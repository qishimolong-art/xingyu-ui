import { describe, expect, it } from 'vitest';

import { sortReceivableDetails } from './receivable-detail-sort';

describe('receivable detail sorting', () => {
  it('sorts cumulative amounts without changing balances', () => {
    const rows = [
      { bizId: 1, receivedAmount: 10, balance: 100 },
      { bizId: 2, receivedAmount: 2, balance: 80 },
      { bizId: 3, receivedAmount: null, balance: 60 },
    ];
    expect(sortReceivableDetails(rows, 'receivedAmount', 'desc')).toEqual(rows);
    expect(rows.map((row) => row.balance)).toEqual([100, 80, 60]);
  });
  it('sorts document timestamps to the second without changing running balances', () => {
    const rows = [
      { bizId: 1, docDate: '2026-09-24 14:25:36', balance: 841 },
      { bizId: 2, docDate: '2026-09-24 14:25:35', balance: 741 },
      { bizId: 3, docDate: '2026-09-24 13:37:29', balance: 720 },
    ];

    expect(sortReceivableDetails(rows, 'docDate', 'asc')).toEqual([
      rows[2],
      rows[1],
      rows[0],
    ]);
    expect(sortReceivableDetails(rows, 'docDate', 'desc')).toEqual(rows);
    expect(rows.map((row) => row.bizId)).toEqual([1, 2, 3]);
  });

  it('compares amount fields numerically', () => {
    const rows = [
      { bizId: 1, increaseAmount: 10 },
      { bizId: 2, increaseAmount: 2 },
    ];

    expect(
      sortReceivableDetails(rows, 'increaseAmount', 'asc').map(
        (item) => item.bizId,
      ),
    ).toEqual([2, 1]);
  });

  it('sorts displayed document values naturally', () => {
    const rows = [
      { bizId: 1, docNo: 'XS10' },
      { bizId: 2, docNo: 'XS2' },
    ];

    expect(
      sortReceivableDetails(rows, 'docNo', 'asc').map((item) => item.bizId),
    ).toEqual([2, 1]);
  });

  it('keeps blanks last in both directions and preserves ties', () => {
    const rows = [
      { bizId: 1, docType: '' },
      { bizId: 2, docType: '收款单' },
      { bizId: 3, docType: undefined },
      { bizId: 4, docType: '收款单' },
    ];

    expect(
      sortReceivableDetails(rows, 'docType', 'asc').map((item) => item.bizId),
    ).toEqual([2, 4, 1, 3]);
    expect(
      sortReceivableDetails(rows, 'docType', 'desc').map((item) => item.bizId),
    ).toEqual([2, 4, 1, 3]);
  });
});
