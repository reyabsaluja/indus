require "rails_helper"

RSpec.describe "domain constraints" do
  let(:user) { User.create!(issuer: "issuer", external_subject: SecureRandom.uuid, email: "domain@example.test", display_name: "Domain") }

  it "prevents duplicate tenant favorites" do
    user.favorites.create!(symbol: "AAPL")
    expect { user.favorites.create!(symbol: "aapl") }.to raise_error(ActiveRecord::RecordInvalid)
  end

  it "requires a positive position quantity" do
    portfolio = user.portfolios.create!(name: "Long term")
    expect { portfolio.positions.create!(symbol: "AAPL", quantity: 0, average_cost: 1) }.to raise_error(ActiveRecord::RecordInvalid)
  end

  it "validates position decimals before PostgreSQL can round or overflow them" do
    portfolio = user.portfolios.create!(name: "Decimal boundaries")
    valid = portfolio.positions.new(symbol: "AAPL", quantity: "999999999999999999.1234567890",
      average_cost: "99999999999999.12345678")
    expect(valid).to be_valid

    [
      { quantity: "1.12345678901", average_cost: "1" },
      { quantity: "9999999999999999999", average_cost: "1" },
      { quantity: "1", average_cost: "1.123456789" },
      { quantity: "1", average_cost: "999999999999999.1" }
    ].each do |attributes|
      expect(portfolio.positions.new({ symbol: SecureRandom.hex(2).upcase }.merge(attributes))).not_to be_valid
    end
  end

  it "restricts reports to durable workflow states" do
    expect { user.reports.create!(symbol: "AAPL", status: "mystery") }.to raise_error(ActiveRecord::RecordInvalid)
  end

  it "enforces report and portfolio tenant consistency in the model and database" do
    other = User.create!(issuer: "issuer", external_subject: SecureRandom.uuid,
      email: "other-domain@example.test", display_name: "Other")
    portfolio = other.portfolios.create!(name: "Private")
    report = user.reports.new(symbol: "AAPL", title: "Cross-tenant report", portfolio: portfolio)
    expect(report).not_to be_valid
    expect(report.errors[:portfolio]).to include("must belong to the report owner")

    now = Time.current
    expect do
      ApplicationRecord.transaction(requires_new: true) do
        Report.insert_all!([ { user_id: user.id, portfolio_id: portfolio.id, symbol: "AAPL", title: "Invalid owner",
          status: "queued", created_at: now, updated_at: now } ])
      end
    end.to raise_error(ActiveRecord::StatementInvalid)
  end

  it "rejects symbols with repeated or trailing separators" do
    portfolio = user.portfolios.create!(name: "Symbols")
    expect(portfolio.positions.new(symbol: "BTC//USD", quantity: 1, average_cost: 1)).not_to be_valid
    expect(user.reports.new(symbol: "AAPL-", title: "Malformed")).not_to be_valid
    expect(user.favorites.new(symbol: "BRK..B", instrument_type: "equity")).not_to be_valid
  end

  it "enforces strict symbols when writes bypass Active Record validation" do
    portfolio = user.portfolios.create!(name: "Database symbols")
    now = Time.current
    writes = [
      -> { Favorite.insert_all!([ { user_id: user.id, symbol: "BTC//USD", instrument_type: "crypto", created_at: now, updated_at: now } ]) },
      -> { Position.insert_all!([ { portfolio_id: portfolio.id, symbol: "AAPL-", instrument_type: "equity",
        quantity: 1, average_cost: 1, currency: "USD", created_at: now, updated_at: now } ]) },
      -> { Report.insert_all!([ { user_id: user.id, symbol: "BRK..B", title: "Invalid", status: "queued",
        created_at: now, updated_at: now } ]) }
    ]
    writes.each do |write|
      expect { ApplicationRecord.transaction(requires_new: true) { write.call } }.to raise_error(ActiveRecord::StatementInvalid)
    end
  end

  it "caps positions and report evidence at their response bounds" do
    portfolio = user.portfolios.create!(name: "Bounded")
    position = portfolio.positions.new(symbol: "AAPL", quantity: 1, average_cost: 1)
    allow(Portfolio).to receive_message_chain(:lock, :find).and_return(portfolio)
    allow(Position).to receive(:where).with(portfolio_id: portfolio.id)
      .and_return(instance_double(ActiveRecord::Relation, count: Position::MAX_PER_PORTFOLIO))
    expect(position).not_to be_valid
    expect(position.errors[:base]).to include("portfolio position limit reached")

    report = user.reports.create!(symbol: "AAPL", title: "AAPL report")
    source = report.report_sources.new(provider: "fixture", kind: "filing", source_reference: "10-Q")
    allow(Report).to receive_message_chain(:lock, :find).and_return(report)
    allow(ReportSource).to receive(:where).with(report_id: report.id)
      .and_return(instance_double(ActiveRecord::Relation, count: ReportSource::MAX_PER_REPORT))
    expect(source).not_to be_valid
    expect(source.errors[:base]).to include("report source limit reached")
    expect(report.report_sources.new(provider: "fixture", kind: "filing", source_reference: "x" * 201)).not_to be_valid
  end
end
