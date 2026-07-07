import { Trophy } from "lucide-react"
import type { LeaderboardEntry } from "@/types"
import { cn } from "@/lib/utils"

interface TopThreePodiumProps {
  entries: LeaderboardEntry[]
  className?: string
}

export function TopThreePodium({ entries, className }: TopThreePodiumProps) {
  const ordered = [entries[1], entries[0], entries[2]].filter(Boolean)
  const ranks = [2, 1, 3]

  return (
    <div className={cn("flex items-end justify-center gap-3 py-6", className)}>
      {ordered.map((entry, idx) => (
        <div
          key={entry.address}
          className={cn(
            "flex flex-col items-center rounded-xl bg-card p-4 ring-1 ring-border",
            idx === 1 ? "w-28" : "w-24"
          )}
          style={{ height: idx === 1 ? "140px" : idx === 0 ? "120px" : "100px" }}
        >
          <div className="mb-2 flex h-8 w-8 items-center justify-center rounded-full bg-muted">
            {ranks[idx] === 1 ? (
              <Trophy className="h-4 w-4 text-amber-400" />
            ) : (
              <span className="text-sm font-bold">{ranks[idx]}</span>
            )}
          </div>
          <span className="w-full truncate text-center text-sm font-medium">
            {entry.nickname || `${entry.address.slice(0, 6)}...${entry.address.slice(-4)}`}
          </span>
          <span className="mt-1 text-lg font-bold">{entry.score.toLocaleString()}</span>
        </div>
      ))}
    </div>
  )
}
