require "rails_helper"

RSpec.describe Reports::TemporalClient do
  let(:client) { instance_double(Temporalio::Client) }
  subject(:gateway) { described_class.new(client: client) }

  it "starts one bounded workflow using a reject-duplicate workflow ID" do
    allow(client).to receive(:start_workflow)
    input = { "workflow_id" => "report-123", "report_id" => "123" }
    expect(gateway.start_report(input)).to eq(:started)
    expect(client).to have_received(:start_workflow).with(Reports::ResearchWorkflow, input,
      id: "report-123", task_queue: described_class::TASK_QUEUE, execution_timeout: 600, run_timeout: 600,
      id_reuse_policy: Temporalio::WorkflowIDReusePolicy::REJECT_DUPLICATE,
      id_conflict_policy: Temporalio::WorkflowIDConflictPolicy::FAIL)
  end

  it "treats an already-started workflow as a successful duplicate delivery" do
    allow(client).to receive(:start_workflow).and_raise(Temporalio::Error::WorkflowAlreadyStartedError.new(
      workflow_id: "report-123", workflow_type: "ResearchWorkflow", run_id: "run-1"))
    expect(gateway.start_report("workflow_id" => "report-123")).to eq(:duplicate)
  end

  it "cancels the stable workflow handle" do
    handle = instance_double(Temporalio::Client::WorkflowHandle, cancel: true)
    allow(client).to receive(:workflow_handle).with("report-123").and_return(handle)
    gateway.cancel_report("report-123")
    expect(handle).to have_received(:cancel)
  end
end
