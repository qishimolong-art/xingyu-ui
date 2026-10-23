import { describe, expect, it } from 'vitest';

import {
  createPurchaseItemClientRowKeyManager,
  stripPurchaseItemClientFields,
} from './item-row-key';

describe('purchase item client row key', () => {
  it('uses persisted IDs and keeps the key stable across clones', () => {
    const manager = createPurchaseItemClientRowKeyManager('purchase-in');
    const row = { id: 42, seq: 7 };

    expect(manager.ensureRowKey(row)).toBe('purchase-in:id:42');
    expect(manager.ensureRowKey({ ...row })).toBe('purchase-in:id:42');
  });

  it('assigns distinct keys to new rows even when seq and products repeat', () => {
    const manager = createPurchaseItemClientRowKeyManager('purchase-in');
    const rows: Array<{
      clientRowKey?: string;
      productId: number;
      seq: number;
    }> = [
      { productId: 1, seq: 7 },
      { productId: 1, seq: 7 },
      { productId: 1, seq: 7 },
    ];

    manager.ensureRowKeys(rows);

    expect(new Set(rows.map((row) => row.clientRowKey)).size).toBe(3);
  });

  it('repairs duplicated retained keys while preserving the first row', () => {
    const manager = createPurchaseItemClientRowKeyManager('purchase-order');
    const rows = [
      { clientRowKey: 'retained-key', productId: 1 },
      { clientRowKey: 'retained-key', productId: 2 },
    ];

    manager.ensureRowKeys(rows);

    expect(rows[0]?.clientRowKey).toBe('retained-key');
    expect(rows[1]?.clientRowKey).not.toBe('retained-key');
  });

  it('creates a fresh key for a true copy and strips frontend fields', () => {
    const manager = createPurchaseItemClientRowKeyManager('purchase-return');
    const source = { clientRowKey: 'old-key', productId: 1, seq: 3 };

    const copiedKey = manager.ensureRowKey(source, { forceNew: true });

    expect(copiedKey).not.toBe('old-key');
    expect(stripPurchaseItemClientFields(source)).toEqual({ productId: 1 });
  });
});
