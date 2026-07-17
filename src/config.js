'use strict';

// 运行时配置：优先读取环境变量（CI 通过 secrets/vars 注入，本地通过 .env 注入）
const CONFIG = {
  // aihot 公开 API 地址（匿名可访，无需 token）
  apiBase: 'https://aihot.virxact.com',
  // 必须带浏览器 UA，否则 /api/public/* 会被 nginx 403 拦截
  userAgent:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  // 企业微信群机器人 Webhook 地址（群 -> 群机器人 -> 复制 Webhook）
  webhook: process.env.WECOM_WEBHOOK || '',
  // 日报访问基础地址，用于推送消息中的链接，例如 https://your-name.github.io/ai-hot
  baseUrl: process.env.SITE_BASE_URL || '',
  // 本地 release 是否自动 git 推送部署：on（默认）/ off
  deploy: process.env.DEPLOY || 'on',
};

module.exports = { CONFIG };
