<script setup lang="ts">
import type { TableColumnsType, TablePaginationConfig } from 'ant-design-vue';

import type { ErpImportExportRecordApi } from '#/api/erp/common/import-export-record';

import { computed, onMounted, reactive, ref } from 'vue';

import { downloadFileFromBlobPart, formatDateTime } from '@vben/utils';

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

import { getImportExportRecordPage } from '#/api/erp/common/import-export-record';
import {
  moduleOptions,
  recordStatusOptions,
} from '#/views/erp/system/import-record/data';

type OperationType = 'EXPORT' | 'IMPORT';
type RecordItem = ErpImportExportRecordApi.RecordItem;

defineOptions({ name: 'ErpImportExportAuditReadonlyTable' });

const props = defineProps<{
  operationType: OperationType;
}>();

const query = reactive({
  fileName: '',
  moduleKey: undefined as string | undefined,
  status: undefined as string | undefined,
});
const pageNo = ref(1);
const pageSize = ref(10);
const total = ref(0);
const loading = ref(false);
const rows = ref<RecordItem[]>([]);

const title = computed(() =>
  props.operationType === 'IMPORT' ? '导入记录审计' : '导出记录审计',
);

const columns = computed<TableColumnsType<RecordItem>>(() => {
  const common: TableColumnsType<RecordItem> = [
    { title: '模块', dataIndex: 'moduleName', width: 130 },
    { title: '文件名', dataIndex: 'fileName', width: 220 },
    { title: '状态', dataIndex: 'status', width: 105 },
    { title: '操作人', dataIndex: 'operatorName', width: 110 },
    { title: '耗时', dataIndex: 'durationMs', width: 95, align: 'right' },
    { title: '开始时间', dataIndex: 'startTime', width: 155 },
    { title: '结束时间', dataIndex: 'endTime', width: 155 },
    { title: '创建时间', dataIndex: 'createTime', width: 155 },
    { title: '失败原因', dataIndex: 'errorMessage', width: 240 },
  ];
  if (props.operationType === 'IMPORT') {
    common.splice(
      3,
      0,
      { title: '总数', dataIndex: 'totalCount', width: 80, align: 'right' },
      { title: '成功', dataIndex: 'successCount', width: 80, align: 'right' },
      { title: '失败', dataIndex: 'failureCount', width: 80, align: 'right' },
      { title: '新增', dataIndex: 'createCount', width: 80, align: 'right' },
      { title: '更新', dataIndex: 'updateCount', width: 80, align: 'right' },
    );
    return common;
  }
  common.splice(3, 0, {
    title: '导出数量',
    dataIndex: 'totalCount',
    width: 105,
    align: 'right',
  });
  return common;
});

const pageSummary = computed(() => {
  let totalCount = 0;
  let successCount = 0;
  let failureCount = 0;
  for (const row of rows.value) {
    totalCount += Number(row.totalCount || 0);
    successCount += Number(row.successCount || 0);
    failureCount += Number(row.failureCount || 0);
  }
  return {
    count: rows.value.length,
    failureCount,
    successCount,
    totalCount,
  };
});

const pagination = computed<false | TablePaginationConfig>(() => false);

function getStatus(status?: string) {
  if (status === 'SUCCESS') return { color: 'success', label: '成功' };
  if (status === 'PARTIAL_SUCCESS')
    return { color: 'warning', label: '部分成功' };
  if (status === 'FAILURE') return { color: 'error', label: '失败' };
  if (status === 'PROCESSING') return { color: 'processing', label: '处理中' };
  return { color: 'default', label: status || '-' };
}

function formatNumber(value: unknown) {
  const next = Number(value || 0);
  if (!Number.isFinite(next)) return '-';
  return next.toLocaleString('zh-CN', { maximumFractionDigits: 0 });
}

function formatDuration(value: unknown) {
  const ms = Number(value);
  if (!Number.isFinite(ms)) return '-';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatDate(value: unknown) {
  if (!value) return '-';
  return formatDateTime(value as string) || String(value);
}

function escapeCsv(value: unknown) {
  const text = String(value ?? '');
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function getCellText(row: Record<string, any>, field: unknown) {
  const key = String(field || '');
  const value = row[key];
  if (key === 'status') return getStatus(String(value || '')).label;
  if (key === 'durationMs') return formatDuration(value);
  if (['createTime', 'endTime', 'startTime'].includes(key))
    return formatDate(value);
  if (
    [
      'createCount',
      'failureCount',
      'successCount',
      'totalCount',
      'updateCount',
    ].includes(key)
  ) {
    return formatNumber(value);
  }
  return value ?? '-';
}

function handleExport() {
  const header = columns.value
    .map((column) => escapeCsv(String(column.title || '')))
    .join(',');
  const body = rows.value
    .map((row) =>
      columns.value
        .map((column) =>
          escapeCsv(
            getCellText(
              row as Record<string, any>,
              (column as { dataIndex?: unknown }).dataIndex,
            ),
          ),
        )
        .join(','),
    )
    .join('\n');
  downloadFileFromBlobPart({
    fileName: `${title.value}.csv`,
    source: new Blob([`\uFEFF${[header, body].filter(Boolean).join('\n')}`], {
      type: 'text/csv;charset=utf-8',
    }),
  });
}

async function loadData() {
  loading.value = true;
  try {
    const result = await getImportExportRecordPage({
      fileName: query.fileName || undefined,
      moduleKey: query.moduleKey,
      operationType: props.operationType,
      pageNo: pageNo.value,
      pageSize: pageSize.value,
      status: query.status,
    });
    rows.value = result.list || [];
    total.value = result.total || 0;
  } finally {
    loading.value = false;
  }
}

function handleSearch() {
  pageNo.value = 1;
  void loadData();
}

function handleReset() {
  query.fileName = '';
  query.moduleKey = undefined;
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
  <Card class="import-export-audit-readonly-table" size="small" :title="title">
    <Form class="import-export-audit-readonly-table__query" layout="inline">
      <FormItem label="模块">
        <Select
          v-model:value="query.moduleKey"
          allow-clear
          class="import-export-audit-readonly-table__module"
          :options="moduleOptions"
          placeholder="请选择模块"
          show-search
          option-filter-prop="label"
        />
      </FormItem>
      <FormItem label="文件名">
        <Input
          v-model:value="query.fileName"
          allow-clear
          placeholder="请输入文件名"
          @press-enter="handleSearch"
        />
      </FormItem>
      <FormItem label="状态">
        <Select
          v-model:value="query.status"
          allow-clear
          class="import-export-audit-readonly-table__status"
          :options="recordStatusOptions"
          placeholder="请选择状态"
        />
      </FormItem>
      <FormItem>
        <Space>
          <Button type="primary" @click="handleSearch">查询</Button>
          <Button @click="handleReset">重置</Button>
          <Button @click="handleExport">导出</Button>
        </Space>
      </FormItem>
    </Form>

    <Table
      class="import-export-audit-readonly-table__table"
      :columns="columns"
      :data-source="rows"
      :loading="loading"
      :pagination="pagination"
      row-key="id"
      size="small"
      :scroll="{ x: operationType === 'IMPORT' ? 1760 : 1380, y: '100%' }"
    >
      <template #bodyCell="{ column, text }">
        <template v-if="column.dataIndex === 'status'">
          <Tag :color="getStatus(String(text || '')).color">
            {{ getStatus(String(text || '')).label }}
          </Tag>
        </template>
        <template v-else-if="column.dataIndex === 'durationMs'">
          {{ formatDuration(text) }}
        </template>
        <template
          v-else-if="
            ['createTime', 'endTime', 'startTime'].includes(
              String(column.dataIndex),
            )
          "
        >
          {{ formatDate(text) }}
        </template>
        <template
          v-else-if="
            [
              'createCount',
              'failureCount',
              'successCount',
              'totalCount',
              'updateCount',
            ].includes(String(column.dataIndex))
          "
        >
          {{ formatNumber(text) }}
        </template>
        <template v-else>
          {{ text || '-' }}
        </template>
      </template>
    </Table>

    <div class="import-export-audit-readonly-table__footer">
      <Space size="large">
        <span>共 {{ total }} 条记录</span>
        <span>本页 {{ pageSummary.count }} 条</span>
        <span>本页总数：{{ formatNumber(pageSummary.totalCount) }}</span>
        <span v-if="operationType === 'IMPORT'"
          >成功：{{ formatNumber(pageSummary.successCount) }}</span
        >
        <span v-if="operationType === 'IMPORT'"
          >失败：{{ formatNumber(pageSummary.failureCount) }}</span
        >
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
.import-export-audit-readonly-table {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.import-export-audit-readonly-table :deep(.ant-card-head) {
  flex: 0 0 auto;
}

.import-export-audit-readonly-table :deep(.ant-card-body) {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  padding: 12px;
}

.import-export-audit-readonly-table__query {
  flex: 0 0 auto;
  margin-bottom: 8px;
}

.import-export-audit-readonly-table__module {
  width: 180px;
}

.import-export-audit-readonly-table__status {
  width: 140px;
}

.import-export-audit-readonly-table__table {
  flex: 1 1 auto;
  min-height: 0;
}

.import-export-audit-readonly-table__table :deep(.ant-spin-nested-loading),
.import-export-audit-readonly-table__table :deep(.ant-spin-container),
.import-export-audit-readonly-table__table :deep(.ant-table),
.import-export-audit-readonly-table__table :deep(.ant-table-container),
.import-export-audit-readonly-table__table :deep(.ant-table-body) {
  height: 100%;
}

.import-export-audit-readonly-table__footer {
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
