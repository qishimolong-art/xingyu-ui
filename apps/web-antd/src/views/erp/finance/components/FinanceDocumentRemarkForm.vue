<script lang="ts" setup>
import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { updatePayableExpenseRemark } from '#/api/erp/finance/payable/expense';
import { updatePayableOtherRemark } from '#/api/erp/finance/payable/other';
import { updateFinancePaymentRemark } from '#/api/erp/finance/payment';
import { updateFinanceReceiptRemark } from '#/api/erp/finance/receipt';
import { updateOtherIncomeRemark } from '#/api/erp/finance/receivable/other-income';
import { updateOtherReceivableRemark } from '#/api/erp/finance/receivable/other-receivable';
import { updateFinanceTransferRemark } from '#/api/erp/finance/transfer';

export type FinanceDocumentType =
  | 'finance-payment'
  | 'finance-receipt'
  | 'finance-transfer'
  | 'other-income'
  | 'other-receivable'
  | 'payable-expense'
  | 'payable-other';

interface RemarkModalData {
  documentName: string;
  documentType: FinanceDocumentType;
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
  const documentName = document.value?.documentName ?? '资金单据';
  return document.value?.no
    ? `修改${documentName}备注（${document.value.no}）`
    : `修改${documentName}备注`;
});

const updateHandlers: Record<
  FinanceDocumentType,
  (data: { id: number; remark: string }) => Promise<unknown>
> = {
  'finance-payment': updateFinancePaymentRemark,
  'finance-receipt': updateFinanceReceiptRemark,
  'finance-transfer': updateFinanceTransferRemark,
  'other-income': updateOtherIncomeRemark,
  'other-receivable': updateOtherReceivableRemark,
  'payable-expense': updatePayableExpenseRemark,
  'payable-other': updatePayableOtherRemark,
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
