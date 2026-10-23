<script lang="ts" setup>
import type { TableColumnsType } from 'ant-design-vue';

import type { ErpProductApi } from '#/api/erp/product/product';

import { computed, ref, watch } from 'vue';

import { useAccess } from '@vben/access';

import {
  Button,
  Checkbox,
  Empty,
  Input,
  message,
  Table,
  Tag,
} from 'ant-design-vue';

import {
  getProductStockDistribution,
  updateProductStockDistribution,
} from '#/api/erp/product/product';
import { prepareErpArchiveItemColumns } from '#/views/erp/base/utils/archive-list-table';

const props = withDefaults(
  defineProps<{
    readonly?: boolean;
    value?: ErpProductApi.Product;
  }>(),
  {
    readonly: false,
  },
);

const emit = defineEmits<{ (e: 'success'): void }>();

const { hasAccessByCodes } = useAccess();
const distribution = ref<ErpProductApi.StockDistribution | null>(null);
const selectedWarehouseIds = ref<number[]>([]);
const keyword = ref('');
const loading = ref(false);
const saving = ref(false);
let distributionLoadSequence = 0;

function normalizeText(value?: null | number | string) {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

function matchesKeyword(item: ErpProductApi.StockDistributionWarehouse) {
  const input = normalizeText(keyword.value);
  if (!input) {
    return true;
  }
  return [
    item.warehouseCode,
    item.warehouseName,
    item.deptName,
    item.deptId,
  ].some((value) => normalizeText(value).includes(input));
}

const productId = computed(() => props.value?.id);
const warehouses = computed(() => distribution.value?.warehouses ?? []);
const filteredWarehouses = computed(() =>
  warehouses.value.filter((item) => matchesKeyword(item)),
);
const selectedSet = computed(() => new Set(selectedWarehouseIds.value));
const distributedCount = computed(
  () => distribution.value?.distributedWarehouseIds?.length ?? 0,
);
const addedCount = computed(
  () =>
    warehouses.value.filter(
      (item) => !item.distributed && selectedSet.value.has(item.warehouseId),
    ).length,
);
const keptCount = computed(
  () =>
    warehouses.value.filter(
      (item) => item.distributed && selectedSet.value.has(item.warehouseId),
    ).length,
);
const lockedRemoveCount = computed(
  () =>
    warehouses.value.filter(
      (item) =>
        item.distributed &&
        !item.removable &&
        selectedSet.value.has(item.warehouseId),
    ).length,
);
const headerChecked = computed(
  () =>
    filteredWarehouses.value.length > 0 &&
    filteredWarehouses.value.every((item) =>
      selectedSet.value.has(item.warehouseId),
    ),
);
const headerIndeterminate = computed(() => {
  const checkedCount = filteredWarehouses.value.filter((item) =>
    selectedSet.value.has(item.warehouseId),
  ).length;
  return checkedCount > 0 && checkedCount < filteredWarehouses.value.length;
});
const canSave = computed(
  () =>
    !props.readonly &&
    hasAccessByCodes(['erp:product:stock-distribute']) &&
    Boolean(productId.value),
);

const baseColumns: TableColumnsType<ErpProductApi.StockDistributionWarehouse> =
  [
    { title: '', dataIndex: 'selected', width: 56 },
    { title: '仓库编码', dataIndex: 'warehouseCode', width: 110 },
    { title: '仓库名称', dataIndex: 'warehouseName', width: 160 },
    { title: '仓库部门', dataIndex: 'deptName', width: 130 },
    { title: '当前库存', dataIndex: 'count', width: 100, align: 'right' },
    { title: '锁定库存', dataIndex: 'lockCount', width: 100, align: 'right' },
    { title: '状态', dataIndex: 'status', width: 180 },
  ];
const columns = computed<
  TableColumnsType<ErpProductApi.StockDistributionWarehouse>
>(() =>
  prepareErpArchiveItemColumns(baseColumns, {
    editable: !props.readonly,
    rows: filteredWarehouses.value,
  }),
);

function canToggleWarehouse(item: ErpProductApi.StockDistributionWarehouse) {
  return !(
    item.defaultWarehouse ||
    (item.distributed && !item.removable) ||
    props.readonly
  );
}

function isChecked(warehouseId: number) {
  return selectedSet.value.has(warehouseId);
}

function toggleWarehouse(
  item: ErpProductApi.StockDistributionWarehouse,
  checked: boolean,
) {
  if (!canToggleWarehouse(item)) {
    return;
  }
  const next = new Set(selectedWarehouseIds.value);
  if (checked) {
    next.add(item.warehouseId);
  } else {
    next.delete(item.warehouseId);
  }
  selectedWarehouseIds.value = [...next];
}

function canToggleRecord(record: Record<string, any>) {
  return canToggleWarehouse(record as ErpProductApi.StockDistributionWarehouse);
}

function toggleRecord(record: Record<string, any>, checked: boolean) {
  toggleWarehouse(record as ErpProductApi.StockDistributionWarehouse, checked);
}

function toggleFilteredWarehouses(checked: boolean) {
  if (props.readonly) {
    return;
  }
  const next = new Set(selectedWarehouseIds.value);
  filteredWarehouses.value.forEach((item) => {
    if (checked) {
      next.add(item.warehouseId);
      return;
    }
    if (canToggleWarehouse(item)) {
      next.delete(item.warehouseId);
    }
  });
  selectedWarehouseIds.value = [...next];
}

async function loadData() {
  const sequence = ++distributionLoadSequence;
  const currentProductId = productId.value;
  if (!currentProductId) {
    distribution.value = null;
    selectedWarehouseIds.value = [];
    loading.value = false;
    return;
  }
  loading.value = true;
  try {
    const data = await getProductStockDistribution(currentProductId);
    if (sequence !== distributionLoadSequence) {
      return;
    }
    distribution.value = data;
    selectedWarehouseIds.value = (data.warehouses ?? [])
      .filter((item) => item.distributed)
      .map((item) => item.warehouseId);
  } finally {
    if (sequence === distributionLoadSequence) {
      loading.value = false;
    }
  }
}

async function handleSave() {
  if (!productId.value) {
    return;
  }
  if (selectedWarehouseIds.value.length === 0) {
    message.warning('请至少选择一个分发仓库');
    return;
  }
  saving.value = true;
  try {
    await updateProductStockDistribution({
      productId: productId.value,
      warehouseIds: selectedWarehouseIds.value,
    });
    message.success('库存分发成功');
    await loadData();
    emit('success');
  } finally {
    saving.value = false;
  }
}

watch(
  productId,
  () => {
    keyword.value = '';
    void loadData();
  },
  { immediate: true },
);

defineExpose({ reload: loadData });
</script>

<template>
  <div class="mx-2 py-2">
    <Empty v-if="!productId" description="保存配件后可进行库存分发" />
    <div v-else class="space-y-3">
      <div class="grid grid-cols-3 gap-3 text-sm">
        <div>
          配件编码：{{ distribution?.productCode || value?.code || '-' }}
        </div>
        <div>
          配件名称：{{ distribution?.productName || value?.name || '-' }}
        </div>
        <div>已分发：{{ distributedCount }} 个仓库</div>
      </div>

      <div class="flex items-center justify-between gap-3">
        <div class="min-w-0 flex-1">
          <Input
            v-model:value="keyword"
            allow-clear
            class="max-w-[360px]"
            placeholder="搜索仓库名称 / 编码 / 部门"
          />
        </div>
        <div class="flex items-center gap-3">
          <div class="text-xs text-gray-500">
            新增 {{ addedCount }} 个；保留 {{ keptCount }} 个；不可取消
            {{ lockedRemoveCount }} 个
          </div>
          <Button
            v-if="canSave"
            :loading="saving"
            type="primary"
            @click="handleSave"
          >
            保存分发
          </Button>
        </div>
      </div>

      <Table
        :columns="columns"
        :data-source="filteredWarehouses"
        :loading="loading"
        :pagination="false"
        :row-key="(row) => row.warehouseId"
        :scroll="{ x: 'max-content', y: 360 }"
        bordered
        size="small"
      >
        <template #headerCell="{ column }">
          <template v-if="column.dataIndex === 'selected'">
            <Checkbox
              :checked="headerChecked"
              :disabled="readonly || filteredWarehouses.length === 0"
              :indeterminate="headerIndeterminate"
              @change="
                (event) => toggleFilteredWarehouses(event.target.checked)
              "
            />
          </template>
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'selected'">
            <Checkbox
              :checked="isChecked(record.warehouseId)"
              :disabled="!canToggleRecord(record)"
              @change="(event) => toggleRecord(record, event.target.checked)"
            />
          </template>
          <template v-else-if="column.dataIndex === 'count'">
            {{ record.count ?? 0 }}
          </template>
          <template v-else-if="column.dataIndex === 'lockCount'">
            {{ record.lockCount ?? 0 }}
          </template>
          <template v-else-if="column.dataIndex === 'status'">
            <Tag v-if="!record.distributed" color="default">未分发</Tag>
            <Tag v-else-if="record.defaultWarehouse" color="blue">默认仓库</Tag>
            <Tag v-else-if="record.removable" color="green">可取消</Tag>
            <Tag v-else color="orange">
              {{ record.disabledReason || '已有库存业务' }}
            </Tag>
          </template>
        </template>
      </Table>
    </div>
  </div>
</template>
