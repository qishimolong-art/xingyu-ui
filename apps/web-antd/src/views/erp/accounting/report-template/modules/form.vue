<script lang="ts" setup>
import type { ErpReportItemTemplateApi } from '#/api/erp/finance/accounting/report-template';

import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import {
  createReportItemTemplate,
  getReportItemTemplate,
  updateReportItemTemplate,
} from '#/api/erp/finance/accounting/report-template';
import { useFieldPermission } from '#/composables/useFieldPermission';
import { $t } from '#/locales';

import { useFormSchema } from '../data';

const props = defineProps<{
  defaultReportType?: number;
  defaultSide?: number;
}>();

const emit = defineEmits(['success']);
const formData = ref<ErpReportItemTemplateApi.ReportItemTemplate>();
const FIELD_PERMISSION_MODULE = 'erp_accounting_report_template';
const { hiddenFields, loadHiddenFields } = useFieldPermission(
  FIELD_PERMISSION_MODULE,
);
const getTitle = computed(() => {
  return formData.value?.id
    ? $t('ui.actionTitle.edit', ['报表项目'])
    : $t('ui.actionTitle.create', ['报表项目']);
});

const [Form, formApi] = useVbenForm({
  commonConfig: {
    componentProps: {
      class: 'w-full',
    },
    formItemClass: 'col-span-1',
    labelWidth: 100,
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
      (await formApi.getValues()) as ErpReportItemTemplateApi.ReportItemTemplate;
    try {
      await (formData.value?.id
        ? updateReportItemTemplate(data)
        : createReportItemTemplate(data));
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
      modalApi.getData<ErpReportItemTemplateApi.ReportItemTemplate>();
    if (!data || !data.id) {
      // 新增：默认带上当前 Tab 的 reportType 和 side
      await formApi.setValues({
        reportType: props.defaultReportType,
        side: props.defaultSide,
        enable: true,
        sort: 0,
        parentId: 0,
      });
      return;
    }
    modalApi.lock();
    try {
      formData.value = await getReportItemTemplate(data.id);
      await formApi.setValues(formData.value);
    } finally {
      modalApi.unlock();
    }
  },
});
</script>

<template>
  <Modal class="w-[800px]" :title="getTitle">
    <Form class="mx-4" />
  </Modal>
</template>
