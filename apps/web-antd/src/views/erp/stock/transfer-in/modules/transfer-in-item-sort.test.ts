import { describe, expect, it } from 'vitest';

import { useFormItemColumns } from '../data';
import {
  isTransferInItemSortField,
  sortTransferInItems,
} from './transfer-in-item-sort';

describe('transfer-in item sorting', () => {
  const rows = [
    { id: 1, count: 10, productName: '配件2' },
    { id: 2, count: undefined, productName: '' },
    { id: 3, count: 2, productName: '配件10' },
    { id: 4, count: 2, productName: '配件1' },
  ];

  it('sorts numbers numerically and keeps equal rows stable', () => {
    expect(
      sortTransferInItems(rows, 'count', 'asc').map((row) => row.id),
    ).toEqual([3, 4, 1, 2]);
  });

  it('sorts displayed text naturally and keeps blanks last in both directions', () => {
    expect(
      sortTransferInItems(rows, 'productName', 'asc').map((row) => row.id),
    ).toEqual([4, 1, 3, 2]);
    expect(
      sortTransferInItems(rows, 'productName', 'desc').map((row) => row.id),
    ).toEqual([3, 1, 4, 2]);
  });

  it('rejects non-column fields and preserves source order', () => {
    expect(isTransferInItemSortField('id')).toBe(false);
    expect(sortTransferInItems(rows, 'id', 'asc').map((row) => row.id)).toEqual(
      [1, 2, 3, 4],
    );
  });

  it('keeps the item detail columns aligned with transfer-out order', () => {
    const columns = useFormItemColumns() as any[];

    expect(columns.map((column) => column.title)).toEqual([
      '序号',
      '调出仓库',
      '调出仓库部门',
      '调入仓库',
      '调入仓库部门',
      '产品名称',
      '库存',
      '产品单价',
      '数量',
      '产品编码',
      '条码',
      '单位',
      '批次号',
      '包装数',
      '件数',
      '单重',
      '总重',
      '金额',
      '备注',
    ]);
    expect(
      columns.find((column) => column.field === 'fromWarehouseDeptName'),
    ).toMatchObject({
      sortable: true,
      title: '调出仓库部门',
    });
    expect(
      columns.find((column) => column.field === 'toWarehouseDeptName'),
    ).toMatchObject({
      sortable: true,
      title: '调入仓库部门',
    });
    expect(isTransferInItemSortField('fromWarehouseDeptName')).toBe(true);
    expect(isTransferInItemSortField('toWarehouseDeptName')).toBe(true);
    expect(isTransferInItemSortField('stockCount')).toBe(true);

    const hiddenColumns = useFormItemColumns([
      'item_fromWarehouseDeptName',
      'item_toWarehouseDeptName',
      'item_stockCount',
    ]) as any[];
    expect(
      hiddenColumns.some((column) => column.field === 'fromWarehouseDeptName'),
    ).toBe(false);
    expect(
      hiddenColumns.some((column) => column.field === 'toWarehouseDeptName'),
    ).toBe(false);
    expect(hiddenColumns.some((column) => column.field === 'stockCount')).toBe(
      false,
    );
  });
});
