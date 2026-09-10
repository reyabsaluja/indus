require "aws-sdk-s3"
require "digest"

module Reports
  class ArtifactStore
    def self.from_env
      options = { region: ENV.fetch("AWS_REGION", "us-east-1") }
      if ENV["OBJECT_STORAGE_ENDPOINT"].present?
        options.merge!(endpoint: ENV.fetch("OBJECT_STORAGE_ENDPOINT"), force_path_style: true)
      end
      new(client: Aws::S3::Client.new(**options), bucket: ENV.fetch("REPORT_ARTIFACT_BUCKET"))
    end

    def initialize(client:, bucket:)
      @client = client
      @bucket = bucket
    end

    def put(report_id:, user_id:, document:)
      key = "reports/#{user_id}/#{report_id}.json"
      body = JSON.generate(document)
      @client.put_object(bucket: @bucket, key: key, body: body, content_type: "application/json",
        metadata: { "sha256" => Digest::SHA256.hexdigest(body), "report-id" => report_id.to_s })
      key
    end
  end
end
