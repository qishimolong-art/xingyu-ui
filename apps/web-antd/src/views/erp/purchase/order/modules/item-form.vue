<script lang="ts" setup>
import { PURCHASE_CANDIDATE_FOCUS_KEY } from '#/views/erp/purchase/utils/candidate-focus';
import type { TableColumnsType, TableProps } from 'ant-design-vue';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpPurchaseHistoryApi } from '#/api/erp/purchase/history';
import type { ErpPurchaseOrderApi } from '#/api/erp/purchase/order';
import type { ErpStockApi } from '#/api/erp/stock/stock';
import type { PurchaseDocumentItemSortOrder } from '#/views/erp/purchase/utils/document-item-table';

import {
  computed,
  defineAsyncComponent,
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
import { formatDateTime } from '@vben/utils';

import {
  Button,
  DatePicker,
  Input,
  message,
  Modal,
  Pagination,
  Space,
  Switch,
  Table,
  Tag,
} from 'ant-design-vue';

import { TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import { getProduct } from '#/api/erp/product/product';
import { getPurchaseHistoryPage } from '#/api/erp/purchase/history';
import {
  getPurchaseOrderDeptSimplePage,
  getPurchaseOrderPage,
  getPurchaseOrderWarehouseDeptSimplePage,
  PURCHASE_ORDER_STATUS,
} from '#/api/erp/purchase/order';
import { getStockCount } from '#/api/erp/stock/stock';
import {
  getPurchaseWarehouseSimplePage,
  getWarehouse,
} from '#/api/erp/stock/warehouse';
import { getDept } from '#/api/system/dept';
import { isFieldHidden } from '#/composables/useFieldPermission';
import ErpLazyPageSelect from '#/views/erp/components/ErpLazyPageSelect.vue';
import ProductForm from '#/views/erp/product/product/modules/form.vue';
import PurchaseInlineStockSelect from '#/views/erp/purchase/components/PurchaseInlineStockSelect.vue';
import PurchaseItemPriceReferenceOverlay from '#/views/erp/purchase/components/PurchaseItemPriceReferenceOverlay.vue';
import SupplierLazySelect from '#/views/erp/purchase/components/SupplierLazySelect.vue';
import SaleStockProductSelectModal from '#/views/erp/sale/components/SaleStockProductSelectModal.vue';
import {
  preparePurchaseDocumentItemColumns,
  sortPurchaseDocumentItems,
} from '#/views/erp/purchase/utils/document-item-table';
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
import { isCreateShortcutKey } from '#/views/erp/utils/keyboard';
import { ensureModalReady } from '#/views/erp/utils/lazy-modal';
import { settleVxeColumnCustomization } from '#/views/erp/utils/vxe-column-custom';

import { isPurchaseOrderPriceItemHidden, useFormItemColumns } from '../data';
import BatchUpdateItemsForm from './batch-update-items-form.vue';
import {
  normalizePurchaseOrderGiftItem,
  normalizePurchaseOrderGiftItems,
  parsePurchaseOrderCountText,
  parsePurchaseOrderPriceText,
} from './purchase-order-form-utils';

interface Props {
  items?: ErpPurchaseOrderApi.PurchaseOrderItem[];
  disabled?: boolean;
  discountPercent?: number;
  feeAmount?: number;
  hiddenFields?: string[];
  deptId?: number;
  enableBatchEdit?: boolean;
  itemPageLoading?: boolean;
  itemPagination?: PurchaseOrderItemPagination;
  orderId?: number;
  remotePaging?: boolean;
  supplierId?: number;
  showImportButton?: boolean;
}

type PurchaseHistoryMode = 'history' | 'order';
type PurchaseOrderItemPagination = {
  orderDirection?: 'asc' | 'desc';
  orderField?: string;
  pageNo: number;
  pageSize: number;
  total: number;
};
type HistorySorter = {
  field?: string;
  order?: 'ascend' | 'descend';
};
type HistoryFilterState = {
  dateRange?: [string, string];
  supplierId?: number;
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
type HistoryRow =
  | ErpPurchaseHistoryApi.Row
  | ErpPurchaseOrderApi.PurchaseOrder
  | Record<string, any>;

const props = withDefaults(defineProps<Props>(), {
  items: () => [],
  disabled: false,
  discountPercent: 0,
  deptId: undefined,
  enableBatchEdit: false,
  feeAmount: 0,
  hiddenFields: () => [],
  itemPageLoading: false,
  itemPagination: () => ({
    orderDirection: undefined,
    orderField: undefined,
    pageNo: 1,
    pageSize: 10,
    total: 0,
  }),
  orderId: undefined,
  remotePaging: false,
  showImportButton: false,
  supplierId: undefined,
});

provide(
  PURCHASE_CANDIDATE_FOCUS_KEY,
  computed(() => true),
);

const emit = defineEmits([
  'update:items',
  'append-items',
  'update:discount-price',
  'update:total-price',
  'batchUpdateSuccess',
  'import',
  'pageChange',
  'refreshPage',
  'requestSubmit',
]);

const DEFAULT_ITEM_PAGE_SIZE = 10;
const ITEM_PAGE_SIZE_OPTIONS = ['10', '20', '50', '100', '200'];
const ITEM_TABLE_VISIBLE_ROWS = 10;
const ITEM_TABLE_HEADER_HEIGHT = 40;
const ITEM_TABLE_ROW_HEIGHT = 36;
const ITEM_TABLE_HEIGHT =
  ITEM_TABLE_HEADER_HEIGHT + ITEM_TABLE_ROW_HEIGHT * ITEM_TABLE_VISIBLE_ROWS;
const PURCHASE_ORDER_ITEM_COUNT_INPUT_SELECTOR =
  'input[data-purchase-order-count-input="true"]';
const PURCHASE_ORDER_PRODUCT_SELECT_INPUT_SELECTOR =
  '[data-purchase-inline-stock-select-input="true"]';

const tableData = ref<ErpPurchaseOrderApi.PurchaseOrderItem[]>([]); // 表格数据
const displayTableData = ref<ErpPurchaseOrderApi.PurchaseOrderItem[]>([]);
const warehouseOptions = ref<any[]>([]); // 仓库下拉选项
const deptOptions = ref<any[]>([]);
const activeItemRowKey = ref<string>();
const purchaseHistoryOpen = ref(false);
const priceReferenceOpen = ref(false);
const inlineStockSelectorOpen = ref(false);
const saleHistoryModalRef =
  ref<InstanceType<typeof SaleStockProductSelectModal>>();
const itemTableWrapRef = ref<HTMLElement | null>(null);
const purchaseHistoryLoading = ref(false);
const purchaseHistoryMode = ref<PurchaseHistoryMode>('order');
const purchaseHistoryFilters = ref<HistoryFilterState>({});
const purchaseHistoryRows = ref<HistoryRow[]>([]);
const purchaseHistoryPagination = ref({
  current: 1,
  pageSize: 10,
  total: 0,
});
const purchaseHistorySorter = ref<HistorySorter>({});
const selectedBatchItemRows = ref<ErpPurchaseOrderApi.PurchaseOrderItem[]>([]);
const activeItemSort = ref<
  undefined | { field: string; order: PurchaseDocumentItemSortOrder }
>();
const localItemPage = ref({
  pageNo: 1,
  pageSize: DEFAULT_ITEM_PAGE_SIZE,
});
const { hasAccessByCodes } = useAccess();
let isShortcutListening = false;
let pendingOrderHistoryShift = false;
let itemSelectLabelHydrateSequence = 0;
const [ProductFormModal, productFormModalApi] = useVbenModal({
  connectedComponent: ProductForm,
  destroyOnClose: true,
});
const [BatchUpdateItemsModal, batchUpdateItemsModalApi] = useVbenModal({
  connectedComponent: BatchUpdateItemsForm,
  destroyOnClose: true,
});
const loadSupplierDetailComponent = () =>
  import('#/views/erp/purchase/supplier/modules/detail.vue');
const SupplierDetail = defineAsyncComponent(loadSupplierDetailComponent);
const [SupplierDetailModal, supplierDetailModalApi] = useVbenModal({
  connectedComponent: SupplierDetail,
  destroyOnClose: true,
});
const shouldRenderSupplierDetail = ref(false);
const loadPurchaseOrderDetailComponent = () =>
  import('#/views/erp/purchase/order/modules/form.vue');
const PurchaseOrderDetail = defineAsyncComponent(
  loadPurchaseOrderDetailComponent,
);
const [PurchaseOrderDetailModal, purchaseOrderDetailModalApi] = useVbenModal({
  connectedComponent: PurchaseOrderDetail,
  destroyOnClose: true,
});
const shouldRenderPurchaseOrderDetail = ref(false);
const loadPurchaseInDetailComponent = () =>
  import('#/views/erp/purchase/in/modules/form.vue');
const PurchaseInDetail = defineAsyncComponent(loadPurchaseInDetailComponent);
const [PurchaseInDetailModal, purchaseInDetailModalApi] = useVbenModal({
  connectedComponent: PurchaseInDetail,
  destroyOnClose: true,
});
const shouldRenderPurchaseInDetail = ref(false);
const loadPurchaseReturnDetailComponent = () =>
  import('#/views/erp/purchase/return/modules/form.vue');
const PurchaseReturnDetail = defineAsyncComponent(
  loadPurchaseReturnDetailComponent,
);
const [PurchaseReturnDetailModal, purchaseReturnDetailModalApi] = useVbenModal({
  connectedComponent: PurchaseReturnDetail,
  destroyOnClose: true,
});
const shouldRenderPurchaseReturnDetail = ref(false);
let isInternalUpdate = false; // 标记：本次 props.items 变更是否由内部字段编辑触发，是则跳过 reloadData 以避免横向滚动被重置
let lastSyncedItemsSource: ErpPurchaseOrderApi.PurchaseOrderItem[] | undefined;
let nextItemSeq = 1;
const itemRowKeyManager =
  createPurchaseItemClientRowKeyManager('purchase-order');
const CURRENT_SELECT_LABEL_PLACEHOLDER = '加载中...';

const activeProductText = computed(() => {
  const row = getActiveItemRow(false);
  if (!row) {
    return '未选中商品';
  }
  return [row.productCode, row.productName].filter(Boolean).join(' / ');
});
const purchaseHistoryTitle = computed(() => {
  const prefix =
    purchaseHistoryMode.value === 'history' ? '采购历史' : '采购订单历史';
  return `${prefix} - ${activeProductText.value}`;
});
const canBatchEditWarehouse = computed(
  () => !isFieldHidden(props.hiddenFields, 'item_warehouseId'),
);
const canBatchEditDept = computed(
  () => !isFieldHidden(props.hiddenFields, 'item_deptId'),
);
const canUseServerBatchUpdate = computed(
  () => props.disabled && Boolean(props.orderId),
);
const batchUpdateAccessCodes = computed(() =>
  props.orderId ? ['erp:purchase-order:update'] : ['erp:purchase-order:create'],
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
const purchaseHistoryDateField = computed(() =>
  purchaseHistoryMode.value === 'history' ? 'businessTime' : 'orderTime',
);
const purchaseHistoryTablePagination = computed(() => ({
  current: purchaseHistoryPagination.value.current,
  pageSize: purchaseHistoryPagination.value.pageSize,
  pageSizeOptions: ['10', '20', '50', '100'],
  showQuickJumper: true,
  showSizeChanger: true,
  showTotal: (total: number) => `共 ${total} 条`,
  total: purchaseHistoryPagination.value.total,
}));
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

function setCountText(row: ErpPurchaseOrderApi.PurchaseOrderItem) {
  (row as any).countText =
    row.count === null || row.count === undefined
      ? ''
      : formatPurchaseDecimal(row.count);
}

function setPriceText(row: ErpPurchaseOrderApi.PurchaseOrderItem) {
  (row as any).priceText =
    row.productPrice === null || row.productPrice === undefined
      ? ''
      : formatPurchaseAmount(row.productPrice);
}

function resolveWarehouseDeptId(warehouseId?: number) {
  if (!warehouseId) {
    return undefined;
  }
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
  const oldResolvedOptions = (oldOptions || []).filter((item) =>
    isResolvedSelectOption(item),
  );
  let changed = oldResolvedOptions.length !== (oldOptions || []).length;
  oldResolvedOptions.forEach((item) => {
    const key = getOptionKey(item);
    if (key) {
      map.set(key, item);
    }
  });
  (nextOptions || [])
    .filter((item) => isResolvedSelectOption(item))
    .forEach((item) => {
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
  return changed ? [...map.values()] : oldOptions || [];
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

function handleWarehouseOptionsChange(options: any[]) {
  warehouseOptions.value = mergeOptionsById(warehouseOptions.value, options);
}

function handleDeptOptionsChange(options: any[]) {
  deptOptions.value = mergeOptionsById(deptOptions.value, options);
}

function loadItemDeptSimplePage(params: Record<string, any>) {
  const { warehouseId, ...rest } = params || {};
  return warehouseId
    ? getPurchaseOrderWarehouseDeptSimplePage({ ...rest, warehouseId })
    : getPurchaseOrderDeptSimplePage(rest as any);
}

function fillMissingDeptIdFromWarehouse() {
  tableData.value.forEach((item) => {
    item.deptId ??= resolveWarehouseDeptId(item.warehouseId);
  });
}

function findDeptName(
  options: any[],
  deptId?: null | number,
): string | undefined {
  if (deptId === undefined || deptId === null) {
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

function isItemDeptReadonly(row?: ErpPurchaseOrderApi.PurchaseOrderItem) {
  return props.disabled || Boolean(row?.productId);
}

function getReadonlyDeptName(row: ErpPurchaseOrderApi.PurchaseOrderItem) {
  const currentName = (row as any).deptName;
  return (
    (isMissingDisplayName(currentName, row.deptId) ? undefined : currentName) ||
    findDeptName(deptOptions.value, row.deptId) ||
    '-'
  );
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
  row: ErpPurchaseOrderApi.PurchaseOrderItem,
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

function mergeDeptOptionFromRow(row: ErpPurchaseOrderApi.PurchaseOrderItem) {
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
  rows: ErpPurchaseOrderApi.PurchaseOrderItem[],
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
  rows: ErpPurchaseOrderApi.PurchaseOrderItem[],
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
    const warehouses = [...warehouseMap.values()];
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

function ensureRowSeq(row: ErpPurchaseOrderApi.PurchaseOrderItem) {
  if (row.seq === undefined || row.seq === null) {
    row.seq = row.id ?? nextItemSeq++;
    return;
  }
  nextItemSeq = Math.max(nextItemSeq, Number(row.seq) + 1);
}

function ensureRowIdentity(row: ErpPurchaseOrderApi.PurchaseOrderItem) {
  ensureRowSeq(row);
  return itemRowKeyManager.ensureRowKey(row);
}

function ensureRowsIdentity(rows: ErpPurchaseOrderApi.PurchaseOrderItem[]) {
  rows.forEach((row) => ensureRowSeq(row));
  itemRowKeyManager.ensureRowKeys(rows);
}

function getItemRowKey(row?: ErpPurchaseOrderApi.PurchaseOrderItem) {
  if (!row) return undefined;
  return row.clientRowKey || ensureRowIdentity(row);
}

function setActiveItemRow(row?: ErpPurchaseOrderApi.PurchaseOrderItem) {
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
      message.warning('请先点击一条有商品的采购明细');
    }
    return undefined;
  }
  return row;
}

function togglePriceReferenceOverlay() {
  priceReferenceOpen.value = !priceReferenceOpen.value;
}

function canBatchUpdateItemRow(row?: ErpPurchaseOrderApi.PurchaseOrderItem) {
  return (
    Boolean(row?.productId) &&
    (!props.disabled || Boolean(row?.id)) &&
    Number(row?.inCount || 0) <= 0 &&
    Number(row?.returnCount || 0) <= 0
  );
}

function canDeleteItemRow(row?: ErpPurchaseOrderApi.PurchaseOrderItem) {
  return !props.disabled && Boolean(getItemRowKey(row));
}

function canSelectItemRow(row?: ErpPurchaseOrderApi.PurchaseOrderItem) {
  return props.disabled ? canBatchUpdateItemRow(row) : canDeleteItemRow(row);
}

function getItemRowClassName({ row }: { row: any }) {
  const classes: string[] = [];
  if (row?.gift) {
    classes.push('erp-gift-row');
  }
  if (getItemRowKey(row) === activeItemRowKey.value) {
    classes.push('purchase-order-item-row--active');
  }
  return classes.join(' ');
}

function getCountValidateValue(item: ErpPurchaseOrderApi.PurchaseOrderItem) {
  return Object.prototype.hasOwnProperty.call(item as any, 'countText')
    ? (item as any).countText
    : item.count;
}

function getPriceValidateValue(item: ErpPurchaseOrderApi.PurchaseOrderItem) {
  return Object.prototype.hasOwnProperty.call(item as any, 'priceText')
    ? (item as any).priceText
    : item.productPrice;
}

/** 发出 items 更新
 * @param skipReload 是否跳过 grid.reloadData；仅字段编辑场景为 true（保留滚动位置），增删行场景为 false
 */
function emitItemsUpdate(skipReload = false) {
  isInternalUpdate = skipReload;
  const normalizedItems = normalizePurchaseOrderGiftItems(tableData.value);
  tableData.value.splice(0, tableData.value.length, ...normalizedItems);
  emit(
    'update:items',
    normalizedItems.map((item) => {
      const rest = { ...(item as any) };
      delete rest.countText;
      delete rest.priceText;
      delete rest.__stockKeyword;
      return rest;
    }),
  );
}

/** 表格配置 */
function buildItemColumns(
  rows: ErpPurchaseOrderApi.PurchaseOrderItem[] = displayTableData.value,
): NonNullable<
  VxeTableGridOptions<ErpPurchaseOrderApi.PurchaseOrderItem>['columns']
> {
  const columns = useFormItemColumns(props.disabled, props.hiddenFields) || [];
  const normalizedColumns = preparePurchaseDocumentItemColumns(
    columns as unknown as Parameters<
      typeof preparePurchaseDocumentItemColumns
    >[0],
    {
      editable: !props.disabled,
      isCellEditable: (field, row) =>
        field === 'deptId' ? !isItemDeptReadonly(row) : true,
      rows,
      trailingFlexibleColumnMinWidth: 150,
    },
  );
  if (canShowItemSelection.value) {
    normalizedColumns.unshift({
      fixed: 'left',
      type: 'checkbox',
      width: 44,
    } as any);
  }
  return normalizedColumns as unknown as NonNullable<
    VxeTableGridOptions<ErpPurchaseOrderApi.PurchaseOrderItem>['columns']
  >;
}

async function refreshItemColumns(
  rows: ErpPurchaseOrderApi.PurchaseOrderItem[] = displayTableData.value,
) {
  await gridApi.grid.reloadColumn(buildItemColumns(rows));
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

function isVisibleElement(element: HTMLElement) {
  return Boolean(element.offsetParent || element.getClientRects().length > 0);
}

function getProductInputValue(row: ErpPurchaseOrderApi.PurchaseOrderItem) {
  const keyword = (row as any).__stockKeyword;
  return keyword === undefined || keyword === null
    ? row.productName || ''
    : String(keyword);
}

function handleProductKeywordInput(
  row: ErpPurchaseOrderApi.PurchaseOrderItem,
  value: string,
) {
  (row as any).__stockKeyword = value;
}

function escapeAttrValue(value: string) {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

function focusProductNameInput(row: ErpPurchaseOrderApi.PurchaseOrderItem) {
  if (props.disabled) {
    return false;
  }
  const rowKey = getItemRowKey(row);
  const selector = rowKey
    ? `${PURCHASE_ORDER_PRODUCT_SELECT_INPUT_SELECTOR}[data-purchase-inline-stock-row-key="${escapeAttrValue(rowKey)}"]`
    : PURCHASE_ORDER_PRODUCT_SELECT_INPUT_SELECTOR;
  const input =
    itemTableWrapRef.value?.querySelector<HTMLInputElement>(selector);
  if (!input || input.disabled || input.readOnly || !isVisibleElement(input)) {
    return false;
  }
  input.focus({ preventScroll: true });
  input.select?.();
  return true;
}

function focusItemCountInput(row: ErpPurchaseOrderApi.PurchaseOrderItem) {
  return focusEditableInputByRowKey(
    itemTableWrapRef.value,
    PURCHASE_ORDER_ITEM_COUNT_INPUT_SELECTOR,
    getItemRowKey(row),
  );
}

function handleItemInputPressEnter(event: KeyboardEvent) {
  const enterFocusResult = focusNextInputOnEnter(event);
  if (enterFocusResult === 'last-input') {
    emit('requestSubmit', event);
  }
}

async function refreshItemGrid(options: { reloadData?: boolean } = {}) {
  const { reloadData = true } = options;
  const displayData = getDisplayTableData();
  const columns = buildItemColumns(displayData);
  displayTableData.value = displayData;
  gridApi.setGridOptions({
    columns,
    data: displayData,
  });
  await gridApi.grid.reloadColumn(columns);
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
    emit('refreshPage');
    return;
  }
  await refreshItemGrid();
}

function handleOpenBatchUpdateItems() {
  const selectedCount = selectedBatchItemCount.value;
  if (selectedCount === 0) {
    message.warning('请先勾选可批量修改的采购明细');
    return;
  }
  batchUpdateItemsModalApi
    .setData({
      hiddenFields: props.hiddenFields,
      itemCount: selectedCount,
      itemIds: canUseServerBatchUpdate.value ? selectedBatchItemIds.value : [],
      mode: canUseServerBatchUpdate.value ? 'server' : 'local',
      orderId: canUseServerBatchUpdate.value ? props.orderId : undefined,
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
        getStockCount(row.productId, row.warehouseId).then((stockCount) => {
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
  }
  if (showMessage) {
    message.success(`已批量更新 ${selectedCount} 条采购明细`);
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
    emit('batchUpdateSuccess');
  }
  clearBatchItemSelection();
}

async function handleItemSortChange({ field, order }: any) {
  activeItemSort.value =
    field && (order === 'asc' || order === 'desc')
      ? { field, order }
      : undefined;
  if (props.remotePaging) {
    emit('pageChange', {
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
    emit('pageChange', {
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
    id: 'erp-purchase-order-item-list-v1',
    autoResize: true,
    fit: true,
    border: true,
    rowConfig: {
      keyField: 'clientRowKey',
      isHover: true,
    },
    rowClassName: getItemRowClassName,
    checkboxConfig: {
      checkMethod: ({ row }: { row: ErpPurchaseOrderApi.PurchaseOrderItem }) =>
        canSelectItemRow(row),
    },
    pagerConfig: {
      enabled: false,
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
    sortConfig: {
      remote: true,
      multiple: false,
      trigger: 'cell',
      orders: ['asc', 'desc', null],
      allowBtn: false,
    },
  },
  gridEvents: {
    custom: async ({ type }: { type?: string }) => {
      const settled = await settleVxeColumnCustomization(gridApi.grid, type);
      if (!settled) return;
      await refreshItemColumns();
    },
    sortChange: handleItemSortChange,
    checkboxAll: ({
      records,
    }: {
      records: ErpPurchaseOrderApi.PurchaseOrderItem[];
    }) => {
      selectedBatchItemRows.value = records.filter((row) =>
        canSelectItemRow(row),
      );
    },
    checkboxChange: ({
      records,
    }: {
      records: ErpPurchaseOrderApi.PurchaseOrderItem[];
    }) => {
      selectedBatchItemRows.value = records.filter((row) =>
        canSelectItemRow(row),
      );
    },
    cellClick: ({ row }: { row: ErpPurchaseOrderApi.PurchaseOrderItem }) => {
      setActiveItemRow(row);
    },
    currentRowChange: ({
      row,
    }: {
      row?: ErpPurchaseOrderApi.PurchaseOrderItem;
    }) => {
      setActiveItemRow(row);
    },
  },
});

watch(
  () => props.hiddenFields,
  async () => {
    await nextTick();
    await refreshItemColumns();
    clearBatchItemSelection();
  },
  { deep: true },
);

watch(
  () => [props.disabled, props.enableBatchEdit, props.orderId],
  async () => {
    await nextTick();
    await refreshItemColumns();
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

async function syncItemsFromProps(
  items?: ErpPurchaseOrderApi.PurchaseOrderItem[],
  options: { force?: boolean } = {},
) {
  if (!items) {
    return;
  }
  if (items === lastSyncedItemsSource) {
    return;
  }
  lastSyncedItemsSource = items;
  // 内部编辑触发的回传，直接跳过 reloadData，避免横向滚动被重置。
  if (isInternalUpdate && !options.force) {
    isInternalUpdate = false;
    return;
  }
  isInternalUpdate = false;
  const normalizedItems = normalizePurchaseOrderGiftItems(items);
  ensureRowsIdentity(normalizedItems);
  normalizedItems.forEach((item) => initRow(item));
  tableData.value = normalizedItems;
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
  await refreshItemGrid({ reloadData: false });
  void hydrateMissingCurrentSelectLabels(tableData.value);
  clearBatchItemSelection();
}

/** 监听外部传入的列数据 */
watch(
  () => props.items,
  (items) => {
    void syncItemsFromProps(items);
  },
  {
    immediate: true,
  },
);

watch(
  () => props.supplierId,
  (supplierId) => {
    if (!supplierId || tableData.value.length === 0) {
      return;
    }
    let changed = false;
    tableData.value.forEach((item) => {
      if (!item.supplierId) {
        item.supplierId = supplierId;
        changed = true;
      }
    });
    if (changed) {
      emitItemsUpdate(true);
    }
  },
);

/** 计算 discountPrice、totalPrice 价格 */
watch(
  () => [tableData.value, props.discountPercent, props.feeAmount],
  () => {
    if (props.remotePaging) {
      return;
    }
    if (!tableData.value || tableData.value.length === 0) {
      return;
    }
    const totalPrice = purchaseDecimalAdd(
      ...tableData.value.map((item) => item.totalProductPrice || 0),
    );
    const discountPrice =
      props.discountPercent === null
        ? 0
        : purchaseDecimalMultiply(
            totalPrice,
            purchaseDecimalDivide(props.discountPercent, 100),
          );
    const finalTotalPrice = purchaseDecimalAdd(
      purchaseDecimalSubtract(totalPrice, discountPrice),
      props.feeAmount || 0,
    );
    emit('update:discount-price', discountPrice);
    emit('update:total-price', finalTotalPrice);
  },
  { deep: true },
);

function createBlankItemRow() {
  const row = {
    count: 1,
    gift: false,
    packageQty: 1,
    remark: '',
    supplierId: props.supplierId,
  } as ErpPurchaseOrderApi.PurchaseOrderItem;
  ensureRowIdentity(row);
  initRow(row);
  setCountText(row);
  return row;
}

const itemRowFocusController = createErpItemRowFocusController({
  focusField: (row: ErpPurchaseOrderApi.PurchaseOrderItem, field) =>
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

function handleImport() {
  emit('import');
}

function isEditableTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  if (!element) return false;
  const tagName = element.tagName?.toLowerCase();
  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    element.isContentEditable ||
    isShortcutOverlayTarget(target)
  );
}

function isShortcutOverlayTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  return Boolean(
    element?.closest?.(
      '.ant-select-dropdown, .ant-picker-dropdown, .ant-popover',
    ),
  );
}

function formatAmount(value: unknown, fractionDigits = 6) {
  const numberValue = Number(value ?? 0);
  if (Number.isNaN(numberValue)) {
    return '';
  }
  return numberValue.toLocaleString('zh-CN', {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: 0,
  });
}

function formatPrice(value: unknown) {
  return formatPurchaseAmount(value, '-');
}

function isPriceItemHidden(field: string) {
  return isPurchaseOrderPriceItemHidden(props.hiddenFields, field);
}

function formatDateTimeValue(value: unknown) {
  return value ? formatDateTime(value as any) || '-' : '-';
}

function getRecordValue(record: Record<string, any>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  return undefined;
}

function getHistoryCount(record: Record<string, any>) {
  return getRecordValue(record, [
    'count',
    'itemCount',
    'totalCount',
    'purchaseCount',
  ]);
}

function getHistoryProductPrice(record: Record<string, any>) {
  return getRecordValue(record, [
    'productPrice',
    'purchasePrice',
    'lastPurchasePrice',
    'totalProductPrice',
    'totalPrice',
  ]);
}

function getHistoryTotalPrice(record: Record<string, any>) {
  return getRecordValue(record, [
    'totalProductPrice',
    'totalPrice',
    'productTotalPrice',
  ]);
}

function getHistoryDate(record: Record<string, any>) {
  return getRecordValue(record, [
    purchaseHistoryDateField.value,
    'orderDate',
    'inTime',
    'orderTime',
    'createTime',
  ]);
}

function getInTransitCount(record: Record<string, any>) {
  const count = Number(getHistoryCount(record) || 0);
  const arrivalCount = Number(record.arrivalCount ?? record.inCount ?? 0);
  return Math.max(count - arrivalCount, 0);
}

function getPurchaseOrderStatusText(status?: number) {
  if (status === PURCHASE_ORDER_STATUS.DRAFT) return '草稿';
  if (status === PURCHASE_ORDER_STATUS.APPROVE) return '已下订';
  if (status === PURCHASE_ORDER_STATUS.PROCESS) return '未下订';
  return '-';
}

function getPurchaseOrderStatusColor(status?: number) {
  if (status === PURCHASE_ORDER_STATUS.DRAFT) return 'blue';
  if (status === PURCHASE_ORDER_STATUS.APPROVE) return 'green';
  if (status === PURCHASE_ORDER_STATUS.PROCESS) return 'orange';
  return 'default';
}

const PURCHASE_HISTORY_SORT_FIELD_MAP: Record<string, string> = {
  businessTime: 'businessTime',
  count: 'count',
  creatorName: 'creatorName',
  documentNo: 'documentNo',
  documentType: 'documentType',
  productPrice: 'productPrice',
  remark: 'remark',
  supplierName: 'supplierName',
  warehouseName: 'warehouseName',
};
const PURCHASE_ORDER_HISTORY_SORT_FIELD_MAP: Record<string, string> = {
  arrivalCount: 'inCount',
  batchNo: 'batchNo',
  count: 'totalCount',
  inTransitCount: 'inTransitCount',
  no: 'no',
  orderTime: 'orderTime',
  productPrice: 'totalProductPrice',
  remark: 'remark',
  reviewerName: 'updater',
  status: 'status',
  supplierName: 'supplierId',
  totalProductPrice: 'totalProductPrice',
};

function getHistorySortFieldMap() {
  return purchaseHistoryMode.value === 'history'
    ? PURCHASE_HISTORY_SORT_FIELD_MAP
    : PURCHASE_ORDER_HISTORY_SORT_FIELD_MAP;
}

function buildHistorySortParams() {
  const sorter = purchaseHistorySorter.value;
  if (!sorter.field || !sorter.order) {
    return {};
  }
  const orderField = getHistorySortFieldMap()[sorter.field];
  if (!orderField) {
    return {};
  }
  return {
    orderDirection: sorter.order === 'ascend' ? 'asc' : 'desc',
    orderField,
  };
}

function buildHistoryFilterParams() {
  const filters = purchaseHistoryFilters.value;
  return {
    [purchaseHistoryDateField.value]: filters.dateRange,
    supplierId: filters.supplierId,
  };
}

const purchaseHistoryColumns = computed<TableColumnsType<HistoryRow>>(() => {
  const sort = purchaseHistorySorter.value;
  const withSort = (columns: TableColumnsType<HistoryRow>) =>
    columns.map((column) => ({
      ...column,
      sortOrder: sort.field === column.key ? sort.order : null,
    }));

  if (purchaseHistoryMode.value === 'history') {
    return withSort([
      {
        dataIndex: 'documentType',
        key: 'documentType',
        sorter: true,
        title: '单据类型',
        width: 100,
      },
      {
        dataIndex: 'documentNo',
        key: 'documentNo',
        sorter: true,
        title: '单号',
        width: 170,
      },
      {
        dataIndex: 'supplierName',
        key: 'supplierName',
        sorter: true,
        title: '供应商',
        width: 180,
      },
      {
        dataIndex: 'count',
        key: 'count',
        sorter: true,
        title: '采购数',
        width: 100,
      },
      {
        dataIndex: 'productPrice',
        key: 'productPrice',
        sorter: true,
        title: '采购价格',
        width: 110,
      },
      {
        dataIndex: 'businessTime',
        key: 'businessTime',
        sorter: true,
        title: '业务日期',
        width: 170,
      },
      {
        dataIndex: 'warehouseName',
        key: 'warehouseName',
        sorter: true,
        title: '仓库',
        width: 140,
      },
      {
        dataIndex: 'creatorName',
        key: 'creatorName',
        sorter: true,
        title: '开单人',
        width: 120,
      },
      {
        dataIndex: 'remark',
        key: 'remark',
        sorter: true,
        title: '备注',
        width: 220,
      },
    ]);
  }

  return withSort([
    {
      dataIndex: 'supplierName',
      key: 'supplierName',
      sorter: true,
      title: '供应商',
      width: 180,
    },
    {
      dataIndex: 'batchNo',
      key: 'batchNo',
      sorter: true,
      title: '批次号',
      width: 130,
    },
    {
      dataIndex: 'orderTime',
      key: 'orderTime',
      sorter: true,
      title: '订货日期',
      width: 170,
    },
    { dataIndex: 'no', key: 'no', sorter: true, title: '订货单号', width: 170 },
    {
      dataIndex: 'count',
      key: 'count',
      sorter: true,
      title: '数量',
      width: 100,
    },
    {
      dataIndex: 'productPrice',
      key: 'productPrice',
      sorter: true,
      title: '单价',
      width: 110,
    },
    {
      dataIndex: 'totalProductPrice',
      key: 'totalProductPrice',
      sorter: true,
      title: '金额',
      width: 120,
    },
    {
      dataIndex: 'arrivalCount',
      key: 'arrivalCount',
      sorter: true,
      title: '到货数',
      width: 100,
    },
    {
      dataIndex: 'inTransitCount',
      key: 'inTransitCount',
      sorter: true,
      title: '在途数',
      width: 100,
    },
    {
      dataIndex: 'reviewerName',
      key: 'reviewerName',
      sorter: true,
      title: '审核人',
      width: 120,
    },
    {
      dataIndex: 'status',
      key: 'status',
      sorter: true,
      title: '单据状态',
      width: 110,
    },
    {
      dataIndex: 'remark',
      key: 'remark',
      sorter: true,
      title: '备注',
      width: 220,
    },
  ]);
});

async function queryPurchaseHistory(
  pageNo = purchaseHistoryPagination.value.current,
) {
  const row = getActiveItemRow();
  if (!row) {
    return;
  }
  purchaseHistoryLoading.value = true;
  try {
    const params = {
      pageNo,
      pageSize: purchaseHistoryPagination.value.pageSize,
      productId: row.productId,
      ...buildHistoryFilterParams(),
      ...buildHistorySortParams(),
    };
    const result =
      purchaseHistoryMode.value === 'history'
        ? await getPurchaseHistoryPage(params as ErpPurchaseHistoryApi.Query)
        : await getPurchaseOrderPage(params);
    purchaseHistoryRows.value = result.list ?? [];
    purchaseHistoryPagination.value = {
      ...purchaseHistoryPagination.value,
      current: pageNo,
      total: result.total ?? 0,
    };
  } finally {
    purchaseHistoryLoading.value = false;
  }
}

async function openPurchaseOrderHistory(mode: PurchaseHistoryMode) {
  const row = getActiveItemRow();
  if (!row) {
    return;
  }
  purchaseHistoryMode.value = mode;
  purchaseHistoryOpen.value = true;
  purchaseHistoryRows.value = [];
  purchaseHistoryPagination.value = {
    ...purchaseHistoryPagination.value,
    current: 1,
    total: 0,
  };
  purchaseHistorySorter.value = {};
  await queryPurchaseHistory(1);
}

async function handlePurchaseHistorySearch() {
  await queryPurchaseHistory(1);
}

async function handlePurchaseHistoryReset() {
  purchaseHistoryFilters.value = {};
  purchaseHistorySorter.value = {};
  await queryPurchaseHistory(1);
}

const handlePurchaseHistoryTableChange: NonNullable<
  TableProps<HistoryRow>['onChange']
> = async (pagination, _filters, sorter) => {
  const currentSorter = Array.isArray(sorter) ? sorter[0] : sorter;
  const field = currentSorter?.columnKey;
  const order = currentSorter?.order;
  purchaseHistorySorter.value =
    typeof field === 'string' && (order === 'ascend' || order === 'descend')
      ? { field, order }
      : {};
  purchaseHistoryPagination.value = {
    ...purchaseHistoryPagination.value,
    pageSize: pagination.pageSize ?? purchaseHistoryPagination.value.pageSize,
  };
  await queryPurchaseHistory(pagination.current ?? 1);
};

async function closeHistoryBeforeDetailNavigation() {
  if (!purchaseHistoryOpen.value) {
    return;
  }
  purchaseHistoryOpen.value = false;
  await nextTick();
}

function reopenModalOnNextFrame(modalApi: { open?: () => void }) {
  if (typeof window === 'undefined' || !window.requestAnimationFrame) {
    void nextTick(() => modalApi.open?.());
    return;
  }
  window.requestAnimationFrame(() => modalApi.open?.());
}

async function openSupplierDetail(record: Record<string, any>) {
  if (!record.supplierId) {
    return;
  }
  await closeHistoryBeforeDetailNavigation();
  await ensureModalReady(
    shouldRenderSupplierDetail,
    supplierDetailModalApi,
    loadSupplierDetailComponent,
  );
  supplierDetailModalApi.setData({ id: record.supplierId }).open();
  reopenModalOnNextFrame(supplierDetailModalApi);
}

async function openPurchaseOrderDetail(record: Record<string, any>) {
  if (!record.id) {
    return;
  }
  await closeHistoryBeforeDetailNavigation();
  await ensureModalReady(
    shouldRenderPurchaseOrderDetail,
    purchaseOrderDetailModalApi,
    loadPurchaseOrderDetailComponent,
  );
  purchaseOrderDetailModalApi.setData({ type: 'detail', id: record.id }).open();
  reopenModalOnNextFrame(purchaseOrderDetailModalApi);
}

async function openPurchaseInDetail(record: Record<string, any>) {
  const id = record.businessId ?? record.id;
  if (!id) {
    return;
  }
  await closeHistoryBeforeDetailNavigation();
  await ensureModalReady(
    shouldRenderPurchaseInDetail,
    purchaseInDetailModalApi,
    loadPurchaseInDetailComponent,
  );
  purchaseInDetailModalApi.setData({ type: 'detail', id }).open();
  reopenModalOnNextFrame(purchaseInDetailModalApi);
}

async function openPurchaseReturnDetail(record: Record<string, any>) {
  const id = record.businessId ?? record.id;
  if (!id) {
    return;
  }
  await closeHistoryBeforeDetailNavigation();
  await ensureModalReady(
    shouldRenderPurchaseReturnDetail,
    purchaseReturnDetailModalApi,
    loadPurchaseReturnDetailComponent,
  );
  purchaseReturnDetailModalApi.setData({ type: 'detail', id }).open();
  reopenModalOnNextFrame(purchaseReturnDetailModalApi);
}

async function openPurchaseHistoryDocumentDetail(record: Record<string, any>) {
  if (record.documentTypeCode === 'PURCHASE_RETURN') {
    await openPurchaseReturnDetail(record);
    return;
  }
  await openPurchaseInDetail(record);
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
  row.vehicleModel = product.vehicleModel ?? row.vehicleModel;
  row.originPlace = product.originPlace ?? row.originPlace;
  row.standard = product.standard ?? row.standard;
  row.featureCode = product.featureCode ?? row.featureCode;
  row.drawingNo = product.drawingNo ?? row.drawingNo;
  row.factoryCode = product.factoryCode ?? row.factoryCode;
  row.brand = product.brand ?? row.brand;
  row.productPurchasePrice = product.purchasePrice ?? row.productPurchasePrice;
  row.salePrice = product.salePrice ?? row.salePrice;
  row.minPrice = product.minPrice ?? row.minPrice;
  row.referencePrice = product.referencePrice ?? row.referencePrice;
  row.retailPrice = product.retailPrice ?? row.retailPrice;
  row.lastPurchasePrice = product.lastPurchasePrice ?? row.lastPurchasePrice;
  row.grossProfitRate = product.grossProfitRate ?? row.grossProfitRate;
  row.backupPrice1 = product.backupPrice1 ?? row.backupPrice1;
  row.wholesalePrice = product.wholesalePrice ?? row.wholesalePrice;
  row.sharePrice = product.sharePrice ?? row.sharePrice;
  (row as any).batchNoEnabled = isBatchNoEnabled(product.batchNoEnabled);
  handleRowChange(row);
}

function isShortcutDialogOpen() {
  return (
    purchaseHistoryOpen.value ||
    inlineStockSelectorOpen.value ||
    saleHistoryModalRef.value?.isShortcutDialogOpen?.() === true
  );
}

async function openSaleShortcutHistory(mode: PurchaseHistoryMode) {
  const row = getActiveItemRow();
  if (!row?.productId) {
    message.warning('请先点击一条采购明细');
    return;
  }
  await saleHistoryModalRef.value?.openShortcutHistory(mode, {
    ...(row as any),
    count: row.stockCount ?? 0,
    productBarCode: row.productBarCode,
    unitId: row.productUnitId,
    unitName: row.productUnitName,
  } as ErpStockApi.Stock);
}

function handleShortcut(event: KeyboardEvent) {
  if (pendingOrderHistoryShift && !isOrderHistoryShiftKey(event)) {
    pendingOrderHistoryShift = false;
  }
  if (event.defaultPrevented || event.repeat || event.isComposing) {
    return;
  }
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return;
  }
  const key = event.key.toLowerCase();
  if (!props.disabled && isCreateShortcutKey(event)) {
    if (
      priceReferenceOpen.value ||
      isShortcutDialogOpen() ||
      isShortcutOverlayTarget(event.target)
    ) {
      return;
    }
    event.preventDefault();
    void handleAddBlankItemRow();
    return;
  }
  if (isEditableTarget(event.target)) {
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
  if (isShortcutDialogOpen()) {
    return;
  }
  if (
    !props.disabled &&
    props.showImportButton &&
    event.key.toLowerCase() === 'i'
  ) {
    event.preventDefault();
    handleImport();
    return;
  }
  if (isOrderHistoryShiftKey(event)) {
    pendingOrderHistoryShift = true;
    return;
  }
  if (event.key === ' ' || event.code === 'Space') {
    event.preventDefault();
    void openPurchaseOrderHistory('history');
    return;
  }
  if (key === 's') {
    event.preventDefault();
    void openSaleShortcutHistory('history');
    return;
  }
  if (key === 'q') {
    event.preventDefault();
    void openSaleShortcutHistory('order');
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
  if (key === 'f') {
    event.preventDefault();
    openProductEdit();
  }
}

function isOrderHistoryShiftKey(event: KeyboardEvent) {
  return (
    event.key === 'Shift' ||
    event.code === 'ShiftLeft' ||
    event.code === 'ShiftRight'
  );
}

function handleShortcutKeyup(event: KeyboardEvent) {
  if (!isOrderHistoryShiftKey(event)) {
    pendingOrderHistoryShift = false;
    return;
  }
  if (!pendingOrderHistoryShift) {
    return;
  }
  pendingOrderHistoryShift = false;
  if (
    event.defaultPrevented ||
    event.isComposing ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    isEditableTarget(event.target) ||
    isShortcutDialogOpen()
  ) {
    return;
  }
  event.preventDefault();
  void openPurchaseOrderHistory('order');
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
  pendingOrderHistoryShift = false;
  window.removeEventListener('keydown', handleShortcut, true);
  window.removeEventListener('keyup', handleShortcutKeyup, true);
  isShortcutListening = false;
}

function buildPurchaseOrderItemFromStock(
  p: ErpStockApi.Stock,
): ErpPurchaseOrderApi.PurchaseOrderItem {
  const row: any = {
    id: undefined,
    productId: p.productId,
    productCode: p.productCode,
    productName: p.productName,
    productUnitId: p.unitId,
    productUnitName: p.unitName,
    productBarCode: p.productBarCode,
    weight: p.weight,
    packageQty: p.packageQty ?? 1,
    productPrice: p.lastPurchasePrice ?? 0,
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
    stockCount: p.count || 0,
    count: 1,
    totalProductPrice: undefined,
    remark: undefined,
    vehicleModel: p.vehicleModel,
    originPlace: p.originPlace,
    standard: p.standard,
    featureCode: p.featureCode,
    drawingNo: p.drawingNo,
    factoryCode: p.factoryCode,
    brand: p.brand,
    warehouseId: p.warehouseId,
    deptId: p.deptId ?? resolveWarehouseDeptId(p.warehouseId),
    warehousePosition: undefined,
    batchNo: p.batchNo,
    batchNoEnabled: isBatchNoEnabled(p.batchNoEnabled),
    supplierId: props.supplierId,
    priceVisible: p.priceVisible,
    arrivalCount: 0,
  };
  ensureRowIdentity(row);
  initRow(row);
  setCountText(row);
  return row;
}

function buildReplacementPurchaseOrderItemFromStock(
  stock: ErpStockApi.Stock,
  targetRow: ErpPurchaseOrderApi.PurchaseOrderItem,
) {
  const row = buildPurchaseOrderItemFromStock(stock);
  row.id = targetRow.id;
  row.seq = targetRow.seq ?? row.seq;
  row.clientRowKey = targetRow.clientRowKey ?? row.clientRowKey;
  (row as any).orderId = (targetRow as any).orderId;
  (row as any).orderNo = (targetRow as any).orderNo;
  row.inCount = targetRow.inCount;
  row.returnCount = targetRow.returnCount;
  row.arrivalCount = targetRow.arrivalCount ?? row.arrivalCount;
  return row;
}

async function insertStockProducts(
  products: ErpStockApi.Stock[],
  options: {
    targetRow?: ErpPurchaseOrderApi.PurchaseOrderItem;
  } = {},
) {
  const existedKeys = new Set(
    (tableData.value ?? [])
      .filter(
        (item) => getItemRowKey(item) !== getItemRowKey(options.targetRow),
      )
      .map((item) => buildPurchaseItemDuplicateKey(item)),
  );
  const selectedProducts = products.filter((product) => {
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
  if (selectedProducts.length === 0) {
    return;
  }

  const targetRowKey = getItemRowKey(options.targetRow);
  const targetIndex = targetRowKey
    ? tableData.value.findIndex((item) => getItemRowKey(item) === targetRowKey)
    : -1;
  let activeRow: ErpPurchaseOrderApi.PurchaseOrderItem;
  if (targetIndex >= 0 && options.targetRow) {
    const [firstStock, ...additionalStocks] = selectedProducts;
    const replacementRow = buildReplacementPurchaseOrderItemFromStock(
      firstStock!,
      options.targetRow,
    );
    const additionalRows = additionalStocks.map((stock) =>
      buildPurchaseOrderItemFromStock(stock),
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
      buildPurchaseOrderItemFromStock(stock),
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
  targetRow: ErpPurchaseOrderApi.PurchaseOrderItem,
  rows: ErpStockApi.Stock[],
) {
  void insertStockProducts(rows, { targetRow });
}

function handleInlineStockOpenChange(open: boolean) {
  inlineStockSelectorOpen.value = open;
}

async function handleWarehouseChange(row: any, _value?: any, option?: any) {
  const selected = Array.isArray(option) ? option[0] : option;
  if (selected?.deptId) {
    row.deptId = selected.deptId;
    row.deptName = selected.deptName;
  } else {
    row.deptId = resolveWarehouseDeptId(row.warehouseId);
  }
  row.stockCount =
    row.productId && row.warehouseId
      ? (await getStockCount(row.productId, row.warehouseId)) || 0
      : 0;
  handleRowChange(row);
}

/** 处理删除 */
function handleDelete(row: ErpPurchaseOrderApi.PurchaseOrderItem) {
  deleteItemRows([row]);
}

function deleteItemRows(rows: ErpPurchaseOrderApi.PurchaseOrderItem[]) {
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
  clearBatchItemSelection();
  emitItemsUpdate();
}

function handleBatchDeleteItems() {
  const rows = selectedDeleteItemRows.value;
  if (rows.length === 0) {
    message.warning('请先勾选要删除的采购明细');
    return;
  }
  Modal.confirm({
    title: `确认删除已选 ${rows.length} 条采购明细吗？`,
    content: '删除后将从当前采购订单明细中移除这些行。',
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: () => {
      deleteItemRows(rows);
    },
  });
}

/** 处理行数据变更 */
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
    emitItemsUpdate(false); // 新增行需要 reloadData
  } else {
    tableData.value[index] = row;
    emitItemsUpdate(true);
    void nextTick(refreshItemColumns);
  }
  if (activeItemSort.value) {
    void nextTick(refreshItemGrid);
  }
}

/** 订货数量失焦校验 */
function handleCountBlur(row: any) {
  const parsed = parsePurchaseOrderCountText(row.countText);
  if (!parsed.ok) {
    message.warning(parsed.message);
    setCountText(row);
    return;
  }
  row.count = parsed.value;
  handleRowChange(row);
}

/** 订货价格变更：前端兜底校验 <= 0（赠品行除外） */
function handlePriceChange(row: any) {
  if (row.gift) {
    row.productPrice = 0;
    setPriceText(row);
    handleRowChange(row);
    return;
  }
  const parsed = parsePurchaseOrderPriceText(row.priceText);
  if (!parsed.ok) {
    message.warning(parsed.message);
    setPriceText(row);
    return;
  }
  row.productPrice = parsed.value;
  handleRowChange(row);
}

/** 初始化行数据 */
function initRow(row: ErpPurchaseOrderApi.PurchaseOrderItem) {
  (row as any).batchNoEnabled = isBatchNoEnabled((row as any).batchNoEnabled);
  if (!isBatchNoEnabled((row as any).batchNoEnabled)) {
    (row as any).batchNo = undefined;
  }
  if (row.gift) {
    Object.assign(row, normalizePurchaseOrderGiftItem(row));
    setCountText(row);
    setPriceText(row);
    return;
  }
  row.totalProductPrice =
    row.productPrice !== null && row.productPrice !== undefined && row.count
      ? purchaseDecimalMultiply(row.productPrice, row.count)
      : 0;
  setCountText(row);
  setPriceText(row);
}

/** 处理赠品切换 */
function handleGiftChange(row: any) {
  initRow(row);
  handleRowChange(row);
}
function validate(items = tableData.value) {
  if (items.length === 0) {
    throw new Error('请先添加采购产品');
  }
  const duplicateKeys = new Set<string>();
  for (const [i, item] of items.entries()) {
    if (!item) continue;
    const parsed = parsePurchaseOrderCountText(getCountValidateValue(item));
    if (!parsed.ok) {
      throw new Error(`第 ${i + 1} 行：${parsed.message}`);
    }
    item.count = parsed.value;
    if (!item.productId) {
      throw new Error(`第 ${i + 1} 行：请选择产品`);
    }
    if (!item.warehouseId) {
      throw new Error(`第${i + 1} 行：请选择仓库`);
    }
    const duplicateKey = buildPurchaseItemDuplicateKey(item);
    if (duplicateKey) {
      if (duplicateKeys.has(duplicateKey)) {
        throw new Error(`第 ${i + 1} 行：产品、仓库、赠品标识重复`);
      }
      duplicateKeys.add(duplicateKey);
    }
    if (!item.count || item.count <= 0) {
      throw new Error(`第 ${i + 1} 行：请输入大于 0 的订货数量`);
    }
    if (!item.gift) {
      const priceParsed = parsePurchaseOrderPriceText(
        getPriceValidateValue(item),
      );
      if (!priceParsed.ok) {
        throw new Error(`第 ${i + 1} 行：${priceParsed.message}`);
      }
      item.productPrice = priceParsed.value;
    }
  }
  emitItemsUpdate(true);
}

async function reloadItemsFromProps() {
  await syncItemsFromProps(props.items, { force: true });
}

function focusItemRow(
  row: ErpPurchaseOrderApi.PurchaseOrderItem,
  field: ErpItemRowFocusField,
) {
  return itemRowFocusController.focus(row, field);
}

defineExpose({
  clearItemSort,
  focusItemRow,
  reloadItemsFromProps,
  validate,
});

/** 初始化 */
onMounted(() => {
  fillMissingDeptIdFromWarehouse();
  startShortcutListening();
});

onActivated(() => {
  startShortcutListening();
});

onDeactivated(() => {
  stopShortcutListening();
});

onBeforeUnmount(() => {
  stopShortcutListening();
});
</script>

<template>
  <div class="w-full">
    <div ref="itemTableWrapRef" class="purchase-order-item-table-wrap">
      <Grid class="w-full">
        <template #toolbar-buttons>
          <div class="purchase-order-item-toolbar-left">
            <div class="purchase-order-item-shortcut-hint">
              <span v-if="!disabled"><kbd>Insert</kbd><b>新增行</b></span>
              <span
                v-if="!disabled"
                class="purchase-order-item-shortcut-hint__divider"
              ></span>
              <span class="purchase-order-item-shortcut-hint__label">
                点击明细行后
              </span>
              <span><kbd>Space</kbd><b>采购历史</b></span>
              <span><kbd>Shift</kbd><b>采购订单历史</b></span>
              <span><kbd>S</kbd><b>销售历史</b></span>
              <span><kbd>Q</kbd><b>报价订单历史</b></span>
              <span><kbd>F</kbd><b>修改商品</b></span>
              <span class="purchase-order-item-shortcut-hint__divider"></span>
              <span class="purchase-order-item-shortcut-hint__label">
                当前页
              </span>
              <span><kbd>W</kbd><b>全部价格</b></span>
            </div>
            <div
              v-if="canShowBatchUpdateItems"
              class="purchase-order-item-batch-summary"
            >
              已选 {{ selectedBatchItemCount }} 条 / 可改
              {{ batchEditableItemCount }} 条
            </div>
          </div>
        </template>
        <template #toolbar-tools>
          <div class="purchase-order-item-toolbar flex items-center gap-2">
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
              v-if="canShowBatchUpdateItems"
              type="primary"
              :disabled="selectedBatchItemCount === 0"
              @click="handleOpenBatchUpdateItems"
            >
              批量修改仓库/部门
            </Button>
            <TableAction
              v-if="!disabled && showImportButton"
              :actions="[
                {
                  label: '导入明细',
                  type: 'default' as const,
                  tooltip: '导入采购订单明细',
                  onClick: handleImport,
                },
              ]"
            />
          </div>
        </template>
        <template #inStatus="{ row }">
          <Tag
            v-if="
              Number(row.inCount || 0) > 0 &&
              Number(row.inCount || 0) >= Number(row.count || 0)
            "
            color="green"
          >
            已入库
          </Tag>
          <Tag v-else-if="Number(row.inCount || 0) > 0" color="orange">
            部分入库
          </Tag>
          <span v-else class="text-gray-400">未入库</span>
        </template>

        <template #productId="{ row }">
          <PurchaseInlineStockSelect
            settings-scope="purchase-order"
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
        <template #count="{ row }">
          <Input
            v-if="!disabled"
            :value="(row as any).countText"
            class="w-full"
            :data-erp-item-row-key="getItemRowKey(row)"
            data-purchase-order-count-input="true"
            inputmode="decimal"
            autocomplete="off"
            @update:value="(value) => ((row as any).countText = value)"
            @focus="setActiveItemRow(row)"
            @press-enter="handleItemInputPressEnter"
            @blur="handleCountBlur(row)"
          />
          <span v-else>{{ formatPurchaseDecimal(row.count, '-') }}</span>
        </template>
        <template #productPrice="{ row }">
          <span v-if="disabled && isPriceItemHidden('productPrice')">****</span>
          <Input
            v-else-if="!disabled && !row.gift"
            :value="(row as any).priceText"
            class="w-full"
            inputmode="decimal"
            autocomplete="off"
            @update:value="(value) => ((row as any).priceText = value)"
            @focus="setActiveItemRow(row)"
            @press-enter="handleItemInputPressEnter"
            @blur="handlePriceChange(row)"
          />
          <span v-else-if="row.gift" class="text-gray-400">0（赠品）</span>
          <span v-else>{{ formatPurchaseAmount(row.productPrice, '-') }}</span>
        </template>
        <template #warehouseId="{ row }">
          <span v-if="disabled" class="purchase-order-item-readonly-cell">
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
            allow-clear
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
            v-if="isItemDeptReadonly(row)"
            class="purchase-order-item-readonly-cell"
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
        <template #warehousePosition="{ row }">
          <Input
            v-if="!disabled"
            v-model:value="row.warehousePosition"
            class="w-full"
            @press-enter="handleItemInputPressEnter"
            @change="handleRowChange(row)"
          />
          <span v-else>{{ row.warehousePosition || '-' }}</span>
        </template>
        <template #drawingNo="{ row }">
          <Input
            v-if="!disabled"
            v-model:value="row.drawingNo"
            class="w-full"
            @press-enter="handleItemInputPressEnter"
            @change="handleRowChange(row)"
          />
          <span v-else>{{ row.drawingNo || '-' }}</span>
        </template>
        <template #batchNo="{ row }">
          <Input
            v-if="!disabled"
            v-model:value="row.batchNo"
            :disabled="!isBatchNoEnabled(row.batchNoEnabled)"
            class="w-full"
            placeholder="请输入批次号"
            @press-enter="handleItemInputPressEnter"
            @change="handleRowChange(row)"
          />
          <span v-else>{{ row.batchNo || '-' }}</span>
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
        <template #gift="{ row }">
          <div class="flex items-center gap-1">
            <Switch
              v-model:checked="row.gift"
              :disabled="disabled"
              size="small"
              @change="handleGiftChange(row)"
            />
            <Tag v-if="row.gift" color="red" class="!m-0 !px-1.5 font-bold">
              赠品
            </Tag>
          </div>
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
    <div v-if="showItemPager" class="purchase-order-item-pager">
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
  </div>

  <BatchUpdateItemsModal @success="handleBatchUpdateItemsSuccess" />
  <SaleStockProductSelectModal
    ref="saleHistoryModalRef"
    candidate-focus-highlight
    :enable-sale-stock-shortcuts="true"
    :hidden-fields="props.hiddenFields"
    :sale-dept-id="props.deptId"
  />

  <Modal
    v-model:open="purchaseHistoryOpen"
    :footer="null"
    :title="purchaseHistoryTitle"
    class="!w-[92vw] purchase-order-item-history-modal"
  >
    <div class="purchase-order-item-history-panel">
      <div class="purchase-order-item-history-filter">
        <div
          class="purchase-order-item-history-filter__item purchase-order-item-history-filter__date"
        >
          <span>日期范围</span>
          <DatePicker.RangePicker
            v-model:value="purchaseHistoryFilters.dateRange"
            value-format="YYYY-MM-DD HH:mm:ss"
            show-time
            allow-clear
            :placeholder="['开始日期', '结束日期']"
          />
        </div>
        <div class="purchase-order-item-history-filter__item">
          <span>供应商</span>
          <SupplierLazySelect
            v-model:value="purchaseHistoryFilters.supplierId"
            allow-clear
            show-search
            placeholder="供应商"
            popup-class-name="purchase-order-item-history-dropdown erp-candidate-focus-popup"
            class="purchase-order-item-history-filter__supplier"
          />
        </div>
        <Space>
          <Button
            type="primary"
            size="small"
            @click="handlePurchaseHistorySearch"
          >
            查询
          </Button>
          <Button size="small" @click="handlePurchaseHistoryReset">重置</Button>
        </Space>
      </div>
      <div class="purchase-order-item-history-table-wrap">
        <Table
          :columns="purchaseHistoryColumns"
          :data-source="purchaseHistoryRows"
          :loading="purchaseHistoryLoading"
          :pagination="purchaseHistoryTablePagination"
          class="purchase-order-item-history-table"
          :row-key="(record) => record.rowKey || record.id"
          size="small"
          :show-sorter-tooltip="false"
          :scroll="{ x: 1500, y: 480 }"
          @change="handlePurchaseHistoryTableChange"
        >
          <template #bodyCell="{ column, record, text }">
            <a
              v-if="column.key === 'supplierName' && record.supplierId"
              @click.stop="openSupplierDetail(record)"
            >
              {{ text || '-' }}
            </a>
            <a
              v-else-if="column.key === 'no' && purchaseHistoryMode === 'order'"
              @click.stop="openPurchaseOrderDetail(record)"
            >
              {{ text || '-' }}
            </a>
            <a
              v-else-if="
                column.key === 'documentNo' && purchaseHistoryMode === 'history'
              "
              @click.stop="openPurchaseHistoryDocumentDetail(record)"
            >
              {{ text || '-' }}
            </a>
            <Tag
              v-else-if="
                column.key === 'documentType' &&
                purchaseHistoryMode === 'history'
              "
            >
              {{ text || '-' }}
            </Tag>
            <span v-else-if="column.key === 'count'">
              {{ formatAmount(getHistoryCount(record), 3) || '-' }}
            </span>
            <span v-else-if="column.key === 'productPrice'">
              {{ formatPrice(getHistoryProductPrice(record)) }}
            </span>
            <span v-else-if="column.key === 'totalProductPrice'">
              {{ formatPrice(getHistoryTotalPrice(record)) }}
            </span>
            <span
              v-else-if="
                column.key === 'orderTime' || column.key === 'businessTime'
              "
            >
              {{ formatDateTimeValue(getHistoryDate(record)) }}
            </span>
            <span v-else-if="column.key === 'arrivalCount'">
              {{
                formatAmount(record.arrivalCount ?? record.inCount, 3) || '-'
              }}
            </span>
            <span v-else-if="column.key === 'inTransitCount'">
              {{ formatAmount(getInTransitCount(record), 3) || '-' }}
            </span>
            <span v-else-if="column.key === 'reviewerName'">
              {{ record.reviewerName || record.updaterName || '-' }}
            </span>
            <Tag
              v-else-if="column.key === 'status'"
              :color="getPurchaseOrderStatusColor(record.status)"
            >
              {{ getPurchaseOrderStatusText(record.status) }}
            </Tag>
            <span v-else>{{ text || '-' }}</span>
          </template>
        </Table>
      </div>
    </div>
  </Modal>
  <ProductFormModal @success="handleProductFormSuccess" />
  <SupplierDetailModal v-if="shouldRenderSupplierDetail" />
  <PurchaseOrderDetailModal v-if="shouldRenderPurchaseOrderDetail" />
  <PurchaseInDetailModal v-if="shouldRenderPurchaseInDetail" />
  <PurchaseReturnDetailModal v-if="shouldRenderPurchaseReturnDetail" />
</template>

<style scoped>
:deep(.vxe-table),
:deep(.ant-input),
:deep(.ant-input-number),
:deep(.ant-select) {
  font-size: 11px;
}

:deep(.purchase-order-item-toolbar .ant-btn),
:deep(.purchase-order-item-toolbar .ant-btn span) {
  font-size: 12px;
}

.purchase-order-item-toolbar :deep(.ant-btn) {
  height: 28px;
  padding: 2px 10px;
  line-height: 20px;
}

.purchase-order-item-toolbar-left {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  gap: 6px 12px;
  align-items: center;
  min-width: 0;
}

.purchase-order-item-batch-summary {
  min-width: 0;
  font-size: 12px;
  color: #475569;
}

.purchase-order-item-readonly-cell {
  display: block;
  width: 100%;
  color: #475569;
  white-space: nowrap;
}

.purchase-order-item-shortcut-hint {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  min-width: 0;
  font-size: 12px;
  color: #334155;
}

.purchase-order-item-shortcut-hint__label {
  color: #64748b;
}

.purchase-order-item-shortcut-hint
  span:not(.purchase-order-item-shortcut-hint__label) {
  display: inline-flex;
  gap: 5px;
  align-items: center;
  min-height: 26px;
  padding: 2px 8px;
  background: #f8fafc;
  border: 1px solid #d8e0ea;
  border-radius: 4px;
}

.purchase-order-item-shortcut-hint__divider {
  width: 1px;
  height: 16px;
  min-height: 16px !important;
  padding: 0 !important;
  background: #d9e2ef !important;
  border: 0 !important;
}

.purchase-order-item-shortcut-hint b {
  font-weight: 600;
}

.purchase-order-item-shortcut-hint kbd {
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

.purchase-order-item-table-wrap {
  position: relative;
}

:deep(.vxe-header--column.is--sortable .vxe-cell--title) {
  color: #1677ff;
}

:deep(.vxe-header--column .vxe-cell--sort) {
  display: none;
}

:deep(.vxe-body--column .table-actions .ant-btn-link) {
  height: 28px;
  padding: 0 8px;
  font-size: 12px;
  line-height: 28px;
  white-space: nowrap;
}

:deep(.erp-gift-row) {
  background-color: rgba(255, 77, 79, 0.08) !important;
}
:deep(.erp-gift-row:hover td) {
  background-color: rgba(255, 77, 79, 0.16) !important;
}

.purchase-order-item-pager {
  display: flex;
  justify-content: flex-end;
  padding: 8px 0 0;
}

.purchase-order-item-pager :deep(.ant-pagination),
.purchase-order-item-pager :deep(.ant-pagination-item),
.purchase-order-item-pager :deep(.ant-pagination-total-text),
.purchase-order-item-pager :deep(.ant-pagination-options),
.purchase-order-item-pager :deep(.ant-select),
.purchase-order-item-pager :deep(.ant-input) {
  font-size: 11px;
}

.purchase-order-item-pager :deep(.ant-pagination-item),
.purchase-order-item-pager :deep(.ant-pagination-prev),
.purchase-order-item-pager :deep(.ant-pagination-next),
.purchase-order-item-pager :deep(.ant-pagination-jump-prev),
.purchase-order-item-pager :deep(.ant-pagination-jump-next) {
  min-width: 24px;
  height: 24px;
  line-height: 22px;
}

.purchase-order-item-pager :deep(.ant-pagination-item a),
.purchase-order-item-pager :deep(.ant-pagination-prev button),
.purchase-order-item-pager :deep(.ant-pagination-next button) {
  height: 22px;
  font-size: 11px;
  line-height: 22px;
}

.purchase-order-item-pager :deep(.ant-pagination-options-size-changer),
.purchase-order-item-pager :deep(.ant-select-single),
.purchase-order-item-pager :deep(.ant-select-selector) {
  height: 24px;
  line-height: 22px;
}

.purchase-order-item-pager
  :deep(.ant-pagination-options-size-changer .ant-select-selector) {
  box-sizing: border-box;
  align-items: center;
  min-height: 24px;
  padding: 0 24px 0 8px;
}

.purchase-order-item-pager
  :deep(.ant-select-single .ant-select-selector .ant-select-selection-item) {
  height: 22px;
  font-size: 11px;
  line-height: 22px;
}

.purchase-order-item-pager :deep(.ant-select-arrow) {
  margin-top: -5px;
  font-size: 10px;
}

.purchase-order-item-pager :deep(.ant-pagination-options-quick-jumper input) {
  height: 24px;
  padding: 0 7px;
  font-size: 11px;
  line-height: 22px;
}

:deep(.purchase-order-item-row--active td) {
  background-color: rgba(22, 119, 255, 0.1) !important;
}

:deep(.purchase-order-item-row--active td:first-child) {
  box-shadow: inset 3px 0 0 #1677ff;
}

:deep(.purchase-order-item-row--active:hover td) {
  background-color: rgba(22, 119, 255, 0.16) !important;
}

:deep(.purchase-order-item-history-modal .ant-modal-body),
:deep(.purchase-order-item-history-modal .ant-table),
:deep(.purchase-order-item-history-modal .ant-table-cell),
:deep(.purchase-order-item-history-modal .ant-select),
:deep(.purchase-order-item-history-modal .ant-picker),
:deep(.purchase-order-item-history-modal .ant-btn) {
  font-size: 12px;
}

.purchase-order-item-history-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.purchase-order-item-history-filter {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.purchase-order-item-history-filter__item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.purchase-order-item-history-filter__date :deep(.ant-picker) {
  width: 360px;
}

.purchase-order-item-history-filter__supplier {
  width: 220px;
}

.purchase-order-item-history-table-wrap {
  min-height: 480px;
}
</style>
