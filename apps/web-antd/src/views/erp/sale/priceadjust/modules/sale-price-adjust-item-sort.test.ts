import { describe, expect, it, vi } from 'vitest';
import { sortPriceAdjustItems } from './sale-price-adjust-item-sort';

vi.mock('@vben/utils', () => ({
  erpPriceMultiply: (price: number, count: number) => price * count,
}));

describe('sortPriceAdjustItems', () => {
  it('按中文展示文本自然排序并按明细 ID 稳定处理相同值', () => {
    const rows = [
      { id: 1, partName: '配件10' },
      { id: 2, partName: '配件2' },
      { id: 3, partName: '配件2' },
    ];

    expect(
      sortPriceAdjustItems(rows, 'partName', 'asc').map((row) => row.id),
    ).toEqual([2, 3, 1]);
  });

  it('按数值及界面计算的调整金额排序', () => {
    const rows = [
      { id: 1, newPrice: 12, outCount: 2 },
      { id: 2, newPrice: 10, outCount: 5 },
      { id: 3, newPrice: 6, outCount: 3 },
    ];

    expect(
      sortPriceAdjustItems(rows, 'adjustAmount', 'desc').map((row) => row.id),
    ).toEqual([2, 1, 3]);
  });

  it('升序和降序都将空值放在末尾', () => {
    const rows = [
      { id: 1, itemRemark: '' },
      { id: 2, itemRemark: 'B' },
      { id: 3, itemRemark: undefined },
      { id: 4, itemRemark: 'A' },
    ];

    expect(
      sortPriceAdjustItems(rows, 'itemRemark', 'asc').map((row) => row.id),
    ).toEqual([4, 2, 1, 3]);
    expect(
      sortPriceAdjustItems(rows, 'itemRemark', 'desc').map((row) => row.id),
    ).toEqual([2, 4, 1, 3]);
  });
});
