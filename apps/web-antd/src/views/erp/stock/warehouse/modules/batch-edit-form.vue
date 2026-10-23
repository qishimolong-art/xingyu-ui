<script lang="ts" setup>
import { ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { CommonStatusEnum } from '@vben/constants';

import {
  Form as AForm,
  FormItem,
  Input,
  message,
  Radio,
  RadioGroup,
  Select,
} from 'ant-design-vue';

import {
  batchUpdateWarehouse,
  getWarehouseFormDeptSimplePage,
} from '#/api/erp/stock/warehouse';
import { useFieldPermission } from '#/composables/useFieldPermission';
import ErpLazyPageSelect from '#/views/erp/components/ErpLazyPageSelect.vue';

import { parseWarehouseNumber } from '../warehouse-input';

import '#/views/erp/styles/form-focus.css';

const emit = defineEmits(['success']);

interface BatchEditFormData {
  deptId?: number;
  purchaseEnabled?: boolean;
  remark?: string;
  saleEnabled?: boolean;
  scanControl?: boolean;
  sort?: number | string;
  splitOrder?: boolean;
  status?: number;
  stockBillEnabled?: boolean;
  warehouseType?: number;
}

const warehouseTypeOptions = [
  { label: '物理仓', value: 1 },
  { label: '虚拟仓', value: 2 },
];

const booleanOptions = [
  { label: '是', value: true },
  { label: '否', value: false },
];

const ids = ref<number[]>([]);
const formData = ref<BatchEditFormData>({});
const loading = ref(false);
const loadFailed = ref(false);
let loadSequence = 0;
const { isHidden, loadHiddenFields } = useFieldPermission('erp_warehouse');

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    if (loading.value || loadFailed.value) return;
    if (ids.value.length === 0) {
      message.warning('请先勾选至少一个仓库');
      return;
    }
    const payload: Record<string, any> = { ids: ids.value };
    (Object.keys(formData.value) as (keyof BatchEditFormData)[]).forEach(
      (key) => {
        if (isHidden(key) || key === 'stockBillEnabled') {
          return;
        }
        const value = formData.value[key];
        if (value !== undefined && value !== null && value !== '') {
          payload[key] = value;
        }
      },
    );
    if ('sort' in payload) {
      const number = parseWarehouseNumber(payload.sort);
      if (!Number.isFinite(number)) {
        message.warning('排序必须为有效整数');
        return;
      }
      payload.sort = number;
    }
    if (Object.keys(payload).length <= 1) {
      message.warning('请至少修改一个字段');
      return;
    }
    modalApi.lock();
    try {
      const count = ids.value.length;
      await batchUpdateWarehouse(payload as any);
      await modalApi.close();
      emit('success');
      message.success(`已批量更新 ${count} 个仓库`);
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen: boolean) {
    const sequence = ++loadSequence;
    if (!isOpen) {
      loading.value = false;
      formData.value = {};
      ids.value = [];
      return;
    }
    const data = modalApi.getData<{ ids: number[] }>();
    ids.value = data?.ids || [];
    formData.value = {};
    loading.value = true;
    loadFailed.value = false;
    try {
      await loadHiddenFields();
    } catch {
      if (sequence === loadSequence) loadFailed.value = true;
    } finally {
      if (sequence === loadSequence) loading.value = false;
    }
  },
});
</script>

<template>
  <Modal
    :title="`批量修改仓库（已选 ${ids.length} 个）`"
    class="w-[600px] max-w-[calc(100vw-32px)]"
    :confirm-disabled="loading || loadFailed"
  >
    <AForm
      :label-col="{ span: 6 }"
      :wrapper-col="{ span: 16 }"
      class="erp-form-focus-highlight mx-4 my-4"
    >
      <p v-if="loadFailed" class="text-red-500">权限加载失败，请关闭后重试。</p>
      <p class="mb-4 text-gray-500">
        只填写需要批量修改的字段，留空代表不修改。
      </p>
      <FormItem v-if="!isHidden('status')" label="开启状态">
        <RadioGroup v-model:value="formData.status">
          <Radio :value="CommonStatusEnum.ENABLE">启用</Radio>
          <Radio :value="CommonStatusEnum.DISABLE">禁用</Radio>
        </RadioGroup>
      </FormItem>
      <FormItem v-if="!isHidden('deptId')" label="所属部门">
        <ErpLazyPageSelect
          v-model:value="formData.deptId"
          :api="getWarehouseFormDeptSimplePage"
          label-field="name"
          value-field="id"
          :page-size="20"
          allow-clear
          show-search
          placeholder="请选择所属部门"
          class="w-full"
        />
      </FormItem>
      <FormItem v-if="!isHidden('warehouseType')" label="仓库类型">
        <Select
          v-model:value="formData.warehouseType"
          :options="warehouseTypeOptions"
          allow-clear
          placeholder="请选择仓库类型"
          class="w-full"
        />
      </FormItem>
      <FormItem v-if="!isHidden('saleEnabled')" label="销售启用">
        <RadioGroup
          v-model:value="formData.saleEnabled"
          :options="booleanOptions"
        />
      </FormItem>
      <FormItem v-if="!isHidden('purchaseEnabled')" label="采购启用">
        <RadioGroup
          v-model:value="formData.purchaseEnabled"
          :options="booleanOptions"
        />
      </FormItem>
      <FormItem v-if="!isHidden('stockBillEnabled')" label="历史领货设置">
        <span class="text-gray-500">不再修改；新业务审核后直接增减库存。</span>
      </FormItem>
      <FormItem v-if="!isHidden('scanControl')" label="扫码管控">
        <RadioGroup
          v-model:value="formData.scanControl"
          :options="booleanOptions"
        />
      </FormItem>
      <FormItem v-if="!isHidden('splitOrder')" label="是否拆单">
        <RadioGroup
          v-model:value="formData.splitOrder"
          :options="booleanOptions"
        />
      </FormItem>
      <FormItem v-if="!isHidden('sort')" label="排序">
        <Input
          v-model:value="formData.sort"
          inputmode="numeric"
          placeholder="留空表示不修改"
          class="w-full"
        />
      </FormItem>
      <FormItem v-if="!isHidden('remark')" label="备注">
        <Input.TextArea
          v-model:value="formData.remark"
          :rows="3"
          placeholder="留空表示不修改"
        />
      </FormItem>
    </AForm>
  </Modal>
</template>
