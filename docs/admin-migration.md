# Admin 前端迁移文档

## 背景

将旧 PolyMind Admin 前端（`/Users/sylas/polymind/admin/frontend`）迁移到新 monorepo 的 `/Users/sylas/polymind/polymind/apps/admin`。

- **旧 Admin**：umi/max + Ant Design Pro v6 + React 19 + TypeScript，调用 `/admin/v1/*`（旧 admin/backend 8200 / 旧 api 8100），认证使用 Endless 地址 + SIWS。
- **新 Monorepo**：`apps/web` 使用 TanStack Start + shadcn/ui + Solana；`apps/api` 使用 FastAPI async + PostgreSQL（端口 8300），认证使用 Solana SIWS。

## 迁移策略

**Copy-First，不改页面重写**：
1. 把旧 `admin/frontend` 整体 copy 到 `apps/admin`。
2. 逐步抽出 `web` 与 `admin` 通用的内容到 `packages/`（优先 `wallet`、`shared-utils`）。
3. **只改接口和认证**，不动 Ant Design Pro 页面逻辑。
4. **API 缺什么补什么**：不因为新 API 暂时没有就删除前端页面/功能。

## 关键决策

| 决策 | 结论 |
|---|---|
| 是否保留 umi/max + AntD Pro | **保留** |
| 后端目标 | 新 `apps/api`（端口 8300） |
| 认证方式 | Solana SIWS（`/api/v1/auth/admin/*`） |
| 实施节奏 | 分阶段 MVP |

## 当前状态总览

### ✅ 已完成

- Admin 前端完整 copy 到 `apps/admin` 并接入 monorepo
- 端口改为 3200，proxy 指向 8300
- `@polymind/wallet` 公共包接入 Solana SIWS
- `services/polymind.ts` BASE 改为 `/api/v1`
- 认证 flow 改为 `/api/v1/auth/admin/*`
- 核心页面 API 端点适配：Dashboard、Events、Markets、Disputes、Tags、Users、Bets（Trades）、Activities、Leaderboard、Media、Config、Push
- Admin 下载地址从 `/admin/v1/*` 统一改为 `/api/v1/*`
- 后端补齐：
  - `meta`、`operators`
  - `campaigns`（Champion H5 活动元数据）
  - `admin-events`（特殊活动）
  - `invite/*`（邀请奖励、claim、打款）
  - `users/{id}/transactions`、`users/{id}/trading-stats`、`users/{id}/invite-relations`
  - Events / Markets / Disputes / Activities 的 `download=1` CSV 导出
- TypeScript 全绿，`pnpm typecheck:admin` 通过
- API 可启动，Ruff 通过

### ❌ 未完成 / 本次不做

| 模块 | 说明 |
|---|---|
| **Reward Payouts** | 旧 `/payouts/*` 批量发奖端点（items、distribute、close、confirm、from-query）。新 API 只有单 recipient `/reward-payouts/*`，**本次不做兼容**，等 Solana 发奖流程重新设计 |
| **Batch Transfers** | 旧 `/batch-transfer/*` 批量转账任务端点。新 API 只有单 recipient `/batch-transfers/*`，**本次不做兼容** |
| **链上 admin 检查** | `campaigns/is-admin`、`campaigns/admins`、`admin-events/is-admin`、`admin-events/{slug}/stats`、`invite/ops-wallet` 返回占位数据，待 Solana 程序 wiring |
| **Polymarket 导入** | 旧导入页面保留，但链上同步逻辑需后续适配 |
| **Treasury** | 依赖 payout/batch-transfer，随之上移 |

## 阶段划分（已更新）

### Phase 0：复制与 workspace 接入 ✅
- copy 旧 admin/frontend 到 apps/admin
- 删除 node_modules、dist、.umi、.git、lockfiles
- 接入 pnpm-workspace
- 调整 package.json（端口 3200）
- proxy 指向 `http://localhost:8300`
- API CORS 加入 `http://localhost:3200`

### Phase 1：Solana SIWS 认证与 wallet 公共包 ✅
- 抽取 `packages/wallet`（基于 `@solana/react-hooks`）
- 替换 admin 中 Endless 签名逻辑
- `services/polymind.ts` 中 `authNonce`/`authVerify` 改为 `/api/v1/auth/admin/*`
- 登录页改用 Solana 钱包连接

### Phase 2：核心页面 API 端点适配（MVP） ✅
- `BASE` 从 `/admin/v1` 改为 `/api/v1`
- 替换以下页面/接口：
  - Dashboard
  - Events（列表、详情、可见性、标签）
  - Markets（列表、详情、finalize、void）
  - Disputes（列表、resolve、dismiss）
  - Tags
  - Users
  - Bets（trades）
  - Activities
  - Leaderboard
  - Media
  - Config
  - Push
- 字段映射：`luffa_id` → `address`，`question+title` → `title`，`event_id/market_idx` → `slug`

### Phase 3：后端补齐与运营工具页面 ✅
- Dashboard 细分统计（users/bets/invites/top-bets/top-users/trend）— **已完成**
- 用户 stats / transactions / invite-relations / trading-stats — **已完成**
- 邀请奖励 admin（balance/claim/rewards/invitees）— **已完成**
- Reward payout items / distribute / close / confirm / download — **本次不做**
- 事件标签管理 — **已完成**
- Campaigns（Champion H5）兼容端点 — **已完成（元数据 CRUD + 下注列表）**
- Admin events 兼容端点 — **已完成**
- Operators / Meta 兼容端点 — **已完成**
- Events / Markets / Disputes / Activities CSV 导出 — **已完成**

### Phase 4：高级/遗留能力（视需求） ❌
- Polymarket 导入 — 待评估
- Treasury — 依赖 payout，待重新设计
- Batch Transfers 管理页 — 依赖 batch-transfer，待重新设计
- Reward Payouts 批量发奖 — 待重新设计

## 端点对照速查

| 旧端点 | 新端点 | 状态 |
|---|---|---|
| `POST /admin/v1/auth/nonce` | `POST /api/v1/auth/admin/nonce` | ✅ |
| `POST /admin/v1/auth/verify` | `POST /api/v1/auth/admin/verify` | ✅ |
| `GET /admin/v1/auth/me` | `GET /api/v1/auth/admin/me` | ✅ |
| `GET /admin/v1/admin-accounts` | `GET /api/v1/admin-accounts` | ✅ |
| `GET /admin/v1/events` | `GET /api/v1/events?admin_view=true` | ✅ |
| `GET /admin/v1/events/{slug}` | `GET /api/v1/events/{slug}` | ✅ |
| `PATCH /admin/v1/events/{slug}` | `PATCH /api/v1/events/{slug}` | ✅ |
| `GET /admin/v1/events?download=1` | `GET /api/v1/events?download=1&admin_view=1` | ✅ |
| `GET /admin/v1/markets` | `GET /api/v1/markets?admin_view=true` | ✅ |
| `GET /admin/v1/markets/{slug}` | `GET /api/v1/markets/{slug}` | ✅ |
| `GET /admin/v1/markets?download=1` | `GET /api/v1/markets?download=1&admin_view=1` | ✅ |
| `GET /admin/v1/disputes` | `GET /api/v1/disputes` | ✅ |
| `GET /admin/v1/disputes?download=1` | `GET /api/v1/disputes?download=1` | ✅ |
| `GET /admin/v1/users` | `GET /api/v1/users` | ✅ |
| `GET /admin/v1/users/{id}/transactions` | `GET /api/v1/users/{id}/transactions` | ✅ |
| `GET /admin/v1/users/{id}/trading-stats` | `GET /api/v1/users/{id}/trading-stats` | ✅ |
| `GET /admin/v1/users/{id}/invite-relations` | `GET /api/v1/users/{id}/invite-relations` | ✅ |
| `GET /admin/v1/bets` | `GET /api/v1/trades` | ✅ |
| `GET /admin/v1/tags` | `GET /api/v1/tags` | ✅ |
| `GET /admin/v1/activities` | `GET /api/v1/activities` | ✅ |
| `GET /admin/v1/activities?download=1` | `GET /api/v1/activities?download=1` | ✅ |
| `GET /admin/v1/leaderboard/*` | `GET /api/v1/leaderboard/*` | ✅ |
| `GET /admin/v1/media/images` | `GET /api/v1/media` | ✅ |
| `POST /admin/v1/push/send` | `POST /api/v1/push` | ✅ |
| `GET /admin/v1/configs` | `GET /api/v1/configs?admin_view=true` | ✅ |
| `GET /admin/v1/meta` | `GET /api/v1/meta` | ✅ |
| `GET /admin/v1/operators/roles` | `GET /api/v1/operators/roles` | ✅ |
| `GET /admin/v1/campaigns` | `GET /api/v1/campaigns` | ✅（Solana 链上 admin 检查为占位） |
| `GET /admin/v1/admin-events` | `GET /api/v1/admin-events` | ✅（Solana 链上 admin 检查为占位） |
| `GET /admin/v1/invite/*` | `GET /api/v1/invite/*` | ✅（ops-wallet 为占位） |
| `POST /admin/v1/markets/{eid}/{idx}/finalize` | `POST /api/v1/admin/markets/{slug}/finalize` | ✅ |
| `POST /admin/v1/admin/dispute/dismiss` | `POST /api/v1/admin/disputes/{id}/dismiss` | ✅ |
| `POST /admin/v1/disputes/resolve` | `POST /api/v1/disputes/{id}/resolve` | ✅ |
| `POST /admin/v1/markets/{eid}/{idx}/void` | `POST /api/v1/markets/{slug}/void` | ✅ |
| `GET/POST /admin/v1/payouts/*` | — | ❌ 本次不做 |
| `GET/POST /admin/v1/batch-transfer/*` | — | ❌ 本次不做 |

## 目录结构

```
polymind/
├── apps/
│   ├── web/              # TanStack Start + shadcn
│   ├── api/              # FastAPI
│   └── admin/            # 旧 admin/frontend copy（umi/max + AntD Pro）
└── packages/
    ├── wallet/           # Solana 钱包公共包
    └── shared-utils/     # 工具函数公共包
```

## 关键文件

- `apps/admin/package.json` — 保留 umi/max 依赖，端口 3200
- `apps/admin/config/proxy.ts` — 代理到 8300
- `apps/admin/src/services/polymind.ts` — API 封装
- `apps/admin/src/models/wallet.ts` — Solana SIWS 登录态
- `apps/api/app/dependencies/auth.py` — admin JWT 与权限
- `apps/api/app/routers/` — 后端路由

## 风险

1. umi/max 与 monorepo 依赖冲突：通过独立 lockfile 或 overrides 解决。
2. 新旧 API 端点差异大：已按"API 缺什么补什么"策略补齐大部分兼容端点。
3. **Reward Payouts / Batch Transfers**：旧批量流程未兼容，相关页面暂时无法使用，需产品/技术重新设计 Solana 流程。
4. 数据字段差异：在 service/router 层做字段映射。

## 参考文档

- `docs/admin-api-endpoint-mapping.md` — 旧端点 → 新端点详细映射
- `docs/migration-review.md` — 旧 api + admin/backend → 新 apps/api 的完整对照
- `docs/progress.md` — 当前项目进展
