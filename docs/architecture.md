# PolyMind 架构设计

> 最后更新：2026-07-08

## 1. 总体架构

PolyMind 是一个基于 Solana 的预测市场平台。整体采用**链上程序 + Rust 索引器 + Python API + Web 前端**的分层架构：

```text
┌─────────────────────────────────────────────────────────────┐
│                        Web Frontend                         │
│         apps/web (TanStack Start + React 19 + TS)          │
│              Wallet: @solana/react-hooks                    │
└───────────────────────┬─────────────────────────────────────┘
                        │ REST /api/v1/*
┌───────────────────────▼─────────────────────────────────────┐
│                      Python API                             │
│            apps/api (FastAPI + SQLAlchemy 2.0)              │
│  - 只读查询（markets, trades, positions, leaderboard...）   │
│  - 交易同步校验（POST /sync）                                │
│  - Admin 后台接口（统一 router + 权限 dependency）           │
└───────────────────────┬─────────────────────────────────────┘
                        │ read / write
┌───────────────────────▼─────────────────────────────────────┐
│                     PostgreSQL 18                           │
│              polymind-db-1 (port 5433)                      │
└───────────────────────┬─────────────────────────────────────┘
                        │ write
┌───────────────────────▼─────────────────────────────────────┐
│                     Rust Indexer                            │
│            solana/indexer (Anchor + Tokio)                  │
│  - Yellowstone gRPC / Helius 实时流                          │
│  - 解析 program logs，写入 PostgreSQL                        │
└───────────────────────┬─────────────────────────────────────┘
                        │ events / logs
┌───────────────────────▼─────────────────────────────────────┐
│                    Solana Network                           │
│          solana/programs/polymind (Anchor)                  │
└─────────────────────────────────────────────────────────────┘
```

## 2. 技术栈

| 层级 | 技术 | 说明 |
|---|---|---|
| 前端框架 | TanStack Start + React 19 + TypeScript | 全栈 React，SSR 友好 |
| 前端样式 | Tailwind CSS v4 + shadcn/ui | 原子 CSS + 组件库 |
| 前端状态 | React hooks + URL state | 无全局状态管理库 |
| 钱包 | `@solana/react-hooks` + `@solana/client` | 官方推荐，Wallet Standard |
| 后端框架 | FastAPI + SQLAlchemy 2.0 async | Python 异步 |
| 数据库 | PostgreSQL 18 (Docker) | 唯一数据库 |
| ORM 迁移 | Alembic | autogenerate + 手动调整 |
| 链上程序 | Anchor (Rust) | Solana 程序标准框架 |
| 索引器 | Rust + Tokio + sqlx | 高性能链上事件索引 |
| 包管理 | pnpm (web) + uv (api) + Cargo (solana) | 各层独立 |

## 3. 目录结构

```text
polymind/
├── apps/
│   ├── web/                      # 用户端 Web
│   │   ├── src/
│   │   │   ├── lib/
│   │   │   │   ├── wallet/       # @solana/react-hooks 封装
│   │   │   │   ├── api.ts        # API 调用封装
│   │   │   │   └── i18n/         # 多语言
│   │   │   ├── routes/           # 页面路由
│   │   │   │   ├── index.tsx
│   │   │   │   ├── markets.$eventId.tsx
│   │   │   │   ├── predictions.tsx
│   │   │   │   ├── notifications.tsx
│   │   │   │   ├── leaderboard.tsx
│   │   │   │   ├── profile.tsx
│   │   │   │   ├── invite.tsx    # 新增
│   │   │   │   └── create.tsx
│   │   │   └── components/
│   │   └── package.json
│   │
│   └── api/                      # Python 后端
│       ├── app/
│       │   ├── core/             # config, logging, security
│       │   ├── db/               # Base, engine, session
│       │   ├── models/           # SQLAlchemy 模型
│       │   ├── schemas/          # Pydantic DTOs
│       │   ├── services/         # 业务逻辑
│       │   ├── routers/          # 统一 router（无 admin 子域）
│       │   ├── clients/
│       │   │   └── solana.py     # Solana RPC 客户端
│       │   ├── dependencies/
│       │   │   └── auth.py       # require_permission
│       │   └── workers/          # 后台 worker（可选）
│       ├── alembic/              # 数据库迁移
│       └── docker-compose.yml    # PostgreSQL
│
├── solana/                       # 链上程序 + Rust 索引器
│   ├── programs/
│   │   └── polymind/             # Anchor 程序
│   └── indexer/                  # Rust 索引器
│
├── docs/
│   ├── progress.md               # 项目进展
│   └── architecture.md           # 本文档
│
├── dev.sh                        # 一键启动
├── docker-compose.yml            # 顶层编排（未来）
├── package.json
└── pnpm-workspace.yaml
```

## 4. 数据流

### 4.1 交易流程

```text
1. 用户在 web 点击 "Create Market" 或 "Bet YES"
2. 前端通过 @solana/react-hooks 获取钱包签名者
3. 构造并发送链上 transaction
4. 得到 tx_signature
5. 前端轮询确认（confirmed / finalized）
6. 确认后 POST /api/v1/sync { signature, kind }
   kind: "create_event" | "create_market" | "bet" | "propose" | "finalize" | "claim" | "dispute"
7. API 校验 signature 存在且有效
8. Rust Indexer 监听链上事件，写入 PostgreSQL
9. API 从 PostgreSQL 返回最新状态
```

前端写链、后端同步的模型与旧 PolyMind 一致，只是 sync 端点统一为 `/api/v1/sync`。

### 4.2 查询流程

```text
1. 前端 GET /api/v1/markets
2. API 从 PostgreSQL 查询 markets 表
3. 返回分页 JSON
4. 前端渲染
```

## 5. 关键设计决策

### 5.1 Admin 不是单独域

- **不要**创建 `app/routers/admin/` 目录。
- 所有资源一个 router，例如 `app/routers/markets.py`。
- 权限通过 dependency 注入：

```python
@router.patch("/markets/{market_id}")
async def update_market(
    market_id: str,
    body: MarketUpdate,
    user: CurrentUser = Depends(require_permission("market:write")),
    svc: MarketService = Depends(get_market_service),
):
    ...
```

### 5.2 Python API 不监听链

- Python 只从 PostgreSQL 读数据。
- 链上监听和解码由 Rust Indexer 负责。
- Python 只在前端 sync 时做轻量 RPC 校验。

### 5.3 一套 Service，多套 Router

```text
app/services/market.py  → MarketService
app/routers/markets.py  → 公开接口
app/routers/admin.py    → 管理员接口（如果坚持命名），但仍调用 MarketService
```

### 5.4 Solana 项目在根目录

- `solana/` 放根目录，不和 `apps/` 混排。
- 原因：Anchor/Cargo 有独立工具链和发布周期。

### 5.5 MarketConfig 快照

- 每个 market 创建时复制当前全局配置（平台费、创建者奖励、争议窗口、创建者提议超时、过期模式等）。
- 写入 `markets` 表对应字段，admin 后续改全局配置不影响已创建市场。
- 与旧 PolyMind `MarketConfig` 行为一致。

### 5.6 创建者义务与 Slash

- 创建 market 时需下种子注（seed bet）。
- 创建者必须在 `creator_propose_timeout` 窗口内提议结果。
- 错过窗口则创建者仓位被 slash，转入该 market 的 `bonus_pool`。
-  slash 后若市场变成单边，自动 VOID。

### 5.7 单边市场保护

- 同一地址在同一 market 不能同时押 YES 和 NO（`single_side_only`）。
- 结算前若 YES 或 NO pool 为零，市场自动 VOID，所有参与者退本金。

### 5.8 费率模型（先固定赔率）

- Phase 2 先不做 AMM/CLOB，采用固定赔率/比例分配。
- 结算时抽取：
  - **平台费**：按 `platform_fee_bps`，有上限 `platform_fee_max`。
  - **创建者奖励**：仅当创建者提议且结果一致时，按 `creator_reward_bps` 抽取。
- 剩余资金按输赢方 stake 比例分配。

## 6. 数据模型规划

### 6.1 当前已实现

- `users`：用户基础表，包含 address、nickname、invite_code 等。

### 6.2 Phase 2 最小表集（MVP）

支撑端到端预测市场流程 + superbox 主功能的最小表集：

| 表 | 关键字段 | 作用 |
|---|---|---|
| `event_categories` | `id`, `slug`, `name`, `display_order`, `icon` | 首页分类 tab |
| `tags` | `id`, `slug`, `name` | 标签定义 |
| `event_tags` | `event_id`, `tag_id` | 事件-标签多对多 |
| `events` | `id`, `onchain_event_id`, `creator_address`, `category_id`, `title`, `description`, `image_url`, `rules`, `source`, `status`, `is_trending`, `is_flagged`, `can_share`, `can_bet`, `pinned`, `deadline`, `token_mint`, `created_at`, `updated_at` | 事件主表 |
| `markets` | `id`, `event_id`, `market_idx`, `slug`, `onchain_market_id`, `title`, `label_yes/no`, `status`, `deadline`, `min_bet`, `yes_pool/no_pool/bonus_pool`, `volume`, `players_count`, `proposed_outcome`, `proposed_by`, `finalized_outcome`, `finalized_by`, `dispute_active`, `creator_seed_bet_*`, 费率快照字段, `vault_address` | 子市场 + 状态 + pool + 配置快照 |
| `positions` | `market_id`, `user_address`, `yes_amount`, `no_amount`, `claimed_amount`, `payout_amount` | 用户聚合持仓 |
| `trades` | `market_id`, `user_address`, `side`, `amount`, `tx_signature`, `slot`, `block_time` | 每次下注流水 |
| `disputes` | `market_id`, `disputer_address`, `claimed_outcome`, `bond_amount`, `bond_tx_signature`, `reason`, `resolved_outcome`, `status` | 争议记录 |
| `notifications` | `user_address`, `type`, `title`, `body`, `read`, `action_url`, `market_id` | 通知中心 |
| `referrals` | `inviter_address`, `invitee_address`, `invite_code_used`, `registered_at`, `status` | 邀请关系 |
| `referral_rewards` | `referral_id`, `market_id`, `amount`, `status`, `tx_signature`, `paid_at` | 邀请奖励 |
| `chain_event_log` | `program_id`, `signature`, `slot`, `block_time`, `kind`, `actor`, `payload` | Rust indexer 写入的通用链上事件日志 |
| `indexer_cursor` | `id`, `slot`, `signature`, `updated_at` | indexer 同步游标 |
| `configs` | `key`, `value`, `updated_at` | 全局 KV 配置（平台费、奖励比例、窗口时长等） |
| `admin_accounts` | `id`, `address`, `permissions`, `created_at` | admin 地址管理 |

> `users` 表已存在。

### 6.3 后续扩展表

| 表 | 作用 |
|---|---|
| `market_snapshots` | 走势图快照 |
| `activities` | banner/运营位 |
| `media` | 图片资源 |
| `admin_audit_logs` | admin 操作审计 |
| `login_nonces` | 钱包签名 nonce |
| `claim_requests` | 奖励提现申请（如采用旧版"申请-审核"模式） |

## 7. 前端 Wallet 封装

已迁移到 `@solana/react-hooks`：

```text
apps/web/src/lib/wallet/
├── WalletProvider.tsx    # SolanaProvider + mock wallet 支持
└── index.ts              # 导出 useWallet
```

对外提供统一接口：

```typescript
const { status, address, isMock, connect, disconnect } = useWallet();
```

- `status`: `"connected" | "connecting" | "disconnected"`
- `address`: Solana base58 地址
- `isMock`: 是否 mock 钱包（仅 DEV）
- `connect`: 连接真实钱包或 mock
- `disconnect`: 断开

## 8. 迁移思路

### 8.1 旧 API 项目（`/Users/sylas/polymind/api`）

旧 API 是预测市场的后端服务，用于支撑小程序和 Web 前端。

**技术栈**

| 项 | 旧系统 | 说明 |
|---|---|---|
| 框架 | FastAPI + Python 3.11 | 端口 `8100` |
| 数据库 | MySQL + SQLAlchemy 2.x | `DATABASE_URL` 配置 |
| 链交互 | `endless-sdk` + `httpx` | 调 Endless RPC |
| 包管理 | `uv` | `pyproject.toml` |
| 部署 | `dev.sh` 一键启动 | 含 indexer、notify_cron、gateway |

**核心表**

| 表 | 作用 | 新系统对应 |
|---|---|---|
| `pm_events` | 事件主表（问题、描述、状态、pool） | `events` |
| `pm_markets` | 子市场（一个 event 可多个 market） | `markets` |
| `positions` | 用户持仓 | `positions` |
| `trades` | 交易流水 | `trades` |
| `v3_event_log` | V3 链上事件流水 | `chain_event_log` |
| `chain_event_log` | Champion/H5 通用链上事件 | `chain_event_log` |
| `disputes` | 争议记录 | `disputes` |
| `users` | 用户、地址、邀请码 | `users` |
| `indexer_cursor` | 同步游标 | `indexer_cursor` |

**Indexer 机制**

- 轮询 Endless RPC，每 3 秒拉取一批 ledger version 范围内的事件。
- 处理 `market`、`dispute`、`reward_vault` 等模块的事件。
- 按 `(version, index)` 排序串行处理，避免乱序。
- 写入 `pm_events`、`pm_markets`、`positions`、`v3_event_log`、`disputes` 等表。
- 游标保存在 `indexer_cursor`。

**交易同步端点**

前端完成链上交易后，把 tx hash 回传 API 做即时同步：

- `POST /api/v1/event/sync` — 创建事件/市场
- `POST /api/v1/event/place-sync` — 下注
- `POST /api/v1/rewards/claim-sync` — claim 奖励
- `POST /api/v1/dispute/file` — 提交争议

### 8.2 旧合约项目（`/Users/sylas/polymind/smart-contract`）

旧合约跑在 Endless（Move/Aptos 兼容）链上。

**模块结构**

| 目录 | 模块 | 作用 |
|---|---|---|
| `parimutuel/` | `market.move` | 核心二元预测市场 |
| `parimutuel/` | `dispute.move` | 争议仲裁 |
| `parimutuel/` | `admin.move` | 管理员注册表 |
| `parimutuel/` | `reward_vault.move` | 批量奖励发放 |
| `champion/` | `champion.move` | N 选 1 冠军赛 |
| `subscription/` | `subscription.move` | Pro 会员订阅 |
| `adminevent/` | `adminevent.move` | 管理员问答抽奖 |

**核心状态机（`parimutuel/market.move`）**

```text
OPEN ──bet──► AWAITING PROPOSAL ──propose──► PROPOSED ──finalize──► FINALIZED ──claim──► CLAIMED
                    │                           │
                    │                           ├── dispute ──► DISPUTED ──admin_finalize──► FINALIZED
                    │                           │
                    └── creator超时 ──► [takeover / VOID]
```

关键规则：
- 创建者需下种子注。
- 下注有最小金额 `min_bet`。
- `single_side_only=true`，同一地址不能同时押两边。
- 创建者错过提议窗口会被 slash，仓位转入 `bonus_pool`。
- 单边市场自动 VOID。
- 结算抽取平台费 + 创建者奖励。
- 争议需锁 bond，admin 裁决。

主要事件：`EventCreated`、`MarketCreated`、`Bet`、`OutcomeProposed`、`Finalized`、`Claimed`、`DisputeActiveSet`、`CreatorSlashed` 等。

### 8.3 新旧系统映射

| 旧系统 | 新 Solana 系统 | 说明 |
|---|---|---|
| Endless / Move | Solana / Anchor | 链和合约框架替换 |
| MySQL | PostgreSQL | 数据库替换 |
| SQLAlchemy 2.x sync | SQLAlchemy 2.0 async | ORM 升级 |
| Raw SQL 迁移 | Alembic | 迁移工具升级 |
| Python 轮询 indexer | Rust 订阅 logs | 监听方式升级 |
| `pm_events` / `pm_markets` | `events` / `markets` | 表合并精简 |
| `v3_event_log` / `chain_event_log` | `chain_event_log` | 统一链上事件日志 |
| `positions` | `positions` | 主键改为 Solana base58 地址 |
| `disputes` | `disputes` | 保留业务 |
| `users` | `users` | 移除 Luffa 相关字段 |
| `event/sync`、`place-sync` | `POST /api/v1/sync` | 简化为统一 sync |
| Luffa 小程序 | `apps/web` | 只保留 Web 端 |
| Admin backend (8200) | `apps/api` 统一 router | 通过权限 dependency 区分 |
| Base58/Hex 地址转换 | 不再需要 | Solana 地址直接存字符串 |
| Move `Table` + `EventStore` | Anchor PDA | event / market / position / vault 各一个或多个 PDA |

### 8.4 数据迁移策略

- 旧数据库数据**不迁移**。
- 新 Schema 按 Solana 预测市场重新设计。
- 只保留业务规则参考（状态机、费率、争议机制等）。

## 9. 还需要考虑的问题

### 9.1 链上程序细节

基于旧 PolyMind parimutuel 核心状态机，Phase 2 先按以下最小可行版本实现：

| 项 | 决策 |
|---|---|
| 市场类型 | 二元预测市场（YES / NO / VOID） |
| 定价机制 | 固定赔率 / 比例分配（先不做 AMM/CLOB） |
| 结算代币 | USDC 或 SOL（程序参数化，默认 USDC） |
| 结算机制 | admin resolve（创建者提议 + 无争议 finalize + admin 紧急 VOID） |
| 创建者义务 | 需下种子注；必须在窗口内提议，否则 slash |
| 单边保护 | `single_side_only=true`；单边 pool 自动 VOID |
| 费率 | 平台费 bps + max；创建者奖励 bps + max |
| 争议 | 锁 bond；首次 dispute 后永久只能 admin finalize |
| PDA 设计 | `event`、`market`、`position`、`vault` 分开 |

后续可替换为 AMM 或引入 oracle，但 PDA 和表结构基本不变。

### 9.2 Rust Indexer 实现

- **数据源**：Solana RPC `logsSubscribe`（开发阶段），后续生产可切 Yellowstone gRPC 或专业 RPC。
- **事件解析**：通过 Anchor event discriminator 解析 program logs。
- **事件去重**：按 `tx_signature` + `slot`。
- **失败重试 + DLQ**：失败事件先进入死信队列，避免阻塞主索引。
- **backfill 机制**：从指定 slot 开始历史回填。

### 9.3 前端 Sync 时序

- 用户下注后，indexer 可能先写库，sync 后写。
- 需要幂等设计。
- 是否需要 sync worker 队列？

### 9.4 价格/概率计算

- 如果 AMM 有非线性定价，后端需要同步公式或直接从链上读取。
- 走势图数据需要 `market_snapshots`。

### 9.5 通知系统

- 如果不要 Luffa bot，通知只走 `notifications` 表。
- 是否需要 WebSocket / SSE 实时推送？

### 9.6 邀请奖励机制

- 邀请码是链上还是链下？
- 奖励结算时机和比例？
- 是否需要链下批量发放？

### 9.7 排行榜

- 实时 SQL 聚合还是预计算快照？
- 是否需要 `leaderboard_snapshots` 表或 Redis 缓存？

### 9.8 多语言与 SEO

- TanStack Start 的 SSR 对 SEO 友好，但 i18n 路由需要规划。

### 9.9 TypeScript 版本

- `@solana/kit` peer 依赖 TypeScript ^5.0.0，当前项目用 6.0.3。
- 目前 typecheck 通过，但长期建议评估是否降级到 TS 5.x。

### 9.10 Admin 权限模型

- 当前设计是简单 permission string。
- 如果未来需要角色（超管、运营、财务），需要 RBAC 表。

## 10. 下一步建议

1. 确定 Solana 程序 IDL 和 PDA 设计。
2. 实现 Rust indexer 基础框架。
3. 逐步添加 Phase 2 数据模型（events、markets、positions、trades...）。
4. 把 `apps/web` mock handler 切换到真实 API。
5. 补充 admin routers（dashboard、events、markets、tags、users、disputes 等）。

---

Sources:
- [Helius: How to Index Solana Data](https://www.helius.dev/docs/rpc/how-to-index-solana-data)
- [Predix backend (Rust indexer + Postgres)](https://github.com/sarthakitaliya/Predix-backend)
- [sol-indexer (Rust + Postgres template)](https://github.com/Jayant818/sol-indexer)
- [anchorpy GitHub](https://github.com/kevinheavey/anchorpy)
- [Solana React Hooks 官方教程](https://solana.com/developers/cookbook/wallets/react-hooks)
