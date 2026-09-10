require "rails_helper"

RSpec.describe "service health", type: :request do
  it "reports liveness without authentication" do
    get "/healthz"
    expect(response).to have_http_status(:ok)
    expect(JSON.parse(response.body)).to eq("status" => "ok")
  end

  it "reports readiness when PostgreSQL is reachable" do
    get "/readyz"
    expect(response).to have_http_status(:ok)
    expect(JSON.parse(response.body)).to eq("status" => "ready", "checks" => { "database" => "up" })
  end

  it "fails readiness when PostgreSQL raises an operational error" do
    allow(ApplicationRecord.connection).to receive(:select_value).and_raise(ActiveRecord::ConnectionNotEstablished)
    get "/readyz"
    expect(response).to have_http_status(:service_unavailable)
    expect(response.media_type).to eq("application/problem+json")
  end
end
