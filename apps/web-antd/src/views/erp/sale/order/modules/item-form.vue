<script lang="ts" setup>
import type { ErpSaleOrderApi } from '#/api/erp/sale/order';
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
} from 'vue';

import { useAccess } from '@vben/access';
import { useVbenModal } from '@vben/common-ui';
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
import SaleStockProductSelectModal from '#/views/erp/sale/components/SaleStockProductSelectModal.vue';
import {
  formatSaleAmount,
  formatSaleDecimal,
  parseSaleDecimal,
  saleDecimalAdd,
  saleDecimalDivide,
  saleDecimalMultiply,
  saleDecimalSubtract,
} from '#/views/erp/sale/utils/decimal';
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
} from '#/views/erp/utils/keyboard';
import { isBatchNoEnabled } from '#/views/erp/utils/item';
import {
  isPriceReferenceShortcut,
  shouldIgnorePriceReferenceShortcut,
} from '#/views/erp/utils/price-reference';
import { settleVxeColumnCustomization } from '#/views/erp/utils/vxe-column-custom';

import { useFormItemColumns } from '../data';
import { sortSaleOrderItems } from './sale-order-item-sort';

const itemRowKeyManager = createSaleItemClientRowKeyManager('sale-order-item');
type EditableSaleOrderItem = ErpSaleOrderApi.SaleOrderItem & {
  countText?: string;
  countTextDirty?: boolean;
  productPriceText?: string;
  productPriceTextDirty?: boolean;
  taxPercentText?: string;
  taxPercentTextDirty?: boolean;
};

interface Props {
  items?: ErpSaleOrderApi.SaleOrderItem[];
  disabled?: boolean;
  discountPercent?: number;
  feeAmount?: number;
  hiddenFields?: string[];
  mainDeptId?: number;
  customerPriceLevel?: number;
  documentId?: number;
  enableBatchEdit?: boolean;
  itemPageLoading?: boolean;
  itemPagination?: SaleOrderItemPagination;
  priceType?: string;
  remotePaging?: boolean;
  shortcutActive?: boolean;
  suspendPriceAutoRefresh?: boolean;
}

type SaleOrderItemPagination = {
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
const SALE_ORDER_ALL_PRODUCT_PERMISSION = 'erp:sale-order:all-product';

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
  priceType: undefined,
  remotePaging: false,
  shortcutActive: true,
  suspendPriceAutoRefresh: false,
});

const emit = defineEmits([
  'update:items',
  'update:discount-price',
  'update:total-price',
  'batch-update-success',
  'page-change',
  'request-submit',
]);

const SALE_ORDER_ITEM_COUNT_INPUT_SELECTOR =
  '[data-sale-order-count-input="true"]';
const SALE_ORDER_PRODUCT_SELECT_INPUT_SELECTOR =
  '[data-erp-inline-stock-select-input="true"]';

const tableData = ref<EditableSaleOrderItem[]>([]); // 表格数据
const productSelectRef =
  ref<InstanceType<typeof SaleStockProductSelectModal>>();
const activeItemRowKey = ref<string>();
const batchNoOptionsMap = ref<Record<string, any[]>>({});
const warehouseOptions = ref<any[]>([]);
const deptOptions = ref<any[]>([]);
const selectedBatchItemRows = ref<ErpSaleOrderApi.SaleOrderItem[]>([]);
const activeItemSort = ref<
  { field: string; order: 'asc' | 'desc' } | undefined
>();
const priceReferenceOpen = ref(false);
const inlineStockSelectorOpen = ref(false);
const itemTableWrapRef = ref<HTMLElement | null>(null);
const localItemPage = ref({ pageNo: 1, pageSize: DEFAULT_ITEM_PAGE_SIZE });
const { hasAccessByCodes } = useAccess();
const [ProductFormModal, productFormModalApi] = useVbenModal({
  connectedComponent: ProductForm,
  destroyOnClose: true,
});
let isInternalUpdate = false;
let isShortcutListening = false;
let isShortcutScopeActive = false;
let itemSelectLabelHydrateSequence = 0;
let pendingQuoteOrderHistoryShift = false;
let tempItemSeq = -1;
function getAllSaleProductWarehouseParams() {
  return hasAccessByCodes([SALE_ORDER_ALL_PRODUCT_PERMISSION])
    ? {
        allSaleProduct: true,
        allSaleProductPermission: SALE_ORDER_ALL_PRODUCT_PERMISSION,
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

const canShowItemSelection = computed(() => !props.disabled);
const selectedItemCount = computed(() => selectedBatchItemRows.value.length);
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

function getDisplayTableData() {
  const rows =
    activeItemSort.value && !props.remotePaging
      ? sortSaleOrderItems(
          tableData.value,
          activeItemSort.value.field,
          activeItemSort.value.order,
          {
            deptOptions: deptOptions.value,
            warehouseOptions: warehouseOptions.value,
          },
        )
      : [...tableData.value];
  if (props.remotePaging) {
    return rows;
  }
  const startIndex =
    (localItemPage.value.pageNo - 1) * localItemPage.value.pageSize;
  return rows.slice(startIndex, startIndex + localItemPage.value.pageSize);
}

function getDeptDisplayName(deptId?: number) {
  if (!deptId) return undefined;
  return findDeptName(deptOptions.value, deptId);
}

function getItemRowKey(row?: ErpSaleOrderApi.SaleOrderItem) {
  if (!row) return undefined;
  return itemRowKeyManager.ensureRowKey(row);
}

function setActiveItemRow(row?: ErpSaleOrderApi.SaleOrderItem) {
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
      message.warning('请先点击一条有商品的销售订单明细');
    }
    return undefined;
  }
  return row;
}

function getItemRowClassName({ row }: { row: ErpSaleOrderApi.SaleOrderItem }) {
  return getItemRowKey(row) === activeItemRowKey.value
    ? 'sale-order-item-row--active'
    : '';
}

function resolveWarehouseDeptName(warehouseId?: number) {
  if (!warehouseId) return undefined;
  return findResolvedOptionById(warehouseOptions.value, warehouseId)?.deptName;
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
  if (!warehouseId) return undefined;
  const warehouse = findResolvedOptionById(warehouseOptions.value, warehouseId);
  if (warehouse?.deptId) {
    // 仓库所属部门可能不在当前用户的部门数据权限范围内（跨部门分配的仓库），
    // 这里用仓库自带的 deptName 补齐分页选择器选项，避免回显时只显示原始 id。
    ensureDeptOption(warehouse.deptId, warehouse.deptName);
  }
  return warehouse?.deptId;
}

function fillMissingDeptIdFromWarehouse() {
  tableData.value.forEach((item) => {
    if (props.mainDeptId) {
      item.deptId = props.mainDeptId;
      return;
    }
    item.deptId ??= resolveWarehouseDeptId(item.warehouseId);
  });
}

function hydrateWarehouseSnapshot(row: ErpSaleOrderApi.SaleOrderItem) {
  if (!row.warehouseId) {
    return;
  }
  const warehouse = findResolvedOptionById(
    warehouseOptions.value,
    row.warehouseId,
  );
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

function isCrossDeptWarehouse(row: ErpSaleOrderApi.SaleOrderItem) {
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

function applyCachedSelectLabels(rows: ErpSaleOrderApi.SaleOrderItem[]) {
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

async function hydrateMissingCurrentSelectLabels(
  rows: ErpSaleOrderApi.SaleOrderItem[],
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

function getGridColumns(
  disabled = props.disabled,
  hiddenFields = props.hiddenFields,
  rows: ErpSaleOrderApi.SaleOrderItem[] = getDisplayTableData(),
) {
  const columns =
    useFormItemColumns(disabled, hiddenFields, {
      editable: !disabled,
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
    ];
  }
  return columns;
}

function getCustomizedGridColumns(
  rows: ErpSaleOrderApi.SaleOrderItem[] = getDisplayTableData(),
) {
  return applySaleDocumentItemColumnCustomization(
    getGridColumns(undefined, undefined, rows),
    gridApi.grid?.getFullColumns?.() ?? [],
    150,
  );
}

function canBatchUpdateItemRow(row?: ErpSaleOrderApi.SaleOrderItem) {
  return Boolean(row?.productId && !props.disabled);
}

function canDeleteItemRow(row?: ErpSaleOrderApi.SaleOrderItem) {
  return Boolean(row && !props.disabled);
}

function canSelectItemRow(row?: ErpSaleOrderApi.SaleOrderItem) {
  return canBatchUpdateItemRow(row) || canDeleteItemRow(row);
}

function clearBatchItemSelection() {
  selectedBatchItemRows.value = [];
  gridApi.grid?.clearCheckboxRow?.();
}

/** 获取表格合计数据 */
const summaries = computed(() => {
  return {
    count: tableData.value.reduce(
      (sum, item) => saleDecimalAdd(sum, item.count || 0),
      0,
    ),
    totalWeight: tableData.value.reduce(
      (sum, item) => saleDecimalAdd(sum, getItemTotalWeight(item)),
      0,
    ),
    totalProductPrice: tableData.value.reduce(
      (sum, item) => saleDecimalAdd(sum, item.totalProductPrice || 0),
      0,
    ),
    taxPrice: 0,
    totalPrice: tableData.value.reduce(
      (sum, item) => saleDecimalAdd(sum, item.totalPrice || 0),
      0,
    ),
  };
});

function isPriceItemHidden(field: string) {
  return props.disabled && isSalePriceItemHidden(props.hiddenFields, field);
}

/** 表格配置 */
const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: getGridColumns(),
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
    id: 'erp-sale-order-item-list-v1',
    autoResize: true,
    border: true,
    fit: false,
    rowConfig: {
      keyField: 'clientRowKey',
      isHover: true,
    },
    rowClassName: getItemRowClassName,
    checkboxConfig: {
      checkMethod: ({ row }: { row: ErpSaleOrderApi.SaleOrderItem }) =>
        canSelectItemRow(row),
    },
    pagerConfig: {
      enabled: false,
    },
    toolbarConfig: {
      enabled: true,
      slots: { buttons: 'toolbar-buttons', tools: 'toolbar-tools' },
      custom: true,
      refresh: {
        queryMethod: () => refreshItemGrid(),
      },
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
    custom: handleItemColumnCustom,
    sortChange: handleItemSortChange,
    cellClick: ({ row }: { row: ErpSaleOrderApi.SaleOrderItem }) => {
      setActiveItemRow(row);
    },
    currentRowChange: ({ row }: { row?: ErpSaleOrderApi.SaleOrderItem }) => {
      setActiveItemRow(row);
    },
    checkboxAll: ({
      records,
    }: {
      records: ErpSaleOrderApi.SaleOrderItem[];
    }) => {
      selectedBatchItemRows.value = records.filter(canSelectItemRow);
    },
    checkboxChange: ({
      records,
    }: {
      records: ErpSaleOrderApi.SaleOrderItem[];
    }) => {
      selectedBatchItemRows.value = records.filter(canSelectItemRow);
    },
  },
});

async function refreshItemGrid() {
  const displayData = getDisplayTableData();
  gridApi.setGridOptions({ data: displayData });
  await gridApi.grid.reloadData(displayData);
  await gridApi.grid.reloadColumn(getCustomizedGridColumns(displayData));
  if (activeItemSort.value) await gridApi.grid.setSort(activeItemSort.value);
}

async function handleItemColumnCustom({ type }: { type?: string }) {
  const settled = await settleVxeColumnCustomization(gridApi.grid, type);
  if (!settled) return;
  const columns =
    type === 'reset' ? getGridColumns() : getCustomizedGridColumns();
  await gridApi.grid.reloadColumn(columns || []);
  if (activeItemSort.value) await gridApi.grid.setSort(activeItemSort.value);
  await gridApi.grid.refreshColumn?.();
  await gridApi.grid.recalculate?.(true);
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

watch(
  () => [props.disabled, props.hiddenFields] as const,
  async ([disabled, hiddenFields]) => {
    const columns = getGridColumns(disabled, hiddenFields);
    await nextTick();
    gridApi.setGridOptions({
      columns,
      height: ITEM_TABLE_HEIGHT,
    });
    await gridApi.grid.reloadColumn(columns);
    if (activeItemSort.value) await gridApi.grid.setSort(activeItemSort.value);
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
  () => [props.customerPriceLevel, props.priceType],
  async () => {
    if (props.suspendPriceAutoRefresh) {
      return;
    }
    await refreshCustomerSalePrices();
  },
);

/** 监听外部传入的列数据 */
watch(
  () => props.items,
  async (items) => {
    if (!items) {
      return;
    }
    if (isInternalUpdate) {
      isInternalUpdate = false;
      return;
    }
    items.forEach((item) => {
      if (props.mainDeptId) {
        item.deptId = props.mainDeptId;
      }
      hydrateWarehouseSnapshot(item);
      initRow(item);
    });
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
    await refreshItemGrid();
    void hydrateMissingCurrentSelectLabels(tableData.value);
    if (props.disabled) {
      return;
    }
    await Promise.allSettled([refreshBatchNoOptions(tableData.value)]);
    await refreshItemGrid();
  },
  {
    immediate: true,
  },
);

/** skipReload=true 表示字段编辑，保留横向滚动位置；false 表示增删行，需要刷新表格 */
function emitItemsUpdate(skipReload = false) {
  isInternalUpdate = skipReload;
  emit('update:items', tableData.value.map(stripNumericInputState));
}

function stripNumericInputState(item: EditableSaleOrderItem) {
  const {
    countText: _countText,
    countTextDirty: _countTextDirty,
    productPriceText: _productPriceText,
    productPriceTextDirty: _productPriceTextDirty,
    taxPercentText: _taxPercentText,
    taxPercentTextDirty: _taxPercentTextDirty,
    ...rest
  } = item;
  return rest;
}

function sanitizeNumericInput(value: unknown) {
  return value === null || value === undefined ? '' : String(value).trim();
}

function parseNumericInput(
  value: unknown,
  label: string,
  rowIndex: number,
  options: {
    max?: number;
    min?: number;
    positive?: boolean;
    required?: boolean;
  } = {},
) {
  const text = sanitizeNumericInput(value);
  if (!text) {
    if (options.required)
      throw new Error(`第 ${rowIndex + 1} 行：${label}不能为空`);
    return 0;
  }
  const parsed = parseSaleDecimal(text, label, {
    allowEmpty: !options.required,
    max: options.max,
    min: options.min,
  });
  if (!parsed.ok) {
    throw new Error(`第 ${rowIndex + 1} 行：${parsed.message}`);
  }
  const numberValue = parsed.value ?? 0;
  if (options.positive && numberValue <= 0) {
    throw new Error(`第 ${rowIndex + 1} 行：${label}必须大于 0`);
  }
  if (options.min !== undefined && numberValue < options.min) {
    throw new Error(`第 ${rowIndex + 1} 行：${label}不能小于 ${options.min}`);
  }
  if (options.max !== undefined && numberValue > options.max) {
    throw new Error(`第 ${rowIndex + 1} 行：${label}不能大于 ${options.max}`);
  }
  return numberValue;
}

function syncNumericInputText(row: EditableSaleOrderItem) {
  syncCountInputText(row);
  syncProductPriceInputText(row);
  syncTaxPercentInputText(row);
}

function syncCountInputText(row: EditableSaleOrderItem) {
  row.countText = formatSaleDecimal(row.count);
  row.countTextDirty = false;
}

function syncProductPriceInputText(row: EditableSaleOrderItem) {
  row.productPriceText = formatSaleAmount(row.productPrice);
  row.productPriceTextDirty = false;
}

function syncTaxPercentInputText(row: EditableSaleOrderItem) {
  row.taxPercentText = formatSaleDecimal(row.taxPercent);
  row.taxPercentTextDirty = false;
}

function getRowIndex(row: EditableSaleOrderItem) {
  return Math.max(
    tableData.value.findIndex(
      (item) => getItemRowKey(item) === getItemRowKey(row),
    ),
    0,
  );
}

function handleCountBlur(row: EditableSaleOrderItem) {
  try {
    row.count = parseNumericInput(row.countText, '产品数量', getRowIndex(row), {
      min: 0.001,
      required: true,
    });
    syncCountInputText(row);
    handleRowChange(row);
  } catch (error) {
    message.warning(
      error instanceof Error ? error.message : '产品数量格式不正确',
    );
    syncCountInputText(row);
  }
}

function handleProductPriceBlur(row: EditableSaleOrderItem) {
  if (row.giftFlag) {
    row.productPrice = 0;
    syncProductPriceInputText(row);
    handleRowChange(row);
    return;
  }
  try {
    row.productPrice = parseNumericInput(
      row.productPriceText,
      '产品单价',
      getRowIndex(row),
      { positive: true, required: true },
    );
    syncProductPriceInputText(row);
    handleRowChange(row);
  } catch (error) {
    message.warning(
      error instanceof Error ? error.message : '产品单价格式不正确',
    );
    syncProductPriceInputText(row);
  }
}

function handleTaxPercentBlur(row: EditableSaleOrderItem) {
  try {
    row.taxPercent = parseNumericInput(
      row.taxPercentText,
      '税率',
      getRowIndex(row),
      { max: 100, min: 0 },
    );
    syncTaxPercentInputText(row);
    handleRowChange(row);
  } catch (error) {
    message.warning(error instanceof Error ? error.message : '税率格式不正确');
    syncTaxPercentInputText(row);
  }
}

/** 计算 discountPrice、totalPrice 价格 */
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
    const finalTotalPrice = saleDecimalAdd(
      saleDecimalSubtract(totalPrice, discountPrice),
      props.feeAmount || 0,
    );
    emit('update:discount-price', discountPrice);
    emit('update:total-price', finalTotalPrice);
  },
  { deep: true },
);

function buildSaleOrderItemDuplicateKey(item: ErpSaleOrderApi.SaleOrderItem) {
  if (!item.productId || !item.warehouseId) {
    return '';
  }
  const giftKey = item.giftFlag === true ? 'gift' : 'normal';
  const batchNo =
    typeof item.batchNo === 'string' ? item.batchNo.trim() : item.batchNo;
  return `${item.productId}::${item.warehouseId}::${batchNo ?? ''}::${giftKey}`;
}

function buildShortcutStockRow(
  row: ErpSaleOrderApi.SaleOrderItem,
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
    brand: (row as any).brand,
    lastSalePrice: row.lastSalePrice,
    originPlace: (row as any).originPlace,
    salePrice: row.salePrice ?? row.productPrice,
    standard: (row as any).standard,
    vehicleModel: (row as any).vehicleModel,
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
  row.productWeight = product.weight ?? row.productWeight;
  row.weight = product.weight ?? row.weight;
  row.packageQty = product.packageQty ?? row.packageQty;
  (row as any).brand = product.brand ?? (row as any).brand;
  (row as any).vehicleModel = product.vehicleModel ?? (row as any).vehicleModel;
  (row as any).originPlace = product.originPlace ?? (row as any).originPlace;
  (row as any).standard = product.standard ?? (row as any).standard;
  handleRowChange(row);
}

function isShortcutDialogOpen() {
  return productSelectRef.value?.isShortcutDialogOpen?.() === true;
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
  if (props.disabled) {
    return;
  }
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
      initRow(row);
    }),
  );
  await nextTick();
  await refreshItemGrid();
  emitItemsUpdate(true);
}

function getProductInputValue(row: ErpSaleOrderApi.SaleOrderItem) {
  const keyword = (row as any).__stockKeyword;
  return keyword === undefined || keyword === null
    ? row.productName || ''
    : String(keyword);
}

function handleProductKeywordInput(
  row: ErpSaleOrderApi.SaleOrderItem,
  value: string,
) {
  (row as any).__stockKeyword = value;
}

function escapeAttrValue(value: string) {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

function focusProductNameInput(row: ErpSaleOrderApi.SaleOrderItem) {
  if (props.disabled) {
    return false;
  }
  const rowKey = getItemRowKey(row);
  const selector = rowKey
    ? `${SALE_ORDER_PRODUCT_SELECT_INPUT_SELECTOR}[data-erp-inline-stock-row-key="${escapeAttrValue(rowKey)}"]`
    : SALE_ORDER_PRODUCT_SELECT_INPUT_SELECTOR;
  return focusFirstEditableInput(itemTableWrapRef.value, selector);
}

function createBlankItemRow() {
  const row = {
    count: 1,
    giftFlag: false,
    packageQty: 1,
    remark: '',
  } as ErpSaleOrderApi.SaleOrderItem;
  initRow(row);
  return row;
}

const itemRowFocusController = createErpItemRowFocusController({
  focusField: (row: ErpSaleOrderApi.SaleOrderItem, field) =>
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

function buildSaleOrderItemFromStock(p: ErpStockApi.Stock) {
  const salePrice = pickProductPrice(p, props.priceType);
  const batchNo = normalizeBatchNoValue(p.batchNo) || undefined;
  const batchNoEnabled = isBatchNoEnabled(p.batchNoEnabled) || !!batchNo;
  const row: any = {
    id: undefined,
    productId: p.productId,
    productCode: p.productCode,
    productName: p.productName,
    productUnitId: p.unitId,
    productUnitName: p.unitName,
    productBarCode: p.productBarCode,
    productWeight: p.weight || 0,
    weight: p.weight || 0,
    packageQty: p.packageQty,
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
    warehouseId: p.warehouseId,
    deptId:
      props.mainDeptId ?? resolveWarehouseDeptId(p.warehouseId) ?? p.deptId,
    warehouseName: p.warehouseName,
    warehouseDeptId: p.deptId,
    warehouseDeptName: p.deptName,
    batchNo,
    batchNoEnabled,
    stockCount: p.availableCount ?? p.count ?? 0,
    count: 1,
    totalProductPrice: undefined,
    taxPrice: undefined,
    totalPrice: undefined,
    totalWeight: undefined,
    remark: undefined,
    giftFlag: false,
  };
  initRow(row);
  return row as ErpSaleOrderApi.SaleOrderItem;
}

function buildReplacementSaleOrderItemFromStock(
  stock: ErpStockApi.Stock,
  targetRow: ErpSaleOrderApi.SaleOrderItem,
) {
  const row = buildSaleOrderItemFromStock(stock);
  row.clientRowKey = targetRow.clientRowKey;
  row.id = targetRow.id;
  row.seq = targetRow.seq ?? row.seq;
  (row as any).orderId = (targetRow as any).orderId;
  (row as any).orderNo = (targetRow as any).orderNo;
  (row as any).inCount = (targetRow as any).inCount;
  (row as any).returnCount = (targetRow as any).returnCount;
  return row;
}

function filterSelectableStockProducts(
  products: ErpStockApi.Stock[],
  targetRow?: ErpSaleOrderApi.SaleOrderItem,
) {
  const targetRowKey = getItemRowKey(targetRow);
  const existedKeys = new Set(
    (tableData.value ?? [])
      .filter((item) => getItemRowKey(item) !== targetRowKey)
      .map((item) => buildSaleOrderItemDuplicateKey(item))
      .filter(Boolean),
  );
  return products.filter((product) => {
    const key = buildSaleOrderItemDuplicateKey({
      productId: product.productId,
      warehouseId: product.warehouseId,
      batchNo: product.batchNo,
      giftFlag: false,
    } as ErpSaleOrderApi.SaleOrderItem);
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
    targetRow?: ErpSaleOrderApi.SaleOrderItem;
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
  let activeRow: ErpSaleOrderApi.SaleOrderItem;
  if (targetIndex >= 0 && options.targetRow) {
    const [firstStock, ...additionalStocks] = selectedProducts;
    const replacementRow = buildReplacementSaleOrderItemFromStock(
      firstStock!,
      options.targetRow,
    );
    const additionalRows = additionalStocks.map(buildSaleOrderItemFromStock);
    tableData.value.splice(targetIndex, 1, replacementRow);
    if (additionalRows.length > 0) {
      tableData.value = [...tableData.value, ...additionalRows];
    }
    activeRow = replacementRow;
  } else {
    const rows = selectedProducts.map(buildSaleOrderItemFromStock);
    tableData.value = [...tableData.value, ...rows];
    activeRow = rows[0]!;
  }
  setActiveItemRow(activeRow);
  emitItemsUpdate(false);
  if (props.remotePaging && (targetIndex < 0 || selectedProducts.length > 1)) {
    tableData.value = previousRows;
    return;
  }
  await nextTick();
  await Promise.allSettled([refreshBatchNoOptions(tableData.value)]);
  await itemRowFocusController.focus(activeRow, 'count');
}

function handleInlineStockSelected(
  targetRow: ErpSaleOrderApi.SaleOrderItem,
  rows: ErpStockApi.Stock[],
) {
  void insertStockProducts(rows, {
    targetRow,
  });
}

function handleInlineStockOpenChange(open: boolean) {
  inlineStockSelectorOpen.value = open;
}

/** 弹窗勾选配件后批量追加 */
function handleProductsSelected(products: ErpStockApi.Stock[]) {
  void insertStockProducts(products);
}

function focusFirstItemCountInput() {
  if (props.disabled) {
    return false;
  }
  return focusFirstEditableInput(
    itemTableWrapRef.value,
    SALE_ORDER_ITEM_COUNT_INPUT_SELECTOR,
  );
}

function focusItemCountInput(row: ErpSaleOrderApi.SaleOrderItem) {
  return focusEditableInputByRowKey(
    itemTableWrapRef.value,
    SALE_ORDER_ITEM_COUNT_INPUT_SELECTOR,
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

/** 处理删除 */
function handleDelete(row: ErpSaleOrderApi.SaleOrderItem) {
  deleteItemRows([row]);
}

function deleteItemRows(rows: ErpSaleOrderApi.SaleOrderItem[]) {
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
    message.warning('请先勾选要删除的销售订单明细');
    return;
  }
  Modal.confirm({
    cancelText: '取消',
    content: '删除后将从当前销售订单明细中移除这些行。',
    okText: '删除',
    okType: 'danger',
    title: `确认删除已选 ${rows.length} 条销售订单明细吗？`,
    onOk: () => {
      deleteItemRows(rows);
    },
  });
}

/** 处理行数据变更 */
function handleRowChange(row: any) {
  initRow(row);
  const index = tableData.value.findIndex(
    (item) => getItemRowKey(item) === getItemRowKey(row),
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

/** 处理赠品变更 */
function handleGiftFlagChange(row: ErpSaleOrderApi.SaleOrderItem) {
  initRow(row);
  syncProductPriceInputText(row as EditableSaleOrderItem);
  handleRowChange(row);
}

function getNumberValue(value: unknown): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function getItemUnitWeight(item: ErpSaleOrderApi.SaleOrderItem) {
  return getNumberValue(item.productWeight ?? item.weight);
}

function getItemTotalWeight(item: ErpSaleOrderApi.SaleOrderItem) {
  const unitWeight = getItemUnitWeight(item);
  if (unitWeight > 0 && item.count) {
    return saleDecimalMultiply(unitWeight, item.count) ?? 0;
  }
  return getNumberValue(item.totalWeight);
}

/** 初始化行数据 */
function initRow(row: EditableSaleOrderItem) {
  itemRowKeyManager.ensureRowKey(row);
  if (!row.seq) {
    row.seq = (row.id as any) || tempItemSeq--;
  }
  row.giftFlag = row.giftFlag === true;
  row.totalWeight = getItemTotalWeight(row);
  if (row.giftFlag) {
    row.productPrice = 0;
    row.totalProductPrice = 0;
    row.taxPrice = 0;
    row.totalPrice = 0;
    syncNumericInputText(row);
    return;
  }
  if (
    row.productPrice !== undefined &&
    row.productPrice !== null &&
    row.count
  ) {
    row.totalProductPrice =
      saleDecimalMultiply(row.productPrice, row.count) ?? 0;
    row.taxPrice = 0;
    row.totalPrice = row.totalProductPrice;
  }
  if (row.countText === undefined) syncNumericInputText(row);
}

function normalizeNumericFields(item: EditableSaleOrderItem, rowIndex: number) {
  item.count = parseNumericInput(
    item.countText ?? item.count,
    '产品数量',
    rowIndex,
    { min: 0.001, required: true },
  );
  item.productPrice = item.giftFlag
    ? 0
    : parseNumericInput(
        item.productPriceText ?? item.productPrice,
        '产品单价',
        rowIndex,
        { positive: true, required: true },
      );
  item.taxPercent = parseNumericInput(
    item.taxPercentText ?? item.taxPercent,
    '税率',
    rowIndex,
    { max: 100, min: 0 },
  );
  initRow(item);
}

/** 表单校验 */
function validate(
  items = tableData.value,
  options: { requireItems?: boolean } = {},
) {
  if ((options.requireItems ?? true) && items.length === 0) {
    throw new Error('请先添加销售产品');
  }
  for (let i = 0; i < items.length; i++) {
    const item = items[i] as EditableSaleOrderItem;
    if (item) {
      normalizeNumericFields(item, i);
      if (!item.productId) {
        throw new Error(`第 ${i + 1} 行：产品不能为空`);
      }
      if (!item.count || item.count <= 0) {
        throw new Error(`第 ${i + 1} 行：产品数量不能为空`);
      }
      if (!item.giftFlag && (!item.productPrice || item.productPrice <= 0)) {
        throw new Error(`第 ${i + 1} 行：产品单价不能为空`);
      }
    }
  }
}

async function reloadItemsFromProps() {
  const items = props.items ?? [];
  items.forEach((item) => {
    if (props.mainDeptId) {
      item.deptId = props.mainDeptId;
    }
    hydrateWarehouseSnapshot(item);
    initRow(item);
  });
  tableData.value = [...items];
  await nextTick();
  await refreshItemGrid();
  void hydrateMissingCurrentSelectLabels(tableData.value);
}

defineExpose({
  focusItemByRowKey,
  focusFirstItemCountInput,
  getDraftItems: () =>
    tableData.value.map((item, index) => {
      normalizeNumericFields(item, index);
      return stripNumericInputState(item);
    }),
  reloadItemsFromProps,
  validate,
});

onMounted(async () => {
  isShortcutScopeActive = true;
  syncShortcutListening();
  await loadOrderPriceCustomFieldNames();
  tableData.value.forEach((item) => {
    handleDeptOptionsChange(getCurrentDeptOption(item));
  });
  tableData.value.forEach((item) => hydrateWarehouseSnapshot(item));
  fillMissingDeptIdFromWarehouse();
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

watch(
  () => props.mainDeptId,
  async () => {
    if (props.disabled) {
      return;
    }
    fillMissingDeptIdFromWarehouse();
  },
);

onBeforeUnmount(() => {
  isShortcutScopeActive = false;
  syncShortcutListening();
});
</script>

<template>
  <div
    ref="itemTableWrapRef"
    class="sale-order-item-table-wrap relative"
    tabindex="-1"
    @click="focusSaleShortcutOwner(itemTableWrapRef, $event.target)"
  >
    <Grid class="w-full">
      <template #toolbar-buttons>
        <div class="sale-order-item-toolbar-left">
          <div class="sale-order-item-shortcut-hint">
            <span class="sale-order-item-shortcut-hint__label"
              >点击明细行后</span
            >
            <span><kbd>Space</kbd><b>销售历史</b></span>
            <span><kbd>Shift</kbd><b>报价订单历史</b></span>
            <template v-if="!disabled">
              <span><kbd>F</kbd><b>修改商品</b></span>
              <span><kbd>Insert</kbd><b>新增行</b></span>
            </template>
            <span class="sale-order-item-shortcut-hint__divider"></span>
            <span
              ><span class="sale-order-item-shortcut-hint__label">当前页</span
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
        <div class="sale-order-item-toolbar flex items-center gap-2">
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
        </div>
      </template>
      <template #productId="{ row }">
        <ErpInlineStockSelect
          settings-scope="sale-order"
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
        <div v-else class="flex flex-col leading-tight">
          <div class="flex flex-wrap items-center gap-1">
            <span>{{ row.productName || '-' }}</span>
            <Tag v-if="isCrossDeptWarehouse(row)" color="orange" class="m-0">
              跨部门
            </Tag>
          </div>
          <span v-if="row.productCode" class="text-xs text-gray-400">
            {{ row.productCode }}
          </span>
        </div>
      </template>
      <template #count="{ row }">
        <Input
          v-if="!disabled"
          v-model:value="row.countText"
          inputmode="decimal"
          autocomplete="off"
          :data-erp-item-row-key="getItemRowKey(row)"
          data-sale-order-count-input="true"
          @focus="setActiveItemRow(row)"
          @press-enter="handleItemInputPressEnter"
          @update:value="row.countTextDirty = true"
          @blur="handleCountBlur(row)"
        />
        <span v-else>{{ formatSaleDecimal(row.count, '-') }}</span>
      </template>
      <template #warehouseId="{ row }">
        <span :title="getReadonlyWarehouseName(row)">
          {{ getReadonlyWarehouseName(row) }}
        </span>
      </template>
      <template #deptId="{ row }">
        <span :title="getDeptDisplayName(row.deptId) || '-'">
          {{ getDeptDisplayName(row.deptId) || '-' }}
        </span>
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
          popup-class-name="sale-order-item-select-dropdown"
          @change="handleBatchNoChange(row)"
        />
        <span v-else :title="row.batchNo || ''">{{ row.batchNo || '-' }}</span>
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
      <template #taxPercent="{ row }">
        <Input
          v-if="!disabled"
          v-model:value="row.taxPercentText"
          inputmode="decimal"
          autocomplete="off"
          @press-enter="handleItemInputPressEnter"
          @update:value="row.taxPercentTextDirty = true"
          @blur="handleTaxPercentBlur(row)"
        />
        <span v-else>{{ formatSaleDecimal(row.taxPercent, '-') }}</span>
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
        <div class="mt-2 rounded border border-border bg-muted p-2">
          <div class="flex justify-between text-sm text-muted-foreground">
            <span class="font-medium text-foreground">
              {{ props.remotePaging ? '本页合计：' : '合计：' }}
            </span>
            <div class="flex space-x-4">
              <span>数量：{{ formatSaleDecimal(summaries.count) }}</span>
              <span
                >重量：{{ formatSaleDecimal(summaries.totalWeight) }}</span
              >
              <span>
                金额：{{
                  isPriceItemHidden('totalProductPrice')
                    ? '****'
                    : formatSaleAmount(summaries.totalProductPrice)
                }}
              </span>

              <span>
                合计金额：{{
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
      :rows="getDisplayTableData()"
      :table-header-height="ITEM_TABLE_HEADER_HEIGHT"
      :table-row-height="ITEM_TABLE_ROW_HEIGHT"
      :table-wrapper="itemTableWrapRef"
      :visible-rows="ITEM_TABLE_VISIBLE_ROWS"
    />
  </div>
  <div v-if="showItemPager" class="sale-order-item-pager">
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
    ref="productSelectRef"
    all-sale-product-permission="erp:sale-order:all-product"
    enable-sale-stock-shortcuts
    :hidden-fields="hiddenFields"
    :sale-dept-id="mainDeptId"
    show-batch-no
    :customer-price-level="customerPriceLevel"
    @success="handleProductsSelected"
  />
  <ProductFormModal @success="handleProductFormSuccess" />
</template>

<style scoped>
.sale-order-item-shortcut-hint {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  min-width: 0;
  font-size: 12px;
  color: #334155;
}

.sale-order-item-toolbar :deep(.ant-btn) {
  height: 28px;
  padding: 2px 10px;
  font-size: 12px;
  line-height: 20px;
}

.sale-order-item-toolbar :deep(.ant-btn span) {
  font-size: 12px;
}

.sale-order-item-toolbar-left {
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

.sale-order-item-shortcut-hint__label {
  color: #64748b;
}

.sale-order-item-shortcut-hint span:not(.sale-order-item-shortcut-hint__label) {
  display: inline-flex;
  gap: 5px;
  align-items: center;
  min-height: 26px;
  padding: 2px 8px;
  background: #f8fafc;
  border: 1px solid #d8e0ea;
  border-radius: 4px;
}

.sale-order-item-shortcut-hint b {
  font-weight: 600;
}

.sale-order-item-shortcut-hint kbd {
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

:deep(.sale-order-item-row--active td) {
  background-color: rgba(22, 119, 255, 0.1) !important;
}

:deep(.sale-order-item-row--active td:first-child) {
  box-shadow: inset 3px 0 0 #1677ff;
}

:deep(.sale-order-item-row--active:hover td) {
  background-color: rgba(22, 119, 255, 0.16) !important;
}

.sale-order-item-pager {
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
}

.sale-order-item-pager :deep(.ant-pagination),
.sale-order-item-pager :deep(.ant-pagination-item),
.sale-order-item-pager :deep(.ant-pagination-total-text),
.sale-order-item-pager :deep(.ant-pagination-options),
.sale-order-item-pager :deep(.ant-select),
.sale-order-item-pager :deep(.ant-input) {
  font-size: 11px;
}

.sale-order-item-pager :deep(.ant-pagination-item),
.sale-order-item-pager :deep(.ant-pagination-prev),
.sale-order-item-pager :deep(.ant-pagination-next),
.sale-order-item-pager :deep(.ant-pagination-jump-prev),
.sale-order-item-pager :deep(.ant-pagination-jump-next) {
  min-width: 24px;
  height: 24px;
  line-height: 22px;
}

.sale-order-item-pager :deep(.ant-pagination-item a),
.sale-order-item-pager :deep(.ant-pagination-prev button),
.sale-order-item-pager :deep(.ant-pagination-next button) {
  height: 22px;
  font-size: 11px;
  line-height: 22px;
}

.sale-order-item-pager :deep(.ant-pagination-options-size-changer),
.sale-order-item-pager :deep(.ant-select-single),
.sale-order-item-pager :deep(.ant-select-selector) {
  height: 24px;
  line-height: 22px;
}

.sale-order-item-pager
  :deep(.ant-pagination-options-size-changer .ant-select-selector) {
  box-sizing: border-box;
  align-items: center;
  min-height: 24px;
  padding: 0 24px 0 8px;
}

.sale-order-item-pager
  :deep(.ant-select-single .ant-select-selector .ant-select-selection-item) {
  height: 22px;
  font-size: 11px;
  line-height: 22px;
}

.sale-order-item-pager :deep(.ant-select-arrow) {
  margin-top: -5px;
  font-size: 10px;
}

.sale-order-item-pager :deep(.ant-pagination-options-quick-jumper input) {
  height: 24px;
  padding: 0 7px;
  font-size: 11px;
  line-height: 22px;
}
</style>
