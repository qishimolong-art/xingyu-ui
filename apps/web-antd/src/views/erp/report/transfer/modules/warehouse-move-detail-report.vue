<script setup lang="ts">
import type { TablePaginationConfig } from 'ant-design-vue';
import type { ColumnType } from 'ant-design-vue/es/table';
import type { Dayjs } from 'dayjs';

import type { ErpWarehouseMoveDetailReportApi } from '#/api/erp/report/warehouse-move-detail';

import { computed, onMounted, reactive, ref } from 'vue';

import { useAccess } from '@vben/access';
import { downloadFileFromBlobPart, formatDateTime } from '@vben/utils';

import {
  Alert,
  Button,
  Card,
  DatePicker,
  Form,
  FormItem,
  Input,
  message,
  Pagination,
  Space,
  Table,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import {
  exportWarehouseMoveDetail,
  getWarehouseMoveDetailPage,
  getWarehouseMoveDetailSummary,
} from '#/api/erp/report/warehouse-move-detail';
import { getWarehouseSimplePage } from '#/api/erp/stock/warehouse';
import ErpLazyPageSelect from '#/views/erp/components/ErpLazyPageSelect.vue';

defineOptions({ name: 'ErpWarehouseMoveDetailReport' });

type ReportRow = ErpWarehouseMoveDetailReportApi.Row;
type SortOrder = 'asc' | 'desc';

const { RangePicker } = DatePicker;
const { hasAccessByCodes } = useAccess();
const canExport = computed(() =>
  hasAccessByCodes(['erp:warehouse-move:export']),
);

const defaultDateRange = (): [Dayjs, Dayjs] => [
  dayjs().subtract(29, 'day').startOf('day'),
  dayjs().endOf('day'),
];
const query = reactive({
  approveTime: defaultDateRange() as [Dayjs, Dayjs] | undefined,
  fromWarehouseId: undefined as number | undefined,
  keyword: '',
  toWarehouseId: undefined as number | undefined,
});
const pageNo = ref(1);
const pageSize = ref(10);
const total = ref(0);
const loading = ref(false);
const exporting = ref(false);
const error = ref('');
const rows = ref<ReportRow[]>([]);
const summary = ref<ErpWarehouseMoveDetailReportApi.Summary>({});
const orderField = ref<string>();
const orderDirection = ref<SortOrder>();
let requestId = 0;

const allColumns: ColumnType<ReportRow>[] = [
  { title: '编码', dataIndex: 'productCode', width: 132, sorter: true },
  { title: '单号', dataIndex: 'documentNo', width: 172, sorter: true },
  { title: '审核日期', dataIndex: 'approveTime', width: 164, sorter: true },
  {
    title: '名称',
    dataIndex: 'productName',
    width: 180,
    ellipsis: true,
    sorter: true,
  },
  {
    title: '品牌',
    dataIndex: 'brand',
    width: 112,
    ellipsis: true,
    sorter: true,
  },
  {
    title: '车型',
    dataIndex: 'vehicleModel',
    width: 150,
    ellipsis: true,
    sorter: true,
  },
  { title: '产地', dataIndex: 'originPlace', width: 104, sorter: true },
  { title: '单位', dataIndex: 'unitName', width: 86, sorter: true },
  {
    title: '移动数',
    dataIndex: 'count',
    width: 104,
    align: 'right',
    sorter: true,
  },
  {
    title: '单价',
    dataIndex: 'costPrice',
    width: 112,
    align: 'right',
    sorter: true,
  },
  {
    title: '金额',
    dataIndex: 'costAmount',
    width: 120,
    align: 'right',
    sorter: true,
  },
  {
    title: '移货单价',
    dataIndex: 'movePrice',
    width: 112,
    align: 'right',
    sorter: true,
  },
  {
    title: '移货金额',
    dataIndex: 'moveAmount',
    width: 120,
    align: 'right',
    sorter: true,
  },
  {
    title: '移出仓库',
    dataIndex: 'fromWarehouseName',
    width: 132,
    sorter: true,
  },
  { title: '移出货架', dataIndex: 'fromShelf', width: 108, sorter: true },
  { title: '移入仓库', dataIndex: 'toWarehouseName', width: 132, sorter: true },
  { title: '移入货架', dataIndex: 'toShelf', width: 108, sorter: true },
  { title: '制单人', dataIndex: 'creatorName', width: 108, sorter: true },
  { title: '审核人', dataIndex: 'approveUserName', width: 108, sorter: true },
  {
    title: '规格',
    dataIndex: 'standard',
    width: 132,
    ellipsis: true,
    sorter: true,
  },
  { title: '图号', dataIndex: 'drawingNo', width: 128, sorter: true },
  { title: '特征码', dataIndex: 'featureCode', width: 128, sorter: true },
  {
    title: '明细备注',
    dataIndex: 'itemRemark',
    width: 180,
    ellipsis: true,
    sorter: true,
  },
];
const hiddenFields = computed(
  () =>
    new Set(summary.value.hiddenFields || rows.value[0]?.hiddenFields || []),
);
const columns = computed(() =>
  allColumns.filter(
    (column) => !hiddenFields.value.has(String(column.dataIndex)),
  ),
);
const costVisible = computed(
  () =>
    summary.value.costVisible !== false &&
    rows.value.every((row) => row.costVisible !== false),
);
const movePriceVisible = computed(
  () =>
    summary.value.movePriceVisible !== false &&
    rows.value.every((row) => row.movePriceVisible !== false),
);
const pageCount = computed(() => sumRows('count'));
const pageCostAmount = computed(() => sumRows('costAmount'));
const pageMoveAmount = computed(() => sumRows('moveAmount'));

function buildParams(): ErpWarehouseMoveDetailReportApi.Query {
  const date = query.approveTime;
  return {
    pageNo: pageNo.value,
    pageSize: pageSize.value,
    approveTime: date
      ? [
          date[0].startOf('day').format('YYYY-MM-DD HH:mm:ss'),
          date[1].endOf('day').format('YYYY-MM-DD HH:mm:ss'),
        ]
      : undefined,
    keyword: query.keyword.trim() || undefined,
    fromWarehouseId: query.fromWarehouseId,
    toWarehouseId: query.toWarehouseId,
    orderField: orderField.value,
    orderDirection: orderDirection.value,
  };
}

async function loadData() {
  const currentRequestId = ++requestId;
  loading.value = true;
  error.value = '';
  try {
    const params = buildParams();
    const [pageResult, summaryResult] = await Promise.all([
      getWarehouseMoveDetailPage(params),
      getWarehouseMoveDetailSummary({ ...params, pageNo: 1, pageSize: 10 }),
    ]);
    if (currentRequestId !== requestId) return;
    rows.value = pageResult.list || [];
    total.value = Number(pageResult.total || 0);
    summary.value = summaryResult || {};
  } catch {
    if (currentRequestId !== requestId) return;
    rows.value = [];
    total.value = 0;
    summary.value = {};
    error.value = '仓库移货明细加载失败，请稍后重试';
  } finally {
    if (currentRequestId === requestId) loading.value = false;
  }
}

function handleSearch() {
  pageNo.value = 1;
  void loadData();
}

function handleReset() {
  query.approveTime = defaultDateRange();
  query.keyword = '';
  query.fromWarehouseId = undefined;
  query.toWarehouseId = undefined;
  orderField.value = undefined;
  orderDirection.value = undefined;
  pageNo.value = 1;
  pageSize.value = 10;
  void loadData();
}

function handlePageChange(nextPage: number, nextPageSize: number) {
  pageNo.value = nextPageSize === pageSize.value ? nextPage : 1;
  pageSize.value = nextPageSize;
  void loadData();
}

function handleTableChange(
  _pagination: TablePaginationConfig,
  _filters: Record<string, any>,
  sorter: any,
) {
  const target = Array.isArray(sorter) ? sorter[0] : sorter;
  orderField.value = target?.order ? String(target.field || '') : undefined;
  if (target?.order === 'ascend') {
    orderDirection.value = 'asc';
  } else if (target?.order === 'descend') {
    orderDirection.value = 'desc';
  } else {
    orderDirection.value = undefined;
  }
  pageNo.value = 1;
  void loadData();
}

async function handleExport() {
  exporting.value = true;
  try {
    const data = await exportWarehouseMoveDetail({
      ...buildParams(),
      pageNo: 1,
      pageSize: 10,
    });
    downloadFileFromBlobPart({
      fileName: '仓库移货明细报表.xlsx',
      source: data,
    });
    message.success('导出成功');
  } finally {
    exporting.value = false;
  }
}

function loadFromWarehouseOptions(params: any) {
  return getWarehouseSimplePage({ ...params, bizType: 'stockMoveFrom' });
}

function loadToWarehouseOptions(params: any) {
  return getWarehouseSimplePage({ ...params, bizType: 'stock' });
}

function sumRows(field: keyof ReportRow) {
  let sum = 0;
  for (const row of rows.value) {
    const value = Number(row[field] ?? 0);
    if (Number.isFinite(value)) sum += value;
  }
  return sum;
}

function formatText(value: unknown) {
  return value === null || value === undefined || value === ''
    ? '-'
    : String(value);
}

function formatNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return '-';
  const number = Number(value);
  if (!Number.isFinite(number)) return '-';
  return number.toLocaleString('zh-CN', { maximumFractionDigits: 6 });
}

function formatMoney(value: unknown) {
  if (value === null || value === undefined || value === '') return '****';
  const number = Number(value);
  if (!Number.isFinite(number)) return '-';
  return number.toLocaleString('zh-CN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

onMounted(loadData);
</script>

<template>
  <Card
    class="warehouse-move-detail-report"
    size="small"
    title="仓库移货明细报表"
  >
    <template #extra>
      <Button
        v-if="canExport"
        type="primary"
        :loading="exporting"
        @click="handleExport"
      >
        导出
      </Button>
    </template>

    <Form class="warehouse-move-detail-report__query" layout="inline">
      <FormItem label="审核日期">
        <RangePicker v-model:value="query.approveTime" allow-clear />
      </FormItem>
      <FormItem label="关键词">
        <Input
          v-model:value="query.keyword"
          allow-clear
          class="warehouse-move-detail-report__keyword"
          placeholder="单号、编码、名称、品牌、车型等"
          @press-enter="handleSearch"
        />
      </FormItem>
      <FormItem label="移出仓库">
        <ErpLazyPageSelect
          v-model:value="query.fromWarehouseId"
          :api="loadFromWarehouseOptions"
          class="warehouse-move-detail-report__select"
          label-field="name"
          :page-size="10"
          placeholder="请选择移出仓库"
          show-search
          value-field="id"
        />
      </FormItem>
      <FormItem label="移入仓库">
        <ErpLazyPageSelect
          v-model:value="query.toWarehouseId"
          :api="loadToWarehouseOptions"
          class="warehouse-move-detail-report__select"
          label-field="name"
          :page-size="10"
          placeholder="请选择移入仓库"
          show-search
          value-field="id"
        />
      </FormItem>
      <FormItem>
        <Space>
          <Button type="primary" @click="handleSearch">查询</Button>
          <Button @click="handleReset">重置</Button>
        </Space>
      </FormItem>
    </Form>

    <Alert
      v-if="error"
      class="warehouse-move-detail-report__error"
      :message="error"
      show-icon
      type="error"
    />

    <Table
      class="warehouse-move-detail-report__table"
      :columns="columns"
      :data-source="rows"
      :loading="loading"
      :pagination="false"
      row-key="itemId"
      size="small"
      :scroll="{ x: 'max-content', y: '100%' }"
      @change="handleTableChange"
    >
      <template #bodyCell="{ column, text }">
        <template v-if="column.dataIndex === 'approveTime'">
          {{ text ? formatDateTime(text) : '-' }}
        </template>
        <template
          v-else-if="
            ['costPrice', 'costAmount'].includes(String(column.dataIndex))
          "
        >
          {{ costVisible ? formatMoney(text) : '****' }}
        </template>
        <template
          v-else-if="
            ['movePrice', 'moveAmount'].includes(String(column.dataIndex))
          "
        >
          {{ movePriceVisible ? formatMoney(text) : '****' }}
        </template>
        <template v-else-if="column.dataIndex === 'count'">
          {{ formatNumber(text) }}
        </template>
        <template v-else>{{ formatText(text) }}</template>
      </template>
    </Table>

    <div class="warehouse-move-detail-report__subtotal">
      <b>本页小计：</b>
      <span>明细行：{{ rows.length }}</span>
      <span>移动数：{{ formatNumber(pageCount) }}</span>
      <span v-if="costVisible">金额：{{ formatMoney(pageCostAmount) }}</span>
      <span v-if="movePriceVisible">
        移货金额：{{ formatMoney(pageMoveAmount) }}
      </span>
    </div>
    <div class="warehouse-move-detail-report__footer">
      <Space size="large" wrap>
        <b>全条件合计：</b>
        <span>明细行：{{ formatNumber(summary.rowCount) }}</span>
        <span>移动数：{{ formatNumber(summary.totalCount) }}</span>
        <span v-if="costVisible">
          金额：{{ formatMoney(summary.totalCostAmount) }}
        </span>
        <span v-if="movePriceVisible">
          移货金额：{{ formatMoney(summary.totalMoveAmount) }}
        </span>
      </Space>
      <Pagination
        v-model:current="pageNo"
        v-model:page-size="pageSize"
        :page-size-options="['10', '20', '50', '100']"
        :total="total"
        :show-total="(value) => `共 ${value} 条`"
        show-size-changer
        size="small"
        @change="handlePageChange"
        @show-size-change="handlePageChange"
      />
    </div>
  </Card>
</template>

<style scoped>
.warehouse-move-detail-report {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.warehouse-move-detail-report :deep(.ant-card-body) {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  padding: 12px;
}

.warehouse-move-detail-report__query {
  flex: 0 0 auto;
  row-gap: 8px;
  margin-bottom: 8px;
}

.warehouse-move-detail-report__keyword {
  width: 240px;
}

.warehouse-move-detail-report__select {
  width: 180px;
}

.warehouse-move-detail-report__error {
  margin-bottom: 8px;
}

.warehouse-move-detail-report__table {
  flex: 1 1 auto;
  min-height: 0;
}

.warehouse-move-detail-report__table :deep(.ant-spin-nested-loading),
.warehouse-move-detail-report__table :deep(.ant-spin-container),
.warehouse-move-detail-report__table :deep(.ant-table),
.warehouse-move-detail-report__table :deep(.ant-table-container),
.warehouse-move-detail-report__table :deep(.ant-table-body) {
  height: 100%;
}

.warehouse-move-detail-report__subtotal,
.warehouse-move-detail-report__footer {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  border-top: 1px solid hsl(var(--border));
}

.warehouse-move-detail-report__subtotal {
  flex-wrap: wrap;
  justify-content: flex-start;
  min-height: 32px;
  padding: 4px 8px;
}

.warehouse-move-detail-report__footer {
  min-height: 40px;
  padding: 5px 8px;
}

.warehouse-move-detail-report__subtotal b,
.warehouse-move-detail-report__footer b {
  color: hsl(var(--foreground));
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
</style>
