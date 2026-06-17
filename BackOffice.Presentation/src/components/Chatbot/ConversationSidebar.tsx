import React, { useEffect, useState, useCallback } from "react";
import CloseIcon from "@mui/icons-material/Close";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { chatService } from "../../services/chatService";
import type { ChatConversationSummaryDto } from "../../types/chatbot";

interface Props {
  open: boolean;
  onClose: () => void;
  activeConversationGuid: string | null;
  onSelect: (guid: string) => void;
  onNew: () => void;
  reloadKey?: number;
}

const timeAgo = (iso: string): string => {
  const then = new Date(iso).getTime();
  const secs = Math.floor((Date.now() - then) / 1000);
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
};

const ConversationSidebar: React.FC<Props> = ({
  open,
  onClose,
  activeConversationGuid,
  onSelect,
  onNew,
  reloadKey,
}) => {
  const [items, setItems] = useState<ChatConversationSummaryDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await chatService.listConversations();
      setItems(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, reloadKey, load]);

  const handleDelete = useCallback(
    async (guid: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!window.confirm("Delete this conversation?")) return;
      try {
        await chatService.deleteConversation(guid);
        setItems((prev) => prev.filter((c) => c.conversationGuid !== guid));
        if (activeConversationGuid === guid) onNew();
      } catch {
        // swallow; keep the row visible
      }
    },
    [activeConversationGuid, onNew],
  );

  if (!open) return null;

  return (
    <div className="absolute inset-y-0 left-0 z-10 w-[240px] bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-800">
        <span className="text-xs font-semibold text-gray-700 dark:text-gray-200 uppercase tracking-wide">
          Conversations
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onNew}
            title="New conversation"
            aria-label="New conversation"
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-white/[0.06] text-gray-500 dark:text-gray-300"
          >
            <AddIcon fontSize="small" />
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Close"
            aria-label="Close sidebar"
            className="p-1 rounded hover:bg-gray-100 dark:hover:bg-white/[0.06] text-gray-500 dark:text-gray-300"
          >
            <CloseIcon fontSize="small" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && (
          <p className="text-xs text-gray-400 px-3 py-3">Loading…</p>
        )}
        {error && !loading && (
          <p className="text-xs text-red-500 px-3 py-3">{error}</p>
        )}
        {!loading && !error && items.length === 0 && (
          <p className="text-xs text-gray-400 px-3 py-3">No conversations yet.</p>
        )}
        {items.map((c) => {
          const isActive = c.conversationGuid === activeConversationGuid;
          return (
            <button
              key={c.conversationGuid}
              type="button"
              onClick={() => onSelect(c.conversationGuid)}
              className={`group w-full text-left px-3 py-2 border-b border-gray-100 dark:border-gray-800/60 flex items-start gap-2 ${
                isActive
                  ? "bg-brand-50 dark:bg-brand-900/20"
                  : "hover:bg-gray-50 dark:hover:bg-white/[0.03]"
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-800 dark:text-gray-100 truncate">
                  {c.title || "(untitled)"}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {c.totalMessages} msgs · {timeAgo(c.updatedAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={(e) => handleDelete(c.conversationGuid, e)}
                title="Delete"
                aria-label="Delete conversation"
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-gray-400 hover:text-red-500 transition-opacity"
              >
                <DeleteOutlineIcon sx={{ fontSize: 14 }} />
              </button>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ConversationSidebar;
