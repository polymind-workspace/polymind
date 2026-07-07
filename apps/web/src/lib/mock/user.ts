import type { UserPosition, UserProfile } from "@/types"

export const mockUserProfile: UserProfile = {
  address: "0xDefaultUser",
  nickname: "PolyMind Trader",
  avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=PolyMind",
  stats: {
    bets: 47,
    staked: 12500,
    markets: 12,
    winnings: 8430,
  },
}

export const mockUserPositions: UserPosition[] = [
  {
    marketId: "m2",
    marketTitle: "Will Bitcoin close above $100,000 in 2025?",
    side: "yes",
    amount: 500,
    value: 320,
    pnl: -180,
    status: "active",
  },
  {
    marketId: "m5",
    marketTitle: "Will the Fed cut interest rates in July 2026?",
    side: "no",
    amount: 120,
    value: 142,
    pnl: 22,
    status: "active",
  },
  {
    marketId: "m4",
    marketTitle: "Will a spot Ethereum ETF be approved in the US in 2025?",
    side: "yes",
    amount: 800,
    value: 1086,
    pnl: 286,
    status: "resolved",
  },
  {
    marketId: "m9",
    marketTitle: "Will SOL close above $300 in 2025?",
    side: "yes",
    amount: 350,
    value: 412,
    pnl: 62,
    status: "active",
  },
  {
    marketId: "m13",
    marketTitle: "Will the Los Angeles Lakers win the 2026 NBA Finals?",
    side: "no",
    amount: 200,
    value: 244,
    pnl: 44,
    status: "active",
  },
  {
    marketId: "m17",
    marketTitle: "Will OpenAI release GPT-5 in 2025?",
    side: "yes",
    amount: 150,
    value: 87,
    pnl: -63,
    status: "active",
  },
]
