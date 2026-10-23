<script setup lang="ts">
import type { TablePaginationConfig, TableProps } from 'ant-design-vue';
import type { ColumnType } from 'ant-design-vue/es/table';

import type { PageParam } from '@vben/request';

import type { ErpSaleReportApi } from '#/api/erp/report/sale';

import { computed, onMounted, reactive, ref } from 'vue';

import {
  downloadFileFromBlobPart,
  formatDateTime,
} from '@vben/utils';

import { formatSaleAmount, formatSaleDecimal } from '../../utils/decimal';

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
  exportSaleReport,
  exportSaleReportDept,
  exportSaleReportDetailPage,
  exportSaleReportProduct,
  getSaleReportDeptPage,
  getSaleReportDetailPage,
  getSaleReportPage,
  getSaleReportProductPage,
  getSaleReportSummary,
  getSaleReportTrend,
} from '#/api/erp/report/sale';
import BusinessReportEmptyState from '#/views/erp/report/components/business-report-empty-state.vue';

import DetailDrawer from './detail-drawer.vue';

type Variant = 'customer' | 'dept' | 'detail' | 'gross' | 'product';
type ReportRow =
  | ErpSaleReportApi.SaleDeptReport
  | ErpSaleReportApi.SaleProductReport
  | ErpSaleReportApi.SaleReport
  | ErpSaleReportApi.SaleReportDetail;
type QueryParams = PageParam & Record<string, any>;

defineOptions({
  name: 'ErpSaleBusinessReportTable',
});

const props = defineProps<{
  title: string;
  variant: Variant;
}>();

const query = reactive({
  bizTime: undefined as [string, string] | undefined,
  keyword: '',
});
const rows = ref<ReportRow[]>([]);
const summary = ref<ErpSaleReportApi.SaleReportSummary>({});
const trendRows = ref<ErpSaleReportApi.SaleReportTrend[]>([]);
const loading = ref(false);
const exporting = ref(false);
const pageNo = ref(1);
const pageSize = ref(10);
const total = ref(0);
const sortState = ref<{ field?: string; order?: 'asc' | 'desc' }>({});
const detailOpen = ref(false);
const currentCustomerId = ref<number>();
const currentCustomerName = ref('');
const currentBizTime = ref<string[]>([]);

const variantOptions = [
  { label: '销售综合明细', value: 'detail' },
  { label: '客户销售汇总', value: 'customer' },
  { label: '商品销售汇总', value: 'product' },
  { label: '部门销售汇总', value: 'dept' },
  { label: '价格毛利异常', value: 'gross' },
];

const activeVariant = computed(() => props.variant);

const amountFields = new Set(['netAmount', 'returnAmount', 'saleAmount']);
const countFields = new Set([
  'bizCount',
  'customerCount',
  'docCount',
  'returnCount',
  'saleCount',
]);

const baseColumns: Record<Variant, ColumnType<ReportRow>[]> = {
  detail: [
    { title: '单据类型', dataIndex: 'docType', width: 110 },
    { title: '单据日期', dataIndex: 'docDate', width: 160, sorter: true },
    { title: '单据编号', dataIndex: 'docNo', width: 170 },
    { title: '客户', dataIndex: 'customerName', width: 180 },
    { title: '部门', dataIndex: 'deptName', width: 130 },
    { title: '销售员', dataIndex: 'saleUserName', width: 110 },
    { title: '业务数量', dataIndex: 'bizCount', width: 100, align: 'right' },
    {
      title: '出库金额',
      dataIndex: 'saleAmount',
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
      title: '销售净额',
      dataIndex: 'netAmount',
      width: 120,
      align: 'right',
      sorter: true,
    },
  ],
  customer: [
    { title: '客户', dataIndex: 'customerName', width: 200, sorter: true },
    { title: '联系人', dataIndex: 'contact', width: 110 },
    { title: '联系电话', dataIndex: 'mobile', width: 130 },
    { title: '所属部门', dataIndex: 'deptName', width: 130, sorter: true },
    { title: '销售员', dataIndex: 'saleUserName', width: 110, sorter: true },
    { title: '单据数', dataIndex: 'docCount', width: 90, align: 'right' },
    { title: '出库数量', dataIndex: 'saleCount', width: 110, align: 'right' },
    {
      title: '出库金额',
      dataIndex: 'saleAmount',
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
      title: '销售净额',
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
    { title: '客户数', dataIndex: 'customerCount', width: 90, align: 'right' },
    { title: '单据数', dataIndex: 'docCount', width: 90, align: 'right' },
    {
      title: '出库数量',
      dataIndex: 'saleCount',
      width: 110,
      align: 'right',
      sorter: true,
    },
    {
      title: '出库金额',
      dataIndex: 'saleAmount',
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
      title: '销售净额',
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
    { title: '部门', dataIndex: 'deptName', width: 180, sorter: true },
    { title: '客户数', dataIndex: 'customerCount', width: 90, align: 'right' },
    { title: '单据数', dataIndex: 'docCount', width: 90, align: 'right' },
    {
      title: '出库数量',
      dataIndex: 'saleCount',
      width: 110,
      align: 'right',
      sorter: true,
    },
    {
      title: '出库金额',
      dataIndex: 'saleAmount',
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
      title: '销售净额',
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
  gross: [
    { title: '单据类型', dataIndex: 'docType', width: 110 },
    { title: '单据日期', dataIndex: 'docDate', width: 160, sorter: true },
    { title: '单据编号', dataIndex: 'docNo', width: 170 },
    { title: '客户', dataIndex: 'customerName', width: 180 },
    { title: '部门', dataIndex: 'deptName', width: 130 },
    { title: '销售员', dataIndex: 'saleUserName', width: 110 },
    {
      title: '销售净额',
      dataIndex: 'netAmount',
      width: 120,
      align: 'right',
      sorter: true,
    },
    { title: '成本', dataIndex: 'costStatus', width: 130 },
    { title: '毛利率', dataIndex: 'grossStatus', width: 130 },
    { title: '最低售价', dataIndex: 'minPriceStatus', width: 130 },
    { title: '异常状态', dataIndex: 'exceptionStatus', width: 130 },
  ],
};

const columns = computed(() => baseColumns[activeVariant.value]);
const tableTitle = computed(() => props.title);
function getRowKeyField(variant: Variant) {
  if (variant === 'product') {
    return 'productId';
  }
  if (variant === 'dept') {
    return 'deptId';
  }
  if (variant === 'customer') {
    return 'customerId';
  }
  return 'rowKey';
}

const rowKey = computed(() => getRowKeyField(activeVariant.value));
const pageSummary = computed(() => summarize(rows.value));
const cards = computed(() => [
  { label: '客户数', value: formatNumber(summary.value.customerCount) },
  { label: '单据数', value: formatNumber(summary.value.docCount) },
  { label: '出库金额', value: formatMoney(summary.value.saleAmount) },
  { label: '退货金额', value: formatMoney(summary.value.returnAmount) },
  { label: '销售净额', value: formatMoney(summary.value.netAmount) },
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
  if (activeVariant.value === 'gross') {
    return [
      { label: '成本依据', status: '不可计算', value: '成本快照未形成' },
      { label: '毛利率', status: '规则未启用', value: '不按零成本推算' },
      { label: '最低售价', status: '规则未启用', value: '保留异常栏位' },
      { label: '异常单据', status: '待核对', value: formatNumber(total.value) },
    ];
  }
  if (activeVariant.value === 'customer') {
    return [
      { label: '客户经营', status: '已接入', value: '销售汇总与应收明细' },
      { label: '回款率', status: '按明细核对', value: '不输出临时公式' },
      { label: '客户分层', status: '规则未启用', value: '保留展示位置' },
    ];
  }
  if (activeVariant.value === 'product') {
    return [
      { label: '商品维度', status: '已接入', value: '按商品汇总出退净额' },
      { label: '收付款分摊', status: '规则未启用', value: '不重复摊到每行' },
    ];
  }
  if (activeVariant.value === 'dept') {
    return [
      { label: '人员部门', status: '已接入', value: '沿用可查部门范围' },
      { label: '绩效评分', status: '规则未启用', value: '不输出临时得分' },
    ];
  }
  return [
    { label: '销售出退', status: '已接入', value: '按现有出库退货记录' },
    { label: '正式毛利', status: '不可计算', value: '缺少税率与成本快照' },
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
      getSaleReportSummary(params),
      getSaleReportTrend(params),
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
    return getSaleReportProductPage(params);
  if (activeVariant.value === 'dept') return getSaleReportDeptPage(params);
  if (activeVariant.value === 'customer') return getSaleReportPage(params);
  return getSaleReportDetailPage(params);
}

function decorateRows(list: ReportRow[]) {
  if (activeVariant.value !== 'gross') return list;
  return list.map((row) => ({
    ...row,
    costStatus: '成本快照缺失',
    exceptionStatus: '待规则启用',
    grossStatus: '不可计算',
    minPriceStatus: '规则未启用',
  }));
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
  pageSize.value = 20;
  void loadData();
}

function handlePageChange(nextPage: number, nextPageSize: number) {
  pageNo.value = nextPage;
  pageSize.value = nextPageSize;
  void loadData();
}

function toSortOrder(order: unknown) {
  if (order === 'ascend') {
    return 'asc';
  }
  if (order === 'descend') {
    return 'desc';
  }
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
  if (activeVariant.value === 'product') {
    return exportSaleReportProduct(params);
  }
  if (activeVariant.value === 'dept') {
    return exportSaleReportDept(params);
  }
  if (activeVariant.value === 'customer') {
    return exportSaleReport(params);
  }
  return exportSaleReportDetailPage(params);
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
  return formatSaleAmount(value, '-');
}

function formatNumber(value: unknown) {
  return formatSaleDecimal(value, '-');
}

function formatDate(value: unknown) {
  if (!value) return '-';
  return formatDateTime(value as string) || String(value);
}

function getRankName(row: ReportRow) {
  if (activeVariant.value === 'product') {
    return (
      (row as ErpSaleReportApi.SaleProductReport).productName ||
      (row as ErpSaleReportApi.SaleProductReport).productCode ||
      '未命名商品'
    );
  }
  if (activeVariant.value === 'dept') {
    return (row as ErpSaleReportApi.SaleDeptReport).deptName || '未设置部门';
  }
  if (activeVariant.value === 'customer') {
    return (row as ErpSaleReportApi.SaleReport).customerName || '未命名客户';
  }
  return (
    (row as ErpSaleReportApi.SaleReportDetail).docNo ||
    (row as ErpSaleReportApi.SaleReportDetail).docType ||
    '未命名单据'
  );
}

function getTrendHeight(value: unknown) {
  const amount = Math.abs(Number(value || 0));
  return `${Math.max(8, Math.round((amount / maxTrendAmount.value) * 72))}px`;
}

function openCustomerDetail(row: ErpSaleReportApi.SaleReport) {
  currentCustomerId.value = row.customerId;
  currentCustomerName.value = row.customerName || '';
  currentBizTime.value = query.bizTime ? [...query.bizTime] : [];
  detailOpen.value = true;
}

function getStatusColor(text: unknown) {
  const value = String(text || '');
  if (value.includes('已接入')) return 'success';
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
  <div class="sale-business-report-table">
    <Card :bordered="false" class="sale-business-report-table__search">
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
            class="sale-business-report-table__keyword"
            placeholder="客户/单号/商品/部门/销售员"
            @press-enter="handleSearch"
          />
        </FormItem>
        <FormItem label="报表">
          <Select
            :value="activeVariant"
            class="sale-business-report-table__variant"
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

    <div class="sale-business-report-table__cards">
      <Card v-for="item in cards" :key="item.label" size="small">
        <div class="sale-business-report-table__card-label">
          {{ item.label }}
        </div>
        <div class="sale-business-report-table__card-value">
          {{ item.value }}
        </div>
      </Card>
    </div>

    <div class="sale-business-report-table__rule-cards">
      <Card
        v-for="item in ruleCards"
        :key="item.label"
        class="sale-business-report-table__rule-card"
        size="small"
      >
        <div class="sale-business-report-table__rule-title">
          {{ item.label }}
        </div>
        <Tag :color="getStatusColor(item.status)">{{ item.status }}</Tag>
        <div class="sale-business-report-table__rule-value">
          {{ item.value }}
        </div>
      </Card>
    </div>

    <div
      v-if="activeVariant !== 'gross'"
      class="sale-business-report-table__analysis"
    >
      <Card size="small" title="月度经营趋势">
        <div class="sale-business-report-table__trend">
          <div
            v-for="item in trendRows"
            :key="item.period"
            class="sale-business-report-table__trend-item"
          >
            <div class="sale-business-report-table__trend-bar-wrap">
              <div
                class="sale-business-report-table__trend-bar"
                :style="{ height: getTrendHeight(item.netAmount) }"
              ></div>
            </div>
            <div class="sale-business-report-table__trend-amount">
              {{ formatMoney(item.netAmount) }}
            </div>
            <div class="sale-business-report-table__trend-period">
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
        <div class="sale-business-report-table__rank">
          <div
            v-for="item in rankRows"
            :key="item.key"
            class="sale-business-report-table__rank-row"
          >
            <span class="sale-business-report-table__rank-name">{{
              item.name
            }}</span>
            <span class="sale-business-report-table__rank-value">{{
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

    <Card :bordered="false" class="sale-business-report-table__body">
      <template #title>{{ tableTitle }}</template>
      <Table
        class="sale-business-report-table__table"
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
                openCustomerDetail(record as ErpSaleReportApi.SaleReport)
              "
            >
              明细
            </Button>
          </template>
          <template
            v-else-if="
              [
                'costStatus',
                'grossStatus',
                'minPriceStatus',
                'exceptionStatus',
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
            description="当前查询条件下没有销售经营记录"
            title="暂无销售经营数据"
          />
        </template>
      </Table>
      <div class="sale-business-report-table__footer">
        <Space size="large">
          <span>共 {{ total }} 条记录</span>
          <span>本页 {{ pageSummary.count }} 条</span>
          <span>本页出库：{{ formatMoney(pageSummary.saleAmount) }}</span>
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
        currentCustomerName ? `销售明细 - ${currentCustomerName}` : '销售明细'
      "
      width="85vw"
    >
      <DetailDrawer
        :customer-id="currentCustomerId"
        :biz-time="currentBizTime"
      />
    </Drawer>
  </div>
</template>

<style scoped>
.sale-business-report-table {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 100%;
  gap: 8px;
}

.sale-business-report-table__search,
.sale-business-report-table__cards,
.sale-business-report-table__rule-cards {
  flex: 0 0 auto;
}

.sale-business-report-table__keyword {
  width: 220px;
}

.sale-business-report-table__variant {
  width: 150px;
}

.sale-business-report-table__cards {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 8px;
}

.sale-business-report-table__card-label {
  color: hsl(var(--muted-foreground));
  font-size: 12px;
}

.sale-business-report-table__card-value {
  margin-top: 4px;
  color: hsl(var(--foreground));
  font-size: 18px;
  font-weight: 700;
}

.sale-business-report-table__rule-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 8px;
}

.sale-business-report-table__rule-card {
  min-width: 0;
}

.sale-business-report-table__rule-title {
  margin-bottom: 6px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
}

.sale-business-report-table__rule-value {
  margin-top: 6px;
  overflow: hidden;
  color: hsl(var(--foreground));
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sale-business-report-table__analysis {
  display: grid;
  flex: 0 0 auto;
  grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr);
  gap: 8px;
}

.sale-business-report-table__trend {
  display: flex;
  min-height: 104px;
  align-items: flex-end;
  gap: 10px;
  overflow-x: auto;
}

.sale-business-report-table__trend-item {
  display: flex;
  min-width: 76px;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
}

.sale-business-report-table__trend-bar-wrap {
  display: flex;
  height: 76px;
  align-items: flex-end;
}

.sale-business-report-table__trend-bar {
  width: 28px;
  border-radius: 8px 8px 0 0;
  background: linear-gradient(180deg, #5b8ff9 0%, #2f54eb 100%);
}

.sale-business-report-table__trend-amount {
  max-width: 92px;
  overflow: hidden;
  color: hsl(var(--foreground));
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sale-business-report-table__rank {
  display: flex;
  min-height: 104px;
  flex-direction: column;
  gap: 8px;
}

.sale-business-report-table__rank-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.sale-business-report-table__rank-name {
  min-width: 0;
  overflow: hidden;
  color: hsl(var(--foreground));
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sale-business-report-table__rank-value {
  flex: 0 0 auto;
  color: #2f54eb;
  font-weight: 600;
}

.sale-business-report-table__body {
  flex: 0 0 auto;
  min-height: 0;
}

.sale-business-report-table__body :deep(.ant-card-body) {
  display: flex;
  min-height: 0;
  flex-direction: column;
}

.sale-business-report-table__table {
  flex: 0 0 auto;
  min-height: 0;
}

.sale-business-report-table__table :deep(.ant-table-body) {
  overflow-y: visible !important;
}

.sale-business-report-table__footer {
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
  .sale-business-report-table__cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
