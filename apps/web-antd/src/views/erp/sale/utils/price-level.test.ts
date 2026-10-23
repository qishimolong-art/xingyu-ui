import { describe, expect, it } from 'vitest';

import {
  buildPriceLevelNameMap,
  CUSTOMER_PRICE_LEVEL_VALUE_MAP,
  mapSelectablePriceLevelOptions,
  mapVisibleSelectablePriceLevelOptions,
  pickCustomerLevelPrice,
  setOrderPriceCustomFieldNames,
} from './price-level';

describe('customer price level utilities', () => {
  it('maps selectable customer price levels to product price fields', () => {
    expect(
      mapSelectablePriceLevelOptions([
        { code: 'purchase_price', name: '采购价' },
        { code: 'sale_price', name: '销售价' },
        { code: 'min_price', name: '最低价' },
        { code: 'stock_cost_price', name: '库存成本价' },
        { code: 'gross_profit_rate', name: '毛利率（%）' },
        { code: 'share_price', name: '股份价' },
        { code: 'order_price', name: '订货价' },
      ] as any),
    ).toEqual([
      { label: '采购价', value: CUSTOMER_PRICE_LEVEL_VALUE_MAP.purchase_price },
      { label: '销售价', value: CUSTOMER_PRICE_LEVEL_VALUE_MAP.sale_price },
      { label: '最低价', value: CUSTOMER_PRICE_LEVEL_VALUE_MAP.min_price },
      { label: '股份价', value: CUSTOMER_PRICE_LEVEL_VALUE_MAP.share_price },
      { label: '订货价', value: CUSTOMER_PRICE_LEVEL_VALUE_MAP.order_price },
    ]);
  });

  it('filters selectable price levels by current user hidden price fields', () => {
    expect(
      mapVisibleSelectablePriceLevelOptions(
        [
          { code: 'sale_price', name: '销售价' },
          { code: 'last_purchase_in_price', name: '最后一次采购价' },
          { code: 'stock_cost_price', name: '库存成本价' },
          { code: 'gross_profit_rate', name: '毛利率（%）' },
          { code: 'order_price', name: '订货价' },
        ] as any,
        ['salePrice', 'col_orderPriceCustom'],
        ['orderPriceCustom'],
      ),
    ).toEqual([
      {
        label: '最后一次采购价',
        value: CUSTOMER_PRICE_LEVEL_VALUE_MAP.last_purchase_in_price,
      },
    ]);
  });

  it('keeps a display name for the legacy stock cost level', () => {
    expect(buildPriceLevelNameMap([])[6]).toBe('库存成本价（历史）');
  });

  it('picks fixed and custom product prices by customer price level', () => {
    setOrderPriceCustomFieldNames(['orderPriceCustom']);

    const row = {
      backupPrice1: 11,
      customFields: { orderPriceCustom: 99 },
      minPrice: 12,
      productPurchasePrice: 8,
      salePrice: 15,
      sharePrice: 13,
    };

    expect(
      pickCustomerLevelPrice(
        row,
        CUSTOMER_PRICE_LEVEL_VALUE_MAP.purchase_price,
      ),
    ).toBe(8);
    expect(
      pickCustomerLevelPrice(row, CUSTOMER_PRICE_LEVEL_VALUE_MAP.sale_price),
    ).toBe(15);
    expect(
      pickCustomerLevelPrice(row, CUSTOMER_PRICE_LEVEL_VALUE_MAP.min_price),
    ).toBe(12);
    expect(
      pickCustomerLevelPrice(row, CUSTOMER_PRICE_LEVEL_VALUE_MAP.share_price),
    ).toBe(13);
    expect(
      pickCustomerLevelPrice(row, CUSTOMER_PRICE_LEVEL_VALUE_MAP.order_price),
    ).toBe(99);
  });
});
