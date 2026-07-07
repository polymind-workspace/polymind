import { AppHeader } from "./AppHeader"
import { BottomNav } from "./BottomNav"
import { cn } from "@/lib/utils"

interface PageLayoutProps {
  children: React.ReactNode
  className?: string
}

export function PageLayout({ children, className }: PageLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader />
      <main
        className={cn(
          "flex-1 pt-0",
          className
        )}
      >
        <div className="mx-auto max-w-7xl p-4 pb-24 md:p-6 md:pb-6">
          {children}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
