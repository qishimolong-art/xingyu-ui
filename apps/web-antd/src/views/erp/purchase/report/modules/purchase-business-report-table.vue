<script setup lang="ts">
import type { TablePaginationConfig, TableProps } from 'ant-design-vue';
import type { ColumnType } from 'ant-design-vue/es/table';

import type { PageParam } from '@vben/request';

import type { ErpPurchaseReportApi } from '#/api/erp/report/purchase';

import { computed, onMounted, reactive, ref } from 'vue';

import {
  downloadFileFromBlobPart,
  formatDateTime,
} from '@vben/utils';

import {
  Button,
  Card,
  DatePicker,
  Drawer,
  Form,
  FormItem,
  Input,
  Pagination,
  Select,
  Space,
  Table,
  Tag,
} from 'ant-design-vue';

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
import { formatPurchaseAmount, formatPurchaseDecimal } from '#/views/erp/purchase/utils/decimal';
import BusinessReportEmptyState from '#/views/erp/report/components/business-report-empty-state.vue';

import DetailDrawer from './detail-drawer.vue';

type Variant =
  | 'dept'
  | 'detail'
  | 'price'
  | 'product'
  | 'quality'
  | 'supplier'
  | 'supplier-analysis';
type ReportRow =
  | ErpPurchaseReportApi.PurchaseDeptReport
  | ErpPurchaseReportApi.PurchaseProductReport
  | ErpPurchaseReportApi.PurchaseReport
  | ErpPurchaseReportApi.PurchaseReportDetail;
type QueryParams = PageParam & Record<string, any>;

defineOptions({ name: 'ErpPurchaseBusinessReportTable' });

const props = defineProps<{
  title: string;
  variant: Variant;
}>();

const query = reactive({
  bizTime: undefined as [string, string] | undefined,
  keyword: '',
});
const rows = ref<ReportRow[]>([]);
const summary = ref<ErpPurchaseReportApi.PurchaseReportSummary>({});
const trendRows = ref<ErpPurchaseReportApi.PurchaseReportTrend[]>([]);
const loading = ref(false);
const exporting = ref(false);
const pageNo = ref(1);
const pageSize = ref(10);
const total = ref(0);
const sortState = ref<{ field?: string; order?: 'asc' | 'desc' }>({});
const detailOpen = ref(false);
const currentSupplierId = ref<number>();
const currentSupplierName = ref('');
const currentBizTime = ref<string[]>([]);

const variantOptions = [
  { label: '采购综合明细', value: 'detail' },
  { label: '供应商采购汇总', value: 'supplier' },
  { label: '商品采购汇总', value: 'product' },
  { label: '采购员/部门汇总', value: 'dept' },
  { label: '采购价格波动', value: 'price' },
  { label: '供应商经营分析', value: 'supplier-analysis' },
  { label: '供应商质量/履约评分', value: 'quality' },
];

const activeVariant = computed(() => props.variant);
const amountFields = new Set(['netAmount', 'purchaseAmount', 'returnAmount']);
const countFields = new Set([
  'bizCount',
  'docCount',
  'purchaseCount',
  'returnCount',
  'supplierCount',
]);

const baseColumns: Record<Variant, ColumnType<ReportRow>[]> = {
  detail: [
    { title: '单据类型', dataIndex: 'docType', width: 110 },
    { title: '单据日期', dataIndex: 'docDate', width: 160, sorter: true },
    { title: '单据编号', dataIndex: 'docNo', width: 170 },
    { title: '供应商', dataIndex: 'supplierName', width: 190 },
    { title: '采购员', dataIndex: 'purchaserName', width: 110 },
    { title: '业务数量', dataIndex: 'bizCount', width: 100, align: 'right' },
    {
      title: '入库金额',
      dataIndex: 'purchaseAmount',
      width: 120,
      align: 'right',
      sorter: true,
    },
    {
      title: '退货金额',
      dataIndex: 'returnAmount',
      width: 120,
      align: 'right',
      sorter: true,
    },
    {
      title: '采购净额',
      dataIndex: 'netAmount',
      width: 120,
      align: 'right',
      sorter: true,
    },
  ],
  supplier: [
    { title: '供应商', dataIndex: 'supplierName', width: 210, sorter: true },
    { title: '联系人', dataIndex: 'contact', width: 110 },
    { title: '联系电话', dataIndex: 'mobile', width: 130 },
    { title: '所属部门', dataIndex: 'deptName', width: 130, sorter: true },
    { title: '采购员', dataIndex: 'purchaserName', width: 110, sorter: true },
    { title: '单据数', dataIndex: 'docCount', width: 90, align: 'right' },
    {
      title: '入库数量',
      dataIndex: 'purchaseCount',
      width: 110,
      align: 'right',
    },
    {
      title: '入库金额',
      dataIndex: 'purchaseAmount',
      width: 120,
      align: 'right',
      sorter: true,
    },
    { title: '退货数量', dataIndex: 'returnCount', width: 110, align: 'right' },
    {
      title: '退货金额',
      dataIndex: 'returnAmount',
      width: 120,
      align: 'right',
      sorter: true,
    },
    {
      title: '采购净额',
      dataIndex: 'netAmount',
      width: 120,
      align: 'right',
      sorter: true,
    },
    {
      title: '最近业务时间',
      dataIndex: 'lastBizTime',
      width: 160,
      sorter: true,
    },
    { title: '操作', dataIndex: 'actions', width: 90, fixed: 'right' },
  ],
  product: [
    { title: '配件编码', dataIndex: 'productCode', width: 130, sorter: true },
    { title: '配件名称', dataIndex: 'productName', width: 190, sorter: true },
    { title: '条形码', dataIndex: 'barCode', width: 140 },
    { title: '品牌', dataIndex: 'brand', width: 110 },
    { title: '规格', dataIndex: 'standard', width: 120 },
    { title: '适用车型', dataIndex: 'vehicleModel', width: 150 },
    { title: '图号', dataIndex: 'drawingNo', width: 130 },
    { title: '单位', dataIndex: 'unitName', width: 80 },
    {
      title: '供应商数',
      dataIndex: 'supplierCount',
      width: 100,
      align: 'right',
    },
    { title: '单据数', dataIndex: 'docCount', width: 90, align: 'right' },
    {
      title: '入库数量',
      dataIndex: 'purchaseCount',
      width: 110,
      align: 'right',
      sorter: true,
    },
    {
      title: '入库金额',
      dataIndex: 'purchaseAmount',
      width: 120,
      align: 'right',
      sorter: true,
    },
    { title: '退货数量', dataIndex: 'returnCount', width: 110, align: 'right' },
    {
      title: '退货金额',
      dataIndex: 'returnAmount',
      width: 120,
      align: 'right',
      sorter: true,
    },
    {
      title: '采购净额',
      dataIndex: 'netAmount',
      width: 120,
      align: 'right',
      sorter: true,
    },
    {
      title: '最近业务时间',
      dataIndex: 'lastBizTime',
      width: 160,
      sorter: true,
    },
  ],
  dept: [
    { title: '部门', dataIndex: 'deptName', width: 190, sorter: true },
    {
      title: '供应商数',
      dataIndex: 'supplierCount',
      width: 100,
      align: 'right',
    },
    { title: '单据数', dataIndex: 'docCount', width: 90, align: 'right' },
    {
      title: '入库数量',
      dataIndex: 'purchaseCount',
      width: 110,
      align: 'right',
      sorter: true,
    },
    {
      title: '入库金额',
      dataIndex: 'purchaseAmount',
      width: 120,
      align: 'right',
      sorter: true,
    },
    { title: '退货数量', dataIndex: 'returnCount', width: 110, align: 'right' },
    {
      title: '退货金额',
      dataIndex: 'returnAmount',
      width: 120,
      align: 'right',
      sorter: true,
    },
    {
      title: '采购净额',
      dataIndex: 'netAmount',
      width: 120,
      align: 'right',
      sorter: true,
    },
    {
      title: '最近业务时间',
      dataIndex: 'lastBizTime',
      width: 160,
      sorter: true,
    },
  ],
  price: [
    { title: '单据类型', dataIndex: 'docType', width: 110 },
    { title: '单据日期', dataIndex: 'docDate', width: 160, sorter: true },
    { title: '单据编号', dataIndex: 'docNo', width: 170 },
    { title: '供应商', dataIndex: 'supplierName', width: 190 },
    { title: '采购员', dataIndex: 'purchaserName', width: 110 },
    {
      title: '采购净额',
      dataIndex: 'netAmount',
      width: 120,
      align: 'right',
      sorter: true,
    },
    { title: '上次采购价', dataIndex: 'lastPriceStatus', width: 130 },
    { title: '期间均价', dataIndex: 'avgPriceStatus', width: 130 },
    { title: '价格波动', dataIndex: 'priceTrendStatus', width: 130 },
    { title: '异常状态', dataIndex: 'exceptionStatus', width: 130 },
  ],
  'supplier-analysis': [
    { title: '供应商', dataIndex: 'supplierName', width: 210, sorter: true },
    { title: '所属部门', dataIndex: 'deptName', width: 130, sorter: true },
    { title: '采购员', dataIndex: 'purchaserName', width: 110, sorter: true },
    { title: '单据数', dataIndex: 'docCount', width: 90, align: 'right' },
    {
      title: '采购净额',
      dataIndex: 'netAmount',
      width: 120,
      align: 'right',
      sorter: true,
    },
    { title: '付款率', dataIndex: 'paymentRateStatus', width: 130 },
    { title: '价格稳定性', dataIndex: 'priceStableStatus', width: 130 },
    { title: '合作状态', dataIndex: 'cooperateStatus', width: 130 },
    {
      title: '最近业务时间',
      dataIndex: 'lastBizTime',
      width: 160,
      sorter: true,
    },
  ],
  quality: [
    { title: '供应商', dataIndex: 'supplierName', width: 210, sorter: true },
    { title: '所属部门', dataIndex: 'deptName', width: 130, sorter: true },
    { title: '采购员', dataIndex: 'purchaserName', width: 110, sorter: true },
    { title: '单据数', dataIndex: 'docCount', width: 90, align: 'right' },
    { title: '履约状态', dataIndex: 'fulfillmentStatus', width: 130 },
    { title: '质量状态', dataIndex: 'qualityStatus', width: 130 },
    { title: '评分', dataIndex: 'scoreStatus', width: 130 },
    {
      title: '最近业务时间',
      dataIndex: 'lastBizTime',
      width: 160,
      sorter: true,
    },
  ],
};

const columns = computed(() => baseColumns[activeVariant.value]);
const tableTitle = computed(() => props.title);
function getRowKeyField(variant: Variant) {
  if (variant === 'product') return 'productId';
  if (variant === 'dept') return 'deptId';
  if (['quality', 'supplier', 'supplier-analysis'].includes(variant))
    return 'supplierId';
  return 'rowKey';
}

const rowKey = computed(() => getRowKeyField(activeVariant.value));
const pageSummary = computed(() => summarize(rows.value));
const cards = computed(() => [
  { label: '供应商数', value: formatNumber(summary.value.supplierCount) },
  { label: '单据数', value: formatNumber(summary.value.docCount) },
  { label: '入库金额', value: formatMoney(summary.value.purchaseAmount) },
  { label: '退货金额', value: formatMoney(summary.value.returnAmount) },
  { label: '采购净额', value: formatMoney(summary.value.netAmount) },
]);
const maxTrendAmount = computed(() =>
  Math.max(
    ...trendRows.value.map((row) => Math.abs(Number(row.netAmount || 0))),
    1,
  ),
);
const rankRows = computed(() =>
  rows.value.slice(0, 5).map((row, index) => ({
    key: String((row as any)[rowKey.value] ?? (row as any).rowKey ?? index),
    name: getRankName(row),
    value: formatMoney((row as any).netAmount),
  })),
);
const ruleCards = computed(() => {
  if (activeVariant.value === 'price') {
    return [
      { label: '上次采购价', status: '待规则确认', value: '保留展示栏位' },
      { label: '期间均价', status: '待规则确认', value: '等待加权口径' },
      { label: '价格波动', status: '待规则确认', value: '不输出临时结论' },
    ];
  }
  if (activeVariant.value === 'supplier-analysis') {
    return [
      { label: '供应商经营', status: '已接入', value: '采购汇总与应付概览' },
      { label: '付款率', status: '待核对', value: '后续按核销口径计算' },
      { label: '合作分层', status: '待规则确认', value: '不输出临时评级' },
    ];
  }
  if (activeVariant.value === 'quality') {
    return [
      {
        label: '履约评分',
        status: '待规则确认',
        value: '预计到货与实际到货待补齐',
      },
      { label: '质量评分', status: '待规则确认', value: '问题处理记录待接入' },
      { label: '综合评分', status: '待规则确认', value: '规则版本确认后启用' },
    ];
  }
  if (activeVariant.value === 'product') {
    return [
      { label: '商品维度', status: '已接入', value: '按商品汇总入退净额' },
      { label: '费用分摊', status: '待规则确认', value: '不写入临时成本' },
    ];
  }
  if (activeVariant.value === 'dept') {
    return [
      { label: '部门维度', status: '已接入', value: '沿用可查部门范围' },
      { label: '实际收货部门', status: '待补齐', value: '后续区分采购组织' },
    ];
  }
  return [
    { label: '采购入退', status: '已接入', value: '按现有入库退货记录' },
    { label: '采购价口径', status: '含税展示', value: '税率确认后切换' },
  ];
});

function buildParams(): QueryParams {
  return {
    bizTime: query.bizTime,
    keyword: query.keyword.trim() || undefined,
    orderDirection: sortState.value.order,
    orderField: sortState.value.field,
    pageNo: pageNo.value,
    pageSize: pageSize.value,
  };
}

async function loadData() {
  loading.value = true;
  try {
    const params = buildParams();
    const [summaryResult, trendResult, pageResult] = await Promise.all([
      getPurchaseReportSummary(params),
      getPurchaseReportTrend(params),
      loadPage(params),
    ]);
    summary.value = summaryResult || {};
    trendRows.value = trendResult || [];
    rows.value = decorateRows(pageResult.list || []);
    total.value = pageResult.total || 0;
  } finally {
    loading.value = false;
  }
}

function loadPage(params: QueryParams) {
  if (activeVariant.value === 'product')
    return getPurchaseReportProductPage(params);
  if (activeVariant.value === 'dept') return getPurchaseReportDeptPage(params);
  if (
    ['quality', 'supplier', 'supplier-analysis'].includes(activeVariant.value)
  ) {
    return getPurchaseReportPage(params);
  }
  return getPurchaseReportDetailPage(params);
}

function decorateRows(list: ReportRow[]) {
  if (activeVariant.value === 'price') {
    return list.map((row) => ({
      ...row,
      avgPriceStatus: '待规则确认',
      exceptionStatus: '待核对',
      lastPriceStatus: '待规则确认',
      priceTrendStatus: '不可计算',
    }));
  }
  if (activeVariant.value === 'supplier-analysis') {
    return list.map((row) => ({
      ...row,
      cooperateStatus: '待规则确认',
      paymentRateStatus: '待核对',
      priceStableStatus: '待规则确认',
    }));
  }
  if (activeVariant.value === 'quality') {
    return list.map((row) => ({
      ...row,
      fulfillmentStatus: '待规则确认',
      qualityStatus: '待规则确认',
      scoreStatus: '不可计算',
    }));
  }
  return list;
}

function handleSearch() {
  pageNo.value = 1;
  void loadData();
}

function handleReset() {
  query.bizTime = undefined;
  query.keyword = '';
  sortState.value = {};
  pageNo.value = 1;
  pageSize.value = 10;
  void loadData();
}

function handlePageChange(nextPage: number, nextPageSize: number) {
  pageNo.value = nextPage;
  pageSize.value = nextPageSize;
  void loadData();
}

function toSortOrder(order: unknown) {
  if (order === 'ascend') return 'asc';
  if (order === 'descend') return 'desc';
  return undefined;
}

const handleTableChange: NonNullable<TableProps<ReportRow>['onChange']> = (
  _pagination,
  _filters,
  sorter,
) => {
  const sort = Array.isArray(sorter) ? sorter[0] : sorter;
  sortState.value = {
    field: typeof sort?.field === 'string' ? sort.field : undefined,
    order: toSortOrder(sort?.order),
  };
  pageNo.value = 1;
  void loadData();
};

async function exportByVariant(params: Record<string, any>) {
  if (activeVariant.value === 'product')
    return exportPurchaseReportProduct(params);
  if (activeVariant.value === 'dept') return exportPurchaseReportDept(params);
  if (
    ['quality', 'supplier', 'supplier-analysis'].includes(activeVariant.value)
  ) {
    return exportPurchaseReport(params);
  }
  return exportPurchaseReportDetail(params);
}

async function handleExport() {
  exporting.value = true;
  try {
    const params = { ...buildParams(), pageNo: undefined, pageSize: undefined };
    const data = await exportByVariant(params);
    downloadFileFromBlobPart({
      fileName: `${tableTitle.value}.xls`,
      source: data,
    });
  } finally {
    exporting.value = false;
  }
}

function summarize(list: ReportRow[]) {
  const result: Record<string, number> = { count: list.length };
  for (const field of [...amountFields, ...countFields]) {
    result[field] = list.reduce(
      (sum, row) => sum + Number((row as any)[field] || 0),
      0,
    );
  }
  return result;
}

function formatMoney(value: unknown) {
  if (value === null || value === undefined) return '****';
  return formatPurchaseAmount(value, '-');
}

function formatNumber(value: unknown) {
  const next = Number(value || 0);
  if (!Number.isFinite(next)) return '-';
  return next.toLocaleString('zh-CN', { maximumFractionDigits: 6 });
}

function formatDate(value: unknown) {
  if (!value) return '-';
  return formatDateTime(value as string) || String(value);
}

function getRankName(row: ReportRow) {
  if (activeVariant.value === 'product') {
    return (
      (row as ErpPurchaseReportApi.PurchaseProductReport).productName ||
      (row as ErpPurchaseReportApi.PurchaseProductReport).productCode ||
      '未命名商品'
    );
  }
  if (activeVariant.value === 'dept') {
    return (
      (row as ErpPurchaseReportApi.PurchaseDeptReport).deptName || '未设置部门'
    );
  }
  if (
    ['quality', 'supplier', 'supplier-analysis'].includes(activeVariant.value)
  ) {
    return (
      (row as ErpPurchaseReportApi.PurchaseReport).supplierName ||
      '未命名供应商'
    );
  }
  return (
    (row as ErpPurchaseReportApi.PurchaseReportDetail).docNo ||
    (row as ErpPurchaseReportApi.PurchaseReportDetail).docType ||
    '未命名单据'
  );
}

function getTrendHeight(value: unknown) {
  const amount = Math.abs(Number(value || 0));
  return `${Math.max(8, Math.round((amount / maxTrendAmount.value) * 72))}px`;
}

function openSupplierDetail(row: ErpPurchaseReportApi.PurchaseReport) {
  currentSupplierId.value = row.supplierId;
  currentSupplierName.value = row.supplierName || '';
  currentBizTime.value = query.bizTime ? [...query.bizTime] : [];
  detailOpen.value = true;
}

function getStatusColor(text: unknown) {
  const value = String(text || '');
  if (value.includes('已接入') || value.includes('含税展示')) return 'success';
  if (value.includes('核对') || value.includes('待')) return 'processing';
  if (
    value.includes('不可') ||
    value.includes('缺失') ||
    value.includes('未启用')
  )
    return 'warning';
  return 'default';
}

function renderText(text: unknown) {
  return text === null || text === undefined || text === ''
    ? '-'
    : String(text);
}

const pagination = computed<false | TablePaginationConfig>(() => false);

onMounted(loadData);
</script>

<template>
  <div class="purchase-business-report-table" data-report="purchase-business">
    <Card :bordered="false" class="purchase-business-report-table__search">
      <Form layout="inline">
        <FormItem label="业务时间">
          <DatePicker.RangePicker
            v-model:value="query.bizTime"
            show-time
            value-format="YYYY-MM-DD HH:mm:ss"
            format="YYYY-MM-DD HH:mm:ss"
          />
        </FormItem>
        <FormItem label="关键词">
          <Input
            v-model:value="query.keyword"
            allow-clear
            class="purchase-business-report-table__keyword"
            placeholder="供应商/单号/商品/部门/采购员"
            @press-enter="handleSearch"
          />
        </FormItem>
        <FormItem label="报表">
          <Select
            :value="activeVariant"
            class="purchase-business-report-table__variant"
            disabled
            :options="variantOptions"
          />
        </FormItem>
        <FormItem>
          <Space>
            <Button type="primary" :loading="loading" @click="handleSearch"
              >查询</Button
            >
            <Button @click="handleReset">重置</Button>
            <Button :loading="exporting" @click="handleExport">导出</Button>
          </Space>
        </FormItem>
      </Form>
    </Card>

    <div class="purchase-business-report-table__cards">
      <Card v-for="item in cards" :key="item.label" size="small">
        <div class="purchase-business-report-table__card-label">
          {{ item.label }}
        </div>
        <div class="purchase-business-report-table__card-value">
          {{ item.value }}
        </div>
      </Card>
    </div>

    <div class="purchase-business-report-table__rule-cards">
      <Card
        v-for="item in ruleCards"
        :key="item.label"
        class="purchase-business-report-table__rule-card"
        size="small"
      >
        <div class="purchase-business-report-table__rule-title">
          {{ item.label }}
        </div>
        <Tag :color="getStatusColor(item.status)">{{ item.status }}</Tag>
        <div class="purchase-business-report-table__rule-value">
          {{ item.value }}
        </div>
      </Card>
    </div>

    <div
      v-if="!['price', 'quality'].includes(activeVariant)"
      class="purchase-business-report-table__analysis"
    >
      <Card size="small" title="月度采购趋势">
        <div class="purchase-business-report-table__trend">
          <div
            v-for="item in trendRows"
            :key="item.period"
            class="purchase-business-report-table__trend-item"
          >
            <div class="purchase-business-report-table__trend-bar-wrap">
              <div
                class="purchase-business-report-table__trend-bar"
                :style="{ height: getTrendHeight(item.netAmount) }"
              ></div>
            </div>
            <div class="purchase-business-report-table__trend-amount">
              {{ formatMoney(item.netAmount) }}
            </div>
            <div class="purchase-business-report-table__trend-period">
              {{ item.period }}
            </div>
          </div>
          <BusinessReportEmptyState
            v-if="trendRows.length === 0"
            description="当前查询条件下没有形成趋势记录"
            title="暂无趋势数据"
          />
        </div>
      </Card>
      <Card size="small" title="当前页排行">
        <div class="purchase-business-report-table__rank">
          <div
            v-for="item in rankRows"
            :key="item.key"
            class="purchase-business-report-table__rank-row"
          >
            <span class="purchase-business-report-table__rank-name">{{
              item.name
            }}</span>
            <span class="purchase-business-report-table__rank-value">{{
              item.value
            }}</span>
          </div>
          <BusinessReportEmptyState
            v-if="rankRows.length === 0"
            description="当前查询条件下没有形成排行记录"
            title="暂无排行数据"
          />
        </div>
      </Card>
    </div>

    <Card :bordered="false" class="purchase-business-report-table__body">
      <template #title>{{ tableTitle }}</template>
      <Table
        class="purchase-business-report-table__table"
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        :pagination="pagination"
        :row-key="
          (record) =>
            String(
              (record as any)[rowKey] ??
                (record as any).rowKey ??
                JSON.stringify(record),
            )
        "
        :scroll="{ x: 'max-content' }"
        bordered
        size="small"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record, text }">
          <template v-if="amountFields.has(String(column.dataIndex))">
            {{ formatMoney(text) }}
          </template>
          <template v-else-if="countFields.has(String(column.dataIndex))">
            {{ formatNumber(text) }}
          </template>
          <template
            v-else-if="
              ['docDate', 'lastBizTime'].includes(String(column.dataIndex))
            "
          >
            {{ formatDate(text) }}
          </template>
          <template v-else-if="column.dataIndex === 'actions'">
            <Button
              size="small"
              type="link"
              @click.stop="
                openSupplierDetail(
                  record as ErpPurchaseReportApi.PurchaseReport,
                )
              "
            >
              明细
            </Button>
          </template>
          <template
            v-else-if="
              [
                'avgPriceStatus',
                'cooperateStatus',
                'exceptionStatus',
                'fulfillmentStatus',
                'lastPriceStatus',
                'paymentRateStatus',
                'priceStableStatus',
                'priceTrendStatus',
                'qualityStatus',
                'scoreStatus',
              ].includes(String(column.dataIndex))
            "
          >
            <Tag :color="getStatusColor(text)">{{ renderText(text) }}</Tag>
          </template>
          <template v-else>
            {{ renderText(text) }}
          </template>
        </template>
        <template #emptyText>
          <BusinessReportEmptyState
            description="当前查询条件下没有采购经营记录"
            title="暂无采购经营数据"
          />
        </template>
      </Table>
      <div class="purchase-business-report-table__footer">
        <Space size="large">
          <span>共 {{ total }} 条记录</span>
          <span>本页 {{ pageSummary.count }} 条</span>
          <span>本页入库：{{ formatMoney(pageSummary.purchaseAmount) }}</span>
          <span>本页退货：{{ formatMoney(pageSummary.returnAmount) }}</span>
          <span>本页净额：{{ formatMoney(pageSummary.netAmount) }}</span>
        </Space>
        <Pagination
          v-model:current="pageNo"
          v-model:page-size="pageSize"
          :page-size-options="['10', '20', '50', '100']"
          :show-total="(value) => `共 ${value} 条`"
          :total="total"
          show-size-changer
          size="small"
          @change="handlePageChange"
          @show-size-change="handlePageChange"
        />
      </div>
    </Card>

    <Drawer
      v-model:open="detailOpen"
      destroy-on-close
      :footer="null"
      :title="
        currentSupplierName ? `采购明细 - ${currentSupplierName}` : '采购明细'
      "
      width="85vw"
    >
      <DetailDrawer
        :supplier-id="currentSupplierId"
        :biz-time="currentBizTime"
      />
    </Drawer>
  </div>
</template>

<style scoped>
.purchase-business-report-table {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 100%;
  gap: 8px;
}

.purchase-business-report-table__search,
.purchase-business-report-table__cards,
.purchase-business-report-table__rule-cards {
  flex: 0 0 auto;
}

.purchase-business-report-table__keyword {
  width: 240px;
}

.purchase-business-report-table__variant {
  width: 170px;
}

.purchase-business-report-table__cards {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
}

.purchase-business-report-table__card-label {
  color: hsl(var(--muted-foreground));
  font-size: 12px;
}

.purchase-business-report-table__card-value {
  margin-top: 4px;
  color: hsl(var(--foreground));
  font-size: 18px;
  font-weight: 700;
}

.purchase-business-report-table__rule-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 8px;
}

.purchase-business-report-table__rule-card {
  min-width: 0;
}

.purchase-business-report-table__rule-title {
  margin-bottom: 6px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
}

.purchase-business-report-table__rule-value {
  margin-top: 6px;
  overflow: hidden;
  color: hsl(var(--foreground));
  text-overflow: ellipsis;
  white-space: nowrap;
}

.purchase-business-report-table__analysis {
  display: grid;
  flex: 0 0 auto;
  grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr);
  gap: 8px;
}

.purchase-business-report-table__trend {
  display: flex;
  min-height: 104px;
  align-items: flex-end;
  gap: 10px;
  overflow-x: auto;
}

.purchase-business-report-table__trend-item {
  display: flex;
  min-width: 76px;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
}

.purchase-business-report-table__trend-bar-wrap {
  display: flex;
  height: 76px;
  align-items: flex-end;
}

.purchase-business-report-table__trend-bar {
  width: 28px;
  border-radius: 8px 8px 0 0;
  background: linear-gradient(180deg, #5b8ff9 0%, #2f54eb 100%);
}

.purchase-business-report-table__trend-amount {
  max-width: 92px;
  overflow: hidden;
  color: hsl(var(--foreground));
  text-overflow: ellipsis;
  white-space: nowrap;
}

.purchase-business-report-table__rank {
  display: flex;
  min-height: 104px;
  flex-direction: column;
  gap: 8px;
}

.purchase-business-report-table__rank-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.purchase-business-report-table__rank-name {
  min-width: 0;
  overflow: hidden;
  color: hsl(var(--foreground));
  text-overflow: ellipsis;
  white-space: nowrap;
}

.purchase-business-report-table__rank-value {
  flex: 0 0 auto;
  color: #2f54eb;
  font-weight: 600;
}

.purchase-business-report-table__body {
  flex: 0 0 auto;
  min-height: 0;
}

.purchase-business-report-table__body :deep(.ant-card-body) {
  display: flex;
  min-height: 0;
  flex-direction: column;
}

.purchase-business-report-table__table {
  flex: 0 0 auto;
  min-height: 0;
}

.purchase-business-report-table__table :deep(.ant-table-body) {
  overflow-y: visible !important;
}

.purchase-business-report-table__footer {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  gap: 8px 16px;
  align-items: center;
  justify-content: space-between;
  padding-top: 10px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
}

@media (max-width: 1280px) {
  .purchase-business-report-table__cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
