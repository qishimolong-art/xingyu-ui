import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));

const financeMainListPages = [
  {
    gridId: 'erp-finance-cash-bank-account-list-v2',
    path: ['cash-bank', 'account', 'index.vue'],
  },
  {
    gridId: 'erp-finance-cash-bank-transfer-list-v2',
    path: ['cash-bank', 'transfer', 'index.vue'],
  },
  {
    gridId: 'erp-finance-settlement-payment-list-v4',
    path: ['settlement', 'payment', 'index.vue'],
  },
  {
    gridId: 'erp-finance-settlement-receipt-list-v4',
    path: ['settlement', 'receipt', 'index.vue'],
  },
  {
    gridId: 'erp-finance-payable-account-list-v2',
    path: ['payable', 'account', 'index.vue'],
  },
  {
    gridId: 'erp-finance-payable-expense-list-v2',
    path: ['payable', 'expense', 'index.vue'],
  },
  {
    gridId: 'erp-finance-payable-other-list-v2',
    path: ['payable', 'other', 'index.vue'],
  },
  {
    gridId: 'erp-finance-receivable-account-list-v2',
    path: ['receivable', 'account', 'index.vue'],
  },
  {
    adaptive: true,
    gridId: 'erp-finance-receivable-other-income-list-v2',
    path: ['receivable', 'other-income', 'index.vue'],
  },
  {
    gridId: 'erp-finance-receivable-other-receivable-list-v2',
    path: ['receivable', 'other-receivable', 'index.vue'],
  },
  {
    gridId: 'erp-finance-settlement-offset-list-v2',
    path: ['settlement', 'offset', 'index.vue'],
  },
];

const legacyFinanceInternalItemGridPages = [
  ['payment', 'modules', 'item-form.vue'],
  ['receipt', 'modules', 'item-form.vue'],
];

function readSource(pathSegments: string[]) {
  return readFileSync(join(currentDir, ...pathSegments), 'utf8');
}

describe('finance main list column settings persistence', () => {
  it('persists user column settings on every finance main list', () => {
    financeMainListPages.forEach((config) => {
      const { gridId, path } = config;
      const adaptive = 'adaptive' in config && config.adaptive === true;
      const source = readSource(path);

      expect(source).toContain(`id: '${gridId}'`);
      expect(source).toContain('customConfig: {');
      expect(source).toContain('storage: {');
      expect(source).toContain('fixed: true');
      expect(source).toContain('resizable: true');
      expect(source).toContain('sort: true');
      expect(source).toContain('visible: true');
      expect(source).toContain('fit: false');
      expect(source).toContain('reloadColumn');
      if (adaptive) {
        expect(source).toContain('applyFinanceDocumentListColumnCustomization');
      }
    });
  });

  it('keeps legacy internal item grids out of user column settings persistence', () => {
    legacyFinanceInternalItemGridPages.forEach((path) => {
      const source = readSource(path);

      expect(source).toMatch(/toolbarConfig:\s*{\s*enabled:\s*false,?\s*}/);
      expect(source).not.toContain('customConfig: {');
      expect(source).not.toMatch(/id:\s*'erp-finance-[^']+-list'/);
    });
  });

  it('queues settlement adaptive widths from the query path used on first load', () => {
    [
      ['settlement', 'payment', 'index.vue'],
      ['settlement', 'receipt', 'index.vue'],
    ].forEach((path) => {
      const source = readSource(path);

      expect(source).toContain('pageRows.value = result.list || [];');
      expect(source).toContain('await nextTick();');
      expect(source).toContain(
        "if ((gridApi.grid?.getColumnWidth?.('no') || 0) > 0) break;",
      );
      expect(source).toContain('setTimeout(resolve, 50)');
      expect(source).toContain(
        'await new Promise<void>((resolve) => setTimeout(resolve, 80));',
      );
      expect(source).toContain('gridApi.grid?.getColumnWidth?.(field)');
      expect(source).toContain('gridApi.grid?.setColumnWidth?.(field, width)');
      expect(source).toContain('await Promise.all(widthUpdates);');
      expect(source).toContain('function queueColumnUpdate(');
      expect(source).toMatch(
        /void queueColumnUpdate\(\(\) =>\s*applyAdaptiveColumnWidths\(pageRows\.value\),\s*\);/,
      );
      expect(source).toContain(
        'await gridApi.grid?.reloadColumn?.(buildGridColumns(pageRows.value))',
      );
      expect(
        source.indexOf('pageRows.value = result.list || [];'),
      ).toBeLessThan(source.indexOf('void queueColumnUpdate(() =>'));
    });
  });

  it('gives settlement action columns a stable field for VXE storage reloads', () => {
    [
      ['settlement', 'payment', 'data.ts'],
      ['settlement', 'receipt', 'data.ts'],
    ].forEach((path) => {
      const source = readSource(path);

      expect(source).toMatch(
        /field:\s*'actions',\s*title:\s*'操作',\s*width:\s*\d+,\s*fixed:\s*'right'/,
      );
    });
  });
});
