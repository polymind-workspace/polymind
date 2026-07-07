# PolyMind API

FastAPI + SQLAlchemy 2.0 (async) + Alembic 标准骨架。

## 环境要求

- Python >= 3.11
- uv
- PostgreSQL（生产）或 SQLite（本地开发零配置）

## 快速开始

```bash
cd apps/api
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:app --host 0.0.0.0 --port 8300 --reload
```

## 配置

复制 `.env.example` 为 `.env` 并修改：

```bash
cp .env.example .env
```

默认使用 SQLite 零配置本地开发：

```env
DATABASE_URL=sqlite+aiosqlite:///./polymind_dev.db
```

生产使用 PostgreSQL（示例使用 Docker Compose 里的 PostgreSQL 18，映射到本机 5433 以避免与 repurposer 的 5432 冲突）：

```env
DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5433/polymind
```

用 Docker 启动本地 PostgreSQL 18：

```bash
docker compose up -d db
```

容器名为 `polymind-db-1`，服务名为 `db`。停止/删除：

```bash
docker compose down        # 保留数据卷
docker compose down -v     # 同时删除数据卷
```

## 目录结构

```
app/
  core/          # 配置
  db/            # Base、engine、session
  models/        # SQLAlchemy models
  routers/       # FastAPI routers
  main.py        # 应用入口
  lifespan.py    # 应用生命周期
alembic/         # 迁移脚本
```

## 常用命令

```bash
# 生成迁移
uv run alembic revision --autogenerate -m "描述"

# 执行迁移
uv run alembic upgrade head

# 回滚一级
uv run alembic downgrade -1

# 代码检查
uv run ruff check app

# 类型检查（需安装 dev 依赖）
uv run mypy app
```

## 健康检查

- `GET /health`
- `GET /api/v1/health`
- `GET /api/v1/users`
