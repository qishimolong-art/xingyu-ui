<script lang="ts" setup>
import { CANDIDATE_FOCUS_KEY } from '#/views/erp/utils/candidate-focus';

import type { SaleQuoteItemSortOrder } from './sale-quote-item-sort';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpSaleQuoteApi } from '#/api/erp/sale/quote';
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
import { batchUpdateSaleQuoteItems } from '#/api/erp/sale/quote';
import {
  getAvailableBatchNoList,
  getSaleStockPage,
  getStockCount,
} from '#/api/erp/stock/stock';
import { getWarehouse } from '#/api/erp/stock/warehouse';
import { getDept } from '#/api/system/dept';
import ErpInlineStockSelect from '#/views/erp/components/ErpInlineStockSelect.vue';
import ItemPriceReferenceOverlay from '#/views/erp/components/ItemPriceReferenceOverlay.vue';
import ProductForm from '#/views/erp/product/product/modules/form.vue';
import PurchaseItemDetailShortcuts from '#/views/erp/purchase/components/PurchaseItemDetailShortcuts.vue';
import SaleBatchAdjustPriceForm from '#/views/erp/sale/components/sale-batch-adjust-price-form.vue';
import {
  formatSaleAmount,
  formatSaleDecimal,
  parseSaleDecimal,
  saleDecimalAdd,
  saleDecimalMultiply,
} from '#/views/erp/sale/utils/decimal';
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
import {
  buildErpItemDuplicateKey,
  isBatchNoEnabled,
} from '#/views/erp/utils/item';
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
import { sortSaleQuoteItems } from './sale-quote-item-sort';

provide(CANDIDATE_FOCUS_KEY, ref(true));

const itemRowKeyManager = createSaleItemClientRowKeyManager('sale-quote-item');

interface Props {
  compact?: boolean;
  items?: ErpSaleQuoteApi.SaleQuoteItem[];
  disabled?: boolean;
  feeAmount?: number;
  hiddenFields?: string[];
  mainDeptId?: number;
  customerPriceLevel?: number;
  documentId?: number;
  enableBatchEdit?: boolean;
  itemPageLoading?: boolean;
  itemPagination?: SaleDocumentItemPagination;
  priceType?: string;
  remotePaging?: boolean;
  shortcutActive?: boolean;
  suspendPriceAutoRefresh?: boolean;
}

type EditableSaleQuoteItem = ErpSaleQuoteApi.SaleQuoteItem & {
  countTextDirty?: boolean;
  countText?: string;
  productPriceTextDirty?: boolean;
  productPriceText?: string;
};

interface BatchUpdateItemsPayload {
  mode?: 'local' | 'server';
  priceLevel?: number;
}

type ApplyBatchUpdateItemsOptions = {
  showMessage?: boolean;
  validateDuplicate?: boolean;
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
const SALE_QUOTE_ALL_PRODUCT_PERMISSION = 'erp:sale-quote:all-product';

const props = withDefaults(defineProps<Props>(), {
  compact: false,
  items: () => [],
  disabled: false,
  feeAmount: 0,
  hiddenFields: () => [],
  mainDeptId: undefined,
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
]);
const SALE_QUOTE_ITEM_COUNT_INPUT_SELECTOR =
  '[data-sale-quote-count-input="true"]';
const SALE_QUOTE_PRODUCT_SELECT_INPUT_SELECTOR =
  '[data-erp-inline-stock-select-input="true"]';
const tableData = ref<EditableSaleQuoteItem[]>([]);
const warehouseOptions = ref<any[]>([]);
const deptOptions = ref<any[]>([]);
const batchNoOptionsMap = ref<Record<string, any[]>>({});
const productSelectRef =
  ref<InstanceType<typeof SaleStockProductSelectModal>>();
const purchaseShortcutsRef =
  ref<InstanceType<typeof PurchaseItemDetailShortcuts>>();
const inlineStockSelectorOpen = ref(false);
const activeItemRowKey = ref<string>();
const activeItemSort = ref<null | {
  field: string;
  order: SaleQuoteItemSortOrder;
}>(null);
const localItemPage = ref({ pageNo: 1, pageSize: DEFAULT_ITEM_PAGE_SIZE });
const selectedBatchItemRows = ref<ErpSaleQuoteApi.SaleQuoteItem[]>([]);
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
let itemSyncRunId = 0;
let itemSortRunId = 0;
let itemSelectLabelHydrateSequence = 0;
const itemSortMaskVisible = ref(false);
const DUPLICATE_KEY_OPTIONS = {
  batchField: 'batchNo',
  giftField: 'giftFlag',
} as const;
const ITEM_SORT_MASK_MIN_DURATION = 220;
function getAllSaleProductWarehouseParams() {
  return hasAccessByCodes([SALE_QUOTE_ALL_PRODUCT_PERMISSION])
    ? {
        allSaleProduct: true,
        allSaleProductPermission: SALE_QUOTE_ALL_PRODUCT_PERMISSION,
      }
    : undefined;
}

function getInlineStockPageParams() {
  return {
    ...getAllSaleProductWarehouseParams(),
    saleDeptId: props.mainDeptId,
    showBatchNo: true,
  };
}

function mergeOptionsById(oldOptions: any[], nextOptions: any[]) {
  return mergeResolvedOptionsById(oldOptions, nextOptions);
}

function handleDeptOptionsChange(options: any[]) {
  deptOptions.value = mergeOptionsById(deptOptions.value, options);
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
  props.documentId ? ['erp:sale-quote:update'] : ['erp:sale-quote:create'],
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
      : sortSaleQuoteItems(
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

function getItemRowKey(row?: ErpSaleQuoteApi.SaleQuoteItem) {
  if (!row) return undefined;
  return itemRowKeyManager.ensureRowKey(row);
}

function setActiveItemRow(row?: ErpSaleQuoteApi.SaleQuoteItem) {
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
      message.warning('请先点击一条有商品的报价明细');
    }
    return undefined;
  }
  return row;
}

function getItemRowClassName({ row }: { row: ErpSaleQuoteApi.SaleQuoteItem }) {
  return getItemRowKey(row) === activeItemRowKey.value
    ? 'sale-quote-item-row--active'
    : '';
}

async function refreshItemGrid(showSortMask = false) {
  const runId = ++itemSortRunId;
  const startedAt = Date.now();
  if (showSortMask) {
    itemSortMaskVisible.value = true;
    await nextTick();
    await waitForBrowserPaint();
  }

  try {
    if (runId !== itemSortRunId) return;
    const displayData = getDisplayedItems();
    const columns = buildCustomizedItemColumns(displayData) || [];
    // Keep the wrapper's column props in sync: later data/loading updates clone
    // these options and would otherwise restore the initial empty-page widths.
    gridApi.setGridOptions({ columns, data: displayData });
    await gridApi.grid.loadData(displayData);
    await gridApi.grid.reloadColumn(columns);
    if (activeItemSort.value) await gridApi.grid.setSort(activeItemSort.value);
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
      if (runId === itemSortRunId) {
        itemSortMaskVisible.value = false;
      }
    }
  }
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

function canBatchUpdateItemRow(row?: ErpSaleQuoteApi.SaleQuoteItem) {
  return Boolean(row?.productId && (!props.disabled || row.id));
}

function canDeleteItemRow(row?: ErpSaleQuoteApi.SaleQuoteItem) {
  return Boolean(row && !props.disabled);
}

function canSelectItemRow(row?: ErpSaleQuoteApi.SaleQuoteItem) {
  return canBatchUpdateItemRow(row) || canDeleteItemRow(row);
}

function buildItemColumns(
  rows: ErpSaleQuoteApi.SaleQuoteItem[] = getDisplayedItems(),
): NonNullable<VxeTableGridOptions<ErpSaleQuoteApi.SaleQuoteItem>['columns']> {
  const columns =
    useFormItemColumns(props.disabled, props.hiddenFields, {
      compact: props.compact,
      editable: !props.disabled,
      getCellContentExtraWidth: (field, row) =>
        field === 'productId' && isCrossDeptWarehouse(row) ? 60 : 0,
      rows,
      isCellEditable: (field) => !['warehouseId', 'deptId'].includes(field),
      trailingFlexibleColumnMinWidth: 150,
    }) || [];
  if (canShowItemSelection.value) {
    return [
      {
        fixed: 'left',
        type: 'checkbox',
        width: 44,
      } as any,
      ...columns,
    ] as NonNullable<
      VxeTableGridOptions<ErpSaleQuoteApi.SaleQuoteItem>['columns']
    >;
  }
  return columns as NonNullable<
    VxeTableGridOptions<ErpSaleQuoteApi.SaleQuoteItem>['columns']
  >;
}

function buildCustomizedItemColumns(
  rows: ErpSaleQuoteApi.SaleQuoteItem[] = getDisplayedItems(),
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
  gridApi.setGridOptions({ columns });
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
    message.warning('请先勾选可批量调整价格的报价明细');
    return;
  }
  const isServerMode = canUseServerBatchUpdate.value;
  batchAdjustPriceModalApi
    .setData({
      customerPriceLevel: props.customerPriceLevel,
      documentId: isServerMode ? props.documentId : undefined,
      documentType: 'quote',
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
    await batchUpdateSaleQuoteItems({
      itemIds: selectedBatchItemIds.value,
      priceLevel: payload.priceLevel,
      quoteId: props.documentId,
    });
    message.success(
      `已批量调整 ${selectedBatchItemCount.value} 条报价明细价格`,
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

function isSelectedBatchItemRow(row: ErpSaleQuoteApi.SaleQuoteItem) {
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
  const updatedRows: ErpSaleQuoteApi.SaleQuoteItem[] = [];
  const nextItems = tableData.value.map((item) => {
    if (!isSelectedBatchItemRow(item)) {
      return item;
    }
    const row = { ...item };
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
      setProductPriceText(row);
    }
    initRow(row);
    updatedRows.push(row);
    return row;
  });
  return { nextItems, updatedRows };
}

function hasDuplicateBatchUpdatedItems(items: ErpSaleQuoteApi.SaleQuoteItem[]) {
  const keys = new Set<string>();
  return items.some((item) => {
    const key = buildQuoteItemDuplicateKey(item as any);
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
    message.warning('请先勾选可批量修改的报价明细');
    return false;
  }
  if (validateDuplicate && hasDuplicateBatchUpdatedItems(nextItems)) {
    message.warning(
      '批量修改后存在产品、仓库、批次、赠品标识重复，请调整后再操作',
    );
    return false;
  }
  tableData.value = nextItems;
  emitItemsUpdate(true);
  await nextTick();
  await refreshItemGrid();
  if (showMessage) {
    message.success(`已批量更新 ${updatedRows.length} 条报价明细`);
  }
  return true;
}

function toNumber(value: unknown) {
  return Number(value) || 0;
}

function ensureDeptOption(deptId?: number, deptName?: string) {
  if (
    !deptId ||
    isMissingDisplayName(deptName, deptId) ||
    findDeptName(deptOptions.value, deptId)
  ) {
    return;
  }
  deptOptions.value = [...deptOptions.value, { id: deptId, name: deptName }];
}

function resolveWarehouseDeptId(warehouseId?: number) {
  const warehouse = warehouseOptions.value.find(
    (item) => item.id === warehouseId,
  );
  if (warehouse?.deptId) {
    // 仓库所属部门可能不在当前用户的部门数据权限范围内（如跨部门分配的仓库），
    // 这里用仓库自带的 deptName 补齐分页选择器选项，避免回显时只显示原始 id。
    ensureDeptOption(warehouse.deptId, warehouse.deptName);
  }
  return warehouse?.deptId;
}

function resolveWarehouseDeptName(warehouseId?: number) {
  return warehouseOptions.value.find((item) => item.id === warehouseId)
    ?.deptName;
}

function ensureCurrentWarehouseOption(item: ErpSaleQuoteApi.SaleQuoteItem) {
  if (
    !item.warehouseId ||
    findResolvedOptionById(warehouseOptions.value, item.warehouseId) ||
    isMissingDisplayName(item.warehouseName, item.warehouseId)
  ) {
    return;
  }
  warehouseOptions.value = [
    ...warehouseOptions.value,
    {
      id: item.warehouseId,
      name: item.warehouseName || String(item.warehouseId),
      deptId: item.warehouseDeptId,
      deptName: item.warehouseDeptName,
    },
  ];
}

function fillItemDeptIdFromStock(item: ErpSaleQuoteApi.SaleQuoteItem) {
  const deptId =
    item.warehouseDeptId ?? resolveWarehouseDeptId(item.warehouseId);
  if (deptId) {
    ensureDeptOption(
      deptId,
      item.warehouseDeptName ?? resolveWarehouseDeptName(item.warehouseId),
    );
  }
  item.deptId = deptId;
}

function fillItemWarehouseSnapshot(item: ErpSaleQuoteApi.SaleQuoteItem) {
  ensureCurrentWarehouseOption(item);
  const warehouse = findResolvedOptionById(
    warehouseOptions.value,
    item.warehouseId,
  );
  if (isMissingDisplayName(item.warehouseName, item.warehouseId)) {
    item.warehouseName = warehouse?.name;
  }
  item.warehouseDeptId ??= resolveWarehouseDeptId(item.warehouseId);
  if (isMissingDisplayName(item.warehouseDeptName, item.warehouseDeptId)) {
    item.warehouseDeptName = resolveWarehouseDeptName(item.warehouseId);
  }
  ensureDeptOption(item.warehouseDeptId, item.warehouseDeptName);
}

function isCrossDeptWarehouse(row: ErpSaleQuoteApi.SaleQuoteItem) {
  return (
    !!props.mainDeptId &&
    !!row.warehouseDeptId &&
    row.warehouseDeptId !== props.mainDeptId
  );
}

function getReadonlyWarehouseName(row: any) {
  if (!row?.warehouseId) {
    return '-';
  }
  const currentName = row.warehouseName || row.warehouseNameLabel;
  const existed = findResolvedOptionById(
    warehouseOptions.value,
    row.warehouseId,
  );
  return isMissingDisplayName(currentName, row.warehouseId)
    ? existed?.name || '-'
    : currentName;
}

function applyCachedSelectLabels(rows: ErpSaleQuoteApi.SaleQuoteItem[]) {
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

async function hydrateMissingCurrentSelectLabels(
  rows: ErpSaleQuoteApi.SaleQuoteItem[],
) {
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

const summaries = computed(() => ({
  count: tableData.value.reduce(
    (sum, item) => saleDecimalAdd(sum, toNumber(item.count)),
    0,
  ),
  totalPrice: tableData.value.reduce(
    (sum, item) => saleDecimalAdd(sum, toNumber(item.totalPrice)),
    0,
  ),
  taxPrice: 0,
}));

function isPriceItemHidden(field: string) {
  return props.disabled && isSalePriceItemHidden(props.hiddenFields, field);
}

watch(
  () => [summaries.value.count, summaries.value.totalPrice, props.feeAmount],
  () => {
    emit('update:summary', {
      totalCount: summaries.value.count,
      totalProductPrice: summaries.value.totalPrice,
      totalTaxPrice: 0,
      totalPrice: summaries.value.totalPrice + toNumber(props.feeAmount),
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
    id: 'erp-sale-quote-item-list-v1',
    autoResize: true,
    border: true,
    fit: true,
    showHeaderOverflow: props.compact ? 'tooltip' : undefined,
    showOverflow: props.compact ? 'tooltip' : undefined,
    rowConfig: { keyField: 'clientRowKey', isHover: true },
    rowClassName: getItemRowClassName,
    checkboxConfig: {
      checkMethod: ({ row }: { row: ErpSaleQuoteApi.SaleQuoteItem }) =>
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
    cellClick: ({ row }: { row: ErpSaleQuoteApi.SaleQuoteItem }) => {
      setActiveItemRow(row);
    },
    currentRowChange: ({ row }: { row?: ErpSaleQuoteApi.SaleQuoteItem }) => {
      setActiveItemRow(row);
    },
    sortChange: handleItemSortChange,
    custom: handleItemColumnCustom,
    checkboxAll: ({
      records,
    }: {
      records: ErpSaleQuoteApi.SaleQuoteItem[];
    }) => {
      selectedBatchItemRows.value = records.filter(canSelectItemRow);
    },
    checkboxChange: ({
      records,
    }: {
      records: ErpSaleQuoteApi.SaleQuoteItem[];
    }) => {
      selectedBatchItemRows.value = records.filter(canSelectItemRow);
    },
  },
});

watch(
  () => props.hiddenFields,
  async () => {
    await nextTick();
    const columns = buildCustomizedItemColumns() || [];
    gridApi.setGridOptions({ columns });
    await gridApi.grid.reloadColumn(columns);
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

async function syncItemsFromProps(
  items = props.items,
  options: { force?: boolean } = {},
) {
  if (!items) return;
  if (isInternalUpdate) {
    if (!options.force) {
      isInternalUpdate = false;
      return;
    }
    isInternalUpdate = false;
  }
  const syncRunId = ++itemSyncRunId;
  const nextItems = items.map((item) => ({ ...item }));
  nextItems.forEach((item) => {
    fillItemWarehouseSnapshot(item);
    fillItemDeptIdFromStock(item);
    initRow(item);
    setCountText(item);
    setProductPriceText(item);
  });
  // 先展示接口返回的明细；库存和批次查询只为编辑服务，不能阻塞详情表格。
  tableData.value = nextItems;
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
  void hydrateMissingCurrentSelectLabels(tableData.value);

  if (props.disabled || syncRunId !== itemSyncRunId) {
    return;
  }
  await Promise.allSettled([
    refreshStockCounts(nextItems),
    refreshBatchNoOptions(nextItems),
  ]);
  if (syncRunId !== itemSyncRunId) {
    return;
  }
  await refreshItemGrid();
}

watch(
  () => props.items,
  (items) => {
    void syncItemsFromProps(items);
  },
  { immediate: true },
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

function emitItemsUpdate(skipReload = false) {
  isInternalUpdate = skipReload;
  emit(
    'update:items',
    tableData.value.map((item) => {
      const {
        countTextDirty: _countTextDirty,
        countText: _countText,
        productPriceTextDirty: _productPriceTextDirty,
        productPriceText: _productPriceText,
        ...rest
      } = item;
      return rest;
    }),
  );
}

function setCountText(row: EditableSaleQuoteItem) {
  row.countText =
    row.count === null || row.count === undefined
      ? ''
      : formatSaleDecimal(row.count);
  row.countTextDirty = false;
}

function setProductPriceText(row: EditableSaleQuoteItem) {
  row.productPriceText =
    row.productPrice === null || row.productPrice === undefined
      ? ''
      : formatSaleAmount(row.productPrice);
  row.productPriceTextDirty = false;
}

function resolveCountInputValue(row: EditableSaleQuoteItem) {
  if (row.countText === undefined) {
    return row.count;
  }
  const formattedValue =
    row.count === null || row.count === undefined
      ? ''
      : formatSaleDecimal(row.count);
  return row.countTextDirty || row.countText !== formattedValue
    ? row.countText
    : row.count;
}

function resolveProductPriceInputValue(row: EditableSaleQuoteItem) {
  if (row.productPriceText === undefined) {
    return row.productPrice;
  }
  const formattedValue =
    row.productPrice === null || row.productPrice === undefined
      ? ''
      : formatSaleAmount(row.productPrice);
  return row.productPriceTextDirty || row.productPriceText !== formattedValue
    ? row.productPriceText
    : row.productPrice;
}

function sanitizeNumericInput(value: unknown) {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value).trim();
}

function parseNumericInput(
  value: unknown,
  fieldLabel: string,
  rowIndex: number,
  {
    required = false,
    min,
    max,
    positive = false,
  }: {
    max?: number;
    min?: number;
    positive?: boolean;
    required?: boolean;
  } = {},
) {
  const text = sanitizeNumericInput(value);
  if (!text) {
    if (required) {
      throw new Error(`第 ${rowIndex + 1} 行：${fieldLabel}不能为空`);
    }
    return 0;
  }
  const parsed = parseSaleDecimal(text, fieldLabel, {
    allowEmpty: !required,
    max,
    min,
  });
  if (!parsed.ok) {
    throw new Error(`第 ${rowIndex + 1} 行：${parsed.message}`);
  }
  const numericValue = parsed.value ?? 0;
  if (positive && numericValue <= 0) {
    throw new Error(`第 ${rowIndex + 1} 行：${fieldLabel}必须大于 0`);
  }
  if (min !== undefined && numericValue < min) {
    throw new Error(`第 ${rowIndex + 1} 行：${fieldLabel}不能小于 ${min}`);
  }
  if (max !== undefined && numericValue > max) {
    throw new Error(`第 ${rowIndex + 1} 行：${fieldLabel}不能大于 ${max}`);
  }
  return numericValue;
}

function parseDraftNumber(value: unknown) {
  const text = sanitizeNumericInput(value);
  const parsed = parseSaleDecimal(text, '数字', { allowEmpty: true });
  return parsed.ok ? (parsed.value ?? 0) : 0;
}

function normalizeRowNumbers(row: any, rowIndex: number) {
  row.count = parseNumericInput(
    resolveCountInputValue(row),
    '产品数量',
    rowIndex,
    {
      required: true,
      min: 0.001,
    },
  );
  if (row.giftFlag) {
    row.productPrice = 0;
    return;
  }
  row.productPrice = parseNumericInput(
    resolveProductPriceInputValue(row),
    '产品单价',
    rowIndex,
    {
      positive: true,
      required: true,
    },
  );
}

function buildQuoteItemDuplicateKey(item: Record<string, any>) {
  if (!item.productId || !item.warehouseId) {
    return '';
  }
  return buildErpItemDuplicateKey(item, DUPLICATE_KEY_OPTIONS);
}

function assertNoDuplicateQuoteItems(items: any[]) {
  const duplicateKeys = new Map<string, number>();
  for (const [index, item] of items.entries()) {
    const key = buildQuoteItemDuplicateKey(item);
    if (!key) {
      continue;
    }
    const firstIndex = duplicateKeys.get(key);
    if (firstIndex !== undefined) {
      throw new Error(
        `第 ${index + 1} 行：产品、仓库、批次、赠品标识重复，请合并后再提交`,
      );
    }
    duplicateKeys.set(key, index);
  }
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

async function refreshBatchNoOptions(rows: any) {
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

function buildSubmitItems(sourceItems = tableData.value) {
  const items = sourceItems.map((item, index) => {
    const row = { ...item };
    normalizeRowNumbers(row, index);
    initRow(row);
    delete row.countTextDirty;
    delete row.countText;
    delete row.productPriceTextDirty;
    delete row.productPriceText;
    return row;
  });
  assertNoDuplicateQuoteItems(items);
  return items;
}

function buildDraftItems() {
  const items = tableData.value
    .map((item) => {
      const row = { ...item };
      const count = parseDraftNumber(resolveCountInputValue(row));
      row.count = count;
      row.giftFlag = row.giftFlag === true;
      row.productPrice = row.giftFlag
        ? 0
        : Math.max(parseDraftNumber(resolveProductPriceInputValue(row)), 0);
      initRow(row);
      delete row.countTextDirty;
      delete row.countText;
      delete row.productPriceTextDirty;
      delete row.productPriceText;
      return row;
    })
    .filter(
      (item) =>
        item.productId && item.warehouseId && Number(item.count || 0) > 0,
    );
  assertNoDuplicateQuoteItems(items);
  return items;
}

function handleImport() {
  emit('import');
}

function buildShortcutStockRow(
  row: ErpSaleQuoteApi.SaleQuoteItem,
): ErpStockApi.Stock {
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

  if (!props.disabled && isCreateShortcutKey(event)) {
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
      row.salePrice = pickProductPrice(
        {
          ...row,
          ...product,
          productPurchasePrice: product.purchasePrice,
        },
        props.priceType,
      );
    }),
  );
  await nextTick();
  await refreshItemGrid();
  emitItemsUpdate(true);
}

function getProductInputValue(row: ErpSaleQuoteApi.SaleQuoteItem) {
  const keyword = (row as any).__stockKeyword;
  return keyword === undefined || keyword === null
    ? row.productName || ''
    : String(keyword);
}

function handleProductKeywordInput(
  row: ErpSaleQuoteApi.SaleQuoteItem,
  value: string,
) {
  (row as any).__stockKeyword = value;
}

function escapeAttrValue(value: string) {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

function focusProductNameInput(row: ErpSaleQuoteApi.SaleQuoteItem) {
  if (props.disabled) {
    return false;
  }
  const rowKey = getItemRowKey(row);
  const selector = rowKey
    ? `${SALE_QUOTE_PRODUCT_SELECT_INPUT_SELECTOR}[data-erp-inline-stock-row-key="${escapeAttrValue(rowKey)}"]`
    : SALE_QUOTE_PRODUCT_SELECT_INPUT_SELECTOR;
  return focusFirstEditableInput(itemTableWrapRef.value, selector);
}

function createBlankItemRow() {
  const row = {
    count: 1,
    convertedCount: 0,
    giftFlag: false,
    remark: '',
  } as EditableSaleQuoteItem;
  initRow(row);
  setCountText(row);
  setProductPriceText(row);
  return row;
}

const itemRowFocusController = createErpItemRowFocusController({
  focusField: (row: ErpSaleQuoteApi.SaleQuoteItem, field) =>
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
  const previousRows = [...tableData.value];
  const row = createBlankItemRow();
  tableData.value = [...tableData.value, row];
  emitItemsUpdate(false);
  if (props.remotePaging) {
    tableData.value = previousRows;
    return;
  }
  await itemRowFocusController.focus(row, 'product');
}

function buildSaleQuoteItemFromStock(p: ErpStockApi.Stock) {
  const warehouseId = p.warehouseId;
  const batchNo = normalizeBatchNoValue(p.batchNo) || undefined;
  const batchNoEnabled = isBatchNoEnabled(p.batchNoEnabled) || !!batchNo;
  const salePrice = pickProductPrice(p, props.priceType);
  const row: any = {
    id: undefined,
    productId: p.productId,
    productCode: p.productCode,
    productName: p.productName,
    productUnitId: p.unitId,
    productUnitName: p.unitName,
    weight: p.weight,
    packageQty: p.packageQty,
    productBarCode: p.productBarCode,
    warehouseId,
    warehouseName: p.warehouseName,
    warehouseDeptId: p.deptId,
    warehouseDeptName: p.deptName,
    deptId: p.deptId ?? resolveWarehouseDeptId(warehouseId),
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
    convertedCount: 0,
    giftFlag: false,
    batchNo,
    batchNoEnabled,
    brand: p.brand,
    vehicleModel: p.vehicleModel,
    originPlace: p.originPlace,
    standard: p.standard,
  };
  fillItemDeptIdFromStock(row);
  initRow(row);
  setCountText(row);
  setProductPriceText(row);
  return row as ErpSaleQuoteApi.SaleQuoteItem;
}

function buildReplacementSaleQuoteItemFromStock(
  stock: ErpStockApi.Stock,
  targetRow: ErpSaleQuoteApi.SaleQuoteItem,
) {
  const row = buildSaleQuoteItemFromStock(stock);
  row.clientRowKey = targetRow.clientRowKey;
  row.id = targetRow.id;
  row.seq = targetRow.seq ?? row.seq;
  (row as any).quoteId = (targetRow as any).quoteId;
  (row as any).quoteNo = (targetRow as any).quoteNo;
  row.convertedCount = targetRow.convertedCount ?? row.convertedCount;
  return row;
}

function filterSelectableStockProducts(
  products: ErpStockApi.Stock[],
  targetRow?: ErpSaleQuoteApi.SaleQuoteItem,
) {
  const targetRowKey = getItemRowKey(targetRow);
  const existedKeys = new Set(
    (tableData.value ?? [])
      .filter((item) => getItemRowKey(item) !== targetRowKey)
      .map((item) => buildQuoteItemDuplicateKey(item as any))
      .filter(Boolean),
  );
  return products.filter((product) => {
    const key = buildQuoteItemDuplicateKey({
      productId: product.productId,
      warehouseId: product.warehouseId,
      batchNo: product.batchNo,
      giftFlag: false,
    });
    if (key && existedKeys.has(key)) {
      message.warning(
        `产品【${product.productName || product.productCode || product.productId}】在该仓库已存在`,
      );
      return false;
    }
    if (key) {
      existedKeys.add(key);
    }
    return true;
  });
}

async function insertStockProducts(
  products: ErpStockApi.Stock[],
  options: {
    targetRow?: ErpSaleQuoteApi.SaleQuoteItem;
  } = {},
) {
  if (!products || products.length === 0) return;
  const previousRows = [...tableData.value];
  const targetRowKey = getItemRowKey(options.targetRow);
  const selectedProducts = filterSelectableStockProducts(
    products,
    options.targetRow,
  );
  if (selectedProducts.length === 0) return;

  const targetIndex = targetRowKey
    ? tableData.value.findIndex((item) => getItemRowKey(item) === targetRowKey)
    : -1;
  let activeRow: ErpSaleQuoteApi.SaleQuoteItem;
  if (targetIndex >= 0 && options.targetRow) {
    const [firstStock, ...additionalStocks] = selectedProducts;
    const replacementRow = buildReplacementSaleQuoteItemFromStock(
      firstStock!,
      options.targetRow,
    );
    const additionalRows = additionalStocks.map(buildSaleQuoteItemFromStock);
    tableData.value.splice(targetIndex, 1, replacementRow);
    if (additionalRows.length > 0) {
      tableData.value = [...tableData.value, ...additionalRows];
    }
    activeRow = replacementRow;
  } else {
    const newRows = selectedProducts.map(buildSaleQuoteItemFromStock);
    tableData.value = [...tableData.value, ...newRows];
    activeRow = newRows[0]!;
  }

  // 批次信息只是编辑辅助数据。先一次性写入、回传并刷新表格，避免某个批次请求失败时
  // 已选产品只进入内部 tableData、却没有渲染出来，导致再次选择时被误判为重复。
  setActiveItemRow(activeRow);
  emitItemsUpdate(!props.remotePaging);
  if (props.remotePaging && (targetIndex < 0 || selectedProducts.length > 1)) {
    tableData.value = previousRows;
    return;
  }
  await nextTick();
  await Promise.allSettled([refreshBatchNoOptions(tableData.value)]);
  await itemRowFocusController.focus(activeRow, 'count');
}

function handleInlineStockSelected(
  targetRow: ErpSaleQuoteApi.SaleQuoteItem,
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
    SALE_QUOTE_ITEM_COUNT_INPUT_SELECTOR,
  );
}

function focusItemCountInput(row: ErpSaleQuoteApi.SaleQuoteItem) {
  return focusEditableInputByRowKey(
    itemTableWrapRef.value,
    SALE_QUOTE_ITEM_COUNT_INPUT_SELECTOR,
    getItemRowKey(row),
  );
}

function focusItemByRowKey(
  rowKey: string,
  field: 'count' | 'product' = 'count',
) {
  const row = tableData.value.find((item) => getItemRowKey(item) === rowKey);
  return row ? itemRowFocusController.focus(row, field) : false;
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
  handleRowChange(row);
}

async function refreshStockCounts(items: ErpSaleQuoteApi.SaleQuoteItem[]) {
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

function deleteItemRows(rows: ErpSaleQuoteApi.SaleQuoteItem[]) {
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
  void refreshItemGrid();
  emitItemsUpdate(false);
}

function handleBatchDeleteItems() {
  const rows = selectedDeleteItemRows.value;
  if (rows.length === 0) {
    message.warning('请先勾选要删除的报价明细');
    return;
  }
  Modal.confirm({
    cancelText: '取消',
    content: '删除后将从当前销售报价明细中移除这些行。',
    okText: '删除',
    okType: 'danger',
    title: `确认删除已选 ${rows.length} 条报价明细吗？`,
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
  const count = Number(row.count) || 0;
  const productPrice = Number(row.productPrice) || 0;
  if (row.giftFlag) {
    row.productPrice = 0;
    row.totalPrice = 0;
    row.taxPrice = 0;
    row.totalProductPrice = 0;
    return;
  }
  row.totalPrice = saleDecimalMultiply(productPrice, count) || 0;
  row.taxPrice = 0;
  row.totalProductPrice = row.totalPrice;
}

function handleCountBlur(row: any) {
  if (!row.countTextDirty) {
    setCountText(row);
    return;
  }
  const rowIndex = Math.max(
    tableData.value.findIndex(
      (item: any) => getItemRowKey(item) === getItemRowKey(row),
    ),
    0,
  );
  try {
    row.count = parseNumericInput(row.countText, '产品数量', rowIndex, {
      required: true,
      min: 0.001,
    });
  } catch (error) {
    message.warning(
      error instanceof Error ? error.message : '产品数量格式不正确',
    );
    setCountText(row);
    return;
  }
  handleRowChange(row);
}

function handleProductPriceBlur(row: any) {
  if (!row.productPriceTextDirty) {
    setProductPriceText(row);
    return;
  }
  if (row.giftFlag) {
    row.productPrice = 0;
    setProductPriceText(row);
    handleRowChange(row);
    return;
  }
  const rowIndex = Math.max(
    tableData.value.findIndex(
      (item: any) => getItemRowKey(item) === getItemRowKey(row),
    ),
    0,
  );
  try {
    row.productPrice = parseNumericInput(
      row.productPriceText,
      '产品单价',
      rowIndex,
      {
        positive: true,
        required: true,
      },
    );
  } catch (error) {
    message.warning(
      error instanceof Error ? error.message : '产品单价格式不正确',
    );
    setProductPriceText(row);
    return;
  }
  handleRowChange(row);
}

function validate(
  items = tableData.value,
  options: { requireItems?: boolean } = {},
) {
  if ((options.requireItems ?? true) && items.length === 0) {
    throw new Error('请先添加报价产品');
  }
  const submitItems = buildSubmitItems(items);
  submitItems.forEach((item, index) => {
    if (!item.productId) throw new Error(`第 ${index + 1} 行：产品不能为空`);
    if (!item.warehouseId) throw new Error(`第 ${index + 1} 行：仓库不能为空`);
    if (!item.count || item.count <= 0)
      throw new Error(`第 ${index + 1} 行：产品数量不能为空`);
  });
}

async function waitForItemsReady() {
  await nextTick();
  await refreshItemGrid();
  await nextTick();
}

async function reloadItemsFromProps() {
  await syncItemsFromProps(props.items, { force: true });
  await waitForItemsReady();
}

defineExpose({
  focusItemByRowKey,
  focusFirstItemCountInput,
  validate,
  getDraftItems: buildDraftItems,
  getSubmitItems: buildSubmitItems,
  reloadItemsFromProps,
  waitForItemsReady,
});

onMounted(async () => {
  isShortcutScopeActive = true;
  syncShortcutListening();
  await loadOrderPriceCustomFieldNames();
  tableData.value.forEach((item) => {
    handleDeptOptionsChange(getCurrentDeptOption(item));
  });
  let changed = false;
  if (tableData.value.length > 0) {
    tableData.value.forEach((item) => fillItemWarehouseSnapshot(item));
    if (props.disabled) {
      // 详情态也按库存部门回显，兼容历史明细曾保存为当前用户部门的旧数据。
      tableData.value.forEach((item) => fillItemDeptIdFromStock(item));
    } else {
      tableData.value.forEach((item) => {
        const beforeDeptId = item.deptId;
        fillItemDeptIdFromStock(item);
        if (item.deptId !== beforeDeptId) {
          changed = true;
        }
      });
    }
  }
  // ItemForm 可能在详情数据返回后才通过 v-if 挂载。此时 immediate watcher
  // 已写入 tableData，但 grid 实例尚未就绪，需要在挂载完成后再主动灌入一次。
  await nextTick();
  await refreshItemGrid();
  void hydrateMissingCurrentSelectLabels(tableData.value);
  if (changed) {
    emitItemsUpdate(true);
  }
});

onActivated(() => {
  isShortcutScopeActive = true;
  syncShortcutListening();
});

onDeactivated(() => {
  isShortcutScopeActive = false;
  syncShortcutListening();
});

watch(
  () => props.mainDeptId,
  async () => {
    if (props.disabled) {
      return;
    }
    let changed = false;
    tableData.value.forEach((item) => {
      const beforeDeptId = item.deptId;
      fillItemDeptIdFromStock(item);
      if (item.deptId !== beforeDeptId) {
        changed = true;
      }
    });
    if (changed) {
      await nextTick();
      await refreshItemGrid();
      emitItemsUpdate(true);
    }
  },
);

onBeforeUnmount(() => {
  isShortcutScopeActive = false;
  syncShortcutListening();
});
</script>

<template>
  <div class="sale-quote-item-grid relative w-full">
    <div
      ref="itemTableWrapRef"
      class="sale-quote-item-table-wrap relative"
      tabindex="-1"
      @click="focusSaleShortcutOwner(itemTableWrapRef, $event.target)"
    >
      <Grid class="w-full">
        <template #toolbar-buttons>
          <div class="sale-quote-item-toolbar-left">
            <div class="sale-quote-item-shortcut-hint">
              <span class="sale-quote-item-shortcut-hint__label"
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
              <span class="sale-quote-item-shortcut-hint__divider"></span>
              <span
                ><span class="sale-quote-item-shortcut-hint__label">当前页</span
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
          <div class="sale-quote-item-toolbar flex items-center gap-2">
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
            settings-scope="sale-quote"
            v-if="!disabled"
            :value="getProductInputValue(row)"
            :row="row"
            :row-key="getItemRowKey(row)"
            :dept-id="props.mainDeptId"
            :filter-by-dept="false"
            :hidden-fields="props.hiddenFields"
            :stock-page-api="getSaleStockPage"
            :stock-page-params="getInlineStockPageParams()"
            require-dept-message="请先选择客户及所属部门，再选择销售库存"
            @open-change="handleInlineStockOpenChange"
            @select="(stocks) => handleInlineStockSelected(row, stocks)"
            @update:value="(value) => handleProductKeywordInput(row, value)"
          />
          <div v-else class="flex flex-wrap items-center gap-1">
            <span>{{ row.productName || '-' }}</span>
            <Tag v-if="isCrossDeptWarehouse(row)" color="orange" class="m-0">
              跨部门
            </Tag>
          </div>
        </template>
        <template #warehouseId="{ row }">
          <span :title="getReadonlyWarehouseName(row)">
            {{ getReadonlyWarehouseName(row) }}
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
            :data-erp-item-row-key="getItemRowKey(row)"
            data-sale-quote-count-input="true"
            inputmode="decimal"
            autocomplete="off"
            @focus="setActiveItemRow(row)"
            @press-enter="handleItemInputPressEnter"
            @update:value="row.countTextDirty = true"
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
            @update:value="row.productPriceTextDirty = true"
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
            popup-class-name="sale-quote-item-select-dropdown erp-candidate-focus-popup"
            :options="getBatchNoOptions(row)"
            :disabled="
              !isBatchNoEnabled(row.batchNoEnabled) ||
              !row.productId ||
              !row.warehouseId
            "
            allow-clear
            show-search
            :filter-option="filterSelectOption"
            class="w-full"
            @change="handleBatchNoChange(row)"
          />
          <span v-else>{{ row.batchNo || '-' }}</span>
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
          /><span v-else>{{ row.remark || '-' }}</span>
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
                  title: '确定删除该产品吗？',
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
  <div v-if="showItemPager" class="sale-quote-item-pager">
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
    all-sale-product-permission="erp:sale-quote:all-product"
    enable-sale-stock-shortcuts
    :customer-price-level="customerPriceLevel"
    :hidden-fields="hiddenFields"
    :sale-dept-id="mainDeptId"
    show-batch-no
    @success="handleProductsSelected"
  />
  <ProductFormModal @success="handleProductFormSuccess" />
  <PurchaseItemDetailShortcuts
    ref="purchaseShortcutsRef"
    :active-row="activeShortcutItemRow"
    :dept-id="mainDeptId"
    :history-enabled="false"
    :product-edit-enabled="false"
    warning-message="请先点击一条有商品的报价明细"
  />
</template>

<style scoped>
.sale-quote-item-grid :deep(.vxe-table) {
  font-size: 11px;
}

.sale-quote-item-grid :deep(.vxe-header--column .vxe-cell),
.sale-quote-item-grid :deep(.vxe-body--column .vxe-cell) {
  padding-right: 4px;
  padding-left: 4px;
}

.sale-quote-item-grid :deep(.vxe-header--column .vxe-cell--title) {
  white-space: nowrap;
}

.sale-quote-item-grid :deep(.vxe-header--column.is--sortable .vxe-cell--title) {
  color: #1677ff;
}

.sale-quote-item-grid :deep(.vxe-header--column .vxe-cell--sort) {
  display: none;
}

.sale-quote-item-grid :deep(.ant-input),
.sale-quote-item-grid :deep(.ant-select),
.sale-quote-item-grid :deep(.ant-select-selector),
.sale-quote-item-grid :deep(.ant-select-selection-item),
.sale-quote-item-grid :deep(.ant-select-selection-placeholder),
.sale-quote-item-grid :deep(.ant-select-selection-search-input),
.sale-quote-item-grid :deep(.ant-tree-select) {
  font-size: 11px;
}

.sale-quote-item-grid :deep(.vxe-toolbar .ant-btn) {
  height: 28px;
  padding: 2px 10px;
  font-size: 12px;
  line-height: 20px;
}

.sale-quote-item-toolbar :deep(.ant-btn span) {
  font-size: 12px;
}

.sale-quote-item-toolbar-left {
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

.sale-quote-item-shortcut-hint {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  min-width: 0;
  font-size: 12px;
  color: #334155;
}

.sale-quote-item-shortcut-hint__label {
  color: #64748b;
}

.sale-quote-item-shortcut-hint span:not(.sale-quote-item-shortcut-hint__label) {
  display: inline-flex;
  gap: 5px;
  align-items: center;
  min-height: 26px;
  padding: 2px 8px;
  background: #f8fafc;
  border: 1px solid #d8e0ea;
  border-radius: 4px;
}

.sale-quote-item-shortcut-hint b {
  font-weight: 600;
}

.sale-quote-item-shortcut-hint kbd {
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

.sale-quote-item-grid :deep(.vxe-body--column .table-actions .ant-btn-link) {
  height: auto;
  padding: 0;
  font-size: 11px;
}

.sale-quote-item-grid :deep(.sale-quote-item-row--active td) {
  background-color: rgba(22, 119, 255, 0.1) !important;
}

.sale-quote-item-grid :deep(.sale-quote-item-row--active td:first-child) {
  box-shadow: inset 3px 0 0 #1677ff;
}

.sale-quote-item-grid :deep(.sale-quote-item-row--active:hover td) {
  background-color: rgba(22, 119, 255, 0.16) !important;
}

:global(.sale-quote-item-select-dropdown .ant-select-item),
:global(.sale-quote-item-select-dropdown .ant-select-tree),
:global(.sale-quote-item-select-dropdown .ant-empty-description) {
  font-size: 11px;
}

.sale-quote-item-pager {
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
}

.sale-quote-item-pager :deep(.ant-pagination),
.sale-quote-item-pager :deep(.ant-pagination-item),
.sale-quote-item-pager :deep(.ant-pagination-total-text),
.sale-quote-item-pager :deep(.ant-pagination-options),
.sale-quote-item-pager :deep(.ant-select),
.sale-quote-item-pager :deep(.ant-input) {
  font-size: 11px;
}

.sale-quote-item-pager :deep(.ant-pagination-item),
.sale-quote-item-pager :deep(.ant-pagination-prev),
.sale-quote-item-pager :deep(.ant-pagination-next),
.sale-quote-item-pager :deep(.ant-pagination-jump-prev),
.sale-quote-item-pager :deep(.ant-pagination-jump-next) {
  min-width: 24px;
  height: 24px;
  line-height: 22px;
}

.sale-quote-item-pager :deep(.ant-pagination-item a),
.sale-quote-item-pager :deep(.ant-pagination-prev button),
.sale-quote-item-pager :deep(.ant-pagination-next button) {
  height: 22px;
  font-size: 11px;
  line-height: 22px;
}

.sale-quote-item-pager :deep(.ant-pagination-options-size-changer),
.sale-quote-item-pager :deep(.ant-select-single),
.sale-quote-item-pager :deep(.ant-select-selector) {
  height: 24px;
  line-height: 22px;
}

.sale-quote-item-pager
  :deep(.ant-pagination-options-size-changer .ant-select-selector) {
  box-sizing: border-box;
  align-items: center;
  min-height: 24px;
  padding: 0 24px 0 8px;
}

.sale-quote-item-pager
  :deep(.ant-select-single .ant-select-selector .ant-select-selection-item) {
  height: 22px;
  font-size: 11px;
  line-height: 22px;
}

.sale-quote-item-pager :deep(.ant-select-arrow) {
  margin-top: -5px;
  font-size: 10px;
}

.sale-quote-item-pager :deep(.ant-pagination-options-quick-jumper input) {
  height: 24px;
  padding: 0 7px;
  font-size: 11px;
  line-height: 22px;
}
</style>
