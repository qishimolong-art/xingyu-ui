<script lang="ts" setup>
import type { ErpBookOpenApi } from '#/api/erp/finance/accounting/book-open';

import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { Alert, message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import {
  createBookOpen,
  getBookOpen,
  updateBookOpen,
} from '#/api/erp/finance/accounting/book-open';
import { useFieldPermission } from '#/composables/useFieldPermission';
import { $t } from '#/locales';

import { useFormSchema } from '../data';

const emit = defineEmits(['success']);
const formData = ref<ErpBookOpenApi.BookOpen>();
const FIELD_PERMISSION_MODULE = 'erp_accounting_book_open';
const { hiddenFields, loadHiddenFields } = useFieldPermission(
  FIELD_PERMISSION_MODULE,
);
const getTitle = computed(() => {
  return formData.value?.id
    ? $t('ui.actionTitle.edit', ['开账记录'])
    : '新增开账';
});

const [Form, formApi] = useVbenForm({
  commonConfig: {
    componentProps: {
      class: 'w-full',
    },
    formItemClass: 'col-span-2',
    labelWidth: 90,
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
    const data = (await formApi.getValues()) as ErpBookOpenApi.BookOpen;
    try {
      if (formData.value?.id) {
        await updateBookOpen(data);
        message.success($t('ui.actionMessage.operationSuccess'));
      } else {
        await createBookOpen(data);
        message.success('开账成功');
      }
      await modalApi.close();
      emit('success');
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
    const data = modalApi.getData<ErpBookOpenApi.BookOpen>();
    if (!data || !data.id) {
      return;
    }
    modalApi.lock();
    try {
      formData.value = await getBookOpen(data.id);
      await formApi.setValues(formData.value);
    } finally {
      modalApi.unlock();
    }
  },
});
</script>

<template>
  <Modal class="w-1/3" :title="getTitle" :confirmText="'开账'">
    <div class="px-4 pt-4">
      <Alert type="warning" show-icon class="mb-4">
        <template #message>注意事项</template>
        <template #description>
          <ol class="my-0 ml-5 list-decimal pl-0">
            <li>期初值将转入当前余量库</li>
            <li>系统将按所选年度生成全年开账配置</li>
            <li>系统开账后期初值将不能修改</li>
          </ol>
        </template>
      </Alert>
    </div>
    <Form class="mx-4" />
  </Modal>
</template>
