module V1
  class MeController < ApplicationController
    def show = render(json: user_json(Current.user))

    def update
      attributes = contract_params(:display_name)
      raise ActionController::BadRequest, "at least one field is required" if attributes.empty?

      Current.user.update!(attributes)
      render json: user_json(Current.user)
    end
  end
end
