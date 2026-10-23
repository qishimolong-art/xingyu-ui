<script lang="ts" setup>
import type { ErpPurchaseOrderApi } from '#/api/erp/purchase/order';

import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { updatePurchaseOrderRemark } from '#/api/erp/purchase/order';

const emit = defineEmits<{
  success: [remark: string];
}>();

const order = ref<ErpPurchaseOrderApi.PurchaseOrder>();
const remark = ref('');
const title = computed(() =>
  order.value?.no
    ? `修改采购订单备注（${order.value.no}）`
    : '修改采购订单备注',
);

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    if (!order.value?.id) {
      return;
    }
    modalApi.lock();
    try {
      await updatePurchaseOrderRemark({
        id: order.value.id,
        remark: remark.value,
      });
      const savedRemark = remark.value;
      await modalApi.close();
      emit('success', savedRemark);
      message.success('备注修改成功');
    } finally {
      modalApi.unlock();
    }
  },
  onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      order.value = undefined;
      remark.value = '';
      return;
    }
    order.value = modalApi.getData<ErpPurchaseOrderApi.PurchaseOrder>();
    remark.value = order.value?.remark ?? '';
  },
});
</script>

<template>
  <Modal :title="title" class="!w-[600px]">
    <div class="px-1 py-2">
      <a-textarea
        v-model:value="remark"
        :auto-size="{ minRows: 6, maxRows: 10 }"
        :maxlength="500"
        show-count
        placeholder="请输入备注，清空后保存可删除原备注"
      />
    </div>
  </Modal>
</template>
