"use client";

import type React from "react";
import { formatLargeNumber } from "@/lib/utils";

interface ChatHeaderProps {
	triggerMetric?: {
		metricKey: string;
		label: string;
		value: number | string;
	};
	companySymbol?: string;
}

export const ChatHeader: React.FC<ChatHeaderProps> = ({ triggerMetric, companySymbol }) => {
	return (
		<div className="min-w-0">
			<p className="font-mono text-[9px] font-semibold uppercase tracking-[0.16em] text-primary">
				Indus analyst
			</p>
			<h2 id="chat-title" className="mt-1 truncate text-base font-semibold tracking-[-0.02em]">
				{triggerMetric?.label || "Company research"}
			</h2>

			{/* Line 2: Ticker + Value */}
			{(companySymbol || triggerMetric) && (
				<div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
					{companySymbol && (
						<span className="font-mono font-semibold tracking-[0.08em] text-foreground">
							{companySymbol}
						</span>
					)}

					{triggerMetric && (
						<>
							{companySymbol && <span>•</span>}
							<span className="font-mono tabular-nums">
								{typeof triggerMetric.value === "number"
									? formatLargeNumber(triggerMetric.value)
									: triggerMetric.value}
							</span>
						</>
					)}
				</div>
			)}
		</div>
	);
};
