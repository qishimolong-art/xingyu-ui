<script lang="ts" setup>
import { ref, onBeforeUnmount } from 'vue';
import ErpLazyPageSelect from '#/views/erp/components/ErpLazyPageSelect.vue';
import CustomerDeptSelect from './customer-dept-select.vue';
import {
  getCustomerFormDeptPage,
  getCustomerUserPage,
  getCustomerBaseOptionsPage,
  batchUpdateCustomer,
} from '#/api/erp/sale/customer';
import { loadCustomerRoleFields } from '../utils/field-visibility';

import { useVbenModal } from '@vben/common-ui';

import {
  Alert,
  Form as AForm,
  FormItem,
  Input,
  message,
  Radio,
  RadioGroup,
  Select,
} from 'ant-design-vue';

import { getBaseDataSimpleList } from '#/api/erp/base';
import { mapSelectablePriceLevelOptions } from '#/views/erp/sale/utils/price-level';

const emit = defineEmits(['success']);

interface BatchEditFormData {
  saleUserId?: number;
  developerUserId?: number;
  deptId?: number;
  deptIds?: number[];
  allowMultiDept?: boolean;
  status?: number;
  priceLevel?: number;
  routeId?: number;
  freightExplainId?: number;
  remark?: string;
}

const ids = ref<number[]>([]);
const formData = ref<BatchEditFormData>({});
const priceLevelOptions = ref<{ label: string; value: number }[]>([]);
const hiddenFields = ref<string[]>([]);
const isHidden = (field: string) =>
  hiddenFields.value.includes(field) ||
  hiddenFields.value.includes(`col_${field}`);
const ready = ref(false);
const saving = ref(false);
const loadError = ref('');
let sequence = 0;
onBeforeUnmount(() => {
  sequence += 1;
});

async function loadConfigOptions() {
  const current = sequence;
  const [priceLevels, hidden] = await Promise.all([
    getBaseDataSimpleList('price_level'),
    loadCustomerRoleFields(),
  ]);
  if (current !== sequence) return;
  priceLevelOptions.value = mapSelectablePriceLevelOptions(priceLevels || []);
  hiddenFields.value = hidden;
}

function filterSelectOption(input: string, option: any) {
  const keyword = input.trim().toLowerCase();
  const label = String(
    option?.label ?? option?.name ?? option?.title ?? option?.value ?? '',
  );
  return label.toLowerCase().includes(keyword);
}

function normalizeDeptIds(value: unknown): number[] {
  if (value === null || value === undefined || value === '') {
    return [];
  }
  const values = Array.isArray(value) ? value : [value];
  return values
    .map((item: any) => Number(item?.value ?? item))
    .filter((id): id is number => Number.isFinite(id));
}

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    if (!ready.value || saving.value || loadError.value) return;
    const current = sequence;
    if (ids.value.length === 0) {
      message.warning('请先选择要批量编辑的客户');
      return;
    }
    const payload: any = { ids: ids.value };
    if (!isHidden('deptId') && !isHidden('deptIds')) {
      const deptIds = normalizeDeptIds(formData.value.deptIds);
      if (deptIds.length) {
        payload.deptIds = Array.from(new Set(deptIds));
        if (formData.value.deptId !== undefined)
          payload.deptId = formData.value.deptId;
      }
    }
    if (
      !isHidden('allowMultiDept') &&
      formData.value.allowMultiDept !== undefined
    ) {
      payload.allowMultiDept = formData.value.allowMultiDept;
      if (formData.value.allowMultiDept === false) {
        delete payload.deptIds;
      }
    }
    (Object.keys(formData.value) as (keyof BatchEditFormData)[]).forEach(
      (key) => {
        if (
          key === 'deptIds' ||
          (key === 'deptId' && payload.deptId !== undefined) ||
          isHidden(key)
        ) {
          return;
        }
        const value = formData.value[key];
        if (value !== undefined && value !== null && value !== '') {
          payload[key] = value;
        }
      },
    );
    if (Object.keys(payload).length <= 1) {
      message.warning('请至少修改一个字段');
      return;
    }
    saving.value = true;
    modalApi.lock();
    const count = ids.value.length;
    try {
      await batchUpdateCustomer(payload);
      emit('success');
      if (current !== sequence) return;
      await modalApi.close();
      message.success(`已批量更新 ${count} 个客户`);
    } finally {
      if (current === sequence) {
        saving.value = false;
        modalApi.unlock();
      }
    }
  },
  async onOpenChange(isOpen: boolean) {
    const current = ++sequence;
    ready.value = false;
    saving.value = false;
    loadError.value = '';
    if (!isOpen) {
      formData.value = {};
      ids.value = [];
      return;
    }
    const data = modalApi.getData<{ ids: number[] }>();
    ids.value = data?.ids || [];
    formData.value = {};
    modalApi.setState({ confirmDisabled: true });
    try {
      await loadConfigOptions();
      if (current === sequence) {
        ready.value = true;
        modalApi.setState({ confirmDisabled: false });
      }
    } catch {
      if (current === sequence)
        loadError.value = '权限或选项加载失败，请关闭后重试';
    }
  },
});
</script>

<template>
  <Modal :title="`批量编辑客户（已选 ${ids.length} 个）`" class="w-[600px]">
    <Alert v-if="loadError" :message="loadError" type="error" show-icon />
    <AForm
      :label-col="{ span: 6 }"
      :wrapper-col="{ span: 16 }"
      class="mx-4 my-4 erp-form-focus-highlight"
    >
      <p class="mb-4 text-gray-500">
        只填写需要批量修改的字段，留空代表不修改。
      </p>
      <FormItem v-if="!isHidden('status')" label="状态">
        <RadioGroup v-model:value="formData.status">
          <Radio :value="0">启用</Radio>
          <Radio :value="1">禁用</Radio>
        </RadioGroup>
      </FormItem>
      <FormItem v-if="!isHidden('priceLevel')" label="价格级别">
        <Select
          v-model:value="formData.priceLevel"
          :options="priceLevelOptions"
          allow-clear
          show-search
          :filter-option="filterSelectOption"
          placeholder="请选择价格级别"
          class="w-full"
        />
      </FormItem>
      <FormItem v-if="!isHidden('routeId')" label="线路">
        <ErpLazyPageSelect
          v-model:value="formData.routeId"
          :api="
            (params) => getCustomerBaseOptionsPage({ ...params, type: 'route' })
          "
          label-field="name"
          value-field="id"
          placeholder="请选择线路"
          class="w-full"
        />
      </FormItem>
      <FormItem v-if="!isHidden('freightExplainId')" label="运费说明">
        <ErpLazyPageSelect
          v-model:value="formData.freightExplainId"
          :api="
            (params) =>
              getCustomerBaseOptionsPage({ ...params, type: 'freight_explain' })
          "
          label-field="name"
          value-field="id"
          placeholder="请选择运费说明"
          class="w-full"
        />
      </FormItem>
      <FormItem v-if="!isHidden('saleUserId')" label="业务员">
        <ErpLazyPageSelect
          v-model:value="formData.saleUserId"
          :api="getCustomerUserPage"
          label-field="nickname"
          value-field="id"
          placeholder="请选择业务员"
          class="w-full"
        />
      </FormItem>
      <FormItem v-if="!isHidden('developerUserId')" label="开发员">
        <ErpLazyPageSelect
          v-model:value="formData.developerUserId"
          :api="getCustomerUserPage"
          label-field="nickname"
          value-field="id"
          placeholder="请选择开发员"
          class="w-full"
        />
      </FormItem>
      <FormItem v-if="!isHidden('deptId')" label="部门">
        <ErpLazyPageSelect
          v-model:value="formData.deptId"
          :api="getCustomerFormDeptPage"
          label-field="name"
          value-field="id"
          placeholder="请选择部门"
          class="w-full"
        />
      </FormItem>
      <FormItem v-if="!isHidden('allowMultiDept')" label="允许多部门">
        <RadioGroup v-model:value="formData.allowMultiDept">
          <Radio :value="true">启用</Radio>
          <Radio :value="false">关闭</Radio>
        </RadioGroup>
      </FormItem>
      <FormItem
        v-if="
          !isHidden('deptId') &&
          !isHidden('deptIds') &&
          formData.allowMultiDept === true
        "
        label="适用部门"
      >
        <CustomerDeptSelect v-model:value="formData.deptIds" />
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
