import { Link, useRouterState } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { Home, Inbox, User } from "lucide-react"
import { cn } from "@/lib/utils"

const tabs = [
  { to: "/", icon: Home, labelKey: "nav.home" },
  { to: "/notifications", icon: Inbox, labelKey: "nav.notifications" },
  { to: "/profile", icon: User, labelKey: "nav.profile" },
] as const

export function BottomNav() {
  const { t } = useTranslation()
  const { location } = useRouterState()
  const pathname = location.pathname

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border/50 bg-background/95 pb-safe backdrop-blur-md md:hidden">
      <div className="mx-auto flex h-16 max-w-md items-center justify-around">
        {tabs.map((tab) => {
          const active = tab.to === "/" ? pathname === "/" : pathname.startsWith(tab.to)
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-3 py-2 text-xs transition-colors",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <tab.icon className="h-5 w-5" />
              <span>{t(tab.labelKey)}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
