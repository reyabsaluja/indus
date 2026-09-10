require "rails_helper"

RSpec.describe Events::KafkaConfig do
  around do |example|
    original = ENV.to_h.slice("KAFKA_BROKERS", "KAFKA_AUTH_MODE", "KAFKA_SECURITY_PROTOCOL")
    ENV["KAFKA_BROKERS"] = "broker:9092"
    example.run
  ensure
    %w[KAFKA_BROKERS KAFKA_AUTH_MODE KAFKA_SECURITY_PROTOCOL].each { |key| ENV.delete(key) }
    original.each { |key, value| ENV[key] = value }
  end

  it "uses explicit plaintext transport only for local orchestration" do
    expect(described_class.build(client_id: "test")).to include("security.protocol" => "PLAINTEXT")
  end

  it "configures AWS MSK IAM as SASL/OAUTHBEARER without static Kafka credentials" do
    ENV["KAFKA_AUTH_MODE"] = "msk_iam"
    config = described_class.build(client_id: "test", consumer_group: "consumer-v1")
    expect(config).to include("security.protocol" => "SASL_SSL", "sasl.mechanisms" => "OAUTHBEARER",
      "group.id" => "consumer-v1")
    expect(config.keys).not_to include("sasl.username", "sasl.password")
  end

  it "rejects unknown authentication modes" do
    ENV["KAFKA_AUTH_MODE"] = "scram"
    expect { described_class.build(client_id: "test") }.to raise_error(ArgumentError)
  end
end
