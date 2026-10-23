import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  useFormItemColumns,
  useFormSchema,
  useGridColumns,
  useGridFormSchema,
  useOrderGridFormSchema,
} from './data';

const currentDir = dirname(fileURLToPath(import.meta.url));
const formSource = readFileSync(join(currentDir, 'modules/form.vue'), 'utf8');
const saleOutSelectSource = readFileSync(
  join(currentDir, 'modules/sale-out-select.vue'),
  'utf8',
);
const itemFormSource = readFileSync(
  join(currentDir, 'modules/item-form.vue'),
  'utf8',
);
const saleOrderSelectSource = readFileSync(
  join(currentDir, 'modules/sale-order-select.vue'),
  'utf8',
);

describe('sale return list columns', () => {
  it('provides separate workflow filters for waiting and partial picking', () => {
    const schema = useGridFormSchema() as any[];
    const statusField = schema.find(
      (item) => item.fieldName === 'workflowStatus',
    );

    expect(statusField?.componentProps?.options).toEqual([
      { label: '草稿', value: '0' },
      { label: '待下单确认', value: '10' },
      { label: '待拣货', value: 'pick-waiting' },
      { label: '部分拣货', value: 'pick-partial' },
      { label: '已审批', value: '20' },
    ]);
  });

  it('keeps the required business columns in the exact order', () => {
    const columns = useGridColumns() as any[];
    const titles = columns
      .filter((column) => column.type !== 'checkbox')
      .map((column) => column.title);

    expect(titles).toEqual([
      '删除',
      '打印',
      '微信通知',
      '打印次数',
      '单号',
      '结算状态',
      '开单日期',
      '状态',
      '拣货进度',
      '下单确认时间',
      '下单确认人',
      '继续选购',
      '审核日期',
      '客户编码',
      '客户名称',
      '退货类型',
      '开单方式',
      '退货总数量',
      '结算方式',
      '送货方式',
      '实际金额',
      '优惠',
      '应收金额',
      '总重',
      '票据类型',
      '票据号',
      '配送单号',
      '物流公司',
      '物流单号',
      '部门',
      '业务员',
      '制单人',
      '审核人',
      '打印时间',
      '优先级',
      '备注',
      '确认时间',
      '操作',
    ]);
    expect(titles).not.toContain('预览');
  });

  it('fixes only the supplementary operation column', () => {
    const columns = useGridColumns() as any[];
    expect(
      columns
        .filter((column) => column.fixed)
        .map((column) => ({ fixed: column.fixed, title: column.title })),
    ).toEqual([{ fixed: 'right', title: '操作' }]);
    expect(columns.at(-1)).toMatchObject({
      fixed: 'right',
      title: '操作',
      width: 72,
    });
  });

  it('uses compact dropdown typography hooks in search and document forms', () => {
    const searchSelects = useGridFormSchema().filter(
      (schema) =>
        String(schema.component).includes('Select') &&
        schema.component !== 'CustomerLazySelect',
    );
    const formSelects = useFormSchema('create').filter((schema) =>
      String(schema.component).includes('Select'),
    );

    expect(searchSelects.length).toBeGreaterThan(0);
    expect(formSelects.length).toBeGreaterThan(0);
    expect(
      searchSelects.every(
        (schema) =>
          (schema.componentProps as any)?.popupClassName ===
          'sale-return-search-select-dropdown erp-candidate-focus-popup',
      ),
    ).toBe(true);
    expect(
      formSelects.every(
        (schema) =>
          (schema.componentProps as any)?.popupClassName ===
          'sale-return-form-select-dropdown erp-candidate-focus-popup',
      ),
    ).toBe(true);
  });

  it('uses lazy paged selectors and product keyword in ordinary list search', () => {
    const schema = useGridFormSchema();
    const productSchema = schema.find(
      (item) => item.fieldName === 'productKeyword',
    );
    const deptSchema = schema.find((item) => item.fieldName === 'deptId');
    const creatorSchema = schema.find((item) => item.fieldName === 'creator');
    const handlerSchema = schema.find((item) => item.fieldName === 'handler');

    expect(productSchema).toMatchObject({
      component: 'Input',
      componentProps: {
        placeholder: '请输入配件编码、名称、单位等，多个条件可用 / 或空格分隔',
      },
    });
    for (const item of [deptSchema, creatorSchema, handlerSchema]) {
      expect(item).toMatchObject({
        component: 'ErpLazyPageSelect',
        componentProps: { pageSize: 10 },
      });
    }
    expect(schema.some((item) => item.fieldName === 'productId')).toBe(false);
    expect(
      useOrderGridFormSchema().some((item) => item.fieldName === 'productId'),
    ).toBe(true);
  });

  it('packs the basic form fields into complete four-column rows', () => {
    const schema = useFormSchema('create');
    const layoutFields = new Set([
      'no',
      'returnTime',
      'returnMode',
      'sourceOutNo',
      'customerId',
      'deptId',
      'creatorName',
      'totalCount',
      'remark',
      'fileUrl',
      'customerReceivableInfo',
    ]);
    const layoutSchema = schema.filter((item) =>
      layoutFields.has(item.fieldName),
    );

    expect(layoutSchema.map((item) => item.fieldName)).toEqual([
      'no',
      'returnTime',
      'returnMode',
      'sourceOutNo',
      'customerId',
      'deptId',
      'creatorName',
      'totalCount',
      'remark',
      'fileUrl',
      'customerReceivableInfo',
    ]);
    expect(
      layoutSchema.find((item) => item.fieldName === 'remark')?.formItemClass,
    ).toBe('col-span-4');
    expect(
      layoutSchema.find((item) => item.fieldName === 'fileUrl')?.formItemClass,
    ).toBe('col-span-4 sale-return-attachment-field');
    expect(formSource).toContain(
      '.sale-return-attachment-field .ant-upload-select .ant-btn',
    );
    expect(formSource).toContain('.sale-return-attachment-field .mt-2');
  });

  it('compacts the warehouse column and fixes the editable item action column', () => {
    const columns = useFormItemColumns([], false, [], {
      rows: [{ warehouseId: 1, warehouseName: '甘孜仓' }],
    }) as any[];

    expect(
      columns.find((column) => column.field === 'warehouseId'),
    ).toMatchObject({ title: '仓库名称' });
    expect(
      columns.find((column) => column.field === 'warehouseId')?.width,
    ).toBeGreaterThanOrEqual(120);
    expect(
      columns.find((column) => column.field === 'warehouseId')?.minWidth,
    ).toBeUndefined();
    expect(columns.at(-1)).toMatchObject({
      fixed: 'right',
      title: '操作',
      width: 64,
    });
  });

  it('uses remark as the trailing flexible business column', () => {
    const columns = useFormItemColumns([], false, [], {
      rows: [{ remark: '销售退货明细备注' }],
      trailingFlexibleColumnMinWidth: 150,
    }) as any[];
    const remarkIndex = columns.findIndex(
      (column) => column.field === 'remark',
    );
    const actionIndex = columns.findIndex(
      (column) => column.field === 'actions',
    );
    const remarkColumn = columns[remarkIndex];

    expect(remarkIndex).toBe(actionIndex - 1);
    expect(remarkColumn.width).toBeUndefined();
    expect(remarkColumn.minWidth).toBeGreaterThanOrEqual(150);
    expect(columns[actionIndex]).toMatchObject({
      fixed: 'right',
      width: 64,
    });
  });

  it('keeps long remarks wide and lets the previous visible column take over', () => {
    const longRemarkColumns = useFormItemColumns([], true, [], {
      rows: [
        {
          remark:
            '销售退货备注需要完整显示当前页中的这段较长说明文字并保留内容宽度',
        },
      ],
      trailingFlexibleColumnMinWidth: 150,
    }) as any[];
    const hiddenRemarkColumns = useFormItemColumns([], true, ['item_remark'], {
      rows: [{ totalProductPrice: 12.34 }],
      trailingFlexibleColumnMinWidth: 150,
    }) as any[];

    expect(
      longRemarkColumns.find((column) => column.field === 'remark')?.minWidth,
    ).toBeGreaterThan(150);
    expect(
      hiddenRemarkColumns.find((column) => column.field === 'remark'),
    ).toBeUndefined();
    expect(
      hiddenRemarkColumns.find(
        (column) => column.field === 'totalProductPrice',
      ),
    ).toMatchObject({ minWidth: 150 });
  });

  it('locks source-return and stock-return locations while keeping item display', () => {
    expect(itemFormSource).toContain(
      'function getWarehouseOptions(row: ErpSaleReturnApi.SaleReturnItem)',
    );
    expect(itemFormSource).toContain(
      'async function loadWarehouseOptionsByDept(deptId?: number)',
    );
    expect(itemFormSource).toContain(
      'v-if="!disabled && !warehouseReadonly && !stockLocationReadonly"',
    );
    expect(itemFormSource).toContain(':options="getWarehouseOptions(row)"');
    expect(itemFormSource).toContain(':disabled="!row.deptId"');
    expect(itemFormSource).toContain(
      'v-if="!disabled && !stockLocationReadonly"',
    );
    expect(formSource).toMatch(
      /:stock-location-readonly="\s*\[10, 20\]\.includes\(Number\(formData\?\.returnMode\)\)\s*"/,
    );
    expect(itemFormSource).toContain('@change="handleDeptChange(row)"');
    expect(formSource).not.toContain(
      ':warehouse-readonly="formData?.returnMode !== 20"',
    );
  });

  it('locks source sales document selection to the selected customer', () => {
    expect(formSource).toContain(':customer-id="formData?.customerId"');
    expect(saleOutSelectSource).toContain('customerId?: number');
    expect(saleOutSelectSource).toContain(
      'const queryCustomerId = props.customerId ?? formValues.customerId',
    );
    expect(saleOutSelectSource).toContain('customerId: queryCustomerId');
    expect(saleOutSelectSource).toContain('await syncLockedCustomer();');
    expect(saleOrderSelectSource).toContain('customerId?: number');
    expect(saleOrderSelectSource).toContain(
      'const queryCustomerId = props.customerId ?? formValues.customerId',
    );
    expect(saleOrderSelectSource).toContain('customerId: queryCustomerId');
    expect(
      useOrderGridFormSchema().some(
        (schema) => schema.fieldName === 'customerId',
      ),
    ).toBe(true);
  });
});
