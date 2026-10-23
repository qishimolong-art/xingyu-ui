import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { isSameFieldSet } from './utils/field-permission';

const currentDir = dirname(fileURLToPath(import.meta.url));

const purchaseListPages = [
  { dir: 'order', gridId: 'erp-purchase-order-list-v4' },
  { dir: 'in', gridId: 'erp-purchase-in-list-v2' },
  { dir: 'return', gridId: 'erp-purchase-return-list-v2' },
  { dir: 'invoice', gridId: 'erp-purchase-invoice-list-v2' },
  { dir: 'priceadjust', gridId: 'erp-purchase-price-adjust-list-v2' },
  { dir: 'supplier', gridId: 'erp-purchase-supplier-list-v2' },
];

const purchaseDocumentListPages = purchaseListPages.filter(
  ({ dir }) => dir !== 'supplier',
);

function readIndexSource(dir: string) {
  return readFileSync(join(currentDir, dir, 'index.vue'), 'utf8');
}

describe('purchase list column settings persistence', () => {
  it('compares hidden field sets by value instead of array identity', () => {
    expect(
      isSameFieldSet(['deptName', 'creatorName'], ['creatorName', 'deptName']),
    ).toBe(true);
    expect(isSameFieldSet(['deptName'], ['deptName', 'creatorName'])).toBe(
      false,
    );
  });

  it('persists user column visibility on every purchase main list', () => {
    purchaseListPages.forEach(({ dir, gridId }) => {
      const source = readIndexSource(dir);

      expect(source).toContain('import { isSameFieldSet }');
      expect(source).toContain(`id: '${gridId}'`);
      expect(source).toContain('customConfig: {');
      expect(source).toContain('storage: {');
      expect(source).toContain('fixed: true');
      expect(source).toContain('resizable: true');
      expect(source).toContain('sort: true');
      expect(source).toContain('visible: true');
      expect(source).toContain(
        'let appliedHiddenFields = [...hiddenFields.value]',
      );
      expect(source).toContain('isSameFieldSet(appliedHiddenFields, fields)');
      expect(source).toContain('appliedHiddenFields = [...fields]');
    });
  });

  it('rebuilds purchase document list columns from current-page rows', () => {
    purchaseDocumentListPages.forEach(({ dir }) => {
      const source = readIndexSource(dir);

      if (dir === 'order') {
        expect(source).toContain('fit: true');
      }
      if (dir === 'order') {
        expect(source).toContain(
          'applyPurchaseDocumentListColumnCustomization(',
        );
      } else if (dir !== 'in') {
        expect(source).toContain('fit: false');
      }
      expect(source).toContain('reloadColumn');
      expect(source).toContain('currentPageRows.value');
      if (dir === 'order') {
        expect(source).toContain(
          'useGridColumns(fields, rows, purchaseOrderActionPermissions)',
        );
      } else {
        expect(source).toContain('useGridColumns(fields, rows)');
      }
      expect(source).toContain('void reloadPurchase');
      expect(source).toMatch(
        /await reloadPurchase.*ListColumns\(currentPageRows\.value\)/,
      );
      expect(source).toMatch(/await reloadPurchase.*ListColumns\(rows\)/);
    });
  });
});
