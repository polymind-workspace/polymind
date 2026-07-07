import { useTranslation } from "react-i18next"
import type { UserStats } from "@/types"
import { cn } from "@/lib/utils"

interface ProfileStatsProps {
  stats: UserStats
  className?: string
}

export function ProfileStats({ stats, className }: ProfileStatsProps) {
  const { t } = useTranslation()
  const items: { label: string; value: string }[] = [
    { label: t("profile.stats.bets"), value: stats.bets.toLocaleString() },
    { label: t("profile.stats.staked"), value: `$${stats.staked.toLocaleString()}` },
    { label: t("profile.stats.markets"), value: stats.markets.toLocaleString() },
    { label: t("profile.stats.winnings"), value: `$${stats.winnings.toLocaleString()}` },
  ]

  return (
    <div className={cn("grid grid-cols-2 gap-3", className)}>
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-xl bg-card p-3 ring-1 ring-border"
        >
          <div className="text-xs text-muted-foreground">{item.label}</div>
          <div className="mt-1 text-lg font-semibold">{item.value}</div>
        </div>
      ))}
    </div>
  )
}
