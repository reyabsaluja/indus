module Events
  class Envelope
    SCHEMA_VERSION = 1
    PRODUCER = "platform-api"

    def self.build(event_id:, event_type:, tenant_id:, correlation_id:, idempotency_key:, occurred_at: Time.current,
      causation_id: nil)
      {
        event_id: event_id.to_s,
        schema_version: SCHEMA_VERSION,
        event_type: event_type,
        producer: PRODUCER,
        occurred_at: occurred_at.iso8601(6),
        correlation_id: correlation_id.to_s,
        causation_id: causation_id.to_s,
        idempotency_key: idempotency_key.to_s,
        tenant_id: tenant_id.to_s
      }
    end

    def self.validate!(payload)
      envelope = payload.fetch("envelope")
      raise ArgumentError, "unsupported event schema version" unless envelope.fetch("schema_version") == SCHEMA_VERSION

      %w[event_id event_type producer occurred_at correlation_id idempotency_key tenant_id].each do |field|
        raise ArgumentError, "missing event envelope field: #{field}" if envelope[field].blank?
      end
      Time.iso8601(envelope.fetch("occurred_at"))
      payload
    rescue KeyError, TypeError, ArgumentError => error
      raise ArgumentError, "invalid event envelope: #{error.message}"
    end
  end
end
