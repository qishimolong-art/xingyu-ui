<script lang="ts" setup>
import '#/views/erp/purchase/utils/candidate-focus';
import type { InableItem } from '#/api/erp/purchase/order';
import type { Key } from 'ant-design-vue/es/table/interface';

import { computed, onBeforeUnmount, ref, watch } from 'vue';


import {
  Button,
  Input,
  Modal,
  Pagination,
  Select,
  Table,
  TreeSelect,
  message,
} from 'ant-design-vue';

import {
  getInableItemPage,
  getInableItemStockList,
} from '#/api/erp/purchase/order';
import { getPurchaseWarehouseSimpleList } from '#/api/erp/stock/warehouse';
import { getPurchaseDeptTree } from '#/views/erp/purchase/utils/dept';
import { isFormInputTarget } from '#/views/erp/purchase/utils/item-form';
import { formatPurchaseAmount, formatPurchaseDecimal } from '#/views/erp/purchase/utils/decimal';

import { parsePurchaseInQtyText } from '../order/modules/purchase-order-form-utils';

type InableRow = InableItem & {
  inQty?: string;
  stockLoading?: boolean;
  stockWarehouseId?: number;
};

const emit = defineEmits<{
  select: [rows: InableRow[]];
}>();

const PAGE_SIZE_OPTIONS = ['10', '20', '50', '100', '200'];
const DEFAULT_PAGE_SIZE = 20;
const PRODUCT_KEYWORD_PLACEHOLDER = '请输入配件编码、名称、拼音码、五笔码等';

const visible = ref(false);
const loading = ref(false);
const submitting = ref(false);
const orderId = ref<number>();
const productKeyword = ref('');
const rows = ref<InableRow[]>([]);
const selectedRowKeys = ref<Key[]>([]);
const selectedMap = ref(new Map<string, InableRow>());
const rowCache = ref(new Map<string, Partial<InableRow>>());
const warehouseOptions = ref<any[]>([]);
const deptOptions = ref<any[]>([]);
const pageState = ref({
  pageNo: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  total: 0,
});
let stockRequestSequence = 0;
const stockRequestTokenMap = new Map<string, number>();

const selectedCount = computed(() => selectedMap.value.size);

function resolveWarehouseDeptId(warehouseId?: number) {
  if (!warehouseId) {
    return undefined;
  }
  return warehouseOptions.value.find(
    (warehouse) => warehouse.id === warehouseId,
  )?.deptId;
}

function getRowKey(record: InableRow) {
  return String(record.orderItemId);
}

function getRowKeyText(record: InableRow) {
  return getRowKey(record);
}

function getDefaultInQty(item: InableItem) {
  return item.inableCount === null || item.inableCount === undefined
    ? undefined
    : String(item.inableCount);
}

function syncSelectedKeys() {
  selectedRowKeys.value = Array.from(selectedMap.value.keys());
}

function cacheRow(row: InableRow) {
  const key = getRowKeyText(row);
  const cached = {
    availableCount: row.availableCount,
    deptId: row.deptId,
    inQty: row.inQty,
    stockCount: row.stockCount,
    stockWarehouseId: row.stockWarehouseId,
    warehouseId: row.warehouseId,
  };
  rowCache.value.set(key, cached);
  if (selectedMap.value.has(key)) {
    selectedMap.value.set(key, { ...row });
  }
}

function cacheCurrentPageRows() {
  rows.value.forEach(cacheRow);
}

function mergeRowCache(item: InableItem): InableRow {
  const key = String(item.orderItemId);
  const cached = rowCache.value.get(key) ?? {};
  const warehouseId = cached.warehouseId ?? item.warehouseId;
  const cachedStockMatches = cached.stockWarehouseId === warehouseId;
  const itemStockMatches = item.warehouseId === warehouseId;
  return {
    ...item,
    availableCount: cachedStockMatches
      ? cached.availableCount
      : itemStockMatches
        ? item.availableCount
        : undefined,
    deptId: cached.deptId ?? item.deptId ?? resolveWarehouseDeptId(warehouseId),
    inQty: cached.inQty ?? getDefaultInQty(item),
    stockCount: cachedStockMatches
      ? cached.stockCount
      : itemStockMatches
        ? item.stockCount
        : undefined,
    stockWarehouseId: cachedStockMatches
      ? cached.stockWarehouseId
      : itemStockMatches
        ? item.warehouseId
        : warehouseId,
    warehouseId,
  };
}

function getStockRequestKey(record: InableRow) {
  return String(record.orderItemId);
}

async function refreshStockForRows(
  targetRows: InableRow[],
  notifyOnError = true,
) {
  if (!orderId.value) {
    return;
  }
  const queryRows = targetRows.filter(
    (row) => row.orderItemId && row.warehouseId,
  );
  if (queryRows.length === 0) {
    return;
  }
  const requestToken = ++stockRequestSequence;
  queryRows.forEach((row) => {
    stockRequestTokenMap.set(getStockRequestKey(row), requestToken);
    row.stockLoading = true;
  });
  try {
    const result = await getInableItemStockList({
      orderId: orderId.value,
      items: queryRows.map((row) => ({
        orderItemId: row.orderItemId!,
        warehouseId: row.warehouseId!,
      })),
    });
    const resultMap = new Map(
      (result ?? []).map((item) => [
        `${item.orderItemId}_${item.warehouseId}`,
        item,
      ]),
    );
    queryRows.forEach((row) => {
      const key = getStockRequestKey(row);
      if (stockRequestTokenMap.get(key) !== requestToken) {
        return;
      }
      const warehouseId = row.warehouseId;
      const stock = resultMap.get(`${row.orderItemId}_${warehouseId}`);
      if (!stock || stock.warehouseId !== warehouseId) {
        return;
      }
      row.stockCount = stock.stockCount;
      row.availableCount = stock.availableCount;
      row.stockWarehouseId = warehouseId;
      cacheRow(row);
    });
  } catch {
    queryRows.forEach((row) => {
      const key = getStockRequestKey(row);
      if (stockRequestTokenMap.get(key) !== requestToken) {
        return;
      }
      row.stockCount = undefined;
      row.availableCount = undefined;
      row.stockWarehouseId = row.warehouseId;
      cacheRow(row);
    });
    if (notifyOnError) {
      message.warning('实时库存刷新失败，请稍后重试');
    }
  } finally {
    queryRows.forEach((row) => {
      if (stockRequestTokenMap.get(getStockRequestKey(row)) === requestToken) {
        row.stockLoading = false;
      }
    });
  }
}

async function loadData(pageNo = pageState.value.pageNo) {
  if (!orderId.value) {
    return;
  }
  cacheCurrentPageRows();
  loading.value = true;
  try {
    const pageResult = await getInableItemPage({
      orderId: orderId.value,
      pageNo,
      pageSize: pageState.value.pageSize,
      productKeyword: productKeyword.value.trim() || undefined,
    });
    rows.value = (pageResult.list ?? []).map(mergeRowCache);
    pageState.value = {
      ...pageState.value,
      pageNo,
      total: pageResult.total ?? 0,
    };
    syncSelectedKeys();
    if (pageNo === 1 && rows.value.length === 0) {
      message.warning('该采购订单已全部生成采购入库单');
    }
  } finally {
    loading.value = false;
  }
}

async function open(id: number) {
  orderId.value = id;
  visible.value = true;
  loading.value = true;
  rows.value = [];
  selectedRowKeys.value = [];
  selectedMap.value = new Map();
  rowCache.value = new Map();
  stockRequestTokenMap.clear();
  productKeyword.value = '';
  pageState.value = {
    pageNo: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    total: 0,
  };
  try {
    [warehouseOptions.value, deptOptions.value] = await Promise.all([
      getPurchaseWarehouseSimpleList(),
      getPurchaseDeptTree(),
    ]);
    await loadData(1);
  } finally {
    loading.value = false;
  }
}

function close() {
  visible.value = false;
}

async function handleRefresh() {
  await loadData(pageState.value.pageNo);
  await refreshStockForRows(rows.value);
}

function setSubmitting(value: boolean) {
  submitting.value = value;
}

function handleSelectionChange(keys: Key[]) {
  cacheCurrentPageRows();
  const keySet = new Set(keys.map(String));
  rows.value.forEach((row) => {
    const key = getRowKeyText(row);
    if (keySet.has(key)) {
      selectedMap.value.set(key, { ...row });
    } else {
      selectedMap.value.delete(key);
    }
  });
  syncSelectedKeys();
}

function isInteractiveTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return false;
  }
  return Boolean(
    target.closest(
      [
        '.ant-checkbox-wrapper',
        '.ant-checkbox',
        '.ant-input',
        '.ant-select',
        '.ant-select-selector',
        'a',
        'button',
        'input',
      ].join(','),
    ),
  );
}

function toggleRowSelection(record: InableRow) {
  cacheRow(record);
  const rowKey = getRowKeyText(record);
  if (selectedMap.value.has(rowKey)) {
    selectedMap.value.delete(rowKey);
  } else {
    selectedMap.value.set(rowKey, { ...record });
  }
  syncSelectedKeys();
}

function getRowProps(record: InableRow) {
  return {
    onClick: (event: MouseEvent) => {
      if (isInteractiveTarget(event.target)) {
        return;
      }
      toggleRowSelection(record);
    },
  };
}

async function handleSearch() {
  await loadData(1);
}

async function handlePageChange(pageNo: number, pageSize: number) {
  pageState.value.pageSize = pageSize;
  await loadData(pageNo);
}

async function handleWarehouseChange(record: InableRow) {
  record.deptId = resolveWarehouseDeptId(record.warehouseId);
  record.stockCount = undefined;
  record.availableCount = undefined;
  record.stockWarehouseId = record.warehouseId;
  cacheRow(record);
  await refreshStockForRows([record]);
}

function handleRowInputChange(record: InableRow) {
  cacheRow(record);
}

function handleInQtyBlur(record: InableRow) {
  const parsed = parsePurchaseInQtyText(record.inQty, {
    max: record.inableCount,
  });
  if (parsed.ok) {
    record.inQty = formatPurchaseDecimal(parsed.value);
    cacheRow(record);
  }
}

function getSelectedRows() {
  cacheCurrentPageRows();
  return Array.from(selectedMap.value.values());
}

function validateSelectedRows(selectedRows: InableRow[]) {
  if (selectedRows.length === 0) {
    message.warning('请至少勾选一项');
    return false;
  }
  for (const item of selectedRows) {
    const parsedInQty = parsePurchaseInQtyText(item.inQty, {
      max: item.inableCount,
    });
    if (!parsedInQty.ok) {
      message.warning(`商品[${item.productName}]${parsedInQty.message}`);
      return false;
    }
    if (!item.warehouseId) {
      message.warning(`商品[${item.productName}]请选择仓库`);
      return false;
    }
  }
  return true;
}

function handleConfirm() {
  const selectedRows = getSelectedRows();
  if (!validateSelectedRows(selectedRows)) {
    return;
  }
  emit('select', selectedRows);
}

function handleWindowKeydown(event: KeyboardEvent) {
  if (!visible.value || event.key !== 'Enter' || event.defaultPrevented) {
    return;
  }
  if (isFormInputTarget(event.target)) {
    return;
  }
  event.preventDefault();
  handleConfirm();
}

const columns = [
  { title: '产品名称', dataIndex: 'productName', width: 160 },
  { title: '产品编码', dataIndex: 'productCode', width: 120 },
  { title: '单位', dataIndex: 'productUnitName', width: 60 },
  { title: '仓库', dataIndex: 'warehouseId', width: 160, key: 'warehouseId' },
  { title: '所属部门', dataIndex: 'deptId', width: 170, key: 'deptId' },
  { title: '库存', dataIndex: 'stockCount', width: 90, key: 'stockCount' },
  {
    title: '可用库存',
    dataIndex: 'availableCount',
    width: 100,
    key: 'availableCount',
  },
  { title: '单价', dataIndex: 'productPrice', width: 100, key: 'productPrice' },
  { title: '订单数量', dataIndex: 'orderCount', width: 100, key: 'orderCount' },
  { title: '已入库', dataIndex: 'inCount', width: 90, key: 'inCount' },
  { title: '可入库', dataIndex: 'inableCount', width: 90, key: 'inableCount' },
  { title: '本次入库', dataIndex: 'inQty', width: 120, key: 'inQty' },
  { title: '赠品', dataIndex: 'gift', width: 60, key: 'gift' },
];

function formatStockValue(value?: number) {
  return value === null || value === undefined
    ? '--'
    : formatPurchaseDecimal(value);
}

watch(visible, (open) => {
  if (open) {
    window.addEventListener('keydown', handleWindowKeydown);
  } else {
    window.removeEventListener('keydown', handleWindowKeydown);
  }
});

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleWindowKeydown);
});

defineExpose({ close, open, setSubmitting });
</script>

<template>
  <Modal
    v-model:open="visible"
    class="!w-[85vw]"
    title="选择可入库明细"
    :confirm-loading="loading || submitting"
    :ok-text="`确定（已选 ${selectedCount} 条）`"
    @ok="handleConfirm"
  >
    <div class="mb-3 flex items-center gap-2">
      <Input.Search
        v-model:value="productKeyword"
        :placeholder="PRODUCT_KEYWORD_PLACEHOLDER"
        allow-clear
        class="max-w-[360px]"
        @search="handleSearch"
      />
      <Button :loading="loading" @click="handleRefresh">刷新</Button>
    </div>
    <Table
      :columns="columns"
      :custom-row="getRowProps"
      :data-source="rows"
      :loading="loading"
      :pagination="false"
      :scroll="{ x: 'max-content', y: 'calc(70vh - 170px)' }"
      :row-key="getRowKey"
      :row-selection="{
        selectedRowKeys,
        onChange: handleSelectionChange,
        preserveSelectedRowKeys: true,
      }"
      size="small"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'productPrice'">
          {{ formatPurchaseAmount(record.productPrice, '-') }}
        </template>
        <template v-else-if="column.key === 'orderCount'">
          {{ formatPurchaseDecimal(record.orderCount, '-') }}
        </template>
        <template v-else-if="column.key === 'inCount'">
          {{ formatPurchaseDecimal(record.inCount, '-') }}
        </template>
        <template v-else-if="column.key === 'inableCount'">
          {{ formatPurchaseDecimal(record.inableCount, '-') }}
        </template>
        <template v-else-if="column.key === 'inQty'">
          <Input
            v-model:value="record.inQty"
            size="small"
            class="w-full"
            inputmode="decimal"
            autocomplete="off"
            @change="handleRowInputChange(record)"
            @blur="handleInQtyBlur(record)"
          />
        </template>
        <template v-else-if="column.key === 'stockCount'">
          {{
            record.stockLoading
              ? '加载中...'
              : formatStockValue(record.stockCount)
          }}
        </template>
        <template v-else-if="column.key === 'availableCount'">
          {{
            record.stockLoading
              ? '加载中...'
              : formatStockValue(record.availableCount)
          }}
        </template>
        <template v-else-if="column.key === 'warehouseId'">
          <Select
            popup-class-name="erp-candidate-focus-popup"
            v-model:value="record.warehouseId"
            :options="warehouseOptions"
            :field-names="{ label: 'name', value: 'id' }"
            placeholder="选择仓库"
            size="small"
            show-search
            allow-clear
            class="w-full"
            @change="handleWarehouseChange(record)"
          />
        </template>
        <template v-else-if="column.key === 'deptId'">
          <TreeSelect
            popup-class-name="erp-candidate-focus-popup"
            v-model:value="record.deptId"
            :tree-data="deptOptions"
            :field-names="{ label: 'name', value: 'id', children: 'children' }"
            placeholder="选择所属部门"
            size="small"
            show-search
            allow-clear
            tree-default-expand-all
            class="w-full"
            @change="handleRowInputChange(record)"
          />
        </template>
        <template v-else-if="column.key === 'gift'">
          <span v-if="record.gift" class="text-orange-500">是</span>
          <span v-else>否</span>
        </template>
      </template>
    </Table>
    <div class="mt-3 flex justify-end">
      <Pagination
        v-model:current="pageState.pageNo"
        v-model:page-size="pageState.pageSize"
        :page-size-options="PAGE_SIZE_OPTIONS"
        :total="pageState.total"
        show-less-items
        show-size-changer
        size="small"
        @change="handlePageChange"
        @show-size-change="handlePageChange"
      />
    </div>
  </Modal>
</template>
