class MarketSummary
  INDICES = %w[SPY DIA QQQ].freeze
  BATCH_SIZE = 25
  CACHE_TTL = 30.seconds
  TOTAL_DEADLINE = 5.0

  def initialize(watchlist: [], provider: FundamentalsProvider.default, cache: Rails.cache,
    deadline: TOTAL_DEADLINE, clock: -> { Process.clock_gettime(Process::CLOCK_MONOTONIC) })
    @watchlist = watchlist.first(100)
    @provider = provider
    @cache = cache
    @deadline = deadline
    @clock = clock
  end

  def call
    watchlist_symbols = @watchlist.map { |favorite| favorite.respond_to?(:symbol) ? favorite.symbol : favorite }
    snapshots = load_snapshots((INDICES + watchlist_symbols).uniq)
    { indices: quote_json(INDICES, snapshots, include_name: false),
      watchlist: quote_json(watchlist_symbols, snapshots, include_name: true) }
  end

  private

  def load_snapshots(symbols)
    started_at = @clock.call
    snapshots = symbols.filter_map do |symbol|
      snapshot = read_cache(symbol)
      [ symbol, snapshot ] if snapshot
    end.to_h
    missing = symbols - snapshots.keys
    missing.each_slice(BATCH_SIZE) do |batch|
      remaining = @deadline - (@clock.call - started_at)
      raise FundamentalsProvider::Error, "market summary deadline exceeded" unless remaining.positive?

      fetched = @provider.fetch_many(symbols: batch, timeout: remaining)
      fetched.each do |symbol, snapshot|
        snapshots[symbol] = snapshot
        write_cache(symbol, snapshot)
      end
    end
    snapshots
  end

  def quote_json(symbols, snapshots, include_name:)
    symbols.filter_map do |symbol|
      snapshot = snapshots[symbol]
      next unless snapshot

      metrics = snapshot.metrics
      price = metrics["regularMarketPrice"]
      change = metrics["regularMarketChangePercent"]
      next unless valid_number?(price, minimum: 0) && valid_number?(change, minimum: -100, maximum: 100_000)

      item = { symbol: symbol, price: price, changePercent: change }
      item[:name] = (metrics["shortName"].presence || symbol).to_s[0, 200] if include_name
      item
    end
  end

  def cache_key(symbol) = "market-summary:v1:#{symbol}"

  def valid_number?(value, minimum:, maximum: Float::INFINITY)
    value.is_a?(Numeric) && value.finite? && value.between?(minimum, maximum)
  end

  def read_cache(symbol)
    @cache.read(cache_key(symbol))
  rescue StandardError
    nil
  end

  def write_cache(symbol, snapshot)
    @cache.write(cache_key(symbol), snapshot, expires_in: CACHE_TTL)
  rescue StandardError
    nil
  end
end
