# Maddox Quant

面向投研场景的量化分析平台，围绕行业研报构建「采集 → 存储 → 检索 → 分析 → 关注 → 通知」完整闭环。

## 核心功能

1. **研报分析** — 手动导入 / 自动采集，搜索筛选，列表与详情查看
2. **数据分析** — LLM 结构化分析，聚合看板，提炼指标与因子
3. **关注与通知** — 全局关注行业/板块/个股，重大事件站内通知

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

## 快速开始

### 环境要求

- Docker & Docker Compose
- Node.js 20+（本地前端开发）
- Python 3.11+（本地后端开发）

### 一键启动

```bash
git clone https://github.com/guomu-del/maddox-quant.git
cd maddox-quant
cp .env.example .env
docker compose up --build
```

访问：

- 前端：http://localhost:4321
- 后端健康检查：http://localhost:8765/health

### 本地开发

**后端**

```bash
cd backend
pip install -r requirements.txt
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/maddox_quant
export PATH="$HOME/.local/bin:$PATH"
uvicorn app.main:app --reload --port 8765
```

**前端**

```bash
cd frontend
npm install
npm run dev
```

**数据库迁移**

```bash
cd backend
alembic upgrade head
```

**测试**

```bash
cd backend
PYTHONPATH=. pytest tests/ -v
```

## 开发阶段

| Phase | 内容 | 状态 |
|-------|------|------|
| P0 | 项目骨架 | ✅ 完成 |
| P1 | 研报导入与搜索 | ✅ 完成 |
| P2 | AI 单篇分析 | ✅ 完成 |
| P3 | 聚合分析看板 | 待开始 |
| P4 | 关注与通知 | 待开始 |
| P5 | 自动采集 | 待开始 |
| P6 | 打磨上线 | 待开始 |

## 环境变量

见 `.env.example`。

## License

Private — 内部使用
