import { apiGet, apiPost } from "../api"

export interface Notification {
  id: string
  type: "bet" | "reward" | "system" | "market"
  title: string
  body: string
  read: boolean
  createdAt: string
  marketId?: string
}

export interface NotificationListResponse {
  items: Notification[]
  total: number
  unread_count: number
}

export async function fetchNotifications(): Promise<NotificationListResponse> {
  const res = await apiGet("/notifications")
  const json = await res.json()
  return json.data as NotificationListResponse
}

export async function markNotificationsRead(): Promise<number> {
  const res = await apiPost("/notifications/read")
  const json = await res.json()
  return (json.data?.updated as number) ?? 0
}
