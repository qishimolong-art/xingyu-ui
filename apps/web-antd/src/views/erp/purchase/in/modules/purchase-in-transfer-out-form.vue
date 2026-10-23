<script lang="ts" setup>
import '#/views/erp/purchase/utils/candidate-focus';
import type { ErpPurchaseInApi } from '#/api/erp/purchase/in';
import type { Key } from 'ant-design-vue/es/table/interface';

import { onBeforeUnmount, ref, watch } from 'vue';

import { formatPurchaseAmount, formatPurchaseDecimal } from '#/views/erp/purchase/utils/decimal';

import {
  Descriptions,
  DescriptionsItem,
  Button,
  DatePicker,
  Input,
  InputNumber,
  Modal,
  Pagination,
  Table,
  message,
} from 'ant-design-vue';

import {
  createTransferOutFromPurchaseIn,
  getPurchaseIn,
  getPurchaseInTransferOutableItemPage,
} from '#/api/erp/purchase/in';
import { getStockTransferOutToDeptSimplePage } from '#/api/erp/stock/transfer-out';
import { getStockWarehouseFilterOptionPage } from '#/api/erp/stock/warehouse';
import ErpLazyPageSelect from '#/views/erp/components/ErpLazyPageSelect.vue';
import { isFormInputTarget } from '#/views/erp/purchase/utils/item-form';

import { formatPurchaseInCountInput } from './purchase-in-count-input';
import { getTransferOutSuccessMessage } from './purchase-in-transfer-out';

const emit = defineEmits(['success']);
const PAGE_SIZE_OPTIONS = ['10', '20', '50', '100', '200'];
const DEFAULT_PAGE_SIZE = 20;
const PRODUCT_KEYWORD_PLACEHOLDER = '请输入配件编码、名称、拼音码、五笔码等';

type TransferOutRow = ErpPurchaseInApi.TransferOutableItem & {
  count?: number;
  toWarehouseId?: number;
  remark?: string;
};

const visible = ref(false);
const loading = ref(false);
const sourcePurchaseIn = ref<ErpPurchaseInApi.PurchaseIn>();
const rows = ref<TransferOutRow[]>([]);
const selectedRowKeys = ref<Key[]>([]);
const selectedMap = ref(new Map<string, TransferOutRow>());
const deselectedRowKeys = ref(new Set<string>());
const rowCache = ref(new Map<string, Partial<TransferOutRow>>());
const warehouseOptions = ref<any[]>([]);
const deptOptions = ref<any[]>([]);
const toDeptId = ref<number>();
const toWarehouseId = ref<number>();
const moveTime = ref<string>(String(Date.now()));
const remark = ref('');
const productKeyword = ref('');
const pageState = ref({
  pageNo: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  total: 0,
});

function getRowKey(record: TransferOutRow) {
  return String(record.sourceInItemId);
}

function getRowKeyText(record: TransferOutRow) {
  return getRowKey(record);
}

function syncSelectedKeys() {
  selectedRowKeys.value = Array.from(selectedMap.value.keys());
}

function getWarehouseDeptId(warehouseId?: number) {
  return warehouseOptions.value.find((item) => item.id === warehouseId)?.deptId;
}

function mergeOptionsById(oldOptions: any[], nextOptions: any[]) {
  const map = new Map<string, any>();
  (oldOptions || []).forEach(
    (item) => item?.id && map.set(String(item.id), item),
  );
  (nextOptions || []).forEach(
    (item) => item?.id && map.set(String(item.id), item),
  );
  return Array.from(map.values());
}

function handleWarehouseOptionsChange(options: any[]) {
  warehouseOptions.value = mergeOptionsById(warehouseOptions.value, options);
}

function getCurrentWarehouseOption(warehouseId?: number) {
  if (!warehouseId) {
    return [];
  }
  const existed = warehouseOptions.value.find(
    (warehouse) => String(warehouse.id) === String(warehouseId),
  );
  return existed ? [existed] : [{ id: warehouseId, name: warehouseId }];
}

function applyToWarehouseToRows(warehouseId?: number, option?: any) {
  toDeptId.value =
    option?.deptId ?? getWarehouseDeptId(warehouseId) ?? toDeptId.value;
  rows.value.forEach((row) => {
    row.toWarehouseId = warehouseId;
    cacheRow(row);
  });
  selectedMap.value.forEach((row, key) => {
    row.toWarehouseId = warehouseId;
    selectedMap.value.set(key, { ...row });
  });
}

function normalizeWarehouseId(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const warehouseId = Number(value);
  return Number.isFinite(warehouseId) ? warehouseId : undefined;
}

function handleMainWarehouseChange(value: unknown, option?: any) {
  const warehouseId = normalizeWarehouseId(value);
  toWarehouseId.value = warehouseId;
  const selected = Array.isArray(option) ? option[0] : option;
  applyToWarehouseToRows(warehouseId, selected);
}

function handleRowWarehouseChange(
  row: TransferOutRow,
  _value?: unknown,
  option?: any,
) {
  const selected = Array.isArray(option) ? option[0] : option;
  const deptId = selected?.deptId ?? getWarehouseDeptId(row.toWarehouseId);
  if (deptId) {
    toDeptId.value = deptId;
  }
  cacheRow(row);
}

function getSelectedRows() {
  cacheCurrentPageRows();
  return Array.from(selectedMap.value.values());
}

function handleSelectionChange(keys: Key[]) {
  cacheCurrentPageRows();
  const keySet = new Set(keys.map(String));
  rows.value.forEach((row) => {
    const key = getRowKeyText(row);
    if (keySet.has(key)) {
      selectedMap.value.set(key, { ...row });
      deselectedRowKeys.value.delete(key);
    } else {
      selectedMap.value.delete(key);
      deselectedRowKeys.value.add(key);
    }
  });
  syncSelectedKeys();
}

function normalizeCount(value: unknown) {
  const count = Number(value);
  return Number.isFinite(count) ? count : 0;
}

function cacheRow(row: TransferOutRow) {
  const key = getRowKeyText(row);
  const cached = {
    count: row.count,
    remark: row.remark,
    toWarehouseId: row.toWarehouseId,
  };
  rowCache.value.set(key, cached);
  if (selectedMap.value.has(key)) {
    selectedMap.value.set(key, { ...row });
  }
}

function cacheCurrentPageRows() {
  rows.value.forEach(cacheRow);
}

function mergeRowCache(
  item: ErpPurchaseInApi.TransferOutableItem,
): TransferOutRow {
  const key = String(item.sourceInItemId);
  const cached = rowCache.value.get(key) ?? {};
  return {
    ...item,
    count: cached.count ?? item.transferOutableCount,
    remark: cached.remark ?? item.remark,
    toWarehouseId: cached.toWarehouseId ?? toWarehouseId.value,
  };
}

async function loadTransferOutableItemPage(pageNo = pageState.value.pageNo) {
  const sourceId = sourcePurchaseIn.value?.id;
  if (!sourceId) {
    return;
  }
  cacheCurrentPageRows();
  loading.value = true;
  try {
    const pageResult = await getPurchaseInTransferOutableItemPage({
      inId: sourceId,
      pageNo,
      pageSize: pageState.value.pageSize,
      productKeyword: productKeyword.value.trim() || undefined,
    });
    rows.value = (pageResult.list ?? []).map(mergeRowCache);
    rows.value.forEach((row) => {
      const key = getRowKeyText(row);
      if (!selectedMap.value.has(key) && !deselectedRowKeys.value.has(key)) {
        selectedMap.value.set(key, { ...row });
      }
    });
    pageState.value = {
      ...pageState.value,
      pageNo,
      total: pageResult.total ?? 0,
    };
    syncSelectedKeys();
    if (pageNo === 1 && rows.value.length === 0) {
      message.warning('当前采购入库单无可调拨明细');
    }
  } finally {
    loading.value = false;
  }
}

async function handleSearch() {
  await loadTransferOutableItemPage(1);
}

async function handlePageChange(pageNo: number, pageSize: number) {
  pageState.value.pageSize = pageSize;
  await loadTransferOutableItemPage(pageNo);
}

async function handleConfirm() {
  if (!sourcePurchaseIn.value?.id) {
    message.warning('来源采购入库单不能为空');
    return;
  }
  const selectedRows = getSelectedRows();
  if (selectedRows.length === 0) {
    message.warning('请至少勾选一项调拨明细');
    return;
  }
  for (const row of selectedRows) {
    const count = normalizeCount(row.count);
    const available = normalizeCount(row.transferOutableCount);
    if (!row.toWarehouseId) {
      message.warning(
        `商品[${row.productName || row.productCode}]请选择调入仓库`,
      );
      return;
    }
    if (row.fromWarehouseId === row.toWarehouseId) {
      message.warning(
        `商品[${row.productName || row.productCode}]调入仓库不能与调出仓库相同`,
      );
      return;
    }
    if (count <= 0) {
      message.warning(
        `商品[${row.productName || row.productCode}]本次调拨数量必须大于 0`,
      );
      return;
    }
    if (count > available) {
      message.warning(
        `商品[${row.productName || row.productCode}]本次调拨数量不能超过可调拨数量`,
      );
      return;
    }
  }
  loading.value = true;
  try {
    const result = await createTransferOutFromPurchaseIn({
      sourceInId: sourcePurchaseIn.value.id,
      moveTime: moveTime.value,
      toDeptId: toDeptId.value,
      toWarehouseId: toWarehouseId.value,
      remark: remark.value,
      items: selectedRows.map((row) => ({
        sourceInItemId: row.sourceInItemId!,
        toWarehouseId: row.toWarehouseId,
        count: normalizeCount(row.count),
        remark: row.remark,
      })),
    });
    message.success(getTransferOutSuccessMessage(result));
    visible.value = false;
    emit('success');
  } finally {
    loading.value = false;
  }
}

async function open(params: { sourcePurchaseIn: ErpPurchaseInApi.PurchaseIn }) {
  visible.value = true;
  loading.value = true;
  rows.value = [];
  selectedRowKeys.value = [];
  selectedMap.value = new Map();
  deselectedRowKeys.value = new Set();
  rowCache.value = new Map();
  toDeptId.value = undefined;
  toWarehouseId.value = undefined;
  moveTime.value = String(Date.now());
  productKeyword.value = '';
  pageState.value = {
    pageNo: 1,
    pageSize: DEFAULT_PAGE_SIZE,
    total: 0,
  };
  try {
    const sourceId = params.sourcePurchaseIn.id;
    sourcePurchaseIn.value = sourceId
      ? await getPurchaseIn(sourceId, { includeItems: false })
      : params.sourcePurchaseIn;
    remark.value = sourcePurchaseIn.value?.no
      ? `由采购入库单 ${sourcePurchaseIn.value.no} 生成`
      : '由采购入库单生成';
    await loadTransferOutableItemPage(1);
  } finally {
    loading.value = false;
  }
}

function handleWindowKeydown(event: KeyboardEvent) {
  if (!visible.value || event.key !== 'Enter' || event.defaultPrevented) {
    return;
  }
  if (isFormInputTarget(event.target)) {
    return;
  }
  event.preventDefault();
  void handleConfirm();
}

const columns = [
  { title: '产品名称', dataIndex: 'productName', width: 180 },
  { title: '来源入库单', dataIndex: 'sourceInNo', width: 150 },
  { title: '产品编码', dataIndex: 'productCode', width: 120 },
  { title: '单位', dataIndex: 'productUnitName', width: 70 },
  { title: '调出仓库', dataIndex: 'fromWarehouseName', width: 150 },
  { title: '调出部门', dataIndex: 'fromWarehouseDeptName', width: 130 },
  {
    title: '调入仓库',
    dataIndex: 'toWarehouseId',
    width: 170,
    key: 'toWarehouseId',
  },
  { title: '入库数量', dataIndex: 'inCount', width: 100, key: 'inCount' },
  { title: '已调拨', dataIndex: 'movedCount', width: 100, key: 'movedCount' },
  {
    title: '可调拨',
    dataIndex: 'transferOutableCount',
    width: 100,
    key: 'transferOutableCount',
  },
  { title: '本次调拨', dataIndex: 'count', width: 130, key: 'count' },
  { title: '单价', dataIndex: 'productPrice', width: 100, key: 'productPrice' },
  { title: '批次号', dataIndex: 'batchNo', width: 120 },
  { title: '货架位', dataIndex: 'warehousePosition', width: 110 },
  { title: '备注', dataIndex: 'remark', width: 180, key: 'remark' },
];

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

defineExpose({ open });
</script>

<template>
  <Modal
    v-model:open="visible"
    class="!w-[85vw]"
    title="由采购入库生成调拨出库单"
    :confirm-loading="loading"
    ok-text="生成调拨出库单"
    @ok="handleConfirm"
  >
    <Descriptions size="small" bordered :column="4" class="mb-3">
      <DescriptionsItem label="入库单号">
        {{ sourcePurchaseIn?.no || '-' }}
      </DescriptionsItem>
      <DescriptionsItem label="供应商">
        {{ sourcePurchaseIn?.supplierName || '-' }}
      </DescriptionsItem>
      <DescriptionsItem label="所属部门">
        {{ sourcePurchaseIn?.deptName || '-' }}
      </DescriptionsItem>
      <DescriptionsItem label="入库时间">
        {{ sourcePurchaseIn?.inTime || '-' }}
      </DescriptionsItem>
    </Descriptions>

    <div class="mb-3 grid grid-cols-4 gap-3">
      <div>
        <div class="mb-1 text-sm text-muted-foreground">调拨日期</div>
        <DatePicker
          v-model:value="moveTime"
          value-format="x"
          format="YYYY-MM-DD HH:mm:ss"
          show-time
          class="w-full"
        />
      </div>
      <div>
        <div class="mb-1 text-sm text-muted-foreground">调入部门</div>
        <ErpLazyPageSelect
          popup-class-name="erp-candidate-focus-popup"
          v-model:value="toDeptId"
          :api="getStockTransferOutToDeptSimplePage"
          :options="deptOptions"
          label-field="name"
          value-field="id"
          :page-size="10"
          placeholder="选择调入部门"
          allow-clear
          class="w-full"
        />
      </div>
      <div>
        <div class="mb-1 text-sm text-muted-foreground">统一调入仓库</div>
        <ErpLazyPageSelect
          popup-class-name="erp-candidate-focus-popup"
          v-model:value="toWarehouseId"
          :api="getStockWarehouseFilterOptionPage"
          :options="getCurrentWarehouseOption(toWarehouseId)"
          label-field="displayName"
          value-field="id"
          :page-size="10"
          placeholder="选择调入仓库"
          allow-clear
          class="w-full"
          @change="handleMainWarehouseChange"
          @options-change="handleWarehouseOptionsChange"
        />
      </div>
      <div>
        <div class="mb-1 text-sm text-muted-foreground">备注</div>
        <Input v-model:value="remark" class="w-full" />
      </div>
    </div>

    <div class="mb-3 flex items-center gap-2">
      <Input.Search
        v-model:value="productKeyword"
        :placeholder="PRODUCT_KEYWORD_PLACEHOLDER"
        allow-clear
        class="max-w-[360px]"
        @search="handleSearch"
      />
      <Button
        :loading="loading"
        @click="loadTransferOutableItemPage(pageState.pageNo)"
      >
        刷新
      </Button>
    </div>

    <Table
      :columns="columns"
      :data-source="rows"
      :loading="loading"
      :pagination="false"
      :scroll="{ x: 'max-content', y: 'calc(70vh - 260px)' }"
      :row-key="getRowKey"
      :row-selection="{
        selectedRowKeys,
        onChange: handleSelectionChange,
        preserveSelectedRowKeys: true,
      }"
      size="small"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'toWarehouseId'">
          <ErpLazyPageSelect
            popup-class-name="erp-candidate-focus-popup"
            v-model:value="record.toWarehouseId"
            :api="getStockWarehouseFilterOptionPage"
            :options="getCurrentWarehouseOption(record.toWarehouseId)"
            label-field="displayName"
            value-field="id"
            :page-size="10"
            placeholder="选择调入仓库"
            size="small"
            allow-clear
            class="w-full"
            @change="
              (value, option) => handleRowWarehouseChange(record, value, option)
            "
            @options-change="handleWarehouseOptionsChange"
          />
        </template>
        <template v-else-if="column.key === 'inCount'">
          {{ formatPurchaseDecimal(record.inCount) }}
        </template>
        <template v-else-if="column.key === 'movedCount'">
          {{ formatPurchaseDecimal(record.movedCount) }}
        </template>
        <template v-else-if="column.key === 'transferOutableCount'">
          {{ formatPurchaseDecimal(record.transferOutableCount) }}
        </template>
        <template v-else-if="column.key === 'count'">
          <InputNumber
            v-model:value="record.count"
            :min="0"
            :max="record.transferOutableCount"
            :precision="6"
            :formatter="formatPurchaseInCountInput"
            size="small"
            class="w-full"
            @change="cacheRow(record)"
          />
        </template>
        <template v-else-if="column.key === 'productPrice'">
          {{ formatPurchaseAmount(record.productPrice, '-') }}
        </template>
        <template v-else-if="column.key === 'remark'">
          <Input
            v-model:value="record.remark"
            size="small"
            class="w-full"
            @change="cacheRow(record)"
          />
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
