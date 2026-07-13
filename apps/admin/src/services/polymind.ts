import { request } from '@umijs/max';
import { createTokenStore, createAddrStore } from '@polymind/wallet';

const BASE = '/api/v1';
const TOKEN_KEY = 'polymind_admin_jwt';
const ADDR_KEY  = 'polymind_admin_addr';

export const tokenStore = createTokenStore(TOKEN_KEY);
export const addrStore = createAddrStore(ADDR_KEY);

function authReq<T>(url: string, options: Record<string, unknown> = {}): Promise<T> {
  const token = tokenStore.get();
  const headers: Record<string, string> = {
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return request<T>(url, { ...options, headers, skipErrorHandler: true }).catch((err: unknown) => {
    const e = err as { response?: { status?: number } };
    if (e?.response?.status === 401) {
      tokenStore.clear();
      window.dispatchEvent(new CustomEvent('polymind-admin-401'));
    }
    throw err;
  });
}

/** Download a CSV file with the admin JWT attached.  */
export async function downloadCsv(url: string, filename?: string): Promise<void> {
  const token = tokenStore.get();
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Download failed (${res.status}): ${text}`);
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  const cd = res.headers.get('content-disposition');
  const suggested = cd?.match(/filename="([^"]+)"/)?.[1];
  a.download = filename || suggested || 'export.csv';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(objectUrl);
}

export interface DashboardStats {
  total_users: number;
  total_markets: number;
  total_bet_amount: string;
  total_claim_amount: string;
  total_disputes: number;
  pending_disputes: number;
  as_of: string | null;
  source: string;
}

export interface UserStats {
  total_users: number;
  pro_users: number;
  free_users: number;
  pro_rate_pct: number;
  new_today: number;
  new_week: number;
  new_month: number;
  new_week_change_pct: number;
  active_today: number;
  active_today_polymind: number;
  active_today_contract: number;
  active_week: number;
  active_week_polymind: number;
  active_week_contract: number;
}

export interface TrendPoint {
  date: string;
  new_users?: number;
  active_users?: number;
  active_users_polymind?: number;
  active_users_contract?: number;
  new_bets?: number;
  new_markets?: number;
  entries?: number;
  volume_eds?: number;
  bet_amount?: string;
  claim_amount?: string;
}

export interface TopBetRow {
  id: string;
  question: string;
  resolved: boolean;
  status: string;
  market_count: number;
  total_pool_eds: number;
}

export interface TopUserRow {
  luffa_id: string;
  identity: string;
  nickname: string;
  bet_count: number;
  entry_count: number;
  total_wagered_eds: number;
}

export interface BetStats {
  total_bets: number;
  active_bets: number;
  ended_bets: number;
  resolved_bets: number;
  draft_bets: number;
  total_markets: number;
  resolved_markets: number;
  total_volume_eds: number;
  total_entries: number;
  unique_players: number;
  unique_players_polymind: number;
  unique_players_contract: number;
  new_this_week: number;
  new_week_change_pct: number;
  status_distribution: Array<{ label: string; value: number; pct: number }>;
  outcome_distribution: Array<{ label: string; value: number; pct: number }>;
}

export interface InviteStats {
  total_inviters: number;
  total_invitees: number;
}

export interface TradingStatsRow extends UserRow {
  bet_count: number;
  event_count: number;
  total_wagered_eds: number;
  last_bet_at: string | null;
  first_bet_at: string | null;
  first_bet_amount_eds: number;
  invitee_count?: number;
}

export interface UserTxRow {
  id: number;
  pm_event_id: string;
  onchain_event_id: number | null;
  market_idx: number | null;
  is_buy: number;
  amount_base: string;
  amount_eds: number;
  event_question: string;
  market_title: string;
  event_resolved: boolean;
  event_outcome: number;
  block_time: string | null;
  created_at: string;
}

export interface BetRow {
  id: number;
  pm_event_id: string;
  onchain_event_id: number | null;
  market_idx: number | null;
  luffa_id: string;
  user_address: string;
  is_buy: number;
  amount_base: string;
  amount_eds: number;
  event_question: string;
  market_title: string;
  event_resolved: boolean;
  event_outcome: number;
  block_time: string | null;
  created_at: string;
}

export interface InviteRelationRow {
  invitee_luffa_id: string;
  invitee_nickname: string;
  invitee_address: string;
  inviter_luffa_id: string;
  inviter_nickname: string;
  bound_at: number | null;
  joined_at: string | null;
  pending_base: string;
  paid_base: string;
  reward_count: number;
  bet_count: number;
  total_wagered_eds: number;
  last_bet_at: string | null;
}

export interface UserDetailStats extends UserRow {
  is_pro_active: boolean;
  bet_count: number;
  event_count: number;
  total_wagered_eds: number;
  last_bet_at: string | null;
  invitee_count: number;
  pending_rewards_eds: number;
  paid_rewards_eds: number;
}

export interface UserInviteRelations {
  my_invite_code: string | null;
  inviter: { luffa_id: string; nickname: string; address: string } | null;
  invitees: Array<{
    luffa_id: string;
    nickname: string;
    address: string;
    created_at: string | null;
    bound_at: number | null;
  }>;
  total_invitees: number;
}

export interface EventTagSummary {
  id: number;
  slug: string;
  display_name: string;
}

export interface EventListItem {
  slug: string;
  onchain_event_id?: number | null;
  creator?: string;
  creator_address?: string;
  title?: string;
  question?: string;
  description?: string;
  created_at: string;
  market_count?: number;
  status?: string;
  source?: 'official' | 'polymarket' | 'user';
  is_trending: boolean | number | null;
  is_flagged: boolean | number;
  flagged_reason?: string | null;
  can_share?: boolean | number;
  can_bet?: boolean | number;
  pinned: boolean | number;
  pinned_at: string | null;
  tags?: EventTagSummary[];
}

export interface MarketListRow {
  slug: string;
  question: string;
  onchain_event_id: number;
  market_idx: number;
  title: string;
  label_yes: string;
  label_no: string;
  deadline: number;
  yes_pool: string;
  no_pool: string;
  proposed_outcome: number;
  resolved: boolean;
  outcome: number;
  dispute_active: boolean;
  stage: 'betting' | 'awaiting' | 'in_review' | 'disputed' | 'settled';
  stage_fine: string;
  source?: 'official' | 'polymarket' | 'user';
  created_at: string | null;
  onchain_created_at: number | null;
}

export interface MarketState {
  event_id: number;
  market_idx: number;
  title: string;
  label_yes: string;
  label_no: string;
  deadline: number;
  yes_pool: string;
  no_pool: string;
  bonus_pool: string;
  proposed_outcome: number;
  proposed_by: string;
  proposed_at: number;
  finalized: boolean;
  finalized_outcome: number;
  finalized_at: number;
  dispute_active: boolean;
  admin_reason: string;
  creator_performed: boolean;
  platform_rake: string;
  creator_reward: string;
  distributable_pool: string;
  event_creator: string;
  event_source?: 'official' | 'polymarket' | 'user';
  external_source: number;       // 0 native / 1 polymarket / 2 ...
  external_market_id: string;
  external_aux_id: number;
  polymarket_url?: string;       // resolved from external_aux_id via Gamma
  polymarket_result?: {
    outcome: number | null;       // 1=YES, 2=NO, 3=VOID, null=unknown
    outcome_name: string;
    closed: boolean;
    confidence: string;
  } | null;
}

export interface MarketConfig {
  platform_fee_bps: number;
  platform_fee_max: string;
  creator_reward_bps: number;
  creator_reward_max: string;
  dispute_window_secs: number;
  admin_timeout_secs: number;
  creator_propose_timeout_secs: number;
  expired_propose_mode: number;
  single_side_only?: boolean;
}

export interface MarketBet {
  address: string;
  side: 'YES' | 'NO';
  amount: string;
  time: number;
  tx_version: string;
  luffa_id?: string | null;
}

export interface EventMarketSummary {
  slug?: string;
  market_idx: number;
  title: string;
  label_yes: string;
  label_no: string;
  deadline: number;
  yes_pool: string;
  no_pool: string;
  proposed_outcome: number;
  resolved: boolean;
  outcome: number;
  dispute_active: boolean;
  creator_performed: boolean;
}

export interface CardItemContent {
  type: 0 | 1 | 2 | 3;  // 0 text 1 link 2 copy 3 image
  text?: string;
  url?: string;
  copytext?: string;
  color?: 0 | 1 | 2;    // 0 default 1 alert
}
export interface CardContentItem {
  title?: string;
  content: CardItemContent;
}
export interface CardMessageContent {
  title:   { icon: string; text: string; link?: string };
  header:  {
    type: 1 | 2 | 3 | 4;
    title?: string;
    subTitle?: string;
    source?: {
      status?: 0 | 1 | 2;
      text?: string;
      url?: string;
      link?: string;
    };
  };
  content?: {
    title?: string;
    subTitle?: string;
    items?: CardContentItem[];
  };
  actions?: Array<{ title?: string; url?: string }>;
}

export interface PushHistoryRow {
  id: number;
  title: string;
  body?: string;
  recipient_address?: string;
  action_url?: string;
  status: 'pending' | 'sent' | 'failed';
  error?: string;
  created_at: string | null;
}
export interface PushHistoryDetail extends PushHistoryRow {
  message_content?: CardMessageContent;
}

export interface SendPushResult {
  queued_count: number;
  push_ids: number[];
}

export interface UserAddressRow {
  id: number;
  address: string;
  created_at: string | null;
}

export interface UserRow {
  id: number;
  luffa_id: string;
  address: string;
  nickname: string;
  avatar: string;
  cid: string;
  is_pro: number;
  pro_expires_at: number | null;
  pro_tx_hash: string;
  invite_code: string;
  inviter_id: string;
  invite_source: string;
  created_at: string | null;
  addr_count: number;
}

export interface UserDetail extends UserRow {
  addresses: UserAddressRow[];
}

export interface PmTagRow {
  id?: number;
  slug: string;
  name?: string;
  display_name?: string;
  sort_order: number;
  is_active: boolean | number;
  is_pinned: boolean | number;
  ref_count?: number;
  created_at?: string | null;
}

export interface ActivityRow {
  id: number;
  title: string;
  description: string;
  tag: string;
  tags: string[];
  cover_image_url: string;
  detail_url: string;
  open_in_luffa: number;
  is_featured: number;
  sort_order: number;
  is_active: number;
  created_at: string | null;
}

export interface ActivityListResponse {
  ret: number;
  data: ActivityRow[];
  total: number;
  page: number;
  page_size: number;
  banner_count: number;
  active_count: number;
}

export interface CampaignLangMeta {
  lang?: string;
  title: string;
  description: string;
  window_label: string;
  pick_label: string;
  option_labels: string[];
}

export interface CampaignOnchain {
  has_onchain: boolean;
  status: 'draft' | 'betting' | 'settled' | 'cancelled';
  option_count: number;
  participants: number;
  total_stake_eds: number;
  has_bets: boolean;
  question: string;
  start_time: number;
  end_time: number;
  min_bet_eds: number;
}

export interface CampaignListItem extends CampaignOnchain {
  campaign_id: string;
  title: string;
  langs: string[];
  hidden: boolean;
  options: string[];
  h5_base: string;
  share_urls: Record<string, string>;
}

export interface ChampionBetRow {
  id: number;
  user: string;
  name: string;
  option_idx: number;
  team: string;
  amount_eds: number;
  ts: number;
  tx_version: string;
}

export interface ChampionBetsResponse {
  ret: number;
  data: ChampionBetRow[];
  total: number;
  page: number;
  limit: number;
  participants: number;
}

export interface CampaignDetail {
  campaign_id: string;
  meta: Record<string, CampaignLangMeta>;
  onchain: CampaignOnchain;
  h5_base: string;
  share_urls: Record<string, string>;
}

export interface MediaImage {
  id: number;
  filename: string;
  url: string;
  size: number;
  mime_type: string;
  created_at: string | null;
}

export interface MediaListResponse {
  ret: number;
  data: MediaImage[];
  total: number;
  page: number;
  page_size: number;
}

export interface AdminAccountRow {
  id: number;
  address: string;
  label: string;
  added_by: string;
  created_at: string | null;
}

export interface DisputeRow {
  id: number;
  onchain_event_id: number;
  market_idx: number;
  disputer: string;
  claimed_outcome: number;
  reason: string;
  status: 'pending' | 'resolved' | 'dismissed';
  resolved_outcome: number | null;
  bond_amount: string;
  bond_tx_hash: string;
  resolved_tx_hash: string | null;
  filed_at: string;
  resolved_at: string | null;
  event_question: string;
  market_title: string;
  event_description?: string;
  deadline?: number | null;
  event_source?: 'official' | 'polymarket' | 'user';
}

interface Envelope<T> {
  ret: number;
  msg?: string;
  data: T;
  total?: number;
}

async function unwrap<T>(p: Promise<Envelope<T>>): Promise<T> {
  const res = await p;
  if (res.ret !== 200) throw new Error(res.msg || `ret=${res.ret}`);
  return res.data;
}

export interface AuthNonceResponse {
  nonce: string;
  message: string;
}

export interface PolymarketCategory {
  key: string;
  label: string;
  tag_slug?: string;
  default_order?: 'volume' | 'volume24hr' | 'volume1wk' | 'volume1mo' | 'end_date' | 'breaking';
  default_ascending?: boolean;
}

export interface PolymarketMarket {
  id: string;
  condition_id: string;
  slug: string;
  question: string;
  description: string;
  end_date: string;
  image: string;
  icon: string;
  active: boolean;
  closed: boolean;
  category: string;
  volume: number;
  volume24hr: number;
  price_change_24h: number;
  liquidity: number;
  outcomes: string[];
  outcome_prices: string[];
  yes_price: number | null;
  group_item_title: string;
  already_imported: boolean;
}

export interface PolymarketEvent {
  id: string;
  ticker: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  image: string;
  icon: string;
  start_date: string;
  end_date: string;
  active: boolean;
  closed: boolean;
  volume: number;
  volume24hr: number;
  price_change_24h: number;
  liquidity: number;
  markets: PolymarketMarket[];
  market_count: number;
  imported_count: number;
  onchain_event_id: number | null;
  onchain_event_creator: string | null;
}

export interface AuthVerifyResponse {
  token: string;
  expires_at: number;
}

export const polymindApi = {
  ping: () => unwrap<{ status: string }>(authReq(`${BASE}/health`)),
  meta: () => unwrap<{ contract_addr: string; adminevent_addr: string; champion_addr: string }>(authReq(`${BASE}/meta`)),
  authNonce: (address: string) =>
    unwrap<AuthNonceResponse>(authReq(`${BASE}/auth/admin/nonce`, {
      method: 'POST', data: { address },
    })),
  authVerify: (body: {
    address: string;
    nonce: string;
    message: string;
    signature: string;
  }) =>
    unwrap<AuthVerifyResponse>(authReq(`${BASE}/auth/admin/verify`, {
      method: 'POST', data: body,
    })),
  authAdmins: () => unwrap<string[]>(authReq(`${BASE}/auth/admins`)),

  listOperatorsByRole: (role: 'admin' | 'creator' | 'distributor') =>
    unwrap<string[]>(authReq(`${BASE}/operators`, { params: { role } })),

  listAllRoles: () =>
    unwrap<{ admins: string[]; creators: string[]; distributors: string[] }>(
      authReq(`${BASE}/operators/roles`),
    ),
  authMe: () => unwrap<{ address: string; permissions: string[] }>(authReq(`${BASE}/auth/admin/me`)),

  dashboardStats: () => unwrap<DashboardStats>(authReq(`${BASE}/dashboard/overview`)),
  userStats: () => unwrap<UserStats>(authReq(`${BASE}/dashboard/users`)),
  betStats: () => unwrap<BetStats>(authReq(`${BASE}/dashboard/bets`)),
  inviteStats: () => unwrap<InviteStats>(authReq(`${BASE}/dashboard/invites`)),
  dashboardTrend: (days = 30) => unwrap<TrendPoint[]>(authReq(`${BASE}/dashboard/trend`, { params: { days } })),
  topBets: (limit = 10) => unwrap<TopBetRow[]>(authReq(`${BASE}/dashboard/top-bets`, { params: { limit } })),
  topUsers: (limit = 10) => unwrap<TopUserRow[]>(authReq(`${BASE}/dashboard/top-users`, { params: { limit } })),

  tradingStats: (params: {
    q?: string; is_pro?: number; bet_start?: string; bet_end?: string;
    reg_start?: string; reg_end?: string;
    query_type?: string; first_bet?: number; min_bet?: string;
    random_sample?: number;
    page?: number; limit?: number;
  }) =>
    authReq<{ ret: number; data: TradingStatsRow[]; total: number; page: number; limit: number }>(
      `${BASE}/users/trading-stats`, { params },
    ),

  userTransactions: (params: {
    luffa_id?: string; address?: string;
    bet_start?: string; bet_end?: string; page?: number; limit?: number;
  }) =>
    authReq<{ ret: number; data: UserTxRow[]; total: number; page: number; limit: number }>(
      `${BASE}/users/transactions`, { params },
    ),

  listBets: (params: {
    q?: string; luffa_id?: string; event_id?: string; is_buy?: number;
    bet_start?: string; bet_end?: string;
    sort_by?: string; sort_order?: string;
    page?: number; limit?: number;
  }) =>
    authReq<{ ret: number; data: BetRow[]; total: number; page: number; limit: number }>(
      `${BASE}/trades`, { params: { ...params, admin_view: 1 } },
    ),

  exportBets: (params: {
    q?: string; luffa_id?: string; event_id?: string; is_buy?: number;
    bet_start?: string; bet_end?: string;
  }) =>
    authReq<Blob>(`${BASE}/trades?download=1`, { params: { ...params, admin_view: 1 }, responseType: 'blob' }),

  allInvitations: (params: {
    q?: string;
    query_role?: 'inviter' | 'invitee';
    has_bet?: number;
    page?: number;
    limit?: number;
    sort_by?: string;
    sort_dir?: string;
  }) =>
    authReq<{ ret: number; data: InviteRelationRow[]; total: number; page: number; limit: number }>(
      `${BASE}/users/invitations`, { params },
    ),

  userDetailStats: (luffa_id: string) =>
    unwrap<UserDetailStats>(authReq(`${BASE}/users/${encodeURIComponent(luffa_id)}/stats`)),

  userInviteRelations: (luffa_id: string, params?: { page?: number; limit?: number }) =>
    unwrap<UserInviteRelations>(
      authReq(`${BASE}/users/${encodeURIComponent(luffa_id)}/invite-relations`, { params }),
    ),

  listEvents: (params: {
    stage?: string;
    source?: string;    // comma-separated pm_events.source values
    q?: string;
    tag_ids?: string;   // comma-separated PmTag ids
    page?: number;
    limit?: number;
  }) =>
    authReq<Envelope<EventListItem[]>>(`${BASE}/events`, { params: { ...params, admin_view: 1 } }),

  eventDetail: (slug: string) =>
    unwrap<EventListItem & { creator: string; description: string; markets: EventMarketSummary[] }>(
      authReq(`${BASE}/events/${encodeURIComponent(slug)}`),
    ),

  updateEventVisibility: (slug: string, body: { is_trending?: boolean | null; is_flagged?: boolean; can_share?: boolean; can_bet?: boolean; pinned?: boolean }) =>
    unwrap<EventListItem>(
      authReq(`${BASE}/events/${encodeURIComponent(slug)}`, { method: 'PATCH', data: body }),
    ),

  listMarkets: (params: {
    stage?: string;        // comma-separated coarse buckets
    event_slug?: string;
    creator?: string;      // canonical/raw address — backend matches variants
    source?: string;       // comma-separated pm_events.source values
    q?: string;
    page?: number;
    limit?: number;
  }) =>
    authReq<Envelope<MarketListRow[]>>(`${BASE}/markets`, { params: { ...params, admin_view: 1 } }),

  listActivities: (params: {
    page?: number;
    page_size?: number;
    tag?: string;
    is_featured?: number;
    is_active?: number;
  }) =>
    authReq<ActivityListResponse>(`${BASE}/activities`, { params }),

  getActivity: (id: number) =>
    unwrap<ActivityRow>(authReq(`${BASE}/activities/${id}`)),

  createActivity: (body: Partial<ActivityRow> & { tags: string[]; title: string }) =>
    unwrap<ActivityRow>(authReq(`${BASE}/activities`, {
      method: 'POST', data: body,
    })),

  updateActivity: (id: number, body: Partial<ActivityRow> & { tags?: string[] }) =>
    unwrap<ActivityRow>(authReq(`${BASE}/activities/${id}`, {
      method: 'PATCH', data: body,
    })),

  deleteActivity: (id: number) =>
    unwrap<{ deleted: number }>(authReq(`${BASE}/activities/${id}`, {
      method: 'DELETE',
    })),

  listCampaigns: (includeHidden = 0) =>
    authReq<{ ret: number; data: CampaignListItem[]; total: number; h5_base: string }>(
      `${BASE}/campaigns`, { params: { include_hidden: includeHidden } },
    ),

  getCampaign: (cid: string) =>
    unwrap<CampaignDetail>(authReq(`${BASE}/campaigns/${encodeURIComponent(cid)}`)),

  upsertCampaignMeta: (cid: string, langs: Record<string, CampaignLangMeta>) =>
    unwrap<CampaignDetail>(authReq(`${BASE}/campaigns/${encodeURIComponent(cid)}/meta`, {
      method: 'PUT', data: { langs },
    })),

  deleteCampaign: (cid: string) =>
    unwrap<{ deleted_rows: number }>(authReq(`${BASE}/campaigns/${encodeURIComponent(cid)}`, {
      method: 'DELETE',
    })),

  setCampaignHidden: (cid: string, hidden: boolean) =>
    unwrap<{ campaign_id: string; hidden: boolean }>(
      authReq(`${BASE}/campaigns/${encodeURIComponent(cid)}/hidden`, {
        method: 'POST', data: { hidden },
      }),
    ),

  championBets: (cid: string, params: { q?: string; page?: number; limit?: number }) =>
    authReq<ChampionBetsResponse>(`${BASE}/campaigns/${encodeURIComponent(cid)}/bets`, { params }),

  listMediaImages: (page = 1, page_size = 20) =>
    authReq<MediaListResponse>(`${BASE}/media`, {
      params: { page, limit: page_size },
    }),

  uploadMediaImage: (file: File, folder?: 'activities' | 'push' | 'misc') => {
    const fd = new FormData();
    fd.append('file', file);
    if (folder) fd.append('folder', folder);
    return unwrap<{ id: number; url: string; filename: string }>(
      authReq(`${BASE}/media/upload`, {
        method: 'POST',
        data: fd,
        requestType: 'form',
      }),
    );
  },

  deleteMediaImage: (id: number) =>
    unwrap<{ deleted: number }>(authReq(`${BASE}/media/${id}`, {
      method: 'DELETE',
    })),

  listTags: () =>
    unwrap<PmTagRow[]>(authReq(`${BASE}/tags`)),

  createTag: (body: {
    slug: string; name: string;
    sort_order?: number; is_active?: boolean; is_pinned?: boolean;
  }) =>
    unwrap<PmTagRow>(authReq(`${BASE}/tags`, { method: 'POST', data: body })),

  updateTag: (slug: string, body: Partial<{
    name: string;
    sort_order: number; is_active: boolean; is_pinned: boolean;
  }>) =>
    unwrap<PmTagRow>(authReq(`${BASE}/tags/${encodeURIComponent(slug)}`, { method: 'PATCH', data: body })),

  deleteTag: (slug: string) =>
    unwrap<{ deleted: number }>(authReq(`${BASE}/tags/${encodeURIComponent(slug)}`, { method: 'DELETE' })),

  eventTags: (slug: string) =>
    unwrap<PmTagRow[]>(authReq(`${BASE}/events/${encodeURIComponent(slug)}/tags`)),

  setEventTags: (slug: string, tag_ids: number[]) =>
    unwrap<{ added: number[]; removed: number[]; current: number[] }>(
      authReq(`${BASE}/events/${encodeURIComponent(slug)}/tags`, {
        method: 'PUT', data: { tag_ids },
      }),
    ),

  bulkAttachTag: (tag_slug: string, event_slugs: string[]) =>
    unwrap<{ changed: string[]; skipped_existing?: string[]; unknown_slugs: string[] }>(
      authReq(`${BASE}/tags/${encodeURIComponent(tag_slug)}/attach`, {
        method: 'POST', data: { event_slugs },
      }),
    ),

  bulkDetachTag: (tag_slug: string, event_slugs: string[]) =>
    unwrap<{ changed: string[]; unknown_slugs: string[] }>(
      authReq(`${BASE}/tags/${encodeURIComponent(tag_slug)}/detach`, {
        method: 'POST', data: { event_slugs },
      }),
    ),

  pushSend: (body: {
    title: string;
    body?: string;
    recipient_address?: string;
    action_url?: string;
  }) =>
    unwrap<SendPushResult>(authReq(`${BASE}/push`, {
      method: 'POST', data: body,
    })),

  pushHistory: (params: {
    page?: number; limit?: number;
    status?: string; recipient_address?: string;
  }) =>
    authReq<{
      ret: number; data: PushHistoryRow[];
      total: number; page: number; limit: number;
    }>(`${BASE}/push`, { params }),

  updatePushStatus: (id: number, body: { status: 'pending' | 'sent' | 'failed'; error?: string }) =>
    unwrap<{ ok: boolean }>(authReq(`${BASE}/push/${id}/status`, {
      method: 'PATCH', data: body,
    })),

  listUsers: (params: {
    q?: string;
    is_pro?: number;
    page?: number;
    limit?: number;
  }) =>
    authReq<{ ret: number; data: UserRow[]; total: number; page: number; limit: number }>(
      `${BASE}/users`, { params },
    ),

  getUser: (idOrAddress: string) =>
    unwrap<UserDetail>(authReq(`${BASE}/users/${encodeURIComponent(idOrAddress)}`)),

  syncEvent: (body: { signature: string; source?: string; description?: string }) =>
    authReq<{ ret: number; msg?: string; data?: { event_id?: string | null; onchain_event_id?: number; source?: string } }>(
      `${BASE}/events/sync`,
      { method: 'POST', data: body },
    ),

  marketState: (slug: string) =>
    unwrap<MarketState | null>(
      authReq(`${BASE}/markets/${encodeURIComponent(slug)}`),
    ),

  marketConfig: (slug: string) =>
    unwrap<MarketConfig | null>(
      authReq(`${BASE}/markets/${encodeURIComponent(slug)}/config`),
    ),

  claimPreview: (slug: string, addr: string) =>
    unwrap<{ amount: string }>(
      authReq(`${BASE}/markets/${encodeURIComponent(slug)}/claim-preview`, { params: { addr } }),
    ),

  marketBets: (slug: string, limit: number, offset: number) =>
    unwrap<{ items: MarketBet[]; total: number; limit: number; offset: number }>(
      authReq(`${BASE}/trades`, { params: { market_slug: slug, limit, offset } }),
    ),

  listDisputes: (params: { status?: string; source?: string; page?: number; limit?: number }) =>
    authReq<Envelope<DisputeRow[]>>(`${BASE}/disputes`, { params }),

  disputeDetail: (id: number) =>
    unwrap<DisputeRow & { market?: MarketState }>(
      authReq(`${BASE}/disputes/${id}`),
    ),

  listOperators: () => unwrap<string[]>(authReq(`${BASE}/operators`)),

  listAdminAccounts: () =>
    unwrap<AdminAccountRow[]>(authReq(`${BASE}/admin-accounts`)),

  addAdminAccount: (body: { address: string; label?: string }) =>
    unwrap<AdminAccountRow>(authReq(`${BASE}/admin-accounts`, {
      method: 'POST', data: body,
    })),

  deleteAdminAccount: (id: number) =>
    unwrap<{ id: number }>(authReq(`${BASE}/admin-accounts/${id}`, {
      method: 'DELETE',
    })),

  getConfig: () => unwrap<Record<string, unknown>>(authReq(`${BASE}/config/runtime`)),

  updateConfig: (key: string, body: { value?: unknown; memo?: string; is_public?: boolean }) =>
    unwrap<Record<string, unknown>>(authReq(`${BASE}/configs/${encodeURIComponent(key)}`, {
      method: 'PATCH', data: body,
    })),

  listDbConfigs: (prefix?: string) =>
    authReq<{ ret: number; data: ConfigRow[] }>(`${BASE}/configs`, { params: { admin_view: 1, prefix } }),

  updateDbConfig: (body: { key: string; value: unknown }) =>
    authReq<{ ret: number; msg?: string }>(`${BASE}/configs/${encodeURIComponent(body.key)}`, {
      method: 'PATCH', data: { value: body.value },
    }),

  creatorRewardBalance: (address: string) =>
    unwrap<{ address: string; balance: string }>(
      authReq(`${BASE}/config/creator-reward`, { params: { address } }),
    ),

  polymarketCategories: () =>
    unwrap<PolymarketCategory[]>(authReq(`${BASE}/polymarket/categories`)),

  polymarketEvents: (params: {
    category?: string;
    q?: string;
    active?: boolean;
    closed?: boolean;
    days?: number;
    order?: string;
    ascending?: boolean;
    limit?: number;
    offset?: number;
  }) =>
    authReq<Envelope<PolymarketEvent[]>>(`${BASE}/polymarket/events`, { params }),

  polymarketMarkets: (params: {
    category?: string;
    q?: string;
    active?: boolean;
    closed?: boolean;
    days?: number;
    order?: string;
    ascending?: boolean;
    limit?: number;
    offset?: number;
  }) =>
    authReq<Envelope<PolymarketMarket[]>>(`${BASE}/polymarket/markets`, { params }),

  inviteSummary: () =>
    unwrap<InviteSummaryRow[]>(authReq(`${BASE}/invite/pending-summary`)),

  inviteRewards: (params: {
    inviter_luffa_id?: string;
    invitee_luffa_id?: string;
    status?: 'pending' | 'paid';
    page?: number;
    limit?: number;
  }) =>
    authReq<Envelope<InviteRewardRow[]>>(`${BASE}/invite/rewards`, { params }),

  inviteMarkPaid: (body: { ids: number[]; tx_hash?: string }) =>
    unwrap<{ flipped: number; skipped: number; tx_hash: string | null }>(
      authReq(`${BASE}/invite/mark-paid`, { method: 'POST', data: body }),
    ),

  inviteInvitees: (inviter_luffa_id: string) =>
    unwrap<InviteInviteeRow[]>(
      authReq(`${BASE}/invite/invitees`, { params: { inviter_luffa_id } }),
    ),

  inviteOpsWallet: () =>
    unwrap<{ address: string; balance_base: string; configured: boolean }>(
      authReq(`${BASE}/invite/ops-wallet`),
    ),

  listClaims: (params: { status?: string; page?: number; limit?: number }) =>
    authReq<Envelope<ClaimRow[]>>(`${BASE}/invite/claims`, { params }),

  confirmClaim: (id: number, tx_hash: string) =>
    unwrap<{ claim_id: number; status: string }>(
      authReq(`${BASE}/invite/claims/${id}/confirm`, {
        method: 'POST', data: { tx_hash },
      }),
    ),

  failClaim: (id: number, error?: string) =>
    unwrap<{ claim_id: number; status: string }>(
      authReq(`${BASE}/invite/claims/${id}/fail`, {
        method: 'POST', data: { error: error || '' },
      }),
    ),

  adminEventIsAdmin: (addr: string) =>
    authReq<{ ret: number; data: { is_admin: boolean } }>(
      `${BASE}/admin-events/is-admin`, { params: { addr } },
    ).then((r) => r?.data?.is_admin ?? false),

  championIsAdmin: (addr: string) =>
    authReq<{ ret: number; data: { is_admin: boolean } }>(
      `${BASE}/campaigns/is-admin`, { params: { addr } },
    ).then((r) => r?.data?.is_admin ?? false),

  listChampionAdmins: () =>
    authReq<{ ret: number; data: string[] }>(`${BASE}/campaigns/admins`)
      .then((r) => r?.data ?? []),

  listAdminEventAdmins: () =>
    authReq<{ ret: number; data: string[] }>(`${BASE}/admin-events/admins`)
      .then((r) => r?.data ?? []),

  addAdminEventAdminToDb: (addr: string) =>
    authReq(`${BASE}/admin-events/admins`, { method: 'POST', data: { addr } }),

  removeAdminEventAdminFromDb: (addr: string) =>
    authReq(`${BASE}/admin-events/admins/${encodeURIComponent(addr)}`, { method: 'DELETE' }),

  listAdminEvents: (params?: { page?: number; limit?: number }) =>
    authReq<Envelope<AdminEventRow[]>>(`${BASE}/admin-events`, { params }),

  createAdminEvent: (body: {
    tx_hash:     string;
    question:    string;
    answers:     string[];
    start_time:  number;
    end_time:    number;
    min_bet_eds?: number;
    prize_eds?:   number;
    slug?:        string;
  }) =>
    unwrap<{ slug: string; h5_url: string; tx_hash: string }>(
      authReq(`${BASE}/admin-events`, { method: 'POST', data: body }),
    ),

  getAdminEventStats: (slug: string) =>
    authReq<{ ret: number; data: { participant_count: number; collected_bets: number; min_bet_amount: number } }>(
      `${BASE}/admin-events/${encodeURIComponent(slug)}/stats`,
    ).then((r) => r?.data ?? { participant_count: 0, collected_bets: 0, min_bet_amount: 0 }),

  finalizeAdminEvent: (slug: string, body: { tx_hash: string; correct_answer: string }) =>
    unwrap<{ slug: string; correct_answer: string; tx_hash: string }>(
      authReq(`${BASE}/admin-events/${slug}/finalize`, {
        method: 'POST', data: body,
      }),
    ),

  leaderboardInvite: (params: { period?: 'day' | 'week' | 'month' | 'all'; week_offset?: number; limit?: number }) =>
    authReq<{ ret: number; data: LeaderboardInviteRow[] }>(
      `${BASE}/leaderboard/invite`, { params: { period: params.period || 'week', limit: params.limit || 10 } },
    ).then(r => r.data),

  leaderboardBet: (params: { period?: 'day' | 'week' | 'month' | 'all'; week_offset?: number; limit?: number; require_luffa_id?: number }) =>
    authReq<{ ret: number; data: LeaderboardBetRow[] }>(
      `${BASE}/leaderboard/bet`, { params: { period: params.period || 'week', limit: params.limit || 10 } },
    ).then(r => r.data),

  leaderboardTopic: (params: { period?: 'day' | 'week' | 'month' | 'all'; week_offset?: number; limit?: number }) =>
    authReq<{ ret: number; data: LeaderboardTopicRow[] }>(
      `${BASE}/leaderboard/topic`, { params: { period: params.period || 'week', limit: params.limit || 10 } },
    ).then(r => r.data),

  // Reward Payouts
  listPayouts: (params: { status?: string; page?: number; limit?: number }) =>
    authReq<{ ret: number; data: PayoutRow[]; total: number; page: number; limit: number }>(
      `${BASE}/payouts`, { params },
    ),

  getPayout: (id: number) =>
    authReq<{ ret: number; data: { payout: PayoutRow; items: PayoutItemRow[] } }>(
      `${BASE}/payouts/${id}`,
    ),

  getPayoutItems: (id: number, params: { status?: string; page?: number; limit?: number }) =>
    authReq<{ ret: number; data: PayoutItemRow[]; total: number; page: number; limit: number }>(
      `${BASE}/payouts/${id}/items`, { params },
    ),

  createPayout: (body: {
    name: string;
    tag?: string;
    claim_deadline: number;
    items: { address: string; amount_eds: number }[];
  }) =>
    unwrap<{ id: number; name: string; status: string; recipient_count: number; total_amount_eds: number }>(
      authReq(`${BASE}/payouts`, { method: 'POST', data: body }),
    ),

  createPayoutFromQuery: (body: {
    name: string;
    tag?: string;
    claim_deadline: number;
    query_type: string;
    reg_start?: string;
    reg_end?: string;
    bet_start?: string;
    bet_end?: string;
    min_bet?: string;
    amount_eds?: number;
    limit?: number;
    random_sample?: number;
  }) =>
    unwrap<{ id: number; name: string; total: number; total_eds: number }>(
      authReq(`${BASE}/payouts/from-query`, { method: 'POST', data: body }),
    ),

  distributePayout: (id: number) =>
    unwrap<{ payout_id: number; tx_hash: string; status: string }>(
      authReq(`${BASE}/payouts/${id}/distribute`, { method: 'POST' }),
    ),

  syncCreatePayout: (id: number, body: { create_tx_hash: string }) =>
    unwrap<{ payout_id: number; chain_payout_id?: number; pending?: boolean; vm_status?: string }>(
      authReq(`${BASE}/payouts/${id}/sync-create`, { method: 'POST', data: body }),
    ),

  confirmPayout: (id: number, body: { create_tx_hash: string; add_tx_hash: string }) =>
    unwrap<{ payout_id: number; chain_payout_id: number; status: string }>(
      authReq(`${BASE}/payouts/${id}/confirm`, { method: 'POST', data: body }),
    ),

  deletePayout: (id: number) =>
    unwrap<{ deleted: boolean }>(
      authReq(`${BASE}/payouts/${id}`, { method: 'DELETE' }),
    ),

  closePayout: (id: number) =>
    unwrap<{ payout_id: number; tx_hash: string; status: string }>(
      authReq(`${BASE}/payouts/${id}/close`, { method: 'POST' }),
    ),
};

export interface ConfigRow {
  key: string;
  value: string;
  memo: string | null;
  updated_at: string | null;
}

export interface InviteSummaryRow {
  inviter_luffa_id: string;
  pending_base:     string;
  pending_count:    number;
  last_reward_at:   string | null;
  inviter_address:  string;
  inviter_nickname: string;
}

export interface InviteRewardRow {
  id:               number;
  inviter_luffa_id: string;
  invitee_luffa_id: string;
  invitee_address:  string;
  onchain_event_id: number;
  market_idx:       number;
  bet_tx_version:   string;
  bet_tx_index:     number;
  bet_amount_base:  string;
  reward_base:      string;
  status:           'pending' | 'paid';
  paid_at:          string | null;
  paid_tx_hash:     string | null;
  created_at:       string | null;
}

export interface ClaimRow {
  id:            number;
  uid:           string;
  user_address:  string;
  amount_base:   string;
  reward_ids:    string;
  status:        'pending' | 'processing' | 'done' | 'failed';
  tx_hash:       string;
  error:         string;
  created_at:    string | null;
  processed_at:  string | null;
  nickname:      string;
}

export interface AdminEventRow {
  slug:       string;
  question:   string;
  answers:    string[];
  end_time:   number;
  ended:      boolean;
  status:     string;
  h5_url:     string;
  created_at: string | null;
}

export interface LeaderboardInviteRow {
  rank: number;
  luffa_id: string;
  nickname: string;
  address: string;
  invitee_count: number;
}

export interface LeaderboardBetRow {
  rank: number;
  luffa_id: string;
  nickname: string;
  address: string;
  event_count: number;
  entry_count: number;
  total_wagered_eds: number;
}

export interface LeaderboardTopicRow {
  rank: number;
  luffa_id: string;
  nickname: string;
  address: string;
  event_id: string;
  event_question: string;
  heat_score: number;
}

export interface PayoutRow {
  id: number;
  name: string;
  tag: string | null;
  status: 'pending' | 'creating' | 'claimable' | 'closed';
  recipient_count: number;
  claimed_count: number;
  total_amount_eds: number;
  claimed_amount_eds: number;
  chain_payout_id: number | null;
  create_tx_hash: string;
  distribute_tx_hash: string;
  close_tx_hash: string;
  claim_deadline: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface PayoutItemRow {
  id: number;
  address: string;
  address_hex: string;
  is_valid_address: boolean;
  amount_eds: number;
  status: 'available' | 'claimed' | 'cancelled';
  claimed_at: string | null;
  claim_tx_hash: string;
  created_at: string | null;
}

export interface InviteInviteeRow {
  luffa_id:     string;
  nickname:     string;
  avatar:       string;
  address:      string;
  created_at:   string | null;
  bound_at:     number | null;     // unix seconds (NULL on pre-stamp legacy)
  pending_base: string;
  paid_base:    string;
  reward_count: number;
}
