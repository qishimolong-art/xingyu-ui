import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const listSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const formSource = readFileSync(join(currentDir, 'modules/form.vue'), 'utf8');
const apiSource = readFileSync(
  join(currentDir, '../../../../api/erp/sale/priceadjust/index.ts'),
  'utf8',
);

describe('sale price adjust import contract', () => {
  it('keeps whole-order list import separate from current-form detail import', () => {
    expect(listSource).toContain('importSalePriceAdjustOrder');
    expect(listSource).toContain('exportSalePriceAdjustOrderImportTemplate');
    expect(formSource).toContain('importSalePriceAdjust');
    expect(formSource).toContain('exportSalePriceAdjustImportTemplate');
    expect(apiSource).toContain("'/erp/sale-price-adjust/import-order'");
    expect(apiSource).toContain(
      "'/erp/sale-price-adjust/get-order-import-template'",
    );
  });
});
