<script lang="ts" setup>import { financeValue, financeCompare } from '#/views/erp/finance/utils/finance-decimal';

import { financeMoney as erpPriceInputFormatter } from '#/views/erp/finance/utils/finance-decimal';

import { useFinanceCandidateFocus } from '#/views/erp/finance/utils/candidate-focus';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpFinanceReceiptApi } from '#/api/erp/finance/receipt';
import type { ErpReceivableAccountApi } from '#/api/erp/finance/receivable/account';

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
import { getFinanceReceipt } from '#/api/erp/finance/receipt';
import {
  exportReceivableDrilldown,
  getReceivableAccountExportFields,
  getReceivableDrilldownPage,
} from '#/api/erp/finance/receivable/account';
import ExportFieldModalComponent from '#/views/erp/components/export-field-modal.vue';
import { getErpDetailLoadError } from '#/views/erp/utils/detail-load-error';
import { fitFinanceDocumentItemColumnsToWidth } from '#/views/erp/finance/utils/document-item-table';

import WriteOffModal from '../../../settlement/components/writeoff-modal.vue';
import { useDetailColumns, useDrilldownColumns } from '../data';
import { getReceivableDetailPaymentState } from '../receivable-account-ui';
const { candidatePopupClass } = useFinanceCandidateFocus();

type ReceivableDetailSortOrder = 'asc' | 'desc';

const props = withDefaults(
  defineProps<{
    approveTime?: string[];
    bizTime?: string[];
    customerId?: number;
    customerName?: string;
    deptId?: number;
    deptName?: string;
    deptUnassigned?: boolean;
    detailLabel?: string;
    detailType?: ErpReceivableAccountApi.ReceivableDrilldownType;
    displayMode?: 'drawer' | 'modal';
    readonly?: boolean;
    reportMode?: boolean;
    dateBasis?: 'approveTime' | 'bizTime';
  }>(),
  {
    customerId: undefined,
    customerName: '',
    deptId: undefined,
    deptName: '',
    deptUnassigned: false,
    detailLabel: '余额',
    detailType: 'BALANCE',
    displayMode: 'drawer',
    readonly: false,
    reportMode: false,
    dateBasis: 'bizTime',
    approveTime: () => [],
    bizTime: () => [],
  },
);
const emit = defineEmits<{ writeoffSuccess: [] }>();
const { hasAccessByCodes } = useAccess();
const SaleOutDetail = defineAsyncComponent(
  () => import('#/views/erp/sale/out/modules/form.vue'),
);
const SaleReturnDetail = defineAsyncComponent(
  () => import('#/views/erp/sale/return/modules/form.vue'),
);
const SalePriceAdjustDetail = defineAsyncComponent(
  () => import('#/views/erp/sale/priceadjust/modules/form.vue'),
);
const ReceiptDetail = defineAsyncComponent(
  () => import('#/views/erp/finance/settlement/receipt/modules/form.vue'),
);
const OtherReceivableDetail = defineAsyncComponent(
  () =>
    import('#/views/erp/finance/receivable/other-receivable/modules/form.vue'),
);
const MiscReceivableDetail = defineAsyncComponent(
  () => import('#/views/erp/finance/receivable/misc/modules/form.vue'),
);
const [SaleOutModal, saleOutModalApi] = useVbenModal({
  connectedComponent: SaleOutDetail,
  destroyOnClose: true,
});
const [SaleReturnModal, saleReturnModalApi] = useVbenModal({
  connectedComponent: SaleReturnDetail,
  destroyOnClose: true,
});
const [SalePriceAdjustModal, salePriceAdjustModalApi] = useVbenModal({
  connectedComponent: SalePriceAdjustDetail,
  destroyOnClose: true,
});
const [ReceiptModal, receiptModalApi] = useVbenModal({
  connectedComponent: ReceiptDetail,
  destroyOnClose: true,
});
const [OtherReceivableModal, otherReceivableModalApi] = useVbenModal({
  connectedComponent: OtherReceivableDetail,
  destroyOnClose: true,
});
const [MiscReceivableModal, miscReceivableModalApi] = useVbenModal({
  connectedComponent: MiscReceivableDetail,
  destroyOnClose: true,
});
const [ReceiptWriteOffModal, receiptWriteOffModalApi] = useVbenModal({
  connectedComponent: WriteOffModal,
  destroyOnClose: true,
});
const [ExportFieldModal, exportFieldModalApi] = useVbenModal({
  connectedComponent: ExportFieldModalComponent,
  destroyOnClose: true,
});

function getDetailModal(row: ErpReceivableAccountApi.ReceivableDetail) {
  const permission = getDetailPermission(row);
  if (!permission || !hasAccessByCodes([permission])) return;
  const bizModalMap: Record<number, any> = {
    [ErpBizType.SALE_OUT]: saleOutModalApi,
    [ErpBizType.SALE_RETURN]: saleReturnModalApi,
    [ErpBizType.SALE_PRICE_ADJUST]: salePriceAdjustModalApi,
    [ErpBizType.RECEIVABLE_MISC]: miscReceivableModalApi,
  };
  if (row.bizType && bizModalMap[row.bizType]) return bizModalMap[row.bizType];
  if (row.docType === '收款单' || row.docType === '其他应收收款') {
    return receiptModalApi;
  }
  if (row.docType === '应收调账') {
    return otherReceivableModalApi;
  }
}

function getDetailPermission(row: ErpReceivableAccountApi.ReceivableDetail) {
  const bizPermissionMap: Record<number, string> = {
    [ErpBizType.SALE_OUT]: 'erp:sale-out:query',
    [ErpBizType.SALE_RETURN]: 'erp:sale-return:query',
    [ErpBizType.SALE_PRICE_ADJUST]: 'erp:sale-price-adjust:query',
    [ErpBizType.RECEIVABLE_MISC]: 'erp:receivable-misc:query',
  };
  if (row.bizType && bizPermissionMap[row.bizType]) {
    return bizPermissionMap[row.bizType];
  }
  if (row.docType === '收款单' || row.docType === '其他应收收款') {
    return 'erp:finance-receipt:query';
  }
  if (row.docType === '应收调账') return 'erp:receivable-other:query';
}

function canOpenDetail(row: ErpReceivableAccountApi.ReceivableDetail) {
  return Boolean(
    (!props.readonly || props.reportMode) &&
    row.docNo &&
    row.bizId &&
    getDetailModal(row),
  );
}

function getSaleOutDocNoMarkers(row: ErpReceivableAccountApi.ReceivableDetail) {
  if (row.bizType !== ErpBizType.SALE_OUT) {
    return [];
  }
  const markers: string[] = [];
  if (row.returnStatus === 2) {
    markers.push('整退');
  } else if (row.returnStatus === 1) {
    markers.push('部分退');
  }
  if (row.priceAdjusted === true) {
    markers.push('调');
  }
  return markers;
}

function handleOpenDetail(row: ErpReceivableAccountApi.ReceivableDetail) {
  if (!canOpenDetail(row)) return;
  getDetailModal(row)?.setData({ type: 'detail', id: row.bizId }).open();
}

const loading = ref(false);
const exportLoading = ref(false);
const loadError = ref('');
const detailList = ref<ErpReceivableAccountApi.ReceivableDetail[]>([]);
const detailWrapRef = ref<HTMLElement>();
const detailTotal = ref(0);
const drilldownSummary = ref<ErpReceivableAccountApi.DrilldownSummary>({});
function defaultDetailSort() {
  return props.dateBasis === 'approveTime'
    ? ({ field: 'approveTime', order: 'asc' } as const)
    : null;
}
const activeDetailSort = ref<null | {
  field: keyof ErpReceivableAccountApi.ReceivableDetail;
  order: ReceivableDetailSortOrder;
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
  customerId: props.customerId,
  deptId: props.deptUnassigned ? undefined : props.deptId,
  deptUnassigned: props.deptUnassigned || undefined,
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
  const customerName = props.customerName || '当前客户';
  let deptName = props.deptName;
  if (!deptName) {
    if (props.deptUnassigned) {
      deptName = '未归属部门';
    } else if (props.deptId) {
      deptName = '当前部门';
    } else {
      deptName = '全部部门';
    }
  }
  return `${customerName} / ${deptName}`;
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
    hasAccessByCodes(['erp:finance-receipt:writeoff']) &&
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
      `receivable-detail-row--${getReceivableDetailPaymentState(row)}`,
    sortConfig: {
      remote: true,
      multiple: false,
      trigger: 'cell',
      orders: ['asc', 'desc', null],
      allowBtn: false,
    },
  } as VxeTableGridOptions<ErpReceivableAccountApi.ReceivableDetail>,
  gridEvents: {
    sortChange: handleDetailSortChange,
  },
});

async function handleDetailSortChange(params: any) {
  const currentSort = params?.sort ?? params;
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
  if (!props.customerId) {
    loading.value = false;
    detailList.value = [];
    detailTotal.value = 0;
    drilldownSummary.value = {};
    await renderDetailList();
    return;
  }
  loading.value = true;
  try {
    const data = await getReceivableDrilldownPage(queryParams.value);
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
  if (!props.customerId) {
    return;
  }
  exportFieldModalApi
    .setData({
      loadFields: () =>
        getReceivableAccountExportFields('drilldown', {
          dateBasis: props.dateBasis,
          detailType: props.detailType,
        }),
      moduleKey: 'erp_finance_receivable_account',
    })
    .open();
}

async function handleExportConfirm(fields: string[]) {
  exportLoading.value = true;
  try {
    const data = await exportReceivableDrilldown({
      ...queryParams.value,
      fields: fields.join(','),
    });
    downloadFileFromBlobPart({
      fileName: `应收-${props.detailLabel}明细.xls`,
      source: data,
    });
  } finally {
    exportLoading.value = false;
  }
}

function buildDetailRowKey(
  row: ErpReceivableAccountApi.ReceivableDetail,
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

function withDetailRowKeys(rows: ErpReceivableAccountApi.ReceivableDetail[]) {
  return rows.map((row, index) => ({
    ...row,
    receiptDisplayAmount: row.receiptDisplayAmount ?? row.receiptAmount,
    rowKey: buildDetailRowKey(row, index),
  }));
}

function isReceiptDetailRow(row: ErpReceivableAccountApi.ReceivableDetail) {
  return Boolean(
    !row.bizType &&
    row.bizId &&
    (financeCompare(financeValue(row.receiptAmount || 0), 0) !== 0) &&
    (financeCompare(financeValue(row.increaseAmount || 0), 0) <= 0) &&
    (financeCompare(financeValue(row.writeOffAmount || 0), 0) <= 0),
  );
}

function canWriteOff(row: ErpReceivableAccountApi.ReceivableDetail) {
  return Boolean(
    !props.readonly && props.customerId && isReceiptDetailRow(row),
  );
}

function handleOpenWriteOff(row: ErpReceivableAccountApi.ReceivableDetail) {
  if (!canWriteOff(row)) {
    return;
  }
  handleOpenReceiptWriteOff(row);
}

async function handleOpenReceiptWriteOff(
  row: ErpReceivableAccountApi.ReceivableDetail,
) {
  if (!row.bizId) return;
  try {
    const receipt = await getFinanceReceipt(row.bizId);
    if (!receipt || (financeCompare(financeValue(receipt.unallocatedPrice || 0), 0) === 0)) {
      message.warning('当前收款单没有未核销金额');
      return;
    }
    receiptWriteOffModalApi
      .setData({ type: 'receipt', record: receipt })
      .open();
  } catch (error) {
    message.error(
      getErpDetailLoadError(error, '收款单详情加载失败，请稍后重试'),
    );
  }
}

function handleReceiptDetailWriteOff(
  record: ErpFinanceReceiptApi.FinanceReceipt,
) {
  if (props.readonly) return;
  receiptWriteOffModalApi.setData({ type: 'receipt', record }).open();
}

async function handleReceiptWriteOffSuccess() {
  await loadData();
  emit('writeoffSuccess');
}

watch(
  () => [
    props.customerId,
    props.deptId,
    props.deptUnassigned,
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
    class="receivable-detail"
    :class="`receivable-detail--${displayMode}`"
  >
    <div class="receivable-detail__toolbar">
      <span>
        {{ detailLabel }}按当前列表筛选的{{
          dateBasis === 'approveTime' ? '审批日期' : '业务时间'
        }}与客户部门组合统计：{{ currentScopeText }}
      </span>
      <div
        v-if="!readonly || reportMode"
        class="receivable-detail__toolbar-actions"
      >
        <div
          v-if="detailType === 'BALANCE'"
          class="receivable-detail__legend"
          aria-label="收款核销状态图例"
        >
          <span class="receivable-detail__legend-item">
            <i class="receivable-detail__legend-dot--settled"></i>
            已完成收款/核销
          </span>
          <span class="receivable-detail__legend-item">
            <i class="receivable-detail__legend-dot--partial"></i>
            已收款但未收完
          </span>
          <span class="receivable-detail__legend-item">
            <i class="receivable-detail__legend-dot--unpaid"></i>
            未进行收款
          </span>
        </div>
        <TableAction
          :actions="[
            {
              label: '导出',
              type: 'primary',
              icon: ACTION_ICON.DOWNLOAD,
              auth: ['erp:receivable-account:query'],
              disabled: !customerId,
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
      :message="`请先选择${dateBasis === 'approveTime' ? '审批' : '业务'}开始时间后查看此前应收明细`"
    />
    <Alert
      v-if="loadError"
      class="mb-3"
      type="error"
      show-icon
      :message="loadError"
    />
    <Grid v-loading="loading" class="receivable-detail__grid">
      <template #docNo="{ row }">
        <a
          v-if="canOpenDetail(row)"
          class="cursor-pointer text-primary"
          @click.stop="handleOpenDetail(row)"
        >
          {{ row.docNo }}
          <span
            v-for="marker in getSaleOutDocNoMarkers(row)"
            :key="marker"
            class="receivable-detail__doc-marker"
          >
            （{{ marker }}）
          </span>
        </a>
        <span v-else>
          {{ row.docNo || '-' }}
          <span
            v-for="marker in getSaleOutDocNoMarkers(row)"
            :key="marker"
            class="receivable-detail__doc-marker"
          >
            （{{ marker }}）
          </span>
        </span>
      </template>
      <template #actions="{ row }">
        <TableAction
          v-if="!readonly && isReceiptDetailRow(row)"
          :actions="[
            {
              label: '核销',
              type: 'link',
              icon: ACTION_ICON.EDIT,
              auth: ['erp:finance-receipt:writeoff'],
              disabled: !canWriteOff(row),
              onClick: handleOpenWriteOff.bind(null, row),
            },
          ]"
        />
      </template>
    </Grid>
    <div class="receivable-detail__pager">
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
    <div class="receivable-detail__summary">
      <span v-for="item in summaryItems" :key="item.label">
        {{ item.label }}：<b>{{ item.value }}</b>
      </span>
    </div>
    <SaleOutModal />
    <SaleReturnModal />
    <SalePriceAdjustModal />
    <ReceiptModal @writeoff="handleReceiptDetailWriteOff" />
    <ReceiptWriteOffModal
      v-if="!readonly"
      @success="handleReceiptWriteOffSuccess"
    />
    <OtherReceivableModal />
    <MiscReceivableModal />
    <ExportFieldModal @confirm="handleExportConfirm" />
  </div>
</template>

<style scoped>
.receivable-detail {
  font-size: 12px;
  color: hsl(var(--foreground));
}

.receivable-detail__toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  min-height: 36px;
  margin-bottom: 8px;
  color: hsl(var(--muted-foreground));
}

.receivable-detail__toolbar-actions,
.receivable-detail__legend,
.receivable-detail__legend-item {
  display: flex;
  align-items: center;
}

.receivable-detail__toolbar-actions {
  gap: 16px;
}

.receivable-detail--modal .receivable-detail__toolbar {
  align-items: flex-start;
}

.receivable-detail--modal .receivable-detail__toolbar > span {
  line-height: 1.7;
}

.receivable-detail--modal .receivable-detail__toolbar-actions {
  flex-shrink: 0;
}

.receivable-detail__legend {
  flex-wrap: wrap;
  gap: 4px 12px;
  color: hsl(var(--muted-foreground));
}

.receivable-detail__legend-item {
  gap: 5px;
  white-space: nowrap;
}

.receivable-detail__legend-item i {
  width: 10px;
  height: 10px;
  border: 1px solid hsl(var(--border));
  border-radius: 2px;
}

.receivable-detail__legend-dot--settled {
  background: hsl(var(--primary));
}

.receivable-detail__legend-dot--partial {
  background: hsl(var(--destructive));
}

.receivable-detail__legend-dot--unpaid {
  background: hsl(var(--card));
}

.receivable-detail__toolbar :deep(.ant-btn) {
  height: 28px;
  padding: 2px 10px;
  font-size: 12px;
}

:deep(.receivable-detail__grid .vxe-table--render-default) {
  font-size: 12px;
}

:deep(.receivable-detail__grid .vxe-header--column .vxe-cell--title) {
  white-space: nowrap;
}

:deep(
  .receivable-detail__grid .vxe-header--column.is--sortable .vxe-cell--title
) {
  color: #1677ff;
}

:deep(.receivable-detail__grid .vxe-header--column .vxe-cell--sort) {
  display: none;
}

:deep(.receivable-detail__grid .table-actions .ant-btn-link) {
  height: auto;
  padding: 0;
  font-size: 12px;
}

.receivable-detail__doc-marker {
  color: #fa8c16;
}

.receivable-detail__pager {
  display: flex;
  justify-content: flex-end;
  padding: 8px 2px 0;
  font-size: 11px;
}

.receivable-detail__pager :deep(.ant-pagination),
.receivable-detail__pager :deep(.ant-pagination-item),
.receivable-detail__pager :deep(.ant-pagination-options),
.receivable-detail__pager :deep(.ant-pagination-options-quick-jumper),
.receivable-detail__pager :deep(.ant-select),
.receivable-detail__pager :deep(.ant-select-selection-item),
.receivable-detail__pager :deep(.ant-select-selection-placeholder),
.receivable-detail__pager :deep(.ant-input) {
  font-size: 11px;
}

.receivable-detail__pager :deep(.ant-select-single),
.receivable-detail__pager :deep(.ant-select-selector) {
  box-sizing: border-box;
  height: 24px !important;
  min-height: 24px !important;
  line-height: 22px !important;
}

.receivable-detail__pager :deep(.ant-select-selection-item),
.receivable-detail__pager :deep(.ant-select-selection-placeholder) {
  line-height: 22px !important;
}

.receivable-detail__pager :deep(.ant-pagination-options-quick-jumper input) {
  height: 24px;
  font-size: 11px;
}

:deep(.receivable-detail-row--settled .vxe-body--column) {
  background-color: hsl(var(--primary) / 18%) !important;
}

:deep(.receivable-detail-row--settled.row--hover .vxe-body--column) {
  background-color: hsl(var(--primary) / 28%) !important;
}

:deep(.receivable-detail-row--partial .vxe-body--column) {
  background-color: hsl(var(--destructive) / 18%) !important;
}

:deep(.receivable-detail-row--partial.row--hover .vxe-body--column) {
  background-color: hsl(var(--destructive) / 28%) !important;
}

:deep(.receivable-detail-row--unpaid .vxe-body--column) {
  background-color: hsl(var(--card)) !important;
}

:deep(.receivable-detail-row--unpaid.row--hover .vxe-body--column) {
  background-color: hsl(var(--muted) / 40%) !important;
}

.receivable-detail__summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 24px;
  align-items: center;
  justify-content: flex-end;
  min-height: 38px;
  padding: 8px 12px;
  margin-top: 6px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 24%);
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
  box-shadow: inset 3px 0 0 #1677ff;
}

.receivable-detail__summary b {
  font-variant-numeric: tabular-nums;
  color: hsl(var(--foreground));
}

@media (max-width: 640px) {
  .receivable-detail__toolbar,
  .receivable-detail__summary {
    flex-direction: column;
    align-items: flex-start;
  }

  .receivable-detail__toolbar-actions {
    align-items: flex-start;
  }
}
</style>
