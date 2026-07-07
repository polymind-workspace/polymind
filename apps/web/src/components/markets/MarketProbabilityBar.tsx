import { cn } from "@/lib/utils"

interface MarketProbabilityBarProps {
  yes: number
  no: number
  className?: string
}

export function MarketProbabilityBar({ yes, no, className }: MarketProbabilityBarProps) {
  const yesPct = Math.max(0, Math.min(100, yes))
  const noPct = Math.max(0, Math.min(100, no))
  const total = yesPct + noPct || 1
  const yesWidth = (yesPct / total) * 100
  const noWidth = (noPct / total) * 100

  return (
    <div className={cn("flex h-2 w-full overflow-hidden rounded-full", className)}>
      <div
        className="h-full bg-yes transition-all duration-500"
        style={{ width: `${yesWidth}%` }}
      />
      <div
        className="h-full bg-no transition-all duration-500"
        style={{ width: `${noWidth}%` }}
      />
    </div>
  )
}
