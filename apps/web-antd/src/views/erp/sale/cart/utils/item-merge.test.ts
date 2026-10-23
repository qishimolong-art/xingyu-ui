import { describe, expect, it } from 'vitest';

import { mergeSaleCartItems } from './item-merge';

describe('mergeSaleCartItems batch behavior', () => {
  it('keeps different batches as separate sale lines', () => {
    const result = mergeSaleCartItems([
      {
        batchNo: 'BATCH-A',
        count: 1,
        productId: 10,
        productPrice: 20,
        warehouseId: 30,
      },
      {
        batchNo: 'BATCH-B',
        count: 2,
        productId: 10,
        productPrice: 20,
        warehouseId: 30,
      },
    ]);

    expect(result).toHaveLength(2);
    expect(result.map((item) => item.batchNo)).toEqual(['BATCH-A', 'BATCH-B']);
  });

  it('merges the same product, warehouse and batch', () => {
    const result = mergeSaleCartItems([
      {
        batchNo: 'BATCH-A',
        count: 1,
        productId: 10,
        productPrice: 20,
        warehouseId: 30,
      },
      {
        batchNo: ' BATCH-A ',
        count: 2,
        productId: 10,
        productPrice: 25,
        warehouseId: 30,
      },
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      batchNo: 'BATCH-A',
      count: 3,
      productPrice: 25,
      totalPrice: 75,
    });
  });
});
