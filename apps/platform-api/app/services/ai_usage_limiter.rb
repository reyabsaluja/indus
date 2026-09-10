class AiUsageLimiter
  LimitExceeded = Class.new(StandardError)
  MAX_CONFLICT_ATTEMPTS = 2

  def initialize(user:, operation:, now: Time.current, limit: ENV.fetch("AI_REQUESTS_PER_HOUR", 30).to_i)
    @user = user
    @operation = operation
    @window = now.beginning_of_hour
    @limit = limit
  end

  def consume!
    # QuotaRecord owns a dedicated connection pool so this transaction commits even when
    # the caller's idempotent mutation later rolls back after a provider failure.
    attempts = 0
    begin
      AiUsageWindow.transaction(requires_new: true, joinable: false) do
        usage = AiUsageWindow.lock.find_or_create_by!(user_id: @user.id, operation: @operation, window_started_at: @window)
        raise LimitExceeded, "AI request quota exceeded" if usage.request_count >= @limit

        usage.increment!(:request_count)
      end
    rescue ActiveRecord::RecordNotUnique
      attempts += 1
      retry if attempts < MAX_CONFLICT_ATTEMPTS
      raise
    end
  end
end
