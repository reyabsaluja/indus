require "net/http"

module Instruments
  class YahooSearchAdapter
    ENDPOINT = "https://query2.finance.yahoo.com/v1/finance/search".freeze

    def initialize(transport: Net::HTTP) = @transport = transport

    def search(query:, limit:)
      uri = URI(ENDPOINT)
      uri.query = URI.encode_www_form(q: query, quotesCount: limit, newsCount: 0)
      request = Net::HTTP::Get.new(uri, { "Accept" => "application/json", "User-Agent" => "Indus/1.0" })
      response = @transport.start(uri.host, uri.port, use_ssl: true, open_timeout: 3, read_timeout: 10) do |http|
        http.request(request)
      end
      raise FundamentalsProvider::Error, "instrument provider unavailable" unless response.is_a?(Net::HTTPSuccess)

      JSON.parse(response.body).fetch("quotes", []).first(limit).filter_map do |quote|
        type = instrument_type(quote["quoteType"])
        name = quote["shortname"] || quote["longname"]
        symbol = quote["symbol"].to_s.upcase
        next unless type && name.present? && symbol.match?(/\A[A-Z0-9]+(?:[.\/-][A-Z0-9]+)?\z/)

        { symbol: symbol, name: name.to_s.byteslice(0, 200), instrument_type: type,
          exchange: quote["exchange"].presence }.compact
      end
    rescue JSON::ParserError, SocketError, SystemCallError, Timeout::Error => error
      raise FundamentalsProvider::Error, "instrument provider failed: #{error.class}"
    end

    private

    def instrument_type(type)
      return "equity" if %w[EQUITY ETF].include?(type)
      "crypto" if type == "CRYPTOCURRENCY"
    end
  end
end
