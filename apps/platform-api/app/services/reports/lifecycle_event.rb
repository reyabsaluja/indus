module Reports
  class LifecycleEvent
    def self.emit!(report:, previous_status:, correlation_id:, idempotency_key:)
      event = OutboxEvent.new(id: SecureRandom.uuid, topic: "reports.lifecycle.v1", aggregate_type: "Report",
        aggregate_id: report.id)
      event.payload = {
        envelope: Events::Envelope.build(event_id: event.id, event_type: "report.#{report.status}", tenant_id: report.user_id,
          correlation_id: correlation_id, idempotency_key: idempotency_key),
        report_id: report.id, user_id: report.user_id, symbol: report.symbol, previous_status: previous_status,
        status: report.status, workflow_id: report.workflow_id, failure_code: report.failure_code,
        completed_at: report.completed_at&.iso8601(6)
      }
      event.save!
    end
  end
end
