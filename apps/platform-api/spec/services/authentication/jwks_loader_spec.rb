require "rails_helper"

RSpec.describe Authentication::JwksLoader do
  class MutableJwksClock
    attr_accessor :now

    def initialize(now) = @now = now
  end

  let(:clock) { MutableJwksClock.new(Time.utc(2026, 8, 5, 12)) }
  let(:loader) { described_class.new(ttl: 60, clock: clock) }
  let(:url) { "https://identity.example.test/.well-known/jwks.json" }

  it "caches a successful HTTPS response until its TTL expires" do
    response = instance_double(Net::HTTPSuccess, body: '{"keys":[{"kid":"primary"}]}')
    allow(response).to receive(:is_a?).with(Net::HTTPSuccess).and_return(true)
    allow(Net::HTTP).to receive(:start).and_yield(instance_double(Net::HTTP, get: response))

    expect(loader.call(url)).to eq("keys" => [ { "kid" => "primary" } ])
    clock.now += 30
    expect(loader.call(url)).to eq("keys" => [ { "kid" => "primary" } ])
    expect(Net::HTTP).to have_received(:start).once.with("identity.example.test", 443,
      use_ssl: true, open_timeout: 2, read_timeout: 3)

    clock.now += 31
    loader.call(url)
    expect(Net::HTTP).to have_received(:start).twice
  end

  it "rejects non-HTTPS URLs without opening a connection" do
    allow(Net::HTTP).to receive(:start)

    expect { loader.call("http://identity.example.test/jwks") }
      .to raise_error(Authentication::JwksLoader::FetchError, /must use HTTPS/)
    expect(Net::HTTP).not_to have_received(:start)
  end

  it "does not cache failed or malformed responses" do
    failed = instance_double(Net::HTTPServiceUnavailable, code: "503")
    allow(failed).to receive(:is_a?).with(Net::HTTPSuccess).and_return(false)
    malformed = instance_double(Net::HTTPSuccess, body: "provider payload")
    allow(malformed).to receive(:is_a?).with(Net::HTTPSuccess).and_return(true)
    http = instance_double(Net::HTTP)
    allow(http).to receive(:get).and_return(failed, malformed)
    allow(Net::HTTP).to receive(:start).and_yield(http)

    expect { loader.call(url) }.to raise_error(Authentication::JwksLoader::FetchError, /returned 503/)
    expect { loader.call(url) }.to raise_error(Authentication::JwksLoader::FetchError, /JSON::ParserError/)
    expect(http).to have_received(:get).twice
  end
end
