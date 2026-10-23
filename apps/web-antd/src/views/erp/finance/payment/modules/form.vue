<script lang="ts" setup>
import { financeSubtract } from '#/views/erp/finance/utils/finance-decimal';

import type { ErpFinancePaymentApi } from '#/api/erp/finance/payment';

import { computed, defineAsyncComponent, nextTick, ref } from 'vue';

import { useAccess } from '@vben/access';
import { useVbenModal } from '@vben/common-ui';
import { ErpBizType } from '@vben/constants';
import { $t } from '@vben/locales';

import { Button, message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { getAccountSimpleList } from '#/api/erp/finance/account';
import {
  createFinancePayment,
  getFinancePayment,
  updateFinancePayment,
} from '#/api/erp/finance/payment';
import { useFieldPermission } from '#/composables/useFieldPermission';
import FinanceDocumentRemarkForm from '#/views/erp/finance/components/FinanceDocumentRemarkForm.vue';
import { buildFinanceCopyDraft } from '#/views/erp/finance/utils/copy-draft';
import {
  buildFinanceDocumentDetailFormValues,
  buildFinanceDocumentFormSchema,
  hydrateFinanceDocumentFormSelectLabels,
} from '#/views/erp/finance/utils/document-form-ui';
import {
  attachFinanceInputEnterFocus,
  handleFinanceInputEnterFocus,
} from '#/views/erp/finance/utils/form-enter-focus';
import {
  normalizeOptionalNumberFields,
  toOptionalNumberValue,
} from '#/views/erp/finance/utils/text-number';
import DetailLinkInput from '#/views/erp/components/DetailLinkInput.vue';
import { replaceDetailFieldWithLinkSlot } from '#/views/erp/components/detail-link-schema';

import { useFormSchema } from '../data';
import ItemForm from './item-form.vue';

const SupplierDetail = defineAsyncComponent(
  () => import('#/views/erp/purchase/supplier/modules/detail.vue'),
);
const PurchaseInDetail = defineAsyncComponent(
  () => import('#/views/erp/purchase/in/modules/form.vue'),
);
const PurchaseReturnDetail = defineAsyncComponent(
  () => import('#/views/erp/purchase/return/modules/form.vue'),
);
const [SupplierDetailModal, supplierDetailModalApi] = useVbenModal({
  connectedComponent: SupplierDetail,
  destroyOnClose: true,
});
const [PurchaseInDetailModal, purchaseInDetailModalApi] = useVbenModal({
  connectedComponent: PurchaseInDetail,
  destroyOnClose: true,
});
const [PurchaseReturnDetailModal, purchaseReturnDetailModalApi] = useVbenModal({
  connectedComponent: PurchaseReturnDetail,
  destroyOnClose: true,
});

function handleOpenSupplierDetail() {
  if (!formData.value.supplierId) return;
  supplierDetailModalApi.setData({ id: formData.value.supplierId }).open();
}

function handleBizDetail(item: ErpFinancePaymentApi.FinancePaymentItem) {
  if (!item.bizId) return;
  const modalMap: Record<number, any> = {
    [ErpBizType.PURCHASE_IN]: purchaseInDetailModalApi,
    [ErpBizType.PURCHASE_RETURN]: purchaseReturnDetailModalApi,
  };
  modalMap[item.bizType]?.setData({ type: 'detail', id: item.bizId }).open();
}

const emit = defineEmits(['success', 'audit']);
const { hasAccessByCodes } = useAccess();
const formData = ref<
  ErpFinancePaymentApi.FinancePayment & {
    fileUrl?: string;
  }
>({
  id: undefined,
  no: '',
  supplierId: undefined,
  accountId: undefined,
  financeUserId: undefined,
  paymentTime: undefined,
  remark: '',
  fileUrl: undefined,
  totalPrice: undefined as any,
  discountPrice: undefined as any,
  paymentPrice: 0,
  items: [],
  status: 0,
});

const formType = ref(''); // 表单类型：'create' | 'edit' | 'detail'
const canOpenSupplierDetail = computed(() =>
  Boolean(formData.value?.supplierId && formData.value?.supplierName),
);
const itemFormRef = ref<InstanceType<typeof ItemForm>>();
const canEditRemark = computed(
  () =>
    formType.value === 'detail' &&
    Boolean(formData.value.id) &&
    hasAccessByCodes(['erp:finance-payment:update']),
);
const [RemarkModal, remarkModalApi] = useVbenModal({
  connectedComponent: FinanceDocumentRemarkForm,
  destroyOnClose: true,
});

function handleEditRemark() {
  remarkModalApi
    .setData({
      documentName: '付款单',
      documentType: 'finance-payment',
      id: formData.value.id,
      no: formData.value.no,
      remark: formData.value.remark,
    })
    .open();
}

async function handleRemarkSuccess(remark: string) {
  formData.value.remark = remark;
  await formApi.setValues({ remark }, false);
  emit('success');
}
const { hiddenFields, loadHiddenFields } = useFieldPermission(
  'erp_finance_payment',
);

const getTitle = computed(() => {
  if (formType.value === 'create') {
    return $t('ui.actionTitle.create', ['付款单']);
  } else if (formType.value === 'copy') {
    return $t('ui.actionTitle.create', ['付款单']);
  } else if (formType.value === 'edit') {
    return $t('ui.actionTitle.edit', ['付款单']);
  } else {
    return '付款单详情';
  }
});

async function applyFormMode(type: string) {
  formType.value = type;
  formApi.setDisabled(type === 'detail');
  formApi.setState({
    schema: replaceDetailFieldWithLinkSlot(
      attachFinanceInputEnterFocus(
        buildFinanceDocumentFormSchema(
          useFormSchema(type, hiddenFields.value),
          { data: formData.value, formType: type },
        ),
      ),
      type,
      'supplierId',
      'supplierDetail',
    ),
  });
  await nextTick();
}

const [Form, formApi] = useVbenForm({
  commonConfig: {
    componentProps: {
      class: 'w-full',
    },
    labelWidth: 120,
  },
  wrapperClass: 'grid-cols-3',
  layout: 'vertical',
  schema: attachFinanceInputEnterFocus(
    buildFinanceDocumentFormSchema(
      useFormSchema(formType.value, hiddenFields.value),
      { data: formData.value, formType: formType.value },
    ),
  ),
  showDefaultActions: false,
  handleValuesChange: (values, changedFields) => {
    if (formType.value === 'detail') {
      return;
    }
    if (formData.value) {
      if (changedFields.includes('supplierId')) {
        formData.value.supplierId = values.supplierId;
      }
      // 目的：同步到 item-form 组件，触发整体的价格计算
      if (
        changedFields.includes('discountPrice') ||
        changedFields.includes('totalPrice')
      ) {
        const discountPrice = toOptionalNumberValue(values.discountPrice) || 0;
        const totalPrice = toOptionalNumberValue(values.totalPrice) || 0;
        formData.value.discountPrice = discountPrice;
        formData.value.totalPrice = totalPrice;
        formData.value.paymentPrice = financeSubtract(
          totalPrice,
          discountPrice,
        );
        formApi.setValues({
          paymentPrice: formData.value.paymentPrice,
        });
      }
    }
  },
});

/** 更新付款项 */
function handleUpdateItems(items: ErpFinancePaymentApi.FinancePaymentItem[]) {
  formData.value.items = items;
  formApi.setValues({
    items,
  });
}

/** 更新总金额 */
function handleUpdateTotalPrice(totalPrice: number | string | null) {
  formData.value.totalPrice = totalPrice;
  formApi.setValues({
    totalPrice: formData.value.totalPrice,
  });
}

/** 更新付款金额 */
function handleUpdatePaymentPrice(paymentPrice: number | string | null) {
  formData.value.paymentPrice = paymentPrice;
  formApi.setValues({
    paymentPrice: formData.value.paymentPrice,
  });
}

/** 创建或更新付款单 */
const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) {
      return;
    }
    const itemFormInstance = Array.isArray(itemFormRef.value)
      ? itemFormRef.value[0]
      : itemFormRef.value;
    try {
      itemFormInstance.validate();
    } catch (error: any) {
      message.error(error.message || '子表单验证失败');
      return;
    }

    modalApi.lock();
    // 提交表单
    const data =
      (await formApi.getValues()) as ErpFinancePaymentApi.FinancePayment;
    normalizeOptionalNumberFields(data as any, [
      'discountPrice',
      'paymentPrice',
      'totalPrice',
    ]);
    try {
      await (formType.value === 'create'
        ? createFinancePayment(data)
        : updateFinancePayment(data));
      // 关闭并提示
      await modalApi.close();
      emit('success');
      message.success($t('ui.actionMessage.operationSuccess'));
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      formData.value = {} as ErpFinancePaymentApi.FinancePayment;
      return;
    }
    // 加载数据
    const data = modalApi.getData<{ id?: number; type: string }>();
    await loadHiddenFields();
    await applyFormMode(data.type === 'copy' ? 'create' : data.type);
    if (!data || !data.id) {
      // 新增时，默认选中账户
      const accountList = await getAccountSimpleList();
      const defaultAccount = accountList.find((item) => item.defaultStatus);
      if (defaultAccount) {
        await formApi.setValues({ accountId: defaultAccount.id });
      }
      return;
    }
    modalApi.lock();
    try {
      const detail = await getFinancePayment(data.id);
      formData.value = await hydrateFinanceDocumentFormSelectLabels(
        data.type === 'copy' ? buildFinanceCopyDraft(detail) : detail,
      );
      await applyFormMode(formType.value);
      // 设置到 values
      await formApi.setValues(
        buildFinanceDocumentDetailFormValues(formData.value, formType.value),
        false,
      );
    } finally {
      modalApi.unlock();
    }
  },
});
</script>

<template>
  <Modal
    :title="getTitle"
    class="w-3/4"
    :show-confirm-button="formType !== 'detail'"
  >
    <template #prepend-footer>
      <Button v-if="canEditRemark" type="primary" @click="handleEditRemark">
        修改备注
      </Button>
      <Button
        v-if="formType === 'detail' && formData?.id && formData?.status !== 20"
        type="primary"
        @click="emit('audit', formData)"
      >
        审核
      </Button>
    </template>
    <Form class="mx-3" @keydown.enter.capture="handleFinanceInputEnterFocus">
      <template #supplierDetail>
        <DetailLinkInput
          :navigable="canOpenSupplierDetail"
          :value="formData?.supplierName"
          @open="handleOpenSupplierDetail"
        />
      </template>
      <template #items>
        <ItemForm
          ref="itemFormRef"
          :items="formData?.items ?? []"
          :supplier-id="formData?.supplierId"
          :disabled="formType === 'detail'"
          :discount-price="formData?.discountPrice ?? 0"
          :hidden-fields="hiddenFields"
          @update:items="handleUpdateItems"
          @update:total-price="handleUpdateTotalPrice"
          @update:payment-price="handleUpdatePaymentPrice"
          @detail="handleBizDetail"
          class="w-full"
        />
      </template>
    </Form>
  </Modal>
  <RemarkModal @success="handleRemarkSuccess" />
  <SupplierDetailModal />
  <PurchaseInDetailModal />
  <PurchaseReturnDetailModal />
</template>

<style scoped>
:deep(.flex-auto.overflow-hidden:has(> .relative > .erp-detail-link-field)) {
  overflow: visible;
}
</style>
