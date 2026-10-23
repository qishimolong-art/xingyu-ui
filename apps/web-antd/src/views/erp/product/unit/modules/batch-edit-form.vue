<script lang="ts" setup>
import { ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { CommonStatusEnum } from '@vben/constants';

import {
  Form as AForm,
  FormItem,
  message,
  RadioButton,
  RadioGroup,
} from 'ant-design-vue';

import { batchUpdateProductUnit } from '#/api/erp/product/unit';
import { useFieldPermission } from '#/composables/useFieldPermission';

const emit = defineEmits(['success']);

const ids = ref<number[]>([]);
const status = ref<number>();
const { isHidden, loadHiddenFields } = useFieldPermission('erp_product_unit');

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    if (ids.value.length === 0) {
      message.warning('请先勾选至少一个配件单位');
      return;
    }
    if (isHidden('status')) {
      message.warning('当前角色无权批量修改单位状态');
      return;
    }
    if (status.value === undefined || status.value === null) {
      message.warning('请选择单位状态');
      return;
    }
    modalApi.lock();
    try {
      await batchUpdateProductUnit({ ids: ids.value, status: status.value });
      await modalApi.close();
      emit('success');
      message.success(`已批量更新 ${ids.value.length} 个配件单位`);
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      ids.value = [];
      status.value = undefined;
      return;
    }
    const data = modalApi.getData<{ ids: number[] }>();
    ids.value = data?.ids || [];
    status.value = undefined;
    await loadHiddenFields();
  },
});
</script>

<template>
  <Modal :title="`批量修改配件单位（已选 ${ids.length} 个）`" class="w-[520px]">
    <AForm
      :label-col="{ span: 6 }"
      :wrapper-col="{ span: 16 }"
      class="product-unit-batch-form mx-4 my-4"
    >
      <p class="mb-4 text-gray-500">当前仅支持批量修改单位状态。</p>
      <FormItem v-if="!isHidden('status')" label="单位状态">
        <RadioGroup v-model:value="status" button-style="solid" class="w-full">
          <RadioButton :value="CommonStatusEnum.ENABLE">启用</RadioButton>
          <RadioButton :value="CommonStatusEnum.DISABLE">禁用</RadioButton>
        </RadioGroup>
      </FormItem>
    </AForm>
  </Modal>
</template>

<style scoped>
.product-unit-batch-form {
  font-size: 12px;
}

.product-unit-batch-form p,
.product-unit-batch-form :deep(.ant-form-item-label > label),
.product-unit-batch-form :deep(.ant-radio-button-wrapper) {
  font-size: 12px;
}

.product-unit-batch-form :deep(.ant-radio-group) {
  display: flex;
}

.product-unit-batch-form :deep(.ant-radio-button-wrapper) {
  flex: 1;
  height: 32px;
  line-height: 30px;
  text-align: center;
}
</style>
