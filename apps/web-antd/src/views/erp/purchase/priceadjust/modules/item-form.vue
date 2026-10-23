<script lang="ts" setup>
import '#/views/erp/purchase/utils/candidate-focus';
import type { ErpPurchasePriceAdjustApi } from '#/api/erp/purchase/priceadjust';
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
import {
  buildPurchaseItemDuplicateKey,
  focusNextInputOnEnter,
} from '#/views/erp/purchase/utils/item-form';
import { createPurchaseItemClientRowKeyManager } from '#/views/erp/purchase/utils/item-row-key';
import {
  formatPurchaseAmount,
  formatPurchaseDecimal,
  parsePurchaseDecimal,
  purchaseDecimalAdd,
  purchaseDecimalDivide,
  purchaseDecimalMultiply,
  purchaseDecimalSubtract,
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

import {
  isPurchasePriceAdjustPriceItemHidden,
  useFormItemColumns,
} from '../data';

interface Props {
  items?: ErpPurchasePriceAdjustApi.PurchasePriceAdjustItem[];
  disabled?: boolean;
  adjustType: number;
  formType: string;
  hiddenFields?: string[];
  itemPageLoading?: boolean;
  itemPagination?: PurchasePriceAdjustItemPagination;
  remotePaging?: boolean;
  shortcutActive?: boolean;
}

type PurchasePriceAdjustItemPagination = {
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

const emit = defineEmits([
  'openInDetail',
  'update:items',
  'update:total-adjust-price',
  'page-change',
]);

const tableData = ref<ErpPurchasePriceAdjustApi.PurchasePriceAdjustItem[]>([]);
const displayTableData = ref<
  ErpPurchasePriceAdjustApi.PurchasePriceAdjustItem[]
>([]);
const warehouseOptions = ref<any[]>([]);
const deptOptions = ref<any[]>([]);
const priceReferenceOpen = ref(false);
const itemShortcutsRef =
  ref<InstanceType<typeof PurchaseItemDetailShortcuts>>();
const activeItemRowKey = ref<string>();
const itemTableWrapRef = ref<HTMLElement | null>(null);
const activeItemSort = ref<
  undefined | { field: string; order: PurchaseDocumentItemSortOrder }
>();
const localItemPage = ref({ pageNo: 1, pageSize: DEFAULT_ITEM_PAGE_SIZE });
let isShortcutListening = false;
let isShortcutScopeActive = false;
let itemResizeFrame = 0;
let lastItemTableWidth = 0;
/** 标记：本次 props.items 变更是否由内部字段编辑触发，是则跳过 reloadData 以避免横向滚动被重置 */
let isInternalUpdate = false;
let lastSyncedItemsSource:
  | ErpPurchasePriceAdjustApi.PurchasePriceAdjustItem[]
  | undefined;
const itemRowKeyManager = createPurchaseItemClientRowKeyManager(
  'purchase-price-adjust',
);

function getItemTableWidth(
  rows: ErpPurchasePriceAdjustApi.PurchasePriceAdjustItem[] = displayTableData.value,
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

function getItemRowKey(
  row?: ErpPurchasePriceAdjustApi.PurchasePriceAdjustItem,
) {
  if (!row) return undefined;
  return row.clientRowKey || itemRowKeyManager.ensureRowKey(row);
}

function setActiveItemRow(
  row?: ErpPurchasePriceAdjustApi.PurchasePriceAdjustItem,
) {
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

function setNewPriceText(
  row: ErpPurchasePriceAdjustApi.PurchasePriceAdjustItem,
) {
  (row as any).newPriceText = formatPurchaseAmount(row.newPrice, '0.00');
}

function setAdjustRatioText(
  row: ErpPurchasePriceAdjustApi.PurchasePriceAdjustItem,
) {
  (row as any).adjustRatioText =
    row.adjustRatio === null || row.adjustRatio === undefined
      ? ''
      : formatPurchaseDecimal(row.adjustRatio);
}

function parseDecimalText(
  value: unknown,
  label: string,
  options: { allowEmpty?: boolean; decimals: number; min?: number },
) {
  return parsePurchaseDecimal(value, label, options);
}

function prepareItemRows(
  items: ErpPurchasePriceAdjustApi.PurchasePriceAdjustItem[],
) {
  const rows = items.map((item) => ({ ...item }));
  itemRowKeyManager.ensureRowKeys(rows);
  rows.forEach((item) => initRow(item));
  return rows;
}

/** 表格合计 */
const summaries = computed(() => ({
  count: purchaseDecimalAdd(...tableData.value.map((item) => item.count || 0)),
  adjustPrice: purchaseDecimalAdd(
    ...tableData.value.map((item) => item.adjustPrice || 0),
  ),
}));

function buildItemColumns(
  hiddenFields = props.hiddenFields,
  rows = displayTableData.value,
): NonNullable<
  VxeTableGridOptions<ErpPurchasePriceAdjustApi.PurchasePriceAdjustItem>['columns']
> {
  return preparePurchaseDocumentItemColumns(
    (useFormItemColumns(props.formType, props.adjustType, hiddenFields) ||
      []) as unknown as Parameters<
      typeof preparePurchaseDocumentItemColumns
    >[0],
    {
      editable: !props.disabled,
      rows,
      trailingFlexibleColumnMinWidth: 150,
    },
  ) as unknown as NonNullable<
    VxeTableGridOptions<ErpPurchasePriceAdjustApi.PurchasePriceAdjustItem>['columns']
  >;
}

async function refreshItemColumns(
  rows: ErpPurchasePriceAdjustApi.PurchasePriceAdjustItem[] = displayTableData.value,
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

function isPriceItemHidden(field: string) {
  return isPurchasePriceAdjustPriceItemHidden(props.hiddenFields, field);
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
          {
            deptOptions: deptOptions.value,
            warehouseOptions: warehouseOptions.value,
          },
        );
  if (props.remotePaging) {
    return rows;
  }
  const startIndex =
    (localItemPage.value.pageNo - 1) * localItemPage.value.pageSize;
  return rows.slice(startIndex, startIndex + localItemPage.value.pageSize);
}

function findOptionName(options: any[], id?: number): string | undefined {
  if (id === null || id === undefined) return undefined;
  for (const option of options) {
    if (String(option.id) === String(id)) return option.name;
    const childName = findOptionName(option.children || [], id);
    if (childName) return childName;
  }
  return undefined;
}

function resolveWarehouseName(row: Record<string, any>) {
  return (
    row.warehouseName ||
    findOptionName(warehouseOptions.value, row.warehouseId) ||
    '-'
  );
}

function resolveDeptName(row: Record<string, any>) {
  return row.deptName || findOptionName(deptOptions.value, row.deptId) || '-';
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

async function handleToolbarRefresh() {
  if (props.remotePaging && props.disabled) {
    emit('page-change', {
      orderDirection: activeItemSort.value?.order,
      orderField: activeItemSort.value?.field,
      pageNo: effectiveItemPagination.value.pageNo,
      pageSize: effectiveItemPagination.value.pageSize,
    });
    return;
  }
  await refreshItemGrid();
}

async function handleItemSortChange({ field, order }: any) {
  activeItemRowKey.value = undefined;
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
  activeItemRowKey.value = undefined;
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
    id: 'erp-purchase-price-adjust-item-list-v1',
    autoResize: true,
    fit: false,
    border: true,
    rowConfig: { keyField: 'clientRowKey', isHover: true },
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
      enabled: true,
      custom: true,
      refresh: {
        queryMethod: handleToolbarRefresh,
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
    cellClick: ({
      row,
    }: {
      row: ErpPurchasePriceAdjustApi.PurchasePriceAdjustItem;
    }) => setActiveItemRow(row),
    currentRowChange: ({
      row,
    }: {
      row?: ErpPurchasePriceAdjustApi.PurchasePriceAdjustItem;
    }) => setActiveItemRow(row),
  },
});

/** 发出 items 更新
 * @param skipReload 是否跳过 grid.reloadData；仅字段编辑场景为 true（保留滚动位置），增删行场景为 false
 */
function emitItemsUpdate(skipReload = false) {
  isInternalUpdate = skipReload;
  emit(
    'update:items',
    tableData.value.map((item) => {
      const {
        adjustRatioText: _adjustRatioText,
        newPriceText: _newPriceText,
        ...data
      } = item as any;
      return data;
    }),
  );
}

/** 同步合计到父组件 */
watch(
  () => summaries.value.adjustPrice,
  (val) => {
    emit('update:total-adjust-price', val || 0);
  },
  { immediate: true },
);

/** 监听外部传入的 items */
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
    if (
      activeItemRowKey.value &&
      !tableData.value.some(
        (item) => getItemRowKey(item) === activeItemRowKey.value,
      )
    ) {
      activeItemRowKey.value = undefined;
    }
    await nextTick();
    if (gridApi.grid) {
      await refreshItemGrid();
    }
  },
  { immediate: true },
);

/** 监听 adjustType 变化，刷新动态列 */
watch(
  () => props.adjustType,
  async () => {
    if (gridApi.grid) {
      await refreshItemColumns();
      if (activeItemSort.value)
        await gridApi.grid.setSort(activeItemSort.value);
    }
  },
);

watch(
  () => props.hiddenFields,
  async () => {
    if (gridApi.grid) {
      await refreshItemColumns(displayTableData.value);
      if (activeItemSort.value)
        await gridApi.grid.setSort(activeItemSort.value);
    }
  },
  { deep: true },
);

/** 兜底：grid 挂载完成后再同步一次列和数据，避免首个 immediate watch 早于 grid 初始化 */
onMounted(async () => {
  await nextTick();
  if (gridApi.grid) {
    await refreshItemColumns();
    if (props.items && props.items.length > 0) {
      tableData.value = prepareItemRows(props.items);
      await refreshItemGrid();
    }
  }
  if (activeItemSort.value && gridApi.grid) {
    await refreshItemGrid();
  }
});

/** 初始化行数据 */
function initRow(row: ErpPurchasePriceAdjustApi.PurchasePriceAdjustItem) {
  itemRowKeyManager.ensureRowKey(row);
  const oldPrice = Number(row.oldPrice) || 0;
  const newPrice = Number(row.newPrice) || 0;
  const count = Number(row.count) || 0;
  row.oldPrice = oldPrice;
  row.newPrice = newPrice;
  row.count = count;
  row.adjustPrice = purchaseDecimalMultiply(
    purchaseDecimalSubtract(newPrice, oldPrice),
    count,
  );
  setNewPriceText(row);
  setAdjustRatioText(row);
}

/** 调整后单价变更 */
function handleNewPriceChange(
  row: ErpPurchasePriceAdjustApi.PurchasePriceAdjustItem,
) {
  const newPrice = Number(row.newPrice) || 0;
  const oldPrice = Number(row.oldPrice) || 0;
  const count = Number(row.count) || 0;
  row.adjustPrice = purchaseDecimalMultiply(
    purchaseDecimalSubtract(newPrice, oldPrice),
    count,
  );
  // 按入库单方式下，手改单价反推比率
  if (props.adjustType === 10 && oldPrice > 0) {
    row.adjustRatio = purchaseDecimalMultiply(
      purchaseDecimalDivide(newPrice, oldPrice),
      100,
    );
    setAdjustRatioText(row);
  }
  const rowKey = itemRowKeyManager.ensureRowKey(row);
  const index = tableData.value.findIndex(
    (item) => item.clientRowKey === rowKey,
  );
  if (index !== -1) {
    tableData.value[index] = row;
    emitItemsUpdate(true);
  }
  if (activeItemSort.value) {
    void nextTick(refreshItemGrid);
  } else {
    void nextTick(() => refreshItemGrid({ reloadData: false }));
  }
}

/** 调价比率变更（仅按入库单方式） */
function handleRatioChange(
  row: ErpPurchasePriceAdjustApi.PurchasePriceAdjustItem,
) {
  const oldPrice = Number(row.oldPrice) || 0;
  const ratio = Number(row.adjustRatio);
  if (!Number.isNaN(ratio) && oldPrice >= 0) {
    row.newPrice = purchaseDecimalMultiply(
      oldPrice,
      purchaseDecimalDivide(ratio, 100),
    );
    setNewPriceText(row);
  }
  const count = Number(row.count) || 0;
  row.adjustPrice = purchaseDecimalMultiply(
    purchaseDecimalSubtract(Number(row.newPrice) || 0, oldPrice),
    count,
  );
  const rowKey = itemRowKeyManager.ensureRowKey(row);
  const index = tableData.value.findIndex(
    (item) => item.clientRowKey === rowKey,
  );
  if (index !== -1) {
    tableData.value[index] = row;
    emitItemsUpdate(true);
  }
  if (activeItemSort.value) {
    void nextTick(refreshItemGrid);
  } else {
    void nextTick(() => refreshItemGrid({ reloadData: false }));
  }
}

function handleNewPriceBlur(
  row: ErpPurchasePriceAdjustApi.PurchasePriceAdjustItem,
) {
  const parsed = parseDecimalText((row as any).newPriceText, '调价后单价', {
    decimals: 6,
    min: 0,
  });
  if (!parsed.ok) {
    message.warning(parsed.message);
    setNewPriceText(row);
    return;
  }
  row.newPrice = parsed.value;
  setNewPriceText(row);
  handleNewPriceChange(row);
}

function handleAdjustRatioBlur(
  row: ErpPurchasePriceAdjustApi.PurchasePriceAdjustItem,
) {
  const parsed = parseDecimalText((row as any).adjustRatioText, '调价比率', {
    allowEmpty: true,
    decimals: 6,
    min: 0,
  });
  if (!parsed.ok) {
    message.warning(parsed.message);
    setAdjustRatioText(row);
    return;
  }
  row.adjustRatio = parsed.value;
  setAdjustRatioText(row);
  if (parsed.value === undefined) {
    emitItemsUpdate(true);
    return;
  }
  handleRatioChange(row);
}

/** 备注变更 */
function handleRemarkChange(
  row: ErpPurchasePriceAdjustApi.PurchasePriceAdjustItem,
) {
  const rowKey = itemRowKeyManager.ensureRowKey(row);
  const index = tableData.value.findIndex(
    (item) => item.clientRowKey === rowKey,
  );
  if (index !== -1) {
    tableData.value[index] = row;
    emitItemsUpdate(true);
  }
  if (activeItemSort.value) {
    void nextTick(refreshItemGrid);
  } else {
    void nextTick(() => refreshItemGrid({ reloadData: false }));
  }
}

/** 删除 */
function handleDelete(row: ErpPurchasePriceAdjustApi.PurchasePriceAdjustItem) {
  const rowKey = itemRowKeyManager.ensureRowKey(row);
  const index = tableData.value.findIndex(
    (item) => item.clientRowKey === rowKey,
  );
  if (index !== -1) tableData.value.splice(index, 1);
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
  emitItemsUpdate(false); // 删除行需要 reload
}

/** 表单校验 */
function validate() {
  if (tableData.value.length === 0) {
    throw new Error('调价明细不能为空');
  }
  const duplicateKeys = new Set<string>();
  tableData.value.forEach((item, index) => {
    const duplicateKey = buildPurchaseItemDuplicateKey(item);
    if (duplicateKey) {
      if (duplicateKeys.has(duplicateKey)) {
        throw new Error(`第 ${index + 1} 行：产品、仓库、赠品标识重复`);
      }
      duplicateKeys.add(duplicateKey);
    }
    const priceParsed = parseDecimalText(
      (item as any).newPriceText,
      '调价后单价',
      { decimals: 6, min: 0 },
    );
    if (!priceParsed.ok) {
      throw new Error(`第 ${index + 1} 行：${priceParsed.message}`);
    }
    item.newPrice = priceParsed.value;
    if (props.adjustType === 10) {
      const ratioParsed = parseDecimalText(
        (item as any).adjustRatioText,
        '调价比率',
        { allowEmpty: true, decimals: 6, min: 0 },
      );
      if (!ratioParsed.ok) {
        throw new Error(`第 ${index + 1} 行：${ratioParsed.message}`);
      }
      item.adjustRatio = ratioParsed.value;
    }
    initRow(item);
  });
}

function getItems() {
  return tableData.value.map((item) => {
    const {
      adjustRatioText: _adjustRatioText,
      newPriceText: _newPriceText,
      ...data
    } = item as any;
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
  (props.items ?? []).forEach((item) => initRow(item));
  tableData.value = [...(props.items ?? [])];
  await nextTick();
  await refreshItemGrid();
  await refreshItemColumns();
}

defineExpose({ clearItemSort, getItems, reloadItemsFromProps, validate });

onMounted(() => {
  isShortcutScopeActive = true;
  syncShortcutListening();
  lastItemTableWidth = getItemTableWidth();
  window.addEventListener('resize', handleItemWindowResize);
});

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
      class="purchase-price-adjust-item-table-wrap"
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
            <span class="purchase-document-item-shortcut-hint__label"
              >当前页</span
            >
            <span><kbd>W</kbd><b>全部价格</b></span>
          </div>
        </template>
        <template #toolbar-tools>
          <div
            class="purchase-price-adjust-item-toolbar flex items-center gap-2"
          >
            <slot name="toolbar"></slot>
          </div>
        </template>
        <template #inNo="{ row }">
          <a
            v-if="row.inNo && row.inId"
            class="cursor-pointer text-primary"
            @click.stop="emit('openInDetail', row.inId)"
          >
            {{ row.inNo }}
          </a>
          <span v-else>{{ row.inNo || '-' }}</span>
        </template>
        <template #newPrice="{ row }">
          <span v-if="disabled && isPriceItemHidden('newPrice')">****</span>
          <Input
            v-else-if="!disabled"
            v-model:value="row.newPriceText"
            autocomplete="off"
            class="w-full"
            inputmode="decimal"
            @press-enter="focusNextInputOnEnter"
            @blur="handleNewPriceBlur(row)"
          />
          <span v-else>{{ formatPurchaseAmount(row.newPrice, '-') }}</span>
        </template>
        <template #warehouseId="{ row }">
          <span :title="resolveWarehouseName(row)">
            {{ resolveWarehouseName(row) }}
          </span>
        </template>
        <template #deptId="{ row }">
          <span :title="resolveDeptName(row)">
            {{ resolveDeptName(row) }}
          </span>
        </template>
        <template #adjustRatio="{ row }">
          <Input
            v-if="!disabled"
            v-model:value="row.adjustRatioText"
            autocomplete="off"
            class="w-full"
            inputmode="decimal"
            @press-enter="focusNextInputOnEnter"
            @blur="handleAdjustRatioBlur(row)"
          />
          <span v-else>
            {{
              row.adjustRatio == null
                ? '-'
                : formatPurchaseDecimal(row.adjustRatio, '-')
            }}
          </span>
        </template>
        <template #remark="{ row }">
          <Input
            v-if="!disabled"
            v-model:value="row.remark"
            class="w-full"
            placeholder="请输入备注"
            @blur="handleRemarkChange(row)"
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
                  title: '确认删除该调价明细吗？',
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
    <div v-if="showItemPager" class="purchase-price-adjust-item-pager">
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
:deep(.ant-input-number) {
  font-size: 11px;
}

:deep(.vxe-header--column.is--sortable .vxe-cell--title) {
  color: #1677ff;
}

:deep(.vxe-header--column .vxe-cell--sort) {
  display: none;
}

.purchase-price-adjust-item-table-wrap {
  position: relative;
}

:deep(.purchase-document-item-row--active > td) {
  background: #e8f3ff !important;
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

.purchase-price-adjust-item-pager {
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
}

.purchase-price-adjust-item-pager :deep(.ant-pagination),
.purchase-price-adjust-item-pager :deep(.ant-pagination-item),
.purchase-price-adjust-item-pager :deep(.ant-pagination-total-text),
.purchase-price-adjust-item-pager :deep(.ant-pagination-options),
.purchase-price-adjust-item-pager :deep(.ant-select),
.purchase-price-adjust-item-pager :deep(.ant-input) {
  font-size: 11px;
}

.purchase-price-adjust-item-pager :deep(.ant-pagination-item),
.purchase-price-adjust-item-pager :deep(.ant-pagination-prev),
.purchase-price-adjust-item-pager :deep(.ant-pagination-next),
.purchase-price-adjust-item-pager :deep(.ant-pagination-jump-prev),
.purchase-price-adjust-item-pager :deep(.ant-pagination-jump-next) {
  min-width: 24px;
  height: 24px;
  line-height: 22px;
}

.purchase-price-adjust-item-pager :deep(.ant-pagination-item a),
.purchase-price-adjust-item-pager :deep(.ant-pagination-prev button),
.purchase-price-adjust-item-pager :deep(.ant-pagination-next button) {
  height: 22px;
  font-size: 11px;
  line-height: 22px;
}

.purchase-price-adjust-item-pager :deep(.ant-pagination-options-size-changer),
.purchase-price-adjust-item-pager :deep(.ant-select-single),
.purchase-price-adjust-item-pager :deep(.ant-select-selector) {
  height: 24px;
  line-height: 22px;
}

.purchase-price-adjust-item-pager
  :deep(.ant-pagination-options-size-changer .ant-select-selector) {
  box-sizing: border-box;
  align-items: center;
  min-height: 24px;
  padding: 0 24px 0 8px;
}

.purchase-price-adjust-item-pager
  :deep(.ant-select-single .ant-select-selector .ant-select-selection-item) {
  height: 22px;
  font-size: 11px;
  line-height: 22px;
}

.purchase-price-adjust-item-pager :deep(.ant-select-arrow) {
  margin-top: -5px;
  font-size: 10px;
}

.purchase-price-adjust-item-pager
  :deep(.ant-pagination-options-quick-jumper input) {
  height: 24px;
  padding: 0 7px;
  font-size: 11px;
  line-height: 22px;
}
</style>
