'use strict';

// 本地生成日报。可指定日期：npm run new -- 2026-07-15
require('../src/util').loadEnv();
const { runBuild } = require('../src/build');

const arg = process.argv[2] || process.env.REPORT_DATE || undefined;
if (arg && !/^\d{4}-\d{2}-\d{2}$/.test(arg)) {
  console.error('[new] 日期格式应为 YYYY-MM-DD，例如 2026-07-15');
  process.exit(1);
}

runBuild({ doNotify: false, doDeploy: false, targetDate: arg })
  .then((r) => {
    console.log(`[new] 完成：${r.actualDate}.html`);
    process.exit(0);
  })
  .catch((e) => {
    console.error('[new] 失败：', e.message);
    process.exit(1);
  });
