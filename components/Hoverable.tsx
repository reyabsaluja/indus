"use client";

import { AlertCircle, BrainCircuit, RefreshCw } from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useState } from "react";
import { ContextChatTrigger } from "@/components/chat/ContextChatTrigger";
import FormattedText from "@/components/FormattedText";
import QualitativeSignal from "@/components/QualitativeSignal";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import {
	fetchExplanation,
	getCachedExplanation,
	getExplanationError,
	isLoading,
	subscribeToCacheUpdates,
} from "@/hooks/useExplanation";
import { parseValueAnalysis } from "@/lib/metric-explanations";

type HoverableProps = {
	symbol: string;
	metric: string;
	value: number;
	children: React.ReactNode;
	onChatTrigger?: (metricKey: string, metricLabel: string, value: number | string) => void;
	metricLabel?: string;
	isNumericMetric?: boolean;
};

const Hoverable: React.FC<HoverableProps> = ({
	symbol,
	metric,
	value,
	children,
	onChatTrigger,
	metricLabel,
	isNumericMetric = true,
}) => {
	const [open, setOpen] = useState(false);
	const [explanation, setExplanation] = useState<string | undefined>();
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | undefined>();

	const updateExplanation = useCallback(() => {
		const cached = getCachedExplanation(symbol, metric, value);
		const currentlyLoading = isLoading(symbol, metric);
		setExplanation(cached);
		setLoading(currentlyLoading);
		setError(getExplanationError(symbol, metric));
	}, [symbol, metric, value]);

	useEffect(() => {
		updateExplanation();
	}, [updateExplanation]);

	useEffect(() => {
		const unsubscribe = subscribeToCacheUpdates(symbol, metric, updateExplanation);
		return () => unsubscribe?.();
	}, [symbol, metric, updateExplanation]);

	const handleIntent = useCallback(() => {
		const cached = getCachedExplanation(symbol, metric, value);
		const currentlyLoading = isLoading(symbol, metric);

		if (!cached && !currentlyLoading) {
			setLoading(true);
			fetchExplanation(symbol, metric, value).catch(() => {
				setLoading(false);
			});
		}
	}, [symbol, metric, value]);

	const renderContent = () => {
		if (loading) {
			return (
				<div className="flex items-center gap-3 py-3">
					<span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
						<BrainCircuit className="size-4 animate-pulse" />
					</span>
					<div>
						<p className="text-sm font-medium">Fetching explanation</p>
						<p className="text-xs text-muted-foreground">Using {symbol}’s current value.</p>
					</div>
				</div>
			);
		}

		if (error) {
			return (
				<div className="space-y-3">
					<div className="flex gap-2.5 text-sm">
						<AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
						<div>
							<p className="font-medium">Explanation unavailable</p>
							<p className="mt-1 text-xs leading-5 text-muted-foreground">{error}</p>
						</div>
					</div>
					<button
						type="button"
						onClick={() => void fetchExplanation(symbol, metric, value)}
						className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
					>
						<RefreshCw className="size-3" />
						Try again
					</button>
				</div>
			);
		}

		if (!explanation) {
			return <div className="text-sm text-muted-foreground">No explanation loaded.</div>;
		}

		const valueAnalysis = parseValueAnalysis(explanation);

		if (valueAnalysis) {
			const isFallback = valueAnalysis.source === "fallback";
			return (
				<div className="space-y-4">
					<div className="border-b border-border pb-2">
						<div className="flex items-center gap-2">
							<FormattedText
								text={valueAnalysis.metric_display}
								className="text-base leading-relaxed flex-1"
							/>
							{!isFallback && valueAnalysis.evaluation && (
								<QualitativeSignal
									evaluation={valueAnalysis.evaluation}
									showLabel={true}
									size="md"
								/>
							)}
						</div>
					</div>

					<div className="text-sm leading-relaxed">
						<FormattedText text={valueAnalysis.insight} />
					</div>
					{isFallback && <p className="text-xs text-muted-foreground">Built-in explanation</p>}

					{onChatTrigger && (
						<ContextChatTrigger
							metricKey={metric}
							label={metricLabel || metric}
							value={value}
							onTrigger={onChatTrigger}
							isNumericMetric={isNumericMetric}
						/>
					)}
				</div>
			);
		}

		// Fallback for plain text explanations
		return (
			<div className="space-y-4">
				<div className="text-sm">
					<FormattedText text={explanation} />
				</div>

				{onChatTrigger && (
					<ContextChatTrigger
						metricKey={metric}
						label={metricLabel || metric}
						value={value}
						onTrigger={onChatTrigger}
						isNumericMetric={isNumericMetric}
					/>
				)}
			</div>
		);
	};

	// Extract evaluation for display next to the number
	const currentAnalysis = explanation ? parseValueAnalysis(explanation) : null;
	const currentEvaluation =
		currentAnalysis?.source === "fallback" ? null : currentAnalysis?.evaluation;

	if (!Number.isFinite(value)) {
		return <span className="inline-flex items-center gap-1.5">{children}</span>;
	}

	return (
		<HoverCard open={open} onOpenChange={setOpen} openDelay={100} closeDelay={100}>
			<HoverCardTrigger asChild>
				<button
					type="button"
					onMouseEnter={handleIntent}
					onFocus={() => {
						handleIntent();
						setOpen(true);
					}}
					onClick={() => setOpen(true)}
					className="inline-flex cursor-help items-center gap-1.5 rounded-sm underline decoration-dotted decoration-2 underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
					aria-label={`${metricLabel || metric}: open AI interpretation`}
				>
					{children}
					{currentEvaluation && (
						<QualitativeSignal evaluation={currentEvaluation} size="sm" className="inline-flex" />
					)}
				</button>
			</HoverCardTrigger>
			<HoverCardContent className="w-88 max-w-[calc(100vw-2rem)] border-primary/20 p-4 shadow-2xl">
				{renderContent()}
			</HoverCardContent>
		</HoverCard>
	);
};

export default Hoverable;
