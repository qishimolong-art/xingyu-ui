import { describe, expect, it } from 'vitest';

import { buildCurrentSaleUserOptions } from './sale-cart-user-options';

describe('buildCurrentSaleUserOptions', () => {
  it('uses the sales-person name for the read-only edit field', () => {
    expect(
      buildCurrentSaleUserOptions('edit', {
        saleUserId: 1001,
        saleUserName: '四川兴宇',
        creatorName: '总部制单员',
      }),
    ).toEqual([{ id: 1001, nickname: '四川兴宇' }]);
  });

  it('falls back to the creator name when the sales-person name is absent', () => {
    expect(
      buildCurrentSaleUserOptions('edit', {
        saleUserId: 1001,
        creatorName: '四川兴宇',
      }),
    ).toEqual([{ id: 1001, nickname: '四川兴宇' }]);
  });

  it('injects the current sales-person name in create mode', () => {
    expect(
      buildCurrentSaleUserOptions('create', {
        saleUserId: 1001,
        saleUserName: '四川兴宇',
      }),
    ).toEqual([{ id: 1001, nickname: '四川兴宇' }]);
  });

  it('skips numeric fallback labels', () => {
    expect(
      buildCurrentSaleUserOptions('create', {
        saleUserId: 1001,
        saleUserName: '1001',
      }),
    ).toEqual([]);
  });
});
