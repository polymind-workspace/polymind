import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"

const CATEGORIES = ["all", "trending", "live", "politics", "crypto", "sports"] as const

export type Category = (typeof CATEGORIES)[number]

interface CategoryTabsProps {
  active: Category
  onSelect: (category: Category) => void
  className?: string
}

export function CategoryTabs({ active, onSelect, className }: CategoryTabsProps) {
  const { t } = useTranslation()
  return (
    <div className={cn("w-full overflow-x-auto", className)}>
      <div className="flex gap-2 px-1 py-1">
        {CATEGORIES.map((cat) => {
          const selected = active === cat
          return (
            <button
              key={cat}
              onClick={() => onSelect(cat)}
              className={cn(
                "shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
                selected
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {t(`home.tabs.${cat}`)}
            </button>
          )
        })}
      </div>
    </div>
  )
}
