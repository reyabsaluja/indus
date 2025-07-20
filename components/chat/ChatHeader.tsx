"use client";

import React from "react";
import { formatLargeNumber } from "@/lib/utils";

interface ChatHeaderProps {
  triggerMetric?: {
    metricKey: string;
    label: string;
    value: number | string;
  };
  companySymbol?: string;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({
  triggerMetric,
  companySymbol,
}) => {
  return (
    <div>
      {/* Line 1: Metric Label */}
      <h2 id="chat-title" className="text-lg font-semibold text-zinc-100">
        {triggerMetric?.label || 'Financial Analysis Chat'}
      </h2>
      
      {/* Line 2: Ticker + Value */}
      {(companySymbol || triggerMetric) && (
        <div className="flex items-center mt-1">
          {companySymbol && (
            <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-zinc-800/70 text-zinc-300">
              {companySymbol}
            </span>
          )}
          
          {triggerMetric && (
            <>
              {companySymbol && <span className="mx-1 text-zinc-500">•</span>}
              <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-zinc-800/70 text-zinc-300 tabular-nums ml-2">
                {typeof triggerMetric.value === 'number' 
                  ? formatLargeNumber(triggerMetric.value)
                  : triggerMetric.value
                }
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}; 