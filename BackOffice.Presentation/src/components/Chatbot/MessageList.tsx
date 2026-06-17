import React, { useEffect, useRef } from "react";
import type { ChatUiMessage } from "../../types/chatbot";
import MessageBubble from "./MessageBubble";

interface Props {
  messages: ChatUiMessage[];
  isSending: boolean;
  runningLabel?: string;
  onRegenerateLast?: () => void;
}

const MessageList: React.FC<Props> = ({ messages, isSending, runningLabel, onRegenerateLast }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  return (
    <div className="flex-1 overflow-y-auto p-4">
      {messages.length === 0 && !isSending && (
        <div className="text-center text-sm text-gray-500 dark:text-gray-400 mt-8">
          <p className="font-medium mb-1">AI Assistant</p>
          <p>Ask about items, customers, inventory, or sales.</p>
        </div>
      )}

      {messages.map((m, idx) => (
        <MessageBubble
          key={m.id}
          message={m}
          isLast={idx === messages.length - 1}
          onRegenerate={
            idx === messages.length - 1 && m.role === "assistant"
              ? onRegenerateLast
              : undefined
          }
        />
      ))}

      {isSending && (
        <div className="mr-auto max-w-[85%] mb-3">
          <div className="rounded-2xl px-4 py-2.5 bg-gray-100 dark:bg-white/[0.05] text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
            <span className="inline-flex gap-1">
              <span className="animate-bounce">.</span>
              <span className="animate-bounce [animation-delay:120ms]">.</span>
              <span className="animate-bounce [animation-delay:240ms]">.</span>
            </span>
            {runningLabel && (
              <span className="text-[11px] italic">{runningLabel}</span>
            )}
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
};

export default MessageList;
