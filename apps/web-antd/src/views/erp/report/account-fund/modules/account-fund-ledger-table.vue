<script setup lang="ts">
import { financeMoneyGrouped } from '#/views/erp/finance/utils/finance-decimal';import { financeValue, financeSubtract } from '#/views/erp/finance/utils/finance-decimal';

import type { TableColumnsType, TablePaginationConfig } from 'ant-design-vue';

import type { ErpFinanceBillApi } from '#/api/erp/finance/bill';

import { computed, onMounted, reactive, ref } from 'vue';

import { downloadFileFromBlobPart, formatDateTime } from '@vben/utils';

import {
  Button,
  Card,
  DatePicker,
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

import { getFinanceBillPage } from '#/api/erp/finance/bill';

defineOptions({ name: 'ErpAccountFundLedgerTable' });

const props = withDefaults(
  defineProps<{
    compact?: boolean;
    title?: string;
  }>(),
  {
    compact: false,
    title: '账户资金流水表',
  },
);

const { RangePicker } = DatePicker;

const statusOptions = [
  { label: '草稿', value: 0 },
  { label: '待审核', value: 10 },
  { label: '已审核', value: 20 },
  { label: '已驳回', value: 30 },
];

const billTypeOptions = [
  { label: '收款', value: 'receipt' },
  { label: '付款', value: 'payment' },
];

const query = reactive({
  billTime: undefined as [string, string] | undefined,
  billType: undefined as string | undefined,
  bizNo: '',
  no: '',
  remark: '',
  status: undefined as number | undefined,
});
const pageNo = ref(1);
const pageSize = ref(10);
const total = ref(0);
const loading = ref(false);
const rows = ref<ErpFinanceBillApi.FinanceBill[]>([]);

const columns: TableColumnsType<Record<string, any>> = [
  { title: '资金方向', dataIndex: 'billType', width: 92, fixed: 'left' },
  { title: '单据编号', dataIndex: 'no', width: 170, fixed: 'left' },
  { title: '发生时间', dataIndex: 'billTime', width: 160 },
  { title: '账户', dataIndex: 'accountName', width: 150 },
  { title: '业务归属部门', dataIndex: 'deptName', width: 140 },
  { title: '客户', dataIndex: 'customerName', width: 180 },
  { title: '供应商', dataIndex: 'supplierName', width: 180 },
  { title: '经办人', dataIndex: 'financeUserName', width: 110 },
  { title: '单据状态', dataIndex: 'status', width: 100 },
  { title: '业务单号', dataIndex: 'bizNo', width: 170 },
  { title: '应收/应付', dataIndex: 'totalPrice', width: 120, align: 'right' },
  { title: '优惠金额', dataIndex: 'discountPrice', width: 120, align: 'right' },
  { title: '资金增加', dataIndex: 'receiptAmount', width: 120, align: 'right' },
  { title: '资金减少', dataIndex: 'paymentAmount', width: 120, align: 'right' },
  { title: '创建人', dataIndex: 'creatorName', width: 110 },
  { title: '创建时间', dataIndex: 'createTime', width: 160 },
  { title: '备注', dataIndex: 'remark', width: 220 },
];

const pageSummary = computed(() => {
  let receiptAmount = 0;
  let paymentAmount = 0;
  let discountPrice = 0;
  let totalPrice = 0;
  for (const row of rows.value) {
    const actualPrice = financeValue(row.actualPrice || 0);
    totalPrice += financeValue(row.totalPrice || 0);
    discountPrice += financeValue(row.discountPrice || 0);
    if (row.billType === 'receipt') {
      receiptAmount += actualPrice;
    } else if (row.billType === 'payment') {
      paymentAmount += actualPrice;
    }
  }
  return {
    count: rows.value.length,
    discountPrice,
    netAmount: financeSubtract(receiptAmount, paymentAmount),
    paymentAmount,
    receiptAmount,
    totalPrice,
  };
});

function formatMoney(value: unknown) { return financeMoneyGrouped(value as any);
}

function formatDate(value: unknown) {
  if (!value) return '-';
  return formatDateTime(value as string) || String(value);
}

function getBillType(row: Record<string, any>) {
  if (row.billType === 'receipt')
    return { color: 'success', label: row.billTypeName || '收款' };
  if (row.billType === 'payment')
    return { color: 'error', label: row.billTypeName || '付款' };
  return { color: 'default', label: row.billTypeName || '-' };
}

function getStatus(status?: number) {
  if (status === 20) return { color: 'success', label: '已审核' };
  if (status === 10) return { color: 'processing', label: '待审核' };
  if (status === 30) return { color: 'error', label: '已驳回' };
  if (status === 0) return { color: 'default', label: '草稿' };
  return { color: 'default', label: '-' };
}

function buildParams() {
  return {
    billTime: query.billTime,
    billType: query.billType,
    bizNo: query.bizNo || undefined,
    no: query.no || undefined,
    remark: query.remark || undefined,
    status: query.status,
  };
}

async function loadData() {
  loading.value = true;
  try {
    const result = await getFinanceBillPage({
      pageNo: pageNo.value,
      pageSize: pageSize.value,
      ...buildParams(),
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
  query.billTime = undefined;
  query.billType = undefined;
  query.bizNo = '';
  query.no = '';
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
  const text = value === undefined || value === null ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

function handleExport() {
  const headers = [
    '资金方向',
    '单据编号',
    '发生时间',
    '账户',
    '业务归属部门',
    '客户',
    '供应商',
    '经办人',
    '单据状态',
    '业务单号',
    '应收/应付',
    '优惠金额',
    '资金增加',
    '资金减少',
    '创建人',
    '创建时间',
    '备注',
  ];
  const body = rows.value.map((row) => {
    const billType = getBillType(row).label;
    const status = getStatus(row.status).label;
    const receiptAmount = row.billType === 'receipt' ? row.actualPrice : '';
    const paymentAmount = row.billType === 'payment' ? row.actualPrice : '';
    return [
      billType,
      row.no,
      formatDate(row.billTime),
      row.accountName,
      row.deptName,
      row.customerName,
      row.supplierName,
      row.financeUserName,
      status,
      row.bizNo,
      row.totalPrice,
      row.discountPrice,
      receiptAmount,
      paymentAmount,
      row.creatorName,
      formatDate(row.createTime),
      row.remark,
    ]
      .map((value) => escapeCsv(value))
      .join(',');
  });
  const source = new Blob([`\uFEFF${headers.join(',')}\n${body.join('\n')}`], {
    type: 'text/csv;charset=utf-8',
  });
  downloadFileFromBlobPart({ fileName: `${props.title}.csv`, source });
  if (rows.value.length === 0) {
    message.info('当前页暂无可导出的数据');
  }
}

const pagination = computed<false | TablePaginationConfig>(() => false);

onMounted(loadData);
</script>

<template>
  <Card class="account-fund-ledger-table" size="small" :title="props.title">
    <Form
      v-if="!props.compact"
      class="account-fund-ledger-table__query"
      layout="inline"
    >
      <FormItem label="发生时间">
        <RangePicker
          v-model:value="query.billTime"
          class="account-fund-ledger-table__range"
          show-time
          value-format="YYYY-MM-DD HH:mm:ss"
        />
      </FormItem>
      <FormItem label="单据编号">
        <Input
          v-model:value="query.no"
          allow-clear
          placeholder="请输入单据编号"
          @press-enter="handleSearch"
        />
      </FormItem>
      <FormItem label="业务单号">
        <Input
          v-model:value="query.bizNo"
          allow-clear
          placeholder="请输入业务单号"
          @press-enter="handleSearch"
        />
      </FormItem>
      <FormItem label="资金方向">
        <Select
          v-model:value="query.billType"
          allow-clear
          class="account-fund-ledger-table__select"
          :options="billTypeOptions"
          placeholder="请选择方向"
        />
      </FormItem>
      <FormItem label="状态">
        <Select
          v-model:value="query.status"
          allow-clear
          class="account-fund-ledger-table__select"
          :options="statusOptions"
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
      class="account-fund-ledger-table__table"
      :columns="columns"
      :data-source="rows"
      :loading="loading"
      :pagination="pagination"
      row-key="id"
      size="small"
      :scroll="{ x: 2360 }"
    >
      <template #bodyCell="{ column, record, text }">
        <template v-if="column.dataIndex === 'billType'">
          <Tag :color="getBillType(record).color">
            {{ getBillType(record).label }}
          </Tag>
        </template>
        <template v-else-if="column.dataIndex === 'status'">
          <Tag :color="getStatus(record.status).color">
            {{ getStatus(record.status).label }}
          </Tag>
        </template>
        <template
          v-else-if="
            ['billTime', 'createTime'].includes(String(column.dataIndex))
          "
        >
          {{ formatDate(text) }}
        </template>
        <template v-else-if="column.dataIndex === 'receiptAmount'">
          {{
            record.billType === 'receipt'
              ? formatMoney(record.actualPrice)
              : '-'
          }}
        </template>
        <template v-else-if="column.dataIndex === 'paymentAmount'">
          {{
            record.billType === 'payment'
              ? formatMoney(record.actualPrice)
              : '-'
          }}
        </template>
        <template
          v-else-if="
            ['totalPrice', 'discountPrice'].includes(String(column.dataIndex))
          "
        >
          {{ formatMoney(text) }}
        </template>
        <template v-else>
          {{ text || '-' }}
        </template>
      </template>
    </Table>

    <div class="account-fund-ledger-table__footer">
      <Space size="large" wrap>
        <span>共 {{ total }} 条记录</span>
        <span>本页 {{ pageSummary.count }} 条</span>
        <span>本页应收/应付：{{ formatMoney(pageSummary.totalPrice) }}</span>
        <span>本页优惠：{{ formatMoney(pageSummary.discountPrice) }}</span>
        <span>本页资金增加：{{ formatMoney(pageSummary.receiptAmount) }}</span>
        <span>本页资金减少：{{ formatMoney(pageSummary.paymentAmount) }}</span>
        <span>本页净额：{{ formatMoney(pageSummary.netAmount) }}</span>
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
.account-fund-ledger-table {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.account-fund-ledger-table :deep(.ant-card-head) {
  flex: 0 0 auto;
}

.account-fund-ledger-table :deep(.ant-card-body) {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  padding: 12px;
}

.account-fund-ledger-table__query {
  flex: 0 0 auto;
  gap: 8px 0;
  margin-bottom: 8px;
}

.account-fund-ledger-table__range {
  width: 330px;
}

.account-fund-ledger-table__select {
  width: 132px;
}

.account-fund-ledger-table__table {
  flex: 1 1 auto;
  min-height: 0;
}

.account-fund-ledger-table__footer {
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
