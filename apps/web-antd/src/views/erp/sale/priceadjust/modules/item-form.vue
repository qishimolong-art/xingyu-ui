<script lang="ts" setup>
import { CANDIDATE_FOCUS_KEY } from '#/views/erp/utils/candidate-focus';

import type { ErpSalePriceAdjustApi } from '#/api/erp/sale/priceadjust';
import type { ErpStockApi } from '#/api/erp/stock/stock';
import type { PriceAdjustItemSortOrder } from './sale-price-adjust-item-sort';

import {
  computed,
  nextTick,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  ref,
  watch,
  provide,
} from 'vue';

import { useAccess } from '@vben/access';
import { useVbenModal } from '@vben/common-ui';
import { Input, message, Pagination, Tag } from 'ant-design-vue';

import { TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import { getProduct } from '#/api/erp/product/product';
import ItemPriceReferenceOverlay from '#/views/erp/components/ItemPriceReferenceOverlay.vue';
import ProductForm from '#/views/erp/product/product/modules/form.vue';
import PurchaseItemDetailShortcuts from '#/views/erp/purchase/components/PurchaseItemDetailShortcuts.vue';
import SaleStockProductSelectModal from '#/views/erp/sale/components/SaleStockProductSelectModal.vue';
import {
  getSalePriceReferenceOverlayHiddenFields,
  isSalePriceItemHidden,
} from '#/views/erp/sale/utils/field-permission';
import {
  formatSaleAmount,
  parseSaleDecimal,
  saleDecimalAdd,
  saleDecimalMultiply,
  saleDecimalSubtract,
} from '#/views/erp/sale/utils/decimal';
import {
  applySaleDocumentItemColumnCustomization,
  fitSaleDocumentItemColumnsToWidth,
} from '#/views/erp/sale/utils/document-item-table';
import { createSaleItemClientRowKeyManager } from '#/views/erp/sale/utils/item-row-key';
import {
  focusSaleShortcutOwner,
  isSaleShortcutOwnerActive,
} from '#/views/erp/sale/utils/shortcut-scope';
import {
  focusNextInputOnEnter,
  isCreateShortcutKey,
  isEditableEnterTarget,
  queueAfterEditableControlRender,
} from '#/views/erp/utils/keyboard';
import {
  isPriceReferenceShortcut,
  shouldIgnorePriceReferenceShortcut,
} from '#/views/erp/utils/price-reference';

import { useFormItemColumns } from '../data';
import { sortPriceAdjustItems } from './sale-price-adjust-item-sort';

provide(CANDIDATE_FOCUS_KEY, ref(true));

const itemRowKeyManager = createSaleItemClientRowKeyManager(
  'sale-price-adjust-item',
);

interface Props {
  items?: ErpSalePriceAdjustApi.PriceAdjustItem[];
  disabled?: boolean;
  hiddenFields?: string[];
  itemPageLoading?: boolean;
  itemPagination?: PriceAdjustItemPagination;
  mainDeptId?: number;
  customerPriceLevel?: number;
  remotePaging?: boolean;
  shortcutActive?: boolean;
}

type PriceAdjustItemPagination = {
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
const SALE_PRICE_ADJUST_NEW_PRICE_INPUT_SELECTOR =
  '.sale-price-adjust-item-new-price-input input';

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
  mainDeptId: undefined,
  customerPriceLevel: undefined,
  remotePaging: false,
  shortcutActive: true,
});

const emit = defineEmits([
  'page-change',
  'request-add-items',
  'request-submit',
  'update:items',
  'update:total-adjust-price',
]);

const tableData = ref<ErpSalePriceAdjustApi.PriceAdjustItem[]>([]);
const activeItemSort = ref<{
  field: string;
  order: PriceAdjustItemSortOrder;
} | null>(null);
const localItemPage = ref({ pageNo: 1, pageSize: DEFAULT_ITEM_PAGE_SIZE });
const priceReferenceOpen = ref(false);
const itemTableWrapRef = ref<HTMLElement | null>(null);
const activeItemRowKey = ref<string>();
const productSelectRef =
  ref<InstanceType<typeof SaleStockProductSelectModal>>();
const purchaseShortcutsRef =
  ref<InstanceType<typeof PurchaseItemDetailShortcuts>>();
const { hasAccessByCodes } = useAccess();
const canViewPurchaseOrderHistory = computed(() =>
  hasAccessByCodes(['erp:purchase-order:query']),
);
const canViewPurchaseInHistory = computed(() =>
  hasAccessByCodes(['erp:purchase-in:query']),
);
const activeShortcutItemRow = computed(() => getActiveItemRow(false));
const [ProductFormModal, productFormModalApi] = useVbenModal({
  connectedComponent: ProductForm,
  destroyOnClose: true,
});
let isInternalUpdate = false;
let isShortcutListening = false;
let isShortcutScopeActive = false;
let pendingQuoteOrderHistoryShift = false;
let itemResizeFrame = 0;
let lastItemTableWidth = 0;

function getItemTableWidth() {
  const table = itemTableWrapRef.value?.querySelector('.vxe-grid');
  return Math.floor(
    table?.getBoundingClientRect().width ??
      itemTableWrapRef.value?.getBoundingClientRect().width ??
      0,
  );
}
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
const priceReferenceHiddenFields = computed(() =>
  getSalePriceReferenceOverlayHiddenFields(props.hiddenFields),
);

function getDisplayedItems() {
  const rows =
    !activeItemSort.value || props.remotePaging
      ? [...tableData.value]
      : sortPriceAdjustItems(
          tableData.value,
          activeItemSort.value.field,
          activeItemSort.value.order,
        );
  if (props.remotePaging) {
    return rows;
  }
  const startIndex =
    (localItemPage.value.pageNo - 1) * localItemPage.value.pageSize;
  return rows.slice(startIndex, startIndex + localItemPage.value.pageSize);
}

function getItemRowKey(row?: ErpSalePriceAdjustApi.PriceAdjustItem) {
  if (!row) return undefined;
  return itemRowKeyManager.ensureRowKey(row);
}

function setActiveItemRow(row?: ErpSalePriceAdjustApi.PriceAdjustItem) {
  const key = getItemRowKey(row);
  if (key) activeItemRowKey.value = key;
}

function getActiveItemRow(showWarning = true) {
  const row = tableData.value.find(
    (item) => getItemRowKey(item) === activeItemRowKey.value,
  );
  if (!row?.productId) {
    if (showWarning) message.warning('请先点击一条有商品的调价明细');
    return undefined;
  }
  return row;
}

function getItemRowClassName({
  row,
}: {
  row: ErpSalePriceAdjustApi.PriceAdjustItem;
}) {
  return getItemRowKey(row) === activeItemRowKey.value
    ? 'sale-price-adjust-item-row--active'
    : '';
}

async function refreshItemGrid() {
  const displayData = getDisplayedItems();
  gridApi.setGridOptions({ data: displayData });
  await gridApi.grid.loadData(displayData);
  await gridApi.grid.reloadColumn(
    buildCustomizedItemColumns(displayData) || [],
  );
  if (activeItemSort.value) await gridApi.grid.setSort(activeItemSort.value);
  await nextTick();
}

function buildItemColumns(
  rows: ErpSalePriceAdjustApi.PriceAdjustItem[] = getDisplayedItems(),
) {
  return (
    useFormItemColumns(props.disabled, props.hiddenFields, {
      editable: !props.disabled,
      rows,
      trailingFlexibleColumnMinWidth: 150,
    }) || []
  );
}

function buildCustomizedItemColumns(
  rows: ErpSalePriceAdjustApi.PriceAdjustItem[] = getDisplayedItems(),
) {
  return fitSaleDocumentItemColumnsToWidth(
    applySaleDocumentItemColumnCustomization(
      buildItemColumns(rows),
      gridApi.grid.getFullColumns?.() ?? [],
      150,
    ),
    getItemTableWidth(),
  );
}

async function handleItemColumnCustom({ type }: { type?: string }) {
  if (type !== 'confirm' && type !== 'reset') return;
  await nextTick();
  await gridApi.grid.reloadColumn(buildCustomizedItemColumns() || []);
  if (activeItemSort.value) await gridApi.grid.setSort(activeItemSort.value);
}

async function handleItemSortChange({ field, order }: any) {
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

const summaries = computed(() => ({
  adjustPrice: tableData.value.reduce(
    (sum, item) => saleDecimalAdd(sum, item.adjustPrice || 0),
    0,
  ),
}));

function isPriceItemHidden(field: string) {
  return props.disabled && isSalePriceItemHidden(props.hiddenFields, field);
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
    data: tableData.value,
    height: ITEM_TABLE_HEIGHT,
    id: 'erp-sale-price-adjust-item-list-v1',
    autoResize: true,
    border: true,
    fit: false,
    showHeaderOverflow: 'tooltip',
    showOverflow: 'tooltip',
    scrollX: { enabled: true, gt: 0 },
    rowConfig: { keyField: 'clientRowKey', isHover: true },
    rowClassName: getItemRowClassName,
    pagerConfig: { enabled: false },
    toolbarConfig: {
      custom: true,
      enabled: true,
      refresh: {
        queryMethod: () => refreshItemGrid(),
      },
      slots: { buttons: 'toolbar-buttons', tools: 'toolbar-tools' },
      zoom: true,
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
    cellClick: ({ row }: { row: ErpSalePriceAdjustApi.PriceAdjustItem }) => {
      setActiveItemRow(row);
    },
    cellDblclick: ({ row }: { row: ErpSalePriceAdjustApi.PriceAdjustItem }) => {
      setActiveItemRow(row);
    },
    custom: handleItemColumnCustom,
    sortChange: handleItemSortChange,
  },
});

watch(
  () => props.items,
  async (items) => {
    if (!items) return;
    if (isInternalUpdate) {
      isInternalUpdate = false;
      return;
    }
    items.forEach(initRow);
    tableData.value = [...items];
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
    if (gridApi.grid) {
      await refreshItemGrid();
    }
  },
  { immediate: true },
);

watch(
  () => props.itemPageLoading,
  (loading) => {
    gridApi.setGridOptions({ loading });
  },
);

watch([() => props.disabled, () => props.hiddenFields], async () => {
  if (gridApi.grid) {
    await gridApi.grid.reloadColumn(buildCustomizedItemColumns() || []);
    if (activeItemSort.value) {
      await gridApi.grid.setSort(activeItemSort.value);
      await refreshItemGrid();
    }
  }
});

function buildShortcutStockRow(
  row: ErpSalePriceAdjustApi.PriceAdjustItem,
): ErpStockApi.Stock {
  return {
    id: row.id,
    productId: row.productId!,
    warehouseId: row.warehouseId ?? 0,
    deptId: row.warehouseDeptId ?? row.deptId,
    deptName: row.warehouseDeptName,
    count: Number(row.stockCount ?? 0),
    availableCount: Number(row.stockCount ?? 0),
    productCode: row.partCode,
    productName: row.partName,
    unitName: row.unit,
    warehouseName: row.warehouseName,
    batchNo: row.batchNo,
    brand: row.brand,
    lastSalePrice: row.lastSalePrice,
    originPlace: row.originPlace,
    salePrice: row.salePrice ?? row.oldPrice,
    vehicleModel: row.vehicleModel,
  };
}

async function openSaleShortcutHistory(mode: 'history' | 'order') {
  const row = getActiveItemRow();
  if (!row) return;
  await productSelectRef.value?.openShortcutHistory?.(
    mode,
    buildShortcutStockRow(row),
  );
}

function openProductEdit() {
  const row = getActiveItemRow();
  if (!row) return;
  if (!hasAccessByCodes(['erp:product:update'])) {
    message.warning('没有配件修改权限');
    return;
  }
  if (
    props.mainDeptId &&
    row.warehouseDeptId &&
    props.mainDeptId !== row.warehouseDeptId
  ) {
    message.warning('该商品不属于当前单据部门，不能修改');
    return;
  }
  productFormModalApi.setData({ type: 'edit', id: row.productId }).open();
}

async function handleProductFormSuccess() {
  const row = getActiveItemRow(false);
  if (!row?.productId) return;
  const product = await getProduct(row.productId);
  row.partCode = product.code ?? row.partCode;
  row.partName = product.name ?? row.partName;
  row.unit = product.unitName ?? row.unit;
  row.weight = product.weight ?? row.weight;
  row.packageQty = product.packageQty ?? row.packageQty;
  row.brand = product.brand ?? row.brand;
  row.vehicleModel = product.vehicleModel ?? row.vehicleModel;
  row.originPlace = product.originPlace ?? row.originPlace;
  emitItemsUpdate(true);
  await refreshItemGrid();
}

function isShortcutDialogOpen() {
  return (
    productSelectRef.value?.isShortcutDialogOpen?.() === true ||
    purchaseShortcutsRef.value?.isShortcutDialogOpen?.() === true
  );
}

function openPurchaseShortcutHistory(mode: 'in' | 'order') {
  void purchaseShortcutsRef.value?.openPurchaseHistory(mode);
}

function isQuoteOrderHistoryShiftKey(event: KeyboardEvent) {
  return (
    event.key === 'Shift' ||
    event.code === 'ShiftLeft' ||
    event.code === 'ShiftRight'
  );
}

function handleShortcut(event: KeyboardEvent) {
  if (!isSaleShortcutOwnerActive(itemTableWrapRef.value)) {
    pendingQuoteOrderHistoryShift = false;
    return;
  }
  if (pendingQuoteOrderHistoryShift && !isQuoteOrderHistoryShiftKey(event)) {
    pendingQuoteOrderHistoryShift = false;
  }
  if (
    event.defaultPrevented ||
    event.repeat ||
    event.isComposing ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey
  ) {
    return;
  }
  if (isEditableEnterTarget(event.target)) return;
  if (!props.disabled && isCreateShortcutKey(event)) {
    if (isShortcutDialogOpen()) return;
    event.preventDefault();
    emit('request-add-items');
    return;
  }
  if (isPriceReferenceShortcut(event)) {
    if (shouldIgnorePriceReferenceShortcut(event) || isShortcutDialogOpen()) {
      return;
    }
    event.preventDefault();
    priceReferenceOpen.value = !priceReferenceOpen.value;
    return;
  }
  if (isShortcutDialogOpen()) return;
  if (isQuoteOrderHistoryShiftKey(event)) {
    pendingQuoteOrderHistoryShift = true;
    return;
  }
  if (event.key === ' ' || event.code === 'Space') {
    event.preventDefault();
    void openSaleShortcutHistory('history');
    return;
  }
  const key = event.key.toLowerCase();
  if (key === 'p' && canViewPurchaseOrderHistory.value) {
    event.preventDefault();
    openPurchaseShortcutHistory('order');
    return;
  }
  if (key === 'i' && canViewPurchaseInHistory.value) {
    event.preventDefault();
    openPurchaseShortcutHistory('in');
    return;
  }
  if (props.disabled) return;
  if (key === 'f') {
    event.preventDefault();
    openProductEdit();
  }
}

function handleShortcutKeyup(event: KeyboardEvent) {
  if (
    !isSaleShortcutOwnerActive(itemTableWrapRef.value) ||
    !pendingQuoteOrderHistoryShift
  ) {
    pendingQuoteOrderHistoryShift = false;
    return;
  }
  if (!isQuoteOrderHistoryShiftKey(event)) {
    pendingQuoteOrderHistoryShift = false;
    return;
  }
  pendingQuoteOrderHistoryShift = false;
  if (
    event.defaultPrevented ||
    event.isComposing ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    isEditableEnterTarget(event.target) ||
    isShortcutDialogOpen()
  ) {
    return;
  }
  event.preventDefault();
  void openSaleShortcutHistory('order');
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
  if (!isShortcutListening) {
    return;
  }
  pendingQuoteOrderHistoryShift = false;
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

watch(
  () => props.shortcutActive,
  () => {
    syncShortcutListening();
  },
);

/** Grid 挂载后兜底同步列和明细，避免 immediate watch 早于 Grid 初始化。 */
onMounted(async () => {
  isShortcutScopeActive = true;
  syncShortcutListening();
  await nextTick();
  if (!gridApi.grid) return;
  await gridApi.grid.reloadColumn(buildCustomizedItemColumns() || []);
  if (props.items.length > 0) {
    props.items.forEach(initRow);
    tableData.value = [...props.items];
    await refreshItemGrid();
  }
  lastItemTableWidth = getItemTableWidth();
  window.addEventListener('resize', handleItemWindowResize);
});

onActivated(() => {
  isShortcutScopeActive = true;
  syncShortcutListening();
});

onDeactivated(() => {
  isShortcutScopeActive = false;
  syncShortcutListening();
});

onBeforeUnmount(() => {
  isShortcutScopeActive = false;
  syncShortcutListening();
  cancelAnimationFrame(itemResizeFrame);
  window.removeEventListener('resize', handleItemWindowResize);
});

function handleItemWindowResize() {
  cancelAnimationFrame(itemResizeFrame);
  itemResizeFrame = requestAnimationFrame(() => {
    const width = getItemTableWidth();
    if (width <= 0 || width === lastItemTableWidth) return;
    lastItemTableWidth = width;
    void gridApi.grid.reloadColumn(buildCustomizedItemColumns() || []);
  });
}

watch(
  () => summaries.value.adjustPrice,
  (val) => {
    // 远程分页时这里只是当前页，不能覆盖整单调价金额。
    if (props.remotePaging) {
      return;
    }
    emit('update:total-adjust-price', val || 0);
  },
  { immediate: true },
);

function emitItemsUpdate(skipReload = false) {
  isInternalUpdate = skipReload;
  emit('update:items', [...tableData.value]);
}

function initRow(row: ErpSalePriceAdjustApi.PriceAdjustItem) {
  itemRowKeyManager.ensureRowKey(row);
  if (!row.seq && row.id) {
    row.seq = row.id;
  }
  const oldPrice = row.oldPrice || 0;
  const newPrice = row.newPrice || 0;
  const outCount = row.outCount || 0;
  row.adjustPrice =
    saleDecimalMultiply(saleDecimalSubtract(newPrice, oldPrice), outCount) ||
    0;
}

function handleNewPriceChange(row: ErpSalePriceAdjustApi.PriceAdjustItem) {
  const index = tableData.value.findIndex(
    (item) => item.clientRowKey === row.clientRowKey,
  );
  initRow(row);
  if (index === -1) {
    tableData.value.push(row);
    emitItemsUpdate(false);
  } else {
    tableData.value[index] = row;
    emitItemsUpdate(true);
  }
  if (activeItemSort.value) {
    void nextTick(refreshItemGrid);
  }
}

function handleFieldChange(row: ErpSalePriceAdjustApi.PriceAdjustItem) {
  const index = tableData.value.findIndex(
    (item) => item.clientRowKey === row.clientRowKey,
  );
  if (index !== -1) {
    tableData.value[index] = row;
    emitItemsUpdate(true);
    if (activeItemSort.value) {
      void nextTick(refreshItemGrid);
    }
  }
}

function handleDelete(row: ErpSalePriceAdjustApi.PriceAdjustItem) {
  const index = tableData.value.findIndex(
    (item) => item.clientRowKey === row.clientRowKey,
  );
  if (index !== -1) tableData.value.splice(index, 1);
  void refreshItemGrid();
  emitItemsUpdate(false);
}

function isCrossDeptWarehouse(row: ErpSalePriceAdjustApi.PriceAdjustItem) {
  return (
    !!props.mainDeptId &&
    !!row.warehouseDeptId &&
    row.warehouseDeptId !== props.mainDeptId
  );
}

function validate(
  items = tableData.value,
  options: { requireItems?: boolean } = {},
) {
  if ((options.requireItems ?? true) && items.length === 0) {
    throw new Error('调价明细不能为空，请先选择客户并新增明细');
  }
  items.forEach((item, index) => {
    const parsed = parseSaleDecimal(item.newPrice, '调整价', { min: 0 });
    if (!parsed.ok) {
      throw new Error(`第 ${index + 1} 行：${parsed.message}`);
    }
    item.newPrice = parsed.value ?? 0;
  });
}

function buildDraftItems() {
  return tableData.value.map((item) => {
    const row = { ...item };
    row.newPrice = Number(row.newPrice ?? 0);
    initRow(row);
    return row;
  });
}

async function reloadItemsFromProps() {
  const items = props.items ?? [];
  items.forEach(initRow);
  tableData.value = [...items];
  await nextTick();
  await refreshItemGrid();
}

function focusNewlyAddedPriceInput() {
  if (props.disabled) {
    return false;
  }
  const inputs = itemTableWrapRef.value?.querySelectorAll<HTMLInputElement>(
    SALE_PRICE_ADJUST_NEW_PRICE_INPUT_SELECTOR,
  );
  const input = inputs?.item(Math.max((inputs?.length ?? 1) - 1, 0));
  input?.focus();
  input?.select();
  return Boolean(input);
}

function queueFocusNewlyAddedPriceInput() {
  if (props.disabled) {
    return;
  }
  void nextTick(() =>
    queueAfterEditableControlRender(focusNewlyAddedPriceInput),
  );
}

function updateNewPriceText(
  row: ErpSalePriceAdjustApi.PriceAdjustItem,
  value: string,
) {
  if (!/^\d*(?:\.\d{0,6})?$/.test(value)) return;
  (row as any).newPrice = value;
  if (value !== '' && value !== '.') handleNewPriceChange(row);
}

function normalizeNewPrice(row: ErpSalePriceAdjustApi.PriceAdjustItem) {
  const value = String(row.newPrice ?? '').trim();
  const parsed = parseSaleDecimal(value === '.' ? '' : value, '调整价', {
    allowEmpty: true,
    min: 0,
  });
  if (!parsed.ok) {
    message.warning(parsed.message);
  }
  row.newPrice = (parsed.ok ? parsed.value : 0) ?? 0;
  handleNewPriceChange(row);
}

function handleItemInputPressEnter(event: KeyboardEvent) {
  const enterFocusResult = focusNextInputOnEnter(event);
  if (enterFocusResult === 'last-input') {
    emit('request-submit', event);
  }
}

defineExpose({
  getDraftItems: buildDraftItems,
  queueFocusNewlyAddedPriceInput,
  reloadItemsFromProps,
  validate,
});
</script>

<template>
  <div
    ref="itemTableWrapRef"
    class="sale-price-adjust-item-table-wrap relative"
    tabindex="-1"
    @click="focusSaleShortcutOwner(itemTableWrapRef, $event.target)"
  >
    <Grid class="sale-price-adjust-item-grid w-full">
      <template #toolbar-buttons>
        <div class="sale-price-adjust-item-shortcut-hint">
          <span class="sale-price-adjust-item-shortcut-hint__label"
            >点击明细行后</span
          >
          <span><kbd>Space</kbd><b>销售历史</b></span>
          <span><kbd>Shift</kbd><b>报价订单历史</b></span>
          <span v-if="canViewPurchaseOrderHistory"
            ><kbd>P</kbd><b>采购订单历史</b></span
          >
          <span v-if="canViewPurchaseInHistory"
            ><kbd>I</kbd><b>采购入库记录</b></span
          >
          <template v-if="!disabled">
            <span><kbd>F</kbd><b>修改商品</b></span>
            <span><kbd>Insert</kbd><b>新增明细</b></span>
          </template>
          <span class="sale-price-adjust-item-shortcut-hint__divider"></span>
          <span
            ><span class="sale-price-adjust-item-shortcut-hint__label"
              >当前页</span
            ><kbd>W</kbd><b>全部价格</b></span
          >
        </div>
      </template>
      <template #toolbar-tools>
        <div class="sale-price-adjust-item-toolbar flex items-center gap-2">
          <slot name="toolbar"></slot>
        </div>
      </template>
      <template #newPrice="{ row }">
        <Input
          v-if="!disabled"
          :value="String(row.newPrice ?? '')"
          class="sale-price-adjust-item-new-price-input w-full"
          inputmode="decimal"
          @press-enter="handleItemInputPressEnter"
          @update:value="(value) => updateNewPriceText(row, value)"
          @blur="normalizeNewPrice(row)"
        />
        <span v-else-if="isPriceItemHidden('newPrice')">****</span>
        <span v-else>{{ formatSaleAmount(row.newPrice, '-') }}</span>
      </template>
      <template #adjustAmount="{ row }">
        <span v-if="isPriceItemHidden('adjustAmount')">****</span>
        <span v-else>{{
          formatSaleAmount(
            saleDecimalMultiply(row.newPrice || 0, row.outCount || 0),
            '-',
          )
        }}</span>
      </template>
      <template #partName="{ row }">
        <div
          class="flex min-w-0 flex-nowrap items-center gap-1 overflow-hidden"
        >
          <span
            class="sale-price-adjust-item-cell-text"
            :title="row.partName || '-'"
          >
            {{ row.partName || '-' }}
          </span>
          <Tag
            v-if="isCrossDeptWarehouse(row)"
            color="orange"
            class="m-0 shrink-0"
          >
            跨部门
          </Tag>
        </div>
      </template>
      <template #warehouseName="{ row }">
        <span
          class="sale-price-adjust-item-cell-text"
          :title="String(row.warehouseName || '-')"
        >
          {{ row.warehouseName || '-' }}
        </span>
      </template>
      <template #adjustReason="{ row }">
        <Input
          v-if="!disabled"
          v-model:value="row.adjustReason"
          placeholder="调价原因"
          @press-enter="handleItemInputPressEnter"
          @change="handleFieldChange(row)"
        />
        <span
          v-else
          class="sale-price-adjust-item-cell-text"
          :title="row.adjustReason || '-'"
        >
          {{ row.adjustReason || '-' }}
        </span>
      </template>
      <template #itemRemark="{ row }">
        <Input
          v-if="!disabled"
          v-model:value="row.itemRemark"
          placeholder="备注"
          @press-enter="handleItemInputPressEnter"
          @change="handleFieldChange(row)"
        />
        <span
          v-else
          class="sale-price-adjust-item-cell-text"
          :title="row.itemRemark || '-'"
        >
          {{ row.itemRemark || '-' }}
        </span>
      </template>
      <template #actions="{ row }">
        <TableAction
          :actions="[
            {
              label: '删除',
              type: 'link',
              danger: true,
              popConfirm: {
                title: '确认删除该调价明细吗？',
                confirm: handleDelete.bind(null, row),
              },
            },
          ]"
        />
      </template>
    </Grid>
    <ItemPriceReferenceOverlay
      :hidden-fields="priceReferenceHiddenFields"
      :open="priceReferenceOpen"
      :rows="getDisplayedItems()"
      :table-header-height="ITEM_TABLE_HEADER_HEIGHT"
      :table-row-height="ITEM_TABLE_ROW_HEIGHT"
      :table-wrapper="itemTableWrapRef"
      :visible-rows="ITEM_TABLE_VISIBLE_ROWS"
    />
  </div>
  <div v-if="showItemPager" class="sale-price-adjust-item-pager">
    <Pagination
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
  <SaleStockProductSelectModal
    candidate-focus-highlight
    ref="productSelectRef"
    enable-sale-stock-shortcuts
    :customer-price-level="customerPriceLevel"
    :hidden-fields="hiddenFields"
    :sale-dept-id="mainDeptId"
    show-batch-no
  />
  <ProductFormModal @success="handleProductFormSuccess" />
  <PurchaseItemDetailShortcuts
    ref="purchaseShortcutsRef"
    :active-row="activeShortcutItemRow"
    :dept-id="mainDeptId"
    :history-enabled="false"
    :product-edit-enabled="false"
  />
</template>

<style scoped>
.sale-price-adjust-item-cell-text {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>

<style scoped>
:deep(.vxe-table--render-default) {
  font-size: 11px;
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

:deep(.ant-input),
:deep(.ant-input-number),
:deep(.ant-input-number-input),
:deep(.table-actions .ant-btn-link) {
  font-size: 11px;
}

.sale-price-adjust-item-toolbar-left {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 12px;
  min-width: 0;
}

.sale-price-adjust-item-toolbar :deep(.ant-btn) {
  height: 28px;
  padding: 2px 10px;
  font-size: 12px;
  line-height: 20px;
}

.sale-price-adjust-item-toolbar :deep(.ant-btn span) {
  font-size: 12px;
}

.sale-price-adjust-item-shortcut-hint {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  color: #475569;
  font-size: 12px;
}

.sale-price-adjust-item-shortcut-hint__label {
  color: #64748b;
}

.sale-price-adjust-item-shortcut-hint b {
  font-weight: 600;
}

.sale-price-adjust-item-shortcut-hint kbd {
  min-width: 24px;
  padding: 1px 7px;
  color: #334155;
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  font-family: inherit;
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
  text-align: center;
  box-shadow: inset 0 -1px 0 rgb(15 23 42 / 10%);
}

.sale-price-adjust-item-shortcut-hint__divider {
  width: 1px;
  height: 18px;
  margin: 0 4px;
  background: #cbd5e1;
}

.sale-price-adjust-item-grid :deep(.sale-price-adjust-item-row--active td) {
  background-color: rgba(22, 119, 255, 0.1) !important;
}

.sale-price-adjust-item-grid
  :deep(.sale-price-adjust-item-row--active td:first-child) {
  box-shadow: inset 3px 0 0 #1677ff;
}

.sale-price-adjust-item-grid
  :deep(.sale-price-adjust-item-row--active:hover td) {
  background-color: rgba(22, 119, 255, 0.16) !important;
}

.sale-price-adjust-item-pager {
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
}

.sale-price-adjust-item-pager :deep(.ant-pagination),
.sale-price-adjust-item-pager :deep(.ant-pagination-item),
.sale-price-adjust-item-pager :deep(.ant-pagination-total-text),
.sale-price-adjust-item-pager :deep(.ant-pagination-options),
.sale-price-adjust-item-pager :deep(.ant-select),
.sale-price-adjust-item-pager :deep(.ant-input) {
  font-size: 11px;
}

.sale-price-adjust-item-pager :deep(.ant-pagination-item),
.sale-price-adjust-item-pager :deep(.ant-pagination-prev),
.sale-price-adjust-item-pager :deep(.ant-pagination-next),
.sale-price-adjust-item-pager :deep(.ant-pagination-jump-prev),
.sale-price-adjust-item-pager :deep(.ant-pagination-jump-next) {
  min-width: 24px;
  height: 24px;
  line-height: 22px;
}

.sale-price-adjust-item-pager :deep(.ant-pagination-item a),
.sale-price-adjust-item-pager :deep(.ant-pagination-prev button),
.sale-price-adjust-item-pager :deep(.ant-pagination-next button) {
  height: 22px;
  font-size: 11px;
  line-height: 22px;
}

.sale-price-adjust-item-pager :deep(.ant-pagination-options-size-changer),
.sale-price-adjust-item-pager :deep(.ant-select-single),
.sale-price-adjust-item-pager :deep(.ant-select-selector) {
  height: 24px;
  line-height: 22px;
}

.sale-price-adjust-item-pager
  :deep(.ant-pagination-options-size-changer .ant-select-selector) {
  box-sizing: border-box;
  align-items: center;
  min-height: 24px;
  padding: 0 24px 0 8px;
}

.sale-price-adjust-item-pager
  :deep(.ant-select-single .ant-select-selector .ant-select-selection-item) {
  height: 22px;
  font-size: 11px;
  line-height: 22px;
}

.sale-price-adjust-item-pager :deep(.ant-select-arrow) {
  margin-top: -5px;
  font-size: 10px;
}

.sale-price-adjust-item-pager
  :deep(.ant-pagination-options-quick-jumper input) {
  height: 24px;
  padding: 0 7px;
  font-size: 11px;
  line-height: 22px;
}
</style>
