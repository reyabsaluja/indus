require "rails_helper"

RSpec.describe Events::OutboxReplay do
  let(:now) { Time.zone.parse("2026-08-05T12:00:00Z") }
  let(:clock) { class_double(Time, current: now) }
  let(:service) { described_class.new(clock: clock) }

  it "previews a bounded failed selection without mutating delivery state" do
    failed = create_event(last_error: "Rdkafka::RdkafkaError", next_attempt_at: now + 5.minutes)
    create_event

    result = service.call(failed: true)

    expect(result.to_h).to eq(event_ids: [ failed.id ], executed: false)
    expect(failed.reload.next_attempt_at).to eq(now + 5.minutes)
  end

  it "makes selected unpublished events immediately eligible while preserving failure history" do
    failed = create_event(last_error: "Rdkafka::RdkafkaError", next_attempt_at: now + 5.minutes)

    result = service.call(event_ids: [ failed.id ], execute: true)

    expect(result.to_h).to eq(event_ids: [ failed.id ], executed: true)
    expect(failed.reload).to have_attributes(published_at: nil, next_attempt_at: nil,
      last_error: "Rdkafka::RdkafkaError", updated_at: now)
  end

  it "requires an explicit opt-in before requeueing a published event" do
    published = create_event(published_at: now - 1.minute)

    expect(service.call(event_ids: [ published.id ], execute: true).event_ids).to be_empty
    result = service.call(event_ids: [ published.id ], include_published: true, execute: true)

    expect(result.event_ids).to eq([ published.id ])
    expect(published.reload.published_at).to be_nil
  end

  it "rejects unbounded selections and excessive limits" do
    expect { service.call }.to raise_error(described_class::SelectionError, /selector/)
    expect { service.call(event_ids: [ "not-a-uuid" ]) }.to raise_error(described_class::SelectionError, /UUID/)
    expect { service.call(failed: true, limit: 1_001) }.to raise_error(described_class::SelectionError, /limit/)
  end

  it "intersects selectors and applies the limit without touching nonmatches" do
    selected = create_event(topic: "reports.lifecycle.v1", last_error: "failed", next_attempt_at: now + 5.minutes,
      created_at: now - 2.minutes)
    create_event(topic: "audit.security.v1", last_error: "failed", created_at: now - 2.minutes)
    newer = create_event(topic: "reports.lifecycle.v1", last_error: "failed", created_at: now + 1.minute)

    result = service.call(topic: "reports.lifecycle.v1", failed: true, created_before: now, limit: 1, execute: true)

    expect(result.event_ids).to eq([ selected.id ])
    expect(selected.reload.next_attempt_at).to be_nil
    expect(newer.reload.last_error).to eq("failed")
  end

  def create_event(**attributes)
    OutboxEvent.create!({ topic: "reports.lifecycle.v1", aggregate_type: "Report", aggregate_id: SecureRandom.uuid,
      payload: { envelope: Events::Envelope.build(event_id: SecureRandom.uuid, event_type: "report.queued",
        tenant_id: SecureRandom.uuid, correlation_id: SecureRandom.uuid, idempotency_key: SecureRandom.uuid) } }.merge(attributes))
  end
end
