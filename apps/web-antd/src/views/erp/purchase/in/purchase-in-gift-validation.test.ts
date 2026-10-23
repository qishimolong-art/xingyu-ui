import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const itemFormSource = readFileSync(
  join(currentDir, 'modules/item-form.vue'),
  'utf8',
);
const apiSource = readFileSync(
  join(currentDir, '../../../../api/erp/purchase/in/index.ts'),
  'utf8',
);

describe('purchase in gift and price validation contract', () => {
  it('allows editing the gift flag and forces gift rows to zero price', () => {
    expect(itemFormSource).toContain('v-model:checked="row.gift"');
    expect(itemFormSource).toContain('@change="handleGiftChange(row)"');
    expect(itemFormSource).toContain('row.productPrice = 0');
    expect(itemFormSource).toContain('v-if="!disabled && !row.gift"');
  });

  it('rejects zero-priced non-gift rows before submission', () => {
    expect(itemFormSource).toContain(
      "parseBusinessNumberText(row.priceText, '入库单价', {",
    );
    expect(itemFormSource).toContain('min: 0.000001');
    expect(itemFormSource).toContain(
      'if (!item.gift && (!item.productPrice || item.productPrice <= 0))',
    );
    expect(itemFormSource).toContain('非赠品入库单价必须大于 0');
  });

  it('sends the gift flag through the purchase-in API model', () => {
    expect(apiSource).toMatch(
      /export interface PurchaseInItem[\s\S]*gift\?: boolean;/,
    );
  });
});
