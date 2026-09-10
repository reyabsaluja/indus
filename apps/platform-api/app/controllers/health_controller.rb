class HealthController < ActionController::API
  def live = render(json: { status: "ok" })

  def ready
    ApplicationRecord.connection.select_value("SELECT 1")
    render json: { status: "ready", checks: { database: "up" } }
  rescue ActiveRecord::ActiveRecordError
    response.set_header("Retry-After", "5")
    render json: { type: "about:blank", title: "Service not ready", status: 503, code: "service_unavailable",
      request_id: request.request_id.presence || SecureRandom.uuid, detail: "database check failed" },
      status: :service_unavailable, content_type: "application/problem+json"
  end
end
