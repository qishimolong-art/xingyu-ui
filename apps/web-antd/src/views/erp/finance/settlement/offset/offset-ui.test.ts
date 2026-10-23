import { describe, expect, it } from 'vitest';

import {
  getOffsetDirection,
  getOffsetDirectionLabel,
  getPayableSettlementState,
  getPayableSettlementStateMeta,
  getReceivableSettlementState,
  getReceivableSettlementStateMeta,
} from './offset-ui';

describe('settlement offset direction', () => {
  it.each([
    [120, 'receivable', '净应收'],
    [-30, 'payable', '净应付'],
    [0, 'balanced', '已平衡'],
    [undefined, 'balanced', '已平衡'],
  ])('maps %s to %s', (amount, direction, label) => {
    expect(getOffsetDirection(amount)).toBe(direction);
    expect(getOffsetDirectionLabel(getOffsetDirection(amount))).toBe(label);
  });

  it('describes receivable collection status from receipt and write-off data', () => {
    expect(
      getReceivableSettlementState({
        allocatedAmount: 100,
        balance: 100,
        increaseAmount: 100,
      }),
    ).toBe('settled');
    expect(
      getReceivableSettlementState({
        allocatedAmount: 18,
        balance: -277.09,
        increaseAmount: 20.5,
        writeOffBaseAmount: 18,
      }),
    ).toBe('settled');
    expect(
      getReceivableSettlementState({ balance: 100, receiptAmount: 0 }),
    ).toBe('unsettled');
    expect(
      getReceivableSettlementState({ balance: 40, receiptAmount: 60 }),
    ).toBe('partial');
    expect(
      getReceivableSettlementState({ balance: 0, writeOffAmount: 100 }),
    ).toBe('settled');
    expect(getReceivableSettlementStateMeta('partial')).toEqual({
      color: 'orange',
      label: '部分收款',
    });
  });

  it('describes payable payment status from payment and write-off data', () => {
    expect(
      getPayableSettlementState({
        allocatedAmount: 40,
        balance: 0,
        increaseAmount: 100,
      }),
    ).toBe('partial');
    expect(
      getPayableSettlementState({
        allocatedAmount: 18,
        balance: -277.09,
        increaseAmount: 20.5,
        writeOffBaseAmount: 18,
      }),
    ).toBe('settled');
    expect(getPayableSettlementState({ balance: 100, paymentAmount: 0 })).toBe(
      'unsettled',
    );
    expect(getPayableSettlementState({ balance: 25, paymentAmount: 75 })).toBe(
      'partial',
    );
    expect(getPayableSettlementState({ balance: 0, writeOffAmount: 100 })).toBe(
      'settled',
    );
    expect(getPayableSettlementStateMeta('settled')).toEqual({
      color: 'green',
      label: '已付款',
    });
  });
});
