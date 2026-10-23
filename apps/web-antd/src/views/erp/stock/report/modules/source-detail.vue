<script setup lang="ts">
import { nextTick, ref } from 'vue';

import { useAccess } from '@vben/access';
import { useVbenModal } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import AssemblyOrderForm from '#/views/erp/assembly/order/modules/form.vue';
import PurchaseInForm from '#/views/erp/purchase/in/modules/form.vue';
import PurchaseAdjustForm from '#/views/erp/purchase/priceadjust/modules/form.vue';
import PurchaseReturnForm from '#/views/erp/purchase/return/modules/form.vue';
import SaleOutForm from '#/views/erp/sale/out/modules/form.vue';
import SaleAdjustForm from '#/views/erp/sale/priceadjust/modules/form.vue';
import SaleReturnForm from '#/views/erp/sale/return/modules/form.vue';
import StockCheckForm from '#/views/erp/stock/check/modules/form.vue';
import StockInForm from '#/views/erp/stock/in/modules/form.vue';
import StockMoveForm from '#/views/erp/stock/move/modules/form.vue';
import StockOutForm from '#/views/erp/stock/out/modules/form.vue';
import WarehouseMoveForm from '#/views/erp/stock/warehouse-move/modules/form.vue';

import { sourceTargets } from '../report-v2-ui';

const { hasAccessByCodes } = useAccess();
const selectedKey = ref('');
const [StockIn, stockIn] = useVbenModal({
  connectedComponent: StockInForm,
  destroyOnClose: true,
});
const [StockOut, stockOut] = useVbenModal({
  connectedComponent: StockOutForm,
  destroyOnClose: true,
});
const [StockMove, stockMove] = useVbenModal({
  connectedComponent: StockMoveForm,
  destroyOnClose: true,
});
const [WarehouseMove, warehouseMove] = useVbenModal({
  connectedComponent: WarehouseMoveForm,
  destroyOnClose: true,
});
const [StockCheck, stockCheck] = useVbenModal({
  connectedComponent: StockCheckForm,
  destroyOnClose: true,
});
const [SaleOut, saleOut] = useVbenModal({
  connectedComponent: SaleOutForm,
  destroyOnClose: true,
});
const [SaleReturn, saleReturn] = useVbenModal({
  connectedComponent: SaleReturnForm,
  destroyOnClose: true,
});
const [PurchaseIn, purchaseIn] = useVbenModal({
  connectedComponent: PurchaseInForm,
  destroyOnClose: true,
});
const [PurchaseReturn, purchaseReturn] = useVbenModal({
  connectedComponent: PurchaseReturnForm,
  destroyOnClose: true,
});
const [PurchaseAdjust, purchaseAdjust] = useVbenModal({
  connectedComponent: PurchaseAdjustForm,
  destroyOnClose: true,
});
const [SaleAdjust, saleAdjust] = useVbenModal({
  connectedComponent: SaleAdjustForm,
  destroyOnClose: true,
});
const [AssemblyOrder, assemblyOrder] = useVbenModal({
  connectedComponent: AssemblyOrderForm,
  destroyOnClose: true,
});
const targets: Record<string, typeof stockIn> = {
  stockIn,
  stockOut,
  stockMove,
  warehouseMove,
  stockCheck,
  saleOut,
  saleReturn,
  purchaseIn,
  purchaseReturn,
  purchaseAdjust,
  saleAdjust,
  assemblyOrder,
};
async function open(bizType?: number, bizId?: number) {
  const target = bizType === undefined ? undefined : sourceTargets[bizType];
  if (!target || !bizId || !hasAccessByCodes([target.permission])) {
    message.warning('缺少来源单据查询权限或该业务类型暂不支持下钻');
    return;
  }
  selectedKey.value = target.key;
  await nextTick();
  if (hasAccessByCodes([target.permission]))
    targets[target.key]?.setData({ type: 'detail', id: bizId }).open();
}
defineExpose({ open });
</script>
<template>
  <StockIn v-if="selectedKey === 'stockIn'" /><StockOut
    v-if="selectedKey === 'stockOut'"
  />
  <StockMove v-if="selectedKey === 'stockMove'" /><WarehouseMove
    v-if="selectedKey === 'warehouseMove'"
  />
  <StockCheck v-if="selectedKey === 'stockCheck'" /><SaleOut
    v-if="selectedKey === 'saleOut'"
  />
  <SaleReturn v-if="selectedKey === 'saleReturn'" /><PurchaseIn
    v-if="selectedKey === 'purchaseIn'"
  />
  <PurchaseReturn v-if="selectedKey === 'purchaseReturn'" /><PurchaseAdjust
    v-if="selectedKey === 'purchaseAdjust'"
  />
  <SaleAdjust v-if="selectedKey === 'saleAdjust'" />
  <AssemblyOrder v-if="selectedKey === 'assemblyOrder'" />
</template>
