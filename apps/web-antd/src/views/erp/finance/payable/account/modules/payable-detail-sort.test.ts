import { describe, expect, it } from 'vitest';

import { sortPayableDetails } from './payable-detail-sort';

describe('payable detail sorting', () => {
  it('sorts source numbers without changing source associations or balances', () => {
    const rows = [
      { sourceNo: 'CGDD10', sourceId: 80, balance: 100 },
      { sourceNo: 'CGDD2', sourceId: 90, balance: 75 },
    ];
    expect(sortPayableDetails(rows, 'sourceNo', 'asc')).toEqual([
      rows[1],
      rows[0],
    ]);
    expect(rows[0]).toEqual({ sourceNo: 'CGDD10', sourceId: 80, balance: '100' });
  });

  it('compares amount fields numerically', () => {
    const rows = [
      { bizId: 1, increaseAmount: 10 },
      { bizId: 2, increaseAmount: 2 },
    ];

    expect(
      sortPayableDetails(rows, 'increaseAmount', 'asc').map(
        (item) => item.bizId,
      ),
    ).toEqual([2, 1]);
  });

  it('sorts displayed document values naturally', () => {
    const rows = [
      { bizId: 1, docNo: 'RK10' },
      { bizId: 2, docNo: 'RK2' },
    ];

    expect(
      sortPayableDetails(rows, 'docNo', 'asc').map((item) => item.bizId),
    ).toEqual([2, 1]);
  });

  it('keeps blanks last in both directions and preserves ties', () => {
    const rows = [
      { bizId: 1, docType: '' },
      { bizId: 2, docType: '付款单' },
      { bizId: 3, docType: undefined },
      { bizId: 4, docType: '付款单' },
    ];

    expect(
      sortPayableDetails(rows, 'docType', 'asc').map((item) => item.bizId),
    ).toEqual([2, 4, 1, 3]);
    expect(
      sortPayableDetails(rows, 'docType', 'desc').map((item) => item.bizId),
    ).toEqual([2, 4, 1, 3]);
  });

  it('does not mutate the canonical detail order', () => {
    const rows = [
      { bizId: 1, balance: 20 },
      { bizId: 2, balance: 10 },
    ];

    const sorted = sortPayableDetails(rows, 'balance', 'asc');

    expect(sorted.map((item) => item.bizId)).toEqual([2, 1]);
    expect(rows.map((item) => item.bizId)).toEqual([1, 2]);
  });
});
