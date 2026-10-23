<script lang="ts" setup>
import '#/views/erp/purchase/utils/candidate-focus';
import type { ErpPurchaseReturnApi } from '#/api/erp/purchase/return';
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

import { Button, Input, message, Modal, Pagination } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  getPurchaseReturnDeptSimplePage,
  getPurchaseReturnWarehouseDeptSimplePage,
} from '#/api/erp/purchase/return';
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
  focusPurchaseShortcutOwner,
  isPurchaseShortcutOwnerActive,
} from '#/views/erp/purchase/utils/shortcut-scope';
import {
  buildPurchaseItemDuplicateKey,
  focusNextInputOnEnter,
  isBatchNoEnabled,
} from '#/views/erp/purchase/utils/item-form';
import { createPurchaseItemClientRowKeyManager } from '#/views/erp/purchase/utils/item-row-key';
import {
  formatPurchaseAmount,
  formatPurchaseDecimal,
  parsePurchaseDecimal,
  purchaseDecimalAdd,
  purchaseDecimalMultiply,
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
import {
  focusFirstEditableInput,
  queueAfterEditableControlRender,
} from '#/views/erp/utils/keyboard';
import { settleVxeColumnCustomization } from '#/views/erp/utils/vxe-column-custom';

import { isPurchaseReturnPriceItemHidden, useFormItemColumns } from '../data';
import BatchUpdateItemsForm from './batch-update-items-form.vue';
import {
  formatPurchaseReturnPriceInput,
  normalizePurchaseReturnPrice,
} from './purchase-return-price-input';

interface Props {
  items?: ErpPurchaseReturnApi.PurchaseReturnItem[];
  disabled?: boolean;
  feeAmount?: number;
  hiddenFields?: string[];
  deptId?: number;
  enableBatchEdit?: boolean;
  isStockSelectorOpen?: () => boolean;
  itemPageLoading?: boolean;
  itemPagination?: PurchaseReturnItemPagination;
  remotePaging?: boolean;
  returnId?: number;
  returnMode?: number;
  shortcutActive?: boolean;
}

type PurchaseReturnItemPagination = {
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
  hiddenFields: () => [],
  isStockSelectorOpen: undefined,
  itemPageLoading: false,
  itemPagination: () => ({
    orderDirection: undefined,
    orderField: undefined,
    pageNo: 1,
    pageSize: DEFAULT_ITEM_PAGE_SIZE,
    total: 0,
  }),
  remotePaging: false,
  returnId: undefined,
  returnMode: 10,
  shortcutActive: true,
});

const emit = defineEmits([
  'update:items',
  'append-items',
  'update:summary',
  'batch-update-success',
  'create',
  'page-change',
  'request-submit',
]);

const PURCHASE_RETURN_ITEM_COUNT_INPUT_SELECTOR =
  '[data-purchase-return-count-input="true"]';
const PURCHASE_RETURN_PRODUCT_SELECT_INPUT_SELECTOR =
  '[data-purchase-inline-stock-select-input="true"]';

const tableData = ref<ErpPurchaseReturnApi.PurchaseReturnItem[]>([]);
const displayTableData = ref<ErpPurchaseReturnApi.PurchaseReturnItem[]>([]);
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
const selectedBatchItemRows = ref<ErpPurchaseReturnApi.PurchaseReturnItem[]>(
  [],
);
const { hasAccessByCodes } = useAccess();
const [BatchUpdateItemsModal, batchUpdateItemsModalApi] = useVbenModal({
  connectedComponent: BatchUpdateItemsForm,
  destroyOnClose: true,
});
let isInternalUpdate = false;
let lastSyncedItemsSource:
  | ErpPurchaseReturnApi.PurchaseReturnItem[]
  | undefined;
let isShortcutListening = false;
let isShortcutScopeActive = false;
let itemSelectLabelHydrateSequence = 0;
let nextItemSeq = 1;
let itemResizeFrame = 0;
let lastItemTableWidth = 0;
const CURRENT_SELECT_LABEL_PLACEHOLDER = '加载中...';

function getItemTableWidth(
  rows: ErpPurchaseReturnApi.PurchaseReturnItem[] = displayTableData.value,
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
  () =>
    props.returnMode === 20 &&
    !isFieldHidden(props.hiddenFields, 'item_warehouseId'),
);
const canBatchEditDept = computed(
  () => !isFieldHidden(props.hiddenFields, 'item_deptId'),
);
const canUseServerBatchUpdate = computed(
  () => props.disabled && Boolean(props.returnId),
);
const batchUpdateAccessCodes = computed(() =>
  props.returnId
    ? ['erp:purchase-return:update']
    : ['erp:purchase-return:create'],
);
const canShowBatchUpdateItems = computed(
  () =>
    props.enableBatchEdit &&
    hasAccessByCodes(batchUpdateAccessCodes.value) &&
    (canBatchEditWarehouse.value || canBatchEditDept.value),
);
const canUseInlineStockSelector = computed(
  () => !props.disabled && props.returnMode === 20,
);
const canShowItemSelection = computed(
  () => !props.disabled || canShowBatchUpdateItems.value,
);
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
const batchUpdateButtonText = computed(() =>
  canBatchEditWarehouse.value ? '批量修改仓库/部门' : '批量修改部门',
);

function setCountText(row: ErpPurchaseReturnApi.PurchaseReturnItem) {
  (row as any).countText =
    row.count === null || row.count === undefined
      ? ''
      : formatPurchaseDecimal(row.count);
}

function setTaxPercentText(row: ErpPurchaseReturnApi.PurchaseReturnItem) {
  (row as any).taxPercentText =
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

function getReadonlyDeptName(row: ErpPurchaseReturnApi.PurchaseReturnItem) {
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
    ? getPurchaseReturnWarehouseDeptSimplePage({ ...rest, warehouseId })
    : getPurchaseReturnDeptSimplePage(rest as any);
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

function mergeWarehouseOptionFromRow(
  row: ErpPurchaseReturnApi.PurchaseReturnItem,
) {
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

function mergeDeptOptionFromRow(row: ErpPurchaseReturnApi.PurchaseReturnItem) {
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

function applyCachedSelectLabels(
  rows: ErpPurchaseReturnApi.PurchaseReturnItem[],
) {
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
  rows: ErpPurchaseReturnApi.PurchaseReturnItem[],
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

function ensureRowSeq(row: ErpPurchaseReturnApi.PurchaseReturnItem) {
  if (row.seq === undefined || row.seq === null) {
    row.seq = nextItemSeq++;
    return;
  }
  nextItemSeq = Math.max(nextItemSeq, Number(row.seq) + 1);
}

const itemRowKeyManager =
  createPurchaseItemClientRowKeyManager('purchase-return');

function ensureRowIdentity(row: ErpPurchaseReturnApi.PurchaseReturnItem) {
  ensureRowSeq(row);
  return itemRowKeyManager.ensureRowKey(row);
}

function ensureRowsIdentity(rows: ErpPurchaseReturnApi.PurchaseReturnItem[]) {
  rows.forEach((row) => ensureRowSeq(row));
  itemRowKeyManager.ensureRowKeys(rows);
}

function getItemRowKey(row?: ErpPurchaseReturnApi.PurchaseReturnItem) {
  if (!row) return undefined;
  return row.clientRowKey || ensureRowIdentity(row);
}

function setActiveItemRow(row?: ErpPurchaseReturnApi.PurchaseReturnItem) {
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

function getItemRowClassName({ row }: { row: any }) {
  return getItemRowKey(row) === activeItemRowKey.value
    ? 'purchase-document-item-row--active'
    : '';
}

function setProductPriceText(row: ErpPurchaseReturnApi.PurchaseReturnItem) {
  (row as any).productPriceText = formatPurchaseReturnPriceInput(
    row.productPrice,
  );
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
  return parsePurchaseDecimal(value, label, options);
}

function isItemFieldHidden(fieldKey: string) {
  return isFieldHidden(props.hiddenFields, `item_${fieldKey}`);
}

function isPriceItemHidden(field: string) {
  return isPurchaseReturnPriceItemHidden(props.hiddenFields, field);
}

function emitItemsUpdate(skipReload = false) {
  isInternalUpdate = skipReload;
  emit(
    'update:items',
    tableData.value.map((item) => {
      const {
        countText: _countText,
        productPriceText: _productPriceText,
        taxPercentText: _taxPercentText,
        ...rest
      } = item as any;
      return rest;
    }),
  );
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

function buildItemColumns(
  hiddenFields = props.hiddenFields,
  rows = displayTableData.value,
): NonNullable<
  VxeTableGridOptions<ErpPurchaseReturnApi.PurchaseReturnItem>['columns']
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
    VxeTableGridOptions<ErpPurchaseReturnApi.PurchaseReturnItem>['columns']
  >;
}

async function refreshItemColumns(
  rows: ErpPurchaseReturnApi.PurchaseReturnItem[] = displayTableData.value,
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

function canBatchUpdateItemRow(row?: ErpPurchaseReturnApi.PurchaseReturnItem) {
  return Boolean(row?.productId) && (!props.disabled || Boolean(row?.id));
}

function canDeleteItemRow(row?: ErpPurchaseReturnApi.PurchaseReturnItem) {
  return !props.disabled && Boolean(getItemRowKey(row));
}

function canSelectItemRow(row?: ErpPurchaseReturnApi.PurchaseReturnItem) {
  return props.disabled ? canBatchUpdateItemRow(row) : canDeleteItemRow(row);
}

function clearBatchItemSelection() {
  selectedBatchItemRows.value = [];
  gridApi.grid?.clearCheckboxRow?.();
}

function handleOpenBatchUpdateItems() {
  const selectedCount = selectedBatchItemCount.value;
  if (selectedCount === 0) {
    message.warning('请先勾选可批量修改的退货明细');
    return;
  }
  batchUpdateItemsModalApi
    .setData({
      hiddenFields: props.hiddenFields,
      itemCount: selectedCount,
      itemIds: canUseServerBatchUpdate.value ? selectedBatchItemIds.value : [],
      mode: canUseServerBatchUpdate.value ? 'server' : 'local',
      returnId: canUseServerBatchUpdate.value ? props.returnId : undefined,
      returnMode: props.returnMode,
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
    message.warning('批量修改后存在产品、仓库重复，请调整后再操作');
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
    setProductPriceText(row);
    setTaxPercentText(row);
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
    message.success(`已批量更新 ${selectedCount} 条退货明细`);
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

watch(
  () => [
    summaries.value.count,
    summaries.value.totalProductPrice,
    summaries.value.totalPrice,
    props.feeAmount,
  ],
  () => {
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
    id: 'erp-purchase-return-item-list-v1',
    autoResize: true,
    fit: false,
    border: true,
    rowConfig: { keyField: 'clientRowKey', isHover: true },
    rowClassName: getItemRowClassName,
    checkboxConfig: {
      checkMethod: ({
        row,
      }: {
        row: ErpPurchaseReturnApi.PurchaseReturnItem;
      }) => canSelectItemRow(row),
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
      records: ErpPurchaseReturnApi.PurchaseReturnItem[];
    }) => {
      selectedBatchItemRows.value = records.filter(canSelectItemRow);
    },
    checkboxChange: ({
      records,
    }: {
      records: ErpPurchaseReturnApi.PurchaseReturnItem[];
    }) => {
      selectedBatchItemRows.value = records.filter(canSelectItemRow);
    },
    cellClick: ({ row }: { row: ErpPurchaseReturnApi.PurchaseReturnItem }) => {
      setActiveItemRow(row);
    },
    currentRowChange: ({
      row,
    }: {
      row?: ErpPurchaseReturnApi.PurchaseReturnItem;
    }) => {
      setActiveItemRow(row);
    },
  },
});

async function syncItemsFromProps(
  items?: ErpPurchaseReturnApi.PurchaseReturnItem[],
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
  tableData.value.forEach((item) => {
    setCountText(item);
    setProductPriceText(item);
    setTaxPercentText(item);
  });
  await refreshItemGrid({ reloadData: false });
  void hydrateMissingCurrentSelectLabels(tableData.value);
  await refreshItemColumns(displayTableData.value);
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
    await refreshItemColumns(displayTableData.value, false);
    if (activeItemSort.value) await gridApi.grid.setSort(activeItemSort.value);
    clearBatchItemSelection();
  },
  { deep: true },
);

watch(
  () => [
    props.disabled,
    props.enableBatchEdit,
    props.returnId,
    props.returnMode,
  ],
  async () => {
    await nextTick();
    await refreshItemColumns(displayTableData.value, false);
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

function handleDelete(row: ErpPurchaseReturnApi.PurchaseReturnItem) {
  deleteItemRows([row]);
}

function deleteItemRows(rows: ErpPurchaseReturnApi.PurchaseReturnItem[]) {
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
  emitItemsUpdate(false);
  void nextTick(refreshItemGrid);
}

function handleBatchDeleteItems() {
  const rows = selectedDeleteItemRows.value;
  if (rows.length === 0) {
    message.warning('请先勾选要删除的退货明细');
    return;
  }
  Modal.confirm({
    title: `确认删除已选 ${rows.length} 条退货明细吗？`,
    content: '删除后将从当前采购退货明细中移除这些行。',
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: () => {
      deleteItemRows(rows);
    },
  });
}

async function handleWarehouseChange(
  row: ErpPurchaseReturnApi.PurchaseReturnItem,
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
  setCountText(row);
  setProductPriceText(row);
  setTaxPercentText(row);
  if (row.count !== undefined && row.count !== null && row.count <= 0) {
    message.warning('数量必须大于 0');
  }
  if (
    row.productPrice !== undefined &&
    row.productPrice !== null &&
    row.productPrice <= 0
  ) {
    message.warning('产品单价必须大于 0');
  }
  if (row.productPrice && row.count) {
    row.totalProductPrice = purchaseDecimalMultiply(
      row.productPrice,
      row.count,
    );
    row.taxPrice = 0;
    row.totalPrice = row.totalProductPrice;
  }
  const rowKey = getItemRowKey(row);
  const index = tableData.value.findIndex(
    (item) => getItemRowKey(item) === rowKey,
  );
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

function initRow(row: ErpPurchaseReturnApi.PurchaseReturnItem) {
  (row as any).batchNoEnabled = isBatchNoEnabled((row as any).batchNoEnabled);
  if (!isBatchNoEnabled((row as any).batchNoEnabled)) {
    (row as any).batchNo = undefined;
  }
  if (row.productPrice && row.count) {
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
  setProductPriceText(row);
  setTaxPercentText(row);
}

function createBlankItemRow() {
  const row = {
    count: 1,
    packageQty: 1,
    remark: '',
  } as ErpPurchaseReturnApi.PurchaseReturnItem;
  ensureRowIdentity(row);
  initRow(row);
  return row;
}

const itemRowFocusController = createErpItemRowFocusController({
  focusField: (row: ErpPurchaseReturnApi.PurchaseReturnItem, field) =>
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
  if (!canUseInlineStockSelector.value) {
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

function buildPurchaseReturnItemFromStock(
  product: ErpStockApi.Stock,
): ErpPurchaseReturnApi.PurchaseReturnItem {
  const productPrice = product.lastPurchasePrice ?? product.currentPrice ?? 0;
  const row = {
    productId: product.productId,
    productName: product.productName,
    productCode: product.productCode,
    productUnitId: product.unitId,
    productUnitName: product.unitName,
    productBarCode: product.productBarCode,
    barCode: product.productBarCode,
    vehicleModel: product.vehicleModel,
    originPlace: product.originPlace,
    drawingNo: product.drawingNo,
    brand: product.brand,
    weight: product.weight,
    packageQty: product.packageQty ?? 1,
    warehouseId: product.warehouseId,
    deptId: product.deptId ?? resolveWarehouseDeptId(product.warehouseId),
    warehouseName: product.warehouseName,
    stockCount: product.count ?? 0,
    count: 1,
    productPrice,
    productPurchasePrice: product.purchasePrice ?? product.productPurchasePrice,
    salePrice: product.salePrice,
    lastSalePrice: product.lastSalePrice,
    minPrice: product.minPrice,
    referencePrice: product.referencePrice,
    retailPrice: product.retailPrice,
    lastPurchasePrice: product.lastPurchasePrice,
    grossProfitRate: product.grossProfitRate,
    backupPrice1: product.backupPrice1,
    wholesalePrice: product.wholesalePrice,
    sharePrice: product.sharePrice,
    priceVisible: product.priceVisible,
    totalProductPrice: productPrice,
    taxPrice: 0,
    totalPrice: productPrice,
    batchNo: product.batchNo,
    batchNoEnabled: product.batchNoEnabled,
    remark: '',
  } as ErpPurchaseReturnApi.PurchaseReturnItem;
  ensureRowIdentity(row);
  initRow(row);
  return row;
}

function buildReplacementPurchaseReturnItemFromStock(
  stock: ErpStockApi.Stock,
  targetRow: ErpPurchaseReturnApi.PurchaseReturnItem,
) {
  const row = buildPurchaseReturnItemFromStock(stock);
  row.id = targetRow.id;
  row.seq = targetRow.seq ?? row.seq;
  row.clientRowKey = targetRow.clientRowKey ?? row.clientRowKey;
  (row as any).returnId = (targetRow as any).returnId;
  return row;
}

async function insertStockProducts(
  products: ErpStockApi.Stock[],
  options: {
    targetRow?: ErpPurchaseReturnApi.PurchaseReturnItem;
  } = {},
) {
  if (!products || products.length === 0) return;
  const targetRowKey = getItemRowKey(options.targetRow);
  const existedKeys = new Set(
    (tableData.value ?? [])
      .filter((item) => getItemRowKey(item) !== targetRowKey)
      .map((item) => buildPurchaseItemDuplicateKey(item)),
  );
  const selectedProducts = products.filter((product) => {
    const key = buildPurchaseItemDuplicateKey({
      productId: product.productId,
      warehouseId: product.warehouseId,
    });
    if (key && existedKeys.has(key)) {
      message.warning(
        `产品「${product.productName || product.productCode}」在该仓库已存在`,
      );
      return false;
    }
    existedKeys.add(key);
    return true;
  });
  if (selectedProducts.length === 0) return;

  const targetIndex = targetRowKey
    ? tableData.value.findIndex((item) => getItemRowKey(item) === targetRowKey)
    : -1;
  let activeRow: ErpPurchaseReturnApi.PurchaseReturnItem;
  if (targetIndex >= 0 && options.targetRow) {
    const [firstStock, ...additionalStocks] = selectedProducts;
    const replacementRow = buildReplacementPurchaseReturnItemFromStock(
      firstStock!,
      options.targetRow,
    );
    const additionalRows = additionalStocks.map((stock) =>
      buildPurchaseReturnItemFromStock(stock),
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
    const rows = selectedProducts.map((stock) =>
      buildPurchaseReturnItemFromStock(stock),
    );
    if (props.remotePaging) {
      emit('append-items', rows, 'count');
      return;
    }
    tableData.value = [...tableData.value, ...rows];
    activeRow = rows[0]!;
  }
  setActiveItemRow(activeRow);
  emitItemsUpdate(false);
  await itemRowFocusController.focus(activeRow, 'count');
}

function handleInlineStockSelected(
  targetRow: ErpPurchaseReturnApi.PurchaseReturnItem,
  rows: ErpStockApi.Stock[],
) {
  void insertStockProducts(rows, { targetRow });
}

function handleInlineStockOpenChange(open: boolean) {
  inlineStockSelectorOpen.value = open;
}

function handleCountBlur(row: ErpPurchaseReturnApi.PurchaseReturnItem) {
  const parsed = parseBusinessNumberText((row as any).countText, '数量', {
    decimals: 6,
    min: 0.000001,
  });
  if (!parsed.ok) {
    message.warning(parsed.message);
    setCountText(row);
    return;
  }
  row.count = parsed.value!;
  handleRowChange(row);
}

function handleProductPriceBlur(row: ErpPurchaseReturnApi.PurchaseReturnItem) {
  const parsed = parseBusinessNumberText(
    (row as any).productPriceText,
    '产品单价',
    { decimals: 6, min: 0.000001 },
  );
  if (!parsed.ok) {
    message.warning(parsed.message);
    setProductPriceText(row);
    return;
  }
  row.productPrice = normalizePurchaseReturnPrice(parsed.value!);
  handleRowChange(row);
}

function handleTaxPercentBlur(row: ErpPurchaseReturnApi.PurchaseReturnItem) {
  const parsed = parseBusinessNumberText((row as any).taxPercentText, '税率', {
    allowEmpty: true,
    decimals: 6,
    max: 100,
    min: 0,
  });
  if (!parsed.ok) {
    message.warning(parsed.message);
    setTaxPercentText(row);
    return;
  }
  row.taxPercent = parsed.value;
  handleRowChange(row);
}

function validate() {
  if (tableData.value.length === 0) {
    throw new Error('请先添加退货明细');
  }
  const duplicateKeys = new Set<string>();
  for (let i = 0; i < tableData.value.length; i++) {
    const item = tableData.value[i];
    if (!item) continue;
    const lineNo = i + 1;
    if (!item.warehouseId) {
      throw new Error(`第 ${lineNo} 行：请选择仓库`);
    }
    const duplicateKey = buildPurchaseItemDuplicateKey(item);
    if (duplicateKey) {
      if (duplicateKeys.has(duplicateKey)) {
        throw new Error(`第 ${lineNo} 行：产品、仓库、赠品标识重复`);
      }
      duplicateKeys.add(duplicateKey);
    }

    const countParsed = parseBusinessNumberText(
      (item as any).countText,
      '数量',
      { decimals: 6, min: 0.000001 },
    );
    if (!countParsed.ok) {
      throw new Error(`第 ${lineNo} 行：${countParsed.message}`);
    }
    item.count = countParsed.value!;

    const priceParsed = parseBusinessNumberText(
      (item as any).productPriceText,
      '产品单价',
      { decimals: 6, min: 0.000001 },
    );
    if (!priceParsed.ok) {
      throw new Error(`第 ${lineNo} 行：${priceParsed.message}`);
    }
    item.productPrice = normalizePurchaseReturnPrice(priceParsed.value!);

    const taxPercentParsed = parseBusinessNumberText(
      (item as any).taxPercentText,
      '税率',
      { allowEmpty: true, decimals: 6, max: 100, min: 0 },
    );
    if (!taxPercentParsed.ok) {
      throw new Error(`第 ${lineNo} 行：${taxPercentParsed.message}`);
    }
    item.taxPercent = taxPercentParsed.value;
    initRow(item);
  }
}

function getItems() {
  return tableData.value.map((item) => {
    const {
      __stockKeyword: _stockKeyword,
      countText: _countText,
      productPriceText: _productPriceText,
      taxPercentText: _taxPercentText,
      ...data
    } = item as any;
    return data;
  });
}

function getProductInputValue(row: ErpPurchaseReturnApi.PurchaseReturnItem) {
  const keyword = (row as any).__stockKeyword;
  return keyword === undefined || keyword === null
    ? row.productName || ''
    : String(keyword);
}

function handleProductKeywordInput(
  row: ErpPurchaseReturnApi.PurchaseReturnItem,
  value: string,
) {
  (row as any).__stockKeyword = value;
}

function escapeAttrValue(value: string) {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

function focusProductNameInput(row: ErpPurchaseReturnApi.PurchaseReturnItem) {
  if (props.disabled) {
    return false;
  }
  const rowKey = getItemRowKey(row);
  const selector = rowKey
    ? `${PURCHASE_RETURN_PRODUCT_SELECT_INPUT_SELECTOR}[data-purchase-inline-stock-row-key="${escapeAttrValue(rowKey)}"]`
    : PURCHASE_RETURN_PRODUCT_SELECT_INPUT_SELECTOR;
  return focusFirstEditableInput(itemTableWrapRef.value, selector);
}

function focusFirstItemCountInput() {
  if (props.disabled) {
    return false;
  }
  return focusFirstEditableInput(
    itemTableWrapRef.value,
    PURCHASE_RETURN_ITEM_COUNT_INPUT_SELECTOR,
  );
}

function focusItemCountInput(row: ErpPurchaseReturnApi.PurchaseReturnItem) {
  return focusEditableInputByRowKey(
    itemTableWrapRef.value,
    PURCHASE_RETURN_ITEM_COUNT_INPUT_SELECTOR,
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

function handleShortcutProductUpdated(row: any) {
  handleRowChange(row);
}

async function reloadItemsFromProps() {
  await syncItemsFromProps(props.items, { force: true });
}

function focusItemRow(
  row: ErpPurchaseReturnApi.PurchaseReturnItem,
  field: ErpItemRowFocusField,
) {
  return itemRowFocusController.focus(row, field);
}

defineExpose({
  clearItemSort,
  focusFirstItemCountInput,
  focusItemRow,
  getItems,
  queueFocusFirstItemCountInput,
  reloadItemsFromProps,
  validate,
});

onMounted(() => {
  fillMissingDeptIdFromWarehouse();
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
      class="purchase-return-item-table-wrap"
      tabindex="-1"
      @click="focusPurchaseShortcutOwner(itemTableWrapRef, $event.target)"
    >
      <Grid class="w-full">
        <template #toolbar-buttons>
          <div class="purchase-return-item-toolbar-left">
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
              <span v-if="canUseInlineStockSelector">
                <kbd>Insert</kbd><b>新增行</b>
              </span>
            </div>
            <div
              v-if="canShowBatchUpdateItems"
              class="purchase-return-item-batch-summary"
            >
              已选 {{ selectedBatchItemCount }} 条 / 可改
              {{ batchEditableItemCount }} 条
            </div>
          </div>
        </template>
        <template #toolbar-tools>
          <div class="purchase-return-item-toolbar flex items-center gap-2">
            <Button
              v-if="canUseInlineStockSelector"
              type="primary"
              @click="handleAddBlankItemRow"
            >
              新增行
            </Button>
            <Button
              v-if="!props.disabled && canShowItemSelection"
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
              {{ batchUpdateButtonText }}
            </Button>
            <slot name="toolbar"></slot>
          </div>
        </template>
        <template #warehouseId="{ row }">
          <span
            v-if="props.disabled"
            class="purchase-return-item-readonly-cell"
          >
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
            :disabled="props.disabled"
            popup-class-name="purchase-document-item-select-dropdown erp-candidate-focus-popup"
            class="w-full"
            @change="
              (value, option) => handleWarehouseChange(row, value, option)
            "
            @options-change="handleWarehouseOptionsChange"
          />
        </template>
        <template #deptId="{ row }">
          <span
            v-if="props.disabled"
            class="purchase-return-item-readonly-cell"
          >
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
            :disabled="props.disabled"
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
            settings-scope="purchase-return"
            v-if="canUseInlineStockSelector"
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
            <span v-if="!isItemFieldHidden('productName')">{{
              row.productName || '-'
            }}</span>
          </div>
        </template>
        <template #count="{ row }">
          <Input
            v-if="!props.disabled"
            v-model:value="row.countText"
            class="w-full"
            :data-erp-item-row-key="getItemRowKey(row)"
            data-purchase-return-count-input="true"
            inputmode="decimal"
            autocomplete="off"
            @focus="setActiveItemRow(row)"
            @press-enter="handleItemInputPressEnter"
            @blur="handleCountBlur(row)"
          />
          <span v-else>{{ formatPurchaseDecimal(row.count, '-') }}</span>
        </template>
        <template #productPrice="{ row }">
          <span v-if="props.disabled && isPriceItemHidden('productPrice')">
            ****
          </span>
          <Input
            v-else-if="!props.disabled"
            v-model:value="row.productPriceText"
            class="w-full"
            inputmode="decimal"
            autocomplete="off"
            @press-enter="handleItemInputPressEnter"
            @blur="handleProductPriceBlur(row)"
          />
          <span v-else>{{ formatPurchaseAmount(row.productPrice, '-') }}</span>
        </template>
        <template #batchNo="{ row }">
          <Input
            v-if="!props.disabled"
            v-model:value="row.batchNo"
            :disabled="!isBatchNoEnabled(row.batchNoEnabled)"
            class="w-full"
            @press-enter="handleItemInputPressEnter"
            @change="handleRowChange(row)"
          />
          <span v-else>{{ row.batchNo || '-' }}</span>
        </template>
        <template #remark="{ row }">
          <Input
            v-if="!props.disabled"
            v-model:value="row.remark"
            class="w-full"
            @press-enter="handleItemInputPressEnter"
          />
          <span v-else>{{ row.remark || '-' }}</span>
        </template>
        <template #taxPercent="{ row }">
          <Input
            v-if="!props.disabled"
            v-model:value="row.taxPercentText"
            class="w-full"
            inputmode="decimal"
            autocomplete="off"
            @press-enter="handleItemInputPressEnter"
            @blur="handleTaxPercentBlur(row)"
          />
          <span v-else>{{ formatPurchaseDecimal(row.taxPercent) || '-' }}</span>
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
    <div v-if="showItemPager" class="purchase-return-item-pager">
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
    <PurchaseItemDetailShortcuts
      ref="itemShortcutsRef"
      :active-row="activeItemRow"
      :create-enabled="canUseInlineStockSelector"
      :is-stock-selector-open="() => inlineStockSelectorOpen"
      :sale-history-enabled="true"
      @create="handleAddBlankItemRow"
      @product-updated="handleShortcutProductUpdated"
    />
    <BatchUpdateItemsModal @success="handleBatchUpdateItemsSuccess" />
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

.purchase-document-item-shortcut-hint__divider {
  width: 1px;
  height: 16px;
  min-height: 16px !important;
  padding: 0 !important;
  background: #d9e2ef !important;
  border: 0 !important;
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

:deep(.purchase-document-item-row--active td) {
  background-color: rgba(22, 119, 255, 0.1) !important;
}

:deep(.purchase-document-item-row--active td:first-child) {
  box-shadow: inset 3px 0 0 #1677ff;
}

:deep(.purchase-document-item-row--active:hover td) {
  background-color: rgba(22, 119, 255, 0.16) !important;
}

.purchase-return-item-toolbar :deep(.ant-btn) {
  height: 28px;
  padding: 2px 10px;
  font-size: 12px;
  line-height: 20px;
}

.purchase-return-item-toolbar :deep(.ant-btn span) {
  font-size: 12px;
}

.purchase-return-item-toolbar-left {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  gap: 6px 12px;
  align-items: center;
  min-width: 0;
}

.purchase-return-item-batch-summary {
  font-size: 12px;
  color: #475569;
}

.purchase-return-item-table-wrap {
  position: relative;
}

.purchase-return-item-readonly-cell {
  display: block;
  width: 100%;
  overflow: hidden;
  color: #475569;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.purchase-return-item-pager {
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
}

.purchase-return-item-pager :deep(.ant-pagination),
.purchase-return-item-pager :deep(.ant-pagination-item),
.purchase-return-item-pager :deep(.ant-pagination-total-text),
.purchase-return-item-pager :deep(.ant-pagination-options),
.purchase-return-item-pager :deep(.ant-select),
.purchase-return-item-pager :deep(.ant-input) {
  font-size: 11px;
}

.purchase-return-item-pager :deep(.ant-pagination-item),
.purchase-return-item-pager :deep(.ant-pagination-prev),
.purchase-return-item-pager :deep(.ant-pagination-next),
.purchase-return-item-pager :deep(.ant-pagination-jump-prev),
.purchase-return-item-pager :deep(.ant-pagination-jump-next) {
  min-width: 24px;
  height: 24px;
  line-height: 22px;
}

.purchase-return-item-pager :deep(.ant-pagination-item a),
.purchase-return-item-pager :deep(.ant-pagination-prev button),
.purchase-return-item-pager :deep(.ant-pagination-next button) {
  height: 22px;
  font-size: 11px;
  line-height: 22px;
}

.purchase-return-item-pager :deep(.ant-pagination-options-size-changer),
.purchase-return-item-pager :deep(.ant-select-single),
.purchase-return-item-pager :deep(.ant-select-selector) {
  height: 24px;
  line-height: 22px;
}

.purchase-return-item-pager
  :deep(.ant-pagination-options-size-changer .ant-select-selector) {
  box-sizing: border-box;
  align-items: center;
  min-height: 24px;
  padding: 0 24px 0 8px;
}

.purchase-return-item-pager
  :deep(.ant-select-single .ant-select-selector .ant-select-selection-item) {
  height: 22px;
  font-size: 11px;
  line-height: 22px;
}

.purchase-return-item-pager :deep(.ant-select-arrow) {
  margin-top: -5px;
  font-size: 10px;
}

.purchase-return-item-pager :deep(.ant-pagination-options-quick-jumper input) {
  height: 24px;
  padding: 0 7px;
  font-size: 11px;
  line-height: 22px;
}
</style>
