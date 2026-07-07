import { Medal } from "lucide-react"
import type { LeaderboardEntry } from "@/types"
import { cn } from "@/lib/utils"

interface LeaderboardRowProps {
  entry: LeaderboardEntry
  className?: string
}

export function LeaderboardRow({ entry, className }: LeaderboardRowProps) {
  const displayName =
    entry.nickname || `${entry.address.slice(0, 6)}...${entry.address.slice(-4)}`
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg bg-card px-3 py-3 ring-1 ring-border",
        className
      )}
    >
      <div className="flex w-8 items-center justify-center text-sm font-bold text-muted-foreground">
        {entry.rank <= 3 ? (
          <Medal
            className={cn(
              "h-4 w-4",
              entry.rank === 1 && "text-amber-400",
              entry.rank === 2 && "text-slate-300",
              entry.rank === 3 && "text-amber-600"
            )}
          />
        ) : (
          entry.rank
        )}
      </div>

      {entry.avatar ? (
        <img src={entry.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
      ) : (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium">
          {displayName.slice(0, 2).toUpperCase()}
        </div>
      )}

      <div className="flex-1 truncate text-sm font-medium">{displayName}</div>
      <div className="text-sm font-semibold">{entry.score.toLocaleString()}</div>
    </div>
  )
}
