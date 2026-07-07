import { useNavigate } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { Menu, Home, Bell, Trophy, LayoutDashboard, Gift } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function NavMenu() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const items = [
    { to: "/", icon: Home, label: t("nav.home") },
    { to: "/notifications", icon: Bell, label: t("nav.notifications") },
    { to: "/leaderboard", icon: Trophy, label: t("nav.leaderboard") },
    { to: "/profile", icon: LayoutDashboard, label: t("nav.profile") },
    { to: "/predictions", icon: Gift, label: t("nav.predictions") },
  ]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon">
            <Menu className="h-5 w-5" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-48">
        {items.map((item) => (
          <DropdownMenuItem
            key={item.to}
            className="flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer"
            onClick={() => navigate({ to: item.to })}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
