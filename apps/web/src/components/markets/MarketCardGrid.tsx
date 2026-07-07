import { MarketCard } from "./MarketCard"
import type { Market } from "@/types"
import { cn } from "@/lib/utils"

interface MarketCardGridProps {
  markets: Market[]
  className?: string
}

export function MarketCardGrid({ markets, className }: MarketCardGridProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
        className
      )}
    >
      {markets.map((market) => (
        <MarketCard key={market.id} market={market} />
      ))}
    </div>
  )
}
