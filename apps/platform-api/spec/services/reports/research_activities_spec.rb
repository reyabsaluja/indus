require "rails_helper"

RSpec.describe "durable report activities" do
  let(:user) { User.create!(issuer: "fixture", external_subject: SecureRandom.uuid, email: "user@example.test", display_name: "User") }
  let(:report) { user.reports.create!(symbol: "AAPL", title: "AAPL research report") }
  let(:heartbeat) { instance_double(Temporalio::Activity::Context, heartbeat: true) }
  let(:as_of) { Time.zone.parse("2026-08-05T12:00:00Z") }
  let(:input) { { "report_id" => report.id, "workflow_id" => "report-#{report.id}", "correlation_id" => "request-1" } }

  before { allow(Temporalio::Activity::Context).to receive(:current).and_return(heartbeat) }

  it "grounds, stores, and completes exactly once when activities are redelivered" do
    provider = instance_double(FundamentalsProvider, fetch: FundamentalsSnapshot.new(symbol: "AAPL", as_of: as_of,
      metrics: { "revenue" => 100 }, source_reference: "fixture:AAPL"))
    allow(FundamentalsProvider).to receive(:default).and_return(provider)
    payload = { "summary" => "Revenue is stable.", "content" => "## Revenue\nStable.", "claims" => [
      { "text" => "Revenue is stable.", "sources" => [ "fundamentals:fixture:AAPL" ], "as_of" => as_of.iso8601(6) }
    ] }
    gateway = instance_double(ModelGateway, execute: ModelExecution.new(payload: payload, model: "fixture", usage: {},
      task: "research_report", prompt_version: "v1"))
    allow(ModelGateway).to receive(:default).and_return(gateway)
    store = instance_double(Reports::ArtifactStore,
      put: "reports/#{user.id}/#{report.id}.json")
    allow(Reports::ArtifactStore).to receive(:from_env).and_return(store)

    Reports::StartReportActivity.new.execute(input)
    evidence = Reports::LoadReportEvidenceActivity.new.execute(input)
    generation = Reports::GenerateReportActivity.new.execute(input.merge("evidence" => evidence))
    result = Reports::PersistReportActivity.new.execute(input.merge("evidence" => evidence, "generation" => generation))
    Reports::PersistReportActivity.new.execute(input.merge("evidence" => evidence, "generation" => generation))

    expect(result).to include("status" => "completed")
    expect(report.reload).to have_attributes(status: "completed", summary: "Revenue is stable.", model: "fixture")
    expect(report.report_sources.count).to eq(1)
    expect(store).to have_received(:put).once
    expect(OutboxEvent.where("payload ->> 'status' = ?", "completed").count).to eq(1)
  end

  it "marks an active report failed once with bounded public failure metadata" do
    report.update!(status: "generating")
    failure_input = input.merge("failure_code" => "provider-" + ("x" * 200))

    first = Reports::MarkReportFailedActivity.new.execute(failure_input)
    second = Reports::MarkReportFailedActivity.new.execute(failure_input)

    expect(first).to eq("status" => "failed")
    expect(second).to eq("status" => "failed")
    expect(report.reload.failure_code.bytesize).to eq(100)
    expect(OutboxEvent.where("payload ->> 'status' = ?", "failed").count).to eq(1)
  end

  it "preserves completed reports when late cancellation cleanup arrives" do
    report.update!(status: "completed", completed_at: Time.current)

    result = Reports::MarkReportCancelledActivity.new.execute(input)

    expect(result).to eq("status" => "completed")
    expect(report.reload.status).to eq("completed")
    expect(OutboxEvent.where("payload ->> 'status' = ?", "cancelled")).to be_empty
  end
end
