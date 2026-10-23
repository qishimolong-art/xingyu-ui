<script setup lang="ts">
import type { TablePaginationConfig } from 'ant-design-vue';

import type { ErpPurchaseInvoiceApi } from '#/api/erp/purchase/invoice';

import { computed, onMounted, reactive, ref } from 'vue';

import { downloadFileFromBlobPart, formatDateTime } from '@vben/utils';

import {
  Button,
  Card,
  Form,
  FormItem,
  Input,
  message,
  Pagination,
  Select,
  Space,
  Table,
  Tag,
} from 'ant-design-vue';

import {
  exportFinancialPurchaseInvoice,
  getFinancialPurchaseInvoicePage,
} from '#/api/erp/report/financial-statement';

defineOptions({ name: 'ErpPurchaseInvoiceReadonlyTable' });

const statusOptions = [
  { label: '草稿', value: 0 },
  { label: '待审核', value: 10 },
  { label: '已审核', value: 20 },
];

const query = reactive({
  invoiceNo: '',
  no: '',
  status: undefined as number | undefined,
});
const pageNo = ref(1);
const pageSize = ref(10);
const total = ref(0);
const loading = ref(false);
const exportLoading = ref(false);
const rows = ref<ErpPurchaseInvoiceApi.PurchaseInvoice[]>([]);

const columns = [
  { title: '票据单号', dataIndex: 'no', width: 160 },
  { title: '供应商', dataIndex: 'supplierName', width: 180 },
  { title: '开票日期', dataIndex: 'invoiceDate', width: 140 },
  { title: '发票类型', dataIndex: 'invoiceType', width: 120 },
  { title: '发票号', dataIndex: 'invoiceNo', width: 180 },
  { title: '票据状态', dataIndex: 'status', width: 100 },
  { title: '部门', dataIndex: 'deptName', width: 130 },
  { title: '经办人', dataIndex: 'handlerName', width: 110 },
  { title: '明细数', dataIndex: 'invoiceCount', width: 90, align: 'right' },
  {
    title: '不含税金额',
    dataIndex: 'taxExclusiveAmount',
    width: 120,
    align: 'right',
  },
  { title: '税额', dataIndex: 'taxAmount', width: 120, align: 'right' },
  { title: '价税合计', dataIndex: 'totalAmount', width: 120, align: 'right' },
  { title: '税率展示', dataIndex: 'displayTaxPercent', width: 110 },
  { title: '附件状态', dataIndex: 'fileUrl', width: 90 },
  { title: '创建人', dataIndex: 'creatorName', width: 110 },
  { title: '创建时间', dataIndex: 'createTime', width: 160 },
  { title: '审核人', dataIndex: 'auditUserName', width: 110 },
  { title: '审核时间', dataIndex: 'auditTime', width: 160 },
  { title: '修改人', dataIndex: 'updaterName', width: 110 },
  { title: '修改时间', dataIndex: 'updateTime', width: 160 },
  { title: '备注', dataIndex: 'remark', width: 180 },
];

const pageSummary = computed(() => {
  let count = 0;
  let taxAmount = 0;
  let taxExclusiveAmount = 0;
  let totalAmount = 0;
  for (const row of rows.value) {
    count += Number(row.invoiceCount || 0);
    taxAmount += Number(row.taxAmount || 0);
    taxExclusiveAmount += Number(row.taxExclusiveAmount || 0);
    totalAmount += Number(row.totalAmount || 0);
  }
  return {
    count: rows.value.length,
    invoiceCount: count,
    taxAmount,
    taxExclusiveAmount,
    totalAmount,
  };
});

function formatMoney(value: unknown) {
  const next = Number(value || 0);
  if (!Number.isFinite(next)) return '-';
  return next.toLocaleString('zh-CN', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

function formatNumber(value: unknown) {
  const next = Number(value || 0);
  if (!Number.isFinite(next)) return '-';
  return next.toLocaleString('zh-CN', { maximumFractionDigits: 3 });
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

async function loadData() {
  loading.value = true;
  try {
    const result = await getFinancialPurchaseInvoicePage({
      invoiceNo: query.invoiceNo || undefined,
      invoiceStatus: query.status,
      no: query.no || undefined,
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
  query.invoiceNo = '';
  query.no = '';
  query.status = undefined;
  pageNo.value = 1;
  loadData();
}

function handlePageChange(nextPage: number, nextPageSize: number) {
  pageNo.value = nextPage;
  pageSize.value = nextPageSize;
  loadData();
}

function buildExportParams() {
  return {
    invoiceNo: query.invoiceNo || undefined,
    invoiceStatus: query.status,
    no: query.no || undefined,
  };
}

async function handleExport() {
  exportLoading.value = true;
  try {
    const data = await exportFinancialPurchaseInvoice(buildExportParams());
    downloadFileFromBlobPart({ fileName: '采购发票明细.xls', source: data });
  } catch (error) {
    console.error(error);
    message.error('导出失败，请稍后重试');
  } finally {
    exportLoading.value = false;
  }
}

const pagination = computed<false | TablePaginationConfig>(() => false);

onMounted(loadData);
</script>

<template>
  <Card
    class="purchase-invoice-readonly-table"
    size="small"
    title="采购发票明细"
  >
    <template #extra>
      <Button size="small" :loading="exportLoading" @click="handleExport"
        >导出</Button
      >
    </template>

    <Form class="purchase-invoice-readonly-table__query" layout="inline">
      <FormItem label="票据单号">
        <Input
          v-model:value="query.no"
          allow-clear
          placeholder="请输入票据单号"
          @press-enter="handleSearch"
        />
      </FormItem>
      <FormItem label="发票号">
        <Input
          v-model:value="query.invoiceNo"
          allow-clear
          placeholder="请输入发票号"
          @press-enter="handleSearch"
        />
      </FormItem>
      <FormItem label="票据状态">
        <Select
          v-model:value="query.status"
          allow-clear
          class="purchase-invoice-readonly-table__status"
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
      class="purchase-invoice-readonly-table__table"
      :columns="columns"
      :data-source="rows"
      :loading="loading"
      :pagination="pagination"
      row-key="id"
      size="small"
      :scroll="{ x: 2520, y: '100%' }"
    >
      <template #bodyCell="{ column, record, text }">
        <template v-if="column.dataIndex === 'status'">
          <Tag :color="getStatus(record.status).color">
            {{ getStatus(record.status).label }}
          </Tag>
        </template>
        <template
          v-else-if="
            ['invoiceDate', 'auditTime', 'createTime', 'updateTime'].includes(
              String(column.dataIndex),
            )
          "
        >
          {{ formatDate(text) }}
        </template>
        <template v-else-if="column.dataIndex === 'fileUrl'">
          <Tag :color="text ? 'blue' : 'default'">
            {{ text ? '有附件' : '无附件' }}
          </Tag>
        </template>
        <template v-else-if="column.dataIndex === 'invoiceCount'">
          {{ formatNumber(text) }}
        </template>
        <template
          v-else-if="
            ['taxExclusiveAmount', 'taxAmount', 'totalAmount'].includes(
              String(column.dataIndex),
            )
          "
        >
          {{ formatMoney(text) }}
        </template>
        <template v-else>
          {{ text || '-' }}
        </template>
      </template>
    </Table>

    <div class="purchase-invoice-readonly-table__footer">
      <Space size="large">
        <span>共 {{ total }} 条记录</span>
        <span>本页 {{ pageSummary.count }} 条</span>
        <span>本页明细数：{{ formatNumber(pageSummary.invoiceCount) }}</span>
        <span
          >本页不含税：{{ formatMoney(pageSummary.taxExclusiveAmount) }}</span
        >
        <span>本页税额：{{ formatMoney(pageSummary.taxAmount) }}</span>
        <span>本页价税合计：{{ formatMoney(pageSummary.totalAmount) }}</span>
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
.purchase-invoice-readonly-table {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.purchase-invoice-readonly-table :deep(.ant-card-head) {
  flex: 0 0 auto;
}

.purchase-invoice-readonly-table :deep(.ant-card-body) {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  padding: 12px;
}

.purchase-invoice-readonly-table__hint {
  display: inline-block;
  max-width: 760px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  white-space: normal;
}

.purchase-invoice-readonly-table__query {
  flex: 0 0 auto;
  margin-bottom: 8px;
}

.purchase-invoice-readonly-table__status {
  width: 150px;
}

.purchase-invoice-readonly-table__table {
  flex: 1 1 auto;
  min-height: 0;
}

.purchase-invoice-readonly-table__table :deep(.ant-spin-nested-loading),
.purchase-invoice-readonly-table__table :deep(.ant-spin-container),
.purchase-invoice-readonly-table__table :deep(.ant-table),
.purchase-invoice-readonly-table__table :deep(.ant-table-container),
.purchase-invoice-readonly-table__table :deep(.ant-table-body) {
  height: 100%;
}

.purchase-invoice-readonly-table__footer {
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
