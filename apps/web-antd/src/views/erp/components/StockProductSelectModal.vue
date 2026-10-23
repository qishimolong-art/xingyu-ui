<script lang="ts" setup>
/* eslint-disable vue/html-closing-bracket-newline -- Oxfmt manages multiline template layout. */
import { inject } from 'vue';

import { stockNatural } from '#/views/erp/stock/utils/stock-decimal';
const props = withDefaults(
  defineProps<{
    allSaleProduct?: boolean;
    allSaleProductPermission?: string;
    bizType?: 'purchase' | 'sale' | 'stock';
    candidateFocusHighlight?: boolean;
    customerPriceLevel?: number;
    deptId?: number;
    deptSelectApi?: AsyncListApi;
    enablePurchaseOrderShortcuts?: boolean;
    enableSaleStockShortcuts?: boolean;
    enableStockShortcuts?: boolean;
    hiddenFields?: string[];
    saleDeptId?: number;
    saleDistributionReadonly?: boolean;
    showBatchNo?: boolean;
    source?: 'product' | 'stock';
    stockPageApi?: StockPageApi;
    warehouseSelectApi?: AsyncListApi;
  }>(),
  {
    candidateFocusHighlight: false,
    allSaleProduct: false,
    allSaleProductPermission: undefined,
    bizType: undefined,
    customerPriceLevel: undefined,
    deptId: undefined,
    deptSelectApi: undefined,
    enablePurchaseOrderShortcuts: false,
    enableSaleStockShortcuts: false,
    enableStockShortcuts: false,
    hiddenFields: () => [],
    saleDeptId: undefined,
    saleDistributionReadonly: false,
    showBatchNo: false,
    source: 'stock',
    stockPageApi: undefined,
    warehouseSelectApi: undefined,
  },
);
const emit = defineEmits<{
  success: [rows: ErpStockApi.Stock[]];
}>();
const stockDecimalContext = inject('stock-decimal-context', false);
import type { TableColumnsType, TableProps } from 'ant-design-vue';

import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpFieldConfigApi } from '#/api/erp/config/field';
import type { ErpProductApi } from '#/api/erp/product/product';
import type { ErpPurchaseHistoryApi } from '#/api/erp/purchase/history';
import type { ErpPurchaseOrderApi } from '#/api/erp/purchase/order';
import type { ErpSaleOutApi } from '#/api/erp/sale/out';
import type { ErpSaleQuoteApi } from '#/api/erp/sale/quote';
import type { ErpSaleReturnApi } from '#/api/erp/sale/return';
import type { ErpStockApi } from '#/api/erp/stock/stock';

import {
  computed,
  defineAsyncComponent,
  nextTick,
  onBeforeUnmount,
  provide,
  ref,
  watch,
} from 'vue';

import { useAccess } from '@vben/access';
import { useVbenModal } from '@vben/common-ui';
import { erpPriceInputFormatter, formatDateTime } from '@vben/utils';

import {
  Button,
  DatePicker,
  Input,
  message,
  Modal,
  Select,
  Space,
  Table,
  Tag,
} from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { getEffectiveStockSelectPriceFields } from '#/api/erp/config/stock-select-price';
import { getProductBrandSimpleList } from '#/api/erp/product/brand';
import { getProductPage } from '#/api/erp/product/product';
import { getPurchaseHistoryPage } from '#/api/erp/purchase/history';
import {
  getPurchaseOrderPage,
  PURCHASE_ORDER_STATUS,
} from '#/api/erp/purchase/order';
import { getSupplierSimpleList } from '#/api/erp/purchase/supplier';
import { getSaleOutPage } from '#/api/erp/sale/out';
import { getSaleQuotePage } from '#/api/erp/sale/quote';
import { getSaleReturnPage } from '#/api/erp/sale/return';
import { getStockPage } from '#/api/erp/stock/stock';
import {
  getSaleWarehouseOwnerDeptSimpleList,
  getWarehouseSimpleList,
} from '#/api/erp/stock/warehouse';
import { getSimpleDeptList } from '#/api/system/dept';
import { isFieldHidden } from '#/composables/useFieldPermission';
import ProductForm from '#/views/erp/product/product/modules/form.vue';
import {
  buildCustomPriceFieldColumns,
  getProductCustomFieldConfigs,
} from '#/views/erp/product/product/utils/custom-fields';
import CustomerLazySelect from '#/views/erp/sale/components/CustomerLazySelect.vue';
import { filterErpBusinessPartnerOption } from '#/views/erp/utils/business-partner-select';
import {
  appendCandidatePopupClass,
  CANDIDATE_FOCUS_KEY,
} from '#/views/erp/utils/candidate-focus';
import { createErpKeywordSearchSchema } from '#/views/erp/utils/form-defaults';
import { isBatchNoEnabled } from '#/views/erp/utils/item';
import { ensureModalReady } from '#/views/erp/utils/lazy-modal';
import { createVxeHeaderSort } from '#/views/erp/utils/vxe-header-sort';

import {
  formatStockSelectionCount,
  formatStockSelectionPrice,
  getStockSelectionRowClassName,
  isStockSelectionReadonly,
  normalizeSaleHistoryCount,
} from './stock-product-select-ui';

type AsyncListApi = (
  params?: Record<string, any>,
) => Promise<any[] | { list?: any[]; total?: number }>;
type AsyncPageApi = (params: {
  [key: string]: any;
  keyword?: string;
  pageNo: number;
  pageSize: number;
}) => Promise<{ list?: any[]; total?: number }>;
type StockPageApi = (
  params: ErpStockApi.StockPageReqVO,
) => ReturnType<typeof getStockPage>;
type PurchaseHistoryMode = 'history' | 'order';
type ShortcutBizType = 'purchase' | 'sale';
type HistorySorter = {
  field?: string;
  order?: 'ascend' | 'descend';
};
type HistoryFilterState = {
  customerId?: number;
  dateRange?: [string, string];
  supplierId?: number;
};
type SaleHistoryDocumentType = 'return' | 'sale-out';
type HistoryRow =
  | ErpPurchaseHistoryApi.Row
  | ErpPurchaseOrderApi.PurchaseOrder
  | ErpSaleOutApi.SaleOut
  | ErpSaleQuoteApi.SaleQuote
  | ErpSaleReturnApi.SaleReturn
  | Record<string, any>;

provide(
  CANDIDATE_FOCUS_KEY,
  computed(() => props.candidateFocusHighlight),
);

const open = ref(false);
const activeStockRow = ref<ErpStockApi.Stock>();
const selectedRows = ref<ErpStockApi.Stock[]>([]);
const customPriceFieldConfigs = ref<ErpFieldConfigApi.FieldConfig[]>([]);
const effectivePriceFieldKeys = ref<null | Set<string>>(null);
const activeStockColumnFilters = ref<Record<string, string>>({});
const stockFilterBrandOptions = ref<Array<{ label: string; value: string }>>(
  [],
);
const STOCK_SELECT_COLUMN_TOOLTIP = 'tooltip' as const;
const purchaseHistoryOpen = ref(false);
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
const supplierOptions = ref<
  Array<Record<string, any> & { id: number; name: string }>
>([]);
const customerOptions = ref<Array<Record<string, any>>>([]);
const { hasAccessByCodes } = useAccess();
const modalTitle = computed(() => {
  if (props.source === 'product') {
    return '选择配件';
  }
  if (saleStockShortcutsEnabled.value) {
    return '选择库存明细 / 销售快捷键';
  }
  if (purchaseOrderShortcutsEnabled.value) {
    return '选择库存明细 / 采购快捷键';
  }
  return stockShortcutsEnabled.value
    ? '选择库存明细 / 库存快捷键'
    : '选择库存明细';
});
const tableTitle = computed(() =>
  props.source === 'product' ? '配件列表' : '产品库存列表',
);
const emptySelectionMessage = computed(() =>
  props.source === 'product' ? '请至少勾选一条配件' : '请至少勾选一条库存明细',
);
const purchaseOrderShortcutsEnabled = computed(
  () =>
    props.enablePurchaseOrderShortcuts === true &&
    props.source === 'stock' &&
    props.bizType === 'purchase',
);
const saleStockShortcutsEnabled = computed(
  () =>
    props.enableSaleStockShortcuts === true &&
    props.source === 'stock' &&
    props.bizType === 'sale',
);
const stockShortcutsEnabled = computed(
  () =>
    props.enableStockShortcuts === true &&
    props.source === 'stock' &&
    props.bizType === 'stock',
);
const stockSelectionKeyboardNavigationEnabled = computed(
  () =>
    purchaseOrderShortcutsEnabled.value ||
    saleStockShortcutsEnabled.value ||
    stockShortcutsEnabled.value,
);
const shortcutBizType = computed<ShortcutBizType | undefined>(() => {
  if (purchaseOrderShortcutsEnabled.value) return 'purchase';
  if (saleStockShortcutsEnabled.value) return 'sale';
  return undefined;
});
const historySelectionShortcutsEnabled = computed(
  () => !!shortcutBizType.value,
);
const selectionShortcutsEnabled = computed(
  () =>
    historySelectionShortcutsEnabled.value ||
    stockSelectionKeyboardNavigationEnabled.value,
);
const modalClass = computed(() =>
  selectionShortcutsEnabled.value
    ? '!w-[100vw] stock-product-select-modal--fullscreen'
    : '!w-[85vw]',
);
const gridClass = computed(() => {
  const sizeClass = selectionShortcutsEnabled.value
    ? 'stock-product-select-grid--fullscreen'
    : 'h-[70vh]';
  return props.source === 'stock'
    ? `${sizeClass} stock-product-select-grid--stock`
    : sizeClass;
});
function candidatePopupClass(existing?: string) {
  return props.candidateFocusHighlight
    ? appendCandidatePopupClass(existing)
    : existing;
}
const activeProductText = computed(() => {
  const row = activeStockRow.value;
  if (!row) {
    return '未选中产品';
  }
  return [row.productCode, row.productName].filter(Boolean).join(' / ');
});
const purchaseHistoryTitle = computed(() => {
  if (shortcutBizType.value === 'sale') {
    const prefix =
      purchaseHistoryMode.value === 'history' ? '销售历史' : '报价订单历史';
    return `${prefix} - ${activeProductText.value}`;
  }
  const prefix =
    purchaseHistoryMode.value === 'history' ? '采购历史' : '采购订单历史';
  return `${prefix} - ${activeProductText.value}`;
});
const purchaseHistoryDateField = computed(() => {
  if (shortcutBizType.value === 'sale') {
    return purchaseHistoryMode.value === 'history'
      ? 'historyTime'
      : 'quoteTime';
  }
  return purchaseHistoryMode.value === 'history' ? 'businessTime' : 'orderTime';
});
const purchaseHistoryTablePagination = computed(() => ({
  current: purchaseHistoryPagination.value.current,
  pageSize: purchaseHistoryPagination.value.pageSize,
  pageSizeOptions: ['10', '20', '50', '100'],
  showQuickJumper: true,
  showSizeChanger: true,
  showTotal: (total: number) => `共 ${total} 条`,
  total: purchaseHistoryPagination.value.total,
}));
let isEnterListening = false;
let pendingOrderHistoryShift = false;
const COLLAPSED_SEARCH_OPTIONS = {
  collapsed: true,
  collapsedRows: 1,
};
const STOCK_SELECT_SEARCH_INPUT_SELECTOR = '.vxe-grid--form-wrapper input';
const STOCK_SELECT_GRID_FOCUS_SELECTOR =
  '.vxe-table--main-wrapper .vxe-table--body-wrapper, .vxe-table--body-wrapper:not(.fixed-left--wrapper):not(.fixed-right--wrapper)';
const NON_FOCUS_SEARCH_INPUT_TYPES = new Set([
  'button',
  'checkbox',
  'file',
  'hidden',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
]);
let shouldFocusStockGridAfterQuery = false;

const PRODUCT_SORT_FIELD_MAP: Record<string, string> = {
  productCode: 'code',
  productName: 'name',
  lastPurchasePrice: 'lastPurchasePrice',
  salePrice: 'salePrice',
  referencePrice: 'referencePrice',
  brand: 'brand',
  vehicleModel: 'vehicleModel',
  originPlace: 'originPlace',
  standard: 'standard',
  drawingNo: 'drawingNo',
  factoryCode: 'factoryCode',
  shelf: 'shelf',
};

const STOCK_SORT_FIELD_MAP: Record<string, string> = {
  batchNo: 'batchNo',
  warehouseName: 'warehouseName',
  deptName: 'deptName',
  productCode: 'productCode',
  productName: 'productName',
  count: 'count',
  occupiedCount: 'occupiedCount',
  availableCount: 'availableCount',
  pendingInCount: 'pendingInCount',
  inTransitCount: 'inTransitCount',
  unitName: 'unitName',
  lastPurchasePrice: 'lastPurchasePrice',
  salePrice: 'salePrice',
  referencePrice: 'referencePrice',
  retailPrice: 'retailPrice',
  productPurchasePrice: 'productPurchasePrice',
  minPrice: 'minPrice',
  grossProfitRate: 'grossProfitRate',
  backupPrice1: 'backupPrice1',
  wholesalePrice: 'wholesalePrice',
  sharePrice: 'sharePrice',
  brand: 'brand',
  vehicleModel: 'vehicleModel',
  originPlace: 'originPlace',
  standard: 'standard',
  drawingNo: 'drawingNo',
  factoryCode: 'factoryCode',
  shelf: 'shelf',
};
const STOCK_COLUMN_FILTER_FIELDS = new Set([
  'batchNo',
  'brand',
  'deptName',
  'drawingNo',
  'factoryCode',
  'originPlace',
  'productCode',
  'productName',
  'shelf',
  'standard',
  'vehicleModel',
  'warehouseName',
]);
const STOCK_COLUMN_FILTER_FORM_FIELDS = new Set([
  'brand',
  'drawingNo',
  'factoryCode',
  'productCode',
  'productName',
  'shelf',
  'standard',
  'vehicleModel',
]);
const productHeaderSort = createVxeHeaderSort(PRODUCT_SORT_FIELD_MAP);
const stockHeaderSort = createVxeHeaderSort(STOCK_SORT_FIELD_MAP, {
  field: 'count',
  order: 'desc',
});
const PRODUCT_EDIT_MODAL_Z_INDEX = 3000;
const HISTORY_MODAL_Z_INDEX = 3000;

function getHeaderSort() {
  return props.source === 'product' ? productHeaderSort : stockHeaderSort;
}

function getDefaultStockSortParams() {
  return props.source === 'stock'
    ? {
        orderDirection: 'desc' as const,
        orderField: 'count',
      }
    : {};
}

const [ProductFormModal, productFormModalApi] = useVbenModal({
  connectedComponent: ProductForm,
  destroyOnClose: true,
  zIndex: PRODUCT_EDIT_MODAL_Z_INDEX,
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
const loadCustomerDetailComponent = () =>
  import('#/views/erp/sale/customer/modules/detail.vue');
const CustomerDetail = defineAsyncComponent(loadCustomerDetailComponent);
const [CustomerDetailModal, customerDetailModalApi] = useVbenModal({
  connectedComponent: CustomerDetail,
  destroyOnClose: true,
});
const shouldRenderCustomerDetail = ref(false);
const loadSaleOutDetailComponent = () =>
  import('#/views/erp/sale/out/modules/form.vue');
const SaleOutDetail = defineAsyncComponent(loadSaleOutDetailComponent);
const [SaleOutDetailModal, saleOutDetailModalApi] = useVbenModal({
  connectedComponent: SaleOutDetail,
  destroyOnClose: true,
});
const shouldRenderSaleOutDetail = ref(false);
const loadSaleReturnDetailComponent = () =>
  import('#/views/erp/sale/return/modules/form.vue');
const SaleReturnDetail = defineAsyncComponent(loadSaleReturnDetailComponent);
const [SaleReturnDetailModal, saleReturnDetailModalApi] = useVbenModal({
  connectedComponent: SaleReturnDetail,
  destroyOnClose: true,
});
const shouldRenderSaleReturnDetail = ref(false);
const loadSaleQuoteDetailComponent = () =>
  import('#/views/erp/sale/quote/modules/form.vue');
const SaleQuoteDetail = defineAsyncComponent(loadSaleQuoteDetailComponent);
const [SaleQuoteDetailModal, saleQuoteDetailModalApi] = useVbenModal({
  connectedComponent: SaleQuoteDetail,
  destroyOnClose: true,
});
const shouldRenderSaleQuoteDetail = ref(false);

const SELECT_FIELD_ALIASES: Record<string, string[]> = {
  currentPrice: ['item_productPrice', 'productPrice'],
  lastSalePrice: ['item_lastSalePrice', 'lastSalePrice'],
  lastPurchasePrice: ['item_productPrice', 'productPrice'],
  productCode: ['item_productCode'],
  productName: ['item_productId', 'item_productName', 'productId'],
  referencePrice: ['item_referencePrice', 'referencePrice'],
  retailPrice: ['item_retailPrice', 'retailPrice'],
  salePrice: ['item_salePrice', 'salePrice'],
  warehouseName: ['item_warehouseId', 'warehouseId'],
};

const STOCK_PRICE_MASK = '****';
const FIXED_STOCK_PRICE_FIELD_KEYS = new Set([
  'backupPrice1',
  'grossProfitRate',
  'lastPurchasePrice',
  'lastSalePrice',
  'minPrice',
  'purchasePrice',
  'referencePrice',
  'retailPrice',
  'salePrice',
  'sharePrice',
  'wholesalePrice',
]);

const STOCK_PRICE_MASK_EXEMPT_FIELD_KEYS = new Set(['lastSalePrice']);

function isSelectFieldHidden(fieldName: string) {
  return (
    isFieldHidden(props.hiddenFields, `select_${fieldName}`) ||
    isFieldHidden(props.hiddenFields, `select_col_${fieldName}`) ||
    (SELECT_FIELD_ALIASES[fieldName] || []).some((alias) =>
      isFieldHidden(props.hiddenFields, alias),
    )
  );
}

function isStockPriceFieldHidden(fieldKey: string) {
  return (
    isFieldHidden(props.hiddenFields, fieldKey) || isSelectFieldHidden(fieldKey)
  );
}

function isEffectivePriceFieldVisible(fieldKey: string) {
  if (
    saleStockShortcutsEnabled.value &&
    (fieldKey === 'salePrice' || fieldKey === 'lastSalePrice')
  ) {
    return true;
  }
  if (
    props.bizType !== 'purchase' &&
    props.bizType !== 'sale' &&
    props.bizType !== 'stock'
  ) {
    return true;
  }
  return effectivePriceFieldKeys.value?.has(fieldKey) === true;
}

function isDocumentStockPriceMaskContext() {
  return (
    props.source === 'stock' &&
    (props.bizType === 'purchase' ||
      props.bizType === 'sale' ||
      props.bizType === 'stock')
  );
}

function shouldDisplayStockPriceField(fieldKey: string) {
  if (isDocumentStockPriceMaskContext()) {
    return true;
  }
  return isEffectivePriceFieldVisible(fieldKey);
}

function isStockPriceColumn(field?: string) {
  const fieldKey = getPriceFieldKeyByStockColumn(field);
  return (
    !!fieldKey &&
    (FIXED_STOCK_PRICE_FIELD_KEYS.has(fieldKey) ||
      String(field || '').startsWith('customFields__'))
  );
}

function shouldRetainMaskedDocumentStockPriceColumn(field?: string) {
  return isDocumentStockPriceMaskContext() && isStockPriceColumn(field);
}

function shouldMaskStockPrice(field?: string) {
  if (!isDocumentStockPriceMaskContext()) {
    return false;
  }
  const fieldKey = getPriceFieldKeyByStockColumn(field);
  if (!fieldKey) {
    return false;
  }
  if (STOCK_PRICE_MASK_EXEMPT_FIELD_KEYS.has(fieldKey)) {
    return false;
  }
  return (
    isStockPriceFieldHidden(fieldKey) ||
    effectivePriceFieldKeys.value?.has(fieldKey) === false
  );
}

function formatPrice(value: unknown) {
  return stockDecimalContext
    ? stockNatural(value as number | string | undefined)
    : erpPriceInputFormatter(value as number | string | undefined) || '-';
}

function firstNumericPrice(...values: unknown[]) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== '') {
      return Number(value) || 0;
    }
  }
  return 0;
}

function pickCustomerLevelSalePrice(row: Record<string, any>) {
  switch (props.customerPriceLevel) {
    case 1: {
      return firstNumericPrice(row.backupPrice1);
    }
    case 2: {
      return firstNumericPrice(row.referencePrice);
    }
    case 3: {
      return firstNumericPrice(row.retailPrice);
    }
    case 4: {
      return firstNumericPrice(row.wholesalePrice);
    }
    case 5: {
      return firstNumericPrice(row.lastPurchasePrice, row.productPurchasePrice);
    }
    case 6: {
      return firstNumericPrice(
        row.costPrice,
        row.purchasePrice,
        row.productPurchasePrice,
      );
    }
    default: {
      return undefined;
    }
  }
}

function getDisplayedStockPrice(row: ErpStockApi.Stock, field?: string) {
  if (shouldMaskStockPrice(field)) {
    return STOCK_PRICE_MASK;
  }
  const fieldKey = getPriceFieldKeyByStockColumn(field);
  if (field?.startsWith('customFields__') && fieldKey) {
    return formatStockSelectionPrice(row.customFields ?? {}, fieldKey);
  }
  if (field === 'salePrice') {
    const customerPrice = pickCustomerLevelSalePrice(row);
    if (customerPrice !== undefined) {
      return formatPrice(customerPrice);
    }
  }
  return formatStockSelectionPrice(row, field || '');
}

function getDisplayedStockCount(row: ErpStockApi.Stock, field?: string) {
  if (!field) {
    return '';
  }
  return formatStockSelectionCount(
    (row as unknown as Record<string, unknown>)[field],
  );
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

function normalizeStockBatchNo(value: unknown) {
  return String(value ?? '').trim();
}

function getStockRowBatchNo(row: Record<string, any>) {
  return normalizeStockBatchNo(
    getRecordValue(row, [
      'batchNo',
      'batchNumber',
      'batchCode',
      'lotNo',
      'lotNumber',
    ]),
  );
}

function isStockRowBatchNoEnabled(row: Record<string, any>) {
  return isBatchNoEnabled(row.batchNoEnabled) || !!getStockRowBatchNo(row);
}

function normalizeStockPageRow(row: ErpStockApi.Stock): ErpStockApi.Stock {
  const batchNo = getStockRowBatchNo(row as Record<string, any>);
  return {
    ...row,
    batchNo: batchNo || undefined,
    batchNoEnabled: isStockRowBatchNoEnabled({
      ...row,
      batchNo,
    }),
  };
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
    'lastSalePrice',
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

function getMatchingHistoryItem(
  record: Record<string, any>,
  productId?: number,
) {
  const items = Array.isArray(record.items) ? record.items : [];
  return (
    items.find((item: Record<string, any>) => item.productId === productId) ??
    items[0] ??
    {}
  );
}

function normalizeSaleHistoryRows(
  rows: Array<ErpSaleOutApi.SaleOut | ErpSaleReturnApi.SaleReturn>,
  documentType: SaleHistoryDocumentType,
  productId?: number,
) {
  return rows.map((row) => {
    const item = getMatchingHistoryItem(row as Record<string, any>, productId);
    return {
      ...(row as Record<string, any>),
      __saleHistoryType: documentType,
      batchNo: item.batchNo,
      count: normalizeSaleHistoryCount(
        item.count ?? row.totalCount,
        documentType,
      ),
      historyTime:
        documentType === 'sale-out'
          ? (row as ErpSaleOutApi.SaleOut).outTime
          : (row as ErpSaleReturnApi.SaleReturn).returnTime,
      productPrice: item.productPrice,
      totalProductPrice: item.totalProductPrice ?? item.totalPrice,
      warehouseName: item.warehouseName,
    };
  });
}

function normalizeSaleQuoteRows(
  rows: ErpSaleQuoteApi.SaleQuote[],
  productId?: number,
) {
  return rows.map((row) => {
    const item = getMatchingHistoryItem(row as Record<string, any>, productId);
    return {
      ...(row as Record<string, any>),
      batchNo: item.batchNo,
      count: item.count ?? row.totalCount,
      productPrice: item.productPrice,
      totalProductPrice: item.totalProductPrice ?? item.totalPrice,
      warehouseName: item.warehouseName,
    };
  });
}

function getHistoryDate(record: Record<string, any>) {
  return getRecordValue(record, [
    'historyTime',
    purchaseHistoryDateField.value,
    'quoteTime',
    'outTime',
    'returnTime',
    'orderDate',
    'inTime',
    'orderTime',
    'createTime',
  ]);
}

function getPurchaseOrderStatusText(status?: number) {
  if (status === PURCHASE_ORDER_STATUS.DRAFT) {
    return '草稿';
  }
  if (status === PURCHASE_ORDER_STATUS.APPROVE) {
    return '已下订';
  }
  if (status === PURCHASE_ORDER_STATUS.PROCESS) {
    return '未下订';
  }
  return '-';
}

function getPurchaseOrderStatusColor(status?: number) {
  if (status === PURCHASE_ORDER_STATUS.DRAFT) {
    return 'blue';
  }
  if (status === PURCHASE_ORDER_STATUS.APPROVE) {
    return 'green';
  }
  if (status === PURCHASE_ORDER_STATUS.PROCESS) {
    return 'orange';
  }
  return 'default';
}

function getSaleDocumentTypeText(type?: SaleHistoryDocumentType) {
  if (type === 'sale-out') return '销售单';
  if (type === 'return') return '退货单';
  return '-';
}

function normalizeHistoryStatus(status?: number | string) {
  if (status === undefined || status === null || status === '') {
    return undefined;
  }
  const numericStatus = Number(status);
  return Number.isFinite(numericStatus) ? numericStatus : undefined;
}

function getSaleStatusText(
  status?: number | string,
  mode: PurchaseHistoryMode = purchaseHistoryMode.value,
) {
  const normalizedStatus = normalizeHistoryStatus(status);
  if (normalizedStatus === undefined) return '-';
  if (normalizedStatus === 0) return '草稿';
  if (normalizedStatus === 10) return mode === 'order' ? '待审核' : '未审核';
  if (normalizedStatus === 20) return '已审核';
  if (mode === 'order' && normalizedStatus === 30) return '部分转手推车';
  if (mode === 'order' && normalizedStatus === 40) return '已转手推车';
  if (mode === 'order' && normalizedStatus === 50) return '已生成销售单';
  if (mode === 'order' && normalizedStatus === 90) return '已取消';
  return String(status);
}

function getSaleStatusColor(status?: number | string) {
  const normalizedStatus = normalizeHistoryStatus(status);
  if (normalizedStatus === 0) return 'blue';
  if (normalizedStatus === 10) return 'orange';
  if (normalizedStatus === 20) return 'green';
  if (normalizedStatus === 30) return 'cyan';
  if (normalizedStatus === 40 || normalizedStatus === 50) return 'green';
  return 'default';
}

function getInTransitCount(record: Record<string, any>) {
  const count = Number(getHistoryCount(record) || 0);
  const arrivalCount = Number(record.arrivalCount ?? record.inCount ?? 0);
  return Math.max(count - arrivalCount, 0);
}

function buildHistorySortParams() {
  const sorter = purchaseHistorySorter.value;
  if (!sorter.field || !sorter.order) {
    return {};
  }
  const sortMap = getHistorySortFieldMap();
  const orderField = sortMap[sorter.field];
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
  if (shortcutBizType.value === 'sale') {
    if (purchaseHistoryMode.value === 'history') {
      return {
        customerId: filters.customerId,
        outTime: filters.dateRange,
        returnTime: filters.dateRange,
      };
    }
    return {
      customerId: filters.customerId,
      quoteTime: filters.dateRange,
    };
  }
  return {
    [purchaseHistoryDateField.value]: filters.dateRange,
    supplierId: filters.supplierId,
  };
}

function getHistorySortFieldMap() {
  if (shortcutBizType.value === 'sale') {
    return purchaseHistoryMode.value === 'history'
      ? SALE_HISTORY_SORT_FIELD_MAP
      : SALE_QUOTE_HISTORY_SORT_FIELD_MAP;
  }
  return purchaseHistoryMode.value === 'history'
    ? PURCHASE_HISTORY_SORT_FIELD_MAP
    : PURCHASE_ORDER_HISTORY_SORT_FIELD_MAP;
}

function getStockRowKey(row: ErpStockApi.Stock) {
  return String(
    row.rowKey ??
      [
        row.id,
        row.productId,
        row.warehouseId,
        row.batchNo || '',
        row.deptId || '',
      ].join('_'),
  );
}

function restoreSelectedRowsByKey(selectedKeys: Set<string>) {
  if (selectedKeys.size === 0) {
    return;
  }
  const grid = gridApi.grid as any;
  const rows: ErpStockApi.Stock[] =
    grid?.getTableData?.().fullData ??
    grid?.getData?.() ??
    grid?.getTableData?.().tableData ??
    [];
  const restoredRows = rows.filter((row: ErpStockApi.Stock) =>
    selectedKeys.has(getStockRowKey(row)),
  );
  restoredRows.forEach((row: ErpStockApi.Stock) => {
    if (!isReadonlySelection(row)) {
      grid?.setCheckboxRow?.(row, true);
    }
  });
  selectedRows.value = [
    ...selectedRows.value.filter(
      (row) =>
        !restoredRows.some(
          (item) => getStockRowKey(item) === getStockRowKey(row),
        ),
    ),
    ...restoredRows,
  ].filter((row) => !isReadonlySelection(row));
  const activeKey = activeStockRow.value
    ? getStockRowKey(activeStockRow.value)
    : undefined;
  activeStockRow.value =
    restoredRows.find((row) => getStockRowKey(row) === activeKey) ??
    activeStockRow.value ??
    restoredRows.at(-1);
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
const SALE_HISTORY_SORT_FIELD_MAP: Record<string, string> = {
  customerName: 'customerName',
  historyTime: 'outTime',
  no: 'no',
  productPrice: 'totalProductPrice',
  remark: 'remark',
  saleUserName: 'saleUserId',
  status: 'status',
  totalProductPrice: 'totalProductPrice',
};
const SALE_RETURN_HISTORY_SORT_FIELD_MAP: Record<string, string> = {
  ...SALE_HISTORY_SORT_FIELD_MAP,
  historyTime: 'returnTime',
};
const SALE_QUOTE_HISTORY_SORT_FIELD_MAP: Record<string, string> = {
  customerName: 'customerName',
  no: 'no',
  productPrice: 'totalProductPrice',
  quoteTime: 'quoteTime',
  remark: 'remark',
  saleUserName: 'saleUserId',
  status: 'status',
  totalProductPrice: 'totalProductPrice',
};
const purchaseHistoryColumns = computed<TableColumnsType<HistoryRow>>(() => {
  const sort = purchaseHistorySorter.value;
  const withSort = (columns: TableColumnsType<HistoryRow>) =>
    columns.map((column) => ({
      ...column,
      sortOrder: sort.field === column.key ? sort.order : null,
    }));

  if (shortcutBizType.value === 'sale') {
    if (purchaseHistoryMode.value === 'history') {
      return withSort([
        {
          dataIndex: '__saleHistoryType',
          key: 'documentType',
          title: '单据类型',
          width: 100,
        },
        {
          dataIndex: 'no',
          key: 'no',
          sorter: true,
          title: '单据编号',
          width: 170,
        },
        {
          dataIndex: 'customerName',
          key: 'customerName',
          sorter: true,
          title: '客户',
          width: 180,
        },
        { dataIndex: 'batchNo', key: 'batchNo', title: '批次', width: 130 },
        { dataIndex: 'count', key: 'count', title: '数量', width: 100 },
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
          dataIndex: 'historyTime',
          key: 'historyTime',
          sorter: true,
          title: '业务日期',
          width: 170,
        },
        {
          dataIndex: 'warehouseName',
          key: 'warehouseName',
          title: '仓库',
          width: 140,
        },
        {
          dataIndex: 'saleUserName',
          key: 'saleUserName',
          sorter: true,
          title: '业务员',
          width: 120,
        },
        {
          dataIndex: 'status',
          key: 'status',
          sorter: true,
          title: '状态',
          width: 100,
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
        dataIndex: 'no',
        key: 'no',
        sorter: true,
        title: '报价单号',
        width: 170,
      },
      {
        dataIndex: 'customerName',
        key: 'customerName',
        sorter: true,
        title: '客户',
        width: 180,
      },
      { dataIndex: 'batchNo', key: 'batchNo', title: '批次', width: 130 },
      {
        dataIndex: 'quoteTime',
        key: 'quoteTime',
        sorter: true,
        title: '报价日期',
        width: 170,
      },
      { dataIndex: 'count', key: 'count', title: '数量', width: 100 },
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
        dataIndex: 'saleUserName',
        key: 'saleUserName',
        sorter: true,
        title: '业务员',
        width: 120,
      },
      {
        dataIndex: 'status',
        key: 'status',
        sorter: true,
        title: '状态',
        width: 100,
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
      title: '批次',
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
      title: '订单状态',
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

function getPriceFieldKeyByStockColumn(field?: string) {
  if (field === 'productPurchasePrice') return 'purchasePrice';
  return field?.startsWith('customFields__')
    ? field.slice('customFields__'.length)
    : field;
}

function getPricePermissionBusinessDeptId() {
  return props.bizType === 'sale' ? getSaleDeptId() : props.deptId;
}

async function loadEffectivePriceFields() {
  if (
    props.source !== 'stock' ||
    (props.bizType !== 'purchase' &&
      props.bizType !== 'sale' &&
      props.bizType !== 'stock')
  ) {
    effectivePriceFieldKeys.value = null;
    return;
  }
  const effectiveFields = await getEffectiveStockSelectPriceFields({
    businessDeptId: getPricePermissionBusinessDeptId(),
    bizType: props.bizType,
  });
  effectivePriceFieldKeys.value = new Set(effectiveFields || []);
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.matches('input, textarea, select, button, [role="button"]') ||
    target.isContentEditable ||
    !!target.closest(
      'input, textarea, select, button, [role="button"], .ant-select, .ant-picker, .ant-input-number, [contenteditable=""], [contenteditable="true"], [contenteditable="plaintext-only"]',
    )
  );
}

function isCheckableControlTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const input = target.matches('input') ? target : target.closest('input');
  if (
    input instanceof HTMLInputElement &&
    (input.type === 'checkbox' || input.type === 'radio')
  ) {
    return true;
  }

  return !!target.closest(
    '.ant-checkbox, .ant-radio, .vxe-checkbox, .vxe-cell--checkbox',
  );
}

function shouldIgnoreSelectionShortcutTarget(event: KeyboardEvent) {
  const key = event.key.toLowerCase();
  if (key === 'f' && isCheckableControlTarget(event.target)) {
    return false;
  }
  return isEditableTarget(event.target);
}

function isSearchInputTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLInputElement)) {
    return false;
  }

  if (target.closest('.ant-picker, .ant-select')) {
    return false;
  }

  return !!target.closest('.vxe-grid--form-wrapper');
}

function isVisibleStockSelectElement(element: HTMLElement) {
  if (
    element.closest('[hidden], [aria-hidden="true"]') ||
    element.getClientRects().length === 0
  ) {
    return false;
  }
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

function getActiveStockSelectModalElement() {
  return [
    ...document.querySelectorAll<HTMLElement>(
      '.stock-product-select-modal--fullscreen',
    ),
  ].find((value) => isVisibleStockSelectElement(value));
}

function isFocusableStockSelectSearchInput(input: HTMLInputElement) {
  return (
    !NON_FOCUS_SEARCH_INPUT_TYPES.has(input.type) &&
    !input.disabled &&
    !input.readOnly &&
    input.tabIndex >= 0 &&
    !input.closest(
      '.ant-picker, .ant-select, [hidden], [aria-hidden="true"]',
    ) &&
    isVisibleStockSelectElement(input)
  );
}

function focusFirstStockSelectSearchInput() {
  if (!open.value || !stockSelectionKeyboardNavigationEnabled.value) {
    return;
  }
  const modalElement = getActiveStockSelectModalElement();
  const searchInput = [
    ...(modalElement ?? document).querySelectorAll<HTMLInputElement>(
      STOCK_SELECT_SEARCH_INPUT_SELECTOR,
    ),
  ].find((value) => isFocusableStockSelectSearchInput(value));
  if (!searchInput) {
    return;
  }
  searchInput.focus({ preventScroll: true });
  try {
    searchInput.select();
  } catch {
    // Some input types can receive focus but do not support text selection.
  }
}

function focusStockSelectGrid() {
  if (!open.value || !stockSelectionKeyboardNavigationEnabled.value) {
    return;
  }
  const modalElement = getActiveStockSelectModalElement();
  const gridFocusElement = (
    modalElement ?? document
  ).querySelector<HTMLElement>(STOCK_SELECT_GRID_FOCUS_SELECTOR);
  if (!gridFocusElement || !isVisibleStockSelectElement(gridFocusElement)) {
    return;
  }
  if (!gridFocusElement.hasAttribute('tabindex')) {
    gridFocusElement.setAttribute('tabindex', '-1');
  }
  gridFocusElement.focus({ preventScroll: true });
}

function queueStockSelectGridFocus() {
  void nextTick().then(focusStockSelectGrid);
}

function handleSearchEnter(event: KeyboardEvent) {
  if (
    !open.value ||
    event.defaultPrevented ||
    event.repeat ||
    event.isComposing ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.shiftKey ||
    !isSearchInputTarget(event.target)
  ) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  shouldFocusStockGridAfterQuery =
    stockSelectionKeyboardNavigationEnabled.value;
  void gridApi.formApi.submitForm();
}

function normalizeSearchParams(values: Record<string, any>) {
  const params = { ...values };
  const textFields =
    props.source === 'product'
      ? ['keyword', 'vehicleModel', 'factoryCode']
      : [
          'keyword',
          'productCode',
          'productName',
          'vehicleModel',
          'brand',
          'standard',
          'drawingNo',
          'factoryCode',
          'shelf',
        ];
  textFields.forEach((field) => {
    if (typeof params[field] === 'string') {
      const normalized =
        field === 'keyword'
          ? params[field].trim()
          : params[field].trim().replaceAll(/\s+/g, '%');
      params[field] = normalized || undefined;
    }
  });
  return params;
}

function mapProductToStockRow(
  product: ErpProductApi.Product,
): ErpStockApi.Stock {
  return {
    id: product.id,
    productId: product.id!,
    warehouseId: product.defaultWarehouseId!,
    deptId: product.deptId,
    deptName: product.deptName,
    count: product.currentStock ?? 0,
    occupiedCount: product.lockCount ?? 0,
    inTransitCount: product.inTransitStock ?? 0,
    productName: product.name,
    unitId: product.unitId,
    unitName: product.unitName,
    categoryName: product.categoryName,
    warehouseName: product.defaultWarehouseName,
    productCode: product.code,
    drawingNo: product.drawingNo,
    standard: product.standard,
    featureCode: product.featureCode,
    vehicleModel: product.vehicleModelText ?? product.vehicleModel,
    brand: product.brand,
    originPlace: product.originPlace,
    shelf: product.shelf,
    categoryId: product.categoryId,
    productPurchasePrice: product.purchasePrice,
    lastPurchasePrice: product.lastPurchasePrice ?? product.purchasePrice,
    oeNumber: product.oeNumber,
    factoryCode: product.factoryCode,
    productBarCode: product.barCode,
    salePrice: product.salePrice,
    minPrice: product.minPrice,
    referencePrice: product.referencePrice,
    retailPrice: product.retailPrice,
    grossProfitRate: product.grossProfitRate,
    backupPrice1: product.backupPrice1,
    wholesalePrice: product.wholesalePrice,
    sharePrice: product.sharePrice,
    customFields: product.customFields,
    stockMax: product.stockMax,
    stockMin: product.stockMin,
    stockStandard: product.stockStandard,
    packageQty: product.packageQty,
    batchNoEnabled: isBatchNoEnabled(product.batchNoEnabled),
    weight: product.weight,
    currentPrice: product.purchasePrice,
  };
}

function getSaleDeptId() {
  return props.saleDeptId ?? props.deptId;
}

function getDefaultSearchDeptId() {
  if (props.source !== 'stock' || props.bizType === 'sale') {
    return undefined;
  }
  return props.deptId;
}

function isStockDeptLockedByDocument() {
  return props.source === 'stock' && props.bizType === 'purchase';
}

function getSearchDeptId(searchParams: Record<string, any>) {
  if (isStockDeptLockedByDocument()) {
    return props.deptId;
  }
  return searchParams.deptId ?? getDefaultSearchDeptId();
}

function getInitialSearchValues() {
  const deptId = getDefaultSearchDeptId();
  return deptId === undefined || deptId === null ? {} : { deptId };
}

function getWarehouseSelectParams() {
  const allSaleProductParams =
    props.bizType === 'sale' && props.allSaleProduct
      ? {
          allSaleProduct: true,
          allSaleProductPermission: props.allSaleProductPermission,
        }
      : {};
  return {
    ...allSaleProductParams,
    bizType: props.bizType,
    deptId:
      props.bizType === 'sale' ? getSaleDeptId() : getDefaultSearchDeptId(),
  };
}

function getDeptSelectParams() {
  return props.bizType === 'sale'
    ? {
        allSaleProduct: props.allSaleProduct || undefined,
        allSaleProductPermission: props.allSaleProduct
          ? props.allSaleProductPermission
          : undefined,
        saleDeptId: getSaleDeptId(),
      }
    : {};
}

function getWarehouseSelectApi() {
  return props.warehouseSelectApi ?? getWarehouseSimpleList;
}

function getDeptSelectApi() {
  if (props.deptSelectApi) {
    return props.deptSelectApi;
  }
  return async (params?: { saleDeptId?: number }) => {
    const saleDeptId = params?.saleDeptId ?? getSaleDeptId();
    if (props.source === 'stock' && props.bizType === 'sale' && saleDeptId) {
      return await getSaleWarehouseOwnerDeptSimpleList(saleDeptId, {
        allSaleProduct: props.allSaleProduct || undefined,
        allSaleProductPermission: props.allSaleProduct
          ? props.allSaleProductPermission
          : undefined,
      });
    }
    return await getSimpleDeptList();
  };
}

function toLazyPageApi(api: AsyncListApi): AsyncPageApi {
  return async (params) => {
    const result = await api(params);
    if (Array.isArray(result)) {
      const pageNo = Number(params?.pageNo || 1);
      const pageSize = Number(params?.pageSize || 10);
      const keyword = String(params?.keyword || '')
        .trim()
        .toLowerCase();
      const filtered = keyword
        ? result.filter((item) =>
            String(item?.name ?? item?.label ?? item?.title ?? '')
              .toLowerCase()
              .includes(keyword),
          )
        : result;
      const start = (pageNo - 1) * pageSize;
      return {
        list: filtered.slice(start, start + pageSize),
        total: filtered.length,
      };
    }
    return result || { list: [], total: 0 };
  };
}

function clearSelection() {
  selectedRows.value = [];
  activeStockRow.value = undefined;

  const grid = gridApi.grid as any;
  grid?.clearCurrentRow?.();
  grid?.clearCheckboxRow?.();
  grid?.clearCheckboxReserve?.();
}

function syncCurrentStockRow(row?: ErpStockApi.Stock, scroll = false) {
  const grid = gridApi.grid as any;
  if (!row) {
    grid?.clearCurrentRow?.();
    return;
  }
  grid?.setCurrentRow?.(row);
  if (scroll) {
    void grid?.scrollToRow?.(row);
  }
}

function setActiveRow(
  row?: ErpStockApi.Stock,
  options: { scroll?: boolean; syncCurrent?: boolean } = {},
) {
  const { scroll = false, syncCurrent = true } = options;
  activeStockRow.value = row || undefined;
  if (syncCurrent) {
    syncCurrentStockRow(row, scroll);
  }
}

function selectRow(row: ErpStockApi.Stock) {
  setActiveRow(row);
  if (isReadonlySelection(row)) {
    return;
  }
  const grid = gridApi.grid as any;
  grid.setCheckboxRow?.(row, true);

  selectedRows.value = grid.getCheckboxRecords?.() ?? [];
}

function toggleRowSelection(row: ErpStockApi.Stock) {
  setActiveRow(row);
  if (isReadonlySelection(row)) {
    return;
  }
  const grid = gridApi.grid;
  grid.toggleCheckboxRow(row);
  selectedRows.value = grid.getCheckboxRecords();
}

function toggleActiveRowSelection() {
  const row = getCurrentPageActiveRow();
  if (!row) {
    return false;
  }
  toggleRowSelection(row);
  return true;
}

function getCurrentPageRows() {
  const grid = gridApi.grid as any;
  const tableData = grid?.getTableData?.();
  const rows: ErpStockApi.Stock[] =
    tableData?.tableData ??
    tableData?.visibleData ??
    tableData?.fullData ??
    grid?.getData?.() ??
    [];
  return rows.filter(Boolean);
}

function isSameStockRow(left?: ErpStockApi.Stock, right?: ErpStockApi.Stock) {
  return !!left && !!right && getStockRowKey(left) === getStockRowKey(right);
}

function getCurrentPageActiveRow() {
  const rows = getCurrentPageRows();
  if (rows.length === 0) {
    return undefined;
  }
  const grid = gridApi.grid as any;
  const currentRow = grid?.getCurrentRecord?.() as
    | ErpStockApi.Stock
    | undefined;
  const activeRow = currentRow ?? activeStockRow.value;
  return rows.find((row) => isSameStockRow(row, activeRow)) ?? rows[0];
}

function setFirstCurrentPageRow() {
  setActiveRow(getCurrentPageRows()[0]);
}

function moveCurrentPageActiveRow(offset: number) {
  const rows = getCurrentPageRows();
  if (rows.length === 0) {
    return false;
  }
  const activeRow = getCurrentPageActiveRow();
  const activeIndex = rows.findIndex((row) => isSameStockRow(row, activeRow));
  const currentIndex = Math.max(activeIndex, 0);
  const nextIndex = (currentIndex + offset + rows.length) % rows.length;
  setActiveRow(rows[nextIndex], { scroll: true });
  return true;
}

function getStockSelectionPageTarget(direction: -1 | 1) {
  const grid = gridApi.grid as any;
  const pager = grid?.getProxyInfo?.()?.pager;
  const currentPage = Number(pager?.currentPage || 1);
  const pageSize = Number(pager?.pageSize || 0);
  const total = Number(pager?.total || 0);
  if (!pageSize || total <= 0) {
    return;
  }
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const targetPage = currentPage + direction;
  if (targetPage < 1 || targetPage > pageCount) {
    return;
  }
  return targetPage;
}

async function moveStockSelectionPage(targetPage: number) {
  const grid = gridApi.grid as any;
  if (!grid) {
    return;
  }
  if (typeof grid.setCurrentPage === 'function') {
    await grid.setCurrentPage(targetPage);
  } else {
    const pager = grid.getProxyInfo?.()?.pager;
    if (pager) {
      pager.currentPage = targetPage;
    }
  }
  await grid.commitProxy?.('query');
  await nextTick();
  setFirstCurrentPageRow();
  focusStockSelectGrid();
}

function isReadonlySelection(row: ErpStockApi.Stock) {
  return isStockSelectionReadonly(row, props.saleDistributionReadonly);
}

function applySearchPermission(schema: VbenFormSchema[]) {
  return schema.filter((item) => {
    const fieldName = String(item.fieldName || '');
    return !isSelectFieldHidden(fieldName);
  });
}

function applySelectColumnPermission(
  columns: VxeTableGridOptions['columns'],
): VxeTableGridOptions['columns'] {
  return columns?.filter((column) => {
    if (!column || typeof column !== 'object') {
      return true;
    }
    const field = (column as { field?: unknown }).field;
    if (!field) {
      return true;
    }
    if (shouldRetainMaskedDocumentStockPriceColumn(String(field))) {
      return true;
    }
    return !isSelectFieldHidden(String(field));
  });
}

async function refreshSearchSchema() {
  gridApi.formApi?.setState?.({
    ...COLLAPSED_SEARCH_OPTIONS,
    schema: useSearchSchema(),
  });
}

async function resetAndQuery() {
  clearSelection();
  if (props.source === 'stock') {
    activeStockColumnFilters.value = {};
    await gridApi.grid?.clearFilter?.();
    await stockHeaderSort.resetSortState(gridApi);
  }
  await gridApi.formApi?.resetForm();
  const initialValues = getInitialSearchValues();
  if (Object.keys(initialValues).length > 0) {
    await gridApi.formApi?.setValues(initialValues);
  }
  await nextTick();
  await gridApi.query();
  clearSelection();
}

function getColumnFilterOption(column: any) {
  return column?.filters?.[0];
}

function setColumnFilterVisualState(field: string, value?: string) {
  const column = gridApi.grid?.getColumnByField?.(field);
  const option = getColumnFilterOption(column);
  if (!option) return;
  option.data = value || '';
  option.checked = Boolean(value);
}

async function applyStockColumnFilter(panel: any, column: any) {
  const field = String(column?.field || '');
  const option = getColumnFilterOption(column);
  const value = String(option?.data || '').trim();
  if (!field || !STOCK_COLUMN_FILTER_FIELDS.has(field)) return;
  const next = { ...activeStockColumnFilters.value };
  if (value) next[field] = value;
  else delete next[field];
  activeStockColumnFilters.value = next;
  if (STOCK_COLUMN_FILTER_FORM_FIELDS.has(field)) {
    await gridApi.formApi?.setValues({ [field]: value || undefined });
  } else if (field === 'warehouseName') {
    await gridApi.formApi?.setValues({ warehouseId: undefined });
  } else if (field === 'deptName' && !isStockDeptLockedByDocument()) {
    await gridApi.formApi?.setValues({ deptId: undefined });
  }
  shouldFocusStockGridAfterQuery =
    stockSelectionKeyboardNavigationEnabled.value;
  panel.changeOption?.(null, Boolean(value), option);
  panel.confirmFilter?.();
}

async function clearStockColumnFilter(panel: any, column: any) {
  const option = getColumnFilterOption(column);
  if (option) option.data = '';
  await applyStockColumnFilter(panel, column);
}

async function clearAllStockConditions() {
  shouldFocusStockGridAfterQuery =
    stockSelectionKeyboardNavigationEnabled.value;
  await resetAndQuery();
}

function syncStockColumnFiltersFromForm(formValues: Record<string, any>) {
  if (props.source !== 'stock') return;
  const next = { ...activeStockColumnFilters.value };
  for (const field of STOCK_COLUMN_FILTER_FORM_FIELDS) {
    const value = String(formValues[field] || '').trim();
    if (value) next[field] = value;
    else delete next[field];
    setColumnFilterVisualState(field, value);
  }
  if (formValues.warehouseId) {
    delete next.warehouseName;
    setColumnFilterVisualState('warehouseName');
  }
  if (formValues.deptId && !isStockDeptLockedByDocument()) {
    delete next.deptName;
    setColumnFilterVisualState('deptName');
  }
  activeStockColumnFilters.value = next;
}

function withStockColumnFilter(column: any) {
  const field = String(column?.field || '');
  if (
    props.source !== 'stock' ||
    !STOCK_COLUMN_FILTER_FIELDS.has(field) ||
    (field === 'batchNo' && !props.showBatchNo)
  ) {
    return column;
  }
  const value = activeStockColumnFilters.value[field] || '';
  return {
    ...column,
    filterMultiple: false,
    filters: [{ checked: Boolean(value), data: value, label: value, value }],
    slots: { ...column.slots, filter: 'stockColumnFilter' },
  };
}

async function refreshOpenSaleSearchContext() {
  if (!open.value || props.source !== 'stock' || props.bizType !== 'sale') {
    return;
  }
  try {
    await loadEffectivePriceFields();
  } catch {
    effectivePriceFieldKeys.value = new Set();
    message.error('价格字段权限加载失败，请稍后重试');
  }
  await refreshSearchSchema();
  gridApi.setGridOptions({ columns: useColumns() || [] });
  await resetAndQuery();
}

function useSearchSchema(): VbenFormSchema[] {
  if (props.source === 'product') {
    return applySearchPermission([
      {
        fieldName: 'keyword',
        label: '关键词',
        component: 'Input',
        componentProps: {
          placeholder:
            '请输入配件编码/名称/拼音码/五笔码/车型/品牌/图号等，多个条件可用 / 或空格分隔',
          allowClear: true,
        },
      },
      {
        fieldName: 'warehouseId',
        label: '默认仓库',
        component: 'ErpLazyPageSelect',
        componentProps: {
          api: toLazyPageApi(getWarehouseSelectApi()),
          params: getWarehouseSelectParams(),
          labelField: 'name',
          valueField: 'id',
          placeholder: '请选择默认仓库',
          allowClear: true,
          pageSize: 10,
          popupClassName: candidatePopupClass('stock-product-select-dropdown'),
        },
      },
      {
        fieldName: 'deptId',
        label: '所属部门',
        component: 'ErpLazyPageSelect',
        componentProps: {
          api: toLazyPageApi(getDeptSelectApi()),
          params: getDeptSelectParams(),
          labelField: 'name',
          valueField: 'id',
          placeholder: '请选择所属部门',
          allowClear: !isStockDeptLockedByDocument(),
          disabled: isStockDeptLockedByDocument(),
          pageSize: 10,
          popupClassName: candidatePopupClass('stock-product-select-dropdown'),
        },
      },
      {
        fieldName: 'vehicleModel',
        label: '车型',
        component: 'Input',
        componentProps: { placeholder: '请输入适用车型', allowClear: true },
      },
      {
        fieldName: 'factoryCode',
        label: '厂家编码',
        component: 'Input',
        componentProps: { placeholder: '请输入厂家编码', allowClear: true },
      },
    ]);
  }

  return applySearchPermission([
    createErpKeywordSearchSchema({
      placeholder:
        '请输入配件/仓库/仓库部门/批次关键词；多个条件可用逗号、/ 等符号分隔',
    }),
    {
      fieldName: 'warehouseId',
      label: '仓库',
      component: 'ErpLazyPageSelect',
      componentProps: {
        api: toLazyPageApi(getWarehouseSelectApi()),
        params: getWarehouseSelectParams(),
        labelField: 'name',
        valueField: 'id',
        placeholder: '请选择仓库',
        allowClear: true,
        pageSize: 10,
        popupClassName: candidatePopupClass('stock-product-select-dropdown'),
      },
    },
    {
      fieldName: 'deptId',
      label: '所属部门',
      component: 'ErpLazyPageSelect',
      componentProps: {
        api: toLazyPageApi(getDeptSelectApi()),
        params: getDeptSelectParams(),
        labelField: 'name',
        valueField: 'id',
        placeholder: '请选择所属部门',
        allowClear: !isStockDeptLockedByDocument(),
        disabled: isStockDeptLockedByDocument(),
        pageSize: 10,
        popupClassName: candidatePopupClass('stock-product-select-dropdown'),
      },
    },
    {
      fieldName: 'productCode',
      label: '编码',
      component: 'Input',
      componentProps: { placeholder: '请输入配件编码', allowClear: true },
    },
    {
      fieldName: 'productName',
      label: '名称',
      component: 'Input',
      componentProps: { placeholder: '请输入配件名称', allowClear: true },
    },
    {
      fieldName: 'vehicleModel',
      label: '车型',
      component: 'Input',
      componentProps: { placeholder: '请输入适用车型', allowClear: true },
    },
    {
      fieldName: 'brand',
      label: '品牌',
      component: 'ApiSelect',
      componentProps: {
        api: getProductBrandSimpleList,
        labelField: 'name',
        valueField: 'name',
        placeholder: '请选择品牌',
        allowClear: true,
        showSearch: true,
        optionFilterProp: 'label',
      },
    },
    {
      fieldName: 'standard',
      label: '规格',
      component: 'Input',
      componentProps: { placeholder: '请输入规格', allowClear: true },
    },
    {
      fieldName: 'drawingNo',
      label: '图号',
      component: 'Input',
      componentProps: { placeholder: '请输入图号', allowClear: true },
    },
    {
      fieldName: 'factoryCode',
      label: '厂家编码',
      component: 'Input',
      componentProps: { placeholder: '请输入厂家编码', allowClear: true },
    },
    {
      fieldName: 'shelf',
      label: '货架',
      component: 'Input',
      componentProps: { placeholder: '请输入货架位', allowClear: true },
    },
    {
      fieldName: 'countFilter',
      label: '库存数',
      component: 'Select',
      componentProps: {
        placeholder: '请选择库存范围',
        allowClear: true,
        popupClassName: candidatePopupClass('stock-product-select-dropdown'),
        options: [
          { label: '全部', value: 0 },
          { label: '大于 0', value: 1 },
          { label: '等于 0', value: 2 },
        ],
      },
    },
  ]);
}

function useColumns(): VxeTableGridOptions['columns'] {
  const productColumns: VxeTableGridOptions['columns'] = [
    { type: 'checkbox', width: 50, fixed: 'left' },
    { field: 'productCode', title: '编码', minWidth: 110, fixed: 'left' },
    { field: 'productName', title: '名称', width: 260, fixed: 'left' },
    { field: 'warehouseName', title: '默认仓库', minWidth: 120 },
    { field: 'deptName', title: '所属部门', minWidth: 120 },
    {
      field: 'count',
      title: '当前库存',
      width: 110,
      slots: { default: 'count' },
    },
    { field: 'unitName', title: '单位', width: 80 },
    {
      field: 'lastPurchasePrice',
      title: '采购价',
      width: 100,
      formatter: 'formatAmount2',
    },
    {
      field: 'salePrice',
      title: '销售价',
      width: 100,
      formatter: 'formatAmount2',
    },
    {
      field: 'referencePrice',
      title: '参考价',
      width: 100,
      formatter: 'formatAmount2',
    },
    { field: 'brand', title: '品牌', minWidth: 100 },
    { field: 'vehicleModel', title: '车型', minWidth: 140 },
    { field: 'originPlace', title: '产地', minWidth: 100 },
    { field: 'standard', title: '规格', minWidth: 110 },
    { field: 'drawingNo', title: '图号', minWidth: 110 },
    { field: 'factoryCode', title: '厂家编码', minWidth: 120 },
    { field: 'shelf', title: '货架', minWidth: 100 },
  ];

  const customStockPriceColumns = buildCustomPriceFieldColumns(
    customPriceFieldConfigs.value.filter((config) =>
      shouldDisplayStockPriceField(config.fieldName),
    ),
    isDocumentStockPriceMaskContext() ? [] : props.hiddenFields,
  ).map((column) => ({
    ...column,
    minWidth: undefined,
    showHeaderOverflow: STOCK_SELECT_COLUMN_TOOLTIP,
    showOverflow: STOCK_SELECT_COLUMN_TOOLTIP,
    slots: { default: 'stockPrice' },
    width: 82,
  }));

  const stockPriceColumns: NonNullable<VxeTableGridOptions['columns']> =
    props.bizType === 'purchase' ||
    props.bizType === 'sale' ||
    props.bizType === 'stock'
      ? [
          {
            field: 'productPurchasePrice',
            title: '采购价',
            width: 80,
            slots: { default: 'stockPrice' },
          },
          {
            field: 'salePrice',
            title: '销售价',
            width: 80,
            slots: { default: 'stockPrice' },
          },
          {
            field: 'lastSalePrice',
            title: '最后一次销售价',
            showHeaderOverflow: STOCK_SELECT_COLUMN_TOOLTIP,
            width: 100,
            slots: { default: 'stockPrice' },
          },
          {
            field: 'minPrice',
            title: '最低价',
            width: 80,
            slots: { default: 'stockPrice' },
          },
          {
            field: 'referencePrice',
            title: '参考价',
            width: 80,
            slots: { default: 'stockPrice' },
          },
          {
            field: 'retailPrice',
            title: '零售价',
            width: 80,
            slots: { default: 'stockPrice' },
          },
          {
            field: 'lastPurchasePrice',
            title: '最后采购入库价',
            showHeaderOverflow: STOCK_SELECT_COLUMN_TOOLTIP,
            width: 104,
            slots: { default: 'stockPrice' },
          },
          {
            field: 'grossProfitRate',
            title: '毛利率（%）',
            showHeaderOverflow: STOCK_SELECT_COLUMN_TOOLTIP,
            width: 86,
            slots: { default: 'stockPrice' },
          },
          {
            field: 'backupPrice1',
            title: '备用价1',
            width: 82,
            slots: { default: 'stockPrice' },
          },
          {
            field: 'wholesalePrice',
            title: '批发价',
            width: 80,
            slots: { default: 'stockPrice' },
          },
          {
            field: 'sharePrice',
            title: '股份价',
            width: 80,
            slots: { default: 'stockPrice' },
          },
          ...customStockPriceColumns,
        ].filter((column) =>
          shouldDisplayStockPriceField(
            getPriceFieldKeyByStockColumn(String(column.field)) || '',
          ),
        )
      : [
          {
            field: 'lastPurchasePrice',
            title: '最近采购价',
            width: 90,
            slots: { default: 'stockPrice' },
          },
          {
            field: 'salePrice',
            title: '销售价',
            width: 80,
            slots: { default: 'stockPrice' },
          },
          {
            field: 'referencePrice',
            title: '参考价',
            width: 80,
            slots: { default: 'stockPrice' },
          },
          {
            field: 'retailPrice',
            title: '零售价',
            width: 80,
            slots: { default: 'stockPrice' },
          },
        ];
  const stockColumns: NonNullable<VxeTableGridOptions['columns']> = [
    { type: 'checkbox', width: 44, fixed: 'left' },
    {
      field: 'batchNo',
      title: '批次号',
      showHeaderOverflow: STOCK_SELECT_COLUMN_TOOLTIP,
      showOverflow: STOCK_SELECT_COLUMN_TOOLTIP,
      slots: { default: 'batchNo' },
      width: 100,
    },
    {
      field: 'warehouseName',
      fixed: 'left',
      showOverflow: STOCK_SELECT_COLUMN_TOOLTIP,
      title: '仓库',
      width: 96,
    },
    {
      field: 'deptName',
      showHeaderOverflow: STOCK_SELECT_COLUMN_TOOLTIP,
      showOverflow: STOCK_SELECT_COLUMN_TOOLTIP,
      title: '所属部门',
      width: 96,
    },
    {
      field: 'productCode',
      title: '编码',
      showOverflow: STOCK_SELECT_COLUMN_TOOLTIP,
      width: 92,
    },
    {
      field: 'productName',
      title: '名称',
      showOverflow: STOCK_SELECT_COLUMN_TOOLTIP,
      width: 180,
    },
    {
      field: 'count',
      title: '库存数量',
      showHeaderOverflow: STOCK_SELECT_COLUMN_TOOLTIP,
      width: 84,
      slots: { default: 'count' },
    },
    {
      field: 'occupiedCount',
      title: '占用数',
      width: 78,
      slots: { default: 'stockCount' },
    },
    {
      field: 'pendingInCount',
      title: '未入数',
      width: 78,
      slots: { default: 'stockCount' },
    },
    {
      field: 'availableCount',
      title: '可用库存',
      showHeaderOverflow: STOCK_SELECT_COLUMN_TOOLTIP,
      width: 84,
      slots: { default: 'stockCount' },
    },
    {
      field: 'inTransitCount',
      title: '在途数量',
      showHeaderOverflow: STOCK_SELECT_COLUMN_TOOLTIP,
      width: 84,
      slots: { default: 'stockCount' },
    },
    { field: 'unitName', title: '单位', width: 56 },
    ...stockPriceColumns,
    {
      field: 'brand',
      title: '品牌',
      showOverflow: STOCK_SELECT_COLUMN_TOOLTIP,
      width: 88,
    },
    {
      field: 'vehicleModel',
      title: '车型',
      showOverflow: STOCK_SELECT_COLUMN_TOOLTIP,
      width: 110,
    },
    {
      field: 'originPlace',
      title: '产地',
      showOverflow: STOCK_SELECT_COLUMN_TOOLTIP,
      width: 84,
    },
    {
      field: 'standard',
      title: '规格',
      showOverflow: STOCK_SELECT_COLUMN_TOOLTIP,
      width: 92,
    },
    {
      field: 'drawingNo',
      title: '图号',
      showOverflow: STOCK_SELECT_COLUMN_TOOLTIP,
      width: 92,
    },
    {
      field: 'factoryCode',
      title: '厂家编码',
      showHeaderOverflow: STOCK_SELECT_COLUMN_TOOLTIP,
      showOverflow: STOCK_SELECT_COLUMN_TOOLTIP,
      width: 100,
    },
    {
      field: 'shelf',
      title: '货架',
      showOverflow: STOCK_SELECT_COLUMN_TOOLTIP,
      width: 84,
    },
  ];

  const sortFieldMap =
    props.source === 'product' ? PRODUCT_SORT_FIELD_MAP : STOCK_SORT_FIELD_MAP;
  const columns =
    props.source === 'product'
      ? productColumns
      : stockColumns.filter(
          (column) => props.showBatchNo || column.field !== 'batchNo',
        );
  const visibleColumns = applySelectColumnPermission(
    columns?.map((column) => {
      const sortableColumn =
        column.field && sortFieldMap[column.field]
          ? { ...column, sortable: true }
          : column;
      return withStockColumnFilter(sortableColumn);
    }),
  );
  if (!props.saleDistributionReadonly) {
    return visibleColumns;
  }
  return visibleColumns?.map((column) => {
    if (column.type === 'checkbox') {
      return { ...column, autoFixed: false, fixed: undefined, width: 36 };
    }
    return column.fixed === 'left' ? { ...column, fixed: undefined } : column;
  });
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    ...COLLAPSED_SEARCH_OPTIONS,
    schema: useSearchSchema(),
  },
  gridOptions: {
    columns: useColumns(),
    height: '100%',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page, sort, sorts }, formValues) => {
          const sortParams = getHeaderSort().buildSortParams(sorts, sort);
          if (props.source === 'product') {
            const result = await getProductPage({
              pageNo: page.currentPage,
              pageSize: page.pageSize,
              ...normalizeSearchParams(formValues),
              ...sortParams,
            });
            return {
              ...result,
              list: result.list.map((product) => mapProductToStockRow(product)),
            };
          }

          const searchParams = normalizeSearchParams(formValues);
          syncStockColumnFiltersFromForm(formValues);
          const stockPageApi = props.stockPageApi ?? getStockPage;
          const result = await stockPageApi({
            allSaleProduct: props.allSaleProduct || undefined,
            allSaleProductPermission: props.allSaleProduct
              ? props.allSaleProductPermission
              : undefined,
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            bizType: props.bizType,
            saleDeptId: props.bizType === 'sale' ? getSaleDeptId() : undefined,
            showBatchNo: props.showBatchNo || undefined,
            ...searchParams,
            ...activeStockColumnFilters.value,
            crossDimensionKeyword: true,
            deptId: getSearchDeptId(searchParams),
            ...getDefaultStockSortParams(),
            ...sortParams,
          });
          return {
            ...result,
            list: (result.list ?? []).map((row) => normalizeStockPageRow(row)),
          };
        },
        querySuccess: async () => {
          const shouldFocusGrid =
            shouldFocusStockGridAfterQuery ||
            stockSelectionKeyboardNavigationEnabled.value;
          shouldFocusStockGridAfterQuery = false;
          await nextTick();
          clearSelection();
          await getHeaderSort().restoreSortState(gridApi);
          await nextTick();
          if (
            stockSelectionKeyboardNavigationEnabled.value ||
            props.candidateFocusHighlight
          ) {
            setFirstCurrentPageRow();
            if (shouldFocusGrid) {
              focusStockSelectGrid();
            }
          }
        },
      },
      filter: true,
      sort: true,
    },
    rowConfig: {
      keyField: props.showBatchNo ? 'rowKey' : 'id',
      isHover: true,
      isCurrent:
        stockSelectionKeyboardNavigationEnabled.value ||
        props.candidateFocusHighlight,
    },
    rowClassName: (params: { row: ErpStockApi.Stock }) =>
      getStockSelectionRowClassName(params, props.saleDistributionReadonly),
    checkboxConfig: {
      highlight: true,
      range: true,
      checkMethod: ({ row }: { row: ErpStockApi.Stock }) =>
        !isReadonlySelection(row),
    },
    toolbarConfig: {
      refresh: true,
      search: true,
    },
    sortConfig: {
      remote: true,
      multiple: false,
      trigger: 'cell',
      orders: ['asc', 'desc', null],
      allowBtn: false,
    },
    filterConfig: {
      remote: true,
    },
  } as VxeTableGridOptions<ErpStockApi.Stock>,
  gridEvents: {
    sortChange: (params: any) => {
      shouldFocusStockGridAfterQuery =
        stockSelectionKeyboardNavigationEnabled.value;
      return getHeaderSort().handleSortChange(params);
    },
    checkboxChange: ({
      records,
      row,
    }: {
      records: ErpStockApi.Stock[];
      row?: ErpStockApi.Stock;
    }) => {
      setActiveRow(row ?? records.at(-1));
      selectedRows.value = records.filter((row) => !isReadonlySelection(row));
      queueStockSelectGridFocus();
    },
    checkboxAll: ({ records }: { records: ErpStockApi.Stock[] }) => {
      setActiveRow(records.at(-1));
      selectedRows.value = records.filter((row) => !isReadonlySelection(row));
      queueStockSelectGridFocus();
    },
    currentRowChange: ({ row }: { row?: ErpStockApi.Stock }) => {
      setActiveRow(row, { syncCurrent: false });
    },
    cellMouseenter: ({ row }: { row: ErpStockApi.Stock }) => {
      if (props.candidateFocusHighlight && !isReadonlySelection(row)) {
        setActiveRow(row);
      }
    },
    cellClick: ({ row, column }: { column: any; row: ErpStockApi.Stock }) => {
      setActiveRow(row);
      if (column?.type === 'checkbox') {
        return;
      }
      toggleRowSelection(row);
      queueStockSelectGridFocus();
    },
    cellDblclick: ({
      row,
      column,
    }: {
      column: any;
      row: ErpStockApi.Stock;
    }) => {
      if (column?.type === 'checkbox') {
        return;
      }
      selectRow(row);
      handleOk();
    },
  },
});

function getShortcutActiveRow() {
  const row = activeStockRow.value ?? selectedRows.value.at(-1);
  if (!row?.productId) {
    message.warning('请先选中一条库存明细');
    return;
  }
  activeStockRow.value = row;
  return row;
}

async function ensureSupplierOptions() {
  if (supplierOptions.value.length > 0) {
    return;
  }
  const suppliers = await getSupplierSimpleList();
  supplierOptions.value = suppliers
    .filter((supplier) => supplier.id && supplier.name)
    .map((supplier) => ({
      ...supplier,
      id: supplier.id!,
      name: supplier.name!,
    }));
}

async function ensureHistoryPartyOptions() {
  if (shortcutBizType.value !== 'sale') {
    await ensureSupplierOptions();
  }
}

function handleCustomerOptionsChange(options: any[]) {
  customerOptions.value = options || [];
}

async function queryPurchaseHistory(
  pageNo = purchaseHistoryPagination.value.current,
) {
  const row = getShortcutActiveRow();
  if (!row) {
    return;
  }
  purchaseHistoryLoading.value = true;
  try {
    if (shortcutBizType.value === 'sale') {
      await querySaleHistory(row, pageNo);
      return;
    }
    const params = {
      ...(stockDecimalContext ? { decimalMode: 'string' } : {}),
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

async function querySaleHistory(row: ErpStockApi.Stock, pageNo: number) {
  const pageSize = purchaseHistoryPagination.value.pageSize;
  const filters = purchaseHistoryFilters.value;
  if (purchaseHistoryMode.value === 'history') {
    const [saleOutResult, saleReturnResult] = await Promise.all([
      getSaleOutPage({
        pageNo,
        pageSize,
        productId: row.productId,
        customerId: filters.customerId,
        outTime: filters.dateRange,
        ...buildHistorySortParams(),
      } as any),
      getSaleReturnPage({
        pageNo,
        pageSize,
        productId: row.productId,
        customerId: filters.customerId,
        returnTime: filters.dateRange,
        ...(() => {
          const sorter = purchaseHistorySorter.value;
          const orderField = sorter.field
            ? SALE_RETURN_HISTORY_SORT_FIELD_MAP[sorter.field]
            : undefined;
          return orderField && sorter.order
            ? {
                orderDirection: sorter.order === 'ascend' ? 'asc' : 'desc',
                orderField,
              }
            : {};
        })(),
      } as any),
    ]);
    const saleOutRows = normalizeSaleHistoryRows(
      saleOutResult.list ?? [],
      'sale-out',
      row.productId,
    );
    const saleReturnRows = normalizeSaleHistoryRows(
      saleReturnResult.list ?? [],
      'return',
      row.productId,
    );
    const mergedRows = [...saleOutRows, ...saleReturnRows].toSorted((a, b) => {
      const aTime = new Date(getHistoryDate(a) || 0).getTime();
      const bTime = new Date(getHistoryDate(b) || 0).getTime();
      return bTime - aTime;
    });
    purchaseHistoryRows.value = mergedRows.slice(0, pageSize);
    purchaseHistoryPagination.value = {
      ...purchaseHistoryPagination.value,
      current: pageNo,
      total: (saleOutResult.total ?? 0) + (saleReturnResult.total ?? 0),
    };
    return;
  }

  const result = await getSaleQuotePage({
    pageNo,
    pageSize,
    productId: row.productId,
    customerId: filters.customerId,
    quoteTime: filters.dateRange,
    ...buildHistorySortParams(),
  } as any);
  purchaseHistoryRows.value = normalizeSaleQuoteRows(
    result.list ?? [],
    row.productId,
  );
  purchaseHistoryPagination.value = {
    ...purchaseHistoryPagination.value,
    current: pageNo,
    total: result.total ?? 0,
  };
}

async function openPurchaseOrderHistory(mode: PurchaseHistoryMode) {
  const row = getShortcutActiveRow();
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
  await ensureHistoryPartyOptions();
  await queryPurchaseHistory(1);
}

async function openShortcutHistory(
  mode: PurchaseHistoryMode,
  row: ErpStockApi.Stock,
) {
  activeStockRow.value = row;
  await openPurchaseOrderHistory(mode);
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

async function openCustomerDetail(record: Record<string, any>) {
  if (!record.customerId) {
    return;
  }
  await closeHistoryBeforeDetailNavigation();
  await ensureModalReady(
    shouldRenderCustomerDetail,
    customerDetailModalApi,
    loadCustomerDetailComponent,
  );
  customerDetailModalApi.setData({ id: record.customerId }).open();
  reopenModalOnNextFrame(customerDetailModalApi);
}

async function openSaleOutDetail(record: Record<string, any>) {
  if (!record.id) {
    return;
  }
  await closeHistoryBeforeDetailNavigation();
  await ensureModalReady(
    shouldRenderSaleOutDetail,
    saleOutDetailModalApi,
    loadSaleOutDetailComponent,
  );
  saleOutDetailModalApi.setData({ type: 'detail', id: record.id }).open();
  reopenModalOnNextFrame(saleOutDetailModalApi);
}

async function openSaleReturnDetail(record: Record<string, any>) {
  if (!record.id) {
    return;
  }
  await closeHistoryBeforeDetailNavigation();
  await ensureModalReady(
    shouldRenderSaleReturnDetail,
    saleReturnDetailModalApi,
    loadSaleReturnDetailComponent,
  );
  saleReturnDetailModalApi.setData({ type: 'detail', id: record.id }).open();
  reopenModalOnNextFrame(saleReturnDetailModalApi);
}

async function openSaleQuoteDetail(record: Record<string, any>) {
  if (!record.id) {
    return;
  }
  await closeHistoryBeforeDetailNavigation();
  await ensureModalReady(
    shouldRenderSaleQuoteDetail,
    saleQuoteDetailModalApi,
    loadSaleQuoteDetailComponent,
  );
  saleQuoteDetailModalApi.setData({ type: 'detail', id: record.id }).open();
  reopenModalOnNextFrame(saleQuoteDetailModalApi);
}

async function openSaleHistoryDocumentDetail(record: Record<string, any>) {
  if (record.__saleHistoryType === 'return') {
    await openSaleReturnDetail(record);
    return;
  }
  await openSaleOutDetail(record);
}

function getProductEditDocumentDeptId() {
  if (props.bizType === 'purchase') {
    return undefined;
  }
  return props.bizType === 'sale' ? getSaleDeptId() : props.deptId;
}

function openProductEdit() {
  const row = getShortcutActiveRow();
  if (!row) {
    return;
  }
  if (!hasAccessByCodes(['erp:product:update'])) {
    message.warning('没有配件修改权限');
    return;
  }
  const documentDeptId = getProductEditDocumentDeptId();
  if (documentDeptId && row.deptId && documentDeptId !== row.deptId) {
    message.warning('该产品不属于当前单据部门，不能修改');
    return;
  }
  productFormModalApi.setData({ type: 'edit', id: row.productId }).open();
}

async function handleProductFormSuccess() {
  const selectedKeys = new Set(
    selectedRows.value.map((row) => getStockRowKey(row)),
  );
  await gridApi.query();
  await nextTick();
  restoreSelectedRowsByKey(selectedKeys);
}

async function openModal() {
  if (
    props.source === 'stock' &&
    props.bizType === 'purchase' &&
    !props.deptId
  ) {
    message.warning('请先选择采购部门，再选择库存');
    return;
  }
  if (
    props.source === 'stock' &&
    props.bizType === 'sale' &&
    !getSaleDeptId()
  ) {
    message.warning('请先选择客户及所属部门，再选择库存');
    return;
  }
  open.value = true;
  try {
    if (
      props.source === 'stock' &&
      (props.bizType === 'purchase' ||
        props.bizType === 'sale' ||
        props.bizType === 'stock')
    ) {
      const [customFields, , brands] = await Promise.all([
        getProductCustomFieldConfigs(),
        loadEffectivePriceFields(),
        getProductBrandSimpleList(),
      ]);
      customPriceFieldConfigs.value = customFields;
      stockFilterBrandOptions.value = (brands || []).map((brand: any) => ({
        label: brand.name,
        value: brand.name,
      }));
    } else {
      customPriceFieldConfigs.value = [];
      stockFilterBrandOptions.value = [];
      effectivePriceFieldKeys.value = null;
    }
  } catch {
    customPriceFieldConfigs.value = [];
    stockFilterBrandOptions.value = [];
    effectivePriceFieldKeys.value = new Set();
    message.error('价格字段权限加载失败，请稍后重试');
  }
  await refreshSearchSchema();
  gridApi.setGridOptions({
    columns: useColumns(),
    rowConfig: {
      keyField: props.showBatchNo ? 'rowKey' : 'id',
      isHover: true,
      isCurrent: stockSelectionKeyboardNavigationEnabled.value,
    },
  });
  await resetAndQuery();
  await nextTick();
  focusFirstStockSelectSearchInput();
}

function handleOk() {
  const eligibleRows = selectedRows.value.filter(
    (row) => !isReadonlySelection(row),
  );
  if (eligibleRows.length === 0) {
    message.warning(emptySelectionMessage.value);
    return;
  }
  const confirmedRows = eligibleRows.map((row) => ({
    ...row,
    batchNo: getStockRowBatchNo(row as Record<string, any>) || undefined,
    batchNoEnabled: isStockRowBatchNoEnabled(row as Record<string, any>),
    salePrice: pickCustomerLevelSalePrice(row) ?? row.salePrice,
  }));
  emit('success', confirmedRows);
  open.value = false;
}

function handleEnterConfirm(event: KeyboardEvent) {
  if (
    !open.value ||
    isShortcutDialogOpen() ||
    selectedRows.value.length === 0 ||
    event.defaultPrevented ||
    event.repeat ||
    event.isComposing ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    event.key !== 'Enter' ||
    isEditableTarget(event.target)
  ) {
    return;
  }

  event.preventDefault();
  handleOk();
}

function isShortcutDialogOpen() {
  return purchaseHistoryOpen.value;
}

let isHistoryEscapeListening = false;

function handleHistoryEscape(event: KeyboardEvent) {
  if (!purchaseHistoryOpen.value || event.key !== 'Escape') {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  purchaseHistoryOpen.value = false;
}

function startHistoryEscapeListening() {
  if (isHistoryEscapeListening) return;
  window.addEventListener('keydown', handleHistoryEscape, true);
  isHistoryEscapeListening = true;
}

function stopHistoryEscapeListening() {
  if (!isHistoryEscapeListening) return;
  window.removeEventListener('keydown', handleHistoryEscape, true);
  isHistoryEscapeListening = false;
}

function isSelectionShortcutKey(event: KeyboardEvent) {
  const key = event.key.toLowerCase();
  return (
    (historySelectionShortcutsEnabled.value &&
      (event.key === ' ' ||
        event.code === 'Space' ||
        isOrderHistoryShortcutKey(event) ||
        key === 'f')) ||
    isStockSelectionKeyboardShortcutKey(event)
  );
}

function isOrderHistoryShortcutKey(event: KeyboardEvent) {
  return isOrderHistoryShiftKey(event);
}

function isStockSelectionKeyboardShortcutKey(event: KeyboardEvent) {
  return (
    stockSelectionKeyboardNavigationEnabled.value &&
    !event.shiftKey &&
    (isCurrentRowNavigationKey(event) ||
      isCurrentRowSelectionKey(event) ||
      isPageNavigationKey(event))
  );
}

function isCurrentRowNavigationKey(event: KeyboardEvent) {
  return event.key === 'ArrowUp' || event.key === 'ArrowDown';
}

function isCurrentRowSelectionKey(event: KeyboardEvent) {
  return event.key === 'Insert' || event.code === 'Insert';
}

function isPageNavigationKey(event: KeyboardEvent) {
  return event.key === 'ArrowLeft' || event.key === 'ArrowRight';
}

function handleStockSelectionKeyboardShortcut(event: KeyboardEvent) {
  if (!isStockSelectionKeyboardShortcutKey(event)) {
    return false;
  }
  if (event.key === 'ArrowUp') {
    return moveCurrentPageActiveRow(-1);
  }
  if (event.key === 'ArrowDown') {
    return moveCurrentPageActiveRow(1);
  }
  if (isCurrentRowSelectionKey(event)) {
    return toggleActiveRowSelection();
  }
  const direction = event.key === 'ArrowLeft' ? -1 : 1;
  const targetPage = getStockSelectionPageTarget(direction);
  if (!targetPage) {
    return false;
  }
  void moveStockSelectionPage(targetPage);
  return true;
}

function handleSelectionShortcut(event: KeyboardEvent) {
  if (pendingOrderHistoryShift && !isOrderHistoryShiftKey(event)) {
    pendingOrderHistoryShift = false;
  }
  if (
    !open.value ||
    !selectionShortcutsEnabled.value ||
    isShortcutDialogOpen() ||
    event.defaultPrevented ||
    event.repeat ||
    event.isComposing ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    shouldIgnoreSelectionShortcutTarget(event)
  ) {
    return;
  }

  if (historySelectionShortcutsEnabled.value && isOrderHistoryShiftKey(event)) {
    pendingOrderHistoryShift = true;
    return;
  }

  if (!isSelectionShortcutKey(event)) {
    return;
  }

  const key = event.key.toLowerCase();
  if (isStockSelectionKeyboardShortcutKey(event)) {
    if (handleStockSelectionKeyboardShortcut(event)) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
    return;
  }

  event.preventDefault();
  event.stopImmediatePropagation();

  if (event.key === ' ' || event.code === 'Space') {
    void openPurchaseOrderHistory('history');
    return;
  }
  if (isOrderHistoryShortcutKey(event)) {
    void openPurchaseOrderHistory('order');
    return;
  }
  if (key === 'f') {
    openProductEdit();
  }
}

function handleSelectionKeydown(event: KeyboardEvent) {
  if (selectionShortcutsEnabled.value) {
    handleSelectionShortcut(event);
  }
  handleEnterConfirm(event);
}

function isOrderHistoryShiftKey(event: KeyboardEvent) {
  return (
    event.key === 'Shift' ||
    event.code === 'ShiftLeft' ||
    event.code === 'ShiftRight'
  );
}

function handleSelectionKeyup(event: KeyboardEvent) {
  if (!pendingOrderHistoryShift) {
    return;
  }
  if (!isOrderHistoryShiftKey(event)) {
    pendingOrderHistoryShift = false;
    return;
  }
  pendingOrderHistoryShift = false;
  if (
    !open.value ||
    !historySelectionShortcutsEnabled.value ||
    isShortcutDialogOpen() ||
    event.defaultPrevented ||
    event.isComposing ||
    event.ctrlKey ||
    event.metaKey ||
    event.altKey ||
    shouldIgnoreSelectionShortcutTarget(event)
  ) {
    return;
  }
  event.preventDefault();
  event.stopImmediatePropagation();
  void openPurchaseOrderHistory('order');
}

function startEnterListening() {
  if (isEnterListening) {
    return;
  }

  window.addEventListener('keydown', handleSelectionKeydown, true);
  window.addEventListener('keyup', handleSelectionKeyup, true);
  isEnterListening = true;
}

function stopEnterListening() {
  if (!isEnterListening) {
    return;
  }

  pendingOrderHistoryShift = false;
  window.removeEventListener('keydown', handleSelectionKeydown, true);
  window.removeEventListener('keyup', handleSelectionKeyup, true);
  isEnterListening = false;
}

watch(open, (visible) => {
  if (visible) {
    startEnterListening();
  } else {
    stopEnterListening();
  }
});

watch(purchaseHistoryOpen, (visible) => {
  if (visible) {
    startHistoryEscapeListening();
  } else {
    stopHistoryEscapeListening();
  }
});

watch(
  () => props.hiddenFields,
  async () => {
    await refreshSearchSchema();
    gridApi.setGridOptions({ columns: useColumns() || [] });
  },
  { deep: true },
);

watch(
  () => [
    props.source,
    props.bizType,
    props.saleDeptId,
    props.deptId,
    props.showBatchNo,
  ],
  refreshOpenSaleSearchContext,
);

onBeforeUnmount(() => {
  stopEnterListening();
  stopHistoryEscapeListening();
});

defineExpose({
  isOpen: () => open.value,
  isShortcutDialogOpen,
  open: openModal,
  openShortcutHistory,
});
</script>

<template>
  <Modal
    v-model:open="open"
    :class="modalClass"
    :title="modalTitle"
    :ok-text="`确定（已选 ${selectedRows.length} 条）`"
    @ok="handleOk"
  >
    <div v-if="selectionShortcutsEnabled" class="stock-select-shortcuts">
      <div class="stock-select-shortcuts__active">
        <span class="stock-select-shortcuts__eyebrow">当前作用产品</span>
        <strong :title="activeProductText">{{ activeProductText }}</strong>
      </div>
      <div class="stock-select-shortcuts__keys">
        <span v-if="historySelectionShortcutsEnabled"
          ><kbd>Space</kbd
          ><b>{{
            shortcutBizType === 'sale' ? '销售历史' : '采购历史'
          }}</b></span
        >
        <span v-if="historySelectionShortcutsEnabled"
          ><kbd>Shift</kbd
          ><b>{{
            shortcutBizType === 'sale' ? '报价订单历史' : '采购订单历史'
          }}</b></span
        >
        <span v-if="historySelectionShortcutsEnabled"
          ><kbd>F</kbd><b>修改产品</b></span
        >
        <span v-if="stockSelectionKeyboardNavigationEnabled"
          ><kbd>↑ / ↓</kbd><b>切换高亮</b></span
        >
        <span v-if="stockSelectionKeyboardNavigationEnabled"
          ><kbd>← / →</kbd><b>切换分页</b></span
        >
        <span v-if="stockSelectionKeyboardNavigationEnabled"
          ><kbd>Insert</kbd><b>勾选/取消</b></span
        >
      </div>
    </div>

    <Grid
      :class="[
        gridClass,
        { 'purchase-candidate-focus': candidateFocusHighlight },
      ]"
      :data-candidate-focus-highlight="candidateFocusHighlight || undefined"
      :table-title="tableTitle"
      @keydown.enter.capture="handleSearchEnter"
    >
      <template #count="{ row }">
        <span>{{ formatStockSelectionCount(row.count ?? 0) }}</span>
        <Tag v-if="Number(row.count ?? 0) === 0" color="error" class="ml-1">
          库存为零
        </Tag>
      </template>
      <template #stockCount="{ row, column }">
        <span>{{ getDisplayedStockCount(row, column.field) }}</span>
      </template>
      <template #batchNo="{ row }">
        <span :title="row.batchNo || '未指定批次'">
          {{ row.batchNo || '未指定批次' }}
        </span>
      </template>
      <template #stockPrice="{ row, column }">
        <span>
          {{ getDisplayedStockPrice(row, column.field) }}
        </span>
      </template>
      <template #stockColumnFilter="{ column, $panel }">
        <div
          v-if="column.filters?.[0]"
          class="stock-column-filter-panel"
          @click.stop
          @keydown.stop
        >
          <Select
            :popup-class-name="candidatePopupClass()"
            v-if="column.field === 'brand'"
            v-model:value="column.filters[0].data"
            :options="stockFilterBrandOptions"
            allow-clear
            show-search
            option-filter-prop="label"
            placeholder="请选择品牌"
            @keydown.enter.stop.prevent="applyStockColumnFilter($panel, column)"
          />
          <Input
            v-else
            v-model:value="column.filters[0].data"
            allow-clear
            placeholder="请输入筛选内容"
            @keydown.enter.stop.prevent="applyStockColumnFilter($panel, column)"
          />
          <Space class="stock-column-filter-panel__actions">
            <Button
              size="small"
              @click.stop="clearStockColumnFilter($panel, column)"
            >
              清空本列
            </Button>
            <Button size="small" @click.stop="clearAllStockConditions">
              清空全部
            </Button>
            <Button
              size="small"
              type="primary"
              @click.stop="applyStockColumnFilter($panel, column)"
            >
              筛选
            </Button>
          </Space>
        </div>
      </template>
      <template v-if="saleDistributionReadonly" #bottom>
        <div class="stock-selection-bottom">
          <div
            v-if="saleDistributionReadonly"
            class="stock-selection-distribution-note"
          >
            <span class="stock-selection-distribution-swatch"></span>
            浅蓝色行表示仅因销售仓库分配而可见（只读，不可选）
          </div>
        </div>
      </template>
    </Grid>
  </Modal>

  <Modal
    v-model:open="purchaseHistoryOpen"
    :footer="null"
    :title="purchaseHistoryTitle"
    :z-index="HISTORY_MODAL_Z_INDEX"
    class="!w-[92vw] stock-history-modal"
  >
    <div class="stock-history-panel">
      <div class="stock-history-filter">
        <div class="stock-history-filter__item stock-history-filter__date">
          <span>日期范围</span>
          <DatePicker.RangePicker
            v-model:value="purchaseHistoryFilters.dateRange"
            value-format="YYYY-MM-DD HH:mm:ss"
            show-time
            allow-clear
            :placeholder="['开始日期', '结束日期']"
          />
        </div>
        <div class="stock-history-filter__item">
          <span>{{ shortcutBizType === 'sale' ? '客户' : '供应商' }}</span>
          <CustomerLazySelect
            v-if="shortcutBizType === 'sale'"
            v-model:value="purchaseHistoryFilters.customerId"
            :options="customerOptions"
            allow-clear
            placeholder="客户"
            :popup-class-name="
              candidatePopupClass('stock-history-filter-dropdown')
            "
            class="stock-history-filter__supplier"
            @options-change="handleCustomerOptionsChange"
          />
          <Select
            v-else
            v-model:value="purchaseHistoryFilters.supplierId"
            :options="supplierOptions"
            :field-names="{ label: 'name', value: 'id' }"
            allow-clear
            show-search
            :filter-option="filterErpBusinessPartnerOption"
            placeholder="供应商"
            :popup-class-name="
              candidatePopupClass('stock-history-filter-dropdown')
            "
            class="stock-history-filter__supplier"
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
      <div class="stock-history-table-wrap">
        <Table
          :columns="purchaseHistoryColumns"
          :data-source="purchaseHistoryRows"
          :loading="purchaseHistoryLoading"
          :pagination="purchaseHistoryTablePagination"
          class="stock-history-table"
          :row-key="(record) => record.rowKey || record.id"
          size="small"
          :show-sorter-tooltip="false"
          :scroll="{ x: 1500, y: 480 }"
          @change="handlePurchaseHistoryTableChange"
        >
          <template #bodyCell="{ column, record, text }">
            <a
              v-if="
                shortcutBizType === 'sale' &&
                column.key === 'customerName' &&
                record.customerId
              "
              @click.stop="openCustomerDetail(record)"
            >
              {{ text || '-' }}
            </a>
            <a
              v-else-if="
                shortcutBizType === 'sale' &&
                column.key === 'no' &&
                purchaseHistoryMode === 'order'
              "
              @click.stop="openSaleQuoteDetail(record)"
            >
              {{ text || '-' }}
            </a>
            <a
              v-else-if="
                shortcutBizType === 'sale' &&
                column.key === 'no' &&
                purchaseHistoryMode === 'history'
              "
              @click.stop="openSaleHistoryDocumentDetail(record)"
            >
              {{ text || '-' }}
            </a>
            <Tag
              v-else-if="
                shortcutBizType === 'sale' && column.key === 'documentType'
              "
            >
              {{ getSaleDocumentTypeText(record.__saleHistoryType) }}
            </Tag>
            <a
              v-else-if="column.key === 'supplierName' && record.supplierId"
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
                shortcutBizType === 'purchase' &&
                column.key === 'documentNo' &&
                purchaseHistoryMode === 'history'
              "
              @click.stop="openPurchaseHistoryDocumentDetail(record)"
            >
              {{ text || '-' }}
            </a>
            <Tag
              v-else-if="
                shortcutBizType === 'purchase' &&
                column.key === 'documentType' &&
                purchaseHistoryMode === 'history'
              "
            >
              {{ text || '-' }}
            </Tag>
            <span v-else-if="column.key === 'count'">
              {{ formatStockSelectionCount(getHistoryCount(record) ?? 0) }}
            </span>
            <span v-else-if="column.key === 'productPrice'">
              {{ formatPrice(getHistoryProductPrice(record)) }}
            </span>
            <span v-else-if="column.key === 'totalProductPrice'">
              {{ formatPrice(getHistoryTotalPrice(record)) }}
            </span>
            <span
              v-else-if="
                column.key === 'orderTime' ||
                column.key === 'inTime' ||
                column.key === 'businessTime' ||
                column.key === 'quoteTime' ||
                column.key === 'historyTime'
              "
            >
              {{ formatDateTimeValue(getHistoryDate(record)) }}
            </span>
            <span v-else-if="column.key === 'arrivalCount'">
              {{
                formatStockSelectionCount(
                  record.arrivalCount ?? record.inCount ?? 0,
                )
              }}
            </span>
            <span v-else-if="column.key === 'inTransitCount'">
              {{ formatStockSelectionCount(getInTransitCount(record)) }}
            </span>
            <span v-else-if="column.key === 'reviewerName'">
              {{ record.reviewerName || record.updaterName || '-' }}
            </span>
            <Tag
              v-else-if="column.key === 'status'"
              :color="
                shortcutBizType === 'sale'
                  ? getSaleStatusColor(record.status)
                  : getPurchaseOrderStatusColor(record.status)
              "
            >
              {{
                shortcutBizType === 'sale'
                  ? getSaleStatusText(record.status)
                  : getPurchaseOrderStatusText(record.status)
              }}
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
  <CustomerDetailModal v-if="shouldRenderCustomerDetail" />
  <SaleOutDetailModal v-if="shouldRenderSaleOutDetail" />
  <SaleReturnDetailModal v-if="shouldRenderSaleReturnDetail" />
  <SaleQuoteDetailModal v-if="shouldRenderSaleQuoteDetail" />
</template>

<style scoped>
:deep(.vxe-table--render-default),
:deep(.vxe-grid--form-wrapper),
:deep(.vxe-grid--form-wrapper .ant-input),
:deep(.vxe-grid--form-wrapper .ant-select),
:deep(.vxe-grid--form-wrapper .ant-btn) {
  font-size: 12px;
}

:deep(.vxe-grid--form-wrapper .ant-input-affix-wrapper),
:deep(.vxe-grid--form-wrapper .ant-select-single),
:deep(.vxe-grid--form-wrapper .ant-select-single .ant-select-selector),
:deep(.vxe-grid--form-wrapper .ant-btn) {
  min-height: 28px;
  font-size: 12px;
}

:deep(.vxe-grid--form-wrapper input::placeholder),
:deep(.vxe-grid--form-wrapper textarea::placeholder),
:deep(.vxe-grid--form-wrapper .ant-select-selection-placeholder) {
  font-size: 12px;
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

:deep(.stock-product-select-grid--stock .vxe-header--column .vxe-cell--sort) {
  display: inline-flex;
}

:deep(
  .stock-product-select-grid--stock .vxe-header--column .vxe-cell--sort > i
) {
  opacity: 0.35;
}

:deep(
  .stock-product-select-grid--stock
    .vxe-header--column
    .vxe-cell--sort
    > i.sort--active
) {
  opacity: 1;
}

.stock-column-filter-panel {
  width: 260px;
  padding: 10px;
}

.stock-column-filter-panel :deep(.ant-input),
.stock-column-filter-panel :deep(.ant-select) {
  width: 100%;
}

.stock-column-filter-panel__actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 10px;
}

:deep(.stock-selection-sale-distribution-row .vxe-body--column) {
  background-color: hsl(var(--primary) / 10%) !important;
}

:deep(.stock-selection-sale-distribution-row.row--hover .vxe-body--column) {
  background-color: hsl(var(--primary) / 16%) !important;
}

:deep(.vxe-body--row.row--current .vxe-body--column) {
  background-color: #fffbe6 !important;
  box-shadow:
    inset 0 1px 0 #faad14,
    inset 0 -1px 0 #faad14;
}

:deep(.vxe-body--row.row--current .vxe-body--column:first-child) {
  box-shadow:
    inset 4px 0 0 #faad14,
    inset 0 1px 0 #faad14,
    inset 0 -1px 0 #faad14;
}

:deep(.vxe-body--row.row--current.row--hover .vxe-body--column) {
  background-color: #fff1b8 !important;
}

.stock-select-shortcuts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  margin-bottom: 8px;
  color: #172033;
  background: #f6f8fb;
  border: 1px solid #d8e0ea;
  border-radius: 4px;
}

.stock-select-shortcuts__active {
  display: grid;
  flex: 1 1 320px;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 6px 10px;
  align-items: baseline;
  min-width: 0;
  max-width: 100%;
  font-size: 12px;
}

.stock-select-shortcuts__active strong {
  overflow: hidden;
  font-size: 12px;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stock-select-shortcuts__eyebrow {
  color: #5d6b82;
}

.stock-select-shortcuts__keys {
  display: flex;
  flex: 0 1 auto;
  flex-wrap: wrap;
  gap: 5px;
  justify-content: flex-end;
  min-width: 0;
  max-width: 100%;
  font-size: 12px;
}

.stock-select-shortcuts__keys span {
  display: inline-flex;
  flex: 0 0 auto;
  gap: 6px;
  align-items: center;
  min-height: 28px;
  padding: 3px 8px;
  white-space: nowrap;
  background: #fff;
  border: 1px solid #d8e0ea;
  border-radius: 4px;
}

.stock-select-shortcuts__keys span.is-active {
  color: #0958d9;
  background: #eef6ff;
  border-color: #91caff;
}

.stock-select-shortcuts__keys b {
  font-weight: 600;
  white-space: nowrap;
}

.stock-select-shortcuts kbd {
  min-width: 24px;
  padding: 1px 6px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  font-weight: 700;
  line-height: 16px;
  color: #13213a;
  text-align: center;
  white-space: nowrap;
  background: #edf1f7;
  border: 1px solid #c6d0de;
  border-radius: 3px;
}

.stock-selection-bottom {
  border-top: 1px solid hsl(var(--border));
}

.stock-selection-distribution-note {
  display: flex;
  gap: 6px;
  align-items: center;
  min-height: 36px;
  padding: 5px 8px;
  font-size: 12px;
  font-weight: 600;
}

.stock-selection-distribution-swatch {
  width: 14px;
  height: 14px;
  background-color: hsl(var(--primary) / 10%);
  border: 1px solid hsl(var(--primary) / 55%);
}

:global(.stock-product-select-dropdown .ant-select-item),
:global(.stock-product-select-dropdown .ant-select-item-option-content),
:global(.stock-product-select-dropdown .ant-empty-description) {
  font-size: 12px;
}

:global(.stock-product-select-modal--fullscreen),
:global(.stock-product-select-modal--fullscreen .ant-modal-title),
:global(.stock-product-select-modal--fullscreen .ant-modal-body),
:global(.stock-product-select-modal--fullscreen .ant-modal-footer),
:global(.stock-product-select-modal--fullscreen .ant-btn),
:global(.stock-history-modal),
:global(.stock-history-modal .ant-modal-title),
:global(.stock-history-modal .ant-modal-body),
:global(.stock-history-modal .ant-btn),
:global(.stock-history-filter-dropdown),
:global(.stock-history-filter-dropdown .ant-select-item),
:global(.stock-history-filter-dropdown .ant-select-item-option-content),
:global(.stock-history-filter-dropdown .ant-empty-description) {
  font-size: 12px;
}

:global(.stock-product-select-modal--fullscreen input::placeholder),
:global(.stock-product-select-modal--fullscreen textarea::placeholder),
:global(
  .stock-product-select-modal--fullscreen .ant-select-selection-placeholder
),
:global(.stock-history-modal input::placeholder),
:global(.stock-history-modal textarea::placeholder),
:global(.stock-history-modal .ant-select-selection-placeholder) {
  font-size: 12px;
}

:global(.stock-product-select-modal--fullscreen) {
  top: 0;
  max-width: 100vw;
  padding-bottom: 0;
}

:global(.stock-product-select-modal--fullscreen .ant-modal-content) {
  display: flex;
  flex-direction: column;
  height: 100vh;
  border-radius: 0;
}

:global(.stock-product-select-modal--fullscreen .ant-modal-body) {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.stock-product-select-grid--fullscreen {
  height: calc(100vh - 168px);
  min-height: 560px;
}

:deep(.stock-product-select-grid--fullscreen .vxe-header--column),
:deep(.stock-product-select-grid--fullscreen .vxe-body--column) {
  padding-right: 4px;
  padding-left: 4px;
}

.stock-history-panel {
  overflow: hidden;
  border: 1px solid #d8dee8;
}

.stock-history-filter {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  align-items: center;
  padding: 8px 10px;
  background: #f7f9fc;
  border-bottom: 1px solid #d8dee8;
}

.stock-history-filter__item {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  font-size: 12px;
  font-weight: 600;
  color: #334155;
}

.stock-history-filter__date :deep(.ant-picker) {
  width: 330px;
}

.stock-history-filter__supplier {
  width: 220px;
}

.stock-history-table-wrap {
  background: #fff;
}

:global(.stock-history-modal .ant-modal-body) {
  padding-top: 8px;
}

:global(.stock-history-table .ant-table) {
  font-size: 12px;
}

:global(.stock-history-table .ant-table-thead > tr > th) {
  height: 30px;
  padding: 5px 8px;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
  background: #f1f5f9;
}

:global(.stock-history-table .ant-table-column-sorters) {
  padding: 0;
}

:global(.stock-history-table .ant-table-column-sorter) {
  display: none;
}

:global(.stock-history-table .ant-table-tbody > tr > td) {
  height: 30px;
  padding: 4px 8px;
}

:global(.stock-history-table .ant-pagination) {
  padding: 8px 10px;
  margin: 0;
  font-size: 12px;
  border-top: 1px solid #e5e7eb;
}

:global(.stock-history-table .ant-pagination .ant-select),
:global(.stock-history-table .ant-pagination .ant-select-item),
:global(.stock-history-table .ant-pagination .ant-pagination-options),
:global(.stock-history-table .ant-pagination .ant-pagination-item),
:global(.stock-history-table .ant-pagination input) {
  font-size: 12px;
}

@media (max-width: 1200px) {
  .stock-select-shortcuts {
    align-items: stretch;
    flex-direction: column;
  }

  .stock-select-shortcuts__active {
    max-width: 100%;
  }

  .stock-select-shortcuts__keys {
    justify-content: flex-start;
  }
}
</style>
