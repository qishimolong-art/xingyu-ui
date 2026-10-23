import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
  getPurchaseReturnDeptSimplePage,
  getPurchaseReturnSupplierDeptSimplePage,
  getPurchaseReturnUserSimplePage,
} from '#/api/erp/purchase/return';
import { preparePurchaseDocumentItemColumns } from '#/views/erp/purchase/utils/document-item-table';
import { applyPurchaseSelectColumnPermission } from '../utils/field-permission';
import {
  useFormItemColumns,
  useFormSchema,
  useGridColumns,
  useGridFormSchema,
} from './data';
import { purchaseInSelectColumns } from './modules/purchase-in-select-columns';

const currentDir = dirname(fileURLToPath(import.meta.url));
const indexSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const formSource = readFileSync(join(currentDir, 'modules/form.vue'), 'utf8');
const itemFormSource = readFileSync(
  join(currentDir, 'modules/item-form.vue'),
  'utf8',
);
const purchaseInSelectSource = readFileSync(
  join(currentDir, 'modules/purchase-in-select.vue'),
  'utf8',
);
const detailImportSource = readFileSync(
  join(currentDir, 'modules/import-form.vue'),
  'utf8',
);
const orderImportSource = readFileSync(
  join(currentDir, 'modules/order-import-form.vue'),
  'utf8',
);
const documentFormStyleSource = readFileSync(
  join(currentDir, '../../styles/form-focus.css'),
  'utf8',
);

describe('purchase return form schema', () => {
  it('uses timestamp values for return time picker', () => {
    const returnTimeSchema = useFormSchema('edit').find(
      (item) => item.fieldName === 'returnTime',
    );

    expect(returnTimeSchema?.componentProps).toMatchObject({
      valueFormat: 'x',
    });
  });

  it('keeps ordinary fields in the four-column grid and sizes item actions to their content', () => {
    const returnModeSchema = useFormSchema('create').find(
      (item) => item.fieldName === 'returnMode',
    );
    const actionColumn = useFormItemColumns([], false)?.find(
      (column) => column.title === '操作',
    );

    expect(returnModeSchema?.formItemClass).toBe('col-span-1');
    expect(actionColumn).toMatchObject({ fixed: 'right', width: 70 });
  });

  it('uses vxe formatters for purchase-in select columns', () => {
    const inTimeColumn = purchaseInSelectColumns?.find(
      (column) => !('children' in column) && column.field === 'inTime',
    );

    expect(inTimeColumn).toMatchObject({
      title: '入库时间',
      field: 'inTime',
      formatter: 'formatDate',
    });
  });

  it('uses radio selection column for purchase-in selection', () => {
    expect(
      purchaseInSelectColumns?.some(
        (column) => !('children' in column) && column.type === 'radio',
      ),
    ).toBe(true);
  });

  it('applies hidden field permissions to purchase-in select columns', () => {
    const columns = applyPurchaseSelectColumnPermission(
      purchaseInSelectColumns || [],
      ['select_supplierName', 'select_col_totalPrice'],
    );

    expect(
      columns.some(
        (column) => !('children' in column) && column.field === 'supplierName',
      ),
    ).toBe(false);
    expect(
      columns.some(
        (column) => !('children' in column) && column.field === 'totalPrice',
      ),
    ).toBe(false);
    expect(
      columns.some(
        (column) => !('children' in column) && column.field === 'no',
      ),
    ).toBe(true);
  });

  it('locks purchase-in selection to the selected supplier', () => {
    expect(formSource).toContain(':supplier-id="formData?.supplierId"');
    expect(purchaseInSelectSource).toContain('supplierId?: number');
    expect(purchaseInSelectSource).toContain(
      'const querySupplierId = props.supplierId ?? formValues.supplierId',
    );
    expect(purchaseInSelectSource).toContain('supplierId: querySupplierId');
    expect(purchaseInSelectSource).toContain('await syncLockedSupplier();');
  });

  it('uses supplier-scoped department paging for the main form', () => {
    const editSchema = useFormSchema('edit');
    const deptProps = editSchema.find((field) => field.fieldName === 'deptId')
      ?.componentProps as Record<string, any>;

    expect(
      editSchema.find((field) => field.fieldName === 'deptId'),
    ).toMatchObject({
      component: 'ErpLazyPageSelect',
      componentProps: {
        api: getPurchaseReturnSupplierDeptSimplePage,
        labelField: 'name',
        valueField: 'id',
      },
    });
    expect(deptProps.shouldFetch({})).toBe(false);
    expect(deptProps.shouldFetch({ supplierId: 100 })).toBe(true);
    expect(
      editSchema.find((field) => field.fieldName === 'handler'),
    ).toMatchObject({
      component: 'ErpLazyPageSelect',
      componentProps: {
        api: getPurchaseReturnUserSimplePage,
        labelField: 'nickname',
        valueField: 'id',
      },
    });
    expect(formSource).toContain('hydratePurchaseDocumentFormSelectLabels(');
    expect(formSource).toContain('buildPurchaseDocumentDetailFormValues(');
    expect(formSource).toContain(
      '{ data: supplierData ?? formData.value, formType: type }',
    );
    expect(formSource).toContain(
      'await applyFormMode(formType.value, formData.value);',
    );
  });

  it('refreshes supplier department options and surfaces backend validation errors', () => {
    expect(formSource).toContain('getPurchaseReturnSupplierDeptSimpleList');
    expect(formSource).toContain(
      'await handleSupplierChange(values.supplierId)',
    );
    expect(formSource).toContain('availableDeptIds.has(selectedDeptId)');
    expect(formSource).toContain('当前部门不在该供应商可用部门范围内，已清空');
    expect(formSource).toContain('showPurchaseFormActionError');
    expect(formSource.match(/showPurchaseFormActionError/g)?.length).toBe(5);
  });
});

describe('purchase return page design contract', () => {
  it('preserves list column order without fixed leading columns', () => {
    const columns = useGridColumns() || [];

    expect(columns.map((column) => column.field ?? column.type)).toEqual([
      'checkbox',
      'deleteAction',
      'printAction',
      'exportAction',
      'no',
      'settlementStatus',
      'returnTime',
      'continueBuyAction',
      'supplierName',
      'itemCount',
      'totalCount',
      'totalPrice',
      'purchaser',
      'status',
      'deptName',
      'remark',
      'creatorName',
      'actions',
    ]);
    expect(columns.slice(0, -1).every((column) => !column.fixed)).toBe(true);
    expect(columns.at(-1)).toMatchObject({ fixed: 'right', width: 72 });
  });

  it('adds the return number search and compact popup class to every selector', () => {
    const schema = useGridFormSchema();
    const selectorFields = schema.filter((field) =>
      [
        'ApiSelect',
        'ApiTreeSelect',
        'ErpLazyPageSelect',
        'Select',
        'SupplierLazySelect',
        'TreeSelect',
      ].includes(String(field.component)),
    );

    expect(schema.some((field) => field.fieldName === 'no')).toBe(true);
    expect(selectorFields.length).toBeGreaterThan(0);
    selectorFields.forEach((field) => {
      expect((field.componentProps as any)?.popupClassName).toBe(
        'purchase-return-search-select-dropdown erp-candidate-focus-popup',
      );
    });
  });

  it('uses paged lazy selectors for database-backed list filters', () => {
    const schema = useGridFormSchema();

    expect(schema.find((field) => field.fieldName === 'deptId')).toMatchObject({
      component: 'ErpLazyPageSelect',
      componentProps: {
        api: getPurchaseReturnDeptSimplePage,
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
          api: getPurchaseReturnUserSimplePage,
          labelField: 'nickname',
          pageSize: 10,
          valueField: 'id',
        },
      });
    }
  });

  it('keeps detail item selectors readonly and hydrates current labels', () => {
    expect(itemFormSource).toContain('getReadonlyWarehouseName(row)');
    expect(itemFormSource).toContain('getReadonlyDeptName(row)');
    expect(itemFormSource).toContain(
      'class="purchase-return-item-readonly-cell"',
    );
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

  it('renders plain product text columns without undeclared grid slots', () => {
    const columns = useFormItemColumns([], false) || [];

    for (const field of [
      'partCode',
      'partName',
      'vehicleModel',
      'originPlace',
    ]) {
      expect(columns.find((column) => column.field === field)).toMatchObject({
        field,
      });
      expect(columns.find((column) => column.field === field)?.slots).toBe(
        undefined,
      );
    }
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
      width: 70,
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
              '这是一条明显超过最小宽度的采购退货备注，用于验证内容计算宽度不会被一百五十像素压缩',
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

  it('keeps the list dense, searchable, summarized, and sticky', () => {
    expect(indexSource).toContain('@keydown.enter.capture="handleSearchEnter"');
    expect(indexSource).toContain('submitSearchFormOnEnterAndBlur');
    expect(indexSource).toContain('gridApi.formApi.submitForm()');
    expect(indexSource).toContain("showHeaderOverflow: 'tooltip'");
    expect(indexSource).toContain("showOverflow: 'tooltip'");
    expect(indexSource).toContain('PurchaseListQuerySummary');
    expect(indexSource).toContain("label: '退货总额'");
    expect(indexSource).toContain(':items="querySummaryItems"');
    expect(indexSource).toContain('...buildSortParams()');
    expect(indexSource).toContain('class="purchase-return-bottom-summary"');
    expect(indexSource).toContain('font-size: 12px');
    expect(indexSource).toContain('.vxe-grid--pager-wrapper');
  });

  it('loads the ordinary list without full detail items', () => {
    expect(indexSource.match(/includeItems: false/g)).toHaveLength(3);
  });

  it('shows batch delete for mixed selections and skips unavailable rows', () => {
    expect(indexSource).toContain('function isPurchaseReturnDeletable(');
    expect(indexSource).toContain(
      'return row.status !== PURCHASE_RETURN_STATUS.APPROVE;',
    );
    expect(indexSource).toContain(
      'checkedRows.value.filter((item) => isPurchaseReturnDeletable(item))',
    );
    expect(indexSource).toContain(
      'checkedRows.value.filter((item) => !isPurchaseReturnDeletable(item))',
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
      [
        'title: `确认删除已选的 ',
        '$',
        '{deletableCheckedIds.length}',
        ' 条可删除数据吗？不可删除数据将自动跳过。`',
      ].join(''),
    );
    expect(indexSource).toContain('confirm: handleBatchDelete');
    expect(indexSource).toContain(
      'ifShow: () => isPurchaseReturnDeletable(row)',
    );
    expect(indexSource).not.toContain('hasApprovedCheckedRows');
    expect(indexSource).not.toContain(
      'checkedIds.length > 0 && !hasApprovedCheckedRows',
    );
    expect(indexSource).not.toContain(
      'disabled: isEmpty(checkedIds) || hasApprovedCheckedRows',
    );
    expect(indexSource).not.toContain('disabled: row.status === 20');
  });

  it('keeps create, edit, copy, and detail on the shared compact document layout', () => {
    expect(formSource).toContain('modalApi.setState({ fullscreen: true })');
    expect(formSource).toContain(
      "'purchase-document-form--editable': formType !== 'detail'",
    );
    expect(formSource).toContain(
      "'purchase-document-form--focus-highlight': formType !== 'detail'",
    );
    expect(formSource).toContain('purchase-document-load-state');
    expect(formSource).toContain('purchase-document-basic-grid grid-cols-4');
    expect(itemFormSource).toContain('preparePurchaseDocumentItemColumns');
    expect(itemFormSource).toContain('purchase-document-item-select-dropdown');
  });

  it('keeps return detail actions in the item table toolbar without a duplicate product detail title', () => {
    const returnDetailTitleIndex = formSource.indexOf(
      '<span class="purchase-document-section__title">退货明细</span>',
    );
    const itemFormIndex = formSource.indexOf('<ItemForm');
    const toolbarIndex = formSource.indexOf('<template #toolbar>');

    expect(returnDetailTitleIndex).toBeGreaterThan(-1);
    expect(itemFormIndex).toBeGreaterThan(returnDetailTitleIndex);
    expect(toolbarIndex).toBeGreaterThan(itemFormIndex);
    expect(
      formSource.slice(returnDetailTitleIndex, itemFormIndex),
    ).not.toContain('purchase-document-section__tools');
    const toolbarSource = formSource.slice(
      toolbarIndex,
      formSource.indexOf('</template>', toolbarIndex),
    );

    expect(toolbarSource).not.toContain('选择库存');
    expect(toolbarSource).toContain('导入明细');
    expect(toolbarSource).toContain('class="purchase-return-detail-action"');
    expect(toolbarSource).toContain('size="small"');
    expect(itemFormSource).toContain(
      "slots: { buttons: 'toolbar-buttons', tools: 'toolbar-tools' }",
    );
    expect(itemFormSource).toContain('<slot name="toolbar"></slot>');
    expect(itemFormSource).toContain('PurchaseInlineStockSelect');
    expect(itemFormSource).toMatch(/>\s*新增行\s*<\/Button>/);
    expect(itemFormSource).toContain('批量删除');
    expect(itemFormSource).toContain('purchase-return-item-toolbar');
    expect(itemFormSource).not.toContain('商品明细');
  });

  it('uses explicit adaptive columns, complete toolbar controls, and layered history shortcuts', () => {
    expect(indexSource).toContain('fitPurchaseDocumentColumnsToWidth');
    expect(indexSource).toContain('settleVxeColumnCustomization');
    expect(indexSource).toContain('custom: true');
    expect(indexSource).toContain('zoom: true');
    expect(indexSource).not.toContain('queueFocusPurchaseKeywordSearchInput');

    expect(itemFormSource).toContain('fitPurchaseDocumentColumnsToWidth');
    expect(itemFormSource).toContain(
      'applyPurchaseDocumentListColumnCustomization',
    );
    expect(itemFormSource).toContain('fit: false');
    expect(itemFormSource).toContain('queryMethod: handleToolbarRefresh');
    expect(itemFormSource).toContain("type !== 'reset'");
    expect(itemFormSource).toContain('<kbd>S</kbd><b>销售历史</b>');
    expect(itemFormSource).toContain('<kbd>Q</kbd><b>报价订单历史</b>');
    expect(itemFormSource).toContain(':sale-history-enabled="true"');
    expect(itemFormSource).toContain('icon: ACTION_ICON.DELETE');
  });

  it('uses decimal text inputs and opt-in focus highlighting only for editable return forms', () => {
    expect(itemFormSource.match(/inputmode="decimal"/g)).toHaveLength(3);
    expect(itemFormSource).toContain('decimals: 6');
    expect(itemFormSource).toContain('{ decimals: 6, min: 0.000001 }');
    expect(itemFormSource).toContain('max: 100');
    expect(itemFormSource).toContain('v-model:value="row.taxPercentText"');
    expect(documentFormStyleSource).toContain(
      '.purchase-document-form--focus-highlight',
    );
    expect(documentFormStyleSource).toContain(
      'background: #eaf3ff !important;',
    );
    expect(documentFormStyleSource).toContain(
      'border-color: var(--erp-form-focus-border, #1677ff) !important;',
    );
    expect(documentFormStyleSource).toContain(
      '0 0 0 2px rgb(22 119 255 / 12%)',
    );
    expect(documentFormStyleSource).toContain('.ant-form-item-has-error');
  });

  it('keeps whole-order and current-form detail imports on separate contracts', () => {
    expect(detailImportSource).toContain(
      'importPurchaseReturn(uploadFile.value)',
    );
    expect(detailImportSource).toContain('getPurchaseReturnImportTemplate()');
    expect(detailImportSource).not.toContain('importPurchaseReturnOrder');
    expect(orderImportSource).toContain(
      'importPurchaseReturnOrder(uploadFile.value)',
    );
    expect(orderImportSource).toContain(
      'getPurchaseReturnOrderImportTemplate()',
    );
    expect(orderImportSource).not.toContain(
      'importPurchaseReturn(uploadFile.value)',
    );
  });
});
