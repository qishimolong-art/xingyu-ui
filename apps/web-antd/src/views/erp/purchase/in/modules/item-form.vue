<script lang="ts" setup>
import '#/views/erp/purchase/utils/candidate-focus';
import type { ErpPurchaseInApi } from '#/api/erp/purchase/in';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpStockApi } from '#/api/erp/stock/stock';
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

import { useAccess } from '@vben/access';
import { useVbenModal } from '@vben/common-ui';


import {
  Button,
  Input,
  message,
  Modal as AntModal,
  Pagination,
  Switch,
  Tag,
} from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  getPurchaseInDeptSimplePage,
  getPurchaseInWarehouseDeptSimplePage,
} from '#/api/erp/purchase/in';
import { getWarehouseStockCount } from '#/api/erp/stock/stock';
import {
  getPurchaseWarehouseSimplePage,
  getWarehouse,
} from '#/api/erp/stock/warehouse';
import { getDept } from '#/api/system/dept';
import { isFieldHidden } from '#/composables/useFieldPermission';
import ErpLazyPageSelect from '#/views/erp/components/ErpLazyPageSelect.vue';
import PurchaseInlineStockSelect from '#/views/erp/purchase/components/PurchaseInlineStockSelect.vue';
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
  isBatchNoEnabled,
} from '#/views/erp/purchase/utils/item-form';
import { createPurchaseItemClientRowKeyManager } from '#/views/erp/purchase/utils/item-row-key';
import {
  formatPurchaseAmount,
  formatPurchaseDecimal,
  purchaseDecimalAdd,
  purchaseDecimalDivide,
  purchaseDecimalMultiply,
  purchaseDecimalSubtract,
} from '#/views/erp/purchase/utils/decimal';
import {
  isPurchasePriceReferenceShortcut,
  shouldIgnorePurchasePriceReferenceShortcut,
} from '#/views/erp/purchase/utils/price-reference';
import {
  createErpItemRowFocusController,
  focusEditableInputByRowKey,
} from '#/views/erp/utils/item-row-focus';
import type { ErpItemRowFocusField } from '#/views/erp/utils/item-row-focus';
import { focusFirstEditableInput } from '#/views/erp/utils/keyboard';
import { settleVxeColumnCustomization } from '#/views/erp/utils/vxe-column-custom';

import { isPurchaseInPriceItemHidden, useFormItemColumns } from '../data';
import BatchUpdateItemsForm from './batch-update-items-form.vue';

interface Props {
  items?: ErpPurchaseInApi.PurchaseInItem[];
  disabled?: boolean;
  feeAmount?: number;
  freightType?: string;
  hiddenFields?: string[];
  deptId?: number;
  enableBatchEdit?: boolean;
  inId?: number;
  itemPageLoading?: boolean;
  itemPagination?: PurchaseInItemPagination;
  remotePaging?: boolean;
  showImport?: boolean;
  totalFreight?: number;
}

type PurchaseInItemPagination = {
  orderDirection?: 'asc' | 'desc';
  orderField?: string;
  pageNo: number;
  pageSize: number;
  total: number;
};

type BatchUpdateItemsPayload = {
  deptId?: number;
  mode?: 'local' | 'server';
  warehouseId?: number;
};

type ApplyBatchUpdateItemsOptions = {
  showMessage?: boolean;
  validateDuplicate?: boolean;
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
  deptId: undefined,
  enableBatchEdit: false,
  feeAmount: 0,
  freightType: undefined,
  hiddenFields: () => [],
  inId: undefined,
  itemPageLoading: false,
  itemPagination: () => ({
    orderDirection: undefined,
    orderField: undefined,
    pageNo: 1,
    pageSize: DEFAULT_ITEM_PAGE_SIZE,
    total: 0,
  }),
  remotePaging: false,
  showImport: false,
  totalFreight: 0,
});

const emit = defineEmits([
  'update:items',
  'append-items',
  'update:summary',
  'batch-update-success',
  'import',
  'page-change',
  'request-submit',
]);

const PURCHASE_IN_ITEM_COUNT_INPUT_SELECTOR =
  '[data-purchase-in-count-input="true"]';
const PURCHASE_IN_PRODUCT_SELECT_INPUT_SELECTOR =
  '[data-purchase-inline-stock-select-input="true"]';

function getReturnStatusLabel(row: Record<string, any>) {
  if (row.returnStatus === 2) return '全部退货';
  if (row.returnStatus === 1) return '部分退货';
  if (row.returnStatus === 0) return '未退货';
  const returnCount = Number(row.returnCount || 0);
  const count = Number(row.count || 0);
  if (returnCount <= 0) return '未退货';
  return count > 0 && returnCount >= count ? '全部退货' : '部分退货';
}

function getReturnedCount(row: Record<string, any>) {
  return Number(row.returnCount || 0);
}

function getReturnedCountText(row: Record<string, any>) {
  const returnCount = getReturnedCount(row);
  if (returnCount <= 0) return '';
  return formatPurchaseDecimal(returnCount) || String(returnCount);
}

function getStockInBillTagColor(status?: number) {
  if (status === 30) return 'green';
  if (status === 20) return 'blue';
  if (status === 10) return 'orange';
  return 'default';
}

function getGiftValue(row: Record<string, any>) {
  return !!row.gift;
}

function isPriceItemHidden(field: string) {
  return isPurchaseInPriceItemHidden(props.hiddenFields, field);
}

const tableData = ref<ErpPurchaseInApi.PurchaseInItem[]>([]);
const displayTableData = ref<ErpPurchaseInApi.PurchaseInItem[]>([]);
const warehouseOptions = ref<any[]>([]);
const deptOptions = ref<any[]>([]);
const itemShortcutsRef =
  ref<InstanceType<typeof PurchaseItemDetailShortcuts>>();
const activeItemRowKey = ref<string>();
const priceReferenceOpen = ref(false);
const inlineStockSelectorOpen = ref(false);
const itemTableWrapRef = ref<HTMLElement | null>(null);
const activeItemSort = ref<
  undefined | { field: string; order: PurchaseDocumentItemSortOrder }
>();
const localItemPage = ref({ pageNo: 1, pageSize: DEFAULT_ITEM_PAGE_SIZE });
const selectedBatchItemRows = ref<ErpPurchaseInApi.PurchaseInItem[]>([]);
const { hasAccessByCodes } = useAccess();
const [BatchUpdateItemsModal, batchUpdateItemsModalApi] = useVbenModal({
  connectedComponent: BatchUpdateItemsForm,
  destroyOnClose: true,
});
const nonGiftPriceCache = new WeakMap<object, number>();
let isInternalUpdate = false;
let lastSyncedItemsSource: ErpPurchaseInApi.PurchaseInItem[] | undefined;
let isShortcutListening = false;
let itemSelectLabelHydrateSequence = 0;
let nextItemSeq = 1;
let itemResizeFrame = 0;
let lastItemTableWidth = 0;
const CURRENT_SELECT_LABEL_PLACEHOLDER = '加载中...';

function getItemTableWidth(
  rows: ErpPurchaseInApi.PurchaseInItem[] = displayTableData.value,
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

const canBatchEditWarehouse = computed(
  () => !isFieldHidden(props.hiddenFields, 'item_warehouseId'),
);
const canBatchEditDept = computed(
  () => !isFieldHidden(props.hiddenFields, 'item_deptId'),
);
const canUseServerBatchUpdate = computed(
  () => props.disabled && Boolean(props.inId),
);
const batchUpdateAccessCodes = computed(() =>
  props.inId ? ['erp:purchase-in:update'] : ['erp:purchase-in:create'],
);
const canShowBatchUpdateItems = computed(
  () =>
    props.enableBatchEdit &&
    hasAccessByCodes(batchUpdateAccessCodes.value) &&
    (canBatchEditWarehouse.value || canBatchEditDept.value),
);
const canShowItemSelection = computed(
  () => !props.disabled || canShowBatchUpdateItems.value,
);
const selectedItemKeys = computed(() =>
  selectedBatchItemRows.value.map((row) => getItemRowKey(row)).filter(Boolean),
);
const selectedItemCount = computed(() => selectedItemKeys.value.length);
const selectedBatchItemIds = computed(() =>
  selectedBatchItemRows.value
    .filter((row) => canBatchUpdateItemRow(row))
    .map((row) => row.id!)
    .filter(Boolean),
);
const selectedBatchItemKeys = computed(() =>
  selectedBatchItemRows.value
    .filter((row) => canBatchUpdateItemRow(row))
    .map((row) => getItemRowKey(row))
    .filter(Boolean),
);
const selectedBatchItemCount = computed(() =>
  canUseServerBatchUpdate.value
    ? selectedBatchItemIds.value.length
    : selectedBatchItemKeys.value.length,
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

function setCountText(row: ErpPurchaseInApi.PurchaseInItem) {
  (row as any).countText =
    row.count === null || row.count === undefined
      ? ''
      : formatPurchaseDecimal(row.count);
}

function setBusinessNumberTexts(row: ErpPurchaseInApi.PurchaseInItem) {
  const mutableRow = row as any;
  mutableRow.priceText = row.gift
    ? '0'
    : row.productPrice === null || row.productPrice === undefined
      ? ''
      : formatPurchaseAmount(row.productPrice);
  mutableRow.wholeQtyText =
    row.wholeQty === null || row.wholeQty === undefined
      ? ''
      : formatPurchaseDecimal(row.wholeQty);
  mutableRow.taxPercentText =
    row.taxPercent === null || row.taxPercent === undefined
      ? ''
      : formatPurchaseDecimal(row.taxPercent);
}

function resolveWarehouseDeptId(warehouseId?: number) {
  if (!warehouseId) return undefined;
  return warehouseOptions.value.find(
    (warehouse) => warehouse.id === warehouseId,
  )?.deptId;
}

function getOptionKey(item: any) {
  const key = item?.id ?? item?.value;
  return key === undefined || key === null ? undefined : String(key);
}

function isResolvedSelectOption(item: any) {
  const id = item?.id ?? item?.value;
  return (
    id !== undefined &&
    id !== null &&
    !isMissingDisplayName(item?.name ?? item?.label, id)
  );
}

function isSameSelectOption(oldOption: any, nextOption: any) {
  return (
    String(oldOption?.id ?? oldOption?.value ?? '') ===
      String(nextOption?.id ?? nextOption?.value ?? '') &&
    String(oldOption?.name ?? oldOption?.label ?? '') ===
      String(nextOption?.name ?? nextOption?.label ?? '') &&
    String(oldOption?.deptId ?? '') === String(nextOption?.deptId ?? '') &&
    String(oldOption?.deptName ?? '') === String(nextOption?.deptName ?? '')
  );
}

function mergeOptionsById(oldOptions: any[], nextOptions: any[]) {
  const map = new Map<string, any>();
  const oldResolvedOptions = (oldOptions || []).filter(isResolvedSelectOption);
  let changed = oldResolvedOptions.length !== (oldOptions || []).length;
  oldResolvedOptions.forEach((item) => {
    const key = getOptionKey(item);
    if (key) {
      map.set(key, item);
    }
  });
  (nextOptions || []).filter(isResolvedSelectOption).forEach((item) => {
    const key = getOptionKey(item);
    if (!key) {
      return;
    }
    const existed = map.get(key);
    if (!existed) {
      map.set(key, item);
      changed = true;
      return;
    }
    if (!isSameSelectOption(existed, item)) {
      map.set(key, { ...existed, ...item });
      changed = true;
    }
  });
  return changed ? Array.from(map.values()) : oldOptions || [];
}

function getCurrentWarehouseOption(row: any) {
  if (!row?.warehouseId) {
    return [];
  }
  const existed = warehouseOptions.value.find(
    (warehouse) =>
      String(warehouse.id) === String(row.warehouseId) &&
      isResolvedSelectOption(warehouse),
  );
  if (existed) {
    return [existed];
  }
  const currentName = row.warehouseName || row.warehouseNameLabel;
  return [
    {
      id: row.warehouseId,
      name: isMissingDisplayName(currentName, row.warehouseId)
        ? CURRENT_SELECT_LABEL_PLACEHOLDER
        : currentName,
      deptId: row.deptId,
      deptName: row.deptName,
    },
  ];
}

function getReadonlyWarehouseName(row: any) {
  if (!row?.warehouseId) {
    return '-';
  }
  const existed = warehouseOptions.value.find(
    (warehouse) =>
      String(warehouse.id) === String(row.warehouseId) &&
      isResolvedSelectOption(warehouse),
  );
  const currentName = row.warehouseName || row.warehouseNameLabel;
  return (
    (isMissingDisplayName(currentName, row.warehouseId)
      ? undefined
      : currentName) ||
    existed?.name ||
    '-'
  );
}

function getCurrentDeptOption(row: any) {
  if (!row?.deptId) {
    return [];
  }
  const existed = deptOptions.value.find(
    (dept) =>
      String(dept.id) === String(row.deptId) && isResolvedSelectOption(dept),
  );
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

function getReadonlyDeptName(row: ErpPurchaseInApi.PurchaseInItem) {
  const currentName = (row as any).deptName;
  return (
    (isMissingDisplayName(currentName, row.deptId) ? undefined : currentName) ||
    findDeptName(deptOptions.value, row.deptId) ||
    '-'
  );
}

function handleWarehouseOptionsChange(options: any[]) {
  warehouseOptions.value = mergeOptionsById(warehouseOptions.value, options);
}

function handleDeptOptionsChange(options: any[]) {
  deptOptions.value = mergeOptionsById(deptOptions.value, options);
}

function loadItemDeptSimplePage(params: Record<string, any>) {
  const { warehouseId, ...rest } = params || {};
  return warehouseId
    ? getPurchaseInWarehouseDeptSimplePage({ ...rest, warehouseId })
    : getPurchaseInDeptSimplePage(rest as any);
}

function findDeptName(
  options: any[],
  deptId?: null | number,
): string | undefined {
  if (deptId === null || deptId === undefined) {
    return undefined;
  }
  const targetDeptId = String(deptId);
  for (const option of options ?? []) {
    if (String(option?.id) === targetDeptId) {
      return isMissingDisplayName(option?.name, deptId)
        ? undefined
        : option?.name;
    }
    const childDeptName: string | undefined = findDeptName(
      option?.children ?? [],
      deptId,
    );
    if (childDeptName) {
      return childDeptName;
    }
  }
  return undefined;
}

function fillMissingDeptIdFromWarehouse() {
  tableData.value.forEach((item) => {
    item.deptId ??= resolveWarehouseDeptId(item.warehouseId);
  });
}

function isMissingDisplayName(value: unknown, id: unknown) {
  return (
    value === undefined ||
    value === null ||
    value === '' ||
    value === CURRENT_SELECT_LABEL_PLACEHOLDER ||
    String(value) === String(id)
  );
}

function mergeWarehouseOptionFromRow(row: ErpPurchaseInApi.PurchaseInItem) {
  if (
    !row.warehouseId ||
    isMissingDisplayName(row.warehouseName, row.warehouseId)
  ) {
    return;
  }
  warehouseOptions.value = mergeOptionsById(warehouseOptions.value, [
    {
      deptId: row.deptId,
      deptName: (row as any).deptName,
      id: row.warehouseId,
      name: row.warehouseName,
    },
  ]);
}

function mergeDeptOptionFromRow(row: ErpPurchaseInApi.PurchaseInItem) {
  if (!row.deptId || isMissingDisplayName((row as any).deptName, row.deptId)) {
    return;
  }
  deptOptions.value = mergeOptionsById(deptOptions.value, [
    {
      id: row.deptId,
      name: (row as any).deptName,
    },
  ]);
}

function applyCachedSelectLabels(rows: ErpPurchaseInApi.PurchaseInItem[]) {
  let changed = false;
  rows.forEach((row) => {
    const warehouse = warehouseOptions.value.find(
      (item) =>
        String(item.id) === String(row.warehouseId) &&
        isResolvedSelectOption(item),
    );
    if (warehouse) {
      if (isMissingDisplayName(row.warehouseName, row.warehouseId)) {
        row.warehouseName = warehouse.name;
        (row as any).warehouseNameLabel = warehouse.name;
        changed = true;
      }
      if (!row.deptId && warehouse.deptId) {
        row.deptId = warehouse.deptId;
        changed = true;
      }
      if (
        row.deptId &&
        isMissingDisplayName((row as any).deptName, row.deptId) &&
        warehouse.deptName
      ) {
        (row as any).deptName = warehouse.deptName;
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
  rows: ErpPurchaseInApi.PurchaseInItem[],
) {
  const sequence = ++itemSelectLabelHydrateSequence;
  rows.forEach((row) => {
    mergeWarehouseOptionFromRow(row);
    mergeDeptOptionFromRow(row);
  });
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
    const warehouseMap = new Map<string, any>();
    try {
      const page = await getPurchaseWarehouseSimplePage({
        pageNo: 1,
        pageSize: Math.max(200, warehouseIds.length),
      });
      (page?.list ?? []).forEach((warehouse) => {
        if (warehouse?.id) {
          warehouseMap.set(String(warehouse.id), warehouse);
        }
      });
    } catch {
      // 当前值回显兜底失败时不打断表单使用。
    }
    const missingWarehouseIds = warehouseIds.filter(
      (id) => !warehouseMap.has(String(id)),
    );
    const detailWarehouses = await Promise.all(
      missingWarehouseIds.map((id) => getWarehouse(id).catch(() => undefined)),
    );
    detailWarehouses.forEach((warehouse) => {
      if (warehouse?.id) {
        warehouseMap.set(String(warehouse.id), warehouse);
      }
    });
    if (sequence !== itemSelectLabelHydrateSequence) {
      return;
    }
    const warehouses = Array.from(warehouseMap.values());
    if (warehouses.length > 0) {
      warehouseOptions.value = mergeOptionsById(
        warehouseOptions.value,
        warehouses,
      );
      changed = applyCachedSelectLabels(rows) || changed;
    }
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
    const availableDepts = depts
      .filter((dept) => dept?.id)
      .map((dept) => ({ id: dept!.id, name: dept!.name }));
    if (availableDepts.length > 0) {
      deptOptions.value = mergeOptionsById(deptOptions.value, availableDepts);
      changed = applyCachedSelectLabels(rows) || changed;
    }
  }

  if (changed && sequence === itemSelectLabelHydrateSequence) {
    await refreshItemGrid({ reloadData: false });
  }
}

function ensureRowSeq(row: ErpPurchaseInApi.PurchaseInItem) {
  if (row.seq === undefined || row.seq === null) {
    row.seq = nextItemSeq++;
    return;
  }
  nextItemSeq = Math.max(nextItemSeq, Number(row.seq) + 1);
}

const itemRowKeyManager = createPurchaseItemClientRowKeyManager('purchase-in');

function ensureRowIdentity(row: ErpPurchaseInApi.PurchaseInItem) {
  ensureRowSeq(row);
  return itemRowKeyManager.ensureRowKey(row);
}

function ensureRowsIdentity(rows: ErpPurchaseInApi.PurchaseInItem[]) {
  rows.forEach((row) => ensureRowSeq(row));
  itemRowKeyManager.ensureRowKeys(rows);
}

function getItemRowKey(row?: ErpPurchaseInApi.PurchaseInItem) {
  if (!row) return undefined;
  return row.clientRowKey || ensureRowIdentity(row);
}

function setActiveItemRow(row?: ErpPurchaseInApi.PurchaseInItem) {
  const key = getItemRowKey(row);
  if (key) {
    activeItemRowKey.value = key;
  }
}

const activeItemRow = computed(() =>
  tableData.value.find(
    (item) => getItemRowKey(item) === activeItemRowKey.value,
  ),
);

function getProductInputValue(row: ErpPurchaseInApi.PurchaseInItem) {
  const keyword = (row as any).__stockKeyword;
  return keyword === undefined || keyword === null
    ? row.productName || ''
    : String(keyword);
}

function isAnyStockSelectorOpen() {
  return inlineStockSelectorOpen.value;
}

function handleProductKeywordInput(
  row: ErpPurchaseInApi.PurchaseInItem,
  value: string,
) {
  (row as any).__stockKeyword = value;
}

function escapeAttrValue(value: string) {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

function focusProductNameInput(row: ErpPurchaseInApi.PurchaseInItem) {
  if (props.disabled) {
    return false;
  }
  const rowKey = getItemRowKey(row);
  const selector = rowKey
    ? `${PURCHASE_IN_PRODUCT_SELECT_INPUT_SELECTOR}[data-purchase-inline-stock-row-key="${escapeAttrValue(rowKey)}"]`
    : PURCHASE_IN_PRODUCT_SELECT_INPUT_SELECTOR;
  return focusFirstEditableInput(itemTableWrapRef.value, selector);
}

function getItemRowClassName({ row }: { row: any }) {
  const classes: string[] = [];
  if (getGiftValue(row)) {
    classes.push('erp-gift-row');
  }
  if (getItemRowKey(row) === activeItemRowKey.value) {
    classes.push('purchase-document-item-row--active');
  }
  return classes.join(' ');
}

function canBatchUpdateItemRow(row?: ErpPurchaseInApi.PurchaseInItem) {
  return (
    Boolean(row?.productId) &&
    (!props.disabled || Boolean(row?.id)) &&
    Number(row?.returnCount || 0) <= 0 &&
    !row?.hasInvoice &&
    !row?.hasStockInBill &&
    !row?.adjusted &&
    !row?.adjustId
  );
}

function canDeleteItemRow(row?: ErpPurchaseInApi.PurchaseInItem) {
  return !props.disabled && Boolean(getItemRowKey(row));
}

function canSelectItemRow(row?: ErpPurchaseInApi.PurchaseInItem) {
  return props.disabled ? canBatchUpdateItemRow(row) : canDeleteItemRow(row);
}

function parseCountText(text: unknown) {
  const value = String(text ?? '').trim();
  if (!value) return { ok: false, message: '请输入入库数量' } as const;
  if (!/^\d+(?:\.\d{0,6})?$/.test(value)) {
    return {
      ok: false,
      message: '入库数量必须为数字，最多 6 位小数',
    } as const;
  }
  return { ok: true, value: Number(value) } as const;
}

function emitItemsUpdate(skipReload = false) {
  isInternalUpdate = skipReload;
  emit(
    'update:items',
    tableData.value.map((item) => sanitizeItemForEmit(item)),
  );
}

function sanitizeItemForEmit(item: ErpPurchaseInApi.PurchaseInItem) {
  const {
    __stockKeyword: _stockKeyword,
    countText: _countText,
    priceText: _priceText,
    productCostAmount: _productCostAmount,
    productCostPrice: _productCostPrice,
    taxPercentText: _taxPercentText,
    wholeQtyText: _wholeQtyText,
    ...rest
  } = item as any;
  return rest;
}

const summaries = computed(() => ({
  count: purchaseDecimalAdd(...tableData.value.map((item) => item.count || 0)),
  totalProductPrice: purchaseDecimalAdd(
    ...tableData.value.map((item) => item.totalProductPrice || 0),
  ),
  taxPrice: 0,
  totalPrice: purchaseDecimalAdd(
    ...tableData.value.map((item) => item.totalPrice || 0),
  ),
}));

function getLineAmount(item: ErpPurchaseInApi.PurchaseInItem) {
  if (item.totalProductPrice !== undefined && item.totalProductPrice !== null) {
    return Number(item.totalProductPrice) || 0;
  }
  return purchaseDecimalMultiply(item.productPrice || 0, item.count || 0);
}

function getCostPrice(amount: number, count?: number, fallbackPrice?: number) {
  const safeCount = Number(count || 0);
  if (safeCount === 0) {
    return fallbackPrice;
  }
  return purchaseDecimalDivide(amount, safeCount);
}

function applyPurchaseCostDisplay() {
  tableData.value.forEach((item) => {
    const lineAmount = getLineAmount(item);
    item.productCostAmount = lineAmount;
    item.productCostPrice = getCostPrice(
      lineAmount,
      item.count,
      item.productPrice,
    );
  });
  const totalFreight = Number(props.totalFreight || 0);
  if (props.freightType !== '我方自付' || totalFreight <= 0) {
    return;
  }
  const positiveCountItems = tableData.value.filter(
    (item) => Number(item.count || 0) > 0,
  );
  const totalCount = purchaseDecimalAdd(
    ...positiveCountItems.map((item) => item.count || 0),
  );
  if (totalCount <= 0) {
    return;
  }
  let allocated = 0;
  positiveCountItems.forEach((item, index) => {
    const lineAmount = getLineAmount(item);
    const count = Number(item.count || 0);
    const freightShare =
      index === positiveCountItems.length - 1
        ? purchaseDecimalSubtract(totalFreight, allocated)
        : purchaseDecimalMultiply(
            totalFreight,
            purchaseDecimalDivide(count, totalCount),
          );
    if (index !== positiveCountItems.length - 1) {
      allocated = purchaseDecimalAdd(allocated, freightShare);
    }
    const costAmount = purchaseDecimalAdd(lineAmount, freightShare);
    item.productCostAmount = costAmount;
    item.productCostPrice = getCostPrice(
      costAmount,
      item.count,
      item.productPrice,
    );
  });
}

function buildItemColumns(
  hiddenFields = props.hiddenFields,
  rows = displayTableData.value,
): NonNullable<
  VxeTableGridOptions<ErpPurchaseInApi.PurchaseInItem>['columns']
> {
  const columns = preparePurchaseDocumentItemColumns(
    (useFormItemColumns(tableData.value, props.disabled, hiddenFields) ||
      []) as unknown as Parameters<
      typeof preparePurchaseDocumentItemColumns
    >[0],
    {
      editable: !props.disabled,
      rows,
      trailingFlexibleColumnMinWidth: 150,
    },
  );
  if (canShowItemSelection.value) {
    columns.unshift({
      fixed: 'left',
      type: 'checkbox',
      width: 44,
    } as any);
  }
  return columns as unknown as NonNullable<
    VxeTableGridOptions<ErpPurchaseInApi.PurchaseInItem>['columns']
  >;
}

async function refreshItemColumns(
  rows: ErpPurchaseInApi.PurchaseInItem[] = displayTableData.value,
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

function clearBatchItemSelection() {
  selectedBatchItemRows.value = [];
  gridApi.grid?.clearCheckboxRow?.();
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

async function refreshItemGrid(options: { reloadData?: boolean } = {}) {
  const { reloadData = true } = options;
  const displayData = getDisplayTableData();
  const columns = fitPurchaseDocumentColumnsToWidth(
    applyPurchaseDocumentListColumnCustomization(
      buildItemColumns(props.hiddenFields, displayData),
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
    buildItemColumns(props.hiddenFields, displayData),
  );
  await syncPurchaseDocumentOperationColumn(gridApi.grid, columns);
  releasePurchaseDocumentTrailingColumnResize(
    gridApi.grid?.getFullColumns?.() ?? [],
  );
  await gridApi.grid?.refreshColumn?.();
  if (activeItemSort.value) {
    await gridApi.grid.setSort(activeItemSort.value);
  }
  if (!props.itemPageLoading) {
    gridApi.setLoading(false);
  }
  if (!reloadData) {
    return;
  }
  await nextTick();
  await gridApi.grid.reloadData(displayData);
  if (activeItemSort.value) {
    await gridApi.grid.setSort(activeItemSort.value);
  }
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

function handleOpenBatchUpdateItems() {
  const selectedCount = selectedBatchItemCount.value;
  if (selectedCount === 0) {
    message.warning('请先勾选可批量修改的入库明细');
    return;
  }
  batchUpdateItemsModalApi
    .setData({
      hiddenFields: props.hiddenFields,
      inId: canUseServerBatchUpdate.value ? props.inId : undefined,
      itemCount: selectedCount,
      itemIds: canUseServerBatchUpdate.value ? selectedBatchItemIds.value : [],
      mode: canUseServerBatchUpdate.value ? 'server' : 'local',
    })
    .open();
}

function buildBatchUpdatedItems(payload: BatchUpdateItemsPayload) {
  const selectedKeys = new Set(selectedBatchItemKeys.value);
  return tableData.value.map((item) => {
    if (!selectedKeys.has(getItemRowKey(item))) {
      return item;
    }
    return {
      ...item,
      deptId: payload.deptId ?? item.deptId,
      warehouseId: payload.warehouseId ?? item.warehouseId,
    };
  });
}

function hasDuplicateBatchUpdatedItems(payload: BatchUpdateItemsPayload) {
  const duplicateKeys = new Set<string>();
  return buildBatchUpdatedItems(payload).some((item) => {
    const duplicateKey = buildPurchaseItemDuplicateKey(item);
    if (!duplicateKey) {
      return false;
    }
    if (duplicateKeys.has(duplicateKey)) {
      return true;
    }
    duplicateKeys.add(duplicateKey);
    return false;
  });
}

async function applyLocalBatchUpdateItems(
  payload: BatchUpdateItemsPayload,
  options: ApplyBatchUpdateItemsOptions = {},
) {
  const { showMessage = true, validateDuplicate = true } = options;
  if (!payload.warehouseId && !payload.deptId) {
    return false;
  }
  if (validateDuplicate && hasDuplicateBatchUpdatedItems(payload)) {
    message.warning('批量修改后存在产品、仓库、赠品标识重复，请调整后再操作');
    return false;
  }

  const selectedCount = selectedBatchItemKeys.value.length;
  const selectedKeys = new Set(selectedBatchItemKeys.value);
  const stockCountTasks: Promise<void>[] = [];
  tableData.value.forEach((row) => {
    if (!selectedKeys.has(getItemRowKey(row))) {
      return;
    }
    const warehouseChanged =
      payload.warehouseId !== undefined &&
      row.warehouseId !== payload.warehouseId;
    if (payload.warehouseId !== undefined) {
      row.warehouseId = payload.warehouseId;
    }
    if (payload.deptId !== undefined) {
      row.deptId = payload.deptId;
      (row as any).deptName = findDeptName(deptOptions.value, payload.deptId);
    }
    initRow(row);
    setCountText(row);
    if (warehouseChanged && row.productId && row.warehouseId) {
      stockCountTasks.push(
        getWarehouseStockCount({
          productId: row.productId,
          warehouseId: row.warehouseId,
        }).then((stockCount) => {
          row.stockCount = stockCount || 0;
        }),
      );
    }
  });
  await Promise.all(stockCountTasks);
  emitItemsUpdate(true);
  if (activeItemSort.value) {
    await nextTick();
    await refreshItemGrid();
  } else {
    await nextTick();
    await refreshItemGrid({ reloadData: false });
  }
  if (showMessage) {
    message.success(`已批量更新 ${selectedCount} 条入库明细`);
  }
  return true;
}

async function handleBatchUpdateItemsSuccess(
  payload?: BatchUpdateItemsPayload,
) {
  if (payload?.mode === 'local') {
    await applyLocalBatchUpdateItems(payload);
  } else {
    if (payload?.warehouseId || payload?.deptId) {
      await applyLocalBatchUpdateItems(payload, {
        showMessage: false,
        validateDuplicate: false,
      });
    }
    emit('batch-update-success');
  }
  clearBatchItemSelection();
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

watch(
  () => [
    summaries.value.count,
    summaries.value.totalProductPrice,
    summaries.value.totalPrice,
    props.feeAmount,
  ],
  () => {
    if (props.remotePaging) {
      return;
    }
    emit('update:summary', {
      totalCount: summaries.value.count,
      totalProductPrice: summaries.value.totalProductPrice,
      totalTaxPrice: 0,
      totalPrice: summaries.value.totalProductPrice + (props.feeAmount || 0),
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
    data: displayTableData.value,
    height: ITEM_TABLE_HEIGHT,
    id: 'erp-purchase-in-item-list-v1',
    autoResize: true,
    fit: false,
    border: true,
    rowConfig: { keyField: 'clientRowKey', isHover: true },
    rowClassName: getItemRowClassName,
    checkboxConfig: {
      checkMethod: ({ row }: { row: ErpPurchaseInApi.PurchaseInItem }) =>
        canSelectItemRow(row),
    },
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
    checkboxAll: ({
      records,
    }: {
      records: ErpPurchaseInApi.PurchaseInItem[];
    }) => {
      selectedBatchItemRows.value = records.filter(canBatchUpdateItemRow);
    },
    checkboxChange: ({
      records,
    }: {
      records: ErpPurchaseInApi.PurchaseInItem[];
    }) => {
      selectedBatchItemRows.value = records.filter(canBatchUpdateItemRow);
    },
    cellClick: ({ row }: { row: ErpPurchaseInApi.PurchaseInItem }) => {
      setActiveItemRow(row);
    },
    currentRowChange: ({ row }: { row?: ErpPurchaseInApi.PurchaseInItem }) => {
      setActiveItemRow(row);
    },
  },
});

async function syncItemsFromProps(
  items?: ErpPurchaseInApi.PurchaseInItem[],
  options: { force?: boolean } = {},
) {
  if (!items) return;
  if (items === lastSyncedItemsSource) return;
  lastSyncedItemsSource = items;
  if (isInternalUpdate && !options.force) {
    isInternalUpdate = false;
    return;
  }
  isInternalUpdate = false;
  const nextItems = items.map((item) => ({ ...item }));
  ensureRowsIdentity(nextItems);
  nextItems.forEach((item) => initRow(item));
  tableData.value = nextItems;
  tableData.value.forEach((item) => setCountText(item));
  if (!props.remotePaging) {
    const pageCount = Math.max(
      1,
      Math.ceil(tableData.value.length / localItemPage.value.pageSize),
    );
    if (localItemPage.value.pageNo > pageCount) {
      localItemPage.value.pageNo = pageCount;
    }
  }
  applyPurchaseCostDisplay();
  await refreshItemGrid({ reloadData: false });
  void hydrateMissingCurrentSelectLabels(tableData.value);
  await gridApi.grid.reloadColumn(
    buildItemColumns(props.hiddenFields, displayTableData.value),
  );
  if (activeItemSort.value) await gridApi.grid.setSort(activeItemSort.value);
  clearBatchItemSelection();
}

watch(
  () => props.items,
  (items) => {
    void syncItemsFromProps(items);
  },
  { immediate: true },
);

watch(
  () => props.hiddenFields,
  async (hiddenFields) => {
    await nextTick();
    await gridApi.grid.reloadColumn(
      buildItemColumns(hiddenFields, displayTableData.value),
    );
    if (activeItemSort.value) await gridApi.grid.setSort(activeItemSort.value);
    clearBatchItemSelection();
  },
  { deep: true },
);

watch(
  () => [props.freightType, props.totalFreight],
  async () => {
    applyPurchaseCostDisplay();
    await refreshItemGrid({ reloadData: false });
  },
);

watch(
  () => [props.disabled, props.enableBatchEdit, props.inId],
  async () => {
    await nextTick();
    await gridApi.grid.reloadColumn(
      buildItemColumns(props.hiddenFields, displayTableData.value),
    );
    if (activeItemSort.value) await gridApi.grid.setSort(activeItemSort.value);
    clearBatchItemSelection();
  },
);

watch(
  () => props.itemPageLoading,
  (loading) => {
    gridApi.setLoading(Boolean(loading));
  },
  { immediate: true },
);

function handleDelete(row: ErpPurchaseInApi.PurchaseInItem) {
  deleteItemRows([row]);
}

function deleteItemRows(rows: ErpPurchaseInApi.PurchaseInItem[]) {
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
    const pageCount = Math.max(
      1,
      Math.ceil(tableData.value.length / localItemPage.value.pageSize),
    );
    if (localItemPage.value.pageNo > pageCount) {
      localItemPage.value.pageNo = pageCount;
    }
  }
  clearBatchItemSelection();
  applyPurchaseCostDisplay();
  emitItemsUpdate(false);
  void nextTick(refreshItemGrid);
}

function handleBatchDeleteItems() {
  const rows = selectedDeleteItemRows.value;
  const selectedCount = selectedDeleteItemCount.value;
  if (selectedCount === 0) {
    message.warning('请先勾选要删除的入库明细');
    return;
  }
  AntModal.confirm({
    cancelText: '取消',
    okText: '删除',
    okType: 'danger',
    title: `确认删除选中的 ${selectedCount} 条入库明细吗？`,
    onOk: () => {
      deleteItemRows(rows);
      message.success(`已删除 ${selectedCount} 条入库明细`);
    },
  });
}

async function handleWarehouseChange(
  row: ErpPurchaseInApi.PurchaseInItem,
  _value?: any,
  option?: any,
) {
  const selected = Array.isArray(option) ? option[0] : option;
  if (selected?.deptId) {
    row.deptId = selected.deptId;
    (row as any).deptName = selected.deptName;
  } else {
    row.deptId = resolveWarehouseDeptId(row.warehouseId);
  }
  const stockCount = await getWarehouseStockCount({
    productId: row.productId!,
    warehouseId: row.warehouseId!,
  });
  row.stockCount = stockCount || 0;
  handleRowChange(row);
}

function handleRowChange(row: any) {
  ensureRowIdentity(row);
  initRow(row);
  setCountText(row);
  const rowKey = getItemRowKey(row);
  const index = tableData.value.findIndex(
    (item) => getItemRowKey(item) === rowKey,
  );
  if (index === -1) {
    tableData.value.push(row);
  } else {
    tableData.value[index] = row;
  }
  applyPurchaseCostDisplay();
  emitItemsUpdate(index !== -1);
  if (activeItemSort.value) {
    void nextTick(refreshItemGrid);
  }
}

function handleWholeQtyChange(row: any) {
  const wholeQty = Number(row.wholeQty) || 0;
  const packageQty = Number(row.packageQty) || 1;
  row.count = wholeQty * packageQty;
  handleRowChange(row);
}

function parseBusinessNumberText(
  value: unknown,
  label: string,
  options: {
    allowEmpty?: boolean;
    decimals: number;
    max?: number;
    min?: number;
  },
) {
  const text = String(value ?? '').trim();
  if (!text) {
    return options.allowEmpty
      ? ({ ok: true, value: undefined } as const)
      : ({ ok: false, message: `请输入${label}` } as const);
  }
  const decimals = options.decimals === 0 ? 0 : 6;
  const pattern = decimals === 0 ? /^\d+$/ : /^\d+(?:\.\d{0,6})?$/;
  if (!pattern.test(text)) {
    return {
      ok: false,
      message:
        decimals === 0
          ? `${label}必须为整数`
          : `${label}必须为数字，最多 6 位小数`,
    } as const;
  }
  const parsed = Number(text);
  if (options.min !== undefined && parsed < options.min) {
    return { ok: false, message: `${label}不能小于 ${options.min}` } as const;
  }
  if (options.max !== undefined && parsed > options.max) {
    return { ok: false, message: `${label}不能大于 ${options.max}` } as const;
  }
  return { ok: true, value: parsed } as const;
}

function handleCountChange(row: any) {
  const parsed = parseCountText(row.countText);
  if (!parsed.ok) {
    message.warning(parsed.message);
    setCountText(row);
    return;
  }
  row.count = parsed.value;
  if (row.count <= 0) {
    message.warning('入库数量必须大于 0');
    row.count = 1;
  }
  handleRowChange(row);
}

function handleProductPriceChange(row: any) {
  if (row.gift) {
    row.productPrice = 0;
  } else if (
    row.productPrice !== null &&
    row.productPrice !== undefined &&
    row.productPrice <= 0
  ) {
    message.warning('非赠品入库单价必须大于 0');
    row.productPrice = undefined;
  }
  handleRowChange(row);
}

function handleProductPriceBlur(row: any) {
  if (row.gift) {
    row.productPrice = 0;
    handleRowChange(row);
    return;
  }
  const parsed = parseBusinessNumberText(row.priceText, '入库单价', {
    decimals: 6,
    min: 0.000001,
  });
  if (!parsed.ok) {
    message.warning(parsed.message);
    setBusinessNumberTexts(row);
    return;
  }
  row.productPrice = parsed.value;
  handleProductPriceChange(row);
}

function handleWholeQtyBlur(row: any) {
  const parsed = parseBusinessNumberText(row.wholeQtyText, '整件数', {
    allowEmpty: true,
    decimals: 0,
    min: 0,
  });
  if (!parsed.ok) {
    message.warning(parsed.message);
    setBusinessNumberTexts(row);
    return;
  }
  row.wholeQty = parsed.value;
  handleWholeQtyChange(row);
}

function handleTaxPercentBlur(row: any) {
  const parsed = parseBusinessNumberText(row.taxPercentText, '税率', {
    allowEmpty: true,
    decimals: 6,
    max: 100,
    min: 0,
  });
  if (!parsed.ok) {
    message.warning(parsed.message);
    setBusinessNumberTexts(row);
    return;
  }
  row.taxPercent = parsed.value;
  handleRowChange(row);
}

function handleGiftChange(row: ErpPurchaseInApi.PurchaseInItem) {
  if (row.gift) {
    if (Number(row.productPrice) > 0) {
      nonGiftPriceCache.set(row, Number(row.productPrice));
    }
    row.productPrice = 0;
  } else {
    const cachedPrice = nonGiftPriceCache.get(row);
    if (Number(row.productPrice) <= 0 && cachedPrice) {
      row.productPrice = cachedPrice;
    }
  }
  handleRowChange(row);
}

function initRow(row: ErpPurchaseInApi.PurchaseInItem) {
  row.gift = !!row.gift;
  (row as any).batchNoEnabled = isBatchNoEnabled((row as any).batchNoEnabled);
  if (!isBatchNoEnabled((row as any).batchNoEnabled)) {
    (row as any).batchNo = undefined;
  }
  if (!(row as any).packageQty || (row as any).packageQty <= 0) {
    (row as any).packageQty = 1;
  }
  if (row.gift) {
    row.productPrice = 0;
    row.totalProductPrice = 0;
    row.taxPrice = 0;
    row.totalPrice = 0;
  } else if (row.productPrice && row.count) {
    row.totalProductPrice = purchaseDecimalMultiply(
      row.productPrice,
      row.count,
    );
    row.taxPrice = 0;
    row.totalPrice = row.totalProductPrice;
  } else {
    row.totalProductPrice = 0;
    row.taxPrice = 0;
    row.totalPrice = 0;
  }
  setCountText(row);
  setBusinessNumberTexts(row);
}

function getItems() {
  return tableData.value.map((item) => sanitizeItemForEmit(item));
}

function validate(
  items = tableData.value,
  options: { requireItems?: boolean } = {},
) {
  if ((options.requireItems ?? true) && items.length === 0) {
    throw new Error('请先添加入库明细');
  }
  const duplicateKeys = new Set<string>();
  for (const [i, item] of items.entries()) {
    if (!item) continue;

    const lineNo = i + 1;
    const parsed = parseCountText((item as any).countText);
    if (!parsed.ok) {
      throw new Error(`第 ${lineNo} 行：${parsed.message}`);
    }
    item.count = parsed.value;
    if (item.gift) {
      item.productPrice = 0;
    } else {
      const price = parseBusinessNumberText(
        (item as any).priceText ?? item.productPrice,
        '入库单价',
        { decimals: 6, min: 0.000001 },
      );
      if (!price.ok) {
        throw new Error(`第 ${lineNo} 行：${price.message}`);
      }
      item.productPrice = price.value!;
    }
    const wholeQty = parseBusinessNumberText(
      (item as any).wholeQtyText ?? item.wholeQty,
      '整件数',
      { allowEmpty: true, decimals: 0, min: 0 },
    );
    if (!wholeQty.ok) {
      throw new Error(`第 ${lineNo} 行：${wholeQty.message}`);
    }
    item.wholeQty = wholeQty.value;
    const taxPercent = parseBusinessNumberText(
      (item as any).taxPercentText ?? item.taxPercent,
      '税率',
      { allowEmpty: true, decimals: 6, max: 100, min: 0 },
    );
    if (!taxPercent.ok) {
      throw new Error(`第 ${lineNo} 行：${taxPercent.message}`);
    }
    item.taxPercent = taxPercent.value;
    initRow(item);
    if ((item as any).orderItemId && (item as any).totalCount !== undefined) {
      const maxCount =
        Number((item as any).totalCount || 0) -
        Number((item as any).inCount || 0);
      if (Number(item.count || 0) > maxCount) {
        throw new Error(
          `第 ${lineNo} 行：本次入库数量不能超过可入库数量 ${formatPurchaseDecimal(maxCount)}`,
        );
      }
    }
    if (!(item as any).warehouseId) {
      throw new Error(`第 ${lineNo} 行：请选择仓库`);
    }
    const duplicateKey = buildPurchaseItemDuplicateKey(item);
    if (duplicateKey) {
      if (duplicateKeys.has(duplicateKey)) {
        throw new Error(`第 ${lineNo} 行：产品、仓库、赠品标识重复`);
      }
      duplicateKeys.add(duplicateKey);
    }
    if (!item.count || item.count <= 0) {
      throw new Error(`第 ${lineNo} 行：请输入大于 0 的入库数量`);
    }
    if (!item.gift && (!item.productPrice || item.productPrice <= 0)) {
      throw new Error(`第 ${lineNo} 行：非赠品入库单价必须大于 0`);
    }
  }
  emitItemsUpdate(true);
}

function createBlankItemRow() {
  const row = {
    count: 1,
    gift: false,
    packageQty: 1,
    remark: '',
  } as ErpPurchaseInApi.PurchaseInItem;
  ensureRowIdentity(row);
  initRow(row);
  setCountText(row);
  return row;
}

const itemRowFocusController = createErpItemRowFocusController({
  focusField: (row: ErpPurchaseInApi.PurchaseInItem, field) =>
    field === 'product' ? focusProductNameInput(row) : focusItemCountInput(row),
  getAllRows: () => tableData.value,
  getDisplayedRows: getDisplayTableData,
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
    emit('append-items', [row], 'product');
    return;
  }
  tableData.value = [...tableData.value, row];
  emitItemsUpdate(false);
  await itemRowFocusController.focus(row, 'product');
}

function handleOpenImport() {
  emit('import');
}

function buildPurchaseInItemFromStock(
  p: ErpStockApi.Stock,
): ErpPurchaseInApi.PurchaseInItem {
  const productPrice = p.lastPurchasePrice ?? p.currentPrice ?? 0;
  const row = {
    productId: p.productId,
    productName: p.productName,
    productCode: p.productCode,
    productUnitId: p.unitId,
    productUnitName: p.unitName,
    productBarCode: p.productBarCode,
    barCode: p.productBarCode,
    vehicleModel: p.vehicleModel,
    originPlace: p.originPlace,
    standard: p.standard,
    featureCode: p.featureCode,
    drawingNo: p.drawingNo,
    factoryCode: p.factoryCode,
    brand: p.brand,
    packageQty: p.packageQty ?? 1,
    warehouseId: p.warehouseId,
    deptId: p.deptId ?? resolveWarehouseDeptId(p.warehouseId),
    warehouseName: p.warehouseName,
    stockCount: p.count ?? 0,
    count: 1,
    gift: false,
    productPrice,
    productPurchasePrice: p.purchasePrice ?? p.productPurchasePrice,
    salePrice: p.salePrice,
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
    totalProductPrice: productPrice,
    taxPrice: 0,
    totalPrice: productPrice,
    batchNo: p.batchNo,
    batchNoEnabled: isBatchNoEnabled(p.batchNoEnabled),
    remark: '',
  } as ErpPurchaseInApi.PurchaseInItem;
  ensureRowIdentity(row);
  initRow(row);
  setCountText(row);
  return row;
}

function buildReplacementPurchaseInItemFromStock(
  stock: ErpStockApi.Stock,
  targetRow: ErpPurchaseInApi.PurchaseInItem,
) {
  const row = buildPurchaseInItemFromStock(stock);
  row.id = targetRow.id;
  row.seq = targetRow.seq ?? row.seq;
  row.clientRowKey = targetRow.clientRowKey ?? row.clientRowKey;
  if ((targetRow as any).inId !== undefined) {
    (row as any).inId = (targetRow as any).inId;
  }
  return row;
}

async function insertStockProducts(
  products: ErpStockApi.Stock[],
  options: {
    targetRow?: ErpPurchaseInApi.PurchaseInItem;
  } = {},
) {
  if (!products || products.length === 0) return;
  const targetRowKey = getItemRowKey(options.targetRow);
  const existedKeys = new Set(
    (tableData.value ?? [])
      .filter((item) => getItemRowKey(item) !== targetRowKey)
      .map((item) => buildPurchaseItemDuplicateKey(item)),
  );
  const selected = products.filter((product) => {
    const key = buildPurchaseItemDuplicateKey({
      productId: product.productId,
      warehouseId: product.warehouseId,
      gift: false,
    });
    if (key && existedKeys.has(key)) {
      message.warning(
        `产品【${product.productName || product.productCode}】在该仓库已存在`,
      );
      return false;
    }
    existedKeys.add(key);
    return true;
  });
  if (selected.length === 0) return;

  const targetIndex = targetRowKey
    ? tableData.value.findIndex((item) => getItemRowKey(item) === targetRowKey)
    : -1;
  let activeRow: ErpPurchaseInApi.PurchaseInItem;
  if (targetIndex >= 0 && options.targetRow) {
    const [firstStock, ...additionalStocks] = selected;
    const replacementRow = buildReplacementPurchaseInItemFromStock(
      firstStock!,
      options.targetRow,
    );
    const additionalRows = additionalStocks.map((stock) =>
      buildPurchaseInItemFromStock(stock),
    );
    tableData.value.splice(targetIndex, 1, replacementRow);
    if (additionalRows.length > 0 && !props.remotePaging) {
      tableData.value = [...tableData.value, ...additionalRows];
    }
    activeRow = replacementRow;
    if (props.remotePaging && additionalRows.length > 0) {
      emit('append-items', additionalRows, 'count', replacementRow);
    }
  } else {
    const newRows = selected.map((stock) =>
      buildPurchaseInItemFromStock(stock),
    );
    if (props.remotePaging) {
      emit('append-items', newRows, 'count');
      return;
    }
    tableData.value = [...tableData.value, ...newRows];
    activeRow = newRows[0]!;
  }
  setActiveItemRow(activeRow);
  emitItemsUpdate(false);
  await itemRowFocusController.focus(activeRow, 'count');
}

function handleInlineStockSelected(
  targetRow: ErpPurchaseInApi.PurchaseInItem,
  rows: ErpStockApi.Stock[],
) {
  void insertStockProducts(rows, { targetRow });
}

function handleInlineStockOpenChange(open: boolean) {
  inlineStockSelectorOpen.value = open;
}

function focusFirstItemCountInput() {
  if (props.disabled) {
    return false;
  }
  return focusFirstEditableInput(
    itemTableWrapRef.value,
    PURCHASE_IN_ITEM_COUNT_INPUT_SELECTOR,
  );
}

function focusItemCountInput(row: ErpPurchaseInApi.PurchaseInItem) {
  return focusEditableInputByRowKey(
    itemTableWrapRef.value,
    PURCHASE_IN_ITEM_COUNT_INPUT_SELECTOR,
    getItemRowKey(row),
  );
}

function handleItemInputPressEnter(event: KeyboardEvent) {
  const enterFocusResult = focusNextInputOnEnter(event);
  if (enterFocusResult === 'last-input') {
    emit('request-submit', event);
  }
}

function togglePriceReferenceOverlay() {
  priceReferenceOpen.value = !priceReferenceOpen.value;
}

function handleShortcut(event: KeyboardEvent) {
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
  if (priceReferenceOpen.value) {
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
  if (!isShortcutListening) {
    return;
  }
  window.removeEventListener('keydown', handleShortcut, true);
  window.removeEventListener('keyup', handleShortcutKeyup, true);
  isShortcutListening = false;
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

function handleShortcutProductUpdated(row: any) {
  handleRowChange(row);
}

async function reloadItemsFromProps() {
  await syncItemsFromProps(props.items, { force: true });
}

function focusItemRow(
  row: ErpPurchaseInApi.PurchaseInItem,
  field: ErpItemRowFocusField,
) {
  return itemRowFocusController.focus(row, field);
}

defineExpose({
  clearItemSort,
  focusFirstItemCountInput,
  focusItemRow,
  getItems,
  reloadItemsFromProps,
  validate,
});

onMounted(() => {
  fillMissingDeptIdFromWarehouse();
  startShortcutListening();
  lastItemTableWidth = getItemTableWidth();
  window.addEventListener('resize', handleItemWindowResize);
});

onActivated(() => {
  startShortcutListening();
});

onDeactivated(() => {
  stopShortcutListening();
});

onBeforeUnmount(() => {
  stopShortcutListening();
  window.removeEventListener('resize', handleItemWindowResize);
  cancelAnimationFrame(itemResizeFrame);
});
</script>

<template>
  <div class="w-full">
    <div ref="itemTableWrapRef" class="purchase-in-item-table-wrap">
      <Grid class="w-full">
        <template #toolbar-buttons>
          <div class="purchase-in-item-toolbar-left">
            <div class="purchase-document-item-shortcut-hint">
              <span class="purchase-document-item-shortcut-hint__label">
                点击明细行后
              </span>
              <span><kbd>Space</kbd><b>采购历史</b></span>
              <span><kbd>Shift</kbd><b>采购订单历史</b></span>
              <span><kbd>S</kbd><b>销售历史</b></span>
              <span><kbd>Q</kbd><b>报价订单历史</b></span>
              <span><kbd>F</kbd><b>修改商品</b></span>
              <span
                class="purchase-document-item-shortcut-hint__divider"
              ></span>
              <span class="purchase-document-item-shortcut-hint__label">
                当前页
              </span>
              <span><kbd>W</kbd><b>全部价格</b></span>
              <span v-if="!disabled"><kbd>Insert</kbd><b>新增行</b></span>
            </div>
          </div>
        </template>
        <template #toolbar-tools>
          <div class="purchase-in-item-toolbar flex items-center gap-2">
            <div
              v-if="canShowItemSelection"
              class="purchase-in-item-batch-summary"
            >
              已选 {{ selectedItemCount }} 条
              <template v-if="canShowBatchUpdateItems">
                / 可批量修改 {{ selectedBatchItemCount }} 条 / 可改
                {{ batchEditableItemCount }} 条
              </template>
            </div>
            <Button
              v-if="!disabled"
              type="primary"
              class="purchase-in-item-action"
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
            <Button
              v-if="!disabled && showImport"
              type="primary"
              ghost
              class="purchase-in-item-action"
              @click="handleOpenImport"
            >
              导入明细
            </Button>
          </div>
        </template>
        <template #warehouseId="{ row }">
          <span v-if="disabled" class="purchase-in-item-readonly-cell">
            {{ getReadonlyWarehouseName(row) }}
          </span>
          <ErpLazyPageSelect
            v-else
            v-model:value="row.warehouseId"
            :api="getPurchaseWarehouseSimplePage"
            :options="getCurrentWarehouseOption(row)"
            label-field="name"
            value-field="id"
            :page-size="10"
            placeholder="请选择仓库"
            :disabled="disabled"
            popup-class-name="purchase-document-item-select-dropdown erp-candidate-focus-popup"
            class="w-full"
            @change="
              (value, option) => handleWarehouseChange(row, value, option)
            "
            @options-change="handleWarehouseOptionsChange"
          />
        </template>
        <template #deptId="{ row }">
          <span v-if="disabled" class="purchase-in-item-readonly-cell">
            {{ getReadonlyDeptName(row) }}
          </span>
          <ErpLazyPageSelect
            v-else
            v-model:value="row.deptId"
            :api="loadItemDeptSimplePage"
            :options="getCurrentDeptOption(row)"
            :params="{ warehouseId: row.warehouseId }"
            label-field="name"
            value-field="id"
            :page-size="10"
            placeholder="请选择所属部门"
            :disabled="disabled"
            allow-clear
            popup-class-name="purchase-document-item-select-dropdown erp-candidate-focus-popup"
            class="w-full"
            @change="
              (_, option) => {
                const selected = Array.isArray(option) ? option[0] : option;
                row.deptName = selected?.name;
                handleRowChange(row);
              }
            "
            @options-change="handleDeptOptionsChange"
          />
        </template>
        <template #productId="{ row }">
          <PurchaseInlineStockSelect
            settings-scope="purchase-in"
            v-if="!disabled"
            :value="getProductInputValue(row)"
            :row="row"
            :row-key="getItemRowKey(row)"
            :dept-id="props.deptId"
            :hidden-fields="props.hiddenFields"
            @open-change="handleInlineStockOpenChange"
            @select="(stocks) => handleInlineStockSelected(row, stocks)"
            @update:value="(value) => handleProductKeywordInput(row, value)"
          />
          <div v-else class="flex flex-col leading-tight">
            <span>{{ row.productName || '-' }}</span>
          </div>
        </template>
        <template #gift="{ row }">
          <Switch
            v-if="!disabled"
            v-model:checked="row.gift"
            checked-children="是"
            un-checked-children="否"
            @change="handleGiftChange(row)"
          />
          <Tag v-else-if="getGiftValue(row)" color="red">是</Tag>
          <span v-else>否</span>
        </template>
        <template #count="{ row }">
          <div class="purchase-in-count-cell">
            <Input
              v-if="!disabled"
              v-model:value="row.countText"
              :data-erp-item-row-key="getItemRowKey(row)"
              data-purchase-in-count-input="true"
              inputmode="decimal"
              autocomplete="off"
              @focus="setActiveItemRow(row)"
              @press-enter="handleItemInputPressEnter"
              @blur="handleCountChange(row)"
            />
            <span v-else>{{ formatPurchaseDecimal(row.count, '-') }}</span>
            <span
              v-if="getReturnedCount(row) > 0"
              class="purchase-in-returned-count"
            >
              退：{{ getReturnedCountText(row) }}
            </span>
          </div>
        </template>
        <template #productPrice="{ row }">
          <template v-if="disabled && isPriceItemHidden('productPrice')">
            <span>****</span>
          </template>
          <template
            v-else-if="
              row.originalProductPrice != null &&
              row.originalProductPrice !== row.productPrice
            "
          >
            <span
              >原：{{
                formatPurchaseAmount(row.originalProductPrice, '-')
              }}</span
            >
            <span class="text-red-500">
              【调：{{ formatPurchaseAmount(row.productPrice, '-') }}】
            </span>
          </template>
          <template v-else>
            <Input
              v-if="!disabled && !row.gift"
              v-model:value="row.priceText"
              class="w-full"
              inputmode="decimal"
              autocomplete="off"
              @press-enter="handleItemInputPressEnter"
              @blur="handleProductPriceBlur(row)"
            />
            <span v-else-if="row.gift" class="text-gray-400">0（赠品）</span>
            <span v-else>
              {{ formatPurchaseAmount(row.productPrice, '-') }}
            </span>
          </template>
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
        <template #wholeQty="{ row }">
          <Input
            v-if="!disabled"
            v-model:value="row.wholeQtyText"
            placeholder="请输入整件数"
            class="w-full"
            inputmode="numeric"
            autocomplete="off"
            @press-enter="handleItemInputPressEnter"
            @blur="handleWholeQtyBlur(row)"
          />
          <span v-else>{{ formatPurchaseDecimal(row.wholeQty) || '-' }}</span>
        </template>
        <template #warehousePosition="{ row }">
          <Input
            v-if="!disabled"
            v-model:value="row.warehousePosition"
            placeholder="请输入货架位"
            class="w-full"
            @press-enter="handleItemInputPressEnter"
          />
          <span v-else>{{ row.warehousePosition || '-' }}</span>
        </template>
        <template #barCode="{ row }">
          <Input
            v-if="!disabled"
            v-model:value="row.barCode"
            placeholder="请输入条形码"
            class="w-full"
            @press-enter="handleItemInputPressEnter"
          />
          <span v-else>{{ row.barCode || '-' }}</span>
        </template>
        <template #batchNo="{ row }">
          <Input
            v-if="!disabled"
            v-model:value="row.batchNo"
            :disabled="!isBatchNoEnabled(row.batchNoEnabled)"
            placeholder="批次"
            class="w-full"
            @press-enter="handleItemInputPressEnter"
          />
          <span v-else>{{ row.batchNo || '-' }}</span>
        </template>
        <template #drawingNo="{ row }">
          <Input
            v-if="!disabled"
            v-model:value="row.drawingNo"
            placeholder="图号"
            class="w-full"
            @press-enter="handleItemInputPressEnter"
          />
          <span v-else>{{ row.drawingNo || '-' }}</span>
        </template>
        <template #taxPercent="{ row }">
          <Input
            v-if="!disabled"
            v-model:value="row.taxPercentText"
            class="w-full"
            inputmode="decimal"
            autocomplete="off"
            @press-enter="handleItemInputPressEnter"
            @blur="handleTaxPercentBlur(row)"
          />
          <span v-else>{{ formatPurchaseDecimal(row.taxPercent) || '-' }}</span>
        </template>
        <template #adjustStatus="{ row }">
          <span
            v-if="
              row.adjusted ||
              (row.originalProductPrice != null &&
                row.originalProductPrice !== row.productPrice)
            "
          >
            已调价
          </span>
          <span v-else>-</span>
        </template>

        <template #invoiceStatus="{ row }">
          <span v-if="row.hasInvoice">已开票</span>
          <span v-else>-</span>
        </template>

        <template #returnStatus="{ row }">
          <span>{{ getReturnStatusLabel(row) }}</span>
        </template>
        <template #stockInBillStatus="{ row }">
          <Tag :color="getStockInBillTagColor(row.stockInBillStatus)">
            {{
              row.stockInBillStatusName || (row.hasStockInBill ? '-' : '未生成')
            }}
          </Tag>
        </template>
        <template #actions="{ row }">
          <TableAction
            class="purchase-in-item-row-action"
            :actions="[
              {
                label: '删除',
                type: 'link',
                icon: ACTION_ICON.DELETE,
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
      <PurchaseItemPriceReferenceOverlay
        :hidden-fields="props.hiddenFields"
        :open="priceReferenceOpen"
        :rows="displayTableData"
        :table-header-height="ITEM_TABLE_HEADER_HEIGHT"
        :table-row-height="ITEM_TABLE_ROW_HEIGHT"
        :table-wrapper="itemTableWrapRef"
        :visible-rows="ITEM_TABLE_VISIBLE_ROWS"
      />
    </div>
    <div v-if="showItemPager" class="purchase-in-item-pager">
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
    <BatchUpdateItemsModal @success="handleBatchUpdateItemsSuccess" />
    <PurchaseItemDetailShortcuts
      ref="itemShortcutsRef"
      :active-row="activeItemRow"
      :create-enabled="!props.disabled"
      :dept-id="props.deptId"
      :hidden-fields="props.hiddenFields"
      :is-stock-selector-open="isAnyStockSelectorOpen"
      :sale-history-enabled="true"
      @create="handleAddBlankItemRow"
      @product-updated="handleShortcutProductUpdated"
    />
  </div>
</template>

<style scoped>
:deep(.vxe-table),
:deep(.ant-input),
:deep(.ant-input-number),
:deep(.ant-select) {
  font-size: 11px;
}

:deep(.vxe-header--column.is--sortable .vxe-cell--title) {
  color: #1677ff;
}

:deep(.vxe-header--column .vxe-cell--sort) {
  display: none;
}

.purchase-in-item-toolbar :deep(.ant-btn) {
  height: 28px;
  padding: 2px 10px;
  font-size: 12px;
  line-height: 20px;
}

.purchase-in-item-action {
  height: 28px;
  padding: 2px 8px;
  font-size: 11px;
  line-height: 20px;
}

.purchase-in-item-row-action :deep(.ant-btn),
.purchase-in-item-row-action :deep(.anticon) {
  font-size: 11px;
}

.purchase-in-item-toolbar :deep(.ant-btn span) {
  font-size: 12px;
}

.purchase-in-item-toolbar-left {
  display: flex;
  flex: 1;
  flex-wrap: nowrap;
  align-items: center;
  min-width: 0;
  padding-right: 12px;
}

.purchase-in-item-table-wrap :deep(.vxe-toolbar) {
  flex-wrap: nowrap;
  white-space: nowrap;
}

.purchase-in-item-table-wrap :deep(.vxe-buttons--wrapper) {
  flex: 1;
  min-width: 0;
}

.purchase-in-item-table-wrap :deep(.vxe-button--item-wrapper) {
  flex-wrap: nowrap;
  min-width: 0;
}

.purchase-in-item-table-wrap :deep(.vxe-tools--wrapper) {
  flex-shrink: 0;
}

.purchase-in-item-toolbar {
  flex: none;
  flex-wrap: nowrap;
}

.purchase-in-item-toolbar > * {
  flex-shrink: 0;
}

.purchase-in-item-batch-summary {
  min-width: 0;
  font-size: 12px;
  font-weight: 600;
  color: #334155;
}

.purchase-in-item-table-wrap {
  position: relative;
}

.purchase-in-item-readonly-cell {
  display: block;
  width: 100%;
  overflow: hidden;
  color: #475569;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.purchase-in-count-cell {
  display: inline-flex;
  align-items: center;
  width: 100%;
  min-width: 0;
}

.purchase-in-count-cell :deep(.ant-input) {
  min-width: 0;
}

.purchase-in-returned-count {
  flex: none;
  margin-left: 6px;
  color: hsl(var(--destructive));
}

.purchase-document-item-shortcut-hint__divider {
  width: 1px;
  height: 16px;
  min-height: 16px !important;
  padding: 0 !important;
  background: #d9e2ef !important;
  border: 0 !important;
}

.purchase-in-item-pager {
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
}

.purchase-in-item-pager :deep(.ant-pagination),
.purchase-in-item-pager :deep(.ant-pagination-item),
.purchase-in-item-pager :deep(.ant-pagination-total-text),
.purchase-in-item-pager :deep(.ant-pagination-options),
.purchase-in-item-pager :deep(.ant-select),
.purchase-in-item-pager :deep(.ant-input) {
  font-size: 11px;
}

.purchase-in-item-pager :deep(.ant-pagination-item),
.purchase-in-item-pager :deep(.ant-pagination-prev),
.purchase-in-item-pager :deep(.ant-pagination-next),
.purchase-in-item-pager :deep(.ant-pagination-jump-prev),
.purchase-in-item-pager :deep(.ant-pagination-jump-next) {
  min-width: 24px;
  height: 24px;
  line-height: 22px;
}

.purchase-in-item-pager :deep(.ant-pagination-item a),
.purchase-in-item-pager :deep(.ant-pagination-prev button),
.purchase-in-item-pager :deep(.ant-pagination-next button) {
  height: 22px;
  font-size: 11px;
  line-height: 22px;
}

.purchase-in-item-pager :deep(.ant-pagination-options-size-changer),
.purchase-in-item-pager :deep(.ant-select-single),
.purchase-in-item-pager :deep(.ant-select-selector) {
  height: 24px;
  line-height: 22px;
}

.purchase-in-item-pager
  :deep(.ant-pagination-options-size-changer .ant-select-selector) {
  box-sizing: border-box;
  align-items: center;
  min-height: 24px;
  padding: 0 24px 0 8px;
}

.purchase-in-item-pager
  :deep(.ant-select-single .ant-select-selector .ant-select-selection-item) {
  height: 22px;
  font-size: 11px;
  line-height: 22px;
}

.purchase-in-item-pager :deep(.ant-select-arrow) {
  margin-top: -5px;
  font-size: 10px;
}

.purchase-in-item-pager :deep(.ant-pagination-options-quick-jumper input) {
  height: 24px;
  padding: 0 7px;
  font-size: 11px;
  line-height: 22px;
}

.purchase-document-item-shortcut-hint {
  display: flex;
  flex-wrap: nowrap;
  gap: 6px;
  align-items: center;
  min-width: 0;
  overflow-x: auto;
  font-size: 12px;
  color: #334155;
  white-space: nowrap;
}

.purchase-document-item-shortcut-hint > span {
  flex: none;
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

:deep(.erp-gift-row) {
  background-color: rgba(255, 77, 79, 0.08) !important;
}

:deep(.erp-gift-row:hover td) {
  background-color: rgba(255, 77, 79, 0.16) !important;
}

:deep(.purchase-document-item-row--active td) {
  background-color: rgba(22, 119, 255, 0.1) !important;
}

:deep(.purchase-document-item-row--active td:first-child) {
  box-shadow: inset 3px 0 0 #1677ff;
}

:deep(.purchase-document-item-row--active:hover td) {
  background-color: rgba(22, 119, 255, 0.16) !important;
}
</style>
