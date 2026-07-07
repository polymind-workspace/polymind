import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { TrendingUp, Bookmark, Newspaper, LinkIcon } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatNumber } from "@/lib/date"
import type { Market } from "@/types"
import { cn } from "@/lib/utils"

interface FeaturedMarketCardProps {
  market: Market
  className?: string
}

export function FeaturedMarketCard({ market, className }: FeaturedMarketCardProps) {
  const { t, i18n } = useTranslation()
  const end = new Date(market.endTime)
  const isEnded = end.getTime() < Date.now()
  const endLabel = isEnded
    ? t("market.ended")
    : t("market.ends", {
        time: end.toLocaleDateString(i18n.language === "zh" ? "zh-CN" : "en-US", {
          month: "short",
          day: "numeric",
        }),
      })

  // Mock sparkline points
  const points = Array.from({ length: 12 }, (_, i) =>
    Math.max(10, Math.min(90, market.yesProbability + (Math.sin(i) * 15)))
  )
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1
  const width = 300
  const height = 80
  const path = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * width
      const y = height - ((p - min) / range) * (height - 10) - 5
      return `${i === 0 ? "M" : "L"} ${x} ${y}`
    })
    .join(" ")

  return (
    <Card
      className={cn(
        "grid grid-cols-1 gap-4 overflow-hidden p-4 transition-colors hover:bg-card/80 lg:grid-cols-2",
        className
      )}
    >
      <div className="flex flex-col gap-3">
        <Link
          to="/markets/$eventId"
          params={{ eventId: market.slug }}
          className="flex items-start gap-3"
        >
          <img
            src={market.imageUrl}
            alt=""
            className="h-12 w-12 shrink-0 rounded-xl object-cover"
          />
          <div className="min-w-0 flex-1">
            <Badge variant="secondary" className="mb-1 text-[10px]">
              {market.category}
            </Badge>
            <h2 className="text-lg font-bold leading-tight">{market.title}</h2>
          </div>
        </Link>

        <div className="flex flex-col gap-2">
          <OutcomeRow label={t("market.yes")} probability={market.yesProbability} />
          <OutcomeRow label={t("market.no")} probability={market.noProbability} />
        </div>

        <div className="mt-auto flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <TrendingUp className="h-3.5 w-3.5" />
            {formatNumber(market.volume)} USDC
          </span>
          <span>· {endLabel}</span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="relative rounded-xl bg-muted/50 p-3">
          <svg viewBox={`0 0 ${width} ${height}`} className="h-32 w-full">
            <path
              d={path}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-primary"
            />
          </svg>
          <div className="absolute bottom-3 right-3 text-[10px] text-muted-foreground">
            Polymind
          </div>
        </div>

        <div className="rounded-lg bg-muted/50 p-3">
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            <Newspaper className="h-3.5 w-3.5" />
            Related news
          </div>
          <p className="text-sm">
            Latest updates on {market.title.slice(0, 40)}…
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            <Button variant="ghost" size="icon-sm">
              <LinkIcon className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon-sm">
              <Bookmark className="h-4 w-4" />
            </Button>
          </div>
          <Button size="sm">{t("market.bet")}</Button>
        </div>
      </div>
    </Card>
  )
}

function OutcomeRow({
  label,
  probability,
}: {
  label: string
  probability: number
}) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
      <span className="text-sm font-medium">{label}</span>
      <span className="text-sm font-bold">{Math.round(probability)}%</span>
    </div>
  )
}
