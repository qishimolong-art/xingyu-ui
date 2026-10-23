import { describe, expect, it } from 'vitest';

import {
  applySaleFormFieldPermission,
  applySaleItemColumnPermission,
  applySaleSelectColumnPermission,
  getSaleDetailColumnPermissionHiddenFields,
  getSalePriceReferenceOverlayHiddenFields,
  isSalePriceItemHidden,
} from './field-permission';

describe('sale field permission helpers', () => {
  it('retains hidden sale price item columns for detail value rendering', () => {
    expect(
      getSaleDetailColumnPermissionHiddenFields([
        'item_productPrice',
        'item_totalPrice',
        'item_customerName',
      ]),
    ).toEqual(['item_customerName']);
  });

  it('does not mask sale price item fields in detail forms', () => {
    const hiddenFields = ['item_productPrice', 'item_totalProductPrice'];

    expect(isSalePriceItemHidden(hiddenFields, 'productPrice')).toBe(false);
    expect(isSalePriceItemHidden(hiddenFields, 'totalProductPrice')).toBe(
      false,
    );
    expect(isSalePriceItemHidden(hiddenFields, 'count')).toBe(false);
  });

  it('keeps sale price fields visible in forms and item columns', () => {
    const formSchema = applySaleFormFieldPermission(
      [{ fieldName: 'totalPrice' }, { fieldName: 'customerName' }] as any,
      ['totalPrice', 'customerName'],
    );
    const itemColumns = applySaleItemColumnPermission(
      [{ field: 'productPrice' }, { field: 'count' }] as any,
      ['item_productPrice', 'item_count'],
    );

    expect(formSchema?.map((item: any) => item.fieldName)).toEqual([
      'totalPrice',
    ]);
    expect(itemColumns?.map((item: any) => item.field)).toEqual([
      'productPrice',
    ]);
  });

  it('keeps sale price fields visible in non-stock sale select dialogs', () => {
    const columns = applySaleSelectColumnPermission(
      [
        { dataIndex: 'productPrice' },
        { dataIndex: 'totalPrice' },
        { dataIndex: 'remark' },
      ],
      ['select_col_productPrice', 'select_col_totalPrice', 'select_col_remark'],
    );

    expect(columns.map((item: any) => item.dataIndex)).toEqual([
      'productPrice',
      'totalPrice',
    ]);
  });

  it('removes sale business price hidden fields before passing them to the W price overlay', () => {
    expect(
      getSalePriceReferenceOverlayHiddenFields([
        'item_productPrice',
        'item_salePrice',
        'col_item_lastSalePrice',
        'item_customerName',
      ]),
    ).toEqual(['item_customerName']);
  });
});
