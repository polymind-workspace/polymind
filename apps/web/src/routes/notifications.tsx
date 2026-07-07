import { createFileRoute } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Bell, Gift, Info, CircleDollarSign } from "lucide-react"
import { apiGet } from "@/lib/api"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { Notification } from "@/types"

export const Route = createFileRoute("/notifications")({
  component: Notifications,
})

interface NotificationsResponse {
  ret: number
  msg: string
  data: Notification[]
}

const icons: Record<Notification["type"], React.ElementType> = {
  bet: CircleDollarSign,
  reward: Gift,
  system: Info,
  market: Bell,
}

function Notifications() {
  const { t } = useTranslation()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiGet("/notifications")
      .then((r) => r.json())
      .then((payload: NotificationsResponse) => {
        if (payload.ret === 200) setNotifications(payload.data)
      })
      .finally(() => setLoading(false))
  }, [])

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  return (
    <PageLayout>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("notifications.title")}</h1>
        <Button variant="ghost" size="sm" onClick={markAllRead}>
          Mark all read
        </Button>
      </div>

      {loading ? (
        <div className="py-12 text-center">{t("common.loading")}</div>
      ) : notifications.length === 0 ? (
        <div className="rounded-xl bg-card p-8 text-center ring-1 ring-border">
          <h3 className="font-semibold">{t("notifications.emptyTitle")}</h3>
          <p className="mt-1 text-muted-foreground">{t("notifications.emptySub")}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {notifications.map((n) => {
            const Icon = icons[n.type]
            return (
              <div
                key={n.id}
                className={cn(
                  "flex gap-3 rounded-xl bg-card p-4 ring-1 ring-border",
                  !n.read && "bg-primary/5"
                )}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted"
                >
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="font-medium">{n.title}</h4>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {new Date(n.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </PageLayout>
  )
}
