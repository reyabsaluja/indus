"use client";

import React from "react";
import { ContextChatState } from "@/lib/types";
import { ChatPanel } from "./ChatPanel";

interface ContextChatModalProps {
  state: ContextChatState;
  onClose: () => void;
  onSendMessage: (message: string) => void;
  onRegenerateLast: () => void;
  onClearError: () => void;
}

export const ContextChatModal: React.FC<ContextChatModalProps> = (props) => {
  return <ChatPanel {...props} />;
}; 