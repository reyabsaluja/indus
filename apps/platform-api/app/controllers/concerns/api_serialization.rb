require "base64"

module ApiSerialization
  private

  def contract_params(*allowed, required: [])
    payload = request.request_parameters.stringify_keys
    unknown = payload.keys - allowed.map(&:to_s)
    missing = required.map(&:to_s) - payload.keys
    raise ActionController::BadRequest, "unknown fields: #{unknown.join(', ')}" if unknown.any?
    raise ActionController::ParameterMissing, missing.first if missing.any?

    ActionController::Parameters.new(payload).permit!
  end

  def page(scope)
    size = Integer(params.fetch(:page_size, 25), exception: false)
    raise ActionController::BadRequest, "page_size must be between 1 and 100" unless size&.between?(1, 100)

    scope = scope.where("id > ?", decode_cursor(params[:cursor])) if params[:cursor].present?
    records = scope.order(:id).limit(size + 1).to_a
    next_cursor = records.length > size ? encode_cursor(records[size - 1].id) : nil
    { records: records.first(size), next_cursor: next_cursor }
  end

  def encode_cursor(id) = Base64.urlsafe_encode64(id.to_s, padding: false)

  def decode_cursor(cursor)
    decoded = Base64.urlsafe_decode64(cursor.to_s)
    raise ArgumentError unless decoded.match?(/\A[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\z/)

    decoded
  rescue ArgumentError
    raise ActionController::BadRequest, "invalid cursor"
  end

  def user_json(user)
    { id: user.id, email: user.email, display_name: user.display_name.presence || user.email.to_s.split("@").first,
      created_at: user.created_at.iso8601, updated_at: user.updated_at.iso8601 }
  end

  def favorite_json(favorite)
    { id: favorite.id, symbol: favorite.symbol, instrument_type: favorite.instrument_type,
      created_at: favorite.created_at.iso8601 }
  end

  def portfolio_json(portfolio)
    { id: portfolio.id, name: portfolio.name, base_currency: portfolio.base_currency,
      created_at: portfolio.created_at.iso8601, updated_at: portfolio.updated_at.iso8601 }
  end

  def position_json(position)
    { id: position.id, portfolio_id: position.portfolio_id, symbol: position.symbol,
      instrument_type: position.instrument_type, quantity: decimal(position.quantity),
      average_cost: decimal(position.average_cost), currency: position.currency,
      created_at: position.created_at.iso8601, updated_at: position.updated_at.iso8601 }
  end

  def report_json(report)
    { id: report.id, symbol: report.symbol, portfolio_id: report.portfolio_id,
      title: report.title.presence || "#{report.symbol} research report", status: report.status,
      failure_code: report.failure_code, created_at: report.created_at.iso8601, updated_at: report.updated_at.iso8601 }
  end

  def report_detail_json(report)
    report_json(report).merge(summary: report.summary, content: report.content,
      sources: report.report_sources.order(:id).limit(100).map do |source|
        { label: source.source_reference, as_of: source.created_at.iso8601 }
      end)
  end

  def decimal(value) = value&.to_s("F")
end
