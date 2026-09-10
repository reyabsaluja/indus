Sidekiq.configure_server { |config| config.redis = { url: ENV.fetch("REDIS_URL", "redis://localhost:6379/0") } }
Sidekiq.configure_client { |config| config.redis = { url: ENV.fetch("REDIS_URL", "redis://localhost:6379/0") } }
