<script setup lang="ts">
import type { TableColumnsType, TablePaginationConfig } from 'ant-design-vue';

import type { ErpSettlementOffsetApi } from '#/api/erp/finance/settlement/offset';

import { computed, onMounted, reactive, ref } from 'vue';

import { erpPriceInputFormatter } from '@vben/utils';

import {
  Button,
  Card,
  Form,
  FormItem,
  Input,
  Pagination,
  Space,
  Table,
  Tag,
} from 'ant-design-vue';

import { getSettlementOffsetPage } from '#/api/erp/finance/settlement/offset';

defineOptions({ name: 'ErpSettlementOffsetReadonlyTable' });

const query = reactive({
  keyword: '',
});
const pageNo = ref(1);
const pageSize = ref(10);
const total = ref(0);
const loading = ref(false);
const rows = ref<ErpSettlementOffsetApi.SettlementOffset[]>([]);

const columns: TableColumnsType<ErpSettlementOffsetApi.SettlementOffset> = [
  { title: '往来对象', dataIndex: 'subjectName', width: 190 },
  { title: '客户编码', dataIndex: 'customerCode', width: 130 },
  { title: '部门', dataIndex: 'deptName', width: 130 },
  { title: '联系人', dataIndex: 'contact', width: 110 },
  { title: '手机号', dataIndex: 'mobile', width: 130 },
  {
    title: '应收余额',
    dataIndex: 'receivableBalance',
    width: 130,
    align: 'right' as const,
  },
  {
    title: '应付余额',
    dataIndex: 'payableBalance',
    width: 130,
    align: 'right' as const,
  },
  {
    title: '轧抵结果',
    dataIndex: 'offsetBalance',
    width: 130,
    align: 'right' as const,
  },
  { title: '方向', dataIndex: 'direction', width: 100 },
];

const pageSummary = computed(() => {
  let payable = 0;
  let receivable = 0;
  let offset = 0;
  for (const row of rows.value) {
    payable += Number(row.payableBalance || 0);
    receivable += Number(row.receivableBalance || 0);
    offset += Number(row.offsetBalance || 0);
  }
  return {
    count: rows.value.length,
    offset,
    payable,
    receivable,
  };
});

function formatMoney(value: unknown) {
  return erpPriceInputFormatter(Number(value || 0));
}

function getDirection(value: unknown) {
  const amount = Number(value || 0);
  if (amount > 0) return { color: 'blue', label: '净应收' };
  if (amount < 0) return { color: 'red', label: '净应付' };
  return { color: 'default', label: '已轧平' };
}

async function loadData() {
  loading.value = true;
  try {
    const result = await getSettlementOffsetPage({
      keyword: query.keyword || undefined,
      pageNo: pageNo.value,
      pageSize: pageSize.value,
    });
    rows.value = result.list || [];
    total.value = result.total || 0;
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  pageNo.value = 1;
  loadData();
}

function handleReset() {
  query.keyword = '';
  pageNo.value = 1;
  loadData();
}

function handlePageChange(nextPage: number, nextPageSize: number) {
  pageNo.value = nextPage;
  pageSize.value = nextPageSize;
  loadData();
}

const pagination = computed<false | TablePaginationConfig>(() => false);

onMounted(loadData);
</script>

<template>
  <Card
    class="settlement-offset-readonly-table"
    size="small"
    title="应收冲应付只读参考"
  >
    <template #extra>
      <span class="settlement-offset-readonly-table__hint">
        只读复用应收冲应付分页，展示同一对象的当前应收、应付和轧抵参考；本页只是轧抵参考，不自动生成冲抵单，不直接调整余额，差异和正式冲抵仍走业务流程；不导出明细、不核销、不调账，也不替代对账单确认、历史截止余额或差异待办。
      </span>
    </template>

    <Form class="settlement-offset-readonly-table__query" layout="inline">
      <FormItem label="关键词">
        <Input
          v-model:value="query.keyword"
          allow-clear
          placeholder="请输入客户/供应商/联系人"
          @press-enter="handleSearch"
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
      class="settlement-offset-readonly-table__table"
      :columns="columns"
      :data-source="rows"
      :loading="loading"
      :pagination="pagination"
      row-key="customerId"
      size="small"
      :scroll="{ x: 1170, y: '100%' }"
    >
      <template #bodyCell="{ column, record, text }">
        <template v-if="column.dataIndex === 'direction'">
          <Tag :color="getDirection(record.offsetBalance).color">
            {{ getDirection(record.offsetBalance).label }}
          </Tag>
        </template>
        <template
          v-else-if="
            ['receivableBalance', 'payableBalance', 'offsetBalance'].includes(
              String(column.dataIndex),
            )
          "
        >
          <span
            :class="{
              'settlement-offset-readonly-table__positive':
                Number(text || 0) > 0,
              'settlement-offset-readonly-table__negative':
                Number(text || 0) < 0,
            }"
          >
            {{ formatMoney(text) }}
          </span>
        </template>
        <template v-else>
          {{ text || '-' }}
        </template>
      </template>
    </Table>

    <div class="settlement-offset-readonly-table__footer">
      <Space size="large">
        <span>共 {{ total }} 条记录</span>
        <span>本页 {{ pageSummary.count }} 条</span>
        <span>本页参考应收：{{ formatMoney(pageSummary.receivable) }}</span>
        <span>本页参考应付：{{ formatMoney(pageSummary.payable) }}</span>
        <span>本页参考轧抵：{{ formatMoney(pageSummary.offset) }}</span>
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
.settlement-offset-readonly-table {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.settlement-offset-readonly-table :deep(.ant-card-head) {
  flex: 0 0 auto;
}

.settlement-offset-readonly-table :deep(.ant-card-body) {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  padding: 12px;
}

.settlement-offset-readonly-table__hint {
  display: inline-block;
  max-width: 760px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  white-space: normal;
}

.settlement-offset-readonly-table__query {
  flex: 0 0 auto;
  margin-bottom: 8px;
}

.settlement-offset-readonly-table__table {
  flex: 1 1 auto;
  min-height: 0;
}

.settlement-offset-readonly-table__table :deep(.ant-spin-nested-loading),
.settlement-offset-readonly-table__table :deep(.ant-spin-container),
.settlement-offset-readonly-table__table :deep(.ant-table),
.settlement-offset-readonly-table__table :deep(.ant-table-container),
.settlement-offset-readonly-table__table :deep(.ant-table-body) {
  height: 100%;
}

.settlement-offset-readonly-table__positive {
  color: #1677ff;
}

.settlement-offset-readonly-table__negative {
  color: #ef4444;
}

.settlement-offset-readonly-table__footer {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 8px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
}
</style>
