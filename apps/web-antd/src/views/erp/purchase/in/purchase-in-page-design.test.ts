import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  getPurchaseInDeptSimplePage,
  getPurchaseInSupplierDeptSimplePage,
  getPurchaseInUserSimplePage,
} from '#/api/erp/purchase/in';
import { preparePurchaseDocumentItemColumns } from '#/views/erp/purchase/utils/document-item-table';

import {
  useFormItemColumns,
  useFormSchema,
  useGridColumns,
  useGridFormSchema,
  useOrderGridFormSchema,
} from './data';

const currentDir = dirname(fileURLToPath(import.meta.url));
const indexSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const formSource = readFileSync(
  join(currentDir, 'modules', 'form.vue'),
  'utf8',
);
const itemFormSource = readFileSync(
  join(currentDir, 'modules', 'item-form.vue'),
  'utf8',
);
const detailImportSource = readFileSync(
  join(currentDir, 'modules', 'import-form.vue'),
  'utf8',
);
const orderImportSource = readFileSync(
  join(currentDir, 'modules', 'order-import-form.vue'),
  'utf8',
);
const purchaseInApiSource = readFileSync(
  join(
    currentDir,
    '..',
    '..',
    '..',
    '..',
    'api',
    'erp',
    'purchase',
    'in',
    'index.ts',
  ),
  'utf8',
);
const paymentWriteOffTabSource = readFileSync(
  join(currentDir, 'modules', 'payment-writeoff-tab.vue'),
  'utf8',
);
const purchaseOrderSelectSource = readFileSync(
  join(currentDir, 'modules', 'purchase-order-select.vue'),
  'utf8',
);

describe('purchase in page design contract', () => {
  it('preserves the configured list column order without fixed leading columns', () => {
    const columns = useGridColumns() || [];

    expect(columns.map((column) => column.field ?? column.type)).toEqual([
      'checkbox',
      'deleteAction',
      'printAction',
      'exportAction',
      'no',
      'invoiceStatus',
      'adjustStatus',
      'returnStatus',
      'transferOutStatus',
      'paymentStatus',
      'factoryOrderNo',
      'createTime',
      'continueBuyAction',
      'status',
      'supplierName',
      'totalProductPrice',
      'discountPrice',
      'totalPrice',
      'freightType1',
      'totalFreight1',
      'itemCount',
      'totalCount',
      'creatorName',
      'purchaserName',
      'deptName',
      'orderNo',
      'remark',
      'actions',
    ]);
    expect(columns.slice(0, -1).every((column) => !column.fixed)).toBe(true);
    expect(columns.at(-1)?.fixed).toBe('right');
    expect(columns.at(-1)?.width).toBe(128);
  });

  it('expands list number and date columns from current-page content', () => {
    const columns =
      useGridColumns(
        [],
        [
          {
            no: 'CGRK20260916000005',
            factoryOrderNo: 'S260916092564',
            createTime: '2026-09-16 18:02:31',
            supplierName: '上海孚创实业发展有限公司',
            totalProductPrice: 1234.56,
            totalCount: 51,
          },
        ],
      ) || [];
    const widthOf = (field: string) =>
      Number(columns.find((column) => column.field === field)?.width ?? 0);

    expect(widthOf('no')).toBeGreaterThan(150);
    expect(widthOf('no')).toBeLessThan(190);
    expect(widthOf('createTime')).toBeGreaterThanOrEqual(156);
    expect(widthOf('factoryOrderNo')).toBeGreaterThan(120);
    expect(widthOf('supplierName')).toBeGreaterThan(190);
    expect(widthOf('totalCount')).toBeLessThanOrEqual(84);
  });

  it('uses an explicit compact popup class for every search selector', () => {
    const selectorFields = useGridFormSchema().filter((field) =>
      [
        'ApiSelect',
        'ApiTreeSelect',
        'ErpLazyPageSelect',
        'Select',
        'SupplierLazySelect',
        'TreeSelect',
      ].includes(String(field.component)),
    );

    expect(selectorFields.length).toBeGreaterThan(0);
    selectorFields.forEach((field) => {
      expect((field.componentProps as any)?.popupClassName).toBe(
        'purchase-in-search-select-dropdown erp-candidate-focus-popup',
      );
    });
  });

  it('keeps factory order number visible on the form and searchable in the list', () => {
    const createFactoryField = useFormSchema('create').find(
      (field) => field.fieldName === 'factoryOrderNo',
    );
    const detailFactoryField = useFormSchema('detail').find(
      (field) => field.fieldName === 'factoryOrderNo',
    );
    const searchFactoryField = useGridFormSchema().find(
      (field) => field.fieldName === 'factoryOrderNo',
    );
    const basicFields = useFormSchema('create').map((field) => field.fieldName);

    expect(createFactoryField?.label).toBe('厂家单号');
    expect((createFactoryField?.componentProps as any)?.placeholder).toBe(
      '请输入厂家单号',
    );
    expect((createFactoryField?.componentProps as any)?.disabled).toBe(false);
    expect((detailFactoryField?.componentProps as any)?.disabled).toBe(true);
    expect(searchFactoryField?.label).toBe('厂家单号');
    expect((searchFactoryField?.componentProps as any)?.allowClear).toBe(true);
    expect(basicFields.indexOf('orderNo')).toBeLessThan(
      basicFields.indexOf('factoryOrderNo'),
    );
  });

  it('hides legacy fee entry and keeps freight fields adjacent before department', () => {
    const basicFields = useFormSchema('create').map((field) => field.fieldName);

    expect(basicFields).not.toContain('feeAmount');
    expect(basicFields.indexOf('freightType1') + 1).toBe(
      basicFields.indexOf('totalFreight1'),
    );
    expect(basicFields.indexOf('totalFreight1')).toBeLessThan(
      basicFields.indexOf('deptId'),
    );
  });

  it('keeps the list dense, searchable, summarized, and sticky', () => {
    expect(indexSource).toContain('@keydown.enter.capture="handleSearchEnter"');
    expect(indexSource).toContain('submitSearchFormOnEnterAndBlur');
    expect(indexSource).toContain("showHeaderOverflow: 'tooltip'");
    expect(indexSource).toContain("showOverflow: 'tooltip'");
    expect(indexSource).toContain('class="purchase-in-bottom-summary"');
    expect(indexSource).toContain('<PurchaseListQuerySummary');
    expect(indexSource).toContain("label: '含运费合计'");
    expect(indexSource).toContain(':items="querySummaryItems"');
    expect(indexSource).toContain('font-size: 12px');
    expect(indexSource).toContain('.vxe-grid--pager-wrapper');
  });

  it('applies list column settings immediately and keeps operations recognizable', () => {
    expect(indexSource).toContain('handlePurchaseInColumnCustom');
    expect(indexSource).toContain('settleVxeColumnCustomization(');
    expect(indexSource).toContain('custom: handlePurchaseInColumnCustom');
    expect(indexSource).toContain('custom: true');
    expect(indexSource).toContain('zoom: true');
    expect(indexSource).toContain('await gridApi.grid?.recalculate?.(true)');
    expect(indexSource).toContain('icon: ACTION_ICON.EDIT');
    expect(indexSource).toContain('icon: ACTION_ICON.AUDIT');
    expect(indexSource).not.toContain('queueFocusPurchaseKeywordSearchInput');
  });

  it('loads the ordinary list without full detail items', () => {
    expect(indexSource.match(/includeItems: false/g)).toHaveLength(3);
  });

  it('shows batch delete for mixed selections and skips unavailable rows', () => {
    expect(indexSource).toContain('function isPurchaseInDeletable(');
    expect(indexSource).toContain(
      'return row.status !== PURCHASE_IN_STATUS.APPROVE;',
    );
    expect(indexSource).toContain(
      'checkedRows.value.filter((item) => isPurchaseInDeletable(item))',
    );
    expect(indexSource).toContain(
      'checkedRows.value.filter((item) => !isPurchaseInDeletable(item))',
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
      'title: `确认删除已选的 ${' +
        'deletableCheckedIds.length} 条可删除数据吗？不可删除数据将自动跳过。`',
    );
    expect(indexSource).toContain('confirm: handleBatchDelete');
    expect(indexSource).toContain('ifShow: () => isPurchaseInDeletable(row)');
    expect(indexSource).not.toContain('hasApprovedCheckedRows');
    expect(indexSource).not.toContain(
      'checkedIds.length > 0 && !hasApprovedCheckedRows',
    );
    expect(indexSource).not.toContain(
      'disabled: isEmpty(checkedIds) || hasApprovedCheckedRows',
    );
    expect(indexSource).not.toContain('disabled: row.status === 20');
  });

  it('uses the transfer-out business name without changing its permission', () => {
    expect(formSource).toContain('调拨出库');
    expect(formSource).toContain(
      "hasAccessByCodes(['erp:purchase-in:transfer-out'])",
    );
    expect(formSource).toContain('@click="handleOpenTransferOut"');
  });

  it('uses independent business status columns instead of list status dots', () => {
    const columns = useGridColumns() || [];
    const statusColumns = columns.slice(5, 9);

    expect(statusColumns.map((column) => column.field)).toEqual([
      'invoiceStatus',
      'adjustStatus',
      'returnStatus',
      'transferOutStatus',
    ]);
    expect(statusColumns.map((column) => column.title)).toEqual([
      '开票状态',
      '调价状态',
      '退货状态',
      '调拨状态',
    ]);
    expect(statusColumns.every((column) => column.sortable !== true)).toBe(
      true,
    );
    expect(indexSource).not.toContain(
      "import PurchaseInStatusDots from './modules/purchase-in-status-dots.vue'",
    );
    expect(indexSource).not.toContain('<PurchaseInStatusDots :row="row" />');
    expect(indexSource).not.toContain('状态说明');
    expect(indexSource).not.toContain('class="purchase-in-bottom-status-note"');
    expect(indexSource).not.toContain('v-if="row.adjusted" color="blue"');
    expect(indexSource).not.toContain('v-if="row.hasInvoice" color="green"');
    expect(indexSource).toContain('purchase-in-business-status-text');
    expect(indexSource).not.toContain('getInvoiceStatus(row).color');
    expect(indexSource).not.toContain('getAdjustStatus(row).color');
    expect(indexSource).not.toContain('getReturnStatus(row).color');
    expect(indexSource).not.toContain('getTransferOutStatus(row).color');
  });

  it('marks returned purchase-in detail rows next to the item quantity', () => {
    expect(itemFormSource).toContain('function getReturnedCountText');
    expect(itemFormSource).toContain('formatPurchaseDecimal(returnCount)');
    expect(itemFormSource).toContain('v-if="getReturnedCount(row) > 0"');
    expect(itemFormSource).toContain('class="purchase-in-returned-count"');
    expect(itemFormSource).toContain('退：{{ getReturnedCountText(row) }}');
    expect(itemFormSource).toContain('.purchase-in-returned-count');
  });

  it('uses sale-out style original and adjusted price markers in detail rows', () => {
    expect(itemFormSource).toMatch(
      /原：\{\{\s*formatPurchaseDecimal\(row\.originalProductPrice, '-'\)\s*\}\}/,
    );
    expect(itemFormSource).toContain(
      "【调：{{ formatPurchaseDecimal(row.productPrice, '-') }}】",
    );
    expect(itemFormSource).not.toContain('原单价：');
  });

  it('places remark after the amount columns and before fixed operations', () => {
    const columns = useFormItemColumns([], false) || [];
    const visibleColumnKeys = columns
      .filter((column) => column.visible !== false)
      .map((column) => column.field ?? column.slots?.default ?? column.type);

    expect(visibleColumnKeys.slice(-3)).toEqual([
      'totalPrice',
      'remark',
      'actions',
    ]);
  });

  it('makes only the trailing remark flexible without changing fixed operations or source columns', () => {
    const sourceColumns = (useFormItemColumns([], false) ||
      []) as unknown as Parameters<
      typeof preparePurchaseDocumentItemColumns
    >[0];
    const sourceTotalPriceColumn = sourceColumns.find(
      (column) => column.field === 'totalPrice',
    );
    const sourceTotalPriceMinWidth = sourceTotalPriceColumn?.minWidth;
    const columns = preparePurchaseDocumentItemColumns(sourceColumns, {
      editable: true,
      rows: [{ remark: '短备注', totalPrice: 4.58 }],
      trailingFlexibleColumnMinWidth: 150,
    });
    const totalPriceColumn = columns.find(
      (column) => column.field === 'totalPrice',
    );
    const remarkColumn = columns.find((column) => column.field === 'remark');
    const operationColumn = columns.find(
      (column) => column.slots?.default === 'actions',
    );

    expect(remarkColumn?.width).toBeUndefined();
    expect(Number(remarkColumn?.minWidth ?? 0)).toBeGreaterThanOrEqual(150);
    expect(operationColumn).toMatchObject({
      fixed: 'right',
      sortable: false,
      width: 76,
    });
    expect(totalPriceColumn?.width).toBeDefined();
    expect(sourceTotalPriceColumn?.minWidth).toBe(sourceTotalPriceMinWidth);
    expect(
      sourceColumns.find((column) => column.field === 'remark')?.minWidth,
    ).toBe(150);
  });

  it('lets total amount take over when remark is hidden and preserves long remark width', () => {
    const hiddenRemarkColumns = (useFormItemColumns([], false, [
      'item_remark',
    ]) || []) as unknown as Parameters<
      typeof preparePurchaseDocumentItemColumns
    >[0];
    const hiddenColumns = preparePurchaseDocumentItemColumns(
      hiddenRemarkColumns,
      { trailingFlexibleColumnMinWidth: 150 },
    );
    const totalPriceColumn = hiddenColumns.find(
      (column) => column.field === 'totalPrice',
    );

    expect(hiddenColumns.some((column) => column.field === 'remark')).toBe(
      false,
    );
    expect(totalPriceColumn?.width).toBeUndefined();
    expect(Number(totalPriceColumn?.minWidth ?? 0)).toBeGreaterThanOrEqual(150);

    const longRemarkColumns = preparePurchaseDocumentItemColumns(
      (useFormItemColumns([], true) || []) as unknown as Parameters<
        typeof preparePurchaseDocumentItemColumns
      >[0],
      {
        rows: [
          {
            remark:
              '这是一条明显超过最小宽度的采购入库备注，用于验证内容计算宽度不会被一百五十像素压缩',
          },
        ],
        trailingFlexibleColumnMinWidth: 150,
      },
    );
    const longRemarkColumn = longRemarkColumns.find(
      (column) => column.field === 'remark',
    );

    expect(longRemarkColumn?.width).toBeUndefined();
    expect(Number(longRemarkColumn?.minWidth ?? 0)).toBeGreaterThan(150);
  });

  it('maps purchase in business statuses to readable list labels', () => {
    expect(indexSource).toContain("text: '未开票'");
    expect(indexSource).toContain("text: '已开票'");
    expect(indexSource).toContain("text: '未调价'");
    expect(indexSource).toContain("text: '部分调价'");
    expect(indexSource).toContain("text: '已调价'");
    expect(indexSource).toContain("text: '未退货'");
    expect(indexSource).toContain("text: '部分退货'");
    expect(indexSource).toContain("text: '已退货'");
    expect(indexSource).toContain("text: '未调拨'");
    expect(indexSource).toContain("text: '部分调拨'");
    expect(indexSource).toContain("text: '已调拨'");
  });

  it('renders purchase in business statuses as plain text with color only for meaningful states', () => {
    expect(indexSource).toContain("{ text: '未开票', tone: 'none' }");
    expect(indexSource).toContain("{ text: '未调价', tone: 'none' }");
    expect(indexSource).toContain("{ text: '未退货', tone: 'none' }");
    expect(indexSource).toContain("{ text: '未调拨', tone: 'none' }");
    expect(indexSource).toContain(
      '.purchase-in-business-status-text--invoice-done',
    );
    expect(indexSource).toContain(
      '.purchase-in-business-status-text--adjust-done',
    );
    expect(indexSource).toContain(
      '.purchase-in-business-status-text--return-done',
    );
    expect(indexSource).toContain(
      '.purchase-in-business-status-text--transfer-done',
    );
    expect(indexSource).toContain('.purchase-in-business-status-text--partial');
  });

  it('shows and refreshes linked business status only in detail mode', () => {
    expect(formSource).toContain('class="purchase-in-business-status"');
    expect(formSource).toContain(
      '<PurchaseInStatusDots :row="formData" mode="detail" />',
    );
    expect(formSource).toContain('handleLinkedBusinessSuccess');
    expect(formSource).toContain('@success="handleLinkedBusinessSuccess"');
  });

  it('renders purchase in detail with a lazy payment writeoff tab', () => {
    expect(formSource).toContain('PaymentWriteOffTab');
    expect(formSource).toContain('tab="单据详情"');
    expect(formSource).toContain('tab="付款核销"');
    expect(formSource).toContain(
      "hasAccessByCodes(['erp:finance-payment:query'])",
    );
    expect(formSource).toContain(
      ':active="detailActiveTab === PAYMENT_TAB_KEY"',
    );
    expect(formSource).toContain(
      ':can-view-payment-items="canViewFinancePaymentItems"',
    );
    expect(formSource).toContain(':reload-key="paymentTabReloadKey"');
  });

  it('keeps payment item permission and lazy loading inside the payment tab', () => {
    expect(paymentWriteOffTabSource).toContain('getPurchaseInPaymentSummary');
    expect(paymentWriteOffTabSource).toContain(
      'getFinancePaymentWriteOffItems',
    );
    expect(paymentWriteOffTabSource).toContain(
      'if (!props.canViewPaymentItems)',
    );
    expect(paymentWriteOffTabSource).toContain('无付款单查询权限');
    expect(paymentWriteOffTabSource).toContain('已核销金额');
    expect(paymentWriteOffTabSource).toContain('PURCHASE_IN_BIZ_TYPE = 11');
  });

  it('requires supplier before selecting a source purchase document', () => {
    const basicFields = useFormSchema('create').map((field) => field.fieldName);

    expect(basicFields.indexOf('supplierId')).toBeLessThan(
      basicFields.indexOf('orderNo'),
    );
    expect(formSource).toContain(':supplier-id="formData?.supplierId"');
    expect(formSource).toContain("changedFields.includes('supplierId')");
    expect(formSource).toContain('formData.value.orderId = undefined');
    expect(purchaseOrderSelectSource).toContain('supplierId: {');
    expect(purchaseOrderSelectSource).toContain(
      "message.warning('请先选择供应商')",
    );
    expect(purchaseOrderSelectSource).toContain(
      'const querySupplierId = props.supplierId ?? formValues.supplierId',
    );
    expect(purchaseOrderSelectSource).toContain('supplierId: querySupplierId');
    expect(
      (
        useOrderGridFormSchema({ supplierLocked: true }).find(
          (schema) => schema.fieldName === 'supplierId',
        )?.componentProps as any
      )?.disabled,
    ).toBe(true);
  });

  it('uses supplier-scoped departments on the form while keeping list filter global', () => {
    const formDeptField = useFormSchema('create').find(
      (field) => field.fieldName === 'deptId',
    );
    const gridDeptField = useGridFormSchema().find(
      (field) => field.fieldName === 'deptId',
    );

    expect((formDeptField?.componentProps as any)?.api).toBe(
      getPurchaseInSupplierDeptSimplePage,
    );
    expect((formDeptField?.componentProps as any)?.pageSize).toBe(10);
    expect((formDeptField?.componentProps as any)?.shouldFetch?.({})).toBe(
      false,
    );
    expect(
      (formDeptField?.componentProps as any)?.shouldFetch?.({ supplierId: 1 }),
    ).toBe(true);
    expect(gridDeptField?.component).toBe('ErpLazyPageSelect');
    expect((gridDeptField?.componentProps as any)?.api).toBe(
      getPurchaseInDeptSimplePage,
    );
    expect((gridDeptField?.componentProps as any)?.pageSize).toBe(10);
  });

  it('uses paged lazy selectors for database-backed list filters', () => {
    const schema = useGridFormSchema();

    expect(schema.find((field) => field.fieldName === 'deptId')).toMatchObject({
      component: 'ErpLazyPageSelect',
      componentProps: {
        api: getPurchaseInDeptSimplePage,
        labelField: 'name',
        pageSize: 10,
        valueField: 'id',
      },
    });
    for (const fieldName of ['purchaser', 'handler']) {
      expect(
        schema.find((field) => field.fieldName === fieldName),
      ).toMatchObject({
        component: 'ErpLazyPageSelect',
        componentProps: {
          api: getPurchaseInUserSimplePage,
          labelField: 'nickname',
          pageSize: 10,
          valueField: 'id',
        },
      });
    }
  });

  it('fills purchase in header fields from selected purchase order', () => {
    expect(formSource).toContain('factoryOrderNo: sourceOrder.factoryOrderNo');
    expect(formSource).toContain('deptId: sourceOrder.deptId');
    expect(formSource).toContain('feeAmount: 0');
    expect(formSource).toContain('otherPrice: 0');
    expect(formSource).not.toContain(
      'feeAmount: getFeeAmountFallback(sourceOrder as any)',
    );
    expect(formSource).toContain('remark: sourceOrder.remark');
    expect(formSource).toContain('formApi.setValues(formData.value, false)');
  });

  it('keeps detail item selectors readonly and hydrates current labels', () => {
    expect(itemFormSource).toContain('getReadonlyWarehouseName(row)');
    expect(itemFormSource).toContain('getReadonlyDeptName(row)');
    expect(itemFormSource).toContain('class="purchase-in-item-readonly-cell"');
    expect(itemFormSource).toMatch(/<ErpLazyPageSelect\s+v-else/);
    expect(itemFormSource).toContain(
      'function hydrateMissingCurrentSelectLabels',
    );
    expect(itemFormSource).toContain('getWarehouse(id).catch(() => undefined)');
    expect(itemFormSource).toContain('getDept(id).catch(() => undefined)');
    expect(itemFormSource).toContain(
      "const CURRENT_SELECT_LABEL_PLACEHOLDER = '加载中...';",
    );
    expect(itemFormSource).toContain('function isResolvedSelectOption');
    expect(itemFormSource).toContain(
      '(oldOptions || []).filter(isResolvedSelectOption)',
    );
    expect(itemFormSource).toContain(
      '(nextOptions || []).filter(isResolvedSelectOption)',
    );
    expect(itemFormSource).toContain(
      'value === CURRENT_SELECT_LABEL_PLACEHOLDER',
    );
    expect(itemFormSource).toContain("existed?.name ||\n    '-'");
    expect(itemFormSource).not.toContain(
      'name: row.warehouseName || row.warehouseNameLabel || row.warehouseId',
    );
    expect(itemFormSource).not.toContain(
      'name: row.deptName || row.warehouseDeptName || row.deptId',
    );
    expect(itemFormSource).toContain(
      'await refreshItemGrid({ reloadData: false });',
    );
    expect(itemFormSource).toContain(':rows="displayTableData"');
  });

  it('uses text numeric inputs and complete item table tools and shortcuts', () => {
    expect(itemFormSource).toContain('inputmode="decimal"');
    expect(itemFormSource).toContain('v-model:value="row.priceText"');
    expect(itemFormSource).toContain('v-model:value="row.wholeQtyText"');
    expect(itemFormSource).toContain('v-model:value="row.taxPercentText"');
    expect(itemFormSource).not.toContain('<InputNumber');
    expect(itemFormSource).toContain('custom: true');
    expect(itemFormSource).toContain('queryMethod: handleToolbarRefresh');
    expect(itemFormSource).toContain('zoom: true');
    expect(itemFormSource).toContain('settleVxeColumnCustomization(');
    expect(itemFormSource).toContain(
      'applyPurchaseDocumentListColumnCustomization',
    );
    expect(itemFormSource).toContain('class="purchase-in-item-row-action"');
    expect(itemFormSource).toContain('<kbd>S</kbd><b>销售历史</b>');
    expect(itemFormSource).toContain('<kbd>Q</kbd><b>报价订单历史</b>');
    expect(itemFormSource).toContain(':sale-history-enabled="true"');
    expect(itemFormSource).toContain('icon: ACTION_ICON.DELETE');
  });

  it('keeps full-order and detail import contracts strictly separated', () => {
    expect(orderImportSource).toContain('importPurchaseInOrder');
    expect(orderImportSource).toContain('getPurchaseInOrderImportTemplate');
    expect(orderImportSource).toContain("fileName: '采购入库导入模板.xls'");
    expect(orderImportSource).toContain('用于批量创建采购入库单');
    expect(detailImportSource).toContain('importPurchaseIn');
    expect(detailImportSource).toContain('getPurchaseInImportTemplate');
    expect(detailImportSource).toContain(
      "fileName: '采购入库明细导入模板.xls'",
    );
    expect(purchaseInApiSource).toContain("'/erp/purchase-in/import-order'");
    expect(purchaseInApiSource).toContain("'/erp/purchase-in/import'");
  });
});
