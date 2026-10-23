import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const itemFormSource = readFileSync(join(currentDir, 'item-form.vue'), 'utf8');
const purchaseReturnFormSource = readFileSync(
  join(currentDir, 'sale-return-purchase-return-form.vue'),
  'utf8',
);

describe('sale return item number inputs', () => {
  it('lets editable controls consume Insert before the business shortcut', () => {
    const editableGuardIndex = itemFormSource.indexOf(
      'if (isEditableEnterTarget(event.target)) return;',
    );
    const insertShortcutIndex = itemFormSource.indexOf(
      'canUseInlineStockSelector.value &&',
    );
    expect(editableGuardIndex).toBeGreaterThan(-1);
    expect(editableGuardIndex).toBeLessThan(insertShortcutIndex);
  });

  it('keeps the last visible business column flexible after column changes', () => {
    expect(itemFormSource).toContain(
      'applySaleDocumentItemColumnCustomization',
    );
    expect(itemFormSource).toContain('trailingFlexibleColumnMinWidth: 150');
    expect(itemFormSource).toContain('fit: false');
    expect(itemFormSource).toContain('fitSaleDocumentItemColumnsToWidth');
    expect(itemFormSource).toContain('custom: handleItemColumnCustom');
    expect(itemFormSource).toContain('buildCustomizedItemColumns(displayData)');
  });

  it('normalizes count and price text only after blur', () => {
    expect(itemFormSource).toContain('v-model:value="row.countText"');
    expect(itemFormSource).toContain('@blur="handleCountBlur(row)"');
    expect(itemFormSource).toContain('v-model:value="row.productPriceText"');
    expect(itemFormSource).toContain('@blur="handleProductPriceBlur(row)"');
    expect(itemFormSource).toContain('formatSaleReturnCountInput(');
    expect(itemFormSource).toContain('formatSaleReturnPriceInput(');
  });

  it('does not send editable display text to the parent payload', () => {
    expect(itemFormSource).toContain('countText: _countText');
    expect(itemFormSource).toContain('productPriceText: _productPriceText');
    expect(itemFormSource).toContain('taxPercentText: _taxPercentText');
  });

  it('keeps readonly count and price formatting unchanged', () => {
    expect(itemFormSource).toContain("formatSaleDecimal(row.count, '-')");
    expect(itemFormSource).toContain(
      "formatSaleAmount(row.productPrice, '-')",
    );
  });

  it('keeps the purchase-return conversion unit price at up to six decimals', () => {
    expect(purchaseReturnFormSource).toMatch(
      /v-model:value="record\.productPrice"[\s\S]*?:formatter="[\s\S]*?formatSaleAmount[\s\S]*?:precision="6"/,
    );
    expect(purchaseReturnFormSource).toContain(
      'saleDecimalMultiply(',
    );
  });
});
