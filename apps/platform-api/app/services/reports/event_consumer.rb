require "rdkafka"

module Reports
  class EventConsumer
    def self.from_env
      config = Events::KafkaConfig.build(client_id: ENV.fetch("KAFKA_CLIENT_ID", "indus-reports-consumer"),
        consumer_group: ENV.fetch("REPORTS_KAFKA_CONSUMER_GROUP", "indus-report-workflow-starter-v1"))
      consumer = Events::KafkaConfig.consumer(config)
      consumer.subscribe("reports.lifecycle.v1")
      new(consumer: consumer, temporal: TemporalClient.from_env)
    end

    def initialize(consumer:, temporal:)
      @consumer = consumer
      @temporal = temporal
      @receipts = Events::IdempotentConsumer.new(name: "report-workflow-starter-v1")
    end

    def run
      @consumer.each do |message|
        payload = JSON.parse(message.payload)
        @receipts.process(payload) { start_if_queued(payload) }
        @consumer.store_offset(message)
        @consumer.commit(nil, false)
      rescue JSON::ParserError, ArgumentError => error
        Rails.logger.error(event: "report_event_rejected", error_class: error.class.name)
        @consumer.store_offset(message)
        @consumer.commit(nil, false)
      end
    ensure
      @consumer.close
    end

    private

    def start_if_queued(payload)
      return unless payload.fetch("status") == "queued"

      report = Report.find(payload.fetch("report_id"))
      return if report.status == "cancelled"

      workflow_id = payload.fetch("workflow_id")
      report.update!(workflow_id: workflow_id) if report.workflow_id.nil?
      @temporal.start_report({ "report_id" => report.id, "workflow_id" => workflow_id,
        "correlation_id" => payload.dig("envelope", "correlation_id"), "focus" => payload["focus"] })
    end
  end
end
