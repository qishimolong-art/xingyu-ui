<script lang="ts" setup>
import { CANDIDATE_FOCUS_KEY } from '#/views/erp/utils/candidate-focus';

import type { SaleCartItemSortOrder } from './sale-cart-item-sort';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpSaleCartApi } from '#/api/erp/sale/cart';
import type { ErpStockApi } from '#/api/erp/stock/stock';

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
import { useVbenModal, VbenLoading } from '@vben/common-ui';
import {
  Button,
  Checkbox,
  Input,
  message,
  Modal,
  Pagination,
  Select,
  Tag,
} from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import { getProduct } from '#/api/erp/product/product';
import { batchUpdateSaleCartItems } from '#/api/erp/sale/cart';
import {
  getAvailableBatchNoList,
  getSaleStockPage,
  getStockCount,
} from '#/api/erp/stock/stock';
import {
  getSaleWarehouseSimplePage,
  getWarehouse,
} from '#/api/erp/stock/warehouse';
import { getDept } from '#/api/system/dept';
import ErpInlineStockSelect from '#/views/erp/components/ErpInlineStockSelect.vue';
import ItemPriceReferenceOverlay from '#/views/erp/components/ItemPriceReferenceOverlay.vue';
import {
  formatSaleAmount,
  formatSaleDecimal,
  parseSaleDecimal,
  saleDecimalAdd,
  saleDecimalMultiply,
} from '#/views/erp/sale/utils/decimal';
import ProductForm from '#/views/erp/product/product/modules/form.vue';
import PurchaseItemDetailShortcuts from '#/views/erp/purchase/components/PurchaseItemDetailShortcuts.vue';
import SaleBatchAdjustPriceForm from '#/views/erp/sale/components/sale-batch-adjust-price-form.vue';
import SaleStockProductSelectModal from '#/views/erp/sale/components/SaleStockProductSelectModal.vue';
import {
  CURRENT_SELECT_LABEL_PLACEHOLDER,
  findDeptName,
  findResolvedOptionById,
  isMissingDisplayName,
  mergeResolvedOptionsById,
} from '#/views/erp/sale/utils/document-item-select';
import { applySaleDocumentItemColumnCustomization } from '#/views/erp/sale/utils/document-item-table';
import {
  getSalePriceReferenceOverlayHiddenFields,
  isSalePriceItemHidden,
} from '#/views/erp/sale/utils/field-permission';
import { createSaleItemClientRowKeyManager } from '#/views/erp/sale/utils/item-row-key';
import {
  firstNumericPrice,
  loadOrderPriceCustomFieldNames,
  pickCustomerLevelPrice,
} from '#/views/erp/sale/utils/price-level';
import {
  focusSaleShortcutOwner,
  isSaleShortcutOwnerActive,
} from '#/views/erp/sale/utils/shortcut-scope';
import { isBatchNoEnabled } from '#/views/erp/utils/item';
import {
  createErpItemRowFocusController,
  focusEditableInputByRowKey,
} from '#/views/erp/utils/item-row-focus';
import {
  focusFirstEditableInput,
  focusNextInputOnEnter,
  isCreateShortcutKey,
  isEditableEnterTarget,
} from '#/views/erp/utils/keyboard';
import {
  isPriceReferenceShortcut,
  shouldIgnorePriceReferenceShortcut,
} from '#/views/erp/utils/price-reference';
import { settleVxeColumnCustomization } from '#/views/erp/utils/vxe-column-custom';

import { useFormItemColumns } from '../data';
import { mergeSaleCartItems } from '../utils/item-merge';
import { buildSaleCartStockShortageText } from '../utils/stock-shortage-message';
import { sortSaleCartItems } from './sale-cart-item-sort';

provide(CANDIDATE_FOCUS_KEY, ref(true));

const itemRowKeyManager = createSaleItemClientRowKeyManager('sale-cart-item');

interface Props {
  items?: ErpSaleCartApi.SaleCartItem[];
  disabled?: boolean;
  compact?: boolean;
  feeAmount?: number;
  hiddenFields?: string[];
  deptId?: number;
  customerPriceLevel?: number;
  documentId?: number;
  enableBatchEdit?: boolean;
  itemPageLoading?: boolean;
  itemPagination?: SaleDocumentItemPagination;
  priceType?: string;
  remotePaging?: boolean;
  remoteSortLocked?: boolean;
  shortcutActive?: boolean;
  suspendPriceAutoRefresh?: boolean;
}

type EditableSaleCartItem = ErpSaleCartApi.SaleCartItem & {
  countText?: string;
  productPriceText?: string;
  seq?: number | string;
};

type StockShortage = {
  batchNo?: string;
  key: string;
  productCode?: string;
  productId?: number;
  productName?: string;
  requiredCount: number;
  shortageCount: number;
  stockCount: number;
  warehouseId?: number;
  warehouseName?: string;
};

interface BatchUpdateItemsPayload {
  mode?: 'local' | 'server';
  priceLevel?: number;
}

type ApplyBatchUpdateItemsOptions = {
  showMessage?: boolean;
  validateDuplicate?: boolean;
};

type SyncItemsFromPropsOptions = {
  force?: boolean;
  refreshAuxiliary?: boolean;
};

type SaleDocumentItemPagination = {
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
const SALE_CART_ALL_PRODUCT_PERMISSION = 'erp:sale-cart:all-product';

const props = withDefaults(defineProps<Props>(), {
  items: () => [],
  disabled: false,
  compact: false,
  feeAmount: 0,
  hiddenFields: () => [],
  deptId: undefined,
  customerPriceLevel: undefined,
  documentId: undefined,
  enableBatchEdit: false,
  itemPageLoading: false,
  itemPagination: () => ({
    orderDirection: undefined,
    orderField: undefined,
    pageNo: 1,
    pageSize: DEFAULT_ITEM_PAGE_SIZE,
    total: 0,
  }),
  priceType: undefined,
  remotePaging: false,
  remoteSortLocked: false,
  shortcutActive: true,
  suspendPriceAutoRefresh: false,
});

const emit = defineEmits([
  'update:items',
  'update:summary',
  'batch-update-success',
  'import',
  'page-change',
  'request-submit',
  'remoteBlankRowAdded',
  'remoteRowsDeleted',
  'remoteStockSelectionRequested',
]);
const SALE_CART_ITEM_COUNT_INPUT_SELECTOR =
  '[data-sale-cart-count-input="true"]';
const SALE_CART_PRODUCT_SELECT_INPUT_SELECTOR =
  '[data-erp-inline-stock-select-input="true"]';
const tableData = ref<EditableSaleCartItem[]>([]);
const warehouseOptions = ref<any[]>([]);
const warehouseOptionsByDept = ref<Record<number, any[]>>({});
const deptOptions = ref<any[]>([]);
const batchNoOptionsMap = ref<Record<string, any[]>>({});
const productSelectRef =
  ref<InstanceType<typeof SaleStockProductSelectModal>>();
const purchaseShortcutsRef =
  ref<InstanceType<typeof PurchaseItemDetailShortcuts>>();
const activeItemRowKey = ref<string>();
const activeItemSort = ref<null | {
  field: string;
  order: SaleCartItemSortOrder;
}>(null);
const localItemPage = ref({ pageNo: 1, pageSize: DEFAULT_ITEM_PAGE_SIZE });
const selectedBatchItemRows = ref<EditableSaleCartItem[]>([]);
const inlineStockSelectorOpen = ref(false);
const priceReferenceOpen = ref(false);
const itemTableWrapRef = ref<HTMLElement | null>(null);
const { hasAccessByCodes } = useAccess();
const canEditProduct = computed(() => hasAccessByCodes(['erp:product:update']));
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
const [BatchAdjustPriceModal, batchAdjustPriceModalApi] = useVbenModal({
  connectedComponent: SaleBatchAdjustPriceForm,
  destroyOnClose: true,
});
let isInternalUpdate = false;
let isShortcutListening = false;
let isShortcutScopeActive = false;
let pendingQuoteOrderHistoryShift = false;
let itemSortRunId = 0;
let itemSyncRunId = 0;
let itemSelectLabelHydrateSequence = 0;
let itemRowsReadyPromise: Promise<void> = Promise.resolve();
let lastSyncedItemsSource: ErpSaleCartApi.SaleCartItem[] | undefined;
const itemSortMaskVisible = ref(false);

const ITEM_SORT_MASK_MIN_DURATION = 220;
function getAllSaleProductWarehouseParams() {
  return hasAccessByCodes([SALE_CART_ALL_PRODUCT_PERMISSION])
    ? {
        allSaleProduct: true,
        allSaleProductPermission: SALE_CART_ALL_PRODUCT_PERMISSION,
      }
    : undefined;
}

function getInlineStockPageParams() {
  return {
    ...getAllSaleProductWarehouseParams(),
    saleDeptId: props.deptId,
    showBatchNo: true,
  };
}

function mergeOptionsById(oldOptions: any[], nextOptions: any[]) {
  return mergeResolvedOptionsById(oldOptions, nextOptions);
}

function getCurrentDeptOption(row: any) {
  if (!row?.deptId) {
    return [];
  }
  const existed = findResolvedOptionById(deptOptions.value, row.deptId);
  if (existed) {
    return [existed];
  }
  const currentName = row.deptName || row.warehouseDeptName;
  return [
    {
      id: row.deptId,
      name: isMissingDisplayName(currentName, row.deptId)
        ? CURRENT_SELECT_LABEL_PLACEHOLDER
        : currentName,
    },
  ];
}

function getCurrentDeptDisplayName(row: any) {
  const currentName = row?.deptName || row?.warehouseDeptName;
  return isMissingDisplayName(currentName, row?.deptId) ? '-' : currentName;
}

const canUseServerBatchUpdate = computed(
  () => props.disabled && Boolean(props.documentId),
);
const batchUpdateAccessCodes = computed(() =>
  props.documentId ? ['erp:sale-cart:update'] : ['erp:sale-cart:create'],
);
const canShowBatchAdjustPrice = computed(
  () =>
    props.enableBatchEdit &&
    hasAccessByCodes(batchUpdateAccessCodes.value) &&
    !isSalePriceItemHidden(props.hiddenFields, 'productPrice'),
);
const canShowItemSelection = computed(
  () => !props.disabled || canShowBatchAdjustPrice.value,
);
const selectedItemCount = computed(() => selectedBatchItemRows.value.length);
const selectedBatchItemIds = computed(() =>
  selectedBatchItemRows.value
    .filter((row) => canBatchUpdateItemRow(row))
    .map((row) => row.id!)
    .filter(Boolean),
);
const selectedBatchItemCount = computed(
  () => selectedBatchItemRows.value.filter(canBatchUpdateItemRow).length,
);
const selectedDeleteItemRows = computed(() =>
  selectedBatchItemRows.value.filter((row) => canDeleteItemRow(row)),
);
const selectedDeleteItemCount = computed(
  () => selectedDeleteItemRows.value.length,
);
const batchEditableItemCount = computed(
  () => tableData.value.filter((row) => canBatchUpdateItemRow(row)).length,
);
const priceReferenceHiddenFields = computed(() =>
  getSalePriceReferenceOverlayHiddenFields(props.hiddenFields),
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

function waitForBrowserPaint() {
  if (typeof requestAnimationFrame !== 'function') {
    return nextTick();
  }
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

function waitForDuration(duration: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, duration));
}

function getDisplayedItems() {
  const activeSort = activeItemSort.value;
  const rows =
    !activeSort || props.remotePaging
      ? [...tableData.value]
      : sortSaleCartItems(tableData.value, activeSort.field, activeSort.order, {
          deptOptions: deptOptions.value,
          warehouseOptions: warehouseOptions.value,
        });
  if (props.remotePaging) {
    return rows;
  }
  const startIndex =
    (localItemPage.value.pageNo - 1) * localItemPage.value.pageSize;
  return rows.slice(startIndex, startIndex + localItemPage.value.pageSize);
}

function getItemRowKey(row?: EditableSaleCartItem) {
  if (!row) return undefined;
  return itemRowKeyManager.ensureRowKey(row);
}

function setActiveItemRow(row?: EditableSaleCartItem) {
  const key = getItemRowKey(row);
  if (key) {
    activeItemRowKey.value = key;
  }
}

function getActiveItemRow(showWarning = true) {
  const row = tableData.value.find(
    (item) => getItemRowKey(item) === activeItemRowKey.value,
  );
  if (!row?.productId) {
    if (showWarning) {
      message.warning('请先点击一条有商品的销售手推车明细');
    }
    return undefined;
  }
  return row;
}

function getItemRowClassName({ row }: { row: EditableSaleCartItem }) {
  return getItemRowKey(row) === activeItemRowKey.value
    ? 'sale-cart-item-row--active'
    : '';
}

async function refreshItemGrid(showSortMask = false) {
  const runId = ++itemSortRunId;
  const startedAt = Date.now();
  if (showSortMask) {
    // 使用本地遮罩，避免 setLoading 重新合并初始化时的旧 data 而清空明细。
    itemSortMaskVisible.value = true;
    await nextTick();
    await waitForBrowserPaint();
  }

  try {
    if (runId !== itemSortRunId) return;
    const displayData = getDisplayedItems();
    gridApi.setGridOptions({ data: displayData });
    await gridApi.grid.loadData(displayData);
    await gridApi.grid.reloadColumn(
      buildCustomizedItemColumns(displayData) || [],
    );
    // reloadColumn 会清空 VXE 内部保存的列排序状态。远程分页返回后如果不恢复，
    // 用户再次点击同一列表头仍会从 asc 开始，无法切换到 desc。
    if (activeItemSort.value) {
      await gridApi.grid.setSort(activeItemSort.value);
    }
    await nextTick();
  } finally {
    if (runId === itemSortRunId) {
      if (showSortMask) {
        const remainingDuration =
          ITEM_SORT_MASK_MIN_DURATION - (Date.now() - startedAt);
        if (remainingDuration > 0) {
          await waitForDuration(remainingDuration);
        }
      }
      if (runId === itemSortRunId && itemSortMaskVisible.value) {
        itemSortMaskVisible.value = false;
      }
    }
  }
}

async function handleItemSortChange({ field, order }: any) {
  if (props.remotePaging && props.remoteSortLocked) {
    message.warning('存在未保存的新增明细，保存或删除新增行后可恢复排序');
    await gridApi.grid.clearSort?.();
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
  await refreshItemGrid(true);
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

function canBatchUpdateItemRow(row?: EditableSaleCartItem) {
  return Boolean(row?.productId && (!props.disabled || row.id));
}

function canDeleteItemRow(row?: EditableSaleCartItem) {
  return Boolean(row && !props.disabled);
}

function canSelectItemRow(row?: EditableSaleCartItem) {
  return canBatchUpdateItemRow(row) || canDeleteItemRow(row);
}

function buildItemColumns(
  rows: EditableSaleCartItem[] = getDisplayedItems(),
): NonNullable<VxeTableGridOptions<EditableSaleCartItem>['columns']> {
  const columns =
    useFormItemColumns(props.disabled, props.hiddenFields, props.compact, {
      compact: props.compact,
      editable: !props.disabled,
      getCellContentExtraWidth: (field, row) =>
        field === 'productId' && isCrossDeptWarehouse(row) ? 60 : 0,
      rows,
      isCellEditable: (field) => !['warehouseId', 'deptId'].includes(field),
      trailingFlexibleColumnMinWidth: 150,
    }) || [];
  const sortableColumns = props.remoteSortLocked
    ? columns.map((column) => ({ ...column, sortable: false }))
    : columns;
  if (canShowItemSelection.value) {
    return [
      {
        fixed: 'left',
        type: 'checkbox',
        width: 44,
      } as any,
      ...sortableColumns,
    ] as NonNullable<VxeTableGridOptions<EditableSaleCartItem>['columns']>;
  }
  return sortableColumns as NonNullable<
    VxeTableGridOptions<EditableSaleCartItem>['columns']
  >;
}

function buildCustomizedItemColumns(
  rows: EditableSaleCartItem[] = getDisplayedItems(),
) {
  return applySaleDocumentItemColumnCustomization(
    buildItemColumns(rows),
    gridApi.grid.getFullColumns?.() ?? [],
    150,
  );
}

async function handleItemColumnCustom({ type }: { type?: string }) {
  const settled = await settleVxeColumnCustomization(gridApi.grid, type);
  if (!settled) return;
  const columns =
    type === 'reset' ? buildItemColumns() : buildCustomizedItemColumns();
  await gridApi.grid.reloadColumn(columns || []);
  if (activeItemSort.value) await gridApi.grid.setSort(activeItemSort.value);
  await gridApi.grid.refreshColumn?.();
  await gridApi.grid.recalculate?.(true);
}

function clearBatchItemSelection() {
  selectedBatchItemRows.value = [];
  gridApi.grid?.clearCheckboxRow?.();
}

function handleOpenBatchAdjustPrice() {
  if (selectedBatchItemCount.value === 0) {
    message.warning('请先勾选可批量调整价格的销售手推车明细');
    return;
  }
  const isServerMode = canUseServerBatchUpdate.value;
  batchAdjustPriceModalApi
    .setData({
      customerPriceLevel: props.customerPriceLevel,
      documentId: isServerMode ? props.documentId : undefined,
      documentType: 'cart',
      itemCount: selectedBatchItemCount.value,
      itemIds: isServerMode ? selectedBatchItemIds.value : [],
      mode: isServerMode ? 'server' : 'local',
    })
    .open();
}

async function handleBatchAdjustPriceSuccess(
  payload?: BatchUpdateItemsPayload,
) {
  if (!payload) {
    return;
  }
  if (payload.mode === 'server' && props.documentId) {
    await batchUpdateSaleCartItems({
      cartId: props.documentId,
      itemIds: selectedBatchItemIds.value,
      priceLevel: payload.priceLevel,
    });
    message.success(
      `已批量调整 ${selectedBatchItemCount.value} 条销售手推车明细价格`,
    );
    clearBatchItemSelection();
    emit('batch-update-success');
    return;
  }
  const applied = await applyLocalBatchUpdateItems(payload);
  if (!applied) {
    return;
  }
  clearBatchItemSelection();
}

function buildCartItemDuplicateKey(item: Record<string, any>) {
  if (!item.productId || !item.warehouseId) {
    return '';
  }
  const batchNo =
    typeof item.batchNo === 'string' ? item.batchNo.trim() : item.batchNo;
  const giftKey = item.giftFlag === true ? 'gift' : 'normal';
  return `${item.productId}::${item.warehouseId}::${batchNo ?? ''}::${giftKey}`;
}

function isSelectedBatchItemRow(row: EditableSaleCartItem) {
  const rowKey = getItemRowKey(row);
  return selectedBatchItemRows.value
    .filter(canBatchUpdateItemRow)
    .some((item) => getItemRowKey(item) === rowKey);
}

async function loadBatchPriceProducts(payload: BatchUpdateItemsPayload) {
  if (payload.priceLevel === undefined) {
    return new Map<number, Record<string, any>>();
  }
  const productIds = [
    ...new Set(
      selectedBatchItemRows.value
        .filter(canBatchUpdateItemRow)
        .map((row) => row.productId)
        .filter((id): id is number => id !== undefined && id !== null),
    ),
  ];
  const products = await Promise.all(
    productIds.map(async (id) => [id, await getProduct(id)] as const),
  );
  return new Map<number, Record<string, any>>(products);
}

function buildBatchUpdatedItems(
  payload: BatchUpdateItemsPayload,
  productMap: Map<number, Record<string, any>> = new Map(),
) {
  const updatedRows: EditableSaleCartItem[] = [];
  const nextItems = tableData.value.map((item) => {
    if (!isSelectedBatchItemRow(item)) {
      return item;
    }
    const row = { ...item } as EditableSaleCartItem;
    if (payload.priceLevel !== undefined) {
      const product = row.productId ? productMap.get(row.productId) : undefined;
      const salePrice = pickProductPrice(
        {
          ...row,
          ...product,
          productPurchasePrice: product?.purchasePrice,
        },
        props.priceType,
        payload.priceLevel,
      );
      row.salePrice = salePrice;
      row.productPrice = row.giftFlag ? 0 : salePrice;
    }
    initRow(row);
    setCountText(row);
    setProductPriceText(row);
    updatedRows.push(row);
    return row;
  });
  return { nextItems, updatedRows };
}

function hasDuplicateBatchUpdatedItems(items: EditableSaleCartItem[]) {
  const keys = new Set<string>();
  return items.some((item) => {
    const key = buildCartItemDuplicateKey(item as any);
    if (!key) {
      return false;
    }
    if (keys.has(key)) {
      return true;
    }
    keys.add(key);
    return false;
  });
}

async function applyLocalBatchUpdateItems(
  payload: BatchUpdateItemsPayload,
  options: ApplyBatchUpdateItemsOptions = {},
) {
  const { showMessage = true, validateDuplicate = true } = options;
  if (payload.priceLevel === undefined) {
    message.warning('请选择价格体系');
    return false;
  }
  const productMap = await loadBatchPriceProducts(payload);
  const { nextItems, updatedRows } = buildBatchUpdatedItems(
    payload,
    productMap,
  );
  if (updatedRows.length === 0) {
    message.warning('请先勾选可批量修改的销售手推车明细');
    return false;
  }
  if (validateDuplicate && hasDuplicateBatchUpdatedItems(nextItems)) {
    message.warning(
      '批量修改后存在产品、仓库、批次、赠品标识重复，请调整后再操作',
    );
    return false;
  }
  tableData.value.splice(0, tableData.value.length, ...nextItems);
  emitItemsUpdate(true);
  await nextTick();
  await refreshItemGrid();
  warnStockShortages();
  if (showMessage) {
    message.success(`已批量更新 ${updatedRows.length} 条销售手推车明细`);
  }
  return true;
}

function setCountText(row: ErpSaleCartApi.SaleCartItem) {
  (row as any).countText =
    row.count === null || row.count === undefined ? '' : String(row.count);
}

function setProductPriceText(row: ErpSaleCartApi.SaleCartItem) {
  (row as any).productPriceText =
    row.productPrice === null || row.productPrice === undefined
      ? ''
      : formatSaleAmount(row.productPrice);
}

function resolveWarehouseDeptId(warehouseId?: number) {
  if (!warehouseId) return undefined;
  return findResolvedOptionById(warehouseOptions.value, warehouseId)?.deptId;
}

function resolveWarehouseDeptName(warehouseId?: number) {
  if (!warehouseId) return undefined;
  return findResolvedOptionById(warehouseOptions.value, warehouseId)?.deptName;
}

function findWarehouseOption(warehouseId?: number | string) {
  const warehouse = findResolvedOptionById(warehouseOptions.value, warehouseId);
  if (warehouse) {
    return warehouse;
  }
  return Object.values(warehouseOptionsByDept.value)
    .flat()
    .find(
      (item) =>
        String(item?.id ?? item?.value) === String(warehouseId) &&
        !isMissingDisplayName(item?.name ?? item?.label, warehouseId),
    );
}

function isCrossDeptWarehouse(row: ErpSaleCartApi.SaleCartItem) {
  return (
    !!props.deptId &&
    !!row.warehouseDeptId &&
    row.warehouseDeptId !== props.deptId
  );
}

async function loadWarehouseOptionsByDept(deptId?: number) {
  if (!deptId || warehouseOptionsByDept.value[deptId]) {
    return;
  }
  const page = await getSaleWarehouseSimplePage({
    ...getAllSaleProductWarehouseParams(),
    deptId,
    pageNo: 1,
    pageSize: 10,
  });
  const options = page?.list || [];
  warehouseOptionsByDept.value = {
    ...warehouseOptionsByDept.value,
    [deptId]: options,
  };
  warehouseOptions.value = mergeOptionsById(warehouseOptions.value, options);
  void hydrateMissingCurrentSelectLabels(tableData.value);
}

function getReadonlyWarehouseName(row: any) {
  if (!row?.warehouseId) {
    return '-';
  }
  const currentName = row.warehouseName || row.warehouseNameLabel;
  const existed = findWarehouseOption(row.warehouseId);
  return isMissingDisplayName(currentName, row.warehouseId)
    ? existed?.name || '-'
    : currentName;
}

function getReadonlyWarehouseDeptName(row: any) {
  const currentName = row?.warehouseDeptName;
  return isMissingDisplayName(currentName, row?.warehouseDeptId)
    ? '-'
    : currentName;
}

function applyCachedSelectLabels(rows: EditableSaleCartItem[]) {
  let changed = false;
  rows.forEach((row) => {
    const warehouse = findResolvedOptionById(
      warehouseOptions.value,
      row.warehouseId,
    );
    if (warehouse) {
      if (isMissingDisplayName(row.warehouseName, row.warehouseId)) {
        row.warehouseName = warehouse.name;
        (row as any).warehouseNameLabel = warehouse.name;
        changed = true;
      }
      if (!row.warehouseDeptId && warehouse.deptId) {
        row.warehouseDeptId = warehouse.deptId;
        changed = true;
      }
      if (
        isMissingDisplayName(row.warehouseDeptName, row.warehouseDeptId) &&
        warehouse.deptName
      ) {
        row.warehouseDeptName = warehouse.deptName;
        changed = true;
      }
      if (!row.deptId && warehouse.deptId) {
        row.deptId = warehouse.deptId;
        changed = true;
      }
    }

    const deptName = findDeptName(deptOptions.value, row.deptId);
    if (
      row.deptId &&
      isMissingDisplayName((row as any).deptName, row.deptId) &&
      deptName
    ) {
      (row as any).deptName = deptName;
      changed = true;
    }
  });
  return changed;
}

async function hydrateMissingCurrentSelectLabels(rows: EditableSaleCartItem[]) {
  const sequence = ++itemSelectLabelHydrateSequence;
  let changed = applyCachedSelectLabels(rows);
  const warehouseIds = [
    ...new Set(
      rows
        .filter(
          (row) =>
            row.warehouseId &&
            isMissingDisplayName(row.warehouseName, row.warehouseId),
        )
        .map((row) => row.warehouseId!),
    ),
  ];

  if (warehouseIds.length > 0) {
    const warehouses = await Promise.all(
      warehouseIds.map((id) => getWarehouse(id).catch(() => undefined)),
    );
    if (sequence !== itemSelectLabelHydrateSequence) {
      return;
    }
    warehouseOptions.value = mergeOptionsById(
      warehouseOptions.value,
      warehouses.filter(Boolean),
    );
    changed = applyCachedSelectLabels(rows) || changed;
  }

  const deptIds = [
    ...new Set(
      rows
        .filter(
          (row) =>
            row.deptId &&
            isMissingDisplayName((row as any).deptName, row.deptId),
        )
        .map((row) => row.deptId!),
    ),
  ];
  if (deptIds.length > 0) {
    const depts = await Promise.all(
      deptIds.map((id) => getDept(id).catch(() => undefined)),
    );
    if (sequence !== itemSelectLabelHydrateSequence) {
      return;
    }
    deptOptions.value = mergeOptionsById(
      deptOptions.value,
      depts.filter(Boolean),
    );
    changed = applyCachedSelectLabels(rows) || changed;
  }

  if (changed && sequence === itemSelectLabelHydrateSequence) {
    await refreshItemGrid();
  }
}

async function loadWarehouseOptionsForRows(rows: any | any[]) {
  const rowList = Array.isArray(rows) ? rows : [rows];
  const deptIds = new Set<number>();
  rowList.forEach((row) => {
    if (!row) return;
    row.deptId ??= props.deptId ?? resolveWarehouseDeptId(row.warehouseId);
    row.warehouseDeptId ??= resolveWarehouseDeptId(row.warehouseId);
    row.warehouseDeptName ??= resolveWarehouseDeptName(row.warehouseId);
    if (row.deptId) {
      deptIds.add(row.deptId);
    }
  });
  await Promise.all(
    [...deptIds].map((deptId) => loadWarehouseOptionsByDept(deptId)),
  );
}

function parseNumberText(text: unknown, fieldLabel: string) {
  const result = parseSaleDecimal(text, fieldLabel);
  return result.ok ? { ok: true as const, value: result.value ?? 0 } : result;
}

const summaries = computed(() => ({
  count: tableData.value.reduce(
    (sum, item) => saleDecimalAdd(sum, item.count || 0),
    0,
  ),
  totalPrice: tableData.value.reduce(
    (sum, item) => saleDecimalAdd(sum, item.totalPrice || 0),
    0,
  ),
  taxPrice: 0,
}));

function isPriceItemHidden(field: string) {
  return props.disabled && isSalePriceItemHidden(props.hiddenFields, field);
}

const stockShortages = computed<StockShortage[]>(() => {
  const shortageMap = new Map<string, StockShortage>();
  tableData.value.forEach((item) => {
    if (!item.productId || !item.warehouseId) return;
    const count = Number(item.count ?? (item as any).countText ?? 0);
    if (!Number.isFinite(count) || count <= 0) return;
    const batchNo =
      typeof item.batchNo === 'string' ? item.batchNo.trim() : undefined;
    const key = `${item.productId}-${item.warehouseId}-${batchNo || ''}`;
    const existed = shortageMap.get(key);
    if (existed) {
      existed.requiredCount += count;
      existed.shortageCount = Math.max(
        existed.requiredCount - existed.stockCount,
        0,
      );
      return;
    }
    const stockCount = Number(item.stockCount ?? 0);
    const warehouseName =
      warehouseOptions.value.find(
        (warehouse) => warehouse.id === item.warehouseId,
      )?.name ?? '';
    shortageMap.set(key, {
      batchNo,
      key,
      productId: item.productId,
      productName: item.productName,
      productCode: item.productCode,
      warehouseId: item.warehouseId,
      warehouseName,
      requiredCount: count,
      stockCount,
      shortageCount: Math.max(count - stockCount, 0),
    });
  });
  return [...shortageMap.values()].filter((item) => item.shortageCount > 0);
});

function getStockShortages() {
  return stockShortages.value;
}

function warnStockShortages(shortages = stockShortages.value) {
  if (shortages.length === 0) return;
  message.warning({
    content: `库存不足，不能提交，请修改数量或更换有库存的仓库：\n${buildSaleCartStockShortageText(shortages, 2)}`,
    duration: 5,
  });
}

watch(
  () => [summaries.value.count, summaries.value.totalPrice, props.feeAmount],
  () => {
    emit('update:summary', {
      totalCount: summaries.value.count,
      totalProductPrice: summaries.value.totalPrice,
      totalTaxPrice: 0,
      totalPrice: summaries.value.totalPrice + (props.feeAmount || 0),
    });
  },
  { immediate: true },
);

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
    id: 'erp-sale-cart-item-list-v1',
    autoResize: true,
    border: true,
    fit: true,
    showHeaderOverflow: props.compact ? 'tooltip' : undefined,
    showOverflow: props.compact ? 'tooltip' : undefined,
    rowConfig: { keyField: 'clientRowKey', isHover: true },
    rowClassName: getItemRowClassName,
    checkboxConfig: {
      checkMethod: ({ row }: { row: EditableSaleCartItem }) =>
        canSelectItemRow(row),
    },
    pagerConfig: { enabled: false },
    toolbarConfig: {
      custom: true,
      enabled: true,
      refresh: true,
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
    cellClick: ({ row }: { row: EditableSaleCartItem }) => {
      setActiveItemRow(row);
    },
    currentRowChange: ({ row }: { row?: EditableSaleCartItem }) => {
      setActiveItemRow(row);
    },
    sortChange: handleItemSortChange,
    custom: handleItemColumnCustom,
    checkboxAll: ({ records }: { records: EditableSaleCartItem[] }) => {
      selectedBatchItemRows.value = records.filter(canSelectItemRow);
    },
    checkboxChange: ({ records }: { records: EditableSaleCartItem[] }) => {
      selectedBatchItemRows.value = records.filter(canSelectItemRow);
    },
  },
});

watch(
  () => [props.hiddenFields, props.compact] as const,
  async () => {
    await nextTick();
    await gridApi.grid.reloadColumn(buildCustomizedItemColumns() || []);
    if (activeItemSort.value) {
      await gridApi.grid.setSort(activeItemSort.value);
      await refreshItemGrid();
    }
  },
  { deep: true },
);

watch(
  () => props.itemPageLoading,
  (loading) => {
    gridApi.setGridOptions({ loading });
  },
);

watch(
  () => props.remoteSortLocked,
  async (locked) => {
    if (locked) {
      activeItemSort.value = null;
      await gridApi.grid.clearSort?.();
    }
    await gridApi.grid.reloadColumn(buildCustomizedItemColumns() || []);
  },
);

watch(
  () => props.deptId,
  async (deptId) => {
    if (props.disabled || tableData.value.length === 0) {
      return;
    }
    if (deptId) {
      await loadWarehouseOptionsByDept(deptId);
    }
    let changed = false;
    tableData.value.forEach((item) => {
      if (item.deptId !== deptId) {
        item.deptId = deptId;
        changed = true;
      }
    });
    if (!changed) {
      return;
    }
    emitItemsUpdate(true);
    await nextTick();
    await refreshItemGrid();
  },
);

watch(
  () => [props.customerPriceLevel, props.priceType],
  async () => {
    if (props.suspendPriceAutoRefresh) {
      return;
    }
    await refreshCustomerSalePrices();
  },
);

async function syncItemsFromProps(
  items = props.items,
  options: SyncItemsFromPropsOptions = {},
) {
  if (!items) return;
  if (lastSyncedItemsSource === items) {
    await itemRowsReadyPromise;
    return;
  }
  if (isInternalUpdate) {
    if (!options.force) {
      isInternalUpdate = false;
      return;
    }
    isInternalUpdate = false;
  }

  lastSyncedItemsSource = items;
  const syncRunId = ++itemSyncRunId;
  const nextItems = items.map((item) => ({
    ...item,
  })) as EditableSaleCartItem[];
  nextItems.forEach((item) => {
    initRow(item);
    setCountText(item);
    setProductPriceText(item);
  });

  // 详情为只读展示，先同步接口明细，不让库存、仓库等辅助请求阻塞表格。
  tableData.value.splice(0, tableData.value.length, ...nextItems);
  if (!props.remotePaging) {
    const pageCount = Math.max(
      1,
      Math.ceil(tableData.value.length / localItemPage.value.pageSize),
    );
    if (localItemPage.value.pageNo > pageCount) {
      localItemPage.value.pageNo = pageCount;
    }
  }
  itemRowsReadyPromise = (async () => {
    await nextTick();
    await refreshItemGrid();
  })();

  if (options.refreshAuxiliary === false) {
    return;
  }

  void (async () => {
    try {
      await itemRowsReadyPromise;
    } catch {
      return;
    }
    void hydrateMissingCurrentSelectLabels(tableData.value);
    if (props.disabled || syncRunId !== itemSyncRunId) {
      return;
    }

    await Promise.allSettled([
      loadWarehouseOptionsForRows(nextItems),
      refreshStockCounts(nextItems),
      refreshBatchNoOptions(nextItems),
    ]);
    if (syncRunId !== itemSyncRunId) {
      return;
    }
    await refreshItemGrid();
  })();
}

watch(
  () => props.items,
  (items) => {
    void syncItemsFromProps(items);
  },
  { immediate: true },
);

async function waitForItemsReady() {
  await itemRowsReadyPromise;
}

async function reloadItemsFromProps() {
  await syncItemsFromProps(props.items, { force: true });
  await waitForItemsReady();
}

async function syncRemoteItems(
  items: ErpSaleCartApi.SaleCartItem[],
  options: { refreshAuxiliary?: boolean } = {},
) {
  await syncItemsFromProps(items, {
    force: true,
    refreshAuxiliary: options.refreshAuxiliary,
  });
  await waitForItemsReady();
}

function emitItemsUpdate(skipReload = false) {
  isInternalUpdate = skipReload;
  emit(
    'update:items',
    tableData.value.map((item) => {
      const {
        countText: _countText,
        productPriceText: _productPriceText,
        ...rest
      } = item as any;
      return rest;
    }),
  );
}

function toDraftNumber(value: unknown) {
  const text = String(value ?? '').trim();
  if (!text) {
    return 0;
  }
  const numericValue = Number(text);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

function buildDraftItems() {
  return tableData.value.map((item) => {
    const {
      countText: _countText,
      productPriceText: _productPriceText,
      ...rest
    } = item as any;
    const row = { ...rest } as ErpSaleCartApi.SaleCartItem;
    row.count = toDraftNumber(item.countText ?? item.count);
    row.productPrice = row.giftFlag
      ? 0
      : toDraftNumber(item.productPriceText ?? item.productPrice);
    row.totalPrice =
      saleDecimalMultiply(row.productPrice || 0, row.count || 0) || 0;
    row.taxPrice = 0;
    return row;
  });
}

function buildMergeReadyItems(items: ErpSaleCartApi.SaleCartItem[]) {
  return items.map((item) => {
    const nextItem = { ...item } as EditableSaleCartItem;
    const countText = String(nextItem.countText ?? '').trim();
    const productPriceText = String(nextItem.productPriceText ?? '').trim();
    if (/^\d+(\.\d*)?$/.test(countText)) {
      nextItem.count = Number(countText);
    }
    if (/^\d+(\.\d*)?$/.test(productPriceText)) {
      nextItem.productPrice = Number(productPriceText);
    }
    return nextItem;
  });
}

function getBatchNoOptionKey(row: Record<string, any>) {
  if (!row.productId || !row.warehouseId) {
    return '';
  }
  return `${row.productId}-${row.warehouseId}`;
}

function normalizeBatchNoValue(value: unknown) {
  return String(value ?? '').trim();
}

function mergeCurrentBatchNoOption(
  row: Record<string, any>,
  options: any[] = [],
) {
  const currentBatchNo = normalizeBatchNoValue(row.batchNo);
  if (!currentBatchNo) {
    return options;
  }
  const hasCurrentOption = options.some(
    (item) => normalizeBatchNoValue(item.value) === currentBatchNo,
  );
  if (hasCurrentOption) {
    return options;
  }
  return [
    {
      label: currentBatchNo,
      value: currentBatchNo,
      availableCount: row.stockCount,
    },
    ...options,
  ];
}

function getBatchNoOptions(row: Record<string, any>) {
  const key = getBatchNoOptionKey(row);
  return key
    ? mergeCurrentBatchNoOption(row, batchNoOptionsMap.value[key])
    : [];
}

function filterSelectOption(input: string, option: any) {
  const keyword = input.trim().toLowerCase();
  const label = String(option?.label ?? option?.value ?? '');
  return label.toLowerCase().includes(keyword);
}

async function refreshBatchNoOptions(rows: any | any[]) {
  const rowList = Array.isArray(rows) ? rows : [rows];
  await Promise.all(
    rowList.map(async (row) => {
      if (!isBatchNoEnabled(row.batchNoEnabled)) {
        row.batchNo = undefined;
        return;
      }
      const key = getBatchNoOptionKey(row);
      if (!key) {
        row.batchNo = undefined;
        return;
      }
      const list = await getAvailableBatchNoList({
        bizType: 'sale',
        productId: row.productId,
        warehouseId: row.warehouseId,
      });
      batchNoOptionsMap.value[key] = mergeCurrentBatchNoOption(
        row,
        (list || []).map((item) => ({
          label: item.batchNo,
          value: item.batchNo,
          availableCount: item.availableCount,
          firstInTime: item.firstInTime,
        })),
      );
      const currentBatchNo = normalizeBatchNoValue(row.batchNo);
      const selectedOption = batchNoOptionsMap.value[key].find(
        (item) => normalizeBatchNoValue(item.value) === currentBatchNo,
      );
      if (selectedOption) {
        row.stockCount = Number(selectedOption.availableCount ?? 0);
      }
    }),
  );
}

async function applyMergedItems(
  items: ErpSaleCartApi.SaleCartItem[],
  skipReload = false,
) {
  const mergedItems = mergeSaleCartItems(
    buildMergeReadyItems(items),
  ) as EditableSaleCartItem[];
  tableData.value.splice(0, tableData.value.length, ...mergedItems);
  tableData.value.forEach((item) => {
    initRow(item);
    setCountText(item);
    setProductPriceText(item);
  });
  emitItemsUpdate(skipReload);
  if (skipReload) {
    await nextTick();
    await refreshItemGrid();
  }
  // Batch metadata is auxiliary editor data. A failed lookup must not prevent
  // selected products from being emitted to the form and rendered in the grid.
  await Promise.allSettled([
    refreshBatchNoOptions(tableData.value),
    (async () => {
      await loadWarehouseOptionsForRows(tableData.value);
      await hydrateMissingCurrentSelectLabels(tableData.value);
    })(),
  ]);
}

function handleImport() {
  emit('import');
}

function buildShortcutStockRow(row: EditableSaleCartItem): ErpStockApi.Stock {
  return {
    id: row.id,
    productId: row.productId!,
    warehouseId: row.warehouseId ?? 0,
    deptId: row.warehouseDeptId ?? row.deptId,
    deptName: row.warehouseDeptName,
    count: Number(row.stockCount ?? 0),
    availableCount: Number(row.stockCount ?? 0),
    productCode: row.productCode,
    productName: row.productName,
    productBarCode: row.productBarCode,
    unitId: row.productUnitId,
    unitName: row.productUnitName,
    warehouseName: row.warehouseName,
    batchNo: row.batchNo,
    batchNoEnabled: row.batchNoEnabled,
    brand: row.brand,
    lastSalePrice: row.lastSalePrice,
    originPlace: row.originPlace,
    salePrice: row.salePrice ?? row.productPrice,
    standard: row.standard,
    vehicleModel: row.vehicleModel,
  };
}

async function openSaleShortcutHistory(mode: 'history' | 'order') {
  const row = getActiveItemRow();
  if (!row) {
    return;
  }
  await productSelectRef.value?.openShortcutHistory?.(
    mode,
    buildShortcutStockRow(row),
  );
}

function openProductEdit() {
  const row = getActiveItemRow();
  if (!row) {
    return;
  }
  if (!hasAccessByCodes(['erp:product:update'])) {
    message.warning('没有配件修改权限');
    return;
  }
  if (
    props.deptId &&
    row.warehouseDeptId &&
    props.deptId !== row.warehouseDeptId
  ) {
    message.warning('该商品不属于当前单据部门，不能修改');
    return;
  }
  productFormModalApi.setData({ type: 'edit', id: row.productId }).open();
}

async function handleProductFormSuccess() {
  const row = getActiveItemRow(false);
  if (!row?.productId) {
    return;
  }
  const product = await getProduct(row.productId);
  row.productCode = product.code ?? row.productCode;
  row.productName = product.name ?? row.productName;
  row.productBarCode = product.barCode ?? row.productBarCode;
  row.productUnitId = product.unitId ?? row.productUnitId;
  row.productUnitName = product.unitName ?? row.productUnitName;
  row.weight = product.weight ?? row.weight;
  row.packageQty = product.packageQty ?? row.packageQty;
  row.brand = product.brand ?? row.brand;
  row.vehicleModel = product.vehicleModel ?? row.vehicleModel;
  row.originPlace = product.originPlace ?? row.originPlace;
  row.standard = product.standard ?? row.standard;
  row.batchNoEnabled = isBatchNoEnabled(product.batchNoEnabled);
  handleRowChange(row);
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

function isStockSelectOpen() {
  return productSelectRef.value?.isOpen?.() === true;
}

const SHORTCUT_OVERLAY_SELECTOR =
  '.ant-select-dropdown, .ant-picker-dropdown, .ant-popover';

function isVisibleShortcutOverlay(overlay: Element) {
  if (
    overlay.classList.contains('ant-select-dropdown-hidden') ||
    overlay.classList.contains('ant-picker-dropdown-hidden') ||
    overlay.classList.contains('ant-popover-hidden')
  ) {
    return false;
  }
  if (!(overlay instanceof HTMLElement)) {
    return false;
  }
  const style = window.getComputedStyle(overlay);
  if (
    style.display === 'none' ||
    style.visibility === 'hidden' ||
    style.opacity === '0' ||
    style.pointerEvents === 'none'
  ) {
    return false;
  }
  const rect = overlay.getBoundingClientRect();
  return overlay.offsetParent !== null || rect.width > 0 || rect.height > 0;
}

function isShortcutOverlayTarget(target: EventTarget | null) {
  const element = target instanceof HTMLElement ? target : null;
  const targetOverlay = element?.closest?.(SHORTCUT_OVERLAY_SELECTOR);
  if (targetOverlay && isVisibleShortcutOverlay(targetOverlay)) {
    return true;
  }
  return Boolean(
    [...document.querySelectorAll(SHORTCUT_OVERLAY_SELECTOR)].some(
      isVisibleShortcutOverlay,
    ),
  );
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

  if (isPriceReferenceShortcut(event)) {
    if (
      shouldIgnorePriceReferenceShortcut(event) ||
      isStockSelectOpen() ||
      isShortcutDialogOpen() ||
      isShortcutOverlayTarget(event.target)
    ) {
      return;
    }
    event.preventDefault();
    priceReferenceOpen.value = !priceReferenceOpen.value;
    return;
  }

  if (!props.disabled && !event.shiftKey && isCreateShortcutKey(event)) {
    if (
      inlineStockSelectorOpen.value ||
      isStockSelectOpen() ||
      isShortcutDialogOpen() ||
      isShortcutOverlayTarget(event.target)
    ) {
      return;
    }
    event.preventDefault();
    void handleAddBlankItemRow();
    return;
  }

  if (
    isEditableEnterTarget(event.target) ||
    isStockSelectOpen() ||
    isShortcutDialogOpen()
  ) {
    return;
  }

  const key = event.key.toLowerCase();
  if (isQuoteOrderHistoryShiftKey(event)) {
    pendingQuoteOrderHistoryShift = true;
    return;
  }
  if (event.key === ' ' || event.code === 'Space') {
    event.preventDefault();
    void openSaleShortcutHistory('history');
    return;
  }
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
  if (key === 'f' && canEditProduct.value) {
    event.preventDefault();
    openProductEdit();
  }
}

function handleShortcutKeyup(event: KeyboardEvent) {
  if (!isSaleShortcutOwnerActive(itemTableWrapRef.value)) {
    pendingQuoteOrderHistoryShift = false;
    return;
  }
  if (!pendingQuoteOrderHistoryShift) {
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
    isStockSelectOpen() ||
    isShortcutDialogOpen()
  ) {
    return;
  }
  event.preventDefault();
  void openSaleShortcutHistory('order');
}

function pickProductPrice(
  p: ErpStockApi.Stock | Record<string, any>,
  priceType?: string,
  priceLevel = props.customerPriceLevel,
): number {
  const customerPrice = pickCustomerLevelPrice(p, priceLevel);
  if (customerPrice !== undefined) {
    return customerPrice;
  }
  switch (priceType) {
    case '参考价': {
      return firstNumericPrice(p.referencePrice);
    }
    case '备用价': {
      return firstNumericPrice(p.backupPrice1);
    }
    case '批发价': {
      return firstNumericPrice(p.wholesalePrice);
    }
    case '零售价': {
      return firstNumericPrice(p.retailPrice);
    }
    default: {
      return firstNumericPrice(p.salePrice, p.retailPrice, p.referencePrice);
    }
  }
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

async function refreshCustomerSalePrices() {
  if (props.disabled || tableData.value.length === 0) {
    return;
  }
  await Promise.all(
    tableData.value.map(async (row) => {
      if (!row.productId) {
        return;
      }
      const product = await getProduct(row.productId);
      const salePrice = pickProductPrice(
        {
          ...row,
          ...product,
          productPurchasePrice: product.purchasePrice,
        },
        props.priceType,
      );
      row.salePrice = salePrice;
      row.productPrice = row.giftFlag ? 0 : salePrice;
      setProductPriceText(row);
      initRow(row);
    }),
  );
  await nextTick();
  await refreshItemGrid();
  emitItemsUpdate(true);
}

function getProductInputValue(row: EditableSaleCartItem) {
  const keyword = (row as any).__stockKeyword;
  return keyword === undefined || keyword === null
    ? row.productName || ''
    : String(keyword);
}

function handleProductKeywordInput(row: EditableSaleCartItem, value: string) {
  (row as any).__stockKeyword = value;
}

function escapeAttrValue(value: string) {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

function focusProductNameInput(row: EditableSaleCartItem) {
  if (props.disabled) {
    return false;
  }
  const rowKey = getItemRowKey(row);
  const selector = rowKey
    ? `${SALE_CART_PRODUCT_SELECT_INPUT_SELECTOR}[data-erp-inline-stock-row-key="${escapeAttrValue(rowKey)}"]`
    : SALE_CART_PRODUCT_SELECT_INPUT_SELECTOR;
  return focusFirstEditableInput(itemTableWrapRef.value, selector);
}

function createBlankItemRow() {
  const row = {
    count: 1,
    giftFlag: false,
    remark: '',
  } as EditableSaleCartItem;
  initRow(row);
  setCountText(row);
  setProductPriceText(row);
  return row;
}

const itemRowFocusController = createErpItemRowFocusController({
  focusField: (row: EditableSaleCartItem, field) =>
    field === 'product' ? focusProductNameInput(row) : focusItemCountInput(row),
  getAllRows: () => tableData.value,
  getDisplayedRows: getDisplayedItems,
  getGrid: () => gridApi.grid as any,
  getLocalPage: () => localItemPage.value,
  getRowKey: getItemRowKey,
  isDisabled: () => props.disabled,
  isRemotePaging: () => props.remotePaging,
  refreshGrid: () => refreshItemGrid(),
  setActiveRow: setActiveItemRow,
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
    emit('remoteBlankRowAdded', row);
    return;
  }
  tableData.value = [...tableData.value, row];
  emitItemsUpdate(false);
  await itemRowFocusController.focus(row, 'product');
}

function buildSaleCartItemFromStock(p: ErpStockApi.Stock) {
  const warehouseId = p.warehouseId;
  const salePrice = pickProductPrice(p, props.priceType);
  const batchNo = normalizeBatchNoValue(p.batchNo) || undefined;
  const batchNoEnabled = isBatchNoEnabled(p.batchNoEnabled) || !!batchNo;
  const row: any = {
    id: undefined,
    productId: p.productId,
    productCode: p.productCode,
    productName: p.productName,
    productBarCode: p.productBarCode,
    productUnitId: p.unitId,
    productUnitName: p.unitName,
    weight: p.weight,
    packageQty: p.packageQty,
    warehouseId,
    warehouseName: p.warehouseName,
    warehouseDeptId: p.deptId,
    warehouseDeptName: p.deptName,
    deptId: props.deptId,
    productPurchasePrice: p.purchasePrice ?? p.productPurchasePrice,
    salePrice,
    lastSalePrice: p.lastSalePrice,
    minPrice: p.minPrice,
    referencePrice: p.referencePrice,
    retailPrice: p.retailPrice,
    lastPurchasePrice: p.lastPurchasePrice,
    grossProfitRate: p.grossProfitRate,
    backupPrice1: p.backupPrice1,
    wholesalePrice: p.wholesalePrice,
    sharePrice: p.sharePrice,
    priceVisible: p.priceVisible,
    productPrice: salePrice,
    stockCount: p.availableCount ?? p.count ?? 0,
    count: 1,
    giftFlag: false,
    batchNo,
    batchNoEnabled,
    brand: p.brand,
    vehicleModel: p.vehicleModel,
    originPlace: p.originPlace,
    standard: p.standard,
  };
  initRow(row);
  setCountText(row);
  setProductPriceText(row);
  return row as EditableSaleCartItem;
}

async function insertStockProducts(
  products: ErpStockApi.Stock[],
  options: {
    targetRow?: EditableSaleCartItem;
  } = {},
) {
  if (!products || products.length === 0) return;
  const selectedRows = products.map(buildSaleCartItemFromStock);
  const targetRowKey = getItemRowKey(options.targetRow);
  const targetIndex = targetRowKey
    ? tableData.value.findIndex((item) => getItemRowKey(item) === targetRowKey)
    : -1;
  const [firstSelectedRow, ...additionalRows] = selectedRows;
  const replacementRow =
    targetIndex >= 0 && options.targetRow
      ? ({
          ...firstSelectedRow!,
          cartId: (options.targetRow as any).cartId,
          cartNo: (options.targetRow as any).cartNo,
          clientRowKey: options.targetRow.clientRowKey,
          id: options.targetRow.id,
          seq: options.targetRow.seq ?? firstSelectedRow?.seq,
        } as EditableSaleCartItem)
      : undefined;
  if (props.remotePaging) {
    emit('remoteStockSelectionRequested', {
      appendedItems: replacementRow ? additionalRows : selectedRows,
      replacementItem: replacementRow,
      targetRowKey,
    });
    return;
  }
  let nextItems: EditableSaleCartItem[];
  let activeRow: EditableSaleCartItem;
  if (replacementRow) {
    nextItems = [
      ...tableData.value.slice(0, targetIndex),
      replacementRow,
      ...tableData.value.slice(targetIndex + 1),
      ...additionalRows,
    ];
    activeRow = replacementRow;
  } else {
    nextItems = [...tableData.value, ...selectedRows];
    activeRow = selectedRows[0]!;
  }
  await applyMergedItems(nextItems, true);
  await nextTick();
  warnStockShortages();
  const mergedActiveRow = tableData.value.find(
    (item) => getItemRowKey(item) === getItemRowKey(activeRow),
  );
  const focusRow = mergedActiveRow || activeRow;
  setActiveItemRow(focusRow);
  await itemRowFocusController.focus(focusRow, 'count');
}

function handleInlineStockSelected(
  targetRow: EditableSaleCartItem,
  rows: ErpStockApi.Stock[],
) {
  void insertStockProducts(rows, {
    targetRow,
  });
}

function handleInlineStockOpenChange(open: boolean) {
  inlineStockSelectorOpen.value = open;
}

function handleProductsSelected(products: ErpStockApi.Stock[]) {
  void insertStockProducts(products);
}

function focusFirstItemCountInput() {
  if (props.disabled) {
    return false;
  }
  return focusFirstEditableInput(
    itemTableWrapRef.value,
    SALE_CART_ITEM_COUNT_INPUT_SELECTOR,
  );
}

function focusItemCountInput(row: EditableSaleCartItem) {
  return focusEditableInputByRowKey(
    itemTableWrapRef.value,
    SALE_CART_ITEM_COUNT_INPUT_SELECTOR,
    getItemRowKey(row),
  );
}

function handleItemInputPressEnter(event: KeyboardEvent) {
  const enterFocusResult = focusNextInputOnEnter(event);
  if (enterFocusResult === 'last-input') {
    emit('request-submit', event);
  }
}

async function handleBatchNoChange(row: any) {
  const selectedOption = getBatchNoOptions(row).find(
    (item) => item.value === row.batchNo,
  );
  row.stockCount = selectedOption
    ? Number(selectedOption.availableCount ?? 0)
    : row.productId && row.warehouseId
      ? (await getStockCount(row.productId, row.warehouseId, 'sale')) || 0
      : 0;
  await applyMergedItems(tableData.value, true);
  await nextTick();
  warnStockShortages();
}

async function refreshStockCounts(items: ErpSaleCartApi.SaleCartItem[]) {
  await Promise.all(
    items.map(async (item: any) => {
      item.stockCount =
        item.productId && item.warehouseId
          ? (await getStockCount(item.productId, item.warehouseId, 'sale')) || 0
          : 0;
    }),
  );
}

function handleDelete(row: any) {
  deleteItemRows([row]);
}

function deleteItemRows(rows: EditableSaleCartItem[]) {
  const deleteKeys = new Set(
    rows.map((row) => getItemRowKey(row)).filter(Boolean),
  );
  if (deleteKeys.size === 0) {
    return;
  }
  tableData.value = tableData.value.filter(
    (item) => !deleteKeys.has(getItemRowKey(item)),
  );
  if (activeItemRowKey.value && deleteKeys.has(activeItemRowKey.value)) {
    activeItemRowKey.value = undefined;
  }
  if (!props.remotePaging) {
    localItemPage.value.pageNo = Math.max(
      1,
      Math.ceil(tableData.value.length / localItemPage.value.pageSize),
    );
  }
  clearBatchItemSelection();
  emitItemsUpdate(false);
  if (props.remotePaging) {
    emit('remoteRowsDeleted');
  }
  void refreshItemGrid();
}

function handleBatchDeleteItems() {
  const rows = selectedDeleteItemRows.value;
  if (rows.length === 0) {
    message.warning('请先勾选要删除的销售手推车明细');
    return;
  }
  Modal.confirm({
    cancelText: '取消',
    content: '删除后将从当前销售手推车明细中移除这些行。',
    okText: '删除',
    okType: 'danger',
    title: `确认删除已选 ${rows.length} 条销售手推车明细吗？`,
    onOk: () => {
      deleteItemRows(rows);
    },
  });
}

function handleRowChange(row: any) {
  initRow(row);
  setCountText(row);
  setProductPriceText(row);
  const index = tableData.value.findIndex(
    (item: any) => getItemRowKey(item) === getItemRowKey(row),
  );
  if (index === -1) {
    tableData.value.push(row);
    emitItemsUpdate(false);
    void nextTick(refreshItemGrid);
    return;
  } else {
    tableData.value[index] = row;
    emitItemsUpdate(true);
  }
  if (activeItemSort.value) {
    void nextTick(refreshItemGrid);
  }
}

function handleGiftFlagChange(row: any) {
  initRow(row);
  setProductPriceText(row);
  handleRowChange(row);
}

function initRow(row: any) {
  itemRowKeyManager.ensureRowKey(row);
  if (!row.seq)
    row.seq = row.id || `${row.productId || 'new'}-${Math.random()}`;
  row.batchNoEnabled = isBatchNoEnabled(row.batchNoEnabled);
  if (!row.batchNoEnabled) {
    row.batchNo = undefined;
  }
  row.giftFlag = row.giftFlag === true;
  if (row.giftFlag) {
    row.productPrice = 0;
    row.totalPrice = 0;
    row.taxPrice = 0;
    return;
  }
  row.totalPrice =
    saleDecimalMultiply(row.productPrice || 0, row.count || 0) || 0;
  row.taxPrice = 0;
}

function handleCountBlur(row: any) {
  const parsed = parseNumberText(row.countText, '数量');
  if (!parsed.ok) {
    message.warning(parsed.message);
    setCountText(row);
    return;
  }
  row.count = parsed.value;
  if (row.count <= 0) {
    message.warning('数量必须大于0');
    row.count = 1;
  }
  handleRowChange(row);
  nextTick(() => warnStockShortages());
}

function handleProductPriceBlur(row: any) {
  if (row.giftFlag) {
    row.productPrice = 0;
    setProductPriceText(row);
    handleRowChange(row);
    return;
  }
  const parsed = parseNumberText(row.productPriceText, '单价');
  if (!parsed.ok) {
    message.warning(parsed.message);
    setProductPriceText(row);
    return;
  }
  row.productPrice = parsed.value;
  if (row.productPrice <= 0) {
    message.warning('单价必须大于0');
    row.productPrice = 1;
  }
  handleRowChange(row);
}

function validate(
  items = tableData.value,
  options: { requireItems?: boolean } = {},
) {
  if ((options.requireItems ?? true) && items.length === 0) {
    throw new Error('请先添加销售手推车产品');
  }
  items.forEach((item, index) => {
    if (!item.productId) throw new Error(`第 ${index + 1} 行：产品不能为空`);
    if (!item.deptId) throw new Error(`第 ${index + 1} 行：销售部门不能为空`);
    if (!item.warehouseId) throw new Error(`第 ${index + 1} 行：仓库不能为空`);

    const countParsed = parseNumberText(
      (item as any).countText ?? item.count,
      '数量',
    );
    if (!countParsed.ok) {
      throw new Error(`第 ${index + 1} 行：${countParsed.message}`);
    }
    item.count = countParsed.value;

    item.giftFlag = item.giftFlag === true;
    if (item.giftFlag) {
      item.productPrice = 0;
      setProductPriceText(item);
    } else {
      const productPriceParsed = parseNumberText(
        (item as any).productPriceText ?? item.productPrice,
        '单价',
      );
      if (!productPriceParsed.ok) {
        throw new Error(`第 ${index + 1} 行：${productPriceParsed.message}`);
      }
      item.productPrice = productPriceParsed.value;
    }

    if (!item.count || item.count <= 0) {
      throw new Error(`第 ${index + 1} 行：产品数量必须大于 0`);
    }
    if (!item.giftFlag && (!item.productPrice || item.productPrice <= 0)) {
      throw new Error(`第 ${index + 1} 行：产品单价必须大于 0`);
    }
  });
}

async function clearRemoteItemSort() {
  activeItemSort.value = null;
  await gridApi.grid.clearSort?.();
}

async function restoreRemoteItemSort(
  field?: string,
  order?: SaleCartItemSortOrder,
) {
  activeItemSort.value = field && order ? { field, order } : null;
  if (activeItemSort.value) {
    await gridApi.grid.setSort(activeItemSort.value);
    return;
  }
  await gridApi.grid.clearSort?.();
}

async function focusRemoteItemByKey(
  rowKey: string,
  field: 'count' | 'product' = 'count',
  refreshGrid = true,
) {
  const row = tableData.value.find((item) => getItemRowKey(item) === rowKey);
  if (!row) return false;
  setActiveItemRow(row);
  if (refreshGrid) {
    return itemRowFocusController.focus(row, field);
  }
  await nextTick();
  gridApi.grid.setCurrentRow?.(row);
  void gridApi.grid.scrollToRow?.(row);
  return field === 'product'
    ? focusProductNameInput(row)
    : focusItemCountInput(row);
}

defineExpose({
  clearRemoteItemSort,
  focusFirstItemCountInput,
  focusRemoteItemByKey,
  getDraftItems: buildDraftItems,
  getStockShortages,
  reloadItemsFromProps,
  restoreRemoteItemSort,
  syncRemoteItems,
  validate,
  waitForItemsReady,
  warnStockShortages,
});

onMounted(async () => {
  isShortcutScopeActive = true;
  syncShortcutListening();
  await loadOrderPriceCustomFieldNames();
  // Vben VXE Grid 会在子组件挂载后的 nextTick 再合并初始化配置。
  // 等它完成后重新同步一次，避免初始化时的空数据覆盖详情明细。
  await nextTick();
  await refreshItemGrid();
  if (props.disabled) {
    return;
  }
  tableData.value.forEach((row) => {
    if (
      row.warehouseId &&
      !isMissingDisplayName(row.warehouseName, row.warehouseId)
    ) {
      warehouseOptions.value = mergeOptionsById(warehouseOptions.value, [
        {
          id: row.warehouseId,
          name: row.warehouseName,
          deptId: row.warehouseDeptId,
          deptName: row.warehouseDeptName,
        },
      ]);
    }
    if (row.deptId) {
      deptOptions.value = mergeOptionsById(
        deptOptions.value,
        getCurrentDeptOption(row),
      );
    }
  });
  await loadWarehouseOptionsForRows(tableData.value);
  void hydrateMissingCurrentSelectLabels(tableData.value);
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
});
</script>

<template>
  <div class="sale-cart-item-grid-shell relative w-full">
    <div
      ref="itemTableWrapRef"
      class="sale-cart-item-table-wrap relative"
      tabindex="-1"
      @click="focusSaleShortcutOwner(itemTableWrapRef, $event.target)"
    >
      <Grid class="sale-cart-item-grid w-full">
        <template #toolbar-buttons>
          <div class="sale-cart-item-toolbar-left">
            <div class="sale-cart-item-shortcut-hint">
              <span class="sale-cart-item-shortcut-hint__label"
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
              <span v-if="canEditProduct"><kbd>F</kbd><b>修改商品</b></span>
              <template v-if="!disabled">
                <span><kbd>Insert</kbd><b>新增行</b></span>
              </template>
              <span class="sale-cart-item-shortcut-hint__divider"></span>
              <span
                ><span class="sale-cart-item-shortcut-hint__label">当前页</span
                ><kbd>W</kbd><b>全部价格</b></span
              >
            </div>
            <div
              v-if="canShowItemSelection"
              class="sale-document-item-batch-summary"
            >
              已选 {{ selectedItemCount }} 条 / 可改
              {{ batchEditableItemCount }} 条
            </div>
          </div>
        </template>
        <template #toolbar-tools>
          <div class="sale-cart-item-toolbar flex items-center gap-2">
            <Button
              v-if="!disabled"
              type="primary"
              @click="handleAddBlankItemRow"
            >
              新增行
            </Button>
            <Button
              v-if="!disabled && canShowItemSelection"
              danger
              :disabled="selectedDeleteItemCount === 0"
              @click="handleBatchDeleteItems"
            >
              批量删除
            </Button>
            <Button
              v-if="canShowBatchAdjustPrice"
              type="primary"
              :disabled="selectedBatchItemCount === 0"
              @click="handleOpenBatchAdjustPrice"
            >
              批量调整价格
            </Button>
            <Button v-if="!disabled" @click="handleImport">导入</Button>
          </div>
        </template>
        <template #productId="{ row }">
          <ErpInlineStockSelect
            candidate-focus-highlight
            settings-scope="sale-cart"
            v-if="!disabled"
            :value="getProductInputValue(row)"
            :row="row"
            :row-key="getItemRowKey(row)"
            :dept-id="props.deptId"
            :filter-by-dept="false"
            :hidden-fields="props.hiddenFields"
            :stock-page-api="getSaleStockPage"
            :stock-page-params="getInlineStockPageParams()"
            require-dept-message="请先选择客户及所属部门，再选择销售库存"
            @open-change="handleInlineStockOpenChange"
            @select="(stocks) => handleInlineStockSelected(row, stocks)"
            @update:value="(value) => handleProductKeywordInput(row, value)"
          />
          <div
            v-else
            class="flex flex-col leading-tight"
            :title="row.productName || ''"
          >
            <div class="flex flex-wrap items-center gap-1">
              <span>{{ row.productName || '-' }}</span>
              <Tag v-if="isCrossDeptWarehouse(row)" color="orange" class="m-0">
                跨部门
              </Tag>
            </div>
          </div>
        </template>
        <template #warehouseId="{ row }">
          <span :title="getReadonlyWarehouseName(row)">
            {{ getReadonlyWarehouseName(row) }}
          </span>
        </template>
        <template #warehouseDeptName="{ row }">
          <span :title="getReadonlyWarehouseDeptName(row)">
            {{ getReadonlyWarehouseDeptName(row) }}
          </span>
        </template>
        <template #deptId="{ row }">
          <span :title="getCurrentDeptDisplayName(row)">
            {{ getCurrentDeptDisplayName(row) }}
          </span>
        </template>
        <template #count="{ row }">
          <Input
            v-if="!disabled"
            v-model:value="row.countText"
            inputmode="decimal"
            autocomplete="off"
            :data-erp-item-row-key="getItemRowKey(row)"
            data-sale-cart-count-input="true"
            @focus="setActiveItemRow(row)"
            @press-enter="handleItemInputPressEnter"
            @blur="handleCountBlur(row)"
          />
          <span v-else>{{ formatSaleDecimal(row.count, '-') }}</span>
        </template>
        <template #productPrice="{ row }">
          <Input
            v-if="!disabled"
            v-model:value="row.productPriceText"
            :disabled="row.giftFlag"
            inputmode="decimal"
            autocomplete="off"
            @press-enter="handleItemInputPressEnter"
            @blur="handleProductPriceBlur(row)"
          />
          <span v-else>{{
            formatSaleAmount(row.productPrice, '-')
          }}</span>
        </template>
        <template #giftFlag="{ row }">
          <Checkbox
            v-if="!disabled"
            v-model:checked="row.giftFlag"
            @change="handleGiftFlagChange(row)"
          />
          <Checkbox v-else :checked="!!row.giftFlag" disabled />
        </template>
        <template #batchNo="{ row }">
          <Select
            v-if="!disabled"
            v-model:value="row.batchNo"
            :options="getBatchNoOptions(row)"
            :disabled="
              !isBatchNoEnabled(row.batchNoEnabled) ||
              !row.productId ||
              !row.warehouseId
            "
            allow-clear
            show-search
            :filter-option="filterSelectOption"
            popup-class-name="sale-cart-item-select-dropdown erp-candidate-focus-popup"
            class="w-full"
            @change="handleBatchNoChange(row)"
          />
          <span v-else :title="row.batchNo || ''">{{
            row.batchNo || '-'
          }}</span>
        </template>
        <template #brand="{ row }">
          <span :title="row.brand || ''">{{ row.brand || '-' }}</span>
        </template>
        <template #vehicleModel="{ row }">
          <span :title="row.vehicleModel || ''">
            {{ row.vehicleModel || '-' }}
          </span>
        </template>
        <template #originPlace="{ row }">
          <span :title="row.originPlace || ''">
            {{ row.originPlace || '-' }}
          </span>
        </template>
        <template #standard="{ row }">
          <span :title="row.standard || ''">{{ row.standard || '-' }}</span>
        </template>
        <template #remark="{ row }">
          <Input
            v-if="!disabled"
            v-model:value="row.remark"
            @press-enter="handleItemInputPressEnter"
            @change="handleRowChange(row)"
          />
          <span v-else :title="row.remark || ''">{{ row.remark || '-' }}</span>
        </template>
        <template #actions="{ row }">
          <TableAction
            :actions="[
              {
                label: '删除',
                type: 'link',
                danger: true,
                icon: ACTION_ICON.DELETE,
                popConfirm: {
                  title: '确认删除该产品吗？',
                  confirm: () => handleDelete(row),
                },
              },
            ]"
          />
        </template>
        <template #bottom>
          <div
            v-if="!compact"
            class="mt-2 rounded border border-border bg-muted p-2"
          >
            <div class="flex justify-between text-sm text-muted-foreground">
              <span class="font-medium text-foreground">
                {{ props.remotePaging ? '本页合计：' : '合计：' }}
              </span>
              <div class="flex gap-4">
                <span>数量：{{ formatSaleDecimal(summaries.count) }}</span>
                <span>
                  金额：{{
                    isPriceItemHidden('totalPrice')
                      ? '****'
                      : formatSaleAmount(summaries.totalPrice)
                  }}
                </span>
              </div>
            </div>
          </div>
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
    <VbenLoading
      :min-loading-time="0"
      :spinning="itemSortMaskVisible"
      text="明细排序中，请稍候..."
    />
  </div>
  <div v-if="showItemPager" class="sale-cart-item-pager">
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
  <BatchAdjustPriceModal @success="handleBatchAdjustPriceSuccess" />
  <SaleStockProductSelectModal
    candidate-focus-highlight
    ref="productSelectRef"
    all-sale-product-permission="erp:sale-cart:all-product"
    enable-sale-stock-shortcuts
    :hidden-fields="hiddenFields"
    :sale-dept-id="deptId"
    show-batch-no
    :customer-price-level="customerPriceLevel"
    @success="handleProductsSelected"
  />
  <ProductFormModal @success="handleProductFormSuccess" />
  <PurchaseItemDetailShortcuts
    ref="purchaseShortcutsRef"
    :active-row="activeShortcutItemRow"
    :dept-id="deptId"
    :history-enabled="false"
    :product-edit-enabled="false"
    warning-message="请先点击一条有商品的手推车明细"
  />
</template>

<style scoped>
.sale-cart-item-toolbar :deep(.ant-btn) {
  height: 28px;
  padding: 2px 10px;
  font-size: 12px;
  line-height: 20px;
}

.sale-cart-item-toolbar :deep(.ant-btn span) {
  font-size: 12px;
}

.sale-cart-item-toolbar-left {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  gap: 6px 12px;
  align-items: center;
  min-width: 0;
}

.sale-document-item-batch-summary {
  min-width: 0;
  font-size: 12px;
  color: #475569;
}

.sale-cart-item-grid :deep(.ant-input),
.sale-cart-item-grid :deep(.ant-select),
.sale-cart-item-grid :deep(.ant-select-selector),
.sale-cart-item-grid :deep(.ant-select-selection-item),
.sale-cart-item-grid :deep(.ant-select-selection-placeholder),
.sale-cart-item-grid :deep(.ant-select-selection-search-input) {
  font-size: 11px;
}

.sale-cart-item-grid :deep(.vxe-header--column.is--sortable .vxe-cell--title) {
  color: #1677ff;
}

.sale-cart-item-grid :deep(.vxe-header--column .vxe-cell--sort) {
  display: none;
}

.sale-cart-item-shortcut-hint {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  min-width: 0;
  font-size: 12px;
  color: #334155;
}

.sale-cart-item-shortcut-hint__label {
  color: #64748b;
}

.sale-cart-item-shortcut-hint span:not(.sale-cart-item-shortcut-hint__label) {
  display: inline-flex;
  gap: 5px;
  align-items: center;
  min-height: 26px;
  padding: 2px 8px;
  background: #f8fafc;
  border: 1px solid #d8e0ea;
  border-radius: 4px;
}

.sale-cart-item-shortcut-hint b {
  font-weight: 600;
}

.sale-cart-item-shortcut-hint kbd {
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

.sale-cart-item-grid :deep(.sale-cart-item-row--active td) {
  background-color: rgba(22, 119, 255, 0.1) !important;
}

.sale-cart-item-grid :deep(.sale-cart-item-row--active td:first-child) {
  box-shadow: inset 3px 0 0 #1677ff;
}

.sale-cart-item-grid :deep(.sale-cart-item-row--active:hover td) {
  background-color: rgba(22, 119, 255, 0.16) !important;
}

:global(.sale-cart-item-select-dropdown .ant-select-item),
:global(.sale-cart-item-select-dropdown .ant-select-tree),
:global(.sale-cart-item-select-dropdown .ant-empty-description) {
  font-size: 11px;
}

.sale-cart-item-pager {
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
}

.sale-cart-item-pager :deep(.ant-pagination),
.sale-cart-item-pager :deep(.ant-pagination-item),
.sale-cart-item-pager :deep(.ant-pagination-total-text),
.sale-cart-item-pager :deep(.ant-pagination-options),
.sale-cart-item-pager :deep(.ant-select),
.sale-cart-item-pager :deep(.ant-input) {
  font-size: 11px;
}

.sale-cart-item-pager :deep(.ant-pagination-item),
.sale-cart-item-pager :deep(.ant-pagination-prev),
.sale-cart-item-pager :deep(.ant-pagination-next),
.sale-cart-item-pager :deep(.ant-pagination-jump-prev),
.sale-cart-item-pager :deep(.ant-pagination-jump-next) {
  min-width: 24px;
  height: 24px;
  line-height: 22px;
}

.sale-cart-item-pager :deep(.ant-pagination-item a),
.sale-cart-item-pager :deep(.ant-pagination-prev button),
.sale-cart-item-pager :deep(.ant-pagination-next button) {
  height: 22px;
  font-size: 11px;
  line-height: 22px;
}

.sale-cart-item-pager :deep(.ant-pagination-options-size-changer),
.sale-cart-item-pager :deep(.ant-select-single),
.sale-cart-item-pager :deep(.ant-select-selector) {
  height: 24px;
  line-height: 22px;
}

.sale-cart-item-pager
  :deep(.ant-pagination-options-size-changer .ant-select-selector) {
  box-sizing: border-box;
  align-items: center;
  min-height: 24px;
  padding: 0 24px 0 8px;
}

.sale-cart-item-pager
  :deep(.ant-select-single .ant-select-selector .ant-select-selection-item) {
  height: 22px;
  font-size: 11px;
  line-height: 22px;
}

.sale-cart-item-pager :deep(.ant-select-arrow) {
  margin-top: -5px;
  font-size: 10px;
}

.sale-cart-item-pager :deep(.ant-pagination-options-quick-jumper input) {
  height: 24px;
  padding: 0 7px;
  font-size: 11px;
  line-height: 22px;
}
</style>
