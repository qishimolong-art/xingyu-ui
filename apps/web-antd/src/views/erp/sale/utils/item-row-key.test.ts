import { describe, expect, it } from 'vitest';

import {
  createSaleItemClientRowKeyManager,
  stripSaleItemClientFields,
} from './item-row-key';

describe('sale item client row key', () => {
  it('uses a stable persisted key and unique local keys', () => {
    const manager = createSaleItemClientRowKeyManager('sale-order');
    const persisted = { id: 12, seq: 1 };
    const first = { seq: 1 };
    const second = { seq: 1 };

    expect(manager.ensureRowKey(persisted)).toBe('sale-order:id:12');
    expect(manager.ensureRowKey(persisted)).toBe('sale-order:id:12');
    expect(manager.ensureRowKey(first)).not.toBe(manager.ensureRowKey(second));
  });

  it('repairs duplicate retained keys', () => {
    const manager = createSaleItemClientRowKeyManager('sale-return');
    const rows = [{ clientRowKey: 'duplicate' }, { clientRowKey: 'duplicate' }];
    manager.ensureRowKeys(rows);
    expect(rows[0]!.clientRowKey).toBe('duplicate');
    expect(rows[1]!.clientRowKey).not.toBe('duplicate');
  });

  it('forces a new identity and strips client fields before save', () => {
    const manager = createSaleItemClientRowKeyManager('sale-price-adjust');
    const row = { clientRowKey: 'old', id: undefined, seq: 7, productId: 1 };
    manager.ensureRowKey(row, { forceNew: true });
    expect(row.clientRowKey).not.toBe('old');
    expect(stripSaleItemClientFields(row)).toEqual({
      id: undefined,
      productId: 1,
    });
  });
});
