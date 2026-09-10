ENV["OTEL_TRACES_EXPORTER"] = "none" unless ENV.key?("OTEL_TRACES_EXPORTER")

OpenTelemetry::SDK.configure do |config|
  config.service_name = "platform-api"
  config.use "OpenTelemetry::Instrumentation::Rails"
  config.use "OpenTelemetry::Instrumentation::Net::HTTP"
end
