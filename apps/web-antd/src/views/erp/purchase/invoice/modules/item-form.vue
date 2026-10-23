<script lang="ts" setup>
import '#/views/erp/purchase/utils/candidate-focus';
import type { ErpPurchaseInvoiceApi } from '#/api/erp/purchase/invoice';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { PurchaseDocumentItemSortOrder } from '#/views/erp/purchase/utils/document-item-table';

import {
  computed,
  nextTick,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  ref,
  watch,
} from 'vue';

import { Input, message, Pagination } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import { isFieldHidden } from '#/composables/useFieldPermission';
import PurchaseItemDetailShortcuts from '#/views/erp/purchase/components/PurchaseItemDetailShortcuts.vue';
import PurchaseItemPriceReferenceOverlay from '#/views/erp/purchase/components/PurchaseItemPriceReferenceOverlay.vue';
import {
  preparePurchaseDocumentItemColumns,
  sortPurchaseDocumentItems,
} from '#/views/erp/purchase/utils/document-item-table';
import {
  applyPurchaseDocumentListColumnCustomization,
  fitPurchaseDocumentColumnsToWidth,
  releasePurchaseDocumentTrailingColumnResize,
  syncPurchaseDocumentColumnDefaults,
  syncPurchaseDocumentOperationColumn,
} from '#/views/erp/purchase/utils/document-list-table';
import { focusNextInputOnEnter } from '#/views/erp/purchase/utils/item-form';
import { createPurchaseItemClientRowKeyManager } from '#/views/erp/purchase/utils/item-row-key';
import {
  formatPurchaseAmount,
  formatPurchaseDecimal,
  parsePurchaseDecimal,
  purchaseDecimalMultiply,
} from '#/views/erp/purchase/utils/decimal';
import {
  focusPurchaseShortcutOwner,
  isPurchaseShortcutOwnerActive,
} from '#/views/erp/purchase/utils/shortcut-scope';
import {
  isPurchasePriceReferenceShortcut,
  shouldIgnorePurchasePriceReferenceShortcut,
} from '#/views/erp/purchase/utils/price-reference';
import { settleVxeColumnCustomization } from '#/views/erp/utils/vxe-column-custom';

import { isPurchaseInvoicePriceItemHidden, useFormItemColumns } from '../data';

interface Props {
  items?: ErpPurchaseInvoiceApi.PurchaseInvoiceItem[];
  disabled?: boolean;
  hiddenFields?: string[];
  itemPageLoading?: boolean;
  itemPagination?: PurchaseInvoiceItemPagination;
  remotePaging?: boolean;
  shortcutActive?: boolean;
}

type PurchaseInvoiceItemPagination = {
  orderDirection?: 'asc' | 'desc';
  orderField?: string;
  pageNo: number;
  pageSize: number;
  total: number;
};

const DEFAULT_ITEM_PAGE_SIZE = 10;
const ITEM_PAGE_SIZE_OPTIONS = ['10', '20', '50', '100', '200'];
const ITEM_TABLE_VISIBLE_ROWS = 10;
const ITEM_TABLE_HEADER_HEIGHT = 40;
const ITEM_TABLE_ROW_HEIGHT = 36;
const ITEM_TABLE_HEIGHT =
  ITEM_TABLE_HEADER_HEIGHT + ITEM_TABLE_ROW_HEIGHT * ITEM_TABLE_VISIBLE_ROWS;

const props = withDefaults(defineProps<Props>(), {
  items: () => [],
  disabled: false,
  hiddenFields: () => [],
  itemPageLoading: false,
  itemPagination: () => ({
    orderDirection: undefined,
    orderField: undefined,
    pageNo: 1,
    pageSize: DEFAULT_ITEM_PAGE_SIZE,
    total: 0,
  }),
  remotePaging: false,
  shortcutActive: true,
});

const emit = defineEmits(['open-in-detail', 'update:items', 'page-change']);

const tableData = ref<ErpPurchaseInvoiceApi.PurchaseInvoiceItem[]>([]);
const displayTableData = ref<ErpPurchaseInvoiceApi.PurchaseInvoiceItem[]>([]);
const priceReferenceOpen = ref(false);
const itemShortcutsRef =
  ref<InstanceType<typeof PurchaseItemDetailShortcuts>>();
const activeItemRowKey = ref<string>();
const itemTableWrapRef = ref<HTMLElement | null>(null);
const activeItemSort = ref<
  { field: string; order: PurchaseDocumentItemSortOrder } | undefined
>();
const localItemPage = ref({ pageNo: 1, pageSize: DEFAULT_ITEM_PAGE_SIZE });
let isInternalUpdate = false;
let lastSyncedItemsSource:
  | ErpPurchaseInvoiceApi.PurchaseInvoiceItem[]
  | undefined;
let isShortcutListening = false;
let isShortcutScopeActive = false;
let itemResizeFrame = 0;
let lastItemTableWidth = 0;
const itemRowKeyManager =
  createPurchaseItemClientRowKeyManager('purchase-invoice');

function getItemTableWidth(
  rows: ErpPurchaseInvoiceApi.PurchaseInvoiceItem[] = displayTableData.value,
) {
  const table =
    itemTableWrapRef.value?.querySelector<HTMLElement>('.vxe-table');
  const header = itemTableWrapRef.value?.querySelector<HTMLElement>(
    '.vxe-table--header-wrapper.body--wrapper',
  );
  const headerWidth =
    header?.clientWidth ?? itemTableWrapRef.value?.clientWidth ?? 0;
  if (!table || rows.length === 0) return headerWidth;
  const scrollbarWidth =
    itemTableWrapRef.value
      ?.querySelector<HTMLElement>('.vxe-table--scroll-y-virtual')
      ?.getBoundingClientRect().width ?? 0;
  const alreadyReserved = Math.max(table.clientWidth - headerWidth, 0);
  return Math.max(
    headerWidth - Math.max(scrollbarWidth - alreadyReserved, 0),
    0,
  );
}

function getItemRowKey(row?: ErpPurchaseInvoiceApi.PurchaseInvoiceItem) {
  if (!row) return undefined;
  return row.clientRowKey || itemRowKeyManager.ensureRowKey(row);
}

function setActiveItemRow(row?: ErpPurchaseInvoiceApi.PurchaseInvoiceItem) {
  activeItemRowKey.value = getItemRowKey(row);
}

const activeItemRow = computed(() =>
  tableData.value.find(
    (item) => getItemRowKey(item) === activeItemRowKey.value,
  ),
);

function getItemRowClassName({ row }: { row: any }) {
  return getItemRowKey(row) === activeItemRowKey.value
    ? 'purchase-document-item-row--active'
    : '';
}

function setRowTextValues(row: ErpPurchaseInvoiceApi.PurchaseInvoiceItem) {
  row.countText = formatPurchaseDecimal(row.count);
  row.productPriceText = formatPurchaseAmount(row.productPrice, '0.00');
  row.taxPercentText =
    row.taxPercent === null || row.taxPercent === undefined
      ? ''
      : formatPurchaseDecimal(row.taxPercent);
}

function parseDecimalText(
  value: unknown,
  label: string,
  options: {
    allowEmpty?: boolean;
    decimals: number;
    max?: number;
    min?: number;
  },
) {
  return parsePurchaseDecimal(value, label, options);
}

function prepareItemRows(items: ErpPurchaseInvoiceApi.PurchaseInvoiceItem[]) {
  const rows = items.map((item) => ({ ...item }));
  itemRowKeyManager.ensureRowKeys(rows);
  rows.forEach((item) => {
    calcAmounts(item);
    setRowTextValues(item);
  });
  return rows;
}

async function refreshItemColumns(
  rows: ErpPurchaseInvoiceApi.PurchaseInvoiceItem[] = displayTableData.value,
  applyCustomization = true,
) {
  const preparedColumns = buildItemColumns(props.hiddenFields, rows);
  const columns = fitPurchaseDocumentColumnsToWidth(
    applyCustomization
      ? applyPurchaseDocumentListColumnCustomization(
          preparedColumns,
          gridApi.grid?.getFullColumns?.() ?? [],
          150,
        )
      : preparedColumns,
    getItemTableWidth(rows),
  );
  gridApi.setGridOptions({ columns });
  await gridApi.grid.reloadColumn(columns);
  await nextTick();
  syncPurchaseDocumentColumnDefaults(
    gridApi.grid?.getFullColumns?.() ?? [],
    preparedColumns,
  );
  await syncPurchaseDocumentOperationColumn(gridApi.grid, columns);
  releasePurchaseDocumentTrailingColumnResize(
    gridApi.grid?.getFullColumns?.() ?? [],
  );
  await gridApi.grid?.refreshColumn?.();
  await gridApi.grid?.recalculate?.(true);
}

function buildItemColumns(
  hiddenFields = props.hiddenFields,
  rows = displayTableData.value,
): NonNullable<
  VxeTableGridOptions<ErpPurchaseInvoiceApi.PurchaseInvoiceItem>['columns']
> {
  return preparePurchaseDocumentItemColumns(
    (useFormItemColumns(tableData.value, props.disabled, hiddenFields) ||
      []) as unknown as Parameters<
      typeof preparePurchaseDocumentItemColumns
    >[0],
    {
      editable: !props.disabled,
      rows,
      trailingFlexibleColumnMinWidth: 150,
    },
  ) as unknown as NonNullable<
    VxeTableGridOptions<ErpPurchaseInvoiceApi.PurchaseInvoiceItem>['columns']
  >;
}

function getDisplayTableData() {
  const activeSort = activeItemSort.value;
  const rows =
    !activeSort || props.remotePaging
      ? [...tableData.value]
      : sortPurchaseDocumentItems(
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

async function refreshItemGrid(options: { reloadData?: boolean } = {}) {
  const { reloadData = true } = options;
  const displayData = getDisplayTableData();
  const preparedColumns = buildItemColumns(props.hiddenFields, displayData);
  const columns = fitPurchaseDocumentColumnsToWidth(
    applyPurchaseDocumentListColumnCustomization(
      preparedColumns,
      gridApi.grid?.getFullColumns?.() ?? [],
      150,
    ),
    getItemTableWidth(displayData),
  );
  displayTableData.value = displayData;
  gridApi.setGridOptions({ columns, data: displayData });
  await gridApi.grid.reloadColumn(columns);
  syncPurchaseDocumentColumnDefaults(
    gridApi.grid?.getFullColumns?.() ?? [],
    preparedColumns,
  );
  await syncPurchaseDocumentOperationColumn(gridApi.grid, columns);
  releasePurchaseDocumentTrailingColumnResize(
    gridApi.grid?.getFullColumns?.() ?? [],
  );
  await gridApi.grid?.refreshColumn?.();
  if (activeItemSort.value) await gridApi.grid.setSort(activeItemSort.value);
  if (!reloadData) {
    return;
  }
  await gridApi.grid.reloadData(displayData);
  if (activeItemSort.value) await gridApi.grid.setSort(activeItemSort.value);
}

async function handleItemSortChange({ field, order }: any) {
  activeItemSort.value =
    field && (order === 'asc' || order === 'desc')
      ? { field, order }
      : undefined;
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

async function clearItemSort() {
  activeItemSort.value = undefined;
  await nextTick();
  await gridApi.grid.clearSort();
}

watch(
  () =>
    [
      props.itemPagination?.orderField,
      props.itemPagination?.orderDirection,
    ] as const,
  async ([field, order]) => {
    if (!props.remotePaging) return;
    const nextSort =
      field && (order === 'asc' || order === 'desc')
        ? { field, order }
        : undefined;
    if (
      activeItemSort.value?.field === nextSort?.field &&
      activeItemSort.value?.order === nextSort?.order
    ) {
      return;
    }
    activeItemSort.value = nextSort;
    await nextTick();
    if (nextSort) await gridApi.grid.setSort(nextSort);
    else await clearItemSort();
  },
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

async function handleItemPageChange(pageNo: number, pageSize: number) {
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
    data: displayTableData.value,
    height: ITEM_TABLE_HEIGHT,
    id: 'erp-purchase-invoice-item-list-v1',
    autoResize: true,
    fit: false,
    border: true,
    rowConfig: { keyField: 'clientRowKey', isCurrent: true, isHover: true },
    rowClassName: getItemRowClassName,
    pagerConfig: { enabled: false },
    sortConfig: {
      remote: true,
      multiple: false,
      trigger: 'cell',
      orders: ['asc', 'desc', null],
      allowBtn: false,
    },
    toolbarConfig: {
      custom: true,
      enabled: true,
      refresh: {
        queryMethod: () => refreshItemGrid(),
      },
      slots: { buttons: 'toolbar-buttons', tools: 'toolbar-tools' },
      zoom: true,
    },
  },
  gridEvents: {
    custom: async ({ type }: { type?: string }) => {
      const settled = await settleVxeColumnCustomization(gridApi.grid, type);
      if (!settled) return;
      await refreshItemColumns(displayTableData.value, type !== 'reset');
    },
    sortChange: handleItemSortChange,
    cellClick: ({ row }: { row: ErpPurchaseInvoiceApi.PurchaseInvoiceItem }) =>
      setActiveItemRow(row),
    currentRowChange: ({
      row,
    }: {
      row?: ErpPurchaseInvoiceApi.PurchaseInvoiceItem;
    }) => setActiveItemRow(row),
  },
});

let gridReady = false;

watch(
  () => props.items,
  async (items) => {
    if (!items) return;
    if (items === lastSyncedItemsSource) return;
    lastSyncedItemsSource = items;
    if (isInternalUpdate) {
      isInternalUpdate = false;
      return;
    }
    tableData.value = prepareItemRows(items);
    await nextTick();
    if (!gridReady || !gridApi.grid) return;
    await refreshItemGrid();
    await gridApi.grid.reloadColumn(
      buildItemColumns(props.hiddenFields, displayTableData.value),
    );
  },
  { immediate: true },
);

watch(
  () => props.hiddenFields,
  async () => {
    await nextTick();
    if (!gridReady || !gridApi.grid) return;
    await refreshItemColumns(displayTableData.value);
    if (activeItemSort.value) await gridApi.grid.setSort(activeItemSort.value);
  },
  { deep: true },
);

onMounted(async () => {
  isShortcutScopeActive = true;
  syncShortcutListening();
  await nextTick();
  gridReady = true;
  if (!gridApi.grid) return;
  await refreshItemColumns(displayTableData.value);
  if (tableData.value.length > 0) {
    await refreshItemGrid();
  }
  lastItemTableWidth = getItemTableWidth();
  window.addEventListener('resize', handleItemWindowResize);
});

function isItemFieldHidden(fieldKey: string) {
  return isFieldHidden(props.hiddenFields, `item_${fieldKey}`);
}

function isPriceItemHidden(field: string) {
  return isPurchaseInvoicePriceItemHidden(props.hiddenFields, field);
}

function calcAmounts(row: ErpPurchaseInvoiceApi.PurchaseInvoiceItem) {
  const count = Number(row.count || 0);
  const price = Number(row.productPrice || 0);
  row.taxExclusivePrice = undefined;
  row.taxPrice = 0;
  const rawAmount = purchaseDecimalMultiply(price, count);
  row.totalPrice = row.sourceType === 30 ? -Math.abs(rawAmount) : rawAmount;
}

function emitItemsUpdate(skipReload = false) {
  isInternalUpdate = skipReload;
  emit(
    'update:items',
    tableData.value.map((item) => ({ ...item })),
  );
}

function handleRowChange(row: ErpPurchaseInvoiceApi.PurchaseInvoiceItem) {
  const rowKey = itemRowKeyManager.ensureRowKey(row);
  calcAmounts(row);
  const index = tableData.value.findIndex(
    (item) => item.clientRowKey === rowKey,
  );
  if (index === -1) {
    tableData.value.push(row);
    emitItemsUpdate(false);
    return;
  }
  tableData.value[index] = row;
  emitItemsUpdate(true);
  if (activeItemSort.value) {
    void nextTick(refreshItemGrid);
  }
}

function handleCountBlur(row: ErpPurchaseInvoiceApi.PurchaseInvoiceItem) {
  const max =
    row.sourceRemainingCount === null || row.sourceRemainingCount === undefined
      ? undefined
      : Number(row.sourceRemainingCount);
  const parsed = parseDecimalText(row.countText, '本次开票数量', {
    decimals: 6,
    max,
    min: 0,
  });
  if (!parsed.ok || !parsed.value || parsed.value <= 0) {
    message.warning(parsed.ok ? '本次开票数量必须大于 0' : parsed.message);
    row.countText = formatPurchaseDecimal(row.count);
    return;
  }
  row.count = parsed.value;
  row.countText = formatPurchaseDecimal(parsed.value);
  handleRowChange(row);
}

function handleProductPriceBlur(
  row: ErpPurchaseInvoiceApi.PurchaseInvoiceItem,
) {
  const parsed = parseDecimalText(row.productPriceText, '单价', {
    decimals: 6,
    min: 0,
  });
  if (!parsed.ok) {
    message.warning(parsed.message);
    row.productPriceText = formatPurchaseAmount(row.productPrice, '0.00');
    return;
  }
  row.productPrice = parsed.value;
  row.productPriceText = formatPurchaseAmount(row.productPrice, '0.00');
  handleRowChange(row);
}

function handleTaxPercentBlur(row: ErpPurchaseInvoiceApi.PurchaseInvoiceItem) {
  const parsed = parseDecimalText(row.taxPercentText, '税率', {
    allowEmpty: true,
    decimals: 6,
    max: 100,
    min: 0,
  });
  if (!parsed.ok) {
    message.warning(parsed.message);
    row.taxPercentText =
      row.taxPercent === null || row.taxPercent === undefined
        ? ''
        : formatPurchaseDecimal(row.taxPercent);
    return;
  }
  row.taxPercent = parsed.value;
  row.taxPercentText =
    parsed.value === undefined ? '' : formatPurchaseDecimal(parsed.value);
  handleRowChange(row);
}

function handleDelete(row: ErpPurchaseInvoiceApi.PurchaseInvoiceItem) {
  const rowKey = itemRowKeyManager.ensureRowKey(row);
  const index = tableData.value.findIndex(
    (item) => item.clientRowKey === rowKey,
  );
  if (index !== -1) {
    tableData.value.splice(index, 1);
  }
  if (!props.remotePaging) {
    const pageCount = Math.max(
      Math.ceil(tableData.value.length / localItemPage.value.pageSize),
      1,
    );
    localItemPage.value.pageNo = Math.min(
      localItemPage.value.pageNo,
      pageCount,
    );
  }
  emitItemsUpdate(false);
}

function validate() {
  if (tableData.value.length === 0) {
    throw new Error('请先导入票据明细');
  }
  for (let i = 0; i < tableData.value.length; i++) {
    const item = tableData.value[i];
    if (!item) {
      continue;
    }
    if (!item.productId) {
      throw new Error(`第 ${i + 1} 行：请选择产品`);
    }
    const max =
      item.sourceRemainingCount === null ||
      item.sourceRemainingCount === undefined
        ? undefined
        : Number(item.sourceRemainingCount);
    const countParsed = parseDecimalText(item.countText, '本次开票数量', {
      decimals: 6,
      max,
      min: 0,
    });
    if (!countParsed.ok || !countParsed.value || countParsed.value <= 0) {
      throw new Error(
        `第 ${i + 1} 行：${
          countParsed.ok ? '本次开票数量必须大于 0' : countParsed.message
        }`,
      );
    }
    item.count = countParsed.value;
    if (
      item.productPrice === null ||
      item.productPrice === undefined ||
      (item.sourceType === undefined && Number(item.productPrice) < 0)
    ) {
      throw new Error(`第 ${i + 1} 行：单价不能小于 0`);
    }
    if (item.sourceItemId === undefined || item.sourceItemId === null) {
      const priceParsed = parseDecimalText(item.productPriceText, '单价', {
        decimals: 6,
        min: 0,
      });
      if (!priceParsed.ok) {
        throw new Error(`第 ${i + 1} 行：${priceParsed.message}`);
      }
      item.productPrice = priceParsed.value;
    }
    const taxParsed = parseDecimalText(item.taxPercentText, '税率', {
      allowEmpty: true,
      decimals: 6,
      max: 100,
      min: 0,
    });
    if (!taxParsed.ok) {
      throw new Error(`第 ${i + 1} 行：${taxParsed.message}`);
    }
    item.taxPercent = taxParsed.value;
    calcAmounts(item);
  }
}

function getItems() {
  return tableData.value.map((item) => {
    const {
      countText: _countText,
      productPriceText: _productPriceText,
      taxPercentText: _taxPercentText,
      ...data
    } = item;
    return data;
  });
}

function togglePriceReferenceOverlay() {
  priceReferenceOpen.value = !priceReferenceOpen.value;
}

function handleShortcut(event: KeyboardEvent) {
  if (!isPurchaseShortcutOwnerActive(itemTableWrapRef.value)) {
    itemShortcutsRef.value?.resetPendingShortcutState();
    return;
  }
  if (priceReferenceOpen.value) {
    if (
      isPurchasePriceReferenceShortcut(event) &&
      !shouldIgnorePurchasePriceReferenceShortcut(event)
    ) {
      event.preventDefault();
      togglePriceReferenceOverlay();
    }
    return;
  }
  if (
    isPurchasePriceReferenceShortcut(event) &&
    !shouldIgnorePurchasePriceReferenceShortcut(event)
  ) {
    event.preventDefault();
    togglePriceReferenceOverlay();
    return;
  }
  itemShortcutsRef.value?.handleShortcut(event);
}

function handleShortcutKeyup(event: KeyboardEvent) {
  if (
    priceReferenceOpen.value ||
    !isPurchaseShortcutOwnerActive(itemTableWrapRef.value)
  ) {
    itemShortcutsRef.value?.resetPendingShortcutState();
    return;
  }
  itemShortcutsRef.value?.handleShortcutKeyup(event);
}

function startShortcutListening() {
  if (isShortcutListening) {
    return;
  }
  window.addEventListener('keydown', handleShortcut, true);
  window.addEventListener('keyup', handleShortcutKeyup, true);
  isShortcutListening = true;
}

function stopShortcutListening() {
  itemShortcutsRef.value?.resetPendingShortcutState();
  if (!isShortcutListening) {
    return;
  }
  window.removeEventListener('keydown', handleShortcut, true);
  window.removeEventListener('keyup', handleShortcutKeyup, true);
  isShortcutListening = false;
}

function syncShortcutListening() {
  if (isShortcutScopeActive && props.shortcutActive) {
    startShortcutListening();
    return;
  }
  stopShortcutListening();
}

function handleItemWindowResize() {
  cancelAnimationFrame(itemResizeFrame);
  itemResizeFrame = requestAnimationFrame(() => {
    const width = getItemTableWidth();
    if (width <= 0 || width === lastItemTableWidth) return;
    lastItemTableWidth = width;
    void refreshItemColumns();
  });
}

watch(
  () => props.shortcutActive,
  () => syncShortcutListening(),
);

async function reloadItemsFromProps() {
  if (props.items === lastSyncedItemsSource) return;
  lastSyncedItemsSource = props.items;
  tableData.value = prepareItemRows(props.items ?? []);
  await nextTick();
  await refreshItemGrid();
  await refreshItemColumns();
}

defineExpose({ clearItemSort, getItems, reloadItemsFromProps, validate });

onActivated(() => {
  isShortcutScopeActive = true;
  syncShortcutListening();
});

onDeactivated(() => {
  isShortcutScopeActive = false;
  stopShortcutListening();
});

onBeforeUnmount(() => {
  isShortcutScopeActive = false;
  stopShortcutListening();
  window.removeEventListener('resize', handleItemWindowResize);
  cancelAnimationFrame(itemResizeFrame);
});
</script>

<template>
  <div class="w-full">
    <div
      ref="itemTableWrapRef"
      class="purchase-invoice-item-table-wrap"
      tabindex="-1"
      @click="focusPurchaseShortcutOwner(itemTableWrapRef, $event.target)"
    >
      <Grid class="w-full">
        <template #toolbar-buttons>
          <div class="purchase-document-item-shortcut-hint">
            <span class="purchase-document-item-shortcut-hint__label">
              点击明细行后
            </span>
            <span><kbd>Space</kbd><b>采购历史</b></span>
            <span><kbd>Shift</kbd><b>采购订单历史</b></span>
            <span><kbd>S</kbd><b>销售历史</b></span>
            <span><kbd>Q</kbd><b>报价订单历史</b></span>
            <span class="purchase-document-item-shortcut-hint__label">
              当前页
            </span>
            <span><kbd>W</kbd><b>全部价格</b></span>
          </div>
        </template>
        <template #toolbar-tools>
          <span aria-hidden="true"></span>
        </template>
        <template #sourceDocNo="{ row }">
          <a
            v-if="row.sourceType === 10 && row.sourceDocNo && row.sourceDocId"
            class="cursor-pointer text-primary"
            @click.stop="emit('open-in-detail', row.sourceDocId)"
          >
            {{ row.sourceDocNo }}
          </a>
          <span v-else>{{ row.sourceDocNo || row.sourceInNo || '-' }}</span>
        </template>
        <template #productId="{ row }">
          <span v-if="!isItemFieldHidden('productId')">
            {{ row.productName || '-' }}
          </span>
        </template>
        <template #count="{ row }">
          <Input
            v-if="!disabled"
            v-model:value="row.countText"
            autocomplete="off"
            class="w-full"
            inputmode="decimal"
            @blur="handleCountBlur(row)"
            @press-enter="focusNextInputOnEnter"
          />
          <span v-else>{{ formatPurchaseDecimal(row.count, '-') }}</span>
        </template>
        <template #productPrice="{ row }">
          <span v-if="disabled && isPriceItemHidden('productPrice')">****</span>
          <span
            v-else-if="
              row.sourceItemId !== undefined && row.sourceItemId !== null
            "
            >{{ formatPurchaseAmount(row.productPrice, '-') }}</span
          >
          <Input
            v-else-if="!disabled"
            v-model:value="row.productPriceText"
            autocomplete="off"
            class="w-full"
            inputmode="decimal"
            @blur="handleProductPriceBlur(row)"
            @press-enter="focusNextInputOnEnter"
          />
          <span v-else>{{ formatPurchaseAmount(row.productPrice, '-') }}</span>
        </template>
        <template #taxPercent="{ row }">
          <Input
            v-if="!disabled"
            v-model:value="row.taxPercentText"
            autocomplete="off"
            class="w-full"
            inputmode="decimal"
            @blur="handleTaxPercentBlur(row)"
            @press-enter="focusNextInputOnEnter"
          />
          <span v-else>{{ formatPurchaseDecimal(row.taxPercent, '-') }}</span>
        </template>
        <template #remark="{ row }">
          <Input
            v-if="!disabled"
            v-model:value="row.remark"
            class="w-full"
            @blur="handleRowChange(row)"
            @press-enter="focusNextInputOnEnter"
          />
          <span v-else>{{ row.remark || '-' }}</span>
        </template>
        <template #actions="{ row }">
          <TableAction
            :actions="[
              {
                label: '删除',
                type: 'link',
                icon: ACTION_ICON.DELETE,
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
      <PurchaseItemPriceReferenceOverlay
        :hidden-fields="props.hiddenFields"
        :open="priceReferenceOpen"
        :rows="getDisplayTableData()"
        :table-header-height="ITEM_TABLE_HEADER_HEIGHT"
        :table-row-height="ITEM_TABLE_ROW_HEIGHT"
        :table-wrapper="itemTableWrapRef"
        :visible-rows="ITEM_TABLE_VISIBLE_ROWS"
      />
    </div>
    <PurchaseItemDetailShortcuts
      ref="itemShortcutsRef"
      :active-row="activeItemRow"
      :history-enabled="true"
      :product-edit-enabled="false"
      :sale-history-enabled="true"
    />
    <div v-if="showItemPager" class="purchase-invoice-item-pager">
      <Pagination
        :current="effectiveItemPagination.pageNo"
        :disabled="props.itemPageLoading"
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
:deep(.vxe-table),
:deep(.ant-input),
:deep(.ant-input-number) {
  font-size: 11px;
}

:deep(.vxe-header--column.is--sortable .vxe-cell--title) {
  color: #1677ff;
}

:deep(.vxe-header--column .vxe-cell--sort) {
  display: none;
}

:deep(.vxe-body--column .table-actions .ant-btn-link),
:deep(.vxe-body--column .table-actions .ant-btn-link > span),
:deep(.vxe-body--column .table-actions .vben-link) {
  font-size: 12px;
}

.purchase-invoice-item-table-wrap {
  position: relative;
}

.purchase-document-item-shortcut-hint {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  min-width: 0;
  font-size: 12px;
  color: #334155;
}

.purchase-document-item-shortcut-hint__label {
  color: #64748b;
}

.purchase-document-item-shortcut-hint
  span:not(.purchase-document-item-shortcut-hint__label) {
  display: inline-flex;
  gap: 5px;
  align-items: center;
  min-height: 26px;
  padding: 2px 8px;
  background: #f8fafc;
  border: 1px solid #d8e0ea;
  border-radius: 4px;
}

.purchase-document-item-shortcut-hint b {
  font-weight: 600;
}

.purchase-document-item-shortcut-hint kbd {
  min-width: 24px;
  padding: 1px 6px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  font-weight: 700;
  line-height: 16px;
  color: #13213a;
  text-align: center;
  background: #edf1f7;
  border: 1px solid #c6d0de;
  border-radius: 3px;
}

.purchase-invoice-item-pager {
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
}

.purchase-invoice-item-pager :deep(.ant-pagination),
.purchase-invoice-item-pager :deep(.ant-pagination-item),
.purchase-invoice-item-pager :deep(.ant-pagination-total-text),
.purchase-invoice-item-pager :deep(.ant-pagination-options),
.purchase-invoice-item-pager :deep(.ant-select),
.purchase-invoice-item-pager :deep(.ant-input) {
  font-size: 11px;
}

.purchase-invoice-item-pager :deep(.ant-pagination-item),
.purchase-invoice-item-pager :deep(.ant-pagination-prev),
.purchase-invoice-item-pager :deep(.ant-pagination-next),
.purchase-invoice-item-pager :deep(.ant-pagination-jump-prev),
.purchase-invoice-item-pager :deep(.ant-pagination-jump-next) {
  min-width: 24px;
  height: 24px;
  line-height: 22px;
}

.purchase-invoice-item-pager :deep(.ant-pagination-item a),
.purchase-invoice-item-pager :deep(.ant-pagination-prev button),
.purchase-invoice-item-pager :deep(.ant-pagination-next button) {
  height: 22px;
  font-size: 11px;
  line-height: 22px;
}

.purchase-invoice-item-pager :deep(.ant-pagination-options-size-changer),
.purchase-invoice-item-pager :deep(.ant-select-single),
.purchase-invoice-item-pager :deep(.ant-select-selector) {
  height: 24px;
  line-height: 22px;
}

.purchase-invoice-item-pager
  :deep(.ant-pagination-options-size-changer .ant-select-selector) {
  box-sizing: border-box;
  align-items: center;
  min-height: 24px;
  padding: 0 24px 0 8px;
}

.purchase-invoice-item-pager
  :deep(.ant-select-single .ant-select-selector .ant-select-selection-item) {
  height: 22px;
  font-size: 11px;
  line-height: 22px;
}

.purchase-invoice-item-pager :deep(.ant-select-arrow) {
  margin-top: -5px;
  font-size: 10px;
}

.purchase-invoice-item-pager :deep(.ant-pagination-options-quick-jumper input) {
  height: 24px;
  padding: 0 7px;
  font-size: 11px;
  line-height: 22px;
}
</style>
