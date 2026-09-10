module V1
  class ReportsController < ApplicationController
    def index
      scope = policy_scope(Report)
      if params[:status].present?
        raise ActionController::BadRequest, "invalid report status" unless Report::STATUSES.include?(params[:status])
        scope = scope.where(status: params[:status])
      end
      result = page(scope)
      render json: { items: result[:records].map { |report| report_json(report) }, next_cursor: result[:next_cursor] }
    end

    def show
      report = policy_scope(Report).find(params[:id])
      authorize report
      render json: report_detail_json(report)
    end

    def create
      attributes = contract_params(:symbol, :portfolio_id, :focus, required: [ :symbol ])
      policy_scope(Portfolio).find(attributes[:portfolio_id]) if attributes[:portfolio_id].present?
      if attributes[:focus].present? && (!attributes[:focus].is_a?(String) || !attributes[:focus].length.between?(1, 1_000))
        raise ActionController::BadRequest, "focus must be between 1 and 1000 characters"
      end
      AiUsageLimiter.new(user: Current.user, operation: "report").consume!
      report = Current.user.reports.new(symbol: attributes[:symbol], portfolio_id: attributes[:portfolio_id],
        title: "#{attributes[:symbol].to_s.upcase} research report")
      authorize report
      Report.transaction do
        report.save!
        event = OutboxEvent.new(id: SecureRandom.uuid, topic: "reports.lifecycle.v1", aggregate_type: "Report", aggregate_id: report.id)
        event.payload = { envelope: Events::Envelope.build(event_id: event.id, event_type: "report.queued",
          tenant_id: Current.user.id, correlation_id: request.request_id, idempotency_key: request.headers["Idempotency-Key"]),
          report_id: report.id, user_id: Current.user.id, symbol: report.symbol, previous_status: nil,
          status: report.status, workflow_id: "report-#{report.id}", failure_code: nil, focus: attributes[:focus] }
        event.save!
      end
      response.set_header("Location", "/v1/reports/#{report.id}")
      render json: report_json(report), status: :accepted
    end

    def destroy
      report = policy_scope(Report).find(params[:id])
      authorize report
      report.destroy!
      head :no_content
    end

    def cancel
      report = policy_scope(Report).find(params[:id])
      authorize report, :update?
      if %w[queued generating].include?(report.status)
        Report.transaction do
          report.lock!
          previous_status = report.status
          report.update!(status: "cancelled", failure_code: nil)
          Reports::LifecycleEvent.emit!(report: report, previous_status: previous_status,
            correlation_id: request.request_id, idempotency_key: request.headers["Idempotency-Key"])
        end
        Reports::TemporalClient.from_env.cancel_report(report.workflow_id) if report.workflow_id.present?
      end
      render json: report_json(report.reload)
    end
  end
end
