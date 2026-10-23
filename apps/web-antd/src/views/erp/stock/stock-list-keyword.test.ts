import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const stockRoot = dirname(fileURLToPath(import.meta.url));

const keywordFocusPages = [
  {
    path: ['in', 'index.vue'],
    shellClass: 'stock-in-grid-shell',
    shellRef: 'stockInGridShellRef',
  },
  {
    path: ['out', 'index.vue'],
    shellClass: 'stock-out-grid-shell',
    shellRef: 'stockOutGridShellRef',
  },
  {
    path: ['move', 'index.vue'],
    shellClass: 'stock-move-grid-shell',
    shellRef: 'stockMoveGridShellRef',
  },
  {
    path: ['warehouse-move', 'index.vue'],
    shellClass: 'warehouse-move-grid-shell',
    shellRef: 'warehouseMoveGridShellRef',
  },
  {
    path: ['check', 'index.vue'],
    shellClass: 'stock-check-grid-shell',
    shellRef: 'stockCheckGridShellRef',
  },
  {
    path: ['transfer-out', 'index.vue'],
    shellClass: 'stock-transfer-out-grid-shell',
    shellRef: 'stockTransferOutGridShellRef',
  },
  {
    path: ['transfer-in', 'index.vue'],
    shellClass: 'stock-transfer-in-grid-shell',
    shellRef: 'stockTransferInGridShellRef',
  },
  {
    path: ['stock', 'index.vue'],
    shellClass: 'stock-list-grid-shell',
    shellRef: 'stockListGridShellRef',
  },
  {
    path: ['warehouse', 'index.vue'],
    shellClass: 'stock-warehouse-grid-shell',
    shellRef: 'stockWarehouseGridShellRef',
  },
  {
    path: ['inbill', 'index.vue'],
    shellClass: 'stock-in-bill-grid-shell',
    shellRef: 'stockInBillGridShellRef',
  },
  {
    path: ['outbill', 'index.vue'],
    shellClass: 'stock-out-bill-grid-shell',
    shellRef: 'stockOutBillGridShellRef',
  },
  {
    path: ['transfer-ledger', 'index.vue'],
    shellClass: 'stock-transfer-ledger-grid-shell',
    shellRef: 'stockTransferLedgerGridShellRef',
  },
  {
    path: ['record', 'modules', 'stock-record-tab.vue'],
    shellClass: 'stock-record-grid-shell',
    shellRef: 'stockRecordGridShellRef',
  },
];

const enterBlurPages = [
  ['in', 'index.vue'],
  ['out', 'index.vue'],
  ['warehouse-move', 'index.vue'],
  ['check', 'index.vue'],
  ['transfer-out', 'index.vue'],
  ['transfer-in', 'index.vue'],
  ['stock', 'index.vue'],
  ['warehouse', 'index.vue'],
  ['inbill', 'index.vue'],
  ['outbill', 'index.vue'],
  ['record', 'modules', 'stock-record-tab.vue'],
];

const productKeywordSchemaFiles = [
  ['in', 'data.ts'],
  ['out', 'data.ts'],
  ['move', 'data.ts'],
  ['warehouse-move', 'data.ts'],
  ['check', 'data.ts'],
  ['transfer-out', 'data.ts'],
  ['transfer-in', 'data.ts'],
  ['stock', 'data.ts'],
  ['inbill', 'data.ts'],
  ['outbill', 'data.ts'],
  ['transfer-ledger', 'data.ts'],
  ['record', 'data.ts'],
];

function readStockFile(...segments: string[]) {
  return readFileSync(join(stockRoot, ...segments), 'utf8');
}

function getSearchEnterSource(source: string) {
  return (
    source.match(
      /function handleSearchEnter\(event: KeyboardEvent\) \{[\s\S]*?\n\}/,
    )?.[0] || ''
  );
}

function sliceActivationRefreshSource(source: string) {
  const start = source.indexOf('useVxeActivationRefresh<');
  expect(start).toBeGreaterThan(-1);
  const errorMessageStart = source.indexOf('errorMessage:', start);
  expect(errorMessageStart).toBeGreaterThan(start);
  const end = source.indexOf('\n  });', errorMessageStart);
  expect(end).toBeGreaterThan(errorMessageStart);

  return source.slice(start, end);
}

describe('stock list keyword search focus', () => {
  it.each(keywordFocusPages)(
    'focuses keyword search on entering and re-entering $path',
    ({ path, shellClass, shellRef }) => {
      const source = readStockFile(...path);
      const refreshSource = sliceActivationRefreshSource(source);

      if (['in', 'out'].includes(path[0]!)) {
        expect(source).not.toContain('queueFocusStockKeywordSearchInput');
        expect(refreshSource).not.toContain('gridApi.query()');
        expect(source).toContain(`ref="${shellRef}"`);
        return;
      }
      expect(source).toContain('onMounted');
      expect(source).toContain('queueFocusStockKeywordSearchInput');
      expect(source).toContain(`const ${shellRef} = ref<HTMLElement>();`);
      expect(source).toContain(`ref="${shellRef}"`);
      expect(source).toContain(`class="${shellClass}"`);
      expect(source).toContain(
        `queueFocusStockKeywordSearchInput(${shellRef});`,
      );
      expect(refreshSource).toContain('onAfterRefresh: () =>');
      expect(refreshSource).toContain('onFirstActivated: () =>');
      expect(refreshSource).not.toContain('gridApi.query()');
    },
  );

  it('keeps stock keyword focus helper scoped, retry based, and keyword-first', () => {
    const source = readStockFile('utils', 'keyword-search-focus.ts');
    const keywordIndex = source.indexOf(
      'input[data-erp-keyword-search-input="true"]',
    );
    const productKeywordIndex = source.indexOf(
      'input[data-erp-product-keyword-search-input="true"]',
    );

    expect(source).toContain('STOCK_KEYWORD_SEARCH_INPUT_SELECTOR');
    expect(keywordIndex).toBeGreaterThan(-1);
    expect(productKeywordIndex).toBeGreaterThan(keywordIndex);
    expect(source).toContain('STOCK_KEYWORD_SEARCH_FOCUS_MAX_ATTEMPTS = 12');
    expect(source).toContain('focusFirstEditableInput(');
    expect(source).toContain('queueAfterEditableControlRender');
    expect(source).toContain('window.setTimeout');
    expect(source).toContain(
      'queueFocusStockKeywordSearchInput(scopeRef, attempt + 1)',
    );
  });

  it.each(enterBlurPages)(
    'uses the shared Enter search blur helper in $path',
    (...path) => {
      const source = readStockFile(...path);
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

  it('marks every stock product keyword schema for focus targeting', () => {
    productKeywordSchemaFiles.forEach((path) => {
      const source = readStockFile(...path);
      const productKeywordSchemas =
        source.match(
          /fieldName: 'productKeyword'[\s\S]*?componentProps: \{[\s\S]*?\}/g,
        ) ?? [];

      expect(productKeywordSchemas.length).toBeGreaterThan(0);
      for (const schema of productKeywordSchemas) {
        expect(schema).toContain(
          "'data-erp-product-keyword-search-input': 'true'",
        );
      }
    });
  });

  it('marks explicit stock keyword schemas for focus targeting', () => {
    expect(readStockFile('transfer-out', 'data.ts')).toContain(
      "'data-erp-keyword-search-input': 'true'",
    );
    expect(readStockFile('transfer-ledger', 'data.ts')).toContain(
      "'data-erp-keyword-search-input': 'true'",
    );
    expect(readStockFile('warehouse', 'index.vue')).toContain(
      'withErpKeywordSearchSchema(useGridFormSchema())',
    );
    expect(readStockFile('inbill', 'index.vue')).toContain(
      'withErpKeywordSearchSchema(useGridFormSchema())',
    );
  });
});
