import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const purchaseRoot = dirname(fileURLToPath(import.meta.url));

const ordinaryListDirs = ['order', 'in', 'return', 'invoice', 'priceadjust'];
const enterBlurPages: Array<[string, string]> = [
  ['order', 'index.vue'],
  ['in', 'index.vue'],
  ['return', 'index.vue'],
  ['invoice', 'index.vue'],
  ['priceadjust', 'index.vue'],
  ['inbill', 'index.vue'],
  ['supplier', 'index.vue'],
];
const keywordFocusPages = [
  {
    dir: 'order',
    refreshFunction: 'refreshActivatedPurchaseOrderPage',
    shellClass: 'purchase-order-grid-shell',
    shellRef: 'purchaseOrderGridShellRef',
  },
  {
    dir: 'in',
    refreshFunction: 'refreshActivatedPurchaseInPage',
    shellClass: 'purchase-in-grid-shell',
    shellRef: 'purchaseInGridShellRef',
  },
  {
    dir: 'return',
    refreshFunction: 'refreshActivatedPurchaseReturnPage',
    shellClass: 'purchase-return-grid-shell',
    shellRef: 'purchaseReturnGridShellRef',
  },
  {
    dir: 'invoice',
    refreshFunction: 'refreshActivatedPurchaseInvoicePage',
    shellClass: 'purchase-invoice-grid-shell',
    shellRef: 'purchaseInvoiceGridShellRef',
  },
  {
    dir: 'priceadjust',
    refreshFunction: 'refreshActivatedPurchasePriceAdjustPage',
    shellClass: 'purchase-price-adjust-grid-shell',
    shellRef: 'purchasePriceAdjustGridShellRef',
  },
  {
    dir: 'inbill',
    refreshFunction: 'refreshActivatedStockInBillPage',
    shellClass: 'stock-in-bill-grid-shell',
    shellRef: 'stockInBillGridShellRef',
  },
  {
    dir: 'price-adjust',
    refreshFunction: 'refreshActivatedPartsPriceAdjustPage',
    shellClass: 'parts-price-adjust-grid-shell',
    shellRef: 'partsPriceAdjustGridShellRef',
  },
];

function readPurchaseFile(dir: string, file: string) {
  return readFileSync(join(purchaseRoot, dir, file), 'utf8');
}

function getSearchEnterSource(source: string) {
  return (
    source.match(
      /function handleSearchEnter\(event: KeyboardEvent\) \{[\s\S]*?\n\}/,
    )?.[0] || ''
  );
}

describe('purchase ordinary list keyword search', () => {
  it('configures product-aware keyword placeholder on ordinary purchase lists', () => {
    for (const dir of ordinaryListDirs) {
      const source = readPurchaseFile(dir, 'index.vue');

      expect(source).toContain('PURCHASE_LIST_KEYWORD_SEARCH_PLACEHOLDER');
      expect(source).toContain(
        'placeholder: PURCHASE_LIST_KEYWORD_SEARCH_PLACEHOLDER',
      );
      expect(source).toContain('schema: buildGridFormSchema()');
      expect(source).toContain(
        'gridApi.formApi?.setState?.({ schema: buildGridFormSchema(fields) });',
      );
    }
  });

  it('keeps product search as productKeyword and shows the multi-field placeholder', () => {
    for (const dir of ordinaryListDirs) {
      const source = readPurchaseFile(dir, 'data.ts');

      expect(source).toContain("fieldName: 'productKeyword'");
      expect(source).toContain(
        "placeholder: '请输入配件编码、名称、单位等，多个条件可用 / 或空格分隔'",
      );
    }
  });

  it.each(keywordFocusPages)(
    'focuses keyword search on entering and re-entering $dir',
    ({ dir, refreshFunction, shellClass, shellRef }) => {
      const source = readPurchaseFile(dir, 'index.vue');
      const refreshStart = source.indexOf(
        `async function ${refreshFunction}()`,
      );
      const refreshSource = source.slice(
        refreshStart,
        source.indexOf('onMounted(() =>', refreshStart),
      );
      const activatedStart = source.indexOf('onActivated(() =>', refreshStart);
      const activatedSource = source.slice(
        activatedStart,
        source.indexOf('</script>', activatedStart),
      );

      expect(source).toContain('onMounted');
      expect(source).toContain('queueFocusPurchaseKeywordSearchInput');
      expect(source).toContain(`const ${shellRef} = ref<HTMLElement>();`);
      expect(source).toContain(`ref="${shellRef}"`);
      expect(source).toContain(`class="${shellClass}"`);
      expect(refreshSource).toContain(
        `queueFocusPurchaseKeywordSearchInput(${shellRef});`,
      );
      expect(activatedSource).toContain(
        `queueFocusPurchaseKeywordSearchInput(${shellRef});`,
      );
    },
  );

  it('keeps purchase keyword focus helper scoped and retry based', () => {
    const source = readPurchaseFile('utils', 'keyword-search-focus.ts');

    expect(source).toContain('PURCHASE_KEYWORD_SEARCH_INPUT_SELECTOR');
    expect(source).toContain('input[data-erp-keyword-search-input="true"]');
    expect(source).toContain('PURCHASE_KEYWORD_SEARCH_FOCUS_MAX_ATTEMPTS = 12');
    expect(source).toContain('focusFirstEditableInput(');
    expect(source).toContain('queueAfterEditableControlRender');
    expect(source).toContain('window.setTimeout');
    expect(source).toContain(
      'queueFocusPurchaseKeywordSearchInput(scopeRef, attempt + 1)',
    );
  });

  it.each(enterBlurPages)(
    'uses the shared Enter search blur helper in %s',
    (dir, file) => {
      const source = readPurchaseFile(dir, file);
      const handleSearchEnterSource = getSearchEnterSource(source);

      expect(source).toContain('submitSearchFormOnEnterAndBlur');
      expect(handleSearchEnterSource).toContain(
        'submitSearchFormOnEnterAndBlur(event, () => gridApi.formApi.submitForm());',
      );
      expect(handleSearchEnterSource).not.toContain(
        'void gridApi.formApi.submitForm();',
      );
    },
  );

  it('marks custom purchase keyword inputs for the shared focus helper', () => {
    const partsPriceAdjustData = readPurchaseFile('price-adjust', 'data.ts');
    const reportLegacySource = readPurchaseFile('report', 'legacy.vue');

    expect(partsPriceAdjustData).toContain(
      "'data-erp-keyword-search-input': 'true'",
    );
    expect(reportLegacySource).toContain(
      'data-erp-keyword-search-input="true"',
    );
  });

  it('focuses the legacy purchase report keyword input on entry', () => {
    const source = readPurchaseFile('report', 'legacy.vue');

    expect(source).toContain('onMounted');
    expect(source).toContain('onActivated');
    expect(source).toContain(
      'const purchaseReportShellRef = ref<HTMLElement>();',
    );
    expect(source).toContain('ref="purchaseReportShellRef"');
    expect(source).toContain(
      'queueFocusPurchaseKeywordSearchInput(purchaseReportShellRef);',
    );
  });
});
