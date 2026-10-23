<script lang="ts" setup>
import type { ErpVoucherWordApi } from '#/api/erp/finance/accounting/voucher-word';

import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import {
  createVoucherWord,
  getVoucherWord,
  updateVoucherWord,
} from '#/api/erp/finance/accounting/voucher-word';
import { useFieldPermission } from '#/composables/useFieldPermission';
import { $t } from '#/locales';

import { useFormSchema } from '../data';

const emit = defineEmits(['success']);
const formData = ref<ErpVoucherWordApi.VoucherWord>();
const FIELD_PERMISSION_MODULE = 'erp_accounting_voucher_word';
const { hiddenFields, loadHiddenFields } = useFieldPermission(
  FIELD_PERMISSION_MODULE,
);
const getTitle = computed(() => {
  return formData.value?.id
    ? $t('ui.actionTitle.edit', ['凭证字'])
    : $t('ui.actionTitle.create', ['凭证字']);
});

const [Form, formApi] = useVbenForm({
  commonConfig: {
    componentProps: {
      class: 'w-full',
    },
    formItemClass: 'col-span-2',
    labelWidth: 100,
  },
  layout: 'horizontal',
  schema: useFormSchema(hiddenFields.value),
  showDefaultActions: false,
});

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) {
      return;
    }
    modalApi.lock();
    const data = (await formApi.getValues()) as ErpVoucherWordApi.VoucherWord;
    try {
      await (formData.value?.id
        ? updateVoucherWord(data)
        : createVoucherWord(data));
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
    const data = modalApi.getData<ErpVoucherWordApi.VoucherWord>();
    if (!data || !data.id) {
      return;
    }
    modalApi.lock();
    try {
      formData.value = await getVoucherWord(data.id);
      await formApi.setValues(formData.value);
    } finally {
      modalApi.unlock();
    }
  },
});
</script>

<template>
  <Modal class="w-[600px]" :title="getTitle">
    <Form class="mx-4" />
  </Modal>
</template>
