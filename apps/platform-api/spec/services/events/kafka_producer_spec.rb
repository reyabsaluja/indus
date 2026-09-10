require "rails_helper"

RSpec.describe Events::KafkaProducer do
  let(:delivery) { instance_double(Rdkafka::Producer::DeliveryHandle, wait: true) }
  let(:producer) { instance_double(Rdkafka::Producer, produce: delivery, close: true) }
  subject(:publisher) { described_class.new(producer: producer) }

  it "serializes one traceable event and waits for broker acknowledgement" do
    payload = { envelope: { event_id: "event-1" }, status: "queued" }
    headers = { "event_id" => "event-1", "schema_version" => "1" }

    publisher.publish(topic: "reports.lifecycle.v1", key: "report-1", payload: payload, headers: headers)

    expect(producer).to have_received(:produce).with(topic: "reports.lifecycle.v1", key: "report-1",
      payload: JSON.generate(payload), headers: headers)
    expect(delivery).to have_received(:wait).with(max_wait_timeout: 15)
  end

  it "propagates acknowledgement failures and closes the native producer" do
    allow(delivery).to receive(:wait).and_raise(StandardError, "broker acknowledgement timed out")

    expect do
      publisher.publish(topic: "reports.lifecycle.v1", key: "report-1", payload: {}, headers: {})
    end.to raise_error(StandardError, "broker acknowledgement timed out")

    publisher.close
    expect(producer).to have_received(:close)
  end
end
