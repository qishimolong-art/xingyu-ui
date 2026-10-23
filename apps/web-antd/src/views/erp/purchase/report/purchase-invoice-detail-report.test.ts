import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { formatPurchaseInvoiceDetailReportDate } from './modules/purchase-invoice-detail-report-date';

const currentDir = dirname(fileURLToPath(import.meta.url));
const wrapperSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const tableSource = readFileSync(
  join(currentDir, 'modules', 'purchase-invoice-detail-report-table.vue'),
  'utf8',
);
const apiSource = readFileSync(
  join(
    currentDir,
    '..',
    '..',
    '..',
    '..',
    'api',
    'erp',
    'report',
    'purchase-invoice-detail',
    'index.ts',
  ),
  'utf8',
);

describe('采购票据明细查询', () => {
  it('以独立页面接入采购经营报表并执行双重查询权限', () => {
    expect(wrapperSource).toContain("| 'invoice-detail'");
    expect(wrapperSource).toContain("'invoice-detail': '采购票据明细查询'");
    expect(wrapperSource).toContain('erp:purchase-invoice-detail-report:query');
    expect(wrapperSource).toContain('erp:purchase-invoice:query');
    expect(wrapperSource).toContain('<PurchaseInvoiceDetailReportTable');
  });

  it('严格按确认顺序展示 30 列且六个固定字段为空', () => {
    const columns = [
      '序号',
      '创建日期',
      '单号',
      '供应商名称',
      '开票日期',
      '开票类型',
      '发票号码',
      '零件编码',
      '零件名称',
      '单位',
      '数量',
      '含税单价',
      '含税金额',
      '结算情况',
      '税率',
      '车型',
      '品牌',
      '产地',
      '图号',
      '规格',
      '体积',
      '重量',
      '税收分类编码',
      '税收产品名称',
      '税收产品型号',
      '税收单位',
      '票据审核日期',
      '备注',
      '业务单号',
      '业务审核日期',
    ];
    let previous = -1;
    for (const column of columns) {
      const current = tableSource.indexOf(`title: '${column}'`);
      expect(current).toBeGreaterThan(previous);
      previous = current;
    }
    expect(tableSource.match(/formatter: emptyFormatter/g)).toHaveLength(6);
    expect(tableSource).not.toContain('外文名');
  });

  it('默认本月并使用远程分页、排序、汇总及懒加载供应商', () => {
    expect(tableSource).toContain("dayjs().startOf('month')");
    expect(tableSource).toContain("dayjs().endOf('month')");
    expect(tableSource).toContain("component: 'ErpLazyPageSelect'");
    expect(tableSource).toContain('getSupplierSimplePage');
    expect(tableSource).toContain('getPurchaseInvoiceDetailReportPage');
    expect(tableSource).toContain('getPurchaseInvoiceDetailReportSummary');
    expect(tableSource).toContain('sortFieldMap');
    expect(tableSource).toContain('remote: true');
    expect(tableSource).toContain(
      'pagerConfig: { pageSize: 10, pageSizes: [10, 20, 50] }',
    );
    expect(tableSource).toContain('全条件合计');
    expect(tableSource).toContain('summary.value.priceVisible !== false');
    expect(tableSource).toContain(
      'gridApi.formApi.setState({ schema: formSchema() })',
    );
    expect(tableSource).toContain('hiddenFields: summary.value.hiddenFields');
  });

  it('导出同时要求报表和原采购票据导出权限', () => {
    expect(tableSource).toContain('erp:purchase-invoice-detail-report:export');
    expect(tableSource).toContain('erp:purchase-invoice:export');
    expect(tableSource).toContain('v-if="canExport"');
    expect(apiSource).toContain('/erp/purchase-invoice-detail-report/page');
    expect(apiSource).toContain('/erp/purchase-invoice-detail-report/summary');
    expect(apiSource).toContain(
      '/erp/purchase-invoice-detail-report/export-excel',
    );
  });

  it('票据号码与三类业务单号打开对应只读详情', () => {
    for (const slot of ['documentNo', 'invoiceNo', 'businessNo']) {
      expect(tableSource).toContain(`slots: { default: '${slot}' }`);
    }
    expect(tableSource).toContain('REPORT_DOCUMENT_TYPES.PURCHASE_INVOICE');
    expect(tableSource).toContain(
      'REPORT_DOCUMENT_TYPES.PURCHASE_PRICE_ADJUST',
    );
    expect(apiSource).toContain('sourceDocId?: number');
    expect(apiSource).toContain('sourceType?: number');
  });

  it('正确格式化后端毫秒时间戳及日期字符串', () => {
    expect(formatPurchaseInvoiceDetailReportDate(1_788_752_845_000)).toBe(
      '2026-09-07',
    );
    expect(formatPurchaseInvoiceDetailReportDate('1788752845000')).toBe(
      '2026-09-07',
    );
    expect(formatPurchaseInvoiceDetailReportDate(1_788_752_845)).toBe(
      '2026-09-07',
    );
    expect(formatPurchaseInvoiceDetailReportDate('1788752845')).toBe(
      '2026-09-07',
    );
    expect(formatPurchaseInvoiceDetailReportDate('2026-09-07')).toBe(
      '2026-09-07',
    );
    expect(formatPurchaseInvoiceDetailReportDate(null)).toBe('-');
    expect(formatPurchaseInvoiceDetailReportDate('not-a-date')).toBe('-');
    expect(tableSource).not.toContain('dayjs(String(cellValue))');
  });
});
