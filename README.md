# PolyMind Web

PolyMind 第一阶段前端项目：将原本的微信小程序（superbox）迁移到响应式 Web，UI 参考 Polymarket，功能范围保持与 superbox 一致。

---

## 技术栈

- **框架**：TanStack Start + React 19 + TypeScript
- **样式**：Tailwind CSS v4 + shadcn/ui (base-ui)
- **状态/路由**：TanStack Router（文件路由）
- **国际化**：i18next + react-i18next（zh / en）
- **钱包**：@wallet-standard/react + Solana Kit（Phase 1 只连接地址，不上链签名）
- **Mock**：`VITE_API_MOCK=true` 时所有 API 请求走本地 mock
- **后端**：`apps/api` 为 FastAPI + SQLAlchemy 2.0 (async) + Alembic 标准骨架，默认 SQLite 零配置，生产切 PostgreSQL

---

## 目录结构

```
/
├── apps/
│   ├── web/           # 核心前端（端口 3100）
│   ├── api/           # FastAPI + SQLAlchemy + Alembic（端口 8300）
│   └── admin/         # 占位，未接入
├── docs/
│   ├── plan.md        # 第一阶段实施计划
│   └── progress.md    # 当前进展
├── dev.sh             # 一键启动 web + api
├── package.json
└── README.md
```

---

## 快速启动

### 1. 安装依赖

```bash
cd /Users/sylas/polymind/polymind
pnpm install
```

### 2. 环境变量

`apps/web/.env` 已配置（gitignored）：

```env
VITE_API_URL=http://localhost:8300
VITE_API_MOCK=true
```

如需关闭 mock、调真实 API，把 `VITE_API_MOCK` 删掉或设为 `false`。

### 3. 一键启动

```bash
bash dev.sh
```

- Web：`http://localhost:3100`（端口被占时会自动顺延）
- API：`http://localhost:8300/health`
- API 文档：`http://localhost:8300/docs`

`dev.sh` 会先执行 `alembic upgrade head` 再启动 API。

关闭时按 `Ctrl-C`，`dev.sh` 会同时杀掉 web 和 api 进程。

### 4. 单独启动

```bash
# 前端
pnpm dev:web

# 后端
pnpm dev:api
```

---

## 常用命令

| 命令 | 说明 |
|---|---|
| `pnpm dev` | 启动 `dev.sh` |
| `pnpm dev:web` | 只启动前端 |
| `pnpm dev:api` | 只启动后端（含 Alembic 迁移）|
| `pnpm build` | 构建前端（client + SSR）|
| `pnpm typecheck` | TypeScript 检查 |
| `pnpm test` | 跑测试 |
| `pnpm --filter web generate-routes` | 重新生成 TanStack 路由 |

---

## 已实现页面

- `/` 首页：搜索、分类 tab、标签筛选、精选大卡、紧凑卡片列表、右侧边栏
- `/markets/$eventId` 市场详情：概率、押注面板、活动 feed、相关市场
- `/create` 创建市场（UI 占位）
- `/predictions` 我的预测
- `/leaderboard` 排行榜
- `/notifications` 通知中心
- `/profile` 个人中心

---

## 钱包连接

- 未登录：右上角「Log in」打开登录弹窗（Google / 邮箱 / 钱包，Phase 1 仅钱包可点）
- 已登录：右上角显示资产组合/现金/充值/礼物/通知/头像下拉菜单
- DEV 环境下如果没有安装钱包，弹窗里会显示「Mock Wallet」

---

## 注意事项

- 端口故意选为 `3100/8300`，避免与 repurposer（3000/8000）冲突。
- `apps/web/.env` 不要提交 git（已加入 `.gitignore`）。
- `apps/admin` 目前只是空文件夹，第二阶段再接入。
