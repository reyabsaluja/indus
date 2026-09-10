require "rails_helper"

RSpec.describe Reports::ActivityExecution do
  let(:user) { User.create!(issuer: "fixture", external_subject: SecureRandom.uuid, email: "user@example.test", display_name: "User") }
  let(:report) { user.reports.create!(symbol: "AAPL", title: "AAPL research report") }

  it "persists an activity result and replays it without repeating the side effect" do
    calls = 0
    first = described_class.run(report_id: report.id, activity_key: "model:v1") { calls += 1; { "answer" => 42 } }
    second = described_class.run(report_id: report.id, activity_key: "model:v1") { calls += 1; { "answer" => 43 } }
    expect(first).to eq("answer" => 42)
    expect(second).to eq(first)
    expect(calls).to eq(1)
    expect(report.report_activity_executions.first).to have_attributes(status: "completed", attempts: 1)
  end

  it "records bounded failure metadata and permits a retry" do
    expect do
      described_class.run(report_id: report.id, activity_key: "provider:v1") { raise Timeout::Error }
    end.to raise_error(Timeout::Error)
    expect(report.report_activity_executions.first).to have_attributes(status: "failed", attempts: 1,
      last_error: "Timeout::Error")
    expect(described_class.run(report_id: report.id, activity_key: "provider:v1") { { "ok" => true } }).to eq("ok" => true)
    expect(report.report_activity_executions.first.reload.attempts).to eq(2)
  end

  it "rejects an overlapping delivery while its execution lease is active and recovers a stale lease" do
    execution = ReportActivityExecution.create!(report: report, activity_key: "model:v1", status: "running", attempts: 1,
      lease_expires_at: 1.minute.from_now)
    calls = 0
    expect do
      described_class.run(report_id: report.id, activity_key: "model:v1", lease_seconds: 120) { calls += 1 }
    end.to raise_error(Reports::ActivityExecution::InProgress)
    expect(calls).to eq(0)
    expect(execution.reload.attempts).to eq(1)

    execution.update!(lease_expires_at: 1.second.ago)
    expect(described_class.run(report_id: report.id, activity_key: "model:v1", lease_seconds: 120) { calls += 1; { "ok" => true } })
      .to eq("ok" => true)
    expect(calls).to eq(1)
    expect(execution.reload).to have_attributes(status: "completed", attempts: 2, lease_expires_at: nil)
  end

  it "fails closed after cancellation" do
    report.update!(status: "cancelled")
    expect { described_class.run(report_id: report.id, activity_key: "model:v1") { raise "not reached" } }
      .to raise_error(Reports::ReportCancelled)
  end
end
