require "rails_helper"

RSpec.describe Fundamentals::YahooAdapter do
  class FakeFundamentalsTransport
    attr_reader :request

    def initialize(body:) = @body = body

    def start(*)
      http = Object.new
      owner = self
      http.define_singleton_method(:request) do |request|
        owner.instance_variable_set(:@request, request)
        response = Net::HTTPOK.new("1.1", "200", "OK")
        response.instance_variable_set(:@read, true)
        response.body = owner.instance_variable_get(:@body)
        response
      end
      yield http
    end
  end

  it "normalizes a bounded quote fixture" do
    transport = FakeFundamentalsTransport.new(body: file_fixture("yahoo_quote_success.json").read)
    snapshot = described_class.new(transport: transport).fetch(symbol: "aapl")
    expect(snapshot.to_h).to include(symbol: "AAPL", source_reference: "yahoo:quote:AAPL",
      metrics: include("regularMarketPrice" => 218.27, "shortName" => "Apple Inc."))
    expect(transport.request["User-Agent"]).to eq("Indus/1.0")
  end

  it "fetches a bounded symbol batch in one provider request" do
    body = { quoteResponse: { result: [
      { symbol: "AAPL", regularMarketPrice: 218.27, regularMarketChangePercent: 1.1 },
      { symbol: "MSFT", regularMarketPrice: 410.0, regularMarketChangePercent: -0.2 }
    ] } }.to_json
    transport = FakeFundamentalsTransport.new(body: body)

    snapshots = described_class.new(transport: transport).fetch_many(symbols: %w[aapl MSFT], timeout: 2)

    expect(snapshots.keys).to contain_exactly("AAPL", "MSFT")
    expect(URI.decode_www_form(transport.request.uri.query).to_h).to eq("symbols" => "AAPL,MSFT")
  end

  it "rejects malformed symbols before making a provider request" do
    transport = instance_double(Class)
    expect { described_class.new(transport: transport).fetch(symbol: "bad symbol") }
      .to raise_error(FundamentalsProvider::Error, /invalid symbol/)
  end

  it "classifies absent, malformed, and unavailable provider responses" do
    empty = FakeFundamentalsTransport.new(body: '{"quoteResponse":{"result":[]}}')
    expect { described_class.new(transport: empty).fetch(symbol: "AAPL") }
      .to raise_error(FundamentalsProvider::NotFound)

    malformed = FakeFundamentalsTransport.new(body: "sensitive upstream payload")
    expect { described_class.new(transport: malformed).fetch(symbol: "AAPL") }
      .to raise_error(FundamentalsProvider::Error, /JSON::ParserError/)

    transport = Class.new do
      def self.start(*) = raise(Timeout::Error)
    end
    expect { described_class.new(transport: transport).fetch(symbol: "AAPL") }
      .to raise_error(FundamentalsProvider::Error, /Timeout::Error/)
  end

  it "rejects non-success HTTP responses without exposing their body" do
    transport = Class.new do
      def self.start(*)
        response = Net::HTTPServiceUnavailable.new("1.1", "503", "Unavailable")
        response.instance_variable_set(:@read, true)
        response.body = "sensitive provider payload"
        yield Object.new.tap { |http| http.define_singleton_method(:request) { |_request| response } }
      end
    end

    expect { described_class.new(transport: transport).fetch(symbol: "AAPL") }
      .to raise_error(FundamentalsProvider::Error, "fundamentals provider unavailable")
  end
end
