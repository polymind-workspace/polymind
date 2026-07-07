import { Search } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

interface MarketSearchProps {
  value: string
  onChange: (value: string) => void
  className?: string
}

export function MarketSearch({ value, onChange, className }: MarketSearchProps) {
  const { t } = useTranslation()
  return (
    <div className={cn("relative", className)}>
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        placeholder={t("home.searchPlaceholder")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 pl-10 pr-4"
      />
    </div>
  )
}
