"use client";

import React from "react";
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
    label: "Strong",
    description: "Favorable"
  },
  red: {
    color: "bg-red-500", 
    label: "Weak",
    description: "Concerning"
  },
  amber: {
    color: "bg-amber-500",
    label: "Caution",
    description: "Mixed"
  },
  neutral: {
    color: "bg-gray-400",
    label: "Neutral",
    description: "Typical"
  }
};

const sizeConfig = {
  sm: "h-2 w-2",
  md: "h-3 w-3", 
  lg: "h-4 w-4"
};

const QualitativeSignal: React.FC<QualitativeSignalProps> = ({
  evaluation = "neutral",
  showLabel = false,
  size = "sm",
  className
}) => {
  const config = evaluationConfig[evaluation];
  const sizeClass = sizeConfig[size];

  if (!config) {
    return null;
  }

  return (
    <div className={cn("inline-flex items-center gap-1", className)}>
      <div 
        className={cn(
          "rounded-full",
          config.color,
          sizeClass
        )}
        title={`${config.description} - ${config.label}`}
      />
      {showLabel && (
        <span className="text-xs text-muted-foreground">
          {config.label}
        </span>
      )}
    </div>
  );
};

export default QualitativeSignal; 