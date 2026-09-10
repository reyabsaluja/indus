"use client";

import type React from "react";
import { cn } from "@/lib/utils";

type EvaluationType = "green" | "red" | "neutral" | "amber";

type QualitativeSignalProps = {
	evaluation?: EvaluationType;
	showLabel?: boolean;
	size?: "sm" | "md" | "lg";
	className?: string;
};

const evaluationConfig = {
	green: {
		color: "bg-green-500",
		label: "Positive",
		description: "Positive directional read",
	},
	red: {
		color: "bg-red-500",
		label: "Negative",
		description: "Negative directional read",
	},
	amber: {
		color: "bg-amber-500",
		label: "Mixed",
		description: "Mixed directional read",
	},
	neutral: {
		color: "bg-gray-400",
		label: "Neutral",
		description: "Neutral directional read",
	},
};

const sizeConfig = {
	sm: "h-2 w-2",
	md: "h-3 w-3",
	lg: "h-4 w-4",
};

const QualitativeSignal: React.FC<QualitativeSignalProps> = ({
	evaluation = "neutral",
	showLabel = false,
	size = "sm",
	className,
}) => {
	const config = evaluationConfig[evaluation];
	const sizeClass = sizeConfig[size];

	if (!config) {
		return null;
	}

	return (
		<div className={cn("inline-flex items-center gap-1", className)}>
			<div
				className={cn("rounded-full", config.color, sizeClass)}
				title={`${config.description} - ${config.label}`}
				aria-hidden="true"
			/>
			<span className={showLabel ? "text-xs text-muted-foreground" : "sr-only"}>
				{showLabel ? config.label : config.description}
			</span>
		</div>
	);
};

export default QualitativeSignal;
