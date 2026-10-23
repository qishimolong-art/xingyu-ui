import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { formatStockProfitLossDetailReportDate } from './modules/stock-profit-loss-detail-report-date';

const currentDir = dirname(fileURLToPath(import.meta.url));
const tableSource = readFileSync(
  join(currentDir, 'modules/stock-check-readonly-table.vue'),
  'utf8',
);
const indexSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const apiSource = readFileSync(
  join(
    currentDir,
    '../../../../api/erp/report/stock-profit-loss-detail/index.ts',
  ),
  'utf8',
);

describe('配件盈亏明细表', () => {
  it('按确认顺序展示 20 个业务字段', () => {
    const expectedTitles = [
      '盘点类型',
      '单号',
      '日期',
      '编码',
      '名称',
      '仓库',
      '货架',
      '盈亏数',
      '成本单价',
      '调整单价',
      '实盘数',
      '盈亏额',
      '制单人',
      '车型',
      '原因',
      '产地',
      '规格',
      '图号',
      '关联单号',
      '明细备注',
    ];
    const titles = [...tableSource.matchAll(/title:\s*'([^']+)'/g)].map(
      (match) => match[1],
    );

    expect(titles).toEqual(expectedTitles);
  });

  it('使用独立明细分页、全条件汇总和导出接口', () => {
    expect(apiSource).toContain(
      "const BASE_URL = '/erp/business-report/stock-profit-loss-detail'",
    );
    expect(tableSource).toContain('getStockProfitLossDetailPage(params)');
    expect(tableSource).toContain('getStockProfitLossDetailSummary');
    expect(tableSource).toContain('exportStockProfitLossDetail');
    expect(tableSource).toContain('全条件合计');
  });

  it('与销售手推车统一 Grid 、工具栏、汇总和分页样式', () => {
    expect(tableSource).toContain('useVbenVxeGrid');
    expect(tableSource).toContain('prepareSaleDocumentListColumns');
    expect(tableSource).toContain('TableAction');
    expect(tableSource).toContain(
      'toolbarConfig: { refresh: true, search: true }',
    );
    expect(tableSource).toContain('table-title="配件盈亏明细表"');
    expect(tableSource).toContain('.vxe-grid--pager-wrapper');
    expect(tableSource).not.toContain('<Card');
    expect(tableSource).not.toMatch(/<Table(?:\s|>)/);
    expect(tableSource).not.toContain('<Pagination');
  });

  it('保留权限控制、字段隐藏、远程分页和盘点单详情下钻', () => {
    expect(tableSource).toContain(
      "hasAccessByCodes(['erp:stock-check:export'])",
    );
    expect(tableSource).toContain('summary.value.hiddenFields');
    expect(tableSource).toContain('priceVisible');
    expect(tableSource).toContain('pageNo: page.currentPage');
    expect(tableSource).toContain('pageSize: page.pageSize');
    expect(tableSource).toContain('const checkId = Number(row.checkId)');
    expect(tableSource).toContain('sourceDetailRef.value?.open(40, checkId)');
    expect(indexSource).toContain("check: '配件盈亏明细表'");
  });

  it('金额固定两位且数量继续按原精度去尾零', () => {
    expect(tableSource).toContain('formatStockReportMoney(cellValue)');
    expect(tableSource).toContain('formatStockReportMoney(value)');
    expect(tableSource).toContain('formatStockReportQuantity(cellValue, 3)');
    expect(tableSource).not.toContain('maximumFractionDigits: 6');
  });

  it('正确格式化后端时间戳，避免把 1790 开头的毫秒值显示为 1794 年', () => {
    const milliseconds = 1_790_593_200_000;
    const expected = '2026-09-28 19:00:00';

    expect(formatStockProfitLossDetailReportDate(milliseconds)).toBe(expected);
    expect(formatStockProfitLossDetailReportDate(String(milliseconds))).toBe(
      expected,
    );
    expect(formatStockProfitLossDetailReportDate(milliseconds / 1000)).toBe(
      expected,
    );
    expect(formatStockProfitLossDetailReportDate('2026-09-28 19:00:00')).toBe(
      expected,
    );
    expect(formatStockProfitLossDetailReportDate(null)).toBe('-');
    expect(formatStockProfitLossDetailReportDate('not-a-date')).toBe('-');
    expect(tableSource).not.toContain('dayjs(String(cellValue))');
  });
});
