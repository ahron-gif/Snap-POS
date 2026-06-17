import { useEffect, useMemo, useState } from "react"
import { useLocation, useNavigate } from "react-router"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { useHelp } from "../../context/HelpContext"
import {
  defaultTopic,
  getTopic,
  getTopicForRoute,
  searchTopics,
} from "./helpContent"
import type { HelpTopic } from "./helpContent"
import { useOpenScreen } from "./useOpenScreen"

/**
 * Side-drawer help panel. Mounted once at the app root.
 *
 * Opens via `useHelp().openHelp()` or F1. Shows route-relevant help by default;
 * a search box lets the user jump anywhere. A footer link opens the dedicated
 * Help Center page (/help) for a full browsing experience.
 */
const HelpDrawer = () => {
  const { isOpen, closeHelp, pinnedTopicKey } = useHelp()
  const location = useLocation()
  const navigate = useNavigate()
  const openScreen = useOpenScreen()
  const [query, setQuery] = useState("")
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setQuery("")
      setSelectedKey(pinnedTopicKey ?? null)
    }
  }, [isOpen, pinnedTopicKey])

  const topic: HelpTopic = useMemo(() => {
    if (selectedKey) return getTopic(selectedKey) ?? defaultTopic
    if (pinnedTopicKey) return getTopic(pinnedTopicKey) ?? defaultTopic
    return getTopicForRoute(location.pathname) ?? defaultTopic
  }, [selectedKey, pinnedTopicKey, location.pathname])

  const searchResults = useMemo(() => (query.trim() ? searchTopics(query) : []), [query])

  if (!isOpen) return null

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/30" onClick={closeHelp} aria-hidden="true" />

      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="help-drawer-title"
        className="fixed right-0 top-0 z-[61] flex h-screen w-full max-w-md flex-col bg-white shadow-2xl dark:bg-gray-900"
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-200 px-5 py-4 dark:border-gray-700">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093M12 17h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Help
            </div>
            <h2
              id="help-drawer-title"
              className="mt-0.5 truncate text-lg font-semibold text-gray-900 dark:text-white"
            >
              {topic.title}
            </h2>
            <p className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">{topic.summary}</p>
          </div>
          <button
            type="button"
            onClick={closeHelp}
            className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            aria-label="Close help"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="border-b border-gray-200 px-5 py-3 dark:border-gray-700">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search help topics..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-9 pr-3 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
            />
          </div>

          {query.trim() && (
            <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
              {searchResults.length === 0 ? (
                <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">No topics found.</div>
              ) : (
                searchResults.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => {
                      setSelectedKey(t.key)
                      setQuery("")
                    }}
                    className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    <div className="font-medium text-gray-900 dark:text-white">{t.title}</div>
                    <div className="truncate text-xs text-gray-500 dark:text-gray-400">{t.summary}</div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <article className="help-markdown text-sm text-gray-700 dark:text-gray-300">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h2: (props) => (
                  <h2
                    className="mt-5 mb-2 text-base font-semibold text-gray-900 dark:text-white"
                    {...props}
                  />
                ),
                h3: (props) => (
                  <h3 className="mt-4 mb-2 text-sm font-semibold text-gray-900 dark:text-white" {...props} />
                ),
                p: (props) => <p className="my-2 leading-relaxed" {...props} />,
                ul: (props) => <ul className="my-2 list-disc space-y-1 pl-5" {...props} />,
                ol: (props) => <ol className="my-2 list-decimal space-y-1 pl-5" {...props} />,
                li: (props) => <li className="leading-relaxed" {...props} />,
                code: (props) => (
                  <code
                    className="rounded bg-gray-100 px-1 py-0.5 text-xs text-pink-700 dark:bg-gray-800 dark:text-pink-300"
                    {...props}
                  />
                ),
                pre: (props) => (
                  <pre
                    className="my-3 overflow-x-auto rounded-md bg-gray-50 p-3 text-xs dark:bg-gray-800"
                    {...props}
                  />
                ),
                strong: (props) => (
                  <strong className="font-semibold text-gray-900 dark:text-white" {...props} />
                ),
                a: (props) => (
                  <a
                    className="text-blue-600 underline hover:text-blue-700 dark:text-blue-400"
                    target="_blank"
                    rel="noopener noreferrer"
                    {...props}
                  />
                ),
              }}
            >
              {topic.body}
            </ReactMarkdown>
          </article>
        </div>

        <div className="flex flex-col gap-2 border-t border-gray-200 px-5 py-3 dark:border-gray-700">
          {topic.route && (
            <button
              type="button"
              onClick={() => {
                closeHelp()
                openScreen(topic.route!)
              }}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600"
            >
              Go to this screen
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14 5l7 7m0 0l-7 7m7-7H3"
                />
              </svg>
            </button>
          )}
          <div className="flex items-center justify-between gap-2 text-xs">
            <button
              type="button"
              onClick={() => {
                closeHelp()
                navigate(`/help?topic=${topic.key}`)
              }}
              className="font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400"
            >
              Open in Help Center →
            </button>
            <span className="text-gray-400 dark:text-gray-500">
              <kbd className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] dark:bg-gray-800">F1</kbd> to toggle
            </span>
          </div>
        </div>
      </aside>
    </>
  )
}

export default HelpDrawer
