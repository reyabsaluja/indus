require "rails_helper"

RSpec.describe ModelGateway do
  let(:result) { ModelResult.new(text: "Revenue grew.", model: "test-model", usage: {}) }
  let(:adapter) { instance_double(Models::GeminiAdapter, generate: result) }
  let(:citation) { { "label" => "Quarterly filing", "as_of" => "2026-06-30T00:00:00Z" } }
  let(:evidence) { ModelEvidence.new(context: { filing: { source: citation } }, citations: [ citation ]) }
  subject(:gateway) { described_class.new(adapter: adapter) }

  it "delegates a bounded prompt with its purpose" do
    expect(gateway.generate(prompt: "Explain revenue", purpose: "metric_explanation")).to eq(result)
    expect(adapter).to have_received(:generate)
      .with(prompt: "Explain revenue", purpose: "metric_explanation", response_schema: nil)
  end

  it "classifies empty and oversized prompts as invalid requests before calling a provider" do
    [ "", "x" * (ModelGateway::MAX_PROMPT_BYTES + 1) ].each do |prompt|
      expect { gateway.generate(prompt: prompt, purpose: "test") }
        .to raise_error(ModelGateway::Error) { |error| expect(error.category).to eq(:invalid_request) }
    end
    expect(adapter).not_to have_received(:generate)
  end

  it "owns the task version, evidence policy, response schema, and normalized usage" do
    structured = ModelResult.new(text: { explanations: [ { metric: "revenue", explanation: "Revenue grew.",
      sources: [ citation ] } ] }.to_json, model: "test-model",
      usage: { "promptTokenCount" => 12, "candidatesTokenCount" => 8 })
    captured = nil
    allow(adapter).to receive(:generate) { |**arguments| captured = arguments; structured }

    execution = gateway.execute(task: "metric_explanations",
      input: { symbol: "AAPL", metrics: [ "revenue" ] }, evidence: evidence)

    prompt = JSON.parse(captured.fetch(:prompt))
    expect(prompt).to include("task" => "metric_explanations", "prompt_version" => "v2",
      "allowed_evidence" => [ "fundamentals" ], "evidence" => include("filing"))
    expect(captured.fetch(:response_schema)).to include(type: "object", required: [ "explanations" ])
    source_schema = captured.dig(:response_schema, :properties, :explanations, :items, :properties, :sources, :items)
    expect(source_schema.dig(:properties, :label, :enum)).to eq([ "Quarterly filing" ])
    expect(execution.to_h).to include(model: "test-model", usage: { input_tokens: 12, output_tokens: 8 },
      prompt_version: "v2")
  end

  it "rejects provider JSON that does not match the task schema" do
    allow(adapter).to receive(:generate).and_return(ModelResult.new(text: '{"explanations":[]}', model: "test", usage: {}))
    expect { gateway.execute(task: "metric_explanations", input: { symbol: "AAPL", metrics: [ "revenue" ] }) }
      .to raise_error(ModelGateway::Error) { |error| expect(error.category).to eq(:invalid_response) }
  end

  it "classifies non-JSON provider output without returning it" do
    allow(adapter).to receive(:generate).and_return(ModelResult.new(text: "sensitive provider payload", model: "test", usage: {}))

    expect { gateway.execute(task: "financial_chat", input: { messages: [ { role: "user", content: "Hello" } ] }) }
      .to raise_error(ModelGateway::Error) { |error|
        expect(error.category).to eq(:invalid_response)
        expect(error.message).not_to include("sensitive")
      }
  end

  it "rejects malformed chat roles, content, and citation schemes" do
    invalid = [
      { "message" => { "role" => "user", "content" => "Wrong role" }, "sources" => [] },
      { "message" => { "role" => "assistant", "content" => "" }, "sources" => [] },
      { "message" => { "role" => "assistant", "content" => "Answer" },
        "sources" => [ { "label" => "Source", "uri" => "file:///secret", "as_of" => "2026-08-05T12:00:00Z" } ] }
    ]

    invalid.each do |payload|
      allow(adapter).to receive(:generate).and_return(ModelResult.new(text: payload.to_json, model: "test", usage: {}))
      expect { gateway.execute(task: "financial_chat", input: { messages: [ { role: "user", content: "Hello" } ] }) }
        .to raise_error(ModelGateway::Error) { |error| expect(error.category).to eq(:invalid_response) }
    end
  end

  it "accepts the versioned explanation and chat golden fixtures when their citations are supplied" do
    explanation = ModelResult.new(text: file_fixture("model_explanations_golden.json").read, model: "fixture", usage: {})
    chat = ModelResult.new(text: file_fixture("model_chat_golden.json").read, model: "fixture", usage: {})
    allow(adapter).to receive(:generate).and_return(explanation, chat)

    expect(gateway.execute(task: "metric_explanations", input: { symbol: "AAPL", metrics: [ "revenue" ] },
      evidence: evidence).prompt_version).to eq("v2")
    expect(gateway.execute(task: "financial_chat", input: { messages: [ { role: "user", content: "Revenue?" } ] },
      evidence: evidence).payload).to include("message" => include("role" => "assistant"))
  end

  it "rejects fabricated or unrelated citations even when their shape is valid" do
    fabricated = { "message" => { "role" => "assistant", "content" => "Unsupported answer" },
      "sources" => [ { "label" => "Unrelated annual report", "as_of" => "2026-06-30T00:00:00Z" } ] }
    allow(adapter).to receive(:generate).and_return(ModelResult.new(text: fabricated.to_json, model: "fixture", usage: {}))

    expect do
      gateway.execute(task: "financial_chat", input: { messages: [ { role: "user", content: "Revenue?" } ] }, evidence: evidence)
    end.to raise_error(ModelGateway::Error) { |error| expect(error.category).to eq(:invalid_response) }
  end

  it "rejects incomplete explanations and excessive citations" do
    excessive_sources = Array.new(21) { citation }
    invalid = [
      { "explanations" => [ { "metric" => "revenue", "explanation" => "One", "sources" => [ citation ] },
        { "metric" => "revenue", "explanation" => "Two", "sources" => [ citation ] } ] },
      { "explanations" => [ { "metric" => "revenue", "explanation" => "One", "sources" => excessive_sources } ] }
    ]
    invalid.each do |payload|
      allow(adapter).to receive(:generate).and_return(ModelResult.new(text: payload.to_json, model: "fixture", usage: {}))
      metrics = payload["explanations"].length == 2 ? %w[revenue earnings] : [ "revenue" ]
      expect { gateway.execute(task: "metric_explanations", input: { symbol: "AAPL", metrics: metrics }, evidence: evidence) }
        .to raise_error(ModelGateway::Error) { |error| expect(error.category).to eq(:invalid_response) }
    end
  end
end
