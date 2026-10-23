<script setup lang="ts">
import type { TablePaginationConfig } from 'ant-design-vue';

import type { ErpReceivableAccountApi } from '#/api/erp/finance/receivable/account';

import { computed, onMounted, reactive, ref } from 'vue';

import { downloadFileFromBlobPart, formatDateTime } from '@vben/utils';

import { formatSaleAmount, formatSaleDecimal } from '../../utils/decimal';

import {
  Button,
  Card,
  Drawer,
  Form,
  FormItem,
  Input,
  Pagination,
  Space,
  Table,
  Tag,
} from 'ant-design-vue';

import {
  exportReceivableAccount,
  getReceivableAccountPage,
} from '#/api/erp/finance/receivable/account';
import BusinessReportEmptyState from '#/views/erp/report/components/business-report-empty-state.vue';

import ReceivableDetailDrawer from '../../../finance/receivable/account/modules/detail-drawer.vue';

defineOptions({ name: 'ErpCustomerReceivableOverviewTable' });

const query = reactive({
  customerName: '',
});
const pageNo = ref(1);
const pageSize = ref(10);
const total = ref(0);
const loading = ref(false);
const exporting = ref(false);
const rows = ref<ErpReceivableAccountApi.ReceivableAccount[]>([]);
const detailOpen = ref(false);
const currentCustomerId = ref<number>();
const currentDeptId = ref<number>();
const currentDeptUnassigned = ref(false);
const currentCustomerName = ref('');
const currentDeptName = ref('');

const columns = [
  { title: '客户', dataIndex: 'customerName', width: 180 },
  { title: '联系人', dataIndex: 'contact', width: 110 },
  { title: '手机号', dataIndex: 'mobile', width: 130 },
  { title: '部门', dataIndex: 'deptName', width: 130 },
  { title: '业务员', dataIndex: 'saleUserName', width: 110 },
  { title: '销售出库', dataIndex: 'saleOutAmount', width: 120, align: 'right' },
  {
    title: '销售退货',
    dataIndex: 'saleReturnAmount',
    width: 120,
    align: 'right',
  },
  {
    title: '调价金额',
    dataIndex: 'priceAdjustAmount',
    width: 120,
    align: 'right',
  },
  {
    title: '其他应收',
    dataIndex: 'miscReceivableAmount',
    width: 120,
    align: 'right',
  },
  { title: '已收款', dataIndex: 'receiptAmount', width: 120, align: 'right' },
  { title: '已核销', dataIndex: 'writeOffAmount', width: 120, align: 'right' },
  {
    title: '应收余额',
    dataIndex: 'receivableBalance',
    width: 120,
    align: 'right',
  },
  {
    title: '预收余额',
    dataIndex: 'preAdvanceAmount',
    width: 120,
    align: 'right',
  },
  { title: '授信余额', dataIndex: 'creditBalance', width: 120, align: 'right' },
  { title: '回款率', dataIndex: 'collectionRateStatus', width: 130 },
  { title: '客户分层', dataIndex: 'customerLevelStatus', width: 130 },
  { title: '忠诚度', dataIndex: 'loyaltyStatus', width: 130 },
  { title: '最近业务时间', dataIndex: 'lastBizTime', width: 170 },
  { title: '操作', dataIndex: 'actions', width: 90, fixed: 'right' },
];

const moneyFields: Array<keyof ErpReceivableAccountApi.ReceivableAccount> = [
  'saleOutAmount',
  'saleReturnAmount',
  'priceAdjustAmount',
  'miscReceivableAmount',
  'receiptAmount',
  'writeOffAmount',
  'receivableBalance',
  'preAdvanceAmount',
  'creditBalance',
];

const pageCards = computed(() => [
  { label: '经营客户数', value: formatNumber(total.value), status: '已接入' },
  {
    label: '本页应收余额',
    value: formatMoney(pageSummary.value.receivableBalance),
    status: '已接入',
  },
  {
    label: '本页已收款',
    value: formatMoney(pageSummary.value.receiptAmount),
    status: '已接入',
  },
  { label: '回款率', value: '按明细核对', status: '规则未启用' },
  { label: '客户分层', value: '保留栏位', status: '规则未启用' },
]);

const pageSummary = computed(() => {
  const summary: Record<string, number> = { count: rows.value.length };
  for (const field of moneyFields) {
    let amount = 0;
    for (const row of rows.value) {
      amount += Number(row[field] || 0);
    }
    summary[field] = amount;
  }
  return summary;
});

function formatNumber(value: unknown) {
  return formatSaleDecimal(value, '-');
}

function formatMoney(value: unknown) {
  return formatSaleAmount(value, '-');
}

function getStatusText(dataIndex: unknown) {
  if (dataIndex === 'collectionRateStatus') return '按明细核对';
  if (dataIndex === 'customerLevelStatus') return '规则未启用';
  if (dataIndex === 'loyaltyStatus') return '规则未启用';
  return '-';
}

function getStatusColor(text: unknown) {
  const value = String(text || '');
  if (value.includes('已接入')) return 'success';
  if (value.includes('核对')) return 'processing';
  if (value.includes('未启用')) return 'warning';
  return 'default';
}

function formatDate(value: unknown) {
  if (!value) return '-';
  return formatDateTime(value as string) || String(value);
}

function buildQueryParams() {
  return {
    customerName: query.customerName || undefined,
  };
}

async function loadData() {
  loading.value = true;
  try {
    const result = await getReceivableAccountPage({
      ...buildQueryParams(),
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
  query.customerName = '';
  pageNo.value = 1;
  loadData();
}

function handlePageChange(nextPage: number, nextPageSize: number) {
  pageNo.value = nextPage;
  pageSize.value = nextPageSize;
  loadData();
}

async function handleExport() {
  exporting.value = true;
  try {
    const data = await exportReceivableAccount(buildQueryParams());
    downloadFileFromBlobPart({
      fileName: '客户经营分析.xls',
      source: data,
    });
  } finally {
    exporting.value = false;
  }
}

function isUnassignedDept(deptId: null | number | undefined) {
  return deptId === undefined || deptId === null;
}

function handleOpenDetail(row: ErpReceivableAccountApi.ReceivableAccount) {
  currentCustomerId.value = row.customerId;
  currentDeptId.value = row.deptId;
  currentDeptUnassigned.value = isUnassignedDept(row.deptId);
  currentCustomerName.value = row.customerName || '';
  currentDeptName.value =
    row.deptName || (isUnassignedDept(row.deptId) ? '未归属部门' : '');
  detailOpen.value = true;
}

const detailTitle = computed(() => {
  const titleParts = [currentCustomerName.value, currentDeptName.value].filter(
    Boolean,
  );
  return titleParts.length > 0
    ? `客户应收明细 - ${titleParts.join(' / ')}`
    : '客户应收明细';
});

const pagination = computed<false | TablePaginationConfig>(() => false);

onMounted(loadData);
</script>

<template>
  <Card
    class="customer-receivable-overview-table"
    size="small"
    title="客户经营分析"
  >
    <Form class="customer-receivable-overview-table__query" layout="inline">
      <FormItem label="客户">
        <Input
          v-model:value="query.customerName"
          allow-clear
          placeholder="请输入客户名称"
          @press-enter="handleSearch"
        />
      </FormItem>
      <FormItem>
        <Space>
          <Button type="primary" @click="handleSearch">查询</Button>
          <Button @click="handleReset">重置</Button>
          <Button :loading="exporting" @click="handleExport">导出</Button>
        </Space>
      </FormItem>
    </Form>

    <div class="customer-receivable-overview-table__cards">
      <Card
        v-for="item in pageCards"
        :key="item.label"
        class="customer-receivable-overview-table__card"
        size="small"
      >
        <div class="customer-receivable-overview-table__card-label">
          {{ item.label }}
        </div>
        <div class="customer-receivable-overview-table__card-value">
          {{ item.value }}
        </div>
        <Tag :color="getStatusColor(item.status)">{{ item.status }}</Tag>
      </Card>
    </div>

    <Table
      class="customer-receivable-overview-table__table"
      :columns="columns"
      :data-source="rows"
      :loading="loading"
      :pagination="pagination"
      row-key="accountKey"
      size="small"
      :scroll="{ x: 2360 }"
    >
      <template #bodyCell="{ column, record, text }">
        <template
          v-if="
            [
              'collectionRateStatus',
              'customerLevelStatus',
              'loyaltyStatus',
            ].includes(String(column.dataIndex))
          "
        >
          <Tag :color="getStatusColor(getStatusText(column.dataIndex))">
            {{ getStatusText(column.dataIndex) }}
          </Tag>
        </template>
        <template v-else-if="column.dataIndex === 'lastBizTime'">
          {{ formatDate(text) }}
        </template>
        <template v-else-if="column.dataIndex === 'actions'">
          <Button
            size="small"
            type="link"
            @click.stop="
              handleOpenDetail(
                record as ErpReceivableAccountApi.ReceivableAccount,
              )
            "
          >
            明细
          </Button>
        </template>
        <template v-else-if="moneyFields.includes(column.dataIndex as never)">
          {{ formatMoney(text) }}
        </template>
        <template v-else>
          {{ text || '-' }}
        </template>
      </template>
      <template #emptyText>
        <BusinessReportEmptyState
          description="当前查询条件下没有客户经营记录"
          title="暂无客户经营数据"
        />
      </template>
    </Table>

    <div class="customer-receivable-overview-table__footer">
      <Space size="large">
        <span>共 {{ total }} 条记录</span>
        <span>本页 {{ pageSummary.count }} 条</span>
        <span>本页出库：{{ formatMoney(pageSummary.saleOutAmount) }}</span>
        <span>本页已收：{{ formatMoney(pageSummary.receiptAmount) }}</span>
        <span
          >本页应收余额：{{ formatMoney(pageSummary.receivableBalance) }}</span
        >
        <span
          >本页预收余额：{{ formatMoney(pageSummary.preAdvanceAmount) }}</span
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
    <Drawer
      v-model:open="detailOpen"
      class="customer-receivable-overview-detail-drawer"
      destroy-on-close
      :footer="null"
      :title="detailTitle"
      width="85vw"
    >
      <ReceivableDetailDrawer
        :customer-id="currentCustomerId"
        :customer-name="currentCustomerName"
        :dept-id="currentDeptId"
        :dept-name="currentDeptName"
        :dept-unassigned="currentDeptUnassigned"
        display-mode="drawer"
        readonly
      />
    </Drawer>
  </Card>
</template>

<style scoped>
.customer-receivable-overview-table {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  min-height: 100%;
}

.customer-receivable-overview-table :deep(.ant-card-head) {
  flex: 0 0 auto;
}

.customer-receivable-overview-table :deep(.ant-card-body) {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 12px;
}

.customer-receivable-overview-table__hint {
  display: inline-block;
  max-width: 760px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  white-space: normal;
}

.customer-receivable-overview-table__query {
  flex: 0 0 auto;
  margin-bottom: 8px;
}

.customer-receivable-overview-table__cards {
  display: grid;
  flex: 0 0 auto;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 8px;
  margin-bottom: 8px;
}

.customer-receivable-overview-table__card {
  min-width: 0;
}

.customer-receivable-overview-table__card-label {
  color: hsl(var(--muted-foreground));
  font-size: 12px;
}

.customer-receivable-overview-table__card-value {
  margin: 4px 0 6px;
  color: hsl(var(--foreground));
  font-size: 18px;
  font-weight: 700;
}

.customer-receivable-overview-table__table {
  flex: 0 0 auto;
  min-height: 0;
}

.customer-receivable-overview-table__table :deep(.ant-table-body) {
  overflow-y: visible !important;
}

.customer-receivable-overview-table__footer {
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
