# PolyMind API 迁移 Review：old api + admin/backend → new apps/api

> 评审日期：2026-07-09  
> 范围：旧 `api/` + `admin/backend/` 与新的 `apps/api/` 对照，重点检查 propose → bet → finalize/void → claim → dispute 主链路完整性、字段完整性、route 遗漏、以及优化合并点。

---

## 1. 总体结论

**新 `apps/api` 已完整覆盖旧系统的核心预测市场主链路**（draft → sync → bet → propose → finalize/void → claim → dispute），并在架构上做了重大合并和优化：

- 取消独立的 admin 域，admin 操作通过 `require_permission` 挂在资源 router 下
- 统一 SIWS 登录，替代旧的 chat JWT + Luffa 钱包登录两套体系
- 统一响应格式 `{ret, msg, data}`
- 用 PostgreSQL 取代 Redis/SQLite 做 nonce、push、job queue
- 将 admin/backend 的 CSV 导出、排行榜、dashboard、运营位等能力合并进同一 API

**但仍有一批旧端点/字段/模型未被迁移**。大部分是以下三类：
1. **V1/V2 旧协议残留**（如 CLOB orderbook、voting、legacy events/markets）
2. **Champion/H5 活动体系**（campaigns、champion indexer 相关业务）
3. **运营/机器人链路**（broadcast bot DM、invite balance/claim、red-dots、admin audit）

是否需要补齐，取决于新 Solana 架构是否还要兼容这些旧能力。下文按维度列出清单。

---

## 2. 主业务链路对照（propose 链路）

| 步骤 | 旧 api endpoint | 新 apps/api endpoint | 状态 | 备注 |
|---|---|---|---|---|
| 创建草稿 | `POST /api/v1/event/draft` | `POST /api/v1/events/draft` | ✅ 已迁移 | 新 schema 以 `title` 为主，不再区分 question/title |
| 链上创建后同步 | `POST /api/v1/event/sync` | `POST /api/v1/events/sync` | ✅ 已迁移 | 新：只确认 signature，indexer 写库 |
| 下注 | `POST /api/v1/event/place-sync` | `POST /api/v1/trades/sync` | ✅ 已迁移 | 新：按 trade 资源建模 |
| 提议结果 | 旧无独立端点（直接链上） | `POST /api/v1/markets/{slug}/propose` | ✅ 新增 | 新 API 提供确认入口 |
| 普通结算 | 链上 `finalize_proposed` | `POST /api/v1/markets/{slug}/finalize` | ✅ 已迁移 | |
| 紧急 VOID | 链上 `emergency_void` | `POST /api/v1/markets/{slug}/void` | ✅ 已迁移 | 新：admin 权限 |
| 预览 claim | `GET /api/v1/event/v3/claim-preview` | `GET /api/v1/markets/{slug}/claim-preview` | ✅ 已迁移 | 新：按 market slug |
| 领取 | `POST /api/v1/rewards/claim-sync` | `POST /api/v1/markets/{slug}/claim` | ✅ 已迁移 | 新：按 market slug |
| 提交争议 | `POST /api/v1/dispute/file` | `POST /api/v1/disputes` | ✅ 已迁移 | |
| admin 裁决 | `POST /api/v1/admin/dispute/resolve` | `POST /api/v1/disputes/{id}/resolve` | ✅ 已迁移 | |
| admin 强制 finalize | `POST /api/v1/admin/market/finalize` | 缺失 | ⚠️ 待补齐 | 新架构下可放 `POST /api/v1/markets/{slug}/finalize` 由 admin 调用，或单独 admin 端点 |
| admin 驳回争议 | `POST /api/v1/admin/dispute/dismiss` | 缺失 | ⚠️ 待补齐 | bond 罚没场景 |
| admin audit log | `GET /api/v1/admin/audit` | 缺失 | ⚠️ 待补齐 | 运营审计需要 |

**主链路结论**：核心闭环已通，但 admin 侧的 `dismiss`、`强制 finalize`、`audit log` 还没接入。

---

## 3. Route 遗漏清单

### 3.1 旧 `api/routers/` 中未迁移的公开/用户端点

| 旧 endpoint | 用途 | 是否应迁移 | 建议 |
|---|---|---|---|
| `GET /api/v1/config/runtime` | 返回合约地址、v3 地址、费率、邀请开关、排行榜显隐 | ✅ 建议迁移 | 可合并到 `/api/v1/configs?admin_view=false` 或新增 `/api/v1/configs/runtime` |
| `GET /api/v1/config/routes` | 小程序 deep-link 路由表 | ⚠️ 视需求 | 如还要支持 superbox，需要保留 |
| `GET /api/v1/config/contract` | 旧合约地址 | ❌ 不迁移 | V1/V2 合约已废弃 |
| `GET /api/v1/event/v3/config` | 全局 V3 market config、admin、 sponsor、 betting limits | ✅ 建议迁移 | 对应新 `markets.config` / `configs` 表，可放 `/api/v1/configs/market` |
| `GET /api/v1/event/v3/market/state` | 链上 market 状态 | ⚠️ 视需求 | 新架构下前端可直接读链，API 可不代理 |
| `GET /api/v1/event/v3/position` | 用户链上 position | ⚠️ 视需求 | 新 `positions` 表已聚合，可用 `/api/v1/markets/{slug}/claim-preview` 替代 |
| `GET /api/v1/event/v3/user-stats` | V3 + champion 下注统计 | ✅ 建议迁移 | 可合并到 `/api/v1/profile/stats` 或 `/api/v1/users/{address}/stats` |
| `GET /api/v1/event/detail/{event_id}/entries` | 市场活动/交易流水 | ✅ 已部分覆盖 | `/api/v1/trades` 已提供，但缺按 event 聚合 |
| `GET /api/v1/event/detail/{event_id}/orderbook` | 订单簿 | ❌ 不迁移 | V1/V2 CLOB 已废弃 |
| `GET /api/v1/event/orders/open` | 未成交订单 | ❌ 不迁移 | V1/V2 CLOB 已废弃 |
| `GET /api/v1/event/oracle/question` | oracle adapter 状态 | ❌ 不迁移 | oracle adapter 模块已废弃 |
| `GET /api/v1/event/voting/*` | voting 模块 | ❌ 不迁移 | V2 voting 已废弃 |
| `GET /api/v1/tag/list` | 标签列表 | ✅ 已迁移 | `/api/v1/tags` |
| `GET /api/v1/invite/balance` | 邀请奖励余额 | ⚠️ 建议迁移 | 新 referrals 缺余额汇总 |
| `POST /api/v1/invite/claim` | 提取邀请奖励 | ⚠️ 建议迁移 | 对应新 `reward_payouts`  job queue |
| `GET /api/v1/invite/claim-status` | 最新提取状态 | ⚠️ 建议迁移 | |
| `GET /api/v1/invite/history` | 邀请奖励历史 | ✅ 已迁移 | `/api/v1/referrals/rewards` |
| `GET /api/v1/rewards` | 待领取奖励列表 | ⚠️ 建议迁移 | creator + referral 待领取汇总 |
| `POST /api/v1/rewards/claim-sync` | 同步奖励 claim | ✅ 已迁移 | `/api/v1/markets/{slug}/claim` |
| `GET /api/v1/user/balance` | EDS 余额 | ⚠️ 视需求 | 新架构用 Solana 原生余额，API 可不代理 |
| `GET /api/v1/user/red-dots` | 未读红点 | ⚠️ 建议迁移 | 可用 notifications unread_count 替代 |
| `POST /api/v1/user/inbox/mark-seen` | 标记收件箱已读 | ✅ 已覆盖 | `/api/v1/notifications/read` |
| `GET /api/v1/user/creator-reward` / `creator-reward-history` | 创建者奖励 | ✅ 已迁移 | `/api/v1/profile/rewards` |
| `GET /api/v1/user/invite/relations` | 邀请关系 | ⚠️ 建议迁移 | 新 referrals 缺关系列表 |
| `POST /api/v1/broadcast/*` | 机器人广播 | ❌ 不迁移 | 属于运营 bot，不是 API 核心 |
| `GET /api/v1/champion/campaign/*` | Champion H5 活动 | ❌ 本次不迁移 | 活动体系独立，如需要后续单独评估 |
| `GET /api/polymarket/*` | Polymarket 代理 | ✅ 已部分迁移 | 新 `/api/v1/polymarket/events` + orderbook；缺 markets/tags/search/prices |
| `GET /api/v1/share/payload` | H5 分享 payload | ⚠️ 视需求 | superbox/H5 需要 |
| `GET /api/v1/share/poster/{luffa_id}` | 用户战绩海报 | ⚠️ 视需求 | 运营分享需要 |
| `GET /api/v1/share/e/{event_id}` | 事件落地页 | ⚠️ 视需求 | SEO/分享需要 |
| `POST /api/chat` AI 流 | 聊天机器人 | ❌ 不迁移 | 应走独立的 ai-service |
| `POST /api/chat/order-paid` | 聊天订单支付 | ❌ 不迁移 | 属于 chat 商业化，非核心 |
| `POST /api/auth/*` 用户名密码 | chat/web 登录 | ❌ 不迁移 | 被 SIWS 替代 |

### 3.2 旧 `admin/backend/routers/` 中未迁移的 admin 端点

| 旧 endpoint | 用途 | 是否应迁移 | 建议 |
|---|---|---|---|
| `GET /admin/v1/admin-events/is-admin` / `admins` | admin 名单管理 | ✅ 已覆盖 | 新 `/api/v1/admin-accounts` |
| `POST /admin/v1/admin-events/{slug}/finalize` | 事件级 finalize | ⚠️ 待补齐 | 新 `/api/v1/markets/{slug}/finalize` 由 admin 调用即可 |
| `GET /admin/v1/admin-events/{slug}/stats` | 事件统计 | ✅ 已覆盖 | 新 `/api/v1/dashboard/overview` + `/api/v1/events/{slug}` |
| `GET /admin/v1/bets` | 下注列表 | ✅ 已覆盖 | `/api/v1/trades` |
| `GET /admin/v1/campaigns/*` | Champion 活动 admin | ❌ 本次不迁移 | 活动体系独立 |
| `GET /admin/v1/config/db/list` / `db/update` | 配置管理 | ✅ 已覆盖 | `/api/v1/configs` |
| `GET /admin/v1/config/creator-reward` | 创建者奖励配置 | ⚠️ 建议迁移 | 可放 `/api/v1/configs/creator_reward` |
| `GET /admin/v1/dashboard/stats` / `users` / `bets` / `top-bets` / `invites` / `top-users` | 运营数据 | ⚠️ 建议补齐 | 新 dashboard 只有 overview/trend，缺 top 榜和 invites 统计 |
| `GET /admin/v1/disputes/{dispute_id}` | 争议详情 | ✅ 已迁移 | `/api/v1/disputes/{id}` |
| `GET /admin/v1/events/{slug}/stats` | 事件统计 | ⚠️ 建议补齐 | 可扩展 `/api/v1/events/{slug}` |
| `GET /admin/v1/invite/*` | 邀请奖励 admin | ⚠️ 建议迁移 | 运营需要 |
| `GET /admin/v1/leaderboard/*` | 排行榜 admin | ✅ 已覆盖 | `/api/v1/leaderboard` |
| `GET /admin/v1/markets/{event_id}/{market_idx}/state` / `bets` / `claim-preview` / `config` | market admin | ⚠️ 部分覆盖 | config 已覆盖；state/bets/claim-preview 可扩展 |
| `POST /admin/v1/polymarket/check-imported` | Polymarket 导入检查 | ⚠️ 视需求 | 如做 Polymarket 套利/同步需要 |
| `POST /admin/v1/push/validate` | push 预览/校验 | ⚠️ 建议迁移 | 可扩展 `/api/v1/push` |
| `GET /admin/v1/reward_payout/{payout_id}/items` / `distribute` / `close` / `confirm` / `download` | 奖励发放 admin | ⚠️ 建议补齐 | 新 job queue 缺 distribute/close/confirm/download |
| `GET /admin/v1/users/trading-stats` / `transactions` / `invitations` / `stats` / `invite-relations` | 用户 admin | ⚠️ 建议补齐 | 新 users 只有 CRUD 列表 |
| `GET /admin/v1/operators` / `roles` | 操作员角色 | ❌ 不迁移 | 新权限模型用 `permissions` JSONB 替代 |

---

## 4. 字段/模型遗漏清单

### 4.1 `events` / `markets` 相关

| 旧字段/模型 | 位置 | 新状态 | 建议 |
|---|---|---|---|
| `PmEvent.question` vs `title` | 旧有 question + title | 新只有 `title` | ✅ 合理合并 |
| `PmEvent.options` (JSON) | 旧市场选项 | 新用 `Market.label_yes/label_no` | ✅ 合理简化 |
| `PmEvent.start_time`, `end_time`, `end_date` | 旧时间字段 | 新只有 `deadline` | ⚠️ 如需多 market 时间不同，可保留 |
| `PmEvent.h5_url` | Champion 活动链接 | 缺失 | 如保留 Champion，需加回 |
| `PmEvent.tag` | 旧字符串 tag | 新用 `event_tags` 多对多 | ✅ 优化 |
| `PmEvent.is_trending` (int nullable) | 1=force,0=hide,NULL=default | 新 bool | ⚠️ 运营需要三态控制，建议改回 int/nullable |
| `PmEvent.can_share`, `can_bet` | 开关 | ✅ 已迁移 | |
| `PmEvent.yes_pool/no_pool` (String) | 事件级 pool | 新 market 级 pool | ✅ 合理 |
| `PmMarket.oracle_linked`, `oracle_question_id`, `condition_id` | oracle 适配 | 缺失 | 如不做 oracle 适配，可不迁移 |
| `PmMarket.polymarket_condition_id/slug`, `external_source/market_id/aux_id` | 外部市场关联 | 缺失 | 如做 Polymarket 导入，需加回 |
| `PmMarket.notif_*` 系列 cron 时间戳 | 通知提醒 | 缺失 | 可改由 cron 任务自行维护，不存表 |
| `PmMarket.finalization_path` | 结算路径 1-5 | 新 Market 无此字段 | ⚠️ 建议加回，用于审计和展示 |
| `PmMarket.admin_reason` | admin 裁决理由 | 新 dispute.reason 有 | ⚠️ 但 market 级没有， disputed 后 admin finalize 需要 |
| `PmMarket.creator_seed_bet_amount/side/tx` | 创建者种子下注 | ✅ 已迁移 | |
| `PmMarket.creator_performed`, `platform_rake`, `creator_reward`, `distributable_pool` | 结算统计 | ✅ 已迁移 | |
| `MarketConfig` 快照 | 旧 `PmMarket.cfg_*` | 新 Market 直接存费率 | ✅ 合理 |

### 4.2 `positions` / `trades` 相关

| 旧字段/模型 | 位置 | 新状态 | 建议 |
|---|---|---|---|
| `Position` PK 用 `event_id` slug | 旧 | 新 `(market_id, user_address)` | ✅ 更合理 |
| `Position.onchain_event_id`, `pm_event_id`, `luffa_id`, `payout` | 旧实际表字段 | 新 `payout_amount` | ⚠️ 旧 `payout` 字符串需确认精度；建议保留 `onchain_event_id` 用于调试 |
| `ClobOrder` 表 | 旧 my-predictions 来源 | 新用 `trades` + `positions` | ✅ 简化 |
| `Trade` 表 | 旧 V2 | 新 `trades` | ✅ 已迁移 |

### 4.3 `disputes` 相关

| 旧字段/模型 | 位置 | 新状态 | 建议 |
|---|---|---|---|
| `Dispute.bond_tx_hash` | 旧 | 新 `bond_tx_signature` | ✅ 命名统一 |
| `Dispute.filed_tx_version`, `filed_at` | 旧 | 新用 `created_at` | ✅ 简化 |
| `Dispute.resolved_reason`, `resolved_tx_hash` | 旧 | 新 `reason`, 无 resolved_tx_hash | ⚠️ 建议加 `resolved_tx_signature` |
| `Dispute.status` 枚举 | pending/resolved/dismissed | 新 active/resolved/rejected | ✅ 语义等价，建议加 `dismissed` |
| `AdminAuditLog` 表 | 旧 | 缺失 | ⚠️ 建议补 audit_log 模型 |

### 4.4 用户/邀请/通知相关

| 旧字段/模型 | 位置 | 新状态 | 建议 |
|---|---|---|---|
| `User.luffa_id` | 旧核心 ID | 新以 `address` 为核心 | ✅ 合理（Solana 架构） |
| `User.cid` | Luffa 会话 | 缺失 | 如保留 superbox 登录需要 |
| `User.inviter_bound_at` | 邀请绑定时间 | 缺失 | ⚠️ 排行榜统计需要，建议加回 |
| `User.invite_source` | 邀请来源 | 缺失 | ⚠️ 运营需要 |
| `UserAddress` 表 | 地址变体 | 缺失 | 新 Solana 单地址，不需要 |
| `InviteBalance` 表 | 邀请余额 | 缺失 | ⚠️ 如保留 invite claim，需要 |
| `InviteReward` 表 | 邀请奖励明细 | 新 `referral_rewards` | ✅ 已迁移，但缺 campaign_id nullable 判别 |
| `V3EventLog` 详细事件表 | 旧 indexer 写入 | 新 `chain_event_log` | ⚠️ 新表更通用，但缺 `kind=BET` 等按 market 聚合的索引 |
| `push_messages.push_type=2` | 旧 admin 通知来源 | 新 `push_messages` | ⚠️ 新表无 push_type，需用 payload 区分 |
| `notifications` 拼装逻辑 | 旧实时从多表拼装 | 新直接读 `notifications` 表 | ✅ 简化，但 indexer 需负责写入 |

### 4.5 奖励发放/批量转账

| 旧字段/模型 | 位置 | 新状态 | 建议 |
|---|---|---|---|
| `RewardPayout.name`, `tag`, `creator_id` | 旧 | 新无 | ⚠️ 运营命名/标签需要 |
| `RewardPayoutItem` 子表 | 旧 | 新无 | ⚠️ 如做批量奖励分发，需要子任务表 |
| `RewardPayout.direct_transfer` | 旧 | 新无 | ⚠️ 区分直接转账 vs 申领模式 |
| `RewardPayout.claim_deadline` | 旧 | 新无 | 如用户主动 claim，需要 |
| `BatchTransfer.from-query` | 旧按查询条件创建 | 新无 | 运营批量转账需要 |

---

## 5. 优化与合并点（新架构做得好的地方）

1. **Admin 不单独成域**：旧 `admin/backend` 16+ router 文件，新架构通过 `require_permission` 把 admin 操作挂在资源下，router 数量减少一半以上。
2. **统一认证**：旧有 chat JWT、Luffa 钱包、admin SIWS 多套，新全部走 SIWS + user/admin JWT。
3. **统一响应格式**：旧 `success`/`ret`/`msg` 混用，新全部 `{ret, msg, data}`。
4. **模型简化**：
   - 去掉 `PmEvent.question`/`options` 等冗余，直接用 `title` + `Market.label_yes/no`
   - 去掉 `ClobOrder`，用 `trades` + `positions` 判断参与
   - 去掉 `UserAddress`、`luffa_id` 等 legacy ID
5. **配置管理 JSONB 化**：旧 config 值分散在多个字段，新 `configs.value` JSONB 更灵活。
6. **Job queue 统一**：旧 reward_payout/batch_transfer 在 admin 域有复杂状态机，新统一为 `pending/running/completed/failed`。
7. **通知持久化**：旧通知中心实时拼装多表，新直接写入 `notifications` 表，查询简单可靠。
8. **排行榜口径修复**：旧 API  leaderboard 已修复 `inviter_bound_at`、`calendar.timegm`、inclusive end 等问题，新架构可直接沿用这些修复。

---

## 6. 建议下一步补齐（按优先级）

### P0 - 主链路必须
1. **Admin 强制 finalize / dismiss 争议**：`POST /api/v1/disputes/{id}/dismiss`、admin 调用 `markets/{slug}/finalize` 的权限分支。
2. **Admin audit log**：新增 `admin_audit_logs` 表 + `GET /api/v1/admin/audit`。
3. **Market 级 `finalization_path` 和 `admin_reason`**：用于结算展示和审计。

### P1 - 运营需要
4. **邀请余额与提取**：`GET /api/v1/referrals/balance`、`POST /api/v1/referrals/claim`。
5. **奖励发放完整流程**：`reward_payouts/{id}/distribute`、`close`、`confirm`、`download`、以及 `RewardPayoutItem` 子表。
6. **Dashboard 补齐**：`top-bets`、`top-users`、`invites` 统计。
7. **用户 admin 增强**：`users/{id}/stats`、`transactions`、`invite-relations`。

### P2 - 视产品需求
8. **Champion/Campaign 活动体系**：如继续支持 H5 活动，需单独评估。
9. **Polymarket 完整代理**：markets、tags、search、prices。
10. **Share 扩展**：`share/payload`、`share/poster`、`share/e/{slug}`。
11. **Broadcast bot DM**：运营推送机器人（非核心 API）。

### P3 - 字段微调
12. `Event.is_trending` 改回 nullable int（NULL/0/1 三态）。
13. `User` 增加 `inviter_bound_at`、`invite_source`。
14. `Dispute` 增加 `resolved_tx_signature`、`dismissed` 状态。
15. `InviteReward`/`ReferralReward` 增加 `campaign_id` nullable 以支持 champion 奖励。

---

## 7. 一句话总结

**新 `apps/api` 在 propose 主链路和核心资源建模上已经完整，并成功合并了旧 api + admin/backend 的重复能力；主要遗漏集中在 admin 运营侧（audit、强制 finalize/dismiss、dashboard top 榜、邀请提取、奖励发放完整 workflow）以及 Champion/H5 活动体系。**
