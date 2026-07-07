# PolyMind 第一阶段进展

> 最后更新：2026-07-07

## 总体状态

第一阶段核心目标已达成：`apps/web` 已搭好 TanStack Start + shadcn/ui + Tailwind v4 + i18n 骨架，UI 布局参考 Polymarket，功能范围保持与 superbox 一致，所有页面先用 mock 数据跑通。

---

## 已完成

### 项目骨架
- [x] `pnpm-workspace.yaml` + `package.json` 根工作区
- [x] `apps/web`：TanStack Start + Vite + React 19 + TypeScript
- [x] `apps/api`：FastAPI + SQLAlchemy 2.0 (async) + Alembic 标准骨架，含 `User` model、`/api/v1/users`、`/health`
- [x] `apps/api/.env.example` + `docker-compose.yml`（PostgreSQL 18，本机端口 5433 避免与 repurposer 冲突）
- [x] `apps/api/alembic` 初始迁移已生成并验证通过
- [x] `apps/admin`：空文件夹占位
- [x] `.env.example` + `apps/web/.env` 本地配置
- [x] 根目录 `dev.sh` 一键启动 web + api
- [x] 端口选为 `3100/8300`，避免与 repurposer 冲突

### 前端依赖与配置
- [x] shadcn/ui (base-ui) 组件库
- [x] Tailwind CSS v4 + 自定义语义变量（`--yes` / `--no`）
- [x] i18next（zh / en），key 覆盖 market / wallet / predictions / leaderboard / notifications / profile / header
- [x] @wallet-standard/react + Solana Kit 钱包检测

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

### 钱包与登录
- [x] `WalletProvider`：Wallet Standard 检测、连接、断开、自动重连
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
- [x] `app/core/config.py`：pydantic-settings 统一配置
- [x] `app/db/session.py`：async SQLAlchemy engine + session
- [x] `app/models/user.py`：示例 User model
- [x] `app/routers/users.py`：示例 `/api/v1/users` CRUD 列表
- [x] `alembic/`：迁移配置 + 初始 migration

### 验证
- [x] `pnpm typecheck` 通过
- [x] `pnpm test` 通过
- [x] `pnpm build` 通过（client + SSR）
- [x] `bash dev.sh` 可正常拉起 web + api（含 Alembic 迁移）
- [x] `uv run alembic upgrade head` 通过
- [x] `uv run ruff check app` 通过

---

## 已知占位 / 未实现（符合第一阶段范围）

- 所有写操作（创建市场、下注、claim）只做了 UI，不上链、不写数据库。
- Google / 邮箱登录是 UI 占位，未接后端。
- 走势图为 mock 折线，非真实价格数据。
- 右侧边栏的「永续合约」「创建组合」是 Polymarket 风格的 UI 占位，不代表真实功能。
- `apps/admin` 未接入。

---

## 下一步建议

1. **接入真实 Solana 钱包签名**：把卡片上的 Yes/No 按钮与市场详情里的押注面板接到链上 `market::bet`。
2. **后端合并**：把现有 `polymind/api` 的真实服务逐步迁到 `apps/api`。
3. **Admin 前端**：在 `apps/admin` 启动 TanStack Start 版 admin。
4. **主题优化**：当前默认 dark，可根据品牌需要切到 light 默认。
5. **单元测试扩充**：目前只有 `formatNumber` 的简单测试。
