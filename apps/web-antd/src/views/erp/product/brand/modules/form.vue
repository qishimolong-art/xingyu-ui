<script lang="ts" setup>
import type { ErpProductBrandApi } from '#/api/erp/product/brand';

import { computed, ref, watch } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import {
  createProductBrand,
  getProductBrand,
  updateProductBrand,
} from '#/api/erp/product/brand';
import { useFieldPermission } from '#/composables/useFieldPermission';
import { $t } from '#/locales';

import { useFormSchema } from '../data';

const emit = defineEmits(['success']);
const formData = ref<ErpProductBrandApi.ProductBrand>();
const { hiddenFields } = useFieldPermission('erp_product_brand');
const getTitle = computed(() => {
  return formData.value?.id
    ? $t('ui.actionTitle.edit', ['配件品牌'])
    : $t('ui.actionTitle.create', ['配件品牌']);
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
  wrapperClass: 'product-brand-form-grid grid-cols-1 sm:grid-cols-2',
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
    const data = (await formApi.getValues()) as ErpProductBrandApi.ProductBrand;
    try {
      let id = data.id;
      if (formData.value?.id) {
        await updateProductBrand(data);
      } else {
        id = await createProductBrand(data);
      }
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
    const data = modalApi.getData<ErpProductBrandApi.ProductBrand>();
    if (!data || !data.id) {
      await formApi.setValues({ status: 0, sort: 0 });
      return;
    }
    modalApi.lock();
    try {
      formData.value = await getProductBrand(data.id);
      await formApi.setValues(formData.value);
    } finally {
      modalApi.unlock();
    }
  },
});
</script>

<template>
  <Modal :title="getTitle" class="w-[680px]">
    <div class="product-brand-form-view">
      <section class="product-brand-form-section">
        <header class="product-brand-form-section__header">
          <span class="product-brand-form-section__title">基本信息</span>
        </header>
        <Form class="product-brand-edit-form" />
      </section>
    </div>
  </Modal>
</template>

<style scoped>
.product-brand-form-view {
  padding: 12px;
  font-size: 12px;
  background: hsl(var(--muted) / 28%);
}

.product-brand-form-section {
  overflow: hidden;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
}

.product-brand-form-section__header {
  display: flex;
  align-items: center;
  min-height: 40px;
  padding: 0 12px;
  background: hsl(var(--muted) / 24%);
  border-bottom: 1px solid hsl(var(--border));
}

.product-brand-form-section__title {
  position: relative;
  padding-left: 10px;
  font-size: 13px;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.product-brand-form-section__title::before {
  position: absolute;
  top: 2px;
  bottom: 2px;
  left: 0;
  width: 3px;
  content: '';
  background: hsl(var(--primary));
  border-radius: 3px;
}

.product-brand-edit-form :deep(.product-brand-form-grid) {
  gap: 0 12px;
  padding: 12px;
}

.product-brand-edit-form :deep(.product-brand-form-grid > div) {
  min-width: 0;
}

.product-brand-edit-form :deep(.product-brand-form-grid > div > label) {
  padding-right: 10px;
  margin-right: 0;
  font-size: 12px;
  font-weight: 400;
  line-height: 1.2;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

.product-brand-edit-form :deep(.product-brand-form-grid > div > .flex-auto) {
  min-width: 0;
}

.product-brand-edit-form :deep(.ant-input),
.product-brand-edit-form :deep(.ant-input-affix-wrapper),
.product-brand-edit-form :deep(.ant-input-number),
.product-brand-edit-form :deep(.ant-radio-button-wrapper) {
  min-height: 32px;
  font-size: 12px;
  border-color: hsl(var(--border)) !important;
  border-radius: 6px !important;
}

.product-brand-edit-form :deep(.ant-input:not(textarea)),
.product-brand-edit-form :deep(.ant-input-affix-wrapper),
.product-brand-edit-form :deep(.ant-input-number),
.product-brand-edit-form :deep(.ant-radio-button-wrapper) {
  height: 32px;
}

.product-brand-edit-form :deep(.ant-input-number) {
  width: 100%;
}

.product-brand-edit-form :deep(.ant-radio-group) {
  display: flex;
  width: 100%;
}

.product-brand-edit-form :deep(.ant-radio-button-wrapper) {
  flex: 1;
  padding-inline: 8px;
  line-height: 30px;
  text-align: center;
}

.product-brand-edit-form :deep(.ant-form-item-explain) {
  font-size: 12px;
}

@media (max-width: 639px) {
  .product-brand-form-view {
    padding: 8px;
  }
}
</style>
