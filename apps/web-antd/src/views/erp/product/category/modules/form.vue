<script lang="ts" setup>
import type { ErpProductCategoryApi } from '#/api/erp/product/category';

import { computed, ref, watch } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import {
  createProductCategory,
  getProductCategory,
  updateProductCategory,
} from '#/api/erp/product/category';
import { useFieldPermission } from '#/composables/useFieldPermission';
import { $t } from '#/locales';

import { useFormSchema } from '../data';

const emit = defineEmits(['success']);
const formData = ref<ErpProductCategoryApi.ProductCategory>();
const formMode = ref<'create' | 'edit'>('create');
const { hiddenFields } = useFieldPermission('erp_product_category');
const getTitle = computed(() => {
  return formData.value?.id
    ? $t('ui.actionTitle.edit', ['配件分类'])
    : $t('ui.actionTitle.create', ['配件分类']);
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
  schema: useFormSchema(hiddenFields.value, formMode.value),
  showDefaultActions: false,
  wrapperClass: 'product-category-form-grid grid-cols-1 sm:grid-cols-2',
});

watch(hiddenFields, (fields) => {
  formApi.setState({ schema: useFormSchema(fields, formMode.value) });
});

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    const { valid } = await formApi.validate();
    if (!valid) {
      return;
    }
    modalApi.lock();
    // 提交表单
    const data =
      (await formApi.getValues()) as ErpProductCategoryApi.ProductCategory;
    if (
      !formData.value?.id &&
      (data.sort === null || data.sort === undefined)
    ) {
      data.sort = 0;
    }
    delete data.parentId;
    try {
      let id = data.id;
      if (formData.value?.id) {
        await updateProductCategory(data);
      } else {
        id = await createProductCategory(data);
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
      formMode.value = 'create';
      return;
    }
    // 加载数据
    const data = modalApi.getData<ErpProductCategoryApi.ProductCategory>();
    formMode.value = data?.id ? 'edit' : 'create';
    formApi.setState({
      schema: useFormSchema(hiddenFields.value, formMode.value),
    });
    if (!data || !data.id) {
      // 设置上级
      await formApi.setValues(data);
      return;
    }
    modalApi.lock();
    try {
      formData.value = await getProductCategory(data.id);
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
    <div class="product-category-form-view">
      <section class="product-category-form-section">
        <header class="product-category-form-section__header">
          <span class="product-category-form-section__title">基本信息</span>
        </header>
        <Form class="product-category-edit-form" />
      </section>
    </div>
  </Modal>
</template>

<style scoped>
.product-category-form-view {
  padding: 12px;
  font-size: 12px;
  background: hsl(var(--muted) / 28%);
}

.product-category-form-section {
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.product-category-form-section__header {
  display: flex;
  align-items: center;
  min-height: 40px;
  padding: 0 12px;
  background: hsl(var(--muted) / 24%);
  border-bottom: 1px solid hsl(var(--border));
}

.product-category-form-section__title {
  position: relative;
  padding-left: 10px;
  font-size: 13px;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.product-category-form-section__title::before {
  position: absolute;
  top: 2px;
  bottom: 2px;
  left: 0;
  width: 3px;
  content: '';
  background: hsl(var(--primary));
  border-radius: 3px;
}

.product-category-edit-form :deep(.product-category-form-grid) {
  gap: 0 12px;
  padding: 12px;
}

.product-category-edit-form :deep(.product-category-form-grid > div) {
  min-width: 0;
}

.product-category-edit-form :deep(.product-category-form-grid > div > label) {
  padding-right: 10px;
  margin-right: 0;
  font-size: 12px;
  font-weight: 400;
  line-height: 1.2;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

.product-category-edit-form
  :deep(.product-category-form-grid > div > .flex-auto) {
  min-width: 0;
}

.product-category-edit-form :deep(.ant-input),
.product-category-edit-form :deep(.ant-input-affix-wrapper),
.product-category-edit-form :deep(.ant-input-number),
.product-category-edit-form :deep(.ant-radio-button-wrapper) {
  min-height: 32px;
  font-size: 12px;
  border-color: hsl(var(--border)) !important;
  border-radius: 6px !important;
}

.product-category-edit-form :deep(.ant-input:not(textarea)),
.product-category-edit-form :deep(.ant-input-affix-wrapper),
.product-category-edit-form :deep(.ant-input-number),
.product-category-edit-form :deep(.ant-radio-button-wrapper) {
  height: 32px;
}

.product-category-edit-form :deep(.ant-input-number-input) {
  height: 30px;
  font-size: 12px;
}

.product-category-edit-form :deep(.ant-radio-group) {
  display: flex;
  width: 100%;
}

.product-category-edit-form :deep(.ant-radio-button-wrapper) {
  flex: 1;
  padding-inline: 8px;
  line-height: 30px;
  text-align: center;
}

.product-category-edit-form :deep(.ant-input:not([readonly]):not(:disabled)),
.product-category-edit-form
  :deep(.ant-input-affix-wrapper:not(.ant-input-affix-wrapper-disabled)),
.product-category-edit-form
  :deep(.ant-input-number:not(.ant-input-number-disabled)) {
  background: hsl(var(--background)) !important;
}

.product-category-edit-form :deep(.ant-input[readonly]),
.product-category-edit-form :deep(.ant-input:disabled),
.product-category-edit-form :deep(.ant-input-number-disabled) {
  color: hsl(var(--muted-foreground)) !important;
  cursor: not-allowed;
  background: hsl(var(--muted-foreground) / 14%) !important;
  border-color: hsl(var(--muted-foreground) / 28%) !important;
}

.product-category-edit-form :deep(.ant-form-item-explain) {
  font-size: 12px;
}

@media (max-width: 639px) {
  .product-category-form-view {
    padding: 8px;
  }
}
</style>
