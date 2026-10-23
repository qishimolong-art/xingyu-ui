import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));

function readAccountingSource(...segments: string[]) {
  return readFileSync(join(currentDir, ...segments), 'utf8');
}

const masterDetailListPages = [
  ['pre-receipt', 'index.vue'],
  ['pre-payment', 'index.vue'],
  ['pre-receivable', 'index.vue'],
  ['other-receivable', 'index.vue'],
  ['other-payable', 'index.vue'],
];

describe('accounting list performance contracts', () => {
  it('keeps accounting master-detail normal list page requests slim', () => {
    masterDetailListPages.forEach((path) => {
      const source = readAccountingSource(...path);

      expect(source).toContain('includeItems: false');
    });
  });

  it('uses a paged lazy selector for voucher list maker filter', () => {
    const dataSource = readAccountingSource('voucher', 'data.ts');
    const apiSource = readAccountingSource(
      '..',
      '..',
      '..',
      'api',
      'erp',
      'finance',
      'accounting',
      'voucher',
      'index.ts',
    );

    expect(dataSource).toContain("component: 'ErpLazyPageSelect'");
    expect(dataSource).toContain('api: getVoucherUserSimplePage');
    expect(dataSource).toContain('pageSize: 10');
    expect(apiSource).toContain('/erp/voucher/user-simple-page');
  });
});
