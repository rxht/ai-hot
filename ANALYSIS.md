# AI HOT 每日晨报生成系统 · 完整项目分析

> 分析时间：2026-07-18（北京时间 18:5x）
> 方法：通读全部源码（912 行 JS/YAML）+ 实际运行 `npm run new` 构建验证
> 范围：当前工作副本（已含 `/docs` 部署架构、daily.yml 生成→部署强约束）
> 结论：**核心功能完整、构建通过、可上线**；本轮（含此前）共修复 8 处缺陷，另梳理 11 项待办，均为非阻塞的健壮性/运维/可维护性改进。

---

## 1. 项目概览

零依赖 Node.js（≥18，原生 `fetch`）工具：每天定时（或本地手动）从 [aihot.virxact.com](https://aihot.virxact.com) 拉取 AI 日报，渲染成**单文件、Apple 液态玻璃（Liquid Glass）风格**的 HTML 晨报，并通过**企业微信 Webhook** 推送；支持浅/深色双主题、往期归档与按日期检索。GitHub Actions 负责每日生成，GitHub Pages（分支 `master` 的 `/docs` 目录模式）负责托管。

- **数据**：公开匿名 API，无需 token（但必须带浏览器 `User-Agent`，否则 403）。
- **输出**：`docs/YYYY-MM-DD.html`（单文件）+ `docs/index.html`（归档检索）+ `docs/archive.json`（元信息 + 历史累计）。
- **部署**：GitHub Pages 源 = 分支 `master` / 目录 `/docs`（Deploy from a branch）。`daily.yml` 把 `docs/` 推回 `master` 后 GitHub Pages 自动发布，无独立部署 workflow。

---

## 2. 技术栈与运行环境

| 项 | 说明 |
| --- | --- |
| 运行时 | Node.js ≥ 18（推荐 22；CI 用 22）。`fetch` 为 Node 18+ 全局 API（18 为实验性，21+ 稳定）。 |
| 依赖 | **零运行时依赖、零构建步骤**。仅用内置 `fs`/`path`/`child_process` 与原生 `fetch`。 |
| 模块系统 | CommonJS（`require`/`module.exports`），无 `type: module`。 |
| 样式/脚本 | 全部内联进单文件 HTML，无外部资源、无 CDN，可双击打开或静态托管。 |
| 包管理 | 仅 `npm` 作为脚本入口（`npm run new` / `npm run release`），无需 `npm install`。 |

---

## 3. 目录结构与职责

```
ai-hot/
├── src/
│   ├── config.js        # 运行时配置读取（apiBase / UA / webhook / baseUrl / deploy）
│   ├── util.js          # 北京时间转换、HTML 转义、截断、.env 加载、日期标签
│   ├── fetch-daily.js   # 调 aihot 日报接口，含「当日→最近一期」回退逻辑
│   ├── generate-html.js # 单文件 HTML 生成器 + 归档索引页（423 行，含全部 CSS/JS）
│   ├── archive.js       # 维护 docs/archive.json（每期条数 + 累计总数）
│   ├── build.js         # 编排：拉取→生成→归档→(通知)→(部署)
│   └── notify.js        # 企业微信 Webhook markdown 推送
├── scripts/
│   ├── new.js           # npm run new：仅本地生成（不通知、不推送）
│   └── release.js       # npm run release：生成 + 企微通知 + git 推送
├── docs/                # 输出目录（GitHub Pages 源目录 /docs，需提交进仓库）
├── .github/workflows/
│   └── daily.yml        # 定时/手动：①生成日报 ②（生成成功后）提交 docs/ → Pages 自动发布
├── .env.example         # 配置模板
├── package.json         # 仅两个脚本，零依赖
├── README.md            # 用户文档
└── ANALYSIS.md          # 本分析文档
```

---

## 4. 架构与数据流

```
                    ┌──────────────────── 本地 / CI ────────────────────┐
aihot API ──fetch──▶ build.js
                      ├─ getDaily(date)        → 当日缺失则回退最近一期（fallback 横幅）
                      ├─ makeEntry(daily)      → 各版块条数 + 累计统计
                      ├─ upsertReport()        → docs/archive.json（重算累计，幂等）
                      ├─ generateDailyHtml()   → docs/<actualDate>.html（液态玻璃单文件）
                      ├─ generateArchiveIndex()→ docs/index.html（归档检索页）
                      ├─ notify() [release]    → 企业微信 markdown 摘要
                      └─ deployGit() [release] → git add docs && commit && push
                    └────────────────────────────────────────────────────┘
                                         │ 推送 master:/docs
                                         ▼
                                 GitHub Pages 自动发布

CI（daily.yml）路径：生成步(DEPLOY=off) → 成功 → 部署步(git add docs && push)
```

**生成→部署强约束**（daily.yml，本次新增）：
- 生成步 `id: generate`；部署步 `if: success()`，生成失败则绝不部署。
- 部署步额外闸门：仅当 `docs/<今日>.html` 真实生成后才提交推送；若当日数据未就绪（回退），跳过部署，避免把旧内容当今日发布。

---

## 5. 模块详解（逐文件）

### 5.1 `src/config.js`（19 行）
集中配置：`apiBase`、`userAgent`（Chrome UA，绕过 403）、`webhook`/`baseUrl`/`deploy` 从环境变量读。
- ⚠️ **`deploy` 字段为死代码**：`process.env.DEPLOY || 'on'`，但 `build.js`/`release.js` 实际直接用 `process.env.DEPLOY !== 'off'` 判断，从未读取 `CONFIG.deploy`。可删除或改为被引用，避免歧义。

### 5.2 `src/util.js`（130 行）
- `loadEnv(file)`：读取根目录 `.env`，仅填充未设置的变量。正则 `^\s*([\w.-]+)\s*=\s*(.*)\s*$` 能忽略空行/注释行（`#` 不在 `[\w.-]`），但**行尾 `# 注释`不会被剥离**（如 `KEY=v # c` 会把 `# c` 带进值）。当前 `.env.example` 无此写法，属潜在隐患。
- `beijingToday()` / `formatDateLabel()` / `bjDateStr()` / `toBeijingHuman()`：均用 `Asia/Shanghai` 或 `+08:00` 锚定，时区安全。`formatDateLabel` 已去掉 weekday（由 Hero 单独展示，避免重复）。
- `toBeijingHuman()`：今天/昨天/具体日期的口语化；`昨天` 用 `Date.now()-24h` 近似，显示用足够。
- `escapeHtml()` / `truncate()`（按码点截断，中文计 1）：安全且正确。

### 5.3 `src/fetch-daily.js`（63 行）
- `apiGet()`：404→`{notFound:true}`；非 ok→抛错；成功→`{data}`。
- `getSpecificDate(date)`：按日期精确拉取，缺失返回 `null`。
- `getLatest()`：先打 `/api/public/daily`，空对象时回退 `/api/public/dailies?take=1` 再取该日期——**空对象兜底已加固**。
- `getDaily(targetDate, {fallback})`：主逻辑清晰；`fallback=false`（指定历史日期）缺失即报错，避免错位归档。
- ⚠️ **无超时/无重试**：`fetch` 未设 `AbortController`，API 卡死会挂起直到 CI 超时；瞬时 5xx/网络抖动一次即失败。建议加 15s 超时 + 简单重试。

### 5.4 `src/generate-html.js`（423 行）
- `pageShell()`：内联 CSS 变量（浅/深双主题）、首屏前脚本读 `localStorage['aihot-theme']` 防闪烁、`@media (prefers-color-scheme: dark)` 自动跟随、`#themeToggle` 悬浮按钮、`IntersectionObserver` 滚动高亮。结构完整、无外部依赖。
- `cardHtml()`：**来源 chip 始终展示**，有 `publishedAt` 时追加时间 chip（此前修复）。
- `generateDailyHtml()`：5 固定版块顺序即全局连续编号顺序；`weekday` 在 Hero 单独展示；`fallbackNote` 横幅（回退时提示）；`cumulative` 默认 `total`、由 `build.js` 传入真实累计（P1 修复）。
- `generateArchiveIndex()`：归档列表 + 前端日期片段实时筛选。
- 安全：所有动态内容经 `escapeHtml`；URL 经 `escapeHtml`。⚠️ **未校验 URL scheme**，若 API 返回 `javascript:` 链接仍有点击执行风险（当前为可信源，低风险，建议加白名单）。

### 5.5 `src/archive.js`（44 行）
- `DIST = docs/`、`ARCHIVE_FILE = docs/archive.json`（已迁至 `/docs`）。
- `upsertReport()`：重算 `cumulative = Σ count` 并排序，幂等；损坏/缺失返回默认结构。**累计不受重复生成影响**。

### 5.6 `src/build.js`（88 行）
- `makeEntry()`：版块条数 + flashes 计入 `count` + 企微 `sectionCounts` markdown。
- `deployGit()`：`git rev-parse` 判仓库 → `git add docs && commit && push`，失败仅告警不抛错（不阻断构建）。
- `runBuild()`：顺序为 **先 `upsertReport` 再生成日报页并传 `cumulative`**（P1 修复）；`getDaily` 的 `fallback` = `!targetDate`（今日走回退、指定日期不回退）。逻辑闭环正确。

### 5.7 `src/notify.js`（46 行）
- 企微 markdown 推送；未配置 `WECOM_WEBHOOK` 静默跳过；`errcode !== 0` 抛错但被 `try` 捕获返回 `false`（**非致命**，不影响部署）。内容远小于 4096B 上限。

### 5.8 `scripts/new.js` / `scripts/release.js`
- `new`：`doNotify:false, doDeploy:false`（纯本地生成）。`release`：`doNotify:true`，`doDeploy = DEPLOY !== 'off'`（CI 传 `off` 仅生成，由 workflow 提交 `docs/`）。
- 日期参数支持 `argv[2]` 或 `REPORT_DATE`，校验 `YYYY-MM-DD`。

### 5.9 `.github/workflows/daily.yml`（54 行）
- `cron: '0 1 * * *'` = 北京时间 09:00（已修正，原为 `30 9 * * *`=北京 17:30）。
- 步骤：Checkout → Setup Node 22 → **① 生成日报并通知**（DEPLOY=off）→ **② 部署**（if:success + 今日文件闸门）。
- git 身份 `rxht <brf9577@163.com>`（用户真实身份）。

---

## 6. 功能完整性核对（需求对照）

| 需求 | 状态 | 说明 |
| --- | --- | --- |
| 定时 + 手动双模式 | ✅ | cron + `npm run new/release` |
| 当日回退提示 | ✅ | `fallbackNote` 横幅 |
| 单文件零依赖 HTML | ✅ | 样式/脚本全内联 |
| 液态玻璃设计 | ✅ | blur/半透明/圆角 |
| 浅/深色双主题 + 防闪烁 | ✅ | localStorage + 系统跟随 + 首屏脚本 |
| 五版块 + 全局连续编号 | ✅ | 验证 18 条编号 1..18 |
| 归档与累计统计 | ✅ | `archive.json` 重算累计 |
| 企业微信推送 | ✅ | secret 走 Secrets |
| 按日期检索归档 | ✅ | `index.html` 前端筛选 |
| 生成后才部署（强约束） | ✅ | `if:success()` + 今日文件闸门 |

构建验证（2026-07-18 18:5x 北京）：生成 `2026-07-18.html` 共 18 条（模型4/产品1/行业2/论文4/观点7），无回退横幅，主题按钮存在，5 版块 + 1 个脚本内 `data-spy` 选择器，`archive.json` 结构正确。

---

## 7. 问题清单

### 7.1 已修复（历史缺陷，本轮此前完成）
| 等级 | 问题 | 修复 |
| --- | --- | --- |
| P1 | 页脚「历史累计」误显当日数 | `build.js` 先 upsertReport 再生成并传 cumulative |
| P1 | 日期/星期受运行时时区影响 | 统一用 `+08:00` / `Asia/Shanghai` 锚定 |
| P2 | 回退无提示 | 加 `fallbackNote` 横幅 |
| P2 | 来源 chip 被时间 chip 吞 | 来源 chip 始终展示 + 时间 chip 追加 |
| P3 | Hero 星期重复 | `formatDateLabel` 去 weekday |
| P3 | `getLatest` 空对象兜底缺失 | 校验 `r.data.date` 后回退 `/dailies` |
| P3 | `package.json` 误导性字段 | 移除 `packageManager`/`main` |
| — | cron 时区错误（17:30） | 改 `0 1 * * *`（北京 09:00） |
| — | CI `git add dist` 被 .gitignore 拦截 | 产物迁 `docs/`，提交 `docs/` |
| — | Pages 模式误用 Actions 部署 | 改 `/docs` 分支模式，删 `pages.yml` |
| — | 部署可能早于生成 | daily.yml 加 `if:success()` + 今日文件闸门 |

### 7.2 当前待办（新发现 + 历史保留，按等级）
| 等级 | 问题 | 位置 | 建议 |
| --- | --- | --- | --- |
| 🟠 K1 | **迁移后累计归零**：`docs/archive.json` 为全新（仅 2026-07-18，累计 18），旧 `dist/` 下 07-15(25)+07-17(27)=52 的累计未继承。 | `docs/archive.json` | 若需历史连续，补跑 `npm run new -- 2026-07-15` / `2026-07-17` 回填（会重建对应 HTML 与累计）。 |
| 🟠 K2 | 并发/非快进：本地 `release` 与每日 cron 同时推送 `master` 可能 non-fast-forward；`deployGit` 不先 `pull --rebase`，且未显式指定 remote/branch。 | `build.js` | CI/本地错峰；`deployGit` 前加 `git pull --rebase --autostash`；或推送时显式 `git push origin HEAD:master`。 |
| 🟡 K3 | `fetch` 无超时、无重试；API 卡死会挂起 CI。 | `fetch-daily.js` | 加 `AbortController`（~15s）+ 1~2 次指数退避重试。 |
| 🟡 K4 | `CONFIG.deploy` 死代码，与实际判断逻辑（直接读 `process.env.DEPLOY`）不一致。 | `config.js` | 删除该字段，或让 `release.js` 改用 `CONFIG.deploy`。 |
| 🟡 K5 | `.env` 行尾 `# 注释` 不剥离，会污染变量值。 | `util.js` | 解析时 `v = v.split('#')[0].trim()`（注意值内含 `#` 的边界，当前无此场景）。 |
| 🟡 K6 | 卡片链接未校验 scheme，`javascript:` 等仍可点击执行（当前源可信，低风险）。 | `generate-html.js` | 仅放行 `http/https`，其余置为 `#`。 |
| 🟢 K7 | 无自动化测试/冒烟校验。 | — | 加最小断言：生成后卡片数>0、含 5 个 `sec-` 锚点、主题按钮存在、archive.json 合法。 |
| 🟢 K8 | 用户在 Node 18 运行会看到 `fetch` 实验性警告。 | `package.json` | 建议 `engines.node >= 21`（CI 已用 22）；或在 README 标注推荐 22。 |
| 🟢 K9 | `archive.json` 随 `/docs` 被 Pages 公开（非敏感）。 | — | 可接受；若介意可只公开 `index.html`。 |
| 🟢 K10 | HTML 缺 `<meta name="description">` / Open Graph。 | `generate-html.js` | 可选补充，利于分享预览。 |
| 🟢 K11 | `package.json` `author` 含 `<>`（`rxh<brf9577@163.com>`）。 | `package.json` | 改为 `rxh <brf9577@163.com>`（加空格）以符合 npm 惯例，不影响功能。 |

---

## 8. 安全评估

- **密钥**：`WECOM_WEBHOOK` 经 GitHub Secrets 注入（日志脱敏），未落盘、未进仓库；`.env` 已被 `.gitignore` 忽略。✅
- **XSS**：所有 API 文本经 `escapeHtml` 后入 HTML；属性值（URL）亦转义。`<script>` 内仅自有逻辑。✅（仅 K6 scheme 校验待补，低风险）
- **部署权限**：`daily.yml` 仅 `contents: write`，无 `pages`/`id-token` 权限（因用分支模式，无需）。✅
- **数据完整性**：`archive.json` 重算累计、损坏回退默认，幂等。✅

---

## 9. 部署（当前 `/docs` 模式）

1. 仓库 **Settings → Pages**：Source = **Deploy from a branch** → `master` → `/docs` → Save。
2. **Secrets**：`WECOM_WEBHOOK`；**Variables**：`SITE_BASE_URL`（如 `https://rxht.github.io/ai-hot`）。
3. 首次：手动跑一次 `daily.yml`（Actions → Run workflow）或本地 `npm run release`，把 `docs/` 推上 `master` 即自动发布。
4. 定时：每日**北京时间 09:00**，生成→（成功）→提交 `docs/`→Pages 自动上线。
5. ⚠️ 当前工作副本在 `master` 有两次本地未推送提交（`44aa191` `/docs` 架构、`888ba2f` 部署强约束），以及本次验证生成的 `docs/` 产物；需 `git push origin master` 后方可上线（沙箱此前拦截推送，由你本地执行）。

---

## 10. 命令速查

```bash
npm run new                       # 生成本日（未就绪则回退最近一期）
npm run new -- 2026-07-15        # 生成指定日期（缺失即报错，不回退）
npm run release                   # 完整流程：生成 + 企微通知 + git 推送（部署）
npm run release -- 2026-07-15    # 指定日期完整流程
REPORT_DATE=2026-07-15 npm run new  # 环境变量等价写法
```
- 本地推送默认开启（`DEPLOY=on`）；`.env` 设 `DEPLOY=off` 只生成不推送。
- 指定历史日期时**精确拉取、缺失即报错**，避免错位归档。

---

## 11. 结论与优先建议

系统已实现全部核心能力，构建通过、部署模型清晰、生成→部署强约束已落地。**整体功能完整、可交付上线**，剩余 11 项为非阻塞改进。

建议优先级：
1. **K1**（回填历史累计）——若在意历史连续性，先补跑 07-15/07-17。
2. **K2 / K3**（并发推送安全 + fetch 超时重试）——影响线上稳定性，建议尽快。
3. **K4 / K5 / K6 / K11**（死代码、.env 解析、scheme 校验、author 格式）——低风险清理，可顺手做。
4. **K7 / K8 / K9 / K10**——可选增强（测试、引擎版本、SEO）。

> 本次分析后，源码与文档均就绪；上线仅需你本地 `git push origin master` 并完成 Pages `/docs` 设置。
