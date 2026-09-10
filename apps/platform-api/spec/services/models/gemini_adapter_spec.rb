require "rails_helper"

RSpec.describe Models::GeminiAdapter do
  class FakeGeminiTransport
    attr_reader :request

    def initialize(body:, status: "200") = (@body, @status = body, status)

    def start(*)
      http = Object.new
      owner = self
      http.define_singleton_method(:request) do |request|
        owner.instance_variable_set(:@request, request)
        response = Net::HTTPResponse::CODE_TO_OBJ.fetch(owner.instance_variable_get(:@status)).new("1.1", owner.instance_variable_get(:@status), "response")
        response.instance_variable_set(:@read, true)
        response.body = owner.instance_variable_get(:@body)
        response
      end
      yield http
    end
  end

  let(:fixture) { file_fixture("gemini_success.json").read }

  it "normalizes provider content and usage" do
    transport = FakeGeminiTransport.new(body: fixture)
    schema = { type: "object", required: [ "message" ] }
    result = described_class.new(api_key: "not-a-real-key", model: "gemini-test", transport: transport)
      .generate(prompt: "Explain revenue", purpose: "metric_explanation", response_schema: schema)

    expect(result.to_h).to eq(text: "Revenue increased 12% year over year.", model: "gemini-test",
      usage: { "promptTokenCount" => 10, "candidatesTokenCount" => 8, "totalTokenCount" => 18 })
    expect(transport.request["x-goog-api-key"]).to eq("not-a-real-key")
    expect(JSON.parse(transport.request.body)).to include("generationConfig" => include(
      "temperature" => 0.2, "responseMimeType" => "application/json", "responseSchema" => schema.stringify_keys))
  end

  it "fails closed when the provider returns no content" do
    transport = FakeGeminiTransport.new(body: '{"candidates":[]}')
    adapter = described_class.new(api_key: "key", model: "gemini-test", transport: transport)
    expect { adapter.generate(prompt: "hello", purpose: "test") }.to raise_error(ModelGateway::Error, /no content/)
  end

  it "turns missing provider configuration into a bounded gateway error" do
    allow(ENV).to receive(:fetch).with("GEMINI_API_KEY").and_raise(KeyError)
    expect { described_class.from_env }.to raise_error(ModelGateway::Error, /not configured/)
  end

  it "classifies provider throttling and availability failures without returning their body" do
    {
      "429" => :rate_limited,
      "500" => :unavailable
    }.each do |status, category|
      adapter = described_class.new(api_key: "key", model: "gemini-test",
        transport: FakeGeminiTransport.new(body: "sensitive provider payload", status: status))

      expect { adapter.generate(prompt: "hello", purpose: "test") }
        .to raise_error(ModelGateway::Error) { |error|
          expect(error.category).to eq(category)
          expect(error.message).not_to include("sensitive")
        }
    end
  end

  it "classifies malformed JSON and network timeouts" do
    malformed = described_class.new(api_key: "key", model: "gemini-test",
      transport: FakeGeminiTransport.new(body: "provider payload"))
    expect { malformed.generate(prompt: "hello", purpose: "test") }
      .to raise_error(ModelGateway::Error) { |error| expect(error.category).to eq(:invalid_response) }

    transport = Class.new do
      def self.start(*) = raise(Timeout::Error)
    end
    unavailable = described_class.new(api_key: "key", model: "gemini-test", transport: transport)
    expect { unavailable.generate(prompt: "hello", purpose: "test") }
      .to raise_error(ModelGateway::Error) { |error| expect(error.category).to eq(:unavailable) }
  end
end
