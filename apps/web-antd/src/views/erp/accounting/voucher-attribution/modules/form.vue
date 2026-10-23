<script lang="ts" setup>
import type { ErpVoucherAttributionApi } from '#/api/erp/finance/accounting/voucher-attribution';

import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import {
  createVoucherAttribution,
  getVoucherAttribution,
  updateVoucherAttribution,
} from '#/api/erp/finance/accounting/voucher-attribution';
import { useFieldPermission } from '#/composables/useFieldPermission';
import { $t } from '#/locales';

import { useFormSchema } from '../data';

const emit = defineEmits(['success']);
const formData = ref<ErpVoucherAttributionApi.VoucherAttribution>();
const FIELD_PERMISSION_MODULE = 'erp_accounting_voucher_attribution';
const { hiddenFields, loadHiddenFields } = useFieldPermission(
  FIELD_PERMISSION_MODULE,
);
const getTitle = computed(() => {
  return formData.value?.id
    ? $t('ui.actionTitle.edit', ['归属记录'])
    : $t('ui.actionTitle.create', ['归属记录']);
});

const [Form, formApi] = useVbenForm({
  commonConfig: {
    componentProps: { class: 'w-full' },
    formItemClass: 'col-span-1',
    labelWidth: 110,
  },
  layout: 'horizontal',
  schema: useFormSchema(hiddenFields.value),
  showDefaultActions: false,
  wrapperClass: 'grid-cols-2',
});

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) {
      return;
    }
    modalApi.lock();
    const data =
      (await formApi.getValues()) as ErpVoucherAttributionApi.VoucherAttribution;
    // 校验：归属月份不能晚于业务发生月份
    if (data.attributionYear && data.attributionMonth && data.bizDate) {
      const bizDate = new Date(data.bizDate);
      const bizYM = bizDate.getFullYear() * 100 + (bizDate.getMonth() + 1);
      const attrYM = data.attributionYear * 100 + data.attributionMonth;
      if (attrYM > bizYM) {
        modalApi.unlock();
        message.error('归属月份不能晚于业务发生月份');
        return;
      }
    }
    try {
      await (formData.value?.id
        ? updateVoucherAttribution(data)
        : createVoucherAttribution(data));
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
    await loadHiddenFields();
    formApi.setState({ schema: useFormSchema(hiddenFields.value) });
    const data =
      modalApi.getData<ErpVoucherAttributionApi.VoucherAttribution>();
    if (!data || !data.id) {
      return;
    }
    modalApi.lock();
    try {
      formData.value = await getVoucherAttribution(data.id);
      await formApi.setValues(formData.value);
    } finally {
      modalApi.unlock();
    }
  },
});
</script>

<template>
  <Modal class="w-[900px]" :title="getTitle">
    <Form class="mx-4 mt-4" />
  </Modal>
</template>
