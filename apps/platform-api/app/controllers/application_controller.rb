class ApplicationController < ActionController::API
  include Pundit::Authorization
  include IdempotentMutation
  include ApiSerialization

  before_action :authenticate!
  around_action :enforce_idempotent_mutation, if: :mutation_request?

  rescue_from Authentication::Unauthorized, with: :render_unauthorized
  rescue_from Pundit::NotAuthorizedError, with: :render_forbidden
  rescue_from ActiveRecord::RecordNotFound, with: :render_not_found
  rescue_from ActiveRecord::RecordInvalid, with: :render_invalid
  rescue_from AiUsageLimiter::LimitExceeded, with: :render_rate_limited
  rescue_from ActionController::BadRequest, ActionController::ParameterMissing, with: :render_bad_request
  rescue_from ModelGateway::Error, with: :render_model_failure
  rescue_from FundamentalsProvider::Error, with: :render_upstream_failure
  rescue_from FundamentalsProvider::InvalidSymbol, with: :render_bad_request
  rescue_from FundamentalsProvider::NotFound, with: :render_not_found
  rescue_from ActiveRecord::RecordNotUnique, with: :render_conflict
  rescue_from ActiveRecord::DeleteRestrictionError, ActiveRecord::InvalidForeignKey, with: :render_conflict

  private

  def pundit_user = Current.user

  def authenticate!
    claims = Authentication.verifier.verify(bearer_token)
    email = claims["email"].to_s
    raise Authentication::Unauthorized, "verified token is missing an email" unless email.match?(URI::MailTo::EMAIL_REGEXP)
    display_name = claims.dig("user_metadata", "name") || claims["name"] || email.split("@").first
    Current.request_id = request.request_id
    Current.user = User.create_or_find_by!(issuer: claims.fetch("iss"), external_subject: claims.fetch("sub")) do |user|
      user.email = email
      user.display_name = display_name
    end
  end

  def bearer_token
    scheme, token = request.authorization.to_s.split(" ", 2)
    raise Authentication::Unauthorized, "missing bearer token" unless scheme == "Bearer" && token.present?

    token
  end

  def render_unauthorized(_error) = render_problem(status: :unauthorized, code: "unauthorized", title: "Authentication required")
  def render_forbidden = render_problem(status: :forbidden, code: "forbidden", title: "Operation forbidden")
  def render_not_found = render_problem(status: :not_found, code: "not_found", title: "Resource not found")

  def render_invalid(error)
    if error.record.errors.details.values.flatten.any? { |detail| detail[:error] == :taken }
      return render_conflict
    end
    errors = error.record.errors.map do |entry|
      { code: "invalid_field", pointer: "/#{entry.attribute}", detail: entry.message.to_s.byteslice(0, 500) }
    end
    render_problem(status: :unprocessable_content, code: "validation_failed", title: "Validation failed", errors: errors)
  end

  def render_rate_limited
    response.set_header("Retry-After", "3600")
    render_problem(status: :too_many_requests, code: "rate_limited", title: "Request quota exceeded")
  end

  def render_bad_request(error) = render_problem(status: :bad_request, code: "bad_request", title: "Malformed request", detail: error.message)
  def render_model_failure(error)
    return render_bad_request(error) if error.category == :invalid_request

    render_upstream_failure
  end
  def render_upstream_failure = render_problem(status: :bad_gateway, code: "upstream_unavailable", title: "Upstream provider unavailable")
  def render_conflict = render_problem(status: :conflict, code: "resource_conflict", title: "Resource conflict")

  def render_problem(status:, code:, title:, detail: nil, errors: nil)
    numeric_status = Rack::Utils.status_code(status)
    record_failed_mutation(code, numeric_status) if numeric_status >= 400
    body = { type: "about:blank", title: title, status: numeric_status, code: code,
      request_id: request.request_id.presence || SecureRandom.uuid }
    body[:detail] = detail.to_s.byteslice(0, 2_000) if detail.present?
    body[:errors] = errors if errors.present?
    render json: body, status: numeric_status, content_type: "application/problem+json"
  end

  def record_failed_mutation(code, status)
    return unless mutation_request? && Current.user

    uuid = /\A[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\z/i
    resource_id = params[:id].to_s if params[:id].to_s.match?(uuid)
    AuditEvent.create!(user: Current.user, action: "#{controller_name}.#{action_name}",
      resource_type: controller_name.singularize.classify, resource_id: resource_id,
      metadata: { request_id: request.request_id, method: request.request_method, path: request.path,
        outcome: "failure", status: status, error_code: code }, occurred_at: Time.current)
  end
end
