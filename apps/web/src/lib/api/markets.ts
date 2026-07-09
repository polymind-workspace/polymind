import { apiGet, apiPost } from "../api"

export interface MarketListResponse {
  items: MarketItem[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

export interface MarketItem {
  id: string
  slug: string
  title: string
  description: string
  imageUrl?: string
  category: string
  status: "open" | "resolved" | "closed"
  yesProbability: number
  noProbability: number
  yesPool: number
  noPool: number
  volume: number
  players: number
  endTime: string
  resolvedOutcome?: "yes" | "no" | "void"
  tags?: string[]
  source?: "official" | "admin" | "champion" | "user"
}

export interface MarketDetail extends MarketItem {
  outcomes: {
    yes: { probability: number; pool: number }
    no: { probability: number; pool: number }
  }
  activity: MarketActivity[]
  rules: string
  related_markets: MarketItem[]
}

export interface MarketActivity {
  id: string
  type: "bet" | "create" | "resolve" | "claim"
  user: string
  side?: "yes" | "no"
  amount?: number
  timestamp: string
}

export async function fetchMarkets(
  params: Record<string, string | number | undefined> = {},
): Promise<MarketListResponse> {
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") {
      searchParams.append(key, String(value))
    }
  })
  const query = searchParams.toString()
  const res = await apiGet(`/markets${query ? `?${query}` : ""}`)
  const json = await res.json()
  return json.data as MarketListResponse
}

export async function fetchMarketBySlug(slug: string): Promise<MarketDetail | null> {
  const res = await apiGet(`/markets/${slug}`)
  const json = await res.json()
  if (json.ret !== 200) return null
  return json.data as MarketDetail
}

export async function createMarketPlaceholder(): Promise<{
  ret: number
  msg: string
  data: unknown
}> {
  const res = await apiPost("/markets")
  return res.json()
}
