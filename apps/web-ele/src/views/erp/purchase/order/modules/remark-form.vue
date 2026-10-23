<script lang="ts" setup>
import type { ErpPurchaseOrderApi } from '#/api/erp/purchase/order';

import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { ElMessage } from 'element-plus';

import { updatePurchaseOrderRemark } from '#/api/erp/purchase/order';
import { $t } from '#/locales';

const emit = defineEmits(['success']);
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
      await modalApi.close();
      emit('success');
      ElMessage.success($t('ui.actionMessage.operationSuccess'));
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
  <Modal :title="title" class="w-[600px]">
    <div class="mx-4">
      <ElInput
        v-model="remark"
        type="textarea"
        :rows="6"
        maxlength="500"
        show-word-limit
        placeholder="请输入备注，清空后保存可删除原备注"
      />
    </div>
  </Modal>
</template>
