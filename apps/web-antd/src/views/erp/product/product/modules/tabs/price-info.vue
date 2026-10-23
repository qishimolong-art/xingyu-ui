<script lang="ts" setup>
import { useCandidateSchema } from '#/views/erp/utils/candidate-focus';

import { watch } from 'vue';

import { useVbenForm } from '#/adapter/form';
import { useFieldPermission } from '#/composables/useFieldPermission';

import { useConfiguredPriceFormSchema, usePriceFormSchema } from '../../data';
import { focusNextProductInputOnEnter } from '../../utils/keyboard';

const decorateCandidates = useCandidateSchema();

const emit = defineEmits<{
  (e: 'change', values: Record<string, any>): void;
}>();
const { hiddenFields } = useFieldPermission('erp_product');

const [Form, formApi] = useVbenForm({
  commonConfig: {
    componentProps: { class: 'w-full' },
    labelClass: '!justify-start !text-left',
    labelWidth: 82,
  },
  compact: true,
  wrapperClass: 'product-form-grid grid-cols-4',
  layout: 'horizontal',
  schema: decorateCandidates(usePriceFormSchema(hiddenFields.value)),
  showDefaultActions: false,
  handleValuesChange(values) {
    emit('change', values);
  },
});

async function refreshSchema(fields = hiddenFields.value) {
  formApi.setState({
    schema: decorateCandidates(await useConfiguredPriceFormSchema(fields)),
  });
}

watch(hiddenFields, (fields) => {
  void refreshSchema(fields);
});

void refreshSchema();

defineExpose({
  async validate() {
    const { valid } = await formApi.validate();
    return valid;
  },
  getValues: () => formApi.getValues(),
  resetForm: () => formApi.resetForm(),
  setValues: (data: Record<string, any>) => formApi.setValues(data),
  setDisabled: (disabled: boolean) => formApi.setDisabled(disabled),
  refreshSchema,
});
</script>

<template>
  <div @keydown.enter="focusNextProductInputOnEnter">
    <Form class="mx-2" />
  </div>
</template>
