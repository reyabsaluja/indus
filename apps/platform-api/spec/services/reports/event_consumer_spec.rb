require "rails_helper"

RSpec.describe Reports::EventConsumer do
  let(:user) do
    User.create!(issuer: "fixture", external_subject: SecureRandom.uuid, email: "consumer@example.test",
      display_name: "Consumer")
  end
  let(:report) { user.reports.create!(symbol: "AAPL", title: "AAPL research report") }
  let(:temporal) { instance_double(Reports::TemporalClient, start_report: :started) }
  let(:message_class) { Struct.new(:payload) }
  let(:consumer_class) do
    Class.new do
      attr_reader :stored, :commits

      def initialize(messages)
        @messages = messages
        @stored = []
        @commits = []
        @closed = false
      end

      def each(&block) = @messages.each(&block)
      def store_offset(message) = @stored << message
      def commit(*arguments) = @commits << arguments
      def close = @closed = true
      def closed? = @closed
    end
  end

  it "starts a queued report once while committing duplicate deliveries" do
    message = message_class.new(JSON.generate(queued_payload))
    consumer = consumer_class.new([ message, message ])

    described_class.new(consumer: consumer, temporal: temporal).run

    expect(temporal).to have_received(:start_report).once.with(hash_including(
      "report_id" => report.id, "workflow_id" => "report-#{report.id}"))
    expect(ConsumedEvent.count).to eq(1)
    expect(consumer.stored).to eq([ message, message ])
    expect(consumer.commits).to eq([ [ nil, false ], [ nil, false ] ])
    expect(consumer).to be_closed
  end

  it "commits malformed and unsupported events without starting work" do
    unsupported = queued_payload
    unsupported["envelope"]["schema_version"] = 2
    messages = [ message_class.new("not-json"), message_class.new(JSON.generate(unsupported)) ]
    consumer = consumer_class.new(messages)

    described_class.new(consumer: consumer, temporal: temporal).run

    expect(temporal).not_to have_received(:start_report)
    expect(ConsumedEvent.count).to eq(0)
    expect(consumer.stored).to eq(messages)
    expect(consumer.commits.length).to eq(2)
    expect(consumer).to be_closed
  end

  it "leaves the offset and receipt uncommitted when workflow startup fails" do
    allow(temporal).to receive(:start_report).and_raise("temporal unavailable")
    consumer = consumer_class.new([ message_class.new(JSON.generate(queued_payload)) ])

    expect { described_class.new(consumer: consumer, temporal: temporal).run }
      .to raise_error("temporal unavailable")

    expect(ConsumedEvent.count).to eq(0)
    expect(report.reload.workflow_id).to be_nil
    expect(consumer.stored).to be_empty
    expect(consumer.commits).to be_empty
    expect(consumer).to be_closed
  end

  def queued_payload
    { "envelope" => Events::Envelope.build(event_id: SecureRandom.uuid, event_type: "report.queued",
      tenant_id: user.id, correlation_id: "request-1", idempotency_key: "request-1").deep_stringify_keys,
      "report_id" => report.id, "workflow_id" => "report-#{report.id}", "status" => "queued" }
  end
end
