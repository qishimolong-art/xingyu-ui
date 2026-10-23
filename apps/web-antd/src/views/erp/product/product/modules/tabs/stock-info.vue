<script lang="ts" setup>
import type { ErpProductApi } from '#/api/erp/product/product';
import type { ErpStockApi } from '#/api/erp/stock/stock';
import type { TableColumnsType } from 'ant-design-vue';

import { computed, ref, watch } from 'vue';

import {
  Alert,
  Descriptions,
  DescriptionsItem,
  Empty,
  Table,
} from 'ant-design-vue';

import { getStockPage } from '#/api/erp/stock/stock';
import { useFieldPermission } from '#/composables/useFieldPermission';
import { prepareErpArchiveItemColumns } from '#/views/erp/base/utils/archive-list-table';

const props = defineProps<{ value?: ErpProductApi.Product }>();
const { isHidden } = useFieldPermission('erp_product');
const stockRows = ref<ErpStockApi.Stock[]>([]);
const loading = ref(false);
let stockLoadSequence = 0;

const currentStock = computed(() => Number(props.value?.currentStock ?? 0));
const productId = computed(() => props.value?.id);
const zeroStockWarning = computed(() => currentStock.value === 0);
const warning = computed(
  () =>
    zeroStockWarning.value ||
    props.value?.lowStockWarning ||
    (props.value?.stockMin !== null &&
      props.value?.stockMin !== undefined &&
      currentStock.value <= Number(props.value.stockMin)),
);
const warningMessage = computed(() =>
  zeroStockWarning.value ? '库存为零' : '低于安全库存',
);
const warningDescription = computed(() =>
  zeroStockWarning.value
    ? '当前库存为 0，请及时补货。'
    : '当前库存已达到或低于库存下限，请及时补货。',
);

function format(v?: number | string) {
  if (v === null || v === undefined || v === '') return '0';
  return String(v);
}

function calcAvailable(row: ErpStockApi.Stock) {
  const count = Number(row.count ?? 0);
  const lock = Number(row.lockCount ?? 0);
  const occupied = Number(row.occupiedCount ?? 0);
  return count - lock - occupied;
}

function calcAvailableRecord(record: Record<string, any>) {
  return calcAvailable(record as ErpStockApi.Stock);
}

function formatStockCell(record: Record<string, any>, dataIndex: unknown) {
  if (typeof dataIndex !== 'string') {
    return '0';
  }
  return format(record[dataIndex]);
}

const baseColumns: TableColumnsType<ErpStockApi.Stock> = [
  { title: '仓库名称', dataIndex: 'warehouseName', width: 150 },
  { title: '仓库部门', dataIndex: 'deptName', width: 130 },
  { title: '当前库存', dataIndex: 'count', width: 100, align: 'right' },
  { title: '占用库存', dataIndex: 'occupiedCount', width: 100, align: 'right' },
  {
    title: '待入库存',
    dataIndex: 'pendingInCount',
    width: 100,
    align: 'right',
  },
  {
    title: '在途库存',
    dataIndex: 'inTransitCount',
    width: 100,
    align: 'right',
  },
  {
    title: '可用库存',
    dataIndex: 'availableCount',
    width: 100,
    align: 'right',
  },
  { title: '货架位', dataIndex: 'shelf', width: 120 },
  { title: '成本单价', dataIndex: 'costPrice', width: 110, align: 'right' },
  { title: '成本金额', dataIndex: 'costAmount', width: 110, align: 'right' },
];
const columns = computed<TableColumnsType<ErpStockApi.Stock>>(() =>
  prepareErpArchiveItemColumns(baseColumns, { rows: stockRows.value }),
);

async function loadStockRows() {
  const sequence = ++stockLoadSequence;
  const currentProductId = productId.value;
  if (!currentProductId) {
    stockRows.value = [];
    loading.value = false;
    return;
  }
  loading.value = true;
  try {
    const data = await getStockPage({
      pageNo: 1,
      pageSize: 100,
      productId: currentProductId,
    });
    if (sequence !== stockLoadSequence) {
      return;
    }
    stockRows.value = data.list ?? [];
  } finally {
    if (sequence === stockLoadSequence) {
      loading.value = false;
    }
  }
}

watch(productId, () => void loadStockRows(), { immediate: true });

defineExpose({ reload: loadStockRows });
</script>

<template>
  <div class="mx-2 py-2">
    <Alert
      v-if="warning"
      type="warning"
      show-icon
      :message="warningMessage"
      :description="warningDescription"
      class="mb-4"
    />
    <Descriptions bordered :column="3" size="middle">
      <DescriptionsItem v-if="!isHidden('currentStock')" label="当前库存">
        {{ format(value?.currentStock) }}
      </DescriptionsItem>
      <DescriptionsItem v-if="!isHidden('inTransitStock')" label="在途数量">
        {{ format(value?.inTransitStock) }}
      </DescriptionsItem>
      <DescriptionsItem v-if="!isHidden('availableStock')" label="可用库存">
        {{ format(value?.availableStock) }}
      </DescriptionsItem>
      <DescriptionsItem v-if="!isHidden('stockMin')" label="库存下限">
        {{ format(value?.stockMin) }}
      </DescriptionsItem>
      <DescriptionsItem v-if="!isHidden('stockStandard')" label="标准库存">
        {{ format(value?.stockStandard) }}
      </DescriptionsItem>
      <DescriptionsItem v-if="!isHidden('stockMax')" label="库存上限">
        {{ format(value?.stockMax) }}
      </DescriptionsItem>
    </Descriptions>
    <div class="mt-3 text-xs text-gray-500">
      当前库存由 erp_stock 实时聚合；在途数量 /
      可用库存为预留字段，后续接入采购在途后自动计算。
    </div>
    <div class="mt-5">
      <div class="mb-2 text-sm font-medium">产品库存明细</div>
      <Empty v-if="!productId" description="保存配件后显示产品库存" />
      <Table
        v-else
        :columns="columns"
        :data-source="stockRows"
        :loading="loading"
        :pagination="false"
        :row-key="(row) => row.id"
        :scroll="{ x: 1120, y: 320 }"
        bordered
        size="small"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'availableCount'">
            {{ format(calcAvailableRecord(record)) }}
          </template>
          <template
            v-else-if="
              [
                'count',
                'occupiedCount',
                'pendingInCount',
                'inTransitCount',
                'costPrice',
                'costAmount',
              ].includes(column.dataIndex as string)
            "
          >
            {{ formatStockCell(record, column.dataIndex) }}
          </template>
        </template>
      </Table>
    </div>
  </div>
</template>
