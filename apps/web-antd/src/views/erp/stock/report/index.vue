<script lang="ts" setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';

import { useAccess } from '@vben/access';

import BusinessReportEmptyState from '#/views/erp/report/components/business-report-empty-state.vue';
import BusinessReportShell from '#/views/erp/report/components/business-report-shell.vue';

import StockRecordTab from '../record/modules/stock-record-tab.vue';
import StockAgeTable from './modules/stock-age-table.vue';
import StockCheckReadonlyTable from './modules/stock-check-readonly-table.vue';
import StockInDetailReportTable from './modules/stock-in-detail-report-table.vue';
import StockOutDetailReportTable from './modules/stock-out-detail-report-table.vue';
import StockRealtimeTable from './modules/stock-realtime-table.vue';
import StockTransferInDetailReportTable from './modules/stock-transfer-in-detail-report-table.vue';
import StockTransferOutDetailReportTable from './modules/stock-transfer-out-detail-report-table.vue';

defineOptions({ name: 'ErpStockReport' });

const route = useRoute();
const { hasAccessByCodes } = useAccess();

const currentPath = computed(() =>
  typeof route?.path === 'string' ? route.path : '',
);
const canCurrentMenu = computed(() => {
  const matched = Array.isArray(route?.matched) ? route.matched : [];
  return (
    matched.length > 0 &&
    (currentPath.value === '/erp/business-report/inventory' ||
      currentPath.value.startsWith('/erp/business-report/inventory/'))
  );
});
const canQueryRealtime = computed(() => hasAccessByCodes(['erp:stock:query']));
const canQueryRecords = computed(() =>
  hasAccessByCodes(['erp:stock-record:query']),
);
const canQueryCheck = computed(() =>
  hasAccessByCodes(['erp:stock-check:query']),
);
const canQueryTransferOutDetail = computed(
  () =>
    hasAccessByCodes(['erp:stock-transfer-out-detail-report:query']) &&
    hasAccessByCodes(['erp:stock-transfer-out:query']),
);
const canQueryTransferInDetail = computed(
  () =>
    hasAccessByCodes(['erp:stock-transfer-in-detail-report:query']) &&
    hasAccessByCodes(['erp:stock-transfer-in:query']),
);
const canQueryStockInDetail = computed(
  () =>
    hasAccessByCodes(['erp:stock-in-detail-report:query']) &&
    hasAccessByCodes(['erp:stock-in:query']),
);
const canQueryStockOutDetail = computed(
  () =>
    hasAccessByCodes(['erp:stock-out-detail-report:query']) &&
    hasAccessByCodes(['erp:stock-out:query']),
);

type PageKey =
  | 'age'
  | 'balance'
  | 'check'
  | 'legacy'
  | 'movement'
  | 'other-in-detail'
  | 'other-out-detail'
  | 'realtime'
  | 'trace'
  | 'transfer-in-detail'
  | 'transfer-out-detail'
  | 'turnover';

const pagePermissions: Record<PageKey, () => boolean> = {
  age: () => canQueryRecords.value,
  balance: () => canQueryRecords.value,
  check: () => canQueryCheck.value,
  legacy: () => canQueryRecords.value,
  movement: () => canQueryRecords.value,
  'other-in-detail': () => canQueryStockInDetail.value,
  'other-out-detail': () => canQueryStockOutDetail.value,
  realtime: () => canQueryRealtime.value,
  trace: () => canQueryRecords.value,
  'transfer-in-detail': () => canQueryTransferInDetail.value,
  'transfer-out-detail': () => canQueryTransferOutDetail.value,
  turnover: () => canQueryRecords.value,
};

const pageTitles: Record<PageKey, string> = {
  age: '库龄分析',
  balance: '收发存汇总',
  check: '配件盈亏明细表',
  legacy: '历史口径',
  movement: '库存进出流水明细账',
  'other-in-detail': '其他入库明细报表',
  'other-out-detail': '其他出库明细报表',
  realtime: '实时库存',
  trace: '商品追溯',
  'transfer-in-detail': '调拨入库查询报表',
  'transfer-out-detail': '调拨出库查询报表',
  turnover: '库存周转分析',
};

const emptyStates: Record<
  Exclude<
    PageKey,
    | 'age'
    | 'balance'
    | 'check'
    | 'legacy'
    | 'movement'
    | 'other-in-detail'
    | 'other-out-detail'
    | 'realtime'
    | 'trace'
    | 'transfer-in-detail'
    | 'transfer-out-detail'
  >,
  {
    description: string;
    status: 'PENDING_INTERFACE' | 'PENDING_RULE';
    title: string;
  }
> = {
  turnover: {
    title: '库存周转分析待计算规则确认',
    status: 'PENDING_RULE',
    description:
      '需要先确认销售成本、平均库存金额、无销量和库存为零等场景的处理口径，确认后再输出周转率。',
  },
};

function normalizePageKey(value: unknown): PageKey {
  if (typeof value !== 'string') return 'realtime';
  const key = value.split('/').findLast(Boolean) as PageKey | undefined;
  return key && key in pageTitles ? key : 'realtime';
}

const pageKey = computed(() => normalizePageKey(route?.path));
const pageTitle = computed(() => pageTitles[pageKey.value]);
const canCurrentPage = computed(
  () => canCurrentMenu.value || (pagePermissions[pageKey.value]?.() ?? false),
);
const emptyState = computed(() =>
  pageKey.value in emptyStates
    ? emptyStates[pageKey.value as keyof typeof emptyStates]
    : undefined,
);
</script>

<template>
  <BusinessReportShell
    :title="`经营报表 · 库存管理 · ${pageTitle}`"
    :denied="!canCurrentPage"
    body-scrollable
  >
    <StockRealtimeTable v-if="pageKey === 'realtime'" />
    <StockRecordTab
      v-else-if="pageKey === 'movement'"
      fixed-height
      table-title="库存进出流水明细账"
    />
    <StockRecordTab
      v-else-if="pageKey === 'balance'"
      fixed-height
      table-title="收发存汇总"
    />
    <StockRecordTab
      v-else-if="pageKey === 'trace'"
      fixed-height
      table-title="商品追溯"
    />
    <StockCheckReadonlyTable v-else-if="pageKey === 'check'" />
    <StockAgeTable v-else-if="pageKey === 'age'" />
    <StockTransferOutDetailReportTable
      v-else-if="pageKey === 'transfer-out-detail'"
    />
    <StockTransferInDetailReportTable
      v-else-if="pageKey === 'transfer-in-detail'"
    />
    <StockInDetailReportTable v-else-if="pageKey === 'other-in-detail'" />
    <StockOutDetailReportTable v-else-if="pageKey === 'other-out-detail'" />
    <StockRecordTab
      v-else-if="pageKey === 'legacy'"
      fixed-height
      table-title="历史库存流水"
    />
    <BusinessReportEmptyState
      v-else-if="emptyState"
      :title="emptyState.title"
      :status="emptyState.status"
      :description="emptyState.description"
    />
  </BusinessReportShell>
</template>
