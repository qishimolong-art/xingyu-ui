import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const listSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const formSource = readFileSync(join(currentDir, 'modules/form.vue'), 'utf8');
const apiSource = readFileSync(
  join(currentDir, '../../../../api/erp/sale/return/index.ts'),
  'utf8',
);

describe('sale return import contract', () => {
  it('keeps whole-order list import separate from current-form detail import', () => {
    expect(listSource).toContain('importSaleReturnOrder');
    expect(listSource).toContain('exportSaleReturnOrderImportTemplate');
    expect(formSource).toContain('importSaleReturn');
    expect(formSource).toContain('exportSaleReturnImportTemplate');
    expect(apiSource).toContain("'/erp/sale-return/import-order'");
    expect(apiSource).toContain("'/erp/sale-return/get-order-import-template'");
  });
});
