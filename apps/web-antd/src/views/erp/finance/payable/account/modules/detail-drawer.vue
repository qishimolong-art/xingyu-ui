<script lang="ts" setup>import { financeValue, financeCompare } from '#/views/erp/finance/utils/finance-decimal';

import { financeMoney as erpPriceInputFormatter } from '#/views/erp/finance/utils/finance-decimal';

import { useFinanceCandidateFocus } from '#/views/erp/finance/utils/candidate-focus';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpPayableAccountApi } from '#/api/erp/finance/payable/account';
import type { ErpFinancePaymentApi } from '#/api/erp/finance/payment';

import {
  computed,
  defineAsyncComponent,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue';

import { useAccess } from '@vben/access';
import { useVbenModal } from '@vben/common-ui';
import { ErpBizType } from '@vben/constants';
import { downloadFileFromBlobPart } from '@vben/utils';

import { Alert, message, Pagination } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  exportPayableDrilldown,
  getPayableAccountExportFields,
  getPayableDrilldownPage,
} from '#/api/erp/finance/payable/account';
import { getFinancePayment } from '#/api/erp/finance/payment';
import ExportFieldModalComponent from '#/views/erp/components/export-field-modal.vue';
import { fitFinanceDocumentItemColumnsToWidth } from '#/views/erp/finance/utils/document-item-table';
import { getErpDetailLoadError } from '#/views/erp/utils/detail-load-error';

import WriteOffModal from '../../../settlement/components/writeoff-modal.vue';
import { useDetailColumns, useDrilldownColumns } from '../data';
import { getPayableDetailPaymentState } from '../payable-account-ui';
import { getPayableSourceTarget } from './payable-source-link';
const { candidatePopupClass } = useFinanceCandidateFocus();

type PayableDetailSortOrder = 'asc' | 'desc';

const props = withDefaults(
  defineProps<{
    approveTime?: string[];
    bizTime?: string[];
    dateBasis?: 'approveTime' | 'bizTime';
    deptName?: string;
    detailLabel?: string;
    detailType?: ErpPayableAccountApi.PayableDrilldownType;
    displayMode?: 'drawer' | 'modal';
    readonly?: boolean;
    supplierId?: number;
    supplierName?: string;
  }>(),
  {
    deptName: '',
    detailLabel: '应付余额',
    detailType: 'BALANCE',
    displayMode: 'drawer',
    readonly: false,
    supplierId: undefined,
    supplierName: '',
    dateBasis: 'bizTime',
    approveTime: () => [],
    bizTime: () => [],
  },
);
const emit = defineEmits<{ writeoffSuccess: [] }>();
const { hasAccessByCodes } = useAccess();

const PurchaseOrderDetail = defineAsyncComponent(
  () => import('#/views/erp/purchase/order/modules/form.vue'),
);

const PurchaseInDetail = defineAsyncComponent(
  () => import('#/views/erp/purchase/in/modules/form.vue'),
);
const PurchaseReturnDetail = defineAsyncComponent(
  () => import('#/views/erp/purchase/return/modules/form.vue'),
);
const PurchasePriceAdjustDetail = defineAsyncComponent(
  () => import('#/views/erp/purchase/priceadjust/modules/form.vue'),
);
const PaymentDetail = defineAsyncComponent(
  () => import('#/views/erp/finance/settlement/payment/modules/form.vue'),
);
const OtherPayableDetail = defineAsyncComponent(
  () => import('#/views/erp/finance/payable/other/modules/form.vue'),
);
const MiscPayableDetail = defineAsyncComponent(
  () => import('#/views/erp/finance/payable/misc/modules/form.vue'),
);
const [PurchaseOrderModal, purchaseOrderModalApi] = useVbenModal({
  connectedComponent: PurchaseOrderDetail,
  destroyOnClose: true,
});
const [PurchaseInModal, purchaseInModalApi] = useVbenModal({
  connectedComponent: PurchaseInDetail,
  destroyOnClose: true,
});
const [PurchaseReturnModal, purchaseReturnModalApi] = useVbenModal({
  connectedComponent: PurchaseReturnDetail,
  destroyOnClose: true,
});
const [PurchasePriceAdjustModal, purchasePriceAdjustModalApi] = useVbenModal({
  connectedComponent: PurchasePriceAdjustDetail,
  destroyOnClose: true,
});
const [PaymentModal, paymentModalApi] = useVbenModal({
  connectedComponent: PaymentDetail,
  destroyOnClose: true,
});
const [OtherPayableModal, otherPayableModalApi] = useVbenModal({
  connectedComponent: OtherPayableDetail,
  destroyOnClose: true,
});
const [MiscPayableModal, miscPayableModalApi] = useVbenModal({
  connectedComponent: MiscPayableDetail,
  destroyOnClose: true,
});
const [PaymentWriteOffModal, paymentWriteOffModalApi] = useVbenModal({
  connectedComponent: WriteOffModal,
  destroyOnClose: true,
});
const [ExportFieldModal, exportFieldModalApi] = useVbenModal({
  connectedComponent: ExportFieldModalComponent,
  destroyOnClose: true,
});
const detailWrapRef = ref<HTMLElement | null>(null);

function getSourceTarget(row: ErpPayableAccountApi.PayableDetail) {
  return getPayableSourceTarget(row, props.readonly, hasAccessByCodes);
}

function handleOpenSourceDetail(row: ErpPayableAccountApi.PayableDetail) {
  const target = getSourceTarget(row);
  if (!target) return;
  const modalApi =
    target.type === 'PURCHASE_ORDER' ? purchaseOrderModalApi : paymentModalApi;
  modalApi.setData({ type: 'detail', id: target.id }).open();
}

function getDetailModal(row: ErpPayableAccountApi.PayableDetail) {
  const permission = getDetailPermission(row);
  if (!permission || !hasAccessByCodes([permission])) return;
  const bizModalMap: Record<number, any> = {
    [ErpBizType.PURCHASE_IN]: purchaseInModalApi,
    [ErpBizType.PURCHASE_RETURN]: purchaseReturnModalApi,
    [ErpBizType.PURCHASE_PRICE_ADJUST]: purchasePriceAdjustModalApi,
    [ErpBizType.PAYABLE_MISC]: miscPayableModalApi,
  };
  if (row.bizType && bizModalMap[row.bizType]) return bizModalMap[row.bizType];
  if (row.docType === '付款单' || row.docType === '其他应付付款') {
    return paymentModalApi;
  }
  if (row.docType === '应付调账') {
    return otherPayableModalApi;
  }
}

function getDetailPermission(row: ErpPayableAccountApi.PayableDetail) {
  const bizPermissionMap: Record<number, string> = {
    [ErpBizType.PURCHASE_IN]: 'erp:purchase-in:query',
    [ErpBizType.PURCHASE_RETURN]: 'erp:purchase-return:query',
    [ErpBizType.PURCHASE_PRICE_ADJUST]: 'erp:purchase-price-adjust:query',
    [ErpBizType.PAYABLE_MISC]: 'erp:payable-misc:query',
  };
  if (row.bizType && bizPermissionMap[row.bizType]) {
    return bizPermissionMap[row.bizType];
  }
  if (row.docType === '付款单' || row.docType === '其他应付付款') {
    return 'erp:finance-payment:query';
  }
  if (row.docType === '应付调账') return 'erp:payable-other:query';
}

function canOpenDetail(row: ErpPayableAccountApi.PayableDetail) {
  return Boolean(
    !props.readonly && row.docNo && row.bizId && getDetailModal(row),
  );
}

function isAdjustedPurchaseIn(row: ErpPayableAccountApi.PayableDetail) {
  return row.bizType === ErpBizType.PURCHASE_IN && row.priceAdjusted === true;
}

function handleOpenDetail(row: ErpPayableAccountApi.PayableDetail) {
  if (!row.bizId) return;
  getDetailModal(row)?.setData({ type: 'detail', id: row.bizId }).open();
}

const loading = ref(false);
const exportLoading = ref(false);
const loadError = ref('');
const detailList = ref<ErpPayableAccountApi.PayableDetail[]>([]);
const detailTotal = ref(0);
const drilldownSummary = ref<ErpPayableAccountApi.DrilldownSummary>({});
function defaultDetailSort() {
  return props.dateBasis === 'approveTime'
    ? ({ field: 'approveTime', order: 'asc' } as const)
    : null;
}
const activeDetailSort = ref<null | {
  field: keyof ErpPayableAccountApi.PayableDetail;
  order: PayableDetailSortOrder;
}>(defaultDetailSort());
let loadSequence = 0;
const DETAIL_PAGE_SIZE_OPTIONS = ['10', '20', '50', '100', '200'];
const detailPagination = ref({ pageNo: 1, pageSize: 10 });

const summaryItems = computed(() => [
  { label: '明细数', value: `${drilldownSummary.value.detailCount || 0}` },
  {
    label: '期初金额',
    value: erpPriceInputFormatter(drilldownSummary.value.openingAmount || 0),
  },
  {
    label: '增加合计',
    value: erpPriceInputFormatter(drilldownSummary.value.increaseAmount || 0),
  },
  {
    label: '减少合计',
    value: erpPriceInputFormatter(drilldownSummary.value.decreaseAmount || 0),
  },
  {
    label: props.detailLabel,
    value: erpPriceInputFormatter(drilldownSummary.value.targetAmount || 0),
  },
  {
    label: '期末金额',
    value: erpPriceInputFormatter(drilldownSummary.value.endingAmount || 0),
  },
]);

const queryParams = computed(() => ({
  supplierId: props.supplierId,
  approveTime:
    props.dateBasis === 'approveTime' ? props.approveTime : undefined,
  bizTime: props.dateBasis === 'bizTime' ? props.bizTime : undefined,
  dateBasis: props.dateBasis,
  detailType: props.detailType,
  pageNo: detailPagination.value.pageNo,
  pageSize: detailPagination.value.pageSize,
  orderField: activeDetailSort.value?.field,
  orderDirection: activeDetailSort.value?.order,
}));

const currentScopeText = computed(() => {
  const supplierName = props.supplierName || '当前供应商';
  const deptName = props.deptName || '全部部门';
  return `${supplierName} / ${deptName}`;
});
const openingTimeMissing = computed(
  () =>
    props.detailType === 'OPENING_BALANCE' &&
    !(props.dateBasis === 'approveTime'
      ? props.approveTime?.[0]
      : props.bizTime?.[0]),
);

const detailGridHeight = computed(() =>
  props.displayMode === 'modal' ? '50vh' : 'calc(100vh - 330px)',
);
const detailGridMinHeight = computed(() =>
  props.displayMode === 'modal' ? 360 : 520,
);

const currentPageNo = computed(() => detailPagination.value.pageNo);
const currentPageSize = computed(() => detailPagination.value.pageSize);
const currentTotal = computed(() => detailTotal.value);

const detailColumns = computed(() => {
  const columns =
    props.detailType === 'BALANCE'
      ? useDetailColumns(detailList.value, props.dateBasis === 'approveTime')
      : useDrilldownColumns(
          detailList.value,
          props.detailLabel,
          props.dateBasis === 'approveTime',
        );
  const canShowWriteOff =
    !props.readonly &&
    hasAccessByCodes(['erp:finance-payment:writeoff']) &&
    detailList.value.some((row) => canWriteOff(row));
  const visibleColumns = canShowWriteOff
    ? columns
    : columns.filter((column) => column.slots?.default !== 'actions');
  return fitFinanceDocumentItemColumnsToWidth(
    visibleColumns,
    detailWrapRef.value?.clientWidth ?? 0,
  );
});

const detailSortFields = computed(
  () =>
    new Set(
      detailColumns.value
        .filter((column) => column.field && column.sortable)
        .map((column) => column.field as string),
    ),
);

async function renderDetailList() {
  await gridApi.grid.reloadColumn(detailColumns.value);
  await gridApi.grid.loadData(detailList.value);
}

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: detailColumns.value,
    data: detailList.value,
    border: true,
    fit: false,
    height: detailGridHeight.value,
    minHeight: detailGridMinHeight.value,
    showHeaderOverflow: 'tooltip',
    showOverflow: 'tooltip',
    scrollX: { enabled: true, gt: 6 },
    scrollY: { enabled: true, gt: 12 },
    pagerConfig: { enabled: false },
    toolbarConfig: {
      custom: true,
      enabled: true,
      refresh: { queryMethod: () => loadData() },
      search: false,
      zoom: true,
    },
    rowConfig: {
      keyField: 'rowKey',
      isHover: true,
    },
    rowClassName: ({ row }) =>
      `payable-detail-row--${getPayableDetailPaymentState(row)}`,
    sortConfig: {
      remote: true,
      multiple: false,
      trigger: 'cell',
      orders: ['asc', 'desc', null],
      allowBtn: false,
    },
  } as VxeTableGridOptions<ErpPayableAccountApi.PayableDetail>,
  gridEvents: {
    sortChange: handleDetailSortChange,
  },
});

async function handleDetailSortChange(params: any) {
  let currentSort = params?.sort ?? params;
  if (Array.isArray(params?.sorts)) {
    [currentSort] = params.sorts;
  } else if (Array.isArray(params?.sortList)) {
    [currentSort] = params.sortList;
  }
  const field =
    currentSort?.field || currentSort?.property || currentSort?.column?.field;
  const order = currentSort?.order;
  activeDetailSort.value =
    detailSortFields.value.has(field) && (order === 'asc' || order === 'desc')
      ? { field, order }
      : defaultDetailSort();
  detailPagination.value.pageNo = 1;
  await loadData();
}

async function handlePageChange(pageNo: number, pageSize: number) {
  detailPagination.value = { pageNo, pageSize };
  await loadData();
}

async function loadData(options: { resetPage?: boolean } = {}) {
  if (options.resetPage) detailPagination.value.pageNo = 1;
  const sequence = ++loadSequence;
  loadError.value = '';
  if (!props.supplierId) {
    loading.value = false;
    detailList.value = [];
    detailTotal.value = 0;
    drilldownSummary.value = {};
    await renderDetailList();
    return;
  }
  loading.value = true;
  try {
    const data = await getPayableDrilldownPage(queryParams.value);
    if (sequence !== loadSequence) return;
    detailList.value = withDetailRowKeys(data.list || []);
    detailTotal.value = financeValue(data.total || 0);
    drilldownSummary.value = data.summary || {};
    await renderDetailList();
  } catch {
    if (sequence !== loadSequence) return;
    detailList.value = [];
    detailTotal.value = 0;
    drilldownSummary.value = {};
    await renderDetailList();
    loadError.value = `${props.detailLabel}明细加载失败，请稍后重试`;
  } finally {
    if (sequence === loadSequence) {
      loading.value = false;
    }
  }
}

function handleExport() {
  if (!props.supplierId) {
    return;
  }
  exportFieldModalApi
    .setData({
      loadFields: () =>
        getPayableAccountExportFields('drilldown', {
          dateBasis: props.dateBasis,
          detailType: props.detailType,
        }),
      moduleKey: 'erp_finance_payable_account',
    })
    .open();
}

async function handleExportConfirm(fields: string[]) {
  exportLoading.value = true;
  try {
    const data = await exportPayableDrilldown({
      ...queryParams.value,
      fields: fields.join(','),
    });
    downloadFileFromBlobPart({
      fileName: `应付-${props.detailLabel}明细.xls`,
      source: data,
    });
  } finally {
    exportLoading.value = false;
  }
}

function buildDetailRowKey(
  row: ErpPayableAccountApi.PayableDetail,
  index: number,
) {
  if (row.eventKey) return row.eventKey;
  return [
    row.docType || 'none',
    row.bizType ?? 'none',
    row.bizId ?? 'none',
    row.docNo || 'none',
    row.docDate || 'none',
    index,
  ].join(':');
}

function withDetailRowKeys(rows: ErpPayableAccountApi.PayableDetail[]) {
  return rows.map((row, index) => ({
    ...row,
    paymentDisplayAmount: row.paymentDisplayAmount ?? row.paymentAmount,
    rowKey: buildDetailRowKey(row, index),
  }));
}

function isPaymentDetailRow(row: ErpPayableAccountApi.PayableDetail) {
  return Boolean(
    !row.bizType &&
    row.bizId &&
    (financeCompare(financeValue(row.paymentAmount || 0), 0) !== 0) &&
    (financeCompare(financeValue(row.increaseAmount || 0), 0) <= 0) &&
    (financeCompare(financeValue(row.writeOffAmount || 0), 0) <= 0),
  );
}

function canWriteOff(row: ErpPayableAccountApi.PayableDetail) {
  return Boolean(
    !props.readonly && props.supplierId && isPaymentDetailRow(row),
  );
}

function handleOpenWriteOff(row: ErpPayableAccountApi.PayableDetail) {
  if (!canWriteOff(row)) {
    return;
  }
  handleOpenPaymentWriteOff(row);
}

async function handleOpenPaymentWriteOff(
  row: ErpPayableAccountApi.PayableDetail,
) {
  if (!row.bizId) return;
  try {
    const payment = await getFinancePayment(row.bizId);
    if (!payment || (financeCompare(financeValue(payment.unallocatedPrice || 0), 0) === 0)) {
      message.warning('当前付款单没有未核销金额');
      return;
    }
    paymentWriteOffModalApi
      .setData({ type: 'payment', record: payment })
      .open();
  } catch (error) {
    message.error(
      getErpDetailLoadError(error, '付款单详情加载失败，请稍后重试'),
    );
  }
}

function handlePaymentDetailWriteOff(
  record: ErpFinancePaymentApi.FinancePayment,
) {
  paymentWriteOffModalApi.setData({ type: 'payment', record }).open();
}

async function handlePaymentWriteOffSuccess() {
  await loadData();
  emit('writeoffSuccess');
}

watch(
  () => [
    props.supplierId,
    props.approveTime,
    props.bizTime,
    props.dateBasis,
    props.detailType,
  ],
  async () => {
    activeDetailSort.value = defaultDetailSort();
    await loadData({ resetPage: true });
  },
  { immediate: true, deep: true },
);

onBeforeUnmount(() => {
  loadSequence += 1;
  window.removeEventListener('resize', handleDetailResize);
});

function handleDetailResize() {
  void gridApi.grid.reloadColumn(detailColumns.value);
}

onMounted(() => window.addEventListener('resize', handleDetailResize));
</script>

<template>
  <div
    ref="detailWrapRef"
    class="payable-detail"
    :class="`payable-detail--${displayMode}`"
  >
    <div class="payable-detail__toolbar">
      <span>
        {{ detailLabel }}按当前列表筛选的{{
          dateBasis === 'approveTime' ? '审批日期' : '业务时间'
        }}与供应商统计：{{ currentScopeText }}
      </span>
      <div v-if="!readonly" class="payable-detail__toolbar-actions">
        <div
          v-if="detailType === 'BALANCE'"
          class="payable-detail__legend"
          aria-label="付款核销状态图例"
        >
          <span class="payable-detail__legend-item">
            <i class="payable-detail__legend-dot--settled"></i>
            已完成付款/核销
          </span>
          <span class="payable-detail__legend-item">
            <i class="payable-detail__legend-dot--partial"></i>
            已付款但未付完
          </span>
          <span class="payable-detail__legend-item">
            <i class="payable-detail__legend-dot--unpaid"></i>
            未进行付款
          </span>
        </div>
        <TableAction
          :actions="[
            {
              label: '导出',
              type: 'primary',
              icon: ACTION_ICON.DOWNLOAD,
              auth: ['erp:payable-account:query'],
              disabled: !supplierId,
              loading: exportLoading,
              onClick: handleExport,
            },
          ]"
        />
      </div>
    </div>
    <Alert
      v-if="openingTimeMissing"
      class="mb-3"
      type="info"
      show-icon
      :message="`请先选择${dateBasis === 'approveTime' ? '审批' : '业务'}开始时间后查看此前应付明细`"
    />
    <Alert
      v-if="loadError"
      class="mb-3"
      type="error"
      show-icon
      :message="loadError"
    />
    <Grid v-loading="loading" class="payable-detail__grid">
      <template #docNo="{ row }">
        <a
          v-if="canOpenDetail(row)"
          class="cursor-pointer text-primary"
          @click.stop="handleOpenDetail(row)"
        >
          {{ row.docNo }}
          <span
            v-if="isAdjustedPurchaseIn(row)"
            class="payable-detail__adjusted-mark"
          >
            （调）
          </span>
        </a>
        <span v-else>
          {{ row.docNo || '-' }}
          <span
            v-if="isAdjustedPurchaseIn(row)"
            class="payable-detail__adjusted-mark"
          >
            （调）
          </span>
        </span>
      </template>
      <template #sourceNo="{ row }">
        <a
          v-if="getSourceTarget(row)"
          class="cursor-pointer text-primary"
          @click.stop="handleOpenSourceDetail(row)"
        >
          {{ row.sourceNo }}
        </a>
        <span v-else>{{ row.sourceNo || '-' }}</span>
      </template>
      <template #actions="{ row }">
        <TableAction
          v-if="!readonly && isPaymentDetailRow(row)"
          :actions="[
            {
              label: '核销',
              type: 'link',
              icon: ACTION_ICON.EDIT,
              auth: ['erp:finance-payment:writeoff'],
              disabled: !canWriteOff(row),
              onClick: handleOpenWriteOff.bind(null, row),
            },
          ]"
        />
      </template>
    </Grid>
    <div class="payable-detail__pager">
      <Pagination
        :class="candidatePopupClass()"
        size="small"
        :current="currentPageNo"
        :page-size="currentPageSize"
        :page-size-options="DETAIL_PAGE_SIZE_OPTIONS"
        :show-total="(total: number) => `共 ${total} 条明细`"
        :total="currentTotal"
        :disabled="loading"
        show-quick-jumper
        show-size-changer
        @change="handlePageChange"
        @show-size-change="handlePageChange"
      />
    </div>
    <div class="payable-detail__summary">
      <span v-for="item in summaryItems" :key="item.label">
        {{ item.label }}：<b>{{ item.value }}</b>
      </span>
    </div>
    <PurchaseOrderModal />
    <PurchaseInModal />
    <PurchaseReturnModal />
    <PurchasePriceAdjustModal />
    <PaymentModal @writeoff="handlePaymentDetailWriteOff" />
    <PaymentWriteOffModal
      v-if="!readonly"
      @success="handlePaymentWriteOffSuccess"
    />
    <OtherPayableModal />
    <MiscPayableModal />
    <ExportFieldModal @confirm="handleExportConfirm" />
  </div>
</template>

<style scoped>
.payable-detail {
  font-size: 12px;
  color: hsl(var(--foreground));
}

.payable-detail__toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  min-height: 36px;
  margin-bottom: 8px;
  color: hsl(var(--muted-foreground));
}

.payable-detail__toolbar-actions,
.payable-detail__legend,
.payable-detail__legend-item {
  display: flex;
  align-items: center;
}

.payable-detail__toolbar-actions {
  gap: 16px;
}

.payable-detail__legend {
  flex-wrap: wrap;
  gap: 4px 12px;
  color: hsl(var(--muted-foreground));
}

.payable-detail--modal .payable-detail__toolbar {
  align-items: flex-start;
}

.payable-detail--modal .payable-detail__toolbar > span {
  line-height: 1.7;
}

.payable-detail--modal .payable-detail__toolbar-actions {
  flex-shrink: 0;
}

.payable-detail__legend-item {
  gap: 5px;
  white-space: nowrap;
}

.payable-detail__legend-item i {
  width: 10px;
  height: 10px;
  border: 1px solid hsl(var(--border));
  border-radius: 2px;
}

.payable-detail__legend-dot--settled {
  background: hsl(var(--primary));
}

.payable-detail__legend-dot--partial {
  background: hsl(var(--destructive));
}

.payable-detail__legend-dot--unpaid {
  background: hsl(var(--card));
}

:deep(.payable-detail__grid .vxe-table--render-default) {
  font-size: 12px;
}

:deep(.payable-detail__grid .vxe-header--column .vxe-cell--title) {
  white-space: nowrap;
}

:deep(.payable-detail__grid .vxe-header--column.is--sortable .vxe-cell--title) {
  color: #1677ff;
}

:deep(.payable-detail__grid .vxe-header--column .vxe-cell--sort) {
  display: none;
}

:deep(.payable-detail__grid .table-actions .ant-btn-link) {
  height: auto;
  padding: 0;
  font-size: 12px;
}

.payable-detail__adjusted-mark {
  color: hsl(var(--destructive));
  font-weight: 600;
}

.payable-detail__pager {
  display: flex;
  justify-content: flex-end;
  padding: 8px 2px 0;
  font-size: 11px;
}

.payable-detail__pager :deep(.ant-pagination),
.payable-detail__pager :deep(.ant-pagination-item),
.payable-detail__pager :deep(.ant-pagination-options),
.payable-detail__pager :deep(.ant-pagination-options-quick-jumper),
.payable-detail__pager :deep(.ant-select),
.payable-detail__pager :deep(.ant-select-selection-item),
.payable-detail__pager :deep(.ant-select-selection-placeholder),
.payable-detail__pager :deep(.ant-input) {
  font-size: 11px;
}

.payable-detail__pager :deep(.ant-select-single),
.payable-detail__pager :deep(.ant-select-selector) {
  box-sizing: border-box;
  height: 24px !important;
  min-height: 24px !important;
  line-height: 22px !important;
}

.payable-detail__pager :deep(.ant-select-selection-item),
.payable-detail__pager :deep(.ant-select-selection-placeholder) {
  line-height: 22px !important;
}

.payable-detail__pager :deep(.ant-pagination-options-quick-jumper input) {
  height: 24px;
  font-size: 11px;
}

:deep(.payable-detail-row--settled .vxe-body--column) {
  background-color: hsl(var(--primary) / 18%) !important;
}

:deep(.payable-detail-row--settled.row--hover .vxe-body--column) {
  background-color: hsl(var(--primary) / 28%) !important;
}

:deep(.payable-detail-row--partial .vxe-body--column) {
  background-color: hsl(var(--destructive) / 18%) !important;
}

:deep(.payable-detail-row--partial.row--hover .vxe-body--column) {
  background-color: hsl(var(--destructive) / 28%) !important;
}

:deep(.payable-detail-row--unpaid .vxe-body--column) {
  background-color: hsl(var(--card)) !important;
}

:deep(.payable-detail-row--unpaid.row--hover .vxe-body--column) {
  background-color: hsl(var(--muted) / 40%) !important;
}

.payable-detail__summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 24px;
  align-items: center;
  justify-content: flex-end;
  min-height: 38px;
  padding: 8px 12px;
  margin-top: 8px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 24%);
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
  box-shadow: inset 3px 0 0 #1677ff;
}

.payable-detail__summary b {
  font-variant-numeric: tabular-nums;
  color: hsl(var(--foreground));
}

@media (max-width: 640px) {
  .payable-detail__toolbar,
  .payable-detail__summary {
    flex-direction: column;
    align-items: flex-start;
  }

  .payable-detail__toolbar-actions {
    align-items: flex-start;
  }
}
</style>
