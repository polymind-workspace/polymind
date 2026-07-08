import { useNavigate } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import {
  Trophy,
  Gift,
  Code,
  UserPlus,
  Moon,
  Sun,
  BarChart3,
  LifeBuoy,
  Activity,
  FileText,
  HelpCircle,
  FileCheck,
  LogOut,
  ChevronRight,
  Globe,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useTheme } from "@/lib/theme/ThemeProvider"
import { setLocale } from "@/lib/i18n"
import { useWallet } from "@/lib/wallet"
import { cn } from "@/lib/utils"

interface UserDropdownProps {
  className?: string
}

export function UserDropdown({ className }: UserDropdownProps) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const { resolved, toggleTheme } = useTheme()
  const { address, disconnect } = useWallet()

  const display = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ""

  const handleLogout = () => {
    disconnect()
  }

  const menuItemClass =
    "flex items-center gap-2 px-2 py-1.5 text-sm cursor-pointer"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            className={cn("h-9 gap-2 rounded-full px-2", className)}
          >
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/50 text-primary-foreground text-xs font-bold">
              {address ? address.slice(0, 2).toUpperCase() : "?"}
            </div>
            <span className="hidden text-xs font-medium sm:inline">{display}</span>
            <ChevronRight className="hidden h-3 w-3 rotate-90 text-muted-foreground sm:block" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem
          className={menuItemClass}
          onClick={() => navigate({ to: "/leaderboard" })}
        >
          <Trophy className="h-4 w-4" />
          {t("header.leaderboard")}
        </DropdownMenuItem>
        <DropdownMenuItem
          className={menuItemClass}
          onClick={() => navigate({ to: "/profile" })}
        >
          <Gift className="h-4 w-4" />
          {t("header.rewards")}
        </DropdownMenuItem>
        <DropdownMenuItem className={menuItemClass}>
          <Code className="h-4 w-4" />
          {t("header.api")}
        </DropdownMenuItem>
        <DropdownMenuItem className={menuItemClass}>
          <UserPlus className="h-4 w-4" />
          {t("profile.menu.invite")}
        </DropdownMenuItem>
        <DropdownMenuItem className={menuItemClass}>
          <Code className="h-4 w-4" />
          {t("header.developer")}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          className={menuItemClass}
          onClick={(e) => {
            e.preventDefault()
            toggleTheme()
          }}
        >
          {resolved === "dark" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
          {t("common.toggleTheme")}
        </DropdownMenuItem>
        <DropdownMenuItem
          className={menuItemClass}
          onClick={() => setLocale(i18n.language === "zh" ? "en" : "zh")}
        >
          <Globe className="h-4 w-4" />
          {t("profile.menu.language")}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem className={menuItemClass}>
          <BarChart3 className="h-4 w-4" />
          {t("header.accuracy")}
        </DropdownMenuItem>
        <DropdownMenuItem className={menuItemClass}>
          <LifeBuoy className="h-4 w-4" />
          {t("header.support")}
        </DropdownMenuItem>
        <DropdownMenuItem className={menuItemClass}>
          <Activity className="h-4 w-4" />
          {t("header.status")}
        </DropdownMenuItem>
        <DropdownMenuItem className={menuItemClass}>
          <FileText className="h-4 w-4" />
          {t("header.docs")}
        </DropdownMenuItem>
        <DropdownMenuItem className={menuItemClass}>
          <HelpCircle className="h-4 w-4" />
          {t("header.helpCenter")}
        </DropdownMenuItem>
        <DropdownMenuItem className={menuItemClass}>
          <FileCheck className="h-4 w-4" />
          {t("header.terms")}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          className={cn(menuItemClass, "text-destructive focus:text-destructive")}
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          {t("header.logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
