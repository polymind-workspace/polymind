import { createFileRoute, Link } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { ArrowLeft } from "lucide-react"
import { fetchMarketBySlug, type MarketDetail } from "@/lib/api/markets"
import { PageLayout } from "@/components/layout/PageLayout"
import { OutcomeStats } from "@/components/markets/OutcomeStats"
import { BetPanel } from "@/components/markets/BetPanel"
import { ActivityFeed } from "@/components/markets/ActivityFeed"
import { MarketCard } from "@/components/markets/MarketCard"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/markets/$eventId")({
  component: MarketDetail,
})

function MarketDetail() {
  const { eventId } = Route.useParams()
  const { t } = useTranslation()
  const [market, setMarket] = useState<MarketDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    fetchMarketBySlug(eventId)
      .then((data) => {
        if (!data) throw new Error(t("home.loadFailed"))
        setMarket(data)
      })
      .catch(() => setError(t("home.loadFailed")))
      .finally(() => setLoading(false))
  }, [eventId, t])

  const related = market?.related_markets?.slice(0, 3) ?? []

  if (loading) {
    return (
      <PageLayout>
        <div className="py-12 text-center text-muted-foreground">{t("common.loading")}</div>
      </PageLayout>
    )
  }

  if (error || !market) {
    return (
      <PageLayout>
        <div className="rounded-xl bg-card p-8 text-center ring-1 ring-border">
          <p className="text-destructive">{error || t("home.emptyTitle")}</p>
        </div>
      </PageLayout>
    )
  }

  const statusColor =
    market.status === "open"
      ? "bg-green-500/10 text-green-500"
      : "bg-blue-500/10 text-blue-500"

  return (
    <PageLayout>
      <Button
        variant="ghost"
        size="sm"
        className="mb-4"
        render={<Link to="/" />}
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        {t("common.back")}
      </Button>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="mb-6">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className={cn("uppercase", statusColor)}>
                {market.status === "open" ? t("market.statusOpen") : t("market.statusResolved")}
              </Badge>
              {market.tags?.map((tag) => (
                <Badge key={tag} variant="outline">{tag}</Badge>
              ))}
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{market.title}</h1>
            <p className="mt-2 text-muted-foreground">{market.description}</p>
          </div>

          <OutcomeStats
            yesProbability={market.yesProbability}
            noProbability={market.noProbability}
            yesPool={market.yesPool}
            noPool={market.noPool}
            volume={market.volume}
            className="mb-6"
          />

          <ActivityFeed activities={market.activity} />

          {related.length > 0 && (
            <div className="mt-8">
              <h3 className="mb-3 font-semibold">{t("market.related")}</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {related.map((m) => (
                  <MarketCard key={m.id} market={m} />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-1">
          <BetPanel
            yesProbability={market.yesProbability}
            noProbability={market.noProbability}
            yesPool={market.yesPool}
            noPool={market.noPool}
            onBet={(side, amount) => {
              // eslint-disable-next-line no-console
              console.log("bet", side, amount)
            }}
            className="sticky top-24"
          />
        </div>
      </div>
    </PageLayout>
  )
}
