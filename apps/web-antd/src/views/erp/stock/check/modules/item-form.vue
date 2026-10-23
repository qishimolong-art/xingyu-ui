<script lang="ts" setup>
import DecimalAmountInput from '#/views/erp/components/DecimalAmountInput.vue';
/* eslint-disable vue/html-closing-bracket-newline -- Oxfmt manages multiline template layout. */
/* eslint-disable vue/custom-event-name-casing -- Preserve existing stock form events. */
import type { StockCheckDecimalField } from './stock-check-decimal';
import type { StockCheckItemSortOrder } from './stock-check-item-sort';

import type { ErpStockCheckApi as ErpStockCheckApiType } from '#/api/erp/stock/check';
import type { ErpStockApi } from '#/api/erp/stock/stock';
import type { ErpWarehouseApi } from '#/api/erp/stock/warehouse';

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

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import { getProduct } from '#/api/erp/product/product';
import { ErpStockCheckApi } from '#/api/erp/stock/check';
import {
  getAvailableBatchNoList,
  getStockCount,
  getStockPage,
} from '#/api/erp/stock/stock';
import {
  getWarehouse,
  getWarehouseSimplePage,
} from '#/api/erp/stock/warehouse';
import { isFieldHidden } from '#/composables/useFieldPermission';
import ErpInlineStockSelect from '#/views/erp/components/ErpInlineStockSelect.vue';
import ErpLazyPageSelect from '#/views/erp/components/ErpLazyPageSelect.vue';
import ItemPriceReferenceOverlay from '#/views/erp/components/ItemPriceReferenceOverlay.vue';
import PurchaseItemDetailShortcuts from '#/views/erp/purchase/components/PurchaseItemDetailShortcuts.vue';
import {
  focusPurchaseShortcutOwner,
  isPurchaseShortcutOwnerActive,
} from '#/views/erp/purchase/utils/shortcut-scope';
import StockBatchUpdateItemsForm from '#/views/erp/stock/components/stock-batch-update-items-form.vue';
import {
  CURRENT_SELECT_LABEL_PLACEHOLDER,
  isMissingStockDocumentDisplayName,
  isResolvedStockDocumentOption,
  mergeResolvedStockDocumentOptions,
  mergeStockDocumentOption,
} from '#/views/erp/stock/utils/document-form-ui';
import { prepareStockDocumentItemColumns } from '#/views/erp/stock/utils/document-item-table';
import { createStockItemClientRowKeyManager } from '#/views/erp/stock/utils/item-row-key';
import { stockDecimal } from '#/views/erp/stock/utils/stock-decimal';
import { stockAdd, stockSubtract } from '#/views/erp/stock/utils/stock-decimal';
import {
  stockNatural as erpCountInputFormatter,
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
  isEditableEnterTarget,
} from '#/views/erp/utils/keyboard';
import {
  copyPriceReferenceFields,
  useItemPriceReferenceShortcut,
} from '#/views/erp/utils/price-reference';

import { useFormItemColumns } from '../data';
import { useStockCheckColumns } from '../stock-check-columns';
import {
  formatStockCheckDecimal,
  parseStockCheckDecimal,
} from './stock-check-decimal';
import { sortStockCheckItems } from './stock-check-item-sort';

const props = withDefaults(defineProps<Props>(), {
  beforeBatchWarehouseUpdate: undefined,
  items: () => [],
  checkType: ErpStockCheckApi.CHECK_TYPE_COUNT,
  disabled: false,
  enableBatchEdit: false,
  hiddenFields: () => [],
  checkId: undefined,
  deptId: undefined,
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
  'batch-update-success',
  'page-change',
  'request-submit',
  'refresh-items',
  'update:items',
]);

provide(CANDIDATE_FOCUS_KEY, ref(true));

interface Props {
  beforeBatchWarehouseUpdate?: (
    rows: ErpStockCheckApiType.StockCheckItem[],
    warehouseId: number,
  ) => boolean | Promise<boolean>;
  items?: ErpStockCheckApiType.StockCheckItem[];
  checkType?: number;
  disabled?: boolean;
  enableBatchEdit?: boolean;
  hiddenFields?: string[];
  checkId?: number;
  deptId?: number;
  itemPageLoading?: boolean;
  itemPagination?: StockCheckItemPagination;
  remotePaging?: boolean;
}

type StockCheckFormItem = Partial<ErpStockCheckApiType.StockCheckItem> & {
  seq?: number | string;
};

type StockCheckItemPagination = {
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

const STOCK_CHECK_ITEM_COUNT_INPUT_SELECTOR =
  '[data-stock-check-count-input="true"]';
const STOCK_CHECK_ITEM_TOTAL_PRICE_INPUT_SELECTOR =
  '[data-stock-check-total-price-input="true"]';
const STOCK_CHECK_PRODUCT_SELECT_INPUT_SELECTOR =
  '[data-erp-inline-stock-select-input="true"]';

const DEFAULT_ITEM_PAGE_SIZE = 10;
const ITEM_PAGE_SIZE_OPTIONS = ['10', '20', '50', '100', '200'];
const ITEM_TABLE_VISIBLE_ROWS = 10;
const ITEM_TABLE_HEADER_HEIGHT = 40;
const ITEM_TABLE_ROW_HEIGHT = 40;
const ITEM_TABLE_HEIGHT =
  ITEM_TABLE_HEADER_HEIGHT + ITEM_TABLE_ROW_HEIGHT * ITEM_TABLE_VISIBLE_ROWS;

const renderedItemRows = ref<StockCheckFormItem[]>([]);
const tableData = ref<StockCheckFormItem[]>([]); // 表格数据
const itemRowKeyManager = createStockItemClientRowKeyManager('stock-check');
const inlineStockSelectorOpen = ref(false);
const { itemTableWrapRef, priceReferenceOpen } = useItemPriceReferenceShortcut({
  isBlocked: () => shortcutsBlocked(),
});
const warehouseOptions = ref<ErpWarehouseApi.Warehouse[]>([]); // 仓库下拉选项
const batchNoOptionsMap = ref<Record<string, any[]>>({});
const activeItemSort = ref<null | {
  field: string;
  order: StockCheckItemSortOrder;
}>(null);
const isCostCheck = computed(
  () => props.checkType === ErpStockCheckApi.CHECK_TYPE_COST,
);
const selectedBatchItemRows = ref<StockCheckFormItem[]>([]);
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
  props.checkId ? ['erp:stock-check:update'] : ['erp:stock-check:create'],
);
const canShowBatchUpdateItems = computed(
  () =>
    props.enableBatchEdit &&
    (!props.disabled || Boolean(props.checkId)) &&
    hasAccessByCodes(batchUpdateAccessCodes.value) &&
    !isFieldHidden(props.hiddenFields, 'item_warehouseId'),
);
const selectedBatchItemIds = computed(() =>
  selectedBatchItemRows.value
    .filter((value) => canBatchUpdateItemRow(value))
    .map((row) => row.id!)
    .filter(Boolean),
);
const selectedBatchItemCount = computed(
  () =>
    selectedBatchItemRows.value.filter((value) => canBatchUpdateItemRow(value))
      .length,
);
const batchEditableItemCount = computed(
  () => tableData.value.filter((value) => canBatchUpdateItemRow(value)).length,
);
const selectedDeleteItemRows = computed(() =>
  selectedBatchItemRows.value.filter((value) => canDeleteItemRow(value)),
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
let isInternalUpdate = false;
let warehouseHydrateSeq = 0;

const itemShortcutsRef =
  ref<InstanceType<typeof PurchaseItemDetailShortcuts>>();
const activeItemRow = ref<StockCheckFormItem>();
const decimalInputs = ref<Record<string, string>>({});
const historyPermissions: Record<string, string[]> = {
  ' ': ['erp:purchase-in:query', 'erp:purchase-return:query'],
  Shift: ['erp:purchase-order:query'],
  s: ['erp:sale-out:query'],
  q: ['erp:sale-quote:query'],
  f: ['erp:product:update'],
};
function canUseHistory(key: string) {
  return (historyPermissions[key] ?? []).some((code) =>
    hasAccessByCodes([code]),
  );
}
function shortcutsBlocked() {
  return (
    inlineStockSelectorOpen.value ||
    hasOpenFormControlPopup() ||
    batchUpdateItemsModalOpen.value ||
    itemShortcutsRef.value?.isShortcutDialogOpen?.() === true ||
    !isPurchaseShortcutOwnerActive(itemTableWrapRef.value)
  );
}
function activateItem(row: StockCheckFormItem) {
  activeItemRow.value = row;
}
function handleItemPointer(event: MouseEvent) {
  focusPurchaseShortcutOwner(itemTableWrapRef.value, event.target);
}
function handleHistoryShortcut(event: KeyboardEvent) {
  if (
    event.defaultPrevented ||
    event.repeat ||
    event.isComposing ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    isEditableEnterTarget(event.target)
  ) {
    itemShortcutsRef.value?.resetPendingShortcutState();
    return;
  }
  if (shortcutsBlocked() || priceReferenceOpen.value) return;
  const key = event.key === 'Shift' ? 'Shift' : event.key.toLowerCase();
  if (historyPermissions[key] && !canUseHistory(key)) {
    itemShortcutsRef.value?.resetPendingShortcutState();
    return;
  }
  if (event.shiftKey && key !== 'Shift') {
    itemShortcutsRef.value?.resetPendingShortcutState();
    return;
  }
  if (
    key === 'f' &&
    props.deptId &&
    activeItemRow.value?.warehouseDeptId &&
    props.deptId !== activeItemRow.value.warehouseDeptId
  ) {
    if (
      !event.isComposing &&
      !(event.target as HTMLElement)?.closest('input,textarea,select')
    ) {
      event.preventDefault();
      message.warning('该商品不属于当前单据部门，不能修改');
    }
    return;
  }
  itemShortcutsRef.value?.handleShortcut(event);
}
function handleHistoryKeyup(event: KeyboardEvent) {
  if (!shortcutsBlocked() && !priceReferenceOpen.value)
    itemShortcutsRef.value?.handleShortcutKeyup(event);
  else itemShortcutsRef.value?.resetPendingShortcutState();
}
async function handleShortcutProductUpdated(updated: Record<string, any>) {
  const row = tableData.value.find(
    (item) =>
      item.productId === updated.productId &&
      getItemRowKey(item) === getItemRowKey(updated),
  );
  if (!row?.productId) return;
  const product = await getProduct(row.productId);
  // Product edits refresh metadata only; count, stock snapshot and business prices remain intact.
  for (const field of [
    'productCode',
    'productName',
    'productBarCode',
    'productUnitName',
  ] as const) {
    if (updated[field] !== undefined) row[field] = updated[field];
  }
  copyPriceReferenceFields(row, product);
  emitItemsUpdate(true);
  await itemColumns.reload();
}
function decimalKey(row: StockCheckFormItem, field: StockCheckDecimalField) {
  return `${getItemRowKey(row)}:${field}`;
}
function decimalInvalid(
  row: StockCheckFormItem,
  field: StockCheckDecimalField,
) {
  const text = decimalInputs.value[decimalKey(row, field)];
  if (text === undefined) return false;
  try {
    parseStockCheckDecimal(text, field);
    return false;
  } catch {
    return true;
  }
}
function decimalValue(row: StockCheckFormItem, field: StockCheckDecimalField) {
  return (
    decimalInputs.value[decimalKey(row, field)] ??
    formatStockCheckDecimal(row[field], field)
  );
}
function handleDecimalInput(
  row: StockCheckFormItem,
  field: StockCheckDecimalField,
  text: string,
) {
  activateItem(row);
  if (field === 'count')
    delete decimalInputs.value[decimalKey(row, 'actualCount')];
  if (field === 'actualCount')
    delete decimalInputs.value[decimalKey(row, 'count')];
  decimalInputs.value[decimalKey(row, field)] = text;
  try {
    const value = parseStockCheckDecimal(text, field);
    if (field === 'actualCount') handleActualCountChange(value, row);
    else if (field === 'count') handleCountChange(value, row);
    else {
      row[field] = value;
      handleRowChange(row);
    }
  } catch {
    /* Keep incomplete/invalid text visible until blur or submit validation. */
  }
}
function commitDecimal(row: StockCheckFormItem, field: StockCheckDecimalField) {
  const key = decimalKey(row, field);
  if (!(key in decimalInputs.value)) return;
  const value = parseStockCheckDecimal(decimalInputs.value[key]!, field);
  if (field === 'actualCount') handleActualCountChange(value, row);
  else if (field === 'count') handleCountChange(value, row);
  else {
    row[field] = value;
    handleRowChange(row);
  }
  // Keep session input text, including trailing zeros.
}
function handleDecimalBlur(
  row: StockCheckFormItem,
  field: StockCheckDecimalField,
) {
  try {
    commitDecimal(row, field);
  } catch (error) {
    message.warning((error as Error).message);
  }
}
function flushDecimalInputs() {
  for (const row of tableData.value) {
    for (const field of [
      'actualCount',
      'count',
      'productPrice',
      'totalPrice',
    ] as const)
      commitDecimal(row, field);
  }
}
async function handleToolbarRefresh() {
  flushDecimalInputs();
  if (props.remotePaging) emit('refresh-items');
  else await refreshItemGrid();
}

function canBatchUpdateItemRow(row?: StockCheckFormItem) {
  return Boolean(row?.productId && (!props.disabled || row.id));
}

function canDeleteItemRow(row?: StockCheckFormItem) {
  return Boolean(row && !props.disabled);
}

function canSelectItemRow(row?: StockCheckFormItem) {
  return canBatchUpdateItemRow(row) || canDeleteItemRow(row);
}

function filterSelectOption(input: string, option: any) {
  const keyword = input.trim().toLowerCase();
  const label = String(
    option?.label ?? option?.name ?? option?.title ?? option?.value ?? '',
  );
  return label.toLowerCase().includes(keyword);
}

function findWarehouseOption(warehouseId?: number) {
  return warehouseOptions.value.find(
    (item) => String(item.id) === String(warehouseId),
  );
}

function getWarehouseLabel(row: StockCheckFormItem) {
  return (
    (isMissingStockDocumentDisplayName(row.warehouseName, row.warehouseId)
      ? undefined
      : row.warehouseName) ||
    findWarehouseOption(row.warehouseId)?.name ||
    '-'
  );
}

function getCurrentWarehouseOption(row: StockCheckFormItem) {
  if (!row?.warehouseId) {
    return [];
  }
  const existed = findWarehouseOption(row.warehouseId);
  if (existed && isResolvedStockDocumentOption(existed)) {
    return [existed];
  }
  const currentName = row.warehouseName;
  const label = isMissingStockDocumentDisplayName(currentName, row.warehouseId)
    ? CURRENT_SELECT_LABEL_PLACEHOLDER
    : currentName;
  return [
    {
      deptId: row.warehouseDeptId,
      deptName: row.warehouseDeptName,
      id: row.warehouseId,
      label,
      name: label,
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
      .map((value) => normalizeWarehouseOption(value))
      .filter(Boolean),
  ) as ErpWarehouseApi.Warehouse[];
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

function buildBatchNoOptionsKey(row: StockCheckFormItem) {
  return row.productId && row.warehouseId
    ? `${row.productId}-${row.warehouseId}`
    : '';
}

function buildStockCheckItemDuplicateKey(row: StockCheckFormItem) {
  if (!row.productId || !row.warehouseId) {
    return '';
  }
  return `${row.productId}-${row.warehouseId}-${String(row.batchNo ?? '').trim()}`;
}

function getBatchNoOptions(row: StockCheckFormItem) {
  const key = buildBatchNoOptionsKey(row);
  return key ? batchNoOptionsMap.value[key] || [] : [];
}

async function loadBatchNoOptions(row: StockCheckFormItem) {
  const key = buildBatchNoOptionsKey(row);
  if (!key) {
    row.batchNo = undefined;
    return;
  }
  if (!isBatchNoEnabled(row.batchNoEnabled)) {
    row.batchNo = undefined;
    batchNoOptionsMap.value[key] = [];
    return;
  }
  const list = await getAvailableBatchNoList({
    decimalMode: 'string',
    productId: row.productId as number,
    warehouseId: row.warehouseId as number,
  });
  batchNoOptionsMap.value[key] = (list || []).map((item) => ({
    label: item.batchNo,
    value: item.batchNo,
  }));
}

function normalizeCostRows() {
  if (!isCostCheck.value) {
    return;
  }
  tableData.value.forEach((row) => {
    row.actualCount = row.stockCount || 0;
    row.count = 0;
  });
  emitItemsUpdate(true);
}

function getDisplayedItems() {
  const activeSort = activeItemSort.value;
  const rows =
    !activeSort || props.remotePaging
      ? [...tableData.value]
      : sortStockCheckItems(
          tableData.value,
          activeSort.field,
          activeSort.order,
          { warehouseOptions: warehouseOptions.value },
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
  gridApi.setGridOptions({ data: displayData });
  await itemColumns.reload();
  await gridApi.grid.loadData(displayData);
  activeItemRow.value = displayData.find(
    (row) => getItemRowKey(row) === getItemRowKey(activeItemRow.value),
  );
}

async function handleItemSortChange({ field, order }: any) {
  flushDecimalInputs();
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
  flushDecimalInputs();
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
) {
  const columns =
    useFormItemColumns(props.disabled, props.checkType, hiddenFields) || [];
  if (canShowItemSelection.value) {
    columns.unshift({
      fixed: 'left',
      type: 'checkbox',
      width: 44,
    } as any);
  }
  return prepareStockDocumentItemColumns(
    columns.filter((column) => column.visible !== false) as any[],
    {
      editable: !props.disabled,
      rows,
      trailingFlexibleColumnMinWidth: 150,
    },
  );
}

function clearBatchItemSelection() {
  selectedBatchItemRows.value = [];
  gridApi.grid?.clearCheckboxRow?.();
  gridApi.grid?.clearCheckboxReserve?.();
}

const itemColumns = useStockCheckColumns({
  columns: () => buildItemColumns(),
  data: getDisplayedItems,
  grid: () => gridApi,
  wrapper: () => itemTableWrapRef.value,
});

/** 表格配置 */
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
    id: 'erp-stock-check-item-list-v2',
    autoResize: true,
    border: true,
    showHeaderOverflow: 'tooltip',
    showOverflow: 'tooltip',
    scrollX: {
      enabled: true,
      gt: 8,
    },
    rowConfig: {
      keyField: 'clientRowKey',
      isHover: true,
      isCurrent: true,
    },
    checkboxConfig: {
      checkMethod: ({ row }: { row: StockCheckFormItem }) =>
        canSelectItemRow(row),
    },
    pagerConfig: {
      enabled: false,
    },
    toolbarConfig: {
      enabled: true,
      custom: true,
      zoom: true,
      refresh: { queryMethod: handleToolbarRefresh },
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
    custom: itemColumns.custom,
    resizableChange: itemColumns.queue,
    zoom: itemColumns.queue,
    cellClick: ({ row }: { row: StockCheckFormItem }) => activateItem(row),
    currentRowChange: ({ row }: { row?: StockCheckFormItem }) => {
      activeItemRow.value = row;
    },
    sortChange: handleItemSortChange,
    checkboxAll: ({ records }: { records: StockCheckFormItem[] }) => {
      selectedBatchItemRows.value = records.filter((value) =>
        canSelectItemRow(value),
      );
      if (records.length > 0) activateItem(records[records.length - 1]!);
    },
    checkboxChange: ({ records }: { records: StockCheckFormItem[] }) => {
      selectedBatchItemRows.value = records.filter((value) =>
        canSelectItemRow(value),
      );
      if (records.length > 0) activateItem(records[records.length - 1]!);
    },
  },
});

watch(
  () => [props.hiddenFields, props.checkType, props.disabled],
  async ([hiddenFields]) => {
    await nextTick();
    await gridApi.grid.reloadColumn(buildItemColumns(hiddenFields as string[]));
    clearBatchItemSelection();
    if (activeItemSort.value) {
      await gridApi.grid.setSort(activeItemSort.value);
    }
    await refreshItemGrid();
    normalizeCostRows();
  },
  { deep: true },
);

watch(
  () => [props.disabled, props.enableBatchEdit, props.checkId],
  async () => {
    await nextTick();
    await gridApi.grid.reloadColumn(buildItemColumns());
    await refreshItemGrid();
    clearBatchItemSelection();
  },
);

async function syncItemsFromProps(
  items = props.items,
  options: SyncItemsFromPropsOptions = {},
) {
  if (!items) {
    return;
  }
  if (isInternalUpdate && !options.force) {
    isInternalUpdate = false;
    return;
  }
  if (options.force) {
    isInternalUpdate = false;
  }
  const nextRows = items.map((item, index) => {
    const row = {
      ...item,
      seq: (item as StockCheckFormItem).seq ?? item.id ?? index + 1,
    } as StockCheckFormItem;
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
  await nextTick();
  await gridApi.grid.reloadColumn(buildItemColumns());
  await refreshItemGrid();
  clearBatchItemSelection();
}

/** 监听外部传入的列表数据 */
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
            order: orderDirection as StockCheckItemSortOrder,
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

function emitItemsUpdate(skipReload = false) {
  isInternalUpdate = skipReload;
  emit('update:items', [...tableData.value]);
  // A field edit never reloads columns/data, even while a sort is active.
}

function fillWarehouseSnapshot(row: StockCheckFormItem) {
  const warehouse = warehouseOptions.value.find(
    (item) => item.id === row.warehouseId,
  );
  if (!warehouse) {
    return;
  }
  row.warehouseDeptId ??= warehouse.deptId;
  row.warehouseDeptName ??= warehouse.deptName;
}

function findRowIndex(row: StockCheckFormItem) {
  return tableData.value.findIndex(
    (item) => item === row || getItemRowKey(item) === getItemRowKey(row),
  );
}

/** 处理删除 */
function handleDelete(row: StockCheckFormItem) {
  deleteItemRows([row]);
}

function deleteItemRows(rows: StockCheckFormItem[]) {
  if (rows.length === 0 || props.disabled) {
    return;
  }
  const rowKeySet = new Set(rows.map((row) => getItemRowKey(row)));
  tableData.value = tableData.value.filter(
    (item) => !rowKeySet.has(getItemRowKey(item)),
  );
  clearBatchItemSelection();
  emitItemsUpdate(false);
}

/** 处理仓库变更 */
async function handleWarehouseChange(warehouseId: any, row: any, option?: any) {
  if (!warehouseId) {
    row.warehouseId = undefined;
    row.warehouseName = undefined;
    row.warehouseDeptId = undefined;
    row.warehouseDeptName = undefined;
    row.batchNo = undefined;
    handleRowChange(row);
    return;
  }
  const selected = Array.isArray(option) ? option[0] : option;
  const warehouse =
    normalizeWarehouseOption(selected) ||
    warehouseOptions.value.find((w) => String(w.id) === String(warehouseId)) ||
    (await getWarehouse(Number(warehouseId)).catch(() => undefined));
  row.warehouseId = warehouseId;
  row.warehouseName = warehouse?.name;
  row.warehouseDeptId = warehouse?.deptId;
  row.warehouseDeptName = warehouse?.deptName;
  if (!warehouse) {
    handleRowChange(row);
    return;
  }
  handleWarehouseOptionsChange([warehouse]);

  if (row.productId) {
    row.stockCount = (await getStockCount(row.productId, warehouseId)) || 0;
    row.batchNo = undefined;
    await loadBatchNoOptions(row);
    if (isCostCheck.value) {
      row.actualCount = row.stockCount || 0;
      row.count = 0;
    }
  }

  handleRowChange(row);
}

/** 处理实际库存变更 */
function handleActualCountChange(actualCount: any, row: any) {
  row.actualCount = actualCount;
  if (row.stockCount !== undefined && row.actualCount !== undefined) {
    row.count = stockSubtract(row.actualCount, row.stockCount);
  }
  handleRowChange(row);
}

function handleCountChange(count: any, row: any) {
  row.count = count || 0;
  row.actualCount = stockAdd(row.stockCount || 0, row.count);
  handleRowChange(row);
}

/** 处理行数据变更 */
function handleRowChange(row: any) {
  if (isCostCheck.value) {
    row.actualCount = row.stockCount || 0;
    row.count = 0;
  }
  refreshRowAmount(row);
  const index = findRowIndex(row);
  if (index === -1) {
    tableData.value.push(row);
  } else {
    tableData.value[index] = row;
  }
  emitItemsUpdate(index !== -1);
}

function refreshRowAmount(row: any) {
  if (!isCostCheck.value) {
    row.totalPrice =
      erpPriceMultiply(row.productPrice || 0, row.count || 0) ?? 0;
  }
  row.totalWeight = erpPriceMultiply(row.weight || 0, row.count || 0) ?? 0;
}

function handleBatchNoChange(batchNo: any, row: any) {
  row.batchNo =
    batchNo === undefined || batchNo === null ? undefined : String(batchNo);
  handleRowChange(row);
}

/** 初始化行数据 */
function initRow(row: StockCheckFormItem) {
  row.batchNoEnabled = isBatchNoEnabled(row.batchNoEnabled);
  fillWarehouseSnapshot(row);
  loadBatchNoOptions(row);
  if (isCostCheck.value) {
    row.actualCount = row.stockCount || 0;
    row.count = 0;
  }
  if (
    !isCostCheck.value &&
    row.totalPrice == null &&
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

function getItemRowKey(row?: StockCheckFormItem) {
  if (!row) return '';
  return itemRowKeyManager.ensureRowKey(row);
}

function escapeAttrValue(value: string) {
  return value.replaceAll('\\', '\\\\').replaceAll('"', String.raw`\"`);
}

function getProductInputValue(row: StockCheckFormItem) {
  const keyword = (row as any).__stockKeyword;
  return keyword === undefined || keyword === null
    ? row.productName || ''
    : String(keyword);
}

function handleProductKeywordInput(row: StockCheckFormItem, value: string) {
  (row as any).__stockKeyword = value;
}

function focusProductNameInput(row: StockCheckFormItem) {
  if (props.disabled) {
    return false;
  }
  const rowKey = getItemRowKey(row);
  const selector = rowKey
    ? `${STOCK_CHECK_PRODUCT_SELECT_INPUT_SELECTOR}[data-erp-inline-stock-row-key="${escapeAttrValue(rowKey)}"]`
    : STOCK_CHECK_PRODUCT_SELECT_INPUT_SELECTOR;
  return focusFirstEditableInput(itemTableWrapRef.value, selector);
}

function getInlineStockPageParams() {
  return { bizType: 'stock' as const };
}

function createBlankItemRow() {
  const row: StockCheckFormItem = {
    count: 0,
    actualCount: 0,
    productPrice: 0,
    seq: nextSeq(),
  };
  itemRowKeyManager.ensureRowKey(row, { forceNew: true });
  initRow(row);
  return row;
}

const itemRowFocusController = createErpItemRowFocusController({
  focusField: (row: StockCheckFormItem, field) =>
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
  emitItemsUpdate(false);
  await itemRowFocusController.focus(row, 'product');
}

function buildStockCheckItemFromStock(
  product: ErpStockApi.Stock,
  overrides: Partial<StockCheckFormItem> = {},
) {
  const row: StockCheckFormItem = {
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
    packageQty: product.packageQty,
    weight: product.weight,
    batchNoEnabled: isBatchNoEnabled(product.batchNoEnabled),
    stockCount: product.count ?? 0,
    actualCount: product.count ?? 0,
    productPrice: product.lastPurchasePrice ?? 0,
    count: 0,
    totalPrice: 0,
    ...overrides,
  };
  copyPriceReferenceFields(row, product);
  refreshRowAmount(row);
  itemRowKeyManager.ensureRowKey(row, { forceNew: true });
  return row;
}

function buildReplacementStockCheckItemFromStock(
  stock: ErpStockApi.Stock,
  targetRow: StockCheckFormItem,
) {
  const row = buildStockCheckItemFromStock(stock);
  row.id = targetRow.id;
  row.seq = targetRow.seq ?? row.seq;
  row.clientRowKey = targetRow.clientRowKey ?? row.clientRowKey;
  (row as any).checkId = (targetRow as any).checkId;
  return row;
}

/** 表单校验 */
function validate(
  items = tableData.value,
  options: { requireItems?: boolean } = {},
) {
  if ((options.requireItems ?? true) && items.length === 0) {
    throw new Error('盘点明细不能为空');
  }
  flushDecimalInputs();
  const duplicateKeys = new Set<string>();
  for (const [i, item] of items.entries()) {
    if (item) {
      if (!item.warehouseId) {
        throw new Error(`第 ${i + 1} 行：仓库不能为空`);
      }
      if (!item.productId) {
        throw new Error(`第 ${i + 1} 行：产品不能为空`);
      }
      if (
        !isCostCheck.value &&
        (item.count === undefined || item.count === null)
      ) {
        throw new Error(`第 ${i + 1} 行：调整数不能为空`);
      }
      if (
        item.productPrice === undefined ||
        item.productPrice === null ||
        stockDecimal(item.productPrice).lt(0)
      ) {
        throw new Error(`第 ${i + 1} 行：价格不能为空且不能为负`);
      }
      if (
        isCostCheck.value &&
        (item.totalPrice === undefined ||
          item.totalPrice === null ||
          stockDecimal(item.totalPrice).lt(0))
      ) {
        throw new Error(`第 ${i + 1} 行：金额不能为空且不能为负`);
      }
      const duplicateKey = buildStockCheckItemDuplicateKey(item);
      if (duplicateKey && duplicateKeys.has(duplicateKey)) {
        throw new Error(`第 ${i + 1} 行：产品、仓库、批次号重复`);
      }
      duplicateKeys.add(duplicateKey);
    }
  }
}

function getItems() {
  flushDecimalInputs();
  return [...tableData.value];
}

defineExpose({
  flushDecimalInputs,
  focusFirstItemCountInput,
  focusItemRow: (row: StockCheckFormItem, field: 'count' | 'product') =>
    itemRowFocusController.focus(row, field),
  getItems,
  reloadItemsFromProps,
  validate,
});

function handleGlobalInsertShortcut(event: KeyboardEvent) {
  if (
    props.disabled ||
    shortcutsBlocked() ||
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
  window.addEventListener('keydown', handleHistoryShortcut, true);
  window.addEventListener('keyup', handleHistoryKeyup, true);
  warehouseOptions.value = mergeCurrentWarehouseOptions();
  hydrateWarehouseNamesFromOptions();
  await hydrateMissingWarehouseNamesFromApi();
  tableData.value.forEach((row) => initRow(row));
  if (activeItemSort.value || props.disabled) {
    await refreshItemGrid();
  }
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalInsertShortcut, true);
  window.removeEventListener('keydown', handleHistoryShortcut, true);
  window.removeEventListener('keyup', handleHistoryKeyup, true);
});

function filterReviewableStocks(
  targetRow: StockCheckFormItem,
  products: ErpStockApi.Stock[],
) {
  const targetRowKey = getItemRowKey(targetRow);
  const existedKeys = new Set(
    tableData.value
      .filter((item) => getItemRowKey(item) !== targetRowKey)
      .map((item) => buildStockCheckItemDuplicateKey(item)),
  );
  const selected = products.filter((product) => {
    const key = buildStockCheckItemDuplicateKey({
      productId: product.productId,
      warehouseId: product.warehouseId,
      batchNo: undefined,
    });
    if (key && existedKeys.has(key)) {
      message.warning(
        `产品【${product.productName || product.productCode}】在该仓库已存在未指定批次的明细`,
      );
      return false;
    }
    existedKeys.add(key);
    return true;
  });
  if (selected.length === 0) {
    return [];
  }
  return selected;
}

async function insertStockProducts(
  targetRow: StockCheckFormItem,
  products: ErpStockApi.Stock[],
) {
  if (!products || products.length === 0) return;
  const targetRowKey = getItemRowKey(targetRow);
  const selected = filterReviewableStocks(targetRow, products);
  if (selected.length === 0) return;
  const replacement = buildReplacementStockCheckItemFromStock(
    selected[0]!,
    targetRow,
  );
  const appendSeqStart = nextSeq();
  const additionalRows = selected.slice(1).map((product, index) =>
    buildStockCheckItemFromStock(product, {
      seq: appendSeqStart + index,
    }),
  );
  await Promise.all(
    [replacement, ...additionalRows].map((row) => loadBatchNoOptions(row)),
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
  row: StockCheckFormItem,
  stocks: ErpStockApi.Stock[],
) {
  await insertStockProducts(row, stocks);
}

function handleInlineStockOpenChange(open: boolean) {
  inlineStockSelectorOpen.value = open;
}

function handleBatchDeleteItems() {
  const rows = selectedDeleteItemRows.value.filter((value) =>
    canDeleteItemRow(value),
  );
  if (rows.length === 0) {
    message.warning('请先勾选需要删除的盘点明细');
    return;
  }
  Modal.confirm({
    title: `确认删除选中的 ${rows.length} 条盘点明细吗？`,
    onOk: async () => {
      deleteItemRows(rows);
    },
  });
}

function focusFirstItemCountInput() {
  if (props.disabled) {
    return false;
  }
  return focusFirstEditableInput(
    itemTableWrapRef.value,
    isCostCheck.value
      ? STOCK_CHECK_ITEM_TOTAL_PRICE_INPUT_SELECTOR
      : STOCK_CHECK_ITEM_COUNT_INPUT_SELECTOR,
  );
}

function focusItemCountInput(row: StockCheckFormItem) {
  return focusEditableInputByRowKey(
    itemTableWrapRef.value,
    isCostCheck.value
      ? STOCK_CHECK_ITEM_TOTAL_PRICE_INPUT_SELECTOR
      : STOCK_CHECK_ITEM_COUNT_INPUT_SELECTOR,
    getItemRowKey(row),
  );
}

function handleItemInputPressEnter(event: KeyboardEvent) {
  if (event.isComposing) return;
  try {
    flushDecimalInputs();
  } catch (error) {
    event.preventDefault();
    event.stopPropagation();
    message.warning((error as Error).message);
    return;
  }
  const enterFocusResult = focusNextInputOnEnter(event);
  if (enterFocusResult === 'last-input') {
    emit('request-submit', event);
  }
}

function getSelectedBatchItemRows() {
  return selectedBatchItemRows.value.filter((value) =>
    canBatchUpdateItemRow(value),
  );
}

function isSelectedBatchItemRow(row: StockCheckFormItem) {
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
    message.warning('请先勾选可批量修改的盘点明细');
    return;
  }
  batchUpdateItemsModalApi
    .setData({
      documentId: props.disabled ? props.checkId : undefined,
      documentType: 'check',
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
    message.warning('请先勾选可批量修改的盘点明细');
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
      selectedRows as ErpStockCheckApiType.StockCheckItem[],
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
    item.batchNo = undefined;
    updatedCount += 1;
  });
  await Promise.allSettled(
    selectedRows.map(async (row) => {
      row.stockCount =
        row.productId && row.warehouseId
          ? (await getStockCount(row.productId, row.warehouseId)) || 0
          : 0;
      await loadBatchNoOptions(row);
      if (isCostCheck.value) {
        row.actualCount = row.stockCount || 0;
        row.count = 0;
      }
      refreshRowAmount(row);
    }),
  );
  emitItemsUpdate(true);
  await refreshItemGrid();
  clearBatchItemSelection();
  if (showMessage) {
    message.success(`已批量更新 ${updatedCount} 条盘点明细`);
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
  <div class="stock-check-item-form w-full">
    <div
      ref="itemTableWrapRef"
      class="stock-check-item-table-wrap relative"
      tabindex="-1"
      @mousedown="handleItemPointer"
    >
      <Grid class="stock-check-item-grid w-full">
        <template #toolbar-buttons>
          <div class="stock-check-item-toolbar-left">
            <div class="stock-document-item-shortcut-hint">
              <span class="stock-document-item-shortcut-hint__label"
                >当前页</span
              >
              <span v-if="canUseHistory(' ')"
                ><kbd>Space</kbd><b>采购历史</b></span
              >
              <span v-if="canUseHistory('Shift')"
                ><kbd>Shift</kbd><b>采购订单历史</b></span
              >
              <span v-if="canUseHistory('s')"><kbd>S</kbd><b>销售历史</b></span>
              <span v-if="canUseHistory('q')"
                ><kbd>Q</kbd><b>报价订单历史</b></span
              >
              <span v-if="canUseHistory('f')"><kbd>F</kbd><b>修改商品</b></span>
              <span><kbd>W</kbd><b>全部价格</b></span>
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
          <div class="stock-check-item-toolbar flex items-center gap-2">
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
            popup-class-name="stock-document-form-select-dropdown erp-candidate-focus-popup"
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
            settings-scope="stock-check"
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
            popup-class-name="stock-document-form-select-dropdown erp-candidate-focus-popup"
            :options="getBatchNoOptions(row)"
            allow-clear
            show-search
            :filter-option="filterSelectOption"
            class="w-full"
            placeholder="请选择批次号"
            :disabled="
              !isBatchNoEnabled(row.batchNoEnabled) ||
              !row.productId ||
              !row.warehouseId
            "
            @change="handleBatchNoChange($event, row)"
          />
          <span v-else>{{ row.batchNo || '-' }}</span>
        </template>
        <template #actualCount="{ row }">
          <Input
            v-if="!disabled && !isCostCheck"
            type="text"
            inputmode="decimal"
            :value="decimalValue(row, 'actualCount')"
            :aria-invalid="decimalInvalid(row, 'actualCount')"
            :data-erp-item-row-key="getItemRowKey(row)"
            data-stock-check-count-input="true"
            @input="
              handleDecimalInput(row, 'actualCount', $event.target.value ?? '')
            "
            @blur="handleDecimalBlur(row, 'actualCount')"
            @press-enter="handleItemInputPressEnter"
          />
          <span v-else>{{
            erpCountInputFormatter(row.actualCount) || '-'
          }}</span>
        </template>
        <template #count="{ row }">
          <Input
            v-if="!disabled && !isCostCheck"
            type="text"
            inputmode="decimal"
            :value="decimalValue(row, 'count')"
            :aria-invalid="decimalInvalid(row, 'count')"
            :data-erp-item-row-key="getItemRowKey(row)"
            data-stock-check-count-input="true"
            @input="handleDecimalInput(row, 'count', $event.target.value ?? '')"
            @blur="handleDecimalBlur(row, 'count')"
            @press-enter="handleItemInputPressEnter"
          />
          <span v-else>{{ erpCountInputFormatter(row.count) || '-' }}</span>
        </template>
        <template #productPrice="{ row }">
          <DecimalAmountInput
            v-if="!disabled"
            type="text"
            inputmode="decimal"
            :value="decimalValue(row, 'productPrice')"
            :aria-invalid="decimalInvalid(row, 'productPrice')"
            :data-erp-item-row-key="getItemRowKey(row)"
            data-stock-check-productPrice-input="true"
            @input="
              handleDecimalInput(row, 'productPrice', $event.target.value ?? '')
            "
            @blur="handleDecimalBlur(row, 'productPrice')"
            @press-enter="handleItemInputPressEnter"
          />
          <span v-else>{{
            erpPriceInputFormatter(row.productPrice) || '-'
          }}</span>
        </template>
        <template #totalPrice="{ row }">
          <DecimalAmountInput
            v-if="!disabled && isCostCheck"
            type="text"
            inputmode="decimal"
            :value="decimalValue(row, 'totalPrice')"
            :aria-invalid="decimalInvalid(row, 'totalPrice')"
            :data-erp-item-row-key="getItemRowKey(row)"
            data-stock-check-total-price-input="true"
            @input="
              handleDecimalInput(row, 'totalPrice', $event.target.value ?? '')
            "
            @blur="handleDecimalBlur(row, 'totalPrice')"
            @press-enter="handleItemInputPressEnter"
          />
          <span v-else>{{
            erpPriceInputFormatter(row.totalPrice) || '-'
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
    <PurchaseItemDetailShortcuts
      ref="itemShortcutsRef"
      :active-row="activeItemRow"
      :dept-id="deptId"
      :hidden-fields="hiddenFields"
      :sale-history-enabled="true"
      :create-enabled="false"
      :is-stock-selector-open="
        () =>
          inlineStockSelectorOpen ||
          batchUpdateItemsModalOpen ||
          priceReferenceOpen
      "
      warning-message="请先点击一条有商品的盘点明细"
      @product-updated="handleShortcutProductUpdated"
    />
    <BatchUpdateItemsModal @success="handleBatchUpdateItemsSuccess" />
    <div v-if="showItemPager" class="stock-check-item-pager">
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
.stock-check-item-form :deep(.vxe-table),
.stock-check-item-form :deep(.ant-input),
.stock-check-item-form :deep(.ant-input-number),
.stock-check-item-form :deep(.ant-select) {
  font-size: 11px;
}

.stock-check-item-toolbar :deep(.ant-btn) {
  height: 28px;
  padding: 2px 10px;
  font-size: 12px;
  line-height: 20px;
}

.stock-check-item-toolbar :deep(.ant-btn span) {
  font-size: 12px;
}

.stock-check-item-toolbar-left {
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

:deep(.vxe-header--column .vxe-cell--title) {
  white-space: nowrap;
}

:deep(.vxe-header--column.is--sortable .vxe-cell--title) {
  color: #1677ff;
}

:deep(.vxe-header--column .vxe-cell--sort) {
  display: none;
}

.stock-check-item-pager {
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
}

.stock-check-item-pager :deep(.ant-pagination),
.stock-check-item-pager :deep(.ant-pagination-item),
.stock-check-item-pager :deep(.ant-pagination-total-text),
.stock-check-item-pager :deep(.ant-pagination-options),
.stock-check-item-pager :deep(.ant-select),
.stock-check-item-pager :deep(.ant-input) {
  font-size: 11px;
}

.stock-check-item-pager :deep(.ant-pagination-item),
.stock-check-item-pager :deep(.ant-pagination-prev),
.stock-check-item-pager :deep(.ant-pagination-next),
.stock-check-item-pager :deep(.ant-pagination-jump-prev),
.stock-check-item-pager :deep(.ant-pagination-jump-next) {
  min-width: 24px;
  height: 24px;
  line-height: 22px;
}

.stock-check-item-pager :deep(.ant-pagination-item a),
.stock-check-item-pager :deep(.ant-pagination-prev button),
.stock-check-item-pager :deep(.ant-pagination-next button) {
  height: 22px;
  font-size: 11px;
  line-height: 22px;
}

.stock-check-item-pager :deep(.ant-pagination-options-size-changer),
.stock-check-item-pager :deep(.ant-select-single),
.stock-check-item-pager :deep(.ant-select-selector) {
  height: 24px;
  line-height: 22px;
}

.stock-check-item-pager
  :deep(.ant-pagination-options-size-changer .ant-select-selector) {
  box-sizing: border-box;
  align-items: center;
  min-height: 24px;
  padding: 0 24px 0 8px;
}

.stock-check-item-pager
  :deep(.ant-select-single .ant-select-selector .ant-select-selection-item) {
  height: 22px;
  font-size: 11px;
  line-height: 22px;
}

.stock-check-item-pager :deep(.ant-select-arrow) {
  margin-top: -5px;
  font-size: 10px;
}

.stock-check-item-pager :deep(.ant-pagination-options-quick-jumper input) {
  height: 24px;
  padding: 0 7px;
  font-size: 11px;
  line-height: 22px;
}
</style>
