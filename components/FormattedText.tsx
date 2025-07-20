"use client";

import React from "react";

type FormattedTextProps = {
  text: string;
  className?: string;
};

const FormattedText: React.FC<FormattedTextProps> = ({
  text,
  className = "",
}) => {
  // Parse text and replace **text** with bold formatting
  const parseText = (inputText: string) => {
    const parts = inputText.split(/(\*\*.*?\*\*)/);

    return parts.map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        const boldText = part.slice(2, -2);
        return (
          <strong key={index} className="font-semibold">
            {boldText}
          </strong>
        );
      }
      return part;
    });
  };

  return <span className={className}>{parseText(text)}</span>;
};

export default FormattedText;
