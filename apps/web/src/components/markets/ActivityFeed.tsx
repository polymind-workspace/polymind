import { useTranslation } from "react-i18next"
import { CircleDollarSign, Gavel, Trophy, Plus } from "lucide-react"
import type { MarketActivity } from "@/types"
import { cn } from "@/lib/utils"

interface ActivityFeedProps {
  activities: MarketActivity[]
  className?: string
}

const icons: Record<MarketActivity["type"], React.ElementType> = {
  bet: CircleDollarSign,
  create: Plus,
  resolve: Gavel,
  claim: Trophy,
}

export function ActivityFeed({ activities, className }: ActivityFeedProps) {
  const { t } = useTranslation()
  return (
    <div className={cn("rounded-xl bg-card p-4 ring-1 ring-border", className)}>
      <h3 className="mb-3 font-semibold">{t("market.activity")}</h3>
      <div className="flex flex-col gap-3">
        {activities.map((a) => {
          const Icon = icons[a.type]
          return (
            <div key={a.id} className="flex items-start gap-3 text-sm">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                <Icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="font-medium">
                  {a.type === "bet" && (
                    <>
                      {a.user} {a.side} {a.amount} USDC
                    </>
                  )}
                  {a.type === "create" && <>{a.user} created the market</>}
                  {a.type === "resolve" && <>{a.user} resolved the market</>}
                  {a.type === "claim" && <>{a.user} claimed winnings</>}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(a.timestamp).toLocaleString()}
                </p>
              </div>
            </div>
          )
        })}
        {activities.length === 0 && (
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        )}
      </div>
    </div>
  )
}
