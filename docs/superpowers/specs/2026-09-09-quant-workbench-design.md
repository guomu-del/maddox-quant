# 量化工作台设计（仿真交易 + CTA 回测）

日期：2026-09-09  
状态：已确认 — 只做仿真，不做实盘  
范围：规划与接口约定，本文不含实现代码

## 1. 目标

在 Maddox Quant 增加「量化」工作台 `/quant`，对标 VeighNa 中三块能力的 Web 缩小版：

| 页签 | 对标 | 一期能力 |
|------|------|----------|
| 行情 | chart_wizard | 自选、日 K、报价、跳转研报/分析 |
| 交易 | paper_account | 仿真下单、撤单、持仓、成交、资金 |
| 回测 | cta_backtester | 内置 CTA 策略、日 K 回测、净值与成交 |

产品定位仍是投研站上的纸面交易与回测，不是券商/期货柜台。

## 2. 已锁定决策

- **只做仿真，不做实盘。** 不接 CTP、XTP 或任何券商柜台，不保存交易账户密码，不出现「实盘」开关。
- 无登录，全站一个仿真账户（与现有 watchlist / 研报一致）。
- A 股 **只做多**，不支持融券、期货、期权、港股、美股。
- 股票代码统一 **6 位数字**，与 `watchlists.target_code`、行情页一致。
- API 字段英文（`change_pct`、`side`、`order_type`），中文仅用于 UI。
- 行情快照与 K 线：**请求时拉 AKShare + 进程内 TTL**，不写入 Postgres。
- 仿真账本与回测结果：**必须写入 Neon/Postgres**，刷新后仍在。
- 路由禁止 `import akshare`；行情仍走 `MarketProvider`。
- 回测与仿真账户隔离：跑回测不改纸面持仓与现金。
- 不执行用户上传的 Python；策略仅仓库内置模板。
- DeepSeek 不参与下单与回测。
- `/market` 全市场看板保留，不被 `/quant` 替代。

## 3. 不做

- 实盘网关、资金密码、两融、夜盘、Level-2 / 五档 / 分时 / Tick
- 算法单（TWAP、冰山）、条件单、价差、期权
- 多账户、鉴权、审计流水
- 用户自定义策略脚本
- 涨跌停一字板、停牌精细撮合（一期简化并在 UI 注明）
- 把 vn.py 作为子进程嵌入

## 4. 页面与路由

导航增加「量化」；首页增加入口卡。

```
/quant                      默认行情页签
/quant?code=600519          打开指定标的
/quant?tab=trade&code=600519
/quant?tab=backtest&code=600519
```

三栏 + 顶栏页签，zinc 风格，红涨绿跌：

```
[行情] [交易] [回测]
┌──────────┬─────────────────────────┬────────────────┐
│ 搜索     │ 标的名 最新价 涨跌幅      │ 右栏随页签变化   │
│ 自选股票 │ 中部：K 线 / 下单簿 / 净值 │                │
└──────────┴─────────────────────────┴────────────────┘
```

- **行情**：左自选；中日 K + 成交量 + MA5/10/20 开关；右报价摘要、研报 `/reports?q={code}`、分析 `/analysis/stock/{code}`、关注/取消。
- **交易**：中部为下单区（方向、市价/限价、价格、数量）+ 当前标的持仓；右或下为委托表、成交表、账户现金/冻结/总权益；支持撤单与「重置仿真账户」。
- **回测**：选策略、参数、起止日、初始资金；运行后展示净值曲线、指标、回测成交；明确文案「不影响仿真账户」。

空态：未选代码时提示搜索或从自选打开。失败：明确错误，不画假 K 线、不假装成交。

`/market` 个股代码可链到 `/quant?code=`。

## 5. 行情数据

沿用现有 TTL 缓存与 `MarketProvider`。新增：

```
GET /api/market/stocks/{code}
GET /api/market/stocks/{code}/kline?period=daily&limit=250
```

- `{code}`：6 位数字，非法则 400。
- 单标报价优先从全市场快照缓存取一行；缓存没有再按代码拉源（若源站无单标接口，则触发/等待全表缓存）。
- K 线使用 AKShare 日线接口（实现时以当时可用的 `stock_zh_a_hist` 或已验证等价接口为准；东财失败可回落新浪日线，与行情页同一原则）。
- K 线模型：`date, open, high, low, close, volume, amount`。
- 缓存键：`kline:{code}:daily:{limit}`。TTL 默认 10 分钟（可用环境变量，默认即可）。
- 失败：有过期缓存则 `stale=true`；否则 502 `market_source_error`。
- 回测拉更长历史时用更大 `limit` 或 `start/end`，缓存键包含区间，仍不落库。

自选复用：

```
GET/POST/DELETE /api/watchlist
```

工作台左侧只列出 `target_type=stock` 的项。

## 6. 仿真交易

### 6.1 账户

全站一条 `paper_accounts` 记录（id 固定为 1 或启动时确保存在）。

字段：`cash`（可用现金）、`frozen`（挂买冻结）、`starting_cash`（重置基准，默认 1_000_000）、`updated_at`。

总权益 = 现金 + 冻结 + 持仓市值（市值用当前快照 `last`，无价则用成本）。

`POST /api/paper/account/reset`：清空该账户下全部委托、成交、持仓，现金恢复为 `starting_cash`，冻结为 0。

### 6.2 订单

```
POST /api/paper/orders
{ "code": "600519", "side": "buy"|"sell", "order_type": "market"|"limit", "price": number|null, "quantity": int }
```

校验：

- `quantity` 为正整数；A 股买入数量为 100 的整数倍（卖出允许清仓零股）。
- 市价单 `price` 必须为空；限价单 `price` 必须 > 0。
- 买入：`quantity * ref_price + fee` 不得超过可用现金。市价 `ref_price=last`，限价 `ref_price=price`。
- 卖出：不得超过该代码持仓数量。
- 无有效 `last` 时市价单 `rejected`。

状态：`pending` | `filled` | `cancelled` | `rejected`。一期不拆部分成交，要么全成要么继续挂。

### 6.3 撮合（必须按此执行，避免「随便成交」）

触发点：下单当下；以及随后任意一次成功刷新股票快照之后，扫描所有 `pending` 限价单。

- 买入市价：以当前 `last` 全成。
- 卖出市价：以当前 `last` 全成。
- 买入限价：`last <= price` 则以 `last` 全成，否则保持 `pending`。
- 卖出限价：`last >= price` 则以 `last` 全成，否则保持 `pending`。
- 成交价一律用触发时的 `last`（限价触及后按市价成交，不保证按挂单价）。
- 无盘口、不成交量约束、不模拟排队。

费用（常数，代码内可配置，不必做成管理后台）：

- 佣金：成交额 × 0.0003，单笔最低 5 元
- 印花税：仅卖出，成交额 × 0.0005
- 买入冻结 = `quantity * price`（限价）或 `quantity * last`（市价尝试），成交后按实际成交额 + 费用扣减，多余冻结退回现金

持仓成本：移动平均。卖出减少数量并按比例减少成本额。数量为 0 则删除该持仓行。

### 6.4 仿真 API

```
GET  /api/paper/account
POST /api/paper/account/reset
GET  /api/paper/positions
GET  /api/paper/orders?status=&code=
GET  /api/paper/trades?code=
POST /api/paper/orders
POST /api/paper/orders/{id}/cancel
```

取消：仅 `pending` 可撤；买入撤单释放冻结。

实现放在 `PaperBroker` 服务，不引入「实盘 Gateway」类型。

## 7. CTA 回测

### 7.1 内置策略

仅两个，参数均为 JSON 数字：

| id | 名称 | 参数 | 规则 |
|----|------|------|------|
| `dual_ma` | 双均线 | `fast` 默认 5，`slow` 默认 20 | `fast` 上穿 `slow` 全仓买，下穿全仓卖 |
| `breakout` | 唐奇安突破 | `n` 默认 20 | 收盘创 `n` 日新高（不含当日）则买，新低则卖 |

策略只看到截止当日的 K 线，禁止读取未来 bar。引擎在 `on_bar` 之后若产生开平仓信号，于 **下一根 K 线开盘价** 成交。最后一根有信号但无下一根则不成交。

仓位：默认全仓（买入金额 = 当时现金，股数向下取整到 100 股）。卖出全部持仓。

费用与仿真相同。初始资金请求里传 `cash`，默认 1_000_000，**只用于该次回测**。

### 7.2 运行方式

`POST /api/quant/backtests` 同步执行（日 K 至多约 800 根、单标的，预期数秒）。超时或源站失败则 502/504，不写半截成功状态。

请求：

```
{
  "code": "600519",
  "strategy_id": "dual_ma",
  "params": { "fast": 5, "slow": 20 },
  "start": "2023-01-01",
  "end": "2026-09-01",
  "cash": 1000000
}
```

`start`/`end` 缺省：`end` 为今天上海日历，`start` 为 `end` 减 3 年。

响应含：`id, code, strategy_id, params, start, end, cash, status, metrics, equity, trades, created_at`。

`metrics`：`total_return, annual_return, max_drawdown, win_rate, profit_factor, trade_count`。无交易时指标为 0 或 null 并 `trade_count=0`，不算失败。

`equity`：`[{ "date", "value" }, ...]`。`trades` 与仿真成交字段同类（回测专用，不写入 `paper_trades`）。

```
GET /api/quant/strategies
GET /api/quant/backtests/{id}
```

每次运行写入 `backtest_runs`。`GET /api/quant/backtests?limit=20` 返回最近运行（新到旧），便于刷新后仍能打开上次结果。

## 8. 数据表

行情无新表。新增 Alembic 迁移（名称可微调）：

**paper_accounts**  
`id, cash, frozen, starting_cash, updated_at`

**paper_orders**  
`id, account_id, code, name, side, order_type, price, quantity, filled_qty, status, reject_reason, created_at, updated_at`

**paper_trades**  
`id, account_id, order_id, code, name, side, price, quantity, commission, stamp_tax, traded_at`

**paper_positions**  
`id, account_id, code, name, quantity, cost_amount`  
唯一约束 `(account_id, code)`

**backtest_runs**  
`id, code, strategy_id, params (JSONB), start, end, cash, status, metrics (JSONB), equity (JSONB), trades (JSONB), error, created_at`

## 9. 与现有模块

| 模块 | 关系 |
|------|------|
| `/market` | 代码链到 `/quant?code=`；共享 MarketProvider 与 TTL |
| 关注 | 工作台左侧自选 |
| 研报 / 分析 | 行情页签外链 |
| Neon | 仅账本与回测结果；K 线不入库 |
| 采集 / LLM | 不参与 |

## 10. 错误与测试

- 统一 `AppError`：`market_source_error` 502，`insufficient_cash` / `insufficient_position` / `invalid_lot` 400，`order_not_cancellable` 409。
- 单测 mock Provider：撮合（市价成、限价挂、触及后成、撤单退冻结）、双均线在构造的 K 线上金叉后于下一根开盘成交、回测不写 paper 表。
- 禁止测试打真实东财。

## 11. 一期验收

- `/quant?code=600519` 显示日 K 与报价，或明确失败。
- 仿真：市价买入后持仓与现金变化；限价未触发保持 pending；快照价触及后成交；撤单成功；重置后空仓且现金回到 100 万。
- 回测：`dual_ma` 跑完给出净值曲线；有信号则成交价为次日开盘；账户持仓不变。
- 页面文案标明「仿真，非实盘」。
- `/market` 与研报 PDF 预览无回归。

## 12. 实现顺序（确认 spec 后再写详细计划）

1. 单标报价 + 日 K API 与 `/quant` 行情页签  
2. 仿真表结构、撮合、paper API  
3. 交易页签 UI  
4. CTA 引擎 + 双均线/突破 + backtest API  
5. 回测页签 UI 与最近结果  

二期（本文不覆盖）：分时、多标的组合回测、用户策略沙箱、实盘柜台。
