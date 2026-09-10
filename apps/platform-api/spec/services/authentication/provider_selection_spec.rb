require "rails_helper"

RSpec.describe "authentication provider selection" do
  before { Authentication.reset! }

  after do
    Authentication.reset!
    ENV.delete("AUTH_PROVIDER")
  end

  it "keeps Supabase as the dormant replacement default" do
    allow(Authentication::SupabaseVerifier).to receive(:from_env).and_return(:supabase)
    expect(Authentication.verifier).to eq(:supabase)
  end

  it "activates Cognito only through explicit configuration" do
    ENV["AUTH_PROVIDER"] = "cognito"
    allow(Authentication::CognitoVerifier).to receive(:from_env).and_return(:cognito)
    expect(Authentication.verifier).to eq(:cognito)
  end

  it "fails closed for an unknown provider" do
    ENV["AUTH_PROVIDER"] = "unknown"
    expect { Authentication.verifier }.to raise_error(Authentication::ConfigurationError)
  end
end
