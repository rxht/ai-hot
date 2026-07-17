# AI HOT 每日晨报生成系统 · 项目体检报告

> 节点时间：2026-07-18（北京时间）
> 范围：以当前代码为「项目节点」，对 `ai-hot` 全量源码、构建流程、GitHub Actions 部署做一次体检，列出问题并给出修复/部署建议。
> 结论：**核心功能完整、可上线**；本轮已修复 7 处缺陷（含 2 处功能性 bug 与 2 处健壮性隐患），另梳理 7 项待办（多为运维/健壮性，不影响核心使用）。
> 修订：GitHub Pages 源目录确认为分支的 **`/docs`**（Deploy from a branch 模式），已据此将构建产物由 `dist/` 迁至 `docs/`、删除原 `pages.yml`、改为单一 `daily.yml` 提交 `docs/`；本文 §1–§5 已同步更新。

---

## 1. 项目概览

零依赖 Node.js（≥18，原生 `fetch`）工具：每天定时（或本地手动）从 [aihot.virxact.com](https://aihot.virxact.com) 拉取 AI 日报，渲染成**单文件、Apple 液态玻璃（Liquid Glass）风格**的 HTML 晨报，并通过**企业微信 Webhook** 推送；支持浅/深色双主题、往期归档与按日期检索，由 **GitHub Actions** 完成生成，并由 **GitHub Pages（分支 `/docs` 目录模式）** 完成托管。

- 数据：公开匿名 API，无需 token（但必须带浏览器 `User-Agent`，否则 403）。
- 输出：`docs/YYYY-MM-DD.html`（单文件）+ `docs/index.html`（归档检索）+ `docs/archive.json`（元信息）。
- 部署：GitHub Pages 源目录为分支 `master` 的 `/docs`（Deploy from a branch 模式）。`daily.yml` 把 `docs/` 推回 `master` 后 GitHub Pages 自动发布，无需单独的 Pages 部署 workflow。

---

## 2. 架构与目录

```
ai-hot/
├── src/
│   ├── config.js        # 运行时配置（API 地址、UA、Webhook、站点地址、部署开关）
│   ├── util.js          # 北京时间转换、60 字截断、HTML 转义、.env 加载、日期标签
│   ├── fetch-daily.js   # 调用 aihot 日报接口，含「当日→最近一期」回退逻辑
│   ├── generate-html.js # 单文件 HTML 生成器 + 归档索引页；5 版块顺序即全局编号顺序
│   ├── archive.js       # 维护 docs/archive.json（每期条数 + 累计总数）
│   ├── build.js         # 编排：拉取→生成→归档→(通知)→(部署)
│   └── notify.js        # 企业微信 Webhook markdown 推送
├── scripts/
│   ├── new.js           # npm run new：仅本地生成（不推送）
│   └── release.js       # npm run release：生成 + 企微通知 + git 推送
├── docs/                # 输出目录（GitHub Pages 源目录 /docs，需提交进仓库）
├── .github/workflows/
│   └── daily.yml        # 定时/手动：生成日报并 git 推送 docs/ 到 master（Pages 自动发布）
├── .env.example         # 配置模板
├── package.json         # 仅两个脚本，零运行时依赖
└── README.md            # 用户文档
```

### 数据流
```
aihot API ──fetch-daily──▶ build.js ──generate-html──▶ docs/YYYY-MM-DD.html
                                   ├─archive.js──────▶ docs/archive.json + docs/index.html
                                   ├─notify.js───────▶ 企业微信（仅 release）
                                   └─deployGit───────▶ git push master ──▶ GitHub Pages(/docs 自动发布)
```

---

## 3. 运行 / 部署协作模型

| 触发方式 | 行为 | 是否部署 Pages |
| --- | --- | --- |
| `npm run new [日期]` | 拉取→生成→归档（不通知、不推送） | 否 |
| `npm run release [日期]` | 拉取→生成→归档→企微通知→`git push` docs | 是（push 后 `/docs` 自动发布） |
| `daily.yml`（定时 北京09:00 / 手动） | CI 内 `DEPLOY=off` 仅生成+通知，再由 workflow 提交并推送 docs | 是（`/docs` 自动发布） |

> 关键设计：GitHub Pages 源设为分支的 `/docs` 目录（Deploy from a branch 模式）。`daily.yml` 与本地 `release` 都只负责「把 `docs/` 推到 `master`」，**真正的 Pages 发布由 GitHub 在检测到 `master:/docs` 变更后自动完成**，因此无需单独的 Pages 部署 workflow（原 `pages.yml` 已删除）。两条路径收敛到同一个动作，避免重复部署逻辑。

---

## 4. 体检发现的问题与处理

### 4.1 已修复（本轮提交）

| 等级 | 问题 | 位置 | 修复 |
| --- | --- | --- | --- |
| 🔴 P1 | **日报页脚「历史累计」显示错误**：`generateDailyHtml` 未收到真实累计，回退成当日条数。有多期后（如 27+25）会错误显示「历史累计 27」。 | `build.js` | 调整顺序：先 `upsertReport` 算好 `arch.cumulative`，再生成日报页并传入 `cumulative`。已验证两期时页脚显示 `历史累计 52`。 |
| 🔴 P1 | **日期/星期受运行时时区影响**：`new Date(date+'T12:00:00')` 按运行时时区解析，美洲机器会把星期算成前一天。 | `util.js`、`generate-html.js` | 锚定 `T12:00:00+08:00`（北京时间正午）。已用 `TZ=America/New_York` 验证 2026-07-17 仍正确显示「星期五」。 |
| 🟠 P2 | **回退无提示**：当日数据未就绪时，页面静默展示「最近一期」内容，用户误以为是当天。 | `generate-html.js` / `build.js` | 增加顶部 `notice` 横幅，明确「当日（X）尚未生成，展示最近一期（Y）」。 |
| 🟠 P2 | **来源 chip 被吞**：卡片优先展示发布时间 chip，有发布时间时来源 chip 消失，违背「来源chip标签」需求。 | `generate-html.js` | 来源 chip **始终展示**；有发布时间时追加时间 chip（右侧双 chip 布局 + 配套 CSS）。 |
| 🟡 P3 | **星期重复显示**：Hero 大日期已含星期，下方又显示一遍星期。 | `util.js` | `formatDateLabel` 去除 `weekday`，改由 `hero-week` 单独展示，消除重复。 |
| 🟡 P3 | **`getLatest` 空对象兜底缺失**：若 `/api/public/daily` 返回 200 但空对象，`daily.date` 为 `undefined` 会破坏渲染。 | `fetch-daily.js` | 增加 `r.data && r.data.date` 校验，否则走 `/dailies` 兜底。 |
| 🟡 P3 | **`package.json` 误导性字段**：声明 `packageManager: pnpm@10.33.0` 但项目零依赖且用 npm；`main: index.js` 指向不存在文件。 | `package.json` | 移除 `packageManager` 与 `main`。 |

### 4.2 已知问题 / 待办（未改，需决策或低风险）

| 等级 | 问题 | 建议 |
| --- | --- | --- |
| 🟠 K1 | **当前工作副本尚未 `git init`**（首轮体检时）。现已初始化并提交，含 `docs/`、`workflows/daily.yml`。注意 `.gitignore` 仍保留 `dist/`（构建产物已迁至 `docs/`，`dist/` 本就不该进仓库）；`docs/` 必须提交。 | 按 §5 清单确认 `master:/docs` 已推上 GitHub，且 Pages 源设为 `/docs`。 |
| 🟠 K2 | 本地 `release` 的 `deployGit` 用 `git push`（无 remote/branch 参数，且不先 `pull`）。未设 upstream 会静默失败；若 CI 当天已推送，本地可能 non-fast-forward 被拒。 | 确保 `git remote add origin` 与 `branch --set-upstream`；本地与 CI 错峰，或在 `deployGit` 前加 `git pull --rebase`。 |
| 🟡 K3 | 强依赖 `aihot.virxact.com` 的可用性与返回结构；若接口改字段，版块可能静默为空。 | 在 `getDaily` 后加结构校验/告警（如各版块 items 缺失则记 warning）。 |
| 🟡 K4 | `archive.json` 随 `docs/` 一起被 Pages 公开（非敏感，但属于内部元信息）。 | 可接受；若介意可把累计统计单独放到 `docs/` 之外的提交，或只公开 `index.html`。 |
| 🟡 K5 | 企微 markdown 消息上限 4096 字节（当前远小于此，长期关注）。 | 当前无风险；若将来条数暴涨，截断 `sectionCounts`。 |
| 🟢 K6 | 无自动化测试/冒烟校验。 | 建议加最小校验：生成后断言卡片数 > 0、含 5 个 `sec-` 锚点、主题按钮存在。 |
| 🟢 K7 | `package.json` 的 `author` 仍是占位邮箱 `rxh<brf9577@163.com>`。 | 改为真实信息（不影响功能）。 |

---

## 5. 部署清单（首次上线 Checklist）

1. **初始化仓库**
   ```bash
   git init
   git add -A
   git commit -m "init: AI HOT 日报系统"
   git remote add origin <你的仓库地址>
   git push -u origin master
   ```
2. **仓库 Settings → Secrets and variables**
   - **Secrets**：`WECOM_WEBHOOK`（群机器人地址，私有脱敏）
   - **Variables**：`SITE_BASE_URL`（如 `https://<用户>.github.io/ai-hot`）
3. **仓库 Settings → Pages**：Source 选 **Deploy from a branch** → 分支 **`master`** → 目录 **`/docs`** → Save（不是 GitHub Actions 模式）。
4. **首次触发部署**：手动跑一次 `daily.yml`（Actions 页面 → `Run workflow`），或本地 `npm run release`，把 `docs/` 推上 `master` 即自动发布；无需 `pages.yml`。
5. **定时确认**：`daily.yml` 的 cron 为 `0 1 * * *`，即**北京时间 09:00**（UTC 01:00）。如需改时间，注意 GitHub cron 用 UTC。

> 验证：打开 Pages 站点地址，确认当日晨报可访问、主题切换正常、归档 `index.html` 可检索。

---

## 6. 使用命令速查

```bash
npm run new                       # 生成本日（未就绪则回退最近一期）
npm run new -- 2026-07-15        # 生成指定日期（缺失即报错，不回退）
npm run release                   # 完整流程：生成 + 企微通知 + git 推送（触发 Pages 部署）
npm run release -- 2026-07-15    # 指定日期完整流程
```

- 本地推送默认开启（`DEPLOY=on`）；`.env` 设 `DEPLOY=off` 可只生成不推送。
- 指定历史日期时**精确拉取、缺失即报错**，避免错位归档。

---

## 7. 结论

系统已实现需求中的全部核心能力（定时+手动生成、单文件液态玻璃页、双主题+localStorage、归档检索、累计统计、企微推送、GitHub Actions 部署）。本轮体检修复了累计数错误、时区偏移、回退无提示、来源 chip 缺失等 7 处问题，并明确了尚未 git 初始化这一上线前置条件与其余 6 项运维/健壮性待办。整体**功能完整、可交付上线**，剩余项均为非阻塞改进。
