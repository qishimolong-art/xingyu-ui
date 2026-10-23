<script setup lang="ts">
import type { TablePaginationConfig, TableProps } from 'ant-design-vue';

import type { ErpSalePriceAdjustApi } from '#/api/erp/sale/priceadjust';
import type { ErpSaleReturnApi } from '#/api/erp/sale/return';

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

import {
  exportSalePriceAdjust,
  getSalePriceAdjustPage,
} from '#/api/erp/sale/priceadjust';
import { exportSaleReturn, getSaleReturnPage } from '#/api/erp/sale/return';
import { formatSaleAmount, formatSaleDecimal } from '../../utils/decimal';

type Mode = 'adjust' | 'return';
type SaleReturnRow = ErpSaleReturnApi.SaleReturn;
type SaleAdjustRow = ErpSalePriceAdjustApi.PriceAdjust;

defineOptions({ name: 'ErpSaleReturnAdjustReadonlyTable' });

const props = defineProps<{ mode: Mode }>();

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
const rows = ref<Array<SaleAdjustRow | SaleReturnRow>>([]);

const isReturn = computed(() => props.mode === 'return');
const title = computed(() =>
  isReturn.value ? '销售退货原因及退货率分析' : '销售调价业务',
);
const columns = computed<TableProps<SaleAdjustRow | SaleReturnRow>['columns']>(
  () => {
    const commonColumns = [
      {
        title: isReturn.value ? '销售退货单号' : '销售调价单号',
        dataIndex: 'no',
        width: 160,
      },
      { title: '客户', dataIndex: 'customerName', width: 180 },
    ];

    if (isReturn.value) {
      return [
        ...commonColumns,
        { title: '退货日期', dataIndex: 'returnTime', width: 160 },
        { title: '来源出库', dataIndex: 'sourceOutNo', width: 160 },
        { title: '关联订单', dataIndex: 'orderNo', width: 160 },
        { title: '退货部门', dataIndex: 'deptName', width: 130 },
        { title: '业务员', dataIndex: 'saleUserName', width: 110 },
        { title: '经办人', dataIndex: 'handlerName', width: 110 },
        { title: '单据状态', dataIndex: 'status', width: 100 },
        {
          title: '退货数量',
          dataIndex: 'totalCount',
          width: 110,
          align: 'right',
        },
        {
          title: '含税金额',
          dataIndex: 'totalPrice',
          width: 120,
          align: 'right',
        },
        {
          title: '应退金额',
          dataIndex: 'refundPrice',
          width: 120,
          align: 'right',
        },
        { title: '票据类型', dataIndex: 'invoiceType', width: 110 },
        { title: '结算方式', dataIndex: 'settleMethod', width: 120 },
        { title: '配送方式', dataIndex: 'deliveryMethod', width: 120 },
        { title: '物流公司', dataIndex: 'logisticsCompany', width: 140 },
        { title: '物流单号', dataIndex: 'logisticsNo', width: 160 },
        { title: '制单人', dataIndex: 'creatorName', width: 110 },
        { title: '制单时间', dataIndex: 'createTime', width: 160 },
        { title: '更新人', dataIndex: 'updaterName', width: 110 },
        { title: '更新时间', dataIndex: 'updateTime', width: 160 },
        { title: '审核人', dataIndex: 'auditorName', width: 110 },
        { title: '审核时间', dataIndex: 'approveTime', width: 160 },
      ];
    }

    return [
      ...commonColumns,
      { title: '调价日期', dataIndex: 'adjustDate', width: 160 },
      { title: '来源单号', dataIndex: 'sourceNo', width: 160 },
      { title: '调价部门', dataIndex: 'deptName', width: 130 },
      { title: '调价人', dataIndex: 'adjustUserName', width: 110 },
      { title: '单据状态', dataIndex: 'status', width: 100 },
      { title: '调价方式', dataIndex: 'adjustType', width: 110 },
      {
        title: '原金额',
        dataIndex: 'totalOriginalPrice',
        width: 120,
        align: 'right',
      },
      {
        title: '调整后金额',
        dataIndex: 'totalAdjustedPrice',
        width: 130,
        align: 'right',
      },
      {
        title: '调价金额',
        dataIndex: 'totalAdjustPrice',
        width: 120,
        align: 'right',
      },
      {
        title: '收款金额',
        dataIndex: 'receiptPrice',
        width: 120,
        align: 'right',
      },
      { title: '结算方式', dataIndex: 'settleMethod', width: 120 },
      { title: '配送方式', dataIndex: 'deliveryMethod', width: 120 },
      { title: '物流公司', dataIndex: 'logisticsCompany', width: 140 },
      { title: '制单人', dataIndex: 'creatorName', width: 110 },
      { title: '制单时间', dataIndex: 'createTime', width: 160 },
      { title: '更新人', dataIndex: 'updaterName', width: 110 },
      { title: '更新时间', dataIndex: 'updateTime', width: 160 },
      { title: '审核人', dataIndex: 'auditorName', width: 110 },
      { title: '审核时间', dataIndex: 'approveTime', width: 160 },
    ];
  },
);

const pageSummary = computed(() => {
  let totalCount = 0;
  let totalPrice = 0;
  let refundPrice = 0;
  let adjustPrice = 0;
  let receiptPrice = 0;
  for (const row of rows.value) {
    totalCount += Number((row as SaleReturnRow).totalCount || 0);
    totalPrice += Number((row as SaleReturnRow).totalPrice || 0);
    refundPrice += Number((row as SaleReturnRow).refundPrice || 0);
    adjustPrice += Number((row as SaleAdjustRow).totalAdjustPrice || 0);
    receiptPrice += Number((row as SaleAdjustRow).receiptPrice || 0);
  }
  return {
    adjustPrice,
    count: rows.value.length,
    receiptPrice,
    refundPrice,
    totalCount,
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

function getAdjustType(adjustType?: number) {
  if (adjustType === 10) return { color: 'blue', label: '按出库单' };
  if (adjustType === 20) return { color: 'purple', label: '按明细' };
  return { color: 'default', label: '-' };
}

function buildPageParams() {
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
    const result = isReturn.value
      ? await getSaleReturnPage(buildPageParams())
      : await getSalePriceAdjustPage(buildPageParams());
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
    const data = isReturn.value
      ? await exportSaleReturn(buildExportParams())
      : await exportSalePriceAdjust(buildExportParams());
    downloadFileFromBlobPart({ fileName: `${title.value}.xls`, source: data });
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
  <Card class="sale-return-adjust-readonly-table" size="small" :title="title">
    <Form class="sale-return-adjust-readonly-table__query" layout="inline">
      <FormItem :label="isReturn ? '销售退货单号' : '销售调价单号'">
        <Input
          v-model:value="query.no"
          allow-clear
          :placeholder="isReturn ? '请输入销售退货单号' : '请输入销售调价单号'"
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
          class="sale-return-adjust-readonly-table__status"
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
      class="sale-return-adjust-readonly-table__table"
      :columns="columns"
      :data-source="rows"
      :loading="loading"
      :pagination="pagination"
      row-key="id"
      size="small"
      :scroll="{ x: isReturn ? 2920 : 2480 }"
    >
      <template #bodyCell="{ column, record, text }">
        <template v-if="column.dataIndex === 'status'">
          <Tag :color="getStatus(record.status).color">
            {{ getStatus(record.status).label }}
          </Tag>
        </template>
        <template v-else-if="column.dataIndex === 'adjustType'">
          <Tag :color="getAdjustType(record.adjustType).color">
            {{ getAdjustType(record.adjustType).label }}
          </Tag>
        </template>
        <template
          v-else-if="
            [
              'returnTime',
              'adjustDate',
              'createTime',
              'updateTime',
              'approveTime',
            ].includes(String(column.dataIndex))
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
              'totalPrice',
              'refundPrice',
              'totalOriginalPrice',
              'totalAdjustedPrice',
              'totalAdjustPrice',
              'receiptPrice',
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

    <div class="sale-return-adjust-readonly-table__footer">
      <Space size="large">
        <span>共 {{ total }} 条记录</span>
        <span>本页 {{ pageSummary.count }} 条</span>
        <span v-if="isReturn"
          >本页数量：{{ formatNumber(pageSummary.totalCount) }}</span
        >
        <span v-if="isReturn"
          >本页含税金额：{{ formatMoney(pageSummary.totalPrice) }}</span
        >
        <span v-if="isReturn"
          >本页应退：{{ formatMoney(pageSummary.refundPrice) }}</span
        >
        <span v-if="!isReturn"
          >本页调价：{{ formatMoney(pageSummary.adjustPrice) }}</span
        >
        <span v-if="!isReturn"
          >本页收款：{{ formatMoney(pageSummary.receiptPrice) }}</span
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
.sale-return-adjust-readonly-table {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  min-height: 100%;
}

.sale-return-adjust-readonly-table :deep(.ant-card-head) {
  flex: 0 0 auto;
}

.sale-return-adjust-readonly-table :deep(.ant-card-body) {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 12px;
}

.sale-return-adjust-readonly-table__hint {
  display: inline-block;
  max-width: 800px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  white-space: normal;
}

.sale-return-adjust-readonly-table__query {
  flex: 0 0 auto;
  margin-bottom: 8px;
}

.sale-return-adjust-readonly-table__status {
  width: 150px;
}

.sale-return-adjust-readonly-table__table {
  flex: 0 0 auto;
  min-height: 0;
}

.sale-return-adjust-readonly-table__table :deep(.ant-table-body) {
  overflow-y: visible !important;
}

.sale-return-adjust-readonly-table__footer {
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
