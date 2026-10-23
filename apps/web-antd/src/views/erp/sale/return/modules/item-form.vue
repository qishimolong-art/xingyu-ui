<script lang="ts" setup>
import { CANDIDATE_FOCUS_KEY } from '#/views/erp/utils/candidate-focus';

import type { ErpSaleReturnApi } from '#/api/erp/sale/return';
import type { ErpStockApi } from '#/api/erp/stock/stock';
import type { SaleReturnItemSortOrder } from './sale-return-item-sort';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';

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
import {
  Button,
  Input,
  message,
  Modal,
  Pagination,
  Select,
  Tag,
} from 'ant-design-vue';

import { TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import { getProduct } from '#/api/erp/product/product';
import {
  getSaleReturnDeptSimplePage,
  getSaleReturnWarehouseDeptSimplePage,
} from '#/api/erp/sale/return';
import {
  getSaleStockPage,
  getWarehouseStockCount,
} from '#/api/erp/stock/stock';
import {
  getSaleWarehouseSimplePage,
  getWarehouse,
} from '#/api/erp/stock/warehouse';
import { getDept } from '#/api/system/dept';
import { isFieldHidden } from '#/composables/useFieldPermission';
import {
  formatSaleAmount,
  formatSaleDecimal,
  saleDecimalAdd,
  saleDecimalDivide,
  saleDecimalMultiply,
  saleDecimalSubtract,
} from '#/views/erp/sale/utils/decimal';
import ErpLazyPageSelect from '#/views/erp/components/ErpLazyPageSelect.vue';
import ErpInlineStockSelect from '#/views/erp/components/ErpInlineStockSelect.vue';
import ItemPriceReferenceOverlay from '#/views/erp/components/ItemPriceReferenceOverlay.vue';
import ProductForm from '#/views/erp/product/product/modules/form.vue';
import PurchaseItemDetailShortcuts from '#/views/erp/purchase/components/PurchaseItemDetailShortcuts.vue';
import SaleBatchUpdateItemsForm from '#/views/erp/sale/components/sale-batch-update-items-form.vue';
import SaleStockProductSelectModal from '#/views/erp/sale/components/SaleStockProductSelectModal.vue';
import {
  CURRENT_SELECT_LABEL_PLACEHOLDER,
  findDeptName,
  findResolvedOptionById,
  isMissingDisplayName,
  isResolvedSelectOption,
  mergeResolvedOptionsById,
} from '#/views/erp/sale/utils/document-item-select';
import {
  applySaleDocumentItemColumnCustomization,
  fitSaleDocumentItemColumnsToWidth,
} from '#/views/erp/sale/utils/document-item-table';
import { getSalePriceReferenceOverlayHiddenFields } from '#/views/erp/sale/utils/field-permission';
import { createSaleItemClientRowKeyManager } from '#/views/erp/sale/utils/item-row-key';
import {
  focusSaleShortcutOwner,
  isSaleShortcutOwnerActive,
} from '#/views/erp/sale/utils/shortcut-scope';
import {
  firstNumericPrice,
  loadOrderPriceCustomFieldNames,
  pickCustomerLevelPrice,
} from '#/views/erp/sale/utils/price-level';
import {
  createErpItemRowFocusController,
  focusEditableInputByRowKey,
} from '#/views/erp/utils/item-row-focus';
import {
  focusFirstEditableInput,
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
import {
  formatSaleReturnCountInput,
  formatSaleReturnPriceInput,
  normalizeSaleReturnCount,
  normalizeSaleReturnPrice,
  parseSaleReturnNumberText,
} from './sale-return-item-number';
import { sortSaleReturnItems } from './sale-return-item-sort';

provide(CANDIDATE_FOCUS_KEY, ref(true));

const itemRowKeyManager = createSaleItemClientRowKeyManager('sale-return-item');

interface Props {
  items?: ErpSaleReturnApi.SaleReturnItem[];
  disabled?: boolean;
  discountPercent?: number;
  feeAmount?: number;
  hiddenFields?: string[];
  mainDeptId?: number;
  customerPriceLevel?: number;
  documentId?: number;
  enableBatchEdit?: boolean;
  itemPageLoading?: boolean;
  itemPagination?: SaleReturnItemPagination;
  remotePaging?: boolean;
  shortcutActive?: boolean;
  warehouseReadonly?: boolean;
  stockLocationReadonly?: boolean;
}

interface BatchUpdateItemsPayload {
  deptId?: number;
  mode?: 'local' | 'server';
  warehouseId?: number;
}

type ApplyBatchUpdateItemsOptions = {
  showMessage?: boolean;
  validateDuplicate?: boolean;
};

type SaleReturnItemPagination = {
  orderDirection?: 'asc' | 'desc';
  orderField?: string;
  pageNo: number;
  pageSize: number;
  total: number;
};

type EditableSaleReturnItem = ErpSaleReturnApi.SaleReturnItem & {
  countText?: string;
  productPriceText?: string;
  taxPercentText?: string;
};

const DEFAULT_ITEM_PAGE_SIZE = 10;
const ITEM_PAGE_SIZE_OPTIONS = ['10', '20', '50', '100', '200'];
const ITEM_TABLE_VISIBLE_ROWS = 10;
const ITEM_TABLE_HEADER_HEIGHT = 40;
const ITEM_TABLE_ROW_HEIGHT = 36;
const ITEM_TABLE_HEIGHT =
  ITEM_TABLE_HEADER_HEIGHT + ITEM_TABLE_ROW_HEIGHT * ITEM_TABLE_VISIBLE_ROWS;
const SALE_RETURN_ALL_PRODUCT_PERMISSION = 'erp:sale-return:all-product';

const props = withDefaults(defineProps<Props>(), {
  items: () => [],
  disabled: false,
  discountPercent: 0,
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
  remotePaging: false,
  shortcutActive: true,
  warehouseReadonly: false,
  stockLocationReadonly: true,
});

const emit = defineEmits([
  'update:items',
  'update:discount-price',
  'update:fee-amount',
  'update:total-price',
  'batch-update-success',
  'page-change',
  'request-submit',
]);

const SALE_RETURN_ITEM_COUNT_INPUT_SELECTOR =
  '[data-sale-return-count-input="true"]';
const SALE_RETURN_PRODUCT_SELECT_INPUT_SELECTOR =
  '[data-erp-inline-stock-select-input="true"]';

const tableData = ref<EditableSaleReturnItem[]>([]); // 表格数据
const warehouseOptions = ref<any[]>([]); // 仓库下拉选项
const warehouseOptionsByDept = ref<Record<number, any[]>>({});
const deptOptions = ref<any[]>([]);
const activeItemSort = ref<
  { field: string; order: SaleReturnItemSortOrder } | undefined
>();
const localItemPage = ref({ pageNo: 1, pageSize: DEFAULT_ITEM_PAGE_SIZE });
const selectedBatchItemRows = ref<ErpSaleReturnApi.SaleReturnItem[]>([]);
const priceReferenceOpen = ref(false);
const inlineStockSelectorOpen = ref(false);
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
const [ProductFormModal, productFormModalApi] = useVbenModal({
  connectedComponent: ProductForm,
  destroyOnClose: true,
});
const [BatchUpdateItemsModal, batchUpdateItemsModalApi] = useVbenModal({
  connectedComponent: SaleBatchUpdateItemsForm,
  destroyOnClose: true,
});
function getAllSaleProductWarehouseParams() {
  return hasAccessByCodes([SALE_RETURN_ALL_PRODUCT_PERMISSION])
    ? {
        allSaleProduct: true,
        allSaleProductPermission: SALE_RETURN_ALL_PRODUCT_PERMISSION,
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

const canBatchEditWarehouse = computed(
  () =>
    !props.stockLocationReadonly &&
    !props.warehouseReadonly &&
    !isFieldHidden(props.hiddenFields, 'item_warehouseId'),
);
const canBatchEditDept = computed(
  () =>
    !props.stockLocationReadonly &&
    !isFieldHidden(props.hiddenFields, 'item_deptId'),
);
const canUseServerBatchUpdate = computed(
  () => props.disabled && Boolean(props.documentId),
);
const batchUpdateAccessCodes = computed(() =>
  props.documentId ? ['erp:sale-return:update'] : ['erp:sale-return:create'],
);
const canShowBatchUpdateItems = computed(
  () =>
    props.enableBatchEdit &&
    hasAccessByCodes(batchUpdateAccessCodes.value) &&
    (canBatchEditWarehouse.value || canBatchEditDept.value),
);
const canUseInlineStockSelector = computed(
  () => !props.disabled && !props.warehouseReadonly,
);
const batchUpdateButtonText = computed(() =>
  canBatchEditWarehouse.value && canBatchEditDept.value
    ? '批量修改仓库/部门'
    : canBatchEditWarehouse.value
      ? '批量修改仓库'
      : '批量修改部门',
);
const canShowItemSelection = computed(
  () => canUseInlineStockSelector.value || canShowBatchUpdateItems.value,
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

/** 获取表格合计数据 */
let isInternalUpdate = false;
let isShortcutListening = false;
let isShortcutScopeActive = false;
let pendingQuoteOrderHistoryShift = false;
let itemSelectLabelHydrateSequence = 0;

function findDeptExists(nodes: any[] = [], deptId: number): boolean {
  return nodes.some((node) => {
    if (node?.id === deptId) return true;
    return node?.children?.length
      ? findDeptExists(node.children, deptId)
      : false;
  });
}

function mergeOptionsById(oldOptions: any[], nextOptions: any[]) {
  return mergeResolvedOptionsById(oldOptions, nextOptions);
}

function handleWarehouseOptionsChange(options: any[]) {
  warehouseOptions.value = mergeOptionsById(warehouseOptions.value, options);
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

function loadItemDeptSimplePage(params: Record<string, any>) {
  const { warehouseId, ...rest } = params || {};
  return warehouseId
    ? getSaleReturnWarehouseDeptSimplePage({ ...rest, warehouseId })
    : getSaleReturnDeptSimplePage(rest as any);
}

function ensureDeptOption(deptId?: number, deptName?: string) {
  if (
    !deptId ||
    isMissingDisplayName(deptName, deptId) ||
    findDeptExists(deptOptions.value, deptId)
  ) {
    return;
  }
  deptOptions.value = [
    ...deptOptions.value,
    { id: deptId, name: deptName, children: [] },
  ];
}

function resolveWarehouseDeptId(warehouseId?: number) {
  if (!warehouseId) return undefined;
  const warehouse = findWarehouseOption(warehouseId);
  if (warehouse?.deptId) {
    // 仓库所属部门可能不在当前用户的部门数据权限范围内（跨部门分配的仓库），
    // 这里用仓库自带的 deptName 补齐分页选择器选项，避免回显时只显示原始 id。
    ensureDeptOption(warehouse.deptId, warehouse.deptName);
  }
  return warehouse?.deptId;
}

function resolveWarehouseDeptName(warehouseId?: number) {
  if (!warehouseId) return undefined;
  return findWarehouseOption(warehouseId)?.deptName;
}

function fillMissingDeptIdFromWarehouse() {
  tableData.value.forEach((item) => {
    if (props.mainDeptId) {
      item.deptId ??= props.mainDeptId;
      return;
    }
    const deptId = resolveWarehouseDeptId(item.warehouseId);
    item.deptId ??= deptId;
  });
}

function fillItemDeptIdFromMainDept(item: ErpSaleReturnApi.SaleReturnItem) {
  if (props.mainDeptId) {
    item.deptId = props.mainDeptId;
    return;
  }
  const deptId = resolveWarehouseDeptId(item.warehouseId);
  if (deptId) item.deptId ??= deptId;
}

async function refreshWarehouseOptions(deptId = props.mainDeptId) {
  const page = await getSaleWarehouseSimplePage({
    ...getAllSaleProductWarehouseParams(),
    deptId,
    pageNo: 1,
    pageSize: 10,
  });
  const options = page?.list || [];
  warehouseOptions.value = mergeOptionsById(warehouseOptions.value, options);
  if (deptId) {
    warehouseOptionsByDept.value = {
      ...warehouseOptionsByDept.value,
      [deptId]: options,
    };
  }
  appendCurrentDisplayOptions();
  void hydrateMissingCurrentSelectLabels(tableData.value);
}

function mergeWarehouseOptions(options: any[] = []) {
  warehouseOptions.value = mergeOptionsById(warehouseOptions.value, options);
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
  mergeWarehouseOptions(options);
}

async function loadWarehouseOptionsForRows(
  rows: ErpSaleReturnApi.SaleReturnItem[] = [],
) {
  const deptIds = new Set<number>();
  rows.forEach((row) => {
    if (!row) return;
    fillItemDeptIdFromMainDept(row);
    if (row.deptId) {
      deptIds.add(row.deptId);
    }
  });
  await Promise.all(
    [...deptIds].map((deptId) => loadWarehouseOptionsByDept(deptId)),
  );
}

function findWarehouseOption(warehouseId?: number) {
  if (!warehouseId) {
    return undefined;
  }
  const warehouse = findResolvedOptionById(warehouseOptions.value, warehouseId);
  if (warehouse) {
    return warehouse;
  }
  return Object.values(warehouseOptionsByDept.value)
    .flat()
    .find(
      (item) =>
        String(item?.id ?? item?.value) === String(warehouseId) &&
        isResolvedSelectOption(item),
    );
}

function getWarehouseOptions(row: ErpSaleReturnApi.SaleReturnItem): any[] {
  const rowDeptId = row.deptId ?? props.mainDeptId;
  const deptOptions = rowDeptId
    ? warehouseOptionsByDept.value[rowDeptId]
    : undefined;
  const currentWarehouse = findWarehouseOption(row.warehouseId);
  if (deptOptions) {
    if (
      currentWarehouse &&
      !deptOptions.some((warehouse) => warehouse.id === row.warehouseId)
    ) {
      return [...deptOptions, currentWarehouse];
    }
    return deptOptions;
  }
  if (currentWarehouse) {
    return [currentWarehouse];
  }
  if (row.warehouseId) {
    const currentName = row.warehouseName || (row as any).warehouseNameLabel;
    return [
      {
        id: row.warehouseId,
        name: isMissingDisplayName(currentName, row.warehouseId)
          ? CURRENT_SELECT_LABEL_PLACEHOLDER
          : currentName,
        deptId: row.warehouseDeptId,
        deptName: row.warehouseDeptName,
      },
    ];
  }
  return [];
}

function appendCurrentWarehouseOptions(
  items: ErpSaleReturnApi.SaleReturnItem[] = [],
) {
  const existingIds = new Set(
    warehouseOptions.value.map((warehouse) => warehouse.id),
  );
  items.forEach((item) => {
    if (
      !item.warehouseId ||
      existingIds.has(item.warehouseId) ||
      isMissingDisplayName(item.warehouseName, item.warehouseId)
    ) {
      return;
    }
    warehouseOptions.value.push({
      id: item.warehouseId,
      name: item.warehouseName,
      deptId: item.warehouseDeptId,
      deptName: item.warehouseDeptName,
    });
    existingIds.add(item.warehouseId);
  });
}

function appendCurrentDeptOptions(
  items: ErpSaleReturnApi.SaleReturnItem[] = [],
) {
  items.forEach((item) => {
    if (!item.deptId || isMissingDisplayName(item.deptName, item.deptId)) {
      return;
    }
    ensureDeptOption(item.deptId, item.deptName);
  });
}

function appendCurrentDisplayOptions(
  items: ErpSaleReturnApi.SaleReturnItem[] = tableData.value,
) {
  appendCurrentWarehouseOptions(items);
  appendCurrentDeptOptions(items);
}

function hydrateWarehouseSnapshot(row: ErpSaleReturnApi.SaleReturnItem) {
  if (!row.warehouseId) {
    return;
  }
  const warehouse = findWarehouseOption(row.warehouseId);
  if (isMissingDisplayName(row.warehouseName, row.warehouseId)) {
    row.warehouseName = warehouse?.name;
  }
  row.warehouseDeptId ??=
    warehouse?.deptId ?? resolveWarehouseDeptId(row.warehouseId);
  if (isMissingDisplayName(row.warehouseDeptName, row.warehouseDeptId)) {
    row.warehouseDeptName =
      warehouse?.deptName ?? resolveWarehouseDeptName(row.warehouseId);
  }
  ensureDeptOption(row.warehouseDeptId, row.warehouseDeptName);
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

function applyCachedSelectLabels(rows: ErpSaleReturnApi.SaleReturnItem[]) {
  let changed = false;
  rows.forEach((row) => {
    const warehouse = findWarehouseOption(row.warehouseId);
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
      isMissingDisplayName(row.deptName, row.deptId) &&
      deptName
    ) {
      row.deptName = deptName;
      changed = true;
    }
  });
  return changed;
}

async function hydrateMissingCurrentSelectLabels(
  rows: ErpSaleReturnApi.SaleReturnItem[],
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
          (row) => row.deptId && isMissingDisplayName(row.deptName, row.deptId),
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

function isCrossDeptWarehouse(row: ErpSaleReturnApi.SaleReturnItem) {
  return (
    !!props.mainDeptId &&
    !!row.warehouseDeptId &&
    row.warehouseDeptId !== props.mainDeptId
  );
}

function getDisplayTableData() {
  const activeSort = activeItemSort.value;
  const rows =
    !activeSort || props.remotePaging
      ? [...tableData.value]
      : sortSaleReturnItems(
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

async function refreshItemGrid() {
  const displayData = getDisplayTableData();
  gridApi.setGridOptions({ data: displayData });
  await gridApi.grid.reloadData(displayData);
  await gridApi.grid.reloadColumn(
    buildCustomizedItemColumns(displayData) || [],
  );
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

function canBatchUpdateItemRow(row?: ErpSaleReturnApi.SaleReturnItem) {
  return Boolean(row?.productId && (!props.disabled || row.id));
}

function canDeleteItemRow(row?: ErpSaleReturnApi.SaleReturnItem) {
  return Boolean(row && canUseInlineStockSelector.value);
}

function canSelectItemRow(row?: ErpSaleReturnApi.SaleReturnItem) {
  return canBatchUpdateItemRow(row) || canDeleteItemRow(row);
}

function buildItemColumns(
  rows: ErpSaleReturnApi.SaleReturnItem[] = getDisplayTableData(),
): NonNullable<
  VxeTableGridOptions<ErpSaleReturnApi.SaleReturnItem>['columns']
> {
  const columns =
    useFormItemColumns(tableData.value, props.disabled, props.hiddenFields, {
      editable: !props.disabled,
      isCellEditable: (field) =>
        (!props.stockLocationReadonly ||
          !['warehouseId', 'deptId'].includes(field)) &&
        (field !== 'warehouseId' || !props.warehouseReadonly),
      rows,
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
      VxeTableGridOptions<ErpSaleReturnApi.SaleReturnItem>['columns']
    >;
  }
  return columns as NonNullable<
    VxeTableGridOptions<ErpSaleReturnApi.SaleReturnItem>['columns']
  >;
}

function buildCustomizedItemColumns(
  rows: ErpSaleReturnApi.SaleReturnItem[] = getDisplayTableData(),
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

function clearBatchItemSelection() {
  selectedBatchItemRows.value = [];
  gridApi.grid?.clearCheckboxRow?.();
}

function handleOpenBatchUpdateItems() {
  if (!canShowBatchUpdateItems.value) return;
  if (selectedBatchItemCount.value === 0) {
    message.warning('请先勾选可批量修改的销售退货明细');
    return;
  }
  const isServerMode = canUseServerBatchUpdate.value;
  batchUpdateItemsModalApi
    .setData({
      documentId: isServerMode ? props.documentId : undefined,
      documentType: 'return',
      hiddenFields: props.hiddenFields,
      itemCount: selectedBatchItemCount.value,
      itemIds: isServerMode ? selectedBatchItemIds.value : [],
      mode: isServerMode ? 'server' : 'local',
      warehouseReadonly: props.warehouseReadonly,
    })
    .open();
}

async function handleBatchUpdateItemsSuccess(
  payload?: BatchUpdateItemsPayload,
) {
  if (props.stockLocationReadonly) return;
  if (payload?.mode === 'local') {
    const applied = await applyLocalBatchUpdateItems(payload);
    if (!applied) {
      return;
    }
    clearBatchItemSelection();
    return;
  }
  if (payload) {
    await applyLocalBatchUpdateItems(payload, {
      showMessage: false,
      validateDuplicate: false,
    });
  }
  clearBatchItemSelection();
  emit('batch-update-success');
}

function getItemRowKey(row?: ErpSaleReturnApi.SaleReturnItem) {
  if (!row) return undefined;
  return itemRowKeyManager.ensureRowKey(row);
}

function setActiveItemRow(row?: ErpSaleReturnApi.SaleReturnItem) {
  const key = getItemRowKey(row);
  if (key) activeItemRowKey.value = key;
}

function getActiveItemRow(showWarning = true) {
  const row = tableData.value.find(
    (item) => getItemRowKey(item) === activeItemRowKey.value,
  );
  if (!row?.productId) {
    if (showWarning) message.warning('请先点击一条有商品的退货明细');
    return undefined;
  }
  return row;
}

function getItemRowClassName({
  row,
}: {
  row: ErpSaleReturnApi.SaleReturnItem;
}) {
  return getItemRowKey(row) === activeItemRowKey.value
    ? 'sale-return-item-row--active'
    : '';
}

function isSelectedBatchItemRow(row: ErpSaleReturnApi.SaleReturnItem) {
  const rowKey = getItemRowKey(row);
  return selectedBatchItemRows.value
    .filter(canBatchUpdateItemRow)
    .some((item) => getItemRowKey(item) === rowKey);
}

function buildBatchUpdatedItems(payload: BatchUpdateItemsPayload) {
  const updatedRows: ErpSaleReturnApi.SaleReturnItem[] = [];
  const nextItems = tableData.value.map((item) => {
    if (!isSelectedBatchItemRow(item)) {
      return item;
    }
    const row = { ...item };
    if (payload.warehouseId !== undefined) {
      const warehouse = warehouseOptions.value.find(
        (option) => option.id === payload.warehouseId,
      );
      row.warehouseId = payload.warehouseId;
      row.warehouseName = warehouse?.name;
      row.warehouseDeptId = warehouse?.deptId;
      row.warehouseDeptName = warehouse?.deptName;
      ensureDeptOption(row.warehouseDeptId, row.warehouseDeptName);
    }
    if (payload.deptId !== undefined) {
      row.deptId = payload.deptId;
      row.deptName = findDeptName(deptOptions.value, payload.deptId);
    } else if (payload.warehouseId !== undefined) {
      fillItemDeptIdFromMainDept(row);
    }
    initRow(row);
    updatedRows.push(row);
    return row;
  });
  return { nextItems, updatedRows };
}

function hasDuplicateBatchUpdatedItems(
  items: ErpSaleReturnApi.SaleReturnItem[],
) {
  const keys = new Set<string>();
  return items.some((item) => {
    if (!item.productId || !item.warehouseId) {
      return false;
    }
    const key = [
      item.productId,
      item.warehouseId,
      item.batchNo?.trim() ?? '',
    ].join('::');
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
  if (props.stockLocationReadonly) return false;
  const { showMessage = true, validateDuplicate = true } = options;
  if (payload.warehouseId === undefined && payload.deptId === undefined) {
    message.warning('请至少选择仓库或部门');
    return false;
  }
  await refreshWarehouseOptions(props.mainDeptId);
  const { nextItems, updatedRows } = buildBatchUpdatedItems(payload);
  if (updatedRows.length === 0) {
    message.warning('请先勾选可批量修改的销售退货明细');
    return false;
  }
  if (validateDuplicate && hasDuplicateBatchUpdatedItems(nextItems)) {
    message.warning('批量修改后存在产品、仓库和批次重复，请调整后再操作');
    return false;
  }
  tableData.value = nextItems;
  if (payload.warehouseId !== undefined) {
    await Promise.allSettled(
      updatedRows.map(async (row) => {
        row.stockCount =
          row.productId && row.warehouseId
            ? (await getWarehouseStockCount({
                productId: row.productId,
                warehouseId: row.warehouseId,
              })) || 0
            : 0;
      }),
    );
  }
  emitItemsUpdate(true);
  await nextTick();
  await refreshItemGrid();
  if (showMessage) {
    message.success(`已批量更新 ${updatedRows.length} 条销售退货明细`);
  }
  return true;
}

/** 表格配置 */
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
    id: 'erp-sale-return-item-list-v1',
    autoResize: true,
    border: true,
    fit: false,
    rowConfig: {
      keyField: 'clientRowKey',
      isHover: true,
    },
    rowClassName: getItemRowClassName,
    checkboxConfig: {
      checkMethod: ({ row }: { row: ErpSaleReturnApi.SaleReturnItem }) =>
        canSelectItemRow(row),
    },
    pagerConfig: {
      enabled: false,
    },
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
    cellClick: ({ row }: { row: ErpSaleReturnApi.SaleReturnItem }) => {
      setActiveItemRow(row);
    },
    cellDblclick: ({ row }: { row: ErpSaleReturnApi.SaleReturnItem }) => {
      setActiveItemRow(row);
    },
    sortChange: handleItemSortChange,
    custom: handleItemColumnCustom,
    checkboxAll: ({
      records,
    }: {
      records: ErpSaleReturnApi.SaleReturnItem[];
    }) => {
      selectedBatchItemRows.value = records.filter(canSelectItemRow);
    },
    checkboxChange: ({
      records,
    }: {
      records: ErpSaleReturnApi.SaleReturnItem[];
    }) => {
      selectedBatchItemRows.value = records.filter(canSelectItemRow);
    },
  },
});

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
  if (!items) {
    return;
  }
  if (isInternalUpdate) {
    if (!options.force) {
      isInternalUpdate = false;
      return;
    }
    isInternalUpdate = false;
  }
  const nextItems = items.map((item) => ({
    ...item,
  })) as EditableSaleReturnItem[];
  nextItems.forEach((item) => {
    fillItemDeptIdFromMainDept(item);
    initRow(item);
    setCountText(item);
    setProductPriceText(item);
    setTaxPercentText(item);
  });
  await loadWarehouseOptionsForRows(nextItems);
  nextItems.forEach(hydrateWarehouseSnapshot);
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
  appendCurrentDisplayOptions(tableData.value);
  await nextTick(); // 特殊：保证 gridApi 已经初始化
  await refreshItemGrid();
  void hydrateMissingCurrentSelectLabels(tableData.value);
  // 更新表格列配置（目的：已出库、已出库动态列）
  await gridApi.grid.reloadColumn(buildCustomizedItemColumns() || []);
}

/** 监听外部传入的列数据 */
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
      } = item;
      return rest;
    }),
  );
}

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
  () => props.hiddenFields,
  async () => {
    await nextTick();
    await gridApi.grid.reloadColumn(buildCustomizedItemColumns() || []);
    if (activeItemSort.value) await gridApi.grid.setSort(activeItemSort.value);
  },
  { deep: true },
);

function buildShortcutStockRow(
  row: ErpSaleReturnApi.SaleReturnItem,
): ErpStockApi.Stock {
  return {
    id: row.id,
    productId: row.productId!,
    warehouseId: row.warehouseId ?? 0,
    deptId: row.warehouseDeptId ?? row.deptId,
    deptName: row.warehouseDeptName ?? row.deptName,
    count: Number(row.stockCount ?? 0),
    availableCount: Number(row.stockCount ?? 0),
    productCode: row.productCode,
    productName: row.productName,
    productBarCode: row.productBarCode,
    unitId: row.productUnitId,
    unitName: row.productUnitName,
    warehouseName: row.warehouseName,
    batchNo: row.batchNo,
    lastSalePrice: row.lastSalePrice,
    salePrice: row.salePrice ?? row.productPrice,
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
  row.productCode = product.code ?? row.productCode;
  row.productName = product.name ?? row.productName;
  row.productBarCode = product.barCode ?? row.productBarCode;
  row.productUnitId = product.unitId ?? row.productUnitId;
  row.productUnitName = product.unitName ?? row.productUnitName;
  row.weight = product.weight ?? row.weight;
  row.packageQty = product.packageQty ?? row.packageQty;
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
  if (!(overlay instanceof HTMLElement)) return false;
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
  if (targetOverlay && isVisibleShortcutOverlay(targetOverlay)) return true;
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
  if (isEditableEnterTarget(event.target)) return;
  if (
    canUseInlineStockSelector.value &&
    isCreateShortcutKey(event) &&
    !inlineStockSelectorOpen.value &&
    !isShortcutDialogOpen() &&
    !isShortcutOverlayTarget(event.target)
  ) {
    event.preventDefault();
    void handleAddBlankItemRow();
    return;
  }
  if (isPriceReferenceShortcut(event)) {
    if (
      shouldIgnorePriceReferenceShortcut(event) ||
      inlineStockSelectorOpen.value ||
      isShortcutDialogOpen() ||
      isShortcutOverlayTarget(event.target)
    ) {
      return;
    }
    event.preventDefault();
    priceReferenceOpen.value = !priceReferenceOpen.value;
    return;
  }
  if (inlineStockSelectorOpen.value || isShortcutDialogOpen()) {
    return;
  }
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
  if (!isSaleShortcutOwnerActive(itemTableWrapRef.value)) {
    pendingQuoteOrderHistoryShift = false;
    return;
  }
  if (!pendingQuoteOrderHistoryShift) return;
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
    inlineStockSelectorOpen.value ||
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

/** 计算 discountPrice、feeAmount、totalPrice 价格 */
watch(
  () => [tableData.value, props.discountPercent, props.feeAmount],
  () => {
    // 远程分页时这里只是当前页，整单金额继续使用主表汇总字段。
    if (props.remotePaging) {
      return;
    }
    if (!tableData.value || tableData.value.length === 0) {
      return;
    }
    const totalPrice = tableData.value.reduce(
      (prev, curr) => saleDecimalAdd(prev, curr.totalPrice || 0),
      0,
    );
    const discountPrice =
      props.discountPercent === null
        ? 0
        : saleDecimalMultiply(
            totalPrice,
            saleDecimalDivide(props.discountPercent, 100),
          );
    const discountedPrice = saleDecimalSubtract(totalPrice, discountPrice);
    const feeAmount = props.feeAmount ?? 0;
    const finalTotalPrice = saleDecimalAdd(discountedPrice, feeAmount);

    // 通知父组件更新
    emit('update:discount-price', discountPrice);
    emit('update:fee-amount', feeAmount);
    emit('update:total-price', finalTotalPrice);
  },
  { deep: true },
);

function getProductInputValue(row: ErpSaleReturnApi.SaleReturnItem) {
  const keyword = (row as any).__stockKeyword;
  return keyword === undefined || keyword === null
    ? row.productName || ''
    : String(keyword);
}

function handleProductKeywordInput(
  row: ErpSaleReturnApi.SaleReturnItem,
  value: string,
) {
  (row as any).__stockKeyword = value;
}

function escapeAttrValue(value: string) {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

function focusProductNameInput(row: ErpSaleReturnApi.SaleReturnItem) {
  if (!canUseInlineStockSelector.value) {
    return false;
  }
  const rowKey = getItemRowKey(row);
  const selector = rowKey
    ? `${SALE_RETURN_PRODUCT_SELECT_INPUT_SELECTOR}[data-erp-inline-stock-row-key="${escapeAttrValue(rowKey)}"]`
    : SALE_RETURN_PRODUCT_SELECT_INPUT_SELECTOR;
  return focusFirstEditableInput(itemTableWrapRef.value, selector);
}

function createBlankItemRow() {
  const row = {
    count: 1,
    productPrice: 0,
    remark: '',
    returnReason: undefined,
    taxPercent: 0,
    warehousePosition: undefined,
  } as ErpSaleReturnApi.SaleReturnItem;
  initRow(row);
  setCountText(row);
  setProductPriceText(row);
  return row;
}

const itemRowFocusController = createErpItemRowFocusController({
  focusField: (row: ErpSaleReturnApi.SaleReturnItem, field) =>
    field === 'product' ? focusProductNameInput(row) : focusItemCountInput(row),
  getAllRows: () => tableData.value,
  getDisplayedRows: getDisplayTableData,
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
  if (!canUseInlineStockSelector.value) {
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

function buildStockItemKey(item: {
  batchNo?: string;
  productId?: number;
  warehouseId?: number;
}) {
  return [
    item.productId ?? 'unknown',
    item.warehouseId ?? 'unknown',
    item.batchNo?.trim() ?? '',
  ].join('::');
}

function pickProductPrice(p: ErpStockApi.Stock | Record<string, any>): number {
  const customerPrice = pickCustomerLevelPrice(p, props.customerPriceLevel);
  if (customerPrice !== undefined) {
    return customerPrice;
  }
  return firstNumericPrice(p.salePrice, p.retailPrice, p.referencePrice);
}

function buildSaleReturnItemFromStock(stock: ErpStockApi.Stock) {
  const row = {
    productId: stock.productId,
    productName: stock.productName || '',
    productCode: stock.productCode || stock.productBarCode,
    productBarCode: stock.productBarCode,
    productUnitId: stock.unitId,
    productUnitName: stock.unitName,
    weight: stock.weight,
    packageQty: stock.packageQty,
    productPrice: pickProductPrice(stock),
    stockCount: stock.availableCount ?? stock.count ?? 0,
    count: 1,
    warehouseId: stock.warehouseId,
    warehouseName: stock.warehouseName,
    warehouseDeptId: stock.deptId,
    warehouseDeptName: stock.deptName,
    batchNo: stock.batchNo,
    deptId: props.mainDeptId ?? stock.deptId,
    deptName: props.mainDeptId === stock.deptId ? stock.deptName : undefined,
    taxPercent: 0,
    remark: '',
    returnReason: undefined,
    warehousePosition: undefined,
  } as ErpSaleReturnApi.SaleReturnItem;
  initRow(row);
  setCountText(row);
  setProductPriceText(row);
  return row;
}

function buildReplacementSaleReturnItemFromStock(
  stock: ErpStockApi.Stock,
  targetRow: ErpSaleReturnApi.SaleReturnItem,
) {
  const row = buildSaleReturnItemFromStock(stock);
  row.clientRowKey = targetRow.clientRowKey;
  row.id = targetRow.id;
  row.seq = targetRow.seq ?? row.seq;
  (row as any).returnId = (targetRow as any).returnId;
  return row;
}

function filterSelectableStockProducts(
  products: ErpStockApi.Stock[],
  targetRow?: ErpSaleReturnApi.SaleReturnItem,
) {
  const targetRowKey = getItemRowKey(targetRow);
  const existingKeys = new Set(
    (tableData.value || [])
      .filter((item) => getItemRowKey(item) !== targetRowKey)
      .map((item) => buildStockItemKey(item)),
  );
  const duplicateNames: string[] = [];
  const selectableProducts = products.filter((product) => {
    const key = buildStockItemKey(product);
    if (existingKeys.has(key)) {
      duplicateNames.push(
        `${product.productName || product.productCode || product.productId} / ${product.warehouseName || product.warehouseId} / ${product.batchNo || '未指定批次'}`,
      );
      return false;
    }
    existingKeys.add(key);
    return true;
  });
  if (duplicateNames.length > 0) {
    message.warning(`已过滤重复商品：${duplicateNames.join('、')}`);
  }
  return selectableProducts;
}

async function insertStockProducts(
  products: ErpStockApi.Stock[],
  options: {
    targetRow?: ErpSaleReturnApi.SaleReturnItem;
  } = {},
) {
  if (!products || products.length === 0) return;
  const previousRows = [...tableData.value];
  const targetRowKey = getItemRowKey(options.targetRow);
  const selectableProducts = filterSelectableStockProducts(
    products,
    options.targetRow,
  );
  if (selectableProducts.length === 0) return;

  const targetIndex = targetRowKey
    ? tableData.value.findIndex((item) => getItemRowKey(item) === targetRowKey)
    : -1;
  let focusRow: ErpSaleReturnApi.SaleReturnItem;
  if (targetIndex >= 0 && options.targetRow) {
    const [firstStock, ...additionalStocks] = selectableProducts;
    const replacementRow = buildReplacementSaleReturnItemFromStock(
      firstStock!,
      options.targetRow,
    );
    const additionalRows = additionalStocks.map(buildSaleReturnItemFromStock);
    tableData.value.splice(targetIndex, 1, replacementRow);
    if (additionalRows.length > 0) {
      tableData.value = [...tableData.value, ...additionalRows];
    }
    focusRow = replacementRow;
  } else {
    const newRows = selectableProducts.map(buildSaleReturnItemFromStock);
    tableData.value = [...tableData.value, ...newRows];
    focusRow = newRows[0]!;
  }
  emitItemsUpdate(false);
  if (
    props.remotePaging &&
    (targetIndex < 0 || selectableProducts.length > 1)
  ) {
    tableData.value = previousRows;
    return;
  }
  await itemRowFocusController.focus(focusRow, 'count');
}

function handleInlineStockSelected(
  targetRow: ErpSaleReturnApi.SaleReturnItem,
  rows: ErpStockApi.Stock[],
) {
  void insertStockProducts(rows, {
    targetRow,
  });
}

function handleInlineStockOpenChange(open: boolean) {
  inlineStockSelectorOpen.value = open;
}

/** 处理删除 */
function handleDelete(row: ErpSaleReturnApi.SaleReturnItem) {
  deleteItemRows([row]);
}

function deleteItemRows(rows: ErpSaleReturnApi.SaleReturnItem[]) {
  const deleteKeys = new Set(
    rows.map((row) => getItemRowKey(row)).filter(Boolean),
  );
  if (deleteKeys.size === 0) {
    return;
  }
  tableData.value = tableData.value.filter(
    (item) => !deleteKeys.has(getItemRowKey(item)),
  );
  if (!props.remotePaging) {
    localItemPage.value.pageNo = Math.max(
      1,
      Math.ceil(tableData.value.length / localItemPage.value.pageSize),
    );
  }
  clearBatchItemSelection();
  emitItemsUpdate(false);
  void refreshItemGrid();
}

function handleBatchDeleteItems() {
  const rows = selectedDeleteItemRows.value;
  if (rows.length === 0) {
    message.warning('请先勾选要删除的销售退货明细');
    return;
  }
  Modal.confirm({
    cancelText: '取消',
    content: '删除后将从当前销售退货明细中移除这些行。',
    okText: '删除',
    okType: 'danger',
    title: `确认删除已选 ${rows.length} 条销售退货明细吗？`,
    onOk: () => {
      deleteItemRows(rows);
    },
  });
}

/** 处理仓库变更 */
async function handleWarehouseChange(row: ErpSaleReturnApi.SaleReturnItem) {
  if (props.stockLocationReadonly) return;
  await loadWarehouseOptionsByDept(row.deptId ?? props.mainDeptId);
  fillItemDeptIdFromMainDept(row);
  const warehouse = findWarehouseOption(row.warehouseId);
  row.warehouseName = warehouse?.name;
  row.warehouseDeptId = warehouse?.deptId;
  row.warehouseDeptName = warehouse?.deptName;
  ensureDeptOption(row.warehouseDeptId, row.warehouseDeptName);
  const stockCount = await getWarehouseStockCount({
    productId: row.productId!,
    warehouseId: row.warehouseId!,
  });
  row.stockCount = stockCount || 0;
  handleRowChange(row);
}

async function handleDeptChange(row: ErpSaleReturnApi.SaleReturnItem) {
  if (props.stockLocationReadonly) return;
  await loadWarehouseOptionsByDept(row.deptId ?? props.mainDeptId);
  const options = getWarehouseOptions(row);
  if (
    row.warehouseId &&
    options.length > 0 &&
    !options.some((warehouse) => warehouse.id === row.warehouseId)
  ) {
    row.warehouseId = undefined;
    row.warehouseName = undefined;
    row.warehouseDeptId = undefined;
    row.warehouseDeptName = undefined;
    row.stockCount = 0;
    message.warning('当前仓库不在该销售部门可用范围内，请重新选择仓库');
  }
  handleRowChange(row);
}

/** 处理行数据变更 */
function handleRowChange(row: any) {
  const index = tableData.value.findIndex(
    (item) => getItemRowKey(item) === getItemRowKey(row),
  );
  if (index === -1) {
    tableData.value.push(row);
  } else {
    tableData.value[index] = row;
  }
  emitItemsUpdate(index !== -1);
  if (activeItemSort.value) {
    void nextTick(refreshItemGrid);
  }
}

function setCountText(row: ErpSaleReturnApi.SaleReturnItem) {
  (row as EditableSaleReturnItem).countText = formatSaleReturnCountInput(
    row.count,
  );
}

function setProductPriceText(row: ErpSaleReturnApi.SaleReturnItem) {
  (row as EditableSaleReturnItem).productPriceText = formatSaleReturnPriceInput(
    row.productPrice,
  );
}

function setTaxPercentText(row: ErpSaleReturnApi.SaleReturnItem) {
  (row as EditableSaleReturnItem).taxPercentText =
    row.taxPercent === null || row.taxPercent === undefined
      ? ''
      : formatSaleDecimal(row.taxPercent);
}

function recalculateRowAmounts(row: ErpSaleReturnApi.SaleReturnItem) {
  if (
    row.productPrice === null ||
    row.productPrice === undefined ||
    row.count === null ||
    row.count === undefined
  ) {
    row.totalProductPrice = 0;
    row.taxPrice = 0;
    row.totalPrice = 0;
    return;
  }
  row.totalProductPrice =
    saleDecimalMultiply(row.productPrice, row.count) ?? 0;
  row.taxPrice = 0;
  row.totalPrice = row.totalProductPrice;
}

function handleCountBlur(row: EditableSaleReturnItem) {
  const parsed = parseSaleReturnNumberText(row.countText, '数量');
  if (!parsed.ok) {
    row.count = undefined as any;
    recalculateRowAmounts(row);
    handleRowChange(row);
    message.warning(parsed.message);
    return;
  }
  row.count = normalizeSaleReturnCount(parsed.value);
  setCountText(row);
  recalculateRowAmounts(row);
  handleRowChange(row);
}

function handleProductPriceBlur(row: EditableSaleReturnItem) {
  const parsed = parseSaleReturnNumberText(row.productPriceText, '单价');
  if (!parsed.ok) {
    row.productPrice = undefined as any;
    recalculateRowAmounts(row);
    handleRowChange(row);
    message.warning(parsed.message);
    return;
  }
  row.productPrice = normalizeSaleReturnPrice(parsed.value);
  setProductPriceText(row);
  recalculateRowAmounts(row);
  handleRowChange(row);
}

function handleTaxPercentBlur(row: EditableSaleReturnItem) {
  const parsed = parseSaleReturnNumberText(row.taxPercentText, '税率');
  if (!parsed.ok || parsed.value < 0 || parsed.value > 100) {
    row.taxPercent = undefined as any;
    handleRowChange(row);
    message.warning(parsed.ok ? '税率必须在 0 到 100 之间' : parsed.message);
    return;
  }
  row.taxPercent = normalizeSaleReturnPrice(parsed.value);
  setTaxPercentText(row);
  handleRowChange(row);
}

/** 初始化行数据 */
function initRow(row: ErpSaleReturnApi.SaleReturnItem) {
  itemRowKeyManager.ensureRowKey(row);
  if (!row.seq) {
    row.seq = (row.id as any) || `${row.productId || 'new'}-${Math.random()}`;
  }
  recalculateRowAmounts(row);
}

/** 表单校验 */
function validate(
  items = tableData.value,
  options: { requireItems?: boolean } = {},
) {
  if ((options.requireItems ?? true) && items.length === 0) {
    throw new Error('请至少添加一条退货明细');
  }
  const itemKeys = new Set<string>();
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item) {
      continue;
    }
    if (!item.productId) {
      throw new Error(`第 ${i + 1} 行：产品不能为空`);
    }
    if (!item.warehouseId) {
      throw new Error(`第 ${i + 1} 行：仓库不能为空`);
    }
    const itemKey = [
      item.productId,
      item.warehouseId,
      item.batchNo?.trim() ?? '',
    ].join('::');
    if (itemKeys.has(itemKey)) {
      throw new Error(
        `第 ${i + 1} 行：退货明细不能重复选择同一商品、仓库和批次`,
      );
    }
    itemKeys.add(itemKey);
    const countText = (item as EditableSaleReturnItem).countText;
    const count =
      countText === undefined
        ? Number(item.count)
        : parseSaleReturnNumberText(countText, '数量');
    if (
      typeof count === 'object'
        ? !count.ok || normalizeSaleReturnCount(count.value) <= 0
        : !Number.isFinite(count) || count <= 0
    ) {
      throw new Error(`第 ${i + 1} 行：产品数量必须大于 0`);
    }
    const productPriceText = (item as EditableSaleReturnItem).productPriceText;
    const productPrice =
      productPriceText === undefined
        ? Number(item.productPrice)
        : parseSaleReturnNumberText(productPriceText, '单价');
    if (
      typeof productPrice === 'object'
        ? !productPrice.ok || normalizeSaleReturnPrice(productPrice.value) < 0
        : !Number.isFinite(productPrice) || productPrice < 0
    ) {
      throw new Error(`第 ${i + 1} 行：产品单价不能为空且不能小于 0`);
    }
    const taxPercentText = (item as EditableSaleReturnItem).taxPercentText;
    const taxPercent =
      taxPercentText === undefined || taxPercentText === ''
        ? Number(item.taxPercent ?? 0)
        : parseSaleReturnNumberText(taxPercentText, '税率');
    if (
      typeof taxPercent === 'object'
        ? !taxPercent.ok || taxPercent.value < 0 || taxPercent.value > 100
        : !Number.isFinite(taxPercent) || taxPercent < 0 || taxPercent > 100
    ) {
      throw new Error(`第 ${i + 1} 行：税率必须在 0 到 100 之间`);
    }
  }
}

function buildDraftItems() {
  return tableData.value.map((item) => {
    const {
      countText: _countText,
      productPriceText: _productPriceText,
      taxPercentText: _taxPercentText,
      ...rest
    } = item;
    const row = { ...rest } as ErpSaleReturnApi.SaleReturnItem;
    const countParsed = parseSaleReturnNumberText(item.countText, '数量');
    const productPriceParsed = parseSaleReturnNumberText(
      item.productPriceText,
      '单价',
    );
    row.count = countParsed.ok
      ? normalizeSaleReturnCount(countParsed.value)
      : (undefined as any);
    row.productPrice = productPriceParsed.ok
      ? normalizeSaleReturnPrice(productPriceParsed.value)
      : (undefined as any);
    const taxPercentParsed = parseSaleReturnNumberText(
      item.taxPercentText ?? item.taxPercent ?? 0,
      '税率',
    );
    row.taxPercent = taxPercentParsed.ok
      ? normalizeSaleReturnPrice(taxPercentParsed.value)
      : (undefined as any);
    initRow(row);
    return row;
  });
}

async function reloadItemsFromProps() {
  await syncItemsFromProps(props.items, { force: true });
}

function focusFirstItemCountInput() {
  if (props.disabled) {
    return false;
  }
  return focusFirstEditableInput(
    itemTableWrapRef.value,
    SALE_RETURN_ITEM_COUNT_INPUT_SELECTOR,
  );
}

function focusItemCountInput(row: ErpSaleReturnApi.SaleReturnItem) {
  return focusEditableInputByRowKey(
    itemTableWrapRef.value,
    SALE_RETURN_ITEM_COUNT_INPUT_SELECTOR,
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

defineExpose({
  focusItemByRowKey,
  focusFirstItemCountInput,
  getDraftItems: buildDraftItems,
  handleAddBlankItemRow,
  queueFocusFirstItemCountInput,
  reloadItemsFromProps,
  validate,
});

/** 初始化 */
onMounted(async () => {
  isShortcutScopeActive = true;
  syncShortcutListening();
  await loadOrderPriceCustomFieldNames();
  tableData.value.forEach((item) => {
    handleDeptOptionsChange(getCurrentDeptOption(item));
  });
  appendCurrentDisplayOptions();
  await loadWarehouseOptionsForRows(tableData.value);
  tableData.value.forEach(hydrateWarehouseSnapshot);
  fillMissingDeptIdFromWarehouse();
  void hydrateMissingCurrentSelectLabels(tableData.value);
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
  () => props.mainDeptId,
  async () => {
    if (props.disabled) {
      return;
    }
    let changed = false;
    tableData.value.forEach((item) => {
      const beforeDeptId = item.deptId;
      fillItemDeptIdFromMainDept(item);
      if (item.deptId !== beforeDeptId) {
        changed = true;
      }
    });
    await loadWarehouseOptionsForRows(tableData.value);
    void hydrateMissingCurrentSelectLabels(tableData.value);
    if (changed) {
      emitItemsUpdate(true);
      await nextTick();
      await refreshItemGrid();
    }
  },
);
</script>

<template>
  <div>
    <div
      ref="itemTableWrapRef"
      class="sale-return-item-table-wrap relative"
      tabindex="-1"
      @click="focusSaleShortcutOwner(itemTableWrapRef, $event.target)"
    >
      <Grid class="sale-return-item-grid w-full">
        <template #toolbar-buttons>
          <div class="sale-return-item-toolbar-left">
            <div class="sale-return-item-shortcut-hint">
              <span class="sale-return-item-shortcut-hint__label"
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
                <span v-if="canUseInlineStockSelector">
                  <kbd>Insert</kbd><b>新增行</b>
                </span>
              </template>
              <span class="sale-return-item-shortcut-hint__divider"></span>
              <span
                ><span class="sale-return-item-shortcut-hint__label"
                  >当前页</span
                ><kbd>W</kbd><b>全部价格</b></span
              >
            </div>
            <div
              v-if="canShowBatchUpdateItems"
              class="sale-document-item-batch-summary"
            >
              已选 {{ selectedItemCount }} 条 / 可改
              {{ batchEditableItemCount }} 条
            </div>
          </div>
        </template>
        <template #toolbar-tools>
          <div class="sale-return-item-toolbar flex items-center gap-2">
            <Button
              v-if="canUseInlineStockSelector"
              type="primary"
              @click="handleAddBlankItemRow"
            >
              新增行
            </Button>
            <Button
              v-if="canUseInlineStockSelector"
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
          <ErpLazyPageSelect
            v-if="!disabled && !warehouseReadonly && !stockLocationReadonly"
            v-model:value="row.warehouseId"
            :api="getSaleWarehouseSimplePage"
            :options="getWarehouseOptions(row)"
            :params="{
              ...getAllSaleProductWarehouseParams(),
              deptId: row.deptId ?? props.mainDeptId,
            }"
            label-field="name"
            value-field="id"
            :page-size="10"
            placeholder="请选择仓库"
            :disabled="!row.deptId"
            popup-class-name="sale-return-item-select-dropdown erp-candidate-focus-popup"
            allow-clear
            class="w-full"
            @change="handleWarehouseChange(row)"
            @options-change="handleWarehouseOptionsChange"
          />
          <span v-else :title="getReadonlyWarehouseName(row)">
            {{ getReadonlyWarehouseName(row) }}
          </span>
        </template>
        <template #deptId="{ row }">
          <ErpLazyPageSelect
            v-if="!disabled && !stockLocationReadonly"
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
            popup-class-name="sale-return-item-select-dropdown erp-candidate-focus-popup"
            class="w-full"
            @change="handleDeptChange(row)"
            @options-change="handleDeptOptionsChange"
          />
          <span v-else :title="String(getCurrentDeptDisplayName(row))">
            {{ getCurrentDeptDisplayName(row) }}
          </span>
        </template>
        <template #productId="{ row }">
          <ErpInlineStockSelect
            candidate-focus-highlight
            settings-scope="sale-return"
            v-if="canUseInlineStockSelector"
            :value="getProductInputValue(row)"
            :row="row"
            :row-key="getItemRowKey(row)"
            :dept-id="props.mainDeptId"
            :filter-by-dept="false"
            :hidden-fields="props.hiddenFields"
            :stock-page-api="getSaleStockPage"
            :stock-page-params="getInlineStockPageParams()"
            require-dept-message="请先选择客户及所属部门，再选择退货库存"
            @open-change="handleInlineStockOpenChange"
            @select="(stocks) => handleInlineStockSelected(row, stocks)"
            @update:value="(value) => handleProductKeywordInput(row, value)"
          />
          <div v-else class="flex flex-wrap items-center gap-1 leading-tight">
            <span>{{ row.productName || '-' }}</span>
            <Tag v-if="isCrossDeptWarehouse(row)" color="orange" class="m-0">
              跨部门
            </Tag>
          </div>
        </template>
        <template #count="{ row }">
          <Input
            v-if="!disabled"
            v-model:value="row.countText"
            inputmode="decimal"
            :data-erp-item-row-key="getItemRowKey(row)"
            data-sale-return-count-input="true"
            @press-enter="handleItemInputPressEnter"
            @blur="handleCountBlur(row)"
          />
          <span v-else>{{ formatSaleDecimal(row.count, '-') }}</span>
        </template>
        <template #productPrice="{ row }">
          <Input
            v-if="!disabled"
            v-model:value="row.productPriceText"
            inputmode="decimal"
            @press-enter="handleItemInputPressEnter"
            @blur="handleProductPriceBlur(row)"
          />
          <span v-else>{{
            formatSaleAmount(row.productPrice, '-')
          }}</span>
        </template>
        <template #remark="{ row }">
          <Input
            v-if="!disabled"
            v-model:value="row.remark"
            class="w-full"
            @press-enter="handleItemInputPressEnter"
            @change="handleRowChange(row)"
          />
          <span v-else>{{ row.remark || '-' }}</span>
        </template>
        <template #returnReason="{ row }">
          <Select
            v-if="!disabled"
            v-model:value="row.returnReason"
            :options="[
              { label: '质量问题', value: '质量问题' },
              { label: '规格不符', value: '规格不符' },
              { label: '多发', value: '多发' },
              { label: '客户不要', value: '客户不要' },
              { label: '其他', value: '其他' },
            ]"
            placeholder="请选择"
            allow-clear
            popup-class-name="sale-return-item-select-dropdown erp-candidate-focus-popup"
            class="w-full"
            @change="handleRowChange(row)"
          />
          <span v-else>{{ row.returnReason || '-' }}</span>
        </template>
        <template #warehousePosition="{ row }">
          <Input
            v-if="!disabled"
            v-model:value="row.warehousePosition"
            placeholder="请输入"
            class="w-full"
            @press-enter="handleItemInputPressEnter"
            @change="handleRowChange(row)"
          />
          <span v-else>{{ row.warehousePosition || '-' }}</span>
        </template>
        <template #taxPercent="{ row }">
          <Input
            v-if="!disabled"
            v-model:value="row.taxPercentText"
            inputmode="decimal"
            @press-enter="handleItemInputPressEnter"
            @blur="handleTaxPercentBlur(row)"
          />
          <span v-else>{{ row.taxPercent || '-' }}</span>
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
      <ItemPriceReferenceOverlay
        :hidden-fields="priceReferenceHiddenFields"
        :open="priceReferenceOpen"
        :rows="getDisplayTableData()"
        :table-header-height="ITEM_TABLE_HEADER_HEIGHT"
        :table-row-height="ITEM_TABLE_ROW_HEIGHT"
        :table-wrapper="itemTableWrapRef"
        :visible-rows="ITEM_TABLE_VISIBLE_ROWS"
      />
    </div>
    <div v-if="showItemPager" class="sale-return-item-pager">
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
  <BatchUpdateItemsModal
    v-if="!stockLocationReadonly"
    @success="handleBatchUpdateItemsSuccess"
  />
  <SaleStockProductSelectModal
    candidate-focus-highlight
    ref="productSelectRef"
    all-sale-product-permission="erp:sale-return:all-product"
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
.sale-return-item-toolbar :deep(.ant-btn) {
  height: 28px;
  padding: 2px 10px;
  font-size: 12px;
  line-height: 20px;
}

.sale-return-item-toolbar :deep(.ant-btn span) {
  font-size: 12px;
}

.sale-return-item-grid :deep(.sale-return-item-row--active td) {
  background-color: rgba(22, 119, 255, 0.1) !important;
}

.sale-return-item-grid :deep(.sale-return-item-row--active td:first-child) {
  box-shadow: inset 3px 0 0 #1677ff;
}

.sale-return-item-grid :deep(.sale-return-item-row--active:hover td) {
  background-color: rgba(22, 119, 255, 0.16) !important;
}

.sale-return-item-toolbar-left {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 12px;
  min-width: 0;
}

.sale-return-item-shortcut-hint {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  color: #475569;
  font-size: 12px;
}

.sale-return-item-shortcut-hint__label {
  color: #64748b;
}

.sale-return-item-shortcut-hint b {
  font-weight: 600;
}

.sale-return-item-shortcut-hint kbd {
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

.sale-return-item-shortcut-hint__divider {
  width: 1px;
  height: 18px;
  margin: 0 4px;
  background: #cbd5e1;
}

.sale-document-item-batch-summary {
  min-width: 0;
  font-size: 12px;
  color: #475569;
}

:deep(.vxe-table) {
  font-size: 11px;
}

:deep(.ant-input),
:deep(.ant-input-number),
:deep(.ant-input-number-input),
:deep(.ant-select),
:deep(.ant-select-selector),
:deep(.ant-select-selection-item),
:deep(.ant-select-selection-placeholder),
:deep(.ant-select-selection-search-input) {
  font-size: 11px;
}

:deep(.vxe-header--column.is--sortable .vxe-cell--title) {
  color: #1677ff;
}

:deep(.vxe-header--column .vxe-cell--sort) {
  display: none;
}

:global(.sale-return-item-select-dropdown .ant-select-item),
:global(.sale-return-item-select-dropdown .ant-select-tree),
:global(.sale-return-item-select-dropdown .ant-empty-description) {
  font-size: 11px;
}

.sale-return-item-pager {
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
}

.sale-return-item-pager :deep(.ant-pagination),
.sale-return-item-pager :deep(.ant-pagination-item),
.sale-return-item-pager :deep(.ant-pagination-total-text),
.sale-return-item-pager :deep(.ant-pagination-options),
.sale-return-item-pager :deep(.ant-select),
.sale-return-item-pager :deep(.ant-input) {
  font-size: 11px;
}

.sale-return-item-pager :deep(.ant-pagination-item),
.sale-return-item-pager :deep(.ant-pagination-prev),
.sale-return-item-pager :deep(.ant-pagination-next),
.sale-return-item-pager :deep(.ant-pagination-jump-prev),
.sale-return-item-pager :deep(.ant-pagination-jump-next) {
  min-width: 24px;
  height: 24px;
  line-height: 22px;
}

.sale-return-item-pager :deep(.ant-pagination-item a),
.sale-return-item-pager :deep(.ant-pagination-prev button),
.sale-return-item-pager :deep(.ant-pagination-next button) {
  height: 22px;
  font-size: 11px;
  line-height: 22px;
}

.sale-return-item-pager :deep(.ant-pagination-options-size-changer),
.sale-return-item-pager :deep(.ant-select-single),
.sale-return-item-pager :deep(.ant-select-selector) {
  height: 24px;
  line-height: 22px;
}

.sale-return-item-pager
  :deep(.ant-pagination-options-size-changer .ant-select-selector) {
  box-sizing: border-box;
  align-items: center;
  min-height: 24px;
  padding: 0 24px 0 8px;
}

.sale-return-item-pager
  :deep(.ant-select-single .ant-select-selector .ant-select-selection-item) {
  height: 22px;
  font-size: 11px;
  line-height: 22px;
}

.sale-return-item-pager :deep(.ant-select-arrow) {
  margin-top: -5px;
  font-size: 10px;
}

.sale-return-item-pager :deep(.ant-pagination-options-quick-jumper input) {
  height: 24px;
  padding: 0 7px;
  font-size: 11px;
  line-height: 22px;
}
</style>
