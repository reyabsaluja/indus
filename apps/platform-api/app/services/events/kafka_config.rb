require "rdkafka"

module Events
  class KafkaConfig
    def self.build(client_id:, consumer_group: nil)
      config = {
        "bootstrap.servers": ENV.fetch("KAFKA_BROKERS"),
        "client.id": client_id,
        "message.timeout.ms": ENV.fetch("KAFKA_MESSAGE_TIMEOUT_MS", "10000")
      }
      config.merge!("group.id" => consumer_group, "auto.offset.reset" => "earliest", "enable.auto.commit" => false) if consumer_group
      case ENV.fetch("KAFKA_AUTH_MODE", "plaintext")
      when "plaintext"
        config["security.protocol"] = ENV.fetch("KAFKA_SECURITY_PROTOCOL", "PLAINTEXT")
      when "msk_iam"
        config.merge!("security.protocol" => "SASL_SSL", "sasl.mechanisms" => "OAUTHBEARER")
      else
        raise ArgumentError, "KAFKA_AUTH_MODE must be plaintext or msk_iam"
      end
      config
    end

    def self.producer(config)
      return Rdkafka::Config.new(config).producer unless ENV.fetch("KAFKA_AUTH_MODE", "plaintext") == "msk_iam"

      MskIamAuth.build(:producer, config)
    end

    def self.consumer(config)
      return Rdkafka::Config.new(config).consumer unless ENV.fetch("KAFKA_AUTH_MODE", "plaintext") == "msk_iam"

      MskIamAuth.build(:consumer, config)
    end
  end
end
