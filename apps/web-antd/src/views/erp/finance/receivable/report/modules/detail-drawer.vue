<script lang="ts" setup>import { financeValue, financeAdd } from '#/views/erp/finance/utils/finance-decimal';

import { financeMoney as erpPriceInputFormatter } from '#/views/erp/finance/utils/finance-decimal';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpReceivableReportApi } from '#/api/erp/finance/receivable/report';

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
  exportReceivableReportDetail,
  getReceivableReportDetailList,
} from '#/api/erp/finance/receivable/report';

import { useDetailColumns } from '../data';

const props = withDefaults(
  defineProps<{
    bizTime?: string[];
    customerId?: number;
  }>(),
  {
    customerId: undefined,
    bizTime: () => [],
  },
);

const OtherReceivableDetail = defineAsyncComponent(
  () => import('#/views/erp/finance/receivable/misc/modules/form.vue'),
);
const [OtherReceivableModal, otherReceivableModalApi] = useVbenModal({
  connectedComponent: OtherReceivableDetail,
  destroyOnClose: true,
});

const loading = ref(false);
const exportLoading = ref(false);
const loadError = ref('');
const detailList = ref<ErpReceivableReportApi.ReceivableReportDetail[]>([]);
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
  customerId: props.customerId,
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
  } as VxeTableGridOptions<ErpReceivableReportApi.ReceivableReportDetail>,
});

async function renderDetailList() {
  await gridApi.grid.loadData(detailList.value);
}

async function loadData() {
  const sequence = ++loadSequence;
  loadError.value = '';
  if (!props.customerId) {
    loading.value = false;
    detailList.value = [];
    await renderDetailList();
    return;
  }
  loading.value = true;
  try {
    const data = await getReceivableReportDetailList(queryParams.value);
    if (sequence !== loadSequence) return;
    detailList.value = withDetailRowKeys(data || []);
    await renderDetailList();
  } catch {
    if (sequence !== loadSequence) return;
    detailList.value = [];
    await renderDetailList();
    loadError.value = '应收报表明细加载失败，请稍后重试';
  } finally {
    if (sequence === loadSequence) {
      loading.value = false;
    }
  }
}

async function handleExport() {
  if (!props.customerId) return;
  exportLoading.value = true;
  try {
    const data = await exportReceivableReportDetail(queryParams.value);
    downloadFileFromBlobPart({ fileName: '应收报表明细.xls', source: data });
  } finally {
    exportLoading.value = false;
  }
}

function buildDetailRowKey(
  row: ErpReceivableReportApi.ReceivableReportDetail,
  index: number,
) {
  return [
    row.docType || 'none',
    row.bizId ?? 'none',
    row.docNo || 'none',
    index,
  ].join(':');
}

function withDetailRowKeys(
  rows: ErpReceivableReportApi.ReceivableReportDetail[],
) {
  return rows.map((row, index) => ({
    ...row,
    rowKey: buildDetailRowKey(row, index),
  }));
}

function handleOpenDetail(row: ErpReceivableReportApi.ReceivableReportDetail) {
  if (!row.bizId) return;
  otherReceivableModalApi.setData({ type: 'detail', id: row.bizId }).open();
}

watch(
  () => [props.customerId, props.bizTime],
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
  <div class="receivable-report-detail h-full">
    <div class="receivable-report-detail__toolbar">
      <span>明细按当前列表筛选的业务时间统计</span>
      <div class="receivable-report-detail__toolbar-actions">
        <TableAction
          :actions="[
            {
              label: '导出',
              type: 'primary',
              icon: ACTION_ICON.DOWNLOAD,
              auth: ['erp:receivable-report:export'],
              disabled: !customerId,
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
    <Grid v-loading="loading" class="receivable-report-detail__grid">
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
              auth: ['erp:receivable-misc:query'],
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
    <div class="receivable-report-detail__summary">
      <span v-for="item in summaryItems" :key="item.label">
        {{ item.label }}：<b>{{ item.value }}</b>
      </span>
    </div>
    <OtherReceivableModal />
  </div>
</template>

<style scoped>
.receivable-report-detail {
  font-size: 12px;
  color: hsl(var(--foreground));
}

.receivable-report-detail__toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  min-height: 36px;
  margin-bottom: 8px;
  color: hsl(var(--muted-foreground));
}

.receivable-report-detail__toolbar-actions {
  display: flex;
  align-items: center;
}

.receivable-report-detail__toolbar-actions {
  gap: 16px;
}

.receivable-report-detail__toolbar :deep(.ant-btn) {
  height: 28px;
  padding: 2px 10px;
  font-size: 12px;
}

:deep(.receivable-report-detail__grid .vxe-table--render-default) {
  font-size: 12px;
}

.receivable-report-detail__summary {
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

.receivable-report-detail__summary b {
  font-variant-numeric: tabular-nums;
  color: hsl(var(--foreground));
}
</style>
