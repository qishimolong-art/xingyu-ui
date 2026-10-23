<script lang="ts" setup>
import { CANDIDATE_FOCUS_KEY } from '#/views/erp/utils/candidate-focus';

import type { ErpSaleOutApi } from '#/api/erp/sale/out';
import type { ErpStockApi } from '#/api/erp/stock/stock';

import {
  computed,
  defineAsyncComponent,
  nextTick,
  onBeforeUnmount,
  ref,
  provide,
} from 'vue';

import { useAccess } from '@vben/access';
import { useVbenModal } from '@vben/common-ui';
import { useAppConfig } from '@vben/hooks';
import { formatDateTime } from '@vben/utils';

import {
  Button,
  Checkbox,
  Image as AImage,
  message,
  Pagination,
  TabPane,
  Tabs,
  Tag,
} from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { formatSaleDecimal, formatSaleAmount } from '#/views/erp/sale/utils/decimal';
import { getCustomerSalePriceLevel } from '#/api/erp/sale/customer';
import {
  getSaleOut,
  getSaleOutExpressFilePage,
  getSaleOutItemPage,
  getSaleOutPickDeliveryDetail,
  getSaleOutPickDeliveryFilePage,
  getSaleOutPickDeliveryItemPage,
  getSaleOutPickDeliveryOperationItemPage,
} from '#/api/erp/sale/out';
import {
  isFieldHidden,
  useFieldPermission,
} from '#/composables/useFieldPermission';
import ErpAuditInfo from '#/views/erp/components/ErpAuditInfo.vue';
import ItemPriceReferenceOverlay from '#/views/erp/components/ItemPriceReferenceOverlay.vue';
import ProductForm from '#/views/erp/product/product/modules/form.vue';
import PurchaseItemDetailShortcuts from '#/views/erp/purchase/components/PurchaseItemDetailShortcuts.vue';
import { useReportViewOnly } from '#/views/erp/report/components/report-view-only';
import SaleDocumentRemarkForm from '#/views/erp/sale/components/SaleDocumentRemarkForm.vue';
import SaleStockProductSelectModal from '#/views/erp/sale/components/SaleStockProductSelectModal.vue';
import SaleReturnableItemSelectModal from '#/views/erp/sale/return/modules/sale-returnable-item-select-modal.vue';
import { applySaleDocumentItemColumnCustomization } from '#/views/erp/sale/utils/document-item-table';
import { getSalePriceReferenceOverlayHiddenFields } from '#/views/erp/sale/utils/field-permission';
import { getItemPrintSortTitle } from '#/views/erp/sale/utils/item-print-sort';
import {
  focusSaleShortcutOwner,
  isSaleShortcutOwnerActive,
} from '#/views/erp/sale/utils/shortcut-scope';
import {
  stockOutBillHistoryStatus,
  stockOutBillHistorySummary,
} from '#/views/erp/stock/outbill/outbill-history';
import { getErpDetailLoadError } from '#/views/erp/utils/detail-load-error';
import { ensureModalReady } from '#/views/erp/utils/lazy-modal';
import { isEditableEnterTarget } from '#/views/erp/utils/keyboard';
import {
  isPriceReferenceShortcut,
  shouldIgnorePriceReferenceShortcut,
} from '#/views/erp/utils/price-reference';
import { settleVxeColumnCustomization } from '#/views/erp/utils/vxe-column-custom';

import { useDetailItemColumns, useStockOutDetailItemColumns } from '../data';
import { resolveSaleOutExpressFileUrl } from '../utils/express-file';
import { restoreSaleOutItemColumnLayout } from '../utils/item-column-layout';
import ExpressUploadModal from './express-upload-modal.vue';
import ReceiptWriteOffTab from './receipt-writeoff-tab.vue';

provide(CANDIDATE_FOCUS_KEY, ref(true));

defineOptions({ name: 'ErpSaleOutDetail' });

const emit = defineEmits<{
  print: [
    payload: {
      itemOrderDirection?: 'asc' | 'desc';
      itemOrderField?: string;
      row: ErpSaleOutApi.SaleOut;
    },
  ];
  success: [];
}>();
const reportViewOnly = useReportViewOnly();

type SelectedReturnableRows = Array<{
  count: number;
  itemRow: ErpSaleOutApi.SaleReturnableItem;
}>;

const formData = ref<ErpSaleOutApi.SaleOut>({});
const shortcutScopeRef = ref<HTMLElement | null>(null);
const DETAIL_TAB_KEY = 'detail';
const FULFILLMENT_TAB_KEY = 'fulfillment';
const RECEIPT_TAB_KEY = 'receipt';
const activeTab = ref(DETAIL_TAB_KEY);
const receiptTabReloadKey = ref(0);
const detailLoading = ref(false);
const detailLoadError = ref('');
const itemPageLoading = ref(false);
const DEFAULT_ITEM_PAGE_SIZE = 10;
const ITEM_PAGE_SIZE_OPTIONS = ['10', '20', '50', '100', '200'];
const ITEM_TABLE_VISIBLE_ROWS = 10;
const ITEM_TABLE_HEADER_HEIGHT = 40;
const ITEM_TABLE_ROW_HEIGHT = 36;
const ITEM_TABLE_HEIGHT =
  ITEM_TABLE_HEADER_HEIGHT + ITEM_TABLE_ROW_HEIGHT * ITEM_TABLE_VISIBLE_ROWS;
const TRAILING_FLEXIBLE_COLUMN_MIN_WIDTH = 150;
const itemPageState = ref({
  orderDirection: undefined as 'asc' | 'desc' | undefined,
  orderField: undefined as string | undefined,
  pageNo: 1,
  pageSize: DEFAULT_ITEM_PAGE_SIZE,
  total: 0,
});
const FULFILLMENT_ITEM_PAGE_SIZE_OPTIONS = ['20', '50'];
const FULFILLMENT_FILE_PAGE_SIZE_OPTIONS = ['6', '9', '18'];
const FULFILLMENT_OPERATION_PAGE_SIZE_OPTIONS = ['20', '50'];
const fulfillmentDetail = ref<ErpSaleOutApi.PickDeliveryDetail | null>(null);
const fulfillmentItems = ref<ErpSaleOutApi.PickDeliveryItem[]>([]);
const fulfillmentFiles = ref<ErpSaleOutApi.PickDeliveryFile[]>([]);
const fulfillmentPickOperationItems = ref<
  ErpSaleOutApi.PickDeliveryOperationItem[]
>([]);
const fulfillmentDeliveryOperationItems = ref<
  ErpSaleOutApi.PickDeliveryOperationItem[]
>([]);
const expressFiles = ref<ErpSaleOutApi.ExpressFile[]>([]);
const expressFileLoading = ref(false);
const expressFileLoadError = ref('');
const expressFilePageState = ref({
  pageNo: 1,
  pageSize: 6,
  total: 0,
});
const fulfillmentLoadedOutId = ref<number | undefined>();
const fulfillmentLoading = ref(false);
const fulfillmentLoadError = ref('');
const fulfillmentItemLoading = ref(false);
const fulfillmentFileLoading = ref(false);
const fulfillmentPickOperationLoading = ref(false);
const fulfillmentDeliveryOperationLoading = ref(false);
const fulfillmentPickOperationError = ref('');
const fulfillmentDeliveryOperationError = ref('');
const fulfillmentItemPageState = ref({
  pageNo: 1,
  pageSize: 20,
  total: 0,
});
const fulfillmentFilePageState = ref({
  pageNo: 1,
  pageSize: 6,
  total: 0,
});
const fulfillmentPickOperationPageState = ref({
  pageNo: 1,
  pageSize: 20,
  total: 0,
});
const fulfillmentDeliveryOperationPageState = ref({
  pageNo: 1,
  pageSize: 20,
  total: 0,
});
const priceReferenceOpen = ref(false);
const itemTableWrapRef = ref<HTMLElement | null>(null);
const activeItemId = ref<number>();
const productSelectRef =
  ref<InstanceType<typeof SaleStockProductSelectModal>>();
const purchaseShortcutsRef =
  ref<InstanceType<typeof PurchaseItemDetailShortcuts>>();
let detailLoadSequence = 0;
let fulfillmentLoadSequence = 0;
let isShortcutListening = false;
let pendingQuoteOrderHistoryShift = false;
const DETAIL_SUPPRESSED_FIELD_KEYS = new Set<string>([
  'afterReductionAmount',
  'billAmount',
  'billNo',
  'billType',
  'printCount',
  'reductionAmount',
  'senderName',
  'shipper',
  'sourceCreateTime',
  'sourceCreatorName',
  'sourceNo',
  'totalCount',
  'totalProductPrice',
]);
const FIELD_PERMISSION_MODULE = 'erp_sale_out';
const currentCustomerPriceLevel = ref<number | undefined>();
const { hiddenFields, loadHiddenFields } = useFieldPermission(
  FIELD_PERMISSION_MODULE,
  { customerPriceLevel: currentCustomerPriceLevel },
);
const priceReferenceHiddenFields = computed(() =>
  getSalePriceReferenceOverlayHiddenFields(hiddenFields.value),
);
const { hasAccessByCodes } = useAccess();
const canEditProduct = computed(() => hasAccessByCodes(['erp:product:update']));
const canViewPurchaseOrderHistory = computed(() =>
  hasAccessByCodes(['erp:purchase-order:query']),
);
const canViewPurchaseInHistory = computed(() =>
  hasAccessByCodes(['erp:purchase-in:query']),
);
const activeShortcutItemRow = computed(() => getActiveItemRow());
const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);
const CustomerDetail = defineAsyncComponent(
  () => import('#/views/erp/sale/customer/modules/detail.vue'),
);
const SaleOrderDetail = defineAsyncComponent(
  () => import('#/views/erp/sale/order/modules/form.vue'),
);
const loadSalePriceAdjustForm = () =>
  import('#/views/erp/sale/priceadjust/modules/form.vue');
const SalePriceAdjustForm = defineAsyncComponent(loadSalePriceAdjustForm);
const loadSaleReturnForm = () =>
  import('#/views/erp/sale/return/modules/form.vue');
const SaleReturnForm = defineAsyncComponent(loadSaleReturnForm);
const [CustomerDetailModal, customerDetailModalApi] = useVbenModal({
  connectedComponent: CustomerDetail,
  destroyOnClose: true,
});
const [SaleOrderDetailModal, saleOrderDetailModalApi] = useVbenModal({
  connectedComponent: SaleOrderDetail,
  destroyOnClose: true,
});
const [ExpressUploadModalRef, expressUploadModalApi] = useVbenModal({
  connectedComponent: ExpressUploadModal,
  destroyOnClose: true,
});
const [RemarkModal, remarkModalApi] = useVbenModal({
  connectedComponent: SaleDocumentRemarkForm,
  destroyOnClose: true,
});
const [ProductFormModal, productFormModalApi] = useVbenModal({
  connectedComponent: ProductForm,
  destroyOnClose: true,
});

function handleOpenCustomerDetail() {
  if (!formData.value.customerId) return;
  customerDetailModalApi.setData({ id: formData.value.customerId }).open();
}

function handleOpenSourceOrderDetail() {
  if (formData.value.sourceType !== 10 || !formData.value.sourceId) return;
  saleOrderDetailModalApi
    .setData({ type: 'detail', id: formData.value.sourceId })
    .open();
}

function buildDetailItemColumns(
  rows: ErpSaleOutApi.SaleOutItem[] = formData.value.items ?? [],
) {
  return (
    useDetailItemColumns(hiddenFields.value, {
      getCellContentExtraWidth: (field, row) => {
        if (field === 'sourceWarehouseName' && isCrossDeptSale(row)) return 64;
        if (field === 'count' && Number(row.returnedCount ?? 0) > 0) {
          return 42 + formatDetailCount(row.returnedCount).length * 8;
        }
        if (field === 'productPrice' && hasAdjustedProductPrice(row)) {
          return 76 + formatItemPrice(row.originalProductPrice).length * 8;
        }
        return 0;
      },
      rows,
      trailingFlexibleColumnMinWidth: TRAILING_FLEXIBLE_COLUMN_MIN_WIDTH,
    }) || []
  );
}

function buildStockOutDetailItemColumns(
  rows: ErpSaleOutApi.SaleOutItem[] = formData.value.items ?? [],
) {
  return (
    useStockOutDetailItemColumns(hiddenFields.value, {
      getCellContentExtraWidth: (field, row) => {
        if (field === 'sourceWarehouseName' && isCrossDeptSale(row)) return 64;
        if (field === 'stockOutBillStatusName' && !row.hasStockOutBill) {
          return 116;
        }
        return 0;
      },
      rows,
      trailingFlexibleColumnMinWidth: TRAILING_FLEXIBLE_COLUMN_MIN_WIDTH,
    }) || []
  );
}

const [ItemGrid, itemGridApi] = useVbenVxeGrid<ErpSaleOutApi.SaleOutItem>({
  gridOptions: {
    columns: buildDetailItemColumns([]),
    customConfig: {
      restoreStore: restoreSaleOutItemColumnLayout,
      storage: {
        fixed: true,
        resizable: true,
        sort: true,
        visible: true,
      },
    },
    data: [],
    border: true,
    height: ITEM_TABLE_HEIGHT,
    id: 'erp-sale-out-item-list-v1',
    autoResize: true,
    fit: true,
    showOverflow: 'tooltip',
    showHeaderOverflow: 'tooltip',
    rowConfig: { keyField: 'id', isHover: true },
    rowClassName: ({ row }: { row: ErpSaleOutApi.SaleOutItem }) =>
      row.id === activeItemId.value ? 'sale-out-item-row--active' : '',
    pagerConfig: { enabled: false },
    sortConfig: {
      allowBtn: false,
      multiple: false,
      orders: ['asc', 'desc', null],
      remote: true,
      trigger: 'cell',
    },
    toolbarConfig: {
      custom: true,
      enabled: true,
      refresh: true,
      refreshOptions: {
        queryMethod: () => refreshSaleOutItemGrids(),
      },
      zoom: true,
    },
  },
  gridEvents: {
    cellClick: ({ row }: { row: ErpSaleOutApi.SaleOutItem }) => {
      activeItemId.value = row.id;
    },
    cellDblclick: ({ row }: { row: ErpSaleOutApi.SaleOutItem }) => {
      activeItemId.value = row.id;
    },
    custom: handleDetailItemColumnCustom,
    resizableChange: () => handleDetailItemColumnCustom({ type: 'confirm' }),
    sortChange: ({ field, order }: any) =>
      handleItemSortChange({ field, order }),
  },
});
const [StockOutItemGrid, stockOutItemGridApi] =
  useVbenVxeGrid<ErpSaleOutApi.SaleOutItem>({
    gridOptions: {
      columns: buildStockOutDetailItemColumns([]),
      customConfig: {
        restoreStore: restoreSaleOutItemColumnLayout,
        storage: {
          fixed: true,
          resizable: true,
          sort: true,
          visible: true,
        },
      },
      data: [],
      border: true,
      height: ITEM_TABLE_HEIGHT,
      id: 'erp-sale-out-stock-item-list-v1',
      autoResize: true,
      fit: true,
      showOverflow: 'tooltip',
      showHeaderOverflow: 'tooltip',
      rowConfig: { keyField: 'id', isHover: true },
      pagerConfig: { enabled: false },
      toolbarConfig: {
        custom: true,
        enabled: true,
        refresh: true,
        refreshOptions: {
          queryMethod: () => refreshSaleOutItemGrids(),
        },
        zoom: true,
      },
    },
    gridEvents: {
      custom: handleStockOutItemColumnCustom,
      resizableChange: () =>
        handleStockOutItemColumnCustom({ type: 'confirm' }),
    },
  });

function buildCustomizedDetailItemColumns(
  rows: ErpSaleOutApi.SaleOutItem[] = formData.value.items ?? [],
) {
  return applySaleDocumentItemColumnCustomization(
    buildDetailItemColumns(rows),
    itemGridApi.grid?.getFullColumns?.() ?? [],
    TRAILING_FLEXIBLE_COLUMN_MIN_WIDTH,
  );
}

function buildCustomizedStockOutDetailItemColumns(
  rows: ErpSaleOutApi.SaleOutItem[] = formData.value.items ?? [],
) {
  return applySaleDocumentItemColumnCustomization(
    buildStockOutDetailItemColumns(rows),
    stockOutItemGridApi.grid?.getFullColumns?.() ?? [],
    TRAILING_FLEXIBLE_COLUMN_MIN_WIDTH,
  );
}

async function handleDetailItemColumnCustom({ type }: { type?: string }) {
  const settled = await settleVxeColumnCustomization(itemGridApi.grid, type);
  if (!settled) return;
  const columns =
    type === 'reset'
      ? buildDetailItemColumns()
      : buildCustomizedDetailItemColumns();
  itemGridApi.setGridOptions({ columns });
  await itemGridApi.grid?.reloadColumn?.(columns);
  if (itemPageState.value.orderField && itemPageState.value.orderDirection) {
    await itemGridApi.grid?.setSort?.({
      field: itemPageState.value.orderField,
      order: itemPageState.value.orderDirection,
    });
  }
  await itemGridApi.grid?.refreshColumn?.();
  await itemGridApi.grid?.recalculate?.(true);
}

async function handleStockOutItemColumnCustom({ type }: { type?: string }) {
  const settled = await settleVxeColumnCustomization(
    stockOutItemGridApi.grid,
    type,
  );
  if (!settled) return;
  const columns =
    type === 'reset'
      ? buildStockOutDetailItemColumns()
      : buildCustomizedStockOutDetailItemColumns();
  stockOutItemGridApi.setGridOptions({ columns });
  await stockOutItemGridApi.grid?.reloadColumn?.(columns);
  await stockOutItemGridApi.grid?.refreshColumn?.();
  await stockOutItemGridApi.grid?.recalculate?.(true);
}
const [SalePriceAdjustModal, salePriceAdjustModalApi] = useVbenModal({
  connectedComponent: SalePriceAdjustForm,
  destroyOnClose: true,
});
const shouldRenderSalePriceAdjust = ref(false);
const [SaleReturnModal, saleReturnModalApi] = useVbenModal({
  connectedComponent: SaleReturnForm,
  destroyOnClose: true,
});
const shouldRenderSaleReturn = ref(false);
const returnableItemSelectRef =
  ref<InstanceType<typeof SaleReturnableItemSelectModal>>();

const statusText = computed(() => {
  if (formData.value.status === 20) return '已审核';
  if (formData.value.status === 10) return '未审核';
  return '-';
});

const settleStatusText = computed(() => {
  const s = formData.value.settleStatus;
  if (s === 2) return '已结算';
  if (s === 1) return '部分结算';
  return '未结算';
});

const detailStatus = computed(() => {
  if (formData.value.status === 20) {
    return { className: 'is-success', label: '已审核' };
  }
  if (formData.value.status === 10) {
    return { className: 'is-warning', label: '未审核' };
  }
  return { className: 'is-muted', label: '未知状态' };
});

const hasEffectiveExpressFile = computed(
  () => formData.value.hasExpressFile ?? Boolean(formData.value.expressFileUrl),
);

const showUploadExpressBtn = computed(() => {
  return (
    !detailLoading.value &&
    !expressFileLoading.value &&
    !expressFileLoadError.value &&
    !!formData.value.id &&
    !hasEffectiveExpressFile.value &&
    expressFilePageState.value.total === 0 &&
    !isHidden('expressFileUrl') &&
    hasAccessByCodes(['erp:sale-out:upload-express'])
  );
});
const canEditRemark = computed(
  () =>
    !detailLoading.value &&
    !!formData.value.id &&
    hasAccessByCodes(['erp:sale-out:update']),
);
const canViewFinanceReceiptItems = computed(() =>
  hasAccessByCodes(['erp:finance-receipt:query']),
);

function handleEditRemark() {
  if (!formData.value.id) return;
  remarkModalApi
    .setData({
      documentName: '销售出库',
      documentType: 'sale-out',
      id: formData.value.id,
      no: formData.value.no,
      remark: formData.value.remark,
    })
    .open();
}

function handleRemarkSuccess(remark: string) {
  formData.value.remark = remark;
  emit('success');
}

type DetailFieldKind = 'customer' | 'images' | 'source' | 'text';

interface DetailField {
  fieldKey: string;
  kind?: DetailFieldKind;
  label: string;
  link?: string;
  value: string;
}

const detailFields = computed<DetailField[]>(() => {
  const fields: DetailField[] = [
    {
      fieldKey: 'no',
      label: '销售单号',
      value: formatDetailText(formData.value.no),
    },
    {
      fieldKey: 'outTime',
      label: '日期',
      value: formatDetailDate(formData.value.outTime),
    },
    {
      fieldKey: 'customerName',
      kind: 'customer',
      label: '客户名称',
      value: formatDetailText(formData.value.customerName),
    },
    {
      fieldKey: 'customerCode',
      label: '客户编码',
      value: formatDetailText(formData.value.customerCode),
    },
    {
      fieldKey: 'settleStatus',
      label: '结算状态',
      value: settleStatusText.value,
    },
    { fieldKey: 'status', label: '状态', value: statusText.value },
    {
      fieldKey: 'deliveryMethod',
      label: '送货方式',
      value: formatDetailText(formData.value.deliveryMethod),
    },
    {
      fieldKey: 'receiverName',
      label: '收货人',
      value: formatDetailText(formData.value.receiverName),
    },
    {
      fieldKey: 'receiverPhone',
      label: '收货人电话',
      value: formatDetailText(formData.value.receiverPhone),
    },
    {
      fieldKey: 'logisticsCompany',
      label: '物流公司',
      value: formatDetailText(formData.value.logisticsCompany),
    },
    {
      fieldKey: 'shipper',
      label: '发货方',
      value: formatDetailText(formData.value.shipper),
    },
    {
      fieldKey: 'senderName',
      label: '发货人',
      value: formatDetailText(formData.value.senderName),
    },
    {
      fieldKey: 'vin',
      label: 'VIN',
      value: formatDetailText(formData.value.vin),
    },
    {
      fieldKey: 'settleMethod',
      label: '结算方式',
      value: formatDetailText(formData.value.settleMethod),
    },
    {
      fieldKey: 'freightType',
      label: '运费类型',
      value: formatDetailText(formData.value.freightType),
    },
    {
      fieldKey: 'freight',
      label: '运费',
      value: formatDetailAmount(formData.value.freight),
    },
    {
      fieldKey: 'billType',
      label: '票据类型',
      value: formatDetailText(formData.value.billType),
    },
    {
      fieldKey: 'billNo',
      label: '票据号',
      value: formatDetailText(formData.value.billNo),
    },
    {
      fieldKey: 'totalProductPrice',
      label: '开单金额',
      value: formatDetailAmount(formData.value.totalProductPrice),
    },
    {
      fieldKey: 'reductionAmount',
      label: '减收金额',
      value: formatDetailAmount(
        formData.value.reductionAmount ?? formData.value.discountPrice,
      ),
    },
    {
      fieldKey: 'afterReductionAmount',
      label: '减后金额',
      value: formatDetailAmount(
        formData.value.afterReductionAmount ?? formData.value.totalPrice,
      ),
    },
    {
      fieldKey: 'billAmount',
      label: '票据金额',
      value: formatDetailAmount(formData.value.billAmount),
    },
    {
      fieldKey: 'totalCount',
      label: '数量',
      value: formatDetailCount(formData.value.totalCount),
    },
    {
      fieldKey: 'cancelCount',
      label: '取消数量',
      value: formatDetailCount(formData.value.cancelCount),
    },
    {
      fieldKey: 'cancelAmount',
      label: '取消金额',
      value: formatDetailAmount(formData.value.cancelAmount),
    },
    {
      fieldKey: 'afterCancelAmount',
      label: '取消后金额',
      value: formatDetailAmount(formData.value.afterCancelAmount),
    },
    {
      fieldKey: 'feeAmount',
      label: '额外费用',
      value: formatDetailAmount(
        formData.value.feeAmount ??
          formData.value.extraFee ??
          formData.value.otherPrice,
      ),
    },
    {
      fieldKey: 'totalWeight',
      label: '总重',
      value: formatDetailCount(formData.value.totalWeight),
    },
    {
      fieldKey: 'printCount',
      label: '打印次数',
      value: formatDetailCount(formData.value.printCount),
    },
    {
      fieldKey: 'sourceNo',
      kind: 'source',
      label: '来源单号',
      value: formatDetailText(formData.value.sourceNo),
    },
    {
      fieldKey: 'sourceCreateTime',
      label: '来源单制单日期',
      value: formatDetailDate(formData.value.sourceCreateTime),
    },
    {
      fieldKey: 'sourceCreatorName',
      label: '来源单制单人',
      value: formatDetailText(formData.value.sourceCreatorName),
    },
    {
      fieldKey: 'remark',
      label: '备注',
      value: formatDetailText(formData.value.remark),
    },
    {
      fieldKey: 'expressFileUrl',
      kind: 'images',
      label: '快递单',
      value:
        expressFilePageState.value.total > 0
          ? `共 ${expressFilePageState.value.total} 张`
          : '-',
    },
  ];
  return fields.filter((field) => !isHidden(field.fieldKey));
});

const detailItemCount = computed(() => itemPageState.value.total);
const canPrintFromDetail = computed(
  () =>
    !!formData.value.id &&
    !detailLoading.value &&
    !detailLoadError.value &&
    hasAccessByCodes(['erp:sale-out:print']),
);
const printSortTitle = computed(() =>
  getItemPrintSortTitle(
    itemPageState.value.orderField,
    itemPageState.value.orderDirection,
  ),
);
const fulfillmentSummaryItems = computed(() => [
  {
    label: '拣货状态',
    tone: getPickStatusTone(formData.value.pickStatus),
    value: getPickStatusText(formData.value.pickStatus),
  },
  {
    label: '拣货进度',
    value: formatDetailText(formData.value.pickProgress),
  },
  {
    label: '最近拣货时间',
    value: formatDetailDate(formData.value.latestPickTime),
  },
  {
    label: '拣货完成时间',
    value: formatDetailDate(formData.value.pickCompleteTime),
  },
  {
    label: '送货状态',
    tone: getDeliveryStatusTone(formData.value.deliveryStatus),
    value: getDeliveryStatusText(formData.value.deliveryStatus),
  },
  {
    label: '送货进度',
    value: formatDetailText(formData.value.deliveryProgress),
  },
  {
    label: '最近送货时间',
    value: formatDetailDate(formData.value.latestDeliveryTime),
  },
  {
    label: '送货完成时间',
    value: formatDetailDate(formData.value.deliveryCompleteTime),
  },
]);
const fulfillmentTotalCount = computed(() =>
  formatDetailCount(formData.value.pickDeliveryTotalItemCount),
);
const fulfillmentPickedCount = computed(() =>
  formatDetailCount(formData.value.pickedItemCount),
);
const fulfillmentDeliveredCount = computed(() =>
  formatDetailCount(formData.value.deliveredItemCount),
);
const fulfillmentUndeliveredCount = computed(() =>
  formatDetailCount(
    toNumber(formData.value.pickDeliveryTotalItemCount) -
      toNumber(formData.value.deliveredItemCount),
  ),
);
const fulfillmentDocumentRows = computed(() => {
  const rows: Array<{
    document: string;
    handler: string;
    latestTime: string;
    location: string;
    no: string;
    status: string;
    tone?: string;
    type: string;
  }> = [];
  const pickSubmitUser =
    fulfillmentDetail.value?.submits?.find((submit) => submit.type === 10)
      ?.submitUserName || '-';
  const deliverySubmitUser =
    fulfillmentDetail.value?.submits?.find((submit) => submit.type === 20)
      ?.submitUserName || '-';
  rows.push({
    document: formData.value.no || '-',
    handler:
      [formData.value.saleUserName, formData.value.creatorName]
        .filter(Boolean)
        .join(' / ') || '-',
    latestTime: formatDetailDate(
      formData.value.latestDeliveryTime || formData.value.latestPickTime,
    ),
    location: formData.value.deptName || '-',
    no: formData.value.no || '-',
    status: statusText.value,
    tone: detailStatus.value.className === 'is-success' ? 'success' : 'warning',
    type: '销售单',
  });
  for (const task of fulfillmentDetail.value?.pickTasks ?? []) {
    rows.push({
      document: task.id ? `拣货任务 #${task.id}` : '-',
      handler: pickSubmitUser,
      latestTime: formatDetailDate(task.latestPickTime || task.completeTime),
      location: task.warehouseName || '-',
      no: task.id ? String(task.id) : '-',
      status: getPickStatusText(task.status),
      tone: getPickStatusTone(task.status),
      type: '拣货任务',
    });
  }
  const deliveryOrder = fulfillmentDetail.value?.deliveryOrder;
  if (deliveryOrder?.id) {
    rows.push({
      document: `送货单 #${deliveryOrder.id}`,
      handler: deliverySubmitUser,
      latestTime: formatDetailDate(
        deliveryOrder.latestDeliveryTime || deliveryOrder.deliveryCompleteTime,
      ),
      location: formData.value.deptName || '-',
      no: String(deliveryOrder.id),
      status: getDeliveryStatusText(deliveryOrder.deliveryStatus),
      tone: getDeliveryStatusTone(deliveryOrder.deliveryStatus),
      type: '送货单',
    });
  }
  return rows;
});
const fulfillmentSubmitRows = computed(
  () => fulfillmentDetail.value?.submits ?? [],
);
const hasLegacyPickOperation = computed(() =>
  fulfillmentSubmitRows.value.some(
    (submit) => submit.type === 10 && submit.quantityDetails !== true,
  ),
);
const hasLegacyDeliveryOperation = computed(() =>
  fulfillmentSubmitRows.value.some(
    (submit) => submit.type === 20 && submit.quantityDetails !== true,
  ),
);
const fulfillmentFileTotalText = computed(
  () => fulfillmentFilePageState.value.total,
);

function isHidden(fieldKey: string) {
  return (
    DETAIL_SUPPRESSED_FIELD_KEYS.has(fieldKey) ||
    isFieldHidden(hiddenFields.value, fieldKey)
  );
}

function formatDetailText(value: unknown) {
  if (value === undefined || value === null || value === '') return '-';
  return String(value);
}

function formatDetailDate(value?: Date | number | string) {
  return value ? formatDateTime(value) || '-' : '-';
}

function formatDetailAmount(value?: number) {
  return `¥${formatSaleAmount(value || 0, '0.00')}`;
}

function isDetailPriceFieldHidden(fieldKey: string) {
  void fieldKey;
  return false;
}

function formatDetailPriceAmount(fieldKey: string, value?: number) {
  return isDetailPriceFieldHidden(fieldKey)
    ? '****'
    : formatDetailAmount(value);
}

function formatDetailCount(value?: number | string) {
  return formatSaleDecimal(Number(value || 0)) || '0';
}

function getRowValue(row: any, field: string) {
  return row?.[field];
}

function formatItemPrice(value: unknown) {
  if (value === '****') return value;
  if (value === null || value === undefined || value === '') return '-';
  return formatSaleAmount(value, '-');
}

function isCrossDeptSale(row: ErpSaleOutApi.SaleOutItem) {
  return row.crossDept === true;
}

function hasAdjustedProductPrice(row: any) {
  return (
    getRowValue(row, 'originalProductPrice') !== undefined &&
    getRowValue(row, 'originalProductPrice') !== null &&
    getRowValue(row, 'originalProductPrice') !==
      getRowValue(row, 'productPrice')
  );
}

function toNumber(value: unknown) {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function formatSummaryNumber(value: number | string) {
  return formatDetailCount(value);
}

function getPickStatusText(status?: number) {
  if (status === 30) return '已拣货';
  if (status === 20) return '部分拣货';
  if (status === 10) return '待拣货';
  return '未生成';
}

function getDeliveryStatusText(status?: number) {
  if (status === 30) return '已送货';
  if (status === 20) return '部分送货';
  if (status === 10) return '待送货';
  if (status === 5) return '待拣货';
  return '未生成';
}

function getPickStatusTone(status?: number) {
  if (status === 30) return 'success';
  if (status === 20) return 'processing';
  if (status === 10) return 'warning';
  return 'default';
}

function getDeliveryStatusTone(status?: number) {
  if (status === 30) return 'success';
  if (status === 20) return 'processing';
  if (status === 10 || status === 5) return 'warning';
  return 'default';
}

function getSubmitTypeText(type?: number) {
  if (type === 10) return '拣货提交';
  if (type === 20) return '送货提交';
  return '提交记录';
}

function getSubmitTypeTone(type?: number) {
  if (type === 10) return 'processing';
  if (type === 20) return 'success';
  return 'default';
}

function resolveFulfillmentFileUrl(source?: string) {
  return resolveSaleOutExpressFileUrl(source || '', apiURL);
}

function resetFulfillmentState() {
  fulfillmentLoadSequence += 1;
  fulfillmentDetail.value = null;
  fulfillmentItems.value = [];
  fulfillmentFiles.value = [];
  fulfillmentPickOperationItems.value = [];
  fulfillmentDeliveryOperationItems.value = [];
  fulfillmentLoadedOutId.value = undefined;
  fulfillmentLoading.value = false;
  fulfillmentLoadError.value = '';
  fulfillmentItemLoading.value = false;
  fulfillmentFileLoading.value = false;
  fulfillmentPickOperationLoading.value = false;
  fulfillmentDeliveryOperationLoading.value = false;
  fulfillmentPickOperationError.value = '';
  fulfillmentDeliveryOperationError.value = '';
  fulfillmentItemPageState.value = {
    pageNo: 1,
    pageSize: 20,
    total: 0,
  };
  fulfillmentFilePageState.value = {
    pageNo: 1,
    pageSize: 6,
    total: 0,
  };
  fulfillmentPickOperationPageState.value = {
    pageNo: 1,
    pageSize: 20,
    total: 0,
  };
  fulfillmentDeliveryOperationPageState.value = {
    pageNo: 1,
    pageSize: 20,
    total: 0,
  };
}

function resetExpressFileState() {
  expressFiles.value = [];
  expressFileLoading.value = false;
  expressFileLoadError.value = '';
  expressFilePageState.value = {
    pageNo: 1,
    pageSize: 6,
    total: 0,
  };
}

async function loadExpressFilePage(
  params: Partial<typeof expressFilePageState.value> = {},
  sequence = detailLoadSequence,
) {
  if (!formData.value.id || isHidden('expressFileUrl')) return;
  const nextState = {
    ...expressFilePageState.value,
    ...params,
  };
  expressFileLoading.value = true;
  expressFileLoadError.value = '';
  try {
    const page = await getSaleOutExpressFilePage({
      outId: formData.value.id,
      pageNo: nextState.pageNo,
      pageSize: nextState.pageSize,
    });
    if (sequence !== detailLoadSequence) return;
    expressFiles.value = page.list ?? [];
    expressFilePageState.value = {
      pageNo: nextState.pageNo,
      pageSize: nextState.pageSize,
      total: page.total ?? 0,
    };
  } catch (error) {
    if (sequence === detailLoadSequence) {
      expressFileLoadError.value = getErpDetailLoadError(
        error,
        '快递单加载失败，请稍后重试',
      );
    }
  } finally {
    if (sequence === detailLoadSequence) {
      expressFileLoading.value = false;
    }
  }
}

async function handleExpressFilePageChange(pageNo: number, pageSize: number) {
  await loadExpressFilePage({ pageNo, pageSize });
}

async function loadFulfillmentItemPage(
  params: Partial<typeof fulfillmentItemPageState.value> = {},
  sequence = fulfillmentLoadSequence,
) {
  if (!formData.value.id) return;
  const nextState = {
    ...fulfillmentItemPageState.value,
    ...params,
  };
  fulfillmentItemLoading.value = true;
  try {
    const page = await getSaleOutPickDeliveryItemPage({
      outId: formData.value.id,
      pageNo: nextState.pageNo,
      pageSize: nextState.pageSize,
    });
    if (sequence !== fulfillmentLoadSequence) return;
    fulfillmentItems.value = page.list ?? [];
    fulfillmentItemPageState.value = {
      pageNo: nextState.pageNo,
      pageSize: nextState.pageSize,
      total: page.total ?? 0,
    };
  } finally {
    if (sequence === fulfillmentLoadSequence) {
      fulfillmentItemLoading.value = false;
    }
  }
}

async function loadFulfillmentFilePage(
  params: Partial<typeof fulfillmentFilePageState.value> = {},
  sequence = fulfillmentLoadSequence,
) {
  if (!formData.value.id) return;
  const nextState = {
    ...fulfillmentFilePageState.value,
    ...params,
  };
  fulfillmentFileLoading.value = true;
  try {
    const page = await getSaleOutPickDeliveryFilePage({
      outId: formData.value.id,
      pageNo: nextState.pageNo,
      pageSize: nextState.pageSize,
    });
    if (sequence !== fulfillmentLoadSequence) return;
    fulfillmentFiles.value = page.list ?? [];
    fulfillmentFilePageState.value = {
      pageNo: nextState.pageNo,
      pageSize: nextState.pageSize,
      total: page.total ?? 0,
    };
  } finally {
    if (sequence === fulfillmentLoadSequence) {
      fulfillmentFileLoading.value = false;
    }
  }
}

async function loadFulfillmentPickOperationPage(
  params: Partial<typeof fulfillmentPickOperationPageState.value> = {},
  sequence = fulfillmentLoadSequence,
) {
  if (!formData.value.id) return;
  const nextState = {
    ...fulfillmentPickOperationPageState.value,
    ...params,
  };
  fulfillmentPickOperationLoading.value = true;
  fulfillmentPickOperationError.value = '';
  try {
    const page = await getSaleOutPickDeliveryOperationItemPage({
      outId: formData.value.id,
      pageNo: nextState.pageNo,
      pageSize: nextState.pageSize,
      type: 10,
    });
    if (sequence !== fulfillmentLoadSequence) return;
    fulfillmentPickOperationItems.value = page.list ?? [];
    fulfillmentPickOperationPageState.value = {
      pageNo: nextState.pageNo,
      pageSize: nextState.pageSize,
      total: page.total ?? 0,
    };
  } catch (error) {
    if (sequence === fulfillmentLoadSequence) {
      fulfillmentPickOperationError.value = getErpDetailLoadError(
        error,
        '拣货人员明细加载失败，请稍后重试',
      );
    }
  } finally {
    if (sequence === fulfillmentLoadSequence) {
      fulfillmentPickOperationLoading.value = false;
    }
  }
}

async function loadFulfillmentDeliveryOperationPage(
  params: Partial<typeof fulfillmentDeliveryOperationPageState.value> = {},
  sequence = fulfillmentLoadSequence,
) {
  if (!formData.value.id) return;
  const nextState = {
    ...fulfillmentDeliveryOperationPageState.value,
    ...params,
  };
  fulfillmentDeliveryOperationLoading.value = true;
  fulfillmentDeliveryOperationError.value = '';
  try {
    const page = await getSaleOutPickDeliveryOperationItemPage({
      outId: formData.value.id,
      pageNo: nextState.pageNo,
      pageSize: nextState.pageSize,
      type: 20,
    });
    if (sequence !== fulfillmentLoadSequence) return;
    fulfillmentDeliveryOperationItems.value = page.list ?? [];
    fulfillmentDeliveryOperationPageState.value = {
      pageNo: nextState.pageNo,
      pageSize: nextState.pageSize,
      total: page.total ?? 0,
    };
  } catch (error) {
    if (sequence === fulfillmentLoadSequence) {
      fulfillmentDeliveryOperationError.value = getErpDetailLoadError(
        error,
        '送货人员明细加载失败，请稍后重试',
      );
    }
  } finally {
    if (sequence === fulfillmentLoadSequence) {
      fulfillmentDeliveryOperationLoading.value = false;
    }
  }
}

async function ensureFulfillmentLoaded(force = false) {
  if (!formData.value.id) return;
  if (
    !force &&
    fulfillmentLoadedOutId.value === formData.value.id &&
    fulfillmentDetail.value
  ) {
    return;
  }
  const sequence = ++fulfillmentLoadSequence;
  fulfillmentLoading.value = true;
  fulfillmentLoadError.value = '';
  fulfillmentDetail.value = null;
  fulfillmentItems.value = [];
  fulfillmentFiles.value = [];
  fulfillmentPickOperationItems.value = [];
  fulfillmentDeliveryOperationItems.value = [];
  fulfillmentPickOperationError.value = '';
  fulfillmentDeliveryOperationError.value = '';
  try {
    fulfillmentDetail.value = await getSaleOutPickDeliveryDetail(
      formData.value.id,
    );
    if (sequence !== fulfillmentLoadSequence) return;
    fulfillmentLoadedOutId.value = formData.value.id;
    await Promise.all([
      loadFulfillmentItemPage({ pageNo: 1 }, sequence),
      loadFulfillmentFilePage({ pageNo: 1 }, sequence),
      loadFulfillmentPickOperationPage({ pageNo: 1 }, sequence),
      loadFulfillmentDeliveryOperationPage({ pageNo: 1 }, sequence),
    ]);
  } catch (error) {
    if (sequence === fulfillmentLoadSequence) {
      fulfillmentLoadError.value = getErpDetailLoadError(
        error,
        '拣货送货信息加载失败，请稍后重试',
      );
    }
  } finally {
    if (sequence === fulfillmentLoadSequence) {
      fulfillmentLoading.value = false;
    }
  }
}

async function handleFulfillmentItemPageChange(
  pageNo: number,
  pageSize: number,
) {
  await loadFulfillmentItemPage({ pageNo, pageSize });
}

async function handleFulfillmentFilePageChange(
  pageNo: number,
  pageSize: number,
) {
  await loadFulfillmentFilePage({ pageNo, pageSize });
}

async function handleFulfillmentPickOperationPageChange(
  pageNo: number,
  pageSize: number,
) {
  await loadFulfillmentPickOperationPage({ pageNo, pageSize });
}

async function handleFulfillmentDeliveryOperationPageChange(
  pageNo: number,
  pageSize: number,
) {
  await loadFulfillmentDeliveryOperationPage({ pageNo, pageSize });
}

function getStockOutBillStatusText(data?: ErpSaleOutApi.SaleOut) {
  const bills = data?.stockOutBills ?? [];
  return stockOutBillHistorySummary(bills.map((bill) => bill.status));
}

function getStockOutBillStatusColor(status?: number) {
  if (status === 30) return 'green';
  if (status === 20) return 'blue';
  if (status === 10) return 'orange';
  return 'default';
}

function getStockOutSummaryColor(data?: ErpSaleOutApi.SaleOut) {
  const text = getStockOutBillStatusText(data);
  if (text === stockOutBillHistoryStatus(30)) return 'green';
  if (text === stockOutBillHistoryStatus(20)) return 'blue';
  if (text === stockOutBillHistoryStatus(10)) return 'orange';
  return 'default';
}

function getStockOutBillNos(data?: ErpSaleOutApi.SaleOut) {
  return (data?.stockOutBills ?? [])
    .map((bill) => bill.no)
    .filter(Boolean)
    .join(', ');
}

function sumStockOutBill(
  data: ErpSaleOutApi.SaleOut | undefined,
  field: 'pickedCount' | 'totalCount',
) {
  return (data?.stockOutBills ?? []).reduce(
    (sum, bill) => sum + toNumber(bill[field]),
    0,
  );
}

async function reloadStockOutItemGrid() {
  await nextTick();
  const rows = formData.value.items ?? [];
  const columns = buildCustomizedStockOutDetailItemColumns(rows);
  stockOutItemGridApi.setGridOptions({
    columns,
    data: rows,
  });
  const mountedStockOutItemGrid = stockOutItemGridApi.grid;
  if (
    typeof mountedStockOutItemGrid?.loadData === 'function' &&
    typeof mountedStockOutItemGrid?.reloadColumn === 'function'
  ) {
    await mountedStockOutItemGrid.loadData(rows);
    await mountedStockOutItemGrid.reloadColumn(columns);
  }
}

function resetItemPageState() {
  itemPageState.value = {
    orderDirection: undefined,
    orderField: undefined,
    pageNo: 1,
    pageSize: DEFAULT_ITEM_PAGE_SIZE,
    total: 0,
  };
}

async function loadSaleOutItemPage(
  options: {
    orderDirection?: 'asc' | 'desc';
    orderField?: string;
    pageNo?: number;
    pageSize?: number;
  } = {},
  syncMountedGrid = true,
) {
  if (!formData.value.id) {
    formData.value.items = [];
    return;
  }
  itemPageLoading.value = true;
  try {
    const nextState = {
      ...itemPageState.value,
      ...options,
      pageNo: options.pageNo ?? itemPageState.value.pageNo,
      pageSize: options.pageSize ?? itemPageState.value.pageSize,
    };
    const result = await getSaleOutItemPage({
      mask: true,
      orderDirection: nextState.orderDirection,
      orderField: nextState.orderField,
      outId: formData.value.id,
      pageNo: nextState.pageNo,
      pageSize: nextState.pageSize,
    });
    itemPageState.value = {
      ...nextState,
      total: result.total ?? 0,
    };
    const items = result.list ?? [];
    if (!items.some((item) => item.id === activeItemId.value)) {
      activeItemId.value = undefined;
    }
    const itemColumns = buildCustomizedDetailItemColumns(items);
    const stockOutItemColumns = buildCustomizedStockOutDetailItemColumns(items);
    formData.value.items = items;
    itemGridApi.setGridOptions({
      columns: itemColumns,
      data: items,
      loading: itemPageLoading.value,
    });
    stockOutItemGridApi.setGridOptions({
      columns: stockOutItemColumns,
      data: items,
      loading: itemPageLoading.value,
    });
    const mountedItemGrid = itemGridApi.grid;
    if (
      syncMountedGrid &&
      typeof mountedItemGrid.loadData === 'function' &&
      typeof mountedItemGrid.reloadColumn === 'function'
    ) {
      await mountedItemGrid.loadData(items);
      await mountedItemGrid.reloadColumn(itemColumns);
      if (
        itemPageState.value.orderField &&
        itemPageState.value.orderDirection &&
        typeof mountedItemGrid.setSort === 'function'
      ) {
        await mountedItemGrid.setSort({
          field: itemPageState.value.orderField,
          order: itemPageState.value.orderDirection,
        });
      }
    }
    const mountedStockOutItemGrid = stockOutItemGridApi.grid;
    if (
      syncMountedGrid &&
      typeof mountedStockOutItemGrid?.loadData === 'function' &&
      typeof mountedStockOutItemGrid?.reloadColumn === 'function'
    ) {
      await mountedStockOutItemGrid.loadData(items);
      await mountedStockOutItemGrid.reloadColumn(stockOutItemColumns);
    }
  } finally {
    itemPageLoading.value = false;
    itemGridApi.setGridOptions({ loading: false });
    stockOutItemGridApi.setGridOptions({ loading: false });
  }
}

async function refreshSaleOutItemGrids() {
  await loadSaleOutItemPage({
    orderDirection: itemPageState.value.orderDirection,
    orderField: itemPageState.value.orderField,
    pageNo: itemPageState.value.pageNo,
    pageSize: itemPageState.value.pageSize,
  });
}

async function handleItemSortChange({ field, order }: any) {
  const active = field && (order === 'asc' || order === 'desc');
  await loadSaleOutItemPage({
    orderDirection: active ? order : undefined,
    orderField: active ? field : undefined,
    pageNo: 1,
  });
}

function handleDetailPrint() {
  emit('print', {
    itemOrderDirection: itemPageState.value.orderDirection,
    itemOrderField: itemPageState.value.orderField,
    row: formData.value,
  });
}

async function handleItemPageChange(pageNo: number, pageSize: number) {
  await loadSaleOutItemPage({ pageNo, pageSize });
}

async function handleDetailTabChange(key: number | string) {
  if (key !== DETAIL_TAB_KEY) {
    priceReferenceOpen.value = false;
  }
  if (key === FULFILLMENT_TAB_KEY) {
    await ensureFulfillmentLoaded();
  }
  if (key === 'stockOut') {
    await reloadStockOutItemGrid();
  }
}

function getActiveItemRow() {
  return (formData.value.items ?? []).find(
    (item) => item.id === activeItemId.value && item.productId,
  );
}

function buildShortcutStockRow(
  row: ErpSaleOutApi.SaleOutItem,
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
  if (!row) return;
  await productSelectRef.value?.openShortcutHistory?.(
    mode,
    buildShortcutStockRow(row),
  );
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

function openProductEdit() {
  const row = getActiveItemRow();
  if (!row?.productId) return;
  if (!canEditProduct.value) {
    message.warning('没有配件修改权限');
    return;
  }
  if (
    formData.value.deptId &&
    row.warehouseDeptId &&
    formData.value.deptId !== row.warehouseDeptId
  ) {
    message.warning('该商品不属于当前单据部门，不能修改');
    return;
  }
  productFormModalApi.setData({ type: 'edit', id: row.productId }).open();
}

async function handleProductFormSuccess() {
  await refreshSaleOutItemGrids();
}

function isQuoteOrderHistoryShiftKey(event: KeyboardEvent) {
  return (
    event.key === 'Shift' ||
    event.code === 'ShiftLeft' ||
    event.code === 'ShiftRight'
  );
}

function handleShortcut(event: KeyboardEvent) {
  if (
    !isSaleShortcutOwnerActive(shortcutScopeRef.value) ||
    activeTab.value !== DETAIL_TAB_KEY ||
    !formData.value.id
  ) {
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
  if (!getActiveItemRow()) return;
  if (isPriceReferenceShortcut(event)) {
    if (shouldIgnorePriceReferenceShortcut(event) || isShortcutDialogOpen()) {
      return;
    }
    event.preventDefault();
    priceReferenceOpen.value = !priceReferenceOpen.value;
    return;
  }
  if (isEditableEnterTarget(event.target) || isShortcutDialogOpen()) return;
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
  if (key === 'f' && canEditProduct.value) {
    event.preventDefault();
    openProductEdit();
  }
}

function handleShortcutKeyup(event: KeyboardEvent) {
  if (
    !isSaleShortcutOwnerActive(shortcutScopeRef.value) ||
    activeTab.value !== DETAIL_TAB_KEY ||
    !formData.value.id ||
    !pendingQuoteOrderHistoryShift
  ) {
    pendingQuoteOrderHistoryShift = false;
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
    isShortcutDialogOpen() ||
    !getActiveItemRow()
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

async function handlePriceAdjust() {
  if (!formData.value.id) return;
  await ensureModalReady(
    shouldRenderSalePriceAdjust,
    salePriceAdjustModalApi,
    loadSalePriceAdjustForm,
  );
  salePriceAdjustModalApi
    .setData({
      type: 'create',
      sourceSaleOut: formData.value,
    })
    .open();
}

async function handleReturn() {
  if (!formData.value.id) return;
  await ensureModalReady(
    shouldRenderSaleReturn,
    saleReturnModalApi,
    loadSaleReturnForm,
  );
  saleReturnModalApi
    .setData({
      fillReturnableItems: true,
      type: 'create',
      sourceSaleOut: formData.value,
    })
    .open();
}

function handleOpenPartialReturn() {
  if (!formData.value.id) return;
  returnableItemSelectRef.value?.open(formData.value);
}

async function handleSelectPartialReturnableItems(
  rows: SelectedReturnableRows,
  sourceSaleOut: ErpSaleOutApi.SaleOut,
) {
  await ensureModalReady(
    shouldRenderSaleReturn,
    saleReturnModalApi,
    loadSaleReturnForm,
  );
  saleReturnModalApi
    .setData({
      type: 'create',
      sourceSaleOut,
      selectedReturnableRows: rows,
    })
    .open();
}

function handleUploadExpress() {
  if (!formData.value.id) return;
  expressUploadModalApi.setData(formData.value).open();
}

async function loadCustomerPriceLevel(customerId?: number) {
  if (!customerId) {
    currentCustomerPriceLevel.value = undefined;
    return;
  }
  try {
    currentCustomerPriceLevel.value =
      await getCustomerSalePriceLevel(customerId);
  } catch {
    currentCustomerPriceLevel.value = undefined;
  }
}

async function loadSaleOutDetail(id: number, sequence?: number) {
  const activeSequence = sequence ?? detailLoadSequence;
  resetItemPageState();
  resetFulfillmentState();
  resetExpressFileState();
  const sourceData = await getSaleOut(id, { includeItems: false, mask: true });
  await loadCustomerPriceLevel(sourceData.customerId);
  await loadHiddenFields();
  if (sequence !== undefined && sequence !== detailLoadSequence) return;
  const items = sourceData.items ?? [];
  itemGridApi.setGridOptions({
    columns: buildCustomizedDetailItemColumns(items),
    data: items,
  });
  stockOutItemGridApi.setGridOptions({
    columns: buildCustomizedStockOutDetailItemColumns(items),
    data: items,
  });
  formData.value = sourceData;
  formData.value.items = items;
  // detailLoading 为 true 时明细表尚未挂载；先写入网格配置，待弹窗切换到成功态后由组件读取。
  await Promise.all([
    loadSaleOutItemPage({ pageNo: 1 }, false),
    loadExpressFilePage({ pageNo: 1 }, activeSequence),
  ]);
}

async function handleSourceActionSuccess() {
  if (!formData.value.id) return;
  const sequence = ++detailLoadSequence;
  detailLoading.value = true;
  detailLoadError.value = '';
  try {
    await loadSaleOutDetail(formData.value.id, sequence);
    if (activeTab.value === FULFILLMENT_TAB_KEY) {
      await ensureFulfillmentLoaded(true);
    }
  } catch (error) {
    if (sequence === detailLoadSequence) {
      detailLoadError.value = getErpDetailLoadError(
        error,
        reportViewOnly
          ? '单据已删除、不可用或无权访问，请关闭后重试'
          : '详情加载失败，请关闭后重试',
      );
    }
  } finally {
    if (sequence === detailLoadSequence) detailLoading.value = false;
  }
}

async function handleExpressUploadSuccess() {
  await handleSourceActionSuccess();
  emit('success');
}

async function loadDetailData(id: number, sequence: number) {
  try {
    await loadSaleOutDetail(id, sequence);
  } catch (error) {
    if (sequence === detailLoadSequence) {
      detailLoadError.value = getErpDetailLoadError(
        error,
        reportViewOnly
          ? '单据已删除、不可用或无权访问，请关闭后重试'
          : '详情加载失败，请关闭后重试',
      );
    }
  } finally {
    if (sequence === detailLoadSequence) detailLoading.value = false;
  }
}

const [Modal, modalApi] = useVbenModal({
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      stopShortcutListening();
      detailLoadSequence += 1;
      detailLoading.value = false;
      detailLoadError.value = '';
      formData.value = {};
      activeItemId.value = undefined;
      activeTab.value = DETAIL_TAB_KEY;
      priceReferenceOpen.value = false;
      receiptTabReloadKey.value += 1;
      itemGridApi.setGridOptions({ data: [] });
      stockOutItemGridApi.setGridOptions({ data: [] });
      resetFulfillmentState();
      resetExpressFileState();
      return;
    }
    startShortcutListening();
    modalApi.setState({ fullscreen: true });
    activeTab.value = DETAIL_TAB_KEY;
    receiptTabReloadKey.value += 1;
    const data = modalApi.getData<{ id: number }>();
    if (!data?.id) return;
    detailLoading.value = true;
    detailLoadError.value = '';
    formData.value = {};
    activeItemId.value = undefined;
    const sequence = ++detailLoadSequence;
    void loadDetailData(data.id, sequence);
  },
});

onBeforeUnmount(() => {
  stopShortcutListening();
});
</script>

<template>
  <Modal
    title="销售单详情"
    class="!w-full"
    bordered
    content-class="p-0"
    :show-confirm-button="false"
  >
    <template #title>
      <div class="sale-out-detail-title">
        <div class="sale-out-detail-title__text">
          <span>销售单详情</span>
          <small v-if="formData.no && !isHidden('no')">{{ formData.no }}</small>
        </div>
        <span
          v-if="formData.status !== undefined && !isHidden('status')"
          class="sale-out-status"
          :class="detailStatus.className"
        >
          {{ detailStatus.label }}
        </span>
      </div>
    </template>

    <div ref="shortcutScopeRef" class="sale-out-detail-view">
      <div v-if="detailLoading" class="sale-out-detail-load-state">
        正在加载完整明细，请稍候…
      </div>
      <div
        v-else-if="detailLoadError"
        class="sale-out-detail-load-state is-error"
      >
        {{ detailLoadError }}
      </div>

      <Tabs
        v-else-if="formData.id"
        v-model:active-key="activeTab"
        class="sale-out-detail-tabs"
        @change="handleDetailTabChange"
      >
        <TabPane :key="DETAIL_TAB_KEY" tab="销售明细">
          <div class="sale-out-detail-tab-content">
            <section class="sale-out-detail-section">
              <header class="sale-out-detail-section__header">
                <span class="sale-out-detail-section__title">基本信息</span>
              </header>
              <div class="sale-out-detail-grid">
                <div
                  v-for="field in detailFields"
                  :key="field.fieldKey"
                  class="sale-out-detail-field"
                  :class="{
                    'sale-out-detail-field--full-row':
                      field.fieldKey === 'expressFileUrl',
                  }"
                >
                  <span class="sale-out-detail-field__label">{{
                    field.label
                  }}</span>
                  <button
                    v-if="
                      field.kind === 'customer' &&
                      formData.customerId &&
                      formData.customerName
                    "
                    type="button"
                    class="sale-out-detail-field__value sale-out-detail-field__link"
                    :title="field.value"
                    @click="handleOpenCustomerDetail"
                  >
                    <span>{{ field.value }}</span>
                    <span aria-hidden="true">↗</span>
                  </button>
                  <button
                    v-else-if="
                      field.kind === 'source' &&
                      formData.sourceType === 10 &&
                      formData.sourceId
                    "
                    type="button"
                    class="sale-out-detail-field__value sale-out-detail-field__link"
                    :title="field.value"
                    @click="handleOpenSourceOrderDetail"
                  >
                    <span>{{ field.value }}</span>
                    <span aria-hidden="true">↗</span>
                  </button>
                  <div
                    v-else-if="field.kind === 'images'"
                    class="sale-out-express-gallery"
                  >
                    <div
                      v-if="expressFileLoading"
                      class="sale-out-express-gallery__state"
                    >
                      正在加载快递单…
                    </div>
                    <div
                      v-else-if="expressFileLoadError"
                      class="sale-out-express-gallery__state is-error"
                    >
                      {{ expressFileLoadError }}
                    </div>
                    <div
                      v-else-if="expressFiles.length > 0"
                      class="sale-out-express-gallery__list"
                    >
                      <div
                        v-for="file in expressFiles"
                        :key="`${file.sourceType}-${file.submitId || 0}-${file.id || file.fileUrl}`"
                        class="sale-out-express-gallery__item"
                      >
                        <AImage
                          :src="resolveFulfillmentFileUrl(file.fileUrl)"
                          :preview="true"
                          :width="72"
                          :height="72"
                        />
                        <div class="sale-out-express-gallery__meta">
                          <strong>{{ file.fileName || '快递单' }}</strong>
                          <span>{{ file.sourceName || '送货快递单' }}</span>
                          <span>{{ formatDetailDate(file.submitTime) }}</span>
                        </div>
                      </div>
                    </div>
                    <div v-else class="sale-out-express-gallery__state">
                      暂无快递单，可通过下方“补传快递单”补充历史单据。
                    </div>
                    <Pagination
                      v-if="expressFilePageState.total > 0"
                      class="sale-out-express-gallery__pager"
                      :current="expressFilePageState.pageNo"
                      :page-size="expressFilePageState.pageSize"
                      :page-size-options="FULFILLMENT_FILE_PAGE_SIZE_OPTIONS"
                      :show-size-changer="true"
                      :show-total="(total) => `共 ${total} 张快递单`"
                      :total="expressFilePageState.total"
                      size="small"
                      @change="handleExpressFilePageChange"
                      @show-size-change="handleExpressFilePageChange"
                    />
                  </div>
                  <span
                    v-else
                    class="sale-out-detail-field__value"
                    :title="field.value"
                  >
                    {{ field.value }}
                  </span>
                </div>
              </div>
            </section>

            <section class="sale-out-detail-section">
              <header class="sale-out-detail-section__header">
                <span class="sale-out-detail-section__title">销售产品清单</span>
                <div class="sale-out-detail-section__actions">
                  <span class="sale-out-detail-shortcut-hint">
                    <span class="sale-out-detail-shortcut-hint__label"
                      >点击明细行后</span
                    >
                    <span><kbd>Space</kbd><b>销售历史</b></span>
                    <span><kbd>Shift</kbd><b>报价订单历史</b></span>
                    <span v-if="canViewPurchaseOrderHistory">
                      <kbd>P</kbd><b>采购订单历史</b>
                    </span>
                    <span v-if="canViewPurchaseInHistory">
                      <kbd>I</kbd><b>采购入库记录</b>
                    </span>
                    <span v-if="canEditProduct">
                      <kbd>F</kbd><b>修改商品</b>
                    </span>
                    <span class="sale-out-detail-shortcut-hint__divider"></span>
                    <span>
                      <span class="sale-out-detail-shortcut-hint__label"
                        >当前页</span
                      >
                      <kbd>W</kbd><b>全部价格</b>
                    </span>
                  </span>
                  <span class="sale-out-detail-count">
                    {{ detailItemCount }} 项产品
                  </span>
                </div>
              </header>
              <div class="sale-out-detail-items">
                <div
                  ref="itemTableWrapRef"
                  class="sale-out-item-table-wrap relative"
                  tabindex="-1"
                  @click="
                    focusSaleShortcutOwner(itemTableWrapRef, $event.target)
                  "
                >
                  <ItemGrid>
                    <template #toolbar-tools>
                      <span aria-hidden="true"></span>
                    </template>
                    <template #count="{ row }">
                      <span>{{
                        formatDetailCount(getRowValue(row, 'count'))
                      }}</span>
                      <span
                        v-if="
                          getRowValue(row, 'returnedCount') &&
                          Number(getRowValue(row, 'returnedCount')) > 0
                        "
                        class="sale-out-returned-count"
                      >
                        退：{{
                          formatDetailCount(getRowValue(row, 'returnedCount'))
                        }}
                      </span>
                    </template>
                    <template #productPrice="{ row }">
                      <template v-if="hasAdjustedProductPrice(row)">
                        <span>
                          原：{{
                            formatItemPrice(
                              getRowValue(row, 'originalProductPrice'),
                            )
                          }}
                        </span>
                        <span class="text-red-500">
                          【调：{{
                            formatItemPrice(getRowValue(row, 'productPrice'))
                          }}】
                        </span>
                      </template>
                      <span v-else>{{
                        formatItemPrice(getRowValue(row, 'productPrice'))
                      }}</span>
                    </template>
                    <template #productName="{ row }">
                      <span>{{ getRowValue(row, 'productName') || '-' }}</span>
                    </template>
                    <template #giftFlag="{ row }">
                      <Checkbox
                        :checked="!!getRowValue(row, 'giftFlag')"
                        disabled
                      />
                    </template>
                    <template #warehouseName="{ row }">
                      <span>{{
                        getRowValue(row, 'warehouseName') ||
                        getRowValue(row, 'warehouseId') ||
                        '-'
                      }}</span>
                    </template>
                    <template #sourceWarehouseName="{ row }">
                      <div
                        v-if="isCrossDeptSale(row)"
                        class="flex flex-wrap items-center gap-1"
                        :title="getRowValue(row, 'sourceDeptName') || undefined"
                      >
                        <span>{{
                          getRowValue(row, 'sourceWarehouseName') ||
                          getRowValue(row, 'sourceWarehouseId') ||
                          '-'
                        }}</span>
                        <Tag color="orange" class="m-0">跨部门</Tag>
                      </div>
                      <span v-else>{{
                        getRowValue(row, 'sourceWarehouseName') ||
                        getRowValue(row, 'sourceWarehouseId') ||
                        '-'
                      }}</span>
                    </template>
                  </ItemGrid>
                  <ItemPriceReferenceOverlay
                    :hidden-fields="priceReferenceHiddenFields"
                    :open="priceReferenceOpen"
                    :rows="formData.items || []"
                    :table-header-height="ITEM_TABLE_HEADER_HEIGHT"
                    :table-row-height="ITEM_TABLE_ROW_HEIGHT"
                    :table-wrapper="itemTableWrapRef"
                    :visible-rows="ITEM_TABLE_VISIBLE_ROWS"
                  />
                </div>
                <div class="sale-out-item-pager">
                  <Pagination
                    :current="itemPageState.pageNo"
                    :page-size="itemPageState.pageSize"
                    :page-size-options="ITEM_PAGE_SIZE_OPTIONS"
                    :show-size-changer="true"
                    :show-quick-jumper="true"
                    :show-total="(total) => `共 ${total} 条明细`"
                    :total="itemPageState.total"
                    size="small"
                    @change="handleItemPageChange"
                    @show-size-change="handleItemPageChange"
                  />
                </div>
              </div>
              <div class="sale-out-document-summary">
                <strong>单据合计</strong>
                <span v-if="!isHidden('totalCount')">
                  数量 <b>{{ formatDetailCount(formData.totalCount) }}</b>
                </span>
                <span v-if="!isHidden('totalProductPrice')">
                  开单金额
                  <b>{{
                    formatDetailPriceAmount(
                      'totalProductPrice',
                      formData.totalProductPrice,
                    )
                  }}</b>
                </span>
                <span v-if="!isHidden('reductionAmount')">
                  减收金额
                  <b>{{
                    formatDetailPriceAmount(
                      'reductionAmount',
                      formData.reductionAmount ?? formData.discountPrice,
                    )
                  }}</b>
                </span>
                <span v-if="!isHidden('freight')">
                  运费 <b>{{ formatDetailAmount(formData.freight) }}</b>
                </span>
                <span v-if="!isHidden('feeAmount')">
                  额外费用
                  <b>{{
                    formatDetailAmount(
                      formData.feeAmount ??
                        formData.extraFee ??
                        formData.otherPrice,
                    )
                  }}</b>
                </span>
                <span
                  v-if="!isHidden('afterReductionAmount')"
                  class="sale-out-document-summary__paid"
                >
                  减后金额
                  <b>{{
                    formatDetailPriceAmount(
                      'afterReductionAmount',
                      formData.afterReductionAmount ?? formData.totalPrice,
                    )
                  }}</b>
                </span>
              </div>
            </section>

            <section class="sale-out-detail-section sale-out-detail-audit">
              <header class="sale-out-detail-section__header">
                <span class="sale-out-detail-section__title">审计信息</span>
              </header>
              <ErpAuditInfo title="" :record="formData" />
            </section>
          </div>
        </TabPane>

        <TabPane :key="FULFILLMENT_TAB_KEY" tab="拣货送货">
          <div class="sale-out-detail-tab-content">
            <div v-if="fulfillmentLoading" class="sale-out-detail-load-state">
              正在加载拣货送货信息，请稍候…
            </div>
            <div
              v-else-if="fulfillmentLoadError"
              class="sale-out-detail-load-state is-error"
            >
              {{ fulfillmentLoadError }}
            </div>
            <template v-else>
              <section class="sale-out-detail-section">
                <header class="sale-out-detail-section__header">
                  <span class="sale-out-detail-section__title">履约汇总</span>
                </header>
                <div class="sale-out-fulfillment-overview">
                  <div
                    v-for="item in fulfillmentSummaryItems"
                    :key="item.label"
                    class="sale-out-fulfillment-card"
                  >
                    <span>{{ item.label }}</span>
                    <Tag v-if="item.tone" class="m-0" :color="item.tone">
                      {{ item.value }}
                    </Tag>
                    <b v-else>{{ item.value }}</b>
                  </div>
                </div>
                <div class="sale-out-fulfillment-counts">
                  <span>
                    总明细 <b>{{ fulfillmentTotalCount }}</b>
                  </span>
                  <span>
                    已拣 <b>{{ fulfillmentPickedCount }}</b>
                  </span>
                  <span>
                    已送 <b>{{ fulfillmentDeliveredCount }}</b>
                  </span>
                  <span>
                    未送 <b>{{ fulfillmentUndeliveredCount }}</b>
                  </span>
                </div>
              </section>
              <section class="sale-out-detail-section">
                <header class="sale-out-detail-section__header">
                  <span class="sale-out-detail-section__title"
                    >单据链与人员</span
                  >
                </header>
                <div class="sale-out-fulfillment-table-wrap">
                  <table class="sale-out-fulfillment-table">
                    <thead>
                      <tr>
                        <th>单据类型</th>
                        <th>单据</th>
                        <th>状态</th>
                        <th>仓库/部门</th>
                        <th>相关人员</th>
                        <th>最近处理时间</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr
                        v-for="row in fulfillmentDocumentRows"
                        :key="`${row.type}-${row.no}`"
                      >
                        <td>{{ row.type }}</td>
                        <td>{{ row.document }}</td>
                        <td>
                          <Tag class="m-0" :color="row.tone">
                            {{ row.status }}
                          </Tag>
                        </td>
                        <td>{{ row.location }}</td>
                        <td>{{ row.handler }}</td>
                        <td>{{ row.latestTime }}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </section>
              <section class="sale-out-detail-section">
                <header class="sale-out-detail-section__header">
                  <span class="sale-out-detail-section__title">图片凭证</span>
                  <span class="sale-out-detail-count">
                    共 {{ fulfillmentFileTotalText }} 张
                  </span>
                </header>
                <div
                  v-if="fulfillmentFiles.length > 0 || fulfillmentFileLoading"
                  class="sale-out-fulfillment-files"
                >
                  <a
                    v-for="file in fulfillmentFiles"
                    :key="`${file.submitId}-${file.id}`"
                    class="sale-out-fulfillment-file"
                    :href="resolveFulfillmentFileUrl(file.fileUrl)"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <img
                      :src="resolveFulfillmentFileUrl(file.fileUrl)"
                      alt=""
                      class="sale-out-fulfillment-file__thumb"
                    />
                    <span class="sale-out-fulfillment-file__body">
                      <span class="sale-out-fulfillment-file__name">
                        {{ file.fileName || file.fileUrl || '-' }}
                      </span>
                      <span class="sale-out-fulfillment-file__meta">
                        {{ file.typeName || getSubmitTypeText(file.type) }} ·
                        {{ file.submitUserName || '-' }}
                      </span>
                      <span class="sale-out-fulfillment-file__meta">
                        {{ formatDetailDate(file.submitTime) }}
                      </span>
                    </span>
                  </a>
                  <div
                    v-if="fulfillmentFileLoading"
                    class="sale-out-fulfillment-loading"
                  >
                    正在加载图片…
                  </div>
                </div>
                <div v-else class="sale-out-fulfillment-empty">
                  暂无图片凭证
                </div>
                <div
                  v-if="fulfillmentFilePageState.total > 0"
                  class="sale-out-item-pager sale-out-fulfillment-pager"
                >
                  <Pagination
                    :current="fulfillmentFilePageState.pageNo"
                    :page-size="fulfillmentFilePageState.pageSize"
                    :page-size-options="FULFILLMENT_FILE_PAGE_SIZE_OPTIONS"
                    :show-size-changer="true"
                    :show-total="(total) => `提交凭证 ${total} 张`"
                    :total="fulfillmentFilePageState.total"
                    size="small"
                    @change="handleFulfillmentFilePageChange"
                    @show-size-change="handleFulfillmentFilePageChange"
                  />
                </div>
              </section>
              <section class="sale-out-detail-section">
                <header class="sale-out-detail-section__header">
                  <span class="sale-out-detail-section__title"
                    >配件累计履约明细</span
                  >
                  <span class="sale-out-detail-count">
                    共 {{ fulfillmentItemPageState.total }} 条
                  </span>
                </header>
                <div class="sale-out-fulfillment-table-wrap">
                  <table class="sale-out-fulfillment-table">
                    <thead>
                      <tr>
                        <th>序号</th>
                        <th>配件编码</th>
                        <th>配件名称</th>
                        <th>规格</th>
                        <th>仓库</th>
                        <th>数量</th>
                        <th>拣货状态</th>
                        <th>拣货人/时间</th>
                        <th>送货状态</th>
                        <th>送货人/时间</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-if="fulfillmentItemLoading">
                        <td colspan="10">正在加载明细…</td>
                      </tr>
                      <tr v-else-if="fulfillmentItems.length === 0">
                        <td colspan="10">暂无配件履约明细</td>
                      </tr>
                      <template v-else>
                        <tr
                          v-for="(row, index) in fulfillmentItems"
                          :key="row.id || index"
                        >
                          <td>
                            {{
                              (fulfillmentItemPageState.pageNo - 1) *
                                fulfillmentItemPageState.pageSize +
                              index +
                              1
                            }}
                          </td>
                          <td>{{ row.productCode || '-' }}</td>
                          <td>{{ row.productName || '-' }}</td>
                          <td>{{ row.standard || '-' }}</td>
                          <td>{{ row.warehouseName || '-' }}</td>
                          <td>{{ formatDetailCount(row.count) }}</td>
                          <td>
                            <Tag
                              class="m-0"
                              :color="getPickStatusTone(row.pickStatus)"
                            >
                              {{ getPickStatusText(row.pickStatus) }}
                            </Tag>
                          </td>
                          <td>
                            {{ row.pickUserName || '-' }} /
                            {{ formatDetailDate(row.pickTime) }}
                          </td>
                          <td>
                            <Tag
                              class="m-0"
                              :color="getDeliveryStatusTone(row.deliveryStatus)"
                            >
                              {{ getDeliveryStatusText(row.deliveryStatus) }}
                            </Tag>
                          </td>
                          <td>
                            {{ row.deliveryUserName || '-' }} /
                            {{ formatDetailDate(row.deliveryTime) }}
                          </td>
                        </tr>
                      </template>
                    </tbody>
                  </table>
                  <div
                    v-if="fulfillmentItemPageState.total > 0"
                    class="sale-out-item-pager sale-out-fulfillment-pager"
                  >
                    <Pagination
                      :current="fulfillmentItemPageState.pageNo"
                      :page-size="fulfillmentItemPageState.pageSize"
                      :page-size-options="FULFILLMENT_ITEM_PAGE_SIZE_OPTIONS"
                      :show-size-changer="true"
                      :show-total="(total) => `共 ${total} 条明细`"
                      :total="fulfillmentItemPageState.total"
                      size="small"
                      @change="handleFulfillmentItemPageChange"
                      @show-size-change="handleFulfillmentItemPageChange"
                    />
                  </div>
                </div>
              </section>
              <section class="sale-out-detail-section">
                <header class="sale-out-detail-section__header">
                  <span class="sale-out-detail-section__title"
                    >拣货人员明细</span
                  >
                  <span class="sale-out-detail-count">
                    共 {{ fulfillmentPickOperationPageState.total }} 条
                  </span>
                </header>
                <div
                  v-if="hasLegacyPickOperation"
                  class="sale-out-fulfillment-legacy-warning"
                >
                  历史拣货提交未记录逐配件数量，无法按人员准确拆分，请以累计履约明细和提交记录为准。
                </div>
                <div class="sale-out-fulfillment-table-wrap">
                  <table class="sale-out-fulfillment-table">
                    <thead>
                      <tr>
                        <th>序号</th>
                        <th>配件编码</th>
                        <th>配件名称</th>
                        <th>规格</th>
                        <th>仓库</th>
                        <th>本次拣货数量</th>
                        <th>拣货人</th>
                        <th>拣货时间</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-if="fulfillmentPickOperationLoading">
                        <td colspan="8">正在加载拣货人员明细…</td>
                      </tr>
                      <tr v-else-if="fulfillmentPickOperationError">
                        <td class="sale-out-fulfillment-error" colspan="8">
                          {{ fulfillmentPickOperationError }}
                        </td>
                      </tr>
                      <tr
                        v-else-if="fulfillmentPickOperationItems.length === 0"
                      >
                        <td colspan="8">暂无可准确拆分的拣货人员明细</td>
                      </tr>
                      <template v-else>
                        <tr
                          v-for="(row, index) in fulfillmentPickOperationItems"
                          :key="
                            row.id || `${row.submitId}-${row.itemId}-${index}`
                          "
                        >
                          <td>
                            {{
                              (fulfillmentPickOperationPageState.pageNo - 1) *
                                fulfillmentPickOperationPageState.pageSize +
                              index +
                              1
                            }}
                          </td>
                          <td>{{ row.productCode || '-' }}</td>
                          <td>{{ row.productName || '-' }}</td>
                          <td>{{ row.standard || '-' }}</td>
                          <td>{{ row.warehouseName || '-' }}</td>
                          <td>{{ formatDetailCount(row.quantity) }}</td>
                          <td>{{ row.submitUserName || '-' }}</td>
                          <td>{{ formatDetailDate(row.submitTime) }}</td>
                        </tr>
                      </template>
                    </tbody>
                  </table>
                  <div
                    v-if="fulfillmentPickOperationPageState.total > 0"
                    class="sale-out-item-pager sale-out-fulfillment-pager"
                  >
                    <Pagination
                      :current="fulfillmentPickOperationPageState.pageNo"
                      :page-size="fulfillmentPickOperationPageState.pageSize"
                      :page-size-options="
                        FULFILLMENT_OPERATION_PAGE_SIZE_OPTIONS
                      "
                      :show-size-changer="true"
                      :show-total="(total) => `共 ${total} 条拣货明细`"
                      :total="fulfillmentPickOperationPageState.total"
                      size="small"
                      @change="handleFulfillmentPickOperationPageChange"
                      @show-size-change="
                        handleFulfillmentPickOperationPageChange
                      "
                    />
                  </div>
                </div>
              </section>
              <section class="sale-out-detail-section">
                <header class="sale-out-detail-section__header">
                  <span class="sale-out-detail-section__title"
                    >送货人员明细</span
                  >
                  <span class="sale-out-detail-count">
                    共 {{ fulfillmentDeliveryOperationPageState.total }} 条
                  </span>
                </header>
                <div
                  v-if="hasLegacyDeliveryOperation"
                  class="sale-out-fulfillment-legacy-warning"
                >
                  历史送货提交未记录逐配件数量，无法按人员准确拆分，请以累计履约明细和提交记录为准。
                </div>
                <div class="sale-out-fulfillment-table-wrap">
                  <table class="sale-out-fulfillment-table">
                    <thead>
                      <tr>
                        <th>序号</th>
                        <th>配件编码</th>
                        <th>配件名称</th>
                        <th>规格</th>
                        <th>仓库</th>
                        <th>本次送货数量</th>
                        <th>送货人</th>
                        <th>送货时间</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-if="fulfillmentDeliveryOperationLoading">
                        <td colspan="8">正在加载送货人员明细…</td>
                      </tr>
                      <tr v-else-if="fulfillmentDeliveryOperationError">
                        <td class="sale-out-fulfillment-error" colspan="8">
                          {{ fulfillmentDeliveryOperationError }}
                        </td>
                      </tr>
                      <tr
                        v-else-if="
                          fulfillmentDeliveryOperationItems.length === 0
                        "
                      >
                        <td colspan="8">暂无可准确拆分的送货人员明细</td>
                      </tr>
                      <template v-else>
                        <tr
                          v-for="(
                            row, index
                          ) in fulfillmentDeliveryOperationItems"
                          :key="
                            row.id || `${row.submitId}-${row.itemId}-${index}`
                          "
                        >
                          <td>
                            {{
                              (fulfillmentDeliveryOperationPageState.pageNo -
                                1) *
                                fulfillmentDeliveryOperationPageState.pageSize +
                              index +
                              1
                            }}
                          </td>
                          <td>{{ row.productCode || '-' }}</td>
                          <td>{{ row.productName || '-' }}</td>
                          <td>{{ row.standard || '-' }}</td>
                          <td>{{ row.warehouseName || '-' }}</td>
                          <td>{{ formatDetailCount(row.quantity) }}</td>
                          <td>{{ row.submitUserName || '-' }}</td>
                          <td>{{ formatDetailDate(row.submitTime) }}</td>
                        </tr>
                      </template>
                    </tbody>
                  </table>
                  <div
                    v-if="fulfillmentDeliveryOperationPageState.total > 0"
                    class="sale-out-item-pager sale-out-fulfillment-pager"
                  >
                    <Pagination
                      :current="fulfillmentDeliveryOperationPageState.pageNo"
                      :page-size="
                        fulfillmentDeliveryOperationPageState.pageSize
                      "
                      :page-size-options="
                        FULFILLMENT_OPERATION_PAGE_SIZE_OPTIONS
                      "
                      :show-size-changer="true"
                      :show-total="(total) => `共 ${total} 条送货明细`"
                      :total="fulfillmentDeliveryOperationPageState.total"
                      size="small"
                      @change="handleFulfillmentDeliveryOperationPageChange"
                      @show-size-change="
                        handleFulfillmentDeliveryOperationPageChange
                      "
                    />
                  </div>
                </div>
              </section>
              <section class="sale-out-detail-section">
                <header class="sale-out-detail-section__header">
                  <span class="sale-out-detail-section__title">提交记录</span>
                  <span class="sale-out-detail-count">
                    共 {{ fulfillmentSubmitRows.length }} 条
                  </span>
                </header>
                <div
                  v-if="fulfillmentSubmitRows.length > 0"
                  class="sale-out-fulfillment-records"
                >
                  <div
                    v-for="submit in fulfillmentSubmitRows"
                    :key="submit.id"
                    class="sale-out-fulfillment-record"
                  >
                    <div class="sale-out-fulfillment-record__head">
                      <strong>{{ getSubmitTypeText(submit.type) }}</strong>
                      <Tag class="m-0" :color="getSubmitTypeTone(submit.type)">
                        {{ formatDetailCount(submit.itemCount) }} 条明细
                      </Tag>
                    </div>
                    <div class="sale-out-fulfillment-record__body">
                      <span>提交人：{{ submit.submitUserName || '-' }}</span>
                      <span
                        >提交时间：{{
                          formatDetailDate(submit.submitTime)
                        }}</span
                      >
                      <span>图片：{{ submit.files?.length || 0 }} 张</span>
                      <span>备注：{{ submit.remark || '-' }}</span>
                    </div>
                  </div>
                </div>
                <div v-else class="sale-out-fulfillment-empty">
                  暂无提交记录
                </div>
              </section>
            </template>
          </div>
        </TabPane>

        <TabPane :key="RECEIPT_TAB_KEY" tab="收款核销">
          <ReceiptWriteOffTab
            :active="activeTab === RECEIPT_TAB_KEY"
            :can-view-receipt-items="canViewFinanceReceiptItems"
            :customer-id="formData.customerId"
            :out-id="formData.id"
            :reload-key="receiptTabReloadKey"
          />
        </TabPane>

        <TabPane key="finance" tab="财务进度">
          <div class="sale-out-detail-placeholder">功能开发中</div>
        </TabPane>

        <TabPane key="stockOut" tab="出仓信息">
          <div class="sale-out-detail-tab-content">
            <section class="sale-out-detail-section">
              <header class="sale-out-detail-section__header">
                <span class="sale-out-detail-section__title">{{
                  formData.stockOutBills?.length ? '历史出仓信息' : '出仓信息'
                }}</span>
                <Tag
                  v-if="formData.stockOutBills?.length"
                  :color="getStockOutSummaryColor(formData)"
                >
                  {{ getStockOutBillStatusText(formData) }}
                </Tag>
              </header>
              <p
                v-if="formData.stockOutBills?.length"
                class="mb-2 text-gray-500"
              >
                以下为历史领货记录；待领或部分领货请核对实物和账务，不会自动补扣。
              </p>
              <div
                v-if="formData.stockOutBills?.length"
                class="sale-out-stock-summary"
              >
                <div>
                  <span>出仓单号</span>
                  <b :title="getStockOutBillNos(formData)">
                    {{ getStockOutBillNos(formData) || '-' }}
                  </b>
                </div>
                <div>
                  <span>仓单数</span>
                  <b>{{ formData.stockOutBills?.length || 0 }}</b>
                </div>
                <div>
                  <span>出仓数量</span>
                  <b>{{
                    formatSummaryNumber(sumStockOutBill(formData, 'totalCount'))
                  }}</b>
                </div>
                <div>
                  <span>已拣货</span>
                  <b>{{
                    formatSummaryNumber(
                      sumStockOutBill(formData, 'pickedCount'),
                    )
                  }}</b>
                </div>
              </div>
              <div
                v-if="formData.stockOutBills?.length"
                class="sale-out-stock-bills"
              >
                <div
                  v-for="bill in formData.stockOutBills"
                  :key="bill.id || bill.no"
                  class="sale-out-stock-bill"
                >
                  <div class="sale-out-stock-bill__header">
                    <strong>{{ bill.no || '-' }}</strong>
                    <Tag :color="getStockOutBillStatusColor(bill.status)">
                      {{ stockOutBillHistoryStatus(bill.status) }}
                    </Tag>
                  </div>
                  <div class="sale-out-stock-bill__grid">
                    <span>仓库：{{ bill.warehouseName || '-' }}</span>
                    <span>
                      出仓数量：{{
                        formatSummaryNumber(toNumber(bill.totalCount))
                      }}
                    </span>
                    <span>
                      已拣货：{{
                        formatSummaryNumber(toNumber(bill.pickedCount))
                      }}
                    </span>
                    <span> 日期：{{ formatDetailDate(bill.billDate) }} </span>
                  </div>
                </div>
              </div>
              <div v-else class="sale-out-detail-placeholder">
                新销售审核后直接扣库存，不再生成新的出仓领货单；此单无历史出仓记录。
              </div>
              <div class="sale-out-detail-items">
                <StockOutItemGrid>
                  <template #toolbar-tools>
                    <span aria-hidden="true"></span>
                  </template>
                  <template #productName="{ row }">
                    <span>{{ getRowValue(row, 'productName') || '-' }}</span>
                  </template>
                  <template #warehouseName="{ row }">
                    <span>{{
                      getRowValue(row, 'warehouseName') ||
                      getRowValue(row, 'warehouseId') ||
                      '-'
                    }}</span>
                  </template>
                  <template #sourceWarehouseName="{ row }">
                    <div
                      v-if="isCrossDeptSale(row)"
                      class="flex flex-wrap items-center gap-1"
                      :title="getRowValue(row, 'sourceDeptName') || undefined"
                    >
                      <span>{{
                        getRowValue(row, 'sourceWarehouseName') ||
                        getRowValue(row, 'sourceWarehouseId') ||
                        '-'
                      }}</span>
                      <Tag color="orange" class="m-0">跨部门</Tag>
                    </div>
                    <span v-else>{{
                      getRowValue(row, 'sourceWarehouseName') ||
                      getRowValue(row, 'sourceWarehouseId') ||
                      '-'
                    }}</span>
                  </template>
                  <template #stockOutBillStatus="{ row }">
                    <Tag
                      :color="
                        getStockOutBillStatusColor(
                          getRowValue(row, 'stockOutBillStatus'),
                        )
                      "
                    >
                      {{
                        getRowValue(row, 'hasStockOutBill')
                          ? stockOutBillHistoryStatus(
                              getRowValue(row, 'stockOutBillStatus'),
                            )
                          : '无历史出仓记录'
                      }}
                    </Tag>
                  </template>
                </StockOutItemGrid>
                <div class="sale-out-item-pager">
                  <Pagination
                    :current="itemPageState.pageNo"
                    :page-size="itemPageState.pageSize"
                    :page-size-options="ITEM_PAGE_SIZE_OPTIONS"
                    :show-size-changer="true"
                    :show-quick-jumper="true"
                    :show-total="(total) => `共 ${total} 条明细`"
                    :total="itemPageState.total"
                    size="small"
                    @change="handleItemPageChange"
                    @show-size-change="handleItemPageChange"
                  />
                </div>
              </div>
            </section>
          </div>
        </TabPane>

        <TabPane key="log" tab="操作日志">
          <div class="sale-out-detail-placeholder">功能开发中</div>
        </TabPane>
      </Tabs>
    </div>

    <template #cancelText>关闭</template>
    <template v-if="!reportViewOnly" #prepend-footer>
      <Button v-if="canEditRemark" type="primary" @click="handleEditRemark">
        修改备注
      </Button>
      <Button
        v-if="canPrintFromDetail"
        :title="printSortTitle"
        @click="handleDetailPrint"
      >
        打印
      </Button>
      <Button
        v-if="showUploadExpressBtn"
        class="mr-2"
        type="primary"
        ghost
        @click="handleUploadExpress"
      >
        补传快递单
      </Button>
      <Button
        v-if="!detailLoading && formData.status === 20"
        class="mr-2"
        type="primary"
        ghost
        @click="handlePriceAdjust"
      >
        调价
      </Button>
      <Button
        v-if="
          !detailLoading &&
          formData.status === 20 &&
          formData.returnStatus !== 2
        "
        type="primary"
        ghost
        @click="handleReturn"
      >
        整单退货
      </Button>
      <Button
        v-if="
          !detailLoading &&
          formData.status === 20 &&
          formData.returnStatus !== 2
        "
        type="primary"
        ghost
        @click="handleOpenPartialReturn"
      >
        部分退货
      </Button>
    </template>
  </Modal>
  <RemarkModal @success="handleRemarkSuccess" />
  <SalePriceAdjustModal
    v-if="shouldRenderSalePriceAdjust"
    @success="handleSourceActionSuccess"
  />
  <SaleReturnModal
    v-if="shouldRenderSaleReturn"
    @success="handleSourceActionSuccess"
  />
  <ExpressUploadModalRef @success="handleExpressUploadSuccess" />
  <SaleReturnableItemSelectModal
    ref="returnableItemSelectRef"
    @select="handleSelectPartialReturnableItems"
  />
  <CustomerDetailModal />
  <SaleOrderDetailModal />
  <SaleStockProductSelectModal
    candidate-focus-highlight
    ref="productSelectRef"
    enable-sale-stock-shortcuts
    :customer-price-level="currentCustomerPriceLevel"
    :hidden-fields="hiddenFields"
    :sale-dept-id="formData.deptId"
    show-batch-no
  />
  <ProductFormModal @success="handleProductFormSuccess" />
  <PurchaseItemDetailShortcuts
    ref="purchaseShortcutsRef"
    :active-row="activeShortcutItemRow"
    :dept-id="formData.deptId"
    :history-enabled="false"
    :product-edit-enabled="false"
    warning-message="请先点击一条有商品的销售明细"
  />
</template>

<style scoped>
.sale-out-detail-title {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}

.sale-out-detail-title__text {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 2px;
}

.sale-out-detail-title__text > span {
  line-height: 1.25;
}

.sale-out-detail-title__text small {
  overflow: hidden;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  font-weight: 400;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sale-out-status {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 6px;
  padding: 2px 9px;
  border: 1px solid currentcolor;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
}

.sale-out-status::before {
  width: 6px;
  height: 6px;
  background: currentcolor;
  border-radius: 50%;
  content: '';
}

.sale-out-status.is-success {
  color: hsl(var(--success));
  background: hsl(var(--success) / 10%);
}

.sale-out-status.is-warning {
  color: hsl(var(--warning));
  background: hsl(var(--warning) / 10%);
}

.sale-out-status.is-muted {
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted));
}

.sale-out-detail-view {
  min-height: 100%;
  background: hsl(var(--muted) / 28%);
  font-size: 12px;
}

.sale-out-detail-load-state {
  display: flex;
  min-height: 120px;
  align-items: center;
  justify-content: center;
  margin: 12px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.sale-out-detail-load-state.is-error {
  color: hsl(var(--destructive));
}

.sale-out-detail-tabs :deep(.ant-tabs-nav) {
  margin: 0;
  padding: 0 12px;
  background: hsl(var(--card));
}

.sale-out-detail-tabs :deep(.ant-tabs-tab) {
  padding-top: 10px;
  padding-bottom: 10px;
  font-size: 12px;
}

.sale-out-detail-tab-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
}

.sale-out-detail-section {
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.sale-out-detail-section__header {
  display: flex;
  min-height: 40px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 12px;
  background: hsl(var(--muted) / 24%);
  border-bottom: 1px solid hsl(var(--border));
}

.sale-out-detail-section__title {
  position: relative;
  padding-left: 10px;
  color: hsl(var(--foreground));
  font-size: 13px;
  font-weight: 600;
}

.sale-out-detail-section__title::before {
  position: absolute;
  top: 2px;
  bottom: 2px;
  left: 0;
  width: 3px;
  background: hsl(var(--primary));
  border-radius: 3px;
  content: '';
}

.sale-out-detail-section__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px 12px;
  min-width: 0;
}

.sale-out-detail-shortcut-hint {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  color: #475569;
  font-size: 12px;
}

.sale-out-detail-shortcut-hint__label {
  color: #64748b;
}

.sale-out-detail-shortcut-hint b {
  font-weight: 600;
}

.sale-out-detail-shortcut-hint kbd {
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

.sale-out-detail-shortcut-hint__divider {
  width: 1px;
  height: 18px;
  margin: 0 4px;
  background: #cbd5e1;
}

.sale-out-item-table-wrap :deep(.sale-out-item-row--active td) {
  background-color: rgba(22, 119, 255, 0.1) !important;
}

.sale-out-item-table-wrap :deep(.sale-out-item-row--active td:first-child) {
  box-shadow: inset 3px 0 0 #1677ff;
}

.sale-out-item-table-wrap :deep(.sale-out-item-row--active:hover td) {
  background-color: rgba(22, 119, 255, 0.16) !important;
}

.sale-out-detail-count {
  padding: 2px 8px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted));
  border: 1px solid hsl(var(--border));
  border-radius: 999px;
}

.sale-out-detail-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px 12px;
  padding: 12px;
}

.sale-out-detail-field {
  display: grid;
  min-width: 0;
  align-items: center;
  grid-template-columns: 106px minmax(0, 1fr);
}

.sale-out-detail-field--full-row {
  grid-column: 1 / -1;
}

.sale-out-detail-field__label {
  min-width: 0;
  padding-right: 10px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  line-height: 1.2;
  text-align: left;
  white-space: nowrap;
}

.sale-out-detail-field__value {
  display: flex;
  min-width: 0;
  height: 32px;
  align-items: center;
  gap: 8px;
  padding: 0 10px;
  overflow: hidden;
  color: hsl(var(--foreground));
  font-size: 12px;
  background: hsl(var(--muted) / 48%);
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
  line-height: 1.4;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sale-out-detail-field__value > span:first-child {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sale-out-detail-field__value > span:last-child {
  margin-left: auto;
}

.sale-out-detail-field__link {
  width: 100%;
  color: hsl(var(--primary));
  cursor: pointer;
}

.sale-out-detail-field__link:hover {
  background: hsl(var(--primary) / 8%);
  border-color: hsl(var(--primary) / 55%);
}

.sale-out-express-gallery {
  min-width: 0;
  padding: 8px;
  background: hsl(var(--muted) / 28%);
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.sale-out-express-gallery__list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.sale-out-express-gallery__item {
  display: grid;
  min-width: 0;
  grid-template-columns: 72px minmax(0, 1fr);
  gap: 8px;
  align-items: center;
  padding: 6px;
  background: hsl(var(--background));
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.sale-out-express-gallery__item :deep(.ant-image-img) {
  width: 72px;
  height: 72px;
  object-fit: cover;
  border-radius: 4px;
}

.sale-out-express-gallery__meta {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
}

.sale-out-express-gallery__meta strong,
.sale-out-express-gallery__meta span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sale-out-express-gallery__meta span {
  color: hsl(var(--muted-foreground));
}

.sale-out-express-gallery__state {
  padding: 10px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
}

.sale-out-express-gallery__state.is-error {
  color: hsl(var(--destructive));
}

.sale-out-express-gallery__pager {
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
}

.sale-out-detail-receivable {
  padding: 0 12px 12px;
}

.sale-out-detail-receivable :deep(> div) {
  border-color: hsl(var(--primary) / 20%);
  background: hsl(var(--primary) / 7%);
}

.sale-out-detail-items {
  padding: 10px;
}

.sale-out-detail-items :deep(.vxe-table) {
  font-size: 11px;
}

.sale-out-detail-items :deep(.vxe-header--column .vxe-cell),
.sale-out-detail-items :deep(.vxe-body--column .vxe-cell) {
  padding-right: 4px;
  padding-left: 4px;
}

.sale-out-detail-items :deep(.vxe-header--column .vxe-cell) {
  white-space: nowrap;
}

.sale-out-detail-items
  :deep(.vxe-header--column.is--sortable .vxe-cell--title) {
  color: #1677ff;
}

.sale-out-detail-items :deep(.vxe-header--column .vxe-cell--sort) {
  display: none;
}

.sale-out-item-pager {
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
}

.sale-out-item-pager :deep(.ant-pagination),
.sale-out-item-pager :deep(.ant-pagination-item),
.sale-out-item-pager :deep(.ant-pagination-total-text),
.sale-out-item-pager :deep(.ant-pagination-options),
.sale-out-item-pager :deep(.ant-select),
.sale-out-item-pager :deep(.ant-input) {
  font-size: 11px;
}

.sale-out-item-pager :deep(.ant-pagination-item),
.sale-out-item-pager :deep(.ant-pagination-prev),
.sale-out-item-pager :deep(.ant-pagination-next),
.sale-out-item-pager :deep(.ant-pagination-jump-prev),
.sale-out-item-pager :deep(.ant-pagination-jump-next) {
  min-width: 24px;
  height: 24px;
  line-height: 22px;
}

.sale-out-item-pager :deep(.ant-pagination-item a),
.sale-out-item-pager :deep(.ant-pagination-prev button),
.sale-out-item-pager :deep(.ant-pagination-next button) {
  height: 22px;
  font-size: 11px;
  line-height: 22px;
}

.sale-out-item-pager :deep(.ant-pagination-options-size-changer),
.sale-out-item-pager :deep(.ant-select-single),
.sale-out-item-pager :deep(.ant-select-selector) {
  height: 24px;
  line-height: 22px;
}

.sale-out-item-pager
  :deep(.ant-pagination-options-size-changer .ant-select-selector) {
  box-sizing: border-box;
  align-items: center;
  min-height: 24px;
  padding: 0 24px 0 8px;
}

.sale-out-item-pager
  :deep(.ant-select-single .ant-select-selector .ant-select-selection-item) {
  height: 22px;
  font-size: 11px;
  line-height: 22px;
}

.sale-out-item-pager :deep(.ant-select-arrow) {
  margin-top: -5px;
  font-size: 10px;
}

.sale-out-item-pager :deep(.ant-pagination-options-quick-jumper input) {
  height: 24px;
  padding: 0 7px;
  font-size: 11px;
  line-height: 22px;
}

.sale-out-returned-count {
  margin-left: 6px;
  color: hsl(var(--destructive));
}

.sale-out-document-summary {
  display: flex;
  min-height: 44px;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px 20px;
  padding: 8px 12px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 20%);
  border-top: 1px solid hsl(var(--border));
}

.sale-out-document-summary strong {
  margin-right: auto;
  color: hsl(var(--foreground));
}

.sale-out-document-summary b {
  margin-left: 5px;
  color: hsl(var(--foreground));
  font-variant-numeric: tabular-nums;
}

.sale-out-document-summary__paid b {
  color: hsl(var(--success));
}

.sale-out-fulfillment-overview {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 10px;
  padding: 12px;
}

.sale-out-fulfillment-card {
  display: flex;
  min-width: 0;
  min-height: 58px;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
  padding: 10px 12px;
  background: hsl(var(--muted) / 36%);
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.sale-out-fulfillment-card > span {
  color: hsl(var(--muted-foreground));
  line-height: 1.2;
}

.sale-out-fulfillment-card > b {
  overflow: hidden;
  color: hsl(var(--foreground));
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sale-out-fulfillment-counts {
  display: flex;
  min-height: 40px;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 20px;
  padding: 0 12px 12px;
  color: hsl(var(--muted-foreground));
}

.sale-out-fulfillment-counts b {
  margin-left: 5px;
  color: hsl(var(--foreground));
  font-variant-numeric: tabular-nums;
}

.sale-out-fulfillment-note {
  padding: 12px;
  color: hsl(var(--muted-foreground));
  line-height: 1.7;
}

.sale-out-fulfillment-table-wrap {
  padding: 10px 12px 12px;
  overflow-x: auto;
}

.sale-out-fulfillment-table {
  width: 100%;
  min-width: 960px;
  border-collapse: collapse;
  background: hsl(var(--card));
}

.sale-out-fulfillment-table th,
.sale-out-fulfillment-table td {
  height: 34px;
  padding: 6px 8px;
  border: 1px solid hsl(var(--border));
  font-size: 12px;
  line-height: 1.4;
  text-align: left;
  vertical-align: middle;
  white-space: nowrap;
}

.sale-out-fulfillment-table th {
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 24%);
  font-weight: 600;
}

.sale-out-fulfillment-legacy-warning {
  margin: 10px 12px 0;
  padding: 8px 10px;
  color: hsl(var(--warning));
  background: hsl(var(--warning) / 10%);
  border: 1px solid hsl(var(--warning) / 35%);
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.6;
}

.sale-out-fulfillment-table td.sale-out-fulfillment-error {
  color: hsl(var(--destructive));
}

.sale-out-fulfillment-files {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  padding: 12px 12px 4px;
}

.sale-out-fulfillment-file {
  display: grid;
  min-width: 0;
  grid-template-columns: 52px minmax(0, 1fr);
  gap: 8px;
  padding: 8px;
  color: hsl(var(--foreground));
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.sale-out-fulfillment-file:hover {
  color: hsl(var(--primary));
  border-color: hsl(var(--primary) / 45%);
}

.sale-out-fulfillment-file__thumb {
  width: 52px;
  height: 52px;
  object-fit: cover;
  background: hsl(var(--muted) / 40%);
  border: 1px solid hsl(var(--border));
  border-radius: 4px;
}

.sale-out-fulfillment-file__body {
  display: flex;
  min-width: 0;
  flex-direction: column;
  justify-content: center;
  gap: 3px;
}

.sale-out-fulfillment-file__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sale-out-fulfillment-file__meta {
  overflow: hidden;
  color: hsl(var(--muted-foreground));
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sale-out-fulfillment-empty,
.sale-out-fulfillment-loading {
  display: flex;
  min-height: 72px;
  align-items: center;
  justify-content: center;
  padding: 12px;
  color: hsl(var(--muted-foreground));
}

.sale-out-fulfillment-pager {
  padding: 8px 12px 12px;
}

.sale-out-fulfillment-records {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
  padding: 12px;
}

.sale-out-fulfillment-record {
  min-width: 0;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
  overflow: hidden;
}

.sale-out-fulfillment-record__head {
  display: flex;
  min-height: 34px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 10px;
  background: hsl(var(--muted) / 24%);
  border-bottom: 1px solid hsl(var(--border));
}

.sale-out-fulfillment-record__head strong {
  font-size: 12px;
  font-weight: 600;
}

.sale-out-fulfillment-record__body {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px 12px;
  padding: 10px;
  color: hsl(var(--muted-foreground));
  line-height: 1.5;
}

.sale-out-fulfillment-record__body span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sale-out-detail-audit :deep(.erp-audit-info) {
  padding: 12px;
}

.sale-out-detail-audit :deep(.erp-audit-info .text-sm) {
  font-size: 12px;
}

.sale-out-detail-audit :deep(.erp-audit-info > div:first-child) {
  display: none;
}

.sale-out-stock-summary,
.sale-out-stock-bill__grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.sale-out-stock-summary {
  padding: 12px;
}

.sale-out-stock-summary > div {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}

.sale-out-stock-summary span,
.sale-out-stock-bill__grid {
  color: hsl(var(--muted-foreground));
}

.sale-out-stock-summary b {
  overflow: hidden;
  color: hsl(var(--foreground));
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sale-out-stock-bills {
  display: grid;
  gap: 8px;
  padding: 0 12px 12px;
}

.sale-out-stock-bill {
  padding: 10px;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.sale-out-stock-bill__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.sale-out-detail-placeholder {
  display: flex;
  min-height: 160px;
  align-items: center;
  justify-content: center;
  margin: 12px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

@media (max-width: 1200px) {
  .sale-out-detail-grid,
  .sale-out-stock-summary,
  .sale-out-stock-bill__grid {
    min-width: 1060px;
  }

  .sale-out-detail-section {
    overflow-x: auto;
  }
}

@media (max-width: 900px) {
  .sale-out-express-gallery__list,
  .sale-out-fulfillment-overview,
  .sale-out-fulfillment-files,
  .sale-out-fulfillment-records {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .sale-out-express-gallery__list,
  .sale-out-fulfillment-overview,
  .sale-out-fulfillment-files,
  .sale-out-fulfillment-records,
  .sale-out-fulfillment-record__body {
    grid-template-columns: 1fr;
  }
}
</style>
