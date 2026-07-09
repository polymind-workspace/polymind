import { apiGet } from "../api"

export interface LeaderboardEntry {
  rank: number
  address: string
  nickname?: string
  avatar?: string
  score: number
}

export async function fetchLeaderboard(
  type: "invite" | "bet" | "topic",
  period: "day" | "week" | "month" | "all" = "week",
): Promise<LeaderboardEntry[]> {
  const res = await apiGet(`/leaderboard/${type}?period=${period}`)
  const json = await res.json()
  return (json.data as LeaderboardEntry[]) ?? []
}
