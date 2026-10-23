import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const productRoot = dirname(fileURLToPath(import.meta.url));

const archiveSearchPages = [
  {
    path: ['brand', 'index.vue'],
    shellClass: 'product-brand-grid-shell',
    shellRef: 'productBrandGridShellRef',
  },
  {
    path: ['category', 'index.vue'],
    shellClass: 'product-category-grid-shell',
    shellRef: 'productCategoryGridShellRef',
  },
  {
    path: ['unit', 'index.vue'],
    shellClass: 'product-unit-grid-shell',
    shellRef: 'productUnitGridShellRef',
  },
  {
    path: ['pricesystem', 'index.vue'],
    shellClass: 'price-system-grid-shell',
    shellRef: 'priceSystemGridShellRef',
  },
];

const enterBlurPages: Array<[string, string]> = [
  ['brand', 'index.vue'],
  ['category', 'index.vue'],
  ['unit', 'index.vue'],
  ['product', 'index.vue'],
];

const archiveSearchSchemaFiles = [
  ['brand', 'data.ts'],
  ['category', 'data.ts'],
  ['unit', 'data.ts'],
  ['pricesystem', 'data.ts'],
];

function readProductFile(...segments: string[]) {
  return readFileSync(join(productRoot, ...segments), 'utf8');
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

describe('product archive search focus', () => {
  it.each(archiveSearchPages)(
    'focuses archive search on entering and re-entering $path',
    ({ path, shellClass, shellRef }) => {
      const source = readProductFile(...path);

      expect(source).toContain('onMounted');
      expect(source).toContain('onActivated');
      expect(source).toContain('queueFocusArchiveSearchInput');
      expect(source).toContain(`const ${shellRef} = ref<HTMLElement>();`);
      expect(source).toContain(`ref="${shellRef}"`);
      expect(source).toContain(`class="${shellClass}"`);
      expect(source).toContain(`queueFocusArchiveSearchInput(${shellRef});`);
      expect(source).not.toContain('useVxeActivationRefresh');
      expectGridShellHeightContract(source, shellClass);
    },
  );

  it('focuses product keyword search in the list shell after entry and activation', () => {
    const source = readProductFile('product', 'index.vue');

    expect(source).toContain('onMounted');
    expect(source).toContain('onActivated');
    expect(source).toContain('queueFocusArchiveSearchInput');
    expect(source).toContain('const productGridShellRef = ref<HTMLElement>();');
    expect(source).toContain('ref="productGridShellRef"');
    expect(source).toContain(
      'class="product-grid-shell h-full min-h-0 min-w-0 flex-1"',
    );
    expect(source).toContain('refreshCustomFieldColumns().finally(() =>');
    expect(source).toContain(
      'queueFocusArchiveSearchInput(productGridShellRef)',
    );
  });

  it('marks product archive search schemas for focus targeting', () => {
    archiveSearchSchemaFiles.forEach((path) => {
      const source = readProductFile(...path);

      expect(source).toContain("'data-erp-archive-name-search-input': 'true'");
    });
    expect(readProductFile('pricesystem', 'data.ts')).toContain(
      "'data-erp-archive-code-search-input': 'true'",
    );
  });

  it.each(enterBlurPages)(
    'uses the shared Enter search blur helper in %s',
    (dir, file) => {
      const source = readProductFile(dir, file);
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

  it('marks the explicit product keyword schema and keeps name/code fallbacks', () => {
    const source = readProductFile('product', 'data.ts');

    expect(source).toContain("'data-erp-keyword-search-input': 'true'");
    expect(source).toContain("'data-erp-archive-name-search-input': 'true'");
    expect(source).toContain("'data-erp-archive-code-search-input': 'true'");
  });
});
