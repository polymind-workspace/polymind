import type { LeaderboardEntry } from "@/types"

const avatars = [
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Felix",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Zack",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Molly",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Jasper",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Luna",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Kai",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Nora",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Oscar",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Piper",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Quinn",
  "https://api.dicebear.com/7.x/avataaars/svg?seed=Rory",
]

const addresses = [
  "0xAlpha",
  "0xBeta",
  "0xGamma",
  "0xDelta",
  "0xEpsilon",
  "0xZeta",
  "0xEta",
  "0xTheta",
  "0xIota",
  "0xKappa",
  "0xLambda",
  "0xMu",
  "0xNu",
]

const nicknames = [
  "Predator",
  "Oracle",
  "WhaleWatcher",
  "MoonShot",
  "ChartMaster",
  "DegenKing",
  "SignalHunter",
  "AlphaSeeker",
  "BetaTester",
  "GammaGuru",
  "DeltaFlow",
  "EtherEagle",
  "SolSurfer",
]

const createBoard = (scores: number[]): LeaderboardEntry[] =>
  scores.map((score, i) => ({
    rank: i + 1,
    address: addresses[i % addresses.length],
    nickname: nicknames[i % nicknames.length],
    avatar: avatars[i % avatars.length],
    score,
  }))

export const mockLeaderboardInvite: LeaderboardEntry[] = createBoard([
  142, 128, 119, 104, 98, 87, 76, 65, 54, 43, 38, 29, 21,
])

export const mockLeaderboardBet: LeaderboardEntry[] = createBoard([
  98500, 87200, 76400, 65100, 54300, 48900, 41200, 36500, 29800, 23100, 18400, 15200, 9800,
])

export const mockLeaderboardTopic: LeaderboardEntry[] = createBoard([
  34, 31, 28, 25, 22, 19, 17, 15, 12, 10, 9, 7, 5,
])
