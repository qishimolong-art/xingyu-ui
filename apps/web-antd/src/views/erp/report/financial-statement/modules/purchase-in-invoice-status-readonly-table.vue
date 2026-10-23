<script setup lang="ts">
import type { TablePaginationConfig } from 'ant-design-vue';

import type { ErpPurchaseInApi } from '#/api/erp/purchase/in';

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
  exportFinancialPurchaseInInvoiceStatus,
  getFinancialPurchaseInInvoiceStatusPage,
} from '#/api/erp/report/financial-statement';

type PurchaseInReadonlyRow = ErpPurchaseInApi.PurchaseIn & {
  approveTime?: Date | string;
  auditorName?: string;
  auditTime?: Date | string;
  auditUserName?: string;
  invoiceStatus?: number | string;
};

defineOptions({ name: 'ErpPurchaseInInvoiceStatusReadonlyTable' });

const documentStatusOptions = [
  { label: '草稿', value: 0 },
  { label: '待审核', value: 10 },
  { label: '已审核', value: 20 },
];

const invoiceStatusOptions = [
  { label: '未开票', value: 'uninvoiced' },
  { label: '已开票', value: 'invoiced' },
];

const query = reactive({
  invoiceStatus: undefined as string | undefined,
  no: '',
  status: undefined as number | undefined,
  supplierName: '',
});
const pageNo = ref(1);
const pageSize = ref(10);
const total = ref(0);
const loading = ref(false);
const exportLoading = ref(false);
const rows = ref<PurchaseInReadonlyRow[]>([]);

const columns = [
  { title: '采购入库单号', dataIndex: 'no', width: 160 },
  { title: '供应商', dataIndex: 'supplierName', width: 180 },
  { title: '入库日期', dataIndex: 'inTime', width: 160 },
  { title: '审核日期', dataIndex: 'approveTime', width: 160 },
  { title: '部门', dataIndex: 'deptName', width: 130 },
  { title: '采购员', dataIndex: 'purchaserName', width: 110 },
  { title: '经办人', dataIndex: 'handlerName', width: 110 },
  { title: '单据状态', dataIndex: 'status', width: 100 },
  { title: '开票类型', dataIndex: 'invoiceType', width: 120 },
  { title: '开票状态', dataIndex: 'invoiceStatus', width: 100 },
  { title: '总数量', dataIndex: 'totalCount', width: 110, align: 'right' },
  {
    title: '商品金额',
    dataIndex: 'totalProductPrice',
    width: 120,
    align: 'right',
  },
  { title: '税额', dataIndex: 'taxPrice', width: 120, align: 'right' },
  { title: '价税合计', dataIndex: 'totalTaxPrice', width: 120, align: 'right' },
  { title: '折后金额', dataIndex: 'totalPrice', width: 120, align: 'right' },
  { title: '付款状态', dataIndex: 'paymentStatus', width: 100 },
  { title: '审核人', dataIndex: 'auditorName', width: 110 },
  { title: '创建人', dataIndex: 'creatorName', width: 110 },
  { title: '创建时间', dataIndex: 'createTime', width: 160 },
  { title: '修改人', dataIndex: 'updaterName', width: 110 },
  { title: '修改时间', dataIndex: 'updateTime', width: 160 },
  { title: '备注', dataIndex: 'remark', width: 180 },
];

const pageSummary = computed(() => {
  let totalCount = 0;
  let totalPrice = 0;
  let totalProductPrice = 0;
  let totalTaxPrice = 0;
  for (const row of rows.value) {
    totalCount += Number(row.totalCount || 0);
    totalProductPrice += Number(row.totalProductPrice || 0);
    totalTaxPrice += Number(row.totalTaxPrice || 0);
    totalPrice += Number(row.totalPrice || 0);
  }
  return {
    count: rows.value.length,
    totalCount,
    totalPrice,
    totalProductPrice,
    totalTaxPrice,
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

function getDocumentStatus(status?: number) {
  if (status === 20) return { color: 'success', label: '已审核' };
  if (status === 10) return { color: 'processing', label: '待审核' };
  if (status === 0) return { color: 'default', label: '草稿' };
  return { color: 'default', label: '-' };
}

function getInvoiceStatus(record: PurchaseInReadonlyRow) {
  if (record.hasInvoice === true || record.invoiceStatus === 'invoiced') {
    return { color: 'success', label: '已开票' };
  }
  if (record.hasInvoice === false || record.invoiceStatus === 'uninvoiced') {
    return { color: 'default', label: '未开票' };
  }
  return { color: 'default', label: '-' };
}

function getPaymentStatus(status?: number) {
  if (status === 2) return { color: 'success', label: '已结算' };
  if (status === 1) return { color: 'processing', label: '部分结算' };
  if (status === 0) return { color: 'default', label: '未结算' };
  return { color: 'default', label: '-' };
}

function buildQueryParams() {
  const params: Record<string, unknown> = {
    includeItems: false,
    no: query.no || undefined,
    pageNo: pageNo.value,
    pageSize: pageSize.value,
    status: query.status,
    supplierName: query.supplierName || undefined,
  };
  if (query.invoiceStatus === 'invoiced') {
    params.hasInvoice = true;
  }
  if (query.invoiceStatus === 'uninvoiced') {
    params.hasInvoice = false;
  }
  return params;
}

async function loadData() {
  loading.value = true;
  try {
    const result =
      await getFinancialPurchaseInInvoiceStatusPage(buildQueryParams());
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
  query.invoiceStatus = undefined;
  query.no = '';
  query.status = undefined;
  query.supplierName = '';
  pageNo.value = 1;
  loadData();
}

function handlePageChange(nextPage: number, nextPageSize: number) {
  pageNo.value = nextPage;
  pageSize.value = nextPageSize;
  loadData();
}

async function handleExport() {
  exportLoading.value = true;
  try {
    const {
      pageNo: _pageNo,
      pageSize: _pageSize,
      ...params
    } = buildQueryParams();
    const data = await exportFinancialPurchaseInInvoiceStatus(params);
    downloadFileFromBlobPart({
      fileName: '采购入库开票状态.xls',
      source: data,
    });
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
    class="purchase-in-invoice-status-readonly-table"
    size="small"
    title="采购入库开票状态"
  >
    <template #extra>
      <Button size="small" :loading="exportLoading" @click="handleExport"
        >导出</Button
      >
    </template>

    <Form
      class="purchase-in-invoice-status-readonly-table__query"
      layout="inline"
    >
      <FormItem label="入库单号">
        <Input
          v-model:value="query.no"
          allow-clear
          placeholder="请输入采购入库单号"
          @press-enter="handleSearch"
        />
      </FormItem>
      <FormItem label="供应商">
        <Input
          v-model:value="query.supplierName"
          allow-clear
          placeholder="请输入供应商名称"
          @press-enter="handleSearch"
        />
      </FormItem>
      <FormItem label="单据状态">
        <Select
          v-model:value="query.status"
          allow-clear
          class="purchase-in-invoice-status-readonly-table__select"
          :options="documentStatusOptions"
          placeholder="请选择单据状态"
        />
      </FormItem>
      <FormItem label="开票状态">
        <Select
          v-model:value="query.invoiceStatus"
          allow-clear
          class="purchase-in-invoice-status-readonly-table__select"
          :options="invoiceStatusOptions"
          placeholder="请选择开票状态"
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
      class="purchase-in-invoice-status-readonly-table__table"
      :columns="columns"
      :data-source="rows"
      :loading="loading"
      :pagination="pagination"
      row-key="id"
      size="small"
      :scroll="{ x: 2800, y: '100%' }"
    >
      <template #bodyCell="{ column, record, text }">
        <template v-if="column.dataIndex === 'status'">
          <Tag :color="getDocumentStatus(record.status).color">
            {{ getDocumentStatus(record.status).label }}
          </Tag>
        </template>
        <template v-else-if="column.dataIndex === 'invoiceStatus'">
          <Tag :color="getInvoiceStatus(record).color">
            {{ getInvoiceStatus(record).label }}
          </Tag>
        </template>
        <template v-else-if="column.dataIndex === 'paymentStatus'">
          <Tag :color="getPaymentStatus(record.paymentStatus).color">
            {{ getPaymentStatus(record.paymentStatus).label }}
          </Tag>
        </template>
        <template
          v-else-if="
            ['approveTime', 'createTime', 'inTime', 'updateTime'].includes(
              String(column.dataIndex),
            )
          "
        >
          {{ formatDate(text) }}
        </template>
        <template v-else-if="column.dataIndex === 'totalCount'">
          {{ formatNumber(text) }}
        </template>
        <template
          v-else-if="
            [
              'taxPrice',
              'totalPrice',
              'totalProductPrice',
              'totalTaxPrice',
            ].includes(String(column.dataIndex))
          "
        >
          {{ formatMoney(text) }}
        </template>
        <template v-else>
          {{ text || '-' }}
        </template>
      </template>
    </Table>

    <div class="purchase-in-invoice-status-readonly-table__footer">
      <Space size="large">
        <span>共 {{ total }} 条记录</span>
        <span>本页 {{ pageSummary.count }} 条</span>
        <span>本页数量：{{ formatNumber(pageSummary.totalCount) }}</span>
        <span
          >本页商品金额参考：{{
            formatMoney(pageSummary.totalProductPrice)
          }}</span
        >
        <span
          >本页价税合计参考：{{ formatMoney(pageSummary.totalTaxPrice) }}</span
        >
        <span>本页折后金额参考：{{ formatMoney(pageSummary.totalPrice) }}</span>
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
.purchase-in-invoice-status-readonly-table {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.purchase-in-invoice-status-readonly-table :deep(.ant-card-head) {
  flex: 0 0 auto;
}

.purchase-in-invoice-status-readonly-table :deep(.ant-card-body) {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  padding: 12px;
}

.purchase-in-invoice-status-readonly-table__hint {
  display: inline-block;
  max-width: 820px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  white-space: normal;
}

.purchase-in-invoice-status-readonly-table__query {
  flex: 0 0 auto;
  margin-bottom: 8px;
}

.purchase-in-invoice-status-readonly-table__select {
  width: 150px;
}

.purchase-in-invoice-status-readonly-table__table {
  flex: 1 1 auto;
  min-height: 0;
}

.purchase-in-invoice-status-readonly-table__table
  :deep(.ant-spin-nested-loading),
.purchase-in-invoice-status-readonly-table__table :deep(.ant-spin-container),
.purchase-in-invoice-status-readonly-table__table :deep(.ant-table),
.purchase-in-invoice-status-readonly-table__table :deep(.ant-table-container),
.purchase-in-invoice-status-readonly-table__table :deep(.ant-table-body) {
  height: 100%;
}

.purchase-in-invoice-status-readonly-table__footer {
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
