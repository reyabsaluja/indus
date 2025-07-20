"use client";

import React from "react";
import { Button } from "@/components/ui/button";

interface SuggestionChipsProps {
  onSendMessage: (message: string) => void;
}

export const SuggestionChips: React.FC<SuggestionChipsProps> = ({
  onSendMessage,
}) => {
  const suggestions = [
    "Explain valuation",
    "Compare margins", 
    "Debt risk?"
  ];

  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {suggestions.map((suggestion) => (
        <Button
          key={suggestion}
          variant="ghost"
          size="sm"
          onClick={() => onSendMessage(suggestion)}
          className="text-xs px-2 py-1 rounded-md bg-zinc-800/70 hover:bg-zinc-700/70 border border-zinc-700/40 text-zinc-300 hover:text-zinc-100"
        >
          {suggestion}
        </Button>
      ))}
    </div>
  );
}; 