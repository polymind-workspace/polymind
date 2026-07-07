import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { TrendingUp, Users } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MarketProbabilityBar } from "./MarketProbabilityBar"
import { QuickBuyButtons } from "./QuickBuyButtons"
import { formatNumber } from "@/lib/date"
import type { Market } from "@/types"
import { cn } from "@/lib/utils"

interface MarketCardProps {
  market: Market
  className?: string
}

export function MarketCard({ market, className }: MarketCardProps) {
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

  const statusColor =
    market.status === "open"
      ? "bg-green-500/10 text-green-500"
      : market.status === "resolved"
        ? "bg-blue-500/10 text-blue-500"
        : "bg-muted text-muted-foreground"

  return (
    <Card
      className={cn(
        "overflow-hidden transition-colors hover:bg-card/80",
        className
      )}
    >
      <Link
        to="/markets/$eventId"
        params={{ eventId: market.slug }}
        className="contents"
      >
        {market.imageUrl && (
          <div className="relative h-32 w-full overflow-hidden">
            <img
              src={market.imageUrl}
              alt={market.title}
              className="h-full w-full object-cover transition-transform duration-500 group-hover/card:scale-105"
            />
            {market.source === "official" && (
              <Badge className="absolute left-3 top-3 bg-primary text-primary-foreground">
                OFFICIAL
              </Badge>
            )}
          </div>
        )}
        <CardHeader className={cn(!market.imageUrl && "pt-4")}>
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="line-clamp-2 text-base font-semibold">
              {market.title}
            </CardTitle>
            <Badge variant="secondary" className={cn("shrink-0 text-[10px] uppercase", statusColor)}>
              {market.status === "open" ? t("market.statusOpen") : t("market.statusResolved")}
            </Badge>
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {market.tags?.map((tag) => (
              <Badge key={tag} variant="outline" className="text-[10px]">
                {tag}
              </Badge>
            ))}
          </div>
        </CardHeader>
      </Link>

      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <span className="font-medium text-yes">
              {Math.round(market.yesProbability)}%
            </span>
            <span className="text-muted-foreground">{market.source === "champion" ? t("common.volume") : t("market.chance")}</span>
          </div>
          <span className="text-xs text-muted-foreground">{endLabel}</span>
        </div>

        <MarketProbabilityBar
          yes={market.yesProbability}
          no={market.noProbability}
        />

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <TrendingUp className="h-3.5 w-3.5" />
              {formatNumber(market.volume)}
            </span>
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {formatNumber(market.players)}
            </span>
          </div>
        </div>

        {market.status === "open" && (
          <QuickBuyButtons />
        )}
      </CardContent>
    </Card>
  )
}
