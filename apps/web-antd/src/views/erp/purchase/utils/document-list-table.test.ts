import { describe, expect, it } from 'vitest';

import {
  applyPurchaseDocumentListColumnCustomization,
  enforcePurchaseDocumentOperationColumn,
  fitPurchaseDocumentColumnsToWidth,
  preparePurchaseDocumentListColumns,
  releasePurchaseDocumentTrailingColumnResize,
  syncPurchaseDocumentColumnDefaults,
  syncPurchaseDocumentOperationColumn,
} from './document-list-table';

describe('purchase document list adaptive columns', () => {
  it('keeps function columns fixed while measuring business columns from current page rows', () => {
    const columns = preparePurchaseDocumentListColumns(
      [
        { type: 'checkbox', width: 36 },
        { field: 'deleteAction', title: '删除', width: 40 },
        { field: 'no', title: '单据编号', sortable: true, width: 240 },
        { field: 'factoryOrderNo', title: '厂家单号', sortable: true },
        { field: 'supplierName', title: '供应商', sortable: true },
        { field: 'actions', title: '操作', width: 110, fixed: 'right' },
      ] as any,
      [
        {
          no: 'CGDD20260916000005',
          factoryOrderNo: 'S260916092564',
          supplierName: '上海孚创实业发展有限公司',
        },
      ],
    ) as any[];

    const widthOf = (field: string) =>
      Number(columns.find((column) => column.field === field)?.width ?? 0);

    expect(columns[0].width).toBe(36);
    expect(widthOf('deleteAction')).toBe(40);
    expect(widthOf('actions')).toBe(110);
    expect(widthOf('no')).toBeGreaterThan(150);
    expect(widthOf('no')).toBeLessThan(190);
    expect(widthOf('factoryOrderNo')).toBeGreaterThan(120);
    expect(widthOf('factoryOrderNo')).toBeLessThan(150);
    expect(widthOf('supplierName')).toBeGreaterThan(190);
  });

  it('keeps short empty number fields compact', () => {
    const columns = preparePurchaseDocumentListColumns(
      [
        { field: 'factoryOrderNo', title: '厂家单号', sortable: true },
        { field: 'totalCount', title: '总数量', formatter: 'formatAmount3' },
        { field: 'totalPrice', title: '总金额', formatter: 'formatAmount2' },
      ] as any,
      [{ factoryOrderNo: '', totalCount: 3, totalPrice: 49.05 }],
    ) as any[];

    const widthOf = (field: string) =>
      Number(columns.find((column) => column.field === field)?.width ?? 0);

    expect(widthOf('factoryOrderNo')).toBeLessThanOrEqual(100);
    expect(widthOf('totalCount')).toBeLessThanOrEqual(80);
    expect(widthOf('totalPrice')).toBeLessThanOrEqual(88);
  });

  it('reserves enough width for formatted date and date-time values', () => {
    const columns = preparePurchaseDocumentListColumns(
      [
        {
          field: 'createTime',
          title: '开单日期',
          formatter: 'formatDateTime',
          sortable: true,
        },
        { field: 'invoiceDate', title: '开票日期', formatter: 'formatDate' },
      ] as any,
      [
        {
          createTime: '2026-09-16 18:02:31',
          invoiceDate: '2026-09-16',
        },
      ],
    ) as any[];

    const widthOf = (field: string) =>
      Number(columns.find((column) => column.field === field)?.width ?? 0);

    expect(widthOf('createTime')).toBeGreaterThanOrEqual(156);
    expect(widthOf('invoiceDate')).toBeGreaterThanOrEqual(106);
    expect(widthOf('invoiceDate')).toBeLessThan(widthOf('createTime'));
  });

  it('makes only the trailing data column flexible when explicitly enabled', () => {
    const sourceColumns = [
      { type: 'checkbox', width: 36 },
      { field: 'deleteAction', title: '删除', width: 40 },
      { field: 'remark', title: '备注', width: 120 },
      { field: 'printFrequency', title: '打印次数', width: 72 },
      {
        field: 'actions',
        title: '操作',
        fixed: 'right',
        width: 130,
      },
    ] as any[];
    const columns = preparePurchaseDocumentListColumns(sourceColumns, [], {
      trailingFlexibleColumnMinWidth: 72,
    }) as any[];

    expect(columns.find(({ field }) => field === 'remark')?.width).toBe(90);
    expect(
      columns.find(({ field }) => field === 'printFrequency'),
    ).toMatchObject({ minWidth: 72 });
    expect(
      columns.find(({ field }) => field === 'printFrequency'),
    ).not.toHaveProperty('width');
    expect(columns.find(({ field }) => field === 'actions')).toMatchObject({
      fixed: 'right',
      width: 130,
    });
    expect(sourceColumns[3]).toHaveProperty('width', 72);
  });

  it('keeps the feature opt-in so other purchase lists retain fixed widths', () => {
    const columns = preparePurchaseDocumentListColumns(
      [
        { field: 'remark', title: '备注', width: 120 },
        { field: 'actions', fixed: 'right', title: '操作', width: 110 },
      ] as any[],
      [],
    ) as any[];

    expect(columns[0]).toHaveProperty('width', 90);
    expect(columns[0]).not.toHaveProperty('minWidth');
  });

  it('reselects the trailing visible data column after saved settings change', () => {
    const preparedColumns = preparePurchaseDocumentListColumns(
      [
        { type: 'checkbox', width: 36 },
        { field: 'printAction', title: '打印', width: 40 },
        { field: 'remark', title: '备注', width: 120 },
        { field: 'printFrequency', title: '打印次数', width: 72 },
        { field: 'actions', fixed: 'right', title: '操作', width: 130 },
      ] as any[],
      [],
      { trailingFlexibleColumnMinWidth: 72 },
    );
    const columns = applyPurchaseDocumentListColumnCustomization(
      preparedColumns as any[],
      [
        { field: 'printFrequency', renderVisible: false },
        { field: 'printAction', renderVisible: true, resizeWidth: 55 },
        { field: 'remark', renderVisible: true, resizeWidth: 220 },
        {
          field: 'actions',
          fixed: null,
          renderVisible: true,
          resizeWidth: 260,
        },
        { type: 'checkbox', renderVisible: true },
      ],
      72,
    ) as any[];

    expect(columns.map(({ field, type }) => field ?? type)).toEqual([
      'printFrequency',
      'printAction',
      'remark',
      'checkbox',
      'actions',
    ]);
    expect(
      columns.find(({ field }) => field === 'printFrequency')?.visible,
    ).toBe(false);
    expect(columns.find(({ field }) => field === 'printAction')).toMatchObject({
      width: 55,
    });
    expect(columns.find(({ field }) => field === 'remark')).toMatchObject({
      minWidth: 220,
    });
    expect(columns.find(({ field }) => field === 'remark')).not.toHaveProperty(
      'width',
    );
    expect(columns.at(-1)).toMatchObject({
      field: 'actions',
      fixed: 'right',
      width: 130,
    });
  });

  it('preserves fixed data columns and lets the preceding scrollable column fill', () => {
    const preparedColumns = preparePurchaseDocumentListColumns(
      [
        { field: 'remark', title: '备注', width: 120 },
        { field: 'printFrequency', title: '打印次数', width: 72 },
        { field: 'actions', fixed: 'right', title: '操作', width: 130 },
      ] as any[],
      [],
      { trailingFlexibleColumnMinWidth: 72 },
    );
    const columns = applyPurchaseDocumentListColumnCustomization(
      preparedColumns as any[],
      [
        { field: 'remark', renderVisible: true, resizeWidth: 180 },
        {
          field: 'printFrequency',
          renderFixed: 'right',
          renderVisible: true,
          resizeWidth: 88,
        },
        { field: 'actions', renderVisible: true },
      ],
      72,
    ) as any[];

    expect(columns.find(({ field }) => field === 'remark')).toMatchObject({
      minWidth: 180,
    });
    expect(
      columns.find(({ field }) => field === 'printFrequency'),
    ).toMatchObject({ fixed: 'right', width: 88 });
    expect(columns.at(-1)).toMatchObject({
      field: 'actions',
      fixed: 'right',
    });
  });

  it('does not restore a detail-page operation column hidden by the page mode', () => {
    const columns = applyPurchaseDocumentListColumnCustomization(
      [
        { field: 'remark', minWidth: 120, title: '备注' },
        {
          field: 'actions',
          fixed: 'right',
          title: '操作',
          visible: false,
          width: 76,
        },
      ] as any[],
      [
        { field: 'remark', renderVisible: true },
        { field: 'actions', renderVisible: true },
      ],
      72,
    ) as any[];

    expect(columns.at(-1)).toMatchObject({
      field: 'actions',
      fixed: 'right',
      visible: false,
    });
  });

  it('releases only the trailing visible business column from persisted resize', () => {
    const source = [
      { field: 'no', resizeWidth: 160, width: 160 },
      { field: 'supplierName', renderVisible: false, resizeWidth: 240 },
      { field: 'remark', minWidth: 100, resizeWidth: 180 },
      { field: 'actions', fixed: 'right', resizeWidth: 128, width: 128 },
    ] as any[];

    expect(releasePurchaseDocumentTrailingColumnResize(source)).toBe(true);
    expect(source[0].resizeWidth).toBe(160);
    expect(source[1].resizeWidth).toBe(240);
    expect(source[2]).toMatchObject({ minWidth: 100, resizeWidth: 0 });
    expect(source[3].resizeWidth).toBe(128);
  });

  it('fills the wide-screen remainder before the fixed operation column', () => {
    const source = [
      { field: 'no', width: 160 },
      { field: 'supplierName', width: 240 },
      { field: 'remark', minWidth: 100 },
      { field: 'actions', fixed: 'right', width: 128 },
    ] as any[];

    const wide = fitPurchaseDocumentColumnsToWidth(source, 900) as any[];
    expect(wide.find(({ field }) => field === 'remark')).toMatchObject({
      minWidth: 372,
      width: 372,
    });

    const narrow = fitPurchaseDocumentColumnsToWidth(source, 480) as any[];
    expect(narrow.find(({ field }) => field === 'remark')).toMatchObject({
      minWidth: 100,
      width: 100,
    });
  });

  it('reasserts the mode-owned operation visibility and fixed side', () => {
    const listRuntime = [
      {
        field: 'actions',
        fixed: null,
        renderFixed: null,
        renderVisible: false,
        visible: false,
      },
    ] as any[];
    enforcePurchaseDocumentOperationColumn(listRuntime, [
      { field: 'actions', fixed: 'right', visible: true },
    ]);
    expect(listRuntime[0]).toMatchObject({
      fixed: 'right',
      renderFixed: 'right',
      renderVisible: true,
      visible: true,
    });

    const detailRuntime = [
      {
        field: 'actions',
        fixed: null,
        renderFixed: null,
        renderVisible: true,
        visible: true,
      },
    ] as any[];
    enforcePurchaseDocumentOperationColumn(detailRuntime, [
      { field: 'actions', fixed: 'right', visible: false },
    ]);
    expect(detailRuntime[0]).toMatchObject({
      fixed: 'right',
      renderFixed: 'right',
      renderVisible: false,
      visible: false,
    });
  });

  it('uses VXE column APIs so persisted custom state cannot override the mode', async () => {
    const runtime = [{ field: 'actions', fixed: null, visible: false }];
    const calls: string[] = [];
    const table = {
      getFullColumns: () => runtime,
      hideColumn: async () => calls.push('hide'),
      setColumnFixed: async () => calls.push('fixed-right'),
      showColumn: async () => calls.push('show'),
    };

    await syncPurchaseDocumentOperationColumn(table, [
      { field: 'actions', fixed: 'right', visible: true },
    ]);
    expect(calls).toEqual(['show', 'fixed-right']);
    expect(runtime[0]).toMatchObject({ fixed: 'right', visible: true });

    calls.length = 0;
    await syncPurchaseDocumentOperationColumn(table, [
      { field: 'actions', fixed: 'right', visible: false },
    ]);
    expect(calls).toEqual(['hide']);
    expect(runtime[0]).toMatchObject({ fixed: 'right', visible: false });
  });

  it('keeps the uncustomized permission-filtered columns as reset defaults', () => {
    const runtime = [
      { defaultFixed: null, defaultVisible: false, field: 'supplierName' },
      { defaultFixed: null, defaultVisible: false, field: 'actions' },
    ] as any[];
    syncPurchaseDocumentColumnDefaults(runtime, [
      { field: 'supplierName', visible: true },
      { field: 'actions', fixed: 'right', visible: false },
    ]);

    expect(runtime[0]).toMatchObject({
      defaultFixed: undefined,
      defaultVisible: true,
    });
    expect(runtime[1]).toMatchObject({
      defaultFixed: 'right',
      defaultVisible: false,
    });
  });
});
