import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const readPurchaseFile = (...segments: string[]) =>
  readFileSync(join(currentDir, ...segments), 'utf8');

const overlaySource = readPurchaseFile(
  'components',
  'PurchaseItemPriceReferenceOverlay.vue',
);
const commonOverlaySource = readFileSync(
  join(currentDir, '../components/ItemPriceReferenceOverlay.vue'),
  'utf8',
);
const priceReferenceUtilsSource = readPurchaseFile(
  'utils',
  'price-reference.ts',
);
const commonPriceReferenceUtilsSource = readFileSync(
  join(currentDir, '../utils/price-reference.ts'),
  'utf8',
);

const purchaseDocumentCases = [
  {
    api: ['../../../api/erp/purchase/in/index.ts'],
    data: ['in/data.ts'],
    itemForm: ['in/modules/item-form.vue'],
    wrapperClass: 'purchase-in-item-table-wrap',
  },
  {
    api: ['../../../api/erp/purchase/return/index.ts'],
    data: ['return/data.ts'],
    itemForm: ['return/modules/item-form.vue'],
    wrapperClass: 'purchase-return-item-table-wrap',
  },
  {
    api: ['../../../api/erp/purchase/priceadjust/index.ts'],
    data: ['priceadjust/data.ts'],
    itemForm: ['priceadjust/modules/item-form.vue'],
    wrapperClass: 'purchase-price-adjust-item-table-wrap',
  },
  {
    api: ['../../../api/erp/purchase/invoice/index.ts'],
    data: ['invoice/data.ts'],
    itemForm: ['invoice/modules/item-form.vue'],
    wrapperClass: 'purchase-invoice-item-table-wrap',
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

describe('purchase document price reference overlay', () => {
  it('uses a shared table-like row-aligned overlay without title or close controls', () => {
    expect(overlaySource).toContain('ItemPriceReferenceOverlay');
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
    expect(commonOverlaySource).not.toMatch(
      /field\.label.*formatReferenceValue\(row, field\)/,
    );
  });

  it('keeps price field labels compact and unambiguous', () => {
    expect(commonPriceReferenceUtilsSource).toContain("shortLabel: '采购'");
    expect(commonPriceReferenceUtilsSource).toContain("shortLabel: '销售'");
    expect(commonPriceReferenceUtilsSource).toContain("shortLabel: '近销'");
    expect(commonPriceReferenceUtilsSource).toContain("shortLabel: '最低'");
    expect(commonPriceReferenceUtilsSource).toContain("shortLabel: '参考'");
    expect(commonPriceReferenceUtilsSource).toContain("shortLabel: '零售'");
    expect(commonPriceReferenceUtilsSource).toContain(
      "shortLabel: '最后采购价'",
    );
    expect(commonPriceReferenceUtilsSource).not.toContain("shortLabel: '末采'");
    expect(priceReferenceUtilsSource).toContain(
      'PURCHASE_PRICE_REFERENCE_MASK',
    );
  });

  it('connects purchase-in, return, price-adjust, and invoice item forms', () => {
    for (const testCase of purchaseDocumentCases) {
      const itemFormSource = readPurchaseFile(...testCase.itemForm);

      expect(itemFormSource).toContain('PurchaseItemPriceReferenceOverlay');
      expect(itemFormSource).toContain('priceReferenceOpen');
      expect(itemFormSource).toContain('togglePriceReferenceOverlay');
      expect(itemFormSource).toContain(
        'isPurchasePriceReferenceShortcut(event)',
      );
      expect(itemFormSource).toContain(
        'shouldIgnorePurchasePriceReferenceShortcut(event)',
      );
      expect(itemFormSource).toContain('ref="itemTableWrapRef"');
      expect(itemFormSource).toContain(testCase.wrapperClass);
      expect(itemFormSource).toMatch(
        /:rows="(?:getDisplayTableData\(\)|displayTableData)"/,
      );
      expect(itemFormSource).toContain(
        ':table-row-height="ITEM_TABLE_ROW_HEIGHT"',
      );
      expect(itemFormSource).toContain(
        ':table-header-height="ITEM_TABLE_HEADER_HEIGHT"',
      );
      expect(itemFormSource).toContain(
        ':visible-rows="ITEM_TABLE_VISIBLE_ROWS"',
      );
      expect(itemFormSource).toContain('当前页');
      expect(itemFormSource).toContain('<kbd>W</kbd><b>全部价格</b>');
      expect(itemFormSource).not.toContain('<Drawer');
      expect(itemFormSource).not.toContain('placement="right"');
      expect(itemFormSource).not.toContain(
        '@click="priceReferenceOpen = false"',
      );
    }
  });

  it('retains masked price fields and exposes readonly API fields', () => {
    for (const testCase of purchaseDocumentCases) {
      const dataSource = readPurchaseFile(...testCase.data);
      const apiSource = readPurchaseFile(...testCase.api);

      expect(dataSource).toContain('MASKED_PRICE_ITEM_FIELDS');
      for (const field of priceFields) {
        if (field !== 'priceVisible') {
          expect(dataSource).toContain(`'${field}'`);
        }
        expect(apiSource).toContain(`${field}?:`);
      }
    }
  });
});
