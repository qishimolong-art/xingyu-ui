import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
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
    'payable-detail',
    'index.ts',
  ),
  'utf8',
);

describe('应付账明细查询报表', () => {
  it('按确认顺序展示 13 列且没有固定列', () => {
    const columns = [
      '供应商编码',
      '供应商',
      '单据日期',
      '单据类型',
      '业务单号',
      '制单人',
      '增加应付',
      '付款金额',
      '上日余额',
      '末期应付',
      '凭证号',
      '备注',
      '供应商类型',
    ];
    let previous = -1;
    for (const column of columns) {
      const current = pageSource.indexOf(`title: '${column}'`);
      expect(current).toBeGreaterThan(previous);
      previous = current;
    }
    expect(pageSource).not.toContain("fixed: 'left'");
    expect(pageSource).not.toContain('预付金额');
  });

  it('使用分页选择器、服务端汇总和远程排序', () => {
    expect(pageSource).toContain('useVbenVxeGrid');
    expect(pageSource).toContain('prepareSaleDocumentListColumns');
    expect(pageSource).toContain('getPayableDetailReportPage');
    expect(pageSource).toContain('getPayableDetailReportSummary');
    expect(pageSource).toContain("component: 'ErpLazyPageSelect'");
    expect(pageSource).toContain('getSupplierSimplePage');
    expect(pageSource).toContain('getPayableAccountUserSimplePage');
    expect(pageSource).toContain('全条件合计');
    expect(pageSource).toContain('remote: true');
  });

  it('导出权限、接口和金额遮罩完整', () => {
    expect(pageSource).toContain('erp:payable-detail-report:export');
    expect(pageSource).toContain('erp:payable-account:query');
    expect(pageSource).toContain('amountVisible');
    expect(pageSource).toContain('v-if="canExport"');
    expect(apiSource).toContain('/erp/payable-detail-report/page');
    expect(apiSource).toContain('/erp/payable-detail-report/summary');
    expect(apiSource).toContain('/erp/payable-detail-report/export-excel');
  });

  it('业务单号按五类来源打开共用只读详情', () => {
    expect(pageSource).toContain("slots: { default: 'documentNo' }");
    expect(pageSource).toContain('<ReportDocumentLink');
    expect(pageSource).toContain('ReportDocumentDetailModal');
    for (const type of [
      'FINANCE_PAYMENT',
      'PAYABLE_OTHER',
      'PURCHASE_IN',
      'PURCHASE_PRICE_ADJUST',
      'PURCHASE_RETURN',
    ]) {
      expect(pageSource).toContain(`REPORT_DOCUMENT_TYPES.${type}`);
    }
  });
});
