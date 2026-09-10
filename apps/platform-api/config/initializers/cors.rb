Rails.application.config.middleware.insert_before 0, Rack::Cors do
  allow do
    origins(*ENV.fetch("CORS_ORIGINS", "http://localhost:5173").split(",").map(&:strip))
    resource "/v1/*", headers: %w[Authorization Content-Type Idempotency-Key],
      expose: %w[Location Idempotency-Replayed X-Request-Id],
      methods: %i[get post patch put delete options head], max_age: 600
  end
end
