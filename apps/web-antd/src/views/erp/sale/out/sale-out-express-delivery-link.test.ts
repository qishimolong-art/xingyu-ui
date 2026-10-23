import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const apiSource = readFileSync(
  resolve(currentDir, '../../../../api/erp/sale/out/index.ts'),
  'utf8',
);
const detailSource = readFileSync(join(currentDir, 'modules/form.vue'), 'utf8');
const listSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const deliverySource = readFileSync(
  resolve(currentDir, '../delivery/index.vue'),
  'utf8',
);

describe('sale out delivery express linkage', () => {
  it('uses the effective express flag with a legacy fallback for row color', () => {
    expect(apiSource).toContain('hasExpressFile?: boolean');
    expect(listSource).toContain(
      'row.hasExpressFile ?? Boolean(row.expressFileUrl)',
    );
  });

  it('loads the merged multi-image endpoint and preserves field permission', () => {
    expect(apiSource).toContain("'/erp/sale-out/express-file-page'");
    expect(detailSource).toContain('getSaleOutExpressFilePage');
    expect(detailSource).toContain("!isHidden('expressFileUrl')");
    expect(detailSource).toContain('<AImage');
    expect(detailSource).toContain(':preview="true"');
  });

  it('requires delivery express files and no longer calls them generic vouchers', () => {
    expect(deliverySource).toContain('上传快递单');
    expect(deliverySource).toContain('请先上传本次送货快递单');
    expect(deliverySource).not.toContain('送货凭证');
  });
});
