import { Link } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { Users, Gift, Settings, Globe, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface MenuItem {
  to?: string
  icon: React.ElementType
  label: string
  onClick?: () => void
}

interface ProfileMenuProps {
  onLanguage?: () => void
  className?: string
}

export function ProfileMenu({ onLanguage, className }: ProfileMenuProps) {
  const { t } = useTranslation()
  const items: MenuItem[] = [
    { to: "/invite", icon: Users, label: t("profile.menu.invite") },
    { to: "/predictions", icon: Users, label: t("profile.menu.predictions") },
    { to: "/leaderboard", icon: Gift, label: t("profile.menu.rewards") },
    { to: "/notifications", icon: Settings, label: t("profile.menu.settings") },
    { icon: Globe, label: t("profile.menu.language"), onClick: onLanguage },
  ]

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {items.map((item) => {
        const content = (
          <>
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                <item.icon className="h-4 w-4" />
              </div>
              <span className="font-medium">{item.label}</span>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </>
        )
        const className =
          "flex items-center justify-between rounded-xl bg-card p-3 ring-1 ring-border transition-colors hover:bg-card/80"
        return item.to ? (
          <Link key={item.label} to={item.to} className={className}>
            {content}
          </Link>
        ) : (
          <button key={item.label} className={className} onClick={item.onClick}>
            {content}
          </button>
        )
      })}
    </div>
  )
}
