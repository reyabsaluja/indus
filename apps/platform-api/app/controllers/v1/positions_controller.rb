module V1
  class PositionsController < ApplicationController
    before_action :portfolio

    def index
      result = page(@portfolio.positions)
      render json: { items: result[:records].map { |position| position_json(position) }, next_cursor: result[:next_cursor] }
    end

    def create
      position = @portfolio.positions.new(position_params)
      authorize position
      position.save!
      response.set_header("Location", "/v1/portfolios/#{@portfolio.id}/positions/#{position.id}")
      render json: position_json(position), status: :created
    end

    def update
      position = @portfolio.positions.find(params[:id])
      authorize position
      position.update!(position_params)
      render json: position_json(position)
    end

    def destroy
      position = @portfolio.positions.find(params[:id])
      authorize position
      position.destroy!
      head :no_content
    end

    private

    def portfolio
      @portfolio = policy_scope(Portfolio).find(params[:portfolio_id])
      authorize @portfolio, :show?
    end

    def position_params
      attributes = if action_name == "create"
        contract_params(:symbol, :instrument_type, :quantity, :average_cost, :currency,
          required: %i[symbol instrument_type quantity average_cost currency])
      else
        attributes = contract_params(:quantity, :average_cost)
        raise ActionController::BadRequest, "at least one field is required" if attributes.empty?
        attributes
      end
      %i[quantity average_cost].each do |field|
        if attributes.key?(field) && !attributes[field].is_a?(String)
          raise ActionController::BadRequest, "#{field} must be a base-10 decimal string"
        end
      end
      attributes
    end
  end
end
