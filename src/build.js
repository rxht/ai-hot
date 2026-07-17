'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const { getDaily } = require('./fetch-daily');
const { generateDailyHtml, generateArchiveIndex, SECTIONS } = require('./generate-html');
const { upsertReport, DIST } = require('./archive');
const { notify } = require('./notify');
const { beijingToday } = require('./util');
const { CONFIG } = require('./config');

function makeEntry(daily, date) {
  const sections = SECTIONS.map((s) => {
    const f = (daily.sections || []).find((x) => x.label === s.label);
    return { label: s.label, count: f && f.items ? f.items.length : 0 };
  });
  const flashes = (daily.flashes || []).length;
  const count = sections.reduce((a, b) => a + b.count, 0) + flashes;
  const title = daily.lead && daily.lead.title ? daily.lead.title : `AI HOT 日报 · ${date}`;
  const sectionCounts = sections.map((s) => {
    const ic = SECTIONS.find((x) => x.label === s.label).icon;
    return `> ${ic} ${s.label} ${s.count} 条`;
  });
  return { date, title, count, sections, flashes, sectionCounts, generatedAt: daily.generatedAt || null };
}

async function deployGit(date) {
  try {
    execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });
  } catch (_) {
    console.log('[deploy] 非 git 仓库，跳过部署');
    return;
  }
  try {
    execSync('git add dist', { stdio: 'ignore' });
    execSync(`git commit -m "chore: AI HOT 日报 ${date}"`, { stdio: 'ignore' });
    execSync('git push', { stdio: 'ignore' });
    console.log('[deploy] 已推送 dist 至远程');
  } catch (e) {
    console.log('[deploy] 推送未完成（可稍后手动推送）：', e.message);
  }
}

/**
 * 完整构建：拉取数据 -> 生成日报 HTML -> 更新归档 -> (可选)推送与部署。
 */
async function runBuild({ doNotify = false, doDeploy = false, targetDate } = {}) {
  // targetDate 为空时取北京时间今日；显式传入则按指定日期（不回退）
  const date = targetDate || beijingToday();
  if (!fs.existsSync(DIST)) fs.mkdirSync(DIST, { recursive: true });
  console.log(`[build] 目标日期 ${date}${targetDate ? '（指定日期）' : ''}`);
  const { daily, isTarget, actualDate } = await getDaily(date, { fallback: !targetDate });
  if (!isTarget) {
    console.log(`[build] 当日(${date})数据未生成，回退至最近一期 ${actualDate}`);
  }

  const entry = makeEntry(daily, actualDate);
  const arch = upsertReport(entry);

  // 先更新归档拿到真实累计总数，再生成日报页，使页脚「历史累计」正确
  const html = generateDailyHtml(daily, {
    baseUrl: CONFIG.baseUrl,
    cumulative: arch.cumulative,
    isTarget,
    targetDate: date,
  });
  fs.writeFileSync(path.join(DIST, `${actualDate}.html`), html);

  fs.writeFileSync(path.join(DIST, 'index.html'), generateArchiveIndex(arch));

  console.log(
    `[build] 已生成 ${actualDate}.html  共 ${entry.count} 条（历史累计 ${arch.cumulative}）`
  );

  if (doNotify) {
    const url = CONFIG.baseUrl ? `${CONFIG.baseUrl.replace(/\/$/, '')}/${actualDate}.html` : '';
    await notify({ date: actualDate, title: entry.title, total: entry.count, sectionCounts: entry.sectionCounts, url });
  }

  if (doDeploy) await deployGit(actualDate);

  return { actualDate, entry, arch };
}

module.exports = { runBuild, makeEntry };
