import { describe, expect, it } from 'vitest';

import { useFormItemColumns as useStockCheckFormItemColumns } from './check/data';
import { useFormItemColumns as useStockInFormItemColumns } from './in/data';
import { useFormItemColumns as useStockMoveFormItemColumns } from './move/data';
import { useFormItemColumns as useStockOutFormItemColumns } from './out/data';
import { useFormItemColumns as useStockTransferInFormItemColumns } from './transfer-in/data';
import { useFormItemColumns as useStockTransferOutFormItemColumns } from './transfer-out/data';
import { formatStockItemPieceCount } from './utils/item-piece-count';
import { useFormItemColumns as useWarehouseMoveFormItemColumns } from './warehouse-move/data';

function columnFields(columns: any[]) {
  return columns
    .map((column) => column?.field)
    .filter((field): field is string => Boolean(field));
}

describe('stock item piece count columns', () => {
  it('shows piece count after package quantity in stock item forms', () => {
    [
      useStockInFormItemColumns(false),
      useStockOutFormItemColumns(false),
      useStockCheckFormItemColumns(false),
      useStockMoveFormItemColumns(false),
      useStockTransferOutFormItemColumns(false),
      useStockTransferInFormItemColumns(),
      useWarehouseMoveFormItemColumns(false),
    ].forEach((columns) => {
      const fields = columnFields(columns as any[]);

      expect(fields).toContain('pieceCount');
      expect(fields.indexOf('pieceCount')).toBe(
        fields.indexOf('packageQty') + 1,
      );
    });
  });

  it('formats piece count from count and package quantity', () => {
    expect(formatStockItemPieceCount({ count: 9, packageQty: 4 })).toBe('2.25');
    expect(formatStockItemPieceCount({ count: 9, packageQty: 0 })).toBe('-');
    expect(formatStockItemPieceCount({ count: 9, packageQty: -1 })).toBe('-');
    expect(formatStockItemPieceCount({ count: 9, packageQty: '' })).toBe('-');
  });
});
