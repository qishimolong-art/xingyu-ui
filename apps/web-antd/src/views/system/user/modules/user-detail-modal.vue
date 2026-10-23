<script lang="ts" setup>
import type { SystemMenuApi } from '#/api/system/menu';
import type { SystemUserApi } from '#/api/system/user';
import type { SystemUserRolePermissionApi } from '#/api/system/user/price-field';

import { computed, ref } from 'vue';

import { useAccess } from '@vben/access';
import { useVbenModal } from '@vben/common-ui';
import { useAccessStore } from '@vben/stores';
import { isEqual } from '@vben/utils';

import {
  Alert,
  Button,
  Checkbox,
  Divider,
  message,
  Radio,
  RadioGroup,
  Select,
  Tabs,
  Tag,
} from 'ant-design-vue';

import { useVbenForm } from '#/adapter/form';
import { getDeptList } from '#/api/system/dept';
import { getSimpleMenusList } from '#/api/system/menu';
import { getRoleMenuList } from '#/api/system/permission';
import { getUser, updateUser } from '#/api/system/user';
import {
  getUserPriceFields,
  getUserRolePermissions,
  getUserTenantVisitScope,
  saveUserPriceFields,
  saveUserRolePermissions,
} from '#/api/system/user/price-field';
import { clearFieldPermissionCache } from '#/composables/useFieldPermission';

import { formatDeptTreeSelectValues, useFormSchema } from '../data';

const TabPane = Tabs.TabPane;
const BUTTON_MENU_TYPE = 3;
const TENANT_VISIT_PERMISSION = 'system:tenant:visit';
const TENANT_VISIT_SCOPE_PERMISSION = 'system:tenant:visit-scope';
const SYSTEM_TENANT_ID = 1;
type DetailModalType = 'detail' | 'edit';
type RoleOption = {
  code?: string;
  id: number;
  managed?: boolean;
  name: string;
};

const ALL_PRICE_FIELDS: Array<{ code: string; label: string }> = [
  { code: 'purchasePrice', label: '采购价' },
  { code: 'salePrice', label: '销售价' },
  { code: 'minPrice', label: '最低价' },
  { code: 'referencePrice', label: '参考价' },
  { code: 'retailPrice', label: '零售价' },
  { code: 'lastPurchasePrice', label: '最后采购入库价' },
  { code: 'grossProfitRate', label: '毛利率（%）' },
  { code: 'backupPrice1', label: '备用价1' },
  { code: 'wholesalePrice', label: '批发价' },
  { code: 'sharePrice', label: '股份价' },
];

const emit = defineEmits(['success']);

const userData = ref<SystemUserApi.User | null>(null);
const hiddenFields = ref<string[]>([]);
const activeTab = ref('basicInfo');
const formType = ref<DetailModalType>('detail');
const isDetail = computed(() => formType.value === 'detail');
const canSubmit = computed(() => !isDetail.value);
const { hasAccessByCodes } = useAccess();
const accessStore = useAccessStore();
const canEditFromDetail = computed(
  () =>
    isDetail.value &&
    !!userData.value?.id &&
    hasAccessByCodes(['system:user:update']),
);
const modalTitle = computed(() => {
  const displayName = userData.value?.nickname ?? userData.value?.mobile ?? '';
  return `${isDetail.value ? '用户详情' : '用户设置'} — ${displayName}`.trim();
});

// ========== Tab1：基本信息 ==========
const basicInfoSaving = ref(false);
const initialBasicInfo = ref<SystemUserApi.User | null>(null);

type DeptSelectValue =
  | Array<number | string | { value?: number | string }>
  | null
  | number
  | string
  | undefined
  | { value?: number | string };
type BasicInfoFormValues = SystemUserApi.User & {
  deptIds?: DeptSelectValue;
  deptId?: DeptSelectValue;
};

function normalizeDeptIds(value: DeptSelectValue): number[] {
  const values = Array.isArray(value) ? value : [];
  if (!Array.isArray(value) && value !== undefined && value !== null) {
    values.push(value as number | string | { value?: number | string });
  }
  return [
    ...new Set(
      values
        .map((item) =>
          typeof item === 'object'
            ? (item as { value?: number | string }).value
            : item,
        )
        .map(Number)
        .filter((item) => Number.isFinite(item)),
    ),
  ];
}

const [BasicInfoForm, basicInfoFormApi] = useVbenForm({
  commonConfig: {
    componentProps: { class: 'w-full' },
    formItemClass: 'col-span-2',
    labelWidth: 80,
  },
  layout: 'horizontal',
  schema: useFormSchema([]),
  showDefaultActions: false,
});

function toBasicInfoSubmitData(raw: BasicInfoFormValues) {
  const deptIds = normalizeDeptIds(raw.deptIds ?? raw.deptId);
  const submitData: SystemUserApi.User = {
    ...raw,
    deptId: deptIds[0] as number,
    deptIds,
  };
  delete (submitData as Record<string, any>).dataScope;
  delete (submitData as Record<string, any>).dataScopeDeptIds;
  if (submitData.mobile) {
    submitData.username = submitData.mobile;
  }
  return submitData;
}

async function loadBasicInfo(userId: number) {
  const [data, departments] = await Promise.all([
    getUser(userId),
    getDeptList(),
  ]);
  const deptIds = normalizeDeptIds(data?.deptIds ?? data?.deptId);
  await basicInfoFormApi.setValues({
    ...data,
    deptId: deptIds[0],
    deptIds: formatDeptTreeSelectValues(deptIds, departments),
  });
  initialBasicInfo.value = toBasicInfoSubmitData(
    await basicInfoFormApi.getValues<BasicInfoFormValues>(),
  );
}

async function handleSaveBasicInfo(): Promise<boolean> {
  if (isDetail.value) return false;
  if (!userData.value?.id) return false;
  const { valid } = await basicInfoFormApi.validate();
  if (!valid) return false;
  basicInfoSaving.value = true;
  try {
    const submitData = toBasicInfoSubmitData(
      await basicInfoFormApi.getValues<BasicInfoFormValues>(),
    );
    if (isEqual(submitData, initialBasicInfo.value)) {
      return true;
    }
    await updateUser(submitData);
    initialBasicInfo.value = submitData;
    return true;
  } finally {
    basicInfoSaving.value = false;
  }
}

// ========== Tab2：价格字段 ==========
const priceFields = ref<Array<{ code: string; label: string }>>([]);
const checkedFieldCodes = ref<string[]>([]);
const initialCheckedFieldCodes = ref<string[]>([]);
const priceFieldLoading = ref(false);

function normalizeStringList(values: string[]) {
  return [...new Set(values)].toSorted();
}

async function loadPriceFields(userId: number) {
  priceFieldLoading.value = true;
  try {
    const list = await getUserPriceFields(userId);
    priceFields.value =
      list.length > 0
        ? list.map((item) => ({
            code: item.priceFieldCode,
            label: item.priceFieldLabel || item.priceFieldCode,
          }))
        : ALL_PRICE_FIELDS;
    if (list.length === 0) {
      checkedFieldCodes.value = ALL_PRICE_FIELDS.map((item) => item.code);
      initialCheckedFieldCodes.value = normalizeStringList(
        checkedFieldCodes.value,
      );
      return;
    }
    checkedFieldCodes.value = list
      .filter((item) => item.visible)
      .map((item) => item.priceFieldCode);
    initialCheckedFieldCodes.value = normalizeStringList(
      checkedFieldCodes.value,
    );
  } finally {
    priceFieldLoading.value = false;
  }
}

async function handleSavePriceFields(): Promise<boolean> {
  if (isDetail.value) return false;
  if (!userData.value?.id) return false;
  priceFieldLoading.value = true;
  try {
    const normalizedFieldCodes = normalizeStringList(checkedFieldCodes.value);
    if (isEqual(normalizedFieldCodes, initialCheckedFieldCodes.value)) {
      return true;
    }
    await saveUserPriceFields({
      userId: userData.value.id,
      fieldCodes: checkedFieldCodes.value,
    });
    initialCheckedFieldCodes.value = normalizedFieldCodes;
    clearFieldPermissionCache('erp_product');
    return true;
  } finally {
    priceFieldLoading.value = false;
  }
}

function toggleField(code: string) {
  if (isDetail.value) return;
  const idx = checkedFieldCodes.value.indexOf(code);
  if (idx >= 0) {
    checkedFieldCodes.value.splice(idx, 1);
  } else {
    checkedFieldCodes.value.push(code);
  }
}

// ========== Tab3：角色与权限 ==========
const allRoles = ref<RoleOption[]>([]);
const selectedRoleIds = ref<number[]>([]);
const initialRoleIds = ref<number[]>([]);
const permissionItems = ref<SystemUserRolePermissionApi.PermissionInfo[]>([]);
const checkedPermissionCodes = ref<string[]>([]);
const initialDeniedPermissions = ref<string[]>([]);
const permLoading = ref(false);
const allMenus = ref<SystemMenuApi.Menu[]>([]);
const roleMenuIdsCache = new Map<number, Set<number>>();
let rolePermissionSeq = 0;

type TenantVisitScopeType = 'ALL' | 'CLEAR' | 'CUSTOM';
const tenantVisitScopeConfigured = ref(false);
const tenantVisitScopeType = ref<TenantVisitScopeType>();
const tenantVisitTenantIds = ref<number[]>([]);
const tenantVisitOptions = ref<SystemUserRolePermissionApi.TenantVisitOption[]>(
  [],
);
const initialTenantVisitScope = ref<{
  scopeType?: TenantVisitScopeType;
  tenantIds: number[];
}>({ tenantIds: [] });
const canConfigureTenantVisitScope = computed(
  () =>
    Number(accessStore.tenantId) === SYSTEM_TENANT_ID &&
    (accessStore.visitTenantId === null ||
      accessStore.visitTenantId === undefined) &&
    hasAccessByCodes([TENANT_VISIT_SCOPE_PERMISSION]),
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

function hasSelectedSuperAdminRole() {
  const selectedRoleIdSet = new Set(selectedRoleIds.value);
  return allRoles.value.some(
    (role) =>
      role.id !== undefined &&
      selectedRoleIdSet.has(role.id) &&
      role.code === 'super_admin',
  );
}

function isPermissionToggleDisabled(permissionCode: string) {
  return (
    isDetail.value ||
    (permissionCode === TENANT_VISIT_PERMISSION &&
      canConfigureTenantVisitScope.value &&
      tenantVisitScopeType.value !== 'CLEAR') ||
    (hasSelectedSuperAdminRole() && permissionCode !== TENANT_VISIT_PERMISSION)
  );
}

function isPermissionChecked(
  permission: SystemUserRolePermissionApi.PermissionInfo,
): boolean {
  if (typeof permission.checked === 'boolean') {
    return permission.checked;
  }
  return !permission.denied;
}

async function loadRolePermissions(userId: number) {
  permLoading.value = true;
  try {
    const data = await getUserRolePermissions(userId);
    allRoles.value = (data.allRoles ?? [])
      .filter((role) => role.id !== undefined)
      .map((role) => ({
        code: role.code,
        id: role.id as number,
        managed: role.managed,
        name: role.name,
      }));
    selectedRoleIds.value = (data.roleInfos ?? []).map((r) => r.id);
    permissionItems.value = data.permissions ?? [];
    checkedPermissionCodes.value = permissionItems.value
      .filter(isPermissionChecked)
      .map((item) => item.code);
    initialRoleIds.value = [...selectedRoleIds.value].toSorted((a, b) => a - b);
    initialDeniedPermissions.value = normalizeStringList(
      getDeniedPermissions(),
    );
  } finally {
    permLoading.value = false;
  }
}

async function loadTenantVisitScope(userId: number) {
  if (!canConfigureTenantVisitScope.value) {
    return;
  }
  const data = await getUserTenantVisitScope(userId);
  tenantVisitScopeConfigured.value = data.configured;
  tenantVisitScopeType.value = data.configured ? data.scopeType : 'CLEAR';
  tenantVisitTenantIds.value = [...(data.tenantIds ?? [])];
  tenantVisitOptions.value = data.tenantOptions ?? [];
  initialTenantVisitScope.value = {
    scopeType: data.configured ? data.scopeType : 'CLEAR',
    tenantIds: [...tenantVisitTenantIds.value].toSorted((a, b) => a - b),
  };
}

function normalizeMenuIds(value: unknown): Set<number> {
  const list = Array.isArray(value) ? value : [];
  return new Set(
    list.map((item) => Number(item)).filter((item) => Number.isFinite(item)),
  );
}

async function ensureAllMenusLoaded() {
  if (allMenus.value.length > 0) {
    return;
  }
  allMenus.value = await getSimpleMenusList();
}

async function getCachedRoleMenuIds(roleId: number) {
  const cached = roleMenuIdsCache.get(roleId);
  if (cached) {
    return cached;
  }
  const menuIds = normalizeMenuIds(await getRoleMenuList(roleId));
  roleMenuIdsCache.set(roleId, menuIds);
  return menuIds;
}

function rebuildPermissionItems(
  menuIds: Set<number>,
  deniedPermissions: string[],
) {
  const deniedSet = new Set(deniedPermissions);
  const permissionMap = new Map<
    string,
    SystemUserRolePermissionApi.PermissionInfo
  >();
  allMenus.value
    .filter((menu) => menuIds.has(menu.id))
    .filter((menu) => menu.type === BUTTON_MENU_TYPE)
    .filter((menu) => !!menu.permission)
    .forEach((menu) => {
      if (permissionMap.has(menu.permission)) {
        return;
      }
      const denied = deniedSet.has(menu.permission);
      permissionMap.set(menu.permission, {
        code: menu.permission,
        name: menu.name,
        checked: !denied,
        roleGranted: true,
        denied,
      });
    });
  permissionItems.value = [...permissionMap.values()].toSorted((a, b) =>
    a.code.localeCompare(b.code),
  );
  checkedPermissionCodes.value = permissionItems.value
    .filter(isPermissionChecked)
    .map((item) => item.code);
}

async function refreshRolePermissionAggregation() {
  const seq = ++rolePermissionSeq;
  const deniedPermissions = getDeniedPermissions();
  if (selectedRoleIds.value.length === 0) {
    permissionItems.value = [];
    checkedPermissionCodes.value = [];
    permLoading.value = false;
    return;
  }
  permLoading.value = true;
  try {
    await ensureAllMenusLoaded();
    const roleMenuIdSets = await Promise.all(
      selectedRoleIds.value.map((roleId) => getCachedRoleMenuIds(roleId)),
    );
    if (seq !== rolePermissionSeq) {
      return;
    }
    const menuIds = new Set<number>();
    roleMenuIdSets.forEach((roleMenuIds) => {
      roleMenuIds.forEach((menuId) => menuIds.add(menuId));
    });
    rebuildPermissionItems(menuIds, deniedPermissions);
  } finally {
    if (seq === rolePermissionSeq) {
      permLoading.value = false;
    }
  }
}

async function toggleRole(roleId: number) {
  if (
    isDetail.value ||
    allRoles.value.some((role) => role.id === roleId && role.managed)
  )
    return;
  const previousRoleIds = [...selectedRoleIds.value];
  const nextSeq = rolePermissionSeq + 1;
  const idx = selectedRoleIds.value.indexOf(roleId);
  if (idx >= 0) {
    selectedRoleIds.value.splice(idx, 1);
  } else {
    selectedRoleIds.value.push(roleId);
  }
  try {
    await refreshRolePermissionAggregation();
  } catch {
    if (rolePermissionSeq === nextSeq) {
      selectedRoleIds.value = previousRoleIds;
      permLoading.value = false;
      message.error('刷新聚合按钮权限失败，请确认当前账号拥有角色菜单权限');
    }
  }
}

function togglePermission(code: string) {
  if (isDetail.value) return;
  const idx = checkedPermissionCodes.value.indexOf(code);
  if (idx >= 0) {
    checkedPermissionCodes.value.splice(idx, 1);
  } else {
    checkedPermissionCodes.value.push(code);
  }
}

function getDeniedPermissions() {
  const checkedSet = new Set(checkedPermissionCodes.value);
  return permissionItems.value
    .map((item) => item.code)
    .filter(
      (code) =>
        !checkedSet.has(code) &&
        !(
          code === TENANT_VISIT_PERMISSION &&
          canConfigureTenantVisitScope.value &&
          tenantVisitScopeType.value !== 'CLEAR'
        ),
    );
}

async function handleSaveRolePermissions(): Promise<boolean> {
  if (isDetail.value) return false;
  if (!userData.value?.id) return false;
  const userId = userData.value.id;
  permLoading.value = true;
  try {
    const normalizedRoleIds = [...selectedRoleIds.value].toSorted(
      (a, b) => a - b,
    );
    const normalizedDeniedPermissions = normalizeStringList(
      getDeniedPermissions(),
    );
    let tenantVisitScope:
      | SystemUserRolePermissionApi.TenantVisitScopeSave
      | undefined;
    if (canConfigureTenantVisitScope.value) {
      if (!tenantVisitScopeType.value) {
        activeTab.value = 'rolePermission';
        message.warning('请先设置租户访问范围');
        return false;
      }
      if (
        tenantVisitScopeType.value === 'CUSTOM' &&
        tenantVisitTenantIds.value.length === 0
      ) {
        activeTab.value = 'rolePermission';
        message.warning('指定租户模式至少选择一个租户');
        return false;
      }
      tenantVisitScope =
        tenantVisitScopeType.value === 'CLEAR'
          ? { clear: true }
          : {
              scopeType: tenantVisitScopeType.value,
              tenantIds:
                tenantVisitScopeType.value === 'CUSTOM'
                  ? [...tenantVisitTenantIds.value]
                  : [],
            };
    }
    const normalizedTenantVisitScope = tenantVisitScope
      ? tenantVisitScope.clear
        ? { scopeType: 'CLEAR', tenantIds: [] }
        : {
            scopeType: tenantVisitScope.scopeType,
            tenantIds: [...(tenantVisitScope.tenantIds ?? [])].toSorted(
              (a, b) => a - b,
            ),
          }
      : undefined;
    if (
      isEqual(normalizedRoleIds, initialRoleIds.value) &&
      isEqual(normalizedDeniedPermissions, initialDeniedPermissions.value) &&
      (!canConfigureTenantVisitScope.value ||
        isEqual(normalizedTenantVisitScope, initialTenantVisitScope.value))
    ) {
      return true;
    }
    await saveUserRolePermissions({
      userId,
      roleIds: selectedRoleIds.value,
      deniedPermissions: getDeniedPermissions(),
      tenantVisitScope,
    });
    await Promise.all([
      loadRolePermissions(userId),
      loadTenantVisitScope(userId),
    ]);
    return true;
  } finally {
    permLoading.value = false;
  }
}

// ========== Modal ==========
const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    if (isDetail.value) {
      await modalApi.close();
      return;
    }
    const basicInfoSaved = await handleSaveBasicInfo();
    if (!basicInfoSaved) {
      activeTab.value = 'basicInfo';
      return;
    }
    await handleSavePriceFields();
    const rolePermissionsSaved = await handleSaveRolePermissions();
    if (!rolePermissionsSaved) {
      return;
    }
    message.success('保存成功');
    emit('success');
    await modalApi.close();
  },
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      userData.value = null;
      hiddenFields.value = [];
      initialBasicInfo.value = null;
      formType.value = 'detail';
      basicInfoFormApi.setState({ schema: useFormSchema([]) });
      basicInfoFormApi.setDisabled(false);
      priceFields.value = [];
      checkedFieldCodes.value = [];
      initialCheckedFieldCodes.value = [];
      allRoles.value = [];
      selectedRoleIds.value = [];
      initialRoleIds.value = [];
      permissionItems.value = [];
      checkedPermissionCodes.value = [];
      initialDeniedPermissions.value = [];
      tenantVisitScopeConfigured.value = false;
      tenantVisitScopeType.value = undefined;
      tenantVisitTenantIds.value = [];
      tenantVisitOptions.value = [];
      initialTenantVisitScope.value = { tenantIds: [] };
      allMenus.value = [];
      roleMenuIdsCache.clear();
      rolePermissionSeq += 1;
      activeTab.value = 'basicInfo';
      basicInfoFormApi.resetForm();
      return;
    }
    const modalData = modalApi.getData<
      | SystemUserApi.User
      | {
          hiddenFields?: string[];
          row?: SystemUserApi.User;
          type?: DetailModalType;
        }
    >();
    const data =
      (modalData as { row?: SystemUserApi.User })?.row ??
      (modalData as SystemUserApi.User);
    hiddenFields.value =
      (modalData as { hiddenFields?: string[] })?.hiddenFields ?? [];
    formType.value =
      (modalData as { type?: DetailModalType })?.type ??
      (data?.id ? 'detail' : 'edit');
    basicInfoFormApi.setState({ schema: useFormSchema(hiddenFields.value) });
    basicInfoFormApi.setDisabled(isDetail.value);
    if (!data?.id) return;
    userData.value = data;
    modalApi.lock();
    try {
      await Promise.all([
        loadBasicInfo(data.id),
        loadPriceFields(data.id),
        loadRolePermissions(data.id),
        loadTenantVisitScope(data.id),
      ]);
      basicInfoFormApi.setDisabled(isDetail.value);
    } finally {
      modalApi.unlock();
    }
  },
});

function handleEditFromDetail() {
  if (!canEditFromDetail.value) return;
  formType.value = 'edit';
  basicInfoFormApi.setDisabled(false);
}
</script>

<template>
  <Modal :title="modalTitle" class="w-[800px]" :show-confirm-button="canSubmit">
    <Tabs v-model:active-key="activeTab">
      <!-- Tab1：基本信息 -->
      <TabPane key="basicInfo" tab="基本信息">
        <BasicInfoForm class="mx-2 mt-2" />
      </TabPane>

      <!-- Tab2：价格字段 -->
      <TabPane key="priceField" tab="个人价格限制">
        <div class="mb-4 text-sm text-gray-500">
          勾选该用户可见的历史价格字段（取消勾选即隐藏）。最终可见范围还会同时受到角色字段权限和部门价格查看权限限制。
        </div>
        <div class="flex flex-wrap gap-2 mb-6">
          <Tag
            v-for="field in priceFields"
            :key="field.code"
            :color="checkedFieldCodes.includes(field.code) ? 'blue' : 'default'"
            class="select-none px-3 py-1 text-sm"
            :class="isDetail ? 'cursor-default' : 'cursor-pointer'"
            @click="toggleField(field.code)"
          >
            {{ field.label }}
          </Tag>
        </div>
      </TabPane>

      <!-- Tab3：角色与权限 -->
      <TabPane key="rolePermission" tab="角色与权限">
        <div class="mb-4 text-sm text-gray-500">
          点击角色标签切换选中/取消，保存后生效
        </div>
        <div class="flex flex-wrap gap-2 mb-6">
          <Tag
            v-for="role in allRoles"
            :key="role.id"
            :color="selectedRoleIds.includes(role.id) ? 'green' : 'default'"
            class="select-none px-3 py-1 text-sm"
            :class="
              isDetail || role.managed ? 'cursor-default' : 'cursor-pointer'
            "
            :title="role.managed ? '该角色由租户访问范围自动维护' : undefined"
            @click="toggleRole(role.id)"
          >
            {{ role.name }}{{ role.managed ? '（只读）' : '' }}
          </Tag>
          <span v-if="allRoles.length === 0" class="text-gray-400 text-sm">
            暂无可选角色
          </span>
        </div>
        <div class="mb-4">
          <div class="mb-1 font-medium text-sm text-gray-600">
            聚合按钮权限（默认继承角色，可取消勾选禁用）
          </div>
          <div class="mb-2 text-xs text-gray-400">
            取消勾选表示该用户禁用此按钮权限；保存后会重新刷新角色聚合权限。
          </div>
          <div class="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
            <Checkbox
              v-for="perm in permissionItems"
              :key="perm.code"
              :checked="checkedPermissionCodes.includes(perm.code)"
              :disabled="isPermissionToggleDisabled(perm.code)"
              :title="perm.code"
              class="min-w-0 text-xs"
              @change="togglePermission(perm.code)"
            >
              <span class="inline-block max-w-full truncate align-bottom">
                {{ perm.name || perm.code }}
              </span>
            </Checkbox>
            <span
              v-if="permissionItems.length === 0"
              class="text-gray-400 text-sm"
            >
              暂无权限
            </span>
          </div>
        </div>
        <template v-if="canConfigureTenantVisitScope">
          <Divider class="my-4" />
          <div class="mb-2 font-medium text-sm text-gray-600">租户访问范围</div>
          <Alert
            v-if="!tenantVisitScopeConfigured"
            class="mb-3"
            message="暂未开放跨租户访问；选择访问范围后会自动开通访问租户能力。"
            show-icon
            type="warning"
          />
          <RadioGroup
            v-model:value="tenantVisitScopeType"
            :disabled="isDetail"
            class="mb-3"
          >
            <Radio value="ALL">全部租户</Radio>
            <Radio value="CUSTOM">指定租户</Radio>
            <Radio value="CLEAR">暂不开放</Radio>
          </RadioGroup>
          <Select
            v-if="tenantVisitScopeType === 'CUSTOM'"
            v-model:value="tenantVisitTenantIds"
            :disabled="isDetail"
            :options="tenantVisitSelectOptions"
            class="w-full"
            mode="multiple"
            option-filter-prop="label"
            placeholder="搜索并选择允许访问的租户"
            show-search
          />
          <div class="mt-2 text-xs text-gray-400">
            登录所属租户 1 不计入范围；“全部租户”也会包含以后新增的有效租户。
          </div>
        </template>
      </TabPane>
    </Tabs>
    <template #cancelText>
      {{ isDetail ? '关闭' : '取消' }}
    </template>
    <template #prepend-footer>
      <Button
        v-if="canEditFromDetail"
        type="primary"
        @click="handleEditFromDetail"
      >
        编辑
      </Button>
    </template>
  </Modal>
</template>
