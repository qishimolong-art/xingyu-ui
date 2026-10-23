import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const currentDir = dirname(fileURLToPath(import.meta.url));
const indexSource = readFileSync(join(currentDir, 'index.vue'), 'utf8');
const dataSource = readFileSync(join(currentDir, 'data.ts'), 'utf8');
const formSource = readFileSync(join(currentDir, 'modules/form.vue'), 'utf8');
const itemFormSource = readFileSync(
  join(currentDir, 'modules/item-form.vue'),
  'utf8',
);

describe('stock-in page sales-cart UI contract', () => {
  it('uses a document-workbench column layout for the main list', () => {
    expect(dataSource).toMatch(
      /field: 'printAction',[\s\S]*?title: '打印'[\s\S]*?field: 'printCount',[\s\S]*?title: '打印次数'[\s\S]*?field: 'no',[\s\S]*?title: '单号'[\s\S]*?field: 'supplierName',[\s\S]*?title: '相关对象'[\s\S]*?field: 'warehouseNames',[\s\S]*?title: '仓库'[\s\S]*?field: 'inTime',[\s\S]*?title: '日期'[\s\S]*?field: 'totalPrice',[\s\S]*?title: '总金额'[\s\S]*?field: 'status',[\s\S]*?title: '状态'[\s\S]*?field: 'itemCount',[\s\S]*?title: '项数'[\s\S]*?field: 'remark',[\s\S]*?title: '备注'[\s\S]*?field: 'deptName',[\s\S]*?title: '部门'[\s\S]*?field: 'creatorName',[\s\S]*?title: '制单人'[\s\S]*?field: 'lastPrintTime',[\s\S]*?title: '打印时间'/,
    );
    expect(dataSource).toContain(
      'formatter: ({ row }) => row.itemCount ?? row.items?.length ?? 0',
    );
    expect(dataSource).toMatch(/field: 'productNames',[\s\S]*?visible: false/);
    expect(dataSource).toMatch(/field: 'updateTime',[\s\S]*?visible: false/);
  });

  it('keeps the dense list scrollable with only the operation column fixed', () => {
    expect(dataSource).toContain('autoFixed: false');
    expect(dataSource).not.toContain("fixed: 'left'");
    expect(dataSource).toMatch(
      /title: '操作',[\s\S]*?width: 130,[\s\S]*?fixed: 'right'/,
    );
    expect(indexSource).toContain("showHeaderOverflow: 'tooltip'");
    expect(indexSource).toContain("showOverflow: 'tooltip'");
  });

  it('wires stock-in into the shared print-template flow', () => {
    expect(indexSource).toContain("const PRINT_TEMPLATE_MODULE = 'stock_in'");
    expect(indexSource).toContain("const PRINT_MODULE_NAME = '其它入库单'");
    expect(indexSource).toContain('useErpPrintTemplate');
    expect(indexSource).toContain('PrintTemplateModal');
    expect(indexSource).toContain('PrintTemplateSelector');
    expect(indexSource).toContain("auth: ['erp:stock-in:print-template']");
    expect(indexSource).toContain('v-access:code="[\'erp:stock-in:print\']"');
    expect(indexSource).toContain('@printed="handleRefresh"');
    expect(indexSource).toContain('@click.stop="handlePrint(row)"');
    expect(dataSource).toContain("field: 'printAction'");
  });

  it('uses compact search, Enter submit and explicit dropdown styling', () => {
    expect(indexSource).toContain('commonConfig: { labelWidth: 68 }');
    expect(indexSource).toContain('@keydown.enter.capture="handleSearchEnter"');
    expect(indexSource).toContain('submitSearchFormOnEnterAndBlur');
    expect(dataSource).toContain(
      "popupClassName: 'stock-in-search-select-dropdown'",
    );
  });

  it('uses confirm, cancel-confirm and picking workflow states', () => {
    expect(indexSource).toContain('await confirmStockIn(row.id!)');
    expect(indexSource).toContain('await cancelConfirmStockIn(row.id!)');
    expect(indexSource).toContain("auth: ['erp:stock-in:confirm']");
    expect(indexSource).toContain("auth: ['erp:stock-in:cancel-confirm']");
    expect(dataSource).toContain("fieldName: 'pickStatus'");
    expect(dataSource).toContain("field: 'pickProgress'");
    expect(formSource).toContain('formData.value?.status === 10');
  });

  it('defaults the inbound time only when creating a document', () => {
    expect(formSource).toMatch(
      /if \(!data\?\.id\) \{[\s\S]*?inTime: Date\.now\(\),[\s\S]*?return;[\s\S]*?getStockIn\(data\.id/,
    );
    expect(formSource.match(/inTime: Date\.now\(\)/g)).toHaveLength(1);
  });

  it('renders the document number as a link and skips unavailable batch deletes', () => {
    expect(dataSource).toContain("slots: { default: 'no' }");
    expect(indexSource).toContain('class="stock-in-number-link"');
    expect(indexSource).toMatch(
      /label: '批量删除',[\s\S]*?ifShow: \(\) => batchDeleteAllowed/,
    );
    expect(indexSource).toContain(
      'const batchDeleteAllowed = computed(() => checkedRows.value.length > 0);',
    );
    expect(indexSource).toContain(
      'rows.filter((item) => isDeleteAllowed(item))',
    );
    expect(indexSource).toContain('await deleteStockIn(targetIds)');
    expect(indexSource).toContain('当前勾选数据没有可删除项');
    expect(indexSource).toContain('不可删除数据将自动跳过');
    expect(indexSource).toContain(
      `\`已删除 \${targetIds.length} 条，已跳过 \${skippedCount} 条\``,
    );
    expect(indexSource).toContain('ifShow: () => isDeleteAllowed(row)');
    expect(indexSource).not.toContain(
      'checkedRows.value.every((row) => isDeleteAllowed(row))',
    );
  });

  it('shows page subtotals above a sticky pager', () => {
    expect(indexSource).toContain('StockListQuerySummary');
    expect(indexSource).toContain('<template #bottom>');
    expect(indexSource).toContain(':items="querySummaryItems"');
    expect(indexSource).toContain('@retry="querySummaryState.retry"');
    expect(indexSource).toContain(':deep(.vxe-grid--pager-wrapper)');
  });

  it('keeps fullscreen four-column detail, loading exits and item hydration', () => {
    expect(formSource).toContain(
      "wrapperClass: 'stock-document-basic-grid grid-cols-4'",
    );
    expect(formSource).toContain('modalApi.setState({ fullscreen: true })');
    expect(formSource).toContain(':loading="detailLoading"');
    expect(formSource).toContain(':error="detailLoadError"');
    expect(formSource).toContain(':items="formData?.items ?? EMPTY_ITEMS"');
    expect(itemFormSource).toContain(
      'gridApi.setGridOptions({ data: rows, fit: false });',
    );
    expect(itemFormSource).toContain('await gridApi.grid.loadData(rows)');
    expect(itemFormSource).toContain('immediate: true');
  });

  it('provides stable three-state item sorting and one top add action', () => {
    expect(dataSource).toMatch(/field: 'productId',[\s\S]*?sortable: true/);
    expect(dataSource).toMatch(/field: 'warehouseId',[\s\S]*?sortable: true/);
    expect(dataSource).toMatch(/field: 'count',[\s\S]*?sortable: true/);
    expect(itemFormSource).toContain("orders: ['asc', 'desc', null]");
    expect(itemFormSource).toContain('sortChange: handleItemSortChange');
    expect(itemFormSource).toContain('sortStockInItems');
    expect(dataSource).toMatch(
      /title: '操作',[\s\S]*?fixed: 'right',[\s\S]*?visible: !disabled/,
    );
    expect(itemFormSource.match(/新增行/g)).toHaveLength(1);
    expect(itemFormSource).toContain('批量删除');
    expect(itemFormSource).toContain('<ErpInlineStockSelect');
  });

  it('wires full keyboard entry and stock selector shortcuts', () => {
    expect(formSource).toContain('focusFirstEditableFormControl');
    expect(formSource).toContain('focusNextEditableFormControlOnEnter');
    expect(formSource).toContain('queueFocusFirstBasicFormControl(sequence)');
    expect(formSource).toContain('@keydown.capture="handleBasicFormEnter"');
    expect(formSource).toContain(
      '@request-submit="handleLastInputEnterConfirm"',
    );
    expect(formSource).toContain('void modalApi.onConfirm()');
    expect(formSource).not.toContain('attachStockInputEnterFocus');

    expect(itemFormSource).toContain("'request-submit'");
    expect(itemFormSource).toContain('data-stock-in-count-input="true"');
    expect(itemFormSource).toContain(
      "itemRowFocusController.focus(focusRow, 'count')",
    );
    expect(itemFormSource).toContain(
      ':data-erp-item-row-key="getItemRowKey(row)"',
    );
    expect(itemFormSource).toContain('handleItemInputPressEnter');
    expect(itemFormSource).toContain("enterFocusResult === 'last-input'");
    expect(itemFormSource).toContain("emit('request-submit', event)");
    expect(itemFormSource).toContain('createErpItemRowFocusController');
    expect(itemFormSource).not.toContain(
      '@press-enter="focusNextInputOnEnter"',
    );

    expect(itemFormSource).toContain('<ErpInlineStockSelect');
    expect(itemFormSource).toContain(':stock-page-api="getStockPage"');
    expect(itemFormSource).toContain("bizType: 'stock'");
    expect(itemFormSource).toContain('function handleGlobalInsertShortcut');
    expect(itemFormSource).toContain('void handleAddBlankItemRow();');
    expect(itemFormSource).toContain('warehouseId: product.warehouseId');
    expect(itemFormSource).toContain('batchNo: product.batchNo');
  });

  it('preserves decimal text without a quantity precision cap', () => {
    expect(itemFormSource).toContain(
      "import { useOtherStockDecimalInputs } from '#/views/erp/stock/utils/other-stock-input';",
    );
    expect(itemFormSource).toMatch(
      /:value="decimalValue\(row, 'count'\)"[\s\S]*?inputmode="decimal"/,
    );
  });

  it('keeps supplier and item warehouse selects lazy with current-value hydration', () => {
    expect(dataSource).toMatch(
      /label: '供应商',[\s\S]*?fieldName: 'supplierId',[\s\S]*?component: 'SupplierLazySelect'/,
    );
    expect(formSource).toContain('hydrateStockDocumentFormSelectLabels({');
    expect(formSource).toContain(
      'await applyFormMode(formType.value, formData.value)',
    );
    expect(itemFormSource).toContain('<ErpLazyPageSelect');
    expect(itemFormSource).toContain('getCurrentWarehouseOption(row)');
    expect(itemFormSource).toContain('hydrateMissingWarehouseNamesFromApi');
    expect(itemFormSource).toContain('mergeResolvedStockDocumentOptions');
    expect(itemFormSource).not.toContain('await getWarehouseSimpleList()');
  });
});
