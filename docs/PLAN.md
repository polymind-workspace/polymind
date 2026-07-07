# PolyMind Web 第一阶段实施计划

## Context

团队决定将 PolyMind 从 Endless 链 + 微信小程序（superbox）迁移到 Solana 链 + 响应式 Web App。Admin 前端与后端合并留到后续阶段；数据库从 MySQL 迁 PostgreSQL 无 ORM 成本。

本计划聚焦 **第一阶段**：以 `/Users/sylas/repurposer` 的 monorepo 为模板，新建 `/Users/sylas/polymind` 仓库，保持与 repurposer 一致的 Python + Node 混合框架：
- `apps/web`：TanStack Start 新 Web App（superbox 网页版 + Solana 钱包），**第一阶段核心工作**。
- `apps/api`：仅保留基础 FastAPI 空壳，用于占位和本地联调，**不合并现有后端**。
- `apps/admin`：仅保留空文件夹占位，**不迁入代码**。
- `apps/render` / `packages/clip`：视需要保留空壳或移除。

第一阶段不实现 Solana 合约/索引器，Web 端用 mock 数据跑通 UI。

---

## Goals

1. 新建基于 repurposer 的 `/Users/sylas/polymind` 仓库/目录，含 `apps/web`、`apps/api`（空壳）、`apps/admin`（空文件夹）。
2. 搭好 `apps/web`：TanStack Start + shadcn/ui (base-ui) + Tailwind v4 + i18next 骨架。
3. 接入 Solana Kit 钱包连接（检测、连接、断开、地址展示）。
4. 实现 Polymarket 风格的首页：搜索、分类 tab、标签、Banner、市场卡片列表。
5. 实现市场详情页、我的预测、排行榜、通知、个人中心页面骨架。
6. 所有页面先用 mock 数据跑通，不依赖真实链上交互。
7. 保持 `apps/api` 为最小 FastAPI 空壳，仅提供 `/health` 与 CORS，为后续后端合并留接口。

---

## Non-Goals

- 不迁移 admin 前端到 TanStack Start。
- 不写 Solana 程序/合约。
- 不接 Helius/RPC/indexer。
- 不上链真实押注/创建市场/claim。

---

## Recommended Approach

### 1. 项目初始化

以 `repurposer` 为模板，复制并精简，**只保留最小框架，专注于 `apps/web`**：

```bash
# 新目录
/Users/sylas/polymind/
├── pnpm-workspace.yaml       # apps/*
├── package.json              # root workspace meta
├── .gitignore
├── .env.example
├── docker-compose.yml        # 可选：仅 web + api 空壳（无 db）
└── apps/
    ├── web/                  # TanStack Start 新 Web App（核心）
    │   ├── package.json
    │   ├── vite.config.ts
    │   ├── tsconfig.json
    │   ├── components.json
    │   ├── src/
    │   └── public/
    ├── api/                  # 最小 FastAPI 空壳（占位）
    │   ├── pyproject.toml
    │   └── app/
    │       ├── main.py       # FastAPI + /health + CORS
    │       └── __init__.py
    └── admin/                # 空文件夹占位
```

移除 repurposer 中不需要的：
- `apps/render/`
- `packages/clip/`
- 依赖中的 `@remotion/player`, `remotion`, `@repurposer/clip`, `html-to-image`
- 不引入 Turborepo / Nx

**pnpm-workspace.yaml**

```yaml
# /Users/sylas/polymind/pnpm-workspace.yaml
packages:
  - "apps/*"
```

`apps/*` 匹配 `apps/web`（Node/pnpm）。`apps/api` 使用 uv 独立管理，不加入 pnpm workspace。`apps/admin` 暂时空文件夹，未来再纳入。

**apps/api 空壳内容**：
- `pyproject.toml`：FastAPI + uvicorn + pydantic。
- `app/main.py`：最小 FastAPI，仅返回 `{"status": "ok"}` 的 `/health` 和 CORS 中间件，允许 `http://localhost:3100`。
- **不复制现有 `polymind/api` 代码，不合并 admin/backend**。

### 2. 前端依赖

保留 repurposer 核心依赖：
- `react` `^19.2.0`, `react-dom` `^19.2.0`
- `@tanstack/react-start`, `@tanstack/react-router`
- `@shadcn/react`, `@base-ui/react`, `class-variance-authority`, `tailwind-merge`, `clsx`
- `tailwindcss` `^4.1.18`, `@tailwindcss/vite`, `tw-animate-css`, `tailwindcss-animate`
- `lucide-react`, `motion`
- `i18next`, `react-i18next`

新增 Solana 依赖：
- `@solana/kit` `^6.x`
- `@solana/react` `^6.x`
- `@wallet-standard/core` `^1.1.2`
- `@wallet-standard/react` `^1.x`（提供 `useWallets()`）

### 3. 目录结构

```
apps/web/src/
├── router.tsx
├── styles.css
├── routes/
│   ├── __root.tsx              # 根布局：Theme/I18n/Wallet/Sidebar
│   ├── index.tsx               # 首页（市场发现）
│   ├── markets.$eventId.tsx    # 市场详情
│   ├── create.tsx              # 创建市场（UI 占位）
│   ├── predictions.tsx         # 我的预测
│   ├── leaderboard.tsx         # 排行榜
│   ├── notifications.tsx       # 通知中心
│   └── profile.tsx             # 个人中心
├── components/
│   ├── layout/
│   │   ├── AppHeader.tsx       # 顶部：Logo、搜索、Connect
│   │   ├── BottomNav.tsx       # 移动端底部导航
│   │   ├── Sidebar.tsx         # 桌面端侧边导航
│   │   └── MobileContainer.tsx
│   ├── markets/
│   │   ├── MarketCard.tsx
│   │   ├── MarketCardGrid.tsx
│   │   ├── MarketProbabilityBar.tsx
│   │   ├── QuickBuyButtons.tsx
│   │   ├── CategoryTabs.tsx
│   │   ├── TagFilter.tsx
│   │   ├── BannerCarousel.tsx
│   │   ├── MarketSearch.tsx
│   │   ├── BetPanel.tsx
│   │   ├── OutcomeStats.tsx
│   │   └── ActivityFeed.tsx
│   ├── wallet/
│   │   ├── WalletButton.tsx
│   │   └── WalletModal.tsx
│   ├── leaderboard/
│   │   ├── LeaderboardTabs.tsx
│   │   ├── TopThreePodium.tsx
│   │   └── LeaderboardRow.tsx
│   ├── profile/
│   │   ├── ProfileHeader.tsx
│   │   ├── ProfileStats.tsx
│   │   └── ProfileMenu.tsx
│   └── ui/                     # shadcn/base-ui 组件
│       ├── button.tsx
│       ├── card.tsx
│       ├── dialog.tsx
│       ├── input.tsx
│       ├── tabs.tsx
│       └── ...
├── hooks/
│   ├── use-mobile.ts
│   ├── use-infinite-scroll.ts
│   └── use-wallet.ts
├── lib/
│   ├── utils.ts                # cn()
│   ├── api.ts                  # 薄 fetch 封装
│   ├── api/
│   │   ├── markets.ts
│   │   ├── predictions.ts
│   │   ├── leaderboard.ts
│   │   ├── notifications.ts
│   │   └── user.ts
│   ├── mock/
│   │   ├── index.ts
│   │   ├── markets.ts
│   │   ├── leaderboard.ts
│   │   └── notifications.ts
│   ├── wallet/
│   │   ├── WalletProvider.tsx
│   │   ├── use-wallets.ts
│   │   └── solana.ts
│   ├── i18n/
│   │   ├── index.ts
│   │   ├── I18nProvider.tsx
│   │   └── locales/
│   │       ├── en.ts           # Resources source of truth
│   │       └── zh.ts           # typed as Resources
│   └── theme/
│       ├── ThemeProvider.tsx
│       └── tokens.ts
└── types/
    └── index.ts                # 手写的市场/用户类型
```

### 4. 路由设计

| 路由 | 页面 | 说明 |
|---|---|---|
| `/` | 首页 | 搜索、tab、标签、Banner、市场卡片 |
| `/markets/$eventId` | 市场详情 | 问题、描述、概率、押注面板、活动 |
| `/create` | 创建市场 | 第一阶段仅 UI 占位 |
| `/predictions` | 我的预测 | participated / created tabs |
| `/leaderboard` | 排行榜 | invite / bet / topic |
| `/notifications` | 通知中心 | 分类筛选 |
| `/profile` | 个人中心 | 统计、菜单 |

### 5. 钱包集成

- 使用 `@wallet-standard/react` 的 `useWallets()` 检测已安装的 Wallet Standard 钱包。
- 封装 `WalletProvider`：提供 `wallet`、`account`、`connect(name)`、`disconnect`、`publicKey`、`connected`、`isConnecting`。
- `WalletModal` 用 shadcn `Dialog` 展示钱包列表；点击后调用 standard `connect` feature。
- SSR 安全：`typeof window === 'undefined'` 时返回空上下文，钱包相关逻辑只在 `useEffect`/事件里执行。
- Phase 1 不签名交易；连接后仅显示地址、解锁 UI 状态。

### 6. API 客户端策略

- 复用 repurposer 的薄 `apiFetch` 封装：`src/lib/api.ts`。
- 默认 `VITE_API_URL=http://localhost:8300`。
- 现有 API 返回 `{ret,msg,data}`，前端统一读取 `.data`。
- Phase 1 手写类型在 `src/types/index.ts`；Phase 2 再用 `openapi-typescript` 从 FastAPI `/openapi.json` 生成 schema。
- Mock 开关：`VITE_API_MOCK=true` 时路由到 `src/lib/mock/handlers.ts`，组件代码不变。

### 7. i18n

完全复用 repurposer 约定：
- `src/lib/i18n/index.ts` 初始化 i18next。
- `I18nProvider.tsx` SSR-safe，默认英文，hydrate 后读 `polymind-lang` cookie。
- `en.ts` 导出 `Resources` 类型，`zh.ts` 必须满足 `zh: Resources`。
- 新增市场领域 key：`home.*`, `market.*`, `predictions.*`, `leaderboard.*`, `notifications.*`, `profile.*`, `wallet.*`。

### 8. 主题

复用 repurposer 的 `ThemeProvider` 与 `styles.css`：
- storage key 改为 `polymind-theme`。
- 默认 dark 模式，首屏 inline script 读 localStorage 防闪烁。
- 新增语义变量：`--color-yes`（绿）、`--color-no`（红），用于概率条和按钮。
- 所有颜色使用 shadcn theme vars，禁止硬编码。

### 9. Mock 数据

在 `src/lib/mock/` 下提供：
- 25+ 条市场数据，覆盖不同分类、状态、概率。
- 分类 tab：all / trending / live / politics / crypto / sports（与 superbox `event/tabs` 对齐）。
- 标签数据与 pinned 标签。
- 排行榜 top3 + 列表。
- 通知列表。
- 个人中心统计。
- `apiFetch` 根据 path 匹配 mock handler，带 300ms 模拟延迟。

### 10. apps/api 最小空壳（占位）

第一阶段不合并现有后端，仅在 `apps/api` 保留最小 FastAPI 空壳：

- `app/main.py`：创建 `FastAPI()` 实例，添加 CORS 允许 `http://localhost:3100`，提供 `/health` 路由。
- `pyproject.toml`：依赖 `fastapi`, `uvicorn[standard]`, `pydantic`。
- 不复制 `polymind/api` 或 `admin/backend` 代码。
- 不引入数据库、worker、indexer。
- 作用：让 `apps/web` 有一个可 ping 的后端地址，后续阶段再替换为合并后的真实后端。

本地启动：
```bash
cd apps/api && uv run uvicorn app.main:app --reload --port 8300
```

### 11. 关键约定（继承 repurposer）

- shadcn base-ui：trigger 用 `render` prop，**不用** `asChild`。
- 图标只用 `lucide-react`。
- `rounded-full` 仅用于圆形 icon button 和状态红点。
- Card 样式：`ring-1 ring-border shadow-xl`。
- Tailwind v4 + CSS 变量，无 hard-code 颜色。
- 页面内容放 `SidebarInset`。

### 12. 风险与缓解

| 风险 | 缓解 |
|---|---|
| Solana Kit / wallet-standard API 仍在演进 | 封装内部模块，pin 版本，隔离升级影响 |
| SSR hydration mismatch（wallet/theme） | 默认 no-op context，inline script 处理 theme，钱包逻辑放 useEffect |
| 现有 API 仍依赖 Luffa 认证 | Phase 1 Web 只调公开接口，用户相关接口走 mock；admin 继续用原认证 |
| 移动端浏览器 Wallet Standard 检测不全 | 提供安装 Phantom/Solflare 提示，后续接 WalletConnect |
| 范围蔓延 | 明确 non-goals，创建市场/押注只做 UI，不上链；apps/api/admin 不落地业务代码 |

### 13. 验证标准

- `pnpm install` 在 root 安装 `apps/web` 依赖，无冲突。
- `pnpm --filter web dev` 在 `http://localhost:3100` 正常启动，无报错。
- `cd apps/api && uv run uvicorn app.main:app --port 8300` 启动最小后端，`/health` 返回 `{"status":"ok"}`。
- `apps/web` 能通过 `VITE_API_URL=http://localhost:8300` ping 到 `/health`。
- 默认 dark 模式，主题切换有 circular reveal。
- 中英文切换正常，cookie 持久化。
- WalletModal 能检测到钱包（或 mock 钱包），连接/断开正常。
- 首页：tab、标签、搜索、无限滚动、市场卡片、YES/NO 概率条、quick-buy 按钮。
- 市场详情页：问题、描述、概率条、押注面板（UI）、活动 feed。
- predictions / leaderboard / notifications / profile 用 mock 数据渲染。
- `pnpm build` TypeScript 严格模式通过，无 hydration error。
- 响应式：移动端底部导航 + 桌面端侧边导航。

---

## Critical Files

1. `apps/web/src/routes/__root.tsx` — 根布局，集中 providers。
2. `apps/web/src/lib/wallet/WalletProvider.tsx` — Solana 钱包上下文。
3. `apps/web/src/components/markets/MarketCard.tsx` — Polymarket 风格卡片。
4. `apps/web/src/routes/index.tsx` — 首页，集成搜索/tab/标签/列表。
5. `apps/web/src/lib/mock/markets.ts` — Phase 1 核心 mock 数据源。
6. `apps/api/app/main.py` — 最小 FastAPI 空壳，提供 `/health` 与 CORS。

---

## Sources

- [Solana StackExchange: create-solana-dapp guidance](https://solana.stackexchange.com/questions/22366/guidance-on-using-the-new-version-of-create-solana-dapp)
- [Triton One: Intro to the new Solana Kit](https://blog.triton.one/intro-to-the-new-solana-kit-formerly-web3-js-2/)
- [Anchor v0.31.1 release notes](https://www.anchor-lang.com/docs/updates/release-notes/0-31-1)
- [@wallet-standard/core on npmx](https://npmx.dev/package/@wallet-standard/core/v/1.x.x)
