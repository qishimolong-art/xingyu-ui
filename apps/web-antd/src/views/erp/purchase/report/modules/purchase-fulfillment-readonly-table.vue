<script setup lang="ts">
import { formatPurchaseAmount } from "#/views/erp/purchase/utils/decimal";
import type { TablePaginationConfig } from 'ant-design-vue';

import type { ErpPurchaseInApi } from '#/api/erp/purchase/in';
import type { ErpPurchaseOrderApi } from '#/api/erp/purchase/order';

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

import { exportPurchaseIn, getPurchaseInPage } from '#/api/erp/purchase/in';
import {
  exportPurchaseOrder,
  getPurchaseOrderPage,
} from '#/api/erp/purchase/order';

type Mode = 'inbound' | 'order';

defineOptions({ name: 'ErpPurchaseFulfillmentReadonlyTable' });

const props = defineProps<{ mode: Mode }>();

const orderStatusOptions = [
  { label: '草稿', value: 0 },
  { label: '待审核', value: 10 },
  { label: '已审核', value: 20 },
];

const inboundStatusOptions = [
  { label: '草稿', value: 0 },
  { label: '待审核', value: 10 },
  { label: '已审核', value: 20 },
];

const query = reactive({
  no: '',
  supplierName: '',
  status: undefined as number | undefined,
});
const pageNo = ref(1);
const pageSize = ref(10);
const total = ref(0);
const loading = ref(false);
const exporting = ref(false);
const rows = ref<
  ErpPurchaseInApi.PurchaseIn[] | ErpPurchaseOrderApi.PurchaseOrder[]
>([]);

const isOrder = computed(() => props.mode === 'order');
const title = computed(() => (isOrder.value ? '采购订单履约' : '采购入库到货'));
const statusOptions = computed(() =>
  isOrder.value ? orderStatusOptions : inboundStatusOptions,
);

const columns = computed(() => {
  const commonColumns = [
    {
      title: isOrder.value ? '采购订单号' : '采购入库单号',
      dataIndex: 'no',
      width: 160,
    },
    { title: '供应商', dataIndex: 'supplierName', width: 180 },
  ];

  if (isOrder.value) {
    return [
      ...commonColumns,
      { title: '订单日期', dataIndex: 'orderTime', width: 160 },
      { title: '预计到货', dataIndex: 'arrivalDate', width: 140 },
      { title: '采购部门', dataIndex: 'deptName', width: 130 },
      { title: '采购员', dataIndex: 'purchaserName', width: 110 },
      { title: '单据状态', dataIndex: 'status', width: 100 },
      { title: '入库状态', dataIndex: 'inStatus', width: 100 },
      {
        title: '订购数量',
        dataIndex: 'totalCount',
        width: 110,
        align: 'right',
      },
      { title: '已入库数', dataIndex: 'inCount', width: 110, align: 'right' },
      {
        title: '已退货数',
        dataIndex: 'returnCount',
        width: 110,
        align: 'right',
      },
      { title: '产品信息', dataIndex: 'productNames', width: 220 },
      { title: '明细项数', dataIndex: 'itemCount', width: 96, align: 'right' },
      {
        title: '产品金额',
        dataIndex: 'totalProductPrice',
        width: 120,
        align: 'right',
      },
      {
        title: '优惠率',
        dataIndex: 'discountPercent',
        width: 96,
        align: 'right',
      },
      {
        title: '优惠金额',
        dataIndex: 'discountPrice',
        width: 120,
        align: 'right',
      },
      { title: '费用金额', dataIndex: 'feeAmount', width: 120, align: 'right' },
      {
        title: '含税金额',
        dataIndex: 'totalPrice',
        width: 120,
        align: 'right',
      },
      {
        title: '定金金额',
        dataIndex: 'depositPrice',
        width: 120,
        align: 'right',
      },
      { title: '送货方式', dataIndex: 'deliveryMethod', width: 120 },
      { title: '结算方式', dataIndex: 'settleMethod', width: 120 },
      { title: '开票类型', dataIndex: 'invoiceType', width: 120 },
      { title: '采购类型', dataIndex: 'purchaseType', width: 120 },
      { title: '单据类型', dataIndex: 'documentType', width: 120 },
      { title: '厂家单号', dataIndex: 'factoryOrderNo', width: 150 },
      { title: '附件', dataIndex: 'fileUrl', width: 80 },
      { title: '创建人', dataIndex: 'creatorName', width: 110 },
      { title: '创建时间', dataIndex: 'createTime', width: 160 },
      { title: '修改人', dataIndex: 'updaterName', width: 110 },
      { title: '修改时间', dataIndex: 'updateTime', width: 160 },
    ];
  }

  return [
    ...commonColumns,
    { title: '入库日期', dataIndex: 'inTime', width: 160 },
    { title: '来源订单', dataIndex: 'orderNo', width: 160 },
    { title: '收货部门', dataIndex: 'deptName', width: 130 },
    { title: '采购员', dataIndex: 'purchaserName', width: 110 },
    { title: '单据状态', dataIndex: 'status', width: 100 },
    { title: '结算状态', dataIndex: 'paymentStatus', width: 100 },
    { title: '退货状态', dataIndex: 'returnStatus', width: 100 },
    { title: '调价状态', dataIndex: 'adjustStatus', width: 100 },
    { title: '入库数量', dataIndex: 'totalCount', width: 110, align: 'right' },
    { title: '已退货数', dataIndex: 'returnCount', width: 110, align: 'right' },
    {
      title: '产品金额',
      dataIndex: 'totalProductPrice',
      width: 120,
      align: 'right',
    },
    {
      title: '优惠率',
      dataIndex: 'discountPercent',
      width: 96,
      align: 'right',
    },
    {
      title: '优惠金额',
      dataIndex: 'discountPrice',
      width: 120,
      align: 'right',
    },
    { title: '费用金额', dataIndex: 'feeAmount', width: 120, align: 'right' },
    { title: '其他金额', dataIndex: 'otherPrice', width: 120, align: 'right' },
    { title: '税额', dataIndex: 'taxPrice', width: 120, align: 'right' },
    {
      title: '价税合计',
      dataIndex: 'totalTaxPrice',
      width: 120,
      align: 'right',
    },
    { title: '含税金额', dataIndex: 'totalPrice', width: 120, align: 'right' },
    { title: '已付款', dataIndex: 'paymentPrice', width: 120, align: 'right' },
    { title: '开票类型', dataIndex: 'invoiceType', width: 120 },
    { title: '经办人', dataIndex: 'handlerName', width: 110 },
    { title: '结算方式', dataIndex: 'settleMethod', width: 120 },
    { title: '运输方式', dataIndex: 'transportMethod', width: 120 },
    { title: '物流公司', dataIndex: 'logisticsCompany', width: 140 },
    { title: '厂家单号', dataIndex: 'factoryOrderNo', width: 150 },
    { title: '附件', dataIndex: 'fileUrl', width: 80 },
    { title: '创建人', dataIndex: 'creatorName', width: 110 },
    { title: '创建时间', dataIndex: 'createTime', width: 160 },
    { title: '修改人', dataIndex: 'updaterName', width: 110 },
    { title: '修改时间', dataIndex: 'updateTime', width: 160 },
  ];
});

const pageSummary = computed(() => {
  const currentRows = rows.value as Array<Record<string, any>>;
  const totalCount = currentRows.reduce(
    (sum, row) => sum + Number(row.totalCount || row.count || 0),
    0,
  );
  const totalPrice = currentRows.reduce(
    (sum, row) => sum + Number(row.totalPrice || 0),
    0,
  );
  const totalProductPrice = currentRows.reduce(
    (sum, row) => sum + Number(row.totalProductPrice || 0),
    0,
  );
  const discountPrice = currentRows.reduce(
    (sum, row) => sum + Number(row.discountPrice || 0),
    0,
  );
  const feeAmount = currentRows.reduce(
    (sum, row) => sum + Number(row.feeAmount || 0),
    0,
  );
  return {
    count: currentRows.length,
    discountPrice,
    feeAmount,
    totalCount,
    totalProductPrice,
    totalPrice,
  };
});

function formatNumber(value: unknown) {
  const next = Number(value || 0);
  if (!Number.isFinite(next)) return '-';
  return next.toLocaleString('zh-CN', { maximumFractionDigits: 6 });
}

function formatMoney(value: unknown) {
  return formatPurchaseAmount(value, '-');
}

function formatDate(value: unknown) {
  if (!value) return '-';
  return formatDateTime(value as string) || String(value);
}

function getOrderStatus(status?: number) {
  if (status === 20) return { color: 'success', label: '已审核' };
  if (status === 10) return { color: 'processing', label: '待审核' };
  if (status === 0) return { color: 'default', label: '草稿' };
  return { color: 'default', label: '-' };
}

function getOrderInStatus(row: ErpPurchaseOrderApi.PurchaseOrder) {
  if (row.inStatus === 2) return { color: 'success', label: '已入库' };
  if (row.inStatus === 1) return { color: 'warning', label: '部分入库' };
  return { color: 'default', label: '未入库' };
}

function getInboundPaymentStatus(row: ErpPurchaseInApi.PurchaseIn) {
  if (row.paymentStatus === 2) return { color: 'success', label: '已结算' };
  if (row.paymentStatus === 1)
    return { color: 'processing', label: '部分结算' };
  if (row.paymentStatus === 0) return { color: 'default', label: '未结算' };

  const totalPrice = Number(row.totalPrice || 0);
  const paymentPrice = Number(row.paymentPrice || 0);
  if (totalPrice !== 0 && Math.abs(paymentPrice) >= Math.abs(totalPrice)) {
    return { color: 'success', label: '已结算' };
  }
  if (paymentPrice !== 0) return { color: 'processing', label: '部分结算' };
  return { color: 'default', label: '未结算' };
}

function getReturnStatus(row: ErpPurchaseInApi.PurchaseIn) {
  if (row.returnStatus === 2) return { color: 'success', label: '已退货' };
  if (row.returnStatus === 1) return { color: 'warning', label: '部分退货' };
  return { color: 'default', label: '未退货' };
}

function getAdjustStatus(row: ErpPurchaseInApi.PurchaseIn) {
  if (
    row.adjustStatus === 2 ||
    (row.adjustStatus === undefined && row.adjusted)
  ) {
    return { color: 'success', label: '已调价' };
  }
  if (row.adjustStatus === 1) return { color: 'warning', label: '部分调价' };
  return { color: 'default', label: '未调价' };
}

function buildParams(includePage = true) {
  return {
    pageNo: includePage ? pageNo.value : undefined,
    pageSize: includePage ? pageSize.value : undefined,
    no: query.no || undefined,
    supplierName: query.supplierName || undefined,
    status: query.status,
  };
}

async function loadData() {
  loading.value = true;
  try {
    const params = buildParams();
    const result = isOrder.value
      ? await getPurchaseOrderPage(params)
      : await getPurchaseInPage(params);
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
  query.supplierName = '';
  query.status = undefined;
  pageNo.value = 1;
  pageSize.value = 10;
  loadData();
}

async function handleExport() {
  exporting.value = true;
  try {
    const params = buildParams(false);
    const data = isOrder.value
      ? await exportPurchaseOrder(params)
      : await exportPurchaseIn(params);
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
  <Card class="purchase-fulfillment-readonly-table" size="small" :title="title">
    <Form class="purchase-fulfillment-readonly-table__query" layout="inline">
      <FormItem :label="isOrder ? '采购订单号' : '采购入库单号'">
        <Input
          v-model:value="query.no"
          allow-clear
          :placeholder="isOrder ? '请输入采购订单号' : '请输入采购入库单号'"
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
          class="purchase-fulfillment-readonly-table__status"
          :options="statusOptions"
          placeholder="请选择状态"
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
      class="purchase-fulfillment-readonly-table__table"
      :columns="columns"
      :data-source="rows"
      :loading="loading"
      :pagination="pagination"
      row-key="id"
      size="small"
      :scroll="{ x: isOrder ? 3300 : 3600 }"
    >
      <template #bodyCell="{ column, record, text }">
        <template v-if="column.dataIndex === 'status'">
          <Tag :color="getOrderStatus(record.status).color">
            {{ getOrderStatus(record.status).label }}
          </Tag>
        </template>
        <template v-else-if="column.dataIndex === 'inStatus'">
          <Tag :color="getOrderInStatus(record).color">
            {{ getOrderInStatus(record).label }}
          </Tag>
        </template>
        <template v-else-if="column.dataIndex === 'paymentStatus'">
          <Tag :color="getInboundPaymentStatus(record).color">
            {{ getInboundPaymentStatus(record).label }}
          </Tag>
        </template>
        <template v-else-if="column.dataIndex === 'returnStatus'">
          <Tag :color="getReturnStatus(record).color">
            {{ getReturnStatus(record).label }}
          </Tag>
        </template>
        <template v-else-if="column.dataIndex === 'adjustStatus'">
          <Tag :color="getAdjustStatus(record).color">
            {{ getAdjustStatus(record).label }}
          </Tag>
        </template>
        <template
          v-else-if="
            ['orderTime', 'inTime', 'createTime', 'updateTime'].includes(
              String(column.dataIndex),
            )
          "
        >
          {{ formatDate(text) }}
        </template>
        <template v-else-if="column.dataIndex === 'arrivalDate'">
          {{ text || '-' }}
        </template>
        <template
          v-else-if="
            [
              'totalProductPrice',
              'discountPrice',
              'feeAmount',
              'otherPrice',
              'taxPrice',
              'totalTaxPrice',
              'totalPrice',
              'depositPrice',
              'paymentPrice',
            ].includes(String(column.dataIndex))
          "
        >
          {{ formatMoney(text) }}
        </template>
        <template v-else-if="column.dataIndex === 'discountPercent'">
          {{
            text === undefined || text === null ? '-' : `${formatNumber(text)}%`
          }}
        </template>
        <template
          v-else-if="
            ['totalCount', 'inCount', 'returnCount', 'itemCount'].includes(
              String(column.dataIndex),
            )
          "
        >
          {{ formatNumber(text) }}
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

    <div class="purchase-fulfillment-readonly-table__footer">
      <Space size="large">
        <span>共 {{ total }} 条记录</span>
        <span>本页 {{ pageSummary.count }} 条</span>
        <span>本页数量：{{ formatNumber(pageSummary.totalCount) }}</span>
        <span>产品金额：{{ formatMoney(pageSummary.totalProductPrice) }}</span>
        <span>优惠金额：{{ formatMoney(pageSummary.discountPrice) }}</span>
        <span>费用金额：{{ formatMoney(pageSummary.feeAmount) }}</span>
        <span>本页含税金额：{{ formatMoney(pageSummary.totalPrice) }}</span>
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
  </Card>
</template>

<style scoped>
.purchase-fulfillment-readonly-table {
  display: flex;
  flex: 0 0 auto;
  flex-direction: column;
  min-height: 0;
}

.purchase-fulfillment-readonly-table :deep(.ant-card-head) {
  flex: 0 0 auto;
}

.purchase-fulfillment-readonly-table :deep(.ant-card-body) {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  padding: 12px;
}

.purchase-fulfillment-readonly-table__hint {
  display: inline-block;
  max-width: 760px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  white-space: normal;
}

.purchase-fulfillment-readonly-table__query {
  flex: 0 0 auto;
  margin-bottom: 8px;
}

.purchase-fulfillment-readonly-table__status {
  width: 160px;
}

.purchase-fulfillment-readonly-table__table {
  flex: 0 0 auto;
  min-height: 0;
}

.purchase-fulfillment-readonly-table__table :deep(.ant-table-body) {
  overflow-y: visible !important;
}

.purchase-fulfillment-readonly-table__footer {
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
