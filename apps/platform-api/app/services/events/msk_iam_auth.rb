require "aws_msk_iam_sasl_signer"
require "monitor"
require "rdkafka"

module Events
  class MskIamAuth
    @clients = {}
    @lock = Monitor.new

    class << self
      def build(type, config)
        install_callback
        client = Rdkafka::Config.new(config).public_send(type, native_kafka_auto_start: false)
        @lock.synchronize { @clients[client.name] = client }
        client.start
        client
      rescue StandardError
        @lock.synchronize { @clients.delete(client&.name) }
        raise
      end

      def refresh_token(client_name)
        token = AwsMskIamSaslSigner::MSKTokenProvider.new(region: ENV.fetch("AWS_REGION")).generate_auth_token
        client = @lock.synchronize { @clients.fetch(client_name) }
        client.oauthbearer_set_token(token: token.token, lifetime_ms: token.expiration_time_ms,
          principal_name: "kafka-cluster")
      rescue StandardError => error
        client&.oauthbearer_set_token_failure(error.message.to_s.byteslice(0, 200))
      end

      private

      def install_callback
        @lock.synchronize do
          return if @callback_installed

          Rdkafka::Config.oauthbearer_token_refresh_callback = method(:refresh_token)
          @callback_installed = true
        end
      end
    end
  end
end
