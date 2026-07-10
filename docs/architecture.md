# PolyMind 架构设计

> 最后更新：2026-07-10

## 1. 总体架构

PolyMind 是一个基于 Solana 的预测市场平台。整体采用**链上程序 + Python API Worker + Python API + Web/Admin 前端**的分层架构：

```text
┌─────────────────────────────────────────────────────────────┐
│                     Web Frontend / Admin                    │
│    apps/web (TanStack Start + React 19 + TypeScript)       │
│    apps/admin (Ant Design Pro + umi/max + TypeScript)      │
│              Wallet: @solana/react-hooks                    │
└───────────────────────┬─────────────────────────────────────┘
                        │ REST /api/v1/*
┌───────────────────────▼─────────────────────────────────────┐
│                      Python API                             │
│            apps/api (FastAPI + SQLAlchemy 2.0)              │
│  - 只读查询（markets, trades, positions, leaderboard...）   │
│  - 交易同步校验（POST /sync）                                │
│  - Admin 后台接口（统一 router + 权限 dependency）           │
│  - Python Worker 监听链上事件并写入 PostgreSQL               │
└───────────────────────┬─────────────────────────────────────┘
                        │ read / write
┌───────────────────────▼─────────────────────────────────────┐
│                     PostgreSQL 18                           │
│              polymind-db-1 (port 5433)                      │
└───────────────────────┬─────────────────────────────────────┘
                        │ events / logs
┌───────────────────────▼─────────────────────────────────────┐
│                    Solana Network                           │
│    solana/programs/polymind         (Anchor, parimutuel)   │
│    solana/programs/polymind_champion (Anchor, champion)    │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. 技术栈

| 层级 | 技术 | 说明 |
|---|---|---|
| 用户端前端 | TanStack Start + React 19 + TypeScript | 全栈 React，SSR 友好 |
| Admin 前端 | Ant Design Pro + umi/max + TypeScript | 运营后台 |
| 前端样式 | Tailwind CSS v4 + shadcn/ui | 原子 CSS + 组件库 |
| 前端状态 | React hooks + URL state | 无全局状态管理库 |
| 钱包 | `@solana/react-hooks` + `@solana/client` | 官方推荐，Wallet Standard |
| 后端框架 | FastAPI + SQLAlchemy 2.0 async | Python 异步 |
| 数据库 | PostgreSQL 18 (Docker) | 唯一数据库 |
| ORM 迁移 | Alembic | autogenerate + 手动调整 |
| 链上程序 | Anchor 1.0.2 (Rust 1.89.0) | Solana 程序标准框架 |
| 索引器 | Python Worker (`apps/api/app/workers/`) | Python 轮询 Solana RPC、解析 Anchor events 写入 PostgreSQL |
| 包管理 | pnpm (web/admin) + uv (api) + Cargo (solana) | 各层独立 |

---

## 3. 目录结构

```text
polymind/
├── apps/
│   ├── web/                      # 用户端 Web（端口 3100）
│   │   ├── src/lib/              # api、wallet、i18n 封装
│   │   └── src/routes/           # 页面路由
│   │
│   ├── admin/                    # Admin 后台（端口 8000）
│   │   └── src/pages/            # Dashboard / Events / Markets / Users...
│   │
│   └── api/                      # FastAPI 后端（端口 8300）
│       ├── app/
│       │   ├── core/             # config, logging, security
│       │   ├── db/               # Base, engine, session
│       │   ├── models/           # SQLAlchemy 模型（events/markets/positions/...）
│       │   ├── schemas/          # Pydantic DTOs
│       │   ├── services/         # 业务逻辑
│       │   ├── routers/          # 统一 router（公开 + admin 权限）
│       │   ├── clients/solana.py # Solana RPC 客户端
│       │   ├── dependencies/auth.py
│       │   └── workers/          # Python 链上事件索引与定时任务
│       │       ├── indexer.py              # PolyMind 主程序事件索引
│       │       ├── champion_indexer.py     # Champion 活动事件索引
│       │       ├── notification_worker.py  # 链上事件 → notifications
│       │       ├── deadline_cron.py        # 时间触发提醒
│       │       └── referral_reward_worker.py # 推荐奖励结算
│       ├── alembic/              # 数据库迁移
│       └── idl/                  # Anchor IDL（程序 build 后同步）
│
├── solana/                       # 链上程序（Anchor）
│   └── programs/
│       ├── polymind/             # Parimutuel 预测市场主程序
│       └── polymind_champion/    # Champion / campaign 程序（Phase 3）
│
├── docs/
│   ├── architecture.md           # 本文档
│   ├── progress.md               # 项目进展
│   └── solana-contract-plan.md   # Solana 合约实现计划
│
├── dev.sh                        # 一键启动 web + admin + api + workers
├── docker-compose.yml            # PostgreSQL
├── package.json
└── pnpm-workspace.yaml
```

---

## 4. 数据流

### 4.1 交易流程

```text
1. 用户在 web/admin 点击 "Create Market" 或 "Bet YES"
2. 前端通过 @solana/react-hooks 获取钱包签名者
3. 构造并发送链上 transaction（gasless 场景由 relayer 作为 fee payer）
4. 得到 tx_signature
5. 前端轮询确认（confirmed / finalized）
6. 确认后调用对应业务同步端点：
   - 创建事件/市场：POST /api/v1/events/sync { signature }
   - 下注：POST /api/v1/trades/sync { signature }
   - 提案：POST /api/v1/markets/{slug}/propose { signature }
   - 结算：POST /api/v1/markets/{slug}/finalize { signature }
   - VOID：POST /api/v1/markets/{slug}/void { signature }
   - Claim：POST /api/v1/markets/{slug}/claim { signature }
   - 争议：POST /api/v1/disputes { signature, ... }
   - 轻量确认（可选）：POST /api/v1/sync { signature, kind }
7. API 从 Solana RPC 拉取 transaction，校验 signature、instruction discriminator 和事件
8. Python Worker（app/workers/indexer.py）监听链上事件，写入 PostgreSQL
9. API 从 PostgreSQL 返回最新状态
```

前端写链、后端同步的模型与旧 PolyMind 一致：Python worker 轮询 Solana RPC，解析 program logs 后写库，业务 sync 端点负责即时校验 transaction 内容。

### 4.2 查询流程

```text
1. 前端 GET /api/v1/markets
2. API 从 PostgreSQL 查询 markets 表
3. 返回分页 JSON
4. 前端渲染
```

---

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

### 5.2 Python API Worker 监听链

- Python API 的 `app/workers/indexer.py` 轮询 Solana RPC，解析 program logs，写入 PostgreSQL。
- Web API 本身只从 PostgreSQL 读数据，并在前端 sync 时做轻量 RPC 校验。
- 与旧 PolyMind `api/scripts/indexer.py` 架构一致，降低团队学习成本。
- Rust indexer 已废弃并删除，`solana/indexer/` 目录不再存在。

### 5.3 Gasless 支持

- Solana 没有 Move 的 `sponsored` 关键字。
- MVP 的 gasless 通过**交易级 fee payer** 实现：relayer 支付 gas，真实用户（authority）签名。
- 程序层面不区分 sponsored/non-sponsored，只校验真实 authority 的签名。

### 5.4 一套 Service，多套 Router

```text
app/services/market.py  → MarketService
app/routers/markets.py  → 公开接口
app/routers/admin.py    → 管理员接口（如果坚持命名），但仍调用 MarketService
```

### 5.5 Solana 项目在根目录

- `solana/` 放根目录，不和 `apps/` 混排。
- 原因：Anchor/Cargo 有独立工具链和发布周期。
- 拆分为两个程序：`polymind`（主预测市场）和 `polymind_champion`（冠军赛）。

### 5.6 MarketConfig 快照

- 每个 market 创建时复制当前全局配置（平台费、创建者奖励、争议窗口、创建者提议超时、过期模式等）。
- 写入 `markets` 表对应字段，admin 后续改全局配置不影响已创建市场。
- 与旧 PolyMind `MarketConfig` 行为一致。

### 5.7 创建者义务与 Slash

- 创建 market 时需下种子注（seed bet）。
- 创建者必须在 `creator_propose_timeout` 窗口内提议结果。
- 错过窗口则创建者仓位被 slash，转入该 market 的 `bonus_pool`。
- slash 后若市场变成单边，自动 VOID。

### 5.8 单边市场保护

- 同一地址在同一 market 不能同时押 YES 和 NO（`single_side_only`）。
- 结算前若 YES 或 NO pool 为零，市场自动 VOID，所有参与者退本金。

### 5.9 费率模型（固定赔率）

- Phase 2 先不做 AMM/CLOB，采用固定赔率/比例分配。
- 结算时抽取：
  - **平台费**：按 `platform_fee_bps`，有上限 `platform_fee_max`。
  - **创建者奖励**：仅当创建者提议且结果一致时，按 `creator_reward_bps` 抽取。
- 剩余资金按输赢方 stake 比例分配。

### 5.10 代币精度抽象

- 链上程序使用 `u64` base units，不硬编码精度。
- 全局 `TOKEN_DECIMALS` / `TOKEN_MINT` 控制精度与代币品种，默认 USDC（6 位）。
- 前端与 API 统一通过 `TOKEN_DECIMALS` 做格式化与除法。

---

## 6. 数据模型

### 6.1 已实现核心表

| 表 | 关键字段 | 作用 |
|---|---|---|
| `event_categories` | `id`, `slug`, `name`, `display_order`, `icon` | 首页分类 tab |
| `tags` / `event_tags` | `id`, `slug`, `name` / `event_id`, `tag_id` | 标签定义与关联 |
| `events` | `id`, `onchain_event_id`, `creator_address`, `category_id`, `title`, `description`, `image_url`, `rules`, `source`, `status`, `is_trending`, `is_flagged`, `can_share`, `can_bet`, `pinned`, `deadline`, `token_mint`, `created_at`, `updated_at` | 事件主表 |
| `markets` | `id`, `event_id`, `market_idx`, `slug`, `onchain_market_id`, `title`, `label_yes/no`, `status`, `deadline`, `min_bet`, `yes_pool/no_pool/bonus_pool`, `volume`, `players_count`, `proposed_outcome`, `proposed_by`, `finalized_outcome`, `finalized_by`, `dispute_active`, `creator_seed_bet_*`, 费率快照字段, `vault_address` | 子市场 + 状态 + pool + 配置快照 |
| `positions` | `market_id`, `user_address`, `yes_amount`, `no_amount`, `claimed_amount`, `payout_amount` | 用户聚合持仓 |
| `trades` | `market_id`, `user_address`, `side`, `amount`, `tx_signature`, `slot`, `block_time` | 每次下注流水 |
| `disputes` | `market_id`, `disputer_address`, `claimed_outcome`, `bond_amount`, `bond_tx_signature`, `reason`, `resolved_outcome`, `status` | 争议记录 |
| `notifications` | `user_address`, `type`, `title`, `body`, `read`, `action_url`, `market_id` | 通知中心 |
| `referrals` / `referral_rewards` | 邀请关系与奖励结算 | 邀请体系 |
| `chain_event_log` | `program_id`, `signature`, `slot`, `block_time`, `kind`, `actor`, `payload` | Python worker 写入的通用链上事件日志 |
| `indexer_cursor` | `id`, `slot`, `signature`, `updated_at` | indexer 同步游标 |
| `configs` | `key`, `value`, `updated_at` | 全局 KV 配置 |
| `admin_accounts` | `id`, `address`, `permissions`, `created_at` | admin 地址管理 |

### 6.2 后续扩展表

| 表 | 作用 |
|---|---|
| `market_snapshots` | 走势图快照 |
| `activities` | banner/运营位 |
| `media` | 图片资源 |
| `admin_audit_logs` | admin 操作审计 |
| `login_nonces` | 钱包签名 nonce |

---

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

---

## 8. 迁移思路

### 8.1 旧 API 项目（`/Users/sylas/polymind/api`）

旧 API 是 Endless/Move 时代的后端服务，用于支撑小程序和 Web 前端。

| 项 | 旧系统 | 新系统 |
|---|---|---|
| 框架 | FastAPI + Python 3.11 | FastAPI + SQLAlchemy 2.0 async |
| 数据库 | MySQL | PostgreSQL 18 |
| 链 | Endless / Move | Solana / Anchor |
| 索引器 | `api/scripts/indexer.py` | `apps/api/app/workers/indexer.py` |
| 通知 | Luffa bot / SA 推送 | Web 内通知 |

### 8.2 旧合约项目（`/Users/sylas/polymind/smart-contract`）

旧合约跑在 Endless（Move/Aptos 兼容）链上：

| 目录 | 模块 | 作用 |
|---|---|---|
| `parimutuel/` | `market.move` | 核心二元预测市场 |
| `parimutuel/` | `dispute.move` | 争议仲裁 |
| `parimutuel/` | `admin.move` | 管理员注册表 |
| `parimutuel/` | `reward_vault.move` | 批量奖励发放 |
| `champion/` | `champion.move` | N 选 1 冠军赛 |
| `subscription/` | `subscription.move` | Pro 会员订阅 |
| `adminevent/` | `adminevent.move` | 管理员问答抽奖 |

核心状态机：

```text
OPEN ──bet──► AWAITING PROPOSAL ──propose──► PROPOSED ──finalize──► FINALIZED ──claim──► CLAIMED
                    │                           │
                    │                           ├── dispute ──► DISPUTED ──admin_finalize──► FINALIZED
                    │                           │
                    └── creator超时 ──► [takeover / VOID]
```

主要事件：`EventCreated`、`MarketCreated`、`Bet`、`OutcomeProposed`、`Finalized`、`Claimed`、`DisputeActiveSet`、`CreatorSlashed` 等。

### 8.3 新旧系统映射

| 旧系统 | 新 Solana 系统 | 说明 |
|---|---|---|
| Endless / Move | Solana / Anchor | 链和合约框架替换 |
| MySQL | PostgreSQL | 数据库替换 |
| SQLAlchemy 2.x sync | SQLAlchemy 2.0 async | ORM 升级 |
| Raw SQL 迁移 | Alembic | 迁移工具升级 |
| Python 轮询 indexer | Python 轮询 indexer | 监听方式保持一致 |
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

---

## 9. 链上程序实现计划

详见 `docs/solana-contract-plan.md`。核心要点：

- **两个 Anchor 程序**：`polymind`（parimutuel）和 `polymind_champion`（champion）。
- **Phase 1**：实现 `create_event_with_market` → `bet` → `propose_outcome` → `finalize_proposed` → `claim` + `dispute`/`admin_finalize`。
- **Phase 2**：admin 配置、异常 void、平台提现、creator reward。
- **Phase 3**：Champion 程序及其他扩展功能。
- **Gasless**：通过 relayer fee payer 模式支持，程序不区分 sponsored 指令。
- **事件与 Discriminator**：build 后同步 IDL 到 `apps/api/idl/`，回填 `chain_parser.py`。

---

## 10. 下一步建议

1. 按 `docs/solana-contract-plan.md` 实现 Anchor 程序 Phase 1。
2. 程序 build 后同步 IDL，更新 `apps/api/app/services/chain_parser.py`。
3. 把 `apps/web` 写操作从 mock/placeholder 切换到真实链上调用。
4. 完善 `apps/admin` 的 operators / admin-accounts / events / markets 页面。
5. 补充 admin routers（dashboard、events、markets、tags、users、disputes 等）。

---

Sources:
- [Helius: How to Index Solana Data](https://www.helius.dev/docs/rpc/how-to-index-solana-data)
- [anchorpy GitHub](https://github.com/kevinheavey/anchorpy)
- [Solana React Hooks 官方教程](https://solana.com/developers/cookbook/wallets/react-hooks)
