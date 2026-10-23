<script lang="ts" setup>
import type { ErpBaseDataApi } from '#/api/erp/base';

import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { createBaseData, getBaseData, updateBaseData } from '#/api/erp/base';
import { useFieldPermission } from '#/composables/useFieldPermission';
import { $t } from '#/locales';

import { useFormSchema } from '../data';

interface ModalData {
  type: string;
  title: string;
  row?: ErpBaseDataApi.BaseData;
  codeRequired?: boolean;
}

const emit = defineEmits<{
  (e: 'success', record: ErpBaseDataApi.BaseData): void;
}>();
const formData = ref<ErpBaseDataApi.BaseData>();
const modalData = ref<ModalData>();
const { hiddenFields, loadHiddenFields } = useFieldPermission('erp_base_data');
const getTitle = computed(() => {
  const title = modalData.value?.title || '';
  return formData.value?.id
    ? $t('ui.actionTitle.edit', [title])
    : $t('ui.actionTitle.create', [title]);
});

const [Form, formApi] = useVbenForm({
  commonConfig: {
    componentProps: {
      class: 'w-full',
    },
    formItemClass: 'col-span-1',
    labelClass: '!justify-start !text-left',
    labelWidth: 82,
  },
  compact: true,
  layout: 'horizontal',
  schema: useFormSchema(hiddenFields.value),
  showDefaultActions: false,
  wrapperClass: 'base-data-form-grid grid-cols-1 sm:grid-cols-2',
});

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) {
      return;
    }
    modalApi.lock();
    const data = (await formApi.getValues()) as ErpBaseDataApi.BaseData;
    data.type = modalData.value?.type || '';
    try {
      const saved = await (formData.value?.id
        ? updateBaseData(data)
        : createBaseData(data));
      const savedRecord =
        saved && typeof saved === 'object'
          ? { ...data, ...saved }
          : {
              ...data,
              ...(typeof saved === 'number' || typeof saved === 'string'
                ? { id: Number(saved) }
                : {}),
            };
      await modalApi.close();
      emit('success', savedRecord);
      message.success($t('ui.actionMessage.operationSuccess'));
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      formData.value = undefined;
      modalData.value = undefined;
      return;
    }
    const data = modalApi.getData<ModalData>();
    modalData.value = data;
    await loadHiddenFields();
    formApi.updateSchema(
      useFormSchema(hiddenFields.value, {
        codeRequired: data?.codeRequired,
      }),
    );
    if (!data?.row?.id) {
      return;
    }
    modalApi.lock();
    try {
      formData.value = await getBaseData(data.row.id);
      await formApi.setValues(formData.value);
    } finally {
      modalApi.unlock();
    }
  },
});
</script>

<template>
  <Modal :title="getTitle" class="w-[680px]">
    <div class="base-data-form-view">
      <section class="base-data-form-section">
        <header class="base-data-form-section__header">
          <span class="base-data-form-section__title">基本信息</span>
        </header>
        <Form class="base-data-edit-form" />
      </section>
    </div>
  </Modal>
</template>

<style scoped>
.base-data-form-view {
  padding: 12px;
  font-size: 12px;
  background: hsl(var(--muted) / 28%);
}

.base-data-form-section {
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.base-data-form-section__header {
  display: flex;
  align-items: center;
  min-height: 40px;
  padding: 0 12px;
  background: hsl(var(--muted) / 24%);
  border-bottom: 1px solid hsl(var(--border));
}

.base-data-form-section__title {
  position: relative;
  padding-left: 10px;
  font-size: 13px;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.base-data-form-section__title::before {
  position: absolute;
  top: 2px;
  bottom: 2px;
  left: 0;
  width: 3px;
  content: '';
  background: hsl(var(--primary));
  border-radius: 3px;
}

.base-data-edit-form :deep(.base-data-form-grid) {
  gap: 0 12px;
  padding: 12px;
}

.base-data-edit-form :deep(.base-data-form-grid > div) {
  min-width: 0;
}

.base-data-edit-form :deep(.base-data-form-grid > div > label) {
  padding-right: 10px;
  margin-right: 0;
  font-size: 12px;
  font-weight: 400;
  line-height: 1.2;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

.base-data-edit-form :deep(.base-data-form-grid > div > .flex-auto) {
  min-width: 0;
}

.base-data-edit-form :deep(.ant-input),
.base-data-edit-form :deep(.ant-input-affix-wrapper),
.base-data-edit-form :deep(.ant-input-number),
.base-data-edit-form :deep(.ant-radio-button-wrapper) {
  min-height: 32px;
  font-size: 12px;
  border-color: hsl(var(--border)) !important;
  border-radius: 6px !important;
}

.base-data-edit-form :deep(.ant-input:not(textarea)),
.base-data-edit-form :deep(.ant-input-affix-wrapper),
.base-data-edit-form :deep(.ant-input-number),
.base-data-edit-form :deep(.ant-radio-button-wrapper) {
  height: 32px;
}

.base-data-edit-form :deep(.ant-input-number-input) {
  height: 30px;
  font-size: 12px;
}

.base-data-edit-form :deep(textarea.ant-input) {
  min-height: 68px;
  resize: vertical;
}

.base-data-edit-form :deep(.ant-radio-group) {
  display: flex;
  width: 100%;
}

.base-data-edit-form :deep(.ant-radio-button-wrapper) {
  flex: 1;
  padding-inline: 8px;
  line-height: 30px;
  text-align: center;
}

.base-data-edit-form :deep(.ant-input:not([readonly]):not(:disabled)),
.base-data-edit-form
  :deep(.ant-input-affix-wrapper:not(.ant-input-affix-wrapper-disabled)),
.base-data-edit-form :deep(.ant-input-number:not(.ant-input-number-disabled)) {
  background: hsl(var(--background)) !important;
}

.base-data-edit-form :deep(.ant-input[readonly]),
.base-data-edit-form :deep(.ant-input:disabled),
.base-data-edit-form :deep(.ant-input-number-disabled) {
  color: hsl(var(--muted-foreground)) !important;
  cursor: not-allowed;
  background: hsl(var(--muted-foreground) / 14%) !important;
  border-color: hsl(var(--muted-foreground) / 28%) !important;
}

.base-data-edit-form :deep(.ant-form-item-explain) {
  font-size: 12px;
}

@media (max-width: 639px) {
  .base-data-form-view {
    padding: 8px;
  }
}
</style>
