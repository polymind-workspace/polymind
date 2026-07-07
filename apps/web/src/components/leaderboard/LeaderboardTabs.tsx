import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"

const TABS = ["invite", "bet", "topic"] as const
export type LeaderboardType = (typeof TABS)[number]

interface LeaderboardTabsProps {
  active: LeaderboardType
  onSelect: (type: LeaderboardType) => void
  className?: string
}

export function LeaderboardTabs({ active, onSelect, className }: LeaderboardTabsProps) {
  const { t } = useTranslation()
  return (
    <div className={cn("flex gap-2", className)}>
      {TABS.map((tab) => (
        <button
          key={tab}
          onClick={() => onSelect(tab)}
          className={cn(
            "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
            active === tab
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          )}
        >
          {t(`leaderboard.${tab}`)}
        </button>
      ))}
    </div>
  )
}
