import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const baseRoot = dirname(fileURLToPath(import.meta.url));
const erpRoot = join(baseRoot, '..');

function readBaseFile(...segments: string[]) {
  return readFileSync(join(baseRoot, ...segments), 'utf8');
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

function expectGridShellHeightContract(source: string, shellClass: string) {
  expect(source).toMatch(
    new RegExp(
      String.raw`\.${
        shellClass
      }\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex-direction:\s*column;[\s\S]*?height:\s*100%;[\s\S]*?min-height:\s*0;[\s\S]*?\}`,
    ),
  );
}

describe('base archive search focus', () => {
  it('keeps archive search focus helper scoped, retry based, and keyword-first', () => {
    const source = readBaseFile('utils', 'archive-search-focus.ts');
    const keywordIndex = source.indexOf(
      'input[data-erp-keyword-search-input="true"]',
    );
    const nameIndex = source.indexOf(
      'input[data-erp-archive-name-search-input="true"]',
    );
    const codeIndex = source.indexOf(
      'input[data-erp-archive-code-search-input="true"]',
    );

    expect(source).toContain('ARCHIVE_SEARCH_INPUT_SELECTOR');
    expect(source).toContain('ARCHIVE_SEARCH_INPUT_SELECTOR_GROUPS.some');
    expect(keywordIndex).toBeGreaterThan(-1);
    expect(nameIndex).toBeGreaterThan(keywordIndex);
    expect(codeIndex).toBeGreaterThan(nameIndex);
    expect(source).toContain('ARCHIVE_SEARCH_FOCUS_MAX_ATTEMPTS = 12');
    expect(source).toContain('focusFirstEditableInput(');
    expect(source).toContain('queueAfterEditableControlRender');
    expect(source).toContain('window.setTimeout');
    expect(source).toContain(
      'queueFocusArchiveSearchInput(scopeRef, attempt + 1)',
    );
  });

  it('marks base data name and code search inputs for focus targeting', () => {
    const source = readBaseFile('data.ts');

    expect(source).toContain("'data-erp-archive-name-search-input': 'true'");
    expect(source).toContain("'data-erp-archive-code-search-input': 'true'");
  });

  it('focuses base data search in embedded and standalone grid modes', () => {
    const source = readBaseFile('components', 'BaseDataGrid.vue');
    const handleSearchEnterSource = getSearchEnterSource(source);

    expect(source).toContain('onMounted');
    expect(source).toContain('onActivated');
    expect(source).toContain('queueFocusArchiveSearchInput');
    expect(source).toContain(
      'const baseDataGridShellRef = ref<HTMLElement>();',
    );
    expect(source).toContain('ref="baseDataGridShellRef"');
    expect(source.match(/class="base-data-grid-shell/g)).toHaveLength(2);
    expect(source).toContain(
      'queueFocusArchiveSearchInput(baseDataGridShellRef);',
    );
    expect(source).toContain('submitSearchFormOnEnterAndBlur');
    expect(handleSearchEnterSource).toContain(
      'submitSearchFormOnEnterAndBlur(event, () => gridApi.formApi.submitForm());',
    );
    expect(handleSearchEnterSource).not.toContain(
      'void gridApi.formApi.submitForm();',
    );
  });

  it('focuses recycle bin search without adding activation refresh', () => {
    const indexSource = readBaseFile('recycle-bin', 'index.vue');
    const dataSource = readBaseFile('recycle-bin', 'data.ts');

    expect(dataSource).toContain(
      "'data-erp-archive-name-search-input': 'true'",
    );
    expect(dataSource).toContain(
      "'data-erp-archive-code-search-input': 'true'",
    );
    expect(indexSource).toContain('onMounted');
    expect(indexSource).toContain('onActivated');
    expect(indexSource).toContain('queueFocusArchiveSearchInput');
    expect(indexSource).toContain(
      'const recycleBinGridShellRef = ref<HTMLElement>();',
    );
    expect(indexSource).toContain('ref="recycleBinGridShellRef"');
    expect(indexSource).toContain('class="recycle-bin-grid-shell"');
    expectGridShellHeightContract(indexSource, 'recycle-bin-grid-shell');
    expect(indexSource).not.toContain('useVxeActivationRefresh');
  });

  it('keeps warehouse archive search covered by the stock focus integration', () => {
    const source = readErpFile('stock', 'warehouse', 'index.vue');

    expect(source).toContain('withErpKeywordSearchSchema(useGridFormSchema())');
    expect(source).toContain('queueFocusStockKeywordSearchInput');
    expect(source).toContain(
      'const stockWarehouseGridShellRef = ref<HTMLElement>();',
    );
    expect(source).toContain('ref="stockWarehouseGridShellRef"');
    expect(source).toContain('class="stock-warehouse-grid-shell"');
  });
});
