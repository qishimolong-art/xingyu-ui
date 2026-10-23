<script lang="ts" setup>
import { computed, ref } from 'vue';

import { downloadFileFromBlobPart } from '@vben/utils';

import { Button, Card, Empty, Input, Space, Tag } from 'ant-design-vue';

const props = withDefaults(
  defineProps<{
    mode?: 'allocation' | 'budget';
    title?: string;
  }>(),
  {
    mode: 'allocation',
    title: '公共费用分摊明细',
  },
);

const isBudget = computed(() => props.mode === 'budget');

const cards = computed(() =>
  isBudget.value
    ? [
        { label: '预算金额', value: '暂无数据', status: '待规则确认' },
        { label: '费用金额', value: '暂无数据', status: '待规则确认' },
        { label: '差异金额', value: '暂无数据', status: '待规则确认' },
        { label: '完成率', value: '不可计算', status: '待规则确认' },
      ]
    : [
        { label: '待分摊金额', value: '暂无数据', status: '待规则确认' },
        { label: '已分摊金额', value: '暂无数据', status: '待规则确认' },
        { label: '尾差金额', value: '暂无数据', status: '待规则确认' },
        { label: '分摊规则', value: '待规则确认', status: '未启用' },
      ],
);

const columns = computed(() =>
  isBudget.value
    ? [
        { dataIndex: 'deptName', title: '部门', width: 150 },
        { dataIndex: 'expenseCategory', title: '费用项目', width: 160 },
        {
          dataIndex: 'budgetAmount',
          title: '预算金额',
          width: 130,
          align: 'right',
        },
        {
          dataIndex: 'actualAmount',
          title: '费用金额',
          width: 130,
          align: 'right',
        },
        {
          dataIndex: 'differenceAmount',
          title: '差异金额',
          width: 130,
          align: 'right',
        },
        {
          dataIndex: 'completionRate',
          title: '完成率',
          width: 120,
          align: 'right',
        },
      ]
    : [
        { dataIndex: 'allocationNo', title: '分摊单号', width: 150 },
        { dataIndex: 'expenseNo', title: '费用单号', width: 150 },
        { dataIndex: 'fromDeptName', title: '费用承担部门', width: 150 },
        { dataIndex: 'toDeptName', title: '分摊部门', width: 150 },
        { dataIndex: 'baseName', title: '分摊基数', width: 130 },
        {
          dataIndex: 'allocatedAmount',
          title: '分摊金额',
          width: 130,
          align: 'right',
        },
        { dataIndex: 'status', title: '状态', width: 110 },
      ],
);

const keyword = ref('');
const rows: any[] = [];

function handleSearch() {}

function handleReset() {
  keyword.value = '';
}

function escapeCsv(value: unknown) {
  const text = value === undefined || value === null ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function handleExport() {
  const header = columns.value.map((column) => column.title);
  const csv = [header]
    .map((line) => line.map((item) => escapeCsv(item)).join(','))
    .join('\n');
  downloadFileFromBlobPart({
    fileName: `${props.title}.csv`,
    source: new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }),
  });
}
const emptyDescription = computed(() =>
  isBudget.value ? '暂无费用预算差异数据' : '暂无公共费用分摊数据',
);
</script>

<template>
  <div class="expense-income-readiness-report expense-allocation-report">
    <div class="expense-income-readiness-report__cards">
      <Card v-for="card in cards" :key="card.label" size="small">
        <div class="expense-income-readiness-report__label">
          {{ card.label }}
        </div>
        <div class="expense-income-readiness-report__value">
          {{ card.value }}
        </div>
        <Tag :color="card.status === '未启用' ? 'default' : 'warning'">
          {{ card.status }}
        </Tag>
      </Card>
    </div>

    <Card
      class="expense-income-readiness-report__table-card"
      size="small"
      :title="props.title"
    >
      <div class="expense-income-readiness-report__toolbar">
        <Space>
          <Input
            v-model:value="keyword"
            allow-clear
            size="small"
            placeholder="请输入关键词"
          />
          <Button type="primary" size="small" @click="handleSearch"
            >查询</Button
          >
          <Button size="small" @click="handleReset">重置</Button>
          <Button size="small" @click="handleExport">导出</Button>
        </Space>
      </div>
      <a-table
        :columns="columns"
        :data-source="rows"
        :pagination="{ pageSize: 10, showSizeChanger: false }"
        row-key="id"
        size="small"
        :scroll="{ x: isBudget ? 820 : 980 }"
      >
        <template #emptyText>
          <Empty :description="emptyDescription" />
        </template>
      </a-table>
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
  padding: 12px;
  border-bottom: 1px solid hsl(var(--border));
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
}
</style>
