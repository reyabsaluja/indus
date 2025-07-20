"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  getCachedExplanation,
  isLoading,
  fetchExplanation,
  subscribeToCacheUpdates,
} from "@/hooks/useExplanation";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import FormattedText from "@/components/FormattedText";
import { ValueAnalysis } from "@/lib/types";
import { ContextChatTrigger } from "@/components/chat/ContextChatTrigger";
import QualitativeSignal from "@/components/QualitativeSignal";

type HoverableProps = {
  symbol: string;
  metric: string;
  value: number;
  children: React.ReactNode;
  onChatTrigger?: (
    metricKey: string,
    metricLabel: string,
    value: number | string
  ) => void;
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
  const [explanation, setExplanation] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);

  const key = `${symbol}_${metric}`;

  const updateExplanation = useCallback(() => {
    const cached = getCachedExplanation(symbol, metric);
    const currentlyLoading = isLoading(symbol, metric);
    setExplanation(cached);
    setLoading(currentlyLoading);
  }, [symbol, metric]);

  useEffect(() => {
    updateExplanation();
  }, [updateExplanation]);

  useEffect(() => {
    const unsubscribe = subscribeToCacheUpdates(
      symbol,
      metric,
      updateExplanation
    );
    return () => unsubscribe?.();
  }, [symbol, metric, updateExplanation]);

  const handleMouseEnter = useCallback(() => {
    const cached = getCachedExplanation(symbol, metric);
    const currentlyLoading = isLoading(symbol, metric);

    if (!cached && !currentlyLoading) {
      setLoading(true);
      fetchExplanation(symbol, metric, value).catch((err) => {
        console.error(`Fetch error for ${key}:`, err);
        setLoading(false);
      });
    }
  }, [symbol, metric, value, key]);

  // Parse the explanation if it's structured JSON
  const parseExplanation = useCallback((rawExplanation: string) => {
    try {
      const parsed: ValueAnalysis = JSON.parse(rawExplanation);
      return parsed;
    } catch {
      // If it's not JSON, treat as plain text (fallback)
      return null;
    }
  }, []);

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-4">
          <div className="text-sm text-muted-foreground">Loading...</div>
        </div>
      );
    }

    if (!explanation) {
      return (
        <div className="text-sm text-muted-foreground">
          No explanation available.
        </div>
      );
    }

    const valueAnalysis = parseExplanation(explanation);

    if (valueAnalysis) {
      return (
        <div className="space-y-4">
          <div className="border-b border-border pb-2">
            <div className="flex items-center gap-2">
              <FormattedText
                text={valueAnalysis.metric_display}
                className="text-base leading-relaxed flex-1"
              />
              {valueAnalysis.evaluation && (
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
  const currentEvaluation = explanation ? (() => {
    try {
      const parsed: ValueAnalysis = JSON.parse(explanation);
      return parsed.evaluation;
    } catch {
      return null;
    }
  })() : null;

  return (
    <HoverCard openDelay={100} closeDelay={100}>
      <HoverCardTrigger
        onMouseEnter={handleMouseEnter}
        className="cursor-help underline decoration-dotted decoration-2 underline-offset-2"
      >
        <div className="inline-flex items-center gap-1.5">
          {children}
          {currentEvaluation && (
            <QualitativeSignal 
              evaluation={currentEvaluation}
              size="sm"
              className="inline-flex"
            />
          )}
        </div>
      </HoverCardTrigger>
      <HoverCardContent className="max-w-sm w-80 text-sm p-4">
        {renderContent()}
      </HoverCardContent>
    </HoverCard>
  );
};

export default Hoverable;
