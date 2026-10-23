<script setup lang="ts">
import { stockMoney } from '#/views/erp/stock/utils/stock-decimal';
/* eslint-disable vue/html-closing-bracket-newline -- Oxfmt manages multiline template layout. */
import type { TableColumnsType, TablePaginationConfig } from 'ant-design-vue';

import type { ErpWarehouseMoveApi } from '#/api/erp/stock/warehouse-move';

import { computed, onMounted, reactive, ref } from 'vue';

import { formatDateTime } from '@vben/utils';

import {
  Button,
  Card,
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
  getWarehouseMovePage,
  getWarehouseMoveSummary,
} from '#/api/erp/stock/warehouse-move';
import { stockNaturalGrouped as stockNatural } from '#/views/erp/stock/utils/stock-decimal';

defineOptions({ name: 'ErpWarehouseMoveReadonlyTable' });

type WarehouseMove = ErpWarehouseMoveApi.WarehouseMove;

const statusOptions = [
  { label: '草稿', value: 0 },
  { label: '待审核', value: 10 },
  { label: '已审核', value: 20 },
];

const query = reactive({
  keyword: '',
  sourceNo: '',
  status: undefined as number | undefined,
});
const pageNo = ref(1);
const pageSize = ref(10);
const total = ref(0);
const loading = ref(false);
const rows = ref<WarehouseMove[]>([]);
const summary = ref<ErpWarehouseMoveApi.WarehouseMoveSummary>({});

const columns: TableColumnsType<WarehouseMove> = [
  { title: '移货单号', dataIndex: 'no', width: 160 },
  { title: '移货日期', dataIndex: 'moveTime', width: 155 },
  { title: '移货类型', dataIndex: 'moveType', width: 105 },
  { title: '移出仓库', dataIndex: 'fromWarehouseName', width: 130 },
  { title: '移入仓库', dataIndex: 'toWarehouseName', width: 130 },
  { title: '状态', dataIndex: 'status', width: 95 },
  { title: '项数', dataIndex: 'itemCount', width: 80, align: 'right' },
  { title: '移货数', dataIndex: 'totalCount', width: 110, align: 'right' },
  {
    title: '总成本金额',
    dataIndex: 'totalCostAmount',
    width: 125,
    align: 'right',
  },
  { title: '移货总金额', dataIndex: 'totalPrice', width: 125, align: 'right' },
  { title: '经办人', dataIndex: 'handlerName', width: 105 },
  { title: '审核人', dataIndex: 'approveUserName', width: 105 },
  { title: '审核时间', dataIndex: 'approveTime', width: 155 },
  { title: '来源单号', dataIndex: 'sourceNo', width: 140 },
  { title: '备注', dataIndex: 'remark', width: 180 },
];

const pageSummary = computed(() => {
  let totalCount = 0;
  let totalCostAmount: null | number = 0;
  let totalPrice: null | number = 0;
  for (const row of rows.value) {
    totalCount += toNumberOrZero(row.totalCount);
    const rowTotalCostAmount = toNullableNumber(row.totalCostAmount);
    const rowTotalPrice = toNullableNumber(row.totalPrice);
    if (rowTotalCostAmount === null) {
      totalCostAmount = null;
    } else if (totalCostAmount !== null) {
      totalCostAmount += rowTotalCostAmount;
    }
    if (rowTotalPrice === null) {
      totalPrice = null;
    } else if (totalPrice !== null) {
      totalPrice += rowTotalPrice;
    }
  }
  return {
    count: rows.value.length,
    totalCostAmount,
    totalCount,
    totalPrice,
  };
});

const pagination = computed<false | TablePaginationConfig>(() => false);

function formatNumber(value: unknown, _precision?: number, _maximum?: number) {
  return stockNatural(value as null | number | string | undefined);
}

function formatMoney(value: unknown, _precision?: number) {
  return stockMoney(value as null | number | string | undefined);
}

function toNullableNumber(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const next = Number(value);
  if (!Number.isFinite(next)) return null;
  return next;
}

function toNumberOrZero(value: unknown) {
  const next = toNullableNumber(value);
  return typeof next === 'number' ? next : 0;
}

function formatDate(value: unknown) {
  if (!value) return '-';
  return formatDateTime(value as string) || String(value);
}

function getStatus(status?: number) {
  if (status === 20) return { color: 'success', label: '已审核' };
  if (status === 10) return { color: 'processing', label: '待审核' };
  if (status === 0) return { color: 'default', label: '草稿' };
  return { color: 'default', label: '-' };
}

function buildParams() {
  return {
    pageNo: pageNo.value,
    pageSize: pageSize.value,
    keyword: query.keyword || undefined,
    sourceNo: query.sourceNo || undefined,
    status: query.status,
    includeItems: false,
  };
}

async function loadData() {
  loading.value = true;
  try {
    const params = buildParams();
    const [pageResult, summaryResult] = await Promise.all([
      getWarehouseMovePage(params),
      getWarehouseMoveSummary(params),
    ]);
    rows.value = pageResult.list || [];
    total.value = pageResult.total || 0;
    summary.value = summaryResult || {};
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  pageNo.value = 1;
  void loadData();
}

function handleReset() {
  query.keyword = '';
  query.sourceNo = '';
  query.status = undefined;
  pageNo.value = 1;
  void loadData();
}

function handlePageChange(nextPage: number, nextPageSize: number) {
  pageNo.value = nextPage;
  pageSize.value = nextPageSize;
  void loadData();
}

onMounted(loadData);
</script>

<template>
  <Card class="warehouse-move-readonly-table" size="small" title="仓库移货">
    <template #extra>
      <span class="warehouse-move-readonly-table__hint">
        按现有仓库移货记录展示移出、移入、数量、金额和单据状态。
      </span>
    </template>

    <Form class="warehouse-move-readonly-table__query" layout="inline">
      <FormItem label="关键词">
        <Input
          v-model:value="query.keyword"
          allow-clear
          placeholder="请输入移货单号或商品"
          @press-enter="handleSearch"
        />
      </FormItem>
      <FormItem label="来源单号">
        <Input
          v-model:value="query.sourceNo"
          allow-clear
          placeholder="请输入来源单号"
          @press-enter="handleSearch"
        />
      </FormItem>
      <FormItem label="单据状态">
        <Select
          v-model:value="query.status"
          allow-clear
          class="warehouse-move-readonly-table__status"
          :options="statusOptions"
          placeholder="请选择状态"
        />
      </FormItem>
      <FormItem>
        <Space>
          <Button type="primary" @click="handleSearch">查询</Button>
          <Button @click="handleReset">重置</Button>
        </Space>
      </FormItem>
    </Form>

    <Table
      class="warehouse-move-readonly-table__table"
      :columns="columns"
      :data-source="rows"
      :loading="loading"
      :pagination="pagination"
      row-key="id"
      size="small"
      :scroll="{ x: 1800, y: '100%' }"
    >
      <template #bodyCell="{ column, record, text }">
        <template v-if="column.dataIndex === 'status'">
          <Tag :color="getStatus(record.status).color">
            {{ getStatus(record.status).label }}
          </Tag>
        </template>
        <template
          v-else-if="
            ['moveTime', 'approveTime'].includes(String(column.dataIndex))
          "
        >
          {{ formatDate(text) }}
        </template>
        <template v-else-if="column.dataIndex === 'moveType'">
          {{ text || '同价移货' }}
        </template>
        <template
          v-else-if="
            ['totalCount', 'itemCount'].includes(String(column.dataIndex))
          "
        >
          {{ formatNumber(text) }}
        </template>
        <template
          v-else-if="
            ['totalCostAmount', 'totalPrice'].includes(String(column.dataIndex))
          "
        >
          {{ formatMoney(text) }}
        </template>
        <template v-else>
          {{ text || '-' }}
        </template>
      </template>
    </Table>

    <div class="warehouse-move-readonly-table__footer">
      <Space size="large">
        <span>共 {{ total }} 条记录</span>
        <span>本页 {{ pageSummary.count }} 条</span>
        <span>本页数量：{{ formatNumber(pageSummary.totalCount) }}</span>
        <span
          >本页成本金额：{{ formatMoney(pageSummary.totalCostAmount) }}</span
        >
        <span>本页移货金额：{{ formatMoney(pageSummary.totalPrice) }}</span>
      </Space>
      <Space size="large">
        <span>全部数量：{{ formatNumber(summary.totalCount) }}</span>
        <span>全部成本金额：{{ formatMoney(summary.totalCostAmount) }}</span>
        <span>全部移货金额：{{ formatMoney(summary.totalPrice) }}</span>
      </Space>
      <Pagination
        v-model:current="pageNo"
        v-model:page-size="pageSize"
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
.warehouse-move-readonly-table {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.warehouse-move-readonly-table :deep(.ant-card-head) {
  flex: 0 0 auto;
}

.warehouse-move-readonly-table :deep(.ant-card-body) {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  padding: 12px;
}

.warehouse-move-readonly-table__hint {
  display: inline-block;
  max-width: 840px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  white-space: normal;
}

.warehouse-move-readonly-table__query {
  flex: 0 0 auto;
  margin-bottom: 8px;
}

.warehouse-move-readonly-table__status {
  width: 150px;
}

.warehouse-move-readonly-table__table {
  flex: 1 1 auto;
  min-height: 0;
}

.warehouse-move-readonly-table__table :deep(.ant-spin-nested-loading),
.warehouse-move-readonly-table__table :deep(.ant-spin-container),
.warehouse-move-readonly-table__table :deep(.ant-table),
.warehouse-move-readonly-table__table :deep(.ant-table-container),
.warehouse-move-readonly-table__table :deep(.ant-table-body) {
  height: 100%;
}

.warehouse-move-readonly-table__footer {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
  margin-top: 8px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
}
</style>
