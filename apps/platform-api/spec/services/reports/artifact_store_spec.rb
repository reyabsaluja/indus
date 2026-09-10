require "rails_helper"

RSpec.describe Reports::ArtifactStore do
  it "writes a deterministic tenant-scoped object with integrity metadata" do
    client = instance_double(Aws::S3::Client, put_object: true)
    store = described_class.new(client: client, bucket: "reports-local")
    key = store.put(report_id: "report-1", user_id: "user-1", document: { "summary" => "Grounded" })
    expect(key).to eq("reports/user-1/report-1.json")
    expect(client).to have_received(:put_object).with(hash_including(bucket: "reports-local", key: key,
      content_type: "application/json", metadata: hash_including("report-id" => "report-1", "sha256" => match(/\A[0-9a-f]{64}\z/))))
  end
end
