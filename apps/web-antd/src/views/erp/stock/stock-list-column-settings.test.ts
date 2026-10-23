import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { isSameFieldSet } from './utils/field-permission';

const currentDir = dirname(fileURLToPath(import.meta.url));

const stockHighRiskPages = [
  { dir: 'in', gridId: 'erp-stock-in-list-v2' },
  { dir: 'transfer-out', gridId: 'erp-stock-transfer-out-list-v2' },
  { dir: 'warehouse-move', gridId: 'erp-stock-warehouse-move-list-v2' },
  { dir: 'transfer-in', gridId: 'erp-stock-transfer-in-list-v2' },
  { dir: 'transfer-ledger', gridId: 'erp-stock-transfer-ledger-list' },
];

const stockDocumentListPages = [
  {
    adaptive: false,
    dir: 'in',
    gridId: 'erp-stock-in-list-v2',
    helper: 'reloadStockInListColumns',
  },
  {
    adaptive: false,
    dir: 'out',
    gridId: 'erp-stock-out-list-v2',
    helper: 'reloadStockOutListColumns',
  },
  {
    adaptive: false,
    dir: 'check',
    gridId: 'erp-stock-check-list-v2',
    helper: 'reloadStockCheckListColumns',
  },
  {
    adaptive: false,
    dir: 'move',
    gridId: 'erp-stock-move-list-v2',
    helper: 'reloadStockMoveListColumns',
  },
  {
    adaptive: false,
    dir: 'warehouse-move',
    gridId: 'erp-stock-warehouse-move-list-v2',
    helper: 'reloadWarehouseMoveListColumns',
  },
  {
    adaptive: false,
    dir: 'transfer-out',
    gridId: 'erp-stock-transfer-out-list-v2',
    helper: 'reloadTransferOutListColumns',
  },
  {
    adaptive: false,
    dir: 'transfer-in',
    gridId: 'erp-stock-transfer-in-list-v2',
    helper: 'reloadTransferInListColumns',
  },
  {
    adaptive: false,
    dir: 'inbill',
    gridId: 'erp-stock-in-bill-list-v2',
    helper: 'reloadStockInBillListColumns',
  },
  {
    adaptive: false,
    dir: 'outbill',
    gridId: 'erp-stock-out-bill-list-v2',
    helper: 'reloadStockOutBillListColumns',
  },
];

function readIndexSource(dir: string) {
  return readFileSync(join(currentDir, dir, 'index.vue'), 'utf8');
}

describe('stock high-risk list column settings persistence', () => {
  it('compares hidden field sets by value instead of array identity', () => {
    expect(
      isSameFieldSet(['deptName', 'creatorName'], ['creatorName', 'deptName']),
    ).toBe(true);
    expect(isSameFieldSet(['deptName'], ['deptName', 'creatorName'])).toBe(
      false,
    );
  });

  it('persists user column visibility on every high-risk stock main list', () => {
    stockHighRiskPages.forEach(({ dir, gridId }) => {
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

  it('rebuilds business document list widths from current page rows', () => {
    stockDocumentListPages.forEach(({ adaptive, dir, gridId, helper }) => {
      const source = readIndexSource(dir);

      expect(source).toContain('const currentPageRows');
      expect(source).toContain(helper);
      if (dir === 'inbill' || dir === 'outbill') {
        expect(source).toContain('useStockDocumentColumns');
        expect(source).toContain('listColumnState.reload()');
        expect(source).toContain('restoreStore: listColumnState.restoreStore');
      } else if (
        ['in', 'out', 'warehouse-move', 'transfer-out', 'transfer-in'].includes(
          dir,
        )
      ) {
        expect(source).toContain('useStockDocumentColumns');
        expect(source).toContain('listColumns.reload()');
        expect(source).toContain('restoreStore: listColumns.restoreStore');
      } else if (dir === 'check') {
        expect(source).toContain('useStockCheckColumns');
        expect(source).toContain('listColumns.reload()');
      } else expect(source).toContain('reloadColumn');
      expect(source).toContain(`fit: ${adaptive}`);
      expect(source).toContain(`id: '${gridId}'`);
      if (adaptive) {
        expect(source).toContain('applyStockDocumentListColumnCustomization');
        expect(source).toContain('custom: handleStock');
      }
      if (dir === 'check') {
        expect(source).toContain('columns: buildListColumns()');
      } else if (dir === 'move') {
        expect(source).toContain('columns: buildStockMoveListColumns()');
      } else {
        expect(source).toMatch(
          /columns: useGridColumns\([^)]*currentPageRows\.value/,
        );
      }
    });
  });
});
