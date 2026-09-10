require "net/http"

module Authentication
  class Unauthorized < StandardError; end

  class << self
    attr_writer :verifier

    def verifier
      @verifier ||= SupabaseVerifier.from_env
    end
  end

  class TokenVerifier
    CLOCK_SKEW = 30

    def initialize(issuer:, audience:, algorithms:, jwks_url: nil, verification_key: nil, jwks_loader: JwksLoader.new)
      @issuer = issuer
      @audience = audience
      @jwks_url = jwks_url
      @algorithms = algorithms
      @verification_key = verification_key
      @jwks_loader = jwks_loader
    end

    def verify(token)
      options = { algorithms: @algorithms, iss: @issuer, verify_iss: true, leeway: CLOCK_SKEW }
      options[:jwks] = @jwks_loader.call(@jwks_url) if @jwks_url
      options.merge!(aud: @audience, verify_aud: true) if @audience.present?
      JWT.decode(token, @verification_key, true, options).first.tap { |claims| validate_subject!(claims) }
    rescue JWT::DecodeError, KeyError, JwksLoader::FetchError => error
      raise Unauthorized, error.message
    end

    private

    def validate_subject!(claims)
      raise Unauthorized, "token subject is missing" if claims["sub"].blank?
    end
  end

  class JwksLoader
    class FetchError < StandardError; end

    def initialize(ttl: 300, clock: Time)
      @ttl = ttl
      @clock = clock
      @cache = {}
      @mutex = Mutex.new
    end

    def call(url)
      @mutex.synchronize do
        cached = @cache[url]
        return cached[:value] if cached && cached[:expires_at] > @clock.now

        @cache[url] = { value: fetch(url), expires_at: @clock.now + @ttl }
        @cache[url][:value]
      end
    end

    private

    def fetch(url)
      uri = URI(url)
      raise FetchError, "JWKS URL must use HTTPS" unless uri.is_a?(URI::HTTPS)

      response = Net::HTTP.start(uri.host, uri.port, use_ssl: true, open_timeout: 2, read_timeout: 3) do |http|
        http.get(uri.request_uri, { "Accept" => "application/json" })
      end
      raise FetchError, "JWKS endpoint returned #{response.code}" unless response.is_a?(Net::HTTPSuccess)

      JSON.parse(response.body)
    rescue JSON::ParserError, SocketError, SystemCallError, Timeout::Error, URI::InvalidURIError => error
      raise FetchError, "JWKS fetch failed: #{error.class}"
    end
  end

  class SupabaseVerifier < TokenVerifier
    def self.from_env
      issuer = ENV.fetch("SUPABASE_JWT_ISSUER")
      common = { issuer: issuer, audience: ENV.fetch("SUPABASE_JWT_AUDIENCE", "authenticated") }
      if ENV["SUPABASE_JWT_SECRET"].present?
        new(**common, algorithms: [ "HS256" ], verification_key: ENV.fetch("SUPABASE_JWT_SECRET"))
      else
        new(**common, jwks_url: ENV.fetch("SUPABASE_JWKS_URL", "#{issuer}/.well-known/jwks.json"), algorithms: %w[ES256 RS256])
      end
    end
  end

  # Activated only during the Phase 4 identity cutover.
  class CognitoVerifier < TokenVerifier
    def self.from_env
      issuer = ENV.fetch("COGNITO_JWT_ISSUER")
      new(issuer: issuer, audience: ENV.fetch("COGNITO_CLIENT_ID"),
        jwks_url: "#{issuer}/.well-known/jwks.json", algorithms: [ "RS256" ])
    end
  end
end
