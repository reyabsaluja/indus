FundamentalsSnapshot = Data.define(:symbol, :as_of, :metrics, :source_reference)

class FundamentalsProvider
  class Error < StandardError; end
  class InvalidSymbol < Error; end
  class NotFound < Error; end

  def self.default = Fundamentals::YahooAdapter.new

  def fetch(symbol:) = raise(NotImplementedError)
  def fetch_many(symbols:, timeout:) = raise(NotImplementedError)
end
