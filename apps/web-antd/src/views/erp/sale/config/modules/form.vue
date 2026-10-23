<script lang="ts" setup>
import type { ErpSaleConfigApi } from '#/api/erp/sale/config';

import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';

import { message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import {
  createSaleConfig,
  getSaleConfig,
  updateSaleConfig,
} from '#/api/erp/sale/config';
import { useFieldPermission } from '#/composables/useFieldPermission';
import { $t } from '#/locales';

import { getConfigTypeLabel, useFormSchema } from '../data';

const emit = defineEmits(['success']);
const FIELD_PERMISSION_MODULE = 'erp_sale_config';
const formData = ref<ErpSaleConfigApi.SaleConfig>();
const defaultConfigType = ref<string>();
const userStore = useUserStore();
const { hiddenFields, loadHiddenFields } = useFieldPermission(
  FIELD_PERMISSION_MODULE,
);

const getTitle = computed(() => {
  const name = getConfigTypeLabel(
    formData.value?.configType || defaultConfigType.value,
  );
  return formData.value?.id
    ? $t('ui.actionTitle.edit', [name])
    : $t('ui.actionTitle.create', [name]);
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
  schema: useFormSchema(),
  showDefaultActions: false,
});

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) {
      return;
    }
    modalApi.lock();
    const data = (await formApi.getValues()) as ErpSaleConfigApi.SaleConfig;
    try {
      await (formData.value?.id
        ? updateSaleConfig(data)
        : createSaleConfig(data));
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
      defaultConfigType.value = undefined;
      return;
    }
    const data = modalApi.getData<
      ErpSaleConfigApi.SaleConfig & { defaultConfigType?: string }
    >();
    await loadHiddenFields();
    formApi.setState({ schema: useFormSchema(hiddenFields.value) });
    defaultConfigType.value = data?.defaultConfigType;
    if (!data || !data.id) {
      await formApi.setValues({
        configType: data?.defaultConfigType,
        deptId: userStore.userInfo?.deptId,
        status: 0,
        sort: 0,
      });
      return;
    }
    modalApi.lock();
    try {
      formData.value = await getSaleConfig(data.id);
      await formApi.setValues(formData.value);
    } finally {
      modalApi.unlock();
    }
  },
});
</script>

<template>
  <Modal :title="getTitle" class="w-[640px]">
    <Form class="mx-4" />
  </Modal>
</template>
