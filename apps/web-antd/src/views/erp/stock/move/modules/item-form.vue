<script lang="ts" setup>
/* eslint-disable vue/custom-event-name-casing -- Preserve existing stock form events. */
import type { ErpStockMoveApi } from '#/api/erp/stock/move';
import type { ErpStockApi } from '#/api/erp/stock/stock';

import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  provide,
  ref,
  watch,
} from 'vue';

import { Button, Input, Modal, Pagination } from 'ant-design-vue';

import { TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import { getStockCount, getStockPage } from '#/api/erp/stock/stock';
import {
  getStockMoveFromWarehouseSimplePage,
  getWarehouse,
  getWarehouseSimplePage,
} from '#/api/erp/stock/warehouse';
import ErpInlineStockSelect from '#/views/erp/components/ErpInlineStockSelect.vue';
import ErpLazyPageSelect from '#/views/erp/components/ErpLazyPageSelect.vue';
import ItemPriceReferenceOverlay from '#/views/erp/components/ItemPriceReferenceOverlay.vue';
import {
  CURRENT_SELECT_LABEL_PLACEHOLDER,
  isMissingStockDocumentDisplayName,
  isResolvedStockDocumentOption,
  mergeResolvedStockDocumentOptions,
  mergeStockDocumentOption,
} from '#/views/erp/stock/utils/document-form-ui';
import { prepareStockDocumentItemColumns } from '#/views/erp/stock/utils/document-item-table';
import { createStockItemClientRowKeyManager } from '#/views/erp/stock/utils/item-row-key';
import {
  stockDecimal,
  stockInput,
  validateStockStorage,
} from '#/views/erp/stock/utils/stock-decimal';
import {
  stockNatural as erpCountInputFormatter,
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

const props = withDefaults(defineProps<Props>(), {
  items: () => [],
  disabled: false,
  hiddenFields: () => [],
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
  'append-items',
  'page-change',
  'request-submit',
  'update:items',
]);

provide(CANDIDATE_FOCUS_KEY, ref(true));

interface Props {
  items?: ErpStockMoveApi.StockMoveItem[];
  disabled?: boolean;
  hiddenFields?: string[];
  itemPageLoading?: boolean;
  itemPagination?: StockMoveItemPagination;
  remotePaging?: boolean;
}

type StockMoveFormItem = Partial<ErpStockMoveApi.StockMoveItem> & {
  productPurchasePrice?: number;
  productSharePrice?: number;
  seq?: number | string;
};

type StockMoveItemPagination = {
  orderDirection?: 'asc' | 'desc';
  orderField?: string;
  pageNo: number;
  pageSize: number;
  total: number;
};

const STOCK_MOVE_ITEM_COUNT_INPUT_SELECTOR =
  '[data-stock-move-count-input="true"]';
const STOCK_MOVE_PRODUCT_SELECT_INPUT_SELECTOR =
  '[data-erp-inline-stock-select-input="true"]';

const DEFAULT_ITEM_PAGE_SIZE = 10;
const ITEM_PAGE_SIZE_OPTIONS = ['10', '20', '50', '100', '200'];
const ITEM_TABLE_VISIBLE_ROWS = 10;
const ITEM_TABLE_HEADER_HEIGHT = 40;
const ITEM_TABLE_ROW_HEIGHT = 40;
const ITEM_TABLE_HEIGHT =
  ITEM_TABLE_HEADER_HEIGHT + ITEM_TABLE_ROW_HEIGHT * ITEM_TABLE_VISIBLE_ROWS;

const tableData = ref<StockMoveFormItem[]>([]); // 表格数据
const itemRowKeyManager = createStockItemClientRowKeyManager('stock-move');
const inlineStockSelectorOpen = ref(false);
const { itemTableWrapRef, priceReferenceOpen } = useItemPriceReferenceShortcut({
  isBlocked: () => inlineStockSelectorOpen.value,
});
const fromWarehouseOptions = ref<any[]>([]); // 调出仓库下拉选项
const toWarehouseOptions = ref<any[]>([]); // 调入仓库下拉选项
const warehouseOptions = computed(() =>
  mergeOptionLists(fromWarehouseOptions.value, toWarehouseOptions.value),
);
const localItemPage = ref({ pageNo: 1, pageSize: DEFAULT_ITEM_PAGE_SIZE });
const selectedItemRows = ref<StockMoveFormItem[]>([]);
const selectedDeleteItemRows = computed(() =>
  selectedItemRows.value.filter((value) => canDeleteItemRow(value)),
);
const selectedDeleteItemCount = computed(
  () => selectedDeleteItemRows.value.length,
);
const canShowItemSelection = computed(() => !props.disabled);
const effectiveItemPagination = computed(() =>
  props.remotePaging
    ? props.itemPagination
    : {
        orderDirection: undefined,
        orderField: undefined,
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

function canDeleteItemRow(row?: StockMoveFormItem) {
  return Boolean(row && !props.disabled);
}

function getDisplayedItems() {
  const rows = [...tableData.value];
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
  const columns = buildItemColumns(undefined, displayData);
  gridApi.setGridOptions({ columns, data: displayData, fit: false });
  await gridApi.grid.reloadColumn(columns);
  await gridApi.grid.reloadData(displayData);
}

async function handleItemPageChange(pageNo: number, pageSize: number) {
  if (props.remotePaging) {
    emit('page-change', { pageNo, pageSize });
    return;
  }
  localItemPage.value = { pageNo, pageSize };
  await refreshItemGrid();
}

function buildItemColumns(
  hiddenFields = props.hiddenFields,
  rows = getDisplayedItems(),
) {
  const columns = useFormItemColumns(props.disabled, hiddenFields) || [];
  if (canShowItemSelection.value) {
    columns.unshift({
      fixed: 'left',
      type: 'checkbox',
      width: 44,
    } as any);
  }
  return prepareStockDocumentItemColumns(columns as any[], {
    editable: !props.disabled,
    rows,
  });
}

/** 表格配置 */
const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: buildItemColumns(),
    customConfig: {
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
    id: 'erp-stock-move-item-list-v1',
    autoResize: true,
    border: true,
    rowConfig: {
      keyField: 'clientRowKey',
      isHover: true,
      isCurrent: true,
    },
    checkboxConfig: {
      checkMethod: ({ row }: { row: StockMoveFormItem }) =>
        canDeleteItemRow(row),
    },
    pagerConfig: {
      enabled: false,
    },
    toolbarConfig: {
      enabled: true,
      slots: { buttons: 'toolbar-buttons', tools: 'toolbar-tools' },
    },
  },
  gridEvents: {
    checkboxAll: ({ records }: { records: StockMoveFormItem[] }) => {
      selectedItemRows.value = records.filter((value) =>
        canDeleteItemRow(value),
      );
    },
    checkboxChange: ({ records }: { records: StockMoveFormItem[] }) => {
      selectedItemRows.value = records.filter((value) =>
        canDeleteItemRow(value),
      );
    },
  },
});

watch(
  () => props.hiddenFields,
  async (hiddenFields) => {
    await nextTick();
    await gridApi.grid.reloadColumn(buildItemColumns(hiddenFields));
    await refreshItemGrid();
  },
  { deep: true },
);

/** 监听外部传入的列数据 */
watch(
  () => props.items,
  async (items) => {
    if (!items) {
      return;
    }
    const nextRows = items.map((item, index) => {
      const row = {
        ...item,
        seq: (item as StockMoveFormItem).seq ?? index + 1,
      } as StockMoveFormItem;
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
    mergeCurrentItemOptions();
    hydrateCurrentWarehouseNamesFromOptions();
    await hydrateMissingWarehouseNamesFromApi();
    await nextTick(); // 特殊：保证 gridApi 已经初始化
    await refreshItemGrid();
  },
  {
    immediate: true,
  },
);

watch(
  () => props.itemPageLoading,
  (loading) => {
    gridApi.setLoading(loading);
  },
  { immediate: true },
);

/** 处理删除 */
function handleDelete(row: StockMoveFormItem) {
  deleteItemRows([row]);
}

function clearItemSelection() {
  selectedItemRows.value = [];
  gridApi.grid?.clearCheckboxRow?.();
  gridApi.grid?.clearCheckboxReserve?.();
}

function deleteItemRows(rows: StockMoveFormItem[]) {
  if (rows.length === 0 || props.disabled) {
    return;
  }
  const rowKeySet = new Set(rows.map((row) => getItemRowKey(row)));
  tableData.value = tableData.value.filter(
    (item) => !rowKeySet.has(getItemRowKey(item)),
  );
  clearItemSelection();
  emit('update:items', [...tableData.value]);
  void refreshItemGrid();
}

/** 处理调出仓库变更 */
async function handleFromWarehouseChange(
  warehouseId: any,
  row: any,
  option?: any,
) {
  if (!warehouseId) {
    row.fromWarehouseId = undefined;
    row.fromWarehouseName = undefined;
    row.fromWarehouseDeptId = undefined;
    row.fromWarehouseDeptName = undefined;
    handleRowChange(row);
    return;
  }
  const selected = Array.isArray(option) ? option[0] : option;
  const warehouse =
    normalizeWarehouseOption(selected) ||
    findWarehouseOption(fromWarehouseOptions.value, warehouseId) ||
    (await getWarehouse(Number(warehouseId)).catch(() => undefined));
  if (!warehouse) {
    return;
  }
  handleWarehouseOptionsChange('from', [warehouse]);
  row.fromWarehouseId = warehouseId;
  row.fromWarehouseName = warehouse.name;
  row.fromWarehouseDeptId = warehouse.deptId;
  row.fromWarehouseDeptName = warehouse.deptName;
  // 如果已选择产品，重新获取库存
  if (row.productId) {
    row.stockCount = (await getStockCount(row.productId, warehouseId)) || 0;
  }
  refreshRowProductPrice(row, undefined, false);
  handleRowChange(row);
}

/** 处理调入仓库变更 */
async function handleToWarehouseChange(
  warehouseId: any,
  row: any,
  option?: any,
) {
  if (!warehouseId) {
    row.toWarehouseId = undefined;
    row.toWarehouseName = undefined;
    row.toWarehouseDeptId = undefined;
    row.toWarehouseDeptName = undefined;
    handleRowChange(row);
    return;
  }
  const selected = Array.isArray(option) ? option[0] : option;
  const warehouse =
    normalizeWarehouseOption(selected) ||
    findWarehouseOption(toWarehouseOptions.value, warehouseId) ||
    (await getWarehouse(Number(warehouseId)).catch(() => undefined));
  if (!warehouse) {
    return;
  }
  handleWarehouseOptionsChange('to', [warehouse]);
  row.toWarehouseId = warehouseId;
  row.toWarehouseName = warehouse.name;
  row.toWarehouseDeptId = warehouse.deptId;
  row.toWarehouseDeptName = warehouse.deptName;
  refreshRowProductPrice(row, undefined, false);
  handleRowChange(row);
}

function getWarehouseDeptId(warehouseId?: number) {
  return warehouseOptions.value.find((item) => item.id === warehouseId)?.deptId;
}

function isCrossDeptMove(fromWarehouseId?: number, toWarehouseId?: number) {
  const fromDeptId = getWarehouseDeptId(fromWarehouseId);
  const toDeptId = getWarehouseDeptId(toWarehouseId);
  return !!fromDeptId && !!toDeptId && fromDeptId !== toDeptId;
}

function refreshRowProductPrice(
  row: any,
  selectedProduct?: ErpStockApi.Stock,
  overwrite = false,
) {
  if (
    !overwrite &&
    row.productPrice !== undefined &&
    row.productPrice !== null
  ) {
    return;
  }
  const purchasePrice =
    selectedProduct?.lastPurchasePrice ?? row.productPurchasePrice;
  const sharePrice = selectedProduct?.sharePrice ?? row.productSharePrice;
  if (purchasePrice === undefined && sharePrice === undefined) {
    return;
  }
  row.productPrice = isCrossDeptMove(row.fromWarehouseId, row.toWarehouseId)
    ? (sharePrice ?? row.productPrice ?? purchasePrice ?? 0)
    : purchasePrice || 0;
}

/** 处理行数据变更 */
function handleRowChange(row: any) {
  row.seq = row.seq ?? nextSeq();
  itemRowKeyManager.ensureRowKey(row);
  refreshRowAmount(row);
  const index = tableData.value.findIndex(
    (item) => getItemRowKey(item) === getItemRowKey(row),
  );
  if (index === -1) {
    tableData.value.push(row);
  } else {
    tableData.value[index] = row;
  }
  emit('update:items', [...tableData.value]);
}

function refreshRowAmount(row: any) {
  row.totalPrice = erpPriceMultiply(row.productPrice || 0, row.count || 0) ?? 0;
}

/** 初始化行数据 */
function initRow(row: StockMoveFormItem) {
  if (row.productPrice && row.count) {
    row.totalPrice = erpPriceMultiply(row.productPrice, row.count) ?? 0;
  }
}

function mergeCurrentItemOptions() {
  let nextFromOptions = fromWarehouseOptions.value;
  let nextToOptions = toWarehouseOptions.value;
  tableData.value.forEach((item) => {
    if (
      item.fromWarehouseId &&
      !isMissingStockDocumentDisplayName(
        item.fromWarehouseName,
        item.fromWarehouseId,
      )
    ) {
      nextFromOptions = mergeStockDocumentOption(nextFromOptions, {
        id: item.fromWarehouseId,
        label: item.fromWarehouseName,
        name: item.fromWarehouseName,
        deptId: item.fromWarehouseDeptId,
        deptName: item.fromWarehouseDeptName,
        value: item.fromWarehouseId,
      }) as any[];
    }
    if (
      item.toWarehouseId &&
      !isMissingStockDocumentDisplayName(
        item.toWarehouseName,
        item.toWarehouseId,
      )
    ) {
      nextToOptions = mergeStockDocumentOption(nextToOptions, {
        id: item.toWarehouseId,
        label: item.toWarehouseName,
        name: item.toWarehouseName,
        deptId: item.toWarehouseDeptId,
        deptName: item.toWarehouseDeptName,
        value: item.toWarehouseId,
      }) as any[];
    }
  });
  fromWarehouseOptions.value = nextFromOptions;
  toWarehouseOptions.value = nextToOptions;
}

function mergeOptionLists(...optionLists: any[][]) {
  const optionMap = new Map<number, any>();
  optionLists.flat().forEach((item) => {
    if (
      item?.id &&
      isResolvedStockDocumentOption(item) &&
      !optionMap.has(item.id)
    ) {
      optionMap.set(item.id, item);
    }
  });
  return [...optionMap.values()];
}

function findWarehouseOption(options: any[], warehouseId?: number) {
  return options.find((item) => String(item.id) === String(warehouseId));
}

function getFromWarehouseLabel(row: StockMoveFormItem) {
  return (
    (isMissingStockDocumentDisplayName(
      row.fromWarehouseName,
      row.fromWarehouseId,
    )
      ? undefined
      : row.fromWarehouseName) ||
    findWarehouseOption(fromWarehouseOptions.value, row.fromWarehouseId)
      ?.name ||
    '-'
  );
}

function getToWarehouseLabel(row: StockMoveFormItem) {
  return (
    (isMissingStockDocumentDisplayName(row.toWarehouseName, row.toWarehouseId)
      ? undefined
      : row.toWarehouseName) ||
    findWarehouseOption(toWarehouseOptions.value, row.toWarehouseId)?.name ||
    '-'
  );
}

function hydrateCurrentWarehouseNamesFromOptions() {
  let changed = false;
  tableData.value.forEach((item) => {
    if (
      item.fromWarehouseId &&
      isMissingStockDocumentDisplayName(
        item.fromWarehouseName,
        item.fromWarehouseId,
      )
    ) {
      const warehouse = findWarehouseOption(
        fromWarehouseOptions.value,
        item.fromWarehouseId,
      );
      if (warehouse) {
        item.fromWarehouseName = warehouse.name;
        item.fromWarehouseDeptId ??= warehouse.deptId;
        item.fromWarehouseDeptName ??= warehouse.deptName;
        changed = true;
      }
    }
    if (
      item.toWarehouseId &&
      isMissingStockDocumentDisplayName(
        item.toWarehouseName,
        item.toWarehouseId,
      )
    ) {
      const warehouse = findWarehouseOption(
        toWarehouseOptions.value,
        item.toWarehouseId,
      );
      if (warehouse) {
        item.toWarehouseName = warehouse.name;
        item.toWarehouseDeptId ??= warehouse.deptId;
        item.toWarehouseDeptName ??= warehouse.deptName;
        changed = true;
      }
    }
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

function handleWarehouseOptionsChange(side: 'from' | 'to', options: any[]) {
  const targetOptions =
    side === 'from' ? fromWarehouseOptions.value : toWarehouseOptions.value;
  const nextOptions = mergeResolvedStockDocumentOptions(
    targetOptions,
    (options || [])
      .map((value) => normalizeWarehouseOption(value))
      .filter(Boolean),
  );
  if (nextOptions === targetOptions) {
    return;
  }
  if (side === 'from') {
    fromWarehouseOptions.value = nextOptions;
  } else {
    toWarehouseOptions.value = nextOptions;
  }
  if (hydrateCurrentWarehouseNamesFromOptions()) {
    emit('update:items', [...tableData.value]);
    void refreshItemGrid();
  }
}

function getCurrentWarehouseOption(
  row: StockMoveFormItem,
  side: 'from' | 'to',
) {
  const warehouseId = side === 'from' ? row.fromWarehouseId : row.toWarehouseId;
  if (!warehouseId) {
    return [];
  }
  const sourceOptions =
    side === 'from' ? fromWarehouseOptions.value : toWarehouseOptions.value;
  const existed = findWarehouseOption(sourceOptions, warehouseId);
  if (existed && isResolvedStockDocumentOption(existed)) {
    return [existed];
  }
  const currentName =
    side === 'from' ? row.fromWarehouseName : row.toWarehouseName;
  const label = isMissingStockDocumentDisplayName(currentName, warehouseId)
    ? CURRENT_SELECT_LABEL_PLACEHOLDER
    : currentName;
  return [
    {
      id: warehouseId,
      label,
      name: label,
      value: warehouseId,
      deptId: side === 'from' ? row.fromWarehouseDeptId : row.toWarehouseDeptId,
      deptName:
        side === 'from' ? row.fromWarehouseDeptName : row.toWarehouseDeptName,
    },
  ];
}

async function hydrateMissingWarehouseNamesFromApi() {
  const missingPairs = [
    ...new Map(
      tableData.value
        .flatMap((item) => {
          const pairs: Array<['from' | 'to', number]> = [];
          if (
            item.fromWarehouseId &&
            isMissingStockDocumentDisplayName(
              item.fromWarehouseName,
              item.fromWarehouseId,
            )
          ) {
            pairs.push(['from', Number(item.fromWarehouseId)]);
          }
          if (
            item.toWarehouseId &&
            isMissingStockDocumentDisplayName(
              item.toWarehouseName,
              item.toWarehouseId,
            )
          ) {
            pairs.push(['to', Number(item.toWarehouseId)]);
          }
          return pairs.filter(([, id]) => Number.isFinite(id));
        })
        .map((pair) => [`${pair[0]}-${pair[1]}`, pair] as const),
    ).values(),
  ];
  if (missingPairs.length === 0) {
    return;
  }
  const seq = ++warehouseHydrateSeq;
  const results = await Promise.all(
    missingPairs.map(async ([side, id]) => ({
      side,
      warehouse: await getWarehouse(id).catch(() => undefined),
    })),
  );
  if (seq !== warehouseHydrateSeq) {
    return;
  }
  handleWarehouseOptionsChange(
    'from',
    results
      .filter((item) => item.side === 'from')
      .map((item) => item.warehouse)
      .filter(Boolean),
  );
  handleWarehouseOptionsChange(
    'to',
    results
      .filter((item) => item.side === 'to')
      .map((item) => item.warehouse)
      .filter(Boolean),
  );
}

function nextSeq() {
  let maxSeq = 0;
  for (const item of tableData.value) {
    maxSeq = Math.max(maxSeq, Number(item.seq) || 0);
  }
  return maxSeq + 1;
}

function getItemRowKey(row?: StockMoveFormItem) {
  if (!row) return '';
  return itemRowKeyManager.ensureRowKey(row);
}

function escapeAttrValue(value: string) {
  return value.replaceAll('\\', '\\\\').replaceAll('"', String.raw`\"`);
}

function getProductInputValue(row: StockMoveFormItem) {
  const keyword = (row as any).__stockKeyword;
  return keyword === undefined || keyword === null
    ? row.productName || ''
    : String(keyword);
}

function handleProductKeywordInput(row: StockMoveFormItem, value: string) {
  (row as any).__stockKeyword = value;
}

function focusProductNameInput(row: StockMoveFormItem) {
  if (props.disabled) {
    return false;
  }
  const rowKey = getItemRowKey(row);
  const selector = rowKey
    ? `${STOCK_MOVE_PRODUCT_SELECT_INPUT_SELECTOR}[data-erp-inline-stock-row-key="${escapeAttrValue(rowKey)}"]`
    : STOCK_MOVE_PRODUCT_SELECT_INPUT_SELECTOR;
  return focusFirstEditableInput(itemTableWrapRef.value, selector);
}

function getInlineStockPageParams() {
  return { bizType: 'stock' as const };
}

function createBlankItemRow() {
  const row: StockMoveFormItem = {
    count: 1,
    productPrice: 0,
    seq: nextSeq(),
  };
  itemRowKeyManager.ensureRowKey(row, { forceNew: true });
  initRow(row);
  return row;
}

const itemRowFocusController = createErpItemRowFocusController({
  focusField: (row: StockMoveFormItem, field) =>
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

function buildStockMoveItemFromStock(
  product: ErpStockApi.Stock,
  overrides: Partial<StockMoveFormItem> = {},
) {
  const row: StockMoveFormItem = {
    seq: nextSeq(),
    productId: product.productId,
    productName: product.productName,
    productCode: product.productCode,
    productBarCode: product.productBarCode,
    productUnitId: product.unitId,
    productUnitName: product.unitName,
    productPrice: product.lastPurchasePrice ?? 0,
    productPurchasePrice: product.lastPurchasePrice ?? 0,
    productSharePrice: product.sharePrice,
    fromWarehouseId: product.warehouseId,
    fromWarehouseName: product.warehouseName,
    fromWarehouseDeptId: product.deptId,
    fromWarehouseDeptName: product.deptName,
    stockCount: product.count ?? 0,
    count: 1,
    ...overrides,
  };
  copyPriceReferenceFields(row, product);
  refreshRowProductPrice(row, product, true);
  refreshRowAmount(row);
  itemRowKeyManager.ensureRowKey(row, { forceNew: true });
  return row;
}

function buildReplacementStockMoveItemFromStock(
  stock: ErpStockApi.Stock,
  targetRow: StockMoveFormItem,
) {
  const row = buildStockMoveItemFromStock(stock);
  row.id = targetRow.id;
  row.seq = targetRow.seq ?? row.seq;
  row.clientRowKey = targetRow.clientRowKey ?? row.clientRowKey;
  (row as any).moveId = (targetRow as any).moveId;
  row.toWarehouseId = targetRow.toWarehouseId;
  row.toWarehouseName = targetRow.toWarehouseName;
  row.toWarehouseDeptId = targetRow.toWarehouseDeptId;
  row.toWarehouseDeptName = targetRow.toWarehouseDeptName;
  refreshRowProductPrice(row, stock, true);
  refreshRowAmount(row);
  return row;
}

/** 表单校验 */
function validate(
  items = tableData.value,
  options: { requireItems?: boolean } = {},
) {
  if ((options.requireItems ?? true) && items.length === 0) {
    throw new Error('调拨出库单明细不能为空');
  }
  for (const [i, item] of items.entries()) {
    if (item) {
      if (!item.fromWarehouseId) {
        throw new Error(`第 ${i + 1} 行：调出仓库不能为空`);
      }
      if (!item.toWarehouseId) {
        throw new Error(`第 ${i + 1} 行：调入仓库不能为空`);
      }
      if (!item.productId) {
        throw new Error(`第 ${i + 1} 行：产品不能为空`);
      }
      item.count = stockInput(item.count);
      item.productPrice = stockInput(item.productPrice, { allowZero: true });
      validateStockStorage(item.count, `第 ${i + 1} 行数量`);
      validateStockStorage(item.productPrice, `第 ${i + 1} 行单价`);
      if (!item.count || stockDecimal(item.count).lte(0)) {
        throw new Error(`第 ${i + 1} 行：产品数量不能为空`);
      }
    }
  }
}

function getItems() {
  return [...tableData.value];
}

defineExpose({
  focusFirstItemCountInput,
  focusItemRow: (row: StockMoveFormItem, field: 'count' | 'product') =>
    itemRowFocusController.focus(row, field),
  getItems,
  validate,
});

function handleGlobalInsertShortcut(event: KeyboardEvent) {
  if (
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

/** 初始化 */
onMounted(async () => {
  window.addEventListener('keydown', handleGlobalInsertShortcut, true);
  mergeCurrentItemOptions();
  hydrateCurrentWarehouseNamesFromOptions();
  await hydrateMissingWarehouseNamesFromApi();
  if (props.disabled) {
    await refreshItemGrid();
  }
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalInsertShortcut, true);
});

async function insertStockProducts(
  products: ErpStockApi.Stock[],
  targetRow?: StockMoveFormItem,
) {
  if (!products || products.length === 0) return;
  const buildRow = (
    stock: ErpStockApi.Stock,
    overrides: Partial<StockMoveFormItem> = {},
  ) => buildStockMoveItemFromStock(stock, overrides);
  const targetRowKey = getItemRowKey(targetRow);
  const targetIndex = targetRowKey
    ? tableData.value.findIndex((item) => getItemRowKey(item) === targetRowKey)
    : -1;
  let focusRow: StockMoveFormItem;
  if (targetIndex >= 0 && targetRow) {
    const [firstStock, ...additionalStocks] = products;
    const replacementRow = buildReplacementStockMoveItemFromStock(
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
  targetRow: StockMoveFormItem,
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
    title: `确认删除已选的 ${rows.length} 条调拨明细吗？`,
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
    STOCK_MOVE_ITEM_COUNT_INPUT_SELECTOR,
  );
}

function focusItemCountInput(row: StockMoveFormItem) {
  return focusEditableInputByRowKey(
    itemTableWrapRef.value,
    STOCK_MOVE_ITEM_COUNT_INPUT_SELECTOR,
    getItemRowKey(row),
  );
}

function handleItemInputPressEnter(event: KeyboardEvent) {
  const enterFocusResult = focusNextInputOnEnter(event);
  if (enterFocusResult === 'last-input') {
    emit('request-submit', event);
  }
}
</script>

<template>
  <div class="stock-move-item-form w-full">
    <div ref="itemTableWrapRef" class="stock-move-item-table-wrap relative">
      <Grid class="stock-move-item-grid w-full">
        <template #toolbar-buttons>
          <div class="stock-document-item-shortcut-hint">
            <span class="stock-document-item-shortcut-hint__label">当前页</span>
            <span><kbd>W</kbd><b>全部价格</b></span>
          </div>
        </template>
        <template #toolbar-tools>
          <div class="stock-move-item-toolbar flex items-center gap-2">
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
        <template #fromWarehouseId="{ row }">
          <span v-if="disabled">{{ getFromWarehouseLabel(row) }}</span>
          <ErpLazyPageSelect
            v-else
            v-model:value="row.fromWarehouseId"
            popup-class-name="stock-document-form-select-dropdown erp-candidate-focus-popup"
            :api="getStockMoveFromWarehouseSimplePage"
            :options="getCurrentWarehouseOption(row, 'from')"
            label-field="name"
            value-field="id"
            :page-size="10"
            class="w-full"
            placeholder="请选择调出仓库"
            show-search
            :disabled="disabled"
            @change="
              (value, option) => handleFromWarehouseChange(value, row, option)
            "
            @options-change="
              (options) => handleWarehouseOptionsChange('from', options)
            "
          />
        </template>
        <template #toWarehouseId="{ row }">
          <span v-if="disabled">{{ getToWarehouseLabel(row) }}</span>
          <ErpLazyPageSelect
            v-else
            v-model:value="row.toWarehouseId"
            popup-class-name="stock-document-form-select-dropdown erp-candidate-focus-popup"
            :api="
              (params) =>
                getWarehouseSimplePage({ ...params, bizType: 'stock' })
            "
            :options="getCurrentWarehouseOption(row, 'to')"
            label-field="name"
            value-field="id"
            :page-size="10"
            class="w-full"
            placeholder="请选择调入仓库"
            show-search
            :disabled="disabled"
            @change="
              (value, option) => handleToWarehouseChange(value, row, option)
            "
            @options-change="
              (options) => handleWarehouseOptionsChange('to', options)
            "
          />
        </template>
        <template #productId="{ row }">
          <ErpInlineStockSelect
            candidate-focus-highlight
            v-if="!disabled"
            :value="getProductInputValue(row)"
            settings-scope="stock-move"
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
        <template #count="{ row }">
          <Input
            v-if="!disabled"
            :value="row.count ?? undefined"
            @update:value="
              (value) => {
                row.count = value;
                handleRowChange(row);
              }
            "
            :min="0"
            inputmode="decimal"
            @change="handleRowChange(row)"
            :data-erp-item-row-key="getItemRowKey(row)"
            data-stock-move-count-input="true"
            @press-enter="handleItemInputPressEnter"
          />
          <span v-else>{{ erpCountInputFormatter(row.count) || '-' }}</span>
        </template>
        <template #productPrice="{ row }">
          <Input
            v-if="!disabled"
            :value="row.productPrice ?? undefined"
            @update:value="
              (value) => {
                row.productPrice = value;
                handleRowChange(row);
              }
            "
            :min="0"
            inputmode="decimal"
            @change="handleRowChange(row)"
            @press-enter="handleItemInputPressEnter"
          />
          <span v-else>{{
            erpPriceInputFormatter(row.productPrice) || '-'
          }}</span>
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
        :rows="getDisplayedItems()"
        :table-header-height="ITEM_TABLE_HEADER_HEIGHT"
        :table-row-height="ITEM_TABLE_ROW_HEIGHT"
        :table-wrapper="itemTableWrapRef"
        :visible-rows="ITEM_TABLE_VISIBLE_ROWS"
      />
    </div>
    <div v-if="showItemPager" class="stock-move-item-pager">
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
.stock-move-item-form :deep(.vxe-table),
.stock-move-item-form :deep(.ant-input),
.stock-move-item-form :deep(.ant-input-number),
.stock-move-item-form :deep(.ant-select) {
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

.stock-move-item-pager {
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
}

.stock-move-item-pager :deep(.ant-pagination),
.stock-move-item-pager :deep(.ant-pagination-item),
.stock-move-item-pager :deep(.ant-pagination-total-text),
.stock-move-item-pager :deep(.ant-pagination-options),
.stock-move-item-pager :deep(.ant-select),
.stock-move-item-pager :deep(.ant-input) {
  font-size: 11px;
}

.stock-move-item-pager :deep(.ant-pagination-item),
.stock-move-item-pager :deep(.ant-pagination-prev),
.stock-move-item-pager :deep(.ant-pagination-next),
.stock-move-item-pager :deep(.ant-pagination-jump-prev),
.stock-move-item-pager :deep(.ant-pagination-jump-next) {
  min-width: 24px;
  height: 24px;
  line-height: 22px;
}

.stock-move-item-pager :deep(.ant-pagination-item a),
.stock-move-item-pager :deep(.ant-pagination-prev button),
.stock-move-item-pager :deep(.ant-pagination-next button) {
  height: 22px;
  font-size: 11px;
  line-height: 22px;
}

.stock-move-item-pager :deep(.ant-pagination-options-size-changer),
.stock-move-item-pager :deep(.ant-select-single),
.stock-move-item-pager :deep(.ant-select-selector) {
  height: 24px;
  line-height: 22px;
}

.stock-move-item-pager
  :deep(.ant-pagination-options-size-changer .ant-select-selector) {
  box-sizing: border-box;
  align-items: center;
  min-height: 24px;
  padding: 0 24px 0 8px;
}

.stock-move-item-pager
  :deep(.ant-select-single .ant-select-selector .ant-select-selection-item) {
  height: 22px;
  font-size: 11px;
  line-height: 22px;
}

.stock-move-item-pager :deep(.ant-select-arrow) {
  margin-top: -5px;
  font-size: 10px;
}

.stock-move-item-pager :deep(.ant-pagination-options-quick-jumper input) {
  height: 24px;
  padding: 0 7px;
  font-size: 11px;
  line-height: 22px;
}
</style>
