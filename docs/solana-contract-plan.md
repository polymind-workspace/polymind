# PolyMind Solana/Anchor 合约实现计划

> 本计划对照旧 Endless/Move 合约系统（`smart-contract/`），明确新 Solana 链上需要实现的内容，以满足 `apps/api`、`apps/admin`、`apps/web` 的端到端需求。

---

## 一、现状结论

- 当前 `polymind/polymind/solana/programs/polymind` 已实现一个最小 Hello World counter（`initialize` + `increment`），作为 Anchor 编译、部署和本地 validator 的基线验证。
- 旧 Move 合约已完整实现 `market`、`dispute`、`admin`、`reward_vault`、`champion`、`adminevent`、`payouts`、`subscription` 八大模块。
- `apps/api` 已预留好 indexer、parser、router，等待真实的 Solana 指令、事件和 PDA。
- 必须同步更新 `apps/api/app/services/chain_parser.py` / `champion_parser.py` 的 discriminators、Borsh 解码和 IDL。

---

## 二、整体决策（已确认）

| 决策项 | 确认结论 |
|---|---|
| 程序拆分 | 两个 Anchor 程序：`polymind`（主预测市场）+ `polymind_champion`（冠军赛）。Champion 延后到 Phase 3。 |
| 代币 | 统一代币，精度由全局 `TOKEN_DECIMALS` / `TOKEN_MINT` 抽象，默认 USDC（6 位）。 |
| Gasless | **MVP 必须支持 gasless 下注**。Solana 上通过 relayer/fee-payer 模式实现，程序层面不区分 sponsored/non-sponsored，只校验真实 authority 签名。 |
| Admin | 权限模型按新 `apps/admin` 设计，程序自身维护 admin/creator/distributor list。旧 `admin/` 是独立历史项目，不处理。 |
| Event ID | 全局自增 `EventCounter` PDA，避免调用方指定。 |
| 争议 | 每个 `Market` 内置 `is_disputed: bool`，一旦置 true 永久禁止 `finalize_proposed`。 |
| Vault | 每个 Market 一个 SPL ATA，authority 为 Market PDA；平台费和 creator reward 各一个聚合 treasury ATA。 |
| 初始化 | 使用显式 `initialize` 创建 `Config` PDA，而非懒加载。权限清晰，适合含 admin/treasury/fee 等敏感配置的程序。 |

---

## 二点一、关于 `initialize` 与部署/本地开发

### 2.1.1 为什么用显式 `initialize` 而不是懒加载？

`initialize` 负责创建程序的**全局配置账户** `Config`，写入初始 admin 列表、treasury 地址、平台费率等全局参数。显式初始化优于懒加载的原因：

| 对比 | 懒加载 | 显式 `initialize` |
|---|---|---|
| 权限 | 第一个触发者创建 Config，存在恶意初始化风险 | 只有部署者/指定 payer 能创建，权限可控 |
| Gas | 首次交互用户额外承担创建费用 | 部署者单独承担初始化费用 |
| 代码复杂度 | 每个指令都需判断 Config 是否存在 | 直接读取 Config，逻辑更干净 |
| 安全审计 | 难审计 | 权限清晰，审计友好 |

因此，对于含 admin、treasury、fee 等敏感配置的预测市场程序，**显式 `initialize` 是标准做法**。

### 2.1.2 localnet 与 devnet 的部署差异

| 操作 | devnet | localnet（`solana-test-validator`） |
|---|---|---|
| 部署合约 | 一次 | 每次重启 validator 都需重新部署 |
| `initialize` 创建 Config | 一次 | 每次重启 validator 都需重新初始化 |
| 日常交易状态 | 持久保存 | 重启后清空 |

**注意**：`initialize` 不是为了 localnet 才存在的；在 devnet 上同样需要调用一次。只是 localnet 状态不持久，所以 `./dev.sh local` 必须自动完成「启动 validator → 部署合约 → initialize → 启动服务」整条流水线。

### 2.1.3 本地一键启动

项目根目录 `dev.sh` 已支持：

```bash
./dev.sh        # 默认 localnet
./dev.sh local  # 同上
./dev.sh dev    # devnet（需网络可访问）
```

`./dev.sh local` 会自动：
1. 启动 PostgreSQL（Docker Compose）
2. 启动 `solana-test-validator`
3. 部署 `polymind` 程序到 localnet
4. 运行 Alembic 迁移
5. 启动 API、workers、web、admin

当前 Hello World counter 不需要额外的初始化脚本。后续实现带 `Config` PDA 的 `initialize` 指令后，再按需在 `dev.sh` 或部署文档中加入自动初始化调用。


### 3.1 Parimutuel 程序

| Account | Seeds | 说明 |
|---|---|---|
| `Config` | `["config"]` | 全局配置、admin/creator/distributor 列表、暂停开关、treasury 地址。 |
| `EventCounter` | `["event_counter"]` | 自增 event_id。 |
| `Event` | `["event", event_id.to_le_bytes()]` | Event 元数据：creator、question、description、created_at。 |
| `Market` | `["market", event_id.to_le_bytes(), market_idx.to_le_bytes()]` | 市场状态、pool、配置快照、`is_disputed`、`finalized_outcome` 等。 |
| `Position` | `["position", event_id.to_le_bytes(), market_idx.to_le_bytes(), user.key()]` | 每个用户每个 market 一个，聚合 `yes_amount` / `no_amount` / `claimed`。 |
| `MarketVault` | 每个 Market 一个 ATA，authority = Market PDA | 持有该市场用户存款的 token。 |
| `PlatformTreasury` | `["treasury", "platform"]` | 平台手续费 ATA。 |
| `CreatorRewards` | `["creator_rewards", creator.key()]` | 每个 creator 一个 ATA，累计未领取奖励。 |

### 3.2 Champion 程序（Phase 3）

| Account | Seeds | 说明 |
|---|---|---|
| `ChampionConfig` | `["config"]` | Admin 列表、vault 地址。 |
| `Campaign` | `["campaign", campaign_id.as_bytes()]` | Campaign 元数据、选项、pool、状态。 |
| `CampaignPosition` | `["position", campaign_id.as_bytes(), user.key()]` | 每个用户每个 campaign 一个。 |
| `CampaignVault` | 每个 Campaign 一个 ATA，authority = Campaign PDA | 持有 campaign 资金。 |

---

## 四、Phase 1 — P0 核心预测市场

### 4.1 目标

让用户能完成 `create event → bet → propose → finalize → claim`，admin 能完成 `admin_finalize` 和 `dispute resolve`。

### 4.2 必须实现的指令与事件

#### Admin 模块

| Move 来源 | Solana Instruction | 事件 | 说明 |
|---|---|---|---|
| `admin.move` | `initialize` | — | 初始化 Config、角色列表、treasury。 |
| `admin.move` | `add_admin` / `remove_admin` | `AdminAdded` / `AdminRemoved` | admin 列表管理。 |
| `admin.move` | `add_creator` / `remove_creator` | `CreatorAdded` / `CreatorRemoved` | creator 白名单（若启用）。 |
| `admin.move` | `add_distributor` / `remove_distributor` | `DistributorAdded` / `DistributorRemoved` | 平台提现权限。 |

#### Market 核心模块

| Move 来源 | Solana Instruction | 事件 | 对应 API / 前端 |
|---|---|---|---|
| `market.move` | `create_event_with_market` | `EventCreated`, `MarketCreated` | `POST /events/sync`、事件列表 |
| `market.move` | `add_market` | `MarketCreated` | 多 market 事件 |
| `market.move` | `bet` | `Bet` | `POST /trades/sync`、下注 |
| `market.move` | `propose_outcome` | `OutcomeProposed` | market 提案 |
| `market.move` | `finalize_proposed` | `Finalized` (path=1) | market 结算 |
| `market.move` | `admin_finalize` | `Finalized` (path=2) | admin 强制结算 |
| `market.move` | `claim` | `Claimed` | 用户 claim |

#### Dispute 模块

| Move 来源 | Solana Instruction | 事件 | 对应 API / 前端 |
|---|---|---|---|
| `dispute.move` | `file_dispute` | `BondDeposited`, `DisputeActiveSet` | 提交争议 |
| `dispute.move` | `admin_resolve` | `DisputeResolved`, `Finalized` (path=2) | admin 裁决 |

### 4.3 Gasless 支持

Solana 没有 Move 的 `sponsored` 关键字。MVP 的 gasless 通过**交易级 fee payer** 实现：

- 交易包含两个 signer：真实用户（authority）+ relayer（fee payer）。
- 程序只校验真实用户的签名和权限，不 care 谁付 gas。
- 因此程序不需要 `bet_sponsored` 等单独指令；前端/relayer 层负责构造双签交易。
- 若后续需要更复杂的代付逻辑（如 relayer 白名单），可在 Config 中加 `approved_relayers` list。

### 4.4 业务规则（严格对齐 Move）

#### 枚举与常量

```rust
const SIDE_YES: u8 = 0;
const SIDE_NO: u8 = 1;

const OUTCOME_NONE: u8 = 0;
const OUTCOME_YES: u8 = 1;
const OUTCOME_NO: u8 = 2;
const OUTCOME_VOID: u8 = 3;

const MODE_PARTICIPANT_TAKEOVER: u8 = 0;
const MODE_EXPIRE_AND_SLASH: u8 = 1;

const FINALIZE_PATH_FINALIZE_PROPOSED: u8 = 1;
const FINALIZE_PATH_ADMIN_FINALIZE: u8 = 2;
const FINALIZE_PATH_EMERGENCY_VOID: u8 = 3;
const FINALIZE_PATH_CREATOR_EXPIRED: u8 = 4;
const FINALIZE_PATH_CREATOR_SOLO_VOID: u8 = 5;
const FINALIZE_PATH_SOLE_PARTICIPANT_VOID: u8 = 6;
const FINALIZE_PATH_NO_OPPOSITION_VOID: u8 = 7;
```

#### 下注

- `now < deadline`
- `amount >= min_bet`（Market 配置快照）
- `single_side_only` 为 true 时，用户不能同时持有 YES 和 NO 仓位

#### 提案

- Creator 提案窗口：`deadline <= now < deadline + creator_propose_timeout_secs`
- 过期模式 0（takeover）：窗口后任何参与者可提案
- 过期模式 1（slash）：窗口后只能 `expire_unproposed` → VOID

#### Slash 与自动 VOID

- 非 creator 提案或 `expire_unproposed` 触发 slash：creator 的 yes+no 本金移入 `bonus_pool`
- creator position 标记为 claimed
- slash 后若 `yes_pool == 0 || no_pool == 0` → 自动 VOID

#### Rake

- 非 VOID 时：
  - `platform_fee = min(profit * platform_fee_bps / 10000, platform_fee_max)`
  - `creator_reward = min(profit * creator_reward_bps / 10000, creator_reward_max)`（仅当 creator 提案且结果一致）
- 从总池扣除后，剩余为 `distributable_pool`

#### Claim 数学

- YES/NO 赢方：`payout = stake_on_winning_side * distributable_pool / winner_pool`
- VOID：`payout = principal + principal * bonus_pool / (yes_pool + no_pool)`

#### 争议 Trapdoor

- `file_dispute` 将 `Market.is_disputed = true`
- `is_disputed == true` 时，`finalize_proposed` 永远拒绝
- 只能通过 `admin_finalize` 或 `emergency_void` 关闭

### 4.5 事件 Payload 规范

需与 `apps/api/app/services/chain_parser.py` 中的 dataclass 字段完全一致：

| Event | Fields |
|---|---|
| `EventCreated` | `event_id: u64`, `creator: Pubkey`, `question: String` |
| `MarketCreated` | `event_id: u64`, `market_idx: u64`, `title: String`, `deadline: i64`, `seed_side: u8`, `seed_amount: u64`, `external_source: u8`, `external_market_id: String`, `external_aux_id: u64` |
| `Bet` | `event_id: u64`, `market_idx: u64`, `user: Pubkey`, `side: u8`, `amount: u64`, `new_yes_pool: u64`, `new_no_pool: u64` |
| `OutcomeProposed` | `event_id: u64`, `market_idx: u64`, `outcome: u8`, `proposed_by: Pubkey`, `proposed_at: i64` |
| `DisputeActiveSet` | `event_id: u64`, `market_idx: u64`, `active: bool` |
| `Finalized` | `event_id: u64`, `market_idx: u64`, `outcome: u8`, `path: u8`, `finalized_at: i64`, `admin_reason: String`, `creator_performed: bool`, `platform_rake: u64`, `creator_reward: u64`, `distributable_pool: u64` |
| `Claimed` | `event_id: u64`, `market_idx: u64`, `user: Pubkey`, `outcome: u8`, `payout: u64` |
| `CreatorSlashed` | `event_id: u64`, `market_idx: u64`, `creator: Pubkey`, `amount: u64` |
| `BondDeposited` | `event_id: u64`, `market_idx: u64`, `disputer: Pubkey`, `amount: u64`, `claimed_outcome: u8`, `reason: String` |
| `DisputeResolved` | `event_id: u64`, `market_idx: u64`, `disputer: Pubkey`, `resolved_outcome: u8`, `admin_reason: String`, `refunded: bool`, `amount: u64` |
| `BondRefunded` | `event_id: u64`, `market_idx: u64`, `disputer: Pubkey`, `amount: u64` |
| `BondSlashed` | `event_id: u64`, `market_idx: u64`, `disputer: Pubkey`, `amount: u64` |

### 4.6 API / IDL 同步

1. `anchor build` 生成：
   - `target/idl/polymind.json`
   - `target/types/polymind.ts`
2. 复制到：
   - `apps/api/idl/polymind.json`
   - `apps/admin/src/idl/polymind.json`（若前端需要）
3. 用真实 discriminator 替换 `chain_parser.py` 中的占位符。
4. 实现 `chain_parser.py` 中的真实 Borsh 解码 TODO。
5. 更新 `apps/api/app/core/config.py` 中的 program ID。

### 4.7 Phase 1 验收标准

- [ ] `cargo test` 和 `anchor test` 通过。
- [ ] 每个 instruction 至少一个测试：happy path + 主要异常分支。
- [ ] 重点测试：rake 数学、claim payout、dispute 后 `finalize_proposed` 被拒绝、过期 slash。
- [ ] 完整 happy path：`create → bet → propose → finalize → claim`，indexer 正确写入所有业务表。
- [ ] Dispute path：`file_dispute → admin_resolve` 完整跑通。
- [ ] Gasless：relayer 作为 fee payer 的双签交易能成功下注。

---

## 五、Phase 2 — P1 运营 / 财务 / 异常处理

### 5.1 指令与事件

| Move 来源 | Solana Instruction | 事件 | 说明 |
|---|---|---|---|
| `market.move` | `update_config` | `ConfigUpdated` | 修改全局配置 |
| `market.move` | `update_sponsor_flags` | `SponsorFlagsUpdated` | 赞助开关（relayer 白名单等） |
| `market.move` | `set_min_bet` | `MinBetUpdated` | 全局最小下注 |
| `market.move` | `emergency_void` | `Finalized` (path=3) | admin timeout 后任何人可 VOID |
| `market.move` | `expire_unproposed` | `Finalized` (path=4) + `CreatorSlashed` | 过期 slash/VOID |
| `market.move` | `void_sole_participant` | `Finalized` (path=5/6) | 唯一参与者自救 |
| `market.move` | `void_no_opposition` | `Finalized` (path=7) | 无对家自动 VOID |
| `market.move` | `admin_void_open` / `admin_void_open_batch` | `Finalized` | admin 批量 VOID |
| `market.move` | `admin_refund_batch` | — | admin 批量退款 |
| `market.move` | `withdraw_platform_balance` | `PlatformRakeWithdrawn` | distributor 提现平台费 |
| `market.move` | `claim_creator_reward` | `CreatorRewardClaimed` | creator 领取奖励 |
| `dispute.move` | `update_bond_amount` | `BondAmountUpdated` | 修改争议 bond |
| `dispute.move` | `refund_bond` | `BondRefunded` | 手动退还 bond |
| `dispute.move` | `slash_bond` | `BondSlashed` | 手动罚没 bond |

### 5.2 reward_vault 取舍

当前 API 走 `POST /reward-payouts` + treasury 直接转账，不需要用户主动 claim。因此：
- **MVP 暂不实现** `reward_vault`。
- 若 admin 后台后续需要“创建-充值-用户 claim”模式，再按 Move 的 `reward_vault.move` 实现。

### 5.3 Phase 2 验收标准

- [ ] 所有异常 void 路径有 Anchor tests。
- [ ] admin 配置 / 提现 / 奖励指令有测试。
- [ ] 平台 rake 和 creator reward 的累计、提现数学正确。

---

## 六、Phase 3 — P2 扩展功能

| Move 来源 | 功能 | 状态 | 计划 |
|---|---|---|---|
| `champion.move` | N 选 campaigns、下注、结算、派奖 | API 已就绪，链上无实现 | **Phase 3 优先** |
| `adminevent.move` | Admin Q&A 事件 | admin 页面已注释，API stub | 按需 |
| `payouts.move` | 排行榜赛季 / 补贴活动 | 未接入 | 按需 |
| `subscription.move` | Pro 订阅 | 未接入 | 按需 |
| 所有 `*_sponsored` | 代付 gas | 已通过 fee payer 覆盖 betting | 其他指令如需 gasless，同理扩展 relayer 支持 |

### 6.1 Champion 程序

- 独立 program ID：`SOLANA_CHAMPION_PROGRAM_ID`
- PDA：`Campaign ["campaign", campaign_id]`、`CampaignPosition ["position", campaign_id, user.key()]`
- 事件：`CampaignCreated`、`CampaignUpdated`、`CampaignFinalized`、`CampaignCancelled`、`BetPlaced`、`Paid`
- 事件字段与 `champion_parser.py` 完全一致
- 金额精度随全局 `TOKEN_DECIMALS`

### 6.2 Phase 3 验收标准

- [ ] Champion 程序的 create → bet → finalize → claim 跑通。
- [ ] `champion_indexer` 正确写入 `chain_event_log`。
- [ ] `campaigns.py` 的金额除法与 `TOKEN_DECIMALS` 一致。

---

## 七、关键风险

1. **数学一致性**：rake / claim 公式必须和 Move 完全一致，否则前端 preview 与链上结果不符。
2. **事件字段对齐**：程序 build 后立刻回填 `chain_parser.py` discriminators 并跑 indexer。
3. **Authority 顺序**：API 把交易第一个 signer 当操作人，合约应保证 creator/admin/claimer 签名正确。
4. **Token Account 初始化**：market vault、treasury、creator rewards 的 ATA 在首次使用时通过 CPI 初始化。
5. **PDA seeds 稳定**：一旦确定不可再变。
6. **精度切换**：通过 `TOKEN_DECIMALS` 抽象层避免硬编码 1e6 / 1e8。
7. **Gasless 安全**：relayer 只能代付 gas，不能代替用户签名；程序必须校验真实 authority。

---

## 八、下一步行动

1. **评审 Phase 0 决策**：确认 PDA seeds、代币、`TOKEN_DECIMALS`、gasless 方案。
2. **实现最小闭环**：`create_event_with_market` → `bet`（含 gasless）→ `propose_outcome` → `finalize_proposed` → `claim`。
3. **每完成一个指令同步更新**：IDL → `chain_parser.py` → 跑 indexer。
4. **补 dispute / admin_finalize**。
5. **补 Phase 2 异常路径和 admin 财务功能**。
6. **最后实现 Champion 程序**。

---

## 九、待确认内容（已部分确认，待最终拍板）

| 序号 | 内容 | 当前状态 |
|---|---|---|
| 1 | 代币品种最终确认（默认 USDC，但需团队拍板） | 待确认 |
| 2 | `TOKEN_DECIMALS` 抽象方案是否接受 | 待确认 |
| 3 | Gasless 是否仅限 `bet`，还是 `propose`/`finalize`/`claim` 也要支持 | 待确认 |
| 4 | Champion 程序是否一定独立部署（已倾向独立） | 待确认 |
| 5 | reward_vault 是否完全放弃，还是保留占位 | 待确认 |
| 6 | Creator 白名单是否启用（旧 Move 有 creator registry，新系统可简化） | 待确认 |
