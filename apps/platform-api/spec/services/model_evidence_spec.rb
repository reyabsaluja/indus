require "rails_helper"
require Rails.root.join("app/services/fundamentals_provider")

RSpec.describe ModelEvidence do
  let(:user) { User.create!(issuer: "issuer", external_subject: SecureRandom.uuid,
    email: "evidence@example.test", display_name: "Evidence") }

  it "builds a bounded fundamentals source with a deterministic citation" do
    snapshot = FundamentalsSnapshot.new(symbol: "AAPL", as_of: Time.zone.parse("2026-08-05T10:00:00Z"),
      metrics: 120.times.to_h { |index| [ "metric#{index}", index ] }, source_reference: "fixture:AAPL")

    evidence = described_class.for_fundamentals(snapshot)

    expect(evidence.context.dig(:fundamentals, :metrics).length).to eq(100)
    expect(evidence.citations).to eq([ { label: "Yahoo Finance quote (AAPL)", as_of: "2026-08-05T10:00:00Z" } ])
  end

  it "bounds portfolio positions included in a chat prompt" do
    portfolio = user.portfolios.create!(name: "Evidence portfolio")
    (ModelEvidence::MAX_PORTFOLIO_POSITIONS + 1).times do |index|
      portfolio.positions.create!(symbol: "S#{index}", quantity: 1, average_cost: 1)
    end

    evidence = described_class.for_chat(portfolio: portfolio)

    expect(evidence.context.dig(:portfolio, :positions).length).to eq(ModelEvidence::MAX_PORTFOLIO_POSITIONS)
    expect(evidence.context.dig(:portfolio, :truncated)).to be(true)
    expect(evidence.citations).to contain_exactly(include(label: "Portfolio snapshot (#{portfolio.id})"))
  end
end
