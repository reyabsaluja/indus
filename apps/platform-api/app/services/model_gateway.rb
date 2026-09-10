class ModelGateway
  class Error < StandardError
    attr_reader :category

    def initialize(category = :invalid_response, message = "model request failed")
      @category = category
      super(message)
    end
  end

  MAX_PROMPT_BYTES = 16_000
  SOURCE_SCHEMA = {
    type: "object", required: %w[label as_of], properties: {
      label: { type: "string", minLength: 1, maxLength: 200 },
      uri: { type: "string" }, as_of: { type: "string", format: "date-time" }
    }
  }.freeze
  TASKS = {
    "metric_explanations" => { prompt_version: "v2", evidence: %w[fundamentals] },
    "financial_chat" => { prompt_version: "v2", evidence: %w[fundamentals portfolio] },
    "research_report" => { prompt_version: "v1", evidence: %w[fundamentals portfolio] }
  }.freeze

  def self.default
    @default ||= new(adapter: Models::GeminiAdapter.from_env)
  end

  def initialize(adapter:) = @adapter = adapter

  def generate(prompt:, purpose:, response_schema: nil)
    raise Error.new(:invalid_request, "prompt is empty") if prompt.blank?
    raise Error.new(:invalid_request, "prompt is too large") if prompt.bytesize > MAX_PROMPT_BYTES

    @adapter.generate(prompt: prompt, purpose: purpose, response_schema: response_schema)
  end

  def execute(task:, input:, evidence: ModelEvidence.empty)
    definition = TASKS.fetch(task) { raise ArgumentError, "unknown model task" }
    prompt = { task: task, prompt_version: definition[:prompt_version], allowed_evidence: definition[:evidence],
      citation_policy: "Citations must exactly match a supplied evidence source; return no other citations.",
      input: input, evidence: evidence.context }.to_json
    result = generate(prompt: prompt, purpose: task, response_schema: response_schema(task, input, evidence))
    payload = JSON.parse(result.text)
    validate_payload!(task, payload, input, evidence.citations)
    usage = { input_tokens: result.usage.fetch("promptTokenCount", 0).to_i,
      output_tokens: result.usage.fetch("candidatesTokenCount", 0).to_i }
    ModelExecution.new(payload: payload, model: result.model, usage: usage, task: task,
      prompt_version: definition[:prompt_version])
  rescue JSON::ParserError
    raise Error.new(:invalid_response, "model response is not valid JSON")
  end

  private

  def validate_payload!(task, payload, input, citations)
    valid = case task
    when "metric_explanations"
      explanations = payload["explanations"]
      payload.keys == [ "explanations" ] && explanations.is_a?(Array) && explanations.length == input.fetch(:metrics).length &&
        explanations.all? do |item|
          item.is_a?(Hash) && item.keys.sort == %w[explanation metric sources] &&
            item["metric"].in?(input.fetch(:metrics)) && item["explanation"].to_s.length.between?(1, 5_000) &&
            valid_sources?(item["sources"], citations, required: citations.any?)
        end && explanations.pluck("metric").sort == input.fetch(:metrics).sort
    when "financial_chat"
      message = payload["message"]
      payload.keys.sort == %w[message sources] && message.is_a?(Hash) && message.keys.sort == %w[content role] &&
        message["role"] == "assistant" && message["content"].to_s.length.between?(1, 10_000) &&
        valid_sources?(payload["sources"], citations, required: citations.any?)
    when "research_report"
      valid_report_payload?(payload, input)
    end
    raise Error.new(:invalid_response, "model response does not match the task schema") unless valid
  end

  def valid_report_payload?(payload, input)
    return false unless payload.keys.sort == %w[claims content summary]
    return false unless payload["summary"].is_a?(String) && payload["summary"].length.between?(1, 10_000)
    return false unless payload["content"].is_a?(String) && payload["content"].length.between?(1, 200_000)

    allowed = input.fetch(:evidence).to_h { |source| [ source.fetch("source_id"), source.fetch("as_of") ] }
    claims = payload["claims"]
    claims.is_a?(Array) && claims.length.between?(1, 50) && claims.all? do |claim|
      claim.is_a?(Hash) && claim.keys.sort == %w[as_of sources text] && claim["text"].is_a?(String) &&
        claim["text"].length.between?(1, 5_000) && claim["sources"].is_a?(Array) &&
        claim["sources"].length.between?(1, 10) && claim["sources"].uniq == claim["sources"] &&
        claim["sources"].all? { |source_id| allowed.key?(source_id) } &&
        claim["sources"].any? { |source_id| allowed.fetch(source_id) == claim["as_of"] }
    end
  end

  def valid_sources?(sources, citations, required:)
    return false unless sources.is_a?(Array) && sources.length <= 20
    return false if required && sources.empty?
    return false if citations.empty? && sources.any?

    sources.all? do |source|
      source.is_a?(Hash) && (source.keys - %w[label uri as_of]).empty? && source["label"].to_s.length.between?(1, 200) &&
        valid_source_uri?(source["uri"]) && Time.iso8601(source["as_of"].to_s) && citation_allowed?(source, citations)
    rescue ArgumentError
      false
    end
  end

  def citation_allowed?(source, citations)
    normalized = source.stringify_keys.compact
    citations.any? { |citation| citation.stringify_keys.compact == normalized }
  end

  def valid_source_uri?(value)
    return true if value.nil?
    uri = URI.parse(value.to_s)
    uri.is_a?(URI::HTTP) && uri.host.present?
  rescue URI::InvalidURIError
    false
  end

  def response_schema(task, input, evidence)
    sources = { type: "array", minItems: evidence.citations.any? ? 1 : 0,
      maxItems: evidence.citations.any? ? 20 : 0, items: source_schema(evidence.citations) }
    case task
    when "metric_explanations"
      { type: "object", required: [ "explanations" ], properties: { explanations: { type: "array",
        minItems: input.fetch(:metrics).length, maxItems: input.fetch(:metrics).length, items: { type: "object",
          required: %w[metric explanation sources], properties: { metric: { type: "string", enum: input.fetch(:metrics) },
            explanation: { type: "string", minLength: 1, maxLength: 5_000 }, sources: sources } } } } }
    when "financial_chat"
      { type: "object", required: %w[message sources], properties: {
        message: { type: "object", required: %w[role content], properties: {
          role: { type: "string", enum: [ "assistant" ] }, content: { type: "string", minLength: 1, maxLength: 10_000 } } },
        sources: sources } }
    end
  end

  def source_schema(citations)
    return SOURCE_SCHEMA if citations.empty?

    properties = {
      label: { type: "string", enum: citations.map { |citation| citation[:label] || citation["label"] }.uniq },
      as_of: { type: "string", format: "date-time",
        enum: citations.map { |citation| citation[:as_of] || citation["as_of"] }.uniq }
    }
    uris = citations.filter_map { |citation| citation[:uri] || citation["uri"] }.uniq
    properties[:uri] = { type: "string", enum: uris } if uris.any?
    { type: "object", required: %w[label as_of], properties: properties }
  end
end
