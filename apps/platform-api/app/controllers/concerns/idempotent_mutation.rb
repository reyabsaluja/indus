require "digest"

module IdempotentMutation
  IDEMPOTENCY_TTL = 24.hours
  KEY_FORMAT = /\A[A-Za-z0-9._:-]{16,128}\z/
  REPLAYED_RESPONSE_HEADERS = %w[Location].freeze

  private

  def mutation_request? = request.post? || request.patch? || request.put? || request.delete?

  def enforce_idempotent_mutation
    key = request.headers["Idempotency-Key"].to_s
    unless key.match?(KEY_FORMAT)
      raise ActionController::BadRequest, "a valid Idempotency-Key header is required"
    end

    run_idempotent_transaction(key) { yield }
  end

  def run_idempotent_transaction(key)
    attempts = 0
    begin
      IdempotencyRecord.transaction(requires_new: true) do
        record = IdempotencyRecord.find_or_initialize_by(user: Current.user, key: key)
        record.lock! if record.persisted?
        fingerprint = request_fingerprint

        if record.persisted? && record.expires_at > Time.current
          if record.request_fingerprint != fingerprint
            render_idempotency_conflict
          elsif record.response_status
            replay_idempotent_response(record)
          else
            execute_idempotent_mutation(record, fingerprint) { yield }
          end
        else
          execute_idempotent_mutation(record, fingerprint) { yield }
        end
      end
    rescue ActiveRecord::RecordNotUnique
      attempts += 1
      retry if attempts < 2
      raise
    end
  end

  def execute_idempotent_mutation(record, fingerprint)
    record.assign_attributes(request_fingerprint: fingerprint, response_status: nil, response_body: nil,
      expires_at: IDEMPOTENCY_TTL.from_now)
    record.save!
    yield
    record_successful_mutation if response.status.between?(200, 299)
    record.update!(response_status: response.status,
      response_body: { "body" => response.body.to_s, "content_type" => response.media_type,
        "headers" => REPLAYED_RESPONSE_HEADERS.to_h { |header| [ header, response.headers[header] ] }.compact })
  end

  def request_fingerprint
    Digest::SHA256.hexdigest([ request.request_method, request.path, request.query_string, request.raw_post ].join("\n"))
  end

  def replay_idempotent_response(record)
    response.set_header("Idempotency-Replayed", "true")
    self.content_type = record.response_body["content_type"] if record.response_body["content_type"]
    record.response_body.fetch("headers", {}).each { |header, value| response.set_header(header, value) }
    self.response_body = record.response_body.fetch("body")
    self.status = record.response_status
  end

  def render_idempotency_conflict
    render_problem(status: :conflict, code: "idempotency_conflict", title: "Idempotency key conflict")
  end

  def record_successful_mutation
    body = parsed_response_body
    AuditEvent.create!(user: Current.user, action: "#{controller_name}.#{action_name}",
      resource_type: controller_name.singularize.classify, resource_id: body.is_a?(Hash) ? body["id"] : params[:id],
      metadata: { request_id: request.request_id, method: request.request_method, path: request.path,
        outcome: "success", status: response.status }, occurred_at: Time.current)
  end

  def parsed_response_body
    return nil if response.body.blank?

    JSON.parse(response.body)
  rescue JSON::ParserError
    { "result" => response.body.to_s.byteslice(0, 4_096) }
  end
end
