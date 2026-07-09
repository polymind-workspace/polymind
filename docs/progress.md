# PolyMind 第一阶段进展

> 最后更新：2026-07-08

## 总体状态

第一阶段核心目标已达成：`apps/web` 已搭好 TanStack Start + shadcn/ui + Tailwind v4 + i18n 骨架，UI 布局参考 Polymarket，功能范围保持与 superbox 一致，所有页面先用 mock 数据跑通。后端已完成 PostgreSQL 切换，前端钱包已迁移到 `@solana/react-hooks`。

完整架构设计见 `docs/architecture.md`。

---

## 已完成

### 项目骨架
- [x] `pnpm-workspace.yaml` + `package.json` 根工作区
- [x] `apps/web`：TanStack Start + Vite + React 19 + TypeScript
- [x] `apps/api`：FastAPI + SQLAlchemy 2.0 (async) + Alembic 标准骨架，PostgreSQL 默认
- [x] 根目录 `.env.example`（唯一模板）+ `.env` 本地配置
- [x] `apps/api/app/core/config.py` 读取根目录 `.env`，支持 `cd apps/api` 单独启动
- [x] `apps/web/vite.config.ts` 设置 `envDir: '../..'`，支持 `cd apps/web` 单独启动读取根目录 `.env`
- [x] `apps/admin/package.json` 使用 `dotenv-cli` 加载根目录 `.env`，支持 `cd apps/admin` 单独启动
- [x] `docker-compose.yml`（PostgreSQL 18，本机端口 5433）
- [x] `apps/api/alembic` 初始迁移已生成并验证通过
- [x] `apps/admin`：Ant Design Pro + umi/max 管理后台
- [x] 根目录 `dev.sh` 一键启动 web + admin + api + Python workers
- [x] 端口选为 `3100/8300`，避免与 repurposer 冲突
- [x] `solana/` 目录规划在根目录（Anchor 程序）

### 前端依赖与配置
- [x] shadcn/ui (base-ui) 组件库
- [x] Tailwind CSS v4 + 自定义语义变量（`--yes` / `--no`）
- [x] i18next（zh / en），key 覆盖 market / wallet / predictions / leaderboard / notifications / profile / header / invite
- [x] `@solana/react-hooks` + `@solana/client` + `@solana/kit` 钱包封装

### 页面与组件
- [x] 顶部导航：Logo / 搜索 / 玩法介绍 / 登录 / 资产组合 / 现金 / 充值 / 通知 / 头像下拉菜单
- [x] 汉堡菜单（NavMenu）：首页 / 通知 / 排行榜 / 个人中心 / 我的预测
- [x] 首页：分类 tab + 标签筛选 + 精选大卡 + 紧凑卡片网格 + 右侧边栏
- [x] 市场详情页：标题、概率、押注面板、活动 feed、相关市场
- [x] 创建市场页（UI 占位）
- [x] 我的预测页
- [x] 排行榜页
- [x] 通知中心页
- [x] 个人中心页
- [x] 邀请好友页 `/invite`

### 钱包与登录
- [x] `WalletProvider`：基于 `@solana/react-hooks`，支持 mock wallet
- [x] `AuthModal`：Google / 邮箱 / 钱包登录入口（Phase 1 仅钱包可交互）
- [x] `UserDropdown`：已登录状态下的头像下拉菜单
- [x] DEV 环境 Mock Wallet 兜底

## 数据层

### 前端 Mock
- [x] `apps/web/src/lib/mock/`：28 条市场、排行榜、通知、用户资料、持仓
- [x] `mockHandler` 拦截 `/markets`、`/markets/:slug`、`/leaderboard/:type`、`/notifications`、`/profile`、`/predictions`、`/health`
- [x] `VITE_API_MOCK=true` 开关
- [x] 薄 `apiFetch` 封装

### 后端数据层
- [x] `app/core/config.py`：pydantic-settings 统一配置，默认 PostgreSQL
- [x] `app/db/session.py`：async SQLAlchemy engine + session，移除 SQLite 分支
- [x] `app/models/user.py`：User model（含 invite_code、is_admin 等）
- [x] Phase 2 MVP 模型：`events`、`markets`、`positions`、`trades`、`disputes`、`notifications`、`referrals`、`referral_rewards`、`event_categories`、`tags`、`event_tags`、`configs`、`admin_accounts`、`indexer_cursor`
- [x] Alembic migration `a7aaa0c86803_phase2_mvp_tables` 已生成并运行
- [x] `app/scripts/seed.py`：categories / configs / admin / default user seed
- [x] `app/services/`：Market / Leaderboard / Prediction / Notification / Profile / Referral services
- [x] `app/routers/`：markets / leaderboard / predictions / notifications / profile / referrals 读 API
- [x] `app/dependencies/auth.py`：轻量 auth dependency
- [x] `app/routers/users.py`：示例 `/api/v1/users` CRUD 列表
- [x] `alembic/`：PostgreSQL 初始 migration

### 前端数据层
- [x] `apps/web/src/lib/api/markets.ts`：market list / detail API 封装
- [x] `apps/web/src/lib/api/leaderboard.ts`
- [x] `apps/web/src/lib/api/predictions.ts`
- [x] `apps/web/src/lib/api/notifications.ts`
- [x] `apps/web/src/lib/api/profile.ts`
- [x] `apps/web/src/lib/api/referrals.ts`
- [x] 首页、市场详情、排行榜、我的预测、通知、个人中心、邀请页已切换到真实 API

### 验证
- [x] `pnpm typecheck` 通过
- [x] `pnpm test` 通过
- [x] `pnpm build` 通过（client + SSR）
- [x] `bash dev.sh` 可正常拉起 web + admin + api + Python workers（含 Alembic 迁移）
- [x] `uv run alembic upgrade head` 通过（PostgreSQL）
- [x] `uv run ruff check app` 通过

---

## 已知占位 / 未实现

- 所有写操作（创建市场、下注、claim）只做了 UI，不上链、不写数据库。
- Google / 邮箱登录是 UI 占位，未接后端。
- 走势图为 mock 折线，非真实价格数据。
- 右侧边栏的「永续合约」「创建组合」是 Polymarket 风格的 UI 占位，不代表真实功能。
- `apps/admin` 未接入。
- Python Worker（`app/workers/indexer.py`）已实现主程序事件解析，Champion/通知/定时/推荐奖励 worker 已就绪。
- Solana 程序 IDL 已按 parimutuel 状态机确定，待实现。

---

## 架构决策（已确定）

1. **Admin 不单独成域**：统一 router，权限通过 `require_permission` dependency 注入。
2. **Python API Worker 监听链**：`app/workers/indexer.py` 轮询 Solana RPC、解析事件、写 PostgreSQL；Web API 只读 PostgreSQL + 校验 tx sync。与旧 PolyMind 架构一致。
3. **PostgreSQL 唯一数据库**：移除 SQLite fallback。
4. **Solana 项目在根目录 `solana/`**：不和 `apps/` 混排。
5. **前端钱包用 `@solana/react-hooks`**：替代旧的 `@wallet-standard/react`。
6. **旧数据不迁移**：新 Schema 按 Solana 预测市场重新设计。
7. **市场类型与结算机制**：二元预测市场，固定赔率 / 比例分配，admin resolve，先不做 AMM/CLOB。
8. **创建者义务**：需下种子注，错过 propose 窗口会被 slash 进 `bonus_pool`。
9. **单边保护**：`single_side_only=true`，单边 pool 自动 VOID。
10. **MarketConfig 快照**：每个 market 创建时复制全局费率与窗口配置，admin 后续改动不影响已创建市场。
11. **争议机制**：首次 dispute 后 market 永久只能 admin finalize。
12. **Indexer 数据源**：Python worker 使用 Solana RPC `getSignaturesForAddress` + `getTransaction` 轮询，不引入 Helius/Yellowstone。

---

## 下一步建议

1. **实现 Anchor 程序骨架**（`solana/programs/polymind/`）：Event / Market / Position / Vault PDA，固定赔率状态机。
2. **完善 Python Worker 事件解析与可观测性**（`app/workers/indexer.py`），确保所有 parimutuel 事件写入 domain 表。
3. **补充 Python Solana client + sync router**。
4. **补充 admin routers**（events、markets、tags、users、disputes、leaderboard 等）。
5. **评估 TypeScript 版本**：`@solana/kit` peer 依赖 ^5.0.0，当前 6.0.3 虽能跑但长期需关注。

---

Sources:
- [Helius: How to Index Solana Data](https://www.helius.dev/docs/rpc/how-to-index-solana-data)
- [anchorpy GitHub](https://github.com/kevinheavey/anchorpy)
