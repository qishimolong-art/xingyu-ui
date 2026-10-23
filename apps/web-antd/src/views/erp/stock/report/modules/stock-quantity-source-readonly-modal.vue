<script lang="ts" setup>
/* eslint-disable vue/html-closing-bracket-newline -- Oxfmt manages multiline template layout. */
import type { TableColumnsType } from 'ant-design-vue';

import type { ErpStockApi } from '#/api/erp/stock/stock';

import { computed, ref } from 'vue';

import { formatDateTime } from '@vben/utils';

import { Alert, Modal, Table, Tag } from 'ant-design-vue';

import {
  getStockInTransitDetails,
  getStockOccupiedDetails,
  getStockPendingInDetails,
} from '#/api/erp/stock/stock';
import {
  stockNatural as erpCountInputFormatter,
  stockSumKnown,
} from '#/views/erp/stock/utils/stock-decimal';

defineOptions({ name: 'ErpStockQuantitySourceReadonlyModal' });

type DetailType = 'inTransit' | 'occupied' | 'pendingIn';
type DetailRow = (
  | ErpStockApi.StockInTransitDetail
  | ErpStockApi.StockOccupiedDetail
  | ErpStockApi.StockPendingInDetail
) & {
  cartId?: number;
  checkId?: number;
  documentId?: number;
  documentType?: string;
  inId?: number;
  orderId?: number;
};

const detailTypeLabelMap: Record<DetailType, string> = {
  inTransit: '采购在途来源',
  occupied: '占用来源',
  pendingIn: '未入来源',
};

const documentTypeLabelMap: Record<string, string> = {
  PURCHASE_IN: '采购入库',
  PURCHASE_RETURN: '采购退货',
  SALE_CART: '销售手推车',
  SALE_OUT: '销售出库',
  SALE_RETURN: '销售退货',
  STOCK_CHECK: '库存盘点',
  STOCK_IN: '其他入库',
  STOCK_IN_BILL: '入库单',
  STOCK_MOVE: '库存移库',
  STOCK_OUT: '其他出库',
  STOCK_OUT_BILL: '出库单',
  STOCK_TRANSFER_IN: '调拨入库',
  WAREHOUSE_MOVE: '仓库移货',
};

const open = ref(false);
const loading = ref(false);
const loadError = ref('');
const activeType = ref<DetailType>('occupied');
const activeRow = ref<ErpStockApi.Stock>();
const rows = ref<DetailRow[]>([]);
let loadSequence = 0;

const title = computed(() => {
  const row = activeRow.value;
  const productLabel = [row?.productCode, row?.productName]
    .filter(Boolean)
    .join(' ');
  const labels = [
    detailTypeLabelMap[activeType.value],
    productLabel,
    row?.warehouseName,
    row?.batchRow ? `批次：${row.batchNo || '未指定批次'}` : undefined,
  ].filter(Boolean);
  return labels.join(' - ');
});

const columns: TableColumnsType<DetailRow> = [
  { title: '序号', key: 'seq', width: 56 },
  {
    title: '配件名称',
    dataIndex: 'productName',
    key: 'productName',
    width: 180,
  },
  {
    title: '来源类型',
    dataIndex: 'documentType',
    key: 'documentType',
    width: 112,
  },
  { title: '来源单号', dataIndex: 'no', key: 'no', width: 170 },
  {
    title: '配件编码',
    dataIndex: 'productCode',
    key: 'productCode',
    width: 130,
  },
  {
    title: '仓库',
    dataIndex: 'warehouseName',
    key: 'warehouseName',
    width: 130,
  },
  { title: '批次号', dataIndex: 'batchNo', key: 'batchNo', width: 120 },
  {
    title: '数量',
    dataIndex: 'count',
    key: 'count',
    width: 100,
    align: 'right',
  },
  { title: '车型', dataIndex: 'vehicleModel', key: 'vehicleModel', width: 130 },
  { title: '产地', dataIndex: 'originPlace', key: 'originPlace', width: 100 },
  { title: '图号', dataIndex: 'drawingNo', key: 'drawingNo', width: 130 },
  { title: '规格', dataIndex: 'standard', key: 'standard', width: 130 },
  { title: '创建时间', dataIndex: 'createTime', key: 'createTime', width: 168 },
  { title: '创建人', dataIndex: 'creatorName', key: 'creatorName', width: 112 },
];

const totalCount = computed(() =>
  stockSumKnown(rows.value.map((item) => item.count)),
);

function getDocumentTypeLabel(record: DetailRow) {
  const type = record.documentType;
  if (!type && activeType.value === 'inTransit') return '采购订单';
  if (!type) return '-';
  return documentTypeLabelMap[type] || type;
}

function getRowKey(record: DetailRow) {
  return [
    record.documentType,
    record.orderId,
    record.documentId,
    record.cartId,
    record.checkId,
    record.inId,
    record.itemId,
    record.no,
  ]
    .filter((value) => value !== undefined && value !== null && value !== '')
    .join('_');
}

async function loadRows(type: DetailType, row: ErpStockApi.Stock) {
  const sequence = ++loadSequence;
  loading.value = true;
  loadError.value = '';
  rows.value = [];
  try {
    const params = {
      decimalMode: 'string' as const,
      productId: row.productId,
      warehouseId: row.warehouseId,
      batchNo: row.batchNo,
      unassignedBatch: row.batchRow === true && !row.batchNo,
    };
    const load = {
      occupied: getStockOccupiedDetails,
      pendingIn: getStockPendingInDetails,
      inTransit: getStockInTransitDetails,
    }[type];
    const result = await load(params);
    if (sequence !== loadSequence) return;
    rows.value = result || [];
  } catch {
    if (sequence === loadSequence) {
      loadError.value = `${detailTypeLabelMap[type]}加载失败，请关闭后重试`;
    }
  } finally {
    if (sequence === loadSequence) {
      loading.value = false;
    }
  }
}

function show(type: DetailType, row: ErpStockApi.Stock) {
  activeType.value = type;
  activeRow.value = row;
  open.value = true;
  if (!row.productId || !row.warehouseId) {
    loadSequence += 1;
    rows.value = [];
    loadError.value = '当前库存行缺少商品或仓库信息，无法查看来源明细';
    return;
  }
  void loadRows(type, row);
}

function handleClose() {
  loadSequence += 1;
  loading.value = false;
  loadError.value = '';
  rows.value = [];
  activeRow.value = undefined;
}

defineExpose({ show });
</script>

<template>
  <Modal
    v-model:open="open"
    :footer="null"
    :title="title"
    class="stock-quantity-source-readonly-modal"
    width="96vw"
    @after-close="handleClose"
  >
    <Alert
      v-if="loadError"
      class="mb-2"
      :message="loadError"
      show-icon
      type="error"
    />
    <Table
      :columns="columns"
      :data-source="rows"
      :loading="loading"
      :pagination="false"
      :row-key="getRowKey"
      :scroll="{ x: 'max-content', y: 'calc(100vh - 280px)' }"
      size="small"
    >
      <template #bodyCell="{ column, index, record }">
        <template v-if="column.key === 'seq'">
          {{ index + 1 }}
        </template>
        <template v-else-if="column.key === 'documentType'">
          <Tag>{{ getDocumentTypeLabel(record) }}</Tag>
        </template>
        <template v-else-if="column.key === 'no'">
          {{ record.no || '-' }}
        </template>
        <template v-else-if="column.key === 'count'">
          {{ erpCountInputFormatter(record.count) }}
        </template>
        <template v-else-if="column.key === 'createTime'">
          {{ record.createTime ? formatDateTime(record.createTime) : '-' }}
        </template>
        <template v-else-if="column.key === 'creatorName'">
          {{ record.creatorName || record.creator || '-' }}
        </template>
      </template>
    </Table>
    <div class="stock-quantity-source-readonly-modal__summary">
      <span
        >明细 <b>{{ rows.length }}</b> 项</span
      >
      <span
        >数量合计：<b>{{ erpCountInputFormatter(totalCount) }}</b></span
      >
    </div>
  </Modal>
</template>

<style scoped>
.stock-quantity-source-readonly-modal :deep(.ant-modal-body) {
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 112px);
  min-height: 0;
  padding: 12px;
}

.stock-quantity-source-readonly-modal :deep(.ant-table) {
  font-size: 12px;
}

.stock-quantity-source-readonly-modal :deep(.ant-table-cell) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stock-quantity-source-readonly-modal__summary {
  display: flex;
  min-height: 38px;
  align-items: center;
  justify-content: flex-end;
  gap: 20px;
  padding: 8px 12px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-top: 0;
  border-radius: 0 0 8px 8px;
}

.stock-quantity-source-readonly-modal__summary b {
  color: hsl(var(--foreground));
  font-weight: 600;
}
</style>
