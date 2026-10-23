import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const detailSource = readFileSync(
  join(currentDir, 'modules', 'detail-modal.vue'),
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
    'receivable-aging',
    'index.ts',
  ),
  'utf8',
);

describe('receivable aging report contract', () => {
  it('keeps the exact fifteen business columns and excludes store name', () => {
    for (const title of [
      '客户',
      '客户类型',
      '余额',
      '信用额度',
      '信用余额',
      '1个月内',
      '2个月内',
      '3个月内',
      '3个月至半年内',
      '半年至一年内',
      '一年以上',
      '区域',
      '业务员',
      '部门',
      '开发员',
    ])
      expect(pageSource).toContain(`'${title}'`);
    expect(pageSource).not.toContain('账套店名');
  });

  it('uses server paging sorting summary and all report endpoints', () => {
    expect(pageSource).toContain("component: 'ErpLazyPageSelect'");
    expect(pageSource).toContain('remote: true');
    expect(pageSource).toContain('getReceivableAgingReportSummary');
    expect(apiSource).toContain('/erp/receivable-aging-report/page');
    expect(apiSource).toContain('/erp/receivable-aging-report/summary');
    expect(apiSource).toContain('/erp/receivable-aging-report/detail-page');
    expect(apiSource).toContain('/erp/receivable-aging-report/export-excel');
  });

  it('uses the sale-cart header and bottom summary presentation', () => {
    expect(pageSource).toContain('class="receivable-aging-report__grid"');
    expect(pageSource).toContain('<template #bottom>');
    expect(pageSource).toContain('全条件合计：');
    expect(pageSource).toContain('v-for="item in summaryItems"');
    expect(pageSource).toContain('.vxe-header--column.is--sortable');
    expect(pageSource).toContain('.vxe-header--column .vxe-cell--sort');
    expect(pageSource).not.toContain('showFooter: true');
    expect(pageSource).not.toContain('footerMethod');
  });

  it('supports customer amount and source document read-only details', () => {
    expect(pageSource).toContain(
      "import('#/views/erp/sale/customer/modules/detail.vue')",
    );
    expect(pageSource).toContain('openAmount');
    expect(detailSource).toContain('ReportDocumentDetailModal');
    expect(detailSource).toContain('class="!w-[85vw]"');
    expect(detailSource).toContain("y: 'calc(70vh - 180px)'");
  });
});
