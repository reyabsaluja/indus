"use client";

import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import { PageContext } from "@/lib/types";
import { formatLargeNumber, formatPercent } from "@/lib/utils";

interface ContextSummaryProps {
  context?: PageContext;
}

export const ContextSummary: React.FC<ContextSummaryProps> = ({ context }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!context) return null;

  const buildSummaryText = (): string => {
    const parts: string[] = [];

    // Valuation metrics
    const valuation: string[] = [];
    if (context.metricGroups.valuation.peRatio) {
      valuation.push(`P/E ${context.metricGroups.valuation.peRatio.toFixed(1)}`);
    }
    if (context.metricGroups.valuation.forwardPE) {
      valuation.push(`Fwd P/E ${context.metricGroups.valuation.forwardPE.toFixed(1)}`);
    }
    if (context.metricGroups.valuation.pbRatio) {
      valuation.push(`P/B ${context.metricGroups.valuation.pbRatio.toFixed(1)}`);
    }
    if (valuation.length > 0) {
      parts.push(`Valuation: ${valuation.join(', ')}`);
    }

    // Margins
    const margins: string[] = [];
    if (context.metricGroups.margins.grossMargin) {
      margins.push(`Gross ${(context.metricGroups.margins.grossMargin * 100).toFixed(1)}%`);
    }
    if (context.metricGroups.margins.ebitdaMargin) {
      margins.push(`EBITDA ${(context.metricGroups.margins.ebitdaMargin * 100).toFixed(1)}%`);
    }
    if (margins.length > 0) {
      parts.push(`Margins: ${margins.join(', ')}`);
    }

    // Leverage
    if (context.metricGroups.financialHealth.debtToEquity) {
      parts.push(`Leverage: Debt/Equity ${context.metricGroups.financialHealth.debtToEquity.toFixed(1)}`);
    }

    return parts.join(' • ');
  };

  return (
    <div className="mt-2">
      <button
        className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        type="button"
      >
        <ChevronDown 
          className={`h-3 w-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} 
        />
        Context summary
      </button>

      {isOpen && (
        <div className="max-h-[180px] overflow-auto border border-zinc-800/60 rounded-md bg-zinc-900/60 p-2 mt-2 text-xs leading-relaxed">
          <div className="space-y-1 text-zinc-300">
            <div><strong>Company:</strong> {context.companyName}</div>
            <div><strong>Data as of:</strong> {new Date(context.asOf).toLocaleString()}</div>
            
            {buildSummaryText() && (
              <div className="pt-1 text-zinc-400">
                {buildSummaryText()}
              </div>
            )}

            {context.chart && (
              <div><strong>Chart data:</strong> {context.chart.points.length} price points</div>
            )}

            {Object.keys(context.cachedExplanations).length > 0 && (
              <div><strong>AI explanations:</strong> {Object.keys(context.cachedExplanations).length} cached</div>
            )}

            {process.env.NODE_ENV !== 'production' && (
              <details className="pt-2">
                <summary className="cursor-pointer text-zinc-500 hover:text-zinc-300">
                  Show raw JSON
                </summary>
                <pre className="mt-1 text-[10px] text-zinc-500 overflow-auto max-h-32">
                  {JSON.stringify(context, null, 2)}
                </pre>
              </details>
            )}
          </div>
        </div>
      )}
    </div>
  );
}; 