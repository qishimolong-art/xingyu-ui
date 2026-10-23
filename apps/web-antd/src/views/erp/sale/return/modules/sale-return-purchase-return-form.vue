<script lang="ts" setup>
import type { Dayjs } from 'dayjs';

import type { ErpSaleReturnApi } from '#/api/erp/sale/return';

import { computed, ref, watch } from 'vue';

import { erpCountInputFormatter } from '@vben/utils';

import dayjs from 'dayjs';
import {
  Button,
  DatePicker,
  Input,
  InputNumber,
  message,
  Modal,
  Pagination,
  Table,
} from 'ant-design-vue';

import {
  createPurchaseReturnFromSaleReturn,
  getSaleReturnPurchaseReturnableItemPage,
} from '#/api/erp/sale/return';
import {
  formatSaleAmount,
  saleDecimalMultiply,
} from '../../utils/decimal';
import {
  getPurchaseReturnSupplierDeptSimpleList,
  getPurchaseReturnSupplierDeptSimplePage,
} from '#/api/erp/purchase/return';
import ErpLazyPageSelect from '#/views/erp/components/ErpLazyPageSelect.vue';
import SupplierLazySelect from '#/views/erp/purchase/components/SupplierLazySelect.vue';

type PurchaseReturnRow = ErpSaleReturnApi.SaleReturnPurchaseReturnableItem & {
  purchaseReturnCount?: number;
};

const visible = ref(false);
const loading = ref(false);
const submitting = ref(false);
const saleReturn = ref<ErpSaleReturnApi.SaleReturn>();
const rows = ref<PurchaseReturnRow[]>([]);
const selectedRowKeys = ref<number[]>([]);
const rowCache = ref<Record<number, PurchaseReturnRow>>({});
const productKeyword = ref('');
const pagination = ref({ pageNo: 1, pageSize: 20, total: 0 });
const headerForm = ref<{
  supplierId?: number;
  deptId?: number;
  returnTime?: Dayjs;
  remark?: string;
}>({
  returnTime: dayjs(),
});
let supplierDeptLoadSequence = 0;

watch(
  () => headerForm.value.supplierId,
  async (supplierId, previousSupplierId) => {
    if (supplierId === previousSupplierId) return;
    const sequence = ++supplierDeptLoadSequence;
    const selectedDeptId = headerForm.value.deptId;
    if (!supplierId) {
      headerForm.value.deptId = undefined;
      return;
    }
    if (!selectedDeptId) return;
    const departments = await getPurchaseReturnSupplierDeptSimpleList(
      Number(supplierId),
    );
    if (sequence !== supplierDeptLoadSequence) return;
    if (
      !departments.some((dept) => Number(dept.id) === Number(selectedDeptId))
    ) {
      headerForm.value.deptId = undefined;
      message.warning('当前部门不在该供应商可用部门范围内，已清空');
    }
  },
);

const selectedRows = computed(() =>
  selectedRowKeys.value
    .map((key) => rowCache.value[key])
    .filter((row): row is PurchaseReturnRow => Boolean(row)),
);

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

function buildRow(item: ErpSaleReturnApi.SaleReturnPurchaseReturnableItem) {
  const key = Number(item.sourceSaleReturnItemId);
  const cached = rowCache.value[key];
  return {
    ...item,
    ...cached,
    purchaseReturnCount:
      cached?.purchaseReturnCount ?? item.purchaseReturnableCount,
    productPrice: cached?.productPrice ?? item.productPrice,
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
    const page = await getSaleReturnPurchaseReturnableItemPage({
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

function validateRows() {
  if (!headerForm.value.supplierId) {
    throw new Error('请选择供应商');
  }
  if (!headerForm.value.deptId) {
    throw new Error('请选择采购退货主表部门');
  }
  if (selectedRows.value.length === 0) {
    throw new Error('请先勾选需要转采购退货的明细');
  }
  selectedRows.value.forEach((row, index) => {
    const line = index + 1;
    const count = Number(row.purchaseReturnCount || 0);
    if (count <= 0) {
      throw new Error(`第 ${line} 行：采购退货数量必须大于 0`);
    }
    if (count > Number(row.purchaseReturnableCount || 0)) {
      throw new Error(`第 ${line} 行：采购退货数量不能超过可转数量`);
    }
    if (Number(row.productPrice || 0) < 0) {
      throw new Error(`第 ${line} 行：单价不能小于 0`);
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
      error instanceof Error ? error.message : '请检查转采购退货明细',
    );
    return;
  }
  submitting.value = true;
  try {
    const result = await createPurchaseReturnFromSaleReturn({
      returnId: saleReturn.value!.id!,
      supplierId: headerForm.value.supplierId,
      deptId: headerForm.value.deptId,
      returnTime: headerForm.value.returnTime?.valueOf(),
      remark: headerForm.value.remark,
      items: selectedRows.value.map((row) => ({
        sourceSaleReturnItemId: row.sourceSaleReturnItemId,
        count: Number(row.purchaseReturnCount || 0),
        productPrice: Number(row.productPrice || 0),
        remark: row.remark,
      })),
    });
    message.success(`采购退货草稿生成成功：${formatNos(result?.nos)}`);
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
  headerForm.value = {
    returnTime: dayjs(),
  };
  await loadRows(1);
  selectedRowKeys.value = rows.value
    .filter((item) => Number(item.purchaseReturnableCount || 0) > 0)
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
    title="转采购退货"
    width="88%"
    :confirm-loading="submitting"
    @ok="handleSubmit"
  >
    <div class="sale-return-purchase-return-modal">
      <div class="sale-return-purchase-return-modal__header">
        <SupplierLazySelect
          popup-class-name="erp-candidate-focus-popup"
          v-model:value="headerForm.supplierId"
          placeholder="供应商"
        />
        <ErpLazyPageSelect
          popup-class-name="erp-candidate-focus-popup"
          v-model:value="headerForm.deptId"
          :api="getPurchaseReturnSupplierDeptSimplePage"
          :params="{ supplierId: headerForm.supplierId }"
          :should-fetch="(params) => Boolean(params.supplierId)"
          label-field="name"
          value-field="id"
          :page-size="10"
          allow-clear
          placeholder="采购退货主表部门"
        />
        <DatePicker
          v-model:value="headerForm.returnTime"
          show-time
          class="w-full"
          placeholder="退货时间"
        />
        <Input v-model:value="headerForm.remark" placeholder="备注" />
        <Input
          v-model:value="productKeyword"
          allow-clear
          placeholder="请输入配件编码、名称、拼音码、五笔码等"
          @press-enter="handleSearch"
        />
        <Button @click="handleSearch">搜索</Button>
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
          getCheckboxProps: (record: PurchaseReturnRow) => ({
            disabled: Number(record.purchaseReturnableCount || 0) <= 0,
          }),
        }"
        :scroll="{ x: 1260, y: 440 }"
      >
        <Table.Column title="产品" data-index="productName" :width="180" />
        <Table.Column title="编码" data-index="productCode" :width="120" />
        <Table.Column title="仓库" data-index="warehouseName" :width="150" />
        <Table.Column title="部门" data-index="deptName" :width="150" />
        <Table.Column title="原退货数" data-index="count" :width="96">
          <template #default="{ record }">
            {{ erpCountInputFormatter(record.count) }}
          </template>
        </Table.Column>
        <Table.Column
          title="已转采购退货"
          data-index="purchaseReturnedCount"
          :width="120"
        >
          <template #default="{ record }">
            {{ erpCountInputFormatter(record.purchaseReturnedCount) }}
          </template>
        </Table.Column>
        <Table.Column
          title="可转数量"
          data-index="purchaseReturnableCount"
          :width="96"
        >
          <template #default="{ record }">
            {{ erpCountInputFormatter(record.purchaseReturnableCount) }}
          </template>
        </Table.Column>
        <Table.Column
          title="采购退货数量"
          data-index="purchaseReturnCount"
          :width="130"
        >
          <template #default="{ record }">
            <InputNumber
              v-model:value="record.purchaseReturnCount"
              :min="0"
              :max="Number(record.purchaseReturnableCount || 0)"
              :precision="6"
              class="w-full"
            />
          </template>
        </Table.Column>
        <Table.Column title="单价" data-index="productPrice" :width="120">
          <template #default="{ record }">
            <InputNumber
              v-model:value="record.productPrice"
              :formatter="(value: number | string) => formatSaleAmount(value)"
              :min="0"
              :precision="6"
              class="w-full"
            />
          </template>
        </Table.Column>
        <Table.Column title="金额" data-index="totalPrice" :width="110">
          <template #default="{ record }">
            {{
              formatSaleAmount(
                saleDecimalMultiply(
                  record.purchaseReturnCount || 0,
                  record.productPrice || 0,
                ),
              )
            }}
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
.sale-return-purchase-return-modal {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sale-return-purchase-return-modal__header {
  display: grid;
  grid-template-columns: repeat(4, minmax(160px, 1fr)) minmax(220px, 1.5fr) auto;
  gap: 8px;
}

.sale-return-purchase-return-modal :deep(.ant-select),
.sale-return-purchase-return-modal :deep(.ant-input-number) {
  width: 100%;
}
</style>
