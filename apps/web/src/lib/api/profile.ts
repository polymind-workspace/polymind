import { apiGet } from "../api"

export interface UserStats {
  bets: number
  staked: number
  markets: number
  winnings: number
}

export interface UserProfile {
  address: string
  nickname?: string
  avatar?: string
  stats: UserStats
}

export async function fetchProfile(): Promise<UserProfile | null> {
  const res = await apiGet("/profile")
  const json = await res.json()
  if (json.ret !== 200) return null
  return json.data as UserProfile
}
