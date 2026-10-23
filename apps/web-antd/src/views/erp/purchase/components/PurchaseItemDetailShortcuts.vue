<script lang="ts" setup>
import { inject } from 'vue';

import { stockNatural } from '#/views/erp/stock/utils/stock-decimal';
const props = withDefaults(
  defineProps<{
    activeRow?: PurchaseItemShortcutRow;
    createEnabled?: boolean;
    deptId?: number;
    hiddenFields?: string[];
    historyEnabled?: boolean;
    isStockSelectorOpen?: () => boolean;
    productEditEnabled?: boolean;
    saleHistoryEnabled?: boolean;
    warningMessage?: string;
  }>(),
  {
    activeRow: undefined,
    createEnabled: false,
    deptId: undefined,
    historyEnabled: true,
    hiddenFields: () => [],
    isStockSelectorOpen: undefined,
    productEditEnabled: true,
    saleHistoryEnabled: false,
    warningMessage: '请先点击一条有商品的采购明细',
  },
);
const emit = defineEmits<{
  create: [];
  productUpdated: [row: PurchaseItemShortcutRow];
}>();
const stockDecimalContext = inject('stock-decimal-context', false);
import type { TableColumnsType, TableProps } from 'ant-design-vue';

import type { ErpPurchaseHistoryApi } from '#/api/erp/purchase/history';
import type { ErpPurchaseOrderApi } from '#/api/erp/purchase/order';
import type { ErpStockApi } from '#/api/erp/stock/stock';

import {
  computed,
  defineAsyncComponent,
  nextTick,
  provide,
  ref,
  watch,
} from 'vue';

import { useAccess } from '@vben/access';
import { useVbenModal } from '@vben/common-ui';
import { formatDateTime } from '@vben/utils';

import {
  Button,
  DatePicker,
  message,
  Modal,
  Space,
  Table,
  Tag,
} from 'ant-design-vue';

import { getProduct } from '#/api/erp/product/product';
import { getPurchaseHistoryPage } from '#/api/erp/purchase/history';
import {
  getPurchaseOrderPage,
  PURCHASE_ORDER_STATUS,
} from '#/api/erp/purchase/order';
import ProductForm from '#/views/erp/product/product/modules/form.vue';
import SupplierLazySelect from '#/views/erp/purchase/components/SupplierLazySelect.vue';
import { PURCHASE_CANDIDATE_FOCUS_KEY } from '#/views/erp/purchase/utils/candidate-focus';
import {
  formatPurchaseAmount,
  formatPurchaseDecimal,
} from '#/views/erp/purchase/utils/decimal';
import { createPurchaseHistoryShortcutController } from '#/views/erp/purchase/utils/history-shortcut';
import { isBatchNoEnabled } from '#/views/erp/purchase/utils/item-form';
import SaleStockProductSelectModal from '#/views/erp/sale/components/SaleStockProductSelectModal.vue';
import { isCreateShortcutKey } from '#/views/erp/utils/keyboard';
import { ensureModalReady } from '#/views/erp/utils/lazy-modal';

type PurchaseHistoryMode = 'history' | 'in' | 'order';
type HistorySorter = {
  field?: string;
  order?: 'ascend' | 'descend';
};
type HistoryFilterState = {
  dateRange?: [string, string];
  supplierId?: number;
};
type HistoryRow =
  | ErpPurchaseHistoryApi.Row
  | ErpPurchaseOrderApi.PurchaseOrder
  | Record<string, any>;
type PurchaseItemShortcutRow = Record<string, any> & {
  deptId?: number;
  productId?: number;
};

provide(
  PURCHASE_CANDIDATE_FOCUS_KEY,
  computed(() => true),
);

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
const saleHistoryModalRef =
  ref<InstanceType<typeof SaleStockProductSelectModal>>();
const { hasAccessByCodes } = useAccess();

const [ProductFormModal, productFormModalApi] = useVbenModal({
  connectedComponent: ProductForm,
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
const activeProductText = computed(() => {
  const row = getActiveItemRow(false);
  if (!row) {
    return '未选中商品';
  }
  return [row.productCode, row.productName].filter(Boolean).join(' / ');
});
function isPurchaseRecordHistoryMode() {
  return (
    purchaseHistoryMode.value === 'history' ||
    purchaseHistoryMode.value === 'in'
  );
}

function getPurchaseHistoryTitlePrefix() {
  switch (purchaseHistoryMode.value) {
    case 'in': {
      return '采购入库记录';
    }
    case 'order': {
      return '采购订单历史';
    }
    default: {
      return '采购历史';
    }
  }
}

const purchaseHistoryTitle = computed(() => {
  return `${getPurchaseHistoryTitlePrefix()} - ${activeProductText.value}`;
});
const purchaseHistoryDateField = computed(() =>
  purchaseHistoryMode.value === 'order' ? 'orderTime' : 'businessTime',
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

function getActiveItemRow(showWarning = true) {
  const row = props.activeRow;
  if (!row?.productId) {
    if (showWarning) {
      message.warning(props.warningMessage);
    }
    return undefined;
  }
  return row;
}

function isEditableTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  if (!element) return false;
  const tagName = element.tagName?.toLowerCase();
  return (
    tagName === 'input' ||
    tagName === 'textarea' ||
    tagName === 'select' ||
    tagName === 'button' ||
    element.isContentEditable ||
    isShortcutOverlayTarget(target)
  );
}

function isShortcutOverlayTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  if (!element) return false;
  return !!element.closest?.(
    '.ant-select-dropdown, .ant-picker-dropdown, .ant-popover',
  );
}

function isCheckableControlTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  if (!element) return false;
  const input =
    element instanceof HTMLInputElement ? element : element.closest?.('input');
  if (
    input instanceof HTMLInputElement &&
    ['checkbox', 'radio'].includes(input.type)
  ) {
    return true;
  }
  return !!element.closest?.(
    '.ant-checkbox, .ant-radio, .vxe-checkbox, .vxe-cell--checkbox',
  );
}

function shouldIgnoreShortcutTarget(event: KeyboardEvent) {
  const key = event.key.toLowerCase();
  if (key === 'f' && isCheckableControlTarget(event.target)) {
    return false;
  }
  return isEditableTarget(event.target);
}

function formatPrice(value: unknown) {
  return stockDecimalContext
    ? stockNatural(value as null | number | string | undefined)
    : formatPurchaseAmount(value, '-');
}

function formatCount(value: unknown) {
  return stockDecimalContext
    ? stockNatural(value as null | number | string | undefined)
    : formatPurchaseDecimal(value, '-');
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
  return purchaseHistoryMode.value === 'order'
    ? PURCHASE_ORDER_HISTORY_SORT_FIELD_MAP
    : PURCHASE_HISTORY_SORT_FIELD_MAP;
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

  if (isPurchaseRecordHistoryMode()) {
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
      ...(stockDecimalContext ? { decimalMode: 'string' } : {}),
      pageNo,
      pageSize: purchaseHistoryPagination.value.pageSize,
      productId: row.productId,
      ...(purchaseHistoryMode.value === 'in'
        ? { documentTypeCode: 'PURCHASE_IN' as const }
        : {}),
      ...buildHistoryFilterParams(),
      ...buildHistorySortParams(),
    };
    const result = isPurchaseRecordHistoryMode()
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

async function openPurchaseHistory(mode: PurchaseHistoryMode) {
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

async function openSaleShortcutHistory(mode: 'history' | 'order') {
  const row = getActiveItemRow();
  if (!row?.productId) return;
  await saleHistoryModalRef.value?.openShortcutHistory(mode, {
    ...row,
    count: row.stockCount ?? 0,
    productBarCode: row.productBarCode,
    unitId: row.productUnitId,
    unitName: row.productUnitName,
  } as ErpStockApi.Stock);
}

async function handleProductFormSuccess() {
  const row = getActiveItemRow(false);
  if (!row?.productId) {
    return;
  }
  const product = await getProduct(row.productId);
  emit('productUpdated', {
    ...row,
    productCode: product.code ?? row.productCode,
    productName: product.name ?? row.productName,
    productBarCode: product.barCode ?? row.productBarCode,
    barCode: product.barCode ?? row.barCode,
    productUnitId: product.unitId ?? row.productUnitId,
    productUnitName: product.unitName ?? row.productUnitName,
    vehicleModel: product.vehicleModel ?? row.vehicleModel,
    originPlace: product.originPlace ?? row.originPlace,
    standard: product.standard ?? row.standard,
    featureCode: product.featureCode ?? row.featureCode,
    drawingNo: product.drawingNo ?? row.drawingNo,
    factoryCode: product.factoryCode ?? row.factoryCode,
    brand: product.brand ?? row.brand,
    lastPurchasePrice: product.lastPurchasePrice ?? row.lastPurchasePrice,
    batchNoEnabled: isBatchNoEnabled(product.batchNoEnabled),
  });
}

function isShortcutDialogOpen() {
  return (
    purchaseHistoryOpen.value ||
    props.isStockSelectorOpen?.() === true ||
    saleHistoryModalRef.value?.isShortcutDialogOpen?.() === true
  );
}

const purchaseHistoryShortcutController =
  createPurchaseHistoryShortcutController({
    onHistory: () => void openPurchaseHistory('history'),
    onOrderHistory: () => void openPurchaseHistory('order'),
    shouldIgnore: (event) =>
      !props.historyEnabled ||
      event.defaultPrevented ||
      event.repeat ||
      event.isComposing ||
      event.ctrlKey ||
      event.metaKey ||
      event.altKey ||
      shouldIgnoreShortcutTarget(event) ||
      isShortcutDialogOpen(),
  });

watch(
  () => props.historyEnabled,
  (enabled) => {
    if (!enabled) {
      purchaseHistoryShortcutController.reset();
    }
  },
);

function handleShortcut(event: KeyboardEvent) {
  if (event.defaultPrevented || event.repeat || event.isComposing) {
    return;
  }
  if (event.ctrlKey || event.metaKey || event.altKey) {
    return;
  }
  if (props.createEnabled && isCreateShortcutKey(event)) {
    if (isShortcutDialogOpen() || isShortcutOverlayTarget(event.target)) {
      return;
    }
    event.preventDefault();
    emit('create');
    return;
  }
  if (shouldIgnoreShortcutTarget(event)) {
    return;
  }
  if (isShortcutDialogOpen()) {
    return;
  }
  if (purchaseHistoryShortcutController.handleKeydown(event)) {
    return;
  }
  const key = event.key.toLowerCase();
  if (props.saleHistoryEnabled && key === 's') {
    event.preventDefault();
    void openSaleShortcutHistory('history');
    return;
  }
  if (props.saleHistoryEnabled && key === 'q') {
    event.preventDefault();
    void openSaleShortcutHistory('order');
    return;
  }
  if (props.productEditEnabled && key === 'f') {
    event.preventDefault();
    openProductEdit();
  }
}

function handleShortcutKeyup(event: KeyboardEvent) {
  purchaseHistoryShortcutController.handleKeyup(event);
}

function resetPendingShortcutState() {
  purchaseHistoryShortcutController.reset();
}

defineExpose({
  handleShortcut,
  handleShortcutKeyup,
  openProductEdit,
  openPurchaseHistory,
  isShortcutDialogOpen,
  resetPendingShortcutState,
});
</script>

<template>
  <Modal
    v-model:open="purchaseHistoryOpen"
    :footer="null"
    :title="purchaseHistoryTitle"
    class="!w-[92vw] purchase-item-shortcut-history-modal"
  >
    <div class="purchase-item-shortcut-history-panel">
      <div class="purchase-item-shortcut-history-filter">
        <div
          class="purchase-item-shortcut-history-filter__item purchase-item-shortcut-history-filter__date"
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
        <div class="purchase-item-shortcut-history-filter__item">
          <span>供应商</span>
          <SupplierLazySelect
            v-model:value="purchaseHistoryFilters.supplierId"
            allow-clear
            show-search
            placeholder="供应商"
            popup-class-name="purchase-item-shortcut-history-dropdown erp-candidate-focus-popup"
            class="purchase-item-shortcut-history-filter__supplier"
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
      <div class="purchase-item-shortcut-history-table-wrap">
        <Table
          :columns="purchaseHistoryColumns"
          :data-source="purchaseHistoryRows"
          :loading="purchaseHistoryLoading"
          :pagination="purchaseHistoryTablePagination"
          class="purchase-item-shortcut-history-table"
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
                column.key === 'documentNo' && purchaseHistoryMode !== 'order'
              "
              @click.stop="openPurchaseHistoryDocumentDetail(record)"
            >
              {{ text || '-' }}
            </a>
            <Tag
              v-else-if="
                column.key === 'documentType' && purchaseHistoryMode !== 'order'
              "
            >
              {{ text || '-' }}
            </Tag>
            <span v-else-if="column.key === 'count'">
              {{ formatCount(getHistoryCount(record)) }}
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
              {{ formatCount(record.arrivalCount ?? record.inCount) }}
            </span>
            <span v-else-if="column.key === 'inTransitCount'">
              {{ formatCount(getInTransitCount(record)) }}
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
  <SaleStockProductSelectModal
    candidate-focus-highlight
    v-if="saleHistoryEnabled"
    ref="saleHistoryModalRef"
    :enable-sale-stock-shortcuts="true"
    :hidden-fields="hiddenFields"
    :sale-dept-id="deptId"
  />
  <ProductFormModal @success="handleProductFormSuccess" />
  <SupplierDetailModal v-if="shouldRenderSupplierDetail" />
  <PurchaseOrderDetailModal v-if="shouldRenderPurchaseOrderDetail" />
  <PurchaseInDetailModal v-if="shouldRenderPurchaseInDetail" />
  <PurchaseReturnDetailModal v-if="shouldRenderPurchaseReturnDetail" />
</template>

<style scoped>
:deep(.purchase-item-shortcut-history-modal .ant-modal-body),
:deep(.purchase-item-shortcut-history-modal .ant-table),
:deep(.purchase-item-shortcut-history-modal .ant-table-cell),
:deep(.purchase-item-shortcut-history-modal .ant-select),
:deep(.purchase-item-shortcut-history-modal .ant-picker),
:deep(.purchase-item-shortcut-history-modal .ant-btn) {
  font-size: 12px;
}

.purchase-item-shortcut-history-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.purchase-item-shortcut-history-filter {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.purchase-item-shortcut-history-filter__item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.purchase-item-shortcut-history-filter__date :deep(.ant-picker) {
  width: 360px;
}

.purchase-item-shortcut-history-filter__supplier {
  width: 220px;
}

.purchase-item-shortcut-history-table-wrap {
  min-height: 480px;
}
</style>
