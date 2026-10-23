<script lang="ts" setup>
import type { ErpStockApi } from '#/api/erp/stock/stock';

import { ref } from 'vue';

import { getPurchaseStockPage } from '#/api/erp/stock/stock';
import {
  getPurchaseWarehouseOwnerDeptSimpleList,
  getPurchaseWarehouseSimpleList,
} from '#/api/erp/stock/warehouse';
import StockProductSelectModal from '#/views/erp/components/StockProductSelectModal.vue';

const props = withDefaults(
  defineProps<{
    deptId?: number;
    enablePurchaseOrderShortcuts?: boolean;
    hiddenFields?: string[];
  }>(),
  {
    deptId: undefined,
    enablePurchaseOrderShortcuts: false,
    hiddenFields: () => [],
  },
);

const emit = defineEmits<{
  success: [rows: ErpStockApi.Stock[]];
}>();

const selectModalRef = ref<InstanceType<typeof StockProductSelectModal>>();

function open() {
  return selectModalRef.value?.open();
}

function isOpen() {
  return selectModalRef.value?.isOpen?.() === true;
}

function handleSuccess(rows: ErpStockApi.Stock[]) {
  emit('success', rows);
}

defineExpose({ isOpen, open });
</script>

<template>
  <StockProductSelectModal
    ref="selectModalRef"
    candidate-focus-highlight
    biz-type="purchase"
    :dept-id="props.deptId"
    :enable-purchase-order-shortcuts="props.enablePurchaseOrderShortcuts"
    :dept-select-api="getPurchaseWarehouseOwnerDeptSimpleList"
    :hidden-fields="props.hiddenFields"
    source="stock"
    :stock-page-api="getPurchaseStockPage"
    :warehouse-select-api="getPurchaseWarehouseSimpleList"
    @success="handleSuccess"
  />
</template>
