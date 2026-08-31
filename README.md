# Maddox Quant

面向投研场景的量化分析平台，围绕行业研报构建「采集 → 存储 → 检索 → 分析 → 关注 → 通知」完整闭环。

## 核心功能

1. **研报分析** — 手动导入 / 自动采集，搜索筛选，列表与详情查看
2. **数据分析** — LLM 结构化分析，聚合看板，提炼指标与因子
3. **关注与通知** — 全局关注行业/板块/个股，重大事件站内通知

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Next.js、TypeScript、Tailwind CSS、shadcn/ui |
| 后端 | FastAPI、SQLAlchemy、Alembic |
| 数据库 | PostgreSQL（全文检索 + JSONB） |
| 文件存储 | 本地目录 `storage/reports/` |
| 鉴权 | 无登录，公开访问 |

## 文档

- [开发步骤（DEVELOPMENT.md）](./docs/DEVELOPMENT.md) — 分 Phase 详细开发指南
- [实现计划（Superpowers）](./docs/superpowers/plans/2026-08-31-maddox-quant-mvp.md) — 可执行任务清单（TDD）

## 快速开始

> 项目尚在开发中，Phase 0 完成后此处补充启动命令。

```bash
# 克隆仓库
git clone https://github.com/guomu-del/maddox-quant.git
cd maddox-quant

# 配置环境变量
cp .env.example .env

# 启动（Phase 0 完成后可用）
docker compose up -d
```

## 开发阶段

| Phase | 内容 | 状态 |
|-------|------|------|
| P0 | 项目骨架 | 待开始 |
| P1 | 研报导入与搜索 | 待开始 |
| P2 | AI 单篇分析 | 待开始 |
| P3 | 聚合分析看板 | 待开始 |
| P4 | 关注与通知 | 待开始 |
| P5 | 自动采集 | 待开始 |
| P6 | 打磨上线 | 待开始 |

## License

Private — 内部使用
