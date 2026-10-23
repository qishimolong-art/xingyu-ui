<script lang="ts" setup>
import DecimalAmountInput from '#/views/erp/components/DecimalAmountInput.vue';
import type { TransferOutItemSortOrder } from './transfer-out-item-sort';

import type { ErpStockApi } from '#/api/erp/stock/stock';
import type { ErpStockTransferOutApi } from '#/api/erp/stock/transfer-out';

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

import { useAccess } from '@vben/access';
import { useVbenModal } from '@vben/common-ui';

import {
  Button,
  Input,
  message,
  Modal,
  Pagination,
  Select,
} from 'ant-design-vue';

import { TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  getAvailableBatchNoList,
  getStockCount,
  getStockPage,
} from '#/api/erp/stock/stock';
import {
  getStockMoveFromWarehouseSimplePage,
  getWarehouse,
  getWarehouseSimplePage,
} from '#/api/erp/stock/warehouse';
import { isFieldHidden } from '#/composables/useFieldPermission';
import ErpInlineStockSelect from '#/views/erp/components/ErpInlineStockSelect.vue';
import ErpLazyPageSelect from '#/views/erp/components/ErpLazyPageSelect.vue';
import ItemPriceReferenceOverlay from '#/views/erp/components/ItemPriceReferenceOverlay.vue';
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
import {
  formatStockNaturalNumber,
  parseStockDocumentDecimal,
} from '#/views/erp/stock/utils/document-number';
import { createStockItemClientRowKeyManager } from '#/views/erp/stock/utils/item-row-key';
import { stockDecimal } from '#/views/erp/stock/utils/stock-decimal';
import {
  stockMoney as erpPriceInputFormatter,
  stockMultiply as erpPriceMultiply,
} from '#/views/erp/stock/utils/stock-decimal';
import { CANDIDATE_FOCUS_KEY } from '#/views/erp/utils/candidate-focus';
import { isBatchNoEnabled } from '#/views/erp/utils/item';
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
import BatchUpdateItemsForm from './batch-update-items-form.vue';
import { sortTransferOutItems } from './transfer-out-item-sort';

const props = withDefaults(defineProps<Props>(), {
  items: () => [],
  deptId: undefined,
  disabled: false,
  documentId: undefined,
  enableBatchEdit: false,
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
  'refresh-items',
  'append-items',
  'page-change',
  'request-submit',
  'update:items',
]);

provide(CANDIDATE_FOCUS_KEY, ref(true));

interface Props {
  deptId?: number;
  items?: ErpStockTransferOutApi.StockTransferOutItem[];
  disabled?: boolean;
  documentId?: number;
  enableBatchEdit?: boolean;
  hiddenFields?: string[];
  itemPageLoading?: boolean;
  itemPagination?: TransferOutItemPagination;
  remotePaging?: boolean;
}

interface BatchUpdateItemsPayload {
  side?: 'from' | 'to';
  warehouse?: any;
  warehouseId?: number;
}

type TransferOutItemPagination = {
  orderDirection?: 'asc' | 'desc';
  orderField?: string;
  pageNo: number;
  pageSize: number;
  total: number;
};

type StockTransferOutFormItem =
  Partial<ErpStockTransferOutApi.StockTransferOutItem> & {
    batchNoEnabled?: boolean;
    productPurchasePrice?: number;
    productSharePrice?: number;
    seq?: number | string;
  };

const STOCK_TRANSFER_OUT_ITEM_COUNT_INPUT_SELECTOR =
  '[data-stock-transfer-out-count-input="true"]';
const STOCK_TRANSFER_OUT_PRODUCT_SELECT_INPUT_SELECTOR =
  '[data-erp-inline-stock-select-input="true"]';

const DEFAULT_ITEM_PAGE_SIZE = 10;
const ITEM_PAGE_SIZE_OPTIONS = ['10', '20', '50', '100', '200'];
const ITEM_TABLE_VISIBLE_ROWS = 10;
const ITEM_TABLE_HEADER_HEIGHT = 40;
const ITEM_TABLE_ROW_HEIGHT = 40;
const ITEM_TABLE_HEIGHT =
  ITEM_TABLE_HEADER_HEIGHT + ITEM_TABLE_ROW_HEIGHT * ITEM_TABLE_VISIBLE_ROWS;

let internalFieldUpdate = false;
const tableData = ref<StockTransferOutFormItem[]>([]); // 表格数据
const itemRowKeyManager =
  createStockItemClientRowKeyManager('stock-transfer-out');
const detailActions = ref<InstanceType<typeof StockItemDetailActions>>();
const activeItemRow = ref<any>();
const renderedItemRows = ref<any[]>([]);
const inlineStockSelectorOpen = ref(false);
const { itemTableWrapRef, priceReferenceOpen } = useItemPriceReferenceShortcut({
  isBlocked: () =>
    inlineStockSelectorOpen.value ||
    batchUpdateItemsModalOpen.value ||
    Boolean(detailActions.value?.isBlockedForPrice()),
});
const fromWarehouseOptions = ref<any[]>([]); // 调出仓库下拉选项
const toWarehouseOptions = ref<any[]>([]); // 调入仓库下拉选项
const batchNoOptionsMap = ref<Record<string, any[]>>({});
const warehouseOptions = computed(() =>
  mergeOptionLists(fromWarehouseOptions.value, toWarehouseOptions.value),
);
const activeItemSort = ref<null | {
  field: string;
  order: TransferOutItemSortOrder;
}>(null);
const selectedBatchItemRows = ref<StockTransferOutFormItem[]>([]);
const selectedDeleteItemRows = ref<StockTransferOutFormItem[]>([]);
const localItemPage = ref({ pageNo: 1, pageSize: DEFAULT_ITEM_PAGE_SIZE });
const { hasAccessByCodes } = useAccess();
const batchUpdateItemsModalOpen = ref(false);
const [BatchUpdateItemsModal, batchUpdateItemsModalApi] = useVbenModal({
  connectedComponent: BatchUpdateItemsForm,
  destroyOnClose: true,
  onOpenChange: (open) => {
    batchUpdateItemsModalOpen.value = open;
  },
});
const canBatchEditFromWarehouse = computed(
  () => !isFieldHidden(props.hiddenFields, 'item_fromWarehouseId'),
);
const canBatchEditToWarehouse = computed(
  () => !isFieldHidden(props.hiddenFields, 'item_toWarehouseId'),
);
const batchUpdateAccessCodes = computed(() =>
  props.documentId
    ? ['erp:stock-transfer-out:update']
    : ['erp:stock-transfer-out:create'],
);
const canShowBatchUpdateItems = computed(
  () =>
    !props.disabled &&
    props.enableBatchEdit &&
    hasAccessByCodes(batchUpdateAccessCodes.value) &&
    (canBatchEditFromWarehouse.value || canBatchEditToWarehouse.value),
);
const selectedBatchItemCount = computed(
  () =>
    selectedBatchItemRows.value.filter((row) => canBatchUpdateItemRow(row))
      .length,
);
const selectedDeleteItemCount = computed(
  () =>
    selectedDeleteItemRows.value.filter((row) => canDeleteItemRow(row)).length,
);
const batchEditableItemCount = computed(
  () => tableData.value.filter((row) => canBatchUpdateItemRow(row)).length,
);
const canShowItemSelection = computed(
  () => canShowBatchUpdateItems.value || !props.disabled,
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

function canBatchUpdateItemRow(row?: StockTransferOutFormItem) {
  return Boolean(row?.productId && !props.disabled);
}

function canDeleteItemRow(row?: StockTransferOutFormItem) {
  return Boolean(row && !props.disabled);
}

function canSelectItemRow(row?: StockTransferOutFormItem) {
  return canBatchUpdateItemRow(row) || canDeleteItemRow(row);
}

function clearBatchItemSelection() {
  selectedBatchItemRows.value = [];
  selectedDeleteItemRows.value = [];
  gridApi.grid?.clearCheckboxRow?.();
  gridApi.grid?.clearCheckboxReserve?.();
}

function getDisplayedItems() {
  const activeSort = activeItemSort.value;
  const rows =
    !activeSort || props.remotePaging
      ? [...tableData.value]
      : sortTransferOutItems(
          tableData.value,
          activeSort.field,
          activeSort.order,
          {
            fromWarehouseOptions: fromWarehouseOptions.value,
            toWarehouseOptions: toWarehouseOptions.value,
          },
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

/** 表格配置 */
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
    id: 'erp-stock-transfer-out-item-list-v2',
    autoResize: true,
    border: true,
    rowConfig: {
      keyField: 'clientRowKey',
      isHover: true,
    },
    checkboxConfig: {
      checkMethod: ({ row }: { row: StockTransferOutFormItem }) =>
        canSelectItemRow(row),
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
    resizableChange: itemColumns.queue,
    zoom: itemColumns.queue,
    custom: itemColumns.custom,
    sortChange: handleItemSortChange,
    checkboxAll: ({ records }: { records: StockTransferOutFormItem[] }) => {
      selectedBatchItemRows.value = records.filter((row) =>
        canBatchUpdateItemRow(row),
      );
      selectedDeleteItemRows.value = records.filter((row) =>
        canDeleteItemRow(row),
      );
    },
    checkboxChange: ({ records }: { records: StockTransferOutFormItem[] }) => {
      selectedBatchItemRows.value = records.filter((row) =>
        canBatchUpdateItemRow(row),
      );
      selectedDeleteItemRows.value = records.filter((row) =>
        canDeleteItemRow(row),
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

watch(
  () => [props.disabled, props.enableBatchEdit, props.documentId],
  async () => {
    await nextTick();
    await itemColumns.reload();
    await refreshItemGrid();
    clearBatchItemSelection();
  },
);

/** 监听外部传入的列数据 */
watch(
  () => props.items,
  async (items) => {
    if (!items) {
      return;
    }
    if (internalFieldUpdate) {
      internalFieldUpdate = false;
      return;
    }
    const nextRows = items.map((item, index) => {
      const row = {
        ...item,
        seq: (item as StockTransferOutFormItem).seq ?? index + 1,
      } as StockTransferOutFormItem;
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
    await nextTick();
    await itemColumns.reload();
    await refreshItemGrid();
    clearBatchItemSelection();
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

watch(
  () => [props.itemPagination.orderField, props.itemPagination.orderDirection],
  async ([orderField, orderDirection]) => {
    if (!props.remotePaging) return;
    const nextSort =
      orderField && (orderDirection === 'asc' || orderDirection === 'desc')
        ? {
            field: orderField,
            order: orderDirection as TransferOutItemSortOrder,
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
function handleDelete(row: StockTransferOutFormItem) {
  deleteItemRows([row]);
}

function deleteItemRows(rows: StockTransferOutFormItem[]) {
  const keys = new Set(rows.map((row) => getItemRowKey(row)).filter(Boolean));
  if (keys.size === 0) {
    return;
  }
  tableData.value = tableData.value.filter(
    (item) => !keys.has(getItemRowKey(item)),
  );
  clearBatchItemSelection();
  void refreshItemGrid();
  emit('update:items', getItems());
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
    row.batchNo = undefined;
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
    row.batchNo = undefined;
    await loadBatchNoOptions(row);
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
    internalFieldUpdate = true;
    emit('update:items', [...tableData.value]);
  }
}

function refreshRowAmount(row: any) {
  row.totalPrice = erpPriceMultiply(row.productPrice || 0, row.count || 0) ?? 0;
  row.totalWeight = erpPriceMultiply(row.weight || 0, row.count || 0) ?? 0;
}

function handleBatchNoChange(batchNo: any, row: any) {
  row.batchNo =
    batchNo === undefined || batchNo === null ? undefined : String(batchNo);
  const selectedOption = getBatchNoOptions(row).find(
    (item) => item.value === row.batchNo,
  );
  if (selectedOption) {
    row.stockCount = selectedOption.availableCount ?? 0;
  }
  handleRowChange(row);
}

/** 初始化行数据 */
function initRow(row: StockTransferOutFormItem) {
  if (row.batchNoEnabled !== undefined && row.batchNoEnabled !== null) {
    row.batchNoEnabled = isBatchNoEnabled(row.batchNoEnabled);
  } else if (row.batchNo) {
    row.batchNoEnabled = true;
  }
  if (!props.disabled) {
    void loadBatchNoOptions(row);
  }
  if (row.totalPrice == null && row.productPrice && row.count) {
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

function filterSelectOption(input: string, option: any) {
  const keyword = input.trim().toLowerCase();
  const label = String(option?.name ?? option?.label ?? option?.value ?? '');
  return label.toLowerCase().includes(keyword);
}

function findWarehouseOption(options: any[], warehouseId?: number) {
  return options.find((item) => String(item.id) === String(warehouseId));
}

function getFromWarehouseLabel(row: StockTransferOutFormItem) {
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

function getToWarehouseLabel(row: StockTransferOutFormItem) {
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
    (options || []).map((row) => normalizeWarehouseOption(row)).filter(Boolean),
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
    void refreshItemGrid();
  }
}

function getCurrentWarehouseOption(
  row: StockTransferOutFormItem,
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

function buildBatchNoOptionsKey(row: StockTransferOutFormItem) {
  return row.productId && row.fromWarehouseId
    ? `${row.productId}-${row.fromWarehouseId}`
    : '';
}

function getBatchNoOptions(row: StockTransferOutFormItem) {
  const key = buildBatchNoOptionsKey(row);
  return key ? batchNoOptionsMap.value[key] || [] : [];
}

function isBatchNoSelectable(row: StockTransferOutFormItem) {
  return (
    row.batchNoEnabled === undefined ||
    row.batchNoEnabled === null ||
    isBatchNoEnabled(row.batchNoEnabled) ||
    !!row.batchNo
  );
}

async function loadBatchNoOptions(row: StockTransferOutFormItem) {
  const key = buildBatchNoOptionsKey(row);
  if (!key) {
    row.batchNo = undefined;
    return;
  }
  if (!isBatchNoSelectable(row)) {
    row.batchNo = undefined;
    batchNoOptionsMap.value[key] = [];
    return;
  }
  const list = await getAvailableBatchNoList({
    decimalMode: 'string',
    bizType: 'stock',
    productId: row.productId as number,
    warehouseId: row.fromWarehouseId as number,
  });
  batchNoOptionsMap.value[key] = (list || []).map((item) => ({
    label: item.batchNo,
    value: item.batchNo,
    availableCount: item.availableCount,
  }));
  if (row.batchNoEnabled === undefined || row.batchNoEnabled === null) {
    row.batchNoEnabled =
      batchNoOptionsMap.value[key].length > 0 || !!row.batchNo;
  }
  const selectedOption = batchNoOptionsMap.value[key].find(
    (item) => item.value === row.batchNo,
  );
  if (selectedOption) {
    row.stockCount = selectedOption.availableCount ?? 0;
  }
}

function nextSeq() {
  let maxSeq = 0;
  for (const item of tableData.value) {
    maxSeq = Math.max(maxSeq, Number(item.seq) || 0);
  }
  return maxSeq + 1;
}

function getItemRowKey(row?: StockTransferOutFormItem) {
  if (!row) return '';
  return itemRowKeyManager.ensureRowKey(row);
}

function getProductInputValue(row: StockTransferOutFormItem) {
  return row.productName || row.productCode || '';
}

function handleProductKeywordInput(
  row: StockTransferOutFormItem,
  value: string,
) {
  row.productName = value;
  if (!value) {
    row.productId = undefined;
    row.productCode = undefined;
  }
}

function focusProductNameInput(row: StockTransferOutFormItem) {
  if (props.disabled) {
    return false;
  }
  return focusEditableInputByRowKey(
    itemTableWrapRef.value,
    STOCK_TRANSFER_OUT_PRODUCT_SELECT_INPUT_SELECTOR,
    getItemRowKey(row),
    'data-erp-inline-stock-row-key',
  );
}

function getInlineStockPageParams() {
  return {
    bizType: 'stock',
  };
}

const itemRowFocusController = createErpItemRowFocusController({
  focusField: (row: StockTransferOutFormItem, field) =>
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
  emit('update:items', getItems());
  await itemRowFocusController.focus(row, 'product');
}

function createBlankItemRow(): StockTransferOutFormItem {
  const row: StockTransferOutFormItem = {
    seq: nextSeq(),
    count: 1,
    productPrice: 0,
    productPurchasePrice: 0,
    stockCount: 0,
  };
  itemRowKeyManager.ensureRowKey(row, { forceNew: true });
  return row;
}

function buildStockTransferOutItemFromStock(
  product: ErpStockApi.Stock,
  overrides: Partial<StockTransferOutFormItem> = {},
): StockTransferOutFormItem {
  const row: StockTransferOutFormItem = {
    seq: nextSeq(),
    fromWarehouseId: product.warehouseId,
    fromWarehouseName: product.warehouseName,
    fromWarehouseDeptId: product.deptId,
    fromWarehouseDeptName: product.deptName,
    productId: product.productId,
    productName: product.productName,
    productCode: product.productCode,
    productBarCode: product.productBarCode,
    productUnitName: product.unitName,
    productUnitId: product.unitId,
    packageQty: product.packageQty,
    weight: product.weight,
    productPrice: product.lastPurchasePrice ?? 0,
    productPurchasePrice: product.lastPurchasePrice ?? 0,
    productSharePrice: product.sharePrice,
    stockCount: product.availableCount ?? product.count ?? 0,
    fromShelf: product.shelf,
    batchNoEnabled: isBatchNoEnabled(product.batchNoEnabled),
    count: 1,
    ...overrides,
  };
  copyPriceReferenceFields(row, product);
  refreshRowProductPrice(row, product, true);
  refreshRowAmount(row);
  itemRowKeyManager.ensureRowKey(row, { forceNew: true });
  return row;
}

function buildReplacementStockTransferOutItemFromStock(
  targetRow: StockTransferOutFormItem,
  product: ErpStockApi.Stock,
) {
  const row = buildStockTransferOutItemFromStock(product, {
    seq: targetRow.seq ?? nextSeq(),
    toWarehouseId: targetRow.toWarehouseId,
    toWarehouseName: targetRow.toWarehouseName,
    toWarehouseDeptId: targetRow.toWarehouseDeptId,
    toWarehouseDeptName: targetRow.toWarehouseDeptName,
    remark: targetRow.remark,
  });
  row.id = targetRow.id;
  row.clientRowKey = targetRow.clientRowKey ?? row.clientRowKey;
  (row as any).transferOutId = (targetRow as any).transferOutId;
  refreshRowProductPrice(row, product, true);
  refreshRowAmount(row);
  return row;
}

const decimalTexts = new Map<string, string>();
const decimalErrors = ref<Record<string, boolean>>({});
function decimalKey(row: any, field: string) {
  return `${getItemRowKey(row)}:${field}`;
}
function decimalValue(row: any, field: string) {
  return (
    decimalTexts.get(decimalKey(row, field)) ??
    (field === 'productPrice'
      ? erpPriceInputFormatter(row[field])
      : formatStockNaturalNumber(row[field]))
  );
}
function decimalInput(row: any, field: string, value: string) {
  activeItemRow.value = row;
  if (!/^\d*(\.\d*)?$/.test(value)) {
    decimalErrors.value[decimalKey(row, field)] = true;
    return;
  }
  decimalTexts.set(decimalKey(row, field), value);
  delete decimalErrors.value[decimalKey(row, field)];
}
function commitDecimal(row: any, field: 'count' | 'productPrice') {
  const key = decimalKey(row, field);
  if (!decimalTexts.has(key)) return;
  try {
    row[field] = parseStockDocumentDecimal(
      decimalTexts.get(key),
      field === 'productPrice',
    );
  } catch (error) {
    decimalErrors.value[key] = true;
    throw error;
  }
  // Preserve the typed text across blur and pagination.
  handleRowChange(row);
}
function blurDecimal(row: any, field: 'count' | 'productPrice') {
  try {
    commitDecimal(row, field);
  } catch (error) {
    message.warning((error as Error).message);
  }
}
function flushInputs() {
  for (const row of tableData.value) {
    commitDecimal(row, 'count');
    commitDecimal(row, 'productPrice');
  }
}
/** 表单校验 */
function validate(
  items = tableData.value,
  options: { requireItems?: boolean } = {},
) {
  flushInputs();
  if ((options.requireItems ?? true) && items.length === 0) {
    throw new Error('产品清单不能为空');
  }
  for (const [i, item] of items.entries()) {
    if (item) {
      if (!item.fromWarehouseId) {
        throw new Error(`第 ${i + 1} 行：调出仓库不能为空`);
      }
      if (!item.toWarehouseId) {
        throw new Error(`第 ${i + 1} 行：调入仓库不能为空`);
      }
      if (item.fromWarehouseId === item.toWarehouseId) {
        throw new Error(`第 ${i + 1} 行：调出仓库和调入仓库不能相同`);
      }
      if (!item.productId) {
        throw new Error(`第 ${i + 1} 行：产品不能为空`);
      }
      if (!item.count || stockDecimal(item.count).lte(0)) {
        throw new Error(`第 ${i + 1} 行：产品数量必须大于 0`);
      }
      if (
        item.stockCount != null &&
        stockDecimal(item.count).gt(item.stockCount)
      )
        throw new Error(`第 ${i + 1} 行：数量不能超过调出库存`);
      if (!item.productPrice || stockDecimal(item.productPrice).lte(0)) {
        throw new Error(`第 ${i + 1} 行：产品单价必须大于 0`);
      }
    }
  }
}

/** 获取当前明细，提交时由父表单一次性读取，避免编辑过程中反复复制整表。 */
function getItems(): ErpStockTransferOutApi.StockTransferOutItem[] {
  flushInputs();
  return tableData.value.map((item) => ({ ...item }));
}

defineExpose({
  flushInputs,
  focusFirstItemCountInput,
  focusItemRow: (row: StockTransferOutFormItem, field: 'count' | 'product') =>
    itemRowFocusController.focus(row, field),
  getItems,
  validate,
});

function handleGlobalInsertShortcut(event: KeyboardEvent) {
  if (
    detailActions.value?.isBlockedForPrice() ||
    props.disabled ||
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
  mergeCurrentItemOptions();
  hydrateCurrentWarehouseNamesFromOptions();
  await hydrateMissingWarehouseNamesFromApi();
  if (activeItemSort.value || props.disabled) {
    await refreshItemGrid();
  }
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalInsertShortcut, true);
});

async function insertStockProducts(
  targetRow: StockTransferOutFormItem,
  products: ErpStockApi.Stock[],
) {
  if (!products || products.length === 0) {
    return;
  }
  const replacement = buildReplacementStockTransferOutItemFromStock(
    targetRow,
    products[0]!,
  );
  const appendSeqStart = nextSeq();
  const additionalRows = products.slice(1).map((product, index) =>
    buildStockTransferOutItemFromStock(product, {
      seq: appendSeqStart + index,
    }),
  );
  await Promise.all(
    [replacement, ...additionalRows].map((row) => loadBatchNoOptions(row)),
  );
  const targetRowKey = getItemRowKey(targetRow);
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
    emit('update:items', getItems());
    emit('append-items', additionalRows, 'count', replacement);
    return;
  }
  emit('update:items', getItems());
  await itemRowFocusController.focus(replacement, 'count');
}

async function handleInlineStockSelected(
  row: StockTransferOutFormItem,
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
    message.warning('请先勾选需要删除的调拨出库明细');
    return;
  }
  Modal.confirm({
    title: `确认删除选中的 ${rows.length} 条调拨出库明细吗？`,
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
  return focusFirstEditableInput(
    itemTableWrapRef.value,
    STOCK_TRANSFER_OUT_ITEM_COUNT_INPUT_SELECTOR,
  );
}

function focusItemCountInput(row: StockTransferOutFormItem) {
  return focusEditableInputByRowKey(
    itemTableWrapRef.value,
    STOCK_TRANSFER_OUT_ITEM_COUNT_INPUT_SELECTOR,
    getItemRowKey(row),
  );
}

function handleItemInputPressEnter(event: KeyboardEvent) {
  const enterFocusResult = focusNextInputOnEnter(event);
  if (enterFocusResult === 'last-input') {
    emit('request-submit', event);
  }
}

function getSelectedBatchItemRows() {
  return selectedBatchItemRows.value.filter((row) =>
    canBatchUpdateItemRow(row),
  );
}

function handleOpenBatchUpdateItems() {
  if (selectedBatchItemCount.value === 0) {
    message.warning('请先勾选可批量修改的调拨出库明细');
    return;
  }
  batchUpdateItemsModalApi
    .setData({
      hiddenFields: props.hiddenFields,
      itemCount: selectedBatchItemCount.value,
    })
    .open();
}

function isSelectedBatchItemRow(row: StockTransferOutFormItem) {
  return getSelectedBatchItemRows().some(
    (item) => getItemRowKey(item) === getItemRowKey(row),
  );
}

function getBatchTargetWarehouse(
  payload: BatchUpdateItemsPayload,
  options: any[],
) {
  return (
    payload.warehouse || options.find((item) => item.id === payload.warehouseId)
  );
}

function hasSameWarehouseConflict(payload: BatchUpdateItemsPayload) {
  return getSelectedBatchItemRows().some((row) =>
    payload.side === 'from'
      ? row.toWarehouseId === payload.warehouseId
      : row.fromWarehouseId === payload.warehouseId,
  );
}

async function applyLocalBatchUpdateItems(payload?: BatchUpdateItemsPayload) {
  if (!payload?.side || !payload.warehouseId) {
    message.warning('请选择需要修改的仓库方向和目标仓库');
    return false;
  }
  const selectedRows = getSelectedBatchItemRows();
  if (selectedRows.length === 0) {
    message.warning('请先勾选可批量修改的调拨出库明细');
    return false;
  }
  if (hasSameWarehouseConflict(payload)) {
    message.warning(
      '批量修改后存在调出仓库和调入仓库相同的明细，请调整后再操作',
    );
    return false;
  }

  const targetOptions =
    payload.side === 'from'
      ? fromWarehouseOptions.value
      : toWarehouseOptions.value;
  const warehouse = getBatchTargetWarehouse(payload, targetOptions);
  if (!warehouse) {
    message.warning('目标仓库不存在，请重新选择');
    return false;
  }

  let updatedCount = 0;
  const batchNoReloadRows: StockTransferOutFormItem[] = [];
  tableData.value.forEach((item) => {
    if (!isSelectedBatchItemRow(item)) {
      return;
    }
    if (payload.side === 'from') {
      item.fromWarehouseId = payload.warehouseId;
      item.fromWarehouseName = warehouse.name;
      item.fromWarehouseDeptId = warehouse.deptId;
      item.fromWarehouseDeptName = warehouse.deptName;
      item.batchNo = undefined;
      batchNoReloadRows.push(item);
    } else {
      item.toWarehouseId = payload.warehouseId;
      item.toWarehouseName = warehouse.name;
      item.toWarehouseDeptId = warehouse.deptId;
      item.toWarehouseDeptName = warehouse.deptName;
    }
    refreshRowProductPrice(item, undefined, false);
    refreshRowAmount(item);
    updatedCount += 1;
  });

  if (payload.side === 'from') {
    await Promise.allSettled(
      batchNoReloadRows.map(async (row) => {
        row.stockCount =
          row.productId && row.fromWarehouseId
            ? (await getStockCount(row.productId, row.fromWarehouseId)) || 0
            : 0;
        await loadBatchNoOptions(row);
      }),
    );
  }

  await refreshItemGrid();
  clearBatchItemSelection();
  message.success(`已批量更新 ${updatedCount} 条调拨出库明细`);
  return true;
}
</script>

<template>
  <div class="transfer-out-item-form w-full">
    <div
      ref="itemTableWrapRef"
      tabindex="-1"
      @mousedown="detailActions?.pointer($event)"
      class="transfer-out-item-table-wrap relative"
    >
      <Grid class="transfer-out-item-grid w-full">
        <template #toolbar-buttons>
          <StockItemDetailActions
            ref="detailActions"
            :active-row="activeItemRow"
            :dept-id="deptId"
            :hidden-fields="hiddenFields"
            :wrapper="itemTableWrapRef"
            :blocked="
              inlineStockSelectorOpen ||
              priceReferenceOpen ||
              batchUpdateItemsModalOpen
            "
            :enabled="true"
            @product-updated="itemColumns.reload()"
          />
          <div class="transfer-out-item-toolbar-left">
            <div class="stock-document-item-shortcut-hint">
              <span class="page-label">当前页</span>
              <span><kbd>W</kbd><b>全部价格</b></span>
            </div>
            <div
              v-if="canShowBatchUpdateItems"
              class="transfer-out-item-batch-summary"
            >
              已选 {{ selectedBatchItemCount }} 条 / 可改
              {{ batchEditableItemCount }} 条
            </div>
          </div>
        </template>
        <template #toolbar-tools>
          <div class="transfer-out-item-toolbar flex items-center gap-2">
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
        <template #fromWarehouseId="{ row }">
          <span v-if="disabled">{{ getFromWarehouseLabel(row) }}</span>
          <ErpLazyPageSelect
            v-else
            v-model:value="row.fromWarehouseId"
            popup-class-name="transfer-out-item-select-dropdown erp-candidate-focus-popup"
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
            popup-class-name="transfer-out-item-select-dropdown erp-candidate-focus-popup"
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
            preserve-quantity-precision
            v-if="!disabled"
            :value="getProductInputValue(row)"
            settings-scope="stock-transfer-out"
            :row="row"
            :row-key="getItemRowKey(row)"
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
        <template #batchNo="{ row }">
          <Select
            v-if="!disabled"
            v-model:value="row.batchNo"
            popup-class-name="transfer-out-item-select-dropdown erp-candidate-focus-popup"
            :options="getBatchNoOptions(row)"
            allow-clear
            show-search
            :filter-option="filterSelectOption"
            class="w-full"
            placeholder="请选择批次号"
            :disabled="
              !isBatchNoSelectable(row) ||
              !row.productId ||
              !row.fromWarehouseId
            "
            @change="handleBatchNoChange($event, row)"
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
            type="text"
            inputmode="decimal"
            @update:value="decimalInput(row, 'count', String($event ?? ''))"
            @blur="blurDecimal(row, 'count')"
            @press-enter="handleItemInputPressEnter"
            data-stock-transfer-out-count-input="true"
            :data-erp-item-row-key="getItemRowKey(row)"
          />
          <span v-else>{{ formatStockNaturalNumber(row.count) || '-' }}</span>
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
            type="text"
            inputmode="decimal"
            @update:value="
              decimalInput(row, 'productPrice', String($event ?? ''))
            "
            @blur="blurDecimal(row, 'productPrice')"
            @press-enter="handleItemInputPressEnter"
            data-stock-transfer-out-price-input="true"
            :data-erp-item-row-key="getItemRowKey(row)"
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
                icon: 'lucide:trash-2',
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
    <BatchUpdateItemsModal @success="applyLocalBatchUpdateItems" />
    <div v-if="showItemPager" class="transfer-out-item-pager">
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
.page-label {
  color: #64748b;
}
.transfer-out-item-form :deep(.vxe-table),
.transfer-out-item-form :deep(.ant-input),
.transfer-out-item-form :deep(.ant-input-number),
.transfer-out-item-form :deep(.ant-select) {
  font-size: 11px;
}

.transfer-out-item-toolbar :deep(.ant-btn-primary:not(:disabled)) {
  background: #1677ff;
  border-color: #1677ff;
}

.transfer-out-item-toolbar :deep(.ant-btn) {
  height: 28px;
  padding: 2px 10px;
  font-size: 12px;
  line-height: 20px;
}

.transfer-out-item-toolbar :deep(.ant-btn-primary:not(:disabled):hover),
.transfer-out-item-toolbar
  :deep(.ant-btn-primary:not(:disabled):focus-visible) {
  background: #4096ff;
  border-color: #4096ff;
}

.transfer-out-item-toolbar :deep(.ant-btn span) {
  font-size: 12px;
}

.transfer-out-item-toolbar-left {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 12px;
  min-width: 0;
}

.transfer-out-item-batch-summary {
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

.transfer-out-item-grid
  :deep(.vxe-header--column.is--sortable .vxe-cell--title) {
  color: #1677ff;
}

.transfer-out-item-grid :deep(.vxe-header--column .vxe-cell--sort) {
  display: none;
}

:global(.transfer-out-item-select-dropdown .ant-select-item),
:global(.transfer-out-item-select-dropdown .ant-empty-description) {
  font-size: 11px;
}

.transfer-out-item-pager {
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
}

.transfer-out-item-pager :deep(.ant-pagination),
.transfer-out-item-pager :deep(.ant-pagination-item),
.transfer-out-item-pager :deep(.ant-pagination-total-text),
.transfer-out-item-pager :deep(.ant-pagination-options),
.transfer-out-item-pager :deep(.ant-select),
.transfer-out-item-pager :deep(.ant-input) {
  font-size: 11px;
}

.transfer-out-item-pager :deep(.ant-pagination-item),
.transfer-out-item-pager :deep(.ant-pagination-prev),
.transfer-out-item-pager :deep(.ant-pagination-next),
.transfer-out-item-pager :deep(.ant-pagination-jump-prev),
.transfer-out-item-pager :deep(.ant-pagination-jump-next) {
  min-width: 24px;
  height: 24px;
  line-height: 22px;
}

.transfer-out-item-pager :deep(.ant-pagination-item a),
.transfer-out-item-pager :deep(.ant-pagination-prev button),
.transfer-out-item-pager :deep(.ant-pagination-next button) {
  height: 22px;
  font-size: 11px;
  line-height: 22px;
}

.transfer-out-item-pager :deep(.ant-pagination-options-size-changer),
.transfer-out-item-pager :deep(.ant-select-single),
.transfer-out-item-pager :deep(.ant-select-selector) {
  height: 24px;
  line-height: 22px;
}

.transfer-out-item-pager
  :deep(.ant-pagination-options-size-changer .ant-select-selector) {
  box-sizing: border-box;
  align-items: center;
  min-height: 24px;
  padding: 0 24px 0 8px;
}

.transfer-out-item-pager
  :deep(.ant-select-single .ant-select-selector .ant-select-selection-item) {
  height: 22px;
  font-size: 11px;
  line-height: 22px;
}

.transfer-out-item-pager :deep(.ant-select-arrow) {
  margin-top: -5px;
  font-size: 10px;
}

.transfer-out-item-pager :deep(.ant-pagination-options-quick-jumper input) {
  height: 24px;
  padding: 0 7px;
  font-size: 11px;
  line-height: 22px;
}
</style>
