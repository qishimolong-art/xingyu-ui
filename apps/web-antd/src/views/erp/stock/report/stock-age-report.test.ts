import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const indexSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const tableSource = readFileSync(
  join(currentDir, 'modules/stock-age-table.vue'),
  'utf8',
);
const apiSource = readFileSync(
  join(currentDir, '../../../../api/erp/report/stock-age/index.ts'),
  'utf8',
);

describe('库龄及长期未出库辅助报表', () => {
  it('replaces the age placeholder with the real report component', () => {
    expect(indexSource).toContain('StockAgeTable');
    expect(indexSource).toContain(`v-else-if="pageKey === 'age'"`);
    expect(indexSource).not.toContain('库龄分析待批次规则确认');
    expect(indexSource).not.toContain(`age: {\n    title:`);
  });

  it('uses the independent page summary and export APIs', () => {
    expect(apiSource).toContain("'/erp/business-report/stock-age'");
    expect(apiSource).toContain('`${BASE_URL}/page`');
    expect(apiSource).toContain('`${BASE_URL}/summary`');
    expect(apiSource).toContain('`${BASE_URL}/export-excel`');
    expect(tableSource).toContain('getStockAgeReportPage');
    expect(tableSource).toContain('getStockAgeReportSummary');
    expect(tableSource).toContain('exportStockAgeReport');
  });

  it('shows the confirmed auxiliary-aging rule and seven grouped ranges', () => {
    expect(tableSource).toContain(
      '按最后有效出库时间计算；从未出库按最后入库时间计算；每行库存仅进入一个区间，非批次 FIFO 库龄。',
    );
    for (const label of [
      '1月以内',
      '2～3月',
      '4～6月',
      '7～12月',
      '1～2年',
      '2～3年',
      '3年以上',
    ]) {
      expect(tableSource).toContain(`label: '${label}'`);
    }
    expect(tableSource).toContain("title: '数量'");
    expect(tableSource).toContain("title: '金额'");
  });

  it('keeps amount columns permission-aware and only shows the full-filter total', () => {
    expect(tableSource).toContain('const amountVisible = computed');
    expect(tableSource).toContain('if (amountVisible.value)');
    expect(tableSource).not.toContain('本页小计');
    expect(tableSource).toContain('全条件合计');
    expect(tableSource).toContain('summary.value.unclassifiedRowCount');
  });

  it('uses the sales-cart VXE shell without pinned columns or JSON row rendering', () => {
    expect(tableSource).toContain('useVbenVxeGrid');
    expect(tableSource).toContain('prepareSaleDocumentListColumns');
    expect(tableSource).toContain('TableAction');
    expect(tableSource).toContain(
      'toolbarConfig: { refresh: true, search: true }',
    );
    expect(tableSource).toContain('table-title="库龄分析"');
    expect(tableSource).toContain("type: 'seq'");
    expect(tableSource).toContain('seqMethod: ({ rowIndex })');
    expect(tableSource).not.toContain("fixed: 'left'");
    expect(tableSource).not.toContain('<Card');
    expect(tableSource).not.toMatch(/<Table(?:\s|>)/);
    expect(tableSource).not.toContain('<Pagination');
    expect(tableSource).not.toContain('#bodyCell');
  });

  it('keeps collapsed search meaningful and aligns placeholder typography', () => {
    expect(tableSource).toContain('collapsed: true');
    expect(tableSource).toContain('collapsedRows: 1');
    expect(tableSource).toContain('.ant-input::placeholder');
    expect(tableSource).toContain('.ant-select-selection-placeholder');
    expect(tableSource).toContain(
      '.ant-select-selection-search-input::placeholder',
    );
    expect(tableSource).toContain('.ant-picker-input');
  });

  it('uses ten-row pagination and protects the latest request', () => {
    expect(tableSource).toContain(
      'pagerConfig: { pageSize: 10, pageSizes: [10, 20, 50, 100] }',
    );
    expect(tableSource).toContain('const currentRequestId = ++requestId');
    expect(tableSource).toContain('if (currentRequestId === requestId)');
    expect(tableSource).toContain('getStockWarehouseFilterOptionPage');
    expect(tableSource).toContain('getWarehouseDeptSimplePage');
  });

  it('does not reintroduce supplier or purchaser fields', () => {
    expect(tableSource).not.toContain('供应商');
    expect(tableSource).not.toContain('采购员');
    expect(apiSource).not.toContain('supplier');
    expect(apiSource).not.toContain('purchaser');
  });
});
