class ModelEvidence < Data.define(:context, :citations)
  MAX_PORTFOLIO_POSITIONS = 20

  def self.empty = new(context: {}, citations: [])

  def self.for_fundamentals(snapshot)
    citation = fundamentals_citation(snapshot)
    new(context: { fundamentals: { symbol: snapshot.symbol, as_of: snapshot.as_of.iso8601,
      metrics: snapshot.metrics.first(100).to_h, source: citation } }, citations: [ citation ])
  end

  def self.for_chat(snapshot: nil, portfolio: nil)
    context = {}
    citations = []
    if snapshot
      citation = fundamentals_citation(snapshot)
      context[:fundamentals] = { symbol: snapshot.symbol, as_of: snapshot.as_of.iso8601,
        metrics: snapshot.metrics.first(100).to_h, source: citation }
      citations << citation
    end
    if portfolio
      citation = { label: "Portfolio snapshot (#{portfolio.id})", as_of: portfolio.updated_at.iso8601 }
      positions = portfolio.positions.order(:id).limit(MAX_PORTFOLIO_POSITIONS).map do |position|
        { symbol: position.symbol, instrument_type: position.instrument_type, quantity: position.quantity.to_s("F"),
          average_cost: position.average_cost.to_s("F"), currency: position.currency }
      end
      context[:portfolio] = { id: portfolio.id, name: portfolio.name, base_currency: portfolio.base_currency,
        positions: positions, truncated: portfolio.positions.count > MAX_PORTFOLIO_POSITIONS, source: citation }
      citations << citation
    end
    new(context: context, citations: citations)
  end

  def self.fundamentals_citation(snapshot)
    { label: "Yahoo Finance quote (#{snapshot.symbol})", as_of: snapshot.as_of.iso8601 }
  end
  private_class_method :fundamentals_citation
end
