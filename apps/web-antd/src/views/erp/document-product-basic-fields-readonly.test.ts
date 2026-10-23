import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const documentItemForms = [
  'purchase/in/modules/item-form.vue',
  'purchase/invoice/modules/item-form.vue',
  'purchase/order/modules/item-form.vue',
  'purchase/return/modules/item-form.vue',
  'sale/cart/modules/item-form.vue',
  'sale/order/modules/item-form.vue',
  'sale/out/modules/item-form.vue',
  'sale/quote/modules/item-form.vue',
  'sale/return/modules/item-form.vue',
  'stock/check/modules/item-form.vue',
  'stock/in/modules/item-form.vue',
  'stock/move/modules/item-form.vue',
  'stock/out/modules/item-form.vue',
  'stock/transfer-out/modules/item-form.vue',
  'stock/warehouse-move/modules/item-form.vue',
];
const productBasicFields = ['brand', 'vehicleModel', 'originPlace', 'standard'];

describe('document product basic fields', () => {
  it.each(documentItemForms)(
    '%s does not edit product master-data snapshots',
    (relativePath) => {
      const source = readFileSync(join(currentDir, relativePath), 'utf8');

      productBasicFields.forEach((field) => {
        expect(source).not.toMatch(
          new RegExp(`v-model:value=(?:"|')(?:row|item)\\.${field}(?:"|')`),
        );
      });
    },
  );
});
