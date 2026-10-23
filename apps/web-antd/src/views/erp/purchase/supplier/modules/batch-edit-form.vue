<script lang="ts" setup>
import { onBeforeUnmount, ref } from 'vue';

import { useAccess } from '@vben/access';
import { useVbenModal } from '@vben/common-ui';

import {
  Form as AForm,
  Alert,
  FormItem,
  Input,
  message,
  Radio,
  RadioGroup,
} from 'ant-design-vue';

import {
  batchUpdateSupplier,
  getSupplierAssignableUsersPage,
  getSupplierBaseOptionsPage,
  getSupplierFormDeptPage,
} from '#/api/erp/purchase/supplier';
import { isFieldHidden } from '#/composables/useFieldPermission';
import ErpLazyPageSelect from '#/views/erp/components/ErpLazyPageSelect.vue';

import { loadSupplierFieldVisibility } from '../utils/field-visibility';
import { useSupplierFormKeyboard } from '../utils/form-keyboard';
import SupplierDeptSelect from './supplier-dept-select.vue';

import '#/views/erp/styles/form-focus.css';

const emit = defineEmits(['success']);

interface BatchEditFormData {
  status?: number;
  deptId?: number;
  deptIds?: number[];
  allowMultiDept?: boolean;
  region?: string;
  purchaser?: string;
  settleMethod?: string;
  remark?: string;
}

const ids = ref<number[]>([]);
const formData = ref<BatchEditFormData>({});
const loaded = ref(false);
const saving = ref(false);
const loadError = ref('');
let sequence = 0;
const { hasAccessByCodes } = useAccess();
const { beginOpen, endOpen, formScope, handleFormEnter, onOpened, queueFocus } =
  useSupplierFormKeyboard(
    () => true,
    () => loaded.value && !saving.value && !loadError.value,
  );
function setFormScope(element: unknown) {
  formScope.value = element instanceof HTMLElement ? element : undefined;
}

onBeforeUnmount(() => {
  sequence += 1;
});
const regionPage = (params: any) =>
  getSupplierBaseOptionsPage({ ...params, type: 'region', status: 0 });
const settlePage = (params: any) =>
  getSupplierBaseOptionsPage({ ...params, type: 'settle_method', status: 0 });
const hiddenFields = ref<string[]>([]);
function isHidden(field: string) {
  return isFieldHidden(hiddenFields.value, field);
}
async function loadHiddenFields() {
  const snapshot = await loadSupplierFieldVisibility();
  hiddenFields.value = [
    ...snapshot.hiddenFields,
    ...snapshot.configHiddenFields,
  ];
}

function normalizeDeptIds(value: unknown): number[] {
  if (value === null || value === undefined || value === '') {
    return [];
  }
  const values = Array.isArray(value) ? value : [value];
  return values
    .map((item: any) => Number(item?.value ?? item))
    .filter((id) => Number.isFinite(id));
}

const [Modal, modalApi] = useVbenModal({
  onOpened,
  async onConfirm() {
    if (
      !loaded.value ||
      loadError.value ||
      saving.value ||
      !hasAccessByCodes(['erp:supplier:update'])
    )
      return;
    const current = sequence;
    if (ids.value.length === 0) {
      message.warning('请先选择要批量编辑的供应商');
      return;
    }
    const payload: any = { ids: ids.value };
    if (!isHidden('deptId')) {
      const deptIds = normalizeDeptIds(formData.value.deptIds);
      if (deptIds.length > 0) {
        payload.deptIds = [...new Set(deptIds)];
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
    const count = ids.value.length;
    saving.value = true;
    modalApi.lock();
    try {
      await batchUpdateSupplier(payload);
      if (current === sequence) await modalApi.close();
      emit('success');
      message.success(`已批量更新 ${count} 个供应商`);
    } finally {
      if (current === sequence) {
        saving.value = false;
        modalApi.unlock();
      }
    }
  },
  async onOpenChange(isOpen: boolean) {
    const current = ++sequence;
    loaded.value = false;
    saving.value = false;
    loadError.value = '';
    if (!isOpen) {
      endOpen();
      formData.value = {};
      ids.value = [];
      return;
    }
    beginOpen();
    const data = modalApi.getData<{ ids: number[] }>();
    ids.value = data?.ids || [];
    formData.value = {};
    try {
      await loadHiddenFields();
      if (current !== sequence) return;
      loaded.value = true;
      queueFocus();
    } catch {
      if (current === sequence) loadError.value = '权限加载失败，请关闭后重试';
    }
  },
});
</script>

<template>
  <Modal :title="`批量编辑供应商（已选 ${ids.length} 个）`" class="w-[600px]">
    <div
      :ref="setFormScope"
      class="erp-form-focus-highlight"
      @keydown.enter.capture="handleFormEnter"
    >
      <Alert v-if="loadError" :message="loadError" type="error" show-icon />
      <AForm
        :label-col="{ span: 6 }"
        :wrapper-col="{ span: 16 }"
        class="mx-4 my-4"
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
        <FormItem v-if="!isHidden('deptId')" label="所属部门">
          <ErpLazyPageSelect
            v-model:value="formData.deptId"
            :api="getSupplierFormDeptPage"
            label-field="name"
            value-field="id"
            :page-size="20"
          />
        </FormItem>
        <FormItem v-if="!isHidden('allowMultiDept')" label="允许多部门">
          <RadioGroup v-model:value="formData.allowMultiDept">
            <Radio :value="false">否</Radio>
            <Radio :value="true">是</Radio>
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
          <SupplierDeptSelect v-model:value="formData.deptIds" />
        </FormItem>
        <FormItem v-if="!isHidden('region')" label="区域">
          <ErpLazyPageSelect
            v-model:value="formData.region"
            :api="regionPage"
            label-field="name"
            value-field="name"
          />
        </FormItem>
        <FormItem v-if="!isHidden('purchaser')" label="采购员">
          <ErpLazyPageSelect
            v-model:value="formData.purchaser"
            :api="getSupplierAssignableUsersPage"
            label-field="nickname"
            value-field="id"
          />
        </FormItem>
        <FormItem v-if="!isHidden('settleMethod')" label="结算方式">
          <ErpLazyPageSelect
            v-model:value="formData.settleMethod"
            :api="settlePage"
            label-field="name"
            value-field="name"
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
    </div>
  </Modal>
</template>
