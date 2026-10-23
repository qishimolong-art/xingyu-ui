<script lang="ts" setup>
import type { ErpSaleReturnApi } from '#/api/erp/sale/return';
import type { ErpWarehouseApi } from '#/api/erp/stock/warehouse';

import { computed, ref } from 'vue';

import { erpCountInputFormatter } from '@vben/utils';

import {
  Button,
  Input,
  InputNumber,
  message,
  Modal,
  Pagination,
  Table,
} from 'ant-design-vue';

import {
  createTransferOutFromSaleReturn,
  getSaleReturnTransferOutableItemPage,
} from '#/api/erp/sale/return';
import {
  getStockTransferOutFromDeptSimplePage,
  getStockTransferOutToDeptSimplePage,
} from '#/api/erp/stock/transfer-out';
import {
  getStockMoveFromWarehouseSimplePage,
  getWarehouseSimplePage,
} from '#/api/erp/stock/warehouse';
import ErpLazyPageSelect from '#/views/erp/components/ErpLazyPageSelect.vue';

type TransferOutRow = ErpSaleReturnApi.SaleReturnTransferOutableItem & {
  transferCount?: number;
  toWarehouseId?: number;
  toDeptId?: number;
};

const visible = ref(false);
const loading = ref(false);
const submitting = ref(false);
const saleReturn = ref<ErpSaleReturnApi.SaleReturn>();
const rows = ref<TransferOutRow[]>([]);
const selectedRowKeys = ref<number[]>([]);
const fromWarehouseOptions = ref<ErpWarehouseApi.Warehouse[]>([]);
const toWarehouseOptions = ref<ErpWarehouseApi.Warehouse[]>([]);
const deptOptions = ref<any[]>([]);
const rowCache = ref<Record<number, TransferOutRow>>({});
const productKeyword = ref('');
const pagination = ref({ pageNo: 1, pageSize: 20, total: 0 });
const batchForm = ref<{
  fromDeptId?: number;
  fromWarehouseId?: number;
  toDeptId?: number;
  toWarehouseId?: number;
}>({});

const selectedRows = computed(() =>
  selectedRowKeys.value
    .map((key) => rowCache.value[key])
    .filter((row): row is TransferOutRow => Boolean(row)),
);

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

function getOptionsSignature(options: any[]) {
  return (options || [])
    .map((item) =>
      JSON.stringify({
        id: item?.id ?? item?.value ?? '',
        name: item?.name ?? item?.label ?? '',
      }),
    )
    .join('|');
}

function handleFromWarehouseOptionsChange(options: any[]) {
  const nextOptions = mergeOptionsById(fromWarehouseOptions.value, options);
  if (
    getOptionsSignature(nextOptions) !==
    getOptionsSignature(fromWarehouseOptions.value)
  ) {
    fromWarehouseOptions.value = nextOptions;
  }
}

function handleToWarehouseOptionsChange(options: any[]) {
  const nextOptions = mergeOptionsById(toWarehouseOptions.value, options);
  if (
    getOptionsSignature(nextOptions) !==
    getOptionsSignature(toWarehouseOptions.value)
  ) {
    toWarehouseOptions.value = nextOptions;
  }
}

function handleDeptOptionsChange(options: any[]) {
  const nextOptions = mergeOptionsById(deptOptions.value, options);
  if (
    getOptionsSignature(nextOptions) !== getOptionsSignature(deptOptions.value)
  ) {
    deptOptions.value = nextOptions;
  }
}

function getCurrentDeptOption(deptId?: number, deptName?: string) {
  if (!deptId) {
    return [];
  }
  const existed = deptOptions.value.find(
    (dept) => String(dept.id) === String(deptId),
  );
  return existed ? [existed] : [{ id: deptId, name: deptName || deptId }];
}

function getCurrentWarehouseOption(
  options: ErpWarehouseApi.Warehouse[],
  warehouseId?: number,
  warehouseName?: string,
  deptId?: number,
  deptName?: string,
) {
  if (!warehouseId) {
    return [];
  }
  const existed = options.find(
    (warehouse) => String(warehouse.id) === String(warehouseId),
  );
  return existed
    ? [existed]
    : [
        {
          id: warehouseId,
          name: warehouseName || warehouseId,
          deptId,
          deptName,
        },
      ];
}

function getCurrentFromWarehouseOption(row: TransferOutRow) {
  return getCurrentWarehouseOption(
    fromWarehouseOptions.value,
    row.fromWarehouseId,
    row.fromWarehouseName,
    row.fromDeptId,
    row.fromDeptName,
  );
}

function getCurrentToWarehouseOption(row: TransferOutRow) {
  return getCurrentWarehouseOption(
    toWarehouseOptions.value,
    row.toWarehouseId,
    undefined,
    row.toDeptId,
    undefined,
  );
}

function syncCurrentRowsToCache() {
  const nextCache = { ...rowCache.value };
  rows.value.forEach((row) => {
    const key = Number(row.sourceSaleReturnItemId);
    if (key) {
      nextCache[key] = row;
    }
  });
  rowCache.value = nextCache;
}

function buildRow(item: ErpSaleReturnApi.SaleReturnTransferOutableItem) {
  const key = Number(item.sourceSaleReturnItemId);
  const cached = rowCache.value[key];
  return {
    ...item,
    ...cached,
    transferCount: cached?.transferCount ?? item.transferOutableCount,
    fromDeptId: cached?.fromDeptId ?? item.fromDeptId,
    fromWarehouseId: cached?.fromWarehouseId ?? item.fromWarehouseId,
    remark: cached?.remark ?? item.remark,
  };
}

async function loadRows(pageNo = pagination.value.pageNo) {
  if (!saleReturn.value?.id) {
    return;
  }
  syncCurrentRowsToCache();
  loading.value = true;
  try {
    const page = await getSaleReturnTransferOutableItemPage({
      returnId: saleReturn.value.id,
      productKeyword: productKeyword.value || undefined,
      pageNo,
      pageSize: pagination.value.pageSize,
    });
    rows.value = (page?.list || []).map(buildRow);
    rows.value.forEach((row) => {
      const key = Number(row.sourceSaleReturnItemId);
      if (key) {
        rowCache.value[key] = row;
      }
    });
    pagination.value = {
      ...pagination.value,
      pageNo,
      total: Number(page?.total || 0),
    };
  } finally {
    loading.value = false;
  }
}

function getWarehouseDeptId(warehouseId?: number) {
  return [...fromWarehouseOptions.value, ...toWarehouseOptions.value].find(
    (item) => item.id === warehouseId,
  )?.deptId;
}

function getWarehouseName(warehouseId?: number) {
  return [...fromWarehouseOptions.value, ...toWarehouseOptions.value].find(
    (item) => item.id === warehouseId,
  )?.name;
}

function handleFromDeptChange(row: TransferOutRow) {
  if (
    row.fromWarehouseId &&
    getWarehouseDeptId(row.fromWarehouseId) !== row.fromDeptId
  ) {
    row.fromWarehouseId = undefined;
  }
}

function handleToDeptChange(row: TransferOutRow) {
  if (
    row.toWarehouseId &&
    getWarehouseDeptId(row.toWarehouseId) !== row.toDeptId
  ) {
    row.toWarehouseId = undefined;
  }
}

function handleFromWarehouseChange(row: TransferOutRow) {
  row.fromDeptId = getWarehouseDeptId(row.fromWarehouseId);
  row.fromWarehouseName = getWarehouseName(row.fromWarehouseId);
}

function handleToWarehouseChange(row: TransferOutRow) {
  row.toDeptId = getWarehouseDeptId(row.toWarehouseId);
}

function applyBatchValues() {
  if (selectedRows.value.length === 0) {
    message.warning('请先勾选需要转调拨的明细');
    return;
  }
  for (const row of selectedRows.value) {
    if (batchForm.value.fromDeptId !== undefined) {
      row.fromDeptId = batchForm.value.fromDeptId;
      handleFromDeptChange(row);
    }
    if (batchForm.value.fromWarehouseId !== undefined) {
      row.fromWarehouseId = batchForm.value.fromWarehouseId;
      handleFromWarehouseChange(row);
    }
    if (batchForm.value.toDeptId !== undefined) {
      row.toDeptId = batchForm.value.toDeptId;
      handleToDeptChange(row);
    }
    if (batchForm.value.toWarehouseId !== undefined) {
      row.toWarehouseId = batchForm.value.toWarehouseId;
      handleToWarehouseChange(row);
    }
  }
}

function validateRows() {
  if (selectedRows.value.length === 0) {
    throw new Error('请先勾选需要转调拨的明细');
  }
  selectedRows.value.forEach((row, index) => {
    const line = index + 1;
    const count = Number(row.transferCount || 0);
    if (!row.fromDeptId || !row.fromWarehouseId) {
      throw new Error(`第 ${line} 行：调出部门和调出仓库不能为空`);
    }
    if (!row.toDeptId || !row.toWarehouseId) {
      throw new Error(`第 ${line} 行：调入部门和调入仓库不能为空`);
    }
    if (row.fromWarehouseId === row.toWarehouseId) {
      throw new Error(`第 ${line} 行：调出仓库和调入仓库不能相同`);
    }
    if (count <= 0) {
      throw new Error(`第 ${line} 行：转调拨数量必须大于 0`);
    }
    if (count > Number(row.transferOutableCount || 0)) {
      throw new Error(`第 ${line} 行：转调拨数量不能超过可转数量`);
    }
  });
}

function formatNos(nos?: string[]) {
  return nos?.filter(Boolean).join('，') || '-';
}

async function handleSubmit() {
  syncCurrentRowsToCache();
  try {
    validateRows();
  } catch (error) {
    message.warning(
      error instanceof Error ? error.message : '请检查转调拨明细',
    );
    return;
  }
  submitting.value = true;
  try {
    const result = await createTransferOutFromSaleReturn({
      returnId: saleReturn.value!.id!,
      items: selectedRows.value.map((row) => ({
        sourceSaleReturnItemId: row.sourceSaleReturnItemId,
        count: Number(row.transferCount || 0),
        fromWarehouseId: row.fromWarehouseId,
        fromDeptId: row.fromDeptId,
        toWarehouseId: row.toWarehouseId,
        toDeptId: row.toDeptId,
        remark: row.remark,
      })),
    });
    message.success(`调拨出库草稿生成成功：${formatNos(result?.nos)}`);
    visible.value = false;
  } finally {
    submitting.value = false;
  }
}

async function open(data: { sourceSaleReturn: ErpSaleReturnApi.SaleReturn }) {
  if (!data.sourceSaleReturn?.id) {
    return;
  }
  saleReturn.value = data.sourceSaleReturn;
  visible.value = true;
  selectedRowKeys.value = [];
  rowCache.value = {};
  rows.value = [];
  productKeyword.value = '';
  pagination.value = { pageNo: 1, pageSize: 20, total: 0 };
  batchForm.value = {};
  await loadRows(1);
  selectedRowKeys.value = rows.value
    .filter((item) => Number(item.transferOutableCount || 0) > 0)
    .map((item) => Number(item.sourceSaleReturnItemId));
}

function handleRowSelectionChange(keys: Array<number | string | symbol>) {
  syncCurrentRowsToCache();
  selectedRowKeys.value = keys.map((key) => Number(key));
}

function handleSearch() {
  void loadRows(1);
}

function handlePageChange(pageNo: number, pageSize: number) {
  pagination.value.pageSize = pageSize;
  void loadRows(pageNo);
}

defineExpose({ open });
</script>

<template>
  <Modal
    v-model:open="visible"
    title="转调拨"
    width="92%"
    :confirm-loading="submitting"
    @ok="handleSubmit"
  >
    <div class="sale-return-transfer-modal">
      <div class="sale-return-transfer-modal__toolbar">
        <Input
          v-model:value="productKeyword"
          allow-clear
          placeholder="请输入配件编码、名称、拼音码、五笔码等"
          @press-enter="handleSearch"
        />
        <ErpLazyPageSelect
          popup-class-name="erp-candidate-focus-popup"
          v-model:value="batchForm.fromDeptId"
          :api="getStockTransferOutFromDeptSimplePage"
          label-field="name"
          value-field="id"
          :page-size="10"
          allow-clear
          placeholder="批量调出部门"
          @options-change="handleDeptOptionsChange"
        />
        <ErpLazyPageSelect
          popup-class-name="erp-candidate-focus-popup"
          v-model:value="batchForm.fromWarehouseId"
          :api="getStockMoveFromWarehouseSimplePage"
          :params="{ deptId: batchForm.fromDeptId }"
          :options="
            getCurrentWarehouseOption(
              fromWarehouseOptions,
              batchForm.fromWarehouseId,
            )
          "
          label-field="name"
          value-field="id"
          :page-size="10"
          allow-clear
          placeholder="批量调出仓库"
          @options-change="handleFromWarehouseOptionsChange"
        />
        <ErpLazyPageSelect
          popup-class-name="erp-candidate-focus-popup"
          v-model:value="batchForm.toDeptId"
          :api="getStockTransferOutToDeptSimplePage"
          label-field="name"
          value-field="id"
          :page-size="10"
          allow-clear
          placeholder="批量调入部门"
          @options-change="handleDeptOptionsChange"
        />
        <ErpLazyPageSelect
          popup-class-name="erp-candidate-focus-popup"
          v-model:value="batchForm.toWarehouseId"
          :api="getWarehouseSimplePage"
          :params="{ deptId: batchForm.toDeptId }"
          :options="
            getCurrentWarehouseOption(
              toWarehouseOptions,
              batchForm.toWarehouseId,
            )
          "
          label-field="name"
          value-field="id"
          :page-size="10"
          allow-clear
          placeholder="批量调入仓库"
          @options-change="handleToWarehouseOptionsChange"
        />
        <Button @click="handleSearch">搜索</Button>
        <Button type="primary" @click="applyBatchValues">应用到已选</Button>
      </div>
      <Table
        row-key="sourceSaleReturnItemId"
        size="small"
        :loading="loading"
        :data-source="rows"
        :pagination="false"
        :row-selection="{
          selectedRowKeys,
          onChange: handleRowSelectionChange,
          getCheckboxProps: (record: TransferOutRow) => ({
            disabled: Number(record.transferOutableCount || 0) <= 0,
          }),
        }"
        :scroll="{ x: 1560, y: 440 }"
      >
        <Table.Column title="产品" data-index="productName" :width="180" />
        <Table.Column title="编码" data-index="productCode" :width="120" />
        <Table.Column title="原退货数" data-index="count" :width="96">
          <template #default="{ record }">
            {{ erpCountInputFormatter(record.count) }}
          </template>
        </Table.Column>
        <Table.Column
          title="已转调拨"
          data-index="transferredCount"
          :width="96"
        >
          <template #default="{ record }">
            {{ erpCountInputFormatter(record.transferredCount) }}
          </template>
        </Table.Column>
        <Table.Column
          title="可转数量"
          data-index="transferOutableCount"
          :width="96"
        >
          <template #default="{ record }">
            {{ erpCountInputFormatter(record.transferOutableCount) }}
          </template>
        </Table.Column>
        <Table.Column title="调出部门" data-index="fromDeptId" :width="190">
          <template #default="{ record }">
            <ErpLazyPageSelect
              popup-class-name="erp-candidate-focus-popup"
              v-model:value="record.fromDeptId"
              :api="getStockTransferOutFromDeptSimplePage"
              :options="
                getCurrentDeptOption(record.fromDeptId, record.fromDeptName)
              "
              label-field="name"
              value-field="id"
              :page-size="10"
              allow-clear
              @change="handleFromDeptChange(record)"
              @options-change="handleDeptOptionsChange"
            />
          </template>
        </Table.Column>
        <Table.Column
          title="调出仓库"
          data-index="fromWarehouseId"
          :width="180"
        >
          <template #default="{ record }">
            <ErpLazyPageSelect
              popup-class-name="erp-candidate-focus-popup"
              v-model:value="record.fromWarehouseId"
              :api="getStockMoveFromWarehouseSimplePage"
              :params="{ deptId: record.fromDeptId }"
              :options="getCurrentFromWarehouseOption(record)"
              label-field="name"
              value-field="id"
              :page-size="10"
              @change="handleFromWarehouseChange(record)"
              @options-change="handleFromWarehouseOptionsChange"
            />
          </template>
        </Table.Column>
        <Table.Column title="调入部门" data-index="toDeptId" :width="190">
          <template #default="{ record }">
            <ErpLazyPageSelect
              popup-class-name="erp-candidate-focus-popup"
              v-model:value="record.toDeptId"
              :api="getStockTransferOutToDeptSimplePage"
              :options="getCurrentDeptOption(record.toDeptId)"
              label-field="name"
              value-field="id"
              :page-size="10"
              allow-clear
              @change="handleToDeptChange(record)"
              @options-change="handleDeptOptionsChange"
            />
          </template>
        </Table.Column>
        <Table.Column title="调入仓库" data-index="toWarehouseId" :width="180">
          <template #default="{ record }">
            <ErpLazyPageSelect
              popup-class-name="erp-candidate-focus-popup"
              v-model:value="record.toWarehouseId"
              :api="getWarehouseSimplePage"
              :params="{ deptId: record.toDeptId }"
              :options="getCurrentToWarehouseOption(record)"
              label-field="name"
              value-field="id"
              :page-size="10"
              @change="handleToWarehouseChange(record)"
              @options-change="handleToWarehouseOptionsChange"
            />
          </template>
        </Table.Column>
        <Table.Column
          title="转调拨数量"
          data-index="transferCount"
          :width="120"
        >
          <template #default="{ record }">
            <InputNumber
              v-model:value="record.transferCount"
              :min="0"
              :max="Number(record.transferOutableCount || 0)"
              :precision="6"
              class="w-full"
            />
          </template>
        </Table.Column>
        <Table.Column title="备注" data-index="remark" :width="180">
          <template #default="{ record }">
            <Input v-model:value="record.remark" />
          </template>
        </Table.Column>
      </Table>
      <Pagination
        :current="pagination.pageNo"
        :page-size="pagination.pageSize"
        :page-size-options="['20', '50', '100']"
        :show-size-changer="true"
        :show-total="(total) => `共 ${total} 条可转明细`"
        :total="pagination.total"
        size="small"
        @change="handlePageChange"
        @show-size-change="handlePageChange"
      />
    </div>
  </Modal>
</template>

<style scoped>
.sale-return-transfer-modal {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sale-return-transfer-modal__toolbar {
  display: grid;
  grid-template-columns:
    minmax(220px, 1.5fr) repeat(4, minmax(150px, 1fr))
    auto auto;
  gap: 8px;
  align-items: center;
}

.sale-return-transfer-modal :deep(.ant-select),
.sale-return-transfer-modal :deep(.ant-input-number) {
  width: 100%;
}
</style>
