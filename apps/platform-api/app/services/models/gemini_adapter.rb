require "net/http"

module Models
  class GeminiAdapter
    DEFAULT_MODEL = "gemini-2.5-flash".freeze

    def self.from_env
      new(api_key: ENV.fetch("GEMINI_API_KEY"), model: ENV.fetch("GEMINI_MODEL", DEFAULT_MODEL))
    rescue KeyError
      raise ModelGateway::Error.new(:configuration, "model provider is not configured")
    end

    def initialize(api_key:, model:, transport: Net::HTTP)
      @api_key = api_key
      @model = model
      @transport = transport
    end

    def generate(prompt:, purpose:, response_schema: nil)
      uri = URI("https://generativelanguage.googleapis.com/v1beta/models/#{@model}:generateContent")
      request = Net::HTTP::Post.new(uri, { "Content-Type" => "application/json", "x-goog-api-key" => @api_key })
      generation_config = { temperature: 0.2, maxOutputTokens: 2048, responseMimeType: "application/json" }
      generation_config[:responseSchema] = response_schema if response_schema
      request.body = { system_instruction: { parts: [ { text: system_instruction(purpose) } ] },
        contents: [ { role: "user", parts: [ { text: prompt } ] } ],
        generationConfig: generation_config }.to_json
      response = @transport.start(uri.host, uri.port, use_ssl: true, open_timeout: 3, read_timeout: 30) { |http| http.request(request) }
      unless response.is_a?(Net::HTTPSuccess)
        category = response.code.to_i == 429 ? :rate_limited : :unavailable
        raise ModelGateway::Error.new(category, "model provider request failed")
      end

      parsed = JSON.parse(response.body)
      text = parsed.dig("candidates", 0, "content", "parts")&.filter_map { |part| part["text"] }&.join
      raise ModelGateway::Error.new(:invalid_response, "model provider returned no content") if text.blank?

      usage = parsed.fetch("usageMetadata", {}).slice("promptTokenCount", "candidatesTokenCount", "totalTokenCount")
      ModelResult.new(text: text, model: @model, usage: usage)
    rescue JSON::ParserError
      raise ModelGateway::Error.new(:invalid_response, "model provider returned invalid JSON")
    rescue SocketError, SystemCallError, Timeout::Error => error
      raise ModelGateway::Error.new(:unavailable, "model provider request failed: #{error.class}")
    end

    private

    def system_instruction(purpose)
      "You are Indus's financial research assistant. Purpose: #{purpose}. Use supplied evidence, state uncertainty, and never present personalized investment advice."
    end
  end
end
