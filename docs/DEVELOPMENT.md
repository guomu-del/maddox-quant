# Maddox Quant 开发步骤

本文档基于已确认的技术方案，将开发工作拆解为可执行的步骤。按 Phase 顺序推进，每个 Phase 结束应可独立验证。

## 技术约束（回顾）

| 项目 | 选型 |
|------|------|
| 前端 | Next.js + TypeScript + Tailwind + shadcn/ui |
| 后端 | FastAPI + SQLAlchemy + Alembic |
| 数据库 | **仅 PostgreSQL**（全文检索 + JSONB） |
| 文件 | 本地 `storage/reports/` |
| 鉴权 | **无登录**，API 公开访问 |
| 关注/通知 | 服务端全局配置 |
| 代码仓库 | GitHub `guomu-del/maddox-quant` |

---

## 仓库目录结构（目标）

```
maddox-quant/
├── frontend/                 # Next.js 应用
│   ├── src/
│   │   ├── app/              # App Router 页面
│   │   ├── components/       # UI 组件
│   │   ├── lib/              # API 客户端、工具函数
│   │   └── types/            # TypeScript 类型
│   ├── package.json
│   └── Dockerfile
├── backend/                  # FastAPI 应用
│   ├── app/
│   │   ├── api/              # 路由
│   │   ├── models/           # SQLAlchemy 模型
│   │   ├── schemas/          # Pydantic Schema
│   │   ├── services/         # 业务逻辑
│   │   ├── tasks/            # 后台任务、定时任务
│   │   └── main.py
│   ├── alembic/              # 数据库迁移
│   ├── requirements.txt
│   └── Dockerfile
├── storage/                  # PDF 文件（.gitignore）
├── docs/
│   └── DEVELOPMENT.md        # 本文档
├── docker-compose.yml
├── .env.example
├── .gitignore
└── README.md
```

---

## Phase 0：项目骨架（3–5 天）

**目标**：前后端可启动，PostgreSQL 连通，Docker 一键运行。

### 0.1 初始化仓库

- [ ] 创建 `.gitignore`（排除 `node_modules/`、`.venv/`、`storage/`、`.env`）
- [ ] 创建 `.env.example`，包含：
  - `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/maddox_quant`
  - `LLM_API_KEY=`（后续 Phase 2 使用）
  - `LLM_API_BASE=https://api.deepseek.com/v1`（示例）
  - `STORAGE_PATH=./storage/reports`
- [ ] 更新 `README.md`：项目简介、技术栈、启动命令

### 0.2 后端骨架

- [ ] 创建 `backend/requirements.txt`：
  - fastapi, uvicorn, sqlalchemy, alembic, psycopg2-binary
  - python-multipart, pydantic-settings
  - pdfplumber（Phase 1 预装）
- [ ] 创建 `backend/app/main.py`：
  - FastAPI 实例
  - CORS 配置（允许前端域名）
  - `GET /health` 健康检查
- [ ] 创建 `backend/app/core/config.py`：读取环境变量
- [ ] 创建 `backend/app/core/database.py`：SQLAlchemy engine + SessionLocal
- [ ] 初始化 Alembic：`alembic init alembic`，配置 `DATABASE_URL`

### 0.3 前端骨架

- [ ] 使用 `create-next-app` 初始化 `frontend/`（TypeScript、Tailwind、App Router）
- [ ] 安装 shadcn/ui 基础组件：Button、Input、Table、Card、Dialog、Badge
- [ ] 创建 `frontend/src/lib/api.ts`：封装 `fetch`，baseURL 指向后端
- [ ] 创建布局：顶部导航（研报 / 分析 / 关注 / 通知）
- [ ] 首页 `/`：展示项目概览 + 各模块入口

### 0.4 Docker Compose

- [ ] 编写 `docker-compose.yml`：
  - `postgres:16`（端口 5432，volume 持久化）
  - `backend`（端口 8000，依赖 postgres）
  - `frontend`（端口 3000，依赖 backend）
- [ ] 后端 Dockerfile：安装依赖、`uvicorn app.main:app`
- [ ] 前端 Dockerfile：build + start

### 0.5 CI（可选，建议）

- [ ] `.github/workflows/ci.yml`：
  - 后端：pip install + ruff/mypy（可选）
  - 前端：npm install + lint + build

### 0.6 验收标准

- [ ] `docker compose up` 后三容器正常运行
- [ ] 访问 `http://localhost:3000` 可见导航页
- [ ] 访问 `http://localhost:8000/health` 返回 `{"status":"ok"}`
- [ ] 后端日志显示 PostgreSQL 连接成功

---

## Phase 1：研报基础能力（1–2 周）

**目标**：手动导入 PDF、解析文本、列表搜索、详情查看。

### 1.1 数据库设计

- [ ] 创建迁移：`reports` 表

```sql
CREATE TABLE reports (
    id            SERIAL PRIMARY KEY,
    title         VARCHAR(500) NOT NULL,
    source        VARCHAR(200),          -- 来源（券商名等）
    author        VARCHAR(200),
    publish_date  DATE,
    industries    TEXT[],                -- 行业标签
    sectors       TEXT[],                -- 板块标签
    stocks        TEXT[],                -- 关联个股代码
    summary       TEXT,                  -- 摘要（手动或后续 AI 生成）
    full_text     TEXT,                  -- 全文
    file_path     VARCHAR(500),          -- PDF 相对路径
    file_hash     VARCHAR(64) UNIQUE,    -- SHA256 去重
    tags          TEXT[],
    status        VARCHAR(20) DEFAULT 'pending',  -- pending/parsed/failed
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 全文检索向量（迁移中创建）
ALTER TABLE reports ADD COLUMN search_vector tsvector
    GENERATED ALWAYS AS (
        to_tsvector('simple',
            coalesce(title, '') || ' ' ||
            coalesce(summary, '') || ' ' ||
            coalesce(full_text, '')
        )
    ) STORED;

CREATE INDEX idx_reports_search ON reports USING GIN(search_vector);
CREATE INDEX idx_reports_publish_date ON reports(publish_date DESC);
CREATE INDEX idx_reports_industries ON reports USING GIN(industries);
```

- [ ] 创建字典表（可选，Phase 1 可先用硬编码）：
  - `industries(id, code, name)`
  - `sectors(id, code, name)`
  - `stocks(id, code, name, sector_code)`

### 1.2 后端 API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/reports/import` | 上传 PDF + 元数据（multipart） |
| GET | `/api/reports` | 列表（分页、筛选、搜索） |
| GET | `/api/reports/{id}` | 详情 |
| GET | `/api/reports/{id}/file` | 下载/预览 PDF |
| DELETE | `/api/reports/{id}` | 删除（可选） |

**列表查询参数**：

- `q`：关键词（全文检索 `search_vector @@ plainto_tsquery`）
- `industry`、`sector`、`stock`：标签筛选
- `date_from`、`date_to`：日期范围
- `source`：来源
- `page`、`page_size`：分页（默认 20）
- `sort`：`publish_date` / `created_at`

### 1.3 PDF 解析服务

- [ ] 创建 `backend/app/services/pdf_parser.py`：
  - 使用 pdfplumber 抽取文本
  - 计算文件 SHA256 作为 `file_hash`
  - 保存文件到 `STORAGE_PATH/{hash}.pdf`
- [ ] 创建 `backend/app/tasks/parse_report.py`：
  - BackgroundTasks 异步执行
  - 更新 `full_text`、`status=parsed` 或 `status=failed`
- [ ] 导入时若 `file_hash` 重复，返回已有记录（409 或提示）

### 1.4 前端页面

#### `/reports` 研报列表

- [ ] 搜索框（关键词）
- [ ] 筛选栏：行业、日期范围、来源
- [ ] 表格列：标题、行业、关联股、来源、日期、状态
- [ ] 分页组件
- [ ] 点击行跳转详情

#### `/reports/import` 手动导入

- [ ] 文件上传（拖拽 + 选择，仅 PDF）
- [ ] 表单：标题、来源、作者、发布日期、行业（多选）、关联个股
- [ ] 提交后显示「解析中」状态，轮询或跳转详情页

#### `/reports/[id]` 研报详情

- [ ] 元信息卡片
- [ ] PDF 预览（`<iframe>` 或 pdf.js）
- [ ] 全文文本折叠展示
- [ ] 占位 Tab「AI 分析」（Phase 2 填充）

### 1.5 验收标准

- [ ] 上传 PDF 后自动解析全文入库
- [ ] 列表可按关键词搜索、按日期筛选
- [ ] 详情页可预览 PDF 原文
- [ ] 重复上传同一文件被去重拦截

---

## Phase 2：AI 单篇分析（1 周）

**目标**：对研报进行 LLM 结构化分析，展示指标、因子、观点、情感。

### 2.1 数据库设计

```sql
CREATE TABLE analysis_results (
    id              SERIAL PRIMARY KEY,
    report_id       INTEGER UNIQUE REFERENCES reports(id) ON DELETE CASCADE,
    metrics         JSONB,    -- [{"name":"营收增速","value":"15%","context":"..."}]
    factors         JSONB,    -- [{"name":"景气度","direction":"positive","weight":0.8}]
    sentiment       VARCHAR(20),  -- bullish/neutral/bearish
    investment_thesis TEXT,   -- 核心投资逻辑
    risks           JSONB,    -- 风险点列表
    raw_response    JSONB,    -- LLM 原始输出（调试用）
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE analysis_jobs (
    id          SERIAL PRIMARY KEY,
    report_id   INTEGER REFERENCES reports(id) ON DELETE CASCADE,
    status      VARCHAR(20) DEFAULT 'pending',  -- pending/running/done/failed
    error       TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    finished_at TIMESTAMPTZ
);
```

### 2.2 LLM 分析服务

- [ ] 创建 `backend/app/services/llm_client.py`：
  - OpenAI 兼容 API 调用
  - 超时、重试（最多 3 次）
- [ ] 创建 `backend/app/services/analyzer.py`：
  - Prompt 模板：输入 `title + full_text`（超长则截取前 N 字）
  - 输出 JSON Schema：

```json
{
  "summary": "200字以内摘要",
  "sentiment": "bullish|neutral|bearish",
  "investment_thesis": "核心观点",
  "metrics": [
    {"name": "PE", "value": "25x", "context": "2025E"}
  ],
  "factors": [
    {"name": "政策利好", "direction": "positive", "description": "..."}
  ],
  "risks": ["风险1", "风险2"]
}
```

- [ ] Pydantic 校验 LLM 输出，校验失败则重试

### 2.3 后端 API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/reports/{id}/analyze` | 触发分析（创建 job） |
| GET | `/api/reports/{id}/analysis` | 获取分析结果 |
| GET | `/api/analysis/jobs/{job_id}` | 查询任务状态 |

- [ ] PDF 解析完成后自动触发分析（可选开关）
- [ ] BackgroundTasks 执行分析，更新 job 状态

### 2.4 前端

- [ ] 详情页「AI 分析」Tab：
  - 情感标签（利好/中性/利空，颜色区分）
  - 核心观点
  - 关键指标表格
  - 因子列表（名称 + 方向 + 描述）
  - 风险点
- [ ] 「重新分析」按钮
- [ ] 分析中显示 loading + 轮询 job 状态

### 2.5 验收标准

- [ ] 上传研报后自动或手动触发分析
- [ ] 分析结果结构化展示
- [ ] 分析失败有错误提示，可重试
- [ ] 无 LLM Key 时 graceful 降级（提示配置）

---

## Phase 3：聚合分析看板（1 周）

**目标**：跨研报聚合统计，行业/板块维度可视化。

### 3.1 聚合 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/analysis/overview` | 全局概览 |
| GET | `/api/analysis/industry/{code}` | 行业维度 |
| GET | `/api/analysis/sector/{code}` | 板块维度 |
| GET | `/api/analysis/stock/{code}` | 个股维度 |

**`/api/analysis/overview` 返回示例**：

```json
{
  "total_reports": 128,
  "analyzed_count": 95,
  "sentiment_distribution": {"bullish": 40, "neutral": 35, "bearish": 20},
  "top_industries": [{"name": "新能源", "count": 25}],
  "top_factors": [{"name": "政策利好", "count": 18}],
  "recent_reports": [...]
}
```

### 3.2 聚合 SQL 逻辑

- [ ] 情感分布：`SELECT sentiment, COUNT(*) FROM analysis_results GROUP BY sentiment`
- [ ] 行业研报数：`SELECT unnest(industries) AS industry, COUNT(*) FROM reports GROUP BY industry`
- [ ] 因子热度：JSONB 展开 `factors` 数组，`GROUP BY factor.name`
- [ ] 时间趋势：按 `publish_date` 周/月聚合 COUNT

### 3.3 前端 `/analysis` 看板

- [ ] 概览卡片：研报总数、已分析数、情感比例
- [ ] 饼图：情感分布
- [ ] 柱状图：行业研报数量 Top 10
- [ ] 词云或条形图：Top 因子
- [ ] 折线图：近 3 个月研报发布趋势
- [ ] 点击行业/板块跳转 `/analysis/industry/[code]` 子页

### 3.4 子页面

- [ ] `/analysis/industry/[code]`：该行业研报列表 + 情感 + Top 因子 + 关联个股
- [ ] `/analysis/stock/[code]`：该个股所有关联研报 + 一致预期（目标价分布）

### 3.5 验收标准

- [ ] 看板数据随研报增加自动更新
- [ ] 行业/个股下钻可看到关联研报
- [ ] 图表在桌面和移动端可读

---

## Phase 4：关注与通知（1 周）

**目标**：全局关注行业/板块/个股，新研报/重大变化触发站内通知。

### 4.1 数据库设计

```sql
CREATE TABLE watchlists (
    id          SERIAL PRIMARY KEY,
    target_type VARCHAR(20) NOT NULL,  -- industry / sector / stock
    target_code VARCHAR(50) NOT NULL,
    target_name VARCHAR(200),
    note        TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(target_type, target_code)
);

CREATE TABLE events (
    id          SERIAL PRIMARY KEY,
    event_type  VARCHAR(50) NOT NULL,  -- new_report / sentiment_change / rating_change
    title       VARCHAR(500) NOT NULL,
    content     TEXT,
    related_type VARCHAR(20),          -- industry / sector / stock / report
    related_code VARCHAR(50),
    report_id   INTEGER REFERENCES reports(id),
    severity    VARCHAR(20) DEFAULT 'info',  -- info / warning / critical
    occurred_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE notifications (
    id          SERIAL PRIMARY KEY,
    event_id    INTEGER REFERENCES events(id) ON DELETE CASCADE,
    is_read     BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### 4.2 后端 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/watchlist` | 获取关注列表 |
| POST | `/api/watchlist` | 添加关注 |
| DELETE | `/api/watchlist/{id}` | 取消关注 |
| GET | `/api/notifications` | 通知列表（分页） |
| GET | `/api/notifications/unread-count` | 未读数 |
| PATCH | `/api/notifications/{id}/read` | 标记已读 |
| PATCH | `/api/notifications/read-all` | 全部已读 |

### 4.3 事件检测任务

- [ ] 创建 `backend/app/tasks/event_detector.py`
- [ ] APScheduler 每 5 分钟执行：
  1. 查询最近入库且未处理的 `reports`
  2. 匹配 `watchlists`（industry/sector/stock 交集）
  3. 命中则创建 `events` + `notifications`
- [ ] 事件类型（首期）：
  - `new_report`：关注范围内新发研报
  - `sentiment_change`：同一 stock 最新 vs 上一次情感变化（可选）

### 4.4 前端

#### `/watchlist` 我的关注

- [ ] 关注列表：类型、名称、备注、添加时间
- [ ] 添加关注：下拉选择行业/板块/个股（字典 API）
- [ ] 删除关注
- [ ] 从研报详情页「添加关注」快捷按钮

#### `/notifications` 通知中心

- [ ] 通知列表：标题、内容摘要、时间、已读/未读
- [ ] 点击跳转关联研报或分析页
- [ ] 「全部已读」按钮
- [ ] 导航栏未读角标（30 秒轮询 `/unread-count`）

### 4.5 验收标准

- [ ] 添加关注后，新研报入库触发通知
- [ ] 通知中心可查看历史、标记已读
- [ ] 导航栏未读角标正确更新

---

## Phase 5：自动采集（1–2 周，可后置）

**目标**：配置采集源，定时抓取研报并入库。

### 5.1 数据库设计

```sql
CREATE TABLE collect_sources (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(200) NOT NULL,
    source_type VARCHAR(50),     -- rss / html / api
    url         TEXT NOT NULL,
    cron_expr   VARCHAR(50) DEFAULT '0 8 * * *',  -- 每天 8 点
    parser      VARCHAR(50),     -- 解析器名称
    is_enabled  BOOLEAN DEFAULT TRUE,
    last_run_at TIMESTAMPTZ,
    last_status VARCHAR(20),
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE collect_logs (
    id          SERIAL PRIMARY KEY,
    source_id   INTEGER REFERENCES collect_sources(id),
    status      VARCHAR(20),
    items_found INTEGER DEFAULT 0,
    items_new   INTEGER DEFAULT 0,
    error       TEXT,
    started_at  TIMESTAMPTZ,
    finished_at TIMESTAMPTZ
);
```

### 5.2 采集框架

- [ ] 创建 `backend/app/services/collectors/base.py`：抽象基类
  - `fetch()` → 原始条目列表
  - `parse(item)` → 标准化 report dict
- [ ] 实现第一个采集器（建议 RSS 或静态 HTML 列表页 PoC）
- [ ] 下载 PDF → 走 Phase 1 相同入库流程
- [ ] APScheduler 动态加载 `collect_sources` 中启用的源

### 5.3 后端 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/admin/sources` | 采集源列表 |
| POST | `/api/admin/sources` | 新增采集源 |
| PUT | `/api/admin/sources/{id}` | 更新 |
| DELETE | `/api/admin/sources/{id}` | 删除 |
| POST | `/api/admin/sources/{id}/run` | 手动触发采集 |
| GET | `/api/admin/sources/{id}/logs` | 采集日志 |

### 5.4 前端 `/admin/sources`（管理页）

- [ ] 采集源列表：名称、URL、频率、上次状态
- [ ] 新增/编辑表单
- [ ] 「立即采集」按钮
- [ ] 采集日志查看

### 5.5 验收标准

- [ ] 配置采集源后定时自动入库
- [ ] 去重有效，不重复导入
- [ ] 采集失败有日志可查
- [ ] 新入库研报自动触发解析和分析

---

## Phase 6：打磨与上线（2–3 天）

**目标**：文档完善、部署就绪、基础运维。

### 6.1 错误处理与 UX

- [x] 全局 API 错误格式统一：`{"detail": "...", "code": "..."}`
- [x] 前端空状态：无研报、无分析、无通知
- [x] 前端 loading 态：列表骨架屏、按钮 disabled
- [x] 大文件上传限制（如 50MB）+ 友好提示

### 6.2 数据初始化

- [x] 提供 `backend/scripts/seed.py`：导入行业/板块/个股基础字典（CSV）
- [x] README 中说明如何执行 seed

### 6.3 备份与运维

- [x] `scripts/backup.sh`：`pg_dump` + 打包 `storage/`
- [x] `scripts/restore.sh`：恢复脚本
- [x] Docker Compose 生产配置：restart policy、volume 持久化

### 6.4 部署文档

- [x] README 补充：
  - 环境要求（Docker、Node 20、Python 3.11）
  - 本地开发步骤
  - 生产部署步骤（Nginx 反代示例）
  - 环境变量说明

### 6.5 验收标准

- [x] 新环境按 README 可 15 分钟内启动
- [x] 备份/恢复脚本验证通过
- [x] 主要流程无阻塞性 bug

---

## 开发顺序与依赖关系

```
Phase 0（骨架）
    │
    ▼
Phase 1（研报 CRUD + 搜索）──────────────┐
    │                                    │
    ▼                                    │
Phase 2（AI 分析）                       │
    │                                    │
    ├──────────────┐                     │
    ▼              ▼                     │
Phase 3（看板）  Phase 4（关注/通知）     │
    │              │                     │
    └──────┬───────┘                     │
           ▼                             │
      Phase 5（自动采集，可选）◄──────────┘
           │
           ▼
      Phase 6（打磨上线）
```

**建议 MVP 范围**：Phase 0 → 1 → 2，即可交付「导入 + 搜索 + AI 分析」核心能力。

---

## 环境变量清单

| 变量 | 必填 | 说明 |
|------|------|------|
| `DATABASE_URL` | 是 | PostgreSQL 连接串 |
| `STORAGE_PATH` | 是 | PDF 存储目录 |
| `LLM_API_KEY` | Phase 2+ | LLM API 密钥 |
| `LLM_API_BASE` | Phase 2+ | LLM API 地址 |
| `LLM_MODEL` | 否 | 模型名，默认 `deepseek-chat` |
| `CORS_ORIGINS` | 否 | 前端地址，默认 `http://localhost:3000` |
| `COLLECT_ENABLED` | 否 | 是否启用自动采集，默认 `false` |

---

## Git 工作流建议

1. `main` 分支保持稳定可运行
2. 每个 Phase 在 `cursor/phase-N-6d54` 分支开发（示例）
3. Phase 验收通过后 merge 到 `main`
4. 每个 Phase 完成打 tag：`v0.1.0-phase1`、`v0.2.0-phase2` ...

---

## 风险检查清单

| 检查项 | 阶段 | 说明 |
|--------|------|------|
| PDF 解析质量 | P1 | 扫描版 PDF 可能无法提取文字，需 OCR 或提示用户 |
| LLM 输出稳定性 | P2 | 必须有 JSON 校验 + 重试 |
| 中文全文检索 | P1 | `simple` 分词对中文较弱，数据量大时考虑 pg_jieba |
| 磁盘空间 | P1 | 监控 `storage/` 目录大小 |
| 无登录安全 | 全程 | 内网部署或 Nginx Basic Auth |
