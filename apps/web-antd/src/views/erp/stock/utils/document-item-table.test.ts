import { describe, expect, it } from 'vitest';

import {
  applyStockDocumentItemColumnCustomization,
  prepareStockDocumentItemColumns,
} from './document-item-table';

describe('prepareStockDocumentItemColumns', () => {
  it('places the product name immediately after auxiliary columns', () => {
    const columns = prepareStockDocumentItemColumns([
      { type: 'seq', title: '序号', width: 50 },
      { dataIndex: 'warehouseName', title: '仓库', width: 150 },
      { dataIndex: 'productCode', title: '产品编码', width: 120 },
      { dataIndex: 'productName', title: '配件名称', width: 180 },
      { dataIndex: 'count', title: '数量', width: 100 },
    ]) as any[];

    expect(columns.map(({ dataIndex, type }) => dataIndex ?? type)).toEqual([
      'seq',
      'productName',
      'warehouseName',
      'productCode',
      'count',
    ]);
  });

  it('expands long item text fields from current page rows', () => {
    const columns = prepareStockDocumentItemColumns(
      [
        { field: 'productCode', title: '编码', minWidth: 200 },
        { field: 'productName', title: '配件名称', minWidth: 200 },
      ],
      {
        rows: [
          {
            productCode: 'A1',
            productName: '超长库存商品名称-适配多个车型-当前页完整显示',
          },
        ],
      },
    ) as any[];

    expect(
      columns.find((column) => column.field === 'productCode')?.width,
    ).toBeLessThan(120);
    expect(
      columns.find((column) => column.field === 'productName')?.width,
    ).toBeGreaterThan(260);
    expect(columns.every((column) => column.minWidth === undefined)).toBe(true);
  });

  it('keeps number and price fields compact after rows are loaded', () => {
    const columns = prepareStockDocumentItemColumns(
      [
        { field: 'count', title: '数量', minWidth: 150 },
        { field: 'productPrice', title: '单价', minWidth: 150 },
        { field: 'totalPrice', title: '金额', minWidth: 150 },
      ],
      {
        rows: [{ count: 1, productPrice: 20, totalPrice: 20 }],
      },
    ) as any[];

    expect(
      columns.find((column) => column.field === 'count')?.width,
    ).toBeLessThan(90);
    expect(
      columns.find((column) => column.field === 'productPrice')?.width,
    ).toBeLessThan(100);
    expect(
      columns.find((column) => column.field === 'totalPrice')?.width,
    ).toBeLessThan(110);
  });

  it('reserves dropdown control space in edit mode and can be tighter in detail mode', () => {
    const editColumns = prepareStockDocumentItemColumns(
      [{ field: 'warehouseId', title: '仓库', minWidth: 80 }],
      {
        editable: true,
        rows: [{ warehouseId: 1, warehouseName: '甘孜仓' }],
      },
    ) as any[];
    const detailColumns = prepareStockDocumentItemColumns(
      [{ field: 'warehouseId', title: '仓库', minWidth: 80 }],
      {
        editable: false,
        rows: [{ warehouseId: 1, warehouseName: '甘孜仓' }],
      },
    ) as any[];

    expect(editColumns[0].width).toBeGreaterThan(detailColumns[0].width);
    expect(editColumns[0].width).toBeGreaterThanOrEqual(120);
  });

  it('supports readonly Ant Design detail columns without ellipsis', () => {
    const columns = prepareStockDocumentItemColumns(
      [
        {
          dataIndex: 'productName',
          ellipsis: true,
          title: '配件名称',
          width: 180,
        },
        {
          dataIndex: 'warehouseName',
          ellipsis: true,
          title: '仓库',
          width: 150,
        },
      ],
      {
        rows: [
          {
            productName: '出仓历史明细里的长配件名称',
            warehouseName: '兴宁路通仓',
          },
        ],
      },
    ) as any[];

    expect(columns.every((column) => column.ellipsis === undefined)).toBe(true);
    expect(
      columns.find((column) => column.dataIndex === 'productName')?.width,
    ).toBeGreaterThan(180);
    expect(
      columns.find((column) => column.dataIndex === 'warehouseName')?.width,
    ).toBeLessThan(150);
  });

  it('keeps operation and selection columns fixed', () => {
    const columns = prepareStockDocumentItemColumns(
      [
        { type: 'seq', title: '序号', width: 50 },
        {
          field: 'actions',
          fixed: 'left',
          slots: { default: 'actions' },
          title: '操作',
          width: 64,
        },
      ],
      {
        rows: [{ actions: '删除复制很长文案' }],
      },
    ) as any[];

    expect(columns.find((column) => column.type === 'seq')?.width).toBe(50);
    expect(columns.find((column) => column.field === 'actions')?.fixed).toBe(
      'right',
    );
    expect(columns.find((column) => column.field === 'actions')?.width).toBe(
      64,
    );
  });

  it('makes only the trailing visible business column flexible when explicitly enabled', () => {
    const sourceColumns = [
      { type: 'seq', title: '序号', width: 50 },
      { field: 'totalPrice', title: '金额', width: 100 },
      { field: 'remark', title: '备注', minWidth: 120 },
      {
        field: 'actions',
        fixed: 'right',
        slots: { default: 'actions' },
        title: '操作',
        width: 64,
      },
    ];
    const sourceSnapshot = structuredClone(sourceColumns);

    const columns = prepareStockDocumentItemColumns(sourceColumns as any[], {
      rows: [{ remark: '盘点差异复核说明' }],
      trailingFlexibleColumnMinWidth: 150,
    }) as any[];

    expect(columns.find((column) => column.field === 'remark')).toMatchObject({
      minWidth: 150,
    });
    expect(
      columns.find((column) => column.field === 'remark')?.width,
    ).toBeUndefined();
    expect(
      columns.find((column) => column.field === 'totalPrice')?.width,
    ).toBeDefined();
    expect(columns.find((column) => column.field === 'actions')).toMatchObject({
      fixed: 'right',
      width: 64,
    });
    expect(sourceColumns).toEqual(sourceSnapshot);
  });

  it('keeps a long trailing remark wider than the configured flexible minimum', () => {
    const columns = prepareStockDocumentItemColumns(
      [
        { field: 'totalPrice', title: '金额', width: 100 },
        { field: 'remark', title: '备注', minWidth: 120 },
      ],
      {
        rows: [
          {
            remark:
              '这是一段用于确认其他入库和其他出库明细备注不会被压缩的超长当前页备注内容',
          },
        ],
        trailingFlexibleColumnMinWidth: 150,
      },
    ) as any[];

    const remarkColumn = columns.find((column) => column.field === 'remark');
    expect(remarkColumn?.width).toBeUndefined();
    expect(remarkColumn?.minWidth).toBeGreaterThan(300);
  });

  it('falls back to the preceding visible business column when remark is hidden', () => {
    const columns = prepareStockDocumentItemColumns(
      [
        { field: 'totalPrice', title: '金额', width: 100 },
        { field: 'remark', title: '备注', visible: false, width: 150 },
        { field: 'actions', slots: { default: 'actions' }, title: '操作' },
      ],
      { trailingFlexibleColumnMinWidth: 150 },
    ) as any[];

    expect(
      columns.find((column) => column.field === 'totalPrice'),
    ).toMatchObject({
      minWidth: 150,
    });
    expect(
      columns.find((column) => column.field === 'totalPrice')?.width,
    ).toBeUndefined();
    expect(
      columns.find((column) => column.field === 'remark')?.width,
    ).toBeDefined();
  });

  it('follows runtime column settings when the user hides or reorders the trailing column', () => {
    const preparedColumns = prepareStockDocumentItemColumns(
      [
        { type: 'seq', title: '序号', width: 50 },
        { field: 'totalPrice', title: '金额', width: 100 },
        { field: 'remark', title: '备注', minWidth: 150 },
        { field: 'actions', slots: { default: 'actions' }, title: '操作' },
      ],
      { trailingFlexibleColumnMinWidth: 150 },
    ) as any[];

    const columns = applyStockDocumentItemColumnCustomization(
      preparedColumns,
      [
        { field: 'remark', renderVisible: false, resizeWidth: 220 },
        { field: 'totalPrice', renderVisible: true, resizeWidth: 110 },
        { field: 'actions', renderFixed: 'right', renderVisible: true },
        { type: 'seq', renderVisible: true },
      ],
      150,
    ) as any[];

    expect(columns.map(({ field, type }) => field ?? type)).toEqual([
      'remark',
      'totalPrice',
      'actions',
      'seq',
    ]);
    expect(columns.find((column) => column.field === 'remark')).toMatchObject({
      visible: false,
      width: 220,
    });
    expect(
      columns.find((column) => column.field === 'totalPrice'),
    ).toMatchObject({
      minWidth: 150,
      visible: true,
    });
    expect(
      columns.find((column) => column.field === 'totalPrice')?.width,
    ).toBeUndefined();
    expect(columns.find((column) => column.field === 'actions')).toMatchObject({
      fixed: 'right',
      width: 64,
    });
  });
});
