import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { useFormItemColumns, useGridFormSchema } from './data';

const currentDir = dirname(fileURLToPath(import.meta.url));
const dataSource = readFileSync(join(currentDir, 'data.ts'), 'utf8');
const indexSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const formSource = readFileSync(join(currentDir, 'modules/form.vue'), 'utf8');
const apiSource = readFileSync(
  join(currentDir, '../../../../api/erp/sale/cart/index.ts'),
  'utf8',
);
const itemColumnsSource = dataSource.slice(
  dataSource.indexOf('export function useFormItemColumns('),
  dataSource.indexOf('export function useGridFormSchema()'),
);

describe('sale cart restored basic fields', () => {
  it('keeps delivery method and vin available in form, list and sort contracts', () => {
    expect(dataSource).toContain("fieldName: 'deliveryMethod'");
    expect(dataSource).toContain("getBaseDataSimpleList('delivery_method')");
    expect(dataSource).toContain("fieldName: 'vin'");
    expect(dataSource).toContain("field: 'deliveryMethod'");
    expect(dataSource).toContain("field: 'vin'");
    expect(indexSource).toContain("deliveryMethod: 'deliveryMethod'");
    expect(indexSource).toContain("vin: 'vin'");
    expect(apiSource).toContain('deliveryMethod?: string;');
    expect(apiSource).toContain('vin?: string;');
  });
});

describe('sale cart freight finance fields', () => {
  it('keeps customer-advance and self-pay freight types guarded by fee amount validation', () => {
    expect(dataSource).toContain(
      "const FREIGHT_TYPE_CUSTOMER_ADVANCE = '代客户付'",
    );
    expect(dataSource).toContain("const FREIGHT_TYPE_SELF_PAY = '我方自付'");
    expect(dataSource).toContain('label: FREIGHT_TYPE_CUSTOMER_ADVANCE');
    expect(dataSource).toContain('label: FREIGHT_TYPE_SELF_PAY');
    expect(dataSource).toContain("fieldName: 'freightType'");
    expect(dataSource).toContain("fieldName: 'feeAmount'");
    expect(dataSource).toContain("triggerFields: ['freightType']");
    expect(dataSource).toContain('isFinanceFreightType(values.freightType)');
    expect(dataSource).toContain('代客户付或我方自付时，费用必须大于 0');
  });

  it('requires and defaults the settlement account used by self-pay freight', () => {
    expect(dataSource).toContain("fieldName: 'accountId'");
    expect(dataSource).toContain("label: '结算账户'");
    expect(dataSource).toContain('api: getAccountSimpleList');
    expect(dataSource).toContain('我方自付时请选择结算账户');
    expect(formSource).toContain('async function loadDefaultAccountId()');
    expect(formSource).toContain(
      'accountList.find((item) => item.defaultStatus)?.id',
    );
    expect(formSource).toContain('accountId: defaultAccountId');
  });
});

describe('sale cart item price columns', () => {
  it('hides sale price while keeping product price editable independently of price permission', () => {
    expect(itemColumnsSource).not.toContain("field: 'salePrice'");
    expect(itemColumnsSource).not.toContain("title: '售价'");
    expect(itemColumnsSource).toContain("field: 'productPrice'");
    expect(itemColumnsSource).toContain("title: '单价'");
    expect(itemColumnsSource).toContain("'item_productPrice'");
    expect(itemColumnsSource).toContain('itemColumnHiddenFields');
  });

  it('keeps remark last and makes it the only flexible business column', () => {
    const columns = (useFormItemColumns(false, [], false, {
      rows: [{ remark: '手推车备注', stockCount: 12 }],
      trailingFlexibleColumnMinWidth: 150,
    }) || []) as any[];
    const remarkIndex = columns.findIndex(
      (column) => column.field === 'remark',
    );
    const actionIndex = columns.findIndex(
      (column) => column.field === 'actions',
    );
    const flexibleBusinessColumns = columns.filter(
      (column) =>
        column.field &&
        column.field !== 'actions' &&
        column.visible !== false &&
        column.width === undefined,
    );

    expect(columns[remarkIndex - 1]).toMatchObject({ field: 'stockCount' });
    expect(actionIndex).toBe(remarkIndex + 1);
    expect(flexibleBusinessColumns).toHaveLength(1);
    expect(flexibleBusinessColumns[0]).toMatchObject({
      field: 'remark',
      minWidth: 150,
    });
    expect(columns[actionIndex]).toMatchObject({ fixed: 'right', width: 78 });
  });

  it('preserves long remark width and falls back when remark is hidden', () => {
    const longRemarkColumns = (useFormItemColumns(false, [], false, {
      rows: [
        {
          remark: '销售手推车明细备注需要完整保留当前页内容计算出来的宽度',
        },
      ],
      trailingFlexibleColumnMinWidth: 150,
    }) || []) as any[];
    const hiddenRemarkColumns = (useFormItemColumns(
      true,
      ['item_remark'],
      false,
      {
        rows: [{ stockCount: 12 }],
        trailingFlexibleColumnMinWidth: 150,
      },
    ) || []) as any[];
    const fallbackColumn = hiddenRemarkColumns
      .toReversed()
      .find(
        (column) =>
          column.field &&
          column.field !== 'actions' &&
          column.visible !== false,
      );

    expect(
      longRemarkColumns.find((column) => column.field === 'remark')?.minWidth,
    ).toBeGreaterThan(150);
    expect(
      hiddenRemarkColumns.some((column) => column.field === 'remark'),
    ).toBe(false);
    expect(fallbackColumn).toMatchObject({
      field: 'stockCount',
      minWidth: 150,
    });
    expect(fallbackColumn?.width).toBeUndefined();
  });
});

describe('sale cart list performance search', () => {
  it('uses lazy paged selectors and product keyword in ordinary list search', () => {
    const schema = useGridFormSchema();
    const productSchema = schema.find(
      (item) => item.fieldName === 'productKeyword',
    );
    const deptSchema = schema.find((item) => item.fieldName === 'deptId');
    const saleUserSchema = schema.find(
      (item) => item.fieldName === 'saleUserId',
    );

    expect(productSchema).toMatchObject({
      component: 'Input',
      componentProps: {
        placeholder: '请输入配件编码、名称、单位等，多个条件可用 / 或空格分隔',
      },
    });
    expect(deptSchema).toMatchObject({
      component: 'ErpLazyPageSelect',
      componentProps: { pageSize: 10 },
    });
    expect(saleUserSchema).toMatchObject({
      component: 'ErpLazyPageSelect',
      componentProps: { pageSize: 10 },
    });
    expect(schema.some((item) => item.fieldName === 'productId')).toBe(false);
    expect(indexSource).toContain('row.itemCount ?? row.items?.length ?? 0');
  });
});
