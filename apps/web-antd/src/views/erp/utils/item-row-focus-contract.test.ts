import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const itemFormPaths = [
  '../purchase/order/modules/item-form.vue',
  '../purchase/in/modules/item-form.vue',
  '../purchase/return/modules/item-form.vue',
  '../sale/order/modules/item-form.vue',
  '../sale/cart/modules/item-form.vue',
  '../sale/quote/modules/item-form.vue',
  '../sale/return/modules/item-form.vue',
  '../stock/in/modules/item-form.vue',
  '../stock/out/modules/item-form.vue',
  '../stock/check/modules/item-form.vue',
  '../stock/move/modules/item-form.vue',
  '../stock/transfer-out/modules/item-form.vue',
  '../stock/warehouse-move/modules/item-form.vue',
];

describe('ERP added item row focus contract', () => {
  it.each(itemFormPaths)('%s targets the newly added row', (relativePath) => {
    const source = readFileSync(
      resolve(import.meta.dirname, relativePath),
      'utf8',
    );
    const insertStart = source.indexOf('async function insertStockProducts(');
    const insertEnd = source.indexOf(
      'function handleInlineStockSelected(',
      insertStart,
    );
    const insertSource = source.slice(insertStart, insertEnd);

    expect(source).toContain('createErpItemRowFocusController');
    expect(source).toContain('focusEditableInputByRowKey');
    expect(source).toContain(':data-erp-item-row-key="getItemRowKey(row)"');
    expect(source).toContain("itemRowFocusController.focus(row, 'product')");
    expect(insertSource).toContain('itemRowFocusController.focus(');
    expect(insertSource).toContain("'count'");
    expect(insertSource).not.toContain('queueFocusFirstItemCountInput()');
    expect(insertSource).not.toContain('focusProductNameInput(replacement)');
  });
});
