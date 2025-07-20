"use client";

import React from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import FormattedText from "@/components/FormattedText";
import { METRIC_DEFINITIONS } from "@/lib/metric-definitions";
import { ExternalLink } from "lucide-react";

type MetricNameHoverProps = {
  metricName: string;
  children: React.ReactNode;
};

const MetricNameHover: React.FC<MetricNameHoverProps> = ({
  metricName,
  children,
}) => {
  const definition = METRIC_DEFINITIONS[metricName];

  const renderContent = () => {
    if (!definition) {
      return (
        <div className="text-sm text-muted-foreground">
          No definition available for this metric.
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="border-b border-border pb-2">
          <FormattedText
            text={definition.metric_display}
            className="text-base leading-relaxed"
          />
        </div>

        <div className="space-y-3 text-sm leading-relaxed">
          <div>
            <FormattedText text={definition.definition} />
          </div>

          <div>
            <FormattedText text={definition.explanation} />
          </div>
        </div>

        {definition.learn_more_url && (
          <div className="pt-2 border-t border-border">
            <a
              href={definition.learn_more_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:text-primary/80 hover:underline transition-colors"
            >
              Learn more
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
      </div>
    );
  };

  return (
    <HoverCard openDelay={100} closeDelay={100}>
      <HoverCardTrigger className="cursor-help underline decoration-dotted decoration-2 underline-offset-2">
        {children}
      </HoverCardTrigger>
      <HoverCardContent className="max-w-sm w-80 text-sm p-4">
        {renderContent()}
      </HoverCardContent>
    </HoverCard>
  );
};

export default MetricNameHover;
