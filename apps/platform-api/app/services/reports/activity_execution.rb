module Reports
  class ActivityExecution
    InProgress = Class.new(StandardError)

    def self.run(report_id:, activity_key:, lease_seconds: 300)
      execution = claim(report_id:, activity_key:, lease_seconds:)
      return execution.result if execution.status == "completed"

      result = yield
      execution.with_lock do
        execution.update!(status: "completed", result: result || {}, last_error: nil, lease_expires_at: nil)
      end
      result
    rescue StandardError => error
      execution&.update!(status: "failed", last_error: error.class.name.to_s.byteslice(0, 120), lease_expires_at: nil)
      raise
    end

    def self.claim(report_id:, activity_key:, lease_seconds:)
      Report.transaction do
        report = Report.lock.find(report_id)
        raise ReportCancelled, "report was cancelled" if report.status == "cancelled"

        execution = ReportActivityExecution.find_or_initialize_by(report: report, activity_key: activity_key)
        execution.lock! if execution.persisted?
        return execution if execution.status == "completed"
        if execution.status == "running" && execution.lease_expires_at&.future?
          raise InProgress, "activity already has an active execution lease"
        end

        execution.assign_attributes(status: "running", attempts: execution.attempts + 1, last_error: nil,
          lease_expires_at: lease_seconds.seconds.from_now)
        execution.save!
        execution
      end
    rescue ActiveRecord::RecordNotUnique
      retry
    end

    private_class_method :claim
  end

  class ReportCancelled < StandardError; end
end
