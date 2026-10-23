import { describe, expect, it } from 'vitest';

import { prepareSaleDocumentListColumns } from './document-list-table';

describe('prepareSaleDocumentListColumns', () => {
  it('expands document numbers by current page rows and keeps short numbers compact', () => {
    const shortColumns = prepareSaleDocumentListColumns(
      [{ field: 'no', title: '单号', width: 180, sortable: true }],
      [{ no: 'SO1' }],
    ) as any[];
    const longColumns = prepareSaleDocumentListColumns(
      [{ field: 'no', title: '单号', width: 180, sortable: true }],
      [{ no: 'XSD202609220000001' }],
    ) as any[];

    expect(shortColumns[0].width).toBeLessThan(140);
    expect(longColumns[0].width).toBeGreaterThan(shortColumns[0].width);
    expect(longColumns[0].minWidth).toBeUndefined();
  });

  it('reserves full datetime width but keeps date-only columns tighter', () => {
    const columns = prepareSaleDocumentListColumns(
      [
        { field: 'outTime', title: '出库时间', formatter: 'formatDateTime' },
        { field: 'adjustDate', title: '调价日期', formatter: 'formatDate' },
      ],
      [
        {
          adjustDate: '2026-09-22',
          outTime: '2026-09-22 15:26:37',
        },
      ],
    ) as any[];

    const outTimeWidth = columns.find(
      (column) => column.field === 'outTime',
    )?.width;
    const adjustDateWidth = columns.find(
      (column) => column.field === 'adjustDate',
    )?.width;

    expect(outTimeWidth).toBeGreaterThanOrEqual(150);
    expect(adjustDateWidth).toBeLessThan(outTimeWidth);
  });

  it('keeps amount, count and status columns compact after data is loaded', () => {
    const columns = prepareSaleDocumentListColumns(
      [
        { field: 'totalPrice', title: '实收金额', formatter: 'formatAmount2' },
        { field: 'totalCount', title: '数量', formatter: 'formatAmount3' },
        { field: 'status', title: '状态' },
      ],
      [{ status: '已审核', totalCount: 3, totalPrice: 120.5 }],
    ) as any[];

    expect(
      columns.find((column) => column.field === 'totalPrice')?.width,
    ).toBeLessThan(110);
    expect(
      columns.find((column) => column.field === 'totalCount')?.width,
    ).toBeLessThan(90);
    expect(
      columns.find((column) => column.field === 'status')?.width,
    ).toBeLessThan(90);
  });

  it('keeps function and operation columns fixed', () => {
    const columns = prepareSaleDocumentListColumns(
      [
        { type: 'checkbox', width: 36 },
        { field: 'deleteAction', title: '删除', width: 40 },
        { field: 'printAction', title: '打印', width: 40 },
        { field: 'actions', fixed: 'right', title: '操作', width: 112 },
      ],
      [{ actions: '编辑审核复制删除' }],
    ) as any[];

    expect(columns.find((column) => column.type === 'checkbox')?.width).toBe(
      36,
    );
    expect(
      columns.find((column) => column.field === 'deleteAction')?.width,
    ).toBe(40);
    expect(
      columns.find((column) => column.field === 'printAction')?.width,
    ).toBe(40);
    expect(columns.find((column) => column.field === 'actions')).toMatchObject({
      fixed: 'right',
      width: 112,
    });
  });
});
