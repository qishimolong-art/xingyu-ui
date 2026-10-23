<script lang="ts" setup>
import type { TableColumnsType, TableProps } from 'ant-design-vue';

import type { StockQuantityDetailRow } from './stock-quantity-detail-sort';

import { computed, ref } from 'vue';

import { formatDateTime } from '@vben/utils';

import { Alert, Table } from 'ant-design-vue';

import {
  stockNatural as erpCountInputFormatter,
  stockSumKnown,
} from '#/views/erp/stock/utils/stock-decimal';

import {
  isStockQuantityDetailSortField,
  sortStockQuantityDetails,
} from './stock-quantity-detail-sort';

interface Props {
  error?: string;
  loading?: boolean;
  rows?: StockQuantityDetailRow[];
}

const props = withDefaults(defineProps<Props>(), {
  error: '',
  loading: false,
  rows: () => [],
});

const emit = defineEmits<{
  openDocument: [record: StockQuantityDetailRow];
}>();

const activeSort = ref<null | {
  field: string;
  order: 'ascend' | 'descend';
}>(null);

const baseColumns: TableColumnsType<StockQuantityDetailRow> = [
  { title: '序号', key: 'seq', width: 56 },
  {
    title: '配件名称',
    dataIndex: 'productName',
    key: 'productName',
    width: 180,
    sorter: true,
  },
  { title: '单号', dataIndex: 'no', key: 'no', width: 170, sorter: true },
  {
    title: '配件编码',
    dataIndex: 'productCode',
    key: 'productCode',
    width: 130,
    sorter: true,
  },
  {
    title: '仓库',
    dataIndex: 'warehouseName',
    key: 'warehouseName',
    width: 140,
    sorter: true,
  },
  {
    title: '批次号',
    dataIndex: 'batchNo',
    key: 'batchNo',
    width: 130,
    sorter: true,
  },
  {
    title: '包装数',
    dataIndex: 'packageQty',
    key: 'packageQty',
    width: 90,
    sorter: true,
  },
  {
    title: '单重',
    dataIndex: 'weight',
    key: 'weight',
    width: 90,
    sorter: true,
  },
  {
    title: '总重',
    dataIndex: 'totalWeight',
    key: 'totalWeight',
    width: 100,
    sorter: true,
  },
  {
    title: '数量',
    dataIndex: 'count',
    key: 'count',
    width: 100,
    sorter: true,
  },
  {
    title: '车型',
    dataIndex: 'vehicleModel',
    key: 'vehicleModel',
    width: 140,
    sorter: true,
  },
  {
    title: '产地',
    dataIndex: 'originPlace',
    key: 'originPlace',
    width: 110,
    sorter: true,
  },
  {
    title: '图号',
    dataIndex: 'drawingNo',
    key: 'drawingNo',
    width: 130,
    sorter: true,
  },
  {
    title: '规格',
    dataIndex: 'standard',
    key: 'standard',
    width: 130,
    sorter: true,
  },
  {
    title: '创建时间',
    dataIndex: 'createTime',
    key: 'createTime',
    width: 170,
    sorter: true,
  },
  {
    title: '创建人',
    dataIndex: 'creatorName',
    key: 'creatorName',
    width: 120,
    sorter: true,
  },
];

const columns = computed(() => {
  const sort = activeSort.value;
  return baseColumns.map((column) => ({
    ...column,
    sortOrder: sort && sort.field === column.key ? sort.order : null,
  }));
});

const displayedRows = computed(() => {
  const sort = activeSort.value;
  if (!sort) {
    return [...props.rows];
  }
  return sortStockQuantityDetails(
    props.rows,
    sort.field,
    sort.order === 'ascend' ? 'asc' : 'desc',
  );
});

const totalCount = computed(() =>
  stockSumKnown(props.rows.map((item) => item.count)),
);

const handleTableChange: NonNullable<
  TableProps<StockQuantityDetailRow>['onChange']
> = (_pagination, _filters, sorter) => {
  const currentSorter = Array.isArray(sorter) ? sorter[0] : sorter;
  const field = currentSorter?.columnKey;
  const order = currentSorter?.order;
  activeSort.value =
    isStockQuantityDetailSortField(field) &&
    (order === 'ascend' || order === 'descend')
      ? { field, order }
      : null;
};

function hasDocumentTarget(record: StockQuantityDetailRow) {
  return Boolean(
    record.orderId ||
    record.documentId ||
    record.cartId ||
    record.checkId ||
    record.inId,
  );
}

function getRowKey(record: StockQuantityDetailRow) {
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
</script>

<template>
  <div class="stock-quantity-detail-view">
    <Alert
      v-if="error"
      class="stock-quantity-detail-error"
      :message="error"
      show-icon
      type="error"
    />
    <template v-else>
      <Table
        class="stock-quantity-detail-table"
        :columns="columns"
        :data-source="displayedRows"
        :loading="loading"
        :pagination="false"
        :row-key="getRowKey"
        :scroll="{ x: 'max-content', y: 'calc(100vh - 190px)' }"
        :show-sorter-tooltip="false"
        size="small"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record, index }">
          <template v-if="column.key === 'seq'">
            {{ index + 1 }}
          </template>
          <template v-else-if="column.key === 'no'">
            <a
              v-if="record.no && hasDocumentTarget(record)"
              class="text-primary cursor-pointer"
              @click.stop="emit('openDocument', record)"
            >
              {{ record.no }}
            </a>
            <span v-else>{{ record.no || '-' }}</span>
          </template>
          <template v-else-if="column.key === 'count'">
            <span class="stock-quantity-detail-table__number">
              {{ erpCountInputFormatter(record.count) }}
            </span>
          </template>
          <template v-else-if="column.key === 'createTime'">
            {{ record.createTime ? formatDateTime(record.createTime) : '-' }}
          </template>
          <template v-else-if="column.key === 'creatorName'">
            {{ record.creatorName || record.creator || '-' }}
          </template>
        </template>
      </Table>

      <div class="stock-quantity-detail-summary">
        <span>
          明细
          <b>{{ rows.length }}</b>
          项
        </span>
        <span>
          数量合计：<b>{{ erpCountInputFormatter(totalCount) }}</b>
        </span>
      </div>
    </template>
  </div>
</template>

<style scoped>
.stock-quantity-detail-view {
  min-height: calc(100vh - 72px);
  padding: 12px;
  overflow: hidden;
  font-size: 12px;
  background: hsl(var(--muted) / 28%);
}

.stock-quantity-detail-error {
  font-size: 12px;
}

:deep(.stock-quantity-detail-table .ant-table) {
  font-size: 12px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

:deep(.stock-quantity-detail-table .ant-table-cell) {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.stock-quantity-detail-table .ant-table-column-title) {
  white-space: nowrap;
}

:deep(
  .stock-quantity-detail-table
    .ant-table-column-has-sorters
    .ant-table-column-title
) {
  color: #1677ff;
}

:deep(.stock-quantity-detail-table .ant-table-column-sorter) {
  display: none;
}

:deep(.stock-quantity-detail-table .ant-table-column-sorters) {
  justify-content: flex-start;
}

.stock-quantity-detail-table__number {
  font-variant-numeric: tabular-nums;
}

.stock-quantity-detail-summary {
  display: flex;
  min-height: 38px;
  align-items: center;
  justify-content: flex-end;
  gap: 20px;
  padding: 8px 12px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-top: 0;
  border-radius: 0 0 8px 8px;
}

.stock-quantity-detail-summary b {
  color: hsl(var(--foreground));
  font-weight: 600;
}
</style>
