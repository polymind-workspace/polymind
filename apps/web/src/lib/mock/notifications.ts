import type { Notification } from "@/types"

const now = new Date()

const addMinutes = (minutes: number): string => {
  const d = new Date(now)
  d.setMinutes(d.getMinutes() - minutes)
  return d.toISOString()
}

export const mockNotifications: Notification[] = [
  {
    id: "n1",
    type: "market",
    title: "Market resolved",
    body: "'Will Bitcoin close above $100,000 in 2025?' resolved to YES.",
    read: false,
    createdAt: addMinutes(12),
    marketId: "m2",
  },
  {
    id: "n2",
    type: "reward",
    title: "Reward claimed",
    body: "You claimed 245 USDC from market m4.",
    read: false,
    createdAt: addMinutes(45),
    marketId: "m4",
  },
  {
    id: "n3",
    type: "system",
    title: "Welcome to PolyMind",
    body: "Complete your first prediction to unlock the invite program.",
    read: true,
    createdAt: addMinutes(180),
  },
  {
    id: "n4",
    type: "bet",
    title: "New bet placed",
    body: "You placed 120 USDC on YES in 'Fed rate cut July 2026'.",
    read: true,
    createdAt: addMinutes(240),
    marketId: "m5",
  },
  {
    id: "n5",
    type: "market",
    title: "Market closing soon",
    body: "'Will the Fed cut interest rates in July 2026?' ends in 24 hours.",
    read: false,
    createdAt: addMinutes(300),
    marketId: "m5",
  },
  {
    id: "n6",
    type: "reward",
    title: "Invite bonus received",
    body: "You earned 50 USDC from a friend's trading activity.",
    read: true,
    createdAt: addMinutes(520),
  },
  {
    id: "n7",
    type: "system",
    title: "Maintenance completed",
    body: "Scheduled maintenance has been completed successfully.",
    read: true,
    createdAt: addMinutes(900),
  },
  {
    id: "n8",
    type: "bet",
    title: "Bet settled",
    body: "Your YES position in 'ETH ETF approved 2025' settled for 286 USDC profit.",
    read: false,
    createdAt: addMinutes(1100),
    marketId: "m4",
  },
  {
    id: "n9",
    type: "market",
    title: "New market featured",
    body: "'Will Apple release AR glasses before 2027?' is now trending.",
    read: true,
    createdAt: addMinutes(1440),
    marketId: "m18",
  },
  {
    id: "n10",
    type: "reward",
    title: "Weekly reward",
    body: "You ranked #3 on the invite leaderboard and earned 500 USDC.",
    read: false,
    createdAt: addMinutes(1800),
  },
]
