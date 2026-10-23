<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpSaleReportApi } from '#/api/erp/report/sale';

import { computed, onBeforeUnmount, ref, watch } from 'vue';

import { downloadFileFromBlobPart } from '@vben/utils';

import { formatSaleAmount } from '../../utils/decimal';

import { Alert } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  exportSaleReportDetail,
  getSaleReportDetailList,
} from '#/api/erp/report/sale';

import { useDetailColumns } from '../data';

const props = withDefaults(
  defineProps<{
    bizTime?: string[];
    customerId?: number;
  }>(),
  {
    bizTime: () => [],
    customerId: undefined,
  },
);

const loading = ref(false);
const exportLoading = ref(false);
const loadError = ref('');
const detailList = ref<ErpSaleReportApi.SaleReportDetail[]>([]);
let loadSequence = 0;

const summaryItems = computed(() => [
  { label: '明细数', value: `${detailList.value.length}` },
  {
    label: '出库金额',
    value: formatMoney(sumAmount('saleAmount')),
  },
  {
    label: '退货金额',
    value: formatMoney(sumAmount('returnAmount')),
  },
  {
    label: '销售净额',
    value: formatMoney(sumAmount('netAmount')),
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
    height: 520,
    minHeight: 480,
    pagerConfig: { enabled: false },
    rowConfig: {
      keyField: 'rowKey',
      isHover: true,
    },
    scrollX: { enabled: true, gt: 6 },
    scrollY: { enabled: true, gt: 12 },
    showHeaderOverflow: 'tooltip',
    showOverflow: 'tooltip',
    toolbarConfig: { enabled: false },
  } as VxeTableGridOptions<ErpSaleReportApi.SaleReportDetail>,
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
    const data = await getSaleReportDetailList(queryParams.value);
    if (sequence !== loadSequence) return;
    detailList.value = withDetailRowKeys(data || []);
    await renderDetailList();
  } catch {
    if (sequence !== loadSequence) return;
    detailList.value = [];
    await renderDetailList();
    loadError.value = '销售报表明细加载失败，请稍后重试';
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
    const data = await exportSaleReportDetail(queryParams.value);
    downloadFileFromBlobPart({ fileName: '销售报表明细.xls', source: data });
  } finally {
    exportLoading.value = false;
  }
}

function withDetailRowKeys(rows: ErpSaleReportApi.SaleReportDetail[]) {
  return rows.map((row, index) => ({
    ...row,
    rowKey:
      row.rowKey ||
      [row.docType || 'none', row.bizId ?? 'none', index].join(':'),
  }));
}

function sumAmount(field: keyof ErpSaleReportApi.SaleReportDetail) {
  return detailList.value.reduce(
    (sum, item) => sum + Number(item[field] || 0),
    0,
  );
}

function formatMoney(value: number) {
  return formatSaleAmount(value);
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
  <div class="erp-report-detail h-full">
    <div class="erp-report-detail__toolbar">
      <span>明细按当前列表筛选的业务时间统计</span>
      <TableAction
        :actions="[
          {
            label: '导出',
            type: 'primary',
            icon: ACTION_ICON.DOWNLOAD,
            auth: ['erp:sale-report:export'],
            disabled: !customerId,
            loading: exportLoading,
            onClick: handleExport,
          },
        ]"
      />
    </div>
    <Alert
      v-if="loadError"
      class="mb-3"
      type="error"
      show-icon
      :message="loadError"
    />
    <Grid v-loading="loading" class="erp-report-detail__grid" />
    <div class="erp-report-detail__summary">
      <span v-for="item in summaryItems" :key="item.label">
        {{ item.label }}：<b>{{ item.value }}</b>
      </span>
    </div>
  </div>
</template>

<style scoped>
.erp-report-detail {
  font-size: 12px;
  color: hsl(var(--foreground));
}

.erp-report-detail__toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  min-height: 36px;
  margin-bottom: 8px;
  color: hsl(var(--muted-foreground));
}

.erp-report-detail__toolbar :deep(.ant-btn) {
  height: 28px;
  padding: 2px 10px;
  font-size: 12px;
}

:deep(.erp-report-detail__grid .vxe-table--render-default) {
  font-size: 12px;
}

.erp-report-detail__summary {
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
}

.erp-report-detail__summary b {
  font-variant-numeric: tabular-nums;
  color: hsl(var(--foreground));
}
</style>
