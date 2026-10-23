import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  getPurchasePriceAdjustDeptSimplePage,
  getPurchasePriceAdjustSupplierDeptSimplePage,
  getPurchasePriceAdjustUserSimplePage,
} from '#/api/erp/purchase/priceadjust';
import { preparePurchaseDocumentItemColumns } from '#/views/erp/purchase/utils/document-item-table';

import {
  useFormItemColumns,
  useFormSchema,
  useGridColumns,
  useGridFormSchema,
} from './data';
import {
  formatPurchasePriceAdjustAmount,
  sumPurchasePriceAdjustAmount,
} from './purchase-price-adjust-list';

const currentDir = dirname(fileURLToPath(import.meta.url));
const indexSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const itemFormSource = readFileSync(
  join(currentDir, 'modules/item-form.vue'),
  'utf8',
);
const formSource = readFileSync(join(currentDir, 'modules/form.vue'), 'utf8');
const detailImportSource = readFileSync(
  join(currentDir, 'modules/import-form.vue'),
  'utf8',
);
const orderImportSource = readFileSync(
  join(currentDir, 'modules/order-import-form.vue'),
  'utf8',
);
const purchaseInSelectSource = readFileSync(
  join(currentDir, 'modules/purchase-in-select-modal.vue'),
  'utf8',
);
const purchaseInItemSelectSource = readFileSync(
  join(currentDir, 'modules/purchase-in-item-select-modal.vue'),
  'utf8',
);
const apiSource = readFileSync(
  join(currentDir, '../../../../api/erp/purchase/priceadjust/index.ts'),
  'utf8',
);

describe('purchase price adjust page contract', () => {
  it('keeps the compact business column order and fixes only operations', () => {
    const columns = (useGridColumns() || []) as any[];
    expect(
      columns
        .filter((column) => column.type !== 'checkbox')
        .map(({ title }) => title),
    ).toEqual([
      '删除',
      '打印',
      '单号',
      '供应商名称',
      '单据日期',
      '状态',
      '调价方式',
      '原单金额',
      '调后金额',
      '调价差额',
      '已结算金额',
      '部门',
      '调价人',
      '创建人',
      '创建日期',
      '修改人',
      '修改日期',
      '审核人',
      '审核日期',
      '备注',
      '操作',
    ]);
    expect(columns[0]).toMatchObject({
      autoFixed: false,
      type: 'checkbox',
      width: 36,
    });
    expect(columns.slice(0, -1).every((column) => !column.fixed)).toBe(true);
    expect(columns.at(-1)).toMatchObject({
      fixed: 'right',
      title: '操作',
      width: 72,
    });
    const editableColumns = useGridColumns([], [{ status: 10 } as any], {
      canEdit: true,
      canUpdateStatus: true,
    }) as any[];
    expect(editableColumns.at(-1)).toMatchObject({
      fixed: 'right',
      title: '操作',
      width: 120,
    });
    expect(columns.find(({ field }) => field === 'no')).toMatchObject({
      slots: { default: 'no' },
    });
  });

  it('gives teleported search overlays an explicit compact typography class', () => {
    const schema = useGridFormSchema();
    for (const fieldName of [
      'adjustType',
      'adjuster',
      'deptId',
      'supplierId',
    ]) {
      expect(
        schema.find((item) => item.fieldName === fieldName)?.componentProps,
      ).toMatchObject({
        popupClassName:
          'purchase-price-adjust-search-select-dropdown erp-candidate-focus-popup',
      });
    }
    expect(
      schema.find((item) => item.fieldName === 'adjustTime')?.componentProps,
    ).toMatchObject({
      popupClassName: 'purchase-price-adjust-search-picker-dropdown',
    });
    expect(
      schema.find((item) => item.fieldName === 'productKeyword'),
    ).toMatchObject({
      component: 'Input',
    });
  });

  it('loads the ordinary list without full detail items', () => {
    expect(indexSource.match(/includeItems: false/g)).toHaveLength(3);
  });

  it('uses paged lazy selectors for database-backed list filters', () => {
    const schema = useGridFormSchema();

    expect(schema.find((field) => field.fieldName === 'deptId')).toMatchObject({
      component: 'ErpLazyPageSelect',
      componentProps: {
        api: getPurchasePriceAdjustDeptSimplePage,
        labelField: 'name',
        pageSize: 10,
        valueField: 'id',
      },
    });
    expect(
      schema.find((field) => field.fieldName === 'adjuster'),
    ).toMatchObject({
      component: 'ErpLazyPageSelect',
      componentProps: {
        api: getPurchasePriceAdjustUserSimplePage,
        labelField: 'nickname',
        pageSize: 10,
        valueField: 'id',
      },
    });
  });

  it('keeps purchase adjust type options compact in the document form', () => {
    expect(
      useFormSchema('create').find((item) => item.fieldName === 'adjustType')
        ?.componentProps,
    ).toMatchObject({
      class: 'w-full purchase-price-adjust-type-radio',
    });
  });

  it('uses the supplier-scoped department page only in the editable header', () => {
    const withSupplier = useFormSchema('create', [], 100).find(
      (item) => item.fieldName === 'deptId',
    );
    const withoutSupplier = useFormSchema('create', [], undefined).find(
      (item) => item.fieldName === 'deptId',
    );
    const withSupplierProps = withSupplier?.componentProps as any;
    const withoutSupplierProps = withoutSupplier?.componentProps as any;

    expect(withSupplier).toMatchObject({
      component: 'ErpLazyPageSelect',
      componentProps: {
        api: getPurchasePriceAdjustSupplierDeptSimplePage,
        params: { supplierId: 100 },
      },
    });
    expect(withSupplierProps.shouldFetch({ supplierId: 100 })).toBe(true);
    expect(withoutSupplierProps.shouldFetch({ supplierId: undefined })).toBe(
      false,
    );
    expect(
      useGridFormSchema().find((item) => item.fieldName === 'deptId')
        ?.componentProps,
    ).toMatchObject({ api: getPurchasePriceAdjustDeptSimplePage });
  });

  it('puts product name first while keeping only item operations fixed', () => {
    const columns = preparePurchaseDocumentItemColumns(
      (useFormItemColumns('create', 10) || []) as any[],
    );
    expect(columns.map(({ field, type }) => field || type).slice(0, 9)).toEqual(
      [
        'seq',
        'productName',
        'inNo',
        'productCode',
        'batchNo',
        'oldPrice',
        'adjustRatio',
        'newPrice',
        'adjustPrice',
      ],
    );
    expect(columns.find(({ field }) => field === 'productCode')).toBeTruthy();
    expect(columns.find(({ field }) => field === 'productName')).toBeTruthy();
    expect(columns.find(({ field }) => field === 'warehouseId')).toMatchObject({
      slots: { default: 'warehouseId' },
      sortable: true,
      width: 88,
    });
    expect(columns.find(({ field }) => field === 'deptId')).toMatchObject({
      slots: { default: 'deptId' },
      sortable: true,
      width: 88,
    });
    expect(columns.find(({ field }) => field === 'adjustRatio')).toMatchObject({
      slots: { default: 'adjustRatio' },
      sortable: true,
    });
    expect(columns.slice(0, -1).every((column) => !column.fixed)).toBe(true);
    expect(columns.at(-1)).toMatchObject({ fixed: 'right', sortable: false });
  });

  it('uses remark as the only trailing flexible business column', () => {
    const sourceColumns = useFormItemColumns('create', 10) || [];
    const columns = preparePurchaseDocumentItemColumns(sourceColumns as any[], {
      editable: true,
      rows: [{ remark: '很长的采购调价明细备注内容' }],
      trailingFlexibleColumnMinWidth: 150,
    });
    const remark = columns.find(({ field }) => field === 'remark');
    const actions = columns.find(({ field }) => field === 'actions');

    expect(columns.slice(-3).map(({ field }) => field)).toEqual([
      'count',
      'remark',
      'actions',
    ]);
    expect(remark?.width).toBeUndefined();
    expect(Number(remark?.minWidth)).toBeGreaterThanOrEqual(150);
    expect(actions).toMatchObject({ fixed: 'right', width: 70 });
    expect(sourceColumns.find(({ field }) => field === 'remark')).toMatchObject(
      {
        minWidth: 150,
      },
    );

    const hiddenColumns = preparePurchaseDocumentItemColumns(
      useFormItemColumns('create', 10, ['item_remark']) as any[],
      {
        editable: true,
        rows: [],
        trailingFlexibleColumnMinWidth: 150,
      },
    );
    expect(
      hiddenColumns.find(({ field }) => field === 'remark'),
    ).toBeUndefined();
    expect(
      hiddenColumns.find(({ field }) => field === 'count')?.width,
    ).toBeUndefined();
    expect(
      Number(hiddenColumns.find(({ field }) => field === 'count')?.minWidth),
    ).toBeGreaterThanOrEqual(150);
  });

  it('exposes refresh, fullscreen, and column settings tools on the item grid', () => {
    expect(itemFormSource).toContain('fit: false');
    expect(itemFormSource).toContain('fitPurchaseDocumentColumnsToWidth');
    expect(itemFormSource).toContain('queryMethod: handleToolbarRefresh');
    expect(itemFormSource).toContain('zoom: true');
    expect(itemFormSource).toContain('custom: true');
    expect(itemFormSource).toContain('settleVxeColumnCustomization');
    expect(itemFormSource).toContain("tools: 'toolbar-tools'");
    expect(itemFormSource).toContain('<template #toolbar-tools>');
  });

  it('uses explicit list fitting without restoring keyword autofocus', () => {
    expect(indexSource).toContain('fitPurchaseDocumentColumnsToWidth');
    expect(indexSource).toContain('settleVxeColumnCustomization');
    expect(indexSource).toContain('zoom: true');
    expect(indexSource).not.toContain('queueFocusPurchaseKeywordSearchInput');
  });

  it('enables the shared focus style only for editable form modes', () => {
    expect(formSource).toContain(
      "'erp-form-focus-highlight': formType !== 'detail'",
    );
  });

  it('uses decimal text inputs and the unified history shortcut scope', () => {
    expect(itemFormSource).toContain('inputmode="decimal"');
    expect(itemFormSource).not.toContain('<InputNumber');
    expect(itemFormSource).toContain('parseDecimalText');
    expect(itemFormSource).toContain(':sale-history-enabled="true"');
    expect(itemFormSource).toContain(':product-edit-enabled="false"');
    expect(itemFormSource).toContain('<kbd>S</kbd><b>销售历史</b>');
    expect(itemFormSource).toContain('<kbd>Q</kbd><b>报价订单历史</b>');
    for (const source of [purchaseInSelectSource, purchaseInItemSelectSource]) {
      expect(source).toContain('inputmode="decimal"');
      expect(source).not.toContain('<InputNumber');
    }
    expect(purchaseInSelectSource).toContain('parseRatio');
    expect(purchaseInItemSelectSource).toContain('parseNewPrice');
    expect(formSource).toContain('purchaseDecimalMultiply(');
    expect(formSource).not.toContain('Number((calc as number).toFixed(6))');
  });

  it('keeps editable detail actions beside the item grid tools', () => {
    const detailTitleIndex = formSource.indexOf(
      '<span class="purchase-document-section__title">调价明细</span>',
    );
    const itemFormIndex = formSource.indexOf('<ItemForm', detailTitleIndex);
    const toolbarIndex = formSource.indexOf(
      '<template #toolbar>',
      itemFormIndex,
    );

    expect(detailTitleIndex).toBeGreaterThan(-1);
    expect(itemFormIndex).toBeGreaterThan(detailTitleIndex);
    expect(toolbarIndex).toBeGreaterThan(itemFormIndex);
    expect(formSource.slice(detailTitleIndex, itemFormIndex)).not.toContain(
      'purchase-document-section__tools',
    );
    const toolbarSource = formSource.slice(
      toolbarIndex,
      formSource.indexOf('</template>', toolbarIndex),
    );
    expect(toolbarSource).toContain('选择入库单');
    expect(toolbarSource).toContain('导入明细');
    expect(toolbarSource).toContain('添加明细');
    expect(itemFormSource).toContain('<slot name="toolbar"></slot>');
    expect(itemFormSource).toContain('purchase-price-adjust-item-toolbar');
  });

  it('keeps order and detail imports on separate components and endpoints', () => {
    expect(detailImportSource).toContain('importPurchasePriceAdjust(');
    expect(detailImportSource).not.toContain('importPurchasePriceAdjustOrder(');
    expect(orderImportSource).toContain('importPurchasePriceAdjustOrder(');
    expect(orderImportSource).not.toContain('importPurchasePriceAdjust(');
    expect(apiSource).toContain("'/erp/purchase-price-adjust/import'");
    expect(apiSource).toContain("'/erp/purchase-price-adjust/import-order'");
    expect(apiSource).toContain(
      "'/erp/purchase-price-adjust/get-import-template'",
    );
    expect(apiSource).toContain(
      "'/erp/purchase-price-adjust/get-order-import-template'",
    );
  });

  it('preserves imported item remarks without inheriting source document remarks', () => {
    expect(formSource).toContain('remark: item.remark');
    expect(formSource.match(/remark: undefined/g)).toHaveLength(2);
  });

  it('calculates numeric page totals and formats them consistently', () => {
    const rows = [
      { originalTotalPrice: 100.1, totalAdjustPrice: -5 },
      { originalTotalPrice: '20.2' as any, totalAdjustPrice: 2.5 },
    ];
    expect(sumPurchasePriceAdjustAmount(rows, 'originalTotalPrice')).toBe(
      120.3,
    );
    expect(sumPurchasePriceAdjustAmount(rows, 'totalAdjustPrice')).toBe(-2.5);
    expect(formatPurchasePriceAdjustAmount(120.3)).toBe('120.30');
  });

  it('shows batch delete for mixed selections and skips unavailable rows', () => {
    expect(indexSource).toContain('function isPurchasePriceAdjustDeletable(');
    expect(indexSource).toContain(
      'return row.status === 0 || row.status === 10;',
    );
    expect(indexSource).toContain(
      'checkedRows.value.filter((item) => isPurchasePriceAdjustDeletable(item))',
    );
    expect(indexSource).toContain(
      'checkedRows.value.filter((item) => !isPurchasePriceAdjustDeletable(item))',
    );
    expect(indexSource).toContain(
      '.filter((id): id is number => id !== undefined)',
    );
    expect(indexSource).toContain('const ids = deletableCheckedIds.value;');
    expect(indexSource).toContain(
      "message.warning('当前勾选数据没有可删除项');",
    );
    expect(indexSource).toContain('`已删除 ');
    expect(indexSource).toContain(['$', '{ids.length}'].join(''));
    expect(indexSource).toContain(['$', '{skippedCount}'].join(''));
    expect(indexSource).toContain('ifShow: () => checkedIds.length > 0');
    expect(indexSource).toContain(
      'title: `是否删除所选数据？不可删除数据将自动跳过。`',
    );
    expect(indexSource).toContain('confirm: handleBatchDelete');
    expect(indexSource).toContain(
      'ifShow: () => isPurchasePriceAdjustDeletable(row)',
    );
    expect(indexSource).not.toContain('canBatchDelete');
  });
});
