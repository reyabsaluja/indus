"use client";

import React from "react";
import { MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ContextChatTriggerProps {
  metricKey: string;
  label: string;
  value: number | string;
  onTrigger: (metricKey: string, label: string, value: number | string) => void;
  isNumericMetric?: boolean;
}

export const ContextChatTrigger: React.FC<ContextChatTriggerProps> = ({
  metricKey,
  label,
  value,
  onTrigger,
  isNumericMetric = true,
}) => {
  // Only show for numeric metrics
  if (!isNumericMetric) {
    return null;
  }

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onTrigger(metricKey, label, value);
  };

  return (
    <div className="pt-3 mt-3 border-t border-border">
      <Button
        variant="secondary"
        size="sm"
        onClick={handleClick}
        className="text-xs h-7 gap-1.5 w-full"
      >
        <MessageSquare className="h-3.5 w-3.5" />
        Ask more
      </Button>
    </div>
  );
}; 