# PolyMind `apps/api` Route 实现详细文档

> 本文档根据已批准的 router 迁移计划编制，目标是把旧 `api/` 和 `admin/backend/` 的通用业务功能迁移到新 Solana 架构下的 `apps/api`。
>
> 核心设计原则：
> - **Admin 不单独成域**：admin 操作挂在资源 router 下，通过 `require_permission` 区分。
> - **链上写操作按资源分端点**：如 `/api/v1/events/sync`、`/api/v1/trades/sync`。
> - **Python API Worker 监听链**：`app/workers/indexer.py` 轮询 Solana RPC、解析事件、写入 PostgreSQL；Web API 只做轻量确认和读查询。与旧 PolyMind 架构一致。
> - **不新增 Redis 等基础设施**：nonce、push、job queue 等先用 PostgreSQL，后续真有瓶颈再引入。

---

## 目录

1. [全局约定](#1-全局约定)
2. [认证与权限系统](#2-认证与权限系统)
3. [Router 实现详单](#3-router-实现详单)
4. [数据库迁移汇总](#4-数据库迁移汇总)
5. [实施阶段](#5-实施阶段)
6. [代码模板](#6-代码模板)
7. [测试与验证](#7-测试与验证)

---

## 1. 全局约定

### 1.1 响应格式

统一使用 `app/core/response.py`：

```python
{"ret": 200, "msg": "ok", "data": ...}       # 成功
{"ret": 400, "msg": "...", "data": ...}       # 业务错误
{"ret": 401, "msg": "...", "data": ...}       # 未认证
{"ret": 403, "msg": "...", "data": ...}       # 无权限
{"ret": 404, "msg": "...", "data": ...}       # 资源不存在
```

HTTP status code 由 `app.core.exceptions.APIError.status_code` 决定。

### 1.2 金额单位

- 数据库存 micro-token（USDC 为 6 位小数，SOL 为 9 位）。
- API 返回给前端统一用 token 单位（除以 `10^decimals`）。
- 当前 Phase 2 默认按 USDC 6 位小数处理；若后续支持多 token，在 `markets.token_mint` / `markets.token_decimals` 中体现。
- 建议加工具函数 `format_token_amount(micro: int, decimals: int = 6) -> float`。

### 1.3 时间格式

- 数据库：`datetime.datetime(UTC)`。
- API 输出：ISO 8601 字符串（`2026-07-09T12:34:56+00:00`）。
- API 输入：优先接收 ISO 8601 字符串，必要时接收 Unix 秒/毫秒（需在 DTO 中显式声明）。

### 1.4 分页

```python
{
  "items": [...],
  "total": 100,
  "page": 1,
  "limit": 24,
  "hasMore": true
}
```

默认 `page=1, limit=24, max_limit=100`。

### 1.5 排序

- 公开列表默认按 `pinned DESC, pinned_at DESC, created_at DESC`。
- Admin 列表默认按 `created_at DESC`，可通过 `sort` / `order` 参数覆盖。

### 1.6 地址处理

- Solana base58 地址直接以字符串存储，不做额外转换。
- Solana 地址本身就是 base58 编码的公钥，签名验证时可直接还原公钥。
- 所有 `user_address` / `creator_address` / `admin_address` 字段均为 base58 字符串。

---

## 2. 认证与权限系统

### 2.1 认证方式：SIWS（Sign In With Solana）

Phase 2 采用 SIWS 标准钱包登录：

```text
1. POST /api/v1/auth/nonce
   ← { nonce, message }

2. 前端钱包调用 solana:signIn 或 signMessage(message)
   → 得到 signature

3. POST /api/v1/auth/verify
   { address, nonce, signature, message }
   ← { token, expires_at }
```

SIWS message 格式示例：

```text
poly-mind.ai wants you to sign in with your Solana account:
GRzZ7B6ZzgU2TuvmTFhtPHbc98CScGLw6h5McTM4SXT5

URI: https://poly-mind.ai
Version: 1
Chain ID: devnet
Nonce: a1b2c3d4e5f67890
Issued At: 2026-07-09T12:00:00Z
Expiration Time: 2026-07-09T12:05:00Z
Statement: Sign in to PolyMind
```

后端验证：

```python
from solders.pubkey import Pubkey
from solders.signature import Signature

pubkey = Pubkey.from_string(address)
sig = Signature.from_bytes(bytes.fromhex(signature))
pubkey.verify_message(message.encode("utf-8"), sig)
```

### 2.2 Nonce 存储

不新增 Redis，使用 PostgreSQL `login_nonces` 表：

```python
class LoginNonce(Base):
    __tablename__ = "login_nonces"

    nonce: Mapped[str] = mapped_column(String(64), primary_key=True)
    address: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=now_utc, nullable=False
    )
```

消费 nonce 必须原子 UPDATE：

```python
result = await session.execute(
    update(LoginNonce)
    .where(
        LoginNonce.nonce == nonce,
        LoginNonce.address == address.lower(),
        LoginNonce.used == False,
        LoginNonce.expires_at > datetime.now(UTC),
    )
    .values(used=True)
)
await session.commit()
return result.rowcount == 1
```

过期 nonce 由定时任务或启动脚本清理。

### 2.3 Admin 认证

Admin 使用同样的 SIWS 流程，但：
- `Statement`: "Sign in to PolyMind Admin"
- `URI`: admin 面板域名
- verify 时额外检查地址是否在 `admin_accounts` 表

```text
POST /api/v1/auth/admin/nonce
POST /api/v1/auth/admin/verify
GET  /api/v1/auth/admin/me
```

### 2.4 JWT 设计

User JWT：
- Secret: `JWT_SECRET`
- Issuer: `polymind-api`
- Audience: `polymind-user`
- TTL: 7 天
- Payload 只含地址，不含 role/权限：
  ```json
  { "sub": "<address>", "iss": "polymind-api", "aud": "polymind-user", "iat": ..., "exp": ... }
  ```

Admin JWT：
- Secret: `ADMIN_JWT_SECRET`（必须与用户不同）
- Issuer: `polymind-api`
- Audience: `polymind-admin`
- TTL: 4 小时
- Payload 同样只含地址：
  ```json
  { "sub": "<address>", "iss": "polymind-api", "aud": "polymind-admin", "iat": ..., "exp": ... }
  ```

### 2.5 权限模型

每个 `AdminAccount` 有 `permissions: list[str]`，支持通配符 `"*"`。

权限字符串规范：

| 资源 | 权限 |
|---|---|
| admin_accounts | `admin_accounts:list`, `admin_accounts:create`, `admin_accounts:delete` |
| configs | `configs:list`, `configs:update` |
| users | `users:list`, `users:read`, `users:update` |
| events | `events:list`, `events:read`, `events:update`, `events:delete`, `events:draft` |
| markets | `markets:list`, `markets:read`, `markets:update`, `markets:finalize`, `markets:void` |
| trades | `trades:list` |
| disputes | `disputes:list`, `disputes:read`, `disputes:resolve` |
| tags | `tags:list`, `tags:create`, `tags:update`, `tags:delete` |
| activities | `activities:list`, `activities:create`, `activities:update`, `activities:delete` |
| media | `media:upload`, `media:list`, `media:delete` |
| push | `push:send`, `push:list` |
| dashboard | `dashboard:read` |
| reward_payouts | `reward_payouts:list`, `reward_payouts:create`, `reward_payouts:execute` |
| batch_transfers | `batch_transfers:list`, `batch_transfers:create`, `batch_transfers:execute` |

### 2.6 `require_permission` 实现

```python
# apps/api/app/dependencies/auth.py
from fastapi import Depends, Header
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import UnauthorizedError, ForbiddenError
from app.db.session import get_db
from app.models import AdminAccount


def require_permission(*permissions: str):
    async def _checker(
        authorization: str = Header(default=""),
        db: AsyncSession = Depends(get_db),
    ) -> AdminAccount:
        token = _extract_bearer(authorization)
        if not token:
            raise UnauthorizedError("Missing token")

        payload = _decode_admin_jwt(token)
        address = payload["sub"]

        result = await db.execute(
            select(AdminAccount).where(AdminAccount.address == address)
        )
        account = result.scalar_one_or_none()
        if not account:
            raise ForbiddenError("Admin account not found")

        perms = set(account.permissions or [])
        if "*" in perms:
            return account

        for p in permissions:
            if p not in perms:
                raise ForbiddenError(f"Missing permission: {p}")
        return account

    return _checker
```

**关键原则**：JWT 只证明地址完成过 admin 登录，权限每次请求查 DB，撤销即时生效。

### 2.7 开发环境兜底

```python
async def get_current_user(
    authorization: str = Header(default=""),
    x_wallet_address: str | None = Header(default=None, alias="X-Wallet-Address"),
    db: AsyncSession = Depends(get_db),
) -> User:
    if settings.debug and x_wallet_address:
        return await _get_or_create_user(db, x_wallet_address)

    token = _extract_bearer(authorization)
    payload = _decode_user_jwt(token)
    return await _get_or_create_user(db, payload["sub"])
```

**生产环境**：`X-Wallet-Address` 必须无效，严格走 JWT。

---

## 3. Router 实现详单

### 3.1 `routers/auth.py`

**文件：** `apps/api/app/routers/auth.py`

#### 端点

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| POST | `/api/v1/auth/nonce` | public | 获取 SIWS nonce |
| POST | `/api/v1/auth/verify` | public | 验证签名，返回 user JWT |
| GET | `/api/v1/auth/me` | authenticated | 当前用户基本信息 |
| POST | `/api/v1/auth/admin/nonce` | public | 获取 admin SIWS nonce |
| POST | `/api/v1/auth/admin/verify` | public | 验证 admin 签名，返回 admin JWT |
| GET | `/api/v1/auth/admin/me` | `admin:me` | 当前 admin 信息 |

#### DTO

```python
class NonceRequest(BaseModel):
    address: str = Field(..., min_length=32, max_length=44)

class NonceResponse(BaseModel):
    nonce: str
    message: str

class VerifyRequest(BaseModel):
    address: str = Field(..., min_length=32, max_length=44)
    nonce: str
    message: str
    signature: str = Field(..., min_length=64, max_length=256)

class VerifyResponse(BaseModel):
    token: str
    expires_at: int

class MeResponse(BaseModel):
    address: str
    nickname: str | None
    avatar: str | None
```

#### 实现要点

- nonce 5 分钟 TTL，一次性使用。
- message 严格遵循 SIWS 格式。
- admin verify 额外检查 `AdminAccount` 是否存在。

---

### 3.2 `routers/users.py`

**文件：** `apps/api/app/routers/users.py`

#### 端点

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| GET | `/api/v1/users` | `users:list` | 用户列表（admin） |
| GET | `/api/v1/users/{id_or_address}` | public / `users:read` | 用户详情（自查询或 admin） |
| PATCH | `/api/v1/users/{id_or_address}` | `users:update` | 修改用户（admin） |

#### 实现要点

- `GET /api/v1/users/{id_or_address}` 允许自查询（当前用户地址匹配）或 admin 查询。
- Admin 可传 `id` 或 `address`；公开查询只接受 `address`。
- 列表支持按 `address` / `nickname` 模糊搜索。

---

### 3.3 `routers/events.py`

**文件：** `apps/api/app/routers/events.py`

#### 端点

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| GET | `/api/v1/events` | public / `events:list` | 事件列表 |
| GET | `/api/v1/events/{slug}` | public / `events:read` | 事件详情 |
| POST | `/api/v1/events/draft` | authenticated | 创建事件草稿 |
| POST | `/api/v1/events/sync` | authenticated | 链上创建事件后同步 |
| PATCH | `/api/v1/events/{slug}` | `events:update` | admin 修改事件属性 |
| DELETE | `/api/v1/events/{slug}` | `events:delete` | admin 删除草稿事件 |

#### Query / DTO

```python
class EventDraftRequest(BaseModel):
    title: str = Field(..., max_length=512)
    description: str | None = None
    image_url: str | None = Field(None, max_length=1024)
    rules: str | None = None
    category_id: int | None = None

class EventSyncRequest(BaseModel):
    signature: str = Field(..., min_length=64, max_length=128)

class EventUpdateRequest(BaseModel):
    title: str | None = Field(None, max_length=512)
    description: str | None = None
    image_url: str | None = Field(None, max_length=1024)
    rules: str | None = None
    category_id: int | None = None
    status: str | None = Field(None, pattern="^(draft|open|closed|resolved|void)$")
    is_trending: bool | None = None
    is_flagged: bool | None = None
    can_share: bool | None = None
    can_bet: bool | None = None
    pinned: bool | None = None
    pinned_at: datetime | None = None
    deadline: datetime | None = None
```

#### 实现要点

- 公开列表默认不返回 `is_flagged=True` 的事件（admin 列表可返回）。
- `source` 枚举：`official`、`admin`、`user`、`champion`。
- `POST /events/draft` 写 `events.status = "draft"`。
- `POST /events/sync` 只确认 signature，真正写 `events` / `markets` 由 `app/workers/indexer.py` 完成；worker 成功后把同一 event 状态同步为 `open`。
- `DELETE` 仅允许删除 `status == "draft"` 或未上链的事件。
- Event status 由 indexer 根据子 market 状态物化更新，避免查询时推导。

---

### 3.4 `routers/markets.py`

**文件：** `apps/api/app/routers/markets.py`（在已有基础上扩展）

#### 端点

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| GET | `/api/v1/markets` | public / `markets:list` | 市场列表 |
| GET | `/api/v1/markets/{slug}` | public / `markets:read` | 市场详情 |
| GET | `/api/v1/markets/{slug}/config` | public | 市场配置快照 |
| POST | `/api/v1/markets/{slug}/propose` | authenticated | creator 提议结果 |
| POST | `/api/v1/markets/{slug}/finalize` | public / `markets:finalize` | 结算市场 |
| POST | `/api/v1/markets/{slug}/void` | `markets:void` | admin 紧急 VOID |
| PATCH | `/api/v1/markets/{slug}` | `markets:update` | admin 修改市场属性 |

#### 实现要点

- 删除现有的 `POST /api/v1/markets` 501 placeholder；市场创建通过 `/api/v1/events/sync` 触发。
- `markets.creator_address` 显式存储，propose 权限校验直接查 market 行。
- `propose` 校验当前用户是否为 market creator 且处于可提议窗口。
- `finalize` 任何人可调用，但需满足争议窗口已过且无活跃争议。
- `void` 为 admin 紧急操作，需链上 `emergency_void` tx signature。
- 所有写操作返回 `{"confirmed": bool, "signature": str}`，实际状态由 indexer 更新。

---

### 3.5 `routers/trades.py`

**文件：** `apps/api/app/routers/trades.py`

#### 端点

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| GET | `/api/v1/trades` | public / `trades:list` | 下注流水 |
| POST | `/api/v1/trades/sync` | authenticated | 链上下注后同步 |

#### 实现要点

- 列表公开查询仅返回已确认（slot 非空）的交易。
- Admin 可导出 CSV（调用 `csv_response`）。
- `sync` 确认 signature 是否达到 `confirmed` commitment。

---

### 3.6 `routers/positions.py`

**文件：** `apps/api/app/routers/positions.py`

#### 端点

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| GET | `/api/v1/markets/{slug}/claim-preview` | authenticated | 预览可领取金额 |
| POST | `/api/v1/markets/{slug}/claim` | authenticated | 链上 claim 后同步 |

#### DTO

```python
class ClaimPreviewResponse(BaseModel):
    market_id: str
    market_title: str
    principal: float        # 本金
    payout: float           # 毛赔付
    profit: float           # 利润
    platform_fee: float     # 平台费
    creator_fee: float      # 创建者奖励
    net_payout: float       # 净赔付
    outcome: str            # 已结算结果

class ClaimSyncRequest(BaseModel):
    signature: str = Field(..., min_length=64, max_length=128)
```

#### 实现要点

- 按 market slug 对前端更友好；内部按 `(market_id, user_address)` 查 position。
- `claim-preview` 仅在市场已 finalize 且用户有赢方可计算。
- 计算逻辑参考旧 PolyMind claim 公式，在 Python 中本地计算：
  - YES/NO 赢方：`payout = user_stake * distributable_pool / winning_pool`
  - VOID：`payout = principal + bonus_share`
  - `platform_fee = min(profit * fee_bps / 10000, fee_max)`
  - `creator_fee = min(profit * creator_bps / 10000, creator_max)`
- 加单元测试保证与 Rust 程序公式一致。

---

### 3.7 `routers/disputes.py`

**文件：** `apps/api/app/routers/disputes.py`

#### 端点

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| GET | `/api/v1/disputes` | public / `disputes:list` | 争议列表 |
| GET | `/api/v1/disputes/{id}` | public / `disputes:read` | 争议详情 |
| POST | `/api/v1/disputes` | authenticated | 提交争议 |
| POST | `/api/v1/disputes/{id}/resolve` | `disputes:resolve` | admin 裁决 |

#### 实现要点

- 提交争议需用户在该 market 有持仓。
- 首次 dispute 后 market `dispute_active=True`，且只能 admin finalize。
- Python worker 处理 `DisputeResolved` + `MarketFinalized` 时原子更新 dispute 行和 market 行。

---

### 3.8 `routers/profile.py`

**文件：** `apps/api/app/routers/profile.py`（在已有基础上扩展）

#### 端点

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| GET | `/api/v1/profile` | authenticated | 个人资料 |
| GET | `/api/v1/profile/rewards` | authenticated | 创建者奖励明细 |

#### 实现要点

- 创建者奖励从 `creator_rewards` ledger 表读取。
- `creator_rewards` 表由 indexer 在 market finalize 时写入 pending 记录；claim 后更新 status 和 tx signature。

---

### 3.9 `routers/referrals.py`

**文件：** `apps/api/app/routers/referrals.py`（在已有基础上扩展）

#### 端点

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| GET | `/api/v1/referrals` | authenticated | 邀请摘要 |
| GET | `/api/v1/referrals/code` | authenticated | 我的邀请码 |
| POST | `/api/v1/referrals/bind` | authenticated | 绑定邀请人 |
| GET | `/api/v1/referrals/rewards` | authenticated | 邀请奖励明细 |

#### 实现要点

- 邀请码使用确定性短码（如 address 前缀 + checksum），而非旧 memorable word。
- 绑定邀请人时检查：self-invite、already bound、cycle detection、max invitees limit。
- `User.inviter_id` 作为主关系 FK；`Referral` 表作为审计和奖励归因。
- 奖励由 indexer 在 market finalize 时按 config `referral_reward_bps` 计算并写入 `referral_rewards`。

---

### 3.10 `routers/admin_accounts.py`

同前文，保持不变。

---

### 3.11 `routers/configs.py`

**文件：** `apps/api/app/routers/configs.py`

#### 端点

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| GET | `/api/v1/configs` | public / `configs:list` | 公开配置列表 |
| GET | `/api/v1/configs/{key}` | public | 单个公开配置 |
| PATCH | `/api/v1/configs/{key}` | `configs:update` | 更新配置 |

#### 模型变更

```python
class Config(Base):
    ...
    is_public: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
```

#### 实现要点

- `Config.value` 为 JSONB，API 层保持原样读写。
- 公开接口只返回 `is_public=True` 的 key；敏感 key 必须 admin 权限。

---

### 3.12 `routers/tags.py`

同前文，保持不变。

---

### 3.13 `routers/activities.py`

同前文，字段 `tag` 建议改为 `tags: list[str]` JSONB。

---

### 3.14 `routers/media.py`

同前文，保持不变。

---

### 3.15 `routers/push.py`

**文件：** `apps/api/app/routers/push.py`

#### 实现要点

- `push_messages.status` 枚举：`pending` / `sent` / `failed`。
- 个人 push 通过 `recipient_address` 指定；broadcast 时 `recipient_address=None`。
- 发送时同时写 `Notification` 行（in-app push）。

---

### 3.16 `routers/dashboard.py`

**文件：** `apps/api/app/routers/dashboard.py`

#### 实现要点

- Dashboard 数据从预聚合表读取（如 `dashboard_stats`），不实时重 SQL 查询。
- 聚合由 indexer/cron 定期写入。
- `overview`：总用户数、总市场数、总下注额、总争议数、待处理争议数。
- `trend`：按日返回新增用户、新增市场、下注额、claim 额。

---

### 3.17 `routers/polymarket.py`

**文件：** `apps/api/app/routers/polymarket.py`

#### 实现要点

- 使用 `httpx` 封装 `app/clients/polymarket.py`。
- 直接代理 Polymarket Gamma / CLOB API，本地做 keyword / category 匹配。

---

### 3.18 `routers/chat.py`

**文件：** `apps/api/app/routers/chat.py`

#### 端点

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| POST | `/api/v1/chat` | authenticated | 发送消息 |
| GET | `/api/v1/chat/history` | authenticated | 历史记录 |
| POST | `/api/v1/chat/save` | authenticated | 保存消息 |
| DELETE | `/api/v1/chat/history` | authenticated | 清空历史 |

#### 实现要点

- 历史记录存 PostgreSQL `chat_messages` 表，不使用 SQLite。
- 不需要 `chat:use` admin 权限，普通认证即可。

---

### 3.19 `routers/share.py`

**文件：** `apps/api/app/routers/share.py`

#### 端点

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| GET | `/api/v1/share/{slug}.png` | public | 事件分享卡片 PNG |
| GET | `/api/v1/share/invite/{code}` | public | 邀请落地页 HTML |

#### 实现要点

- MVP 用 Pillow 同步生成简单 PNG。
- 后续改为异步生成 + 上传对象存储/CDN，HTTP 返回 URL。
- 邀请落地页返回带 Open Graph meta 的 HTML。

---

### 3.20 `routers/reward_payouts.py` 与 `batch_transfers.py`

#### 实现要点

- 改为 job queue 模式：创建任务 → worker 异步执行链上转账 → 更新状态。
- 不再在 HTTP handler 里同步调链或 `asyncio.run(...)`。
- 任务状态：`pending` / `running` / `completed` / `failed`。

---

## 4. 数据库迁移汇总

### 4.1 模型字段扩展

| 表 | 变更 |
|---|---|
| `tags` | 新增 `sort_order`, `is_active`, `is_pinned` |
| `admin_accounts` | 新增 `label`, `added_by` |
| `configs` | 新增 `is_public` |
| `markets` | 新增 `creator_address`, `creator_performed`, `platform_rake`, `creator_reward`, `distributable_pool` |
| `events` | `status` 支持 `draft` |

### 4.2 新建表

| 表 | 用途 |
|---|---|
| `login_nonces` | SIWS nonce 存储（一次性，TTL 5 分钟） |
| `creator_rewards` | 创建者奖励 ledger |
| `activities` | banner/activity CMS |
| `media_images` | 图片资源管理 |
| `push_messages` | push 发送历史 |
| `chat_messages` | AI chat 历史 |

### 4.3 Alembic 命令

```bash
cd apps/api
uv run alembic revision -m "add auth nonce creator rewards and admin resource tables"
# 手动调整生成的 migration，确保 PostgreSQL JSONB 和索引正确
uv run alembic upgrade head
```

---

## 5. 实施阶段

### Phase 0：基础改造（必须先完成）

1. 实现 `app/dependencies/auth.py`：
   - SIWS nonce 生成/消费
   - User JWT 解码
   - Admin JWT 解码
   - `require_permission` 查 `AdminAccount.permissions`
   - `get_current_user_optional`
2. 新增 `app/models/login_nonce.py` 和 `app/models/creator_reward.py`。
3. 新增 `app/utils/export_csv.py`（从旧项目复用）。
4. 配置 `.env.example` 和 `app/core/config.py`：
   - `JWT_SECRET`
   - `ADMIN_JWT_SECRET`
   - `NONCE_TTL_SECONDS`
   - `BACKEND_ADMIN_BOOTSTRAP`
5. 生成 Alembic migration：
   - `login_nonces` 表
   - `creator_rewards` 表
   - `Config.is_public`
   - `Market.creator_address` 等字段
   - tag/admin_account 字段扩展

### Phase 1：核心预测市场读 API

1. 实现 `routers/events.py`（公开列表/详情/draft/sync + admin 操作）。
2. 扩展 `routers/markets.py`（admin 操作、config、propose/finalize/void stub）。
   - 删除 `POST /api/v1/markets` 501 placeholder。
3. 实现 `routers/trades.py`（流水 + sync stub）。
4. 实现 `routers/disputes.py`（列表/详情 + sync/resolve stub）。
5. 实现 `routers/positions.py`（market-based claim preview + sync stub）。
6. 实现 `routers/admin_accounts.py` + `routers/configs.py`。

### Phase 2：用户与增长

1. 扩展 `routers/users.py` + `routers/profile.py`（含 creator rewards）。
2. 扩展 `routers/referrals.py`（绑定、奖励明细、确定性邀请码）。
3. 扩展 `routers/notifications.py`（通知生成改为读 `Notification` 表）。

### Phase 3：Admin 运营

1. 实现 `routers/tags.py`。
2. 实现 `routers/activities.py` + `media.py`。
3. 实现 `routers/push.py`。
4. 实现 `routers/dashboard.py`（基于预聚合表）。

### Phase 4：辅助功能

1. 实现 `routers/polymarket.py`（httpx client）。
2. 实现 `routers/chat.py`（PostgreSQL 历史）。
3. 实现 `routers/share.py`（Pillow MVP，预留 async worker）。
4. 实现 `routers/reward_payouts.py` + `batch_transfers.py`（job queue）。

### Phase 5：链上闭环

1. Solana 程序 IDL / PDA 确定后，补全各 sync 端点的真实校验。
2. Python worker 业务解析完成后，验证 DB 写入正确性。
3. 联调前端写链 → sync → 读 API 完整流程。

---

## 6. 代码模板

### 6.1 新 Router 模板

```python
# apps/api/app/routers/xxx.py
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.response import success
from app.db.session import get_db
from app.dependencies.auth import get_current_user, require_permission
from app.models import User
from app.services.xxx_service import XxxService, get_xxx_service

router = APIRouter(prefix="/api/v1/xxx", tags=["xxx"])


@router.get("")
async def list_xxx(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=24, ge=1, le=100),
    svc: XxxService = Depends(get_xxx_service),
):
    data = await svc.list_xxx(page=page, limit=limit)
    return success(data=data)


@router.post("", dependencies=[Depends(require_permission("xxx:create"))])
async def create_xxx(
    body: XxxCreateRequest,
    account: AdminAccount = Depends(require_permission("xxx:create")),
    svc: XxxService = Depends(get_xxx_service),
):
    data = await svc.create_xxx(body, account.address)
    return success(data=data)
```

### 6.2 Service 模板

```python
# apps/api/app/services/xxx_service.py
from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db


class XxxService:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def list_xxx(self, *, page: int, limit: int) -> dict:
        ...
        return {"items": [], "total": 0, "page": page, "limit": limit, "hasMore": False}


def get_xxx_service(db: AsyncSession = Depends(get_db)) -> XxxService:
    return XxxService(db)
```

### 6.3 Admin + Public 同 Router 模板

```python
from app.dependencies.auth import get_current_user_optional

@router.get("")
async def list_events(
    is_admin_view: bool = Query(default=False),
    current_user: User | None = Depends(get_current_user_optional),
    svc: EventService = Depends(get_event_service),
):
    if is_admin_view:
        account = await require_permission("events:list")(...)
        data = await svc.list_events_for_admin()
    else:
        data = await svc.list_events_for_public()
    return success(data=data)
```

---

## 7. 测试与验证

### 7.1 静态检查

```bash
cd apps/api
uv run ruff check app
uv run ruff format app
uv run pyright app
```

### 7.2 数据库迁移

```bash
uv run alembic upgrade head
```

### 7.3 单元测试

每个 router 对应一个测试文件：

```
apps/api/tests/routers/test_auth.py
apps/api/tests/routers/test_events.py
apps/api/tests/routers/test_markets.py
apps/api/tests/routers/test_trades.py
apps/api/tests/routers/test_disputes.py
...
```

### 7.4 手动验证清单

| 端点 | 验证内容 |
|---|---|
| `GET /api/v1/health` | 服务启动 |
| `POST /api/v1/auth/nonce` | SIWS nonce 返回 |
| `POST /api/v1/auth/admin/verify` | admin JWT 签发 |
| `GET /api/v1/admin-accounts` | admin 权限校验 |
| `GET /api/v1/events` | 公开事件列表 |
| `POST /api/v1/events/draft` | 草稿创建 |
| `PATCH /api/v1/events/{slug}` | admin 修改事件 |
| `GET /api/v1/markets` | 市场列表 |
| `POST /api/v1/trades/sync` | 交易同步 stub |
| `GET /api/v1/dashboard/overview` | dashboard 数据 |

---

## 附录 A：旧端点 → 新端点快速对照

| 旧端点 | 新端点 | 备注 |
|---|---|---|
| `POST /api/v1/event/draft` | `POST /api/v1/events/draft` | 新架构 first-class 草稿 |
| `POST /api/v1/event/sync` | `POST /api/v1/events/sync` | 仅确认，indexer 写库 |
| `POST /api/v1/event/place-sync` | `POST /api/v1/trades/sync` | |
| `GET /api/v1/event/v3/claim-preview` | `GET /api/v1/markets/{slug}/claim-preview` | 按 market slug |
| `POST /api/v1/rewards/claim-sync` | `POST /api/v1/markets/{slug}/claim` | 按 market slug |
| `POST /api/v1/dispute/file` | `POST /api/v1/disputes` | |
| `GET /api/v1/dispute/list` | `GET /api/v1/disputes` | |
| `POST /api/v1/admin/dispute/resolve` | `POST /api/v1/disputes/{id}/resolve` | |
| `POST /api/v1/admin/market/finalize` | `POST /api/v1/markets/{slug}/finalize` | |
| `GET /api/v1/user/me` | `GET /api/v1/auth/me` | |
| `GET /api/v1/user/creator-reward-history` | `GET /api/v1/profile/rewards` | 新 creator_rewards 表 |
| `GET /api/v1/user/invite/code` | `GET /api/v1/referrals/code` | 确定性短码 |
| `POST /api/v1/user/invite/bind` | `POST /api/v1/referrals/bind` | |
| `GET /admin/v1/users` | `GET /api/v1/users` | 需 `users:list` |
| `GET /admin/v1/events` | `GET /api/v1/events` | 需 `events:list` |
| `GET /admin/v1/markets` | `GET /api/v1/markets` | 需 `markets:list` |
| `GET /admin/v1/tags` | `GET /api/v1/tags` | 需 `tags:list` |
| `POST /admin/v1/activities` | `POST /api/v1/activities` | 需 `activities:create` |
| `POST /admin/v1/media/upload` | `POST /api/v1/media/upload` | 需 `media:upload` |
| `POST /admin/v1/push/send` | `POST /api/v1/push` | 需 `push:send` |
| `GET /admin/v1/dashboard/stats` | `GET /api/v1/dashboard/overview` | 需 `dashboard:read` |
