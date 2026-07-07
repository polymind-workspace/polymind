import { mockMarkets } from "./markets"

export const trendingTags = [
  "全部",
  "特朗普",
  "比特币",
  "世界杯",
  "美联储",
  "NBA",
  "AI",
  "以太坊",
  "美国大选",
  "伊朗",
  "乌克兰",
  "苹果",
  "OpenAI",
  "稳定币",
  "GTA VI",
]

export const trendingTopics = [
  { rank: 1, label: "Bitcoin", volume: 129_000_000 },
  { rank: 2, label: "Trump", volume: 130_000_000 },
  { rank: 3, label: "World Cup", volume: 129_000_000 },
  { rank: 4, label: "Ethereum ETF", volume: 86_800_000 },
  { rank: 5, label: "Solana", volume: 272_000_000 },
]

export function getTagsForCategory(category: string): string[] {
  const allTags = new Set<string>()
  mockMarkets.forEach((m) => {
    if (category === "all" || m.category === category) {
      m.tags?.forEach((tag) => allTags.add(tag))
    }
  })
  return ["全部", ...Array.from(allTags).slice(0, 12)]
}
