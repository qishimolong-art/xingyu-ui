<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpPurchaseReportApi } from '#/api/erp/report/purchase';
import type { EchartsUIType } from '@vben/plugins/echarts';

import { computed, nextTick, onActivated, onMounted, reactive, ref } from 'vue';

import { Page, useVbenDrawer } from '@vben/common-ui';
import { downloadFileFromBlobPart } from '@vben/utils';
import { EchartsUI, useEcharts } from '@vben/plugins/echarts';

import {
  Button,
  Card,
  DatePicker,
  Input,
  Select,
  TabPane,
  Tabs,
  TreeSelect,
} from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import { formatPurchaseAmount, formatPurchaseDecimal } from '#/views/erp/purchase/utils/decimal';
import {
  exportPurchaseReport,
  exportPurchaseReportDept,
  exportPurchaseReportDetail,
  exportPurchaseReportProduct,
  getPurchaseReportDeptPage,
  getPurchaseReportDetailPage,
  getPurchaseReportPage,
  getPurchaseReportProductPage,
  getPurchaseReportSummary,
  getPurchaseReportTrend,
} from '#/api/erp/report/purchase';
import { getSimpleUserList } from '#/api/system/user';
import ErpActivationRefreshMask from '#/views/erp/components/ErpActivationRefreshMask.vue';
import SupplierLazySelect from '#/views/erp/purchase/components/SupplierLazySelect.vue';
import { queueFocusPurchaseKeywordSearchInput } from '#/views/erp/purchase/utils/keyword-search-focus';
import { useVxeActivationRefresh } from '#/views/erp/utils/activation-refresh';
import { createVxeHeaderSort } from '#/views/erp/utils/vxe-header-sort';

import { getPurchaseReportSearchDeptTree } from '../utils/dept';
import {
  PURCHASE_DEPT_REPORT_SORT_FIELD_MAP,
  PURCHASE_PRODUCT_REPORT_SORT_FIELD_MAP,
  PURCHASE_REPORT_SORT_FIELD_MAP,
  useDeptGridColumns,
  useDetailColumns,
  useGridColumns,
  useProductGridColumns,
} from './data';
import DetailDrawer from './modules/detail-drawer.vue';

defineOptions({ name: 'ErpPurchaseReportLegacy' });

type ReportTab = 'dept' | 'detail' | 'product' | 'supplier';

const activeTab = ref<ReportTab>('supplier');
const currentSupplierId = ref<number>();
const currentBizTime = ref<string[]>([]);
const exportLoading = ref(false);
const pageRows = ref<ErpPurchaseReportApi.PurchaseReport[]>([]);
const supplierRankRows = ref<ErpPurchaseReportApi.PurchaseReport[]>([]);
const productRows = ref<ErpPurchaseReportApi.PurchaseProductReport[]>([]);
const deptRows = ref<ErpPurchaseReportApi.PurchaseDeptReport[]>([]);
const detailRows = ref<ErpPurchaseReportApi.PurchaseReportDetail[]>([]);
const trendRows = ref<ErpPurchaseReportApi.PurchaseReportTrend[]>([]);
const summary = ref<ErpPurchaseReportApi.PurchaseReportSummary>({});
const purchaseReportShellRef = ref<HTMLElement>();
const userOptions = ref<Array<{ label: string; value: string }>>([]);
const deptTreeData = ref<any[]>([]);

const filterState = reactive<{
  bizTime?: [string, string];
  deptId?: number;
  keyword: string;
  purchaser?: string;
  supplierId?: number;
}>({
  keyword: '',
});

const trendChartRef = ref<EchartsUIType>();
const { renderEcharts: renderTrendChart } = useEcharts(trendChartRef);

const [Drawer, drawerApi] = useVbenDrawer({
  title: '采购报表明细',
  footer: false,
  destroyOnClose: true,
});

const summaryItems = computed(() => [
  {
    label: '采购金额',
    value: formatMoney(summary.value.purchaseAmount),
    meta: `净额 ${formatMoney(summary.value.netAmount)}`,
    tone: 'success',
  },
  {
    label: '入库数量',
    value: formatCount(summary.value.purchaseCount),
    meta: `单据 ${summary.value.docCount || 0} 张`,
    tone: 'default',
  },
  {
    label: '退货数量',
    value: formatCount(summary.value.returnCount),
    meta: `退货金额 ${formatMoney(summary.value.returnAmount)}`,
    tone: 'warning',
  },
  {
    label: '供应商数',
    value: `${summary.value.supplierCount || 0}`,
    meta: '按当前筛选统计',
    tone: 'default',
  },
]);

const supplierRankItems = computed(() =>
  supplierRankRows.value
    .toSorted((a, b) => Number(b.netAmount || 0) - Number(a.netAmount || 0))
    .slice(0, 5),
);

const maxRankAmount = computed(() =>
  Math.max(
    ...supplierRankItems.value.map((item) => Number(item.netAmount || 0)),
    0,
  ),
);

const AMOUNT_FIELDS = new Set(['purchaseAmount', 'returnAmount', 'netAmount']);

onMounted(() => {
  void loadFilterOptions();
  queueFocusPurchaseKeywordSearchInput(purchaseReportShellRef);
});

onActivated(() => {
  queueFocusPurchaseKeywordSearchInput(purchaseReportShellRef);
});

async function loadFilterOptions() {
  const [users, deptTree] = await Promise.all([
    getSimpleUserList(),
    getPurchaseReportSearchDeptTree(),
  ]);
  userOptions.value = (users || []).map((item: any) => ({
    label: item.nickname || item.username || String(item.id),
    value: String(item.id),
  }));
  deptTreeData.value = deptTree || [];
}

function normalizeFilters() {
  const params: Record<string, any> = {};
  if (filterState.supplierId) params.supplierId = filterState.supplierId;
  if (filterState.deptId) params.deptId = filterState.deptId;
  if (filterState.purchaser) params.purchaser = filterState.purchaser;
  if (filterState.keyword?.trim()) params.keyword = filterState.keyword.trim();
  if (filterState.bizTime?.length === 2) params.bizTime = filterState.bizTime;
  return params;
}

async function refreshOverview(params: Record<string, any>) {
  const [summaryData, trendData, rankData] = await Promise.all([
    getPurchaseReportSummary(params),
    getPurchaseReportTrend(params),
    getPurchaseReportPage({
      pageNo: 1,
      pageSize: 5,
      ...params,
      orderDirection: 'desc',
      orderField: 'netAmount',
    }),
  ]);
  summary.value = summaryData || {};
  trendRows.value = trendData || [];
  supplierRankRows.value = rankData.list || [];
  await nextTick();
  renderCharts();
}

function renderCharts() {
  renderTrendChart({
    color: ['#3f73ff', '#d97706', '#ff4d4f'],
    grid: { left: 24, right: 18, bottom: 24, top: 34, containLabel: true },
    legend: { show: false },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: trendRows.value.map((item) => item.period || ''),
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: '#e5e7eb' } },
    },
    series: [
      {
        name: '采购金额',
        type: 'line',
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 3 },
        areaStyle: { color: 'rgba(63, 115, 255, 0.12)' },
        data: trendRows.value.map((item) => Number(item.purchaseAmount || 0)),
      },
      {
        name: '采购净额',
        type: 'line',
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 3 },
        data: trendRows.value.map((item) => Number(item.netAmount || 0)),
      },
      {
        name: '退货金额',
        type: 'line',
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 2, type: 'dashed' },
        data: trendRows.value.map((item) => Number(item.returnAmount || 0)),
      },
    ],
  });
}

function getRankPercent(value?: number) {
  if (!maxRankAmount.value) return 0;
  return Math.max(
    4,
    Math.round((Number(value || 0) / maxRankAmount.value) * 100),
  );
}

async function handleOpenDetail(row: ErpPurchaseReportApi.PurchaseReport) {
  currentSupplierId.value = row.supplierId;
  currentBizTime.value = filterState.bizTime || [];
  drawerApi
    .setState({
      title: row.supplierName
        ? `采购报表明细 - ${row.supplierName}`
        : '采购报表明细',
    })
    .open();
}

function handleCellClick({
  column,
  row,
}: {
  column: any;
  row: ErpPurchaseReportApi.PurchaseReport;
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

function getActiveSortParams() {
  if (activeTab.value === 'product') {
    return buildProductSortParams();
  }
  if (activeTab.value === 'dept') {
    return buildDeptSortParams();
  }
  if (activeTab.value === 'detail') {
    return {};
  }
  return buildSortParams();
}

async function handleExport() {
  exportLoading.value = true;
  try {
    const params = { ...normalizeFilters(), ...getActiveSortParams() };
    if (activeTab.value === 'product') {
      const data = await exportPurchaseReportProduct(params);
      downloadFileFromBlobPart({ fileName: '采购商品报表.xls', source: data });
      return;
    }
    if (activeTab.value === 'dept') {
      const data = await exportPurchaseReportDept(params);
      downloadFileFromBlobPart({ fileName: '采购部门报表.xls', source: data });
      return;
    }
    if (activeTab.value === 'detail') {
      const data = await exportPurchaseReportDetail(params);
      downloadFileFromBlobPart({ fileName: '采购单据明细.xls', source: data });
      return;
    }
    const data = await exportPurchaseReport(params);
    downloadFileFromBlobPart({ fileName: '采购供应商报表.xls', source: data });
  } finally {
    exportLoading.value = false;
  }
}

function handleSearch() {
  void refreshActiveGrid();
}

function handleReset() {
  filterState.bizTime = undefined;
  filterState.deptId = undefined;
  filterState.keyword = '';
  filterState.purchaser = undefined;
  filterState.supplierId = undefined;
  void refreshActiveGrid();
}

function handleTabChange() {
  void refreshActiveGrid();
}

async function refreshActiveGrid() {
  await nextTick();
  if (activeTab.value === 'product') {
    await productGridApi.reload();
    return;
  }
  if (activeTab.value === 'dept') {
    await deptGridApi.reload();
    return;
  }
  if (activeTab.value === 'detail') {
    await detailGridApi.reload();
    return;
  }
  await gridApi.reload();
}

function buildSupplierFooter({
  columns,
  data,
}: {
  columns: any[];
  data: any[];
}) {
  return [
    columns.map((column) => {
      if (column.field === 'supplierName') return '本页小计';
      if (column.field === 'docCount') return sumAmount(data, 'docCount');
      if (column.field === 'purchaseCount')
        return sumAmount(data, 'purchaseCount');
      if (column.field === 'returnCount') return sumAmount(data, 'returnCount');
      if (AMOUNT_FIELDS.has(column.field)) {
        return formatMoney(sumAmount(data, column.field));
      }
      return '';
    }),
  ];
}

function buildProductFooter({
  columns,
  data,
}: {
  columns: any[];
  data: any[];
}) {
  return [
    columns.map((column) => {
      if (column.field === 'productName') return '本页小计';
      if (column.field === 'supplierCount')
        return sumAmount(data, 'supplierCount');
      if (column.field === 'docCount') return sumAmount(data, 'docCount');
      if (column.field === 'purchaseCount')
        return sumAmount(data, 'purchaseCount');
      if (column.field === 'returnCount') return sumAmount(data, 'returnCount');
      if (AMOUNT_FIELDS.has(column.field)) {
        return formatMoney(sumAmount(data, column.field));
      }
      return '';
    }),
  ];
}

function buildDeptFooter({ columns, data }: { columns: any[]; data: any[] }) {
  return [
    columns.map((column) => {
      if (column.field === 'deptName') return '本页小计';
      if (column.field === 'supplierCount')
        return sumAmount(data, 'supplierCount');
      if (column.field === 'docCount') return sumAmount(data, 'docCount');
      if (column.field === 'purchaseCount')
        return sumAmount(data, 'purchaseCount');
      if (column.field === 'returnCount') return sumAmount(data, 'returnCount');
      if (AMOUNT_FIELDS.has(column.field)) {
        return formatMoney(sumAmount(data, column.field));
      }
      return '';
    }),
  ];
}

function buildDetailFooter({ columns, data }: { columns: any[]; data: any[] }) {
  return [
    columns.map((column) => {
      if (column.field === 'docType') return '本页小计';
      if (column.field === 'bizCount') return sumAmount(data, 'bizCount');
      if (AMOUNT_FIELDS.has(column.field)) {
        return formatMoney(sumAmount(data, column.field));
      }
      return '';
    }),
  ];
}

function sumAmount(rows: any[], field: string) {
  return rows.reduce((sum, item) => sum + Number(item[field] || 0), 0);
}

function formatCount(value?: number) {
  return formatPurchaseDecimal(value, '0');
}

function formatMoney(value?: number) {
  return formatPurchaseAmount(value, '-');
}

const { buildSortParams, handleSortChange, restoreSortState } =
  createVxeHeaderSort(PURCHASE_REPORT_SORT_FIELD_MAP);
const {
  buildSortParams: buildProductSortParams,
  handleSortChange: handleProductSortChange,
  restoreSortState: restoreProductSortState,
} = createVxeHeaderSort(PURCHASE_PRODUCT_REPORT_SORT_FIELD_MAP);
const {
  buildSortParams: buildDeptSortParams,
  handleSortChange: handleDeptSortChange,
  restoreSortState: restoreDeptSortState,
} = createVxeHeaderSort(PURCHASE_DEPT_REPORT_SORT_FIELD_MAP);

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: useGridColumns(),
    customConfig: {
      storage: { fixed: true, resizable: true, sort: true, visible: true },
    },
    footerMethod: buildSupplierFooter,
    height: 'auto',
    id: 'erp-purchase-report-list-v2',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page, sort, sorts }) => {
          const params = {
            ...normalizeFilters(),
            ...buildSortParams(sorts, sort),
          };
          await refreshOverview(params);
          const result = await getPurchaseReportPage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            ...params,
          });
          pageRows.value = result.list || [];
          return result;
        },
        querySuccess: () => void restoreSortState(gridApi),
      },
      sort: true,
    },
    rowConfig: { keyField: 'supplierId', isHover: true, isCurrent: true },
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
    toolbarConfig: { refresh: true },
  } as VxeTableGridOptions<ErpPurchaseReportApi.PurchaseReport>,
  gridEvents: {
    cellClick: handleCellClick,
    sortChange: handleSortChange,
  },
});

const [ProductGrid, productGridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: useProductGridColumns(),
    customConfig: {
      storage: { fixed: true, resizable: true, sort: true, visible: true },
    },
    footerMethod: buildProductFooter,
    height: 'auto',
    id: 'erp-purchase-report-product-list-v2',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page, sort, sorts }) => {
          const params = {
            ...normalizeFilters(),
            ...buildProductSortParams(sorts, sort),
          };
          await refreshOverview(params);
          const result = await getPurchaseReportProductPage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            ...params,
          });
          productRows.value = result.list || [];
          return result;
        },
        querySuccess: () => void restoreProductSortState(productGridApi),
      },
      sort: true,
    },
    rowConfig: { keyField: 'productId', isHover: true, isCurrent: true },
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
    toolbarConfig: { refresh: true },
  } as VxeTableGridOptions<ErpPurchaseReportApi.PurchaseProductReport>,
  gridEvents: {
    sortChange: handleProductSortChange,
  },
});

const [DeptGrid, deptGridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: useDeptGridColumns(),
    customConfig: {
      storage: { fixed: true, resizable: true, sort: true, visible: true },
    },
    footerMethod: buildDeptFooter,
    height: 'auto',
    id: 'erp-purchase-report-dept-list-v1',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page, sort, sorts }) => {
          const params = {
            ...normalizeFilters(),
            ...buildDeptSortParams(sorts, sort),
          };
          await refreshOverview(params);
          const result = await getPurchaseReportDeptPage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            ...params,
          });
          deptRows.value = result.list || [];
          return result;
        },
        querySuccess: () => void restoreDeptSortState(deptGridApi),
      },
      sort: true,
    },
    rowConfig: { keyField: 'deptId', isHover: true, isCurrent: true },
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
    toolbarConfig: { refresh: true },
  } as VxeTableGridOptions<ErpPurchaseReportApi.PurchaseDeptReport>,
  gridEvents: {
    sortChange: handleDeptSortChange,
  },
});

const [DetailGrid, detailGridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: useDetailColumns(),
    customConfig: {
      storage: { fixed: true, resizable: true, sort: true, visible: true },
    },
    footerMethod: buildDetailFooter,
    height: 'auto',
    id: 'erp-purchase-report-detail-list-v2',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page }) => {
          const params = normalizeFilters();
          await refreshOverview(params);
          const result = await getPurchaseReportDetailPage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            ...params,
          });
          detailRows.value = result.list || [];
          return result;
        },
      },
    },
    rowConfig: { keyField: 'rowKey', isHover: true, isCurrent: true },
    scrollX: { enabled: true, gt: 10 },
    scrollY: { enabled: true, gt: 10 },
    showFooter: true,
    showHeaderOverflow: 'tooltip',
    showOverflow: 'tooltip',
    toolbarConfig: { refresh: true },
  } as VxeTableGridOptions<ErpPurchaseReportApi.PurchaseReportDetail>,
});

const { activationRefreshMaskVisible } =
  useVxeActivationRefresh<ErpPurchaseReportApi.PurchaseReport>({
    errorMessage: 'Error occurred while refreshing purchase report page:',
    gridApi,
    getParams: async () => ({
      ...normalizeFilters(),
      ...buildSortParams(),
    }),
    queryPage: getPurchaseReportPage,
    onSuccess: (rows) => {
      pageRows.value = rows;
      void restoreSortState(gridApi);
      renderCharts();
    },
  });
</script>

<template>
  <Page auto-content-height>
    <Drawer class="w-[85vw]">
      <DetailDrawer
        :supplier-id="currentSupplierId"
        :biz-time="currentBizTime"
      />
    </Drawer>
    <div ref="purchaseReportShellRef" class="erp-report-shell">
      <Card class="erp-report-filter-card" size="small">
        <div class="erp-report-filter-grid">
          <label class="erp-report-filter-item">
            <span>统计期间</span>
            <DatePicker.RangePicker
              v-model:value="filterState.bizTime"
              class="erp-report-filter-control"
              format="YYYY-MM-DD"
              value-format="YYYY-MM-DD HH:mm:ss"
            />
          </label>
          <label class="erp-report-filter-item">
            <span>供应商</span>
            <SupplierLazySelect
              v-model:value="filterState.supplierId"
              allow-clear
              class="erp-report-filter-control"
              placeholder="全部供应商"
              popup-class-name="purchase-report-search-select-dropdown"
              show-search
            />
          </label>
          <label class="erp-report-filter-item">
            <span>采购部门</span>
            <TreeSelect
              v-model:value="filterState.deptId"
              allow-clear
              class="erp-report-filter-control"
              :field-names="{
                children: 'children',
                label: 'name',
                value: 'id',
              }"
              placeholder="全部部门"
              show-search
              tree-default-expand-all
              :tree-data="deptTreeData"
            />
          </label>
          <label class="erp-report-filter-item">
            <span>采购员</span>
            <Select
              v-model:value="filterState.purchaser"
              allow-clear
              class="erp-report-filter-control"
              :options="userOptions"
              placeholder="全部采购员"
              show-search
              :filter-option="
                (input, option) =>
                  String(option?.label || '')
                    .toLowerCase()
                    .includes(input.toLowerCase())
              "
            />
          </label>
          <label class="erp-report-filter-item">
            <span>商品关键词</span>
            <Input
              v-model:value="filterState.keyword"
              allow-clear
              class="erp-report-filter-control"
              data-erp-keyword-search-input="true"
              placeholder="编码 / 名称 / 图号"
              @press-enter="handleSearch"
            />
          </label>
        </div>
        <div class="erp-report-filter-actions">
          <Tabs
            v-model:active-key="activeTab"
            class="erp-report-segment-tabs"
            size="small"
            type="card"
            @change="handleTabChange"
          >
            <TabPane key="supplier" tab="按供应商" />
            <TabPane key="product" tab="按商品" />
            <TabPane key="dept" tab="按部门" />
            <TabPane key="detail" tab="按单据" />
          </Tabs>
          <div class="erp-report-filter-buttons">
            <Button @click="handleReset">重置</Button>
            <Button type="primary" @click="handleSearch">查询</Button>
          </div>
        </div>
      </Card>

      <div class="erp-report-overview">
        <Card
          v-for="item in summaryItems"
          :key="item.label"
          class="erp-report-kpi"
          size="small"
        >
          <div class="erp-report-kpi__label">{{ item.label }}</div>
          <div class="erp-report-kpi__value">{{ item.value }}</div>
          <div :class="['erp-report-kpi__meta', `is-${item.tone}`]">
            {{ item.meta }}
          </div>
        </Card>
      </div>

      <div class="erp-report-charts">
        <Card class="erp-report-chart-card" size="small">
          <div class="erp-report-card-title">采购金额与入库趋势</div>
          <div class="erp-report-card-subtitle">
            按月汇总采购入库、采购退货和采购净额
          </div>
          <EchartsUI ref="trendChartRef" class="erp-report-chart" />
        </Card>
        <Card class="erp-report-rank-card" size="small">
          <div class="erp-report-card-title">供应商采购排行</div>
          <div class="erp-report-card-subtitle">按采购净额由高到低展示</div>
          <div class="erp-report-rank-list">
            <div
              v-for="item in supplierRankItems"
              :key="item.supplierId || item.supplierName"
              class="erp-report-rank-item"
            >
              <div class="erp-report-rank-row">
                <span class="erp-report-rank-name">{{
                  item.supplierName || '-'
                }}</span>
                <span class="erp-report-rank-value">{{
                  formatMoney(item.netAmount)
                }}</span>
              </div>
              <div class="erp-report-rank-track">
                <span
                  class="erp-report-rank-bar"
                  :style="{ width: `${getRankPercent(item.netAmount)}%` }"
                />
              </div>
            </div>
            <div v-if="supplierRankItems.length === 0" class="erp-report-empty">
              暂无排行数据
            </div>
          </div>
        </Card>
      </div>

      <Card class="erp-report-table-card" size="small">
        <template #title>
          <span v-if="activeTab === 'supplier'">采购报表明细</span>
          <span v-else-if="activeTab === 'product'">采购商品明细</span>
          <span v-else-if="activeTab === 'dept'">采购部门明细</span>
          <span v-else>采购单据明细</span>
        </template>
        <template #extra>
          <TableAction
            :actions="[
              {
                label: '导出',
                type: 'primary',
                icon: ACTION_ICON.DOWNLOAD,
                auth: ['erp:purchase-report:export'],
                loading: exportLoading,
                onClick: handleExport,
              },
            ]"
          />
        </template>

        <div class="erp-report-grid-shell">
          <Grid v-show="activeTab === 'supplier'" table-title="">
            <template #supplierName="{ row }">
              <button
                type="button"
                class="erp-report-link"
                :title="row.supplierName || ''"
                @click.stop="handleOpenDetail(row)"
              >
                {{ row.supplierName || '-' }}
              </button>
            </template>
            <template #actions="{ row }">
              <TableAction
                :actions="[
                  {
                    label: '明细',
                    type: 'link',
                    icon: ACTION_ICON.VIEW,
                    auth: ['erp:purchase-report:query'],
                    onClick: handleOpenDetail.bind(null, row),
                  },
                ]"
              />
            </template>
          </Grid>
          <ProductGrid v-show="activeTab === 'product'" table-title="" />
          <DeptGrid v-show="activeTab === 'dept'" table-title="" />
          <DetailGrid v-show="activeTab === 'detail'" table-title="" />
          <ErpActivationRefreshMask
            v-if="activationRefreshMaskVisible"
            class="erp-report-activation-mask"
          />
        </div>
      </Card>
    </div>
  </Page>
</template>

<style scoped>
.erp-report-shell {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  min-height: 100%;
}

.erp-report-filter-card {
  border-radius: 8px;
}

.erp-report-filter-grid {
  display: grid;
  grid-template-columns: 1.05fr 1fr 1fr 1fr 1fr;
  gap: 10px;
}

.erp-report-filter-item {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.erp-report-filter-control {
  width: 100%;
}

.erp-report-filter-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 12px;
}

.erp-report-filter-buttons {
  display: flex;
  flex-shrink: 0;
  gap: 8px;
}

.erp-report-segment-tabs {
  min-width: 0;
}

:deep(.erp-report-segment-tabs .ant-tabs-nav) {
  margin: 0;
}

:deep(.erp-report-segment-tabs .ant-tabs-tab) {
  padding: 5px 14px;
  border-radius: 6px;
}

.erp-report-overview {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.erp-report-kpi {
  border-radius: 8px;
}

.erp-report-kpi__label {
  font-size: 13px;
  color: hsl(var(--muted-foreground));
}

.erp-report-kpi__value {
  margin-top: 8px;
  overflow: hidden;
  font-size: 26px;
  font-weight: 600;
  line-height: 34px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.erp-report-kpi__meta {
  margin-top: 6px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.erp-report-kpi__meta.is-success {
  color: #16a34a;
}

.erp-report-kpi__meta.is-warning {
  color: #d97706;
}

.erp-report-charts {
  display: grid;
  grid-template-columns: minmax(0, 5fr) minmax(320px, 3fr);
  gap: 12px;
}

.erp-report-chart-card,
.erp-report-rank-card,
.erp-report-table-card {
  border-radius: 8px;
}

.erp-report-card-title {
  font-size: 16px;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.erp-report-card-subtitle {
  margin-top: 2px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.erp-report-chart {
  height: 300px;
  margin-top: 8px;
}

.erp-report-rank-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 300px;
  padding-top: 18px;
}

.erp-report-rank-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
}

.erp-report-rank-name {
  min-width: 0;
  overflow: hidden;
  color: hsl(var(--foreground));
  text-overflow: ellipsis;
  white-space: nowrap;
}

.erp-report-rank-value {
  flex-shrink: 0;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.erp-report-rank-track {
  height: 7px;
  margin-top: 7px;
  overflow: hidden;
  background: #eef3ff;
  border-radius: 999px;
}

.erp-report-rank-bar {
  display: block;
  height: 100%;
  background: #3f73ff;
  border-radius: inherit;
}

.erp-report-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 220px;
  font-size: 13px;
  color: hsl(var(--muted-foreground));
}

.erp-report-grid-shell {
  position: relative;
  min-height: 420px;
}

:deep(.vxe-table--render-default) {
  font-size: 12px;
}

:deep(.vxe-grid--form-wrapper),
:deep(.vxe-grid--toolbar-wrapper .vxe-toolbar--title) {
  display: none;
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

@media (max-width: 1280px) {
  .erp-report-filter-grid,
  .erp-report-overview,
  .erp-report-charts {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .erp-report-filter-grid,
  .erp-report-overview,
  .erp-report-charts {
    grid-template-columns: 1fr;
  }

  .erp-report-filter-actions {
    align-items: stretch;
    flex-direction: column;
  }

  .erp-report-filter-buttons {
    justify-content: flex-end;
  }
}
</style>
