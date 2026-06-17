import React, { useCallback, useRef, useEffect } from "react"

interface CardGridProps {
  data: Record<string, unknown>[]
  cardRenderer: (row: Record<string, unknown>, index: number) => React.ReactNode
  emptyMessage?: string
  loading?: boolean
  infiniteScroll?: boolean
  onLoadMore?: () => void
  hasMoreData?: boolean
  loadingMore?: boolean
}

const CardGrid: React.FC<CardGridProps> = ({
  data,
  cardRenderer,
  emptyMessage = "No records found",
  loading = false,
  infiniteScroll = false,
  onLoadMore,
  hasMoreData = false,
  loadingMore = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const autoLoadAttemptedRef = useRef<number>(0)

  const handleScroll = useCallback(() => {
    if (!infiniteScroll || !onLoadMore || loadingMore || !hasMoreData) return

    const container = containerRef.current
    if (!container) return

    const { scrollTop, scrollHeight, clientHeight } = container
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight

    if (distanceFromBottom < 150) {
      onLoadMore()
    }
  }, [infiniteScroll, onLoadMore, loadingMore, hasMoreData])

  useEffect(() => {
    if (!infiniteScroll || !onLoadMore || loadingMore || !hasMoreData) return

    const container = containerRef.current
    if (!container) return

    if (autoLoadAttemptedRef.current === data.length) return

    const checkAndLoadMore = () => {
      const { scrollHeight, clientHeight } = container
      if (scrollHeight <= clientHeight + 20 && hasMoreData && !loadingMore) {
        autoLoadAttemptedRef.current = data.length
        onLoadMore()
      }
    }

    const timeoutId = setTimeout(checkAndLoadMore, 300)
    return () => clearTimeout(timeoutId)
  }, [infiniteScroll, onLoadMore, loadingMore, hasMoreData, data.length])

  if (!loading && data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-500">
        <svg
          className="w-16 h-16 mb-4 opacity-40"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.2"
            d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
          />
        </svg>
        <p className="text-sm font-medium">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="overflow-auto flex-1 p-4"
      onScroll={handleScroll}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
        {data.map((row, index) => (
          <React.Fragment key={index}>
            {cardRenderer(row, index)}
          </React.Fragment>
        ))}
      </div>

      {infiniteScroll && loadingMore && (
        <div className="flex items-center justify-center py-6 gap-2">
          <div className="flex gap-1">
            <span className="w-2 h-2 rounded-full bg-brand-500 animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-2 h-2 rounded-full bg-brand-500 animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="w-2 h-2 rounded-full bg-brand-500 animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">Loading more...</span>
        </div>
      )}

      {infiniteScroll && !hasMoreData && data.length > 0 && (
        <div className="flex items-center justify-center py-4">
          <span className="text-xs text-gray-400 dark:text-gray-500">All records loaded</span>
        </div>
      )}

      {!infiniteScroll && loading && (
        <div className="flex items-center justify-center py-6">
          <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-r-transparent" />
          <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">Loading...</span>
        </div>
      )}
    </div>
  )
}

export default CardGrid
