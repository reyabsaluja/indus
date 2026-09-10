require "rails_helper"

RSpec.describe JsonLogFormatter do
  it "emits one structured JSON object without changing supplied fields" do
    payload = JSON.parse(described_class.new.call("INFO", Time.utc(2026, 8, 5), nil, { event: "request.complete", status: 200 }))
    expect(payload).to include("event" => "request.complete", "status" => 200, "severity" => "INFO", "service" => "platform-api")
  end
end
