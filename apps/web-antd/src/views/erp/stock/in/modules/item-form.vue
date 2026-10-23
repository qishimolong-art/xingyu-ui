<script lang="ts" setup>
import DecimalAmountInput from '#/views/erp/components/DecimalAmountInput.vue';
import type { StockInItemSortOrder } from './stock-in-item-sort';

import type { ErpStockInApi } from '#/api/erp/stock/in';
import type { ErpStockApi } from '#/api/erp/stock/stock';

/* eslint-disable vue/custom-event-name-casing -- Preserve existing stock form events. */
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  provide,
  ref,
  watch,
} from 'vue';

import { useAccess } from '@vben/access';
import { useVbenModal } from '@vben/common-ui';

import { Button, Input, message, Modal, Pagination } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import { getStockCount, getStockPage } from '#/api/erp/stock/stock';
import {
  getWarehouse,
  getWarehouseSimplePage,
} from '#/api/erp/stock/warehouse';
import { isFieldHidden } from '#/composables/useFieldPermission';
import ErpInlineStockSelect from '#/views/erp/components/ErpInlineStockSelect.vue';
import ErpLazyPageSelect from '#/views/erp/components/ErpLazyPageSelect.vue';
import ItemPriceReferenceOverlay from '#/views/erp/components/ItemPriceReferenceOverlay.vue';
import StockBatchUpdateItemsForm from '#/views/erp/stock/components/stock-batch-update-items-form.vue';
import StockItemDetailActions from '#/views/erp/stock/components/StockItemDetailActions.vue';
import { useStockDocumentColumns } from '#/views/erp/stock/utils/document-columns';
import {
  CURRENT_SELECT_LABEL_PLACEHOLDER,
  isMissingStockDocumentDisplayName,
  isResolvedStockDocumentOption,
  mergeResolvedStockDocumentOptions,
  mergeStockDocumentOption,
} from '#/views/erp/stock/utils/document-form-ui';
import { prepareStockDocumentItemColumns } from '#/views/erp/stock/utils/document-item-table';
import { formatStockNaturalNumber } from '#/views/erp/stock/utils/document-number';
import { createStockItemClientRowKeyManager } from '#/views/erp/stock/utils/item-row-key';
import { useOtherStockDecimalInputs } from '#/views/erp/stock/utils/other-stock-input';
import { stockDecimal } from '#/views/erp/stock/utils/stock-decimal';
import {
  stockMoney as erpPriceInputFormatter,
  stockMultiply as erpPriceMultiply,
} from '#/views/erp/stock/utils/stock-decimal';
import { CANDIDATE_FOCUS_KEY } from '#/views/erp/utils/candidate-focus';
import {
  createErpItemRowFocusController,
  focusEditableInputByRowKey,
} from '#/views/erp/utils/item-row-focus';
import {
  focusFirstEditableInput,
  focusNextInputOnEnter,
  hasOpenFormControlPopup,
  isCreateShortcutKey,
} from '#/views/erp/utils/keyboard';
import {
  copyPriceReferenceFields,
  useItemPriceReferenceShortcut,
} from '#/views/erp/utils/price-reference';

import { useFormItemColumns } from '../data';
import { sortStockInItems } from './stock-in-item-sort';

const props = withDefaults(defineProps<Props>(), {
  items: () => [],
  beforeBatchWarehouseUpdate: undefined,
  deptId: undefined,
  enabled: true,
  disabled: false,
  enableBatchEdit: false,
  hiddenFields: () => [],
  inId: undefined,
  itemPageLoading: false,
  itemPagination: () => ({
    orderDirection: undefined,
    orderField: undefined,
    pageNo: 1,
    pageSize: 10,
    total: 0,
  }),
  remotePaging: false,
});

const emit = defineEmits([
  'refresh-items',
  'append-items',
  'batch-update-success',
  'page-change',
  'request-submit',
  'update:items',
]);

provide(CANDIDATE_FOCUS_KEY, ref(true));

interface Props {
  deptId?: number;
  enabled?: boolean;
  beforeBatchWarehouseUpdate?: (
    rows: ErpStockInApi.StockInItem[],
    warehouseId: number,
  ) => boolean | Promise<boolean>;
  items?: ErpStockInApi.StockInItem[];
  disabled?: boolean;
  enableBatchEdit?: boolean;
  hiddenFields?: string[];
  inId?: number;
  itemPageLoading?: boolean;
  itemPagination?: StockInItemPagination;
  remotePaging?: boolean;
}

type StockInFormItem = Partial<ErpStockInApi.StockInItem> & {
  seq?: number | string;
};

type StockInItemPagination = {
  orderDirection?: 'asc' | 'desc';
  orderField?: string;
  pageNo: number;
  pageSize: number;
  total: number;
};

interface BatchUpdateItemsPayload {
  warehouse?: any;
  warehouseId?: number;
}

type ApplyBatchUpdateItemsOptions = {
  showMessage?: boolean;
};

type SyncItemsFromPropsOptions = {
  force?: boolean;
};

const STOCK_IN_ITEM_COUNT_INPUT_SELECTOR = '[data-stock-in-count-input="true"]';
const STOCK_IN_PRODUCT_SELECT_INPUT_SELECTOR =
  '[data-erp-inline-stock-select-input="true"]';

const DEFAULT_ITEM_PAGE_SIZE = 10;
const ITEM_PAGE_SIZE_OPTIONS = ['10', '20', '50', '100', '200'];
const ITEM_TABLE_VISIBLE_ROWS = 10;
const ITEM_TABLE_HEADER_HEIGHT = 40;
const ITEM_TABLE_ROW_HEIGHT = 40;
const ITEM_TABLE_HEIGHT =
  ITEM_TABLE_HEADER_HEIGHT + ITEM_TABLE_ROW_HEIGHT * ITEM_TABLE_VISIBLE_ROWS;

const tableData = ref<StockInFormItem[]>([]); // 表格数据
const itemRowKeyManager = createStockItemClientRowKeyManager('stock-in');
const detailActions = ref<InstanceType<typeof StockItemDetailActions>>();
const activeItemRow = ref<any>();
const renderedItemRows = ref<any[]>([]);
let internalRows: object[] | undefined;
let disposed = false;
let syncSequence = 0;
const inlineStockSelectorOpen = ref(false);
const { itemTableWrapRef, priceReferenceOpen } = useItemPriceReferenceShortcut({
  isBlocked: () =>
    !props.enabled ||
    inlineStockSelectorOpen.value ||
    batchUpdateItemsModalOpen.value ||
    Boolean(detailActions.value?.isBlockedForPrice()),
});
const warehouseOptions = ref<any[]>([]); // 仓库下拉选项
const activeItemSort = ref<null | {
  field: string;
  order: StockInItemSortOrder;
}>(null);
const selectedBatchItemRows = ref<StockInFormItem[]>([]);
const localItemPage = ref({ pageNo: 1, pageSize: DEFAULT_ITEM_PAGE_SIZE });
const { hasAccessByCodes } = useAccess();
const batchUpdateItemsModalOpen = ref(false);
const [BatchUpdateItemsModal, batchUpdateItemsModalApi] = useVbenModal({
  connectedComponent: StockBatchUpdateItemsForm,
  destroyOnClose: true,
  onOpenChange: (open) => {
    batchUpdateItemsModalOpen.value = open;
  },
});
const batchUpdateAccessCodes = computed(() =>
  props.inId ? ['erp:stock-in:update'] : ['erp:stock-in:create'],
);
const canShowBatchUpdateItems = computed(
  () =>
    props.enableBatchEdit &&
    (!props.disabled || Boolean(props.inId)) &&
    hasAccessByCodes(batchUpdateAccessCodes.value) &&
    !isFieldHidden(props.hiddenFields, 'item_warehouseId'),
);
const selectedBatchItemIds = computed(() =>
  selectedBatchItemRows.value
    .filter((item) => canBatchUpdateItemRow(item))
    .map((row) => row.id!)
    .filter(Boolean),
);
const selectedBatchItemCount = computed(
  () =>
    selectedBatchItemRows.value.filter((item) => canBatchUpdateItemRow(item))
      .length,
);
const batchEditableItemCount = computed(
  () => tableData.value.filter((item) => canBatchUpdateItemRow(item)).length,
);
const selectedDeleteItemRows = computed(() =>
  selectedBatchItemRows.value.filter((item) => canDeleteItemRow(item)),
);
const selectedDeleteItemCount = computed(
  () => selectedDeleteItemRows.value.length,
);
const canShowItemSelection = computed(
  () => !props.disabled || canShowBatchUpdateItems.value,
);
const effectiveItemPagination = computed(() =>
  props.remotePaging
    ? props.itemPagination
    : {
        orderDirection: activeItemSort.value?.order,
        orderField: activeItemSort.value?.field,
        pageNo: localItemPage.value.pageNo,
        pageSize: localItemPage.value.pageSize,
        total: tableData.value.length,
      },
);
const showItemPager = computed(
  () =>
    props.remotePaging || tableData.value.length > localItemPage.value.pageSize,
);
let warehouseHydrateSeq = 0;

function canBatchUpdateItemRow(row?: StockInFormItem) {
  return Boolean(row?.productId && (!props.disabled || row.id));
}

function canDeleteItemRow(row?: StockInFormItem) {
  return Boolean(row && !props.disabled);
}

function canSelectItemRow(row?: StockInFormItem) {
  return canBatchUpdateItemRow(row) || canDeleteItemRow(row);
}

function getDisplayedItems() {
  const activeSort = activeItemSort.value;
  const rows =
    !activeSort || props.remotePaging
      ? [...tableData.value]
      : sortStockInItems(tableData.value, activeSort.field, activeSort.order, {
          warehouseOptions: warehouseOptions.value,
        });
  if (props.remotePaging) {
    return rows;
  }
  const startIndex =
    (localItemPage.value.pageNo - 1) * localItemPage.value.pageSize;
  return rows.slice(startIndex, startIndex + localItemPage.value.pageSize);
}

async function refreshItemGrid() {
  await nextTick();
  if (disposed) return;
  const rows = getDisplayedItems();
  renderedItemRows.value = rows;
  activeItemRow.value =
    rows.find(
      (row) => getItemRowKey(row) === getItemRowKey(activeItemRow.value),
    ) ?? rows[0];
  gridApi.setGridOptions({ data: rows, fit: false });
  await itemColumns.reload();
  if (disposed) return;
  await gridApi.grid.loadData(rows);
  if (activeItemRow.value)
    await gridApi.grid.setCurrentRow?.(activeItemRow.value);
}

async function handleItemToolbarRefresh() {
  if (!tryFlushInputs()) return;
  if (props.remotePaging)
    emit('refresh-items', { ...effectiveItemPagination.value });
  else await refreshItemGrid();
}
async function handleItemSortChange({ field, order }: any) {
  if (!tryFlushInputs()) return;
  activeItemSort.value =
    field && (order === 'asc' || order === 'desc') ? { field, order } : null;
  if (props.remotePaging) {
    emit('page-change', {
      orderDirection: activeItemSort.value?.order,
      orderField: activeItemSort.value?.field,
      pageNo: 1,
      pageSize: effectiveItemPagination.value.pageSize,
    });
    return;
  }
  localItemPage.value.pageNo = 1;
  await refreshItemGrid();
}

async function handleItemPageChange(pageNo: number, pageSize: number) {
  if (!tryFlushInputs()) return;
  if (props.remotePaging) {
    emit('page-change', {
      orderDirection: activeItemSort.value?.order,
      orderField: activeItemSort.value?.field,
      pageNo,
      pageSize,
    });
    return;
  }
  localItemPage.value = { pageNo, pageSize };
  await refreshItemGrid();
}

/** 表格配置 */
function buildItemColumns(
  hiddenFields = props.hiddenFields,
  rows = getDisplayedItems(),
) {
  const columns = (
    useFormItemColumns(props.disabled, hiddenFields) || []
  ).filter((column) => !props.disabled || column.field !== 'actions');
  if (canShowItemSelection.value) {
    columns.unshift({
      fixed: 'left',
      type: 'checkbox',
      width: 44,
    } as any);
  }
  for (const column of columns as any[]) {
    if (
      [
        'count',
        'packageQty',
        'productPrice',
        'stockCount',
        'totalPrice',
        'totalWeight',
        'weight',
      ].includes(column.field)
    )
      column.formatter = ({ row }: any) =>
        formatStockNaturalNumber(row[column.field]);
  }
  for (const column of columns) {
    if (column.field === 'totalPrice' || column.field === 'totalWeight') {
      column.slots = { default: column.field };
    }
  }
  const prepared = prepareStockDocumentItemColumns(columns as any[], {
    editable: !props.disabled,
    rows,
    trailingFlexibleColumnMinWidth: 150,
  });
  for (const column of prepared as any[]) {
    if (
      [
        'count',
        'packageQty',
        'pieceCount',
        'productPrice',
        'stockCount',
        'totalPrice',
        'totalWeight',
        'weight',
      ].includes(column.field)
    ) {
      const values = rows.map((row) => {
        if (column.field === 'pieceCount') {
          return row.count !== null &&
            row.count !== undefined &&
            Number(row.packageQty) > 0
            ? Number(row.count) / Number(row.packageQty)
            : undefined;
        }
        return row[column.field as keyof typeof row];
      });
      column.width = Math.max(
        Number(column.width) || 0,
        ...values.map(
          (value) =>
            formatStockNaturalNumber(value).length * 8 +
            (props.disabled ? 28 : 44),
        ),
      );
      if (column.field === 'pieceCount')
        column.formatter = ({ row }: any) =>
          row.count === null ||
          row.count === undefined ||
          Number(row.packageQty) <= 0
            ? '-'
            : formatStockNaturalNumber(
                Number(row.count) / Number(row.packageQty),
              );
    }
  }
  return prepared;
}

const itemColumns = useStockDocumentColumns({
  columns: () => buildItemColumns(),
  data: getDisplayedItems,
  grid: () => gridApi,
  wrapper: () => itemTableWrapRef.value,
  afterReload: async () => {
    if (activeItemSort.value) await gridApi.grid.setSort(activeItemSort.value);
  },
});

function clearBatchItemSelection() {
  selectedBatchItemRows.value = [];
  gridApi.grid?.clearCheckboxRow?.();
  gridApi.grid?.clearCheckboxReserve?.();
}

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: buildItemColumns(),
    customConfig: {
      restoreStore: itemColumns.restoreStore,
      storage: {
        fixed: true,
        resizable: true,
        sort: true,
        visible: true,
      },
    },
    data: tableData.value,
    fit: false,
    height: ITEM_TABLE_HEIGHT,
    id: 'erp-stock-in-item-list-v2',
    autoResize: true,
    border: true,
    rowConfig: {
      keyField: 'clientRowKey',
      isHover: true,
      isCurrent: true,
    },
    checkboxConfig: {
      checkMethod: ({ row }: { row: StockInFormItem }) => canSelectItemRow(row),
    },
    pagerConfig: {
      enabled: false,
    },
    toolbarConfig: {
      custom: true,
      zoom: true,
      refresh: { queryMethod: handleItemToolbarRefresh },
      enabled: true,
      slots: { buttons: 'toolbar-buttons', tools: 'toolbar-tools' },
    },
    showHeaderOverflow: 'tooltip',
    showOverflow: 'tooltip',
    sortConfig: {
      remote: true,
      multiple: false,
      trigger: 'cell',
      orders: ['asc', 'desc', null],
      allowBtn: false,
    },
  },
  gridEvents: {
    cellClick: ({ row }: any) => {
      activeItemRow.value = row;
    },
    currentRowChange: ({ row }: any) => {
      activeItemRow.value = row;
    },
    zoom: itemColumns.queue,
    resizableChange: itemColumns.queue,
    sortChange: handleItemSortChange,
    custom: itemColumns.custom,
    checkboxAll: ({ records }: { records: StockInFormItem[] }) => {
      selectedBatchItemRows.value = records.filter((item) =>
        canSelectItemRow(item),
      );
    },
    checkboxChange: ({ records }: { records: StockInFormItem[] }) => {
      selectedBatchItemRows.value = records.filter((item) =>
        canSelectItemRow(item),
      );
    },
  },
});

watch(
  () => props.hiddenFields,
  async () => {
    await nextTick();
    await itemColumns.reload();
    clearBatchItemSelection();
    if (activeItemSort.value) {
      await gridApi.grid.setSort(activeItemSort.value);
    }
    await refreshItemGrid();
  },
  { deep: true },
);

/** 监听外部传入的列数据 */
watch(
  () => [props.disabled, props.enableBatchEdit, props.inId],
  async () => {
    await nextTick();
    await itemColumns.reload();
    await refreshItemGrid();
    clearBatchItemSelection();
  },
);

async function syncItemsFromProps(
  items = props.items,
  _options: SyncItemsFromPropsOptions = {},
) {
  if (!items || disposed) return;
  if (
    items.length === internalRows?.length &&
    items.every((row, index) => {
      const previous = internalRows?.[index] as Record<string, any>;
      return (
        previous &&
        Object.entries(row).every(([key, value]) => previous[key] === value)
      );
    }) &&
    !_options.force
  ) {
    internalRows = undefined;
    return;
  }
  const sequence = ++syncSequence;
  const nextRows = items.map((item, index) => {
    const row = {
      ...item,
      seq: (item as StockInFormItem).seq ?? item.id ?? index + 1,
    } as StockInFormItem;
    initRow(row);
    return row;
  });
  itemRowKeyManager.ensureRowKeys(nextRows);
  tableData.value = nextRows;
  if (!props.remotePaging) {
    const pageCount = Math.max(
      1,
      Math.ceil(tableData.value.length / localItemPage.value.pageSize),
    );
    if (localItemPage.value.pageNo > pageCount) {
      localItemPage.value.pageNo = pageCount;
    }
  }
  warehouseOptions.value = mergeCurrentWarehouseOptions();
  hydrateWarehouseNamesFromOptions();
  await hydrateMissingWarehouseNamesFromApi();
  if (disposed || sequence !== syncSequence) return;
  await nextTick();
  await itemColumns.reload();
  await refreshItemGrid();
  clearBatchItemSelection();
}

watch(
  () => props.items,
  async (items) => {
    await syncItemsFromProps(items);
  },
  {
    immediate: true,
  },
);

watch(
  () => props.enabled,
  (enabled) => {
    if (enabled) return;
    activeItemRow.value = undefined;
    priceReferenceOpen.value = false;
    clearBatchItemSelection();
  },
);

watch(
  () => props.itemPageLoading,
  (loading) => {
    gridApi.setLoading(loading);
  },
  { immediate: true },
);

watch(
  () => [props.itemPagination.orderField, props.itemPagination.orderDirection],
  async ([orderField, orderDirection]) => {
    if (!props.remotePaging) return;
    const nextSort =
      orderField && (orderDirection === 'asc' || orderDirection === 'desc')
        ? {
            field: orderField,
            order: orderDirection as StockInItemSortOrder,
          }
        : null;
    if (
      activeItemSort.value?.field === nextSort?.field &&
      activeItemSort.value?.order === nextSort?.order
    )
      return;
    activeItemSort.value = nextSort;
    await nextTick();
    await (nextSort
      ? gridApi.grid.setSort(nextSort)
      : gridApi.grid.clearSort?.());
  },
);

/** 处理删除 */
function handleDelete(row: StockInFormItem) {
  deleteItemRows([row]);
}

function deleteItemRows(rows: StockInFormItem[]) {
  if (rows.length === 0 || props.disabled) {
    return;
  }
  const rowKeySet = new Set(rows.map((row) => getItemRowKey(row)));
  tableData.value = tableData.value.filter(
    (item) => !rowKeySet.has(getItemRowKey(item)),
  );
  clearBatchItemSelection();
  emit('update:items', [...tableData.value]);
  void refreshItemGrid();
}

/** 处理仓库变更 */
async function handleWarehouseChange(warehouseId: any, row: any, option?: any) {
  if (!warehouseId) {
    row.warehouseId = undefined;
    row.warehouseName = undefined;
    row.warehouseDeptId = undefined;
    row.warehouseDeptName = undefined;
    handleRowChange(row);
    return;
  }
  const selected = Array.isArray(option) ? option[0] : option;
  const warehouse =
    normalizeWarehouseOption(selected) ||
    warehouseOptions.value.find((w) => String(w.id) === String(warehouseId)) ||
    (await getWarehouse(Number(warehouseId)).catch(() => undefined));
  if (!warehouse) {
    return;
  }
  handleWarehouseOptionsChange([warehouse]);
  row.warehouseId = warehouseId;
  row.warehouseName = warehouse.name;
  row.warehouseDeptId = warehouse.deptId;
  row.warehouseDeptName = warehouse.deptName;

  // 如果已选择产品，重新获取库存
  if (row.productId) {
    row.stockCount = (await getStockCount(row.productId, warehouseId)) || 0;
  }

  handleRowChange(row);
}

/** 处理行数据变更 */
function handleRowChange(row: any) {
  refreshRowAmount(row);
  const index = tableData.value.findIndex(
    (item) => getItemRowKey(item) === getItemRowKey(row),
  );
  if (index === -1) {
    tableData.value.push(row);
  } else {
    tableData.value[index] = row;
  }
  internalRows = [...tableData.value];
  emit('update:items', internalRows);
}

function refreshRowAmount(row: any) {
  row.totalPrice = erpPriceMultiply(row.productPrice || 0, row.count || 0) ?? 0;
  row.totalWeight = erpPriceMultiply(row.weight || 0, row.count || 0) ?? 0;
}

/** 初始化行数据 */
function initRow(row: StockInFormItem) {
  if (
    (row.totalPrice === null || row.totalPrice === undefined) &&
    row.productPrice &&
    row.count
  ) {
    row.totalPrice = erpPriceMultiply(row.productPrice, row.count) ?? 0;
  }
}

function nextSeq() {
  let maxSeq = 0;
  for (const item of tableData.value) {
    maxSeq = Math.max(maxSeq, Number(item.seq) || 0);
  }
  return maxSeq + 1;
}

function getItemRowKey(row?: StockInFormItem) {
  if (!row) return '';
  return itemRowKeyManager.ensureRowKey(row);
}

function escapeAttrValue(value: string) {
  return value.replaceAll('\\', '\\\\').replaceAll('"', String.raw`\"`);
}

function getProductInputValue(row: StockInFormItem) {
  const keyword = (row as any).__stockKeyword;
  return keyword === undefined || keyword === null
    ? row.productName || ''
    : String(keyword);
}

function handleProductKeywordInput(row: StockInFormItem, value: string) {
  (row as any).__stockKeyword = value;
}

function focusProductNameInput(row: StockInFormItem) {
  if (props.disabled) {
    return false;
  }
  const rowKey = getItemRowKey(row);
  const selector = rowKey
    ? `${STOCK_IN_PRODUCT_SELECT_INPUT_SELECTOR}[data-erp-inline-stock-row-key="${escapeAttrValue(rowKey)}"]`
    : STOCK_IN_PRODUCT_SELECT_INPUT_SELECTOR;
  return focusFirstEditableInput(itemTableWrapRef.value, selector);
}

function getInlineStockPageParams() {
  return { bizType: 'stock' as const };
}

function createBlankItemRow() {
  const row: StockInFormItem = {
    count: 1,
    productPrice: 0,
    seq: nextSeq(),
  };
  itemRowKeyManager.ensureRowKey(row, { forceNew: true });
  initRow(row);
  return row;
}

const itemRowFocusController = createErpItemRowFocusController({
  focusField: (row: StockInFormItem, field) =>
    field === 'product' ? focusProductNameInput(row) : focusItemCountInput(row),
  getAllRows: () => tableData.value,
  getDisplayedRows: getDisplayedItems,
  getGrid: () => gridApi.grid as any,
  getLocalPage: () => localItemPage.value,
  getRowKey: getItemRowKey,
  isDisabled: () => props.disabled,
  isRemotePaging: () => props.remotePaging,
  refreshGrid: () => refreshItemGrid(),
  setLocalPageNo: (pageNo) => {
    localItemPage.value.pageNo = pageNo;
  },
});

async function handleAddBlankItemRow() {
  if (props.disabled) {
    return;
  }
  const row = createBlankItemRow();
  if (props.remotePaging) {
    emit('append-items', [row], 'product');
    return;
  }
  tableData.value = [...tableData.value, row];
  emit('update:items', [...tableData.value]);
  await itemRowFocusController.focus(row, 'product');
}

function buildStockInItemFromStock(
  product: ErpStockApi.Stock,
  overrides: Partial<StockInFormItem> = {},
) {
  const row: StockInFormItem = {
    seq: nextSeq(),
    warehouseId: product.warehouseId,
    warehouseName: product.warehouseName,
    warehouseDeptId: product.deptId,
    warehouseDeptName: product.deptName,
    productId: product.productId,
    productName: product.productName,
    productCode: product.productCode,
    productBarCode: product.productBarCode,
    productUnitId: product.unitId,
    productUnitName: product.unitName,
    batchNo: product.batchNo,
    packageQty: product.packageQty,
    weight: product.weight,
    productPrice: product.lastPurchasePrice ?? 0,
    stockCount: product.count ?? 0,
    count: 1,
    ...overrides,
  };
  copyPriceReferenceFields(row, product);
  refreshRowAmount(row);
  itemRowKeyManager.ensureRowKey(row, { forceNew: true });
  return row;
}

function buildReplacementStockInItemFromStock(
  stock: ErpStockApi.Stock,
  targetRow: StockInFormItem,
) {
  const row = buildStockInItemFromStock(stock);
  row.id = targetRow.id;
  row.seq = targetRow.seq ?? row.seq;
  row.clientRowKey = targetRow.clientRowKey ?? row.clientRowKey;
  (row as any).inId = (targetRow as any).inId;
  return row;
}

const {
  resetDecimalRow,
  decimalValue,
  decimalInput,
  commitDecimal,
  decimalErrors,
  decimalKey,
} = useOtherStockDecimalInputs(getItemRowKey, handleRowChange);
function flushInputs() {
  if (props.disabled) return;
  for (const row of tableData.value) {
    commitDecimal(row, 'count');
    commitDecimal(row, 'productPrice');
  }
}
function tryFlushInputs() {
  try {
    flushInputs();
    return true;
  } catch (error) {
    message.warning((error as Error).message);
    return false;
  }
}
function blurDecimal(row: any, field: 'count' | 'productPrice') {
  try {
    commitDecimal(row, field);
  } catch (error) {
    message.warning((error as Error).message);
  }
}

/** 表单校验 */
function validate(
  items = tableData.value,
  options: { requireItems?: boolean } = {},
) {
  flushInputs();
  if ((options.requireItems ?? true) && items.length === 0) {
    throw new Error('入库明细不能为空');
  }
  for (const [i, item] of items.entries()) {
    if (item) {
      if (!item.warehouseId) {
        throw new Error(`第 ${i + 1} 行：仓库不能为空`);
      }
      if (!item.productId) {
        throw new Error(`第 ${i + 1} 行：产品不能为空`);
      }
      if (!item.count || stockDecimal(item.count).lte(0)) {
        throw new Error(`第 ${i + 1} 行：产品数量不能为空`);
      }
      if (!item.productPrice || stockDecimal(item.productPrice).lte(0)) {
        throw new Error(`第 ${i + 1} 行：产品单价不能为空`);
      }
    }
  }
}

function getItems() {
  flushInputs();
  return [...tableData.value];
}

defineExpose({
  focusFirstItemCountInput,
  focusItemRow: (row: StockInFormItem, field: 'count' | 'product') =>
    itemRowFocusController.focus(row, field),
  getItems,
  reloadItemsFromProps,
  validate,
});

function handleGlobalInsertShortcut(event: KeyboardEvent) {
  if (
    props.disabled ||
    !props.enabled ||
    Boolean(detailActions.value?.isBlocked()) ||
    inlineStockSelectorOpen.value ||
    priceReferenceOpen.value ||
    batchUpdateItemsModalOpen.value ||
    hasOpenFormControlPopup() ||
    event.defaultPrevented ||
    event.isComposing ||
    event.repeat ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.shiftKey ||
    !isCreateShortcutKey(event)
  ) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  void handleAddBlankItemRow();
}

/** 初始化 */
onMounted(async () => {
  window.addEventListener('keydown', handleGlobalInsertShortcut, true);
  warehouseOptions.value = mergeCurrentWarehouseOptions();
  hydrateWarehouseNamesFromOptions();
  await hydrateMissingWarehouseNamesFromApi();
  if (activeItemSort.value || props.disabled) {
    await refreshItemGrid();
  }
});

onUnmounted(() => {
  disposed = true;
  syncSequence += 1;
  window.removeEventListener('keydown', handleGlobalInsertShortcut, true);
});

function findWarehouseOption(warehouseId?: number) {
  return warehouseOptions.value.find(
    (item) => String(item.id) === String(warehouseId),
  );
}

function getWarehouseLabel(row: StockInFormItem) {
  return (
    (isMissingStockDocumentDisplayName(row.warehouseName, row.warehouseId)
      ? undefined
      : row.warehouseName) ||
    findWarehouseOption(row.warehouseId)?.name ||
    '-'
  );
}

function getCurrentWarehouseOption(row: StockInFormItem) {
  if (!row?.warehouseId) {
    return [];
  }
  const existed = findWarehouseOption(row.warehouseId);
  if (existed && isResolvedStockDocumentOption(existed)) {
    return [existed];
  }
  const currentName = row.warehouseName;
  return [
    {
      deptId: row.warehouseDeptId,
      deptName: row.warehouseDeptName,
      id: row.warehouseId,
      label: isMissingStockDocumentDisplayName(currentName, row.warehouseId)
        ? CURRENT_SELECT_LABEL_PLACEHOLDER
        : currentName,
      name: isMissingStockDocumentDisplayName(currentName, row.warehouseId)
        ? CURRENT_SELECT_LABEL_PLACEHOLDER
        : currentName,
      value: row.warehouseId,
    },
  ];
}

function mergeCurrentWarehouseOptions(options = warehouseOptions.value) {
  let nextOptions = options;
  tableData.value.forEach((item) => {
    if (
      !item.warehouseId ||
      isMissingStockDocumentDisplayName(item.warehouseName, item.warehouseId)
    ) {
      return;
    }
    nextOptions = mergeStockDocumentOption(nextOptions, {
      deptId: item.warehouseDeptId,
      deptName: item.warehouseDeptName,
      id: item.warehouseId,
      label: item.warehouseName,
      name: item.warehouseName,
      value: item.warehouseId,
    }) as any[];
  });
  return nextOptions;
}

function hydrateWarehouseNamesFromOptions() {
  let changed = false;
  tableData.value.forEach((item) => {
    if (
      !item.warehouseId ||
      !isMissingStockDocumentDisplayName(item.warehouseName, item.warehouseId)
    ) {
      return;
    }
    const warehouse = findWarehouseOption(item.warehouseId);
    if (!warehouse) {
      return;
    }
    item.warehouseName = warehouse.name;
    item.warehouseDeptId ??= warehouse.deptId;
    item.warehouseDeptName ??= warehouse.deptName;
    changed = true;
  });
  return changed;
}

function normalizeWarehouseOption(option?: any) {
  if (!option?.id && !option?.value) {
    return undefined;
  }
  const value = option.id ?? option.value;
  const name = option.name ?? option.label;
  if (isMissingStockDocumentDisplayName(name, value)) {
    return undefined;
  }
  return {
    ...option,
    id: value,
    label: name,
    name,
    value,
  };
}

function handleWarehouseOptionsChange(options: any[]) {
  const nextOptions = mergeResolvedStockDocumentOptions(
    warehouseOptions.value,
    (options || [])
      .map((item) => normalizeWarehouseOption(item))
      .filter(Boolean),
  );
  if (nextOptions !== warehouseOptions.value) {
    warehouseOptions.value = nextOptions;
    if (hydrateWarehouseNamesFromOptions()) {
      emit('update:items', [...tableData.value]);
      void refreshItemGrid();
    }
  }
}

async function hydrateMissingWarehouseNamesFromApi() {
  const missingIds = [
    ...new Set(
      tableData.value
        .filter((item) =>
          isMissingStockDocumentDisplayName(
            item.warehouseName,
            item.warehouseId,
          ),
        )
        .map((item) => Number(item.warehouseId))
        .filter((value) => Number.isFinite(value)),
    ),
  ];
  if (missingIds.length === 0) {
    return;
  }
  const seq = ++warehouseHydrateSeq;
  const warehouses = await Promise.all(
    missingIds.map((id) => getWarehouse(id).catch(() => undefined)),
  );
  if (seq !== warehouseHydrateSeq) {
    return;
  }
  handleWarehouseOptionsChange(warehouses.filter(Boolean));
}

async function insertStockProducts(
  products: ErpStockApi.Stock[],
  targetRow?: StockInFormItem,
) {
  if (!products || products.length === 0) return;
  const buildRow = (
    stock: ErpStockApi.Stock,
    overrides: Partial<StockInFormItem> = {},
  ) => buildStockInItemFromStock(stock, overrides);
  const targetRowKey = getItemRowKey(targetRow);
  const targetIndex = targetRowKey
    ? tableData.value.findIndex((item) => getItemRowKey(item) === targetRowKey)
    : -1;
  let focusRow: StockInFormItem;
  if (targetIndex >= 0 && targetRow) {
    const [firstStock, ...additionalStocks] = products;
    resetDecimalRow(targetRow);
    const replacementRow = buildReplacementStockInItemFromStock(
      firstStock!,
      targetRow,
    );
    const appendSeqStart = nextSeq();
    const additionalRows = additionalStocks.map((stock, index) =>
      buildRow(stock, { seq: appendSeqStart + index }),
    );
    tableData.value.splice(targetIndex, 1, replacementRow);
    if (additionalRows.length > 0 && !props.remotePaging) {
      tableData.value = [...tableData.value, ...additionalRows];
    }
    focusRow = replacementRow;
    if (props.remotePaging && additionalRows.length > 0) {
      emit('update:items', [...tableData.value]);
      emit('append-items', additionalRows, 'count', replacementRow);
      return;
    }
  } else {
    const newRows = products.map((stock, index) =>
      buildRow(stock, { seq: nextSeq() + index }),
    );
    if (props.remotePaging) {
      emit('append-items', newRows, 'count');
      return;
    }
    tableData.value = [...tableData.value, ...newRows];
    focusRow = newRows[0]!;
  }
  emit('update:items', [...tableData.value]);
  await itemRowFocusController.focus(focusRow, 'count');
}

function handleInlineStockSelected(
  targetRow: StockInFormItem,
  rows: ErpStockApi.Stock[],
) {
  void insertStockProducts(rows, targetRow);
}

function handleInlineStockOpenChange(open: boolean) {
  inlineStockSelectorOpen.value = open;
}

function handleBatchDeleteItems() {
  const rows = selectedDeleteItemRows.value;
  if (rows.length === 0) {
    return;
  }
  Modal.confirm({
    title: `确认删除已选的 ${rows.length} 条入库明细吗？`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: () => deleteItemRows(rows),
  });
}

function focusFirstItemCountInput() {
  if (props.disabled) {
    return false;
  }
  const [firstRow] = getDisplayedItems();
  if (firstRow) {
    gridApi.grid?.setCurrentRow?.(firstRow);
  }
  return focusFirstEditableInput(
    itemTableWrapRef.value,
    STOCK_IN_ITEM_COUNT_INPUT_SELECTOR,
  );
}

function focusItemCountInput(row: StockInFormItem) {
  return focusEditableInputByRowKey(
    itemTableWrapRef.value,
    STOCK_IN_ITEM_COUNT_INPUT_SELECTOR,
    getItemRowKey(row),
  );
}

function handleItemInputPressEnter(event: KeyboardEvent) {
  if (!tryFlushInputs()) {
    event.preventDefault();
    return;
  }
  const enterFocusResult = focusNextInputOnEnter(event);
  if (enterFocusResult === 'last-input') {
    emit('request-submit', event);
  }
}

function getSelectedBatchItemRows() {
  return selectedBatchItemRows.value.filter((item) =>
    canBatchUpdateItemRow(item),
  );
}

function isSelectedBatchItemRow(row: StockInFormItem) {
  return getSelectedBatchItemRows().some(
    (item) => getItemRowKey(item) === getItemRowKey(row),
  );
}

function getBatchTargetWarehouse(payload: BatchUpdateItemsPayload) {
  return (
    payload.warehouse ||
    warehouseOptions.value.find((item) => item.id === payload.warehouseId)
  );
}

async function reloadItemsFromProps() {
  await syncItemsFromProps(props.items, { force: true });
}

function handleOpenBatchUpdateItems() {
  if (selectedBatchItemCount.value === 0) {
    message.warning('请先勾选可批量修改的入库明细');
    return;
  }
  batchUpdateItemsModalApi
    .setData({
      documentId: props.disabled ? props.inId : undefined,
      documentType: 'in',
      hiddenFields: props.hiddenFields,
      itemCount: selectedBatchItemCount.value,
      itemIds: props.disabled ? selectedBatchItemIds.value : [],
    })
    .open();
}

async function applyLocalBatchUpdateItems(
  payload?: BatchUpdateItemsPayload,
  options: ApplyBatchUpdateItemsOptions = {},
) {
  const { showMessage = true } = options;
  if (!payload?.warehouseId) {
    message.warning('请选择目标仓库');
    return false;
  }
  const selectedRows = getSelectedBatchItemRows();
  if (selectedRows.length === 0) {
    message.warning('请先勾选可批量修改的入库明细');
    return false;
  }
  const warehouse = getBatchTargetWarehouse(payload);
  if (!warehouse) {
    message.warning('目标仓库不存在，请重新选择');
    return false;
  }
  if (
    props.beforeBatchWarehouseUpdate &&
    !(await props.beforeBatchWarehouseUpdate(
      selectedRows as ErpStockInApi.StockInItem[],
      payload.warehouseId,
    ))
  ) {
    return false;
  }

  let updatedCount = 0;
  tableData.value.forEach((item) => {
    if (!isSelectedBatchItemRow(item)) {
      return;
    }
    item.warehouseId = payload.warehouseId;
    item.warehouseName = warehouse.name;
    item.warehouseDeptId = warehouse.deptId;
    item.warehouseDeptName = warehouse.deptName;
    refreshRowAmount(item);
    updatedCount += 1;
  });
  await Promise.allSettled(
    selectedRows.map(async (row) => {
      row.stockCount =
        row.productId && row.warehouseId
          ? (await getStockCount(row.productId, row.warehouseId)) || 0
          : 0;
    }),
  );
  emit('update:items', [...tableData.value]);
  await refreshItemGrid();
  clearBatchItemSelection();
  if (showMessage) {
    message.success(`已批量更新 ${updatedCount} 条入库明细`);
  }
  return true;
}

async function handleBatchUpdateItemsSuccess(
  payload?: BatchUpdateItemsPayload,
) {
  if (payload) {
    await applyLocalBatchUpdateItems(payload, {
      showMessage: !props.disabled,
    });
    if (props.disabled) {
      emit('batch-update-success');
    }
    return;
  }
  clearBatchItemSelection();
  emit('batch-update-success');
}
</script>

<template>
  <div class="stock-in-item-form w-full">
    <div
      ref="itemTableWrapRef"
      tabindex="-1"
      @mousedown="detailActions?.pointer($event)"
      class="stock-in-item-table-wrap relative"
    >
      <Grid class="stock-in-item-grid w-full">
        <template #toolbar-buttons>
          <StockItemDetailActions
            ref="detailActions"
            :active-row="activeItemRow"
            :dept-id="deptId"
            :enabled="enabled"
            :hidden-fields="hiddenFields"
            :wrapper="itemTableWrapRef"
            :blocked="
              inlineStockSelectorOpen ||
              priceReferenceOpen ||
              batchUpdateItemsModalOpen
            "
            @product-updated="itemColumns.queue()"
          />
          <div class="stock-in-item-toolbar-left">
            <div class="stock-document-item-shortcut-hint">
              <div class="stock-document-item-shortcut-hint__label">当前页</div>
              <div class="flex items-center gap-1">
                <kbd>W</kbd><b>全部价格</b>
              </div>
            </div>
            <div
              v-if="canShowBatchUpdateItems"
              class="stock-document-item-batch-summary"
            >
              已选 {{ selectedBatchItemCount }} 条 / 可改
              {{ batchEditableItemCount }} 条
            </div>
          </div>
        </template>
        <template #toolbar-tools>
          <div class="stock-in-item-toolbar flex items-center gap-2">
            <Button
              v-if="!disabled"
              type="primary"
              @click="handleAddBlankItemRow"
            >
              新增行
            </Button>
            <Button
              v-if="!disabled"
              danger
              :disabled="selectedDeleteItemCount === 0"
              @click="handleBatchDeleteItems"
            >
              批量删除
            </Button>
            <Button
              v-if="canShowBatchUpdateItems"
              type="primary"
              :disabled="selectedBatchItemCount === 0"
              @click="handleOpenBatchUpdateItems"
            >
              批量修改仓库/部门
            </Button>
          </div>
        </template>
        <template #warehouseId="{ row }">
          <span v-if="disabled">{{ getWarehouseLabel(row) }}</span>
          <ErpLazyPageSelect
            v-else
            v-model:value="row.warehouseId"
            popup-class-name="stock-in-item-select-dropdown erp-candidate-focus-popup"
            :api="
              (params) =>
                getWarehouseSimplePage({ ...params, bizType: 'stock' })
            "
            :options="getCurrentWarehouseOption(row)"
            label-field="name"
            value-field="id"
            :page-size="10"
            class="w-full"
            placeholder="请选择仓库"
            show-search
            :disabled="disabled"
            @change="
              (value, option) => handleWarehouseChange(value, row, option)
            "
            @options-change="handleWarehouseOptionsChange"
          />
        </template>
        <template #productId="{ row }">
          <ErpInlineStockSelect
            candidate-focus-highlight
            v-if="!disabled"
            :value="getProductInputValue(row)"
            settings-scope="stock-in"
            :row="row"
            :row-key="getItemRowKey(row)"
            :hidden-fields="props.hiddenFields"
            :stock-page-api="getStockPage"
            :stock-page-params="getInlineStockPageParams()"
            :require-dept="false"
            @open-change="handleInlineStockOpenChange"
            @select="(stocks) => handleInlineStockSelected(row, stocks)"
            @update:value="(value) => handleProductKeywordInput(row, value)"
          />
          <span v-else>{{ row.productName || '-' }}</span>
        </template>
        <template #batchNo="{ row }">
          <Input
            v-if="!disabled"
            v-model:value="row.batchNo"
            class="w-full"
            @change="handleRowChange(row)"
            @press-enter="handleItemInputPressEnter"
          />
          <span v-else>{{ row.batchNo || '-' }}</span>
        </template>
        <template #count="{ row }">
          <Input
            v-if="!disabled"
            :value="decimalValue(row, 'count')"
            :status="
              decimalErrors[decimalKey(row, 'count')] ? 'error' : undefined
            "
            inputmode="decimal"
            :data-erp-item-row-key="getItemRowKey(row)"
            data-stock-in-count-input="true"
            @update:value="decimalInput(row, 'count', String($event ?? ''))"
            @blur="blurDecimal(row, 'count')"
            @press-enter="handleItemInputPressEnter"
          />
          <span v-else>{{ formatStockNaturalNumber(row.count) }}</span>
        </template>
        <template #productPrice="{ row }">
          <DecimalAmountInput
            v-if="!disabled"
            :value="decimalValue(row, 'productPrice')"
            :status="
              decimalErrors[decimalKey(row, 'productPrice')]
                ? 'error'
                : undefined
            "
            inputmode="decimal"
            @update:value="
              decimalInput(row, 'productPrice', String($event ?? ''))
            "
            @blur="blurDecimal(row, 'productPrice')"
            @press-enter="handleItemInputPressEnter"
          />
          <span v-else>{{
            erpPriceInputFormatter(row.productPrice) || '-'
          }}</span>
        </template>
        <template #totalPrice="{ row }">
          <span>{{ formatStockNaturalNumber(row.totalPrice) }}</span>
        </template>
        <template #totalWeight="{ row }">
          <span>{{ formatStockNaturalNumber(row.totalWeight) }}</span>
        </template>
        <template #remark="{ row }">
          <Input
            v-if="!disabled"
            v-model:value="row.remark"
            class="w-full"
            @press-enter="handleItemInputPressEnter"
          />
          <span v-else>{{ row.remark || '-' }}</span>
        </template>
        <template #actions="{ row }">
          <TableAction
            :actions="[
              {
                label: '删除',
                icon: ACTION_ICON.DELETE,
                type: 'link',
                danger: true,
                popConfirm: {
                  title: '确认删除该产品吗？',
                  confirm: handleDelete.bind(null, row),
                },
              },
            ]"
          />
        </template>
      </Grid>
      <ItemPriceReferenceOverlay
        preserve-decimal-precision
        :hidden-fields="hiddenFields"
        :open="priceReferenceOpen"
        :rows="renderedItemRows"
        :table-header-height="ITEM_TABLE_HEADER_HEIGHT"
        :table-row-height="ITEM_TABLE_ROW_HEIGHT"
        :table-wrapper="itemTableWrapRef"
        :visible-rows="ITEM_TABLE_VISIBLE_ROWS"
      />
    </div>
    <BatchUpdateItemsModal @success="handleBatchUpdateItemsSuccess" />
    <div v-if="showItemPager" class="stock-in-item-pager">
      <Pagination
        class="erp-candidate-focus-popup"
        :current="effectiveItemPagination.pageNo"
        :page-size="effectiveItemPagination.pageSize"
        :page-size-options="ITEM_PAGE_SIZE_OPTIONS"
        :show-size-changer="true"
        :show-quick-jumper="true"
        :show-total="(total) => `共 ${total} 条明细`"
        :total="effectiveItemPagination.total"
        size="small"
        @change="handleItemPageChange"
        @show-size-change="handleItemPageChange"
      />
    </div>
  </div>
</template>

<style scoped>
:deep(.stock-detail-history-hints) {
  display: inline-flex;
  gap: 10px;
  align-items: center;
  font-size: 12px;
}

.stock-in-item-form :deep(.vxe-table),
.stock-in-item-form :deep(.ant-input),
.stock-in-item-form :deep(.ant-input-number),
.stock-in-item-form :deep(.ant-select) {
  font-size: 11px;
}

.stock-in-item-toolbar :deep(.ant-btn) {
  height: 28px;
  padding: 2px 10px;
  font-size: 12px;
  line-height: 20px;
}

.stock-in-item-toolbar :deep(.ant-btn span) {
  font-size: 12px;
}

.stock-in-item-toolbar-left {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 12px;
  min-width: 0;
}

.stock-document-item-batch-summary {
  min-width: 0;
  font-size: 12px;
  color: #475569;
}

.stock-document-item-shortcut-hint {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  color: #475569;
  font-size: 12px;
}

.stock-document-item-shortcut-hint__label {
  color: #64748b;
}

.stock-document-item-shortcut-hint b {
  font-weight: 600;
}

.stock-document-item-shortcut-hint kbd {
  min-width: 24px;
  padding: 1px 7px;
  color: #334155;
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  box-shadow: inset 0 -1px 0 rgb(15 23 42 / 10%);
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
  text-align: center;
}

.stock-in-item-grid :deep(.vxe-header--column.is--sortable .vxe-cell--title) {
  color: #1677ff;
}

.stock-in-item-grid :deep(.vxe-header--column .vxe-cell--sort) {
  display: none;
}

:global(.stock-in-item-select-dropdown .ant-select-item),
:global(.stock-in-item-select-dropdown .ant-empty-description) {
  font-size: 11px;
}

.stock-in-item-pager {
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
}

.stock-in-item-pager :deep(.ant-pagination),
.stock-in-item-pager :deep(.ant-pagination-item),
.stock-in-item-pager :deep(.ant-pagination-total-text),
.stock-in-item-pager :deep(.ant-pagination-options),
.stock-in-item-pager :deep(.ant-select),
.stock-in-item-pager :deep(.ant-input) {
  font-size: 11px;
}

.stock-in-item-pager :deep(.ant-pagination-item),
.stock-in-item-pager :deep(.ant-pagination-prev),
.stock-in-item-pager :deep(.ant-pagination-next),
.stock-in-item-pager :deep(.ant-pagination-jump-prev),
.stock-in-item-pager :deep(.ant-pagination-jump-next) {
  min-width: 24px;
  height: 24px;
  line-height: 22px;
}

.stock-in-item-pager :deep(.ant-pagination-item a),
.stock-in-item-pager :deep(.ant-pagination-prev button),
.stock-in-item-pager :deep(.ant-pagination-next button) {
  height: 22px;
  font-size: 11px;
  line-height: 22px;
}

.stock-in-item-pager :deep(.ant-pagination-options-size-changer),
.stock-in-item-pager :deep(.ant-select-single),
.stock-in-item-pager :deep(.ant-select-selector) {
  height: 24px;
  line-height: 22px;
}

.stock-in-item-pager
  :deep(.ant-pagination-options-size-changer .ant-select-selector) {
  box-sizing: border-box;
  align-items: center;
  min-height: 24px;
  padding: 0 24px 0 8px;
}

.stock-in-item-pager
  :deep(.ant-select-single .ant-select-selector .ant-select-selection-item) {
  height: 22px;
  font-size: 11px;
  line-height: 22px;
}

.stock-in-item-pager :deep(.ant-select-arrow) {
  margin-top: -5px;
  font-size: 10px;
}

.stock-in-item-pager :deep(.ant-pagination-options-quick-jumper input) {
  height: 24px;
  padding: 0 7px;
  font-size: 11px;
  line-height: 22px;
}
</style>
