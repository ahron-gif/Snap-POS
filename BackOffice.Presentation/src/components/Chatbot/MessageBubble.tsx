import React, { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Link } from "react-router-dom";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";
import RefreshIcon from "@mui/icons-material/Refresh";
import type { ChatEntityLinkDto, ChatUiMessage } from "../../types/chatbot";
import ChatChart from "./ChatChart";
import { resolveEntityRoute } from "./chatEntityRoutes";
import { useOpenScreen } from "../help/useOpenScreen";
import { getTabRoute } from "../../constants/tabRoutes";

interface Props {
  message: ChatUiMessage;
  isLast?: boolean;
  onRegenerate?: () => void;
}

const toolLabel = (name: string): string =>
  name
    .replace(/^(get_|list_|search_|check_|draft_)/, "")
    .replace(/_/g, " ");

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

interface UsableLink {
  label: string;
  route: string;
}

const prepareUsableLinks = (links?: ChatEntityLinkDto[]): UsableLink[] => {
  if (!links || links.length === 0) return [];
  const seen = new Set<string>();
  const out: UsableLink[] = [];
  // longest labels first so partial substrings don't steal matches
  const sorted = [...links].sort((a, b) => b.label.length - a.label.length);
  for (const l of sorted) {
    if (!l.label || l.label.trim().length < 2) continue;
    if (seen.has(l.label.toLowerCase())) continue;
    const route = resolveEntityRoute(l);
    if (!route) continue;
    seen.add(l.label.toLowerCase());
    out.push({ label: l.label, route });
  }
  return out;
};

const renderTextWithLinks = (text: string, usable: UsableLink[]): React.ReactNode => {
  if (usable.length === 0 || !text) return text;
  const pattern = new RegExp(`(${usable.map((u) => escapeRegExp(u.label)).join("|")})`, "g");
  const parts = text.split(pattern);
  const lookup = new Map<string, string>();
  for (const u of usable) lookup.set(u.label, u.route);
  return parts.map((part, idx) => {
    const route = lookup.get(part);
    if (route) {
      return (
        <Link
          key={`lnk-${idx}`}
          to={route}
          className="text-brand-600 dark:text-brand-300 underline decoration-dotted underline-offset-2 hover:decoration-solid"
        >
          {part}
        </Link>
      );
    }
    return <React.Fragment key={`txt-${idx}`}>{part}</React.Fragment>;
  });
};

const MessageBubble: React.FC<Props> = ({ message, isLast, onRegenerate }) => {
  const isUser = message.role === "user";
  const isError = message.role === "error";
  const [copied, setCopied] = useState(false);

  const bubbleClass = isUser
    ? "bg-brand-500 text-white ml-auto"
    : isError
      ? "bg-red-50 text-red-800 border border-red-200 dark:bg-red-900/20 dark:text-red-200 dark:border-red-800"
      : "bg-gray-100 text-gray-800 dark:bg-white/[0.05] dark:text-gray-200";

  const hasCharts = !!message.visualizations && message.visualizations.length > 0;
  const hasRenderableCharts =
    hasCharts &&
    message.visualizations!.some(
      (v) => v.categories.length > 0 && v.series.some((s) => s.data && s.data.length > 0),
    );
  const hasText = !!message.content && message.content.trim().length > 0;
  const canCopy = !isUser && hasText;
  const canRegenerate = !isUser && !isError && isLast && !!onRegenerate;

  const usableLinks = useMemo(
    () => (isUser ? [] : prepareUsableLinks(message.links)),
    [isUser, message.links],
  );

  const openScreen = useOpenScreen();

  /**
   * Render a markdown link with the right navigation strategy:
   *   - href like `/items-list` → tab open via useOpenScreen (most app pages)
   *   - href like `/help?topic=...` or `/profile` → React Router <Link> (real routes)
   *   - http(s):// → external <a> in a new tab
   */
  const MarkdownAnchor = useMemo(
    () =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ({ node: _node, href, children, ...rest }: any) => {
        if (!href) return <>{children}</>;
        const isInternal =
          typeof href === "string" && (href.startsWith("/") || href.startsWith("#"));
        const cls =
          "text-brand-600 dark:text-brand-300 underline decoration-dotted underline-offset-2 hover:decoration-solid";

        if (isInternal) {
          // Strip query string / fragment to check whether the pathname is a tab.
          const pathname = (href as string).split("?")[0].split("#")[0];
          if (getTabRoute(pathname)) {
            // Tab-based screen — open via the dashboard tab system.
            return (
              <button
                type="button"
                onClick={() => openScreen(pathname)}
                className={`${cls} cursor-pointer bg-transparent p-0 border-0 text-left`}
                {...rest}
              >
                {children}
              </button>
            );
          }
          // Real route — let react-router handle it.
          return (
            <Link to={href} className={cls} {...rest}>
              {children}
            </Link>
          );
        }
        return (
          <a href={href} target="_blank" rel="noopener noreferrer" className={cls} {...rest}>
            {children}
          </a>
        );
      },
    [openScreen],
  );

  const markdownComponents = useMemo(() => {
    // Explicit styling for every markdown element we care about, because the
    // Tailwind Typography (`prose`) plugin isn't installed in this project — so
    // the default <ul>, <h2>, <strong> etc. would otherwise render unstyled.
    //
    // We destructure react-markdown's `node` prop out before spreading so it
    // never leaks onto a real DOM element (React would warn). Component prop
    // types are intentionally loose (`any`) to stay compatible with
    // react-markdown v10's Components interface across point releases.
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const baseStyles = {
      a: MarkdownAnchor,
      h1: ({ node: _node, ...props }: any) => (
        <h1 className="mt-3 mb-2 text-base font-bold text-gray-900 dark:text-white" {...props} />
      ),
      h2: ({ node: _node, ...props }: any) => (
        <h2 className="mt-3 mb-1.5 text-sm font-semibold text-gray-900 dark:text-white" {...props} />
      ),
      h3: ({ node: _node, ...props }: any) => (
        <h3 className="mt-3 mb-1.5 text-sm font-semibold text-gray-900 dark:text-white" {...props} />
      ),
      ul: ({ node: _node, ...props }: any) => (
        <ul className="my-2 list-disc space-y-1 pl-5" {...props} />
      ),
      ol: ({ node: _node, ...props }: any) => (
        <ol className="my-2 list-decimal space-y-1 pl-5" {...props} />
      ),
      strong: ({ node: _node, ...props }: any) => (
        <strong className="font-semibold text-gray-900 dark:text-white" {...props} />
      ),
      em: ({ node: _node, ...props }: any) => (
        <em className="italic text-gray-700 dark:text-gray-300" {...props} />
      ),
      hr: ({ node: _node, ...props }: any) => (
        <hr className="my-3 border-gray-200 dark:border-gray-700" {...props} />
      ),
      code: ({ node: _node, ...props }: any) => (
        <code
          className="rounded bg-gray-200 px-1 py-0.5 text-xs text-pink-700 dark:bg-gray-700 dark:text-pink-300"
          {...props}
        />
      ),
      pre: ({ node: _node, ...props }: any) => (
        <pre
          className="my-2 overflow-x-auto rounded-md bg-gray-200 p-2 text-xs dark:bg-gray-700"
          {...props}
        />
      ),
      blockquote: ({ node: _node, ...props }: any) => (
        <blockquote
          className="my-2 border-l-2 border-gray-300 pl-3 italic text-gray-700 dark:border-gray-600 dark:text-gray-300"
          {...props}
        />
      ),
      table: ({ node: _node, ...props }: any) => (
        <div className="my-2 overflow-x-auto">
          <table className="min-w-full border-collapse text-xs" {...props} />
        </div>
      ),
      thead: ({ node: _node, ...props }: any) => (
        <thead className="bg-gray-200/60 dark:bg-white/[0.04]" {...props} />
      ),
      th: ({ node: _node, ...props }: any) => (
        <th
          className="border border-gray-300 px-2 py-1 text-left font-semibold dark:border-gray-700"
          {...props}
        />
      ),
      td: ({ node: _node, ...props }: any) => (
        <td className="border border-gray-300 px-2 py-1 dark:border-gray-700" {...props} />
      ),
    };
    /* eslint-enable @typescript-eslint/no-explicit-any */

    if (usableLinks.length === 0) {
      // No entity-link replacement needed — use the base styles only.
      return {
        ...baseStyles,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        p: ({ node: _node, ...props }: any) => (
          <p className="my-1.5 leading-relaxed" {...props} />
        ),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        li: ({ node: _node, ...props }: any) => (
          <li className="leading-relaxed" {...props} />
        ),
      };
    }

    // Entity-link replacement path: wrap text children with renderTextWithLinks
    // while keeping all our element-level styling.
    return {
      ...baseStyles,
      p: (props: { children?: React.ReactNode }) => (
        <p className="my-1.5 leading-relaxed">
          {React.Children.map(props.children, (child, idx) =>
            typeof child === "string" ? (
              <React.Fragment key={idx}>{renderTextWithLinks(child, usableLinks)}</React.Fragment>
            ) : (
              child
            ),
          )}
        </p>
      ),
      li: (props: { children?: React.ReactNode }) => (
        <li className="leading-relaxed">
          {React.Children.map(props.children, (child, idx) =>
            typeof child === "string" ? (
              <React.Fragment key={idx}>{renderTextWithLinks(child, usableLinks)}</React.Fragment>
            ) : (
              child
            ),
          )}
        </li>
      ),
      td: (props: { children?: React.ReactNode }) => (
        <td>
          {React.Children.map(props.children, (child, idx) =>
            typeof child === "string" ? (
              <React.Fragment key={idx}>{renderTextWithLinks(child, usableLinks)}</React.Fragment>
            ) : (
              child
            ),
          )}
        </td>
      ),
    };
  }, [usableLinks, MarkdownAnchor]);

  if (!isUser && !hasText && !hasRenderableCharts) {
    return null;
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className={`max-w-[92%] ${isUser ? "ml-auto" : "mr-auto"} mb-3`}>
      {hasText && (
        <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${bubbleClass}`}>
          {isUser ? (
            <p className="whitespace-pre-wrap break-words">{message.content}</p>
          ) : (
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{message.content}</ReactMarkdown>
            </div>
          )}
        </div>
      )}

      {hasRenderableCharts && (
        <div className={`${hasText ? "mt-2" : ""} space-y-2`}>
          {message.visualizations!
            .filter(
              (v) => v.categories.length > 0 && v.series.some((s) => s.data && s.data.length > 0),
            )
            .map((viz, idx) => (
              <ChatChart key={`viz-${message.id}-${idx}`} viz={viz} />
            ))}
        </div>
      )}

      {(canCopy || canRegenerate) && (
        <div className="mt-1 flex items-center gap-1">
          {canCopy && (
            <button
              type="button"
              onClick={handleCopy}
              title={copied ? "Copied" : "Copy"}
              aria-label={copied ? "Copied" : "Copy"}
              className="p-1 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-white/[0.06]"
            >
              {copied ? <CheckIcon sx={{ fontSize: 14 }} /> : <ContentCopyIcon sx={{ fontSize: 14 }} />}
            </button>
          )}
          {canRegenerate && (
            <button
              type="button"
              onClick={onRegenerate}
              title="Regenerate"
              aria-label="Regenerate"
              className="p-1 rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-white/[0.06]"
            >
              <RefreshIcon sx={{ fontSize: 14 }} />
            </button>
          )}
          {message.toolsInvoked && message.toolsInvoked.length > 0 && (
            <span className="text-[11px] text-gray-500 dark:text-gray-400 ml-1">
              Used: {[...new Set(message.toolsInvoked.map((t) => toolLabel(t.toolName)))].join(", ")}
            </span>
          )}
        </div>
      )}
    </div>
  );
};

export default MessageBubble;
