module Events
  class OutboxPublisher
    BATCH_SIZE = 100
    MAX_BACKOFF = 300

    def initialize(producer:, clock: Time)
      @producer = producer
      @clock = clock
    end

    def publish_batch(limit: BATCH_SIZE)
      published = 0
      OutboxEvent.unpublished.limit(limit).pluck(:id).each do |event_id|
        published += 1 if publish_one(event_id)
      end
      published
    end

    def publish_one(event_id)
      event = OutboxEvent.find(event_id)
      return false if event.published_at?

      Events::Envelope.validate!(event.payload)
      envelope = event.payload.fetch("envelope")
      @producer.publish(topic: event.topic, key: event.aggregate_id, payload: event.payload,
        headers: { "event_id" => envelope.fetch("event_id"), "correlation_id" => envelope.fetch("correlation_id"),
          "schema_version" => envelope.fetch("schema_version").to_s })
      event.update!(published_at: @clock.current, attempts: event.attempts + 1, next_attempt_at: nil, last_error: nil)
      true
    rescue StandardError => error
      record_failure(event, error) if event
      false
    end

    private

    def record_failure(event, error)
      attempts = event.attempts + 1
      delay = [ 2**[ attempts, 8 ].min, MAX_BACKOFF ].min
      event.update_columns(attempts: attempts, next_attempt_at: @clock.current + delay.seconds,
        last_error: error.class.name.to_s.byteslice(0, 120), updated_at: @clock.current)
    end
  end
end
