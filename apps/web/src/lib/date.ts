export function formatTimeUntil(iso: string, now = new Date()): string {
  const end = new Date(iso)
  const diffMs = end.getTime() - now.getTime()
  if (diffMs <= 0) return "Ended"
  const minutes = Math.floor(diffMs / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d left`
  if (hours > 0) return `${hours}h left`
  return `${minutes}m left`
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}
