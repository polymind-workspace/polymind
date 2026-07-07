import { Link, useNavigate, useSearch } from "@tanstack/react-router"
import { useTranslation } from "react-i18next"
import { Search, Bell, Gift, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { AuthButton } from "@/components/auth/AuthButton"
import { UserDropdown } from "@/components/auth/UserDropdown"
import { NavMenu } from "./NavMenu"
import { useWallet } from "@/lib/wallet"
import { cn } from "@/lib/utils"

interface AppHeaderProps {
  className?: string
}

export function AppHeader({ className }: AppHeaderProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const searchParams = useSearch({ from: "/" }) as { search?: string }
  const search = searchParams.search ?? ""
  const { connected } = useWallet()

  const handleSearch = (value: string) => {
    void navigate({
      to: "/",
      search: value ? { search: value } : undefined,
      replace: true,
    })
  }

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border/50 bg-background/80 px-4 backdrop-blur-md sm:px-6",
        className
      )}
    >
      <Link to="/" className="flex shrink-0 items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
          P
        </div>
        <span className="hidden text-lg font-bold tracking-tight sm:inline">PolyMind</span>
      </Link>

      <div className="mx-4 hidden max-w-md flex-1 items-center md:flex">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder={t("home.searchPlaceholder")}
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="h-10 w-full pl-10"
          />
        </div>
      </div>

      <div className="flex items-center gap-1 sm:gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          render={<Link to="/" />}
        >
          <Search className="h-5 w-5" />
        </Button>

        {connected ? (
          <>
            <div className="hidden items-center gap-3 text-xs sm:flex">
              <div className="flex flex-col items-end leading-tight">
                <span className="text-muted-foreground">{t("header.portfolio")}</span>
                <span className="font-semibold">$0.00</span>
              </div>
              <div className="flex flex-col items-end leading-tight">
                <span className="text-muted-foreground">{t("header.cash")}</span>
                <span className="font-semibold">$0.00</span>
              </div>
            </div>

            <Button size="sm" className="hidden sm:inline-flex">
              <Plus className="mr-1 h-3.5 w-3.5" />
              {t("header.deposit")}
            </Button>

            <Button variant="ghost" size="icon" className="relative">
              <Gift className="h-5 w-5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="relative"
              render={<Link to="/notifications" />}
            >
              <Bell className="h-5 w-5" />
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-yes" />
            </Button>

            <UserDropdown />
            <NavMenu />
          </>
        ) : (
          <>
            <Button variant="ghost" size="sm" className="hidden sm:inline-flex">
              {t("nav.howItWorks")}
            </Button>
            <AuthButton />
            <NavMenu />
          </>
        )}
      </div>
    </header>
  )
}
