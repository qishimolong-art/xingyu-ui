<script lang="ts" setup>import { financeValue, financeAdd } from '#/views/erp/finance/utils/finance-decimal';

import { financeMoney as erpPriceInputFormatter } from '#/views/erp/finance/utils/finance-decimal';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpSettlementOffsetApi } from '#/api/erp/finance/settlement/offset';

import { computed, onBeforeUnmount, ref, watch } from 'vue';

import { IconifyIcon } from '@vben/icons';
import { downloadFileFromBlobPart } from '@vben/utils';

import { Alert, Button, Tabs, Tag } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  exportSettlementOffsetDetail,
  getSettlementOffsetDetail,
} from '#/api/erp/finance/settlement/offset';
import { createVxeHeaderSort } from '#/views/erp/utils/vxe-header-sort';

import { usePayableDetailColumns, useReceivableDetailColumns } from '../data';
import {
  getPayableSettlementState,
  getPayableSettlementStateMeta,
  getReceivableSettlementState,
  getReceivableSettlementStateMeta,
} from '../offset-ui';

const props = withDefaults(
  defineProps<{
    approveTime?: string[];
    customerId?: number;
    supplierId?: number;
  }>(),
  {
    customerId: undefined,
    supplierId: undefined,
    approveTime: () => [],
  },
);

const activeKey = ref('receivable');
const loading = ref(false);
const exportLoading = ref(false);
const loadError = ref('');
const receivableDetails = ref<ErpSettlementOffsetApi.ReceivableDetail[]>([]);
const payableDetails = ref<ErpSettlementOffsetApi.PayableDetail[]>([]);
const receivableSortParams = ref<Record<string, string>>({
  receivableOrderDirection: 'asc',
  receivableOrderField: 'approveTime',
});
const payableSortParams = ref<Record<string, string>>({
  payableOrderDirection: 'asc',
  payableOrderField: 'approveTime',
});
let loadSequence = 0;

const receivableSummary = computed(() => ({
  count: receivableDetails.value.length,
  increase: receivableDetails.value.reduce(
    (sum, row) => financeAdd(sum, financeValue(row.increaseAmount || 0)),
    0,
  ),
  decrease: receivableDetails.value.reduce(
    (sum, row) => financeAdd(sum, financeValue(row.receiptAmount || 0)),
    0,
  ),
  writeOff: receivableDetails.value.reduce(
    (sum, row) => financeAdd(sum, financeValue(row.writeOffAmount || 0)),
    0,
  ),
}));
const payableSummary = computed(() => ({
  count: payableDetails.value.length,
  increase: payableDetails.value.reduce(
    (sum, row) => financeAdd(sum, financeValue(row.increaseAmount || 0)),
    0,
  ),
  decrease: payableDetails.value.reduce(
    (sum, row) => financeAdd(sum, financeValue(row.paymentAmount || 0)),
    0,
  ),
  writeOff: payableDetails.value.reduce(
    (sum, row) => financeAdd(sum, financeValue(row.writeOffAmount || 0)),
    0,
  ),
}));

const receivableSortFieldMap = {
  approveTime: 'approveTime',
  balance: 'balance',
  docDate: 'docDate',
  docNo: 'docNo',
  docType: 'docType',
  deptName: 'deptName',
  increaseAmount: 'increaseAmount',
  prevBalance: 'prevBalance',
  receiptAmount: 'receiptAmount',
  writeOffAmount: 'writeOffAmount',
};
const payableSortFieldMap = {
  approveTime: 'approveTime',
  balance: 'balance',
  docDate: 'docDate',
  docNo: 'docNo',
  docType: 'docType',
  deptName: 'deptName',
  increaseAmount: 'increaseAmount',
  paymentAmount: 'paymentAmount',
  prevBalance: 'prevBalance',
  writeOffAmount: 'writeOffAmount',
};

function getReceivableStatusMeta(row: ErpSettlementOffsetApi.ReceivableDetail) {
  return getReceivableSettlementStateMeta(getReceivableSettlementState(row));
}

function getPayableStatusMeta(row: ErpSettlementOffsetApi.PayableDetail) {
  return getPayableSettlementStateMeta(getPayableSettlementState(row));
}
const {
  buildSortParams: buildReceivableSortParams,
  handleSortChange: syncReceivableSort,
  resetSortState: resetReceivableSort,
  restoreSortState: restoreReceivableSort,
} = createVxeHeaderSort(receivableSortFieldMap, {
  field: 'approveTime',
  order: 'asc',
});
const {
  buildSortParams: buildPayableSortParams,
  handleSortChange: syncPayableSort,
  resetSortState: resetPayableSort,
  restoreSortState: restorePayableSort,
} = createVxeHeaderSort(payableSortFieldMap, {
  field: 'approveTime',
  order: 'asc',
});

function prefixSortParams(
  params: { orderDirection?: null | string; orderField?: string },
  prefix: 'payable' | 'receivable',
) {
  if (!params.orderField || !params.orderDirection) return {};
  return {
    [`${prefix}OrderField`]: params.orderField,
    [`${prefix}OrderDirection`]: params.orderDirection,
  };
}

const queryParams = computed(() => ({
  customerId: props.customerId,
  supplierId: props.supplierId,
  approveTime: props.approveTime,
  dateBasis: 'approveTime',
  ...receivableSortParams.value,
  ...payableSortParams.value,
}));

const [ReceivableGrid, receivableGridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: useReceivableDetailColumns([]),
    data: receivableDetails.value,
    border: true,
    fit: false,
    minHeight: 460,
    height: 500,
    showHeaderOverflow: 'tooltip',
    showOverflow: 'tooltip',
    scrollX: { enabled: true, gt: 6 },
    pagerConfig: { enabled: false },
    toolbarConfig: { enabled: false },
    rowConfig: { keyField: 'eventKey', isHover: true },
    sortConfig: {
      remote: true,
      multiple: false,
      trigger: 'cell',
      orders: ['asc', 'desc', null],
      allowBtn: false,
    },
  } as VxeTableGridOptions<ErpSettlementOffsetApi.ReceivableDetail>,
  gridEvents: { sortChange: handleReceivableSortChange },
});

const [PayableGrid, payableGridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: usePayableDetailColumns([]),
    data: payableDetails.value,
    border: true,
    fit: false,
    minHeight: 460,
    height: 500,
    showHeaderOverflow: 'tooltip',
    showOverflow: 'tooltip',
    scrollX: { enabled: true, gt: 6 },
    pagerConfig: { enabled: false },
    toolbarConfig: { enabled: false },
    rowConfig: { keyField: 'eventKey', isHover: true },
    sortConfig: {
      remote: true,
      multiple: false,
      trigger: 'cell',
      orders: ['asc', 'desc', null],
      allowBtn: false,
    },
  } as VxeTableGridOptions<ErpSettlementOffsetApi.PayableDetail>,
  gridEvents: { sortChange: handlePayableSortChange },
});

async function handleReceivableSortChange(params: any) {
  syncReceivableSort(params);
  const currentSort = params?.sort ?? params;
  receivableSortParams.value = prefixSortParams(
    buildReceivableSortParams(params?.sortList || params?.sorts, currentSort),
    'receivable',
  );
  await loadData();
}

async function handlePayableSortChange(params: any) {
  syncPayableSort(params);
  const currentSort = params?.sort ?? params;
  payableSortParams.value = prefixSortParams(
    buildPayableSortParams(params?.sortList || params?.sorts, currentSort),
    'payable',
  );
  await loadData();
}

async function loadData() {
  const sequence = ++loadSequence;
  loadError.value = '';
  if (!props.customerId || !props.supplierId) {
    loading.value = false;
    receivableDetails.value = [];
    payableDetails.value = [];
    await receivableGridApi.grid.reloadColumn(useReceivableDetailColumns([]));
    await payableGridApi.grid.reloadColumn(usePayableDetailColumns([]));
    await receivableGridApi.grid.reloadData([]);
    await payableGridApi.grid.reloadData([]);
    return;
  }
  loading.value = true;
  try {
    const data = await getSettlementOffsetDetail(queryParams.value);
    if (sequence !== loadSequence) return;
    receivableDetails.value = data.receivableDetails || [];
    payableDetails.value = data.payableDetails || [];
    await receivableGridApi.grid.reloadColumn(
      useReceivableDetailColumns(receivableDetails.value),
    );
    await payableGridApi.grid.reloadColumn(
      usePayableDetailColumns(payableDetails.value),
    );
    await receivableGridApi.grid.reloadData(receivableDetails.value);
    await payableGridApi.grid.reloadData(payableDetails.value);
    await Promise.all([
      restoreReceivableSort(receivableGridApi),
      restorePayableSort(payableGridApi),
    ]);
  } catch {
    if (sequence !== loadSequence) return;
    receivableDetails.value = [];
    payableDetails.value = [];
    await receivableGridApi.grid.reloadColumn(useReceivableDetailColumns([]));
    await payableGridApi.grid.reloadColumn(usePayableDetailColumns([]));
    await receivableGridApi.grid.reloadData([]);
    await payableGridApi.grid.reloadData([]);
    loadError.value = '往来明细加载失败，请稍后重试';
  } finally {
    if (sequence === loadSequence) {
      loading.value = false;
    }
  }
}

async function handleExport() {
  if (!props.customerId || !props.supplierId) {
    return;
  }
  exportLoading.value = true;
  try {
    const data = await exportSettlementOffsetDetail(queryParams.value);
    downloadFileFromBlobPart({ fileName: '应收冲应付明细.xls', source: data });
  } finally {
    exportLoading.value = false;
  }
}

watch(
  () => [props.customerId, props.supplierId, props.approveTime],
  async () => {
    receivableSortParams.value = {
      receivableOrderDirection: 'asc',
      receivableOrderField: 'approveTime',
    };
    payableSortParams.value = {
      payableOrderDirection: 'asc',
      payableOrderField: 'approveTime',
    };
    await Promise.all([
      resetReceivableSort(receivableGridApi),
      resetPayableSort(payableGridApi),
    ]);
    await loadData();
  },
  { immediate: true, deep: true },
);

onBeforeUnmount(() => {
  loadSequence += 1;
});
</script>

<template>
  <div class="offset-detail h-full">
    <div class="offset-detail__toolbar">
      <span>应收与应付明细按当前列表筛选的审批日期统计</span>
      <Button
        type="primary"
        :disabled="!customerId || !supplierId"
        :loading="exportLoading"
        @click="handleExport"
      >
        <template #icon>
          <IconifyIcon icon="lucide:download" />
        </template>
        导出
      </Button>
    </div>
    <Alert
      v-if="loadError"
      class="mb-3"
      type="error"
      show-icon
      :message="loadError"
    />
    <Tabs v-model:active-key="activeKey" class="offset-detail__tabs">
      <Tabs.TabPane key="receivable" force-render>
        <template #tab>
          <span
            >应收明细 <b>{{ receivableSummary.count }}</b></span
          >
        </template>
        <ReceivableGrid v-loading="loading" class="offset-detail__grid">
          <template #receiptStatus="{ row }">
            <Tag :color="getReceivableStatusMeta(row).color">
              {{ getReceivableStatusMeta(row).label }}
            </Tag>
          </template>
        </ReceivableGrid>
        <div class="offset-detail__summary offset-detail__summary--receivable">
          <span
            >明细数：<b>{{ receivableSummary.count }}</b></span
          >
          <span>
            增加金额：<b>{{
              erpPriceInputFormatter(receivableSummary.increase)
            }}</b>
          </span>
          <span>
            收款金额：<b>{{
              erpPriceInputFormatter(receivableSummary.decrease)
            }}</b>
          </span>
          <span>
            核销金额：<b>{{
              erpPriceInputFormatter(receivableSummary.writeOff)
            }}</b>
          </span>
        </div>
      </Tabs.TabPane>
      <Tabs.TabPane key="payable" force-render>
        <template #tab>
          <span
            >应付明细 <b>{{ payableSummary.count }}</b></span
          >
        </template>
        <PayableGrid v-loading="loading" class="offset-detail__grid">
          <template #paymentStatus="{ row }">
            <Tag :color="getPayableStatusMeta(row).color">
              {{ getPayableStatusMeta(row).label }}
            </Tag>
          </template>
        </PayableGrid>
        <div class="offset-detail__summary offset-detail__summary--payable">
          <span
            >明细数：<b>{{ payableSummary.count }}</b></span
          >
          <span>
            增加金额：<b>{{
              erpPriceInputFormatter(payableSummary.increase)
            }}</b>
          </span>
          <span>
            付款金额：<b>{{
              erpPriceInputFormatter(payableSummary.decrease)
            }}</b>
          </span>
          <span>
            核销金额：<b>{{
              erpPriceInputFormatter(payableSummary.writeOff)
            }}</b>
          </span>
        </div>
      </Tabs.TabPane>
    </Tabs>
  </div>
</template>

<style scoped>
.offset-detail {
  color: hsl(var(--foreground));
  font-size: 12px;
}

.offset-detail__toolbar {
  display: flex;
  min-height: 36px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
  color: hsl(var(--muted-foreground));
}

.offset-detail__toolbar :deep(.ant-btn) {
  height: 28px;
  padding: 2px 10px;
  font-size: 12px;
}

.offset-detail__tabs :deep(.ant-tabs-tab) {
  padding: 8px 0;
  font-size: 12px;
}

.offset-detail__tabs :deep(.ant-tabs-tab b) {
  margin-left: 4px;
  font-variant-numeric: tabular-nums;
}

:deep(.offset-detail__grid .vxe-table--render-default) {
  font-size: 12px;
}

:deep(.offset-detail__grid .vxe-header--column .vxe-cell--title) {
  white-space: nowrap;
}

:deep(.offset-detail__grid .vxe-header--column.is--sortable .vxe-cell--title) {
  color: #1677ff;
}

:deep(.offset-detail__grid .vxe-header--column .vxe-cell--sort) {
  display: none;
}

:deep(.offset-detail__grid .ant-tag) {
  margin-inline-end: 0;
  font-size: 12px;
}

.offset-detail__summary {
  display: flex;
  min-height: 38px;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px 24px;
  margin-top: 8px;
  padding: 8px 12px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 24%);
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.offset-detail__summary b {
  color: hsl(var(--foreground));
  font-variant-numeric: tabular-nums;
}

.offset-detail__summary--receivable {
  box-shadow: inset 3px 0 0 #1677ff;
}

.offset-detail__summary--payable {
  box-shadow: inset 3px 0 0 #d97706;
}

@media (max-width: 640px) {
  .offset-detail__toolbar,
  .offset-detail__summary {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
