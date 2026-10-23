<script lang="ts" setup>
import type { SystemDeptApi } from '#/api/system/dept';
import type { SystemUserApi } from '#/api/system/user';
import type { SystemUserRolePermissionApi } from '#/api/system/user/price-field';

import { computed, ref } from 'vue';

import { useAccess } from '@vben/access';
import { useVbenModal } from '@vben/common-ui';
import { CommonStatusEnum, DICT_TYPE } from '@vben/constants';
import { getDictOptions } from '@vben/hooks';
import { useAccessStore } from '@vben/stores';
import { handleTree } from '@vben/utils';

import {
  Alert,
  Form as AForm,
  Checkbox,
  FormItem,
  Input,
  message,
  Radio,
  RadioGroup,
  Select,
  Textarea,
  TreeSelect,
} from 'ant-design-vue';

import { getWarehouseAssignableList } from '#/api/erp/stock/warehouse';
import { getDeptList } from '#/api/system/dept';
import { getSimpleRoleList } from '#/api/system/role';
import { updateUserBatch } from '#/api/system/user';
import { getUserTenantVisitScope } from '#/api/system/user/price-field';
import { isFieldHidden } from '#/composables/useFieldPermission';

const emit = defineEmits(['success']);

interface BatchEditFormData {
  nickname?: string;
  deptIds?: number[];
  roleIds?: number[];
  email?: string;
  mobile?: string;
  sex?: number;
  status?: number;
  remark?: string;
  warehouseIds?: number[];
  tenantVisitTenantIds?: number[];
}

const ids = ref<number[]>([]);
const { hasAccessByCodes } = useAccess();
const accessStore = useAccessStore();
const hiddenFields = ref<string[]>([]);
const selectedUsers = ref<SystemUserApi.User[]>([]);
const formData = ref<BatchEditFormData>({});
const updateNickname = ref(false);
const updateDeptIds = ref(false);
const updateRoleIds = ref(false);
const updateEmail = ref(false);
const updateMobile = ref(false);
const updateSex = ref(false);
const updateStatus = ref(false);
const updateRemark = ref(false);
const updateWarehousePermissions = ref(false);
const updateTenantVisitScope = ref(false);
const warehousePermissionMode = ref<'ADD' | 'REMOVE' | 'REPLACE'>('ADD');
const tenantVisitScopeMode = ref<'ALL' | 'CLEAR' | 'CUSTOM'>('ALL');
const roleOptions = ref<{ label: string; value: number }[]>([]);
const deptTreeData = ref<any[]>([]);
const warehouseOptions = ref<{ label: string; value: number }[]>([]);
const tenantVisitOptions = ref<SystemUserRolePermissionApi.TenantVisitOption[]>(
  [],
);
const canUpdateWarehousePermissions = computed(() =>
  hasAccessByCodes(['erp:warehouse-permission:update']),
);
const canUpdateTenantVisitScope = computed(
  () =>
    Number(accessStore.tenantId) === 1 &&
    (accessStore.visitTenantId === null ||
      accessStore.visitTenantId === undefined) &&
    hasAccessByCodes(['system:tenant:visit-scope']),
);
const disabledSelectedUsers = computed(() =>
  selectedUsers.value.filter((user) => user.status !== CommonStatusEnum.ENABLE),
);
const tenantVisitSelectOptions = computed(() =>
  tenantVisitOptions.value.map((tenant) => ({
    disabled: !tenant.available,
    label: tenant.available
      ? tenant.name
      : `${tenant.name}（${tenant.unavailableReason || '不可用'}）`,
    value: tenant.id,
  })),
);
const sexOptions = getDictOptions(DICT_TYPE.SYSTEM_USER_SEX, 'number')
  .filter(
    (item) => typeof item.value === 'number' || typeof item.value === 'string',
  )
  .map((item) => ({
    label: item.label,
    value: item.value as number | string,
  }));

function isHidden(fieldKey: string) {
  return isFieldHidden(hiddenFields.value, fieldKey);
}

function filterSelectOption(input: string, option: any) {
  const keyword = input.trim().toLowerCase();
  const label = String(option?.label ?? option?.name ?? option?.value ?? '');
  return label.toLowerCase().includes(keyword);
}

function normalizeIds(values?: any[]) {
  if (!values?.length) {
    return [];
  }
  return values
    .map((item) => {
      if (typeof item === 'object' && item !== null) {
        return item.value;
      }
      return item;
    })
    .filter((item) => item !== undefined && item !== null);
}

async function loadOptions() {
  const [roles, depts, warehouses, tenantScope] = await Promise.all([
    getSimpleRoleList(),
    getDeptList(),
    canUpdateWarehousePermissions.value
      ? getWarehouseAssignableList()
      : Promise.resolve([]),
    canUpdateTenantVisitScope.value && ids.value.length > 0
      ? getUserTenantVisitScope(ids.value[0]!)
      : Promise.resolve(undefined),
  ]);
  roleOptions.value = (roles || [])
    .filter((role) => role.id !== undefined)
    .map((role) => ({
      label: role.name,
      value: role.id!,
    }));
  deptTreeData.value = handleTree((depts || []) as SystemDeptApi.Dept[]);
  warehouseOptions.value = (warehouses || [])
    .filter((warehouse) => warehouse.id !== undefined)
    .map((warehouse) => ({
      label: warehouse.name,
      value: warehouse.id!,
    }));
  tenantVisitOptions.value = tenantScope?.tenantOptions ?? [];
}

function resetForm() {
  ids.value = [];
  hiddenFields.value = [];
  selectedUsers.value = [];
  formData.value = {};
  updateNickname.value = false;
  updateDeptIds.value = false;
  updateRoleIds.value = false;
  updateEmail.value = false;
  updateMobile.value = false;
  updateSex.value = false;
  updateStatus.value = false;
  updateRemark.value = false;
  updateWarehousePermissions.value = false;
  updateTenantVisitScope.value = false;
  warehousePermissionMode.value = 'ADD';
  tenantVisitScopeMode.value = 'ALL';
  warehouseOptions.value = [];
  tenantVisitOptions.value = [];
}

function buildPayload(): SystemUserApi.UserBatchUpdateReq | undefined {
  const payload: SystemUserApi.UserBatchUpdateReq = { ids: ids.value };
  if (!isHidden('nickname') && updateNickname.value) {
    if (!formData.value.nickname?.trim()) {
      message.warning('请输入名称');
      return;
    }
    payload.updateNickname = true;
    payload.nickname = formData.value.nickname.trim();
  }
  if (!isHidden('deptIds') && !isHidden('deptName') && updateDeptIds.value) {
    const deptIds = normalizeIds(formData.value.deptIds);
    if (!deptIds.length) {
      message.warning('请选择归属部门');
      return;
    }
    payload.updateDeptIds = true;
    payload.deptIds = deptIds;
  }
  if (!isHidden('roleIds') && !isHidden('roleNames') && updateRoleIds.value) {
    if (!formData.value.roleIds?.length) {
      message.warning('请选择角色');
      return;
    }
    payload.updateRoleIds = true;
    payload.roleIds = formData.value.roleIds;
  }
  if (!isHidden('email') && updateEmail.value) {
    if (ids.value.length > 1 && formData.value.email?.trim()) {
      message.warning('邮箱不能批量设置为同一个非空值');
      return;
    }
    payload.updateEmail = true;
    payload.email = formData.value.email?.trim() || '';
  }
  if (!isHidden('mobile') && updateMobile.value) {
    if (!formData.value.mobile?.trim()) {
      message.warning('请输入手机号码');
      return;
    }
    if (ids.value.length > 1) {
      message.warning('手机号码不能批量设置为同一个非空值');
      return;
    }
    payload.updateMobile = true;
    payload.mobile = formData.value.mobile.trim();
  }
  if (!isHidden('sex') && updateSex.value) {
    if (formData.value.sex === undefined) {
      message.warning('请选择用户性别');
      return;
    }
    payload.updateSex = true;
    payload.sex = formData.value.sex;
  }
  if (!isHidden('status') && updateStatus.value) {
    if (formData.value.status === undefined) {
      message.warning('请选择用户状态');
      return;
    }
    payload.updateStatus = true;
    payload.status = formData.value.status;
  }
  if (!isHidden('remark') && updateRemark.value) {
    payload.updateRemark = true;
    payload.remark = formData.value.remark ?? '';
  }
  if (canUpdateWarehousePermissions.value && updateWarehousePermissions.value) {
    const warehouseIds = normalizeIds(formData.value.warehouseIds);
    if (!warehousePermissionMode.value) {
      message.warning('请选择仓库权限修改模式');
      return;
    }
    if (warehousePermissionMode.value !== 'REPLACE' && !warehouseIds.length) {
      message.warning('请选择仓库');
      return;
    }
    payload.updateWarehousePermissions = true;
    payload.warehousePermissionMode = warehousePermissionMode.value;
    payload.warehouseIds = warehouseIds;
  }
  if (canUpdateTenantVisitScope.value && updateTenantVisitScope.value) {
    if (disabledSelectedUsers.value.length > 0) {
      message.warning('停用用户不能配置租户访问范围，请取消选择后重试');
      return;
    }
    const tenantIds = normalizeIds(formData.value.tenantVisitTenantIds);
    if (tenantVisitScopeMode.value === 'CUSTOM' && tenantIds.length === 0) {
      message.warning('指定租户模式至少选择一个租户');
      return;
    }
    payload.updateTenantVisitScope = true;
    payload.tenantVisitScope =
      tenantVisitScopeMode.value === 'CLEAR'
        ? { clear: true }
        : {
            scopeType: tenantVisitScopeMode.value,
            tenantIds: tenantVisitScopeMode.value === 'CUSTOM' ? tenantIds : [],
          };
  }

  const hasUpdatedField = Object.keys(payload).some((key) =>
    key.startsWith('update'),
  );
  if (!hasUpdatedField) {
    message.warning('请至少选择一个需要修改的字段');
    return;
  }
  return payload;
}

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    if (ids.value.length === 0) {
      message.warning('请先选择需要批量修改的用户');
      return;
    }
    const payload = buildPayload();
    if (!payload) {
      return;
    }
    modalApi.lock();
    try {
      await updateUserBatch(payload);
      await modalApi.close();
      emit('success');
      message.success(`已批量更新 ${ids.value.length} 个用户`);
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      resetForm();
      return;
    }
    const data = modalApi.getData<{
      hiddenFields?: string[];
      ids: number[];
      users?: SystemUserApi.User[];
    }>();
    ids.value = data?.ids || [];
    selectedUsers.value = data?.users || [];
    hiddenFields.value = data?.hiddenFields || [];
    formData.value = {};
    await loadOptions();
  },
});
</script>

<template>
  <Modal :title="`批量修改用户（已选 ${ids.length} 个）`" class="w-[760px]">
    <AForm
      :label-col="{ span: 6 }"
      :wrapper-col="{ span: 16 }"
      class="mx-4 my-4"
    >
      <p class="mb-4 text-gray-500">
        勾选需要批量修改的字段，未勾选代表不修改；角色和部门会替换为本次选择的值。
      </p>
      <FormItem v-if="!isHidden('nickname')" label="名称">
        <Checkbox v-model:checked="updateNickname" class="mb-2">
          修改名称
        </Checkbox>
        <Input
          v-model:value="formData.nickname"
          :disabled="!updateNickname"
          allow-clear
          placeholder="请输入名称"
        />
      </FormItem>
      <FormItem
        v-if="!isHidden('deptIds') && !isHidden('deptName')"
        label="归属部门"
      >
        <Checkbox v-model:checked="updateDeptIds" class="mb-2">
          修改归属部门
        </Checkbox>
        <TreeSelect
          v-model:value="formData.deptIds"
          :disabled="!updateDeptIds"
          :field-names="{ label: 'name', value: 'id', children: 'children' }"
          :tree-data="deptTreeData"
          allow-clear
          class="w-full"
          multiple
          placeholder="请选择归属部门"
          show-search
          tree-check-strictly
          tree-checkable
          tree-default-expand-all
          tree-node-filter-prop="name"
        />
      </FormItem>
      <FormItem
        v-if="!isHidden('roleIds') && !isHidden('roleNames')"
        label="角色"
      >
        <Checkbox v-model:checked="updateRoleIds" class="mb-2">
          修改角色
        </Checkbox>
        <Select
          v-model:value="formData.roleIds"
          :disabled="!updateRoleIds"
          :filter-option="filterSelectOption"
          :options="roleOptions"
          allow-clear
          class="w-full"
          mode="multiple"
          placeholder="请选择角色"
          show-search
        />
      </FormItem>
      <FormItem v-if="canUpdateWarehousePermissions" label="仓库权限">
        <Checkbox v-model:checked="updateWarehousePermissions" class="mb-2">
          修改仓库权限
        </Checkbox>
        <RadioGroup
          v-model:value="warehousePermissionMode"
          :disabled="!updateWarehousePermissions"
          class="mb-2 block"
        >
          <Radio value="ADD">追加</Radio>
          <Radio value="REMOVE">移除</Radio>
          <Radio value="REPLACE">替换</Radio>
        </RadioGroup>
        <Select
          v-model:value="formData.warehouseIds"
          :disabled="!updateWarehousePermissions"
          :filter-option="filterSelectOption"
          :options="warehouseOptions"
          allow-clear
          class="w-full"
          mode="multiple"
          placeholder="请选择仓库"
          show-search
        />
      </FormItem>
      <FormItem v-if="canUpdateTenantVisitScope" label="租户访问范围">
        <Checkbox v-model:checked="updateTenantVisitScope" class="mb-2">
          修改租户访问范围
        </Checkbox>
        <Alert
          v-if="updateTenantVisitScope"
          class="mb-3"
          message="设置范围会自动开通访问租户能力；暂不开放会清空范围并回收系统自动角色。本操作将覆盖所选用户原有范围。"
          show-icon
          type="info"
        />
        <Alert
          v-if="updateTenantVisitScope && disabledSelectedUsers.length"
          class="mb-3"
          :message="`以下停用用户不能配置：${disabledSelectedUsers
            .map((user) => user.nickname || user.mobile || user.id)
            .join('、')}`"
          show-icon
          type="error"
        />
        <RadioGroup
          v-model:value="tenantVisitScopeMode"
          :disabled="!updateTenantVisitScope"
          class="mb-2 block"
        >
          <Radio value="ALL">全部租户</Radio>
          <Radio value="CUSTOM">指定租户</Radio>
          <Radio value="CLEAR">暂不开放</Radio>
        </RadioGroup>
        <Select
          v-if="tenantVisitScopeMode === 'CUSTOM'"
          v-model:value="formData.tenantVisitTenantIds"
          :disabled="!updateTenantVisitScope"
          :filter-option="filterSelectOption"
          :options="tenantVisitSelectOptions"
          allow-clear
          class="w-full"
          mode="multiple"
          placeholder="搜索并选择允许访问的租户"
          show-search
        />
      </FormItem>
      <FormItem v-if="!isHidden('email')" label="邮箱">
        <Checkbox v-model:checked="updateEmail" class="mb-2">
          修改邮箱
        </Checkbox>
        <Input
          v-model:value="formData.email"
          :disabled="!updateEmail"
          allow-clear
          placeholder="请输入邮箱；多选用户时仅支持清空"
        />
      </FormItem>
      <FormItem v-if="!isHidden('mobile')" label="手机号码">
        <Checkbox v-model:checked="updateMobile" class="mb-2">
          修改手机号码
        </Checkbox>
        <Input
          v-model:value="formData.mobile"
          :disabled="!updateMobile"
          allow-clear
          placeholder="请输入手机号码；多选用户不支持批量设置"
        />
      </FormItem>
      <FormItem v-if="!isHidden('sex')" label="用户性别">
        <Checkbox v-model:checked="updateSex" class="mb-2">
          修改用户性别
        </Checkbox>
        <Select
          v-model:value="formData.sex"
          :disabled="!updateSex"
          :options="sexOptions"
          allow-clear
          class="w-full"
          placeholder="请选择用户性别"
        />
      </FormItem>
      <FormItem v-if="!isHidden('status')" label="用户状态">
        <Checkbox v-model:checked="updateStatus" class="mb-2">
          修改用户状态
        </Checkbox>
        <RadioGroup v-model:value="formData.status">
          <Radio :disabled="!updateStatus" :value="CommonStatusEnum.ENABLE"
            >启用</Radio
          >
          <Radio :disabled="!updateStatus" :value="CommonStatusEnum.DISABLE"
            >禁用</Radio
          >
        </RadioGroup>
      </FormItem>
      <FormItem v-if="!isHidden('remark')" label="备注">
        <Checkbox v-model:checked="updateRemark" class="mb-2">
          修改备注
        </Checkbox>
        <Textarea
          v-model:value="formData.remark"
          :disabled="!updateRemark"
          allow-clear
          placeholder="请输入备注"
        />
      </FormItem>
    </AForm>
  </Modal>
</template>
