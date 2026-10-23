<script setup lang="ts">
import { formatPurchaseAmount } from "#/views/erp/purchase/utils/decimal";
import type { TablePaginationConfig } from 'ant-design-vue';

import type { ErpPayableAccountApi } from '#/api/erp/finance/payable/account';

import { computed, onMounted, reactive, ref } from 'vue';

import { downloadFileFromBlobPart, formatDateTime } from '@vben/utils';

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
} from 'ant-design-vue';

import {
  exportPayableAccount,
  getPayableAccountPage,
} from '#/api/erp/finance/payable/account';

import PayableDetailDrawer from '../../../finance/payable/account/modules/detail-drawer.vue';

defineOptions({ name: 'ErpSupplierPayableOverviewTable' });

const query = reactive({
  supplierName: '',
});
const pageNo = ref(1);
const pageSize = ref(10);
const total = ref(0);
const loading = ref(false);
const exporting = ref(false);
const rows = ref<ErpPayableAccountApi.PayableAccount[]>([]);
const detailOpen = ref(false);
const currentSupplierId = ref<number>();
const currentSupplierName = ref('');
const currentDeptName = ref('');

const columns = [
  { title: '供应商', dataIndex: 'supplierName', width: 180 },
  { title: '部门', dataIndex: 'deptName', width: 130 },
  { title: '经办人', dataIndex: 'handlerName', width: 110 },
  {
    title: '采购入库金额',
    dataIndex: 'purchaseInAmount',
    width: 130,
    align: 'right',
  },
  {
    title: '采购退货金额',
    dataIndex: 'purchaseReturnAmount',
    width: 130,
    align: 'right',
  },
  {
    title: '调价金额',
    dataIndex: 'priceAdjustAmount',
    width: 120,
    align: 'right',
  },
  {
    title: '其他应付',
    dataIndex: 'miscPayableAmount',
    width: 120,
    align: 'right',
  },
  { title: '已付款', dataIndex: 'paymentAmount', width: 120, align: 'right' },
  { title: '已核销', dataIndex: 'writeOffAmount', width: 120, align: 'right' },
  { title: '应付余额', dataIndex: 'balance', width: 120, align: 'right' },
  {
    title: '未核销预付款',
    dataIndex: 'unclearedPrepayment',
    width: 130,
    align: 'right',
  },
  { title: '最近业务时间', dataIndex: 'lastBizTime', width: 170 },
  { title: '操作', dataIndex: 'actions', width: 90, fixed: 'right' },
];

const pageSummary = computed(() => {
  const fields: Array<keyof ErpPayableAccountApi.PayableAccount> = [
    'purchaseInAmount',
    'purchaseReturnAmount',
    'priceAdjustAmount',
    'miscPayableAmount',
    'paymentAmount',
    'writeOffAmount',
    'balance',
    'unclearedPrepayment',
  ];
  const summary: Record<string, number> = { count: rows.value.length };
  for (const field of fields) {
    let amount = 0;
    for (const row of rows.value) {
      amount += Number(row[field] || 0);
    }
    summary[field] = amount;
  }
  return summary;
});

function formatMoney(value: unknown) {
  return formatPurchaseAmount(value, '-');
}

function formatDate(value: unknown) {
  if (!value) return '-';
  return formatDateTime(value as string) || String(value);
}

function buildQueryParams() {
  return {
    supplierName: query.supplierName || undefined,
  };
}

async function loadData() {
  loading.value = true;
  try {
    const result = await getPayableAccountPage({
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
  query.supplierName = '';
  pageNo.value = 1;
  pageSize.value = 10;
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
    const data = await exportPayableAccount(buildQueryParams());
    downloadFileFromBlobPart({
      fileName: '供应商应付概览.xls',
      source: data,
    });
  } finally {
    exporting.value = false;
  }
}

function handleOpenDetail(row: ErpPayableAccountApi.PayableAccount) {
  currentSupplierId.value = row.supplierId;
  currentSupplierName.value = row.supplierName || '';
  currentDeptName.value = row.deptName || '';
  detailOpen.value = true;
}

const detailTitle = computed(() => {
  const titleParts = [currentSupplierName.value, currentDeptName.value].filter(
    Boolean,
  );
  return titleParts.length > 0
    ? `供应商应付明细 - ${titleParts.join(' / ')}`
    : '供应商应付明细';
});

const pagination = computed<false | TablePaginationConfig>(() => false);

onMounted(loadData);
</script>

<template>
  <Card
    class="supplier-payable-overview-table"
    size="small"
    title="供应商应付概览"
  >
    <Form class="supplier-payable-overview-table__query" layout="inline">
      <FormItem label="供应商">
        <Input
          v-model:value="query.supplierName"
          allow-clear
          placeholder="请输入供应商名称"
          @press-enter="handleSearch"
        />
      </FormItem>
      <FormItem>
        <Space>
          <Button type="primary" :loading="loading" @click="handleSearch"
            >查询</Button
          >
          <Button @click="handleReset">重置</Button>
          <Button :loading="exporting" @click="handleExport">导出</Button>
        </Space>
      </FormItem>
    </Form>

    <Table
      class="supplier-payable-overview-table__table"
      :columns="columns"
      :data-source="rows"
      :loading="loading"
      :pagination="pagination"
      row-key="supplierId"
      size="small"
      :scroll="{ x: 1580 }"
    >
      <template #bodyCell="{ column, record, text }">
        <template v-if="column.dataIndex === 'lastBizTime'">
          {{ formatDate(text) }}
        </template>
        <template v-else-if="column.dataIndex === 'actions'">
          <Button
            size="small"
            type="link"
            @click.stop="
              handleOpenDetail(record as ErpPayableAccountApi.PayableAccount)
            "
          >
            明细
          </Button>
        </template>
        <template
          v-else-if="
            [
              'purchaseInAmount',
              'purchaseReturnAmount',
              'priceAdjustAmount',
              'miscPayableAmount',
              'paymentAmount',
              'writeOffAmount',
              'balance',
              'unclearedPrepayment',
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

    <div class="supplier-payable-overview-table__footer">
      <Space size="large">
        <span>共 {{ total }} 条记录</span>
        <span>本页 {{ pageSummary.count }} 条</span>
        <span>本页入库：{{ formatMoney(pageSummary.purchaseInAmount) }}</span>
        <span>本页已付：{{ formatMoney(pageSummary.paymentAmount) }}</span>
        <span>本页应付余额：{{ formatMoney(pageSummary.balance) }}</span>
        <span
          >本页未核销预付款：{{
            formatMoney(pageSummary.unclearedPrepayment)
          }}</span
        >
      </Space>
      <Pagination
        v-model:current="pageNo"
        v-model:page-size="pageSize"
        :total="total"
        :page-size-options="['10', '20', '50', '100']"
        :show-total="(value) => `共 ${value} 条`"
        show-size-changer
        size="small"
        @change="handlePageChange"
        @show-size-change="handlePageChange"
      />
    </div>
    <Drawer
      v-model:open="detailOpen"
      class="supplier-payable-overview-detail-drawer"
      destroy-on-close
      :footer="null"
      :title="detailTitle"
      width="85vw"
    >
      <PayableDetailDrawer
        :supplier-id="currentSupplierId"
        :supplier-name="currentSupplierName"
        :dept-name="currentDeptName"
        display-mode="drawer"
        readonly
      />
    </Drawer>
  </Card>
</template>

<style scoped>
.supplier-payable-overview-table {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  min-height: 0;
}

.supplier-payable-overview-table :deep(.ant-card-head) {
  flex: 0 0 auto;
}

.supplier-payable-overview-table :deep(.ant-card-body) {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  padding: 12px;
}

.supplier-payable-overview-table__hint {
  display: inline-block;
  max-width: 760px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  white-space: normal;
}

.supplier-payable-overview-table__query {
  flex: 0 0 auto;
  margin-bottom: 8px;
}

.supplier-payable-overview-table__table {
  flex: 0 0 auto;
  min-height: 0;
}

.supplier-payable-overview-table__table :deep(.ant-table-body) {
  overflow-y: visible !important;
}

.supplier-payable-overview-table__footer {
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
