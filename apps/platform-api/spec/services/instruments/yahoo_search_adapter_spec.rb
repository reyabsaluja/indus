require "rails_helper"

RSpec.describe Instruments::YahooSearchAdapter do
  class FakeSearchTransport
    attr_reader :request

    def initialize(body) = @body = body

    def start(*)
      body = @body
      http = Object.new
      owner = self
      http.define_singleton_method(:request) do |request|
        owner.instance_variable_set(:@request, request)
        response = Net::HTTPOK.new("1.1", "200", "OK")
        response.instance_variable_set(:@read, true)
        response.body = body
        response
      end
      yield http
    end
  end

  it "omits an absent exchange rather than returning a contract-invalid null" do
    body = { quotes: [ { symbol: "AAPL", shortname: "Apple Inc.", quoteType: "EQUITY" } ] }.to_json
    result = described_class.new(transport: FakeSearchTransport.new(body)).search(query: "apple", limit: 5)
    expect(result).to eq([ { symbol: "AAPL", name: "Apple Inc.", instrument_type: "equity" } ])
    expect(result.first).not_to have_key(:exchange)
  end

  it "bounds results and filters unsupported or malformed instruments" do
    body = { quotes: [
      { symbol: "aapl", shortname: "Apple Inc.", quoteType: "EQUITY", exchange: "NMS" },
      { symbol: "BTC/USD", longname: "Bitcoin", quoteType: "CRYPTOCURRENCY" },
      { symbol: "BAD SYMBOL", shortname: "Bad", quoteType: "EQUITY" },
      { symbol: "EURUSD=X", shortname: "Forex", quoteType: "CURRENCY" },
      { symbol: "MSFT", quoteType: "EQUITY" }
    ] }.to_json
    transport = FakeSearchTransport.new(body)

    result = described_class.new(transport: transport).search(query: " apple & bitcoin ", limit: 4)

    expect(result).to eq([
      { symbol: "AAPL", name: "Apple Inc.", instrument_type: "equity", exchange: "NMS" },
      { symbol: "BTC/USD", name: "Bitcoin", instrument_type: "crypto" }
    ])
    query = URI.decode_www_form(transport.request.uri.query).to_h
    expect(query).to include("q" => " apple & bitcoin ", "quotesCount" => "4", "newsCount" => "0")
  end

  it "normalizes malformed JSON and transport failures" do
    expect { described_class.new(transport: FakeSearchTransport.new("provider payload")).search(query: "apple", limit: 5) }
      .to raise_error(FundamentalsProvider::Error, /JSON::ParserError/)

    transport = Class.new do
      def self.start(*) = raise(SocketError)
    end
    expect { described_class.new(transport: transport).search(query: "apple", limit: 5) }
      .to raise_error(FundamentalsProvider::Error, /SocketError/)
  end
end
