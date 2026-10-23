import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const indexSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');

const customerForbiddenTexts = [
  '第一阶段',
  '只读复用',
  '依赖 SQL',
  '未完成原因',
  '后续接入',
  '待客户确认',
  '双成本开关',
  '库存游标',
  '不提供新增',
  '待数据接入',
];

describe('经营报表部门利润及驾驶舱独立页面契约', () => {
  it('splits M9 into independent report pages', () => {
    expect(indexSource).toContain('BusinessReportShell');
    expect(indexSource).toContain(
      "defineOptions({ name: 'ErpReportProfitDashboard' })",
    );
    expect(indexSource).toContain("'department-profit': '部门利润汇总'");
    expect(indexSource).toContain("'company-profit': '公司经营利润汇总'");
    expect(indexSource).toContain("'internal-offset': '内部收入成本抵销'");
    expect(indexSource).toContain("'unrealized-profit': '未实现内部利润明细'");
    expect(indexSource).toContain("'realized-profit': '已实现内部利润调整'");
    expect(indexSource).toContain("cockpit: '经营驾驶舱'");
    expect(indexSource).toContain("'metric-drilldown': '指标下钻明细'");
    expect(indexSource).toContain("history: '历史利润口径'");
    expect(indexSource).toContain('normalizePageKey(currentPath.value)');
    expect(indexSource).not.toContain('TabPane');
    expect(indexSource).not.toContain('Tabs');
  });

  it('keeps customer-facing M9 pages free of internal implementation notes', () => {
    for (const text of customerForbiddenTexts) {
      expect(indexSource).not.toContain(text);
    }
  });

  it('keeps unconfirmed formulas as formal business statuses', () => {
    expect(indexSource).toContain('待规则确认');
    expect(indexSource).toContain('不可计算');
    expect(indexSource).toContain('成本缺失');
    expect(indexSource).toContain('不按0计算');
    expect(indexSource).toContain('正式经营利润');
    expect(indexSource).toContain('正式指标按已确认规则输出');
    expect(indexSource).toContain(
      '缺少正式成本、分摊、抵销和利润公式时不输出利润',
    );
  });

  it('reuses existing report data sources without introducing a new profit formula', () => {
    expect(indexSource).toContain('getSaleReportSummary');
    expect(indexSource).toContain('getSaleReportTrend');
    expect(indexSource).toContain('getSaleReportDeptPage');
    expect(indexSource).toContain('getPurchaseReportSummary');
    expect(indexSource).toContain('getPurchaseReportDeptPage');
    expect(indexSource).toContain('getStockTransferLedgerTotal');
    expect(indexSource).toContain('getPayableExpensePage');
    expect(indexSource).toContain('getOtherIncomePage');
    expect(indexSource).toContain('loadSource');
    expect(indexSource).not.toContain(
      'saleSummary.value.netAmount - purchaseSummary.value.netAmount',
    );
  });

  it('provides clean report interactions, pagination and export', () => {
    expect(indexSource).toContain('DatePicker');
    expect(indexSource).toContain('RangePicker');
    expect(indexSource).toContain('Select');
    expect(indexSource).toContain('Input');
    expect(indexSource).toContain('Table');
    expect(indexSource).toContain('Pagination');
    expect(indexSource).toContain('查询');
    expect(indexSource).toContain('重置');
    expect(indexSource).toContain('导出');
    expect(indexSource).toContain('downloadFileFromBlobPart');
    expect(indexSource).toContain('DEFAULT_PAGE_SIZE = 10');
    expect(indexSource).toContain('pageSize: DEFAULT_PAGE_SIZE');
    expect(indexSource).toContain('每页 10 条');
  });

  it('keeps report pages stretched and scrollable inside the business report shell', () => {
    expect(indexSource).toContain(':body-scrollable="true"');
    expect(indexSource).toContain('profit-dashboard-report-page');
    expect(indexSource).toMatch(
      /\.profit-dashboard-report-page\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex:\s*1 1 auto;[\s\S]*?flex-direction:\s*column;[\s\S]*?min-height:\s*0;[\s\S]*?\}/,
    );
    expect(indexSource).toContain(':scroll="{ x: 1510, y: 360 }"');
    expect(indexSource).toContain('show-size-changer');
  });
});
