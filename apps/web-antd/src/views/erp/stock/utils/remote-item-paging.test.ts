import { describe, expect, it } from 'vitest';

import {
  clampRemoteStockItemPageNo,
  composeRemoteStockItemPage,
  createRemoteStockItemOperationQueue,
  findFirstDuplicateStockItemKey,
  getCreatedStockRowPageNo,
  getRemoteStockItemLastPageNo,
  getRemoteStockItemTotal,
} from './remote-item-paging';

describe('remote stock item paging', () => {
  it('keeps 19 + 1 on page 2 and moves 20 + 1 to page 3', () => {
    expect(
      getRemoteStockItemLastPageNo(getRemoteStockItemTotal(19, 1), 10),
    ).toBe(2);
    expect(getCreatedStockRowPageNo(19, 0, 10)).toBe(2);
    expect(
      getRemoteStockItemLastPageNo(getRemoteStockItemTotal(20, 1), 10),
    ).toBe(3);
    expect(getCreatedStockRowPageNo(20, 0, 10)).toBe(3);
  });

  it('caps the page and composes a 9 + 3 tail as 10 + 2', () => {
    const createdRows = ['n1', 'n2', 'n3'];
    expect(
      composeRemoteStockItemPage({
        createdRows,
        pageNo: 2,
        pageSize: 10,
        persistedRows: Array.from({ length: 9 }, (_, index) => `h${index}`),
        persistedTotal: 19,
      }),
    ).toHaveLength(10);
    expect(
      composeRemoteStockItemPage({
        createdRows,
        pageNo: 3,
        pageSize: 10,
        persistedRows: [],
        persistedTotal: 19,
      }),
    ).toEqual(['n2', 'n3']);
  });

  it('backs up from a disappeared last page after deletion', () => {
    expect(clampRemoteStockItemPageNo(3, 10, 20)).toBe(2);
    expect(clampRemoteStockItemPageNo(2, 10, 2)).toBe(1);
  });

  it('never exposes more rows than pageSize under invalid oversized inputs', () => {
    const rows = composeRemoteStockItemPage({
      createdRows: Array.from({ length: 30 }, (_, index) => `n${index}`),
      pageNo: 1,
      pageSize: 10,
      persistedRows: Array.from({ length: 30 }, (_, index) => `h${index}`),
      persistedTotal: 30,
    });
    expect(rows).toHaveLength(10);
  });

  it('serializes rapid item operations', async () => {
    const enqueue = createRemoteStockItemOperationQueue();
    const order: number[] = [];
    const first = enqueue(async () => {
      await Promise.resolve();
      order.push(1);
    });
    const second = enqueue(() => order.push(2));
    await Promise.all([first, second]);
    expect(order).toEqual([1, 2]);
  });

  it('detects duplicate business keys across cache and the incoming batch', () => {
    expect(
      findFirstDuplicateStockItemKey(['p1|w2'], ['p1|w1']),
    ).toBeUndefined();
    expect(findFirstDuplicateStockItemKey(['p1|w2'], ['p1|w2'])).toBe('p1|w2');
    expect(findFirstDuplicateStockItemKey(['p1|w2', 'p1|w2'])).toBe('p1|w2');
  });
});
