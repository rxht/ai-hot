'use strict';

const { CONFIG } = require('./config');

async function apiGet(path) {
  const url = CONFIG.apiBase + path;
  const res = await fetch(url, {
    headers: {
      'User-Agent': CONFIG.userAgent,
      Accept: 'application/json',
    },
  });
  if (res.status === 404) return { notFound: true };
  if (!res.ok) {
    throw new Error(`API ${path} 返回 ${res.status} ${res.statusText}`);
  }
  return { data: await res.json() };
}

// 拉取指定日期日报；不存在返回 null
async function getSpecificDate(date) {
  const r = await apiGet(`/api/public/daily/${date}`);
  if (r.notFound || !r.data) return null;
  return r.data;
}

// 拉取最新一期日报（带兜底：若 /daily 404 或返回空对象，则从归档列表取最近一期）
async function getLatest() {
  const r = await apiGet('/api/public/daily');
  if (!r.notFound && r.data && r.data.date) return r.data;
  const d = await apiGet('/api/public/dailies?take=1');
  if (d.data && d.data.items && d.data.items[0]) {
    return getSpecificDate(d.data.items[0].date);
  }
  return null;
}

/**
 * 获取目标日期日报。
 * @param {string} targetDate YYYY-MM-DD
 * @param {{fallback?:boolean}} [opts] fallback=true 时当日不存在则回退最近一期；
 *        显式指定历史日期时建议 fallback=false，缺失即报错而非错位。
 * @returns {{daily:object, isTarget:boolean, actualDate:string}}
 */
async function getDaily(targetDate, opts) {
  opts = opts || {};
  const fallback = opts.fallback !== false;
  let daily = await getSpecificDate(targetDate);
  let isTarget = true;
  if (!daily) {
    if (!fallback) {
      throw new Error(`未找到 ${targetDate} 的日报（aihot 可能尚未生成或不存在该日期）`);
    }
    daily = await getLatest();
    isTarget = false;
  }
  if (!daily) {
    throw new Error('aihot 暂无可用的日报数据');
  }
  return { daily, isTarget, actualDate: daily.date };
}

module.exports = { getDaily, getLatest, getSpecificDate };
