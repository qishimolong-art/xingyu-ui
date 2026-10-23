import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const readStockFile = (...segments: string[]) =>
  readFileSync(join(currentDir, ...segments), 'utf8');

const priceReferenceUtilsSource = readFileSync(
  join(currentDir, '../utils/price-reference.ts'),
  'utf8',
);

const stockDocumentCases = [
  {
    api: ['../../../api/erp/stock/in/index.ts'],
    form: ['in/modules/item-form.vue'],
    rowExpression: ':rows="renderedItemRows"',
    wrapperClass: 'stock-in-item-table-wrap',
  },
  {
    api: ['../../../api/erp/stock/out/index.ts'],
    form: ['out/modules/item-form.vue'],
    rowExpression: ':rows="renderedItemRows"',
    wrapperClass: 'stock-out-item-table-wrap',
  },
  {
    api: ['../../../api/erp/stock/check/index.ts'],
    form: ['check/modules/item-form.vue'],
    rowExpression: ':rows="renderedItemRows"',
    wrapperClass: 'stock-check-item-table-wrap',
  },
  {
    api: ['../../../api/erp/stock/move/index.ts'],
    form: ['move/modules/item-form.vue'],
    rowExpression: ':rows="getDisplayedItems()"',
    wrapperClass: 'stock-move-item-table-wrap',
  },
  {
    api: ['../../../api/erp/stock/move/index.ts'],
    form: ['transfer-out/modules/item-form.vue'],
    rowExpression: ':rows="renderedItemRows"',
    wrapperClass: 'transfer-out-item-table-wrap',
  },
  {
    api: ['../../../api/erp/stock/move/index.ts'],
    form: ['transfer-in/modules/form.vue'],
    rowExpression: ':rows="renderedItemRows"',
    wrapperClass: 'stock-transfer-in-item-table-wrap',
  },
  {
    api: ['../../../api/erp/stock/warehouse-move/index.ts'],
    form: ['warehouse-move/modules/item-form.vue'],
    rowExpression: ':rows="renderedItemRows"',
    wrapperClass: 'warehouse-move-item-table-wrap',
  },
];

const priceFields = [
  'productPurchasePrice',
  'salePrice',
  'lastSalePrice',
  'minPrice',
  'referencePrice',
  'retailPrice',
  'lastPurchasePrice',
  'grossProfitRate',
  'backupPrice1',
  'wholesalePrice',
  'sharePrice',
  'priceVisible',
];

describe('stock document price reference overlay', () => {
  it('keeps the shared W shortcut helper strict and reusable', () => {
    expect(priceReferenceUtilsSource).toContain(
      'useItemPriceReferenceShortcut',
    );
    expect(priceReferenceUtilsSource).toContain('event.repeat');
    expect(priceReferenceUtilsSource).toContain('event.isComposing');
    expect(priceReferenceUtilsSource).toContain('event.ctrlKey');
    expect(priceReferenceUtilsSource).toContain('event.metaKey');
    expect(priceReferenceUtilsSource).toContain('event.altKey');
    expect(priceReferenceUtilsSource).toContain('event.shiftKey');
    expect(priceReferenceUtilsSource).toContain('isEditableEnterTarget');
    expect(priceReferenceUtilsSource).toContain('isShortcutOverlayTarget');
    expect(priceReferenceUtilsSource).toContain(
      "window.addEventListener('keydown', handlePriceReferenceShortcut, true)",
    );
    expect(priceReferenceUtilsSource).toContain('copyPriceReferenceFields');
  });

  it('connects all stock business document forms to W current-page prices', () => {
    for (const testCase of stockDocumentCases) {
      const formSource = readStockFile(...testCase.form);

      expect(formSource).toContain('ItemPriceReferenceOverlay');
      expect(formSource).toContain('priceReferenceOpen');
      expect(formSource).toContain('useItemPriceReferenceShortcut');
      expect(formSource).toContain('ref="itemTableWrapRef"');
      expect(formSource).toContain(testCase.wrapperClass);
      expect(formSource).toContain(testCase.rowExpression);
      expect(formSource).toContain(':table-row-height="ITEM_TABLE_ROW_HEIGHT"');
      expect(formSource).toContain(
        ':table-header-height="ITEM_TABLE_HEADER_HEIGHT"',
      );
      expect(formSource).toContain(':visible-rows="ITEM_TABLE_VISIBLE_ROWS"');
      expect(formSource).toContain('当前页');
      expect(formSource).toContain('<kbd>W</kbd>');
      expect(formSource).toContain('全部价格');
      expect(formSource).not.toContain('<Drawer');
      expect(formSource).not.toContain('placement="right"');
    }
  });

  it('extends stock API item types with readonly price reference fields', () => {
    const checkedApis = new Set<string>();
    for (const testCase of stockDocumentCases) {
      const apiPath = testCase.api.join('/');
      if (checkedApis.has(apiPath)) {
        continue;
      }
      checkedApis.add(apiPath);
      const apiSource = readStockFile(...testCase.api);
      for (const field of priceFields) {
        expect(apiSource).toContain(`${field}?:`);
      }
    }
  });
});
