<script setup lang="ts">
import { financeMoneyGrouped } from '#/views/erp/finance/utils/finance-decimal';import { financeValue } from '#/views/erp/finance/utils/finance-decimal';

import type { TableColumnsType, TablePaginationConfig } from 'ant-design-vue';

import type { ErpFinancePaymentApi } from '#/api/erp/finance/payment';
import type { ErpFinanceReceiptApi } from '#/api/erp/finance/receipt';

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
  exportFinancePayment,
  getFinancePaymentPage,
} from '#/api/erp/finance/payment';
import {
  exportFinanceReceipt,
  getFinanceReceiptPage,
} from '#/api/erp/finance/receipt';

type Mode = 'payment' | 'receipt';

defineOptions({ name: 'ErpFinanceReceiptPaymentReadonlyTable' });

const props = withDefaults(defineProps<{ mode: Mode; title?: string }>(), {
  title: undefined,
});

const statusOptions = [
  { label: '草稿', value: 0 },
  { label: '待审核', value: 10 },
  { label: '已审核', value: 20 },
  { label: '已驳回', value: 30 },
];

const query = reactive({
  no: '',
  subjectName: '',
  status: undefined as number | undefined,
});
const pageNo = ref(1);
const pageSize = ref(10);
const total = ref(0);
const loading = ref(false);
const rows = ref<
  ErpFinancePaymentApi.FinancePayment[] | ErpFinanceReceiptApi.FinanceReceipt[]
>([]);

const isReceipt = computed(() => props.mode === 'receipt');
const title = computed(
  () => props.title || (isReceipt.value ? '收款记录' : '付款记录'),
);
const subjectLabel = computed(() => (isReceipt.value ? '客户' : '供应商'));
const amountField = computed(() =>
  isReceipt.value ? 'receiptPrice' : 'paymentPrice',
);

const columns = computed<TableColumnsType<Record<string, any>>>(() => [
  {
    title: isReceipt.value ? '收款单号' : '付款单号',
    dataIndex: 'no',
    width: 160,
  },
  {
    title: subjectLabel.value,
    dataIndex: isReceipt.value ? 'customerName' : 'supplierName',
    width: 180,
  },
  {
    title: isReceipt.value ? '收款日期' : '付款日期',
    dataIndex: isReceipt.value ? 'receiptTime' : 'paymentTime',
    width: 160,
  },
  { title: '账户', dataIndex: 'accountName', width: 150 },
  { title: '开户行', dataIndex: 'bankName', width: 140 },
  { title: '结算方式', dataIndex: 'settleMethod', width: 110 },
  { title: '部门', dataIndex: 'deptName', width: 130 },
  { title: '经办人', dataIndex: 'financeUserName', width: 110 },
  { title: '审核人', dataIndex: 'auditorName', width: 110 },
  { title: '审核时间', dataIndex: 'auditTime', width: 160 },
  { title: '单据状态', dataIndex: 'status', width: 100 },
  { title: '核销状态', dataIndex: 'writeOffStatus', width: 100 },
  { title: '业务单号', dataIndex: 'bizNo', width: 160 },
  { title: '合计金额', dataIndex: 'totalPrice', width: 120, align: 'right' },
  { title: '优惠金额', dataIndex: 'discountPrice', width: 120, align: 'right' },
  {
    title: isReceipt.value ? '实际收款' : '实际付款',
    dataIndex: amountField.value,
    width: 120,
    align: 'right',
  },
  { title: '已核销', dataIndex: 'allocatedPrice', width: 120, align: 'right' },
  {
    title: '未核销',
    dataIndex: 'unallocatedPrice',
    width: 120,
    align: 'right',
  },
  { title: '凭证号', dataIndex: 'voucherNo', width: 140 },
  { title: '备注', dataIndex: 'remark', width: 180 },
]);

const pageSummary = computed(() => {
  let totalPrice = 0;
  let actualPrice = 0;
  let allocatedPrice = 0;
  let discountPrice = 0;
  let unallocatedPrice = 0;
  for (const row of rows.value as Array<Record<string, any>>) {
    totalPrice += financeValue(row.totalPrice || 0);
    actualPrice += Number(row[amountField.value] || 0);
    allocatedPrice += financeValue(row.allocatedPrice || 0);
    discountPrice += financeValue(row.discountPrice || 0);
    unallocatedPrice += financeValue(row.unallocatedPrice || 0);
  }
  return {
    actualPrice,
    allocatedPrice,
    count: rows.value.length,
    discountPrice,
    totalPrice,
    unallocatedPrice,
  };
});

function formatMoney(value: unknown) { return financeMoneyGrouped(value as any);
}

function formatDate(value: unknown) {
  if (!value) return '-';
  return formatDateTime(value as string) || String(value);
}

function getStatus(status?: number) {
  if (status === 20) return { color: 'success', label: '已审核' };
  if (status === 10) return { color: 'processing', label: '待审核' };
  if (status === 30) return { color: 'error', label: '已驳回' };
  if (status === 0) return { color: 'default', label: '草稿' };
  return { color: 'default', label: '-' };
}

function getWriteOffStatus(status?: number) {
  if (status === 2) return { color: 'success', label: '已核销' };
  if (status === 1) return { color: 'processing', label: '部分核销' };
  if (status === 3) return { color: 'error', label: '异常' };
  return { color: 'default', label: '未核销' };
}

async function loadData() {
  loading.value = true;
  try {
    const params = {
      pageNo: pageNo.value,
      pageSize: pageSize.value,
      no: query.no || undefined,
      status: query.status,
      ...(isReceipt.value
        ? { customerName: query.subjectName || undefined }
        : { supplierName: query.subjectName || undefined }),
    };
    const result = isReceipt.value
      ? await getFinanceReceiptPage(params)
      : await getFinancePaymentPage(params);
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
  query.no = '';
  query.subjectName = '';
  query.status = undefined;
  pageNo.value = 1;
  loadData();
}

function handlePageChange(nextPage: number, nextPageSize: number) {
  pageNo.value = nextPage;
  pageSize.value = nextPageSize;
  loadData();
}

async function handleExport() {
  loading.value = true;
  try {
    const params = {
      no: query.no || undefined,
      status: query.status,
      ...(isReceipt.value
        ? { customerName: query.subjectName || undefined }
        : { supplierName: query.subjectName || undefined }),
    };
    const data = isReceipt.value
      ? await exportFinanceReceipt(params)
      : await exportFinancePayment(params);
    downloadFileFromBlobPart({ fileName: `${title.value}.xls`, source: data });
  } catch (error) {
    console.error(error);
    message.error('导出失败，请稍后重试');
  } finally {
    loading.value = false;
  }
}

const pagination = computed<false | TablePaginationConfig>(() => false);

onMounted(loadData);
</script>

<template>
  <Card
    class="finance-receipt-payment-readonly-table"
    size="small"
    :title="title"
  >
    <Form class="finance-receipt-payment-readonly-table__query" layout="inline">
      <FormItem :label="isReceipt ? '收款单号' : '付款单号'">
        <Input
          v-model:value="query.no"
          allow-clear
          :placeholder="isReceipt ? '请输入收款单号' : '请输入付款单号'"
          @press-enter="handleSearch"
        />
      </FormItem>
      <FormItem :label="subjectLabel">
        <Input
          v-model:value="query.subjectName"
          allow-clear
          :placeholder="`请输入${subjectLabel}名称`"
          @press-enter="handleSearch"
        />
      </FormItem>
      <FormItem label="单据状态">
        <Select
          v-model:value="query.status"
          allow-clear
          class="finance-receipt-payment-readonly-table__status"
          :options="statusOptions"
          placeholder="请选择状态"
        />
      </FormItem>
      <FormItem>
        <Space>
          <Button type="primary" @click="handleSearch">查询</Button>
          <Button @click="handleReset">重置</Button>
          <Button :loading="loading" @click="handleExport">导出</Button>
        </Space>
      </FormItem>
    </Form>

    <Table
      class="finance-receipt-payment-readonly-table__table"
      :columns="columns"
      :data-source="rows"
      :loading="loading"
      :pagination="pagination"
      row-key="id"
      size="small"
      :scroll="{ x: 2420, y: '100%' }"
    >
      <template #bodyCell="{ column, record, text }">
        <template v-if="column.dataIndex === 'status'">
          <Tag :color="getStatus(record.status).color">
            {{ getStatus(record.status).label }}
          </Tag>
        </template>
        <template v-else-if="column.dataIndex === 'writeOffStatus'">
          <Tag :color="getWriteOffStatus(record.writeOffStatus).color">
            {{ getWriteOffStatus(record.writeOffStatus).label }}
          </Tag>
        </template>
        <template
          v-else-if="
            ['receiptTime', 'paymentTime', 'auditTime'].includes(
              String(column.dataIndex),
            )
          "
        >
          {{ formatDate(text) }}
        </template>
        <template
          v-else-if="
            [
              'totalPrice',
              'discountPrice',
              'receiptPrice',
              'paymentPrice',
              'allocatedPrice',
              'unallocatedPrice',
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

    <div class="finance-receipt-payment-readonly-table__footer">
      <Space size="large">
        <span>共 {{ total }} 条记录</span>
        <span>本页 {{ pageSummary.count }} 条</span>
        <span>本页合计：{{ formatMoney(pageSummary.totalPrice) }}</span>
        <span>本页优惠：{{ formatMoney(pageSummary.discountPrice) }}</span>
        <span
          >{{ isReceipt ? '本页实收' : '本页实付' }}：{{
            formatMoney(pageSummary.actualPrice)
          }}</span
        >
        <span>本页已核销：{{ formatMoney(pageSummary.allocatedPrice) }}</span>
        <span>本页未核销：{{ formatMoney(pageSummary.unallocatedPrice) }}</span>
      </Space>
      <Pagination
        v-model:current="pageNo"
        v-model:page-size="pageSize"
        :total="total"
        :show-total="(value) => `共 ${value} 条`"
        :page-size-options="['10', '20', '50']"
        show-size-changer
        size="small"
        @change="handlePageChange"
        @show-size-change="handlePageChange"
      />
    </div>
  </Card>
</template>

<style scoped>
.finance-receipt-payment-readonly-table {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.finance-receipt-payment-readonly-table :deep(.ant-card-head) {
  flex: 0 0 auto;
}

.finance-receipt-payment-readonly-table :deep(.ant-card-body) {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  padding: 12px;
}

.finance-receipt-payment-readonly-table__query {
  flex: 0 0 auto;
  margin-bottom: 8px;
}

.finance-receipt-payment-readonly-table__status {
  width: 150px;
}

.finance-receipt-payment-readonly-table__table {
  flex: 1 1 auto;
  min-height: 0;
}

.finance-receipt-payment-readonly-table__table :deep(.ant-spin-nested-loading),
.finance-receipt-payment-readonly-table__table :deep(.ant-spin-container),
.finance-receipt-payment-readonly-table__table :deep(.ant-table),
.finance-receipt-payment-readonly-table__table :deep(.ant-table-container),
.finance-receipt-payment-readonly-table__table :deep(.ant-table-body) {
  height: 100%;
}

.finance-receipt-payment-readonly-table__footer {
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
