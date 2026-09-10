module V1
  class ChatController < ApplicationController
    MAX_MESSAGES = 8
    MAX_MESSAGE_LENGTH = 1_000
    MAX_TOTAL_MESSAGE_BYTES = 8_000

    def create
      attributes = contract_params(:conversation_id, :symbol, :portfolio_id, :messages, required: [ :messages ])
      raw_messages = attributes[:messages]
      unless raw_messages.is_a?(Array) && raw_messages.length.between?(1, MAX_MESSAGES) &&
          raw_messages.all? { |message| message.is_a?(Hash) || message.is_a?(ActionController::Parameters) }
        raise ActionController::BadRequest, "messages do not match the chat contract"
      end
      messages = raw_messages.map(&:to_h)
      unless messages.all? { |message| valid_message?(message) } &&
          messages.sum { |message| message.fetch("content").bytesize } <= MAX_TOTAL_MESSAGE_BYTES
        raise ActionController::BadRequest, "messages do not match the chat contract"
      end

      conversation_id = attributes[:conversation_id].presence || SecureRandom.uuid
      validate_uuid!(conversation_id, "conversation_id")
      symbol = attributes[:symbol].presence&.to_s&.upcase
      validate_symbol!(symbol) if symbol
      validate_uuid!(attributes[:portfolio_id], "portfolio_id") if attributes[:portfolio_id].present?
      portfolio = policy_scope(Portfolio).includes(:positions).find(attributes[:portfolio_id]) if attributes[:portfolio_id].present?
      AiUsageLimiter.new(user: Current.user, operation: "chat").consume!
      snapshot = FundamentalsProvider.default.fetch(symbol: symbol) if symbol
      evidence = ModelEvidence.for_chat(snapshot: snapshot, portfolio: portfolio)
      execution = ModelGateway.default.execute(task: "financial_chat",
        input: { messages: messages, symbol: symbol, portfolio_id: attributes[:portfolio_id] }, evidence: evidence)
      render json: { conversation_id: conversation_id, message: execution.payload.fetch("message"),
        sources: execution.payload.fetch("sources", []), usage: execution.usage }
    end

    private

    def valid_message?(message)
      %w[user assistant].include?(message["role"]) && message["content"].is_a?(String) &&
        message["content"].length.between?(1, MAX_MESSAGE_LENGTH) && (message.keys - %w[role content]).empty?
    end

    def validate_uuid!(value, field)
      pattern = /\A[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\z/i
      raise ActionController::BadRequest, "#{field} must be a UUID" unless value.to_s.match?(pattern)
    end

    def validate_symbol!(symbol)
      valid = symbol.length <= 20 && symbol.match?(/\A[A-Z0-9]+(?:[.\/-][A-Z0-9]+)?\z/)
      raise ActionController::BadRequest, "invalid symbol" unless valid
    end
  end
end
