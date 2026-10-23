<script lang="ts" setup>
import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { updateSaleCartRemark } from '#/api/erp/sale/cart';
import { updateSaleOrderRemark } from '#/api/erp/sale/order';
import { updateSaleOutRemark } from '#/api/erp/sale/out';
import { updateSalePriceAdjustRemark } from '#/api/erp/sale/priceadjust';
import { updateSaleQuoteRemark } from '#/api/erp/sale/quote';
import { updateSaleReturnRemark } from '#/api/erp/sale/return';

type SaleDocumentType =
  | 'sale-cart'
  | 'sale-order'
  | 'sale-out'
  | 'sale-price-adjust'
  | 'sale-quote'
  | 'sale-return';

interface RemarkModalData {
  documentName: string;
  documentType: SaleDocumentType;
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
  const documentName = document.value?.documentName ?? '销售单据';
  return document.value?.no
    ? `修改${documentName}备注（${document.value.no}）`
    : `修改${documentName}备注`;
});

const updateHandlers: Record<
  SaleDocumentType,
  (data: { id: number; remark: string }) => Promise<unknown>
> = {
  'sale-cart': updateSaleCartRemark,
  'sale-order': updateSaleOrderRemark,
  'sale-out': updateSaleOutRemark,
  'sale-price-adjust': updateSalePriceAdjustRemark,
  'sale-quote': updateSaleQuoteRemark,
  'sale-return': updateSaleReturnRemark,
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
