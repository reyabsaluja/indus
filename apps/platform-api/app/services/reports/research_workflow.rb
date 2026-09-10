require "temporalio/retry_policy"
require "temporalio/workflow"

module Reports
  class ResearchWorkflow < Temporalio::Workflow::Definition
    ACTIVITY_RETRY = Temporalio::RetryPolicy.new(initial_interval: 1, backoff_coefficient: 2, max_interval: 30,
      max_attempts: 5, non_retryable_error_types: [ "Reports::ReportCancelled", "ActiveRecord::RecordNotFound" ])
    MODEL_RETRY = Temporalio::RetryPolicy.new(initial_interval: 2, backoff_coefficient: 2, max_interval: 30,
      max_attempts: 3, non_retryable_error_types: [ "Reports::ReportCancelled" ])

    def execute(input)
      execute_activity(StartReportActivity, input, timeout: 30)
      evidence = execute_activity(LoadReportEvidenceActivity, input, timeout: 30)
      generation = execute_activity(GenerateReportActivity, input.merge("evidence" => evidence), timeout: 120,
        retry_policy: MODEL_RETRY)
      execute_activity(PersistReportActivity, input.merge("evidence" => evidence, "generation" => generation), timeout: 60)
    rescue Temporalio::Error::CanceledError
      cleanup_activity(MarkReportCancelledActivity, input)
      raise
    rescue Temporalio::Error::ActivityError
      cleanup_activity(MarkReportFailedActivity, input.merge("failure_code" => "workflow_activity_failed"))
      raise
    end

    private

    def execute_activity(activity, input, timeout:, retry_policy: ACTIVITY_RETRY)
      Temporalio::Workflow.execute_activity(activity, input, start_to_close_timeout: timeout,
        schedule_to_close_timeout: 300, heartbeat_timeout: [ timeout / 2, 10 ].max, retry_policy: retry_policy)
    end

    def cleanup_activity(activity, input)
      Temporalio::Workflow.execute_activity(activity, input, start_to_close_timeout: 30, schedule_to_close_timeout: 60,
        retry_policy: ACTIVITY_RETRY, cancellation: Temporalio::Cancellation.new)
    end
  end
end
