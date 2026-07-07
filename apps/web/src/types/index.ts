export type MarketStatus = "open" | "resolved" | "closed"

export type MarketOutcome = "yes" | "no" | "void"

export interface Market {
  id: string
  slug: string
  title: string
  description: string
  imageUrl?: string
  category: string
  status: MarketStatus
  yesProbability: number
  noProbability: number
  yesPool: number
  noPool: number
  volume: number
  players: number
  endTime: string
  resolvedOutcome?: MarketOutcome
  tags?: string[]
  source?: "official" | "admin" | "champion" | "user"
}

export interface MarketDetail extends Market {
  outcomes: {
    yes: { probability: number; pool: number }
    no: { probability: number; pool: number }
  }
  activity: MarketActivity[]
  rules: string
}

export interface MarketActivity {
  id: string
  type: "bet" | "create" | "resolve" | "claim"
  user: string
  side?: "yes" | "no"
  amount?: number
  timestamp: string
}

export interface UserPosition {
  marketId: string
  marketTitle: string
  side: "yes" | "no"
  amount: number
  value: number
  pnl: number
  status: "active" | "resolved"
}

export interface LeaderboardEntry {
  rank: number
  address: string
  nickname?: string
  avatar?: string
  score: number
}

export interface Notification {
  id: string
  type: "bet" | "reward" | "system" | "market"
  title: string
  body: string
  read: boolean
  createdAt: string
  marketId?: string
}

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
