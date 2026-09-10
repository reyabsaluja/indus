require "rails_helper"

RSpec.describe "tenant ownership policies" do
  let(:owner) { User.create!(issuer: "issuer", external_subject: "owner", email: "owner@example.test", display_name: "Owner") }
  let(:other) { User.create!(issuer: "issuer", external_subject: "other", email: "other@example.test", display_name: "Other") }

  it "fails closed when no authenticated user reaches a policy or scope" do
    expect { FavoritePolicy.new(nil, Favorite.new) }.to raise_error(Pundit::NotAuthorizedError)
    expect { FavoritePolicy::Scope.new(nil, Favorite).resolve }.to raise_error(Pundit::NotAuthorizedError)
  end

  it "allows record mutations only for the owning tenant" do
    favorite = owner.favorites.create!(symbol: "AAPL")

    expect(policy_decisions(FavoritePolicy.new(owner, favorite))).to all(be(true))
    expect(policy_decisions(FavoritePolicy.new(other, favorite))).to all(be(false))
  end

  it "resolves every top-level resource scope to the current tenant" do
    owner.favorites.create!(symbol: "AAPL")
    other.favorites.create!(symbol: "MSFT")
    owner.portfolios.create!(name: "Owner portfolio")
    other.portfolios.create!(name: "Other portfolio")
    owner.reports.create!(symbol: "AAPL", title: "Owner report")
    other.reports.create!(symbol: "MSFT", title: "Other report")

    expect(FavoritePolicy::Scope.new(owner, Favorite).resolve.pluck(:user_id).uniq).to eq([ owner.id ])
    expect(PortfolioPolicy::Scope.new(owner, Portfolio).resolve.pluck(:user_id).uniq).to eq([ owner.id ])
    expect(ReportPolicy::Scope.new(owner, Report).resolve.pluck(:user_id).uniq).to eq([ owner.id ])
  end

  it "authorizes positions through their portfolio owner" do
    position = owner.portfolios.create!(name: "Core").positions.create!(symbol: "AAPL", quantity: 1, average_cost: 10)

    expect(policy_decisions(PositionPolicy.new(owner, position))).to all(be(true))
    expect(policy_decisions(PositionPolicy.new(other, position))).to all(be(false))
  end

  def policy_decisions(policy) = %i[show? create? update? destroy?].map { |action| policy.public_send(action) }
end
