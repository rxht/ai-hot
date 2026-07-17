'use strict';

const fs = require('fs');
const path = require('path');

// 读取项目根目录下的 .env（若存在），仅填充未设置的环境变量
function loadEnv(file) {
  const envPath = path.join(__dirname, '..', file || '.env');
  if (!fs.existsSync(envPath)) return;
  try {
    const txt = fs.readFileSync(envPath, 'utf8');
    txt.split('\n').forEach((line) => {
      const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
      if (m && !(m[1] in process.env)) {
        let v = m[2].trim();
        if (
          (v.startsWith('"') && v.endsWith('"')) ||
          (v.startsWith("'") && v.endsWith("'"))
        ) {
          v = v.slice(1, -1);
        }
        process.env[m[1]] = v;
      }
    });
  } catch (_) {
    /* 忽略 .env 读取错误 */
  }
}

// 北京（UTC+8）今日日期，格式 YYYY-MM-DD
function beijingToday() {
  const d = new Date();
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(d)
    .replace(/\//g, '-');
}

// 把 YYYY-MM-DD 转成 "2026年7月18日"（星期几由 hero-week 单独展示，避免重复）
// 用 +08:00 锚定到北京时间正午，避免运行时所在时区导致日期/星期偏移
function formatDateLabel(dateStr) {
  const d = new Date(dateStr + 'T12:00:00+08:00');
  if (isNaN(d.getTime())) return dateStr;
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d);
}

function bjDateStr(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(d)
    .replace(/\//g, '-');
}

// ISO -> 北京时间口语化展示（今天上午09:48 / 昨天14:30 / 7月5日 晚上20:10）
function toBeijingHuman(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const time = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
  const dateFmt = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const todayStr = dateFmt.format(new Date());
  const thatStr = dateFmt.format(d);
  const yStr = dateFmt.format(new Date(Date.now() - 24 * 3600 * 1000));
  const [hh, mm] = time.split(':');
  const h = parseInt(hh, 10);
  const period =
    h < 5 ? '凌晨' : h < 9 ? '早上' : h < 11 ? '上午' : h < 13 ? '中午' : h < 18 ? '下午' : '晚上';
  if (thatStr === todayStr) return `今天${period}${h}:${mm}`;
  if (thatStr === yStr) return `昨天${period}${h}:${mm}`;
  const md = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    month: 'long',
    day: 'numeric',
  }).format(d);
  return `${md} ${period}${h}:${mm}`;
}

// HTML 转义，避免 API 内容破坏页面结构
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 按码点截断（中文每个字计 1），超出加省略号
function truncate(str, n) {
  if (!str) return '';
  const arr = Array.from(String(str));
  if (arr.length <= n) return str;
  return arr.slice(0, n).join('') + '…';
}

module.exports = {
  loadEnv,
  beijingToday,
  formatDateLabel,
  bjDateStr,
  toBeijingHuman,
  escapeHtml,
  truncate,
};
