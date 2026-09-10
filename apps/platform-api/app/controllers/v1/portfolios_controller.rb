module V1
  class PortfoliosController < ApplicationController
    def index
      result = page(policy_scope(Portfolio))
      render json: { items: result[:records].map { |portfolio| portfolio_json(portfolio) }, next_cursor: result[:next_cursor] }
    end

    def show
      portfolio = policy_scope(Portfolio).includes(:positions).find(params[:id])
      authorize portfolio
      render json: portfolio_json(portfolio).merge(
        positions: portfolio.positions.order(:id).limit(1_000).map { |position| position_json(position) })
    end

    def create
      portfolio = Current.user.portfolios.new(portfolio_params)
      authorize portfolio
      portfolio.save!
      response.set_header("Location", "/v1/portfolios/#{portfolio.id}")
      render json: portfolio_json(portfolio), status: :created
    end

    def update
      portfolio = policy_scope(Portfolio).find(params[:id])
      authorize portfolio
      portfolio.update!(portfolio_params)
      render json: portfolio_json(portfolio)
    end

    def destroy
      portfolio = policy_scope(Portfolio).find(params[:id])
      authorize portfolio
      portfolio.destroy!
      head :no_content
    end

    private

    def portfolio_params
      required = action_name == "create" ? %i[name base_currency] : []
      attributes = contract_params(:name, :base_currency, required: required)
      raise ActionController::BadRequest, "at least one field is required" if action_name == "update" && attributes.empty?
      attributes
    end
  end
end
