require "rails_helper"

RSpec.describe MarketSummary do
  it "normalizes provider snapshots into the web contract" do
    provider = instance_double(FundamentalsProvider)
    allow(provider).to receive(:fetch_many) do |symbols:, timeout:|
      expect(timeout).to be_between(0, MarketSummary::TOTAL_DEADLINE)
      symbols.to_h do |symbol|
        [ symbol, FundamentalsSnapshot.new(symbol: symbol, as_of: Time.current,
          metrics: { "regularMarketPrice" => 100.5, "regularMarketChangePercent" => 1.25, "shortName" => "Name #{symbol}" },
          source_reference: "fixture:#{symbol}") ]
      end
    end

    result = described_class.new(watchlist: %w[AAPL MSFT NVDA], provider: provider).call
    expect(result[:indices]).to all(include(:symbol, price: 100.5, changePercent: 1.25))
    expect(result[:watchlist]).to all(include(:symbol, :name, price: 100.5, changePercent: 1.25))
    expect(provider).to have_received(:fetch_many).once
  end

  it "surfaces provider outages instead of returning a successful empty snapshot" do
    provider = instance_double(FundamentalsProvider)
    allow(provider).to receive(:fetch_many).and_raise(FundamentalsProvider::Error)
    expect { described_class.new(provider: provider).call }.to raise_error(FundamentalsProvider::Error)
  end

  it "omits provider values that violate the bounded response contract" do
    provider = instance_double(FundamentalsProvider)
    allow(provider).to receive(:fetch_many) do |symbols:, **|
      symbols.to_h do |symbol|
        metrics = symbol == "SPY" ? { "regularMarketPrice" => "not-a-number", "regularMarketChangePercent" => 1 } :
          { "regularMarketPrice" => 1, "regularMarketChangePercent" => 0, "shortName" => "x" * 300 }
        [ symbol, FundamentalsSnapshot.new(symbol: symbol, as_of: Time.current, metrics: metrics,
          source_reference: "fixture:#{symbol}") ]
      end
    end

    result = described_class.new(watchlist: [ "AAPL" ], provider: provider).call

    expect(result[:indices].pluck(:symbol)).not_to include("SPY")
    expect(result[:watchlist].first.fetch(:name).length).to eq(200)
  end

  it "batches the bounded watchlist and reuses cached quotes" do
    provider = instance_double(FundamentalsProvider)
    allow(provider).to receive(:fetch_many) do |symbols:, **|
      symbols.to_h do |symbol|
        [ symbol, FundamentalsSnapshot.new(symbol: symbol, as_of: Time.current,
          metrics: { "regularMarketPrice" => 1, "regularMarketChangePercent" => 0 },
          source_reference: "fixture:#{symbol}") ]
      end
    end
    cache = ActiveSupport::Cache::MemoryStore.new
    symbols = 100.times.map { |index| "S#{index}" }

    2.times { described_class.new(watchlist: symbols, provider: provider, cache: cache).call }

    expect(provider).to have_received(:fetch_many).exactly(5).times
    expect(provider).to have_received(:fetch_many).at_least(:once) do |symbols:, **|
      expect(symbols.length).to be <= MarketSummary::BATCH_SIZE
    end
  end

  it "stops before starting another batch after the overall deadline" do
    ticks = [ 0.0, 0.0, 6.0 ]
    provider = instance_double(FundamentalsProvider)
    allow(provider).to receive(:fetch_many).and_return({})

    expect do
      described_class.new(watchlist: 30.times.map { |index| "S#{index}" }, provider: provider,
        clock: -> { ticks.shift || 6.0 }).call
    end.to raise_error(FundamentalsProvider::Error, /deadline/)
    expect(provider).to have_received(:fetch_many).once
  end
end
