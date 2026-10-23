import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { useGridColumns, useGridFormSchema } from './data';

const currentDir = dirname(fileURLToPath(import.meta.url));
const listSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');

const expectedFieldTitles = [
  '打印',
  '云打印',
  '微信通知',
  '打印次数',
  '销售单号',
  '调价状态',
  '退货状态',
  '结算状态',
  '报价单',
  '报销单',
  '日期',
  '状态',
  '客户名称',
  '送货方式',
  '签收',
  '结算方式',
  '开单金额',
  '减收金额',
  '减后金额',
  '票据金额',
  '运费',
  '运费类型',
  '票据类型',
  '数量',
  '取消数量',
  '取消金额',
  '取消后金额',
  '收货人',
  '收货人电话',
  '备注',
  '总重',
  '客户编码',
  '票据号',
  '来源单号',
  '来源单制单日期',
  '来源单制单人',
  'VIN',
  '额外费用',
];

const removedFieldTitles = [
  '发运',
  '订单类型',
  '优先级',
  '客户提取',
  '物流单号',
  '配送单号',
  '第三方单号',
  '第三方上游单号',
  '保险公司',
  '制单人',
  '审核人',
  '业务员',
  '部门',
  '审核时间',
  '打印时间',
  '确认时间',
  '客户签收',
  '签收图片',
  '内部说明',
  '发货方',
  '物流公司',
  '发货人',
  '拣货进度',
  '送货进度',
];

function getBusinessColumns() {
  return (useGridColumns() || []).filter(
    (column) => !('type' in column) && column.title !== '操作',
  );
}

describe('sale out grid data', () => {
  it('keeps the reduced visible fields in the required sequence', () => {
    expect(getBusinessColumns().map((column) => column.title)).toEqual(
      expectedFieldTitles,
    );
  });

  it('omits the requested fields from the list', () => {
    const visibleTitles = getBusinessColumns().map((column) => column.title);

    expect(visibleTitles).not.toEqual(
      expect.arrayContaining(removedFieldTitles),
    );
  });

  it('keeps the first 15 fields ordered while allowing datetime columns to expand', () => {
    const firstFifteen = getBusinessColumns().slice(0, 15);
    const datedColumns = useGridColumns([
      { no: 'XSD202609220000001', outTime: '2026-09-22 18:08:31' },
    ]) as any[];

    expect(firstFifteen.map((column) => column.title)).toEqual(
      expectedFieldTitles.slice(0, 15),
    );
    expect(
      datedColumns.find((column) => column.field === 'outTime')?.width,
    ).toBeGreaterThanOrEqual(150);
    expect(
      datedColumns.find((column) => column.field === 'totalCount')?.width,
    ).toBeLessThan(90);
  });

  it('keeps leading columns scrollable and only fixes operation to the right', () => {
    const columns = useGridColumns() || [];
    const fixedColumns = columns.filter((column) => column.fixed);

    expect(fixedColumns).toHaveLength(1);
    expect(fixedColumns[0]).toMatchObject({
      fixed: 'right',
      title: '操作',
      width: 78,
    });
    expect(columns[0]).toMatchObject({
      type: 'checkbox',
      width: 36,
    });
    expect(columns[0]?.fixed).toBeUndefined();
  });

  it('keeps function fields unsortable and business sorting explicit', () => {
    const columns = getBusinessColumns();
    const columnMap = new Map(columns.map((column) => [column.title, column]));

    for (const title of [
      '打印',
      '云打印',
      '微信通知',
      '调价状态',
      '退货状态',
      '报价单',
      '报销单',
      '签收',
    ]) {
      expect(columnMap.get(title)?.sortable).not.toBe(true);
    }
    for (const title of ['打印次数', '销售单号', '数量']) {
      expect(columnMap.get(title)?.sortable).toBe(true);
    }
  });

  it('separates local printing and cloud printing into dedicated columns', () => {
    const columns = getBusinessColumns();
    const printColumn = columns.find((column) => column.title === '打印');
    const cloudPrintColumn = columns.find(
      (column) => column.title === '云打印',
    );

    expect(printColumn).toMatchObject({
      field: 'printAction',
      slots: { default: 'printAction' },
    });
    expect(cloudPrintColumn).toMatchObject({
      field: 'cloudPrintAction',
      slots: { default: 'cloudPrintAction' },
    });
    expect(listSource).toContain('@click="handlePrint(row)"');
    expect(listSource).toContain('@click="handleCloudPrintRow(row)"');
    expect(listSource).not.toContain('本地打印');
  });

  it('uses compact dropdown classes in search selectors', () => {
    const selectSchemas = useGridFormSchema().filter(
      (schema) =>
        schema.component === 'ApiSelect' ||
        schema.component === 'CustomerLazySelect',
    );

    expect(selectSchemas.length).toBeGreaterThan(0);
    expect(
      selectSchemas.every(
        (schema) =>
          typeof schema.componentProps === 'object' &&
          schema.componentProps?.popupClassName ===
            'sale-out-search-select-dropdown erp-candidate-focus-popup',
      ),
    ).toBe(true);
  });

  it('uses lazy paged selectors and product keyword in search', () => {
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
  });

  it('shows price-adjust and return states as plain list columns', () => {
    const columns = getBusinessColumns();
    const noIndex = columns.findIndex((column) => column.title === '销售单号');

    expect(
      columns.slice(noIndex, noIndex + 4).map((column) => column.title),
    ).toEqual(['销售单号', '调价状态', '退货状态', '结算状态']);
    expect(listSource).toContain('未调价');
    expect(listSource).toContain('部分调价');
    expect(listSource).toContain('已调价');
    expect(listSource).toContain('未退货');
    expect(listSource).toContain('部分退货');
    expect(listSource).toContain('已退货');
    expect(listSource).toContain('sale-out-business-status-text--adjust-done');
    expect(listSource).toContain('sale-out-business-status-text--partial');
    expect(listSource).toContain('sale-out-business-status-text--return-done');
    expect(listSource).not.toContain('sale-out-state-dot');
    expect(listSource).not.toContain('圆点表示');
  });

  it('moves the missing-express warning background to the sale-out list', () => {
    expect(listSource).toContain(
      'row.hasExpressFile ?? Boolean(row.expressFileUrl)',
    );
    expect(listSource).toContain('浅黄色行表示未上传快递单');
    expect(listSource).toContain(
      ':deep(.highlight-no-express .vxe-body--column)',
    );
    expect(listSource).toContain(
      ':deep(.highlight-no-express.row--hover .vxe-body--column)',
    );
  });
});
