<script lang="ts" setup>
import type { ErpPurchaseInvoiceApi } from '#/api/erp/purchase/invoice';
import type { Key } from 'ant-design-vue/es/table/interface';

import { computed, nextTick, ref, watch } from 'vue';
import { formatPurchaseAmount, formatPurchaseDecimal } from '#/views/erp/purchase/utils/decimal';

import { Empty, Input, Pagination, Table, Tag } from 'ant-design-vue';

import { getPurchaseInvoiceSourceDocumentPage } from '#/api/erp/purchase/invoice';

import { formatPurchaseInvoiceSourceBizTime } from './source-display';
import {
  filterSelectedPurchaseInvoiceSourceRefs,
  getPurchaseInvoiceSourceRefKey,
} from './source-selection';

interface Props {
  supplierId?: number;
  disabled?: boolean;
  hiddenFields?: string[];
  persistedSourceRefs?: ErpPurchaseInvoiceApi.PurchaseInvoiceSourceRef[];
}

const props = withDefaults(defineProps<Props>(), {
  supplierId: undefined,
  disabled: false,
  hiddenFields: () => [],
  persistedSourceRefs: () => [],
});

const emit = defineEmits<{
  'update:persistedSourceRefs': [
    sourceRefs: ErpPurchaseInvoiceApi.PurchaseInvoiceSourceRef[],
  ];
  'update:selectedRows': [
    rows: ErpPurchaseInvoiceApi.PurchaseInvoiceSourceDocument[],
  ];
}>();

const keyword = ref('');
const loading = ref(false);
const dataSource = ref<ErpPurchaseInvoiceApi.PurchaseInvoiceSourceDocument[]>(
  [],
);
const selectedRowKeys = ref<Key[]>([]);
const selectedRowMap = ref(
  new Map<string, ErpPurchaseInvoiceApi.PurchaseInvoiceSourceDocument>(),
);
const deselectedPersistedRowKeys = ref(new Set<string>());
const pagination = ref({ pageNo: 1, pageSize: 20, total: 0 });
const persistedRowKeySet = computed(
  () => new Set(props.persistedSourceRefs.map(getPurchaseInvoiceSourceRefKey)),
);
const displaySelectedRowKeys = computed<Key[]>(() => [
  ...Array.from(persistedRowKeySet.value).filter(
    (key) => !deselectedPersistedRowKeys.value.has(key),
  ),
  ...selectedRowKeys.value.filter(
    (key) => !persistedRowKeySet.value.has(String(key)),
  ),
]);

const columns = computed(() => [
  { title: '来源类型', dataIndex: 'sourceTypeName', width: 90 },
  { title: '单据号', dataIndex: 'no', width: 180 },
  { title: '业务时间', dataIndex: 'bizTime', width: 155 },
  { title: '开票状态', dataIndex: 'invoiceStatus', width: 90 },
  { title: '原数量', dataIndex: 'totalCount', width: 95 },
  { title: '剩余数量', dataIndex: 'remainingCount', width: 95 },
  { title: '来源金额', dataIndex: 'totalAmount', width: 110 },
]);

function sourceKey(
  record: ErpPurchaseInvoiceApi.PurchaseInvoiceSourceDocument,
) {
  return `${record.sourceType}:${record.id}`;
}

function isExhausted(
  record: ErpPurchaseInvoiceApi.PurchaseInvoiceSourceDocument,
) {
  return Number(record.remainingCount ?? 0) <= 0;
}

function isPersistedSource(
  record: ErpPurchaseInvoiceApi.PurchaseInvoiceSourceDocument,
) {
  return persistedRowKeySet.value.has(sourceKey(record));
}

function emitSelectedRows() {
  emit('update:selectedRows', Array.from(selectedRowMap.value.values()));
}

function clearSelection() {
  selectedRowKeys.value = [];
  selectedRowMap.value = new Map();
  deselectedPersistedRowKeys.value = new Set();
  emitSelectedRows();
}

function updateSelection(
  keys: Key[],
  rows: ErpPurchaseInvoiceApi.PurchaseInvoiceSourceDocument[] = [],
) {
  const previousSelectedKeySet = new Set(selectedRowKeys.value.map(String));
  const previousPersistedKeys = new Set(
    Array.from(persistedRowKeySet.value).filter(
      (key) => !deselectedPersistedRowKeys.value.has(key),
    ),
  );
  const nextPersistedRefs = filterSelectedPurchaseInvoiceSourceRefs(
    props.persistedSourceRefs,
    keys.map(String),
  );
  const nextPersistedKeys = new Set(
    nextPersistedRefs.map(getPurchaseInvoiceSourceRefKey),
  );
  deselectedPersistedRowKeys.value = new Set(
    Array.from(persistedRowKeySet.value).filter(
      (key) => !nextPersistedKeys.has(key),
    ),
  );
  selectedRowKeys.value = keys.filter(
    (key) => !persistedRowKeySet.value.has(String(key)),
  );
  const selectedKeySet = new Set(selectedRowKeys.value.map(String));
  const nextMap = new Map(selectedRowMap.value);
  for (const key of Array.from(nextMap.keys())) {
    if (!selectedKeySet.has(key)) nextMap.delete(key);
  }
  for (const row of rows) {
    const key = sourceKey(row);
    if (selectedKeySet.has(key)) nextMap.set(key, row);
  }
  selectedRowMap.value = nextMap;
  if (
    previousPersistedKeys.size !== nextPersistedKeys.size ||
    Array.from(previousPersistedKeys).some((key) => !nextPersistedKeys.has(key))
  ) {
    emit('update:persistedSourceRefs', nextPersistedRefs);
  }
  if (
    previousSelectedKeySet.size !== selectedKeySet.size ||
    Array.from(previousSelectedKeySet).some((key) => !selectedKeySet.has(key))
  ) {
    emitSelectedRows();
  }
}

function isInteractiveTarget(target: EventTarget | null) {
  return (
    target instanceof Element &&
    Boolean(
      target.closest('.ant-checkbox-wrapper,.ant-checkbox,a,button,input'),
    )
  );
}

function toggleRowSelection(
  record: ErpPurchaseInvoiceApi.PurchaseInvoiceSourceDocument,
) {
  if (isExhausted(record) && !isPersistedSource(record)) return;
  const key = sourceKey(record);
  const keySet = new Set(displaySelectedRowKeys.value.map(String));
  if (keySet.has(key)) {
    updateSelection(
      displaySelectedRowKeys.value.filter((item) => String(item) !== key),
    );
  } else {
    updateSelection([...displaySelectedRowKeys.value, key], [record]);
  }
}

function getRowProps(
  record: ErpPurchaseInvoiceApi.PurchaseInvoiceSourceDocument,
) {
  if (props.disabled) return {};
  return {
    onClick: (event: MouseEvent) => {
      if (!isInteractiveTarget(event.target)) toggleRowSelection(record);
    },
  };
}

async function loadData(options: { pageNo?: number; pageSize?: number } = {}) {
  if (!props.supplierId) {
    dataSource.value = [];
    pagination.value.total = 0;
    return;
  }
  const pageNo = options.pageNo ?? pagination.value.pageNo;
  const pageSize = options.pageSize ?? pagination.value.pageSize;
  loading.value = true;
  try {
    const page = await getPurchaseInvoiceSourceDocumentPage({
      keyword: keyword.value.trim() || undefined,
      pageNo,
      pageSize,
      supplierId: props.supplierId,
    });
    dataSource.value = page.list ?? [];
    pagination.value = { pageNo, pageSize, total: page.total ?? 0 };
  } finally {
    loading.value = false;
  }
}

function handlePageChange(pageNo: number, pageSize: number) {
  void loadData({ pageNo, pageSize });
}

watch(
  () => props.persistedSourceRefs,
  () => {
    deselectedPersistedRowKeys.value = new Set();
  },
  { deep: true },
);

watch(
  () => props.supplierId,
  async () => {
    keyword.value = '';
    clearSelection();
    pagination.value.pageNo = 1;
    await nextTick();
    await loadData({ pageNo: 1 });
  },
  { immediate: true },
);

defineExpose({ clearSelection, loadData });
</script>

<template>
  <div
    class="purchase-invoice-source-select rounded border border-border bg-background p-3"
  >
    <div class="mb-2">
      <div class="font-medium">待选采购来源</div>
      <div class="text-xs text-muted-foreground">
        入库按原价、调价按差额、退货按负向金额带入；可在同一张票据中混合冲抵。
      </div>
    </div>
    <div class="mb-3 flex gap-2">
      <Input
        v-model:value="keyword"
        placeholder="搜索来源单据号"
        allow-clear
        :disabled="!supplierId || disabled"
        @press-enter="loadData({ pageNo: 1 })"
      />
      <a-button
        type="primary"
        :disabled="!supplierId || disabled"
        :loading="loading"
        @click="loadData({ pageNo: 1 })"
      >
        搜索
      </a-button>
    </div>
    <Table
      :columns="columns"
      :data-source="dataSource"
      :loading="loading"
      :pagination="false"
      :custom-row="getRowProps"
      :row-key="sourceKey"
      size="small"
      :scroll="{ x: 'max-content', y: 'calc(70vh - 260px)' }"
      :locale="{
        emptyText: supplierId ? Empty.PRESENTED_IMAGE_SIMPLE : '请先选择供应商',
      }"
      :row-selection="
        disabled
          ? undefined
          : {
              selectedRowKeys: displaySelectedRowKeys,
              preserveSelectedRowKeys: true,
              getCheckboxProps: (record) => ({
                disabled: isExhausted(record) && !isPersistedSource(record),
              }),
              onChange: updateSelection,
            }
      "
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'bizTime'">
          {{ formatPurchaseInvoiceSourceBizTime(record.bizTime) }}
        </template>
        <template v-else-if="column.dataIndex === 'invoiceStatus'">
          <Tag
            :color="
              record.invoiceStatus === '已开票'
                ? 'green'
                : record.invoiceStatus === '部分开票'
                  ? 'orange'
                  : 'default'
            "
          >
            {{ record.invoiceStatus }}
          </Tag>
        </template>
        <template v-else-if="column.dataIndex === 'totalAmount'">
          {{ formatPurchaseAmount(record.totalAmount, '0') }}
        </template>
      </template>
    </Table>
    <div class="mt-3 flex justify-end">
      <Pagination
        size="small"
        :current="pagination.pageNo"
        :page-size="pagination.pageSize"
        :total="pagination.total"
        :show-size-changer="true"
        :page-size-options="['10', '20', '50']"
        @change="handlePageChange"
        @show-size-change="handlePageChange"
      />
    </div>
  </div>
</template>

<style scoped>
.purchase-invoice-source-select {
  font-size: 12px;
}

:deep(.ant-input),
:deep(.ant-btn),
:deep(.ant-table) {
  font-size: 12px;
}

:deep(.ant-table-thead > tr > th),
:deep(.ant-table-tbody > tr > td) {
  padding: 6px 8px;
  font-size: 11px;
  white-space: nowrap;
}
</style>
