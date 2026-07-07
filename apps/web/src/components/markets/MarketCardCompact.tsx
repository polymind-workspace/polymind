import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { TrendingUp, Bookmark, Gift } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatNumber } from "@/lib/date"
import type { Market } from "@/types"
import { cn } from "@/lib/utils"

interface MarketCardCompactProps {
  market: Market
  className?: string
}

export function MarketCardCompact({ market, className }: MarketCardCompactProps) {
  const { t } = useTranslation()
  const isLive = market.status === "open" && new Date(market.endTime) > new Date()

  return (
    <Card
      className={cn(
        "flex flex-col gap-3 p-4 transition-colors hover:bg-card/80",
        className
      )}
    >
      <Link
        to="/markets/$eventId"
        params={{ eventId: market.slug }}
        className="flex items-start gap-3"
      >
        <img
          src={market.imageUrl}
          alt=""
          className="h-10 w-10 shrink-0 rounded-lg object-cover"
        />
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-sm font-semibold">{market.title}</h3>
        </div>
      </Link>

      <div className="flex flex-col gap-2">
        <OutcomeRow
          label={t("market.yes")}
          probability={market.yesProbability}
          color="yes"
        />
        <OutcomeRow
          label={t("market.no")}
          probability={market.noProbability}
          color="no"
        />
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          {isLive && (
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-yes" />
              {t("common.live")}
            </span>
          )}
          <span className="flex items-center gap-1">
            <TrendingUp className="h-3 w-3" />
            {formatNumber(market.volume)}
          </span>
          <Badge variant="outline" className="text-[10px]">
            {market.category}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-xs">
            <Gift className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon-xs">
            <Bookmark className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  )
}

function OutcomeRow({
  label,
  probability,
  color,
}: {
  label: string
  probability: number
  color: "yes" | "no"
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="min-w-0 flex-1 truncate text-sm">{label}</span>
      <span
        className={cn(
          "shrink-0 text-sm font-semibold",
          color === "yes" ? "text-yes" : "text-no"
        )}
      >
        {Math.round(probability)}%
      </span>
      <div className="flex shrink-0 gap-1">
        <Button
          size="xs"
          variant="outline"
          className={cn(
            "h-6 px-2 text-[10px]",
            color === "yes"
              ? "text-yes hover:bg-yes/10"
              : "text-no hover:bg-no/10"
          )}
        >
          Yes
        </Button>
        <Button
          size="xs"
          variant="outline"
          className="h-6 px-2 text-[10px] text-muted-foreground"
        >
          No
        </Button>
      </div>
    </div>
  )
}
