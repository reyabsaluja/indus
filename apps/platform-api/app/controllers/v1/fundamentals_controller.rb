module V1
  class FundamentalsController < ApplicationController
    def show
      snapshot = FundamentalsProvider.default.fetch(symbol: params[:symbol])
      render json: { symbol: snapshot.symbol, as_of: snapshot.as_of.iso8601, source: "yahoo", metrics: snapshot.metrics }
    end
  end
end
