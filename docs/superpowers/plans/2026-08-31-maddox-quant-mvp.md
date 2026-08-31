# Maddox Quant MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 搭建 Maddox Quant 量化投研平台 MVP：研报手动导入与全文检索、LLM 结构化分析、聚合看板、全局关注与站内通知；无登录，PostgreSQL 为唯一数据库。

**Architecture:** Next.js 前端 + FastAPI 单体后端，Docker Compose 部署三容器（frontend / backend / postgres）。PDF 存本地 `storage/reports/`，业务与全文检索均走 PostgreSQL（tsvector + JSONB）。后台任务用 FastAPI BackgroundTasks + APScheduler，不引入 Redis/ES/MinIO。

**Tech Stack:** Next.js 15, TypeScript, Tailwind, shadcn/ui, TanStack Query, Recharts · FastAPI, SQLAlchemy 2, Alembic, pdfplumber, httpx · PostgreSQL 16 · OpenAI 兼容 LLM API

**Spec:** `docs/DEVELOPMENT.md`

## Global Constraints

- 数据库：**仅 PostgreSQL**，禁止引入 Elasticsearch / Redis / MinIO
- 鉴权：**无登录**，所有 API 公开
- 关注/通知：**服务端全局** watchlist，非 per-user
- 文件存储：`STORAGE_PATH=./storage/reports`，不入 Git
- 前端端口：`4321`（避免 3000 冲突）；后端端口：`8765`
- Python ≥ 3.11，Node ≥ 20
- 测试：后端 pytest + httpx TestClient；前端 vitest（组件）+ 手工 E2E 验收
- 每个 Task 完成必须 commit；Phase 结束 push 到 `main`

---

## File Structure (Target)

```
maddox-quant/
├── frontend/
│   ├── src/app/
│   │   ├── layout.tsx              # 全局导航
│   │   ├── page.tsx                # 首页
│   │   ├── reports/
│   │   │   ├── page.tsx            # 列表
│   │   │   ├── import/page.tsx     # 导入
│   │   │   └── [id]/page.tsx       # 详情
│   │   ├── analysis/
│   │   │   ├── page.tsx            # 看板
│   │   │   ├── industry/[code]/page.tsx
│   │   │   └── stock/[code]/page.tsx
│   │   ├── watchlist/page.tsx
│   │   └── notifications/page.tsx
│   ├── src/components/             # UI 组件
│   ├── src/lib/api.ts              # API 客户端
│   └── src/types/index.ts          # 共享类型
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── core/config.py
│   │   ├── core/database.py
│   │   ├── models/                 # SQLAlchemy ORM
│   │   ├── schemas/                # Pydantic
│   │   ├── api/routes/             # 路由
│   │   ├── services/               # 业务逻辑
│   │   └── tasks/                  # 后台/定时任务
│   ├── alembic/versions/
│   └── tests/
├── storage/reports/                # .gitignore
├── docker-compose.yml
├── .env.example
└── docs/DEVELOPMENT.md
```

---

# Phase 0 — 项目骨架

---

### Task 1: 仓库基础配置

**Files:**
- Create: `.gitignore`, `.env.example`, `docker-compose.yml`
- Modify: `README.md`

**Interfaces:**
- Produces: 环境变量约定，Docker 服务名 `postgres` / `backend` / `frontend`

- [ ] **Step 1: 创建 `.gitignore`**

```
node_modules/
.venv/
__pycache__/
*.pyc
.env
storage/
frontend/.next/
backend/.pytest_cache/
```

- [ ] **Step 2: 创建 `.env.example`**

```
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/maddox_quant
STORAGE_PATH=./storage/reports
CORS_ORIGINS=http://localhost:4321
LLM_API_KEY=
LLM_API_BASE=https://api.deepseek.com/v1
LLM_MODEL=deepseek-chat
AUTO_ANALYZE=false
COLLECT_ENABLED=false
```

- [ ] **Step 3: 创建 `docker-compose.yml`**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: maddox_quant
    volumes:
      - pgdata:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build: ./backend
    ports:
      - "8765:8765"
    env_file: .env
    volumes:
      - ./storage:/app/storage
    depends_on:
      postgres:
        condition: service_healthy

  frontend:
    build: ./frontend
    ports:
      - "4321:4321"
    environment:
      NEXT_PUBLIC_API_URL: http://localhost:8765
    depends_on:
      - backend

volumes:
  pgdata:
```

- [ ] **Step 4: Commit**

```bash
git add .gitignore .env.example docker-compose.yml README.md
git commit -m "chore: add repo config and docker-compose skeleton"
```

---

### Task 2: 后端健康检查

**Files:**
- Create: `backend/requirements.txt`, `backend/Dockerfile`, `backend/app/main.py`, `backend/app/core/config.py`, `backend/tests/test_health.py`

**Interfaces:**
- Produces: `GET /health` → `{"status": "ok", "db": "connected"|"error"}`

- [ ] **Step 1: 写失败测试**

```python
# backend/tests/test_health.py
from httpx import ASGITransport, AsyncClient
from app.main import app

async def test_health_returns_ok():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd backend && pip install -r requirements.txt && pytest tests/test_health.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'app'`

- [ ] **Step 3: 实现最小后端**

`backend/requirements.txt`:
```
fastapi>=0.115.0
uvicorn[standard]>=0.32.0
sqlalchemy>=2.0.0
psycopg2-binary>=2.9.0
pydantic-settings>=2.0.0
httpx>=0.27.0
pytest>=8.0.0
pytest-asyncio>=0.24.0
```

`backend/app/core/config.py`:
```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str = "postgresql://postgres:postgres@localhost:5432/maddox_quant"
    storage_path: str = "./storage/reports"
    cors_origins: str = "http://localhost:4321"
    llm_api_key: str = ""
    llm_api_base: str = "https://api.deepseek.com/v1"
    llm_model: str = "deepseek-chat"
    auto_analyze: bool = False
    collect_enabled: bool = False

    class Config:
        env_file = ".env"

settings = Settings()
```

`backend/app/main.py`:
```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings

app = FastAPI(title="Maddox Quant API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
def health():
    return {"status": "ok", "db": "pending"}
```

`backend/Dockerfile`:
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8765"]
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd backend && pytest tests/test_health.py -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/
git commit -m "feat(backend): add FastAPI health endpoint"
```

---

### Task 3: 数据库连接

**Files:**
- Create: `backend/app/core/database.py`, `backend/tests/test_database.py`
- Modify: `backend/app/main.py`

**Interfaces:**
- Produces: `get_db()` dependency → `Session`
- Produces: `health()` 检查 DB 连通性

- [ ] **Step 1: 写失败测试**

```python
# backend/tests/test_database.py
from sqlalchemy import text
from app.core.database import engine

def test_database_connection():
    with engine.connect() as conn:
        result = conn.execute(text("SELECT 1"))
        assert result.scalar() == 1
```

- [ ] **Step 2: 运行确认失败**

Run: `cd backend && pytest tests/test_database.py -v`
Expected: FAIL — `engine` not defined

- [ ] **Step 3: 实现 database.py**

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.core.config import settings

engine = create_engine(settings.database_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class Base(DeclarativeBase):
    pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

更新 `health()` 使用 `engine.connect()` 返回 `"db": "connected"` 或 `"error"`.

- [ ] **Step 4: 运行测试**

Run: `cd backend && DATABASE_URL=postgresql://postgres:postgres@localhost:5432/maddox_quant pytest tests/test_database.py -v`
Expected: PASS（需本地 postgres 运行）

- [ ] **Step 5: Commit**

```bash
git add backend/app/core/database.py backend/tests/test_database.py backend/app/main.py
git commit -m "feat(backend): add PostgreSQL connection"
```

---

### Task 4: Alembic 初始化

**Files:**
- Create: `backend/alembic.ini`, `backend/alembic/env.py`, `backend/alembic/versions/.gitkeep`
- Modify: `backend/requirements.txt`（加 `alembic`）

**Interfaces:**
- Produces: `alembic upgrade head` 可执行

- [ ] **Step 1: 初始化 Alembic**

Run: `cd backend && alembic init alembic`

- [ ] **Step 2: 配置 env.py 引用 `settings.database_url` 和 `Base.metadata`**

- [ ] **Step 3: 验证迁移命令**

Run: `cd backend && alembic upgrade head`
Expected: 无报错

- [ ] **Step 4: Commit**

```bash
git add backend/alembic backend/alembic.ini backend/requirements.txt
git commit -m "chore(backend): init alembic migrations"
```

---

### Task 5: 前端骨架与导航

**Files:**
- Create: `frontend/` via create-next-app
- Create: `frontend/src/lib/api.ts`, `frontend/src/app/layout.tsx`, `frontend/src/app/page.tsx`
- Create: `frontend/Dockerfile`

**Interfaces:**
- Produces: `apiFetch(path, options?)` → fetch wrapper
- Produces: 导航链接 `/reports`, `/analysis`, `/watchlist`, `/notifications`

- [ ] **Step 1: 初始化 Next.js**

Run:
```bash
npx create-next-app@latest tmp-scaffold --typescript --tailwind --eslint --app --src-dir --no-import-alias
mv tmp-scaffold/* tmp-scaffold/.[!.]* frontend/ 2>/dev/null; rmdir tmp-scaffold
```

修改 `frontend/package.json` scripts dev 端口: `"dev": "next dev -p 4321"`

- [ ] **Step 2: 安装 shadcn/ui 基础组件**

Run: `cd frontend && npx shadcn@latest init -y && npx shadcn@latest add button input table card badge tabs`

- [ ] **Step 3: 创建 api.ts**

```typescript
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8765";

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<T>;
}
```

- [ ] **Step 4: 创建 layout.tsx 导航**

导航项：研报、分析看板、我的关注、通知中心

- [ ] **Step 5: 创建首页调用 `/health` 显示状态**

- [ ] **Step 6: 创建 Dockerfile**

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 4321
CMD ["npm", "run", "start", "--", "-p", "4321"]
```

- [ ] **Step 7: 验证**

Run: `docker compose up --build`
Expected: `http://localhost:4321` 可见导航；`http://localhost:8765/health` 返回 ok

- [ ] **Step 8: Commit**

```bash
git add frontend/
git commit -m "feat(frontend): add Next.js skeleton with navigation"
```

---

# Phase 1 — 研报基础能力

---

### Task 6: Report 模型与迁移

**Files:**
- Create: `backend/app/models/report.py`, `backend/alembic/versions/001_create_reports.py`
- Modify: `backend/app/models/__init__.py`

**Interfaces:**
- Produces: `Report` ORM model，字段见 spec
- Produces: `search_vector` GENERATED ALWAYS AS tsvector

- [ ] **Step 1: 写模型测试**

```python
# backend/tests/test_report_model.py
from app.models.report import Report

def test_report_has_required_fields():
    r = Report(title="测试研报", status="pending")
    assert r.title == "测试研报"
    assert r.status == "pending"
```

- [ ] **Step 2: 实现 Report 模型**

```python
from sqlalchemy import String, Text, Date, ARRAY, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base

class Report(Base):
    __tablename__ = "reports"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(500))
    source: Mapped[str | None] = mapped_column(String(200))
    author: Mapped[str | None] = mapped_column(String(200))
    publish_date: Mapped[Date | None]
    industries: Mapped[list[str] | None] = mapped_column(ARRAY(String))
    sectors: Mapped[list[str] | None] = mapped_column(ARRAY(String))
    stocks: Mapped[list[str] | None] = mapped_column(ARRAY(String))
    summary: Mapped[str | None] = mapped_column(Text)
    full_text: Mapped[str | None] = mapped_column(Text)
    file_path: Mapped[str | None] = mapped_column(String(500))
    file_hash: Mapped[str | None] = mapped_column(String(64), unique=True)
    tags: Mapped[list[str] | None] = mapped_column(ARRAY(String))
    status: Mapped[str] = mapped_column(String(20), default="pending")
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
```

- [ ] **Step 3: 写 Alembic 迁移**（含 search_vector + GIN 索引，见 DEVELOPMENT.md §1.1）

- [ ] **Step 4: 运行迁移**

Run: `cd backend && alembic upgrade head`

- [ ] **Step 5: Commit**

```bash
git add backend/app/models backend/alembic/versions/001_create_reports.py backend/tests/test_report_model.py
git commit -m "feat(backend): add Report model and migration"
```

---

### Task 7: PDF 解析服务

**Files:**
- Create: `backend/app/services/pdf_parser.py`, `backend/tests/test_pdf_parser.py`, `backend/tests/fixtures/sample.pdf`

**Interfaces:**
- Produces: `compute_file_hash(content: bytes) -> str`
- Produces: `extract_text_from_pdf(content: bytes) -> str`
- Produces: `save_pdf(content: bytes, storage_path: str) -> tuple[str, str]` → `(file_path, file_hash)`

- [ ] **Step 1: 写失败测试**

```python
# backend/tests/test_pdf_parser.py
from app.services.pdf_parser import compute_file_hash

def test_compute_file_hash_deterministic():
    h1 = compute_file_hash(b"hello")
    h2 = compute_file_hash(b"hello")
    assert h1 == h2
    assert len(h1) == 64
```

- [ ] **Step 2: 运行确认失败**

Run: `cd backend && pytest tests/test_pdf_parser.py -v`
Expected: FAIL

- [ ] **Step 3: 实现 pdf_parser.py**

```python
import hashlib
from pathlib import Path
import pdfplumber
import io

def compute_file_hash(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()

def extract_text_from_pdf(content: bytes) -> str:
    with pdfplumber.open(io.BytesIO(content)) as pdf:
        pages = [page.extract_text() or "" for page in pdf.pages]
    return "\n".join(pages).strip()

def save_pdf(content: bytes, storage_path: str) -> tuple[str, str]:
    file_hash = compute_file_hash(content)
    dest = Path(storage_path) / f"{file_hash}.pdf"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(content)
    return str(dest.relative_to(storage_path.parent) if storage_path.endswith("reports") else dest), file_hash
```

- [ ] **Step 4: 添加 sample.pdf fixture 并测试 extract_text**

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/pdf_parser.py backend/tests/
git commit -m "feat(backend): add PDF parse and hash service"
```

---

### Task 8: 研报导入 API

**Files:**
- Create: `backend/app/schemas/report.py`, `backend/app/api/routes/reports.py`, `backend/app/tasks/parse_report.py`, `backend/tests/test_reports_import.py`
- Modify: `backend/app/main.py`（注册路由）

**Interfaces:**
- Produces: `POST /api/reports/import` → `ReportResponse`
- Produces: `GET /api/reports` → paginated list
- Produces: `GET /api/reports/{id}` → detail
- Produces: `GET /api/reports/{id}/file` → FileResponse

- [ ] **Step 1: 写导入失败测试**

```python
async def test_import_requires_pdf(client):
    response = await client.post("/api/reports/import", data={"title": "t"})
    assert response.status_code == 422
```

- [ ] **Step 2: 实现 Pydantic schemas**

```python
class ReportCreate(BaseModel):
    title: str
    source: str | None = None
    author: str | None = None
    publish_date: date | None = None
    industries: list[str] = []
    stocks: list[str] = []

class ReportResponse(BaseModel):
    id: int
    title: str
    status: str
    model_config = ConfigDict(from_attributes=True)

class ReportListResponse(BaseModel):
    items: list[ReportResponse]
    total: int
    page: int
    page_size: int
```

- [ ] **Step 3: 实现 import 路由**

逻辑：
1. 校验 file 为 PDF
2. 计算 hash，若已存在返回 409 + 已有 report id
3. 保存文件，创建 Report(status=pending)
4. BackgroundTasks 调用 `parse_report_task(report_id)`

- [ ] **Step 4: 实现 parse_report_task**

读取 PDF → extract_text → 更新 full_text, status=parsed/failed

- [ ] **Step 5: 实现列表/详情/文件下载**

列表支持 `q`, `industry`, `date_from`, `date_to`, `page`, `page_size`

全文搜索 SQL:
```python
from sqlalchemy import func
query.filter(func.to_tsquery('simple', q).op('@@')(Report.search_vector))  # 或用 text()
```

- [ ] **Step 6: 运行测试**

Run: `cd backend && pytest tests/test_reports_import.py -v`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add backend/app/schemas backend/app/api backend/app/tasks backend/tests/test_reports_import.py
git commit -m "feat(backend): add report import and list APIs"
```

---

### Task 9: 研报前端页面

**Files:**
- Create: `frontend/src/types/report.ts`, `frontend/src/app/reports/page.tsx`, `frontend/src/app/reports/import/page.tsx`, `frontend/src/app/reports/[id]/page.tsx`, `frontend/src/components/reports/ReportTable.tsx`, `frontend/src/components/reports/ImportForm.tsx`

**Interfaces:**
- Consumes: `GET /api/reports`, `POST /api/reports/import`, `GET /api/reports/{id}`, `GET /api/reports/{id}/file`

- [ ] **Step 1: 定义 TypeScript 类型**

```typescript
export interface Report {
  id: number;
  title: string;
  source?: string;
  author?: string;
  publish_date?: string;
  industries?: string[];
  stocks?: string[];
  summary?: string;
  full_text?: string;
  status: "pending" | "parsed" | "failed";
  created_at: string;
}
```

- [ ] **Step 2: 实现列表页**

TanStack Query 拉取 `/api/reports?page=1&page_size=20`
搜索框 debounce 300ms 更新 `q` 参数
Table 列：标题、行业、来源、日期、状态

- [ ] **Step 3: 实现导入页**

FormData 上传 PDF + 元数据
成功后 redirect `/reports/{id}`

- [ ] **Step 4: 实现详情页**

元信息 Card + iframe PDF 预览 (`/api/reports/{id}/file`)
全文 Collapsible
Tabs: 「原文」|「AI 分析」(Phase 2 占位)

- [ ] **Step 5: 空状态与 loading 骨架屏**

- [ ] **Step 6: 手工验收**

1. 上传 PDF → 列表出现 → 详情可预览
2. 重复上传 → 提示已存在

- [ ] **Step 7: Commit**

```bash
git add frontend/src/
git commit -m "feat(frontend): add report list, import, and detail pages"
```

---

# Phase 2 — AI 单篇分析

---

### Task 10: 分析模型与迁移

**Files:**
- Create: `backend/app/models/analysis.py`, `backend/alembic/versions/002_create_analysis.py`

**Interfaces:**
- Produces: `AnalysisResult`, `AnalysisJob` models

- [ ] **Step 1: 写迁移**（见 DEVELOPMENT.md §2.1 analysis_results + analysis_jobs）

- [ ] **Step 2: 运行 `alembic upgrade head`**

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(backend): add analysis models"
```

---

### Task 11: LLM 客户端

**Files:**
- Create: `backend/app/services/llm_client.py`, `backend/tests/test_llm_client.py`

**Interfaces:**
- Produces: `async def chat_completion(messages: list[dict], json_mode: bool = True) -> str`

- [ ] **Step 1: 写测试（mock httpx）**

```python
@pytest.mark.asyncio
async def test_llm_client_raises_without_api_key(monkeypatch):
    monkeypatch.setattr("app.core.config.settings.llm_api_key", "")
    with pytest.raises(ValueError, match="LLM_API_KEY"):
        await chat_completion([{"role": "user", "content": "hi"}])
```

- [ ] **Step 2: 实现 llm_client.py**

使用 httpx AsyncClient POST `{llm_api_base}/chat/completions`
headers: Authorization Bearer
body: model, messages, response_format={"type":"json_object"}
重试 3 次，timeout 60s

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(backend): add LLM client with retry"
```

---

### Task 12: 分析服务

**Files:**
- Create: `backend/app/services/analyzer.py`, `backend/app/schemas/analysis.py`, `backend/tests/test_analyzer.py`

**Interfaces:**
- Produces: `class AnalysisOutput(BaseModel)` — summary, sentiment, investment_thesis, metrics, factors, risks
- Produces: `async def analyze_report(report: Report) -> AnalysisOutput`

- [ ] **Step 1: 定义 AnalysisOutput Pydantic model**

```python
class MetricItem(BaseModel):
    name: str
    value: str
    context: str | None = None

class FactorItem(BaseModel):
    name: str
    direction: Literal["positive", "negative", "neutral"]
    description: str | None = None

class AnalysisOutput(BaseModel):
    summary: str
    sentiment: Literal["bullish", "neutral", "bearish"]
    investment_thesis: str
    metrics: list[MetricItem]
    factors: list[FactorItem]
    risks: list[str]
```

- [ ] **Step 2: 写 prompt 模板**

System: 你是专业证券分析师，输出严格 JSON
User: 标题 + full_text（截断 12000 字）

- [ ] **Step 3: 写测试 mock LLM 返回合法 JSON**

- [ ] **Step 4: 实现 analyze_report：调用 LLM → json.loads → AnalysisOutput.model_validate**

校验失败重试最多 2 次

- [ ] **Step 5: Commit**

```bash
git commit -m "feat(backend): add report analyzer service"
```

---

### Task 13: 分析 API 与后台任务

**Files:**
- Create: `backend/app/tasks/analyze_report.py`, `backend/app/api/routes/analysis.py`, `backend/tests/test_analysis_api.py`
- Modify: `backend/app/tasks/parse_report.py`（解析完成后若 AUTO_ANALYZE=true 触发分析）

**Interfaces:**
- Produces: `POST /api/reports/{id}/analyze` → `{job_id: int}`
- Produces: `GET /api/reports/{id}/analysis` → AnalysisResult | 404
- Produces: `GET /api/analysis/jobs/{job_id}` → `{status, error?}`

- [ ] **Step 1: 写测试触发分析**

```python
async def test_analyze_creates_job(client, db, sample_report):
    r = await client.post(f"/api/reports/{sample_report.id}/analyze")
    assert r.status_code == 202
    assert "job_id" in r.json()
```

- [ ] **Step 2: 实现 analyze_report_task**

更新 job status: pending → running → done/failed
保存 AnalysisResult + raw_response

- [ ] **Step 3: 无 LLM Key 时返回 503 + 清晰错误信息**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(backend): add analysis API and background job"
```

---

### Task 14: 分析前端 Tab

**Files:**
- Create: `frontend/src/components/reports/AnalysisPanel.tsx`
- Modify: `frontend/src/app/reports/[id]/page.tsx`

**Interfaces:**
- Consumes: analysis API endpoints

- [ ] **Step 1: AnalysisPanel 展示**

情感 Badge（bullish=绿, bearish=红, neutral=灰）
核心观点段落
指标 Table
因子 List（带方向图标）
风险 Bullet list

- [ ] **Step 2: 「开始分析」/「重新分析」按钮**

点击 POST analyze → 轮询 job 每 2s → 完成后刷新

- [ ] **Step 3: 无 LLM Key 时显示配置提示**

- [ ] **Step 4: Commit + Phase 2 验收**

验收清单：
- [ ] 上传研报 → 手动分析 → 结果展示
- [ ] 分析失败可重试
- [ ] AUTO_ANALYZE=true 时解析后自动分析

```bash
git commit -m "feat(frontend): add AI analysis panel on report detail"
git tag v0.2.0-mvp-core
```

---

# Phase 3 — 聚合分析看板

---

### Task 15: 聚合 API

**Files:**
- Create: `backend/app/services/aggregation.py`, `backend/app/api/routes/aggregation.py`, `backend/tests/test_aggregation.py`

**Interfaces:**
- Produces: `GET /api/analysis/overview`
- Produces: `GET /api/analysis/industry/{code}`
- Produces: `GET /api/analysis/stock/{code}`

- [ ] **Step 1: 写 overview 测试**

```python
def test_overview_returns_counts(client, seeded_db):
    r = client.get("/api/analysis/overview")
    assert r.status_code == 200
    data = r.json()
    assert "total_reports" in data
    assert "sentiment_distribution" in data
```

- [ ] **Step 2: 实现 SQL 聚合**

情感: `GROUP BY sentiment`
行业: `unnest(industries)`
因子热度: `jsonb_array_elements(factors) -> 'name'`
趋势: `date_trunc('week', publish_date)`

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(backend): add analysis aggregation APIs"
```

---

### Task 16: 看板前端

**Files:**
- Create: `frontend/src/app/analysis/page.tsx`, `frontend/src/app/analysis/industry/[code]/page.tsx`, `frontend/src/app/analysis/stock/[code]/page.tsx`, `frontend/src/components/analysis/OverviewCharts.tsx`

- [ ] **Step 1: 概览页 4 卡片 + 4 图表**（Recharts 饼图/柱图/折线图）

- [ ] **Step 2: 行业/个股下钻页**

- [ ] **Step 3: 响应式布局 mobile/desktop**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(frontend): add analysis dashboard"
git tag v0.3.0-dashboard
```

---

# Phase 4 — 关注与通知

---

### Task 17: Watchlist / Event / Notification 模型

**Files:**
- Create: `backend/app/models/watchlist.py`, `backend/alembic/versions/003_create_watchlist_events.py`

- [ ] **Step 1: 迁移三表** watchlists, events, notifications（见 DEVELOPMENT.md §4.1）

- [ ] **Step 2: Commit**

---

### Task 18: 关注与通知 API

**Files:**
- Create: `backend/app/api/routes/watchlist.py`, `backend/app/api/routes/notifications.py`, `backend/tests/test_watchlist.py`

**Interfaces:**
- Produces: CRUD `/api/watchlist`
- Produces: `/api/notifications`, `/api/notifications/unread-count`, PATCH read

- [ ] **Step 1: 测试添加关注**

```python
async def test_add_watchlist(client):
    r = await client.post("/api/watchlist", json={"target_type": "industry", "target_code": "new_energy", "target_name": "新能源"})
    assert r.status_code == 201
```

- [ ] **Step 2: 实现路由**

- [ ] **Step 3: Commit**

---

### Task 19: 事件检测定时任务

**Files:**
- Create: `backend/app/tasks/event_detector.py`
- Modify: `backend/app/main.py`（启动 APScheduler）

- [ ] **Step 1: 实现 detect_new_report_events()**

每 5 分钟：
1. 查最近 10 分钟新 reports
2. 匹配 watchlists (industry/sector/stock 数组交集)
3. INSERT events + notifications

- [ ] **Step 2: 写单元测试 mock DB**

- [ ] **Step 3: Commit**

---

### Task 20: 关注与通知前端

**Files:**
- Create: `frontend/src/app/watchlist/page.tsx`, `frontend/src/app/notifications/page.tsx`, `frontend/src/components/layout/NotificationBadge.tsx`
- Modify: `frontend/src/app/layout.tsx`

- [ ] **Step 1: 关注页 CRUD**

- [ ] **Step 2: 通知中心列表 + 全部已读**

- [ ] **Step 3: 导航栏未读角标 30s 轮询**

- [ ] **Step 4: 研报详情「添加关注」快捷按钮**

- [ ] **Step 5: Commit + 验收**

```bash
git commit -m "feat: add watchlist and notifications"
git tag v0.4.0-notifications
```

---

# Phase 5 — 自动采集（可后置）

---

### Task 21: 采集源模型与框架

**Files:**
- Create: `backend/app/models/collect_source.py`, `backend/app/services/collectors/base.py`, `backend/app/services/collectors/rss_collector.py`, `backend/alembic/versions/004_create_collect_sources.py`

- [ ] **Step 1: 迁移 collect_sources + collect_logs**

- [ ] **Step 2: BaseCollector 抽象类 fetch/parse**

- [ ] **Step 3: RSS PoC 采集器**

- [ ] **Step 4: Commit**

---

### Task 22: 采集 API 与管理页

**Files:**
- Create: `backend/app/api/routes/admin_sources.py`, `frontend/src/app/admin/sources/page.tsx`

- [ ] **Step 1: CRUD + POST run + GET logs**

- [ ] **Step 2: APScheduler 动态加载 enabled sources**

- [ ] **Step 3: 管理页 UI**

- [ ] **Step 4: Commit**

```bash
git commit -m "feat: add report collection framework"
git tag v0.5.0-collect
```

---

# Phase 6 — 打磨上线

---

### Task 23: 种子数据与脚本

**Files:**
- Create: `backend/scripts/seed.py`, `backend/data/industries.csv`, `backend/data/stocks.csv`, `scripts/backup.sh`, `scripts/restore.sh`

- [ ] **Step 1: seed.py 导入行业/个股字典**

- [ ] **Step 2: backup.sh = pg_dump + tar storage/**

- [ ] **Step 3: 更新 README 启动/部署/备份说明**

- [ ] **Step 4: Commit**

---

### Task 24: CI 与错误处理

**Files:**
- Create: `.github/workflows/ci.yml`
- Modify: `backend/app/main.py`（全局 exception handler）

- [ ] **Step 1: CI — backend pytest + frontend build**

- [ ] **Step 2: 统一错误格式 `{"detail": "...", "code": "..."}`**

- [ ] **Step 3: 前端全局 error boundary + 空状态**

- [ ] **Step 4: Commit + 最终验收**

```bash
git commit -m "chore: add CI, error handling, and deployment docs"
git tag v1.0.0
```

---

## Self-Review

### Spec Coverage

| Spec 要求 | 对应 Task |
|-----------|-----------|
| 手动导入 PDF | Task 7, 8, 9 |
| 全文搜索筛选 | Task 6, 8 |
| 列表/详情 | Task 8, 9 |
| LLM 分析指标/因子 | Task 10–14 |
| 聚合看板 | Task 15, 16 |
| 全局关注 | Task 17, 18, 20 |
| 站内通知 | Task 19, 20 |
| 自动采集 | Task 21, 22 |
| 无登录 | Global Constraints |
| 仅 PostgreSQL | Global Constraints |
| Docker 部署 | Task 1, 5 |
| 备份/种子 | Task 23 |

无遗漏。

### Placeholder Scan

无 TBD / TODO / "implement later" / "similar to Task N"。

### Type Consistency

- `Report.status`: `"pending"|"parsed"|"failed"` — 前后端一致
- `AnalysisOutput.sentiment`: `"bullish"|"neutral"|"bearish"` — 前后端一致
- API 路径前缀 `/api/` — 全部 Task 统一

---

## 建议执行顺序与里程碑

| 里程碑 | Tasks | 交付物 |
|--------|-------|--------|
| **M0 可运行** | 1–5 | Docker 启动，健康检查，导航页 |
| **M1 研报 MVP** | 6–9 | 导入/搜索/详情 |
| **M2 AI 分析** | 10–14 | LLM 结构化分析 |
| **M3 看板** | 15–16 | 聚合图表 |
| **M4 通知** | 17–20 | 关注+通知 |
| **M5 采集** | 21–22 | 自动采集（可选） |
| **M6 上线** | 23–24 | CI + 文档 + 备份 |

**推荐首版确认范围：** M0 → M2（Task 1–14），约 22 个 Task。
