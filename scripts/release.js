'use strict';

// 完整发布流程：数据拉取 -> HTML 生成 -> 归档更新 -> 企微通知 -> 部署（git 推送）。
// 可指定日期：npm run release -- 2026-07-15
require('../src/util').loadEnv();
const { runBuild } = require('../src/build');

const arg = process.argv[2] || process.env.REPORT_DATE || undefined;
if (arg && !/^\d{4}-\d{2}-\d{2}$/.test(arg)) {
  console.error('[release] 日期格式应为 YYYY-MM-DD，例如 2026-07-15');
  process.exit(1);
}

const doDeploy = process.env.DEPLOY !== 'off';

runBuild({ doNotify: true, doDeploy, targetDate: arg })
  .then((r) => {
    console.log(`[release] 完成：${r.actualDate}.html`);
    process.exit(0);
  })
  .catch((e) => {
    console.error('[release] 失败：', e.message);
    process.exit(1);
  });
