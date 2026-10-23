import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  formatPurchaseReturnPriceInput,
  normalizePurchaseReturnPrice,
} from './purchase-return-price-input';

const currentDir = dirname(fileURLToPath(import.meta.url));
const itemFormSource = readFileSync(join(currentDir, 'item-form.vue'), 'utf8');

describe('purchase return price input formatting', () => {
  it.each([
    [20, '20'],
    ['20.5', '20.5'],
    ['20.567891', '20.567891'],
    [0, '0'],
  ])('formats price %s as %s', (value, expected) => {
    expect(formatPurchaseReturnPriceInput(value)).toBe(expected);
  });

  it('normalizes the editable price to at most six decimals', () => {
    expect(normalizePurchaseReturnPrice(20.567891)).toBe(20.567891);
  });

  it('keeps the text input and applies formatting during initialization and blur', () => {
    expect(itemFormSource).toContain('v-model:value="row.productPriceText"');
    expect(itemFormSource).toContain('@blur="handleProductPriceBlur(row)"');
    expect(itemFormSource).toContain('formatPurchaseReturnPriceInput(');
    expect(itemFormSource).toContain('normalizePurchaseReturnPrice(');
  });

  it('does not send the display-only price text to the parent payload', () => {
    expect(itemFormSource).toContain('productPriceText: _productPriceText');
  });
});
