'use strict';

const { CONFIG } = require('./config');

/**
 * 通过企业微信群机器人 Webhook 推送日报摘要（markdown 消息）。
 * 未配置 webhook 时静默跳过。
 * @returns {Promise<boolean>} 是否成功推送
 */
async function notify({ date, title, total, sectionCounts, url }) {
  if (!CONFIG.webhook) {
    console.log('[notify] 未配置 WECOM_WEBHOOK，跳过推送');
    return false;
  }
  const lines = [
    `## 📰 AI HOT 日报 · ${date}`,
    `> 今日共 **${total}** 条 AI 动态`,
  ];
  if (Array.isArray(sectionCounts) && sectionCounts.length) {
    lines.push(...sectionCounts);
  }
  if (title) lines.push(`> ${title}`);
  if (url) lines.push(`[点击查看完整晨报](${url})`);
  const payload = {
    msgtype: 'markdown',
    markdown: { content: lines.join('\n') },
  };
  try {
    const res = await fetch(CONFIG.webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json().catch(() => ({}));
    if (json.errcode !== 0) {
      throw new Error('WeCom 返回: ' + JSON.stringify(json));
    }
    console.log('[notify] 企业微信推送成功');
    return true;
  } catch (e) {
    console.error('[notify] 推送失败:', e.message);
    return false;
  }
}

module.exports = { notify };
