"use client";

import type React from "react";
import { Button } from "@/components/ui/button";

interface SuggestionChipsProps {
	onSendMessage: (message: string) => void;
	triggerMetric?: string;
}

export const SuggestionChips: React.FC<SuggestionChipsProps> = ({
	onSendMessage,
	triggerMetric,
}) => {
	const suggestions = triggerMetric
		? [
				`Explain ${triggerMetric.toLowerCase()}`,
				"Connect it to the other metrics",
				"What should I examine next?",
			]
		: ["Summarize the strongest signal", "Where is the tension?", "What should I examine next?"];

	return (
		<div>
			<p className="mb-2 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
				Suggested questions
			</p>
			<div className="flex flex-wrap gap-2">
				{suggestions.map((suggestion) => (
					<Button
						key={suggestion}
						variant="ghost"
						size="sm"
						onClick={() => onSendMessage(suggestion)}
						className="h-auto rounded-full border border-border bg-background/70 px-3 py-1.5 text-[10px] text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
					>
						{suggestion}
					</Button>
				))}
			</div>
		</div>
	);
};
