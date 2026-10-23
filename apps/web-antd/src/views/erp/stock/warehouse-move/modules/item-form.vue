<script lang="ts" setup>
import type { WarehouseMoveItemSortOrder } from './warehouse-move-item-sort';

import type { ErpStockApi } from '#/api/erp/stock/stock';
import type { ErpWarehouseMoveApi } from '#/api/erp/stock/warehouse-move';

/* eslint-disable vue/custom-event-name-casing -- Preserve the existing stock form event contract. */
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  provide,
  ref,
  watch,
} from 'vue';

import { Button, Input, message, Modal, Pagination } from 'ant-design-vue';

import { TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import { getStockPage, getWarehouseStockCount } from '#/api/erp/stock/stock';
import ErpInlineStockSelect from '#/views/erp/components/ErpInlineStockSelect.vue';
import ItemPriceReferenceOverlay from '#/views/erp/components/ItemPriceReferenceOverlay.vue';
import StockItemDetailActions from '#/views/erp/stock/components/StockItemDetailActions.vue';
import { useStockDocumentColumns } from '#/views/erp/stock/utils/document-columns';
import { prepareStockDocumentItemColumns } from '#/views/erp/stock/utils/document-item-table';
import { formatStockNaturalNumber } from '#/views/erp/stock/utils/document-number';
import { createStockItemClientRowKeyManager } from '#/views/erp/stock/utils/item-row-key';
import { stockDecimal } from '#/views/erp/stock/utils/stock-decimal';
import { stockMultiply as erpPriceMultiply } from '#/views/erp/stock/utils/stock-decimal';
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
  queueAfterEditableControlRender,
} from '#/views/erp/utils/keyboard';
import {
  copyPriceReferenceFields,
  useItemPriceReferenceShortcut,
} from '#/views/erp/utils/price-reference';

import { useFormItemColumns } from '../data';
import {
  formatWarehouseMoveCountInput,
  normalizeWarehouseMoveCount,
  parseWarehouseMoveCountText,
} from './warehouse-move-item-number';
import { sortWarehouseMoveItems } from './warehouse-move-item-sort';

const props = withDefaults(defineProps<Props>(), {
  deptId: undefined,
  disabled: false,
  fromWarehouseId: undefined,
  fromWarehouseName: undefined,
  hiddenFields: () => [],
  itemPageLoading: false,
  itemPagination: () => ({
    orderDirection: undefined,
    orderField: undefined,
    pageNo: 1,
    pageSize: 10,
    total: 0,
  }),
  items: () => [],
  remotePaging: false,
  toWarehouseId: undefined,
  toWarehouseName: undefined,
});

const emit = defineEmits([
  'refresh-items',
  'append-items',
  'page-change',
  'request-submit',
  'update:items',
]);

provide(CANDIDATE_FOCUS_KEY, ref(true));

interface Props {
  deptId?: number;
  disabled?: boolean;
  fromWarehouseId?: number;
  fromWarehouseName?: string;
  hiddenFields?: string[];
  itemPageLoading?: boolean;
  itemPagination?: WarehouseMoveItemPagination;
  items?: ErpWarehouseMoveApi.WarehouseMoveItem[];
  remotePaging?: boolean;
  toWarehouseId?: number;
  toWarehouseName?: string;
}

type WarehouseMoveItemPagination = {
  orderDirection?: 'asc' | 'desc';
  orderField?: string;
  pageNo: number;
  pageSize: number;
  total: number;
};

const WAREHOUSE_MOVE_ITEM_COUNT_INPUT_SELECTOR =
  '[data-warehouse-move-count-input="true"]';
const WAREHOUSE_MOVE_PRODUCT_SELECT_INPUT_SELECTOR =
  '[data-erp-inline-stock-select-input="true"]';

const DEFAULT_ITEM_PAGE_SIZE = 10;
const ITEM_PAGE_SIZE_OPTIONS = ['10', '20', '50', '100', '200'];
const ITEM_TABLE_VISIBLE_ROWS = 10;
const ITEM_TABLE_HEADER_HEIGHT = 40;
const ITEM_TABLE_ROW_HEIGHT = 40;
const ITEM_TABLE_HEIGHT =
  ITEM_TABLE_HEADER_HEIGHT + ITEM_TABLE_ROW_HEIGHT * ITEM_TABLE_VISIBLE_ROWS;

const tableData = ref<ErpWarehouseMoveApi.WarehouseMoveItem[]>([]);
const itemRowKeyManager = createStockItemClientRowKeyManager('warehouse-move');
const countInputTextByRowKey = new Map<string, string>();
const editedCountKeys = new Set<string>();
const countInputErrors = ref<Record<string, boolean>>({});
const detailActions = ref<InstanceType<typeof StockItemDetailActions>>();
const activeItemRow = ref<any>();
const renderedItemRows = ref<any[]>([]);
const inlineStockSelectorOpen = ref(false);
const { itemTableWrapRef, priceReferenceOpen } = useItemPriceReferenceShortcut({
  isBlocked: () =>
    inlineStockSelectorOpen.value ||
    Boolean(detailActions.value?.isBlockedForPrice()),
});
const activeItemSort = ref<null | {
  field: string;
  order: WarehouseMoveItemSortOrder;
}>(null);
const localItemPage = ref({ pageNo: 1, pageSize: DEFAULT_ITEM_PAGE_SIZE });
const selectedDeleteItemRows = ref<ErpWarehouseMoveApi.WarehouseMoveItem[]>([]);
const selectedDeleteItemCount = computed(
  () =>
    selectedDeleteItemRows.value.filter((row) => canDeleteItemRow(row)).length,
);
let internalFieldUpdate = false;
let lastEmittedItems: ErpWarehouseMoveApi.WarehouseMoveItem[] | undefined;
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

function getDisplayedItems() {
  const activeSort = activeItemSort.value;
  const rows =
    !activeSort || props.remotePaging
      ? [...tableData.value]
      : sortWarehouseMoveItems(
          tableData.value,
          activeSort.field,
          activeSort.order,
        );
  if (props.remotePaging) {
    return rows;
  }
  const startIndex =
    (localItemPage.value.pageNo - 1) * localItemPage.value.pageSize;
  return rows.slice(startIndex, startIndex + localItemPage.value.pageSize);
}

async function refreshItemGrid() {
  await nextTick();
  const displayData = getDisplayedItems();
  renderedItemRows.value = displayData;
  activeItemRow.value =
    displayData.find((row) =>
      row.id ? row.id === activeItemRow.value?.id : row === activeItemRow.value,
    ) ?? displayData[0];
  gridApi.setGridOptions({ data: displayData, fit: false });
  await itemColumns.reload();
  await gridApi.grid.loadData(displayData);
}

async function handleItemToolbarRefresh() {
  try {
    flushInputs();
  } catch (error) {
    message.warning((error as Error).message);
    return;
  }
  if (props.remotePaging)
    emit('refresh-items', { ...effectiveItemPagination.value });
  else await refreshItemGrid();
}
async function handleItemSortChange({ field, order }: any) {
  try {
    flushInputs();
  } catch (error) {
    message.warning((error as Error).message);
    return;
  }
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
  try {
    flushInputs();
  } catch (error) {
    message.warning((error as Error).message);
    return;
  }
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

function buildItemColumns(
  hiddenFields = props.hiddenFields,
  rows = getDisplayedItems(),
  disabled = props.disabled,
) {
  const columns = useFormItemColumns(Boolean(disabled), hiddenFields) || [];
  if (!disabled) {
    columns.unshift({
      fixed: 'left',
      type: 'checkbox',
      width: 44,
    } as any);
  }
  return prepareStockDocumentItemColumns(columns as any[], {
    editable: !disabled,
    rows,
    trailingFlexibleColumnMinWidth: 150,
  });
}

const itemColumns = useStockDocumentColumns({
  columns: () =>
    buildItemColumns().filter((column: any) => column.visible !== false),
  data: getDisplayedItems,
  grid: () => gridApi,
  wrapper: () => itemTableWrapRef.value,
});
const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    autoResize: true,
    border: true,
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
    id: 'erp-stock-warehouse-move-item-list-v1',
    showHeaderOverflow: 'tooltip',
    showOverflow: 'tooltip',
    scrollX: {
      enabled: true,
      gt: 8,
    },
    pagerConfig: { enabled: false },
    rowConfig: {
      isHover: true,
      isCurrent: true,
      keyField: 'clientRowKey',
    },
    checkboxConfig: {
      checkMethod: ({ row }: { row: ErpWarehouseMoveApi.WarehouseMoveItem }) =>
        canDeleteItemRow(row),
    },
    toolbarConfig: {
      custom: true,
      zoom: true,
      refresh: { queryMethod: handleItemToolbarRefresh },
      enabled: true,
      slots: { buttons: 'toolbar-buttons', tools: 'toolbar-tools' },
    },
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
    resizableChange: itemColumns.queue,
    zoom: itemColumns.queue,
    custom: itemColumns.custom,
    sortChange: handleItemSortChange,
    checkboxAll: ({
      records,
    }: {
      records: ErpWarehouseMoveApi.WarehouseMoveItem[];
    }) => {
      selectedDeleteItemRows.value = records.filter((row) =>
        canDeleteItemRow(row),
      );
    },
    checkboxChange: ({
      records,
    }: {
      records: ErpWarehouseMoveApi.WarehouseMoveItem[];
    }) => {
      selectedDeleteItemRows.value = records.filter((row) =>
        canDeleteItemRow(row),
      );
    },
  },
});

watch(
  () => [props.disabled, props.hiddenFields],
  async () => {
    await nextTick();
    await itemColumns.reload();
    if (activeItemSort.value) {
      await gridApi.grid.setSort(activeItemSort.value);
    }
    clearItemSelection();
    await refreshItemGrid();
  },
  { deep: true },
);

watch(
  () => props.items,
  async (items) => {
    if (!items) {
      return;
    }
    if (internalFieldUpdate || items === lastEmittedItems) {
      internalFieldUpdate = false;
      lastEmittedItems = undefined;
      return;
    }
    const nextRows = items.map((item, index) =>
      initRow({
        ...item,
        seq: item.seq ?? item.id ?? index + 1,
      }),
    );
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
    await nextTick();
    await refreshItemGrid();
    clearItemSelection();
  },
  { immediate: true },
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
            order: orderDirection as WarehouseMoveItemSortOrder,
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

watch(
  () => [
    props.fromWarehouseId,
    props.toWarehouseId,
    props.fromWarehouseName,
    props.toWarehouseName,
  ],
  () => {
    if (props.disabled) {
      return;
    }
    if (tableData.value.length === 0) {
      return;
    }
    tableData.value.forEach((row) => {
      row.fromWarehouseId = props.fromWarehouseId;
      row.fromWarehouseName = props.fromWarehouseName;
      row.toWarehouseId = props.toWarehouseId;
      row.toWarehouseName = props.toWarehouseName;
    });
    emitItemsUpdate(true);
  },
);

function nextSeq() {
  let maxSeq = 0;
  for (const item of tableData.value) {
    maxSeq = Math.max(maxSeq, Number(item.seq) || 0);
  }
  return maxSeq + 1;
}

function canDeleteItemRow(row?: ErpWarehouseMoveApi.WarehouseMoveItem) {
  return Boolean(row && !props.disabled);
}

function clearItemSelection() {
  selectedDeleteItemRows.value = [];
  gridApi.grid?.clearCheckboxRow?.();
  gridApi.grid?.clearCheckboxReserve?.();
}

function initRow(
  row: ErpWarehouseMoveApi.WarehouseMoveItem,
  options: { forceNewRowKey?: boolean } = {},
) {
  itemRowKeyManager.ensureRowKey(row, {
    forceNew: options.forceNewRowKey,
  });
  const saved = {
    totalPrice: row.totalPrice,
    costAmount: row.costAmount,
    totalWeight: row.totalWeight,
  };
  refreshRowAmount(row);
  for (const field of ['totalPrice', 'costAmount', 'totalWeight'] as const) {
    if (saved[field] != null) row[field] = saved[field];
  }
  setCountText(row);
  return row;
}

function setCountText(row: ErpWarehouseMoveApi.WarehouseMoveItem) {
  if (editedCountKeys.has(getItemRowKey(row))) return;
  countInputTextByRowKey.set(
    getItemRowKey(row),
    formatWarehouseMoveCountInput(row.count),
  );
}

function getCountText(row: ErpWarehouseMoveApi.WarehouseMoveItem) {
  const rowKey = getItemRowKey(row);
  const cachedText = countInputTextByRowKey.get(rowKey);
  if (cachedText !== undefined) {
    return cachedText;
  }
  const formattedText = formatWarehouseMoveCountInput(row.count);
  countInputTextByRowKey.set(rowKey, formattedText);
  return formattedText;
}

function handleCountTextInput(
  row: ErpWarehouseMoveApi.WarehouseMoveItem,
  value: string,
) {
  if (!/^\d*(\.\d*)?$/.test(value)) {
    countInputErrors.value[getItemRowKey(row)] = true;
    return;
  }
  editedCountKeys.add(getItemRowKey(row));
  countInputTextByRowKey.set(getItemRowKey(row), value);
  delete countInputErrors.value[getItemRowKey(row)];
}

function handleCountBlur(row: ErpWarehouseMoveApi.WarehouseMoveItem) {
  const parsed = parseWarehouseMoveCountText(getCountText(row));
  if (!parsed.ok) {
    countInputErrors.value[getItemRowKey(row)] = true;
    message.warning(parsed.message);
    return;
  }
  const changed = !stockDecimal(row.count ?? 0).eq(parsed.value);
  if (changed) {
    row.count = normalizeWarehouseMoveCount(parsed.value);
    handleRowChange(row);
  }
  setCountText(row);
}

function emitItemsUpdate(skipReload = false) {
  internalFieldUpdate = skipReload;
  const items = [...tableData.value];
  lastEmittedItems = skipReload ? items : undefined;
  emit('update:items', items);
}

function refreshRowAmount(row: ErpWarehouseMoveApi.WarehouseMoveItem) {
  const count = row.count || 0;
  const costPrice = row.costPrice || 0;
  const productPrice = row.productPrice ?? row.costPrice ?? 0;
  const weight = row.weight || 0;
  row.productPrice = productPrice;
  row.costAmount = erpPriceMultiply(costPrice, count) ?? 0;
  row.totalPrice = erpPriceMultiply(productPrice, count) ?? 0;
  row.totalWeight = erpPriceMultiply(weight, count) ?? 0;
}

function handleRowChange(row: ErpWarehouseMoveApi.WarehouseMoveItem) {
  refreshRowAmount(row);
  itemRowKeyManager.ensureRowKey(row);
  const index = tableData.value.findIndex(
    (item) => getItemRowKey(item) === getItemRowKey(row),
  );
  if (index === -1) {
    tableData.value.push(row);
    emitItemsUpdate(false);
    return;
  }
  tableData.value[index] = row;
  emitItemsUpdate(true);
}

function handleDelete(row: ErpWarehouseMoveApi.WarehouseMoveItem) {
  deleteItemRows([row]);
}

function buildDuplicateKey(
  row: Partial<ErpWarehouseMoveApi.WarehouseMoveItem>,
) {
  return `${row.productId || ''}-${props.fromWarehouseId || ''}-${props.toWarehouseId || ''}-${row.fromShelf || ''}`;
}

function deleteItemRows(rows: ErpWarehouseMoveApi.WarehouseMoveItem[]) {
  const keys = new Set(rows.map((row) => getItemRowKey(row)).filter(Boolean));
  if (keys.size === 0) {
    return;
  }
  tableData.value = tableData.value.filter(
    (item) => !keys.has(getItemRowKey(item)),
  );
  keys.forEach((key) => countInputTextByRowKey.delete(key));
  clearItemSelection();
  emitItemsUpdate(false);
  void refreshItemGrid();
}

function getItemRowKey(row?: Partial<ErpWarehouseMoveApi.WarehouseMoveItem>) {
  if (!row) return '';
  return itemRowKeyManager.ensureRowKey(row);
}

function getProductInputValue(row: ErpWarehouseMoveApi.WarehouseMoveItem) {
  return row.productName || row.productCode || '';
}

function handleProductKeywordInput(
  row: ErpWarehouseMoveApi.WarehouseMoveItem,
  value: string,
) {
  row.productName = value;
  if (!value) {
    row.productId = undefined;
    row.productCode = undefined;
  }
}

function canOpenWarehouseMoveStockSelect() {
  if (!props.fromWarehouseId || !props.toWarehouseId) {
    message.warning('请先选择移出仓库和移入仓库');
    return false;
  }
  if (props.fromWarehouseId === props.toWarehouseId) {
    message.warning('移出仓库和移入仓库不能相同');
    return false;
  }
  return true;
}

function getInlineStockPageParams() {
  return {
    bizType: 'stock',
    warehouseId: props.fromWarehouseId,
  };
}

function focusProductNameInput(row: ErpWarehouseMoveApi.WarehouseMoveItem) {
  if (props.disabled) {
    return false;
  }
  return focusEditableInputByRowKey(
    itemTableWrapRef.value,
    WAREHOUSE_MOVE_PRODUCT_SELECT_INPUT_SELECTOR,
    getItemRowKey(row),
    'data-erp-inline-stock-row-key',
  );
}

const itemRowFocusController = createErpItemRowFocusController({
  focusField: (row: ErpWarehouseMoveApi.WarehouseMoveItem, field) =>
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
  if (props.disabled || !canOpenWarehouseMoveStockSelect()) {
    return;
  }
  const row = initRow(
    {
      seq: nextSeq(),
      count: 1,
      fromWarehouseId: props.fromWarehouseId,
      fromWarehouseName: props.fromWarehouseName,
      toWarehouseId: props.toWarehouseId,
      toWarehouseName: props.toWarehouseName,
    } as ErpWarehouseMoveApi.WarehouseMoveItem,
    { forceNewRowKey: true },
  );
  if (props.remotePaging) {
    emit('append-items', [row], 'product');
    return;
  }
  tableData.value = [...tableData.value, row];
  emitItemsUpdate(false);
  await itemRowFocusController.focus(row, 'product');
}

async function buildWarehouseMoveItemFromStock(
  stock: ErpStockApi.Stock,
  overrides: Partial<ErpWarehouseMoveApi.WarehouseMoveItem> = {},
) {
  const row: ErpWarehouseMoveApi.WarehouseMoveItem = initRow(
    {
      batchNo: stock.batchNoSummary ?? stock.batchNo,
      brand: stock.brand,
      costPrice: stock.costPrice || stock.purchasePrice || 0,
      count: stock.count || 0,
      drawingNo: stock.drawingNo,
      featureCode: stock.featureCode,
      fromShelf: stock.shelf,
      fromStockCount: stock.count || 0,
      fromWarehouseId: props.fromWarehouseId,
      fromWarehouseName: props.fromWarehouseName || stock.warehouseName,
      originPlace: stock.originPlace,
      productBarCode: stock.productBarCode,
      productCode: stock.productCode,
      productId: stock.productId,
      productName: stock.productName,
      productPrice: stock.costPrice || stock.purchasePrice || 0,
      packageQty: stock.packageQty,
      productUnitId: stock.unitId,
      productUnitName: stock.unitName,
      seq: nextSeq(),
      standard: stock.standard,
      toStockCount: await getToStockCount(stock.productId),
      toWarehouseId: props.toWarehouseId,
      toWarehouseName: props.toWarehouseName,
      vehicleModel: stock.vehicleModel,
      weight: stock.weight || 0,
      ...overrides,
    } as ErpWarehouseMoveApi.WarehouseMoveItem,
    { forceNewRowKey: true },
  );
  copyPriceReferenceFields(row, stock);
  refreshRowAmount(row);
  return row;
}

async function buildReplacementWarehouseMoveItemFromStock(
  targetRow: ErpWarehouseMoveApi.WarehouseMoveItem,
  stock: ErpStockApi.Stock,
) {
  const row = await buildWarehouseMoveItemFromStock(stock, {
    id: targetRow.id,
    seq: targetRow.seq ?? nextSeq(),
    toShelf: targetRow.toShelf,
    remark: targetRow.remark,
  });
  (row as any).warehouseMoveId = (targetRow as any).warehouseMoveId;
  (row as any).moveId = (targetRow as any).moveId;
  const generatedRowKey = getItemRowKey(row);
  row.clientRowKey = targetRow.clientRowKey ?? row.clientRowKey;
  if (generatedRowKey !== row.clientRowKey) {
    countInputTextByRowKey.delete(generatedRowKey);
    setCountText(row);
  }
  return row;
}

function filterReviewableStocks(
  targetRow: ErpWarehouseMoveApi.WarehouseMoveItem,
  rows: ErpStockApi.Stock[],
  showWarning = true,
) {
  const targetRowKey = getItemRowKey(targetRow);
  const existingKeys = new Set(
    tableData.value
      .filter((item) => getItemRowKey(item) !== targetRowKey)
      .map((item) => buildDuplicateKey(item)),
  );
  const selected: ErpStockApi.Stock[] = [];
  for (const stock of rows) {
    const key = buildDuplicateKey({
      productId: stock.productId,
      fromShelf: stock.shelf,
    });
    if (existingKeys.has(key)) continue;
    existingKeys.add(key);
    selected.push(stock);
  }
  if (showWarning && selected.length === 0) {
    message.warning('选中的库存已在明细中');
  }
  return selected;
}

async function insertStockProducts(
  targetRow: ErpWarehouseMoveApi.WarehouseMoveItem,
  rows: ErpStockApi.Stock[],
) {
  if (!rows || rows.length === 0 || !canOpenWarehouseMoveStockSelect()) {
    return;
  }
  const targetRowKey = getItemRowKey(targetRow);
  const selected = filterReviewableStocks(targetRow, rows);
  if (selected.length === 0) {
    return;
  }
  const replacement = await buildReplacementWarehouseMoveItemFromStock(
    targetRow,
    selected[0]!,
  );
  const appendSeqStart = nextSeq();
  const additionalRows = await Promise.all(
    selected.slice(1).map((stock, index) =>
      buildWarehouseMoveItemFromStock(stock, {
        seq: appendSeqStart + index,
      }),
    ),
  );
  const targetIndex = tableData.value.findIndex(
    (item) => getItemRowKey(item) === targetRowKey,
  );
  if (targetIndex === -1) {
    tableData.value.push(replacement);
  } else {
    tableData.value.splice(targetIndex, 1, replacement);
  }
  if (additionalRows.length > 0 && !props.remotePaging) {
    tableData.value.push(...additionalRows);
  }
  if (props.remotePaging && additionalRows.length > 0) {
    emitItemsUpdate(false);
    emit('append-items', additionalRows, 'count', replacement);
    return;
  }
  emitItemsUpdate(false);
  await itemRowFocusController.focus(replacement, 'count');
}

async function handleInlineStockSelected(
  row: ErpWarehouseMoveApi.WarehouseMoveItem,
  stocks: ErpStockApi.Stock[],
) {
  await insertStockProducts(row, stocks);
}

function handleInlineStockOpenChange(open: boolean) {
  inlineStockSelectorOpen.value = open;
}

function handleBatchDeleteItems() {
  const rows = selectedDeleteItemRows.value.filter((row) =>
    canDeleteItemRow(row),
  );
  if (rows.length === 0) {
    message.warning('请先勾选需要删除的移货明细');
    return;
  }
  Modal.confirm({
    title: `确认删除选中的 ${rows.length} 条移货明细吗？`,
    onOk: async () => {
      deleteItemRows(rows);
      selectedDeleteItemRows.value = [];
    },
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
    WAREHOUSE_MOVE_ITEM_COUNT_INPUT_SELECTOR,
  );
}

function focusItemCountInput(row: ErpWarehouseMoveApi.WarehouseMoveItem) {
  return focusEditableInputByRowKey(
    itemTableWrapRef.value,
    WAREHOUSE_MOVE_ITEM_COUNT_INPUT_SELECTOR,
    getItemRowKey(row),
  );
}

function queueFocusFirstItemCountInput() {
  if (props.disabled) {
    return;
  }
  void nextTick(() =>
    queueAfterEditableControlRender(focusFirstItemCountInput),
  );
}

function handleItemInputPressEnter(event: KeyboardEvent) {
  const enterFocusResult = focusNextInputOnEnter(event);
  if (enterFocusResult === 'last-input') {
    emit('request-submit', event);
  }
}

async function getToStockCount(productId?: number) {
  if (!productId || !props.toWarehouseId) {
    return 0;
  }
  return (
    (await getWarehouseStockCount({
      decimalMode: 'string',
      productId,
      warehouseId: props.toWarehouseId,
    })) || '0'
  );
}

function validate(
  items = tableData.value,
  options: { requireItems?: boolean } = {},
) {
  if ((options.requireItems ?? true) && items.length === 0) {
    throw new Error('请至少选择一条库存明细');
  }
  const keys = new Set<string>();
  for (const [i, item] of items.entries()) {
    if (!item?.productId) {
      throw new Error(`第 ${i + 1} 行：产品不能为空`);
    }
    const countParsed = parseWarehouseMoveCountText(getCountText(item));
    if (!countParsed.ok) {
      throw new Error(`第 ${i + 1} 行：${countParsed.message}`);
    }
    if (!stockDecimal(item.count ?? 0).eq(countParsed.value)) {
      item.count = normalizeWarehouseMoveCount(countParsed.value);
      refreshRowAmount(item);
    }
    setCountText(item);
    if (!item.count || stockDecimal(item.count).lte(0)) {
      throw new Error(`第 ${i + 1} 行：移货数量必须大于 0`);
    }
    if (
      item.fromStockCount != null &&
      stockDecimal(item.count).gt(item.fromStockCount)
    ) {
      throw new Error(`第 ${i + 1} 行：移货数量不能超过移出库存`);
    }
    const key = buildDuplicateKey(item);
    if (keys.has(key)) {
      throw new Error(`第 ${i + 1} 行：产品、仓库和移出货架重复`);
    }
    keys.add(key);
  }
}

function flushInputs() {
  for (const row of tableData.value) {
    const parsed = parseWarehouseMoveCountText(getCountText(row));
    if (!parsed.ok) throw new Error(parsed.message);
    if (!stockDecimal(row.count ?? 0).eq(parsed.value)) {
      row.count = parsed.value;
      refreshRowAmount(row);
    }
    setCountText(row);
  }
}
function getItems() {
  flushInputs();
  return tableData.value.map((item) => {
    const parsed = parseWarehouseMoveCountText(getCountText(item));
    if (parsed.ok && !stockDecimal(item.count ?? 0).eq(parsed.value)) {
      item.count = normalizeWarehouseMoveCount(parsed.value);
      refreshRowAmount(item);
    }
    return { ...item };
  });
}

async function reloadItems(
  items: ErpWarehouseMoveApi.WarehouseMoveItem[] = props.items,
) {
  countInputTextByRowKey.clear();
  editedCountKeys.clear();
  const nextRows = items.map((item, index) =>
    initRow({
      ...item,
      seq: item.seq ?? item.id ?? index + 1,
    }),
  );
  itemRowKeyManager.ensureRowKeys(nextRows);
  tableData.value = nextRows;
  await nextTick();
  await refreshItemGrid();
}

defineExpose({
  flushInputs,
  focusItemRow: (
    row: ErpWarehouseMoveApi.WarehouseMoveItem,
    field: 'count' | 'product',
  ) => itemRowFocusController.focus(row, field),
  getItems,
  queueFocusFirstItemCountInput,
  reloadItems,
  validate,
});

function handleGlobalInsertShortcut(event: KeyboardEvent) {
  if (
    detailActions.value?.isBlockedForPrice() ||
    props.disabled ||
    inlineStockSelectorOpen.value ||
    priceReferenceOpen.value ||
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

onMounted(() => {
  window.addEventListener('keydown', handleGlobalInsertShortcut, true);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalInsertShortcut, true);
});
</script>

<template>
  <div class="warehouse-move-item-form w-full">
    <div
      ref="itemTableWrapRef"
      tabindex="-1"
      @mousedown="detailActions?.pointer($event)"
      class="warehouse-move-item-table-wrap relative"
    >
      <Grid class="warehouse-move-item-grid w-full">
        <template #toolbar-buttons>
          <StockItemDetailActions
            ref="detailActions"
            :active-row="activeItemRow"
            :dept-id="deptId"
            :hidden-fields="hiddenFields"
            :wrapper="itemTableWrapRef"
            :blocked="inlineStockSelectorOpen || priceReferenceOpen"
            :enabled="true"
            @product-updated="itemColumns.reload()"
          />
          <div class="stock-document-item-shortcut-hint">
            <span class="stock-document-item-shortcut-hint__label">当前页</span>
            <span><kbd>W</kbd><b>全部价格</b></span>
          </div>
        </template>
        <template #toolbar-tools>
          <div class="warehouse-move-item-toolbar flex items-center gap-2">
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
          </div>
        </template>
        <template #productName="{ row }">
          <ErpInlineStockSelect
            candidate-focus-highlight
            preserve-quantity-precision
            v-if="!disabled"
            :key="`${fromWarehouseId ?? ''}:${toWarehouseId ?? ''}`"
            :value="getProductInputValue(row)"
            settings-scope="stock-warehouse-move"
            :row="row"
            :row-key="getItemRowKey(row)"
            :before-open="canOpenWarehouseMoveStockSelect"
            :hidden-fields="hiddenFields"
            :stock-page-api="getStockPage"
            :stock-page-params="getInlineStockPageParams()"
            :require-dept="false"
            @open-change="handleInlineStockOpenChange"
            @select="(stocks) => handleInlineStockSelected(row, stocks)"
            @update:value="(value) => handleProductKeywordInput(row, value)"
          />
          <span v-else>{{ row.productName || '-' }}</span>
        </template>
        <template #count="{ row }">
          <Input
            v-if="!disabled"
            :value="getCountText(row)"
            type="text"
            :status="countInputErrors[getItemRowKey(row)] ? 'error' : undefined"
            class="w-full"
            :data-erp-item-row-key="getItemRowKey(row)"
            data-warehouse-move-count-input="true"
            inputmode="decimal"
            @blur="handleCountBlur(row)"
            @press-enter="handleItemInputPressEnter"
            @update:value="(value) => handleCountTextInput(row, value)"
          />
          <span v-else>{{ formatStockNaturalNumber(row.count) || '-' }}</span>
        </template>
        <template #toShelf="{ row }">
          <Input
            v-if="!disabled"
            v-model:value="row.toShelf"
            class="w-full"
            @change="handleRowChange(row)"
            @press-enter="handleItemInputPressEnter"
          />
          <span v-else>{{ row.toShelf || '-' }}</span>
        </template>
        <template #remark="{ row }">
          <Input
            v-if="!disabled"
            v-model:value="row.remark"
            class="w-full"
            @change="handleRowChange(row)"
            @press-enter="handleItemInputPressEnter"
          />
          <span v-else>{{ row.remark || '-' }}</span>
        </template>
        <template #actions="{ row }">
          <TableAction
            v-if="!disabled"
            :actions="[
              {
                label: '删除',
                icon: 'lucide:trash-2',
                type: 'link',
                danger: true,
                popConfirm: {
                  title: '确认删除该明细吗？',
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
    <div v-if="showItemPager" class="warehouse-move-item-pager">
      <Pagination
        class="erp-candidate-focus-popup"
        :current="effectiveItemPagination.pageNo"
        :page-size="effectiveItemPagination.pageSize"
        :page-size-options="ITEM_PAGE_SIZE_OPTIONS"
        :show-quick-jumper="true"
        :show-size-changer="true"
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
:deep(.warehouse-move-item-form .vxe-table--render-default),
:deep(.warehouse-move-item-form .ant-input),
:deep(.warehouse-move-item-form .ant-input-number),
:deep(.warehouse-move-item-form .ant-input-number-input),
:deep(.warehouse-move-item-form .ant-btn) {
  font-size: 11px;
}

:deep(.warehouse-move-item-grid .vxe-table--render-default) {
  font-size: 11px;
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

:deep(.warehouse-move-item-grid .ant-input),
:deep(.warehouse-move-item-grid .ant-input-number),
:deep(.warehouse-move-item-grid .ant-input-number-input),
:deep(.warehouse-move-item-grid .ant-btn) {
  font-size: 11px;
}

:deep(.warehouse-move-item-grid .vxe-header--column .vxe-cell--title) {
  white-space: nowrap;
}

:deep(
  .warehouse-move-item-grid .vxe-header--column.is--sortable .vxe-cell--title
) {
  color: #1677ff;
}

:deep(.warehouse-move-item-grid .vxe-header--column .vxe-cell--sort) {
  display: none;
}

.warehouse-move-item-pager {
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
}

.warehouse-move-item-pager :deep(.ant-pagination),
.warehouse-move-item-pager :deep(.ant-pagination-item),
.warehouse-move-item-pager :deep(.ant-pagination-total-text),
.warehouse-move-item-pager :deep(.ant-pagination-options),
.warehouse-move-item-pager :deep(.ant-select),
.warehouse-move-item-pager :deep(.ant-input) {
  font-size: 11px;
}

.warehouse-move-item-pager :deep(.ant-pagination-item),
.warehouse-move-item-pager :deep(.ant-pagination-prev),
.warehouse-move-item-pager :deep(.ant-pagination-next),
.warehouse-move-item-pager :deep(.ant-pagination-jump-prev),
.warehouse-move-item-pager :deep(.ant-pagination-jump-next) {
  min-width: 24px;
  height: 24px;
  line-height: 22px;
}

.warehouse-move-item-pager :deep(.ant-pagination-item a),
.warehouse-move-item-pager :deep(.ant-pagination-prev button),
.warehouse-move-item-pager :deep(.ant-pagination-next button) {
  height: 22px;
  font-size: 11px;
  line-height: 22px;
}

.warehouse-move-item-pager :deep(.ant-pagination-options-size-changer),
.warehouse-move-item-pager :deep(.ant-select-single),
.warehouse-move-item-pager :deep(.ant-select-selector) {
  height: 24px;
  line-height: 22px;
}

.warehouse-move-item-pager
  :deep(.ant-pagination-options-size-changer .ant-select-selector) {
  box-sizing: border-box;
  align-items: center;
  min-height: 24px;
  padding: 0 24px 0 8px;
}

.warehouse-move-item-pager
  :deep(.ant-select-single .ant-select-selector .ant-select-selection-item) {
  height: 22px;
  font-size: 11px;
  line-height: 22px;
}

.warehouse-move-item-pager :deep(.ant-select-arrow) {
  margin-top: -5px;
  font-size: 10px;
}

.warehouse-move-item-pager :deep(.ant-pagination-options-quick-jumper input) {
  height: 24px;
  padding: 0 7px;
  font-size: 11px;
  line-height: 22px;
}
</style>
