import { describe, expect, it } from 'vitest';

import {
  fitPickDeliveryTableColumns,
  getPickDeliveryTableScrollWidth,
} from './pick-delivery-table-layout';

describe('pick and delivery table adaptive layout', () => {
  const columns = [
    { type: 'checkbox', width: 44 },
    { field: 'no', width: 150 },
    { field: 'customerName', width: 180 },
    { field: 'createTime', width: 170 },
    { field: 'actions', fixed: 'right', width: 90 },
  ];

  it('fills a wide container with the trailing business column', () => {
    const fitted = fitPickDeliveryTableColumns(columns, 900) as any[];

    expect(fitted[3]).toMatchObject({ minWidth: 436, width: 436 });
    expect(fitted[4]).toMatchObject({ fixed: 'right', width: 90 });
    expect(getPickDeliveryTableScrollWidth(fitted)).toBe(900);
  });

  it('keeps measured minimum widths and horizontal overflow when narrow', () => {
    const fitted = fitPickDeliveryTableColumns(columns, 500) as any[];

    expect(fitted[3]).toMatchObject({ minWidth: 170, width: 170 });
    expect(getPickDeliveryTableScrollWidth(fitted)).toBe(634);
  });

  it('includes Ant table row-selection space without stretching fixed columns', () => {
    const detailColumns = [
      { dataIndex: 'productName', width: 180 },
      { dataIndex: 'count', width: 90 },
      { dataIndex: 'pickTime', width: 170 },
    ];
    const fitted = fitPickDeliveryTableColumns(detailColumns, 720, 48) as any[];

    expect(fitted[2]).toMatchObject({ minWidth: 402, width: 402 });
    expect(getPickDeliveryTableScrollWidth(fitted, 48)).toBe(720);
  });
});
