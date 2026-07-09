import { apiGet } from "../api"

export interface UserPosition {
  marketId: string
  marketTitle: string
  side: "yes" | "no"
  amount: number
  value: number
  pnl: number
  status: "active" | "resolved"
}

export async function fetchPredictions(status?: "active" | "resolved"): Promise<UserPosition[]> {
  const query = status ? `?status=${status}` : ""
  const res = await apiGet(`/predictions${query}`)
  const json = await res.json()
  return (json.data as UserPosition[]) ?? []
}
