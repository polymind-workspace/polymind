import { useTranslation } from "react-i18next"
import { TrendingUp, Droplets } from "lucide-react"
import { MarketProbabilityBar } from "./MarketProbabilityBar"
import { formatNumber } from "@/lib/date"
import { cn } from "@/lib/utils"

interface OutcomeStatsProps {
  yesProbability: number
  noProbability: number
  yesPool: number
  noPool: number
  volume: number
  className?: string
}

export function OutcomeStats({
  yesProbability,
  noProbability,
  yesPool,
  noPool,
  volume,
  className,
}: OutcomeStatsProps) {
  const { t } = useTranslation()
  return (
    <div className={cn("rounded-xl bg-card p-4 ring-1 ring-border", className)}>
      <div className="mb-3 flex items-end justify-between">
        <div>
          <span className="text-3xl font-bold text-yes">{Math.round(yesProbability)}%</span>
          <p className="text-sm text-muted-foreground">{t("market.yes")}</p>
        </div>
        <div className="text-right">
          <span className="text-3xl font-bold text-no">{Math.round(noProbability)}%</span>
          <p className="text-sm text-muted-foreground">{t("market.no")}</p>
        </div>
      </div>

      <MarketProbabilityBar yes={yesProbability} no={noProbability} className="mb-4" />

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-lg bg-muted p-3">
          <div className="mb-1 flex items-center gap-1.5 text-muted-foreground">
            <TrendingUp className="h-4 w-4" />
            {t("market.volume")}
          </div>
          <div className="font-semibold">{formatNumber(volume)} USDC</div>
        </div>
        <div className="rounded-lg bg-muted p-3">
          <div className="mb-1 flex items-center gap-1.5 text-muted-foreground">
            <Droplets className="h-4 w-4" />
            {t("market.liquidity")}
          </div>
          <div className="font-semibold">{formatNumber(yesPool + noPool)} USDC</div>
        </div>
      </div>
    </div>
  )
}
