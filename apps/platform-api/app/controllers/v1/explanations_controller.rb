module V1
  class ExplanationsController < ApplicationController
    def create
      attributes = contract_params(:symbol, :metrics, :as_of, required: %i[symbol metrics])
      symbol = normalized_symbol(attributes[:symbol])
      metrics = attributes[:metrics]
      unless metrics.is_a?(Array) && metrics.length.between?(1, 20) && metrics.uniq.length == metrics.length &&
          metrics.all? { |metric| metric.is_a?(String) && metric.length.between?(1, 80) }
        raise ActionController::BadRequest, "metrics must contain 1 to 20 unique names"
      end
      as_of = attributes[:as_of].present? ? Time.iso8601(attributes[:as_of]) : Time.current
      AiUsageLimiter.new(user: Current.user, operation: "explanation").consume!
      evidence = ModelEvidence.for_fundamentals(FundamentalsProvider.default.fetch(symbol: symbol))
      execution = ModelGateway.default.execute(task: "metric_explanations",
        input: { symbol: symbol, metrics: metrics, as_of: as_of.iso8601 }, evidence: evidence)
      render json: { symbol: symbol, as_of: as_of.iso8601, explanations: execution.payload.fetch("explanations"), usage: execution.usage }
    rescue ArgumentError => error
      raise ActionController::BadRequest, error.message
    end

    private

    def normalized_symbol(value)
      value.to_s.upcase.tap do |symbol|
        valid = symbol.length <= 20 && symbol.match?(/\A[A-Z0-9]+(?:[.\/-][A-Z0-9]+)?\z/)
        raise ActionController::BadRequest, "invalid symbol" unless valid
      end
    end
  end
end
