# AI HOT 每日晨报生成系统

一个零依赖的 Node.js 小工具：每天定时（或本地手动）从 [aihot.virxact.com](https://aihot.virxact.com) 拉取 AI 日报，渲染成**单文件、液态玻璃（Liquid Glass）风格**的 HTML 晨报仪表盘，并通过**企业微信 Webhook** 推送至群聊。支持浅/深色双主题、往期归档与按日期检索。

> 数据完全来自公开匿名 API，无需任何 token。

---

## ✨ 功能特性

- **定时 + 手动双模式**：GitHub Action 每天北京时间 09:00 自动生成并部署；本地 `npm run new` / `npm run release` 随时生成。
- **当日回退**：当日日报（约北京时间 08:00 生成）未就绪时，自动回退到最近一期可用数据；显式指定历史日期则精确拉取，缺失即报错。
- **单文件零依赖 HTML**：样式与脚本全部内联，无外部资源，可直接双击打开或静态托管。
- **液态玻璃设计**：毛玻璃模糊、半透明层叠、柔和阴影、圆角；Apple 风格的视觉质感。
- **浅 / 深色双主题**：自动跟随系统偏好，支持手动切换，选择通过 `localStorage` 持久化；且**首屏前即读取**，避免主题闪烁。
- **晨报结构**：顶部 Hero（日期 + 总条数 + 五版块统计）→ 中部锚点导航（滚动高亮当前版块）→ 左侧分类速览 → 响应式卡片网格（**跨版块全局连续编号**）→ 页脚（当日条数 + 历史累计 + 数据来源）。
- **归档与统计**：`dist/archive.json` 记录每期条数与历史累计总数；`dist/index.html` 提供往期列表与按日期检索入口。
- **企业微信推送**：发布完成后推送 markdown 摘要（标题、各版块条数、查看链接）。

---

## 📁 目录结构

```
ai-hot/
├── src/
│   ├── config.js          # 运行时配置（API 地址、UA、Webhook、站点地址、部署开关）
│   ├── util.js            # 北京时间转换、60 字截断、HTML 转义、.env 加载
│   ├── fetch-daily.js     # 调用 aihot 日报接口，含回退逻辑
│   ├── generate-html.js   # 单文件 HTML 生成器 + 归档索引页生成器
│   ├── archive.js         # 维护 dist/archive.json（每期条数 + 累计总数）
│   ├── build.js           # 编排：拉取→生成→归档→（通知）→（部署）
│   └── notify.js          # 企业微信 Webhook markdown 推送
├── scripts/
│   ├── new.js             # npm run new：仅本地生成
│   └── release.js         # npm run release：完整发布（生成+通知+部署）
├── dist/                  # 输出目录（生成的 HTML 与归档）
│   ├── YYYY-MM-DD.html    # 每日晨报（单文件）
│   ├── index.html         # 往期归档索引（支持日期检索）
│   └── archive.json       # 归档元信息
├── .github/workflows/
│   └── daily.yml          # 定时生成并部署
├── .env.example           # 配置模板
└── package.json
```

---

## 🔧 环境要求

- Node.js ≥ 18（推荐 22）。原生 `fetch`，无需安装任何 npm 依赖。

---

## 🚀 快速开始

```bash
git clone <repo> && cd ai-hot
cp .env.example .env      # 按需填写，不填也能本地生成
npm run new               # 生成今日（或回退最近一期）日报
```

打开 `dist/<日期>.html` 即可查看。

### 配置 `.env`

| 变量 | 说明 | 必填 |
| --- | --- | --- |
| `WECOM_WEBHOOK` | 企业微信群机器人 Webhook 地址（群 → 群机器人 → 复制地址） | 推送时必填，否则静默跳过 |
| `SITE_BASE_URL` | 日报访问基础地址，用于推送消息里的「查看链接」，如 `https://<用户>.github.io/ai-hot` | 推送带链接时建议填 |
| `DEPLOY` | 本地 `release` 是否自动 git 推送：`on`（默认）/ `off` | 否 |

---

## 📜 使用命令

### 生成本地日报（不推送、不部署）

```bash
npm run new                       # 今日（北京时间）；未生成则回退最近一期
npm run new -- 2026-07-15        # 指定历史日期生成对应日报
REPORT_DATE=2026-07-15 npm run new  # 等价的环境变量写法
```

### 完整发布流程（生成 + 企微通知 + 部署）

```bash
npm run release                   # 今日完整流程
npm run release -- 2026-07-15    # 指定日期完整流程
```

`release` 在数据拉取、HTML 生成、归档更新之后，会：
1. 若配置了 `WECOM_WEBHOOK`，向企业微信群推送 markdown 摘要；
2. 若 `DEPLOY !== off` 且当前为 git 仓库，将 `dist/` 提交并推送到远程。

> 指定历史日期时，若该日期日报不存在会直接报错（**不会**回退到其他日期），避免错位归档。

---

## 🔌 数据来源与回退策略

- 数据源：`https://aihot.virxact.com/api/public/daily/{YYYY-MM-DD}`（匿名可访）。
- 调用 API 必须携带浏览器 `User-Agent`，否则会被网关 403 拦截（已在 `config.js` 内置）。
- **今日**：优先拉取当日；若当日接口 404（尚未到北京时间 08:00），则从归档列表取最近一期。
- **指定日期**：精确拉取该日期；不存在即报错，便于及时发现问题。

---

## 🎨 页面结构与设计

| 区域 | 说明 |
| --- | --- |
| **Hero** | 展示当日日期（如「2026年7月17日 星期五」）、总条数大数字、五个版块的统计 chips，以及数据生成时间（北京时间口语化）。 |
| **锚点导航** | 吸顶玻璃条，点击平滑跳转；滚动时通过 `IntersectionObserver` 高亮当前所在版块。 |
| **左侧分类速览** | 五个版块快捷跳转 + 各版块条数 + 「往期归档」入口（窄屏自动隐藏）。 |
| **卡片网格** | 响应式自适应列数；每张卡片含全局连续编号、来源 chip、标题（新窗口打开原文）、≤60 字摘要。 |
| **页脚** | 当日条数 + 历史累计总条数 + 数据来源链接。 |
| **主题** | 右上角悬浮按钮切换浅/深色；未手动设置时跟随系统；`localStorage` 持久化，首屏前读取防闪烁。 |

卡片链接统一设置 `target="_blank" rel="noopener noreferrer"`，所有时间统一转换为北京时间并口语化展示（如「今天上午09:48」「昨天14:30」），不展示 ISO 字符串。

---

## 🗂️ 归档与统计

- 每生成一期，向 `dist/archive.json` 写入/更新该期记录（日期、标题、各版块条数、累计）。
- `dist/index.html` 列出全部历史日报，并支持输入日期片段（如 `07-15` 或 `2026-07`）实时筛选。
- 重新生成同一日期会覆盖该期，累计总数始终为各期之和。

---

## 💬 企业微信推送

在 `.env` 或 CI Secrets 配置 `WECOM_WEBHOOK` 后，`release` 会推送如下 markdown 消息：

```
## 📰 AI HOT 日报 · 2026-07-17
> 今日共 **27** 条 AI 动态
> 🚀 模型发布/更新 1 条
> 🛠️ 产品发布/更新 8 条
...
[点击查看完整晨报](https://<站点>/2026-07-17.html)
```

未配置 Webhook 时自动跳过，不影响本地生成。

---

## ⏰ GitHub Actions 定时生成 + Pages 部署

两个 workflow 协作完成「生成 → 部署」：

- `.github/workflows/daily.yml`（定时 / 手动）：每天**北京时间 09:00**（UTC `0 1 * * *`）生成日报，并把 `dist/` 提交推回 `master` 分支。
- `.github/workflows/pages.yml`（Push 触发）：监听 `master` 分支下 `dist/**` 的变更，将 `dist/` 作为 Pages 产物部署到 GitHub Pages（采用官方 `actions/deploy-pages`）。

因此本地发布也会走 Actions 部署：

1. **定时**：`daily.yml` 生成并推送 `dist/` → 自动触发 `pages.yml` → 部署上线。
2. **本地 `npm run release`**：`scripts/release.js` 在 `DEPLOY !== 'off'`（默认）时会把 `dist/` 推送到 `master` → 自动触发 `pages.yml` → 部署上线。
   （`DEPLOY=off` 时只生成不推送，也就不会触发部署。）
3. **手动**：Actions 页面选择 `AI HOT Daily Report` → `Run workflow`。

### 配置步骤

1. 仓库 **Settings → Secrets and variables**：
   - **Secrets（私有加密变量，日志中自动脱敏）** 添加 `WECOM_WEBHOOK`（群机器人地址）。
     ⚠️ 务必放在 Secrets，切勿放在 Variables —— Variables 对所有有仓库读权限的人可见，会泄露机器人地址。
   - **Variables（可见变量）** 添加 `SITE_BASE_URL`（如 `https://<用户>.github.io/ai-hot`）。
     workflow 中读取方式：`WECOM_WEBHOOK: ${{ secrets.WECOM_WEBHOOK }}` / `SITE_BASE_URL: ${{ vars.SITE_BASE_URL }}`。
2. 仓库 **Settings → Pages**：Source 选择 **GitHub Actions**（不再是「Deploy from a branch」）。
3. 首次部署：手动跑一次 `daily.yml`，或本地执行 `npm run release`，把 `dist/` 推上 `master` 即可触发 `pages.yml` 完成部署。

> 说明：归档状态（`archive.json` 累计总数）靠 `daily.yml` 把 `dist/` 提交回 `master` 来持久化；`pages.yml` 只负责把 `dist/` 部署为站点，不参与生成。

---

## ❓ 常见问题

- **生成的日报是昨天的？** 当日日报约北京时间 08:00 生成；若你在 08:00 前运行，系统会自动回退到最近一期（日志会提示「回退至最近一期」）。
- **指定日期生成失败？** 确认日期格式为 `YYYY-MM-DD` 且该日期在 aihot 有日报；指定日期不会回退。
- **企业微信没收到消息？** 检查 `WECOM_WEBHOOK` 是否正确配置；未配置时会打印「跳过推送」。
- **主题切换不生效？** 切换状态存于 `localStorage['aihot-theme']`，清除站点数据可恢复默认（跟随系统）。

---

## 📄 License

ISC
