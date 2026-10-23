import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';

import { describe, expect, it } from 'vitest';

import {
  getPurchaseOrderDeptSimplePage,
  getPurchaseOrderSupplierDeptSimplePage,
  getPurchaseOrderUserSimplePage,
  PURCHASE_ORDER_STATUS,
} from '#/api/erp/purchase/order';
import { preparePurchaseDocumentItemColumns } from '#/views/erp/purchase/utils/document-item-table';

import {
  useFormItemColumns,
  useFormSchema,
  useGridColumns,
  useGridFormSchema,
} from './data';

const currentDir = dirname(fileURLToPath(import.meta.url));
const indexSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const orderImportFormSource = readFileSync(
  join(currentDir, 'modules', 'order-import-form.vue'),
  'utf8',
);
const detailImportFormSource = readFileSync(
  join(currentDir, 'modules', 'detail-import-form.vue'),
  'utf8',
);
const purchaseOrderFormSource = readFileSync(
  join(currentDir, 'modules', 'form.vue'),
  'utf8',
);
const purchaseImportResultPanelSource = readFileSync(
  join(currentDir, '../components/PurchaseImportResultPanel.vue'),
  'utf8',
);
const purchaseOrderApiSource = readFileSync(
  join(currentDir, '../../../../api/erp/purchase/order/index.ts'),
  'utf8',
);
const printApiSource = readFileSync(
  join(currentDir, '../../../../api/erp/print/index.ts'),
  'utf8',
);
const purchaseInOrderImportFormSource = readFileSync(
  join(currentDir, '../in/modules/order-import-form.vue'),
  'utf8',
);
const purchaseReturnOrderImportFormSource = readFileSync(
  join(currentDir, '../return/modules/order-import-form.vue'),
  'utf8',
);
const purchaseInvoiceImportFormSource = readFileSync(
  join(currentDir, '../invoice/modules/import-form.vue'),
  'utf8',
);
const purchasePriceAdjustOrderImportFormSource = readFileSync(
  join(currentDir, '../priceadjust/modules/order-import-form.vue'),
  'utf8',
);
const purchaseInApiSource = readFileSync(
  join(currentDir, '../../../../api/erp/purchase/in/index.ts'),
  'utf8',
);
const purchaseReturnApiSource = readFileSync(
  join(currentDir, '../../../../api/erp/purchase/return/index.ts'),
  'utf8',
);
const purchaseInvoiceApiSource = readFileSync(
  join(currentDir, '../../../../api/erp/purchase/invoice/index.ts'),
  'utf8',
);
const purchasePriceAdjustApiSource = readFileSync(
  join(currentDir, '../../../../api/erp/purchase/priceadjust/index.ts'),
  'utf8',
);
const printTemplateSource = readFileSync(
  join(
    currentDir,
    '../../../../../public/static/erp/purchase-print-template.html',
  ),
  'utf8',
);
const printTemplateDemoSource = readFileSync(
  join(
    currentDir,
    '../../../../../public/static/erp/purchase-order-print-template-demo.html',
  ),
  'utf8',
);

function extractPrintValueFormatter(source: string) {
  const start = source.indexOf('      function isAmountPrintFieldCode');
  const end = source.indexOf('      function resolvePrintValue', start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  const context: { result?: (code: string, value: unknown) => unknown } = {};
  new Script(`
    function normalizeFieldCode(code) {
      return String(code || '').trim();
    }
    ${source.slice(start, end)}
    result = formatPrintValue;
  `).runInNewContext(context);
  return context.result!;
}

describe('purchase order page design contract', () => {
  it('preserves the configured list column order without fixed leading columns', () => {
    const columns = useGridColumns() || [];

    expect(columns.map((column) => column.field ?? column.type)).toEqual([
      'checkbox',
      'deleteAction',
      'inAction',
      'printAction',
      'exportAction',
      'no',
      'createTime',
      'continueBuyAction',
      'factoryOrderNo',
      'supplierName',
      'status',
      'inStatus',
      'wechatNotifyAction',
      'orderDate',
      'totalCount',
      'totalProductPrice',
      'depositAction',
      'itemCount',
      'remark',
      'deptName',
      'creatorName',
      'purchaserName',
      'printTime',
      'printFrequency',
      'actions',
    ]);
    expect(columns.slice(0, -1).every((column) => !column.fixed)).toBe(true);
    expect(columns.at(-1)?.fixed).toBe('right');
  });

  it('formats print time through the table date-time formatter', () => {
    const printTimeColumn = (useGridColumns() || []).find(
      (column) => column.field === 'printTime',
    );

    expect(printTimeColumn?.formatter).toBe('formatDateTime');
    expect(printTimeColumn?.slots).toBeUndefined();
    expect(indexSource).not.toContain('<template #printTime');
  });

  it('keeps list columns compact before current-page content expansion', () => {
    const columns = useGridColumns() || [];
    const findColumnWidth = (field: string) =>
      Number(columns.find((column) => column.field === field)?.width ?? 0);

    expect(findColumnWidth('no')).toBeLessThan(180);
    expect(findColumnWidth('factoryOrderNo')).toBeLessThanOrEqual(120);
    expect(findColumnWidth('supplierName')).toBeLessThanOrEqual(130);
    expect(findColumnWidth('createTime')).toBeGreaterThanOrEqual(160);
    expect(findColumnWidth('orderDate')).toBeGreaterThanOrEqual(160);
  });

  it('fills wide screens with the trailing data column and pins operations right', () => {
    const columns = useGridColumns() || [];
    const printFrequencyColumn = columns.find(
      (column) => column.field === 'printFrequency',
    );
    const actionColumn = columns.find((column) => column.field === 'actions');

    expect(printFrequencyColumn?.width).toBeUndefined();
    expect(printFrequencyColumn?.minWidth).toBeGreaterThanOrEqual(72);
    expect(actionColumn).toMatchObject({ fixed: 'right', width: 72 });
    expect(indexSource).toContain(':action-gap="4"');
    expect(indexSource).toContain('icon: ACTION_ICON.EDIT');
    expect(indexSource).toContain('icon: ACTION_ICON.SUBMIT');
    expect(indexSource).toContain('icon: ACTION_ICON.ORDER');
    expect(indexSource).toContain('icon: ACTION_ICON.REVERSE');
    expect(indexSource).toContain(
      'applyPurchaseDocumentListColumnCustomization(',
    );
    expect(indexSource).toContain('fit: true');
    expect(indexSource).toContain('autoResize: true');
    expect(indexSource).toContain('custom: handlePurchaseOrderColumnCustom');
    expect(indexSource).toContain('gridApi.grid?.recalculate?.(true)');
  });

  it('adapts the operation column to visible icon actions and permissions', () => {
    const widthOf = (
      rows: any[],
      permissions = { canEdit: true, canUpdateStatus: true },
    ) =>
      Number(
        (useGridColumns([], rows, permissions) || []).find(
          (column) => column.field === 'actions',
        )?.width ?? 0,
      );

    const noActionWidth = widthOf([
      {
        status: PURCHASE_ORDER_STATUS.APPROVE,
        inCount: 1,
        returnCount: 0,
      },
    ]);
    const draftWidth = widthOf([{ status: PURCHASE_ORDER_STATUS.DRAFT }]);
    const processWidth = widthOf([{ status: PURCHASE_ORDER_STATUS.PROCESS }]);
    const reverseWidth = widthOf([
      {
        status: PURCHASE_ORDER_STATUS.APPROVE,
        inCount: 0,
        returnCount: 0,
      },
    ]);
    const noPermissionWidth = widthOf(
      [{ status: PURCHASE_ORDER_STATUS.DRAFT }],
      { canEdit: false, canUpdateStatus: false },
    );

    expect(noActionWidth).toBe(72);
    expect(draftWidth).toBeGreaterThan(noActionWidth);
    expect(processWidth).toBe(draftWidth);
    expect(reverseWidth).toBeGreaterThanOrEqual(noActionWidth);
    expect(reverseWidth).toBeLessThan(draftWidth);
    expect(noPermissionWidth).toBe(noActionWidth);
  });

  it('waits for column reset before rebuilding list columns', () => {
    expect(indexSource).toContain('settleVxeColumnCustomization(');
    expect(indexSource).toContain("type !== 'reset'");
    expect(indexSource).toContain('preserveRuntimeCustomization');
  });

  it('keeps delete callbacks event-free and refreshes a valid page', () => {
    expect(indexSource).toContain('confirm: () => handleDelete([row.id!])');
    expect(indexSource).toContain(
      `确认删除已选 \${checkedIds.length} 条采购订单吗？`,
    );
    expect(indexSource).not.toContain('confirm: handleDelete.bind');
    expect(indexSource).toContain('resolvePurchaseOrderDeleteError(error)');
    expect(indexSource).toContain('PointerEvent');
    expect(indexSource).toContain("'删除失败，请稍后重试'");
    expect(indexSource).toContain('await refreshActivatedPurchaseOrderPage();');
    expect(indexSource).toContain(
      'const finalPage = Math.min(currentPage, pageCount);',
    );
    expect(indexSource).toContain('checkedRows.value = [];');
  });

  it('guards Insert create by permission and activation loading state', () => {
    expect(indexSource).toContain(
      "hasAccessByCodes(['erp:purchase-order:create'])",
    );
    expect(indexSource).toContain('activationRefreshMaskVisible.value ||');
    expect(indexSource).toContain('usePurchaseShortcut({');
    expect(indexSource).toContain('handleCreate();');
  });

  it('moves flexibility to the preceding permitted data column when needed', () => {
    const columns = useGridColumns(['printFrequency']) || [];
    const printTimeColumn = columns.find(
      (column) => column.field === 'printTime',
    );

    expect(columns.some((column) => column.field === 'printFrequency')).toBe(
      false,
    );
    expect(printTimeColumn?.width).toBeUndefined();
    expect(printTimeColumn?.minWidth).toBeGreaterThanOrEqual(160);
    expect(columns.at(-1)).toMatchObject({
      field: 'actions',
      fixed: 'right',
    });
  });

  it('expands purchase order list columns from current-page content', () => {
    const columns =
      useGridColumns(
        [],
        [
          {
            no: 'CGDD20260916000005',
            createTime: new Date('2026-09-16T17:47:49'),
            factoryOrderNo: 'S260916092564',
            supplierName: '上海孚创实业发展有限公司',
            orderDate: '2026-09-18 09:15:20',
            remark: '这是一条很长的采购订单备注用于验证列表宽度会跟随内容撑开',
            deptName: '兴宇路通',
            creatorName: '王凯虎',
            purchaserName: '何锐冰',
          },
        ],
      ) || [];
    const findColumnWidth = (field: string) =>
      Number(columns.find((column) => column.field === field)?.width ?? 0);

    expect(findColumnWidth('no')).toBeGreaterThanOrEqual(156);
    expect(findColumnWidth('no')).toBeLessThan(190);
    expect(findColumnWidth('factoryOrderNo')).toBeGreaterThanOrEqual(120);
    expect(findColumnWidth('factoryOrderNo')).toBeLessThan(150);
    expect(findColumnWidth('createTime')).toBeGreaterThanOrEqual(160);
    expect(findColumnWidth('orderDate')).toBeGreaterThanOrEqual(160);
    expect(findColumnWidth('supplierName')).toBeGreaterThan(180);
    expect(findColumnWidth('remark')).toBeGreaterThan(260);
  });

  it('sizes the fixed operation column from actions visible on the current page', () => {
    const columns = useGridColumns([], [
      { status: 0 },
      { status: 10 },
      { status: 20, inCount: 0, returnCount: 0 },
    ] as any);
    const actionColumn = columns?.find((column) => column.field === 'actions');

    expect(actionColumn?.fixed).toBe('right');
    expect(Number(actionColumn?.width ?? 0)).toBeGreaterThanOrEqual(72);
    expect(Number(actionColumn?.width ?? 0)).toBeLessThan(130);
  });

  it('keeps detail item columns compact before current-page content expansion', () => {
    const visibleColumns = (useFormItemColumns(true) || []).filter(
      (column) => column.visible !== false,
    );
    const findColumnWidth = (field: string) =>
      Number(
        visibleColumns.find((column) => column.field === field)?.width ?? 0,
      );

    expect(visibleColumns.every((column) => column.width !== undefined)).toBe(
      true,
    );
    expect(findColumnWidth('gift')).toBeLessThanOrEqual(56);
    expect(findColumnWidth('productCode')).toBeLessThanOrEqual(90);
    expect(findColumnWidth('warehouseId')).toBeLessThanOrEqual(90);
    expect(findColumnWidth('deptId')).toBeLessThanOrEqual(90);
    expect(findColumnWidth('productId')).toBeLessThanOrEqual(170);
    expect(findColumnWidth('standard')).toBeLessThanOrEqual(80);
    expect(findColumnWidth('drawingNo')).toBeLessThanOrEqual(70);
    expect(findColumnWidth('factoryCode')).toBeLessThanOrEqual(80);
    expect(findColumnWidth('brand')).toBeLessThanOrEqual(60);
    expect(findColumnWidth('remark')).toBeLessThanOrEqual(100);
  });

  it('expands detail item text columns from current-page business values', () => {
    const sourceColumns = (useFormItemColumns(true) ||
      []) as unknown as Parameters<
      typeof preparePurchaseDocumentItemColumns
    >[0];
    const columns = preparePurchaseDocumentItemColumns(sourceColumns, {
      rows: [
        {
          deptName: '兴宇路通',
          productCode: '147757',
          productName: '美孚速霸每日保护全合成 5W-30 6X4L',
          productPrice: 163.96,
          totalProductPrice: 23_609.59,
          warehouseName: '农科路总仓',
        },
      ],
    });
    const findColumnWidth = (field: string) =>
      Number(columns.find((column) => column.field === field)?.width ?? 0);

    expect(findColumnWidth('productCode')).toBeLessThan(100);
    expect(findColumnWidth('warehouseId')).toBeLessThan(140);
    expect(findColumnWidth('deptId')).toBeLessThan(130);
    expect(findColumnWidth('productId')).toBeGreaterThan(260);
    expect(findColumnWidth('productPrice')).toBeLessThanOrEqual(90);
    expect(findColumnWidth('totalProductPrice')).toBeLessThanOrEqual(90);
  });

  it('reserves enough width for editable detail selector controls', () => {
    const sourceColumns = (useFormItemColumns(false) ||
      []) as unknown as Parameters<
      typeof preparePurchaseDocumentItemColumns
    >[0];
    const columns = preparePurchaseDocumentItemColumns(sourceColumns, {
      editable: true,
      isCellEditable: (field, row) =>
        field === 'deptId' ? !row.productId : true,
      rows: [
        {
          deptName: '兴宇路通',
          productCode: 'C402021198',
          productId: 1,
          productName: '卫斯卡空调滤清器WSC56079/WSC07956',
          warehouseName: '甘孜路通',
        },
      ],
    });
    const findColumnWidth = (field: string) =>
      Number(columns.find((column) => column.field === field)?.width ?? 0);

    expect(findColumnWidth('warehouseId')).toBeGreaterThanOrEqual(136);
    expect(findColumnWidth('warehouseId')).toBeLessThanOrEqual(145);
    expect(findColumnWidth('deptId')).toBeLessThan(130);
    expect(findColumnWidth('productCode')).toBeLessThan(120);
    expect(findColumnWidth('productId')).toBeGreaterThan(260);
  });

  it('makes the last visible business item column flexible without changing fixed operations', () => {
    const sourceColumns = (useFormItemColumns(false) ||
      []) as unknown as Parameters<
      typeof preparePurchaseDocumentItemColumns
    >[0];
    const sourceProductColumn = sourceColumns.find(
      (column) => column.field === 'productId',
    );
    const sourceProductWidth = sourceProductColumn?.width;
    const columns = preparePurchaseDocumentItemColumns(sourceColumns, {
      editable: true,
      rows: [{ remark: '短备注' }],
      trailingFlexibleColumnMinWidth: 150,
    });
    const productColumn = columns.find(
      (column) => column.field === 'productId',
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
      width: 64,
    });
    expect(productColumn?.width).toBeDefined();
    expect(sourceProductColumn?.width).toBe(sourceProductWidth);
    expect(
      sourceColumns.find((column) => column.field === 'remark')?.width,
    ).toBe(90);
  });

  it('uses the previous visible business item column when remark is hidden', () => {
    const sourceColumns = (useFormItemColumns(false, ['item_remark']) ||
      []) as unknown as Parameters<
      typeof preparePurchaseDocumentItemColumns
    >[0];
    const columns = preparePurchaseDocumentItemColumns(sourceColumns, {
      trailingFlexibleColumnMinWidth: 150,
    });
    const brandColumn = columns.find((column) => column.field === 'brand');
    const operationColumn = columns.find(
      (column) => column.slots?.default === 'actions',
    );

    expect(columns.some((column) => column.field === 'remark')).toBe(false);
    expect(brandColumn?.width).toBeUndefined();
    expect(Number(brandColumn?.minWidth ?? 0)).toBeGreaterThanOrEqual(150);
    expect(operationColumn?.fixed).toBe('right');
  });

  it('keeps long remarks wider than the flexible minimum', () => {
    const sourceColumns = (useFormItemColumns(true) ||
      []) as unknown as Parameters<
      typeof preparePurchaseDocumentItemColumns
    >[0];
    const columns = preparePurchaseDocumentItemColumns(sourceColumns, {
      rows: [
        {
          remark:
            '这是一条明显超过最小宽度的采购订单开单备注，用于验证内容计算宽度不会被一百五十像素压缩',
        },
      ],
      trailingFlexibleColumnMinWidth: 150,
    });
    const remarkColumn = columns.find((column) => column.field === 'remark');

    expect(remarkColumn?.width).toBeUndefined();
    expect(Number(remarkColumn?.minWidth ?? 0)).toBeGreaterThan(150);
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
        'purchase-order-search-select-dropdown erp-candidate-focus-popup',
      );
    });
  });

  it('loads order form departments from supplier available departments only', () => {
    const formDeptProps = useFormSchema('create').find(
      (field) => field.fieldName === 'deptId',
    )?.componentProps as Record<string, any>;
    const gridDeptProps = useGridFormSchema().find(
      (field) => field.fieldName === 'deptId',
    )?.componentProps as Record<string, any>;

    expect(formDeptProps.api).toBe(getPurchaseOrderSupplierDeptSimplePage);
    expect(formDeptProps.pageSize).toBe(10);
    expect(formDeptProps.shouldFetch({})).toBe(false);
    expect(formDeptProps.shouldFetch({ supplierId: 1 })).toBe(true);
    expect(gridDeptProps.api).toBe(getPurchaseOrderDeptSimplePage);
    expect(gridDeptProps.pageSize).toBe(10);
    expect(gridDeptProps.labelField).toBe('name');
    expect(gridDeptProps.valueField).toBe('id');
  });

  it('uses paged lazy selectors for database-backed list filters', () => {
    const schema = useGridFormSchema();
    const deptField = schema.find((field) => field.fieldName === 'deptId');
    const purchaserField = schema.find(
      (field) => field.fieldName === 'purchaser',
    );

    expect(deptField?.component).toBe('ErpLazyPageSelect');
    expect(deptField?.componentProps).toMatchObject({
      api: getPurchaseOrderDeptSimplePage,
      labelField: 'name',
      pageSize: 10,
      valueField: 'id',
    });
    expect(purchaserField?.component).toBe('ErpLazyPageSelect');
    expect(purchaserField?.componentProps).toMatchObject({
      api: getPurchaseOrderUserSimplePage,
      labelField: 'nickname',
      pageSize: 10,
      valueField: 'id',
    });
  });

  it('keeps the list dense, searchable, summarized, and sticky', () => {
    expect(indexSource).toContain('@keydown.enter.capture="handleSearchEnter"');
    expect(indexSource).toContain('submitSearchFormOnEnterAndBlur');
    expect(indexSource).toContain('gridApi.formApi.submitForm()');
    expect(indexSource).toContain("showHeaderOverflow: 'tooltip'");
    expect(indexSource).toContain("showOverflow: 'tooltip'");
    expect(indexSource).toContain('<template #bottom>');
    expect(indexSource).toContain('<PurchaseListQuerySummary');
    expect(indexSource).toContain(':items="querySummaryItems"');
    expect(indexSource).toContain('class="purchase-order-bottom-summary"');
    expect(indexSource).toContain('font-size: 12px');
    expect(indexSource).toContain('.vxe-grid--pager-wrapper');
  });

  it('loads the ordinary list without full detail items', () => {
    expect(indexSource.match(/includeItems: false/g)).toHaveLength(3);
  });

  it('shows batch delete for mixed selections and skips unavailable rows', () => {
    expect(indexSource).toContain('function isPurchaseOrderDeletable(');
    expect(indexSource).toContain(
      'return row.status !== PURCHASE_ORDER_STATUS.APPROVE;',
    );
    expect(indexSource).toContain(
      'checkedRows.value.filter((item) => isPurchaseOrderDeletable(item))',
    );
    expect(indexSource).toContain(
      'checkedRows.value.filter((item) => !isPurchaseOrderDeletable(item))',
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
      `title: \`确认删除已选 \${checkedIds.length} 条采购订单吗？不可删除数据将自动跳过。\``,
    );
    expect(indexSource).toContain('confirm: handleBatchDelete');
    expect(indexSource).toContain(
      'ifShow: () => isPurchaseOrderDeletable(row)',
    );
    expect(indexSource).not.toContain('hasApprovedCheckedRows');
    expect(indexSource).not.toContain(
      'checkedIds.length > 0 && !hasApprovedCheckedRows',
    );
    expect(indexSource).not.toContain(
      'disabled: isEmpty(checkedIds) || hasApprovedCheckedRows',
    );
  });

  it('persists user column visibility across tab switches and remounts', () => {
    expect(indexSource).toContain("id: 'erp-purchase-order-list-v4'");
    expect(indexSource).toContain('storage: {');
    expect(indexSource).toContain('visible: true');
    expect(indexSource).toContain(
      'isSameFieldSet(appliedHiddenFields, fields)',
    );
  });

  it('opens the print template designer from toolbar and row print action', () => {
    expect(indexSource).toContain('import PrintTemplateModal');
    expect(indexSource).toContain('import PrintTemplateSelector');
    expect(indexSource).toContain('useErpPrintTemplate');
    expect(indexSource).toContain('PrintTemplateDesignModal');
    expect(indexSource).toContain('handleOpenPrintTemplateDesigner');
    expect(indexSource).toContain('handlePrint.bind(null, row)');
    expect(indexSource).toContain('printTemplateSelectOpen');
    expect(indexSource).toContain('printTemplateOptions');
    expect(indexSource).toContain("auth: ['erp:purchase-order:print']");
    expect(indexSource).toContain(
      "auth: ['erp:purchase-order:print-template']",
    );
    expect(indexSource).toContain('@printed="handleRefresh"');
    expect(indexSource).not.toContain("message.info('打印功能待接入')");
  });

  it('keeps failed purchase order imports actionable inside the import modal', () => {
    expect(purchaseOrderApiSource).toContain('recordId?: number');
    expect(purchaseOrderApiSource).toContain(
      'downloadPurchaseOrderImportFailureDetails',
    );
    expect(purchaseOrderApiSource).toContain(
      '/erp/purchase-order/import-failure-details/download',
    );
    expect(orderImportFormSource).toContain('const importResult');
    expect(orderImportFormSource).toContain('importResult.value = null;');
    expect(orderImportFormSource).toContain('canDownloadFailureDetails');
    expect(orderImportFormSource).toContain('!!importResult.value?.recordId');
    expect(orderImportFormSource).toContain('下载错误数据');
    expect(orderImportFormSource).toContain(
      'downloadPurchaseOrderImportFailureDetails(recordId)',
    );
    expect(orderImportFormSource).toContain('PurchaseImportResultPanel');
    expect(orderImportFormSource).toContain('document-name="采购订单"');
    expect(purchaseImportResultPanelSource).toContain(
      ['部分', '$', '{documentName}', '导入失败'].join(''),
    );
    expect(purchaseImportResultPanelSource).toContain('失败原因');
    expect(purchaseImportResultPanelSource).toContain(
      'failureDetails.slice(0, 10)',
    );
    expect(orderImportFormSource).toContain(
      "{{ importResult ? '关闭' : '开始导入' }}",
    );
    expect(orderImportFormSource).toContain('max-h-[calc(100vh-48px)]');
    expect(orderImportFormSource).toContain('class="top-6');
    expect(orderImportFormSource).toContain('content-class="!min-h-0"');
    expect(orderImportFormSource).toContain('footer-class="flex-wrap gap-2');
    expect(orderImportFormSource).toContain('flex-auto flex-wrap');
    expect(orderImportFormSource).not.toContain('content-class="!flex-none"');
  });

  it('keeps full-order and detail import templates on separate contracts', () => {
    expect(indexSource).toContain(
      "import OrderImportForm from './modules/order-import-form.vue'",
    );
    expect(indexSource).toContain('connectedComponent: OrderImportForm');
    expect(orderImportFormSource).toContain('getPurchaseOrderImportTemplate');
    expect(orderImportFormSource).toContain(
      'importPurchaseOrder(uploadFile.value)',
    );
    expect(orderImportFormSource).toContain("fileName: '采购订单导入模板.xls'");
    expect(orderImportFormSource).toContain('用于批量创建采购订单');
    expect(purchaseOrderApiSource).toContain(
      "'/erp/purchase-order/get-import-template'",
    );

    expect(purchaseOrderFormSource).toContain(
      "import DetailImportForm from './detail-import-form.vue'",
    );
    expect(purchaseOrderFormSource).toContain(
      'connectedComponent: DetailImportForm',
    );
    expect(detailImportFormSource).toContain(
      'getPurchaseOrderDetailImportTemplate',
    );
    expect(detailImportFormSource).toContain(
      'parsePurchaseOrderDetailImportExcel(uploadFile)',
    );
    expect(detailImportFormSource).toContain(
      "fileName: '采购订单明细导入模板.xls'",
    );
    expect(detailImportFormSource).toContain('用于解析当前采购订单的配件行');
    expect(purchaseOrderApiSource).toContain(
      "'/erp/purchase-order/get-detail-import-template'",
    );
  });

  it('keeps all purchase full-order import failures downloadable and contained', () => {
    const cases = [
      {
        apiSource: purchaseOrderApiSource,
        documentName: '采购订单',
        downloadFunction: 'downloadPurchaseOrderImportFailureDetails',
        endpoint: '/erp/purchase-order/import-failure-details/download',
        fallbackName: '采购订单错误数据.xls',
        formSource: orderImportFormSource,
      },
      {
        apiSource: purchaseInApiSource,
        documentName: '采购入库',
        downloadFunction: 'downloadPurchaseInImportFailureDetails',
        endpoint: '/erp/purchase-in/import-failure-details/download',
        fallbackName: '采购入库错误数据.xls',
        formSource: purchaseInOrderImportFormSource,
      },
      {
        apiSource: purchaseReturnApiSource,
        documentName: '采购退货',
        downloadFunction: 'downloadPurchaseReturnImportFailureDetails',
        endpoint: '/erp/purchase-return/import-failure-details/download',
        fallbackName: '采购退货错误数据.xls',
        formSource: purchaseReturnOrderImportFormSource,
      },
      {
        apiSource: purchaseInvoiceApiSource,
        documentName: '采购票据',
        downloadFunction: 'downloadPurchaseInvoiceImportFailureDetails',
        endpoint: '/erp/purchase-invoice/import-failure-details/download',
        fallbackName: '采购票据错误数据.xls',
        formSource: purchaseInvoiceImportFormSource,
      },
      {
        apiSource: purchasePriceAdjustApiSource,
        documentName: '采购调价',
        downloadFunction: 'downloadPurchasePriceAdjustImportFailureDetails',
        endpoint: '/erp/purchase-price-adjust/import-failure-details/download',
        fallbackName: '采购调价错误数据.xls',
        formSource: purchasePriceAdjustOrderImportFormSource,
      },
    ];

    cases.forEach(
      ({
        apiSource,
        documentName,
        downloadFunction,
        endpoint,
        fallbackName,
        formSource,
      }) => {
        expect(apiSource).toContain('recordId?: number');
        expect(apiSource).toContain(downloadFunction);
        expect(apiSource).toContain(endpoint);
        expect(formSource).toContain(
          'const uploadFile = ref<File | null>(null)',
        );
        expect(formSource).toContain('const importResult');
        expect(formSource).toContain('importResult.value = data;');
        expect(formSource).toContain('importResult.value = null;');
        expect(formSource).toContain('canDownloadFailureDetails');
        expect(formSource).toContain('!!importResult.value?.recordId');
        expect(formSource).toContain(`${downloadFunction}(recordId)`);
        expect(formSource).toContain(`fileName: '${fallbackName}'`);
        expect(formSource).toContain('PurchaseImportResultPanel');
        expect(formSource).toContain(`document-name="${documentName}"`);
        expect(formSource).toContain(
          "{{ importResult ? '关闭' : '开始导入' }}",
        );
        expect(formSource).toContain('max-h-[calc(100vh-48px)]');
        expect(formSource).toContain('content-class="!min-h-0"');
        expect(formSource).toContain('footer-class="flex-wrap gap-2');
        expect(formSource).toContain('flex-auto flex-wrap');
        expect(formSource).not.toContain('content-class="!flex-none"');
      },
    );
  });

  it('passes authenticated request context into the static print iframe', () => {
    const modalSource = readFileSync(
      join(currentDir, '../../components/PrintTemplateModal.vue'),
      'utf8',
    );

    expect(modalSource).toContain(
      "import { useAccessStore } from '@vben/stores'",
    );
    expect(modalSource).toContain('function postFrameAuth()');
    expect(modalSource).toContain('moduleKey');
    expect(modalSource).toContain('businessId');
    expect(modalSource).toContain('templateId');
    expect(modalSource).toContain("params.set('templateId'");
    expect(modalSource).toContain('/static/erp/purchase-print-template.html?');
    expect(modalSource).toContain('20261016-first-page-header-pagination');
    expect(modalSource).toContain("source: 'erp-print-template-parent'");
    expect(modalSource).toContain("type: 'auth'");
    expect(modalSource).toContain(
      'payload: buildPrintTemplateAuthPayload(accessStore)',
    );
    expect(modalSource).not.toContain('accessCodes: accessStore.accessCodes');
    expect(modalSource).toContain('if (!accessStore.accessToken) return;');
    expect(modalSource).toContain('watch(');
    expect(modalSource).toContain("event.data?.type === 'ready-for-auth'");
    expect(modalSource).toContain('@load="postFrameAuth"');
    expect(printTemplateSource).toContain('let parentAuth = null');
    expect(printTemplateSource).toContain('function waitForParentAuth');
    expect(printTemplateSource).toContain(
      "throw new Error('登录信息同步失败，请关闭后重新打开打印模板');",
    );
    expect(printTemplateSource).toContain("source: 'erp-print-template'");
    expect(printTemplateSource).toContain("type: 'ready-for-auth'");
    expect(printTemplateSource).toContain('await waitForParentAuth();');
    expect(printTemplateSource).toContain('normalizeAccessStore(parentAuth)');
  });

  it('keeps print mode readonly while design mode can maintain templates', () => {
    expect(printTemplateSource).toContain(
      "const printMode = urlParams.get('mode') === 'print'",
    );
    expect(printTemplateSource).toContain('const designMode = !printMode');
    expect(printTemplateSource).toContain(
      "root.classList.toggle('is-print-mode', printMode)",
    );
    expect(printTemplateSource).toContain(
      '#purchase-print-template-resizable-demo.is-print-mode .field-panel',
    );
    expect(printTemplateSource).toContain(
      '#purchase-print-template-resizable-demo.is-print-mode [data-save-button]',
    );
    expect(printTemplateSource).toContain('is-print-preparing');
    expect(printTemplateSource).toContain('正在生成打印预览');
    expect(printTemplateSource).toContain('function canEditTemplate()');
    expect(printTemplateSource).toContain('if (!canEditTemplate()) return;');
    expect(printTemplateSource).toContain('await loadFieldMetadata();');
    expect(printTemplateSource).toContain('await loadTemplateList();');
  });

  it('supports multiple print templates without changing defaults on save', () => {
    expect(printTemplateSource).toContain('data-template-select');
    expect(printTemplateSource).toContain('data-set-default-button');
    expect(printTemplateSource).toContain(
      "const urlTemplateId = urlParams.get('templateId')",
    );
    expect(printTemplateSource).toContain(
      '/erp/print/template/list?moduleKey=',
    );
    expect(printTemplateSource).toContain('/erp/print/template/get?id=');
    expect(printTemplateSource).toContain(
      '/erp/print/template/set-default?id=',
    );
    expect(printTemplateSource).toContain(
      'async function setCurrentTemplateDefault()',
    );
    expect(printTemplateSource).toContain('defaulted: false');
    expect(printTemplateSource).toContain('await refreshTemplateList();');
  });

  it('deletes only non-default templates when the independent permission is present', () => {
    expect(printApiSource).toContain('export function deletePrintTemplate');
    expect(printApiSource).toContain("'/erp/print/template/delete'");
    expect(printTemplateSource).toContain('data-delete-button');
    expect(printTemplateSource).toContain(
      "const printTemplateDeletePermission = 'erp:print-template:delete'",
    );
    expect(printTemplateSource).toContain('function canDeleteTemplate()');
    expect(printTemplateSource).toContain(
      'accessCodes.includes(printTemplateDeletePermission)',
    );
    expect(printTemplateSource).toContain(
      'async function deleteCurrentTemplate()',
    );
    expect(printTemplateSource).toContain('/erp/print/template/delete?id=');
    expect(printTemplateSource).toContain(
      '默认模板不能删除，请先将其他模板设为默认',
    );
    expect(printTemplateSource).toContain("method: 'DELETE'");
    expect(printTemplateSource).toContain('await loadTemplateList();');
  });

  it('supports whitelisted cell fonts in design, preview, print, and template persistence', () => {
    [printTemplateSource, printTemplateDemoSource].forEach((source) => {
      expect(source).toContain('aria-label="字体"');
      expect(source).toContain('<option value="">默认字体</option>');
      expect(source).toContain('<option value="simsun">宋体</option>');
      expect(source).toContain('<option value="simhei">黑体</option>');
      expect(source).toContain(
        '<option value="microsoft_yahei">微软雅黑</option>',
      );
      expect(source).toContain('<option value="kaiti">楷体</option>');
      expect(source).toContain('<option value="fangsong">仿宋</option>');
      expect(source).toContain('const fontFamilyCssMap = Object.freeze({');
      expect(source).toContain('function normalizeFontFamily(value)');
      expect(source).toContain('function applyCellFontFamily(cell, value)');
      expect(source).toContain('function updateFontFamilySelect()');
      expect(source).toContain("fontFamilies.size > 1 ? '__mixed'");
      expect(source).toContain(
        'fontFamily: normalizeFontFamily(cell.dataset.fontFamily) || undefined',
      );
      expect(source).toContain('applyCellFontFamily(cell, item.fontFamily);');
      expect(source).toContain('function applyFontFamily()');
      expect(source).toContain(
        "fontFamilySelect.addEventListener('change', applyFontFamily)",
      );
      expect(source).toContain('font-family: inherit;');
    });
    expect(printTemplateSource).toContain('/erp/print/font/file?fontFamily=');
    expect(printTemplateSource).toContain(
      'async function ensurePrintFontsLoaded()',
    );
    expect(printTemplateSource).toContain('await ensurePrintFontsLoaded();');
    expect(printTemplateSource).toContain('new FontFace');
    expect(printTemplateSource).toContain('document.fonts.ready');
  });

  it('renders selected cells with a visible bold weight across designer pages', () => {
    [printTemplateSource, printTemplateDemoSource].forEach((source) => {
      expect(source).toMatch(/\.bold\s*\{\s*font-weight:\s*700;/);
      expect(source).toContain("cell.classList.toggle('bold', shouldBold)");
      expect(source).toContain(
        "boldButton.addEventListener('click', toggleBold)",
      );
    });
  });

  it('repeats purchase detail rows when rendering print preview and print output', () => {
    expect(printTemplateSource).toContain('function detailBlocks(data)');
    expect(printTemplateSource).toContain('function buildRenderPlan');
    expect(printTemplateSource).toContain(
      'const items = Array.isArray(printData?.items) ? printData.items : []',
    );
    expect(printTemplateSource).toContain(
      'resolvedCellHtml(source, item, target.itemIndex, options.pageContext)',
    );
    expect(printTemplateSource).toContain('repeatDetailRows: true');
  });

  it('uses one explicit version-two detail table component', () => {
    expect(printTemplateSource).toContain('data-detail-insert');
    expect(printTemplateSource).toContain('data-detail-convert');
    expect(printTemplateSource).toContain('每个模板只能存在一个明细表组件');
    expect(printTemplateSource).toContain('let templateVersion = 2');
    expect(printTemplateSource).toContain('let detailTable = null');
    expect(printTemplateSource).toContain(
      'detailTable: templateVersion >= 2 ? cloneDetailTable() : undefined',
    );
    expect(printTemplateSource).toContain("dataSource: 'items'");
    expect(printTemplateSource).toContain(
      'function insertStandardDetailTable()',
    );
    expect(printTemplateSource).toContain('function confirmDetailConversion()');
    expect(printTemplateSource).toContain('function removeDetailTable()');
  });

  it('guards detail field placement and component structure before save', () => {
    expect(printTemplateSource).toContain(
      'function canPlaceFieldInCell(field, cell)',
    );
    expect(printTemplateSource).toContain(
      'function validateExplicitDetailTable',
    );
    expect(printTemplateSource).toContain('function ensureTemplateCanSave()');
    expect(printTemplateSource).toContain(
      '明细字段只能放在明细表组件的循环体内',
    );
    expect(printTemplateSource).toContain(
      '主表和系统字段不能放在明细表组件的循环体内',
    );
    expect(printTemplateSource).toContain('循环体至少保留一条模板行，不能删除');
    expect(printTemplateSource).toContain(
      '不能合并跨越明细表表头、循环体、表尾或组件边界的单元格',
    );
    expect(printTemplateSource).toContain('adjustDetailTableForRowInsert');
    expect(printTemplateSource).toContain('adjustDetailTableForRowDelete');
    expect(printTemplateSource).toContain('adjustDetailTableForColumnInsert');
    expect(printTemplateSource).toContain('adjustDetailTableForColumnDelete');
  });

  it('keeps version-one inference while version two expands only body rows', () => {
    expect(printTemplateSource).toContain(
      'if (Number(data?.version) >= 2 && data?.detailTable)',
    );
    expect(printTemplateSource).toContain(
      'return table ? [{ start: table.bodyRows.start, end: table.bodyRows.end }] : [];',
    );
    expect(printTemplateSource).toContain(
      'const explicitDetail = Number(data?.version) >= 2',
    );
    expect(printTemplateSource).toContain('emptyDetail: true');
    expect(printTemplateSource).toContain(
      'const explicitBodyCell = explicitDetail && block',
    );
    expect(printTemplateSource).toContain(
      "cellFullyInDetailSection(source, 'body'",
    );
    expect(printTemplateSource).toContain('renderTargets = items.length');
    expect(printTemplateSource).toContain('legacyDetailCandidate()');
    expect(printTemplateSource).toContain('不转换仍可按旧版打印');
  });

  it('keeps formal and demo inline scripts syntactically valid', () => {
    [printTemplateSource, printTemplateDemoSource].forEach((source) => {
      const scripts = [
        ...source.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi),
      ];
      expect(scripts.length).toBeGreaterThan(0);
      scripts.forEach((match) => {
        expect(() => new Script(match[1] || '')).not.toThrow();
      });
    });
  });

  it('formats print amount fields with two decimals like detail tables', () => {
    [printTemplateSource, printTemplateDemoSource].forEach((source) => {
      const formatPrintValue = extractPrintValueFormatter(source);

      expect(formatPrintValue('items.productPrice', '57.821158')).toBe('57.82');
      expect(formatPrintValue('items.totalPrice', '36080.4')).toBe('36080.40');
      expect(formatPrintValue('items.productCostAmount', 204)).toBe('204.00');
      expect(formatPrintValue('document.previousPayable', '-9.5')).toBe(
        '-9.50',
      );
      expect(formatPrintValue('document.totalFreight1', '12')).toBe('12.00');
      expect(formatPrintValue('document.extraFee', '2.5')).toBe('2.50');
      expect(formatPrintValue('document.grossProfit', '18.678')).toBe('18.68');
      expect(formatPrintValue('items.count', '624')).toBe('624');
      expect(formatPrintValue('items.taxPercent', '13')).toBe('13');
      expect(formatPrintValue('items.grossProfitRate', '13')).toBe('13');
      expect(formatPrintValue('document.totalPriceFormatted', '1,234.00')).toBe(
        '1,234.00',
      );
    });
  });

  it('supports mixed text and field placeholders in print template cells', () => {
    expect(printTemplateSource).toContain('let fieldDefinitions = []');
    expect(printTemplateSource).toContain(
      'function cacheFieldDefinitions(metadata)',
    );
    expect(printTemplateSource).toContain(
      'const fallbackFieldCodeByNameMap = {',
    );
    expect(printTemplateSource).toContain("'数量': 'items.count'");
    expect(printTemplateSource).toContain("'合计数量': 'document.totalCount'");
    expect(printTemplateSource).toContain("'总欠款金额': 'document.totalDebt'");
    expect(printTemplateSource).toContain('function fieldCodeByName(name)');
    expect(printTemplateSource).toContain(
      'function resolvePlaceholderCode(raw, placeholderCodes = {})',
    );
    expect(printTemplateSource).toContain(
      'function placeholderCodeMap(html, preferredCodes = {})',
    );
    expect(printTemplateSource).toContain(
      "function cellPlaceholderCodeMap(cell, html = cell?.innerHTML || '')",
    );
    expect(printTemplateSource).toContain(
      'placeholderCodes: cellPlaceholderCodeMap(cell)',
    );
    expect(printTemplateSource).toContain('preferredCodes[name] = code;');
    expect(printTemplateSource).toContain(
      'cell.dataset.placeholderCodes = JSON.stringify(item.placeholderCodes);',
    );
    expect(printTemplateSource).toContain(
      'function renderFieldPlaceholders(html, itemIndex = 0, placeholderCodes = {}, pageContext = null)',
    );
    expect(printTemplateSource).toContain(
      'function stripFieldTokenSpans(html)',
    );
    expect(printTemplateSource).toContain(
      "return normalized.includes('.') || legacyCodeMap[normalized] !== undefined ? normalized : '';",
    );
    expect(printTemplateSource).toContain('if (!code) return match;');
    expect(printTemplateSource).toContain(
      'return stripFieldTokenSpans(rendered);',
    );
    expect(printTemplateSource).toContain(
      'if (name && code) placeholderCodes[name] = code;',
    );
    expect(printTemplateSource).toContain(
      'function syncFieldMetaFromText(cell, value)',
    );
    expect(printTemplateSource).toContain(
      'const matches = Array.from(text.matchAll',
    );
    expect(printTemplateSource).toContain(
      'syncFieldMetaFromText(cell, value);',
    );
    expect(printTemplateSource).toContain('syncFieldMetaFromText(cell, text);');
    expect(printTemplateSource).toContain(
      'renderFieldPlaceholders(html, itemIndex, placeholderCodes, pageContext)',
    );
    expect(printTemplateSource).toContain(
      'source.textContent.trim() !== singleFieldText',
    );
    expect(printTemplateSource).toContain(
      'hasItemPlaceholder(html, item.placeholderCodes || {})',
    );
    expect(printTemplateSource).toContain('await loadFieldMetadata();');
  });

  it('auto-expands preview and print rows for wrapped long field values', () => {
    expect(printTemplateSource).toContain('overflow-wrap: anywhere;');
    expect(printTemplateSource).toContain('white-space: normal;');
    expect(printTemplateSource).toContain('function measureRenderRowHeights');
    expect(printTemplateSource).toContain('cell.dataset.renderRow');
    expect(printTemplateSource).toContain('cell.dataset.renderRowspan');
    expect(printTemplateSource).toContain('autoFitRows: true');
    expect(printTemplateSource).toContain(
      "renderTemplatePages(previewClassName, 'preview-sheet', 'preview-page'",
    );
    expect(printTemplateSource).toContain(
      "renderTemplatePages(printClassName, 'print-sheet', 'print-page'",
    );
    expect(printTemplateSource).toContain('function plannedRowHeight');
    expect(printTemplateSource).toContain(
      'const measurementSheet = renderTemplateSheet',
    );
    expect(printTemplateSource).toContain(
      'paginateDetailRows(data, renderPlan, { ...options, measuredPlanHeights })',
    );
  });

  it('paginates long print detail rows across paper pages', () => {
    expect(printTemplateSource).toContain('function paginateDetailRows');
    expect(printTemplateSource).toContain('function renderTemplatePages');
    expect(printTemplateSource).toContain('function paperContentHeightPx');
    expect(printTemplateSource).toContain(
      'detectDetailHeaderRows(data, renderPlan.blocks)',
    );
    expect(printTemplateSource).toContain(
      'const bottomPlans = renderPlan.rowPlans.filter',
    );
    expect(printTemplateSource).toContain('paginate: true');
    expect(printTemplateSource).toContain('break-after: page;');
    expect(printTemplateSource).toContain('.print-page:last-child');
  });

  it('keeps document headers on page one and repeats only the detail table header', () => {
    expect(printTemplateSource).toContain('function rowHasDetailHeaderBorder');
    expect(printTemplateSource).toContain(
      'return repeatableRows.length ? repeatableRows : [table.headerRows.end]',
    );
    expect(printTemplateSource).toContain(
      'const continuationPagePlans = topPlans.filter',
    );
    expect(printTemplateSource).toContain(
      'createDetailPage([...continuationPagePlans, ...headerPlans], true)',
    );
    expect(printTemplateSource).toContain(
      'options.continuationPage && options.continuationPageRows?.has(parts.row)',
    );
    expect(printTemplateSource).toContain('continuationPage: pageIndex > 0');
  });

  it('resolves current page, total pages, and formatted page text after pagination', () => {
    [printTemplateSource, printTemplateDemoSource].forEach((source) => {
      expect(source).toContain("'当前页': 'print.pageNo'");
      expect(source).toContain("'总页数': 'print.pageCount'");
      expect(source).toContain("'页码': 'print.pageText'");
      expect(source).toContain("normalized === 'print.pageNo'");
      expect(source).toContain("normalized === 'print.pageCount'");
      expect(source).toContain("normalized === 'print.pageText'");
      expect(source).toContain('const pageCount = pages.length;');
      expect(source).toContain(
        'pageContext: { pageNo: pageIndex + 1, pageCount }',
      );
      const placeholderOpen = String.fromCodePoint(36, 123);
      expect(source).toContain(
        [
          '`第',
          placeholderOpen,
          'pageContext.pageNo}页/共',
          placeholderOpen,
          'pageContext.pageCount}页`',
        ].join(''),
      );
    });
  });
});
