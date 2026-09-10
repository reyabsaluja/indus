module Events
  class IdempotentConsumer
    def initialize(name:)
      @name = name
    end

    def process(payload)
      Events::Envelope.validate!(payload)
      event_id = payload.dig("envelope", "event_id")
      ConsumedEvent.transaction do
        return :duplicate if ConsumedEvent.exists?(consumer: @name, event_id: event_id)

        yield payload
        ConsumedEvent.create!(consumer: @name, event_id: event_id, processed_at: Time.current)
      end
      :processed
    rescue ActiveRecord::RecordNotUnique
      :duplicate
    end
  end
end
