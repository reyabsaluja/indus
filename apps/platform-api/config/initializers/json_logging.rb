class JsonLogFormatter < Logger::Formatter
  def call(severity, time, _program_name, message)
    payload = message.is_a?(Hash) ? message : { message: message.to_s }
    payload.merge(timestamp: time.utc.iso8601(6), severity: severity, service: "platform-api").to_json << "\n"
  end
end

Rails.application.configure do
  config.log_formatter = JsonLogFormatter.new
end

Rails.application.config.after_initialize do
  formatter = JsonLogFormatter.new
  formatter.extend(ActiveSupport::TaggedLogging::Formatter)
  Rails.logger.formatter = formatter
end
