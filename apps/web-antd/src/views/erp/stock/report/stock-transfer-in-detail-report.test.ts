import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const tableSource = readFileSync(
  join(currentDir, 'modules/stock-transfer-in-detail-report-table.vue'),
  'utf8',
);
const indexSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const apiSource = readFileSync(
  join(
    currentDir,
    '../../../../api/erp/report/stock-transfer-in-detail/index.ts',
  ),
  'utf8',
);

describe('调拨入库查询报表', () => {
  it('按入库视角展示 16 个业务列且没有来源出库单号或序号', () => {
    const expectedTitles = [
      '发生日期',
      '单号',
      '零件编码',
      '零件名称',
      '适用车型',
      '产地',
      '调入仓库',
      '数量',
      '单价',
      '金额',
      '成本单价',
      '成本金额',
      '制单人',
      '调出仓库',
      '规格',
      '图号',
    ];
    const titles = [...tableSource.matchAll(/title:\s*'([^']+)'/g)].map(
      (match) => match[1],
    );

    expect(titles).toEqual(expectedTitles);
    expect(tableSource).not.toContain('来源出库单号');
    expect(tableSource).not.toContain("field: 'sequence'");
  });

  it('使用独立分页、全条件汇总、分批导出和严格权限组合', () => {
    expect(apiSource).toContain("'/erp/stock-transfer-in-detail-report/page'");
    expect(apiSource).toContain(
      "'/erp/stock-transfer-in-detail-report/summary'",
    );
    expect(apiSource).toContain(
      "'/erp/stock-transfer-in-detail-report/export-excel'",
    );
    expect(tableSource).toContain('全条件合计');
    expect(tableSource).toContain(
      "hasAccessByCodes(['erp:stock-transfer-in-detail-report:export'])",
    );
    expect(tableSource).toContain(
      "hasAccessByCodes(['erp:stock-transfer-in:export'])",
    );
  });

  it('默认本月、远程选择器、分页排序及独立防旧请求汇总均已接入', () => {
    expect(tableSource).toContain("dayjs().startOf('month')");
    expect(tableSource).toContain("dayjs().endOf('month')");
    expect(tableSource).toContain('getWarehouseSimplePage');
    expect(tableSource).toContain('getStockTransferInUserSimplePage');
    expect(tableSource).toContain('pageSizes: [10, 20, 50]');
    expect(tableSource).toContain('remote: true');
    expect(tableSource).toContain('let pageRequestId = 0');
    expect(tableSource).toContain('let summaryRequestId = 0');
    expect(tableSource).toContain('汇总加载失败，列表数据不受影响');
  });

  it('查询区默认只显示一行并统一占位文字字号', () => {
    expect(tableSource).toContain('collapsed: true');
    expect(tableSource).toContain('collapsedRows: 1');
    expect(tableSource).toContain('.ant-input::placeholder');
    expect(tableSource).toContain('.ant-input-number-input::placeholder');
    expect(tableSource).toContain('.ant-select-selection-placeholder');
    expect(tableSource).toContain(
      '.ant-select-selection-search-input::placeholder',
    );
    expect(tableSource).toContain('.ant-picker-input');
  });

  it('表头样式与销售手推车保持一致', () => {
    expect(tableSource).toContain('.vxe-table--render-default');
    expect(tableSource).toContain(
      '.vxe-header--column.is--sortable .vxe-cell--title',
    );
    expect(tableSource).toContain('color: #1677ff');
    expect(tableSource).toContain('.vxe-header--column .vxe-cell--sort');
    expect(tableSource).toContain('display: none');
  });

  it('金额固定两位、数量去尾零并通过统一弹窗打开调拨入库只读详情', () => {
    expect(tableSource).toContain('formatter: quantityFormatter');
    expect(tableSource).toContain('formatter: moneyFormatter');
    expect(tableSource).toContain(
      'formatStockReportQuantity(summary.value.totalCount, 2)',
    );
    expect(tableSource).toContain(
      'formatStockReportMoney(summary.value.totalAmount)',
    );
    expect(tableSource).toContain('REPORT_DOCUMENT_TYPES.STOCK_TRANSFER_IN');
    expect(tableSource).toContain('v-if="row.moveId && row.documentNo"');
    expect(tableSource).toContain('<ReportDocumentDetailModal');
    expect(indexSource).toContain("'transfer-in-detail': '调拨入库查询报表'");
    expect(indexSource).toContain('经营报表 · 库存管理');
  });

  it('字段权限联动筛选、列表、金额汇总和导出', () => {
    expect(tableSource).toContain('summary.value.hiddenFields');
    expect(tableSource).toContain('summary.value.priceVisible !== false');
    expect(tableSource).toContain('summary.value.amountVisible !== false');
    expect(tableSource).toContain(
      '!hiddenFields.value.has(String(column.field))',
    );
  });
});
