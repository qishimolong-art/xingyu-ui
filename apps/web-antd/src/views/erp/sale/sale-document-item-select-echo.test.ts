import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const saleDir = 'apps/web-antd/src/views/erp/sale';

function readSaleSource(path: string) {
  return readFileSync(join(process.cwd(), saleDir, path), 'utf8');
}

describe('sale document item select echo', () => {
  it.each([
    ['quote', readSaleSource('quote/modules/item-form.vue')],
    ['cart', readSaleSource('cart/modules/item-form.vue')],
    ['order', readSaleSource('order/modules/item-form.vue')],
    ['return', readSaleSource('return/modules/item-form.vue')],
  ])('%s item form keeps unresolved ids out of option caches', (_, source) => {
    expect(source).toContain('CURRENT_SELECT_LABEL_PLACEHOLDER');
    expect(source).toContain('mergeResolvedOptionsById');
    expect(source).toContain('hydrateMissingCurrentSelectLabels');
    expect(source).toContain('isMissingDisplayName');
    expect(source).toContain('getWarehouse(');
    expect(source).toContain('getDept(');
    expect(source).not.toContain('name: row.warehouseName || row.warehouseId');
    expect(source).not.toContain(
      'name: row.deptName || row.warehouseDeptName || row.deptId',
    );
  });

  it('readonly sale item surfaces do not fall back to warehouse ids', () => {
    const readonlySources = [
      readSaleSource('quote/modules/item-form.vue'),
      readSaleSource('cart/modules/item-form.vue'),
      readSaleSource('order/modules/item-form.vue'),
      readSaleSource('return/modules/item-form.vue'),
      readSaleSource('priceadjust/modules/item-form.vue'),
      readSaleSource('priceadjust/modules/sale-out-item-select-modal.vue'),
      readSaleSource('out/modules/form.vue'),
    ];

    readonlySources.forEach((source) => {
      expect(source).not.toContain('warehouseName || row.warehouseId');
      expect(source).not.toContain('warehouseName || bill.warehouseId');
      expect(source).not.toContain('bill.warehouseName || bill.warehouseId');
      expect(source).not.toContain('row.warehouseName || row.warehouseId');
    });
  });
});
