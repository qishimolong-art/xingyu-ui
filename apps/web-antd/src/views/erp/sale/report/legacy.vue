<script lang="ts" setup>
import type { EchartsUIType } from '@vben/plugins/echarts';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpSaleReportApi } from '#/api/erp/report/sale';

import { computed, nextTick, onMounted, ref } from 'vue';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { EchartsUI, useEcharts } from '@vben/plugins/echarts';
import { downloadFileFromBlobPart } from '@vben/utils';

import { formatSaleAmount } from '../utils/decimal';

import { Card } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  exportSaleReport,
  getSaleReportPage,
  getSaleReportSummary,
  getSaleReportTrend,
} from '#/api/erp/report/sale';
import ErpActivationRefreshMask from '#/views/erp/components/ErpActivationRefreshMask.vue';
import { queueFocusSaleKeywordSearchInput } from '#/views/erp/sale/utils/keyword-search-focus';
import { useVxeActivationRefresh } from '#/views/erp/utils/activation-refresh';
import { submitSearchFormOnEnterAndBlur } from '#/views/erp/utils/keyboard';
import { createVxeHeaderSort } from '#/views/erp/utils/vxe-header-sort';

import {
  SALE_REPORT_SORT_FIELD_MAP,
  useGridColumns,
  useGridFormSchema,
} from './data';
import DetailDrawer from './modules/detail-drawer.vue';

defineOptions({ name: 'ErpSaleReportLegacy' });

const currentCustomerId = ref<number>();
const currentBizTime = ref<string[]>([]);
const exportLoading = ref(false);
const pageRows = ref<ErpSaleReportApi.SaleReport[]>([]);
const trendRows = ref<ErpSaleReportApi.SaleReportTrend[]>([]);
const summary = ref<ErpSaleReportApi.SaleReportSummary>({});
const saleReportGridShellRef = ref<HTMLElement>();

const trendChartRef = ref<EchartsUIType>();
const rankChartRef = ref<EchartsUIType>();
const { renderEcharts: renderTrendChart } = useEcharts(trendChartRef);
const { renderEcharts: renderRankChart } = useEcharts(rankChartRef);

const [Drawer, drawerApi] = useVbenDrawer({
  title: '销售报表明细',
  footer: false,
  destroyOnClose: true,
});

const summaryItems = computed(() => [
  { label: '客户数', value: `${summary.value.customerCount || 0}` },
  { label: '单据数', value: `${summary.value.docCount || 0}` },
  { label: '出库金额', value: formatMoney(summary.value.saleAmount) },
  { label: '退货金额', value: formatMoney(summary.value.returnAmount) },
  { label: '销售净额', value: formatMoney(summary.value.netAmount) },
]);

const AMOUNT_FIELDS = new Set(['netAmount', 'returnAmount', 'saleAmount']);

function buildFooter({ columns, data }: { columns: any[]; data: any[] }) {
  return [
    columns.map((column) => {
      if (column.field === 'customerName') return '本页小计';
      if (column.field === 'docCount') return sumAmount(data, 'docCount');
      if (column.field === 'saleCount') return sumAmount(data, 'saleCount');
      if (column.field === 'returnCount') return sumAmount(data, 'returnCount');
      if (AMOUNT_FIELDS.has(column.field)) {
        return formatMoney(sumAmount(data, column.field));
      }
      return '';
    }),
  ];
}

async function refreshOverview(params: Record<string, any>) {
  const [summaryData, trendData] = await Promise.all([
    getSaleReportSummary(params),
    getSaleReportTrend(params),
  ]);
  summary.value = summaryData || {};
  trendRows.value = trendData || [];
  await nextTick();
  renderCharts();
}

function renderCharts() {
  renderTrendChart({
    color: ['#1677ff', '#52c41a', '#ff7875'],
    grid: { left: 24, right: 18, bottom: 24, top: 44, containLabel: true },
    legend: { top: 8 },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: trendRows.value.map((item) => item.period || ''),
    },
    yAxis: { type: 'value' },
    series: [
      {
        name: '销售净额',
        type: 'line',
        smooth: true,
        data: trendRows.value.map((item) => Number(item.netAmount || 0)),
      },
      {
        name: '出库金额',
        type: 'bar',
        data: trendRows.value.map((item) => Number(item.saleAmount || 0)),
      },
      {
        name: '退货金额',
        type: 'bar',
        data: trendRows.value.map((item) => Number(item.returnAmount || 0)),
      },
    ],
  });

  const rankRows = pageRows.value
    .toSorted((a, b) => Number(b.netAmount || 0) - Number(a.netAmount || 0))
    .slice(0, 8);
  renderRankChart({
    color: ['#13c2c2'],
    grid: { left: 24, right: 18, bottom: 24, top: 18, containLabel: true },
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    xAxis: { type: 'value' },
    yAxis: {
      type: 'category',
      data: rankRows.map((item) => item.customerName || '-').toReversed(),
    },
    series: [
      {
        name: '销售净额',
        type: 'bar',
        barMaxWidth: 18,
        data: rankRows.map((item) => Number(item.netAmount || 0)).toReversed(),
      },
    ],
  });
}

async function handleOpenDetail(row: ErpSaleReportApi.SaleReport) {
  currentCustomerId.value = row.customerId;
  const formValues = await gridApi.formApi.getValues();
  currentBizTime.value = formValues.bizTime || [];
  drawerApi
    .setState({
      title: row.customerName
        ? `销售报表明细 - ${row.customerName}`
        : '销售报表明细',
    })
    .open();
}

function handleCellClick({
  column,
  row,
}: {
  column: any;
  row: ErpSaleReportApi.SaleReport;
}) {
  if (
    !column?.field ||
    column?.type === 'checkbox' ||
    column?.slots?.default === 'actions'
  ) {
    return;
  }
  void handleOpenDetail(row);
}

async function handleExport() {
  exportLoading.value = true;
  try {
    const formValues = await gridApi.formApi.getValues();
    const data = await exportSaleReport({
      ...formValues,
      ...buildSortParams(),
    });
    downloadFileFromBlobPart({ fileName: '销售报表.xls', source: data });
  } finally {
    exportLoading.value = false;
  }
}

function handleSearchEnter(event: KeyboardEvent) {
  submitSearchFormOnEnterAndBlur(event, () => gridApi.formApi.submitForm());
}

function sumAmount(rows: any[], field: string) {
  return rows.reduce((sum, item) => sum + Number(item[field] || 0), 0);
}

function formatMoney(value?: number) {
  return value === null || value === undefined
    ? '****'
    : formatSaleAmount(value);
}

const { buildSortParams, handleSortChange, restoreSortState } =
  createVxeHeaderSort(SALE_REPORT_SORT_FIELD_MAP);

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    commonConfig: { labelWidth: 76 },
    schema: useGridFormSchema(),
    collapsed: true,
    collapsedRows: 1,
  },
  gridOptions: {
    columns: useGridColumns(),
    customConfig: {
      storage: { fixed: true, resizable: true, sort: true, visible: true },
    },
    footerMethod: buildFooter,
    height: 'auto',
    id: 'erp-sale-report-list-v1',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page, sort, sorts }, formValues) => {
          const params = { ...formValues, ...buildSortParams(sorts, sort) };
          await refreshOverview(params);
          const result = await getSaleReportPage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            ...params,
          });
          pageRows.value = result.list || [];
          await nextTick();
          renderCharts();
          return result;
        },
        querySuccess: () => void restoreSortState(gridApi),
      },
      sort: true,
    },
    rowConfig: { keyField: 'customerId', isHover: true, isCurrent: true },
    scrollX: { enabled: true, gt: 10 },
    scrollY: { enabled: true, gt: 10 },
    showFooter: true,
    showHeaderOverflow: 'tooltip',
    showOverflow: 'tooltip',
    sortConfig: {
      remote: true,
      multiple: false,
      trigger: 'cell',
      orders: ['asc', 'desc', null],
      allowBtn: false,
    },
    toolbarConfig: { refresh: true, search: true },
  } as VxeTableGridOptions<ErpSaleReportApi.SaleReport>,
  gridEvents: {
    cellClick: handleCellClick,
    sortChange: handleSortChange,
  },
});

const { activationRefreshMaskVisible } =
  useVxeActivationRefresh<ErpSaleReportApi.SaleReport>({
    errorMessage: 'Error occurred while refreshing sale report page:',
    gridApi,
    getParams: async () => ({
      ...(await gridApi.formApi.getValues()),
      ...buildSortParams(),
    }),
    queryPage: getSaleReportPage,
    onSuccess: (rows) => {
      pageRows.value = rows;
      void restoreSortState(gridApi);
      renderCharts();
    },
    onAfterRefresh: () => {
      queueFocusSaleKeywordSearchInput(saleReportGridShellRef);
    },
    onFirstActivated: () => {
      queueFocusSaleKeywordSearchInput(saleReportGridShellRef);
    },
  });

onMounted(() => {
  queueFocusSaleKeywordSearchInput(saleReportGridShellRef);
});
</script>

<template>
  <Page auto-content-height>
    <Drawer class="w-[85vw]">
      <DetailDrawer
        :customer-id="currentCustomerId"
        :biz-time="currentBizTime"
      />
    </Drawer>
    <div class="erp-report-shell">
      <div class="erp-report-overview">
        <Card
          v-for="item in summaryItems"
          :key="item.label"
          class="erp-report-kpi"
          size="small"
        >
          <div class="erp-report-kpi__label">{{ item.label }}</div>
          <div class="erp-report-kpi__value">{{ item.value }}</div>
        </Card>
      </div>
      <div class="erp-report-charts">
        <Card size="small" title="销售金额和出库退货趋势">
          <EchartsUI ref="trendChartRef" class="erp-report-chart" />
        </Card>
        <Card size="small" title="客户销售净额排行">
          <EchartsUI ref="rankChartRef" class="erp-report-chart" />
        </Card>
      </div>
      <div ref="saleReportGridShellRef" class="erp-report-grid-shell">
        <Grid
          table-title="销售报表列表"
          @keydown.enter.capture="handleSearchEnter"
        >
          <template #toolbar-tools>
            <TableAction
              :actions="[
                {
                  label: '导出',
                  type: 'primary',
                  icon: ACTION_ICON.DOWNLOAD,
                  auth: ['erp:sale-report:export'],
                  loading: exportLoading,
                  onClick: handleExport,
                },
              ]"
            />
          </template>
          <template #customerName="{ row }">
            <button
              type="button"
              class="erp-report-link"
              :title="row.customerName || ''"
              @click.stop="handleOpenDetail(row)"
            >
              {{ row.customerName || '-' }}
            </button>
          </template>
          <template #actions="{ row }">
            <TableAction
              :actions="[
                {
                  label: '明细',
                  type: 'link',
                  icon: ACTION_ICON.VIEW,
                  auth: ['erp:sale-report:query'],
                  onClick: handleOpenDetail.bind(null, row),
                },
              ]"
            />
          </template>
        </Grid>
        <ErpActivationRefreshMask
          v-if="activationRefreshMaskVisible"
          class="erp-report-activation-mask"
        />
      </div>
    </div>
  </Page>
</template>

<style scoped>
.erp-report-shell {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
  min-height: 100%;
}

.erp-report-overview {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
}

.erp-report-kpi__label {
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.erp-report-kpi__value {
  margin-top: 4px;
  overflow: hidden;
  font-size: 20px;
  font-weight: 600;
  line-height: 28px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.erp-report-charts {
  display: grid;
  grid-template-columns: minmax(0, 3fr) minmax(280px, 2fr);
  gap: 10px;
}

.erp-report-chart {
  height: 220px;
}

.erp-report-grid-shell {
  position: relative;
  flex: 1;
  min-height: 420px;
}

:deep(.vxe-table--render-default),
:deep(.vxe-grid--form-wrapper) {
  font-size: 12px;
}

@media (max-width: 1280px) {
  .erp-report-overview,
  .erp-report-charts {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

:deep(.vxe-header--column.is--sortable .vxe-cell--title) {
  color: #1677ff;
}

:deep(.vxe-header--column .vxe-cell--sort) {
  display: none;
}

.erp-report-link {
  display: block;
  max-width: 100%;
  padding: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font: inherit;
  color: hsl(var(--primary));
  white-space: nowrap;
  cursor: pointer;
  background: transparent;
  border: 0;
}

.erp-report-link:hover,
.erp-report-link:focus-visible {
  text-decoration: underline;
}
</style>
