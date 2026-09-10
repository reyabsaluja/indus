require "temporalio/client"

module Reports
  class TemporalClient
    TASK_QUEUE = "indus-research-reports-v1"

    def self.from_env
      client = Temporalio::Client.connect(ENV.fetch("TEMPORAL_ADDRESS", "temporal:7233"),
        ENV.fetch("TEMPORAL_NAMESPACE", "default"))
      new(client: client)
    end

    def initialize(client:)
      @client = client
    end

    def start_report(input)
      workflow_id = input.fetch("workflow_id")
      @client.start_workflow(Reports::ResearchWorkflow, input, id: workflow_id, task_queue: TASK_QUEUE,
        execution_timeout: 600, run_timeout: 600, id_reuse_policy: Temporalio::WorkflowIDReusePolicy::REJECT_DUPLICATE,
        id_conflict_policy: Temporalio::WorkflowIDConflictPolicy::FAIL)
      :started
    rescue Temporalio::Error::WorkflowAlreadyStartedError
      :duplicate
    end

    def cancel_report(workflow_id)
      @client.workflow_handle(workflow_id).cancel
    end
  end
end
