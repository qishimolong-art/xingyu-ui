<script lang="ts" setup>
import type { ErpStockApi } from '#/api/erp/stock/stock';

import { computed, ref } from 'vue';

import { useAccess } from '@vben/access';

import { getSaleStockPage } from '#/api/erp/stock/stock';
import {
  getSaleWarehouseOwnerDeptSimplePage,
  getSaleWarehouseSimplePage,
} from '#/api/erp/stock/warehouse';
import StockProductSelectModal from '#/views/erp/components/StockProductSelectModal.vue';

const props = withDefaults(
  defineProps<{
    candidateFocusHighlight?: boolean;
    enableSaleStockShortcuts?: boolean;
    customerPriceLevel?: number;
    hiddenFields?: string[];
    allSaleProductPermission?: string;
    saleDeptId?: number;
    showBatchNo?: boolean;
  }>(),
  {
    candidateFocusHighlight: false,
    allSaleProductPermission: undefined,
    enableSaleStockShortcuts: false,
    customerPriceLevel: undefined,
    hiddenFields: () => [],
    saleDeptId: undefined,
    showBatchNo: false,
  },
);

const emit = defineEmits<{
  success: [rows: ErpStockApi.Stock[]];
}>();

const selectModalRef = ref<InstanceType<typeof StockProductSelectModal>>();
const { hasAccessByCodes } = useAccess();
const hasAllSaleProductPermission = computed(
  () =>
    !!props.allSaleProductPermission &&
    hasAccessByCodes([props.allSaleProductPermission]),
);

const getAllSaleProductParams = () =>
  hasAllSaleProductPermission.value
    ? {
        allSaleProduct: true,
        allSaleProductPermission: props.allSaleProductPermission,
      }
    : {};

function open() {
  return selectModalRef.value?.open();
}

function isShortcutDialogOpen() {
  return selectModalRef.value?.isShortcutDialogOpen?.() === true;
}

function isOpen() {
  return selectModalRef.value?.isOpen?.() === true;
}

function openShortcutHistory(
  mode: 'history' | 'order',
  row: ErpStockApi.Stock,
) {
  return selectModalRef.value?.openShortcutHistory?.(mode, row);
}

function handleSuccess(rows: ErpStockApi.Stock[]) {
  emit('success', rows);
}

const getSaleWarehouseSelectApi = (params?: Record<string, any>) =>
  getSaleWarehouseSimplePage({
    ...getAllSaleProductParams(),
    ...params,
    deptId: props.saleDeptId,
  });

const getSaleOwnerDeptSelectApi = (params?: Record<string, any>) =>
  props.saleDeptId
    ? getSaleWarehouseOwnerDeptSimplePage({
        ...getAllSaleProductParams(),
        ...params,
        deptId: props.saleDeptId,
      })
    : Promise.resolve({ list: [], total: 0 });

defineExpose({ isOpen, isShortcutDialogOpen, open, openShortcutHistory });
</script>

<template>
  <StockProductSelectModal
    ref="selectModalRef"
    :candidate-focus-highlight="props.candidateFocusHighlight"
    :all-sale-product="hasAllSaleProductPermission"
    :all-sale-product-permission="props.allSaleProductPermission"
    biz-type="sale"
    source="stock"
    :customer-price-level="props.customerPriceLevel"
    :dept-id="props.saleDeptId"
    :enable-sale-stock-shortcuts="props.enableSaleStockShortcuts"
    :dept-select-api="getSaleOwnerDeptSelectApi"
    :hidden-fields="props.hiddenFields"
    :sale-dept-id="props.saleDeptId"
    :show-batch-no="props.showBatchNo"
    :stock-page-api="getSaleStockPage"
    :warehouse-select-api="getSaleWarehouseSelectApi"
    @success="handleSuccess"
  />
</template>
