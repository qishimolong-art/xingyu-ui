<script setup lang="ts">
import type { TableColumnsType, TablePaginationConfig } from 'ant-design-vue';

import type { ErpPurchaseInvoiceOcrApi } from '#/api/erp/purchase/invoice-ocr';

import { computed, onMounted, reactive, ref } from 'vue';

import { downloadFileFromBlobPart } from '@vben/utils';

import {
  Button,
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
  getPurchaseInvoiceOcrBatchPage,
  PURCHASE_INVOICE_OCR_BATCH_STATUS,
} from '#/api/erp/purchase/invoice-ocr';

type OcrBatch = ErpPurchaseInvoiceOcrApi.Batch;

const query = reactive({
  batchNo: '',
  remark: '',
  status: undefined as string | undefined,
});
const loading = ref(false);
const rows = ref<OcrBatch[]>([]);
const total = ref(0);
const pageNo = ref(1);
const pageSize = ref(10);

const statusOptions = Object.values(PURCHASE_INVOICE_OCR_BATCH_STATUS).map(
  (status) => ({ label: getBatchStatusMeta(status).label, value: status }),
);

const columns = computed<TableColumnsType<OcrBatch>>(() => [
  { title: '批次号', dataIndex: 'batchNo', key: 'batchNo', width: 190 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 110 },
  {
    title: '文件数',
    dataIndex: 'fileCount',
    key: 'fileCount',
    width: 80,
    align: 'right',
  },
  {
    title: '生成票据数',
    dataIndex: 'generatedInvoiceCount',
    key: 'generatedInvoiceCount',
    width: 110,
    align: 'right',
  },
  { title: '异常信息', dataIndex: 'errorMsg', key: 'errorMsg', width: 260 },
  { title: '备注', dataIndex: 'remark', key: 'remark', width: 220 },
  { title: '创建时间', dataIndex: 'createTime', key: 'createTime', width: 155 },
  { title: '更新时间', dataIndex: 'updateTime', key: 'updateTime', width: 155 },
]);

const pageSummary = computed(() => {
  let fileCount = 0;
  let generatedInvoiceCount = 0;
  let abnormalBatchCount = 0;
  for (const row of rows.value) {
    fileCount += Number(row.fileCount || 0);
    generatedInvoiceCount += Number(row.generatedInvoiceCount || 0);
    if (
      row.errorMsg ||
      row.status === PURCHASE_INVOICE_OCR_BATCH_STATUS.FAILED
    ) {
      abnormalBatchCount += 1;
    }
  }
  return {
    abnormalBatchCount,
    count: rows.value.length,
    fileCount,
    generatedInvoiceCount,
  };
});

const pagination = computed<false | TablePaginationConfig>(() => false);

function getBatchStatusMeta(status?: string) {
  const map: Record<string, { color: string; label: string }> = {
    CONFIRMED: { color: 'purple', label: '已确认' },
    DRAFT: { color: 'default', label: '待识别' },
    FAILED: { color: 'red', label: '识别失败' },
    MATCHED: { color: 'green', label: '已匹配' },
    RECOGNIZED: { color: 'blue', label: '已识别' },
    RECOGNIZING: { color: 'processing', label: '识别中' },
  };
  return map[status || ''] ?? { color: 'default', label: status || '-' };
}

async function loadData() {
  loading.value = true;
  try {
    const result = await getPurchaseInvoiceOcrBatchPage({
      batchNo: query.batchNo || undefined,
      pageNo: pageNo.value,
      pageSize: pageSize.value,
      remark: query.remark || undefined,
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
  query.batchNo = '';
  query.remark = '';
  query.status = undefined;
  pageNo.value = 1;
  void loadData();
}

function handlePageChange(nextPage: number, nextPageSize: number) {
  pageNo.value = nextPage;
  pageSize.value = nextPageSize;
  void loadData();
}

function escapeCsv(value: unknown) {
  const text = String(value ?? '');
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function getCellText(row: Record<string, any>, field: unknown) {
  const key = String(field || '');
  const value = row[key];
  if (key === 'status') return getBatchStatusMeta(String(value || '')).label;
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
    fileName: '异常来源批次.csv',
    source: new Blob([`\uFEFF${[header, body].filter(Boolean).join('\n')}`], {
      type: 'text/csv;charset=utf-8',
    }),
  });
}

onMounted(loadData);
</script>

<template>
  <div class="purchase-invoice-ocr-readonly-table">
    <Form class="purchase-invoice-ocr-readonly-table__query" layout="inline">
      <FormItem label="批次号">
        <Input
          v-model:value="query.batchNo"
          allow-clear
          placeholder="请输入批次号"
          @press-enter="handleSearch"
        />
      </FormItem>
      <FormItem label="状态">
        <Select
          v-model:value="query.status"
          allow-clear
          class="purchase-invoice-ocr-readonly-table__status"
          :options="statusOptions"
          placeholder="请选择状态"
        />
      </FormItem>
      <FormItem label="备注">
        <Input
          v-model:value="query.remark"
          allow-clear
          placeholder="请输入备注"
          @press-enter="handleSearch"
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
      class="purchase-invoice-ocr-readonly-table__table"
      :columns="columns"
      :data-source="rows"
      :loading="loading"
      :pagination="pagination"
      row-key="id"
      :scroll="{ x: 1280, y: '100%' }"
      size="small"
    >
      <template #bodyCell="{ column, record, text }">
        <template v-if="column.key === 'status'">
          <Tag :color="getBatchStatusMeta(record.status).color">
            {{ getBatchStatusMeta(record.status).label }}
          </Tag>
        </template>
        <template v-else-if="column.key === 'errorMsg'">
          <span
            :class="{
              'purchase-invoice-ocr-readonly-table__error': record.errorMsg,
            }"
          >
            {{ record.errorMsg || '-' }}
          </span>
        </template>
        <template v-else>
          {{ text ?? '-' }}
        </template>
      </template>
    </Table>

    <div class="purchase-invoice-ocr-readonly-table__footer">
      <Space size="large">
        <span>共 {{ total }} 个批次</span>
        <span>本页批次：{{ pageSummary.count }}</span>
        <span>本页文件：{{ pageSummary.fileCount }}</span>
        <span>本页异常批次：{{ pageSummary.abnormalBatchCount }}</span>
        <span>本页生成票据：{{ pageSummary.generatedInvoiceCount }}</span>
      </Space>
      <Pagination
        v-model:current="pageNo"
        v-model:page-size="pageSize"
        :total="total"
        :show-total="(value) => `共 ${value} 个批次`"
        show-size-changer
        size="small"
        @change="handlePageChange"
        @show-size-change="handlePageChange"
      />
    </div>
  </div>
</template>

<style scoped>
.purchase-invoice-ocr-readonly-table {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.purchase-invoice-ocr-readonly-table__query {
  flex: 0 0 auto;
  margin-bottom: 8px;
}

.purchase-invoice-ocr-readonly-table__status {
  width: 160px;
}

.purchase-invoice-ocr-readonly-table__table {
  flex: 1 1 auto;
  min-height: 0;
}

.purchase-invoice-ocr-readonly-table__table :deep(.ant-spin-nested-loading),
.purchase-invoice-ocr-readonly-table__table :deep(.ant-spin-container),
.purchase-invoice-ocr-readonly-table__table :deep(.ant-table),
.purchase-invoice-ocr-readonly-table__table :deep(.ant-table-container),
.purchase-invoice-ocr-readonly-table__table :deep(.ant-table-body) {
  height: 100%;
}

.purchase-invoice-ocr-readonly-table__footer {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 8px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
}

.purchase-invoice-ocr-readonly-table__error {
  color: #cf1322;
  font-weight: 600;
}

:deep(.ant-table) {
  font-size: 12px;
}

:deep(.ant-table-thead > tr > th),
:deep(.ant-table-tbody > tr > td) {
  padding: 7px 8px;
}
</style>
