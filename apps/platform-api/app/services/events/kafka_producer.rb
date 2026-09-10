module Events
  class KafkaProducer
    def self.from_env
      brokers = ENV.fetch("KAFKA_BROKERS")
      config = KafkaConfig.build(client_id: ENV.fetch("KAFKA_CLIENT_ID", "indus-platform-api"))
        .merge("bootstrap.servers": brokers, "enable.idempotence": true, "acks": "all")
      new(producer: KafkaConfig.producer(config))
    end

    def initialize(producer:)
      @producer = producer
    end

    def publish(topic:, key:, payload:, headers: {})
      handle = @producer.produce(topic: topic, key: key.to_s, payload: JSON.generate(payload), headers: headers)
      handle.wait(max_wait_timeout: 15)
    end

    def close
      @producer.close
    end
  end
end
