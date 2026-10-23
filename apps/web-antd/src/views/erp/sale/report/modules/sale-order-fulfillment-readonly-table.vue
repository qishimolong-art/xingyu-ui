<script setup lang="ts">
import type { TablePaginationConfig, TableProps } from 'ant-design-vue';

import type { ErpSaleOrderApi } from '#/api/erp/sale/order';

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

import { exportSaleOrder, getSaleOrderPage } from '#/api/erp/sale/order';
import { formatSaleAmount, formatSaleDecimal } from '../../utils/decimal';

defineOptions({ name: 'ErpSaleOrderFulfillmentReadonlyTable' });

const statusOptions = [
  { label: '草稿', value: 0 },
  { label: '待审核', value: 10 },
  { label: '已审核', value: 20 },
];

const query = reactive({
  customerName: '',
  no: '',
  status: undefined as number | undefined,
});
const pageNo = ref(1);
const pageSize = ref(10);
const total = ref(0);
const loading = ref(false);
const exporting = ref(false);
const rows = ref<ErpSaleOrderApi.SaleOrder[]>([]);

const columns: TableProps<ErpSaleOrderApi.SaleOrder>['columns'] = [
  { title: '销售订单号', dataIndex: 'no', width: 160 },
  { title: '客户', dataIndex: 'customerName', width: 180 },
  { title: '销售部门', dataIndex: 'deptName', width: 130 },
  { title: '订单日期', dataIndex: 'orderTime', width: 160 },
  { title: '单据状态', dataIndex: 'status', width: 100 },
  { title: '订单类型', dataIndex: 'orderType', width: 100 },
  { title: '订购数量', dataIndex: 'totalCount', width: 110, align: 'right' },
  { title: '已出库数', dataIndex: 'outCount', width: 110, align: 'right' },
  {
    title: '未出库数',
    dataIndex: 'pendingOutCount',
    width: 110,
    align: 'right',
  },
  { title: '已退货数', dataIndex: 'returnCount', width: 110, align: 'right' },
  { title: '采购入库数', dataIndex: 'inCount', width: 110, align: 'right' },
  {
    title: '产品金额',
    dataIndex: 'totalProductPrice',
    width: 120,
    align: 'right',
  },
  { title: '优惠率', dataIndex: 'discountPercent', width: 96, align: 'right' },
  { title: '优惠金额', dataIndex: 'discountPrice', width: 120, align: 'right' },
  { title: '费用金额', dataIndex: 'feeAmount', width: 120, align: 'right' },
  { title: '含税金额', dataIndex: 'totalPrice', width: 120, align: 'right' },
  { title: '定金金额', dataIndex: 'depositPrice', width: 120, align: 'right' },
  { title: '产品信息', dataIndex: 'productNames', width: 220 },
  { title: '附件', dataIndex: 'fileUrl', width: 80 },
  { title: '创建人', dataIndex: 'creatorName', width: 110 },
  { title: '创建时间', dataIndex: 'createTime', width: 160 },
  { title: '修改人', dataIndex: 'updaterName', width: 110 },
  { title: '修改时间', dataIndex: 'updateTime', width: 160 },
  { title: '备注', dataIndex: 'remark', width: 220 },
];

const pageSummary = computed(() => {
  let totalCount = 0;
  let outCount = 0;
  let returnCount = 0;
  let inCount = 0;
  let totalProductPrice = 0;
  let discountPrice = 0;
  let feeAmount = 0;
  let totalPrice = 0;
  let depositPrice = 0;
  for (const row of rows.value) {
    totalCount += Number(row.totalCount || 0);
    outCount += Number(row.outCount || 0);
    returnCount += Number(row.returnCount || 0);
    inCount += Number(row.inCount || 0);
    totalProductPrice += Number(row.totalProductPrice || 0);
    discountPrice += Number(row.discountPrice || 0);
    feeAmount += Number(row.feeAmount || 0);
    totalPrice += Number(row.totalPrice || 0);
    depositPrice += Number(row.depositPrice || 0);
  }
  return {
    count: rows.value.length,
    depositPrice,
    discountPrice,
    feeAmount,
    inCount,
    outCount,
    pendingOutCount: totalCount - outCount,
    returnCount,
    totalCount,
    totalProductPrice,
    totalPrice,
  };
});

function formatNumber(value: unknown) {
  return formatSaleDecimal(value, '-');
}

function formatMoney(value: unknown) {
  return formatSaleAmount(value, '-');
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

function getOrderType(orderType?: number) {
  if (orderType === 2) return { color: 'purple', label: '报价单' };
  if (orderType === 1 || orderType === undefined) {
    return { color: 'blue', label: '正式单' };
  }
  return { color: 'default', label: '-' };
}

function getPendingOutCount(row: ErpSaleOrderApi.SaleOrder) {
  return Number(row.totalCount || 0) - Number(row.outCount || 0);
}

function buildPageParams(): ErpSaleOrderApi.SaleOrderPageParams &
  Record<string, any> {
  return {
    customerName: query.customerName || undefined,
    includeItems: false,
    no: query.no || undefined,
    pageNo: pageNo.value,
    pageSize: pageSize.value,
    status: query.status,
  };
}

function buildExportParams() {
  const { pageNo: _pageNo, pageSize: _pageSize, ...params } = buildPageParams();
  return params;
}

async function loadData() {
  loading.value = true;
  try {
    const result = await getSaleOrderPage(buildPageParams());
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
  query.no = '';
  query.status = undefined;
  pageNo.value = 1;
  loadData();
}

async function handleExport() {
  exporting.value = true;
  try {
    const data = await exportSaleOrder(buildExportParams());
    downloadFileFromBlobPart({ fileName: '销售订单履约.xls', source: data });
  } finally {
    exporting.value = false;
  }
}

function handlePageChange(nextPage: number, nextPageSize: number) {
  pageNo.value = nextPage;
  pageSize.value = nextPageSize;
  loadData();
}

const pagination = computed<false | TablePaginationConfig>(() => false);

onMounted(loadData);
</script>

<template>
  <Card
    class="sale-order-fulfillment-readonly-table"
    size="small"
    title="销售订单履约"
  >
    <Form class="sale-order-fulfillment-readonly-table__query" layout="inline">
      <FormItem label="销售订单号">
        <Input
          v-model:value="query.no"
          allow-clear
          placeholder="请输入销售订单号"
          @press-enter="handleSearch"
        />
      </FormItem>
      <FormItem label="客户">
        <Input
          v-model:value="query.customerName"
          allow-clear
          placeholder="请输入客户名称"
          @press-enter="handleSearch"
        />
      </FormItem>
      <FormItem label="单据状态">
        <Select
          v-model:value="query.status"
          allow-clear
          class="sale-order-fulfillment-readonly-table__status"
          :options="statusOptions"
          placeholder="请选择状态"
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

    <Table
      class="sale-order-fulfillment-readonly-table__table"
      :columns="columns"
      :data-source="rows"
      :loading="loading"
      :pagination="pagination"
      row-key="id"
      size="small"
      :scroll="{ x: 2920 }"
    >
      <template #bodyCell="{ column, record, text }">
        <template v-if="column.dataIndex === 'status'">
          <Tag :color="getStatus(record.status).color">
            {{ getStatus(record.status).label }}
          </Tag>
        </template>
        <template v-else-if="column.dataIndex === 'orderType'">
          <Tag :color="getOrderType(record.orderType).color">
            {{ getOrderType(record.orderType).label }}
          </Tag>
        </template>
        <template
          v-else-if="
            ['orderTime', 'createTime', 'updateTime'].includes(
              String(column.dataIndex),
            )
          "
        >
          {{ formatDate(text) }}
        </template>
        <template v-else-if="column.dataIndex === 'pendingOutCount'">
          {{
            formatNumber(
              getPendingOutCount(record as ErpSaleOrderApi.SaleOrder),
            )
          }}
        </template>
        <template
          v-else-if="
            ['totalCount', 'outCount', 'returnCount', 'inCount'].includes(
              String(column.dataIndex),
            )
          "
        >
          {{ formatNumber(text) }}
        </template>
        <template v-else-if="column.dataIndex === 'discountPercent'">
          {{
            text === undefined || text === null ? '-' : `${formatNumber(text)}%`
          }}
        </template>
        <template
          v-else-if="
            [
              'totalProductPrice',
              'discountPrice',
              'feeAmount',
              'totalPrice',
              'depositPrice',
            ].includes(String(column.dataIndex))
          "
        >
          {{ formatMoney(text) }}
        </template>
        <template v-else-if="column.dataIndex === 'fileUrl'">
          <a
            v-if="record.fileUrl"
            :href="record.fileUrl"
            target="_blank"
            rel="noopener noreferrer"
          >
            查看
          </a>
          <span v-else>-</span>
        </template>
        <template v-else>
          {{ text || '-' }}
        </template>
      </template>
    </Table>

    <div class="sale-order-fulfillment-readonly-table__footer">
      <Space size="large">
        <span>共 {{ total }} 条记录</span>
        <span>本页 {{ pageSummary.count }} 条</span>
        <span>订购：{{ formatNumber(pageSummary.totalCount) }}</span>
        <span>已出库：{{ formatNumber(pageSummary.outCount) }}</span>
        <span>未出库：{{ formatNumber(pageSummary.pendingOutCount) }}</span>
        <span>采购入库：{{ formatNumber(pageSummary.inCount) }}</span>
        <span>产品金额：{{ formatMoney(pageSummary.totalProductPrice) }}</span>
        <span>优惠金额：{{ formatMoney(pageSummary.discountPrice) }}</span>
        <span>费用金额：{{ formatMoney(pageSummary.feeAmount) }}</span>
        <span>含税金额：{{ formatMoney(pageSummary.totalPrice) }}</span>
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
.sale-order-fulfillment-readonly-table {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  min-height: 100%;
}

.sale-order-fulfillment-readonly-table :deep(.ant-card-head) {
  flex: 0 0 auto;
}

.sale-order-fulfillment-readonly-table :deep(.ant-card-body) {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 12px;
}

.sale-order-fulfillment-readonly-table__hint {
  display: inline-block;
  max-width: 760px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  white-space: normal;
}

.sale-order-fulfillment-readonly-table__query {
  flex: 0 0 auto;
  margin-bottom: 8px;
}

.sale-order-fulfillment-readonly-table__status {
  width: 150px;
}

.sale-order-fulfillment-readonly-table__table {
  flex: 0 0 auto;
  min-height: 0;
}

.sale-order-fulfillment-readonly-table__table :deep(.ant-table-body) {
  overflow-y: visible !important;
}

.sale-order-fulfillment-readonly-table__footer {
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
