import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const purchaseDir = dirname(fileURLToPath(import.meta.url));

const importFormFiles = [
  'order/modules/detail-import-form.vue',
  'order/modules/import-form.vue',
  'order/modules/order-import-form.vue',
  'in/modules/import-form.vue',
  'in/modules/order-import-form.vue',
  'return/modules/import-form.vue',
  'return/modules/order-import-form.vue',
  'invoice/modules/import-form.vue',
  'priceadjust/modules/import-form.vue',
  'priceadjust/modules/order-import-form.vue',
];

describe('purchase import product identity choice tips', () => {
  it('shows the one-of-two product identity rule in every purchase import dialog', () => {
    for (const file of importFormFiles) {
      const source = readFileSync(join(purchaseDir, file), 'utf-8');

      expect(source, file).toContain(
        '配件编码、配件名称、厂家编码是三选一字段：填写其中任意一个即可；如果多列都填，必须对应同一配件。',
      );
      expect(source, file).not.toContain('产品编码需能匹配');
    }
  });
});
