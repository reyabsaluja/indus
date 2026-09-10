require "rails_helper"

RSpec.describe "OpenAPI product boundaries", type: :request do
  let(:claims) { { "iss" => "https://example.supabase.co/auth/v1", "sub" => "contract-user", "email" => "contract@example.test" } }
  let(:verifier) { instance_double(Authentication::TokenVerifier, verify: claims) }
  let(:auth) { { "Authorization" => "Bearer token" } }
  let(:write_headers) { auth.merge("Idempotency-Key" => SecureRandom.uuid) }

  before { allow(Authentication).to receive(:verifier).and_return(verifier) }

  it "returns and updates the current profile with flat JSON" do
    get "/v1/me", headers: auth
    expect(JSON.parse(response.body)).to include("email" => "contract@example.test", "display_name" => "contract")
    patch "/v1/me", params: { display_name: "Contract User" }, headers: write_headers
    expect(response).to have_http_status(:ok)
    expect(JSON.parse(response.body)).to include("display_name" => "Contract User")
  end

  it "pages favorites using contract fields" do
    post "/v1/favorites", params: { symbol: "BTC/USD", instrument_type: "crypto" }, headers: write_headers
    get "/v1/favorites?page_size=1", headers: auth
    body = JSON.parse(response.body)
    expect(body.keys).to contain_exactly("items", "next_cursor")
    expect(body.fetch("items").first.keys).to contain_exactly("id", "symbol", "instrument_type", "created_at")
  end

  it "deletes exactly one favorite by its resource identifier" do
    user = User.create!(issuer: claims.fetch("iss"), external_subject: claims.fetch("sub"),
      email: claims.fetch("email"), display_name: "Contract")
    equity = user.favorites.create!(symbol: "BTC/USD", instrument_type: "equity")
    crypto = user.favorites.create!(symbol: "BTC/USD", instrument_type: "crypto")

    delete "/v1/favorites/#{crypto.id}", headers: write_headers

    expect(response).to have_http_status(:no_content)
    expect(Favorite.pluck(:id)).to eq([ equity.id ])
    expect(AuditEvent.last.resource_id).to eq(crypto.id)
  end

  it "creates portfolios and positions from flat decimal-safe bodies" do
    post "/v1/portfolios", params: { name: "Core", base_currency: "USD" }, headers: write_headers
    portfolio = JSON.parse(response.body)
    post "/v1/portfolios/#{portfolio.fetch('id')}/positions",
      params: { symbol: "AAPL", instrument_type: "equity", quantity: "2.5", average_cost: "180.25", currency: "USD" },
      headers: write_headers.merge("Idempotency-Key" => SecureRandom.uuid)
    expect(response).to have_http_status(:created)
    expect(JSON.parse(response.body)).to include("quantity" => "2.5", "average_cost" => "180.25", "currency" => "USD")
  end

  it "preserves supported decimal precision and rejects values PostgreSQL would round or overflow" do
    post "/v1/portfolios", params: { name: "Precise", base_currency: "USD" }, headers: write_headers
    portfolio_id = JSON.parse(response.body).fetch("id")
    endpoint = "/v1/portfolios/#{portfolio_id}/positions"

    post endpoint, params: { symbol: "AAPL", instrument_type: "equity", quantity: "0.1234567890",
      average_cost: "123.12345678", currency: "USD" },
      headers: write_headers.merge("Idempotency-Key" => SecureRandom.uuid)
    expect(response).to have_http_status(:created)
    expect(JSON.parse(response.body)).to include("quantity" => "0.123456789", "average_cost" => "123.12345678")

    [
      { symbol: "MSFT", quantity: "1.12345678901", average_cost: "1" },
      { symbol: "NVDA", quantity: "1", average_cost: "1.123456789" }
    ].each do |values|
      post endpoint, params: values.merge(instrument_type: "equity", currency: "USD"),
        headers: write_headers.merge("Idempotency-Key" => SecureRandom.uuid)
      expect(response).to have_http_status(:unprocessable_content)
    end

    post endpoint, params: { symbol: "AMZN", instrument_type: "equity", quantity: 1, average_cost: "1", currency: "USD" },
      headers: write_headers.merge("Idempotency-Key" => SecureRandom.uuid), as: :json
    expect(response).to have_http_status(:bad_request)
    expect(Position.count).to eq(1)
  end

  it "returns a normalized fundamentals snapshot" do
    snapshot = FundamentalsSnapshot.new(symbol: "AAPL", as_of: Time.zone.parse("2026-08-05T10:00:00Z"),
      metrics: { "regularMarketPrice" => 200.0 }, source_reference: "fixture:AAPL")
    provider = instance_double(FundamentalsProvider, fetch: snapshot)
    allow(FundamentalsProvider).to receive(:default).and_return(provider)
    get "/v1/fundamentals/AAPL", headers: auth
    expect(JSON.parse(response.body)).to include("symbol" => "AAPL", "source" => "yahoo",
      "metrics" => { "regularMarketPrice" => 200.0 })
  end

  it "returns a bounded instrument search page" do
    search = instance_double(Instruments::YahooSearchAdapter,
      search: [ { symbol: "AAPL", name: "Apple Inc.", instrument_type: "equity", exchange: "NMS" } ])
    allow(Instruments::YahooSearchAdapter).to receive(:new).and_return(search)
    get "/v1/instruments/search?q=apple&page_size=5", headers: auth
    expect(JSON.parse(response.body)).to eq("items" => [ { "symbol" => "AAPL", "name" => "Apple Inc.",
      "instrument_type" => "equity", "exchange" => "NMS" } ], "next_cursor" => nil)
  end

  it "returns batch explanations and chat in their structured contracts" do
    snapshot = FundamentalsSnapshot.new(symbol: "AAPL", as_of: Time.zone.parse("2026-08-05T10:00:00Z"),
      metrics: { "regularMarketPrice" => 200.0 }, source_reference: "fixture:AAPL")
    allow(FundamentalsProvider).to receive(:default).and_return(instance_double(FundamentalsProvider, fetch: snapshot))
    gateway = instance_double(ModelGateway)
    allow(gateway).to receive(:execute).with(task: "metric_explanations", input: hash_including(metrics: [ "revenue" ]),
      evidence: instance_of(ModelEvidence))
      .and_return(ModelExecution.new(payload: { "explanations" => [ { "metric" => "revenue", "explanation" => "Revenue grew." } ] },
        model: "fixture", usage: { input_tokens: 4, output_tokens: 3 }, task: "metric_explanations", prompt_version: "v2"))
    allow(gateway).to receive(:execute).with(task: "financial_chat", input: hash_including(:messages),
      evidence: instance_of(ModelEvidence))
      .and_return(ModelExecution.new(payload: { "message" => { "role" => "assistant", "content" => "Grounded answer." } },
        model: "fixture", usage: { input_tokens: 5, output_tokens: 2 }, task: "financial_chat", prompt_version: "v2"))
    allow(ModelGateway).to receive(:default).and_return(gateway)

    post "/v1/explanations", params: { symbol: "AAPL", metrics: [ "revenue" ] }, headers: write_headers
    expect(JSON.parse(response.body)).to include("symbol" => "AAPL", "usage" => { "input_tokens" => 4, "output_tokens" => 3 })
    post "/v1/chat", params: { messages: [ { role: "user", content: "Explain revenue" } ] },
      headers: write_headers.merge("Idempotency-Key" => SecureRandom.uuid)
    expect(JSON.parse(response.body).dig("message", "role")).to eq("assistant")
  end

  it "rejects malformed model inputs before quota or provider work" do
    allow(ModelGateway).to receive(:default)
    invalid_requests = [
      [ "/v1/explanations", { symbol: "AAPL", metrics: "revenue" } ],
      [ "/v1/explanations", { symbol: "A" * 21, metrics: [ "revenue" ] } ],
      [ "/v1/chat", { messages: "hello" } ],
      [ "/v1/chat", { messages: { role: "user", content: "hello" } } ],
      [ "/v1/chat", { messages: Array.new(V1::ChatController::MAX_MESSAGES + 1) { { role: "user", content: "hello" } } } ],
      [ "/v1/chat", { messages: [ { role: "user", content: "x" * (V1::ChatController::MAX_MESSAGE_LENGTH + 1) } ] } ],
      [ "/v1/chat", { messages: Array.new(3) { { role: "user", content: "\u{1f680}" * 800 } } } ],
      [ "/v1/chat", { conversation_id: "not-a-uuid", messages: [ { role: "user", content: "hello" } ] } ],
      [ "/v1/chat", { symbol: "A" * 21, messages: [ { role: "user", content: "hello" } ] } ]
    ]
    invalid_requests.each do |path, payload|
      post path, params: payload, headers: write_headers.merge("Idempotency-Key" => SecureRandom.uuid)
      expect(response).to have_http_status(:bad_request)
    end
    expect(AiUsageWindow.count).to eq(0)
    expect(ModelGateway).not_to have_received(:default)
  end

  it "classifies fundamentals validation, absence, and upstream failure" do
    providers = [
      instance_double(FundamentalsProvider, fetch: -> { raise FundamentalsProvider::InvalidSymbol }),
      instance_double(FundamentalsProvider, fetch: -> { raise FundamentalsProvider::NotFound }),
      instance_double(FundamentalsProvider, fetch: -> { raise FundamentalsProvider::Error })
    ]
    expected = %i[bad_request not_found bad_gateway]
    providers.zip(expected).each do |provider, status|
      allow(provider).to receive(:fetch).and_raise(
        status == :bad_request ? FundamentalsProvider::InvalidSymbol :
          status == :not_found ? FundamentalsProvider::NotFound : FundamentalsProvider::Error)
      allow(FundamentalsProvider).to receive(:default).and_return(provider)
      get "/v1/fundamentals/AAPL", headers: auth
      expect(response).to have_http_status(status)
    end
  end

  it "rejects a cursor that is not a canonical UUID" do
    malformed = Base64.urlsafe_encode64("------------------------------------", padding: false)
    get "/v1/favorites?cursor=#{malformed}", headers: auth
    expect(response).to have_http_status(:bad_request)
  end

  it "carries bounded report focus into the durable outbox event" do
    post "/v1/reports", params: { symbol: "AAPL", focus: "Revenue durability" }, headers: write_headers
    expect(response).to have_http_status(:accepted)
    expect(OutboxEvent.last.payload).to include("focus" => "Revenue durability")
  end

  it "maps duplicate owned resources to a conflict" do
    post "/v1/favorites", params: { symbol: "AAPL", instrument_type: "equity" }, headers: write_headers
    post "/v1/favorites", params: { symbol: "AAPL", instrument_type: "equity" },
      headers: write_headers.merge("Idempotency-Key" => SecureRandom.uuid)
    expect(response).to have_http_status(:conflict)
    expect(JSON.parse(response.body)).to include("code" => "resource_conflict")
  end

  it "rejects malformed separated symbols on write boundaries" do
    post "/v1/reports", params: { symbol: "BTC//USD" }, headers: write_headers
    expect(response).to have_http_status(:unprocessable_content)

    post "/v1/portfolios", params: { name: "Symbols", base_currency: "USD" },
      headers: write_headers.merge("Idempotency-Key" => SecureRandom.uuid)
    portfolio_id = JSON.parse(response.body).fetch("id")
    post "/v1/portfolios/#{portfolio_id}/positions",
      params: { symbol: "AAPL-", instrument_type: "equity", quantity: "1", average_cost: "1", currency: "USD" },
      headers: write_headers.merge("Idempotency-Key" => SecureRandom.uuid)
    expect(response).to have_http_status(:unprocessable_content)
  end

  it "allows the configured local SPA origin without reflecting arbitrary origins" do
    options "/v1/me", headers: { "Origin" => "http://localhost:5173", "Access-Control-Request-Method" => "GET" }
    expect(response.headers["Access-Control-Allow-Origin"]).to eq("http://localhost:5173")
    options "/v1/me", headers: { "Origin" => "https://attacker.example", "Access-Control-Request-Method" => "GET" }
    expect(response.headers["Access-Control-Allow-Origin"]).to be_nil

    get "/v1/me", headers: auth.merge("Origin" => "http://localhost:5173")
    expect(response.headers["Access-Control-Expose-Headers"].downcase).to include("x-request-id")
  end
end
