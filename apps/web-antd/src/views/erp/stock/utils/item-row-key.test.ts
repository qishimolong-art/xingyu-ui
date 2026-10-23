import { describe, expect, it } from 'vitest';

import {
  createStockItemClientRowKeyManager,
  stripStockItemClientFields,
} from './item-row-key';

describe('stock item client row key', () => {
  it('keeps persisted keys stable and gives new rows unique keys', () => {
    const manager = createStockItemClientRowKeyManager('stock-in');
    const rows: Array<{
      clientRowKey?: string;
      id?: number;
      seq: number;
    }> = [{ id: 7, seq: 1 }, { seq: 1 }, { seq: 1 }];
    manager.ensureRowKeys(rows);
    expect(rows[0]?.clientRowKey).toBe('stock-in:id:7');
    expect(new Set(rows.map((row) => row.clientRowKey)).size).toBe(3);
  });

  it('repairs conflicting copied keys and strips client fields', () => {
    const manager = createStockItemClientRowKeyManager('stock-out');
    const rows = [
      { clientRowKey: 'same', productId: 1, seq: 2 },
      { clientRowKey: 'same', productId: 2, seq: 2 },
    ];
    manager.ensureRowKeys(rows);
    expect(rows[0]?.clientRowKey).toBe('same');
    expect(rows[1]?.clientRowKey).not.toBe('same');
    expect(stripStockItemClientFields(rows[0]!)).toEqual({ productId: 1 });
  });
});
