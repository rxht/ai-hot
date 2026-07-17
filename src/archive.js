'use strict';

const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, '..', 'docs');
// GitHub Pages 源设为分支的 /docs 目录，故构建产物直接输出到 docs/ 并提交；
// archive.json 随 docs/ 一起提交，累计总数可跨日持久化。
const ARCHIVE_FILE = path.join(DIST, 'archive.json');

function ensureDist() {
  if (!fs.existsSync(DIST)) fs.mkdirSync(DIST, { recursive: true });
}

function loadArchive() {
  ensureDist();
  if (!fs.existsSync(ARCHIVE_FILE)) {
    return { reports: [], cumulative: 0, updatedAt: null };
  }
  try {
    const data = JSON.parse(fs.readFileSync(ARCHIVE_FILE, 'utf8'));
    data.reports = data.reports || [];
    data.cumulative = data.cumulative || 0;
    return data;
  } catch (_) {
    return { reports: [], cumulative: 0, updatedAt: null };
  }
}

// 写入（或更新）一期日报的归档元信息，并重算累计总条数
function upsertReport(entry) {
  ensureDist();
  const arch = loadArchive();
  const idx = arch.reports.findIndex((r) => r.date === entry.date);
  if (idx >= 0) arch.reports[idx] = entry;
  else arch.reports.push(entry);
  arch.reports.sort((a, b) => b.date.localeCompare(a.date));
  arch.cumulative = arch.reports.reduce((s, r) => s + (r.count || 0), 0);
  arch.updatedAt = new Date().toISOString();
  fs.writeFileSync(ARCHIVE_FILE, JSON.stringify(arch, null, 2), 'utf8');
  return arch;
}

module.exports = { loadArchive, upsertReport, DIST, ARCHIVE_FILE };
