import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const saleRoot = dirname(fileURLToPath(import.meta.url));
const erpRoot = join(saleRoot, '..');

const keywordFocusPages = [
  {
    dir: 'return',
    refreshFunction: 'refreshActivatedSaleReturnPage',
    shellClass: 'sale-return-grid-shell',
    shellRef: 'saleReturnGridShellRef',
  },
  {
    dir: 'priceadjust',
    refreshFunction: 'refreshActivatedSalePriceAdjustPage',
    shellClass: 'sale-price-adjust-grid-shell',
    shellRef: 'salePriceAdjustGridShellRef',
  },
];

const enterBlurPages: Array<[string, string]> = [
  ['quote', 'index.vue'],
  ['cart', 'index.vue'],
  ['out', 'index.vue'],
  ['return', 'index.vue'],
  ['priceadjust', 'index.vue'],
  ['customer', 'index.vue'],
  ['report', 'legacy.vue'],
];

function readSaleFile(...segments: string[]) {
  return readFileSync(join(saleRoot, ...segments), 'utf8');
}

function readErpFile(...segments: string[]) {
  return readFileSync(join(erpRoot, ...segments), 'utf8');
}

function getSearchEnterSource(source: string) {
  return (
    source.match(
      /function handleSearchEnter\(event: KeyboardEvent\) \{[\s\S]*?\n\}/,
    )?.[0] || ''
  );
}

describe('sale list keyword search focus', () => {
  it.each(['quote', 'order', 'cart', 'out'])(
    'does not focus the $dir keyword input on entry or activation',
    (dir) => {
      const source = readSaleFile(dir, 'index.vue');

      expect(source).not.toContain('queueFocusSaleKeywordSearchInput');
      expect(source).toContain('onActivated');
      expect(source).toContain('@keydown.enter.capture="handleSearchEnter"');
    },
  );

  it.each(keywordFocusPages)(
    'focuses keyword search on entering and re-entering $dir',
    ({ dir, refreshFunction, shellClass, shellRef }) => {
      const source = readSaleFile(dir, 'index.vue');
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

      expect(refreshStart).toBeGreaterThan(-1);
      expect(source).toContain('onMounted');
      expect(source).toContain('queueFocusSaleKeywordSearchInput');
      expect(source).toContain(`const ${shellRef} = ref<HTMLElement>();`);
      expect(source).toContain(`ref="${shellRef}"`);
      expect(source).toContain(`class="${shellClass}"`);
      expect(refreshSource).toContain(
        `queueFocusSaleKeywordSearchInput(${shellRef});`,
      );
      expect(activatedSource).toContain(
        `queueFocusSaleKeywordSearchInput(${shellRef});`,
      );
      expect(refreshSource).not.toContain('gridApi.query()');
    },
  );

  it('keeps sale keyword focus helper scoped and retry based', () => {
    const source = readSaleFile('utils', 'keyword-search-focus.ts');

    expect(source).toContain('SALE_KEYWORD_SEARCH_INPUT_SELECTOR');
    expect(source).toContain('input[data-erp-keyword-search-input="true"]');
    expect(source).toContain('SALE_KEYWORD_SEARCH_FOCUS_MAX_ATTEMPTS = 12');
    expect(source).toContain('focusFirstEditableInput(');
    expect(source).toContain('queueAfterEditableControlRender');
    expect(source).toContain('window.setTimeout');
    expect(source).toContain(
      'queueFocusSaleKeywordSearchInput(scopeRef, attempt + 1)',
    );
  });

  it.each(enterBlurPages)(
    'uses the shared Enter search blur helper in %s',
    (dir, file) => {
      const source = readSaleFile(dir, file);
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

  it('focuses the legacy sale report keyword input after entry and activation refresh', () => {
    const reportSource = readSaleFile('report', 'legacy.vue');
    const reportDataSource = readSaleFile('report', 'data.ts');
    const activationRefreshSource = readErpFile(
      'utils',
      'activation-refresh.ts',
    );

    expect(reportDataSource).toContain('withErpKeywordSearchSchema');
    expect(reportSource).toContain('onMounted');
    expect(reportSource).toContain(
      'const saleReportGridShellRef = ref<HTMLElement>();',
    );
    expect(reportSource).toContain('ref="saleReportGridShellRef"');
    expect(reportSource).toContain(
      'queueFocusSaleKeywordSearchInput(saleReportGridShellRef);',
    );
    expect(reportSource).toContain('onAfterRefresh: () =>');
    expect(reportSource).toContain('onFirstActivated: () =>');
    expect(activationRefreshSource).toContain('onAfterRefresh?.();');
    expect(activationRefreshSource).toContain('onFirstActivated?.();');
  });
});
