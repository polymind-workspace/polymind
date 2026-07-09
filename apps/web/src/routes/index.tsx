import { createFileRoute, useSearch } from "@tanstack/react-router"
import { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { fetchMarkets, type MarketItem } from "@/lib/api/markets"
import { PageLayout } from "@/components/layout/PageLayout"
import { CategoryTabs, type Category } from "@/components/markets/CategoryTabs"
import { TagFilter } from "@/components/markets/TagFilter"
import { FeaturedMarketCard } from "@/components/markets/FeaturedMarketCard"
import { MarketCardCompact } from "@/components/markets/MarketCardCompact"
import { HomeSidebar } from "@/components/home/HomeSidebar"
import { Button } from "@/components/ui/button"
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll"
import { getTagsForCategory } from "@/lib/mock"

export const Route = createFileRoute("/")({
  component: Home,
})

function Home() {
  const { t } = useTranslation()
  const searchParams = useSearch({ from: "/" }) as { search?: string }
  const search = searchParams.search ?? ""

  const [category, setCategory] = useState<Category>("all")
  const [tag, setTag] = useState("全部")
  const [markets, setMarkets] = useState<MarketItem[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const tags = useMemo(() => getTagsForCategory(category), [category])

  const loadMarkets = async (nextPage = 1, replace = false) => {
    setLoading(true)
    setError("")
    try {
      const payload = await fetchMarkets({
        category,
        search,
        page: nextPage,
        limit: 24,
      })
      setMarkets((prev) => (replace ? payload.items : [...prev, ...payload.items]))
      setHasMore(payload.hasMore)
      setPage(nextPage)
    } catch (e) {
      setError(t("home.loadFailed"))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadMarkets(1, true)
  }, [category, search])

  useEffect(() => {
    // reset tag when category changes
    setTag("全部")
  }, [category])

  const filtered = useMemo(() => {
    if (tag === "全部") return markets
    const term = tag.toLowerCase()
    return markets.filter(
      (m) =>
        m.tags?.some((t) => t.toLowerCase().includes(term)) ||
        m.title.toLowerCase().includes(term) ||
        m.category.toLowerCase().includes(term)
    )
  }, [markets, tag])

  const featured = filtered[0]
  const list = filtered.slice(1)

  const { sentinelRef } = useInfiniteScroll({
    onLoadMore: () => {
      if (!loading && hasMore) {
        void loadMarkets(page + 1, false)
      }
    },
    hasMore,
    isLoading: loading,
  })

  return (
    <PageLayout>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px] xl:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <section className="mb-4">
            <CategoryTabs active={category} onSelect={setCategory} />
            <TagFilter
              tags={tags}
              active={tag}
              onSelect={setTag}
              className="mt-2"
            />
          </section>

          {error ? (
            <div className="rounded-xl bg-card p-8 text-center ring-1 ring-border">
              <p className="text-destructive">{error}</p>
              <Button
                variant="outline"
                className="mt-3"
                onClick={() => loadMarkets(1, true)}
              >
                {t("common.retry")}
              </Button>
            </div>
          ) : filtered.length === 0 && !loading ? (
            <div className="rounded-xl bg-card p-8 text-center ring-1 ring-border">
              <h3 className="text-lg font-semibold">{t("home.emptyTitle")}</h3>
              <p className="mt-1 text-muted-foreground">{t("home.emptySub")}</p>
            </div>
          ) : (
            <>
              {featured && (
                <section className="mb-4">
                  <FeaturedMarketCard market={featured} />
                </section>
              )}

              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    {t("home.allMarkets")}
                  </h2>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {list.map((market) => (
                    <MarketCardCompact key={market.id} market={market} />
                  ))}
                </div>
              </section>

              <div
                ref={sentinelRef}
                className="py-6 text-center text-sm text-muted-foreground"
              >
                {loading && t("common.loading")}
                {!loading && !hasMore && filtered.length > 0 && t("common.noMore")}
              </div>
            </>
          )}
        </div>

        <HomeSidebar className="hidden lg:flex" />
      </div>
    </PageLayout>
  )
}
