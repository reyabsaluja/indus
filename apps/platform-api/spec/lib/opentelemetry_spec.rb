require "rails_helper"

RSpec.describe "OpenTelemetry configuration" do
  it "defaults to no exporter and installs Rails and HTTP instrumentation" do
    expect(ENV.fetch("OTEL_TRACES_EXPORTER")).to eq("none")
    expect(OpenTelemetry::Instrumentation::Rails::Instrumentation.instance.installed?).to be(true)
    expect(OpenTelemetry::Instrumentation::Net::HTTP::Instrumentation.instance.installed?).to be(true)
  end
end
