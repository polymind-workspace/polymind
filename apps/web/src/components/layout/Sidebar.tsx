import { Link, useRouterState } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import {
  Home,
  TrendingUp,
  Trophy,
  Inbox,
  User,
  PlusCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { to: "/", icon: Home, labelKey: "nav.home" },
  { to: "/predictions", icon: TrendingUp, labelKey: "nav.predictions" },
  { to: "/leaderboard", icon: Trophy, labelKey: "nav.leaderboard" },
  { to: "/notifications", icon: Inbox, labelKey: "nav.notifications" },
  { to: "/profile", icon: User, labelKey: "nav.profile" },
]

export function Sidebar() {
  const { t } = useTranslation()
  const { location } = useRouterState()
  const pathname = location.pathname

  return (
    <aside className="fixed left-0 top-16 z-30 hidden h-[calc(100vh-4rem)] w-64 flex-col border-r border-border/50 bg-background/50 p-4 backdrop-blur-md md:flex">
      <div className="flex flex-1 flex-col gap-1">
        {navItems.map((item) => {
          const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to)
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              <item.icon className="h-4 w-4" />
              {t(item.labelKey)}
            </Link>
          )
        })}
      </div>

      <Link
        to="/create"
        className="flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
      >
        <PlusCircle className="h-4 w-4" />
        {t("nav.create")}
      </Link>
    </aside>
  )
}
