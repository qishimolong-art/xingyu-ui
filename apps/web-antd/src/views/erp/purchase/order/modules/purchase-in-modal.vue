<script lang="ts" setup>
import type { InableItem } from '#/api/erp/purchase/order';

import { ref } from 'vue';

import { message } from 'ant-design-vue';

import { createPurchaseInFromOrder } from '#/api/erp/purchase/in';
import PurchaseOrderInableItemSelectModal from '#/views/erp/purchase/components/PurchaseOrderInableItemSelectModal.vue';

import { parsePurchaseInQtyText } from './purchase-order-form-utils';

const emit = defineEmits(['success']);

const orderId = ref<number>();
const selectModalRef =
  ref<InstanceType<typeof PurchaseOrderInableItemSelectModal>>();

function open(id: number) {
  orderId.value = id;
  selectModalRef.value?.open(id);
}

async function handleSelect(rows: InableItem[]) {
  if (!orderId.value) {
    return;
  }
  const submitItems: {
    count: number;
    item: InableItem & { inQty?: string };
  }[] = [];
  for (const item of rows) {
    const parsedInQty = parsePurchaseInQtyText((item as any).inQty, {
      max: item.inableCount,
    });
    if (!parsedInQty.ok) {
      message.warning(`商品[${item.productName}]${parsedInQty.message}`);
      return;
    }
    if (!item.warehouseId) {
      message.warning(`商品[${item.productName}]请选择仓库`);
      return;
    }
    submitItems.push({ count: parsedInQty.value, item });
  }
  selectModalRef.value?.setSubmitting(true);
  try {
    await createPurchaseInFromOrder({
      orderId: orderId.value,
      items: submitItems.map(({ count, item }) => ({
        orderItemId: item.orderItemId!,
        count,
        warehouseId: item.warehouseId!,
        deptId: item.deptId,
      })),
    });
    message.success('入库成功');
    selectModalRef.value?.close();
    emit('success');
  } finally {
    selectModalRef.value?.setSubmitting(false);
  }
}

defineExpose({ open });
</script>

<template>
  <PurchaseOrderInableItemSelectModal
    ref="selectModalRef"
    @select="handleSelect"
  />
</template>
