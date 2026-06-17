import React, { useState, KeyboardEvent } from "react";
import SendIcon from "@mui/icons-material/Send";

interface Props {
  onSend: (content: string) => void;
  disabled: boolean;
}

const ChatInput: React.FC<Props> = ({ onSend, disabled }) => {
  const [text, setText] = useState("");

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setText("");
  };

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="border-t border-gray-200 dark:border-gray-800 p-3">
      <div className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask something..."
          rows={1}
          disabled={disabled}
          className="flex-1 resize-none rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50 max-h-32"
        />
        <button
          type="button"
          onClick={submit}
          disabled={disabled || !text.trim()}
          className="flex items-center justify-center h-10 w-10 rounded-lg bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          aria-label="Send message"
        >
          <SendIcon fontSize="small" />
        </button>
      </div>
      <p className="mt-1.5 text-[11px] text-gray-400 dark:text-gray-500">
        Enter to send, Shift+Enter for new line
      </p>
    </div>
  );
};

export default ChatInput;
