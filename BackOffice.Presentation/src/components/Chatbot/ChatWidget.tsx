import React, { useState, useCallback, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import CloseIcon from "@mui/icons-material/Close";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import MenuIcon from "@mui/icons-material/Menu";
import OpenInFullIcon from "@mui/icons-material/OpenInFull";
import CloseFullscreenIcon from "@mui/icons-material/CloseFullscreen";
import StarOutlineIcon from "@mui/icons-material/StarOutline";
import StarIcon from "@mui/icons-material/Star";
import { chatService } from "../../services/chatService";
import type {
  ChatConversationDto,
  ChatPageContextDto,
  ChatUiMessage,
} from "../../types/chatbot";
import MessageList from "./MessageList";
import ChatInput from "./ChatInput";
import ConversationSidebar from "./ConversationSidebar";
import { searchTopics, topics as allTopics, CATEGORIES } from "../help/helpContent";

/** Chat modes. "data" routes to the server-side LLM with business tools.
 *  "docs" runs an entirely client-side search over the help corpus. */
type ChatMode = "data" | "docs";

const DEFAULT_PROMPTS: Record<ChatMode, string[]> = {
  data: [
    "Item-wise sales in last 30 days",
    "Top selling items this month",
    "Low stock items",
    "Daily sales trend last 30 days",
    "Who owes us money?",
    "Sales by department",
  ],
  docs: [
    "How do I install the Print Helper?",
    "Why is the agent not detected?",
    "How do I pair this browser?",
    "What is the Items List page?",
    "How do I switch to a new environment?",
    "Where do I configure printer mappings?",
  ],
};

const FAVORITES_KEY = "backoffice.chat.favorites";
const MODE_KEY = "backoffice.chat.mode";

const loadMode = (): ChatMode | null => {
  try {
    const raw = localStorage.getItem(MODE_KEY);
    return raw === "data" || raw === "docs" ? raw : null;
  } catch {
    return null;
  }
};

const saveMode = (mode: ChatMode | null) => {
  try {
    if (mode) localStorage.setItem(MODE_KEY, mode);
    else localStorage.removeItem(MODE_KEY);
  } catch {
    /* ignore quota */
  }
};

const loadFavorites = (): string[] => {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
};

const saveFavorites = (favs: string[]) => {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs));
  } catch {
    /* ignore quota errors */
  }
};

const buildPageContext = (pathname: string): ChatPageContextDto => {
  const ctx: ChatPageContextDto = { route: pathname };
  const match = pathname.match(/\/([a-z-]+)\/(?:edit|view|detail)\/([0-9a-f-]{8,})/i);
  if (match) {
    ctx.entityType = match[1];
    ctx.entityId = match[2];
  }
  return ctx;
};

const ChatWidget: React.FC = () => {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [messages, setMessages] = useState<ChatUiMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [conversationGuid, setConversationGuid] = useState<string | null>(null);
  const [runningLabel, setRunningLabel] = useState<string | undefined>(undefined);
  const [favorites, setFavorites] = useState<string[]>(() => loadFavorites());
  const [sidebarReloadKey, setSidebarReloadKey] = useState(0);
  const [mode, setMode] = useState<ChatMode | null>(() => loadMode());

  useEffect(() => { saveFavorites(favorites); }, [favorites]);
  useEffect(() => { saveMode(mode); }, [mode]);

  const quickPrompts = useMemo<string[]>(() => {
    const active = mode ? DEFAULT_PROMPTS[mode] : []
    const combined = [...favorites];
    for (const p of active) {
      if (!combined.includes(p)) combined.push(p);
    }
    return combined.slice(0, 8);
  }, [favorites, mode]);

  const lastUserPrompt = useMemo<string | null>(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") return messages[i].content;
    }
    return null;
  }, [messages]);

  /** Build an assistant reply from the local help corpus (no server roundtrip). */
  const buildDocsReply = useCallback((query: string): ChatUiMessage => {
    const hits = searchTopics(query).slice(0, 5);
    if (hits.length === 0) {
      return {
        id: `a-${Date.now()}`,
        role: "assistant",
        content:
          `I couldn't find a help topic matching **"${query}"**. ` +
          `Try different keywords, or [browse the Help Center](/help) to see all topics by category.`,
        createdAt: new Date().toISOString(),
        suggestedFollowUps: [
          "How do I install the Print Helper?",
          "Why is the agent not detected?",
          "What is the Dashboard?",
        ],
      };
    }

    const top = hits[0];
    const others = hits.slice(1);

    // Build the main answer: link the title to the full topic page so it's obvious it's clickable.
    let content = `### [${top.title} →](/help?topic=${top.key})\n\n*${top.summary}*\n\n${top.body}`;

    // Call-to-action row: "Go to this screen" (if the topic represents an actual page)
    // and "Read full topic" — always offered.
    content += `\n\n`;
    if (top.route) {
      content += `**[🔗 Go to this screen →](${top.route})** · `;
    }
    content += `**[📖 Read in Help Center →](/help?topic=${top.key})**`;

    if (others.length > 0) {
      content += `\n\n---\n\n**Related topics:**\n`;
      for (const h of others) {
        const screenLink = h.route ? ` · [open](${h.route})` : "";
        content += `\n- **[${h.title}](/help?topic=${h.key})** — ${h.summary}${screenLink}`;
      }
    }

    return {
      id: `a-${Date.now()}`,
      role: "assistant",
      content,
      createdAt: new Date().toISOString(),
      suggestedFollowUps: others.slice(0, 3).map((h) => h.title),
    };
  }, []);

  const handleSend = useCallback(
    async (content: string) => {
      const userMsg: ChatUiMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        content,
        createdAt: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsSending(true);
      setRunningLabel(mode === "docs" ? "Searching help…" : "Thinking…");

      // Docs mode: local search, no server call.
      if (mode === "docs") {
        // Small simulated delay so the "Searching help…" indicator is visible.
        await new Promise((resolve) => setTimeout(resolve, 200));
        setMessages((prev) => [...prev, buildDocsReply(content)]);
        setIsSending(false);
        setRunningLabel(undefined);
        return;
      }

      // Data mode: existing server-side LLM flow.
      try {
        const res = await chatService.sendMessage({
          conversationGuid,
          content,
          context: buildPageContext(location.pathname),
        });
        if (!conversationGuid) {
          setConversationGuid(res.conversationGuid);
          setSidebarReloadKey((k) => k + 1);
        }
        if (res.toolsInvoked && res.toolsInvoked.length > 0) {
          setRunningLabel(`Running ${res.toolsInvoked[0].toolName.replace(/_/g, " ")}…`);
        }
        setMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            content: res.assistantReply,
            createdAt: new Date().toISOString(),
            toolsInvoked: res.toolsInvoked,
            visualizations: res.visualizations,
            links: res.links,
            suggestedFollowUps: res.suggestedFollowUps,
          },
        ]);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Something went wrong";
        setMessages((prev) => [
          ...prev,
          {
            id: `e-${Date.now()}`,
            role: "error",
            content: msg,
            createdAt: new Date().toISOString(),
          },
        ]);
      } finally {
        setIsSending(false);
        setRunningLabel(undefined);
      }
    },
    [conversationGuid, location.pathname, mode, buildDocsReply],
  );

  const handleRegenerateLast = useCallback(() => {
    if (!lastUserPrompt || isSending) return;
    setMessages((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      if (last.role === "assistant" || last.role === "error") {
        return prev.slice(0, -1);
      }
      return prev;
    });
    void handleSend(lastUserPrompt);
  }, [lastUserPrompt, isSending, handleSend]);

  const handleReset = useCallback(() => {
    setMessages([]);
    setConversationGuid(null);
    setRunningLabel(undefined);
  }, []);

  /**
   * Hard reset triggered by the trash icon: clears the conversation AND the
   * selected mode, returning the user to the "How can I help?" mode picker.
   * Mode-switch buttons (Data / Docs pills) use the softer `handleReset` so
   * they preserve the just-selected mode.
   */
  const handleClearAll = useCallback(() => {
    setMode(null);
    setMessages([]);
    setConversationGuid(null);
    setRunningLabel(undefined);
  }, []);

  const handleSelectConversation = useCallback(async (guid: string) => {
    try {
      const conv: ChatConversationDto | null = await chatService.getConversation(guid);
      if (!conv) return;
      const loaded: ChatUiMessage[] = conv.messages.map((m, i) => ({
        id: `h-${guid}-${i}`,
        role: m.role === 1 ? "user" : "assistant",
        content: m.content,
        createdAt: m.createdAt,
        visualizations: m.visualizations ?? undefined,
        links: m.links ?? undefined,
        suggestedFollowUps: m.suggestedFollowUps ?? undefined,
      }));
      setMessages(loaded);
      setConversationGuid(conv.conversationGuid);
      setSidebarOpen(false);
    } catch {
      /* ignore */
    }
  }, []);

  const toggleFavorite = useCallback((prompt: string) => {
    setFavorites((prev) =>
      prev.includes(prompt) ? prev.filter((p) => p !== prompt) : [prompt, ...prev].slice(0, 10),
    );
  }, []);

  const lastFollowUps = useMemo<string[]>(() => {
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return [];
    return last.suggestedFollowUps ?? [];
  }, [messages]);

  const showModePicker = mode === null && messages.length === 0 && !isSending;
  const showQuickStart = mode !== null && messages.length === 0 && !isSending;

  const switchMode = useCallback((next: ChatMode) => {
    setMode(next);
    handleReset();
  }, [handleReset]);

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Open AI Assistant"
        className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-brand-500 text-white shadow-lg hover:bg-brand-600 flex items-center justify-center transition-transform hover:scale-105"
      >
        <ChatBubbleOutlineIcon />
      </button>
    );
  }

  const widgetClass = isFullscreen
    ? "fixed inset-4 z-50"
    : "fixed bottom-6 right-6 z-50 w-[420px] h-[620px] max-h-[calc(100vh-6rem)]";

  return (
    <div
      className={`${widgetClass} bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden`}
    >
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-white/[0.03]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label="Toggle conversation list"
            className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-white/[0.06] text-gray-500 dark:text-gray-400"
          >
            <MenuIcon fontSize="small" />
          </button>
          <div className="h-8 w-8 rounded-full bg-brand-500 text-white flex items-center justify-center">
            <ChatBubbleOutlineIcon fontSize="small" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">AI Assistant</h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              {mode === "docs"
                ? "Help & docs mode"
                : mode === "data"
                ? (conversationGuid ? "Data mode — conversation active" : "Data mode — ready")
                : "Choose how to start"}
            </p>
          </div>
        </div>

        {/* Mode switcher pills — shown once a mode has been picked. */}
        {mode !== null && (
          <div className="hidden sm:flex items-center gap-1 mx-2 rounded-full bg-gray-100 dark:bg-white/[0.06] p-0.5">
            <button
              type="button"
              onClick={() => switchMode("data")}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                mode === "data"
                  ? "bg-white dark:bg-gray-800 text-brand-600 dark:text-brand-300 shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
              }`}
              title="Ask about your business data — sales, inventory, customers"
            >
              📊 Data
            </button>
            <button
              type="button"
              onClick={() => switchMode("docs")}
              className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                mode === "docs"
                  ? "bg-white dark:bg-gray-800 text-brand-600 dark:text-brand-300 shadow-sm"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
              }`}
              title="Search the in-product help & documentation"
            >
              📖 Docs
            </button>
          </div>
        )}
        <div className="flex items-center gap-1">
          {(messages.length > 0 || mode !== null) && (
            <button
              type="button"
              onClick={handleClearAll}
              aria-label="Start over"
              title="Start over (clears chat and returns to mode picker)"
              className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-white/[0.06] text-gray-500 dark:text-gray-400"
            >
              <DeleteOutlineIcon fontSize="small" />
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsFullscreen((v) => !v)}
            aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-white/[0.06] text-gray-500 dark:text-gray-400"
          >
            {isFullscreen ? (
              <CloseFullscreenIcon fontSize="small" />
            ) : (
              <OpenInFullIcon fontSize="small" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="Close"
            className="p-1.5 rounded-md hover:bg-gray-200 dark:hover:bg-white/[0.06] text-gray-500 dark:text-gray-400"
          >
            <CloseIcon fontSize="small" />
          </button>
        </div>
      </div>

      <div className="relative flex-1 flex overflow-hidden">
        <ConversationSidebar
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          activeConversationGuid={conversationGuid}
          onSelect={handleSelectConversation}
          onNew={handleReset}
          reloadKey={sidebarReloadKey}
        />

        <div className="flex-1 flex flex-col min-w-0">
          {/* Suppress the default empty-state placeholder while the mode picker is showing. */}
          {!showModePicker && (
            <MessageList
              messages={messages}
              isSending={isSending}
              runningLabel={runningLabel}
              onRegenerateLast={handleRegenerateLast}
            />
          )}

          {lastFollowUps.length > 0 && !isSending && (
            <div className="px-3 pt-2 pb-1 border-t border-gray-100 dark:border-gray-800/60">
              <p className="mb-1.5 text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
                Follow-up
              </p>
              <div className="flex flex-wrap gap-1.5">
                {lastFollowUps.map((fu) => (
                  <button
                    key={fu}
                    type="button"
                    onClick={() => handleSend(fu)}
                    className="px-2.5 py-1 rounded-full text-[11px] border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.05]"
                  >
                    {fu}
                  </button>
                ))}
              </div>
            </div>
          )}

          {showModePicker && (
            <div className="flex-1 flex flex-col items-center justify-center px-6 pb-6 text-center">
              <div className="mb-4 h-12 w-12 rounded-full bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-300 flex items-center justify-center">
                <ChatBubbleOutlineIcon />
              </div>
              <h4 className="text-base font-semibold text-gray-900 dark:text-white">
                How can I help?
              </h4>
              <p className="mt-1 mb-5 text-xs text-gray-500 dark:text-gray-400 max-w-xs">
                Pick a mode to get started. You can switch any time using the pills at the top.
              </p>
              <div className="grid grid-cols-1 gap-2 w-full max-w-sm">
                <button
                  type="button"
                  onClick={() => setMode("data")}
                  className="group flex items-start gap-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 text-left hover:border-brand-300 hover:bg-brand-50 dark:hover:border-brand-700 dark:hover:bg-brand-900/20 transition-colors"
                >
                  <span className="text-xl">📊</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-gray-900 dark:text-white">
                      Data &amp; reports
                    </span>
                    <span className="block text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                      Sales, inventory, customers, transactions. Ask questions about your business.
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setMode("docs")}
                  className="group flex items-start gap-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 text-left hover:border-brand-300 hover:bg-brand-50 dark:hover:border-brand-700 dark:hover:bg-brand-900/20 transition-colors"
                >
                  <span className="text-xl">📖</span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-gray-900 dark:text-white">
                      Help &amp; docs
                    </span>
                    <span className="block text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                      Search how-to guides, troubleshooting, and reference. {allTopics.length} topics across {Object.keys(CATEGORIES).length} categories.
                    </span>
                  </span>
                </button>
              </div>
            </div>
          )}

          {showQuickStart && (
            <div className="px-3 pt-2 pb-1 border-t border-gray-100 dark:border-gray-800/60">
              <p className="mb-1.5 text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500">
                {mode === "docs" ? "Try searching" : "Try asking"}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {quickPrompts.map((prompt) => {
                  const isFav = favorites.includes(prompt);
                  return (
                    <div
                      key={prompt}
                      className="group flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] border border-brand-200 dark:border-brand-900 text-brand-600 dark:text-brand-300 hover:bg-brand-50 dark:hover:bg-brand-900/20"
                    >
                      <button type="button" onClick={() => handleSend(prompt)}>
                        {prompt}
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleFavorite(prompt)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label={isFav ? "Remove favorite" : "Save favorite"}
                        title={isFav ? "Remove favorite" : "Save favorite"}
                      >
                        {isFav ? (
                          <StarIcon sx={{ fontSize: 14 }} />
                        ) : (
                          <StarOutlineIcon sx={{ fontSize: 14 }} />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <ChatInput onSend={handleSend} disabled={isSending || mode === null} />
        </div>
      </div>
    </div>
  );
};

export default ChatWidget;
