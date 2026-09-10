"use client";

import { ChevronDown } from "lucide-react";
import type React from "react";
import { useState } from "react";
import type { PageContext } from "@/lib/types";

interface ContextSummaryProps {
	context?: PageContext;
}

export const ContextSummary: React.FC<ContextSummaryProps> = ({ context }) => {
	const [isOpen, setIsOpen] = useState(false);
	const hasNumber = (value: number | null | undefined): value is number =>
		typeof value === "number" && Number.isFinite(value);

	if (!context) return null;

	const buildSummaryText = (): string => {
		const parts: string[] = [];

		// Valuation metrics
		const valuation: string[] = [];
		if (hasNumber(context.metricGroups.valuation.peRatio)) {
			valuation.push(`P/E ${context.metricGroups.valuation.peRatio.toFixed(1)}`);
		}
		if (hasNumber(context.metricGroups.valuation.forwardPE)) {
			valuation.push(`Fwd P/E ${context.metricGroups.valuation.forwardPE.toFixed(1)}`);
		}
		if (hasNumber(context.metricGroups.valuation.pbRatio)) {
			valuation.push(`P/B ${context.metricGroups.valuation.pbRatio.toFixed(1)}`);
		}
		if (valuation.length > 0) {
			parts.push(`Valuation: ${valuation.join(", ")}`);
		}

		// Margins
		const margins: string[] = [];
		if (hasNumber(context.metricGroups.margins.grossMargin)) {
			margins.push(`Gross ${(context.metricGroups.margins.grossMargin * 100).toFixed(1)}%`);
		}
		if (hasNumber(context.metricGroups.margins.ebitdaMargin)) {
			margins.push(`EBITDA ${(context.metricGroups.margins.ebitdaMargin * 100).toFixed(1)}%`);
		}
		if (margins.length > 0) {
			parts.push(`Margins: ${margins.join(", ")}`);
		}

		// Leverage
		if (hasNumber(context.metricGroups.financialHealth.debtToEquity)) {
			parts.push(
				`Leverage: Debt/Equity ${context.metricGroups.financialHealth.debtToEquity.toFixed(1)}%`,
			);
		}

		return parts.join(" • ");
	};

	return (
		<div className="mt-3">
			<button
				className="flex items-center gap-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
				onClick={() => setIsOpen(!isOpen)}
				aria-expanded={isOpen}
				type="button"
			>
				<ChevronDown className={`h-3 w-3 transition-transform ${isOpen ? "rotate-180" : ""}`} />
				Inspect supplied context
			</button>

			{isOpen && (
				<div className="mt-2 max-h-[180px] overflow-auto rounded-xl border border-border/70 bg-background/60 p-3 text-xs leading-relaxed">
					<div className="space-y-1.5 text-foreground/80">
						<div>
							<strong>Company:</strong> {context.companyName}
						</div>
						<div>
							<strong>Context prepared:</strong> {new Date(context.asOf).toLocaleString()}
						</div>

						{buildSummaryText() && (
							<div className="pt-1 text-muted-foreground">{buildSummaryText()}</div>
						)}

						{context.chart && (
							<div>
								<strong>Chart data:</strong> {context.chart.points.length} price points ·{" "}
								{context.chart.range} range
							</div>
						)}

						{process.env.NODE_ENV !== "production" && (
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
