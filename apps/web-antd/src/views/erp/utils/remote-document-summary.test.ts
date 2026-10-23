import { describe, expect, it } from 'vitest';

import { buildRemoteDocumentSummary } from './remote-document-summary';

interface Item {
  count: number;
  id?: number;
  price: number;
  weight: number;
}

const calculate = (item: Item) => ({
  totalCount: item.count,
  totalPrice: item.count * item.price,
  totalWeight: item.count * item.weight,
});

describe('buildRemoteDocumentSummary', () => {
  it('新建单据直接按全部本地明细汇总', () => {
    const summary = buildRemoteDocumentSummary({
      base: { totalCount: 999, totalPrice: 999, totalWeight: 999 },
      calculate,
      creates: new Map(),
      deletes: new Set(),
      edits: new Map(),
      localItems: [
        { count: 2, price: 10, weight: 1.5 },
        { count: -1, price: 4, weight: 2 },
      ],
      originals: new Map(),
      remotePaging: false,
    });

    expect(summary).toEqual({
      totalCount: 1,
      totalPrice: 16,
      totalWeight: 1,
    });
  });

  it('远程分页以整单基数叠加跨页修改、删除和新增', () => {
    const original1 = { count: 2, id: 1, price: 10, weight: 1 };
    const original2 = { count: 3, id: 2, price: 5, weight: 2 };
    const summary = buildRemoteDocumentSummary({
      base: { totalCount: 10, totalPrice: 100, totalWeight: 20 },
      calculate,
      creates: new Map([['new', { count: 4, price: 2, weight: 0.5 }]]),
      deletes: new Set([2]),
      edits: new Map([[1, { count: 5, id: 1, price: 10, weight: 1 }]]),
      localItems: [],
      originals: new Map([
        [1, original1],
        [2, original2],
      ]),
      remotePaging: true,
    });

    expect(summary).toEqual({
      totalCount: 14,
      totalPrice: 123,
      totalWeight: 19,
    });
  });

  it('删除已修改行时只减原始值，避免重复扣减', () => {
    const original = { count: 2, id: 1, price: 10, weight: 1 };
    const summary = buildRemoteDocumentSummary({
      base: { totalCount: 2, totalPrice: 20, totalWeight: 2 },
      calculate,
      creates: new Map(),
      deletes: new Set([1]),
      edits: new Map([[1, { count: 5, id: 1, price: 10, weight: 1 }]]),
      localItems: [],
      originals: new Map([[1, original]]),
      remotePaging: true,
    });

    expect(summary).toEqual({
      totalCount: 0,
      totalPrice: 0,
      totalWeight: 0,
    });
  });
});
