import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = join(currentDir, '../../../../../../../');
const pageSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const apiSource = readFileSync(
  join(
    workspaceRoot,
    'apps/web-antd/src/api/erp/report/payable-aging/index.ts',
  ),
  'utf8',
);
const sqlSource = readFileSync(
  join(workspaceRoot, '../code/sql/mysql/erp_payable_aging_report_v264.sql'),
  'utf8',
);

describe('payable aging report contract', () => {
  it('keeps the confirmed fields, grouped monthly header and event-date notice', () => {
    for (const text of [
      '供应商',
      '供应商类型',
      '采购员',
      '余额',
      '一年内',
      '一月',
      '十二月',
      '两年内',
      '三年内',
      '三年以上',
      '按业务发生日期带符号分桶',
    ]) {
      expect(pageSource).toContain(text);
    }
    expect(pageSource).not.toContain('ReportDocumentDetailModal');
    expect(pageSource).not.toContain('账套店名');
    expect(pageSource).not.toContain("fixed: 'left'");
  });

  it('uses paged supplier search, server paging, summary and export permissions', () => {
    expect(pageSource).toContain('api: getSupplierSimplePage');
    expect(pageSource).toContain('pageSize: 10');
    expect(pageSource).toContain('getPayableAgingReportPage(params)');
    expect(pageSource).toContain('getPayableAgingReportSummary');
    expect(pageSource).toContain('erp:payable-aging-report:export');
    expect(pageSource).toContain('erp:payable-account:query');
    expect(pageSource).toContain('<template #bottom>');
    expect(pageSource).toContain('全条件合计：');
    expect(pageSource).toContain('v-for="item in summaryItems"');
    expect(pageSource).not.toContain('showFooter: true');
    expect(pageSource).not.toContain('footerMethod');
  });

  it('uses the sale-cart compact header and query-summary presentation', () => {
    expect(pageSource).toContain('.vxe-header--column.is--sortable');
    expect(pageSource).toContain('.vxe-header--column .vxe-cell--sort');
    expect(pageSource).toContain('font-size: 12px');
    expect(pageSource).toContain('class="payable-aging-report__summary"');
    expect(pageSource).toContain("label: '供应商行数'");
    expect(pageSource).toContain("label: '三年以上'");
  });

  it('exposes the three independent report endpoints', () => {
    expect(apiSource).toContain('/erp/payable-aging-report/page');
    expect(apiSource).toContain('/erp/payable-aging-report/summary');
    expect(apiSource).toContain('/erp/payable-aging-report/export-excel');
  });

  it('keeps the migration repeatable and free from business data rewrites', () => {
    expect(sqlSource).toContain("'aging-analysis'");
    expect(sqlSource).toContain("'erp/report/payable-aging/index'");
    expect(sqlSource).toContain("'erp:payable-aging-report:query'");
    expect(sqlSource).toContain("'erp:payable-aging-report:export'");
    expect(sqlSource).not.toMatch(/\bDELETE\b/i);
    expect(sqlSource).not.toMatch(/\bTRUNCATE\b/i);
    expect(sqlSource).not.toMatch(/\bALTER\s+TABLE\b/i);
  });
});
