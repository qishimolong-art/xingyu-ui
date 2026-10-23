<script lang="ts" setup>
import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { updatePurchaseInRemark } from '#/api/erp/purchase/in';
import { updatePurchaseInvoiceRemark } from '#/api/erp/purchase/invoice';
import { updatePurchasePriceAdjustRemark } from '#/api/erp/purchase/priceadjust';
import { updatePurchaseReturnRemark } from '#/api/erp/purchase/return';

type PurchaseDocumentType =
  | 'purchase-in'
  | 'purchase-invoice'
  | 'purchase-price-adjust'
  | 'purchase-return';

interface RemarkModalData {
  documentName: string;
  documentType: PurchaseDocumentType;
  id: number;
  no?: string;
  remark?: string;
}

const emit = defineEmits<{
  success: [remark: string];
}>();

const document = ref<RemarkModalData>();
const remark = ref('');
const title = computed(() => {
  const documentName = document.value?.documentName ?? '采购单据';
  return document.value?.no
    ? `修改${documentName}备注（${document.value.no}）`
    : `修改${documentName}备注`;
});

const updateHandlers: Record<
  PurchaseDocumentType,
  (data: { id: number; remark: string }) => Promise<unknown>
> = {
  'purchase-in': updatePurchaseInRemark,
  'purchase-invoice': updatePurchaseInvoiceRemark,
  'purchase-price-adjust': updatePurchasePriceAdjustRemark,
  'purchase-return': updatePurchaseReturnRemark,
};

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    if (!document.value?.id) {
      return;
    }
    modalApi.lock();
    try {
      await updateHandlers[document.value.documentType]({
        id: document.value.id,
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
      document.value = undefined;
      remark.value = '';
      return;
    }
    document.value = modalApi.getData<RemarkModalData>();
    remark.value = document.value?.remark ?? '';
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
