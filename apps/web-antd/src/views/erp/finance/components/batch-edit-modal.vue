<script lang="ts" setup>
import { useFinanceCandidateFocus } from '#/views/erp/finance/utils/candidate-focus';

import { ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import {
  Form as AForm,
  FormItem,
  Input,
  message,
  RadioGroup,
  Select,
  TreeSelect,
} from 'ant-design-vue';
const { candidatePopupClass } = useFinanceCandidateFocus();

interface FinanceBatchEditField {
  component: 'input' | 'radio' | 'select' | 'textarea' | 'tree-select';
  field: string;
  label: string;
  options?: { label: string; value: any }[];
  placeholder?: string;
  treeData?: any[];
}

interface FinanceBatchEditModalData {
  fields: FinanceBatchEditField[];
  ids: number[];
  title: string;
  updateRequest: (
    data: Record<string, any> & { ids: number[] },
  ) => Promise<number | unknown>;
}

const emit = defineEmits<{
  success: [];
}>();

const ids = ref<number[]>([]);
const fields = ref<FinanceBatchEditField[]>([]);
const formData = ref<Record<string, any>>({});
const modalData = ref<FinanceBatchEditModalData | null>(null);

function buildPayload() {
  const payload: Record<string, any> & { ids: number[] } = { ids: ids.value };
  fields.value.forEach(({ field }) => {
    const value = formData.value[field];
    if (value !== undefined && value !== null && value !== '') {
      payload[field] = value;
    }
  });
  return payload;
}

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    if (ids.value.length === 0) {
      message.warning('请先勾选要批量修改的数据');
      return;
    }
    if (!modalData.value) {
      message.error('批量修改配置缺失，请关闭后重试');
      return;
    }
    const payload = buildPayload();
    if (Object.keys(payload).length <= 1) {
      message.warning('请至少填写一个要修改的字段');
      return;
    }
    modalApi.lock();
    try {
      const updateCount = await modalData.value.updateRequest(payload);
      await modalApi.close();
      emit('success');
      message.success(
        `已批量更新 ${Number(updateCount ?? ids.value.length)} 条数据`,
      );
    } finally {
      modalApi.unlock();
    }
  },
  onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      ids.value = [];
      fields.value = [];
      formData.value = {};
      modalData.value = null;
      return;
    }
    const data = modalApi.getData<FinanceBatchEditModalData>();
    modalData.value = data;
    ids.value = data?.ids || [];
    fields.value = data?.fields || [];
    formData.value = {};
  },
});
</script>

<template>
  <Modal
    :title="`${modalData?.title || '批量修改'}（已选 ${ids.length} 条）`"
    class="w-[560px]"
  >
    <AForm
      :label-col="{ span: 6 }"
      :wrapper-col="{ span: 16 }"
      class="mx-4 my-4"
    >
      <p class="mb-4 text-gray-500">
        只填写需要批量修改的字段，留空代表不修改。
      </p>
      <FormItem v-for="field in fields" :key="field.field" :label="field.label">
        <Input
          v-if="field.component === 'input'"
          v-model:value="formData[field.field]"
          :placeholder="field.placeholder || '留空表示不修改'"
        />
        <Input.TextArea
          v-else-if="field.component === 'textarea'"
          v-model:value="formData[field.field]"
          :placeholder="field.placeholder || '留空表示不修改'"
          :rows="3"
        />
        <RadioGroup
          v-else-if="field.component === 'radio'"
          v-model:value="formData[field.field]"
          :options="field.options"
        />
        <Select
          :popup-class-name="candidatePopupClass()"
          v-else-if="field.component === 'select'"
          v-model:value="formData[field.field]"
          :options="field.options"
          allow-clear
          class="w-full"
          show-search
          option-filter-prop="label"
          :placeholder="field.placeholder || '请选择'"
        />
        <TreeSelect
          :popup-class-name="candidatePopupClass()"
          v-else-if="field.component === 'tree-select'"
          v-model:value="formData[field.field]"
          :tree-data="field.treeData"
          :field-names="{ label: 'name', value: 'id', children: 'children' }"
          allow-clear
          class="w-full"
          show-search
          tree-node-filter-prop="name"
          :placeholder="field.placeholder || '请选择'"
        />
      </FormItem>
    </AForm>
  </Modal>
</template>
