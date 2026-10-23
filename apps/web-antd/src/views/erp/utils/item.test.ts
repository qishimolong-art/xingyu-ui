import { describe, expect, it } from 'vitest';

import { buildErpItemDuplicateKey } from './item';

describe('buildErpItemDuplicateKey batch behavior', () => {
  const item = {
    batchNo: 'BATCH-A',
    giftFlag: false,
    productId: 10,
    warehouseId: 20,
  };

  it('keeps the legacy duplicate key unchanged when batch is not configured', () => {
    expect(buildErpItemDuplicateKey(item, { giftField: 'giftFlag' })).toBe(
      '10|20|0',
    );
  });

  it('adds the batch number when batchField is configured', () => {
    expect(
      buildErpItemDuplicateKey(item, {
        batchField: 'batchNo',
        giftField: 'giftFlag',
      }),
    ).toBe('10|20|BATCH-A|0');
  });
});
