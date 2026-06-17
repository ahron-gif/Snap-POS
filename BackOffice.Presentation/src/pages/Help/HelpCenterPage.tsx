import { useEffect, useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import {
  CATEGORIES,
  defaultTopic,
  getTopic,
  searchTopics,
  topicsByCategory,
} from "../../components/help/helpContent"
import type { HelpTopic } from "../../components/help/helpContent"
import { useOpenScreen } from "../../components/help/useOpenScreen"

/**
 * Dedicated /help page — a "mini docs site" inside the product.
 *
 *  - Left sidebar: categories with their topics.
 *  - Right pane: the selected topic's markdown content.
 *  - Top: full-text search across every topic.
 *  - Selected topic is reflected in the URL (/help?topic=key) so links work.
 */
const HelpCenterPage = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const openScreen = useOpenScreen()
  const requestedKey = searchParams.get("topic")
  const [query, setQuery] = useState("")

  const grouped = useMemo(() => topicsByCategory(), [])
  const allMatches = useMemo(() => (query.trim() ? searchTopics(query) : []), [query])

  const selected: HelpTopic = useMemo(
    () => (requestedKey && getTopic(requestedKey)) || defaultTopic,
    [requestedKey]
  )

  // Ensure URL reflects a valid topic at all times.
  useEffect(() => {
    if (!requestedKey) {
      setSearchParams({ topic: defaultTopic.key }, { replace: true })
    }
  }, [requestedKey, setSearchParams])

  const selectTopic = (key: string) => {
    setSearchParams({ topic: key })
    // Scroll the right pane to the top after selection
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  return (
    <div className="mx-auto max-w-7xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Help Center</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Every page in BackOffice, every feature, every error message — searchable and linkable. Press{" "}
          <kbd className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] dark:bg-gray-800">F1</kbd> on any screen
          to open contextual help for the page you're on.
        </p>
      </header>

      {/* Search bar */}
      <div className="mb-6 max-w-2xl">
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
            type="search"
            placeholder="Search every help topic..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white py-2.5 pl-9 pr-3 text-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
        </div>

        {query.trim() && (
          <div className="mt-2 rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800">
            {allMatches.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                No topics matched <em>"{query}"</em>.
              </div>
            ) : (
              allMatches.slice(0, 10).map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => {
                    setQuery("")
                    selectTopic(t.key)
                  }}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-gray-900 dark:text-white">{t.title}</span>
                    <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                      {CATEGORIES[t.category].label}
                    </span>
                  </div>
                  <div className="mt-0.5 truncate text-xs text-gray-500 dark:text-gray-400">{t.summary}</div>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Sidebar */}
        <aside className="col-span-12 lg:col-span-3">
          <nav className="sticky top-4 space-y-5 text-sm">
            {(Object.keys(CATEGORIES) as (keyof typeof CATEGORIES)[]).map((catKey) => {
              const items = grouped[catKey]
              if (items.length === 0) return null
              return (
                <div key={catKey}>
                  <div className="px-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {CATEGORIES[catKey].label}
                  </div>
                  <ul className="mt-1">
                    {items.map((t) => {
                      const isActive = t.key === selected.key
                      return (
                        <li key={t.key}>
                          <button
                            type="button"
                            onClick={() => selectTopic(t.key)}
                            className={`block w-full rounded-md px-2 py-1.5 text-left transition-colors ${
                              isActive
                                ? "bg-blue-50 font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                                : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                            }`}
                          >
                            {t.title}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })}
          </nav>
        </aside>

        {/* Content */}
        <main className="col-span-12 lg:col-span-9">
          <article className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <div className="mb-4 flex items-baseline justify-between gap-3 border-b border-gray-100 pb-4 dark:border-gray-800">
              <div>
                <div className="text-xs font-medium uppercase tracking-wide text-blue-600 dark:text-blue-400">
                  {CATEGORIES[selected.category].label}
                </div>
                <h2 className="mt-1 text-xl font-semibold text-gray-900 dark:text-white">{selected.title}</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{selected.summary}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {selected.route && (
                  <button
                    type="button"
                    onClick={() => openScreen(selected.route!)}
                    title={`Open the ${selected.title} screen`}
                    className="inline-flex items-center gap-1 rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-600"
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
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(`${window.location.origin}/help?topic=${selected.key}`)
                  }}
                  title="Copy a link to this topic"
                  className="text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  Copy link
                </button>
              </div>
            </div>

            <div className="help-markdown text-sm text-gray-700 dark:text-gray-300">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h2: (props) => (
                    <h2
                      className="mt-6 mb-2 text-base font-semibold text-gray-900 dark:text-white"
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
                  table: (props) => (
                    <div className="my-3 overflow-x-auto">
                      <table className="min-w-full border-collapse text-xs" {...props} />
                    </div>
                  ),
                  th: (props) => (
                    <th
                      className="border border-gray-200 bg-gray-50 px-2 py-1 text-left font-semibold dark:border-gray-700 dark:bg-gray-800"
                      {...props}
                    />
                  ),
                  td: (props) => (
                    <td className="border border-gray-200 px-2 py-1 dark:border-gray-700" {...props} />
                  ),
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
                {selected.body}
              </ReactMarkdown>
            </div>

            {selected.keywords.length > 0 && (
              <div className="mt-6 flex flex-wrap items-center gap-1.5 border-t border-gray-100 pt-4 text-xs dark:border-gray-800">
                <span className="text-gray-500 dark:text-gray-400">Tags:</span>
                {selected.keywords.map((kw) => (
                  <span
                    key={kw}
                    className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                  >
                    {kw}
                  </span>
                ))}
              </div>
            )}
          </article>
        </main>
      </div>
    </div>
  )
}

export default HelpCenterPage
