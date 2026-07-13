# PolyMind

基于 Solana 的预测市场平台。

- **Web 前端**：响应式 Web App（原微信小程序 superbox 迁移）
- **Admin 前端**：Ant Design Pro + umi/max（端口 3200）
- **后端**：FastAPI + SQLAlchemy 2.0 (async) + Alembic + PostgreSQL
- **链上程序**：Anchor（Rust）
- **索引器**：Python Worker（`apps/api/app/workers/`），轮询 Solana RPC、解析 program logs 写入 PostgreSQL

---

## 技术栈

| 层级 | 技术 |
|---|---|
| 前端 | TanStack Start + React 19 + TypeScript |
| 管理后台 | umi/max (Ant Design Pro) + React 19 |
| 样式 | Tailwind CSS v4 + shadcn/ui (base-ui) |
| 钱包 | `@solana/react-hooks` + `@solana/client` |
| 后端 | FastAPI + SQLAlchemy 2.0 async + Alembic |
| 数据库 | PostgreSQL 18（Docker，端口 5433） |
| 链上程序 | Anchor (Rust) |
| 索引器 | Python Worker (`apps/api/app/workers/`) |
| 包管理 | pnpm (web/admin) + uv (api) + Cargo (solana) |

---

## 目录结构

```
/
├── apps/
│   ├── web/                  # 核心前端（端口 3100）
│   ├── api/                  # FastAPI（端口 8300）
│   └── admin/                # 管理后台（端口 3200）
├── solana/
│   └── programs/polymind/    # Anchor 程序
├── docs/
│   ├── architecture.md       # 架构设计
│   ├── progress.md           # 当前进展
│   └── PLAN.md               # 第一阶段实施计划
├── dev.sh                    # 一键启动 web + admin + api + workers
├── apps/api/docker-compose.yml  # PostgreSQL
├── package.json
└── README.md
```

---

## 版本锁定

经过验证的开发环境版本：

| 工具 | 版本 | 说明 |
|---|---|---|
| Rust | `1.89.0` | Anchor 1.0.2 需要 Rust 1.89+ |
| Anchor CLI | `1.0.2` | 程序框架和 CLI |
| Solana CLI | `4.0.2` | 部署和 RPC 调用 |
| Node.js | `>= 20` | 前端和 Anchor TS 测试 |
| Python | `>= 3.11` | 后端 |

> **重要**：Rust 1.96+ 在 macOS Command Line Tools 的 clang 21 上会出现 LLVM bitcode 链接错误。如果已经升级到 Rust 1.96+，请降级到 1.89.0。

---

## 环境准备

### 1. 通用依赖

- [Node.js >= 20](https://nodejs.org/)
- [pnpm](https://pnpm.io/installation)
- [Python >= 3.11](https://www.python.org/)
- [uv](https://docs.astral.sh/uv/getting-started/installation/)
- [Rust](https://www.rust-lang.org/tools/install)
- [Docker / Docker Compose](https://docs.docker.com/get-docker/)
- [Homebrew](https://brew.sh/)（macOS 上需要 openssl/pkgconf）

### 2. 安装 Rust 1.89.0

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
. "$HOME/.cargo/env"

# 安装并切换到 1.89.0
rustup install 1.89.0
rustup default 1.89.0
rustc --version  # rustc 1.89.0
```

**国内镜像加速**：如果 rustup 下载慢，配置中科大镜像：

```bash
export RUSTUP_DIST_SERVER=https://mirrors.ustc.edu.cn/rust-static
export RUSTUP_UPDATE_ROOT=https://mirrors.ustc.edu.cn/rust-static/rustup
rustup install 1.89.0
```

### 3. 安装 Solana CLI

```bash
sh -c "$(curl -sSfL https://release.anza.xyz/stable/install)"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
solana --version  # solana-cli 4.0.x
```

把下面这行加入 `~/.zshrc`（macOS）或 `~/.bashrc`（Linux）：

```bash
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
```

### 4. 安装 Anchor CLI 1.0.2

```bash
# 直接 cargo install 指定 1.0.2
cargo install --git https://github.com/solana-foundation/anchor --tag v1.0.2 anchor-cli --force

anchor --version  # anchor-cli 1.0.2
```

如果 AVM 方式安装遇到 `agave-install` 错误，直接 cargo install 更稳。

### 5. 安装 macOS 系统依赖

```bash
brew install pkgconf openssl
```

编译 Rust 依赖以及 Python 数据库驱动会用到 OpenSSL；`pkgconf` 用来定位它。

### 6. 配置 cargo 国内镜像（推荐）

创建或编辑 `~/.cargo/config.toml`：

```toml
[source.crates-io]
replace-with = "ustc-sparse"

[source.ustc-sparse]
registry = "sparse+https://mirrors.ustc.edu.cn/crates.io-index/"

[net]
git-fetch-with-cli = true
```

---

## 快速启动

### 1. 安装项目依赖

```bash
cd /Users/sylas/polymind/polymind
pnpm install
```

### 2. 复制环境变量

```bash
cp .env.example .env
```

当前程序 ID 已预填：

```env
SOLANA_PROGRAM_ID=7c7Btev54kA36Nx5iq6LrzBhT9K4p6hKD1Tv4CjZ7qAv
```

> `.env` 中的值默认面向 **devnet**。本地开发时 `./dev.sh local` 会自动覆盖为 localnet 配置，不需要改动 `.env`。

### 3. 一键启动

`dev.sh` 支持两种模式，默认是 localnet：

| 命令 | 模式 | 说明 |
|---|---|---|
| `./dev.sh` | **localnet（默认）** | 本地启动 `solana-test-validator`，自动部署合约 |
| `./dev.sh local` | localnet | 同上，显式指定 |
| `./dev.sh dev` | devnet | 不启动本地验证器，使用 `.env` 中的 devnet RPC |

`./dev.sh local` 会自动完成：

1. 启动 PostgreSQL（Docker Compose）
2. 启动 `solana-test-validator`（如果未运行）
3. 编译并部署 `polymind` 程序到 localnet（如果未部署）
4. 运行 Alembic 数据库迁移
5. 启动 API（端口 8300）
6. 启动 Python workers
7. 启动 Web 前端（端口 3100）
8. 启动 Admin 前端（端口 3200）

启动后访问：

| 服务 | 地址 |
|---|---|
| Web | http://localhost:3100 |
| Admin | http://localhost:3200 |
| API | http://localhost:8300/health |
| API 文档 | http://localhost:8300/docs |

关闭时按 `Ctrl-C`，`dev.sh` 会同时杀掉所有子进程。

### 4. 使用 devnet

如果你网络能访问 devnet，可以切到 devnet 模式：

```bash
./dev.sh dev
```

与 `local` 模式的区别：

- **不会**启动 `solana-test-validator`。
- 使用 `.env` 中的 `SOLANA_RPC_URL` / `VITE_SOLANA_RPC`（默认 devnet）。
- `SOLANA_PROGRAM_ID` / `VITE_SOLANA_PROGRAM_ID` 从 `.env` 读取，不再被 Anchor.toml 覆盖。
- 启动前会检查 program 是否已在 devnet 部署；若未部署，会打印警告但其他服务仍会启动。

若程序未部署，需要手动执行：

```bash
cd solana/programs/polymind
solana config set --url devnet
solana airdrop 2
anchor deploy --provider.cluster devnet
```

> devnet 在国内可能访问超时，推荐本地开发使用 `./dev.sh local`。

### 5. 单独启动

```bash
# 前端
pnpm dev:web

# 后端（含 Alembic 迁移）
pnpm dev:api

# Python workers（需要 SOLANA_PROGRAM_ID 等环境变量）
cd apps/api
uv run python -m app.workers.indexer           # PolyMind 主程序索引
uv run python -m app.workers.champion_indexer  # Champion 活动索引
uv run python -m app.workers.notification_worker
uv run python -m app.workers.deadline_cron
uv run python -m app.workers.referral_reward_worker
```

---

## 常用命令

| 命令 | 说明 |
|---|---|
| `pnpm dev` | 启动 `dev.sh`（默认 localnet） |
| `pnpm dev:web` | 只启动前端 |
| `pnpm dev:api` | 只启动后端（含 Alembic 迁移）|
| `pnpm build` | 构建前端（client + SSR）|
| `pnpm typecheck` | TypeScript 检查 |
| `pnpm test` | 跑测试 |
| `uv run ruff check app` | API 代码风格检查 |
| `uv run alembic revision --autogenerate -m "msg"` | 生成数据库迁移 |
| `anchor build` | 编译 Solana 程序 |
| `anchor deploy --provider.cluster devnet` | 部署到 devnet |
| `uv run python -m app.workers.indexer` | 运行 PolyMind 主程序索引 worker |

---

## Solana 端到端验证

当前链上程序是一个最小 Hello World counter，用于验证 Anchor 编译、部署和本地 validator 流水线：

```bash
cd solana/programs/polymind
anchor build
anchor deploy --provider.cluster localnet
```

部署成功后，可继续用 Anchor TS 客户端或 `solana program invoke` 调用 `initialize` / `increment` 指令。
Indexer 会在后续实现真实预测市场事件后接入。旧 `emit_test_event` 验证流程已不再适用。


---

## 环境搭建踩坑记录

### 1. Rust 版本与 Apple clang 不兼容

**现象**：

```text
ld: multiple errors: could not parse bitcode object file ...
'Unknown attribute kind (105) (Producer: 'LLVM22.1.2-rust-1.96.1-stable' Reader: 'LLVM APPLE_1_2100.1.1.101_0')'
```

**原因**：Rust 1.96+ 基于 LLVM 22，而 macOS Command Line Tools 的 clang 还是 LLVM 21，链接时 bitcode 不兼容。

**解决**：降级 Rust 到 1.89.0：

```bash
rustup install 1.89.0
rustup default 1.89.0
```

### 2. Anchor 1.0.2 需要 Rust 1.89+

**现象**：

```text
rustc 1.86.0 is not supported by the following packages:
  darling@0.23.0 requires rustc 1.88.0
  solana-address@2.6.1 requires rustc 1.89.0
```

**解决**：升级到 Rust 1.89.0。

### 3. AVM 安装 Anchor 时报 `agave-install` 错误

**现象**：`avm use 1.0.2` 时自动尝试安装"推荐"的 Solana CLI，但 `agave-install` 找不到。

**解决**：绕过 AVM，直接 cargo install Anchor CLI：

```bash
cargo install --git https://github.com/solana-foundation/anchor --tag v1.0.2 anchor-cli --force
```

### 4. cargo 下载 crates.io 依赖很慢

**解决**：配置中科大 sparse index 镜像，见上文 `~/.cargo/config.toml`。

### 5. Anchor 程序编译报 OpenSSL 找不到

**现象**：

```text
Could not find directory of OpenSSL installation
Could not find openssl via pkg-config
```

**解决**：

```bash
brew install pkgconf openssl
export OPENSSL_DIR=$(brew --prefix openssl)
export PATH="/opt/homebrew/bin:$PATH"
```

### 6. Anchor program id 不匹配

**现象**：

```text
Error: Program ID mismatch detected for program 'polymind'
```

**解决**：

```bash
anchor keys sync
anchor build
```

### 7. devnet airdrop 失败

**现象**：`solana airdrop 2` 报网络错误。

**解决**：
- 开代理/VPN 后重试
- 或去 [Solana Faucet](https://faucet.solana.com/) 手动领取
- **推荐**：改用 localnet：`./dev.sh local`

---

## 参考文档

- Solana 官方安装指南：https://solana.com/zh/docs/intro/installation/dependencies
- Anchor 官方文档：https://www.anchor-lang.com/docs/
- Anchor GitHub：https://github.com/solana-foundation/anchor
- Solana Faucet：https://faucet.solana.com/
- 中科大 cargo 镜像：https://mirrors.ustc.edu.cn/help/crates.io-index.html

---

## 注意事项

- 端口故意选为 `3100/3200/8300`，避免与常见端口冲突。
- `.env` 文件不要提交 git（已加入 `.gitignore`）。
- Anchor 程序首次 `cargo build` 较慢，请耐心等待。
- localnet 每次重启 `solana-test-validator` 后状态会清空，`dev.sh local` 会自动重新部署合约。
- 当前程序 ID：`7c7Btev54kA36Nx5iq6LrzBhT9K4p6hKD1Tv4CjZ7qAv`
