<script lang="ts" setup>import { financeValue, financeAdd } from '#/views/erp/finance/utils/finance-decimal';

import { financeMoney as erpPriceInputFormatter } from '#/views/erp/finance/utils/finance-decimal';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpPayableReportApi } from '#/api/erp/finance/payable/report';

import {
  computed,
  defineAsyncComponent,
  onBeforeUnmount,
  ref,
  watch,
} from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { downloadFileFromBlobPart } from '@vben/utils';

import { Alert } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  exportPayableReportDetail,
  getPayableReportDetailList,
} from '#/api/erp/finance/payable/report';

import { useDetailColumns } from '../data';

const props = withDefaults(
  defineProps<{
    bizTime?: string[];
    supplierId?: number;
  }>(),
  {
    supplierId: undefined,
    bizTime: () => [],
  },
);

const OtherPayableDetail = defineAsyncComponent(
  () => import('#/views/erp/finance/payable/misc/modules/form.vue'),
);
const [OtherPayableModal, otherPayableModalApi] = useVbenModal({
  connectedComponent: OtherPayableDetail,
  destroyOnClose: true,
});

const loading = ref(false);
const exportLoading = ref(false);
const loadError = ref('');
const detailList = ref<ErpPayableReportApi.PayableReportDetail[]>([]);
let loadSequence = 0;

const summary = computed(() => ({
  count: detailList.value.length,
  increaseAmount: detailList.value.reduce(
    (sum, item) => financeAdd(sum, financeValue(item.increaseAmount || 0)),
    0,
  ),
}));

const summaryItems = computed(() => [
  { label: '明细数', value: `${summary.value.count}` },
  {
    label: '增加金额',
    value: erpPriceInputFormatter(summary.value.increaseAmount),
  },
]);

const queryParams = computed(() => ({
  supplierId: props.supplierId,
  bizTime: props.bizTime,
}));

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: useDetailColumns(),
    data: detailList.value,
    border: true,
    minHeight: 480,
    height: 520,
    showHeaderOverflow: 'tooltip',
    showOverflow: 'tooltip',
    scrollX: { enabled: true, gt: 6 },
    scrollY: { enabled: true, gt: 12 },
    pagerConfig: { enabled: false },
    toolbarConfig: { enabled: false },
    rowConfig: {
      keyField: 'rowKey',
      isHover: true,
    },
  } as VxeTableGridOptions<ErpPayableReportApi.PayableReportDetail>,
});

async function renderDetailList() {
  await gridApi.grid.loadData(detailList.value);
}

async function loadData() {
  const sequence = ++loadSequence;
  loadError.value = '';
  if (!props.supplierId) {
    loading.value = false;
    detailList.value = [];
    await renderDetailList();
    return;
  }
  loading.value = true;
  try {
    const data = await getPayableReportDetailList(queryParams.value);
    if (sequence !== loadSequence) return;
    detailList.value = withDetailRowKeys(data || []);
    await renderDetailList();
  } catch {
    if (sequence !== loadSequence) return;
    detailList.value = [];
    await renderDetailList();
    loadError.value = '应付报表明细加载失败，请稍后重试';
  } finally {
    if (sequence === loadSequence) {
      loading.value = false;
    }
  }
}

async function handleExport() {
  if (!props.supplierId) return;
  exportLoading.value = true;
  try {
    const data = await exportPayableReportDetail(queryParams.value);
    downloadFileFromBlobPart({ fileName: '应付报表明细.xls', source: data });
  } finally {
    exportLoading.value = false;
  }
}

function buildDetailRowKey(
  row: ErpPayableReportApi.PayableReportDetail,
  index: number,
) {
  return [
    row.docType || 'none',
    row.bizId ?? 'none',
    row.docNo || 'none',
    index,
  ].join(':');
}

function withDetailRowKeys(rows: ErpPayableReportApi.PayableReportDetail[]) {
  return rows.map((row, index) => ({
    ...row,
    rowKey: buildDetailRowKey(row, index),
  }));
}

function handleOpenDetail(row: ErpPayableReportApi.PayableReportDetail) {
  if (!row.bizId) return;
  otherPayableModalApi.setData({ type: 'detail', id: row.bizId }).open();
}

watch(
  () => [props.supplierId, props.bizTime],
  async () => {
    await loadData();
  },
  { immediate: true, deep: true },
);

onBeforeUnmount(() => {
  loadSequence += 1;
});
</script>

<template>
  <div class="payable-report-detail h-full">
    <div class="payable-report-detail__toolbar">
      <span>明细按当前列表筛选的业务时间统计</span>
      <div class="payable-report-detail__toolbar-actions">
        <TableAction
          :actions="[
            {
              label: '导出',
              type: 'primary',
              icon: ACTION_ICON.DOWNLOAD,
              auth: ['erp:payable-report:export'],
              disabled: !supplierId,
              loading: exportLoading,
              onClick: handleExport,
            },
          ]"
        />
      </div>
    </div>
    <Alert
      v-if="loadError"
      class="mb-3"
      type="error"
      show-icon
      :message="loadError"
    />
    <Grid v-loading="loading" class="payable-report-detail__grid">
      <template #docNo="{ row }">
        <a
          v-if="row.bizId"
          class="cursor-pointer text-primary"
          @click.stop="handleOpenDetail(row)"
        >
          {{ row.docNo }}
        </a>
        <span v-else>{{ row.docNo || '-' }}</span>
      </template>
      <template #actions="{ row }">
        <TableAction
          :actions="[
            {
              label: '明细',
              type: 'link',
              icon: ACTION_ICON.VIEW,
              auth: ['erp:payable-misc:query'],
              disabled: !row.bizId,
              onClick: handleOpenDetail.bind(null, row),
            },
          ]"
        />
      </template>
      <template #fileUrl="{ row }">
        <a
          v-if="row.fileUrl"
          :href="row.fileUrl"
          target="_blank"
          rel="noreferrer"
          >查看</a
        >
        <span v-else>-</span>
      </template>
    </Grid>
    <div class="payable-report-detail__summary">
      <span v-for="item in summaryItems" :key="item.label">
        {{ item.label }}：<b>{{ item.value }}</b>
      </span>
    </div>
    <OtherPayableModal />
  </div>
</template>

<style scoped>
.payable-report-detail {
  font-size: 12px;
  color: hsl(var(--foreground));
}

.payable-report-detail__toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  min-height: 36px;
  margin-bottom: 8px;
  color: hsl(var(--muted-foreground));
}

.payable-report-detail__toolbar-actions {
  display: flex;
  align-items: center;
}

.payable-report-detail__toolbar-actions {
  gap: 16px;
}

.payable-report-detail__toolbar :deep(.ant-btn) {
  height: 28px;
  padding: 2px 10px;
  font-size: 12px;
}

:deep(.payable-report-detail__grid .vxe-table--render-default) {
  font-size: 12px;
}

.payable-report-detail__summary {
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

.payable-report-detail__summary b {
  font-variant-numeric: tabular-nums;
  color: hsl(var(--foreground));
}
</style>
