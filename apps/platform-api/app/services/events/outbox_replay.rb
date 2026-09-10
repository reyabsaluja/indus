module Events
  class OutboxReplay
    MAX_LIMIT = 1_000
    UUID = /\A[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\z/i
    Result = Data.define(:event_ids, :executed)
    SelectionError = Class.new(ArgumentError)

    def initialize(relation: OutboxEvent.all, clock: Time)
      @relation = relation
      @clock = clock
    end

    def call(event_ids: [], topic: nil, failed: false, created_before: nil, include_published: false, limit: 100,
      execute: false)
      normalized_ids = Array(event_ids).compact_blank.map(&:to_s).uniq
      validate_selection!(normalized_ids:, topic:, failed:, created_before:, limit:)
      scope = selected_scope(event_ids: normalized_ids, topic:, failed:, created_before:, include_published:)
      ids = execute ? requeue(scope, limit) : scope.limit(limit).pluck(:id)
      Result.new(event_ids: ids.map(&:to_s), executed: execute)
    end

    private

    def validate_selection!(normalized_ids:, topic:, failed:, created_before:, limit:)
      raise SelectionError, "at least one selector is required" if normalized_ids.empty? && topic.blank? && !failed && !created_before
      raise SelectionError, "event IDs must be UUIDs" unless normalized_ids.all? { |event_id| event_id.match?(UUID) }
      raise SelectionError, "limit must be between 1 and #{MAX_LIMIT}" unless limit.is_a?(Integer) && limit.between?(1, MAX_LIMIT)
    end

    def selected_scope(event_ids:, topic:, failed:, created_before:, include_published:)
      scope = @relation.reorder(:created_at, :id)
      scope = scope.where(id: event_ids) if event_ids.any?
      scope = scope.where(topic:) if topic.present?
      scope = scope.where.not(last_error: nil) if failed
      scope = scope.where("created_at <= ?", created_before) if created_before
      scope = scope.where(published_at: nil) unless include_published
      scope
    end

    def requeue(scope, limit)
      OutboxEvent.transaction do
        ids = scope.lock.limit(limit).pluck(:id)
        @relation.where(id: ids).update_all(published_at: nil, next_attempt_at: nil, updated_at: @clock.current) if ids.any?
        ids
      end
    end
  end
end
