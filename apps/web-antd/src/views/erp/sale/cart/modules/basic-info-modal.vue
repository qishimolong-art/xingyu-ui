<script lang="ts" setup>
import { withCandidateFocus } from '#/views/erp/utils/candidate-focus';

import type { VbenFormSchema } from '#/adapter/form';
import type { ErpSaleCartApi } from '#/api/erp/sale/cart';

import { ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { getSaleCart, updateSaleCartBasic } from '#/api/erp/sale/cart';
import { $t } from '#/locales';
import CustomerReceivableSummary from '#/views/erp/sale/components/CustomerReceivableSummary.vue';
import { getSaleCustomerSelectProps } from '#/views/erp/sale/utils/customer-credit';
import { withCurrentSaleCustomerOption } from '#/views/erp/sale/utils/document-form';
import { withEnterBlurInputSchemas } from '#/views/erp/sale/utils/keyboard';
import {
  createOptionalNumberRule,
  toOptionalNumberValue,
} from '#/views/erp/sale/utils/text-number';

const emit = defineEmits(['success']);
const formData = ref<ErpSaleCartApi.SaleCart>();

const schema: VbenFormSchema[] = withCandidateFocus(
  withEnterBlurInputSchemas([
    {
      fieldName: 'customerId',
      label: '客户',
      component: 'SaleCustomerLazySelect',
      componentProps: {
        ...getSaleCustomerSelectProps(),
      },
      rules: 'required',
    },
    {
      fieldName: 'customerReceivableInfo',
      component: 'Input',
    },
    {
      fieldName: 'feeAmount',
      label: '费用',
      component: 'Input',
      componentProps: {
        placeholder: '请输入费用',
      },
      rules: createOptionalNumberRule('费用', { min: 0 }),
    },
    {
      fieldName: 'remark',
      label: '备注',
      component: 'Textarea',
      componentProps: {
        placeholder: '请输入备注',
        autoSize: { minRows: 3, maxRows: 5 },
      },
    },
  ]),
);

const [Form, formApi] = useVbenForm({
  commonConfig: { componentProps: { class: 'w-full' }, labelWidth: 90 },
  layout: 'vertical',
  schema,
  showDefaultActions: false,
  handleValuesChange(values, changedFields) {
    if (changedFields.includes('customerId')) {
      if (!formData.value) {
        formData.value = {} as ErpSaleCartApi.SaleCart;
      }
      formData.value.customerId = values.customerId;
    }
  },
});

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid || !formData.value?.id) {
      return;
    }
    modalApi.lock();
    try {
      const values =
        (await formApi.getValues()) as ErpSaleCartApi.SaleCartUpdateBasic;
      const feeAmount = toOptionalNumberValue(values.feeAmount) ?? 0;
      await updateSaleCartBasic({
        id: formData.value.id,
        customerId: values.customerId,
        feeAmount,
        remark: values.remark,
      });
      await modalApi.close();
      emit('success');
      message.success($t('ui.actionMessage.operationSuccess'));
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      formData.value = undefined;
      return;
    }
    const data = modalApi.getData<ErpSaleCartApi.SaleCart>();
    if (!data?.id) {
      return;
    }
    modalApi.lock();
    try {
      formData.value = await getSaleCart(data.id);
      formApi.setState({
        schema: withCurrentSaleCustomerOption(schema, formData.value),
      });
      await formApi.resetForm();
      await formApi.setValues({
        customerId: formData.value.customerId,
        feeAmount:
          toOptionalNumberValue(
            formData.value.feeAmount ?? formData.value.otherPrice,
          ) ?? 0,
        remark: formData.value.remark,
      });
    } finally {
      modalApi.unlock();
    }
  },
});
</script>

<template>
  <Modal class="w-1/2" title="修改销售手推车信息">
    <Form class="mx-4">
      <template #customerReceivableInfo>
        <CustomerReceivableSummary :customer-id="formData?.customerId" />
      </template>
    </Form>
  </Modal>
</template>
