require "net/http"
require "timeout"

module Fundamentals
  class YahooAdapter < FundamentalsProvider
    ENDPOINT = "https://query1.finance.yahoo.com/v7/finance/quote".freeze
    MAX_BATCH_SIZE = 25
    DEFAULT_TIMEOUT = 10

    def initialize(transport: Net::HTTP) = @transport = transport

    def fetch(symbol:)
      normalized = normalized_symbol(symbol)
      fetch_many(symbols: [ normalized ], timeout: DEFAULT_TIMEOUT).fetch(normalized)
    rescue KeyError
      raise NotFound, "symbol not found"
    end

    def fetch_many(symbols:, timeout:)
      normalized = symbols.map { |symbol| normalized_symbol(symbol) }.uniq
      raise Error, "fundamentals batch is empty" if normalized.empty?
      raise Error, "fundamentals batch is too large" if normalized.length > MAX_BATCH_SIZE
      timeout = Float(timeout)
      raise Error, "fundamentals provider deadline exceeded" unless timeout.positive?

      uri = URI(ENDPOINT)
      uri.query = URI.encode_www_form(symbols: normalized.join(","))
      request = Net::HTTP::Get.new(uri, { "Accept" => "application/json", "User-Agent" => "Indus/1.0" })
      response = Timeout.timeout(timeout) do
        @transport.start(uri.host, uri.port, use_ssl: true, open_timeout: [ 3, timeout ].min,
          read_timeout: [ DEFAULT_TIMEOUT, timeout ].min) do |http|
          http.request(request)
        end
      end
      raise Error, "fundamentals provider unavailable" unless response.is_a?(Net::HTTPSuccess)

      quotes = JSON.parse(response.body).dig("quoteResponse", "result")
      raise Error, "fundamentals provider returned invalid data" unless quotes.is_a?(Array)

      as_of = Time.current
      quotes.filter_map do |quote|
        symbol = quote["symbol"].to_s.upcase
        next unless normalized.include?(symbol)

        [ symbol, FundamentalsSnapshot.new(symbol: symbol, as_of: as_of,
          metrics: quote.slice("marketCap", "trailingPE", "forwardPE", "epsTrailingTwelveMonths", "regularMarketPrice",
            "regularMarketChangePercent", "shortName"), source_reference: "yahoo:quote:#{symbol}") ]
      end.to_h
    rescue ArgumentError, JSON::ParserError, SocketError, SystemCallError, Timeout::Error => error
      raise Error, "fundamentals provider failed: #{error.class}"
    end

    private

    def normalized_symbol(symbol)
      normalized = symbol.to_s.upcase
      valid = normalized.match?(/\A[A-Z0-9]+(?:[.\/-][A-Z0-9]+)?\z/) && normalized.length <= 20
      raise InvalidSymbol, "invalid symbol" unless valid

      normalized
    end
  end
end
