import { describe, expect, it } from 'vitest';

import {
  preparePurchaseDocumentItemColumns,
  resolvePurchaseDocumentItemSortValue,
  sortPurchaseDocumentItems,
} from './document-item-table';

describe('purchase document item table', () => {
  const context = {
    warehouseOptions: [
      { id: 1, name: 'B仓' },
      { id: 2, name: 'A仓' },
    ],
    deptOptions: [
      { id: 10, name: '总部', children: [{ id: 11, name: '分部' }] },
    ],
  };

  it('sorts by displayed selector and product values', () => {
    expect(
      resolvePurchaseDocumentItemSortValue(
        { warehouseId: 2 },
        'warehouseId',
        context,
      ),
    ).toBe('A仓');
    expect(
      resolvePurchaseDocumentItemSortValue({ deptId: 11 }, 'deptId', context),
    ).toBe('分部');
    expect(
      resolvePurchaseDocumentItemSortValue(
        { productId: 99, productName: '刹车片' },
        'productId',
        context,
      ),
    ).toBe('刹车片');
  });

  it('sorts numbers stably and keeps blanks last in both directions', () => {
    const numericRows = [
      { id: 1, count: 12 },
      { id: 2, count: 3 },
      { id: 3, count: 8 },
    ];
    expect(
      sortPurchaseDocumentItems(numericRows, 'count', 'asc').map(
        ({ id }) => id,
      ),
    ).toEqual([2, 3, 1]);
    expect(
      sortPurchaseDocumentItems(numericRows, 'count', 'desc').map(
        ({ id }) => id,
      ),
    ).toEqual([1, 3, 2]);

    const textRows = [
      { id: 1, remark: undefined },
      { id: 2, remark: '瑞云' },
      { id: 3, remark: '' },
      { id: 4, remark: '瑞云' },
      { id: 5, remark: '安达' },
    ];
    expect(
      sortPurchaseDocumentItems(textRows, 'remark', 'asc').map(({ id }) => id),
    ).toEqual([5, 2, 4, 1, 3]);
    expect(
      sortPurchaseDocumentItems(textRows, 'remark', 'desc').map(({ id }) => id),
    ).toEqual([2, 4, 5, 1, 3]);
  });

  it('keeps the source rows untouched so active sorting can reapply after edits', () => {
    const rows = [
      { id: 1, count: 2 },
      { id: 2, count: 1 },
    ];
    expect(
      sortPurchaseDocumentItems(rows, 'count', 'asc').map(({ id }) => id),
    ).toEqual([2, 1]);
    expect(rows.map(({ id }) => id)).toEqual([1, 2]);
    const firstRow = rows[0];
    expect(firstRow).toBeDefined();
    if (firstRow) {
      firstRow.count = 0;
    }
    expect(
      sortPurchaseDocumentItems(rows, 'count', 'asc').map(({ id }) => id),
    ).toEqual([1, 2]);
  });

  it('preserves remaining column order while fixing only operations to the right', () => {
    const columns = preparePurchaseDocumentItemColumns([
      { type: 'seq', title: '序号', fixed: 'left', width: 50 },
      { field: 'productCode', title: '产品编码', fixed: 'left' },
      { field: 'warehouseId', title: '仓库', minWidth: 120 },
      { field: 'remark', title: '备注', minWidth: 120 },
      {
        title: '操作',
        slots: { default: 'actions' },
        fixed: 'right',
        width: 50,
      },
    ]);

    expect(columns.map(({ title }) => title)).toEqual([
      '序号',
      '产品编码',
      '仓库',
      '备注',
      '操作',
    ]);
    expect(columns[0]).toMatchObject({ sortable: false });
    expect(columns[0]?.fixed).toBeUndefined();
    expect(columns[1]).toMatchObject({ sortable: true });
    expect(columns[1]?.fixed).toBeUndefined();
    expect(columns[2]).toMatchObject({ sortable: true, width: 88 });
    expect(columns[3]).toMatchObject({ sortable: true, width: 90 });
    expect(columns[4]).toMatchObject({
      fixed: 'right',
      sortable: false,
      width: 64,
    });
  });

  it('makes only the trailing business column flexible when explicitly enabled', () => {
    const sourceColumns = [
      { type: 'seq', title: '序号', width: 60 },
      { field: 'productId', title: '产品名称', minWidth: 160 },
      { field: 'remark', title: '备注', minWidth: 90 },
      {
        title: '操作',
        slots: { default: 'actions' },
        visible: false,
        width: 70,
      },
    ];
    const columns = preparePurchaseDocumentItemColumns(sourceColumns, {
      rows: [{ productName: '机滤', remark: '短备注' }],
      trailingFlexibleColumnMinWidth: 150,
    });
    const productColumn = columns.find(
      (column) => column.field === 'productId',
    );
    const remarkColumn = columns.find((column) => column.field === 'remark');
    const operationColumn = columns.find(
      (column) => column.slots?.default === 'actions',
    );

    expect(productColumn?.width).toBeGreaterThanOrEqual(160);
    expect(productColumn?.minWidth).toBeUndefined();
    expect(remarkColumn?.width).toBeUndefined();
    expect(remarkColumn?.minWidth).toBeGreaterThanOrEqual(150);
    expect(operationColumn).toMatchObject({
      fixed: 'right',
      visible: false,
      width: 70,
    });
    expect(sourceColumns[2]).toMatchObject({ minWidth: 90 });
    expect(sourceColumns[2]).toHaveProperty('minWidth');
  });

  it('lets the previous visible business column take over when remark is hidden', () => {
    const columns = preparePurchaseDocumentItemColumns(
      [
        { type: 'seq', title: '序号', width: 60 },
        { field: 'totalPrice', title: '金额', minWidth: 120 },
        {
          field: 'remark',
          title: '备注',
          minWidth: 90,
          visible: false,
        },
        {
          title: '操作',
          slots: { default: 'actions' },
          width: 70,
        },
      ],
      {
        rows: [{ totalPrice: 4.58 }],
        trailingFlexibleColumnMinWidth: 150,
      },
    );
    const amountColumn = columns.find(
      (column) => column.field === 'totalPrice',
    );
    const operationColumn = columns.find(
      (column) => column.slots?.default === 'actions',
    );
    const hiddenRemarkColumn = columns.find(
      (column) => column.field === 'remark',
    );

    expect(amountColumn?.width).toBeUndefined();
    expect(amountColumn?.minWidth).toBe(150);
    expect(hiddenRemarkColumn).toMatchObject({ visible: false });
    expect(hiddenRemarkColumn?.width).toBeGreaterThanOrEqual(90);
    expect(operationColumn).toMatchObject({ fixed: 'right', width: 70 });
  });

  it('places the product name immediately after auxiliary columns', () => {
    const columns = preparePurchaseDocumentItemColumns([
      { type: 'checkbox', title: '', width: 44 },
      { type: 'seq', title: '序号', width: 50 },
      { field: 'inStatus', title: '入库状态', width: 80 },
      { field: 'productCode', title: '产品编码', width: 120 },
      { field: 'productId', title: '零件名称', width: 160 },
      { field: 'warehouseId', title: '仓库', width: 120 },
    ]);

    expect(columns.map(({ field, type }) => field ?? type)).toEqual([
      'checkbox',
      'seq',
      'productId',
      'inStatus',
      'productCode',
      'warehouseId',
    ]);
  });

  it('expands detail columns from current page content without a max width', () => {
    const columns = preparePurchaseDocumentItemColumns(
      [
        { field: 'productCode', title: '编码', width: 82 },
        { field: 'productId', title: '零件名称', width: 160 },
        { field: 'standard', title: '规格', width: 70 },
        { field: 'drawingNo', title: '图号', width: 66 },
        { field: 'factoryCode', title: '厂家编码', width: 78 },
        { field: 'brand', title: '品牌', width: 58 },
        { field: 'remark', title: '开单备注', width: 90 },
      ],
      {
        rows: [
          {
            brand: '超长品牌名称ABCD',
            drawingNo: 'DRAWING-2026-VERY-LONG-001',
            factoryCode: 'FACTORY-CODE-VERY-LONG-001',
            productCode: 'PART-CODE-20260917-VERY-LONG',
            productName: '超长零件名称用于撑开采购订单明细表',
            remark: '这是一段很长的开单备注，需要完整显示出来不能再被省略',
            standard: 'STANDARD-VERY-LONG-SPECIFICATION',
          },
        ],
      },
    );
    const findColumnWidth = (field: string) =>
      Number(columns.find((column) => column.field === field)?.width ?? 0);

    expect(findColumnWidth('productCode')).toBeGreaterThan(180);
    expect(findColumnWidth('productId')).toBeGreaterThan(240);
    expect(findColumnWidth('standard')).toBeGreaterThan(200);
    expect(findColumnWidth('drawingNo')).toBeGreaterThan(200);
    expect(findColumnWidth('factoryCode')).toBeGreaterThan(200);
    expect(findColumnWidth('brand')).toBeGreaterThan(120);
    expect(findColumnWidth('remark')).toBeGreaterThan(300);
  });

  it('keeps short current-page values compact instead of using wide fixed floors', () => {
    const columns = preparePurchaseDocumentItemColumns(
      [
        { field: 'productCode', title: '编码', width: 82 },
        {
          field: 'warehouseId',
          title: '所属仓库',
          width: 88,
          slots: { default: 'warehouseId' },
        },
        {
          field: 'deptId',
          title: '所属部门',
          width: 88,
          slots: { default: 'deptId' },
        },
        {
          field: 'productId',
          title: '零件名称',
          width: 160,
          slots: { default: 'productId' },
        },
      ],
      {
        rows: [
          {
            deptName: '兴宇路通',
            productCode: '147757',
            productName: '美孚速霸每日保护全合成 5W-30 6X4L',
            warehouseName: '农科路总仓',
          },
        ],
      },
    );
    const findColumnWidth = (field: string) =>
      Number(columns.find((column) => column.field === field)?.width ?? 0);

    expect(findColumnWidth('productCode')).toBeLessThan(100);
    expect(findColumnWidth('warehouseId')).toBeLessThan(140);
    expect(findColumnWidth('deptId')).toBeLessThan(130);
    expect(findColumnWidth('productId')).toBeGreaterThan(260);
  });

  it('reserves the editable gift switch and label as one composite control', () => {
    const columns = preparePurchaseDocumentItemColumns(
      [{ field: 'gift', title: '赠品', width: 52 }],
      { editable: true, rows: [{ gift: true }] },
    );

    expect(Number(columns[0]?.width ?? 0)).toBeGreaterThanOrEqual(86);
  });

  it('measures every amount field with its fixed two-decimal display', () => {
    const columns = preparePurchaseDocumentItemColumns(
      [{ field: 'lastPurchasePrice', title: '末采', width: 40 }],
      { rows: [{ lastPurchasePrice: 123_456.1 }] },
    );

    expect(Number(columns[0]?.width ?? 0)).toBeGreaterThanOrEqual(93);
  });

  it('keeps purchase price and amount columns compact in readonly detail rows', () => {
    const columns = preparePurchaseDocumentItemColumns(
      [
        { field: 'count', title: '订货数', width: 62 },
        {
          field: 'productPrice',
          title: '订货价',
          width: 64,
          slots: { default: 'productPrice' },
        },
        { field: 'lastPurchasePrice', title: '最后采购价', width: 78 },
        { field: 'totalProductPrice', title: '订货金额', width: 78 },
      ],
      {
        rows: [
          {
            count: 144,
            lastPurchasePrice: 163.96,
            productPrice: 163.96,
            totalProductPrice: 23_609.59,
          },
          {
            count: 624,
            lastPurchasePrice: 57.82,
            productPrice: 57.82,
            totalProductPrice: 36_080.4,
          },
          {
            count: 144,
            lastPurchasePrice: 204.3,
            productPrice: 204.3,
            totalProductPrice: 29_419.78,
          },
        ],
      },
    );
    const findColumnWidth = (field: string) =>
      Number(columns.find((column) => column.field === field)?.width ?? 0);

    expect(findColumnWidth('count')).toBeLessThanOrEqual(70);
    expect(findColumnWidth('productPrice')).toBeLessThanOrEqual(90);
    expect(findColumnWidth('lastPurchasePrice')).toBeLessThanOrEqual(90);
    expect(findColumnWidth('totalProductPrice')).toBeLessThanOrEqual(90);
  });

  it('measures compact number columns by formatted display text after item loading', () => {
    const columns = preparePurchaseDocumentItemColumns(
      [
        { field: 'count', title: '订货数', width: 62 },
        {
          field: 'productPrice',
          title: '订货价',
          width: 64,
          slots: { default: 'productPrice' },
        },
        { field: 'lastPurchasePrice', title: '最后采购价', width: 78 },
        { field: 'totalProductPrice', title: '订货金额', width: 78 },
      ],
      {
        rows: [
          {
            count: 144.000_000_000_001,
            lastPurchasePrice: 204.300_000_000_000_01,
            productPrice: 163.960_000_000_000_01,
            totalProductPrice: 23_609.590_000_000_004,
          },
        ],
      },
    );
    const findColumnWidth = (field: string) =>
      Number(columns.find((column) => column.field === field)?.width ?? 0);

    expect(findColumnWidth('count')).toBeLessThanOrEqual(70);
    expect(findColumnWidth('productPrice')).toBeLessThanOrEqual(75);
    expect(findColumnWidth('lastPurchasePrice')).toBeLessThanOrEqual(90);
    expect(findColumnWidth('totalProductPrice')).toBeLessThanOrEqual(90);
  });

  it('adds only input control space for editable purchase price columns', () => {
    const readonlyColumns = preparePurchaseDocumentItemColumns(
      [{ field: 'productPrice', title: '订货价', width: 64 }],
      {
        rows: [{ productPrice: 204.3 }],
      },
    );
    const editableColumns = preparePurchaseDocumentItemColumns(
      [{ field: 'productPrice', title: '订货价', width: 64 }],
      {
        editable: true,
        rows: [{ productPrice: 204.3 }],
      },
    );
    const readonlyWidth = Number(readonlyColumns[0]?.width ?? 0);
    const editableWidth = Number(editableColumns[0]?.width ?? 0);

    expect(editableWidth).toBeGreaterThan(readonlyWidth);
    expect(editableWidth).toBeLessThanOrEqual(105);
  });

  it('keeps editable selector columns wide enough without over-expanding readonly cells', () => {
    const columns = preparePurchaseDocumentItemColumns(
      [
        {
          field: 'warehouseId',
          title: '所属仓库',
          width: 88,
          slots: { default: 'warehouseId' },
        },
        {
          field: 'deptId',
          title: '所属部门',
          width: 88,
          slots: { default: 'deptId' },
        },
      ],
      {
        editable: true,
        isCellEditable: (field, row) =>
          field === 'deptId' ? !row.productId : true,
        rows: [
          {
            deptName: '兴宇路通',
            productId: 1,
            warehouseName: '甘孜路通',
          },
          {},
        ],
      },
    );
    const findColumnWidth = (field: string) =>
      Number(columns.find((column) => column.field === field)?.width ?? 0);

    expect(findColumnWidth('warehouseId')).toBeGreaterThanOrEqual(136);
    expect(findColumnWidth('warehouseId')).toBeLessThanOrEqual(145);
    expect(findColumnWidth('deptId')).toBeGreaterThanOrEqual(160);
    expect(findColumnWidth('deptId')).toBeLessThanOrEqual(170);
  });

  it('treats selected item departments as readonly text in editable forms', () => {
    const columns = preparePurchaseDocumentItemColumns(
      [
        {
          field: 'deptId',
          title: '所属部门',
          width: 88,
          slots: { default: 'deptId' },
        },
      ],
      {
        editable: true,
        isCellEditable: (field, row) =>
          field === 'deptId' ? !row.productId : true,
        rows: [
          {
            deptName: '兴宇路通',
            productId: 1,
          },
        ],
      },
    );

    expect(Number(columns[0]?.width ?? 0)).toBeLessThan(130);
  });

  it('ignores legacy wide minWidth floors for known compact business fields', () => {
    const columns = preparePurchaseDocumentItemColumns(
      [
        { field: 'warehouseId', title: '仓库名称', minWidth: 200 },
        { field: 'deptId', title: '所属部门', minWidth: 160 },
        { field: 'productPrice', title: '产品单价', minWidth: 120 },
        { field: 'totalProductPrice', title: '产品金额', minWidth: 120 },
        { field: 'productName', title: '产品名称', minWidth: 200 },
      ] as any[],
      {
        rows: [
          {
            deptName: '兴宇路通',
            productName: '机滤',
            productPrice: 12.5,
            totalProductPrice: 25,
            warehouseName: '甘孜仓',
          },
        ],
      },
    );
    const findColumnWidth = (field: string) =>
      Number(columns.find((column) => column.field === field)?.width ?? 0);

    expect(findColumnWidth('warehouseId')).toBeLessThan(120);
    expect(findColumnWidth('deptId')).toBeLessThan(120);
    expect(findColumnWidth('productPrice')).toBeLessThan(90);
    expect(findColumnWidth('totalProductPrice')).toBeLessThan(90);
    expect(findColumnWidth('productName')).toBe(160);
  });
});
