<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpFieldConfigApi } from '#/api/erp/config/field';
import type { ErpStockApi } from '#/api/erp/stock/stock';

import { nextTick, onBeforeUnmount, ref, watch } from 'vue';

import { Button, Input, Modal, Select, Space } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { getEffectiveStockSelectPriceFields } from '#/api/erp/config/stock-select-price';
import { getProductBrandSimpleList } from '#/api/erp/product/brand';
import { getStockPage } from '#/api/erp/stock/stock';
import { isFieldHidden } from '#/composables/useFieldPermission';
import { formatStockSelectionPrice } from '#/views/erp/components/stock-product-select-ui';
import {
  buildCustomPriceFieldColumns,
  getProductCustomFieldConfigs,
} from '#/views/erp/product/product/utils/custom-fields';
import { stockNatural } from '#/views/erp/stock/utils/stock-decimal';
import {
  focusFirstEditableInput,
  queueAfterEditableControlRender,
} from '#/views/erp/utils/keyboard';
import { createVxeHeaderSort } from '#/views/erp/utils/vxe-header-sort';

const props = withDefaults(
  defineProps<{
    hiddenFields?: string[];
  }>(),
  {
    hiddenFields: () => [],
  },
);
const emit = defineEmits<{
  success: [rows: ErpStockApi.Stock[]];
}>();
const STOCK_PRICE_MASK = '****';
const CUSTOM_FIELD_PREFIX = 'customFields__';
const STOCK_SELECT_SEARCH_INPUT_SELECTOR = '.vxe-grid--form-wrapper input';
const STOCK_SELECT_GRID_FOCUS_SELECTOR =
  '.vxe-table--main-wrapper .vxe-table--body-wrapper, .vxe-table--body-wrapper:not(.fixed-left--wrapper):not(.fixed-right--wrapper)';
const PRICE_FIELD_KEYS = new Set([
  'backupPrice1',
  'grossProfitRate',
  'lastPurchasePrice',
  'lastSalePrice',
  'minPrice',
  'purchasePrice',
  'referencePrice',
  'retailPrice',
  'salePrice',
  'sharePrice',
  'wholesalePrice',
]);
const PRICE_FIELD_ALIASES: Record<string, string[]> = {
  purchasePrice: ['productPurchasePrice'],
};

const open = ref(false);
const warehouseId = ref<number>();
const activeStockRow = ref<ErpStockApi.Stock>();
const selectedRows = ref<ErpStockApi.Stock[]>([]);
const customPriceFieldConfigs = ref<ErpFieldConfigApi.FieldConfig[]>([]);
const effectivePriceFieldKeys = ref<Set<string>>(new Set());
const activeStockColumnFilters = ref<Record<string, string>>({});
const stockFilterBrandOptions = ref<Array<{ label: string; value: string }>>(
  [],
);
let isKeyboardListening = false;
let shouldFocusStockGridAfterQuery = false;

const STOCK_SORT_FIELD_MAP: Record<string, string> = {
  productCode: 'productCode',
  productName: 'productName',
  unitName: 'unitName',
  warehouseName: 'warehouseName',
  deptName: 'deptName',
  count: 'count',
  occupiedCount: 'occupiedCount',
  pendingInCount: 'pendingInCount',
  availableCount: 'availableCount',
  shelf: 'shelf',
  drawingNo: 'drawingNo',
  factoryCode: 'factoryCode',
  standard: 'standard',
  vehicleModel: 'vehicleModel',
  brand: 'brand',
  originPlace: 'originPlace',
  productPurchasePrice: 'productPurchasePrice',
  salePrice: 'salePrice',
  minPrice: 'minPrice',
  referencePrice: 'referencePrice',
  retailPrice: 'retailPrice',
  lastPurchasePrice: 'lastPurchasePrice',
  grossProfitRate: 'grossProfitRate',
  backupPrice1: 'backupPrice1',
  wholesalePrice: 'wholesalePrice',
  sharePrice: 'sharePrice',
  costPrice: 'costPrice',
  costAmount: 'costAmount',
  featureCode: 'featureCode',
  weight: 'weight',
};
const STOCK_COLUMN_FILTER_FIELDS = new Set([
  'brand',
  'deptName',
  'drawingNo',
  'factoryCode',
  'originPlace',
  'productCode',
  'productName',
  'shelf',
  'standard',
  'vehicleModel',
  'warehouseName',
]);
const STOCK_COLUMN_FILTER_FORM_FIELDS = new Set([
  'brand',
  'drawingNo',
  'factoryCode',
  'originPlace',
  'productCode',
  'productName',
  'shelf',
  'standard',
  'vehicleModel',
]);

const { buildSortParams, handleSortChange, resetSortState, restoreSortState } =
  createVxeHeaderSort(STOCK_SORT_FIELD_MAP, {
    field: 'count',
    order: 'desc',
  });

function getColumnFilterOption(column: any) {
  return column?.filters?.[0];
}

function setColumnFilterVisualState(field: string, value?: string) {
  const column = gridApi.grid?.getColumnByField?.(field);
  const option = getColumnFilterOption(column);
  if (!option) return;
  option.data = value || '';
  option.checked = Boolean(value);
}

async function applyStockColumnFilter(panel: any, column: any) {
  const field = String(column?.field || '');
  const option = getColumnFilterOption(column);
  const value = String(option?.data || '').trim();
  if (!field || !STOCK_COLUMN_FILTER_FIELDS.has(field)) return;
  const next = { ...activeStockColumnFilters.value };
  if (value) next[field] = value;
  else delete next[field];
  activeStockColumnFilters.value = next;
  if (STOCK_COLUMN_FILTER_FORM_FIELDS.has(field)) {
    await gridApi.formApi?.setValues({ [field]: value || undefined });
  }
  shouldFocusStockGridAfterQuery = true;
  panel.changeOption?.(null, Boolean(value), option);
  panel.confirmFilter?.();
}

async function clearStockColumnFilter(panel: any, column: any) {
  const option = getColumnFilterOption(column);
  if (option) option.data = '';
  await applyStockColumnFilter(panel, column);
}

async function clearAllStockConditions() {
  shouldFocusStockGridAfterQuery = true;
  clearSelection();
  activeStockColumnFilters.value = {};
  await gridApi.grid?.clearFilter?.();
  await resetSortState(gridApi);
  await gridApi.formApi?.resetForm();
  await nextTick();
  await gridApi.query();
}

function syncStockColumnFiltersFromForm(formValues: Record<string, any>) {
  const next = { ...activeStockColumnFilters.value };
  for (const field of STOCK_COLUMN_FILTER_FORM_FIELDS) {
    const value = String(formValues[field] || '').trim();
    if (value) next[field] = value;
    else delete next[field];
    setColumnFilterVisualState(field, value);
  }
  activeStockColumnFilters.value = next;
}

function withStockColumnFilter(column: any) {
  const field = String(column?.field || '');
  if (!STOCK_COLUMN_FILTER_FIELDS.has(field)) return column;
  const value = activeStockColumnFilters.value[field] || '';
  return {
    ...column,
    filterMultiple: false,
    filters: [{ checked: Boolean(value), data: value, label: value, value }],
    slots: { ...column.slots, filter: 'stockColumnFilter' },
  };
}

function getPriceFieldKey(field?: string) {
  if (field === 'productPurchasePrice') return 'purchasePrice';
  return field?.startsWith(CUSTOM_FIELD_PREFIX)
    ? field.slice(CUSTOM_FIELD_PREFIX.length)
    : field;
}

function isPriceFieldHidden(fieldKey: string) {
  return (
    isFieldHidden(props.hiddenFields, fieldKey) ||
    isFieldHidden(props.hiddenFields, `select_${fieldKey}`) ||
    isFieldHidden(props.hiddenFields, `select_col_${fieldKey}`) ||
    (PRICE_FIELD_ALIASES[fieldKey] || []).some((alias) =>
      isFieldHidden(props.hiddenFields, alias),
    )
  );
}

function shouldMaskPriceField(field?: string) {
  const fieldKey = getPriceFieldKey(field);
  if (!fieldKey) {
    return false;
  }
  if (isPriceFieldHidden(fieldKey)) {
    return true;
  }
  if (
    PRICE_FIELD_KEYS.has(fieldKey) ||
    field?.startsWith(CUSTOM_FIELD_PREFIX)
  ) {
    return effectivePriceFieldKeys.value.has(fieldKey) === false;
  }
  return false;
}

function getDisplayedPrice(row: ErpStockApi.Stock, field?: string) {
  if (shouldMaskPriceField(field)) {
    return STOCK_PRICE_MASK;
  }
  const fieldKey = getPriceFieldKey(field);
  if (field?.startsWith(CUSTOM_FIELD_PREFIX) && fieldKey) {
    return formatStockSelectionPrice(row.customFields ?? {}, fieldKey);
  }
  return formatStockSelectionPrice(row, field || '');
}

function isVisibleStockSelectElement(element: HTMLElement) {
  if (
    element.closest('[hidden], [aria-hidden="true"]') ||
    element.getClientRects().length === 0
  ) {
    return false;
  }
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

function getActiveStockSelectModalElement() {
  return [
    ...document.querySelectorAll<HTMLElement>(
      '.warehouse-move-stock-select-modal',
    ),
  ].find((value) => isVisibleStockSelectElement(value));
}

function focusFirstStockSelectSearchInput() {
  if (!open.value) {
    return;
  }
  const modalElement = getActiveStockSelectModalElement();
  focusFirstEditableInput(
    modalElement ?? document,
    STOCK_SELECT_SEARCH_INPUT_SELECTOR,
  );
}

function focusStockSelectGrid() {
  if (!open.value) {
    return;
  }
  const modalElement = getActiveStockSelectModalElement();
  const gridFocusElement = (
    modalElement ?? document
  ).querySelector<HTMLElement>(STOCK_SELECT_GRID_FOCUS_SELECTOR);
  if (!gridFocusElement || !isVisibleStockSelectElement(gridFocusElement)) {
    return;
  }
  if (!gridFocusElement.hasAttribute('tabindex')) {
    gridFocusElement.setAttribute('tabindex', '-1');
  }
  gridFocusElement.focus({ preventScroll: true });
}

function useSearchSchema(): VbenFormSchema[] {
  return [
    {
      fieldName: 'keyword',
      label: '关键词',
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder:
          '请输入配件/仓库/仓库部门关键词；多个条件可用逗号、/ 等符号分隔',
      },
    },
    {
      fieldName: 'productCode',
      label: '编码',
      component: 'Input',
      componentProps: { allowClear: true, placeholder: '请输入编码' },
    },
    {
      fieldName: 'productName',
      label: '配件名称',
      component: 'Input',
      componentProps: { allowClear: true, placeholder: '请输入配件名称' },
    },
    {
      fieldName: 'drawingNo',
      label: '图号',
      component: 'Input',
      componentProps: { allowClear: true, placeholder: '请输入图号' },
    },
    {
      fieldName: 'vehicleModel',
      label: '适用车型',
      component: 'Input',
      componentProps: { allowClear: true, placeholder: '请输入适用车型' },
    },
    {
      fieldName: 'shelf',
      label: '货架',
      component: 'Input',
      componentProps: { allowClear: true, placeholder: '请输入货架' },
    },
    {
      fieldName: 'standard',
      label: '规格',
      component: 'Input',
      componentProps: { allowClear: true, placeholder: '请输入规格' },
    },
    {
      fieldName: 'factoryCode',
      label: '厂家编码',
      component: 'Input',
      componentProps: { allowClear: true, placeholder: '请输入厂家编码' },
    },
    {
      fieldName: 'brand',
      label: '品牌',
      component: 'ApiSelect',
      componentProps: {
        api: getProductBrandSimpleList,
        labelField: 'name',
        valueField: 'name',
        allowClear: true,
        showSearch: true,
        optionFilterProp: 'label',
        placeholder: '请选择品牌',
      },
    },
    {
      fieldName: 'originPlace',
      label: '产地',
      component: 'Input',
      componentProps: { allowClear: true, placeholder: '请输入产地' },
    },
  ];
}

function useColumns(): VxeTableGridOptions['columns'] {
  const customPriceColumns = buildCustomPriceFieldColumns(
    customPriceFieldConfigs.value,
    [],
  ).map((column) => ({
    ...column,
    slots: { default: 'stockPrice' },
  }));
  const columns: VxeTableGridOptions['columns'] = [
    { type: 'checkbox', width: 36, autoFixed: false } as any,
    { field: 'productName', title: '配件名称', minWidth: 180 },
    { field: 'productCode', title: '编码', minWidth: 120 },
    { field: 'unitName', title: '单位', minWidth: 80 },
    { field: 'warehouseName', title: '仓库', minWidth: 130 },
    { field: 'deptName', title: '所属部门', minWidth: 120 },
    {
      field: 'count',
      title: '库存数',
      minWidth: 100,
      formatter: ({ cellValue }: any) => stockNatural(cellValue),
    },
    {
      field: 'occupiedCount',
      title: '占用数',
      minWidth: 100,
      formatter: ({ cellValue }: any) => stockNatural(cellValue),
    },
    {
      field: 'pendingInCount',
      title: '未入数',
      minWidth: 100,
      formatter: ({ cellValue }: any) => stockNatural(cellValue),
    },
    {
      field: 'availableCount',
      title: '可用库存',
      minWidth: 110,
      formatter: ({ cellValue }: any) => stockNatural(cellValue),
    },
    { field: 'shelf', title: '货架', minWidth: 110 },
    {
      field: 'productPurchasePrice',
      title: '采购价',
      minWidth: 100,
      slots: { default: 'stockPrice' },
    },
    {
      field: 'salePrice',
      title: '售价',
      minWidth: 100,
      slots: { default: 'stockPrice' },
    },
    {
      field: 'lastSalePrice',
      title: '最后一次销售价',
      minWidth: 130,
      slots: { default: 'stockPrice' },
    },
    {
      field: 'minPrice',
      title: '最低价',
      minWidth: 100,
      slots: { default: 'stockPrice' },
    },
    {
      field: 'referencePrice',
      title: '参考价',
      minWidth: 100,
      slots: { default: 'stockPrice' },
    },
    {
      field: 'retailPrice',
      title: '零售价',
      minWidth: 100,
      slots: { default: 'stockPrice' },
    },
    {
      field: 'lastPurchasePrice',
      title: '最后采购入库价',
      minWidth: 130,
      slots: { default: 'stockPrice' },
    },
    {
      field: 'grossProfitRate',
      title: '毛利率（%）',
      minWidth: 110,
      slots: { default: 'stockPrice' },
    },
    {
      field: 'backupPrice1',
      title: '备用价1',
      minWidth: 100,
      slots: { default: 'stockPrice' },
    },
    {
      field: 'wholesalePrice',
      title: '批发价',
      minWidth: 100,
      slots: { default: 'stockPrice' },
    },
    {
      field: 'sharePrice',
      title: '股份价',
      minWidth: 100,
      slots: { default: 'stockPrice' },
    },
    ...customPriceColumns,
    {
      field: 'costPrice',
      title: '成本单价',
      minWidth: 120,
      slots: { default: 'stockPrice' },
    },
    {
      field: 'costAmount',
      title: '成本金额',
      minWidth: 120,
      slots: { default: 'stockPrice' },
    },
    { field: 'drawingNo', title: '图号', minWidth: 110 },
    { field: 'factoryCode', title: '厂家编码', minWidth: 120 },
    { field: 'standard', title: '规格', minWidth: 110 },
    { field: 'featureCode', title: '特征码', minWidth: 110 },
    { field: 'vehicleModel', title: '适用车型', minWidth: 140 },
    { field: 'brand', title: '品牌', minWidth: 100 },
    { field: 'originPlace', title: '产地', minWidth: 100 },
    {
      field: 'weight',
      title: '单重',
      minWidth: 90,
      formatter: ({ cellValue }: any) => stockNatural(cellValue),
    },
  ];
  return columns?.map((column) => {
    const sortableColumn =
      column.field && STOCK_SORT_FIELD_MAP[String(column.field)]
        ? { ...column, sortable: true }
        : column;
    return withStockColumnFilter(sortableColumn);
  });
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    commonConfig: { labelWidth: 68 },
    schema: useSearchSchema(),
    collapsed: true,
    collapsedRows: 1,
  },
  gridOptions: {
    columns: useColumns(),
    height: '100%',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page, sort, sorts }, formValues) => {
          syncStockColumnFiltersFromForm(formValues);
          return await getStockPage({
            decimalMode: 'string',
            bizType: 'stock',
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
            ...activeStockColumnFilters.value,
            crossDimensionKeyword: true,
            warehouseId: warehouseId.value,
            positiveCountOnly: true,
            orderField: 'count',
            orderDirection: 'desc',
            ...buildSortParams(sorts, sort),
          });
        },
        querySuccess: async () => {
          clearSelection();
          await nextTick();
          setFirstCurrentPageRow();
          const shouldFocusGrid = shouldFocusStockGridAfterQuery || open.value;
          shouldFocusStockGridAfterQuery = false;
          if (shouldFocusGrid) {
            focusStockSelectGrid();
          }
          void restoreSortState(gridApi);
        },
      },
      filter: true,
      sort: true,
    },
    rowConfig: {
      isCurrent: true,
      keyField: 'id',
      isHover: true,
    },
    checkboxConfig: {
      highlight: true,
      range: true,
    },
    toolbarConfig: {
      refresh: true,
      search: true,
    },
    sortConfig: {
      remote: true,
      multiple: false,
      trigger: 'cell',
      orders: ['asc', 'desc', null],
      allowBtn: false,
    },
    filterConfig: {
      remote: true,
    },
  } as VxeTableGridOptions<ErpStockApi.Stock>,
  gridEvents: {
    checkboxAll: ({ records }: { records: ErpStockApi.Stock[] }) => {
      selectedRows.value = records;
      queueAfterEditableControlRender(focusStockSelectGrid);
    },
    checkboxChange: ({ records }: { records: ErpStockApi.Stock[] }) => {
      selectedRows.value = records;
      queueAfterEditableControlRender(focusStockSelectGrid);
    },
    sortChange: (params: any) => {
      shouldFocusStockGridAfterQuery = true;
      return handleSortChange(params);
    },
    cellClick: ({ column, row }: { column: any; row: ErpStockApi.Stock }) => {
      if (column?.type === 'checkbox') {
        return;
      }
      setActiveRow(row);
      gridApi.grid.toggleCheckboxRow(row);
      selectedRows.value = gridApi.grid.getCheckboxRecords();
      queueAfterEditableControlRender(focusStockSelectGrid);
    },
    currentRowChange: ({ row }: { row?: ErpStockApi.Stock }) => {
      activeStockRow.value = row;
    },
  },
});

function clearSelection() {
  selectedRows.value = [];
  activeStockRow.value = undefined;
  gridApi.grid?.clearCurrentRow?.();
  gridApi.grid?.clearCheckboxRow?.();
  gridApi.grid?.clearCheckboxReserve?.();
}

function getStockRowKey(row: ErpStockApi.Stock) {
  return String(
    row.rowKey ??
      [
        row.id,
        row.productId,
        row.warehouseId,
        row.batchNo || '',
        row.deptId || '',
      ].join('_'),
  );
}

function isSameStockRow(left?: ErpStockApi.Stock, right?: ErpStockApi.Stock) {
  return !!left && !!right && getStockRowKey(left) === getStockRowKey(right);
}

function setActiveRow(row?: ErpStockApi.Stock, scroll = false) {
  activeStockRow.value = row;
  if (!row) {
    gridApi.grid?.clearCurrentRow?.();
    return;
  }
  gridApi.grid?.setCurrentRow?.(row);
  if (scroll) {
    void gridApi.grid?.scrollToRow?.(row);
  }
}

function getCurrentPageRows() {
  const grid = gridApi.grid as any;
  const tableData = grid?.getTableData?.();
  const rows: ErpStockApi.Stock[] =
    tableData?.tableData ??
    tableData?.visibleData ??
    tableData?.fullData ??
    grid?.getData?.() ??
    [];
  return rows.filter(Boolean);
}

function getCurrentPageActiveRow() {
  const rows = getCurrentPageRows();
  if (rows.length === 0) {
    return undefined;
  }
  const grid = gridApi.grid as any;
  const currentRow = grid?.getCurrentRecord?.() as
    | ErpStockApi.Stock
    | undefined;
  const activeRow = currentRow ?? activeStockRow.value;
  return rows.find((row) => isSameStockRow(row, activeRow)) ?? rows[0];
}

function setFirstCurrentPageRow() {
  setActiveRow(getCurrentPageRows()[0]);
}

function moveCurrentPageActiveRow(offset: number) {
  const rows = getCurrentPageRows();
  if (rows.length === 0) {
    return false;
  }
  const activeRow = getCurrentPageActiveRow();
  const activeIndex = rows.findIndex((row) => isSameStockRow(row, activeRow));
  const currentIndex = Math.max(activeIndex, 0);
  const nextIndex = (currentIndex + offset + rows.length) % rows.length;
  setActiveRow(rows[nextIndex], true);
  return true;
}

function toggleActiveRowSelection() {
  const row = getCurrentPageActiveRow();
  if (!row) {
    return false;
  }
  setActiveRow(row);
  gridApi.grid?.toggleCheckboxRow?.(row);
  selectedRows.value = gridApi.grid?.getCheckboxRecords?.() ?? [];
  return true;
}

function getStockSelectionPageTarget(direction: -1 | 1) {
  const grid = gridApi.grid as any;
  const pager = grid?.getProxyInfo?.()?.pager;
  const currentPage = Number(pager?.currentPage || 1);
  const pageSize = Number(pager?.pageSize || 0);
  const total = Number(pager?.total || 0);
  if (!pageSize || total <= 0) {
    return;
  }
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const targetPage = currentPage + direction;
  if (targetPage < 1 || targetPage > pageCount) {
    return;
  }
  return targetPage;
}

async function moveStockSelectionPage(targetPage: number) {
  const grid = gridApi.grid as any;
  if (!grid) {
    return;
  }
  if (typeof grid.setCurrentPage === 'function') {
    await grid.setCurrentPage(targetPage);
  } else {
    const pager = grid.getProxyInfo?.()?.pager;
    if (pager) {
      pager.currentPage = targetPage;
    }
  }
  await grid.commitProxy?.('query');
  await nextTick();
  setFirstCurrentPageRow();
  focusStockSelectGrid();
}

async function openModal(params: { warehouseId: number }) {
  warehouseId.value = params.warehouseId;
  open.value = true;
  try {
    const [customFields, effectiveFields, brands] = await Promise.all([
      getProductCustomFieldConfigs(),
      getEffectiveStockSelectPriceFields({ bizType: 'stock' }),
      getProductBrandSimpleList(),
    ]);
    customPriceFieldConfigs.value = customFields;
    effectivePriceFieldKeys.value = new Set(effectiveFields || []);
    stockFilterBrandOptions.value = (brands || []).map((brand: any) => ({
      label: brand.name,
      value: brand.name,
    }));
  } catch {
    customPriceFieldConfigs.value = [];
    effectivePriceFieldKeys.value = new Set();
    stockFilterBrandOptions.value = [];
  }
  gridApi.setGridOptions({ columns: useColumns() || [] });
  clearSelection();
  activeStockColumnFilters.value = {};
  await nextTick();
  await gridApi.grid?.clearFilter?.();
  await resetSortState(gridApi);
  await gridApi.formApi?.resetForm();
  await gridApi.query();
  queueAfterEditableControlRender(focusFirstStockSelectSearchInput);
}

function handleOk() {
  emit('success', selectedRows.value);
  open.value = false;
}

function handleSearchEnter(event: KeyboardEvent) {
  if (
    !open.value ||
    event.defaultPrevented ||
    event.repeat ||
    event.isComposing ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.shiftKey
  ) {
    return;
  }
  const target = event.target;
  if (
    !(target instanceof HTMLInputElement) ||
    target.closest('.ant-picker, .ant-select') ||
    !target.closest('.vxe-grid--form-wrapper')
  ) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  shouldFocusStockGridAfterQuery = true;
  void gridApi.formApi.submitForm();
}

function isInteractiveShortcutTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return Boolean(
    target.closest(
      'input, textarea, select, button, a, [contenteditable="true"], .ant-input, .ant-select, .ant-picker, .ant-checkbox, .vxe-checkbox, .vxe-cell--checkbox',
    ),
  );
}

function isStockSelectionShortcutKey(event: KeyboardEvent) {
  return (
    event.key === 'ArrowUp' ||
    event.key === 'ArrowDown' ||
    event.key === 'ArrowLeft' ||
    event.key === 'ArrowRight' ||
    event.key === 'Insert' ||
    event.code === 'Insert'
  );
}

function handleStockSelectionKeyboardShortcut(event: KeyboardEvent) {
  if (!isStockSelectionShortcutKey(event)) {
    return false;
  }
  if (event.key === 'ArrowUp') {
    return moveCurrentPageActiveRow(-1);
  }
  if (event.key === 'ArrowDown') {
    return moveCurrentPageActiveRow(1);
  }
  if (event.key === 'Insert' || event.code === 'Insert') {
    return toggleActiveRowSelection();
  }
  const direction = event.key === 'ArrowLeft' ? -1 : 1;
  const targetPage = getStockSelectionPageTarget(direction);
  if (!targetPage) {
    return false;
  }
  void moveStockSelectionPage(targetPage);
  return true;
}

function handleEnterConfirm(event: KeyboardEvent) {
  if (
    !open.value ||
    selectedRows.value.length === 0 ||
    event.defaultPrevented ||
    event.repeat ||
    event.isComposing ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.shiftKey ||
    event.key !== 'Enter' ||
    isInteractiveShortcutTarget(event.target)
  ) {
    return;
  }
  event.preventDefault();
  handleOk();
}

function handleStockSelectionKeydown(event: KeyboardEvent) {
  if (
    !open.value ||
    event.defaultPrevented ||
    event.repeat ||
    event.isComposing ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.shiftKey ||
    isInteractiveShortcutTarget(event.target)
  ) {
    handleEnterConfirm(event);
    return;
  }
  if (handleStockSelectionKeyboardShortcut(event)) {
    event.preventDefault();
    event.stopImmediatePropagation();
    return;
  }
  handleEnterConfirm(event);
}

function startKeyboardListening() {
  if (isKeyboardListening) {
    return;
  }
  window.addEventListener('keydown', handleStockSelectionKeydown, true);
  isKeyboardListening = true;
}

function stopKeyboardListening() {
  if (!isKeyboardListening) {
    return;
  }
  window.removeEventListener('keydown', handleStockSelectionKeydown, true);
  isKeyboardListening = false;
}

watch(open, (visible) => {
  if (visible) {
    startKeyboardListening();
  } else {
    stopKeyboardListening();
  }
});

onBeforeUnmount(stopKeyboardListening);

defineExpose({ open: openModal });
</script>

<template>
  <Modal
    v-model:open="open"
    class="!w-[85vw] warehouse-move-stock-select-modal"
    title="选择库存"
    :ok-text="`确定（已选 ${selectedRows.length} 条）`"
    @ok="handleOk"
  >
    <Grid
      class="warehouse-move-stock-grid h-[70vh]"
      table-title="库存列表"
      @keydown.enter.capture="handleSearchEnter"
    >
      <template #stockPrice="{ row, column }">
        <span>{{ getDisplayedPrice(row, column.field) }}</span>
      </template>
      <template #stockColumnFilter="{ column, $panel }">
        <div
          v-if="column.filters?.[0]"
          class="stock-column-filter-panel"
          @click.stop
          @keydown.stop
        >
          <Select
            v-if="column.field === 'brand'"
            v-model:value="column.filters[0].data"
            :options="stockFilterBrandOptions"
            allow-clear
            show-search
            option-filter-prop="label"
            placeholder="请选择品牌"
            @keydown.enter.stop.prevent="applyStockColumnFilter($panel, column)"
          />
          <Input
            v-else
            v-model:value="column.filters[0].data"
            allow-clear
            placeholder="请输入筛选内容"
            @keydown.enter.stop.prevent="applyStockColumnFilter($panel, column)"
          />
          <Space class="stock-column-filter-panel__actions">
            <Button
              size="small"
              @click.stop="clearStockColumnFilter($panel, column)"
            >
              清空本列
            </Button>
            <Button size="small" @click.stop="clearAllStockConditions">
              清空全部
            </Button>
            <Button
              size="small"
              type="primary"
              @click.stop="applyStockColumnFilter($panel, column)"
            >
              筛选
            </Button>
          </Space>
        </div>
      </template>
    </Grid>
  </Modal>
</template>

<style scoped>
:deep(.warehouse-move-stock-grid .vxe-table--render-default),
:deep(.warehouse-move-stock-grid .vxe-grid--form-wrapper),
:deep(.warehouse-move-stock-grid .vxe-grid--form-wrapper .ant-input),
:deep(.warehouse-move-stock-grid .vxe-grid--form-wrapper .ant-btn) {
  font-size: 12px;
}

:deep(
  .warehouse-move-stock-grid .vxe-grid--form-wrapper .ant-input-affix-wrapper
),
:deep(.warehouse-move-stock-grid .vxe-grid--form-wrapper .ant-btn) {
  min-height: 28px;
  font-size: 12px;
}

@media (min-width: 1280px) {
  :deep(.warehouse-move-stock-grid .vxe-grid--form-wrapper form > .grid) {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}

:deep(.warehouse-move-stock-grid .vxe-header--column .vxe-cell--title) {
  white-space: nowrap;
}

:deep(
  .warehouse-move-stock-grid .vxe-header--column.is--sortable .vxe-cell--title
) {
  color: #1677ff;
}

:deep(.warehouse-move-stock-grid .vxe-header--column .vxe-cell--sort > i) {
  opacity: 0.35;
}

:deep(
  .warehouse-move-stock-grid
    .vxe-header--column
    .vxe-cell--sort
    > i.sort--active
) {
  opacity: 1;
}

.stock-column-filter-panel {
  width: 260px;
  padding: 10px;
}

.stock-column-filter-panel :deep(.ant-input),
.stock-column-filter-panel :deep(.ant-select) {
  width: 100%;
}

.stock-column-filter-panel__actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 10px;
}
</style>
