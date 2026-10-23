<script lang="ts" setup>
import type { MallDiyHomeBannerApi } from '#/api/mall/promotion/diy/home-banner';

import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import {
  createDiyHomeBanner,
  getDiyHomeBanner,
  updateDiyHomeBanner,
} from '#/api/mall/promotion/diy/home-banner';
import { $t } from '#/locales';

import { useFormSchema } from '../data';

import '../../../styles/compact-grid.css';

const emit = defineEmits(['success']);
const formData = ref<MallDiyHomeBannerApi.HomeBanner>();
const getTitle = computed(() => {
  return formData.value?.id
    ? $t('ui.actionTitle.edit', ['首页轮播图'])
    : $t('ui.actionTitle.create', ['首页轮播图']);
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
    const data = (await formApi.getValues()) as MallDiyHomeBannerApi.HomeBanner;
    try {
      await (formData.value?.id
        ? updateDiyHomeBanner(data)
        : createDiyHomeBanner(data));
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
    const data = modalApi.getData<MallDiyHomeBannerApi.HomeBanner>();
    if (!data || !data.id) {
      return;
    }
    modalApi.lock();
    try {
      formData.value = await getDiyHomeBanner(data.id);
      await formApi.setValues(formData.value);
    } finally {
      modalApi.unlock();
    }
  },
});
</script>

<template>
  <Modal :title="getTitle" class="!w-[720px] max-w-[96vw]">
    <Form class="mx-4 mall-promotion-edit-form" />
  </Modal>
</template>
