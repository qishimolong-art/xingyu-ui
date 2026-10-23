import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const SALE_LIST_PAGES = [
  {
    dir: 'cart',
    gridId: 'erp-sale-cart-list-v2',
    reloadFn: 'reloadSaleCartColumns',
  },
  {
    dir: 'order',
    gridId: 'erp-sale-order-list-v2',
    reloadFn: 'reloadSaleOrderColumns',
  },
  {
    dir: 'out',
    gridId: 'erp-sale-out-list-v2',
    reloadFn: 'reloadSaleOutColumns',
  },
  {
    dir: 'priceadjust',
    gridId: 'erp-sale-price-adjust-list-v2',
    reloadFn: 'reloadSalePriceAdjustColumns',
  },
  {
    dir: 'quote',
    gridId: 'erp-sale-quote-list-v2',
    reloadFn: 'reloadSaleQuoteColumns',
  },
  {
    dir: 'return',
    gridId: 'erp-sale-return-list-v2',
    reloadFn: 'reloadSaleReturnColumns',
  },
];

const currentDir = dirname(fileURLToPath(import.meta.url));

function readSaleFile(dir: string, file: string) {
  return readFileSync(join(currentDir, dir, file), 'utf8');
}

describe('sale list adaptive column width wiring', () => {
  it('uses the shared list-width utility from every business list data file', () => {
    for (const page of SALE_LIST_PAGES) {
      const source = readSaleFile(page.dir, 'data.ts');

      expect(source).toContain('prepareSaleDocumentListColumns');
      expect(source).toContain('rows: Record<string, any>[] = []');
      expect(source).toContain('return prepareSaleDocumentListColumns(');
    }
  });

  it('rebuilds columns from current page rows and disables auto-fill on every list page', () => {
    for (const page of SALE_LIST_PAGES) {
      const source = readSaleFile(page.dir, 'index.vue');

      expect(source).toContain('currentPageRows');
      expect(source).toContain(page.reloadFn);
      expect(source).toContain('reloadColumn');
      expect(source).toContain(
        'columns: useGridColumns(currentPageRows.value)',
      );
      expect(source).toContain(
        page.dir === 'out' || ['cart', 'order', 'quote'].includes(page.dir)
          ? 'fit: true'
          : 'fit: false',
      );
      expect(source).toContain(`id: '${page.gridId}'`);
    }
  });

  it('keeps the sale-out operation column fixed and resets columns immediately', () => {
    const dataSource = readSaleFile('out', 'data.ts');
    const source = readSaleFile('out', 'index.vue');

    expect(dataSource).toContain("field: 'actions'");
    expect(dataSource).toContain("fixed: 'right'");
    expect(dataSource).toContain('const operationWidth = rows.some(');
    expect(dataSource).toContain('trailingFlexibleColumnMinWidth: 90');
    expect(source).toContain('settleVxeColumnCustomization');
    expect(source).toContain("type !== 'reset'");
    expect(source).toContain('syncSaleDocumentOperationColumn');
    expect(source).toContain('icon: ACTION_ICON.EDIT');
    expect(source).toContain('icon: ACTION_ICON.REVERSE');
    expect(source).toContain('icon: ACTION_ICON.AUDIT');
  });

  it('persists sale cart column settings across page refreshes', () => {
    const source = readSaleFile('cart', 'index.vue');

    expect(source).toContain("id: 'erp-sale-cart-list-v2'");
    expect(source).toContain('customConfig: {');
    expect(source).toContain('storage: {');
    expect(source).toContain('fixed: true');
    expect(source).toContain('resizable: true');
    expect(source).toContain('sort: true');
    expect(source).toContain('visible: true');
  });
});
