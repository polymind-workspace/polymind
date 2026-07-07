import { Wallet } from "lucide-react"
import type { UserProfile } from "@/types"
import { cn } from "@/lib/utils"

interface ProfileHeaderProps {
  user: UserProfile
  className?: string
}

export function ProfileHeader({ user, className }: ProfileHeaderProps) {
  const displayName =
    user.nickname || `${user.address.slice(0, 6)}...${user.address.slice(-4)}`
  return (
    <div className={cn("flex items-center gap-4", className)}>
      {user.avatar ? (
        <img
          src={user.avatar}
          alt=""
          className="h-16 w-16 rounded-full object-cover ring-2 ring-border"
        />
      ) : (
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-xl font-semibold">
          {displayName.slice(0, 2).toUpperCase()}
        </div>
      )}
      <div className="flex-1">
        <h2 className="text-lg font-semibold">{displayName}</h2>
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Wallet className="h-3.5 w-3.5" />
          <span>{user.address}</span>
        </div>
      </div>
    </div>
  )
}
