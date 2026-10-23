import { describe, expect, it } from 'vitest';

import {
  applyStockDocumentListColumnCustomization,
  prepareStockDocumentListColumns,
} from './document-list-table';

describe('prepareStockDocumentListColumns', () => {
  it('keeps short document number columns compact and expands for current page content', () => {
    const shortColumns = prepareStockDocumentListColumns(
      [{ field: 'no', title: '单号', width: 180 }],
      [{ no: 'RK1' }],
    ) as any[];
    const longColumns = prepareStockDocumentListColumns(
      [{ field: 'no', title: '单号', width: 180 }],
      [{ no: 'QTRK202609220000000000001' }],
    ) as any[];

    expect(shortColumns[0].width).toBeLessThan(140);
    expect(longColumns[0].width).toBeGreaterThan(shortColumns[0].width);
    expect(longColumns[0].minWidth).toBeUndefined();
  });

  it('measures dates by their displayed formatter instead of stale fixed width', () => {
    const columns = prepareStockDocumentListColumns(
      [
        { field: 'inTime', title: '日期', formatter: 'formatDate' },
        {
          field: 'approveTime',
          title: '审核时间',
          formatter: 'formatDateTime',
        },
      ],
      [
        {
          approveTime: '2026-09-22 13:45:59',
          inTime: '2026-09-22',
        },
      ],
    ) as any[];

    expect(columns[0].width).toBeLessThan(columns[1].width);
    expect(columns[1].width).toBeGreaterThanOrEqual(160);
  });

  it('keeps numeric and status fields tight while measuring text fields', () => {
    const columns = prepareStockDocumentListColumns(
      [
        { field: 'totalCount', title: '数量', formatter: 'formatAmount3' },
        { field: 'status', title: '状态' },
        { field: 'remark', title: '备注' },
      ],
      [
        {
          remark: '这是一段用于撑开库存单据备注列的较长当前页备注',
          status: '已审核',
          totalCount: 12,
        },
      ],
    ) as any[];

    expect(
      columns.find((column) => column.field === 'totalCount')?.width,
    ).toBeLessThan(100);
    expect(
      columns.find((column) => column.field === 'status')?.width,
    ).toBeLessThan(90);
    expect(
      columns.find((column) => column.field === 'remark')?.width,
    ).toBeGreaterThan(240);
  });

  it('keeps functional columns fixed', () => {
    const columns = prepareStockDocumentListColumns(
      [
        { type: 'checkbox', width: 36 },
        { field: 'printAction', title: '打印', width: 90 },
        { field: 'actions', title: '操作', width: 180 },
      ],
      [{ actions: '编辑 删除 查看一串很长操作文案' }],
    ) as any[];

    expect(columns[0].width).toBe(36);
    expect(
      columns.find((column) => column.field === 'printAction')?.width,
    ).toBe(90);
    expect(columns.find((column) => column.field === 'actions')?.width).toBe(
      180,
    );
  });

  it('makes only the trailing visible data column flexible when explicitly enabled', () => {
    const sourceColumns = [
      { type: 'checkbox', width: 36 },
      { field: 'printAction', title: '打印', width: 48 },
      { field: 'remark', title: '备注', width: 120 },
      { field: 'creatorName', title: '制单人', width: 80 },
      {
        field: 'actions',
        fixed: 'right',
        slots: { default: 'actions' },
        title: '操作',
        width: 184,
      },
    ];
    const sourceSnapshot = structuredClone(sourceColumns);

    const columns = prepareStockDocumentListColumns(
      sourceColumns as any[],
      [{ creatorName: '数创公司', remark: '测试备注' }],
      { trailingFlexibleColumnMinWidth: 72 },
    ) as any[];

    expect(
      columns.find((column) => column.field === 'creatorName')?.minWidth,
    ).toBeGreaterThanOrEqual(80);
    expect(
      columns.find((column) => column.field === 'creatorName')?.width,
    ).toBeUndefined();
    expect(
      columns.find((column) => column.field === 'remark')?.width,
    ).toBeDefined();
    expect(
      columns.find((column) => column.field === 'printAction')?.width,
    ).toBe(48);
    expect(columns.find((column) => column.field === 'actions')).toMatchObject({
      fixed: 'right',
      width: 184,
    });
    expect(sourceColumns).toEqual(sourceSnapshot);
  });

  it('keeps the legacy fixed-width behavior when trailing flexibility is not enabled', () => {
    const columns = prepareStockDocumentListColumns(
      [
        { field: 'remark', title: '备注', width: 120 },
        { field: 'creatorName', title: '制单人', width: 80 },
      ],
      [{ creatorName: '数创公司', remark: '测试备注' }],
    ) as any[];

    expect(columns.every((column) => column.width !== undefined)).toBe(true);
    expect(columns.every((column) => column.minWidth === undefined)).toBe(true);
  });

  it('reapplies saved order, visibility and width before selecting the flexible column', () => {
    const preparedColumns = prepareStockDocumentListColumns(
      [
        { type: 'checkbox', width: 36 },
        { field: 'remark', title: '备注', width: 120 },
        { field: 'creatorName', title: '制单人', width: 80 },
        {
          field: 'actions',
          fixed: 'right',
          slots: { default: 'actions' },
          title: '操作',
          width: 184,
        },
      ],
      [],
      { trailingFlexibleColumnMinWidth: 72 },
    ) as any[];

    const columns = applyStockDocumentListColumnCustomization(
      preparedColumns,
      [
        { field: 'creatorName', renderVisible: false, resizeWidth: 160 },
        { field: 'remark', renderVisible: true, resizeWidth: 220 },
        { field: 'actions', renderFixed: false, renderVisible: true },
        { type: 'checkbox', renderVisible: true },
      ],
      72,
    ) as any[];

    expect(columns.map(({ field, type }) => field ?? type)).toEqual([
      'creatorName',
      'remark',
      'checkbox',
      'actions',
    ]);
    expect(
      columns.find((column) => column.field === 'creatorName'),
    ).toMatchObject({
      visible: false,
      width: 160,
    });
    expect(columns.find((column) => column.field === 'remark')).toMatchObject({
      minWidth: 220,
      visible: true,
    });
    expect(
      columns.find((column) => column.field === 'remark')?.width,
    ).toBeUndefined();
    expect(columns.at(-1)).toMatchObject({ field: 'actions', fixed: 'right' });
  });
});
