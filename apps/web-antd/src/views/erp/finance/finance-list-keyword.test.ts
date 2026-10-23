import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const financeRoot = dirname(fileURLToPath(import.meta.url));

const activationKeywordFocusPages = [
  {
    path: ['receivable', 'account', 'index.vue'],
    shellClass: 'receivable-account-grid-shell',
    shellRef: 'receivableAccountGridShellRef',
  },
  {
    path: ['payable', 'account', 'index.vue'],
    shellClass: 'payable-account-grid-shell',
    shellRef: 'payableAccountGridShellRef',
  },
  {
    path: ['receivable', 'report', 'index.vue'],
    shellClass: 'receivable-report-grid-shell',
    shellRef: 'receivableReportGridShellRef',
  },
  {
    path: ['payable', 'report', 'index.vue'],
    shellClass: 'payable-report-grid-shell',
    shellRef: 'payableReportGridShellRef',
  },
  {
    path: ['receivable', 'misc', 'index.vue'],
    shellClass: 'receivable-misc-grid-shell',
    shellRef: 'receivableMiscGridShellRef',
  },
  {
    path: ['payable', 'misc', 'index.vue'],
    shellClass: 'payable-misc-grid-shell',
    shellRef: 'payableMiscGridShellRef',
  },
  {
    path: ['settlement', 'offset', 'index.vue'],
    shellClass: 'settlement-offset-grid-shell',
    shellRef: 'settlementOffsetGridShellRef',
  },
];

const enterBlurPages = [
  {
    path: ['receivable', 'account', 'index.vue'],
  },
  {
    path: ['payable', 'account', 'index.vue'],
  },
  {
    path: ['receivable', 'report', 'index.vue'],
  },
  {
    path: ['payable', 'report', 'index.vue'],
  },
  {
    path: ['settlement', 'offset', 'index.vue'],
  },
];

function readFinanceFile(...segments: string[]) {
  return readFileSync(join(financeRoot, ...segments), 'utf8');
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

describe('finance list keyword search focus', () => {
  it.each(activationKeywordFocusPages)(
    'focuses keyword search after entry and activation refresh for $path',
    ({ path, shellClass, shellRef }) => {
      const source = readFinanceFile(...path);
      const refreshSource = sliceActivationRefreshSource(source);

      expect(source).toContain('withErpKeywordSearchSchema');
      expect(source).toContain('useGridFormSchema');
      expect(source).toContain('onMounted');
      expect(source).toContain('queueFocusFinanceKeywordSearchInput');
      expect(source).toContain(`const ${shellRef} = ref<HTMLElement>();`);
      expect(source).toContain(`ref="${shellRef}"`);
      expect(source).toContain(`class="${shellClass}"`);
      expect(source).toContain(
        `queueFocusFinanceKeywordSearchInput(${shellRef})`,
      );
      expect(refreshSource).toContain('onAfterRefresh: () =>');
      expect(refreshSource).toContain('onFirstActivated: () =>');
      expect(refreshSource).toContain(
        `queueFocusFinanceKeywordSearchInput(${shellRef})`,
      );
      expect(refreshSource).not.toContain('gridApi.query()');
    },
  );

  it('keeps finance keyword focus helper scoped and retry based', () => {
    const source = readFinanceFile('utils', 'keyword-search-focus.ts');

    expect(source).toContain('FINANCE_KEYWORD_SEARCH_INPUT_SELECTOR');
    expect(source).toContain('input[data-erp-keyword-search-input="true"]');
    expect(source).toContain('FINANCE_KEYWORD_SEARCH_FOCUS_MAX_ATTEMPTS = 12');
    expect(source).toContain('focusFirstEditableInput(');
    expect(source).toContain('queueAfterEditableControlRender');
    expect(source).toContain('window.setTimeout');
    expect(source).toContain(
      'queueFocusFinanceKeywordSearchInput(scopeRef, attempt + 1)',
    );
  });

  it.each(enterBlurPages)(
    'uses the shared Enter search blur helper in $path',
    ({ path }) => {
      const source = readFinanceFile(...path);
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
});
