# Maddox Quant

面向投研场景的量化分析平台，围绕行业研报构建「采集 → 存储 → 检索 → 分析 → 关注 → 通知」完整闭环。

## 核心功能

1. **研报分析** — 手动导入 / 自动采集，搜索筛选，列表与详情查看
2. **数据分析** — LLM 结构化分析，聚合看板，提炼指标与因子
3. **关注与通知** — 全局关注行业/板块/个股，重大事件站内通知
4. **自动采集** — RSS 采集源配置，定时或手动抓取 PDF 入库

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Next.js、TypeScript、Tailwind CSS |
| 后端 | FastAPI、SQLAlchemy、Alembic |
| 数据库 | PostgreSQL（全文检索 + JSONB） |
| 文件存储 | 本地目录 `storage/reports/` |
| 鉴权 | 无登录，公开访问 |

## 文档

- [开发步骤（DEVELOPMENT.md）](./docs/DEVELOPMENT.md)
- [实现计划（Superpowers）](./docs/superpowers/plans/2026-08-31-maddox-quant-mvp.md)

## 环境要求

- Docker & Docker Compose
- Node.js 20+（本地前端开发）
- Python 3.11+（本地后端开发）
- PostgreSQL 16（Docker 或本地）

## 快速开始

### 一键启动（Docker）

```bash
git clone https://github.com/guomu-del/maddox-quant.git
cd maddox-quant
cp .env.example .env
docker compose up --build
```

访问：

- 前端：http://localhost:4321
- 后端健康检查：http://localhost:8765/health

首次启动后执行数据库迁移：

```bash
docker compose exec backend alembic upgrade head
```

### 本地开发

**1. 启动 PostgreSQL**（或使用 Docker 仅跑数据库）

```bash
docker compose up postgres -d
```

**2. 后端**

```bash
cd backend
pip install -r requirements.txt
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/maddox_quant
export STORAGE_PATH=../storage/reports
alembic upgrade head
PYTHONPATH=. uvicorn app.main:app --reload --port 8765
```

**3. 前端**

```bash
cd frontend
npm install
npm run dev
```

**4. 测试**

```bash
cd backend
PYTHONPATH=. pytest tests/ -v
```

## 种子数据

导入行业与个股参考字典（用于后续 autocomplete 等）：

```bash
cd backend
PYTHONPATH=. alembic upgrade head
PYTHONPATH=. python scripts/seed.py
```

数据文件位于 `backend/data/industries.csv` 与 `backend/data/stocks.csv`。

## 备份与恢复

**备份**（数据库 + PDF 文件）：

```bash
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/maddox_quant
./scripts/backup.sh
```

默认输出到 `backups/maddox_quant_<timestamp>/`。

**恢复**：

```bash
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/maddox_quant
./scripts/restore.sh backups/maddox_quant_<timestamp>
```

## 生产部署

### Docker Compose

`docker-compose.yml` 已配置 `restart: unless-stopped` 与持久化 volume（`pgdata`、`storage/`）。

生产环境建议：

1. 修改 `.env` 中的数据库密码与 `LLM_API_KEY`
2. 设置 `COLLECT_ENABLED=true` 启用定时采集（可选）
3. 使用 Nginx 反向代理，示例：

```nginx
server {
    listen 80;
    server_name quant.example.com;

    location / {
        proxy_pass http://127.0.0.1:4321;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8765;
        proxy_set_header Host $host;
        client_max_body_size 50m;
    }
}
```

### 安全说明

平台默认无登录，**请勿直接暴露公网**。内网部署或在 Nginx 层添加 Basic Auth。

## 环境变量

| 变量 | 必填 | 说明 |
|------|------|------|
| `DATABASE_URL` | 是 | PostgreSQL 连接串 |
| `STORAGE_PATH` | 是 | PDF 存储目录 |
| `CORS_ORIGINS` | 否 | 前端地址，默认 `http://localhost:4321` |
| `LLM_API_KEY` | 分析功能 | DeepSeek 或兼容 API 密钥 |
| `LLM_API_BASE` | 否 | 默认 `https://api.deepseek.com/v1` |
| `LLM_MODEL` | 否 | 默认 `deepseek-chat` |
| `AUTO_ANALYZE` | 否 | 解析后自动分析，默认 `false` |
| `COLLECT_ENABLED` | 否 | 启用定时采集，默认 `false` |
| `MAX_UPLOAD_MB` | 否 | PDF 上传大小限制，默认 `50` |

完整示例见 `.env.example`。

## 开发阶段

| Phase | 内容 | 状态 |
|-------|------|------|
| P0 | 项目骨架 | ✅ 完成 |
| P1 | 研报导入与搜索 | ✅ 完成 |
| P2 | AI 单篇分析 | ✅ 完成 |
| P3 | 聚合分析看板 | ✅ 完成 |
| P4 | 关注与通知 | ✅ 完成 |
| P5 | 自动采集 | ✅ 完成 |
| P6 | 打磨上线 | ✅ 完成 |

## License

Private — 内部使用
