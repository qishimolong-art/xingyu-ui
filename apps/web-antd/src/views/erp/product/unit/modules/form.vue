<script lang="ts" setup>
import type { ErpProductUnitApi } from '#/api/erp/product/unit';

import { computed, ref, watch } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import {
  createProductUnit,
  getProductUnit,
  updateProductUnit,
} from '#/api/erp/product/unit';
import { useFieldPermission } from '#/composables/useFieldPermission';
import { $t } from '#/locales';

import { useFormSchema } from '../data';

const emit = defineEmits(['success']);
const formData = ref<ErpProductUnitApi.ProductUnit>();
const { hiddenFields } = useFieldPermission('erp_product_unit');
const getTitle = computed(() => {
  return formData.value?.id
    ? $t('ui.actionTitle.edit', ['配件单位'])
    : $t('ui.actionTitle.create', ['配件单位']);
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
  wrapperClass: 'product-unit-form-grid grid-cols-1 sm:grid-cols-2',
});

watch(hiddenFields, (fields) => {
  formApi.setState({ schema: useFormSchema(fields) });
});

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) {
      return;
    }
    modalApi.lock();
    // 提交表单
    const data = (await formApi.getValues()) as ErpProductUnitApi.ProductUnit;
    try {
      let id = data.id;
      if (formData.value?.id) {
        await updateProductUnit(data);
      } else {
        id = await createProductUnit(data);
      }
      // 关闭并提示
      await modalApi.close();
      emit('success', { ...data, id });
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
    // 加载数据
    const data = modalApi.getData<ErpProductUnitApi.ProductUnit>();
    if (!data || !data.id) {
      return;
    }
    modalApi.lock();
    try {
      formData.value = await getProductUnit(data.id);
      // 设置到 values
      await formApi.setValues(formData.value);
    } finally {
      modalApi.unlock();
    }
  },
});
</script>

<template>
  <Modal :title="getTitle" class="w-[680px]">
    <div class="product-unit-form-view">
      <section class="product-unit-form-section">
        <header class="product-unit-form-section__header">
          <span class="product-unit-form-section__title">基本信息</span>
        </header>
        <Form class="product-unit-edit-form" />
      </section>
    </div>
  </Modal>
</template>

<style scoped>
.product-unit-form-view {
  padding: 12px;
  font-size: 12px;
  background: hsl(var(--muted) / 28%);
}

.product-unit-form-section {
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.product-unit-form-section__header {
  display: flex;
  align-items: center;
  min-height: 40px;
  padding: 0 12px;
  background: hsl(var(--muted) / 24%);
  border-bottom: 1px solid hsl(var(--border));
}

.product-unit-form-section__title {
  position: relative;
  padding-left: 10px;
  font-size: 13px;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.product-unit-form-section__title::before {
  position: absolute;
  top: 2px;
  bottom: 2px;
  left: 0;
  width: 3px;
  content: '';
  background: hsl(var(--primary));
  border-radius: 3px;
}

.product-unit-edit-form :deep(.product-unit-form-grid) {
  gap: 0 12px;
  padding: 12px;
}

.product-unit-edit-form :deep(.product-unit-form-grid > div) {
  min-width: 0;
}

.product-unit-edit-form :deep(.product-unit-form-grid > div > label) {
  padding-right: 10px;
  margin-right: 0;
  font-size: 12px;
  font-weight: 400;
  line-height: 1.2;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

.product-unit-edit-form :deep(.product-unit-form-grid > div > .flex-auto) {
  min-width: 0;
}

.product-unit-edit-form :deep(.ant-input),
.product-unit-edit-form :deep(.ant-input-affix-wrapper),
.product-unit-edit-form :deep(.ant-radio-button-wrapper) {
  min-height: 32px;
  font-size: 12px;
  border-color: hsl(var(--border)) !important;
  border-radius: 6px !important;
}

.product-unit-edit-form :deep(.ant-input:not(textarea)),
.product-unit-edit-form :deep(.ant-input-affix-wrapper),
.product-unit-edit-form :deep(.ant-radio-button-wrapper) {
  height: 32px;
}

.product-unit-edit-form :deep(.ant-radio-group) {
  display: flex;
  width: 100%;
}

.product-unit-edit-form :deep(.ant-radio-button-wrapper) {
  flex: 1;
  padding-inline: 8px;
  line-height: 30px;
  text-align: center;
}

.product-unit-edit-form :deep(.ant-input:not([readonly]):not(:disabled)),
.product-unit-edit-form
  :deep(.ant-input-affix-wrapper:not(.ant-input-affix-wrapper-disabled)) {
  background: hsl(var(--background)) !important;
}

.product-unit-edit-form :deep(.ant-input[readonly]),
.product-unit-edit-form :deep(.ant-input:disabled) {
  color: hsl(var(--muted-foreground)) !important;
  cursor: not-allowed;
  background: hsl(var(--muted-foreground) / 14%) !important;
  border-color: hsl(var(--muted-foreground) / 28%) !important;
}

.product-unit-edit-form :deep(.ant-form-item-explain) {
  font-size: 12px;
}

@media (max-width: 639px) {
  .product-unit-form-view {
    padding: 8px;
  }
}
</style>
