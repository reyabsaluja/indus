module V1
  class InstrumentsController < ApplicationController
    def search
      query = params.require(:q).to_s.strip
      raise ActionController::BadRequest, "q must be between 1 and 100 characters" unless query.length.between?(1, 100)
      size = Integer(params.fetch(:page_size, 25), exception: false)
      raise ActionController::BadRequest, "page_size must be between 1 and 100" unless size&.between?(1, 100)
      raise ActionController::BadRequest, "cursor is not supported by this provider" if params[:cursor].present?

      render json: { items: Instruments::YahooSearchAdapter.new.search(query: query, limit: size), next_cursor: nil }
    end
  end
end
