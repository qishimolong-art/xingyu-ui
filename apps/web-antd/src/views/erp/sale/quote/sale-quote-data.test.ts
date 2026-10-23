import { describe, expect, it } from 'vitest';

import {
  getSaleQuoteCustomerDeptSimplePage,
  getSaleQuoteDeptSimplePage,
  getSaleQuoteUserSimplePage,
} from '#/api/erp/sale/quote';

import {
  useFormItemColumns,
  useFormSchema,
  useGridColumns,
  useGridFormSchema,
} from './data';

describe('sale quote form schema', () => {
  it('maps customer sale department options for the quote department select', () => {
    const deptOptions = [
      {
        id: 102,
        name: 'Dept 102',
        children: [{ id: 103, name: 'Dept 103' }],
      },
    ];
    const deptSchema = useFormSchema('edit', [], deptOptions).find(
      (item) => item.fieldName === 'deptId',
    );

    expect(deptSchema?.component).toBe('ErpLazyPageSelect');
    const deptComponentProps = deptSchema?.componentProps as any;
    expect(deptComponentProps).toMatchObject({
      allowClear: true,
      labelField: 'name',
      pageSize: 10,
      placeholder: '请选择部门',
      showSearch: true,
      valueField: 'id',
    });
    expect(deptComponentProps.options).toBe(deptOptions);
    expect(deptComponentProps.api).toBe(getSaleQuoteCustomerDeptSimplePage);
    expect(deptComponentProps.shouldFetch({ customerId: 1 })).toBe(true);
    expect(deptComponentProps.shouldFetch({})).toBe(false);
  });

  it('keeps quote fields with independent order and outbound statuses', () => {
    const namedColumns = (useGridColumns() || [])
      .filter(
        (column: any) => column.type !== 'checkbox' && column.title !== '操作',
      )
      .map((column: any) => column.title);

    expect(namedColumns).toEqual([
      '删除',
      '出库',
      '打印',
      '微信通知',
      '导出',
      '打印次数',
      '报价单号',
      '单据日期',
      '下订状态',
      '出库状态',
      '继续选购',
      '客户名称',
      '总金额',
      '折让金额',
      '实收金额',
      '业务员',
      '部门',
      '优先级',
      '送货方式',
      '送货地址',
      '付款方式',
      '预计发货时间',
      '备注',
      '内部说明',
      '客户编码',
      '建立人',
      '建立时间',
      '修改人',
      '修改时间',
      '打印时间',
    ]);
    expect(namedColumns).not.toContain('预览');
    expect(namedColumns.slice(0, 14)).toEqual([
      '删除',
      '出库',
      '打印',
      '微信通知',
      '导出',
      '打印次数',
      '报价单号',
      '单据日期',
      '下订状态',
      '出库状态',
      '继续选购',
      '客户名称',
      '总金额',
      '折让金额',
    ]);
  });

  it('keeps leading columns scrollable and fixes only the aggregate operation column', () => {
    const columns = (useGridColumns() || []) as any[];
    expect(columns[0]).toMatchObject({ type: 'checkbox', autoFixed: false });
    expect(columns.slice(0, -1).every((column) => !column.fixed)).toBe(true);
    expect(columns.at(-1)).toMatchObject({ title: '操作', fixed: 'right' });
  });

  it('uses customer wording and compact popup typography for quote search', () => {
    const customerSchema = useGridFormSchema().find(
      (item) => item.fieldName === 'customerId',
    );
    expect(customerSchema?.label).toBe('客户');
    expect(customerSchema?.componentProps).toMatchObject({
      popupClassName:
        'sale-quote-search-select-dropdown erp-candidate-focus-popup',
    });
  });

  it('lazy loads quote search department options when the select is opened', () => {
    const deptSchema = useGridFormSchema().find(
      (item) => item.fieldName === 'deptId',
    );

    expect(deptSchema?.label).toBe('所属部门');
    expect(deptSchema?.component).toBe('ErpLazyPageSelect');
    expect(deptSchema?.componentProps).toMatchObject({
      allowClear: true,
      labelField: 'name',
      loadErrorMessage: '部门列表加载失败，请重试',
      pageSize: 10,
      placeholder: '请选择所属部门',
      showSearch: true,
      valueField: 'id',
    });
    expect((deptSchema?.componentProps as any)?.api).toBe(
      getSaleQuoteDeptSimplePage,
    );
  });

  it('uses paged lazy loading for quote search salesperson options', () => {
    const saleUserSchema = useGridFormSchema().find(
      (item) => item.fieldName === 'saleUserId',
    );

    expect(saleUserSchema?.label).toBe('业务员');
    expect(saleUserSchema?.component).toBe('ErpLazyPageSelect');
    expect(saleUserSchema?.componentProps).toMatchObject({
      allowClear: true,
      labelField: 'nickname',
      loadErrorMessage: '业务员列表加载失败，请重试',
      pageSize: 10,
      placeholder: '请选择业务员',
      showSearch: true,
      valueField: 'id',
    });
    expect((saleUserSchema?.componentProps as any)?.api).toBe(
      getSaleQuoteUserSimplePage,
    );
  });

  it('uses a product keyword input for quote search without loading all products', () => {
    const productSchema = useGridFormSchema().find(
      (item) => item.fieldName === 'productKeyword',
    );

    expect(productSchema?.label).toBe('产品');
    expect(productSchema?.component).toBe('Input');
    expect(productSchema?.componentProps).toMatchObject({
      allowClear: true,
      placeholder: '请输入配件编码、名称、单位等，多个条件可用 / 或空格分隔',
    });
    expect((productSchema?.componentProps as any)?.api).toBeUndefined();
  });

  it('sorts business item columns but not sequence or operation columns', () => {
    const columns = (useFormItemColumns(false) || []) as any[];
    expect(columns[0]).toMatchObject({ type: 'seq' });
    expect(columns[0].sortable).toBe(false);
    expect(
      columns.find((column) => column.field === 'productId')?.sortable,
    ).toBe(true);
    expect(
      columns.find((column) => column.field === 'warehouseId'),
    ).toMatchObject({
      sortable: true,
      title: '仓库',
    });
    expect(
      columns.find((column) => column.field === 'warehouseId')?.width,
    ).toBeGreaterThanOrEqual(120);
    expect(
      columns.find((column) => column.field === 'warehouseId')?.minWidth,
    ).toBeUndefined();
    expect(
      columns.find((column) => column.field === 'salePrice'),
    ).toBeUndefined();
    expect(
      columns.find((column) => column.field === 'productPrice'),
    ).toMatchObject({
      sortable: true,
      title: '产品单价',
    });
    expect(
      columns.find((column) => column.field === 'productPrice')?.width,
    ).toBeLessThan(120);
    expect(
      columns.find((column) => column.field === 'lastSalePrice'),
    ).toMatchObject({
      formatter: 'formatAmount2',
      sortable: true,
      title: '最后一次销售价',
    });
    expect(
      columns.find((column) => column.field === 'lastSalePrice')?.width,
    ).toBeLessThan(130);
    expect(
      columns.find((column) => column.field === 'packageQty'),
    ).toMatchObject({ formatter: 'formatAmount3', sortable: true });
    expect(columns.find((column) => column.field === 'remark')).toMatchObject({
      sortable: true,
    });
    expect(
      columns.find((column) => column.field === 'remark')?.minWidth,
    ).toBeUndefined();
    expect(columns.at(-1).sortable).toBe(false);
  });

  it('keeps remark last and makes it flexible when the quote page opts in', () => {
    const columns = (useFormItemColumns(false, [], {
      rows: [{ convertedCount: 1, remark: '报价备注' }],
      trailingFlexibleColumnMinWidth: 150,
    }) || []) as any[];
    const remarkIndex = columns.findIndex(
      (column) => column.field === 'remark',
    );
    const actionIndex = columns.findIndex(
      (column) => column.field === 'actions',
    );
    const remarkColumn = columns[remarkIndex];

    expect(columns[remarkIndex - 1]).toMatchObject({ field: 'convertedCount' });
    expect(actionIndex).toBe(remarkIndex + 1);
    expect(remarkColumn?.width).toBeUndefined();
    expect(remarkColumn?.minWidth).toBeGreaterThanOrEqual(150);
    expect(columns[actionIndex]).toMatchObject({ fixed: 'right', width: 78 });
  });

  it('lets the previous permitted column take over when remark is hidden', () => {
    const columns = (useFormItemColumns(false, ['item_remark'], {
      rows: [{ convertedCount: 1 }],
      trailingFlexibleColumnMinWidth: 150,
    }) || []) as any[];
    const trailingBusinessColumn = columns
      .toReversed()
      .find(
        (column) =>
          column.field &&
          column.field !== 'actions' &&
          column.visible !== false,
      );

    expect(columns.some((column) => column.field === 'remark')).toBe(false);
    expect(trailingBusinessColumn).toMatchObject({
      field: 'convertedCount',
      minWidth: 150,
    });
    expect(trailingBusinessColumn?.width).toBeUndefined();
  });
});
