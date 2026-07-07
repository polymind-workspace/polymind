import { useCallback, useEffect, useRef, useState } from "react"

interface UseInfiniteScrollOptions {
  onLoadMore: () => void | Promise<void>
  hasMore: boolean
  isLoading: boolean
  threshold?: number
}

export function useInfiniteScroll({
  onLoadMore,
  hasMore,
  isLoading,
  threshold = 200,
}: UseInfiniteScrollOptions) {
  const observerRef = useRef<IntersectionObserver | null>(null)
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const [sentinelEl, setSentinelEl] = useState<HTMLDivElement | null>(null)

  const setSentinel = useCallback((node: HTMLDivElement | null) => {
    sentinelRef.current = node
    setSentinelEl(node)
  }, [])

  useEffect(() => {
    if (!sentinelEl || !hasMore || isLoading) return

    observerRef.current?.disconnect()
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const first = entries[0]
        if (first.isIntersecting) {
          void onLoadMore()
        }
      },
      { rootMargin: `${threshold}px` }
    )
    observerRef.current.observe(sentinelEl)

    return () => observerRef.current?.disconnect()
  }, [sentinelEl, hasMore, isLoading, onLoadMore, threshold])

  return { sentinelRef: setSentinel }
}
