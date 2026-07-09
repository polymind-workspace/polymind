# PolyMind 迁移实施计划

> 状态：**已完成**  
> 决策：链上事件索引由 Python API 自行承担（与旧架构一致）  
> 更新日期：2026-07-09  
> 完成日期：2026-07-09

---

## 1. 背景与核心决策

### 1.1 旧系统（OLD）

- 链：Endless / Aptos（Move）
- 业务模型：Parimutuel 预测市场
- 后端：Python FastAPI + SQLAlchemy
- 索引器：Python `api/scripts/indexer.py` 轮询链、解析事件、写 MySQL
- 通知：`notify_cron.py` + `notify_dispatch.py` 推送至 superbox/Luffa inbox

### 1.2 新系统（NEW）目标

- 链：Solana（Anchor program）
- 业务模型：**保持 Parimutuel，不改 AMM**
- 后端：Python FastAPI + SQLAlchemy 2.0 async + PostgreSQL
- 索引器：**Python 自行实现**，与 OLD 模式一致
- 通知：web 内列表展示，不再推送到 Luffa/superbox

### 1.3 关键架构决策

| 决策 | 说明 |
|---|---|
| **Python indexer** | Python 端自行轮询 Solana、解析事件、写 DB。所有链上事件索引由 `apps/api/app/workers/indexer.py` 承担。 |
| **Luffa/机器人/服务号推送排除** | 新系统面向 web，不再维护 superbox inbox 推送。 |
| **Parimutuel 保留** | `yes_pool/no_pool/bonus_pool`、`positions.yes_amount/no_amount`、claim 公式均保持 OLD 语义。 |

---

## 2. 业务模型确认

### 2.1 Parimutuel 核心公式

**YES/NO 赢方赔付：**
```
payout = user_stake * (yes_pool + no_pool + bonus_pool) / winning_pool
```

**VOID 赔付：**
```
payout = principal + principal * bonus_pool / (yes_pool + no_pool)
```

**手续费：**
```
profit = payout - principal
platform_fee = min(profit * platform_fee_bps / 10000, platform_fee_max)
creator_fee  = min(profit * creator_reward_bps / 10000, creator_reward_max)
net_payout = payout - platform_fee - creator_fee
```

### 2.2 市场状态机

```
OPEN ──bet──► AWAITING PROPOSAL ──propose──► PROPOSED ──finalize──► FINALIZED ──claim──► CLAIMED
                    │                           │
                    │                           ├── dispute ──► DISPUTED ──admin_finalize──► FINALIZED
                    │                           │
                    └── creator超时 ──► [Mode0: takeover] / [Mode1: VOID]
```

---

## 3. 与 OLD 的对比与变更

### 3.1 已正确迁移/优化的部分

| OLD | NEW | 状态 |
|---|---|---|
| `pm_events` + `events` | 合并为 `events` | ✅ 已合并 |
| `pm_markets` + `markets` | 合并为 `markets` | ✅ 已合并 |
| `clob_orders` | `trades`（bet 流水） | ✅ 功能等价 |
| `v3_event_log` + `chain_event_log` | 合并为 `chain_event_log` | ✅ 已合并 |
| `positions` | `positions`（增加 claimed_amount/payout_amount） | ✅ 已迁移 |
| `admin_accounts` | `admin_accounts`（增加 permissions JSONB） | ✅ 已扩展 |
| `configs` | `configs`（value 改为 JSONB） | ✅ 已扩展 |
| `orders`（V2 CLOB） | 无 | ✅ 正确排除 |
| Luffa 机器人/SA 推送 | 无 | ✅ 正确排除 |

### 3.2 必须修复的安全/正确性问题（已修复）

| 问题 | 严重级别 | 说明 | 状态 |
|---|---|---|---|
| 签名只确认不解析 | P0 | 任何成功 Solana 签名都可能被接受 | ✅ 已修复 |
| `PATCH /markets/{slug}` 可任意改 status | P0 | 可绕过链上状态变更 | ✅ 已移除 status 字段 |
| `void_market` 不写 audit log | P0 | 关键 admin 操作无审计 | ✅ 已写 audit log 并同步 market |
| Admin 账号权限升级无防护 | P0 | 普通 admin 可给自己加 `*` | ✅ 已加防护 |
| Batch transfer 对普通用户开放 | P0 | 应限制为 admin | ✅ 已限 admin |
| Python indexer | P1 | 需要 Solana 事件索引器 | ✅ 已实现 Python indexer |
| 缺少全局 config 端点 | P1 | OLD `/event/v3/config` 无替代 | ✅ 已新增 `/api/v1/config` |
| 缺少 creator propose timeout 状态机 | P1 | 无法判断 awaiting/expired | ✅ 已加 market stage 计算 |
| referral rewards 无结算 | P1 | market finalize 后不产生奖励 | ✅ 已加 referral reward worker |
| notifications 不自动生成 | P1 | web 通知列表为空 | ✅ 已加 notification worker |
| reward payout 链上调用缺失 | P2 | 当前为模拟执行 | ✅ 已实现真实 SOL 转账 |
| champion 模块缺失 | P2 | 需要完整重新实现 | ✅ 已实现 Champion MVP |

---

## 4. 实施阶段

### Phase 0：架构 pivot & 基础（本周）

**目标**：确认 Python indexer 方向，搭建链上解析公共模块，用 OLD Move 合约定义 event schema。

| # | 任务 | 交付物 | 状态 |
|---|---|---|---|
| 0.1 | 确认目录结构：`app/workers/` 放所有轮询进程 | `app/workers/` 包 | ✅ |
| 0.2 | 参考 OLD Move 合约提取 event / instruction schema | event schema 文档 + Python dataclass | ✅ |
| 0.3 | 创建 `app/services/chain_parser.py` | transaction / instruction / event 解析工具 | ✅ |
| 0.4 | 创建 `app/workers/indexer.py` 骨架 | RPC 轮询循环、cursor、事件分发 | ✅ |

### Phase 1：Python Indexer 核心（2-3 周）

**目标**：实现完整的 Solana 事件索引器。

| # | 任务 | 交付物 | 状态 |
|---|---|---|---|
| 1.1 | 完善 `app/workers/indexer.py` | `getSignaturesForAddress` 轮询、cursor 持久化、错误重试 | ✅ |
| 1.2 | 实现 `chain_event_log` 写入层 | 每笔交易解析后先写入 `chain_event_log`，作为原始事件源 | ✅ |
| 1.3 | 实现 `EventCreated` / `MarketCreated` handler | 从 `chain_event_log` 读取并创建 `events` / `markets` 行 | ✅ |
| 1.4 | 实现 `Bet` handler | 写 `trades`，更新 `markets.pool/volume/players_count`，upsert `positions` | ✅ |
| 1.5 | 实现 `OutcomeProposed` handler | 更新 `markets.proposed_*` 和 `status` | ✅ |
| 1.6 | 实现 `Finalized` handler | 更新 `markets.finalized_*`、`platform_rake`、`creator_reward`、`distributable_pool` | ✅ |
| 1.7 | 实现 `Claimed` handler | 更新 `positions.claimed_amount/payout_amount` | ✅ |
| 1.8 | 实现 dispute 事件 handler | `BondDeposited`、`DisputeResolved` 更新 `disputes` 和 `markets.dispute_active` | ✅ |

### Phase 2：API 安全加固（1 周）

**目标**：修复 P0 安全问题。

| # | 任务 | 交付物 | 状态 |
|---|---|---|---|
| 2.1 | 所有写端点解析 signature 验证 instruction + signer | 更新 `market_service.py`、`dispute_service.py`、`position_service.py`、`trade_service.py`、`event_service.py` | ✅ |
| 2.2 | 移除 `PATCH /markets/{slug}` 的 `status` 可写性 | 更新 schema 和 service | ✅ |
| 2.3 | `void_market` / `admin_finalize_market` 写 audit log 并同步更新 market 行 | 更新 `market_service.py` | ✅ |
| 2.4 | Admin 账号权限升级防护 + 最后 admin 保护 | 更新 `admin_account_service.py` | ✅ |
| 2.5 | Batch transfer 改为 admin 权限 | 更新 `batch_transfers.py` router | ✅ |

### Phase 3：Config + Market 状态机（1 周）

**目标**：补齐全局/市场配置，实现动态 stage 计算。

| # | 任务 | 交付物 | 状态 |
|---|---|---|---|
| 3.1 | `markets` 表加 `expired_propose_mode`、`single_side_only` | Alembic migration | ✅ |
| 3.2 | `configs` seed 补齐全局配置项 | 更新 `scripts/seed.py` | ✅ |
| 3.3 | 新增 `GET /api/v1/config` 全局配置端点 | 新 router / service | ✅ |
| 3.4 | `/markets/{slug}/config` 返回完整 per-market config | 更新 `market_service.py` | ✅ |
| 3.5 | Market stage 动态计算 | `betting/awaiting_proposal/expired_takeover/expired_voidable/proposed/in_review/disputed/finalized/void` | ✅ |

### Phase 4：Worker 体系（1 周）

**目标**：用 Python worker 替代 OLD 的 notify_cron 和 invite reward 结算。

| # | 任务 | 交付物 | 状态 |
|---|---|---|---|
| 4.1 | `app/workers/referral_reward_worker.py` | market finalize 后结算邀请奖励 | ✅ |
| 4.2 | `app/workers/notification_worker.py` | 从 `chain_event_log` 生成 `Notification` 行 | ✅ |
| 4.3 | `app/workers/deadline_cron.py` | deadline / propose timeout 时间触发通知 | ✅ |

### Phase 5：Champion Module（已完成）

**目标**：恢复 H5/champion 活动功能。

| # | 任务 | 交付物 | 状态 |
|---|---|---|---|
| 5.1 | Champion Solana program 事件解析 | `app/services/champion_parser.py` | ✅ |
| 5.2 | Champion DB 表 + API | `campaigns` / `campaign_meta` 等 | ✅ |
| 5.3 | Champion worker | `app/workers/champion_indexer.py`、feed cards、notifications | ✅ |

### Phase 6：Deferred（已完成）

| # | 任务 | 交付物 | 状态 |
|---|---|---|---|
| 6.1 | Reward payout 真实链上调用 | `app/clients/solana.py` 转账方法 + `reward_payout_service.py` 真实执行 | ✅ |
| 6.2 | Admin 运营能力增强 | `dashboard/cards`、`dashboard/trend/export` | ✅ |

**备注**：
- Reward payout 当前实现为原生 SOL 转账；若后续使用 SPL token，需替换为对应 token transfer。
- Champion program ID 未配置时，`champion_indexer` 会自动 idle。

---

## 5. 关键设计细节

### 5.1 签名验证设计

所有写操作端点应执行：

1. `SolanaClient.get_transaction(signature)` 获取交易
2. 检查 `meta.err is None`
3. 检查第一个 signer 是否是预期地址
4. 解析 instruction data，确认 `program_id` 正确
5. 确认 instruction discriminator 匹配预期操作
6. dispute bond 等场景还需解析 event log 核对参数

公共工具放在 `app/services/chain_parser.py`。

### 5.2 Indexer Cursor

NEW 已存在 `indexer_cursor` 表：

```sql
id          int PK
slot        bigint not null
signature   varchar(128) nullable
updated_at  timestamptz not null
```

与 OLD `(event_type, last_version, last_index)` 不同，NEW 设计为**单条全局游标**，用 `signature` 作为 `getSignaturesForAddress` 的 `until` 分页键，`slot` 作为元数据/监控用途。

`app/workers/indexer.py` 的 `IndexerCursor` 类负责读写该表。

### 5.3 Referral Reward 结算

- 触发：监听到 `MarketFinalized` 且 `platform_rake > 0`
- 计算：`reward = trade.amount * referral_reward_bps // 10000`
- 条件：invitee 有 inviter，且 `referrals.registered_at < trade.block_time`
- 幂等：`referral_rewards` 加 `UNIQUE(referral_id, market_id, tx_signature)`

### 5.4 Notification 生成

从 `chain_event_log` 生成 `Notification` 行，不再发 Luffa/SA：

| 事件 | 通知对象 |
|---|---|
| `BetPlaced` | market creator |
| `OutcomeProposed` | 持仓用户 |
| `MarketFinalized` | 持仓用户 |
| `DisputeFiled` | creator / 持仓用户 |
| `CreatorSlashed` | creator |

### 5.5 Config 分层

- **全局配置**：存在 `configs` 表
  - `platform_fee_bps/max`
  - `creator_reward_bps/max`
  - `creator_propose_timeout_seconds`
  - `dispute_window_seconds`
  - `admin_timeout_seconds`
  - `min_bet_micro_usdc`
  - `dispute_bond_micro_usdc`
  - `referral_reward_bps/max`
  - `expired_propose_mode`
  - `single_side_only`
  - `sponsor_flags`
  - `betting.*`
- **市场级配置**：存在 `markets` 表（snapshot）
  - 已有 7 个字段
  - 新增 `expired_propose_mode`、`single_side_only`

### 5.6 Indexer Handler 架构（学习 OLD）

与 OLD `v3_indexer.py` 一致，采用**两层处理**：

```
Solana tx
  → parse_transaction() 解析出 PolyMindEvent
  → 第一层：写入 chain_event_log（原始事件存档 + 去重锚点）
  → 第二层：dispatch 到业务 handler
       → EventCreated   → upsert events
       → MarketCreated  → upsert markets
       → Bet            → insert trades + update markets/positions
       → Finalized      → update markets
       → BondDeposited  → upsert disputes
```

**好处：**
- `chain_event_log` 是统一原始数据源，便于排查和回溯
- 业务 handler 可以独立失败/重试，不丢原始事件
- notification/referral worker 可以直接读 `chain_event_log`，不用重新解析链

### 5.7 幂等去重

`chain_event_log` 加唯一约束：

```sql
UNIQUE(signature, kind, event_index)
```

其中 `event_index` 是一笔交易内 PolyMind 事件出现的顺序下标（从 0 开始），防止同一笔 tx  emitting 多个同 kind 事件时丢失。

处理流程：
1. 先尝试 `INSERT INTO chain_event_log ... ON CONFLICT DO NOTHING`
2. 如果冲突（已处理过），跳过业务 handler
3. 业务表更新也用 UPSERT / ON CONFLICT，避免重复计算 pool

### 5.8 Cursor 策略

当前 parimutuel 模块使用**单条全局游标**：

```sql
SELECT signature, slot FROM indexer_cursor WHERE id = 1
```

未来加入 champion、reward_vault 等模块时，可以扩展为：

```sql
SELECT cursor_key, signature, slot FROM indexer_cursor
```

与 OLD 的 `(event_type, last_version, last_index)` 等价，只是把 `version` 换成 Solana 的 `slot/signature`。

---

## 6. 排除项说明

以下内容明确不迁移：

- `orders` 表（V2 CLOB 死代码）
- Luffa 钱包特定逻辑
- `gateway.py` 机器人
- Service Account 卡片推送
- `notify_cron.py` 的 Luffa/SA 投递逻辑
- `profit` / `best_trade` 排行榜

---

## 7. 风险与缓解

| 风险 | 缓解措施 |
|---|---|
| Python indexer 性能不足 | 先用，后续如成为瓶颈再切 Rust 或加缓存 |
| Solana RPC 延迟/失败 | 指数退避重试 + cursor 断点续传 |
| Program IDL 变更 | 版本化 event schema，变更时同步更新 parser |
| 双写竞争 | 所有 indexer 写操作幂等（UPSERT / ON CONFLICT） |

---

## 8. 目录结构

```
apps/api/
├── app/
│   ├── services/
│   │   └── chain_parser.py      # 共享链上解析模块（API + indexer 共用）
│   ├── workers/                 # 所有长期运行的轮询进程
│   │   ├── __init__.py
│   │   ├── indexer.py           # Solana 事件索引器
│   │   ├── referral_reward_worker.py
│   │   ├── notification_worker.py
│   │   └── deadline_cron.py
│   └── ...
└── scripts/                     # 一次性/开发脚本（如 seed.py）
```

保持扁平：所有轮询进程放在 `app/workers/`，不拆 `indexer/`、`cron/` 等子包。

---

## 9. 完成总结

Phase 0 ~ Phase 6 已全部完成：

- **Phase 0**：确认 Python indexer 方向，搭建 `app/workers/` 目录和 `chain_parser.py`。
- **Phase 1**：完整 Solana 事件索引器 + 所有业务 handler（event/market/bet/propose/finalize/claim/dispute）。
- **Phase 2**：修复全部 P0 安全问题（签名验证、PATCH status、audit log、admin 权限、batch transfer）。
- **Phase 3**：配置系统 + market stage 动态计算。
- **Phase 4**：referral reward / notification / deadline cron 三个 worker。
- **Phase 5**：Champion Module MVP（parser + indexer + campaigns router + notifications）。
- **Phase 6**：真实链上 reward payout + admin dashboard cards/export。

### 后续可选工作

1. **端到端测试**：在 Solana devnet 上跑一遍完整事件流。
2. **SPL token 支持**：若奖励代币不是原生 SOL，需替换 `send_native_transfer`。
3. **性能优化**：Champion / parimutuel indexer 可合并或改为 webhook。
4. **运营后台增强**：更多 admin dashboard cards、详情页、批量操作。
