import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));

const SHARED_ITEM_GRIDS = [
  [
    '销售手推车明细',
    'cart/modules/item-form.vue',
    'cart/modules/form.vue',
    'erp-sale-cart-item-list-v1',
  ],
  [
    '销售订单明细',
    'order/modules/item-form.vue',
    'order/modules/form.vue',
    'erp-sale-order-item-list-v1',
  ],
  [
    '销售报价明细',
    'quote/modules/item-form.vue',
    'quote/modules/form.vue',
    'erp-sale-quote-item-list-v1',
  ],
  [
    '销售退货明细',
    'return/modules/item-form.vue',
    'return/modules/form.vue',
    'erp-sale-return-item-list-v1',
  ],
  [
    '销售调价明细',
    'priceadjust/modules/item-form.vue',
    'priceadjust/modules/form.vue',
    'erp-sale-price-adjust-item-list-v1',
  ],
] as const;

const SALE_OUT_DETAIL_GRIDS = [
  'erp-sale-out-item-list-v1',
  'erp-sale-out-stock-item-list-v1',
] as const;

const ITEM_ACTION_COLUMN_SOURCE_PATHS = [
  'cart/data.ts',
  'order/data.ts',
  'quote/data.ts',
  'return/data.ts',
  'priceadjust/data.ts',
] as const;

const EXISTING_SALE_GRID_IDS = [
  'erp-sale-cart-list-v2',
  'erp-sale-order-list-v2',
  'erp-sale-quote-list-v2',
  'erp-sale-out-list-v2',
  'erp-sale-return-list-v2',
  'erp-sale-price-adjust-list-v2',
  'erp-sale-pick-list-v2',
  'erp-sale-delivery-list-v2',
  'erp-sale-customer-list-v2',
  'erp-sale-config-list-v1',
  'erp-sale-quote-detail-report-list-v1',
  'erp-sale-out-detail-report-list-v1',
  'erp-sale-pick-detail-report-list',
  'erp-sale-delivery-detail-report-list',
  'erp-sale-report-list-v2',
] as const;

function readSaleFile(path: string) {
  return readFileSync(join(currentDir, path), 'utf8');
}

function expectColumnStorage(source: string, count = 1) {
  const storagePattern =
    /customConfig:\s*\{[\s\S]*?storage:\s*\{\s*fixed:\s*true,\s*resizable:\s*true,\s*sort:\s*true,\s*visible:\s*true,?\s*\}/g;

  expect(source.match(storagePattern)).toHaveLength(count);
}

describe('sale detail column settings storage', () => {
  it.each(SHARED_ITEM_GRIDS)(
    '%s uses one stable id and persists all column settings across form modes',
    (_name, itemPath, formPath, gridId) => {
      const itemSource = readSaleFile(itemPath);
      const formSource = readSaleFile(formPath);

      expect(itemSource).toContain(`id: '${gridId}'`);
      expect(itemSource.match(new RegExp(gridId, 'g'))).toHaveLength(1);
      expectColumnStorage(itemSource);
      expect(formSource).toContain('<ItemForm');
      expect(formSource).toContain(':disabled="formType === \'detail\'"');
    },
  );

  it.each(SHARED_ITEM_GRIDS.slice(0, 3))(
    '%s keeps the toolbar available in read-only detail mode',
    (_name, itemPath) => {
      const source = readSaleFile(itemPath);

      expect(source).toMatch(
        /toolbarConfig:\s*\{\s*enabled:\s*true,\s*slots:\s*\{\s*buttons:\s*'toolbar-buttons',\s*tools:\s*'toolbar-tools'\s*\}/,
      );
    },
  );

  it('keeps the complete toolbar available on the sale price-adjust item grid', () => {
    const source = readSaleFile('priceadjust/modules/item-form.vue');

    expect(source).toMatch(
      /toolbarConfig:\s*\{\s*custom:\s*true,\s*enabled:\s*true,\s*refresh:\s*\{\s*queryMethod:\s*\(\)\s*=>\s*refreshItemGrid\(\),?\s*\},\s*slots:\s*\{\s*buttons:\s*'toolbar-buttons',\s*tools:\s*'toolbar-tools'\s*\},\s*zoom:\s*true,?\s*\}/,
    );
    expect(source).toContain('<template #toolbar-tools>');
  });

  it('gives both sale-out read-only detail grids isolated storage and complete toolbars', () => {
    const source = readSaleFile('out/modules/form.vue');

    for (const gridId of SALE_OUT_DETAIL_GRIDS) {
      expect(source).toContain(`id: '${gridId}'`);
      expect(source.match(new RegExp(gridId, 'g'))).toHaveLength(1);
    }
    expectColumnStorage(source, 2);
    expect(
      source.match(
        /toolbarConfig:\s*\{\s*custom:\s*true,\s*enabled:\s*true,\s*refresh:\s*true,\s*refreshOptions:\s*\{\s*queryMethod:\s*\(\)\s*=>\s*refreshSaleOutItemGrids\(\),?\s*\},\s*zoom:\s*true,?\s*\}/g,
      ),
    ).toHaveLength(2);
  });

  it('uses seven new ids without colliding with existing sale list and report grids', () => {
    const detailIds = [
      ...SHARED_ITEM_GRIDS.map(([, , , gridId]) => gridId),
      ...SALE_OUT_DETAIL_GRIDS,
    ];
    const allIds = [...EXISTING_SALE_GRID_IDS, ...detailIds];

    expect(detailIds).toHaveLength(7);
    expect(new Set(detailIds).size).toBe(detailIds.length);
    expect(new Set(allIds).size).toBe(allIds.length);
  });

  it.each(ITEM_ACTION_COLUMN_SOURCE_PATHS)(
    '%s gives the editable item operation column a stable field',
    (path) => {
      const source = readSaleFile(path);

      expect(source).toMatch(
        /export function useFormItemColumns[\s\S]*?field: 'actions',\s*title: '操作',[\s\S]*?slots: \{ default: 'actions' \}/,
      );
    },
  );
});
