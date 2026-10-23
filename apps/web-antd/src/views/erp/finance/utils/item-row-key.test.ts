import { describe, expect, it } from 'vitest';

import {
  createFinanceItemClientRowKeyManager,
  stripFinanceItemClientFields,
} from './item-row-key';

describe('finance item row key', () => {
  it('keeps persisted keys stable and local rows unique', () => {
    const manager = createFinanceItemClientRowKeyManager('payable-expense');
    const persisted = { id: 12 };
    const first = { id: undefined, seq: 1 };
    const second = { id: undefined, seq: 1 };
    expect(manager.ensureRowKey(persisted)).toBe('payable-expense:id:12');
    expect(manager.ensureRowKey(persisted)).toBe('payable-expense:id:12');
    expect(manager.ensureRowKey(first)).not.toBe(manager.ensureRowKey(second));
  });

  it('uses a composite source identity without numeric concatenation', () => {
    const manager = createFinanceItemClientRowKeyManager('finance-receipt');
    const row = {};
    expect(manager.ensureRowKey(row, { sourceKey: '20:123' })).toBe(
      'finance-receipt:source:20:123',
    );
  });

  it('repairs duplicate keys and strips client fields', () => {
    const manager = createFinanceItemClientRowKeyManager('other-income');
    const rows = [{ clientRowKey: 'same' }, { clientRowKey: 'same' }];
    manager.ensureRowKeys(rows);
    expect(rows[0]?.clientRowKey).toBe('same');
    expect(rows[1]?.clientRowKey).not.toBe('same');
    expect(
      stripFinanceItemClientFields({
        clientRowKey: 'key',
        id: 1,
        row_id: 2,
        seq: 3,
      }),
    ).toEqual({ id: 1 });
  });
});
