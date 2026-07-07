import { createFileRoute } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { apiGet } from "@/lib/api"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown } from "lucide-react"
import type { UserPosition } from "@/types"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/predictions")({
  component: Predictions,
})

interface PredictionsResponse {
  ret: number
  msg: string
  data: UserPosition[]
}

function Predictions() {
  const { t } = useTranslation()
  const [tab, setTab] = useState<"participated" | "created">("participated")
  const [positions, setPositions] = useState<UserPosition[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiGet("/predictions")
      .then((r) => r.json())
      .then((payload: PredictionsResponse) => {
        if (payload.ret === 200) setPositions(payload.data)
      })
      .finally(() => setLoading(false))
  }, [])

  const filtered = positions.filter((p) =>
    tab === "participated" ? p.status !== "resolved" : p.status === "resolved"
  )

  return (
    <PageLayout>
      <h1 className="mb-4 text-2xl font-bold">{t("predictions.title")}</h1>
      <div className="mb-4 flex gap-2">
        {(["participated", "created"] as const).map((key) => (
          <Button
            key={key}
            variant={tab === key ? "default" : "outline"}
            size="sm"
            onClick={() => setTab(key)}
          >
            {t(`predictions.${key}`)}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="py-12 text-center">{t("common.loading")}</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl bg-card p-8 text-center ring-1 ring-border">
          <h3 className="font-semibold">{t("predictions.emptyTitle")}</h3>
          <p className="mt-1 text-muted-foreground">{t("predictions.emptySub")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((p) => (
            <div
              key={p.marketId}
              className="flex items-center justify-between rounded-xl bg-card p-4 ring-1 ring-border"
            >
              <div className="min-w-0">
                <h4 className="truncate font-medium">{p.marketTitle}</h4>
                <div className="mt-1 flex items-center gap-2">
                  <Badge
                    variant="outline"
                    className={cn(
                      p.side === "yes" ? "text-yes border-yes/30" : "text-no border-no/30"
                    )}
                  >
                    {p.side.toUpperCase()}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {p.amount} USDC
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center justify-end gap-1 text-sm font-medium">
                  {p.pnl >= 0 ? (
                    <>
                      <TrendingUp className="h-3.5 w-3.5 text-yes" />
                      <span className="text-yes">+{p.pnl}</span>
                    </>
                  ) : (
                    <>
                      <TrendingDown className="h-3.5 w-3.5 text-no" />
                      <span className="text-no">{p.pnl}</span>
                    </>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">Value {p.value} USDC</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </PageLayout>
  )
}
