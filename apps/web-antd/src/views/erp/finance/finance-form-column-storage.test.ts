import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const erpViewsDir = join(currentDir, '..');

const financeFormItemGrids = [
  {
    dataPath: ['settlement', 'receipt', 'data.ts'],
    formPath: ['settlement', 'receipt', 'modules', 'form.vue'],
    gridId: 'erp-finance-settlement-receipt-item-list-v1',
    itemPath: ['settlement', 'receipt', 'modules', 'item-form.vue'],
    operationWidth: 72,
  },
  {
    dataPath: ['settlement', 'payment', 'data.ts'],
    formPath: ['settlement', 'payment', 'modules', 'form.vue'],
    gridId: 'erp-finance-settlement-payment-item-list-v1',
    itemPath: ['settlement', 'payment', 'modules', 'item-form.vue'],
    operationWidth: 80,
  },
  {
    dataPath: ['payable', 'expense', 'data.ts'],
    formPath: ['payable', 'expense', 'modules', 'form.vue'],
    gridId: 'erp-finance-payable-expense-item-list-v1',
    itemPath: ['payable', 'expense', 'modules', 'item-form.vue'],
    operationWidth: 72,
    completeTools: true,
  },
  {
    dataPath: ['receivable', 'other-income', 'data.ts'],
    formPath: ['receivable', 'other-income', 'modules', 'form.vue'],
    gridId: 'erp-finance-receivable-other-income-item-list-v2',
    itemPath: ['receivable', 'other-income', 'modules', 'item-form.vue'],
    operationWidth: 72,
    completeTools: true,
  },
];

const excludedInternalGrids = [
  ['payment', 'modules', 'item-form.vue'],
  ['receipt', 'modules', 'item-form.vue'],
  ['settlement', 'payment', 'modules', 'purchase-select.vue'],
  ['settlement', 'receipt', 'modules', 'sale-select.vue'],
  ['cash-bank', 'account', 'modules', 'transaction-drawer.vue'],
  ['payable', 'account', 'modules', 'detail-drawer.vue'],
  ['payable', 'report', 'modules', 'detail-drawer.vue'],
  ['receivable', 'account', 'modules', 'detail-drawer.vue'],
  ['receivable', 'report', 'modules', 'detail-drawer.vue'],
  ['settlement', 'offset', 'modules', 'detail-drawer.vue'],
];

function readFinanceSource(pathSegments: string[]) {
  return readFileSync(join(currentDir, ...pathSegments), 'utf8');
}

function collectVueSources(rootDir: string): string[] {
  return readdirSync(rootDir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(rootDir, entry.name);
    if (entry.isDirectory()) {
      return collectVueSources(entryPath);
    }
    return entry.isFile() && entry.name.endsWith('.vue')
      ? [readFileSync(entryPath, 'utf8')]
      : [];
  });
}

describe('finance form column settings persistence', () => {
  it('uses four stable and globally isolated item grid ids', () => {
    const targetIds = financeFormItemGrids.map(({ gridId }) => gridId);
    const allErpVueSources = collectVueSources(erpViewsDir);

    expect(new Set(targetIds).size).toBe(targetIds.length);
    targetIds.forEach((gridId) => {
      expect(
        allErpVueSources.filter((source) => source.includes(`id: '${gridId}'`)),
      ).toHaveLength(1);
    });
  });

  it('persists all four column settings and exposes the requested grid tools', () => {
    financeFormItemGrids.forEach(({ completeTools, gridId, itemPath }) => {
      const source = readFinanceSource(itemPath);

      expect(source).toContain(`id: '${gridId}'`);
      expect(source).toContain('customConfig: {');
      expect(source).toContain('storage: {');
      expect(source).toContain('fixed: true');
      expect(source).toContain('resizable: true');
      expect(source).toContain('sort: true');
      expect(source).toContain('visible: true');
      if (completeTools) {
        expect(source).toMatch(
          /toolbarConfig:\s*{\s*custom: true,\s*enabled: true,\s*refresh:\s*{\s*queryMethod:\s*\(\)\s*=>\s*refreshItemGrid\(\),?\s*},\s*search: false,\s*zoom: true,?\s*}/,
        );
        expect(source).toContain('fit: true');
        expect(source).toContain('<template #toolbar-tools>');
      } else {
        expect(source).toMatch(
          /toolbarConfig:\s*{\s*custom: true,\s*enabled: true,\s*refresh: false,\s*search: false,\s*zoom: false,?\s*}/,
        );
        expect(source).toContain('fit: false');
      }
    });
  });

  it('keeps operation columns stable and outside user customization', () => {
    financeFormItemGrids.forEach(({ dataPath, operationWidth }) => {
      const source = readFinanceSource(dataPath);

      expect(source).toMatch(
        new RegExp(
          `field: 'actions',\\s*title: '操作',\\s*width: ${operationWidth},`,
        ),
      );
    });
  });

  it('restores stored columns only after building the final permission-filtered columns', () => {
    financeFormItemGrids.forEach(({ dataPath, itemPath }) => {
      const dataSource = readFinanceSource(dataPath);
      const itemSource = readFinanceSource(itemPath);

      expect(dataSource).toMatch(
        /return prepareFinanceDocumentItemColumns\(\s*applyFinanceItemColumnPermission\(/,
      );
      expect(itemSource).toContain('gridApi.grid.reloadColumn(');
    });

    ['receipt', 'payment'].forEach((documentType) => {
      const source = readFinanceSource([
        'settlement',
        documentType,
        'modules',
        'item-form.vue',
      ]);
      expect(source).not.toMatch(
        /gridApi\.setGridOptions\(\{\s*columns: buildItemColumns\(\)/,
      );
    });
  });

  it('shares one item grid per document across form modes', () => {
    financeFormItemGrids.forEach(({ formPath, gridId, itemPath }) => {
      const formSource = readFinanceSource(formPath);
      const itemSource = readFinanceSource(itemPath);

      expect(formSource).toContain('<ItemForm');
      expect(itemSource.match(new RegExp(gridId, 'g'))).toHaveLength(1);
      expect(formSource).not.toContain(gridId);
    });
  });

  it('keeps legacy, selector, account-detail and report-drilldown grids excluded', () => {
    excludedInternalGrids.forEach((path) => {
      const source = readFinanceSource(path);

      expect(source).not.toContain('storage: {');
      expect(source).not.toMatch(/erp-finance-[^']+-item-list-v1/);
    });
  });
});
