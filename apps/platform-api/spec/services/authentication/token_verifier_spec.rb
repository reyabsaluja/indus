require "rails_helper"

RSpec.describe Authentication::TokenVerifier do
  let(:key) { OpenSSL::PKey::RSA.generate(2048) }
  let(:issuer) { "https://identity.example.test" }
  let(:loader) { ->(_url) { { keys: [ JWT::JWK.new(key.public_key, kid: "primary").export ] } } }
  subject(:verifier) do
    described_class.new(issuer: issuer, audience: "authenticated", jwks_url: "https://identity.example.test/jwks",
      algorithms: [ "RS256" ], jwks_loader: loader)
  end

  def token(claims = {})
    JWT.encode({ iss: issuer, sub: "tenant-user", aud: "authenticated", exp: 5.minutes.from_now.to_i }.merge(claims),
      key, "RS256", kid: "primary")
  end

  it "accepts a signed token with the configured issuer and audience" do
    expect(verifier.verify(token)).to include("sub" => "tenant-user")
  end

  it "rejects an expired token" do
    expect { verifier.verify(token(exp: 1.minute.ago.to_i)) }.to raise_error(Authentication::Unauthorized)
  end

  it "rejects a token for another audience" do
    expect { verifier.verify(token(aud: "service-role")) }.to raise_error(Authentication::Unauthorized)
  end

  it "rejects a token without a subject" do
    expect { verifier.verify(token(sub: nil)) }.to raise_error(Authentication::Unauthorized, /subject/)
  end

  it "supports the explicitly configured legacy Supabase HMAC boundary" do
    hmac = described_class.new(issuer: issuer, audience: "authenticated", algorithms: [ "HS256" ], verification_key: "secret")
    signed = JWT.encode({ iss: issuer, sub: "legacy-user", aud: "authenticated", exp: 5.minutes.from_now.to_i }, "secret", "HS256")
    expect(hmac.verify(signed)).to include("sub" => "legacy-user")
  end
end
