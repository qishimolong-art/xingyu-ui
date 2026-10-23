<script lang="ts" setup>
import { financeAdd } from '#/views/erp/finance/utils/finance-decimal';

import { financeIsFinite } from '#/views/erp/finance/utils/finance-decimal';

import { financeMoneyGrouped } from '#/views/erp/finance/utils/finance-decimal';
import { financeAdd } from '#/views/erp/finance/utils/finance-decimal';

import { financeMoney as erpPriceInputFormatter } from '#/views/erp/finance/utils/finance-decimal';

import type { Dayjs } from 'dayjs';

import { computed, onMounted, reactive, ref } from 'vue';

import { downloadFileFromBlobPart } from '@vben/utils';

import {
  Button,
  Card,
  DatePicker,
  Empty,
  Form,
  FormItem,
  Input,
  Pagination,
  Space,
  Tag,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import { getPayableExpensePage } from '#/api/erp/finance/payable/expense';
import { normalizePayableExpenseListRow } from '#/views/erp/finance/payable/expense/ui';

const props = withDefaults(
  defineProps<{
    mode?: 'department';
    title?: string;
  }>(),
  {
    mode: 'department',
    title: '部门费用汇总',
  },
);

const RangePicker = DatePicker.RangePicker;
const DEFAULT_PAGE_SIZE = 10;

interface DepartmentExpenseRow {
  deptName: string;
  differenceAmount: string;
  documentCount: number;
  expenseAmount: number;
  expenseCategory: string;
  id: string;
  originalRows: any[];
}

const query = reactive<{
  dateRange?: [Dayjs, Dayjs];
  keyword: string;
}>({
  dateRange: [dayjs().subtract(29, 'day').startOf('day'), dayjs().endOf('day')],
  keyword: '',
});

const loading = ref(false);
const pageNo = ref(1);
const pageSize = ref(DEFAULT_PAGE_SIZE);
const total = ref(0);
const rows = ref<DepartmentExpenseRow[]>([]);

function toNumber(value: unknown) {
  const amount = Number(value || 0);
  return financeIsFinite(amount) ? amount : 0;
}

function formatAmount(value: unknown) {
  return financeMoneyGrouped(value as any);
}

function buildParams() {
  return {
    pageNo: pageNo.value,
    pageSize: pageSize.value,
    bizTime: query.dateRange?.map((item) => item.format('YYYY-MM-DD HH:mm:ss')),
    no: query.keyword || undefined,
    includeItems: false,
  };
}

function buildDepartmentRows(list: any[]) {
  const map = new Map<string, DepartmentExpenseRow>();
  for (const rawRow of list) {
    const row = normalizePayableExpenseListRow(rawRow);
    const deptName = row.deptName || '未填写部门';
    const expenseCategory =
      row.expenseType || row.expenseBizType || '未分类费用';
    const key = `${deptName}::${expenseCategory}`;
    const current = map.get(key) || {
      deptName,
      differenceAmount: '不可计算',
      documentCount: 0,
      expenseAmount: 0,
      expenseCategory,
      id: key,
      originalRows: [],
    };
    current.documentCount += 1;
    current.expenseAmount = financeAdd(
      current.expenseAmount,
      toNumber(row.totalAmount),
    );
    current.originalRows.push(row);
    map.set(key, current);
  }
  return [...map.values()];
}

async function loadData() {
  loading.value = true;
  try {
    const result = await getPayableExpensePage(buildParams());
    const list = result.list || [];
    rows.value = buildDepartmentRows(list);
    total.value = result.total || 0;
  } finally {
    loading.value = false;
  }
}

async function handleSearch() {
  pageNo.value = 1;
  await loadData();
}

async function handleReset() {
  query.dateRange = [
    dayjs().subtract(29, 'day').startOf('day'),
    dayjs().endOf('day'),
  ];
  query.keyword = '';
  pageNo.value = 1;
  pageSize.value = DEFAULT_PAGE_SIZE;
  await loadData();
}

async function handlePageChange(nextPage: number, nextPageSize: number) {
  pageNo.value = nextPage;
  pageSize.value = nextPageSize;
  await loadData();
}

function escapeCsv(value: unknown) {
  const text = value === undefined || value === null ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function handleExport() {
  const header = [
    '承担部门',
    '费用项目',
    '费用金额',
    '预算金额',
    '差异金额',
    '预算完成率',
    '单据数',
  ];
  const body = rows.value.map((row) => [
    row.deptName,
    row.expenseCategory,
    formatAmount(row.expenseAmount),
    '待规则确认',
    row.differenceAmount,
    '不可计算',
    row.documentCount,
  ]);
  const csv = [header, ...body]
    .map((line) => line.map((item) => escapeCsv(item)).join(','))
    .join('\n');
  downloadFileFromBlobPart({
    fileName: `${props.title}.csv`,
    source: new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }),
  });
}

const cards = computed(() => {
  const expenseAmount = rows.value.reduce(
    (sum, row) => financeAdd(sum, row.expenseAmount),
    '0',
  );
  const documentCount = rows.value.reduce(
    (sum, row) => sum + row.documentCount,
    0,
  );
  return [
    { label: '费用金额', value: formatAmount(expenseAmount), status: '已接入' },
    { label: '费用单据', value: `${documentCount}`, status: '已接入' },
    { label: '预算金额', value: '待规则确认', status: '待规则确认' },
    { label: '预算完成率', value: '不可计算', status: '待规则确认' },
  ];
});

const columns = [
  { dataIndex: 'deptName', title: '承担部门', width: 160 },
  { dataIndex: 'expenseCategory', title: '费用项目', width: 160 },
  { dataIndex: 'expenseAmount', title: '费用金额', width: 130, align: 'right' },
  { dataIndex: 'budgetAmount', title: '预算金额', width: 130, align: 'right' },
  {
    dataIndex: 'differenceAmount',
    title: '差异金额',
    width: 130,
    align: 'right',
  },
  {
    dataIndex: 'completionRate',
    title: '预算完成率',
    width: 130,
    align: 'right',
  },
  { dataIndex: 'documentCount', title: '单据数', width: 100, align: 'right' },
];

onMounted(() => {
  void loadData();
});
</script>

<template>
  <div class="expense-income-readiness-report department-expense-report">
    <div class="expense-income-readiness-report__cards">
      <Card v-for="card in cards" :key="card.label" size="small">
        <div class="expense-income-readiness-report__label">
          {{ card.label }}
        </div>
        <div class="expense-income-readiness-report__value">
          {{ card.value }}
        </div>
        <Tag :color="card.status === '已接入' ? 'success' : 'warning'">{{
          card.status
        }}</Tag>
      </Card>
    </div>

    <Card
      class="expense-income-readiness-report__table-card"
      size="small"
      :title="props.title"
    >
      <div class="expense-income-readiness-report__toolbar">
        <Form layout="inline" @submit.prevent="handleSearch">
          <FormItem label="费用日期">
            <RangePicker v-model:value="query.dateRange" size="small" />
          </FormItem>
          <FormItem label="单据编号">
            <Input
              v-model:value="query.keyword"
              allow-clear
              size="small"
              placeholder="请输入单据编号"
            />
          </FormItem>
          <FormItem>
            <Space>
              <Button
                type="primary"
                size="small"
                :loading="loading"
                @click="handleSearch"
                >查询</Button
              >
              <Button size="small" @click="handleReset">重置</Button>
              <Button size="small" @click="handleExport">导出</Button>
            </Space>
          </FormItem>
        </Form>
      </div>
      <a-table
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        :pagination="false"
        row-key="id"
        size="small"
        :scroll="{ x: 920 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'expenseAmount'">
            {{ formatAmount(record.expenseAmount) }}
          </template>
          <template v-else-if="column.dataIndex === 'budgetAmount'">
            待规则确认
          </template>
          <template v-else-if="column.dataIndex === 'differenceAmount'">
            {{ record.differenceAmount }}
          </template>
          <template v-else-if="column.dataIndex === 'completionRate'">
            不可计算
          </template>
        </template>
        <template #emptyText>
          <Empty description="暂无部门费用汇总数据" />
        </template>
      </a-table>
      <div class="expense-income-readiness-report__pager">
        <span>共 {{ total }} 条费用记录</span>
        <Pagination
          :current="pageNo"
          :page-size="pageSize"
          :page-size-options="['10', '20', '50']"
          :total="total"
          show-size-changer
          size="small"
          @change="handlePageChange"
          @show-size-change="handlePageChange"
        />
      </div>
    </Card>
  </div>
</template>

<style scoped>
.expense-income-readiness-report {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
}

.expense-income-readiness-report__cards {
  display: grid;
  flex: 0 0 auto;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
}

.expense-income-readiness-report__label {
  color: hsl(var(--muted-foreground));
  font-size: 13px;
}

.expense-income-readiness-report__value {
  margin: 8px 0;
  font-size: 20px;
  font-weight: 600;
}

.expense-income-readiness-report__table-card {
  flex: 1 1 auto;
  min-height: 0;
}

.expense-income-readiness-report__table-card :deep(.ant-card-body) {
  display: flex;
  min-height: 320px;
  flex-direction: column;
  padding: 0;
}

.expense-income-readiness-report__toolbar {
  flex: 0 0 auto;
  padding: 12px 12px 4px;
  border-bottom: 1px solid hsl(var(--border));
}

.expense-income-readiness-report__pager {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;
  border-top: 1px solid hsl(var(--border));
  color: hsl(var(--muted-foreground));
  font-size: 12px;
}

@media (max-width: 1280px) {
  .expense-income-readiness-report__cards {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 768px) {
  .expense-income-readiness-report__cards {
    grid-template-columns: minmax(0, 1fr);
  }

  .expense-income-readiness-report__pager {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
