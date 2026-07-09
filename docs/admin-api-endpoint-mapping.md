# Admin MVP 页面新旧 API 端点映射

> 旧端点来自 `apps/admin/src/services/polymind.ts`（原 `/admin/v1`），新端点来自 `apps/api/app/routers/*.py`（`/api/v1`）。
> 状态说明：✅ 已完成 / ⚠️ 兼容但含占位 / ❌ 本次不做。

## 已存在 / 可直接映射

| 页面 | 旧端点 | 新端点 | 状态 | 说明 |
|---|---|---|---|---|
| Auth | `POST /auth/admin/nonce` | `POST /api/v1/auth/admin/nonce` | ✅ | |
| Auth | `POST /auth/admin/verify` | `POST /api/v1/auth/admin/verify` | ✅ | |
| Auth | `GET /auth/admin/me` | `GET /api/v1/auth/admin/me` | ✅ | |
| Dashboard | `GET /dashboard/overview` | `GET /api/v1/dashboard/overview` | ✅ | 替代 `/stats` |
| Dashboard | `GET /dashboard/trend` | `GET /api/v1/dashboard/trend` | ✅ | 参数 `days` |
| Dashboard | `GET /dashboard/users` | `GET /api/v1/dashboard/users` | ✅ | |
| Dashboard | `GET /dashboard/bets` | `GET /api/v1/dashboard/bets` | ✅ | |
| Dashboard | `GET /dashboard/invites` | `GET /api/v1/dashboard/invites` | ✅ | |
| Dashboard | `GET /dashboard/top-bets` | `GET /api/v1/dashboard/top-bets` | ✅ | |
| Dashboard | `GET /dashboard/top-users` | `GET /api/v1/dashboard/top-users` | ✅ | |
| Events | `GET /events` | `GET /api/v1/events?admin_view=true` | ✅ | 需带 `admin_view` |
| Events | `GET /events/{slug}` | `GET /api/v1/events/{slug}` | ✅ | |
| Events | `PATCH /events/{slug}` | `PATCH /api/v1/events/{slug}` | ✅ | 字段：`title/description/image_url/rules/category_id/status/is_trending/is_flagged/can_share/can_bet/pinned/pinned_at/deadline` |
| Events | `POST /events/sync` | `POST /api/v1/events/sync` | ✅ | body: `{signature}` |
| Events | `GET /events?download=1` | `GET /api/v1/events?download=1&admin_view=1` | ✅ | |
| Markets | `GET /markets` | `GET /api/v1/markets?admin_view=true` | ✅ | 需带 `admin_view` |
| Markets | `GET /markets/{slug}` | `GET /api/v1/markets/{slug}` | ✅ | |
| Markets | `GET /markets/{slug}/config` | `GET /api/v1/markets/{slug}/config` | ✅ | |
| Markets | `POST /markets/{slug}/finalize` | `POST /api/v1/markets/{slug}/finalize` | ✅ | body: `{signature}` |
| Markets | `POST /markets/{slug}/void` | `POST /api/v1/markets/{slug}/void` | ✅ | body: `{signature, reason}` |
| Markets | `PATCH /markets/{slug}` | `PATCH /api/v1/markets/{slug}` | ✅ | 字段：`title/label_yes/label_no/status/is_flagged/can_bet/deadline` |
| Markets | `GET /markets?download=1` | `GET /api/v1/markets?download=1&admin_view=1` | ✅ | |
| Disputes | `GET /disputes` | `GET /api/v1/disputes` | ✅ | |
| Disputes | `GET /disputes/{id}` | `GET /api/v1/disputes/{id}` | ✅ | |
| Disputes | `POST /disputes/{id}/resolve` | `POST /api/v1/disputes/{id}/resolve` | ✅ | body: `{resolved_outcome, signature, admin_reason}` |
| Disputes | `GET /disputes?download=1` | `GET /api/v1/disputes?download=1` | ✅ | |
| Tags | `GET /tags` | `GET /api/v1/tags` | ✅ | |
| Tags | `POST /tags` | `POST /api/v1/tags` | ✅ | body: `{slug, name, sort_order, is_active, is_pinned}` |
| Tags | `PATCH /tags/{slug}` | `PATCH /api/v1/tags/{slug}` | ✅ | |
| Tags | `DELETE /tags/{slug}` | `DELETE /api/v1/tags/{slug}` | ✅ | |
| Users | `GET /users` | `GET /api/v1/users` | ✅ | 权限 `users:list` |
| Users | `GET /users/{id_or_address}` | `GET /api/v1/users/{id_or_address}` | ✅ | |
| Users | `PATCH /users/{id_or_address}` | `PATCH /api/v1/users/{id_or_address}` | ✅ | 权限 `users:update` |
| Users | `GET /users/{id}/stats` | `GET /api/v1/users/{id}/stats` | ✅ | |
| Users | `GET /users/{id}/transactions` | `GET /api/v1/users/{id}/transactions` | ✅ | 含 `download=1` |
| Users | `GET /users/{id}/trading-stats` | `GET /api/v1/users/{id}/trading-stats` | ✅ | 含 `download=1` |
| Users | `GET /users/{id}/invite-relations` | `GET /api/v1/users/{id}/invite-relations` | ✅ | |
| Bets | `GET /bets` | `GET /api/v1/trades` | ✅ | 参数：`market_id/market_slug/user_address/side/download/page/limit` |
| Bets | `GET /bets?download=1` | `GET /api/v1/trades?download=1` | ✅ | |
| Activities | `GET /activities` | `GET /api/v1/activities` | ✅ | |
| Activities | `GET /activities?download=1` | `GET /api/v1/activities?download=1` | ✅ | |
| Activities | `POST /activities` | `POST /api/v1/activities` | ✅ | 权限 `activities:create` |
| Activities | `PATCH /activities/{id}` | `PATCH /api/v1/activities/{id}` | ✅ | |
| Activities | `DELETE /activities/{id}` | `DELETE /api/v1/activities/{id}` | ✅ | |
| Leaderboard | `GET /leaderboard/invite` | `GET /api/v1/leaderboard/invite` | ✅ | |
| Leaderboard | `GET /leaderboard/bet` | `GET /api/v1/leaderboard/bet` | ✅ | |
| Leaderboard | `GET /leaderboard/topic` | `GET /api/v1/leaderboard/topic` | ✅ | |
| Media | `GET /media/images` | `GET /api/v1/media` | ✅ | |
| Media | `POST /media/upload` | `POST /api/v1/media/upload` | ✅ | |
| Media | `DELETE /media/images/{id}` | `DELETE /api/v1/media/{id}` | ✅ | |
| Config | `GET /config` | `GET /api/v1/configs?admin_view=true` | ✅ | |
| Config | `PATCH /config/{key}` | `PATCH /api/v1/configs/{key}` | ✅ | body: `{value, memo, is_public}` |
| Push | `GET /push/history` | `GET /api/v1/push` | ✅ | |
| Push | `POST /push/send` | `POST /api/v1/push` | ✅ | body: `{title, body, recipient_address, action_url}` |
| Push | `PATCH /push/history/{id}` | `PATCH /api/v1/push/{id}/status` | ✅ | body: `{status, error}` |

## 后端补齐的兼容端点

| 页面 | 旧端点 | 新端点 | 状态 | 说明 |
|---|---|---|---|---|
| Wallet 模型 | `GET /meta` | `GET /api/v1/meta` | ✅ | 返回 Solana program id |
| Wallet 模型 | `GET /operators/roles` | `GET /api/v1/operators/roles` | ✅ | 从 `AdminAccount.permissions` 映射 |
| Wallet 模型 | `GET /operators?role=...` | `GET /api/v1/operators?role=...` | ✅ | |
| Campaigns | `GET /campaigns` | `GET /api/v1/campaigns` | ⚠️ | 元数据 CRUD + 下注列表；`is-admin`/`admins` 为占位 |
| Campaigns | `GET /campaigns/{cid}` | `GET /api/v1/campaigns/{cid}` | ✅ | |
| Campaigns | `PUT /campaigns/{cid}/meta` | `PUT /api/v1/campaigns/{cid}/meta` | ✅ | |
| Campaigns | `POST /campaigns/{cid}/hidden` | `POST /api/v1/campaigns/{cid}/hidden` | ✅ | |
| Campaigns | `DELETE /campaigns/{cid}` | `DELETE /api/v1/campaigns/{cid}` | ✅ | |
| Campaigns | `GET /campaigns/{cid}/bets?download=1` | `GET /api/v1/campaigns/{cid}/bets?download=1` | ✅ | |
| Admin Events | `GET /admin-events` | `GET /api/v1/admin-events` | ⚠️ | CRUD；`is-admin`/`stats` 为占位 |
| Admin Events | `POST /admin-events` | `POST /api/v1/admin-events` | ✅ | |
| Admin Events | `POST /admin-events/{slug}/finalize` | `POST /api/v1/admin-events/{slug}/finalize` | ✅ | |
| Admin Events | `GET /admin-events/admins` | `GET /api/v1/admin-events/admins` | ✅ | |
| Admin Events | `POST /admin-events/admins` | `POST /api/v1/admin-events/admins` | ✅ | |
| Admin Events | `DELETE /admin-events/admins/{addr}` | `DELETE /api/v1/admin-events/admins/{addr}` | ✅ | |
| Invite | `GET /invite/pending-summary` | `GET /api/v1/invite/pending-summary` | ✅ | |
| Invite | `GET /invite/rewards` | `GET /api/v1/invite/rewards` | ✅ | 含 `download=1` |
| Invite | `POST /invite/mark-paid` | `POST /api/v1/invite/mark-paid` | ✅ | |
| Invite | `GET /invite/invitees` | `GET /api/v1/invite/invitees` | ✅ | |
| Invite | `GET /invite/claims` | `GET /api/v1/invite/claims` | ✅ | 含 `download=1` |
| Invite | `POST /invite/claims/{id}/confirm` | `POST /api/v1/invite/claims/{id}/confirm` | ✅ | |
| Invite | `POST /invite/claims/{id}/fail` | `POST /api/v1/invite/claims/{id}/fail` | ✅ | |
| Invite | `GET /invite/ops-wallet` | `GET /api/v1/invite/ops-wallet` | ⚠️ | 返回占位数据 |

## 本次不做 / 需重新设计

| 页面 | 旧端点 | 说明 |
|---|---|---|
| Payouts | `GET/POST /payouts/*` | 旧批量发奖（items/distribute/close/confirm/from-query）。新 API 只有单 recipient `/reward-payouts/*`，**本次不做兼容** |
| Batch Transfers | `GET/POST /batch-transfer/*` | 旧批量转账任务。新 API 只有单 recipient `/batch-transfers/*`，**本次不做兼容** |
| Polymarket | `/polymarket/*` | 导入页面保留，链上同步逻辑待后续适配 |
| Config | `POST /push/validate` | 新 API 无对应；可移除 |
| Config | `GET /push/history/{id}` | 新 API 无详情接口；列表已足够 |

## 关键字段映射

| 旧字段 | 新字段 | 说明 |
|---|---|---|
| `luffa_id` | `address` | Solana base58 地址 |
| `onchain_event_id` / `event_id` | `slug` | 新事件主键为字符串 slug |
| `market_idx` | `slug` | 新市场主键为字符串 slug |
| `eds` / `amount_eds` | `amount`（token 单位） | USDC 6 位小数 / SOL 9 位；API 返回 token 单位 |
| `question` | `title` | 事件标题字段统一为 `title` |
| `label_yes` / `label_no` | 同左 | 保持不变 |
| `creator` / `onchain_event_creator` | `creator_address` | |
| `external_source` / `external_market_id` | 待确认 | Polymarket 导入字段 |

## 权限字符串对照

| 旧（如有） | 新 |
|---|---|
| admin | `*` |
| events | `events:list`, `events:update`, `events:delete` |
| markets | `markets:list`, `markets:update`, `markets:void`, `markets:finalize` |
| disputes | `disputes:list`, `disputes:resolve`, `disputes:dismiss` |
| users | `users:list`, `users:update` |
| tags | `tags:create`, `tags:update`, `tags:delete` |
| activities | `activities:create`, `activities:update`, `activities:delete` |
| media | `media:list`, `media:delete` |
| configs | `configs:list`, `configs:update` |
| push | `push:list`, `push:send` |
| dashboard | `dashboard:read` |
| reward_payouts | `reward_payouts:list`, `reward_payouts:create`, `reward_payouts:execute` |
| campaigns | `events:list`, `events:update`, `events:delete` |
| admin_events | `events:create`, `events:update`, `events:list` |
| invite | `users:list`, `reward_payouts:create` |
