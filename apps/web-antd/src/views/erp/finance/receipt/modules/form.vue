<script lang="ts" setup>import { financeSubtract } from '#/views/erp/finance/utils/finance-decimal';

import type { ErpFinanceReceiptApi } from '#/api/erp/finance/receipt';

import { computed, defineAsyncComponent, nextTick, ref } from 'vue';

import { useAccess } from '@vben/access';
import { useVbenModal } from '@vben/common-ui';
import { ErpBizType } from '@vben/constants';
import { $t } from '@vben/locales';

import { Button, message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { getAccountSimpleList } from '#/api/erp/finance/account';
import {
  createFinanceReceipt,
  getFinanceReceipt,
  updateFinanceReceipt,
} from '#/api/erp/finance/receipt';
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

const CustomerDetail = defineAsyncComponent(
  () => import('#/views/erp/sale/customer/modules/detail.vue'),
);
const SaleOutDetail = defineAsyncComponent(
  () => import('#/views/erp/sale/out/modules/form.vue'),
);
const SaleReturnDetail = defineAsyncComponent(
  () => import('#/views/erp/sale/return/modules/form.vue'),
);
const [CustomerDetailModal, customerDetailModalApi] = useVbenModal({
  connectedComponent: CustomerDetail,
  destroyOnClose: true,
});
const [SaleOutDetailModal, saleOutDetailModalApi] = useVbenModal({
  connectedComponent: SaleOutDetail,
  destroyOnClose: true,
});
const [SaleReturnDetailModal, saleReturnDetailModalApi] = useVbenModal({
  connectedComponent: SaleReturnDetail,
  destroyOnClose: true,
});

function handleOpenCustomerDetail() {
  if (!formData.value.customerId) return;
  customerDetailModalApi.setData({ id: formData.value.customerId }).open();
}

function handleBizDetail(item: ErpFinanceReceiptApi.FinanceReceiptItem) {
  if (!item.bizId) return;
  const modalMap: Record<number, any> = {
    [ErpBizType.SALE_OUT]: saleOutDetailModalApi,
    [ErpBizType.SALE_RETURN]: saleReturnDetailModalApi,
  };
  modalMap[item.bizType]?.setData({ type: 'detail', id: item.bizId }).open();
}

const emit = defineEmits(['success', 'audit']);
const { hasAccessByCodes } = useAccess();
const formData = ref<
  ErpFinanceReceiptApi.FinanceReceipt & {
    fileUrl?: string;
  }
>({
  id: undefined,
  no: '',
  customerId: 0,
  accountId: 0,
  financeUserId: 0,
  receiptTime: new Date(),
  remark: '',
  fileUrl: undefined,
  totalPrice: undefined as any,
  discountPrice: undefined as any,
  receiptPrice: 0,
  items: [],
  status: 0,
});

const formType = ref(''); // 表单类型：'create' | 'edit' | 'detail'
const canOpenCustomerDetail = computed(() =>
  Boolean(formData.value?.customerId && formData.value?.customerName),
);
const itemFormRef = ref<InstanceType<typeof ItemForm>>();
const canEditRemark = computed(
  () =>
    formType.value === 'detail' &&
    Boolean(formData.value.id) &&
    hasAccessByCodes(['erp:finance-receipt:update']),
);
const [RemarkModal, remarkModalApi] = useVbenModal({
  connectedComponent: FinanceDocumentRemarkForm,
  destroyOnClose: true,
});

function handleEditRemark() {
  remarkModalApi
    .setData({
      documentName: '收款单',
      documentType: 'finance-receipt',
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
  'erp_finance_receipt',
);

const getTitle = computed(() => {
  if (formType.value === 'create') {
    return $t('ui.actionTitle.create', ['收款单']);
  } else if (formType.value === 'copy') {
    return $t('ui.actionTitle.create', ['收款单']);
  } else if (formType.value === 'edit') {
    return $t('ui.actionTitle.edit', ['收款单']);
  } else {
    return '收款单详情';
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
      'customerId',
      'customerDetail',
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
      if (changedFields.includes('customerId')) {
        formData.value.customerId = values.customerId;
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
        formData.value.receiptPrice = financeSubtract(totalPrice, discountPrice);
        formApi.setValues({
          receiptPrice: formData.value.receiptPrice,
        });
      }
    }
  },
});

/** 更新收款项 */
function handleUpdateItems(items: ErpFinanceReceiptApi.FinanceReceiptItem[]) {
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

/** 更新收款金额 */
function handleUpdateReceiptPrice(receiptPrice: number | string | null) {
  formData.value.receiptPrice = receiptPrice;
  formApi.setValues({
    receiptPrice: formData.value.receiptPrice,
  });
}

/** 创建或更新收款单 */
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
      (await formApi.getValues()) as ErpFinanceReceiptApi.FinanceReceipt;
    normalizeOptionalNumberFields(data as any, [
      'discountPrice',
      'receiptPrice',
      'totalPrice',
    ]);
    try {
      await (formType.value === 'create'
        ? createFinanceReceipt(data)
        : updateFinanceReceipt(data));
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
      formData.value = {
        id: undefined,
        no: '',
        customerId: 0,
        accountId: 0,
        financeUserId: 0,
        receiptTime: new Date(),
        remark: '',
        totalPrice: undefined as any,
        discountPrice: undefined as any,
        receiptPrice: 0,
        status: 0,
        items: [],
        bizNo: '',
      };
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
      const detail = await getFinanceReceipt(data.id);
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
      <template #customerDetail>
        <DetailLinkInput
          :navigable="canOpenCustomerDetail"
          :value="formData?.customerName"
          @open="handleOpenCustomerDetail"
        />
      </template>
      <template #items>
        <ItemForm
          ref="itemFormRef"
          :items="formData?.items ?? []"
          :customer-id="formData?.customerId"
          :disabled="formType === 'detail'"
          :discount-price="formData?.discountPrice ?? 0"
          :hidden-fields="hiddenFields"
          @update:items="handleUpdateItems"
          @update:total-price="handleUpdateTotalPrice"
          @update:receipt-price="handleUpdateReceiptPrice"
          @detail="handleBizDetail"
          class="w-full"
        />
      </template>
    </Form>
  </Modal>
  <RemarkModal @success="handleRemarkSuccess" />
  <CustomerDetailModal />
  <SaleOutDetailModal />
  <SaleReturnDetailModal />
</template>

<style scoped>
:deep(.flex-auto.overflow-hidden:has(> .relative > .erp-detail-link-field)) {
  overflow: visible;
}
</style>
