import { apiGet } from "../api"

export interface ReferralSummary {
  code: string
  invitee_count: number
  pending_rewards: number
  paid_rewards: number
}

export async function fetchReferrals(): Promise<ReferralSummary> {
  const res = await apiGet("/referrals")
  const json = await res.json()
  return json.data as ReferralSummary
}
