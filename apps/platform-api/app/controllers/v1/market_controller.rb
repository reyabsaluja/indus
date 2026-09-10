module V1
  class MarketController < ApplicationController
    def summary = render(json: MarketSummary.new(watchlist: Current.user.favorites.order(:created_at)).call)
  end
end
