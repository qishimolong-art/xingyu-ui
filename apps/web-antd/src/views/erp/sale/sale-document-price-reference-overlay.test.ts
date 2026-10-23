import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const readSaleFile = (...segments: string[]) =>
  readFileSync(join(currentDir, ...segments), 'utf8');

const commonOverlaySource = readFileSync(
  join(currentDir, '../components/ItemPriceReferenceOverlay.vue'),
  'utf8',
);
const priceReferenceUtilsSource = readFileSync(
  join(currentDir, '../utils/price-reference.ts'),
  'utf8',
);
const saleFieldPermissionSource = readSaleFile('utils', 'field-permission.ts');

const saleDocumentCases = [
  {
    api: ['../../../api/erp/sale/cart/index.ts'],
    form: ['cart/modules/item-form.vue'],
    rowExpression: ':rows="getDisplayedItems()"',
    wrapperClass: 'sale-cart-item-table-wrap',
  },
  {
    api: ['../../../api/erp/sale/order/index.ts'],
    form: ['order/modules/item-form.vue'],
    rowExpression: ':rows="getDisplayTableData()"',
    wrapperClass: 'sale-order-item-table-wrap',
  },
  {
    api: ['../../../api/erp/sale/out/index.ts'],
    form: ['out/modules/form.vue'],
    rowExpression: ':rows="formData.items || []"',
    wrapperClass: 'sale-out-item-table-wrap',
  },
  {
    api: ['../../../api/erp/sale/return/index.ts'],
    form: ['return/modules/item-form.vue'],
    rowExpression: ':rows="getDisplayTableData()"',
    wrapperClass: 'sale-return-item-table-wrap',
  },
  {
    api: ['../../../api/erp/sale/quote/index.ts'],
    form: ['quote/modules/item-form.vue'],
    rowExpression: ':rows="getDisplayedItems()"',
    wrapperClass: 'sale-quote-item-table-wrap',
  },
  {
    api: ['../../../api/erp/sale/priceadjust/index.ts'],
    form: ['priceadjust/modules/item-form.vue'],
    rowExpression: ':rows="getDisplayedItems()"',
    wrapperClass: 'sale-price-adjust-item-table-wrap',
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

describe('sale document price reference overlay', () => {
  it('uses the shared row-aligned table overlay without title or close controls', () => {
    expect(commonOverlaySource).toContain('aria-label="当前页配件价格"');
    expect(commonOverlaySource).toContain('erp-price-reference__head-table');
    expect(commonOverlaySource).toContain('erp-price-reference__body-table');
    expect(commonOverlaySource).toContain('<colgroup>');
    expect(commonOverlaySource).toContain('table-layout: fixed');
    expect(commonOverlaySource).toContain('field.shortLabel');
    expect(commonOverlaySource).toContain("'--erp-price-reference-row-height'");
    expect(commonOverlaySource).toContain('translate3d(0, -');
    expect(commonOverlaySource).toContain('function getBodyWrapper');
    expect(commonOverlaySource).toContain(
      '.vxe-table--main-wrapper .vxe-table--body-wrapper',
    );
    expect(commonOverlaySource).toContain(
      "bodyWrapper.addEventListener('scroll', handleBodyScroll",
    );
    expect(commonOverlaySource).toContain('ResizeObserver');
    expect(commonOverlaySource).toContain('当前页暂无可显示价格的配件');
    expect(commonOverlaySource).not.toContain('价格遮罩');
    expect(commonOverlaySource).not.toContain('__close');
    expect(commonOverlaySource).not.toContain('__title');
  });

  it('keeps price labels compact and exposes the expected reference fields', () => {
    expect(priceReferenceUtilsSource).toContain("shortLabel: '采购'");
    expect(priceReferenceUtilsSource).toContain("shortLabel: '销售'");
    expect(priceReferenceUtilsSource).toContain("shortLabel: '近销'");
    expect(priceReferenceUtilsSource).toContain("shortLabel: '最低'");
    expect(priceReferenceUtilsSource).toContain("shortLabel: '参考'");
    expect(priceReferenceUtilsSource).toContain("shortLabel: '零售'");
    expect(priceReferenceUtilsSource).toContain("shortLabel: '最后采购价'");
    expect(priceReferenceUtilsSource).not.toContain("shortLabel: '末采'");
    for (const field of priceFields.filter(
      (field) => field !== 'priceVisible',
    )) {
      expect(priceReferenceUtilsSource).toContain(`field: '${field}'`);
    }
  });

  it('connects all sale business document forms to W current-page prices', () => {
    for (const testCase of saleDocumentCases) {
      const formSource = readSaleFile(...testCase.form);

      expect(formSource).toContain('ItemPriceReferenceOverlay');
      expect(formSource).toContain('priceReferenceOpen');
      expect(formSource).toContain('priceReferenceHiddenFields');
      expect(formSource).toContain(
        ':hidden-fields="priceReferenceHiddenFields"',
      );
      expect(formSource).toContain('isPriceReferenceShortcut');
      expect(formSource).toContain('shouldIgnorePriceReferenceShortcut');
      expect(formSource).toContain('isSaleShortcutOwnerActive');
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

  it('retains masked price fields and extends sale API item types', () => {
    expect(saleFieldPermissionSource).toContain(
      'getSalePriceReferenceOverlayHiddenFields',
    );
    expect(saleFieldPermissionSource).toContain(
      'filterSalePriceHiddenFields(hiddenFields)',
    );

    for (const field of priceFields.filter(
      (field) => field !== 'priceVisible',
    )) {
      expect(saleFieldPermissionSource).toContain(`'${field}'`);
    }

    for (const testCase of saleDocumentCases) {
      const apiSource = readSaleFile(...testCase.api);
      for (const field of priceFields) {
        expect(apiSource).toContain(`${field}?:`);
      }
    }
  });
});
