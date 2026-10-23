<script lang="ts" setup>
import type { DataNode } from 'ant-design-vue/es/tree';

import type { MenuTreeNode, PermissionFormScope } from './permission-tree';

import type { SystemFormDataPermissionApi } from '#/api/system/form-data-permission';
import type { SystemRoleApi } from '#/api/system/role';
import type { FieldDefinition } from '#/api/system/permission/field';

import { computed, ref, watch } from 'vue';

import { useAccess } from '@vben/access';
import { useVbenModal } from '@vben/common-ui';
import { SystemDataScopeEnum } from '@vben/constants';
import { useAccessStore } from '@vben/stores';
import { handleTree } from '@vben/utils';

import {
  Button,
  Checkbox,
  Empty,
  InputSearch,
  message,
  Radio,
  RadioGroup,
  Spin,
  Tree,
  TreeSelect,
} from 'ant-design-vue';

import { getDeptList } from '#/api/system/dept';
import { getFormDataPermissionConfig } from '#/api/system/form-data-permission';
import { getMenuList, getSimpleMenusList } from '#/api/system/menu';
import { assignRoleMenu, getRoleMenuList } from '#/api/system/permission';
import {
  assignRoleFieldPermission,
  getRoleFieldPermissions,
} from '#/api/system/permission/field';
import {
  assignRoleFormDataScope,
  getRoleFormDataScopes,
} from '#/api/system/permission/form-data-scope';
import { $t } from '#/locales';

import { resolveMenuPermissionModule } from './module-items';
import {
  addManagedMenuAncestorIds,
  buildMenuTree,
  buildPermissionFormScope,
  filterAssignableMenus,
  filterPermissionTree,
  flattenMenuTree,
  getExpandableMenuIds,
  getFirstVisibleForm,
  getManagedMenuIds,
  getMenuCheckedState,
  getPermissionAncestorIds,
  getVisibleFormIds,
  mergeManagedMenuIds,
} from './permission-tree';

const emit = defineEmits(['success']);
const { hasAccessByCodes } = useAccess();
const accessStore = useAccessStore();

const SYSTEM_TENANT_ID = 1;

type TreeKey = number | string;

const EMPTY_PERMISSION_SCOPE: PermissionFormScope = {
  displayTree: [],
  scopeTree: [],
};

const menuTreeFieldNames = {
  children: 'children',
  key: 'id',
  title: 'name',
};

const DEFAULT_DATA_SCOPE = SystemDataScopeEnum.ALL;
const DATA_SCOPE_LABELS: Record<number, string> = {
  [SystemDataScopeEnum.ALL]: '全部数据',
  [SystemDataScopeEnum.DEPT_CUSTOM]: '指定部门',
  [SystemDataScopeEnum.DEPT_ONLY]: '本部门',
  [SystemDataScopeEnum.DEPT_AND_CHILD]: '本部门及以下',
  [SystemDataScopeEnum.DEPT_SELF]: '仅本人',
};
const DATA_SCOPE_OPTIONS = [
  SystemDataScopeEnum.ALL,
  SystemDataScopeEnum.DEPT_ONLY,
  SystemDataScopeEnum.DEPT_AND_CHILD,
  SystemDataScopeEnum.DEPT_SELF,
  SystemDataScopeEnum.DEPT_CUSTOM,
].map((value) => ({
  label: DATA_SCOPE_LABELS[value],
  value,
}));
const FORM_EXTRA_VALUE_TYPE_LABELS: Record<
  SystemFormDataPermissionApi.FieldValueType,
  string
> = {
  csv_ids: '包含本人',
  json_ids: '包含本人',
  single_id: '等于本人',
};

const groupLabels: Record<string, string> = {
  address_info: '地址信息',
  bank_info: '银行信息',
  base_info: '基础信息',
  basic_info: '基本信息',
  category_purchase: '分类与采购',
  contact_info: '联系信息',
  detail: '详情展示',
  detail_item: '明细表格',
  enable_control: '启用控制',
  expense_info: '费用信息',
  extend_info: '扩展信息',
  finance_info: '财务信息',
  income_info: '收入信息',
  invoice_info: '开票信息',
  logistics_info: '物流信息',
  main_form: '主表表单',
  operation_control: '作业控制',
  other: '其他',
  payable_info: '应付信息',
  price_info: '价格信息',
  receivable_info: '应收信息',
  sale_info: '业务销售',
  select_modal: '选择弹窗',
  settle_logistics: '结算与物流',
  status_info: '状态信息',
  stock_adjust: '库存调整',
  stock_info: '库存信息',
  system_info: '系统辅助',
};

const groupSort = [
  'base_info',
  'bank_info',
  'status_info',
  'expense_info',
  'income_info',
  'payable_info',
  'receivable_info',
  'price_info',
  'extend_info',
  'stock_info',
  'main_form',
  'detail_item',
  'basic_info',
  'category_purchase',
  'settle_logistics',
  'address_info',
  'invoice_info',
  'finance_info',
  'detail',
  'contact_info',
  'sale_info',
  'logistics_info',
  'system_info',
  'select_modal',
  'stock_adjust',
  'enable_control',
  'operation_control',
];

const roleId = ref(0);
const roleName = ref('');
const formKeyword = ref('');
const activeMenuId = ref(0);
const expandedMenuIds = ref<number[]>([]);

const allMenuTree = ref<MenuTreeNode[]>([]);
const permissionScope = ref<PermissionFormScope>(EMPTY_PERMISSION_SCOPE);
const menuLoading = ref(false);
const menuCheckedKeys = ref<number[]>([]);
const originalMenuIds = ref<number[]>([]);

const definitionsByModule = ref<Record<string, FieldDefinition[]>>({});
const visibleFieldIdsByModule = ref<Record<string, number[]>>({});
const expandedFieldKeysByModule = ref<Record<string, TreeKey[]>>({});
const loadedFieldModules = ref<string[]>([]);
const loadingFieldModules = ref<string[]>([]);
const dirtyFieldModules = ref<string[]>([]);
const fieldPermissionLoadPromises = new Map<string, Promise<void>>();
const dataScopesByModule = ref<
  Record<string, { dataScope: number; dataScopeDeptIds: number[] }>
>({});
const dirtyDataScopeModules = ref<string[]>([]);
const deptTreeOptions = ref<any[]>([]);
const dataScopeLoading = ref(false);
const formPermissionConfigsByModule = ref<
  Record<string, null | SystemFormDataPermissionApi.Config>
>({});
const loadedFormPermissionConfigModules = ref<string[]>([]);
const loadingFormPermissionConfigModules = ref<string[]>([]);
const formPermissionConfigLoadPromises = new Map<string, Promise<void>>();

const canAssignMenuPermission = computed(() =>
  hasAccessByCodes(['system:permission:assign-role-menu']),
);
const canAssignFieldPermission = computed(() =>
  hasAccessByCodes(['system:permission:assign-role-field-permission']),
);
const canAssignDataScope = computed(() =>
  hasAccessByCodes(['system:permission:assign-role-data-scope']),
);
const canQueryFormDataPermissionConfig = computed(() =>
  hasAccessByCodes(['system:form-data-permission:query']),
);
const canQueryRoleMenus = computed(
  () =>
    canAssignMenuPermission.value ||
    canAssignFieldPermission.value ||
    canAssignDataScope.value,
);
const canQueryMenuDetail = computed(() =>
  hasAccessByCodes(['system:menu:query']),
);
const canManageTenantListPermissions = computed(
  () =>
    accessStore.tenantId === SYSTEM_TENANT_ID &&
    accessStore.visitTenantId === null,
);

const allMenuNodeMap = computed(() => {
  const map = new Map<number, MenuTreeNode>();
  flattenMenuTree(allMenuTree.value).forEach((node) => map.set(node.id, node));
  return map;
});

const scopeMenuNodeMap = computed(() => {
  const map = new Map<number, MenuTreeNode>();
  flattenMenuTree(permissionScope.value.scopeTree).forEach((node) =>
    map.set(node.id, node),
  );
  return map;
});

const displayMenuNodeMap = computed(() => {
  const map = new Map<number, MenuTreeNode>();
  flattenMenuTree(permissionScope.value.displayTree).forEach((node) =>
    map.set(node.id, node),
  );
  return map;
});

const managedMenuIdSet = computed(() =>
  getManagedMenuIds(permissionScope.value.scopeTree),
);

const menuCheckedIdSet = computed(() => new Set(menuCheckedKeys.value));

const filteredFormTree = computed(() =>
  filterPermissionTree(permissionScope.value.displayTree, formKeyword.value),
);

const filteredFormTreeData = computed(
  () => filteredFormTree.value as unknown as DataNode[],
);

const visibleFormCount = computed(
  () => getVisibleFormIds(permissionScope.value.displayTree).length,
);

const allFormCheckedState = computed(() =>
  getMenuCheckedState(
    permissionScope.value.displayTree,
    menuCheckedIdSet.value,
  ),
);

const formTreeCheckedKeys = computed(() => {
  const checked: number[] = [];
  const halfChecked: number[] = [];
  flattenMenuTree(permissionScope.value.displayTree).forEach((node) => {
    const state = getMenuCheckedState([node], menuCheckedIdSet.value);
    if (state.checked) {
      checked.push(node.id);
    } else if (state.indeterminate) {
      halfChecked.push(node.id);
    }
  });
  return { checked, halfChecked };
});

const menuModuleMap = computed(() => {
  const map = new Map<number, string>();
  flattenMenuTree(permissionScope.value.displayTree)
    .filter((node) => node.type === 2)
    .forEach((node) => {
      const module = resolveFormModule(node.id);
      if (module) {
        map.set(node.id, module);
      }
    });
  return map;
});

const activeMenuNode = computed(() =>
  displayMenuNodeMap.value.get(activeMenuId.value),
);

const activeFormKey = computed(
  () => menuModuleMap.value.get(activeMenuId.value) || '',
);

const activeDefinitions = computed(
  () => definitionsByModule.value[activeFormKey.value] || [],
);

const activeVisibleFieldIds = computed(
  () => visibleFieldIdsByModule.value[activeFormKey.value] || [],
);

const activeFieldExpandedKeys = computed(
  () => expandedFieldKeysByModule.value[activeFormKey.value] || [],
);

const activeButtonNodes = computed(() =>
  (scopeMenuNodeMap.value.get(activeMenuId.value)?.children || []).filter(
    (node) => node.type === 3,
  ),
);

const activeCheckedButtonCount = computed(
  () =>
    activeButtonNodes.value.filter((node) =>
      menuCheckedIdSet.value.has(node.id),
    ).length,
);

const activeMenuBreadcrumb = computed(() => {
  if (!activeMenuNode.value) {
    return '-';
  }
  const names = [activeMenuNode.value.name];
  let parentId = activeMenuNode.value.parentId;
  while (parentId && parentId !== 0) {
    const parent =
      displayMenuNodeMap.value.get(parentId) ||
      allMenuNodeMap.value.get(parentId);
    if (!parent) {
      break;
    }
    names.unshift(parent.name);
    parentId = parent.parentId;
  }
  return names.join(' / ');
});

const isActiveFormChecked = computed(
  () => !!activeMenuId.value && menuCheckedIdSet.value.has(activeMenuId.value),
);

const canConfigureActiveFormMenu = computed(
  () => canAssignMenuPermission.value && isActiveFormChecked.value,
);

const canConfigureActiveFormFields = computed(
  () =>
    canAssignFieldPermission.value &&
    isActiveFormChecked.value &&
    !!activeFormKey.value,
);

const canConfigureActiveFormDataScope = computed(
  () => canAssignDataScope.value && !!activeFormKey.value,
);

const activeFieldLoading = computed(
  () =>
    !!activeFormKey.value &&
    loadingFieldModules.value.includes(activeFormKey.value),
);

const fieldPermissionEmptyDescription = computed(() => {
  if (!canAssignFieldPermission.value) {
    return '当前账号无字段授权权限';
  }
  if (!isActiveFormChecked.value) {
    return '请先勾选左侧页面后再配置字段权限';
  }
  if (!activeFormKey.value) {
    return '当前页面未配置字段权限映射';
  }
  if (activeFieldLoading.value) {
    return '字段权限加载中';
  }
  return '当前表单暂无字段权限定义';
});

const dataScopeEmptyDescription = computed(() => {
  if (!canAssignDataScope.value) {
    return '当前账号无数据授权权限';
  }
  if (!activeFormKey.value) {
    return '当前页面未配置数据权限映射';
  }
  return '';
});

const buttonPermissionEmptyDescription = computed(() => {
  if (!canAssignMenuPermission.value) {
    return '当前账号无菜单授权权限';
  }
  if (!isActiveFormChecked.value) {
    return '请先勾选左侧页面后再配置功能按钮';
  }
  return '当前表单暂无功能按钮定义';
});

const activeFieldTreeData = computed<DataNode[]>(() => {
  const groups = sortGroupEntries(
    Object.entries(groupDefinitions(activeDefinitions.value)),
  ).map(([group, fields]) => ({
    children: fields.map((field) => ({
      key: field.id,
      title: field.fieldLabel,
    })),
    key: `field_group_${activeFormKey.value}_${group}`,
    title: groupLabels[group] || '其他',
  }));

  return groups.length
    ? [
        {
          children: groups,
          key: `module_form_${activeFormKey.value}`,
          title: activeMenuNode.value?.name || '字段权限',
        },
      ]
    : [];
});

const activeDataScopeValue = computed({
  get() {
    return normalizeDataScope(
      dataScopesByModule.value[activeFormKey.value]?.dataScope,
    );
  },
  set(value: number) {
    updateActiveDataScope(value, activeDataScopeDeptIds.value);
  },
});

const activeDataScopeDeptIds = computed({
  get() {
    return (
      dataScopesByModule.value[activeFormKey.value]?.dataScopeDeptIds ?? []
    );
  },
  set(value: any[]) {
    updateActiveDataScope(activeDataScopeValue.value, normalizeDeptIds(value));
  },
});

const activeDataScopeIsCustom = computed(
  () => activeDataScopeValue.value === SystemDataScopeEnum.DEPT_CUSTOM,
);

const activeDataScopeLabel = computed(
  () => DATA_SCOPE_LABELS[activeDataScopeValue.value] || '未配置',
);

const activeFormPermissionConfigLoading = computed(
  () =>
    !!activeFormKey.value &&
    loadingFormPermissionConfigModules.value.includes(activeFormKey.value),
);

const activeFormPermissionConfig = computed(
  () => formPermissionConfigsByModule.value[activeFormKey.value],
);

const activeFormExtraRuleLabels = computed(() => {
  const config = activeFormPermissionConfig.value;
  if (!config?.enabled) {
    return [];
  }
  return (config.fields || [])
    .filter((field) => field.enabled)
    .map((field) => {
      const valueType = (field.valueType ||
        'single_id') as SystemFormDataPermissionApi.FieldValueType;
      return `${field.columnDesc || field.columnName}${FORM_EXTRA_VALUE_TYPE_LABELS[valueType] || '命中本人'}`;
    });
});

const activeFormExtraRuleDescription = computed(() => {
  if (!canQueryFormDataPermissionConfig.value) {
    return '当前账号无表单数据权限配置查询权限，无法回显额外规则';
  }
  if (activeFormPermissionConfigLoading.value) {
    return '额外表单规则加载中';
  }
  if (!activeFormPermissionConfig.value?.enabled) {
    return '未启用额外表单规则';
  }
  if (!activeFormExtraRuleLabels.value.length) {
    return '已启用，但未配置额外字段规则';
  }
  return activeFormExtraRuleLabels.value.join('、');
});

const activeFinalDataScopeDescription = computed(() => {
  if (activeDataScopeValue.value === SystemDataScopeEnum.ALL) {
    return '最终效果：全部数据；额外表单规则不会再收窄该范围。';
  }
  if (activeFormExtraRuleLabels.value.length) {
    return `最终效果：${activeDataScopeLabel.value}数据 + ${activeFormExtraRuleLabels.value.join('、')}的数据。`;
  }
  return `最终效果：${activeDataScopeLabel.value}数据；如配置额外表单规则，会在此基础上取并集。`;
});

watch(formKeyword, (keyword) => {
  if (keyword.trim()) {
    expandedMenuIds.value = getExpandableMenuIds(filteredFormTree.value);
  }
});

function resolveFormModule(menuId: number) {
  const page = scopeMenuNodeMap.value.get(menuId);
  if (!page) {
    return undefined;
  }
  const matchingNodes = [
    page,
    ...(page.children || []).filter((node) => node.type === 3),
  ];

  return resolveMenuPermissionModule(matchingNodes);
}

function getAncestorMenuIds(menuId: number) {
  return getPermissionAncestorIds(
    menuId,
    permissionScope.value.scopeTree,
    allMenuTree.value,
  );
}

function normalizeMenuCheckedKeys(keys: number[]) {
  return addManagedMenuAncestorIds(
    keys,
    managedMenuIdSet.value,
    permissionScope.value.scopeTree,
    allMenuTree.value,
  );
}

function updateMenuCheckedKeys(menuIds: number[], checked: boolean) {
  const targetIds = new Set(menuIds);
  menuCheckedKeys.value = checked
    ? [...new Set([...menuCheckedKeys.value, ...menuIds])]
    : menuCheckedKeys.value.filter((id) => !targetIds.has(id));
}

function pruneUnusedAncestorMenuIds(ancestorIds: Set<number>) {
  if (!ancestorIds.size) {
    return;
  }
  const requiredAncestorIds = new Set<number>();
  menuCheckedKeys.value.forEach((id) => {
    getAncestorMenuIds(id).forEach((parentId) =>
      requiredAncestorIds.add(parentId),
    );
  });
  menuCheckedKeys.value = menuCheckedKeys.value.filter(
    (id) => !ancestorIds.has(id) || requiredAncestorIds.has(id),
  );
}

function togglePermissionNode(menuId: number, checked: boolean) {
  const node = scopeMenuNodeMap.value.get(menuId);
  if (!node) {
    return;
  }
  const controlledIds = flattenMenuTree([node]).map((item) => item.id);
  const ancestorIds = getAncestorMenuIds(menuId);
  if (checked) {
    updateMenuCheckedKeys([...controlledIds, ...ancestorIds], true);
    return;
  }
  updateMenuCheckedKeys(controlledIds, false);
  pruneUnusedAncestorMenuIds(new Set(ancestorIds));
}

function getEventMenuId(info: any) {
  return Number(info?.node?.id ?? info?.node?.eventKey ?? info?.node?.key);
}

async function handleFormTreeCheck(_keys: unknown, info: any) {
  if (!canAssignMenuPermission.value) {
    return;
  }
  const menuId = getEventMenuId(info);
  if (!Number.isFinite(menuId)) {
    return;
  }
  const node = displayMenuNodeMap.value.get(menuId);
  if (!node) {
    return;
  }
  togglePermissionNode(menuId, info.checked);
  if (node.type === 2) {
    await selectForm(menuId);
  }
}

async function handleFormTreeSelect(_keys: TreeKey[], info: any) {
  const menuId = getEventMenuId(info);
  if (displayMenuNodeMap.value.get(menuId)?.type === 2) {
    await selectForm(menuId);
  }
}

function handleFormTreeExpand(keys: TreeKey[]) {
  expandedMenuIds.value = keys.filter(
    (key): key is number => typeof key === 'number',
  );
}

function handleAllFormCheckChange(event: any) {
  if (!canAssignMenuPermission.value) {
    return;
  }
  const checked = event.target.checked;
  const managedIds = [...managedMenuIdSet.value];
  if (checked) {
    updateMenuCheckedKeys(normalizeMenuCheckedKeys(managedIds), true);
    return;
  }
  updateMenuCheckedKeys(managedIds, false);
  const rootAncestorIds = new Set(
    permissionScope.value.scopeTree.flatMap((node) =>
      getAncestorMenuIds(node.id),
    ),
  );
  pruneUnusedAncestorMenuIds(rootAncestorIds);
}

function handleMenuButtonCheckChange(menuId: number, event: any) {
  updateMenuCheckedKeys([menuId], event.target.checked);
}

function groupDefinitions(definitions: FieldDefinition[]) {
  return definitions.reduce<Record<string, FieldDefinition[]>>((acc, item) => {
    const group = item.fieldGroup || 'other';
    acc[group] = acc[group] || [];
    acc[group]!.push(item);
    return acc;
  }, {});
}

function sortGroupEntries(
  entries: Array<[string, FieldDefinition[]]>,
): Array<[string, FieldDefinition[]]> {
  return entries.toSorted(([left], [right]) => {
    const leftIndex = groupSort.includes(left)
      ? groupSort.indexOf(left)
      : groupSort.length;
    const rightIndex = groupSort.includes(right)
      ? groupSort.indexOf(right)
      : groupSort.length;
    return leftIndex !== rightIndex
      ? leftIndex - rightIndex
      : left.localeCompare(right);
  });
}

function setFieldModuleLoading(module: string, loading: boolean) {
  loadingFieldModules.value = loading
    ? [...new Set([...loadingFieldModules.value, module])]
    : loadingFieldModules.value.filter((item) => item !== module);
}

function buildFieldExpandedKeys(
  module: string,
  definitions: FieldDefinition[],
) {
  if (!definitions.length) {
    return [];
  }
  return [
    `module_form_${module}`,
    ...Object.keys(groupDefinitions(definitions)).map(
      (group) => `field_group_${module}_${group}`,
    ),
  ];
}

async function ensureFieldPermissionsLoaded(module: string) {
  if (!module || loadedFieldModules.value.includes(module)) {
    return;
  }
  const existingPromise = fieldPermissionLoadPromises.get(module);
  if (existingPromise) {
    await existingPromise;
    return;
  }

  const loadPromise = (async () => {
    setFieldModuleLoading(module, true);
    try {
      const result = await getRoleFieldPermissions(roleId.value, module);
      const definitions = result.definitions;
      const hiddenIds = new Set(result.hiddenFieldIds);
      definitionsByModule.value = {
        ...definitionsByModule.value,
        [module]: definitions,
      };
      visibleFieldIdsByModule.value = {
        ...visibleFieldIdsByModule.value,
        [module]: definitions
          .map((field) => field.id)
          .filter((id) => !hiddenIds.has(id)),
      };
      expandedFieldKeysByModule.value = {
        ...expandedFieldKeysByModule.value,
        [module]: buildFieldExpandedKeys(module, definitions),
      };
      loadedFieldModules.value = [...loadedFieldModules.value, module];
    } finally {
      setFieldModuleLoading(module, false);
      fieldPermissionLoadPromises.delete(module);
    }
  })();

  fieldPermissionLoadPromises.set(module, loadPromise);
  await loadPromise;
}

function setFormPermissionConfigLoading(module: string, loading: boolean) {
  loadingFormPermissionConfigModules.value = loading
    ? [...new Set([...loadingFormPermissionConfigModules.value, module])]
    : loadingFormPermissionConfigModules.value.filter(
        (item) => item !== module,
      );
}

async function ensureFormPermissionConfigLoaded(module: string) {
  if (
    !module ||
    !canQueryFormDataPermissionConfig.value ||
    loadedFormPermissionConfigModules.value.includes(module)
  ) {
    return;
  }
  const existingPromise = formPermissionConfigLoadPromises.get(module);
  if (existingPromise) {
    await existingPromise;
    return;
  }

  const loadPromise = (async () => {
    setFormPermissionConfigLoading(module, true);
    try {
      const config = await getFormDataPermissionConfig(module);
      formPermissionConfigsByModule.value = {
        ...formPermissionConfigsByModule.value,
        [module]: config,
      };
    } catch {
      formPermissionConfigsByModule.value = {
        ...formPermissionConfigsByModule.value,
        [module]: null,
      };
    } finally {
      loadedFormPermissionConfigModules.value = [
        ...new Set([...loadedFormPermissionConfigModules.value, module]),
      ];
      setFormPermissionConfigLoading(module, false);
      formPermissionConfigLoadPromises.delete(module);
    }
  })();

  formPermissionConfigLoadPromises.set(module, loadPromise);
  await loadPromise;
}

async function selectForm(menuId: number) {
  activeMenuId.value = menuId;
  const module = menuModuleMap.value.get(menuId);
  if (module) {
    ensureDataScopeInitialized(module);
    void ensureFormPermissionConfigLoaded(module);
  }
  if (module && canAssignFieldPermission.value) {
    await ensureFieldPermissionsLoaded(module);
  }
}

function markActiveFieldModuleDirty() {
  const module = activeFormKey.value;
  if (module && !dirtyFieldModules.value.includes(module)) {
    dirtyFieldModules.value = [...dirtyFieldModules.value, module];
  }
}

function handleFieldTreeCheck(keys: TreeKey[] | { checked: TreeKey[] }) {
  const checkedKeys = Array.isArray(keys) ? keys : keys.checked;
  visibleFieldIdsByModule.value = {
    ...visibleFieldIdsByModule.value,
    [activeFormKey.value]: checkedKeys.filter(
      (key): key is number => typeof key === 'number',
    ),
  };
  markActiveFieldModuleDirty();
}

function handleFieldTreeExpand(keys: TreeKey[]) {
  if (!activeFormKey.value) {
    return;
  }
  expandedFieldKeysByModule.value = {
    ...expandedFieldKeysByModule.value,
    [activeFormKey.value]: keys,
  };
}

function normalizeDeptIds(value: any): number[] {
  const values = Array.isArray(value) ? value : [];
  return [
    ...new Set(
      values
        .map((item) => (typeof item === 'object' ? item.value : item))
        .map(Number)
        .filter((item) => Number.isFinite(item)),
    ),
  ];
}

function normalizeDataScope(dataScope?: null | number) {
  const value = Number(dataScope);
  return DATA_SCOPE_OPTIONS.some((option) => option.value === value)
    ? value
    : DEFAULT_DATA_SCOPE;
}

function markDataScopeModuleDirty(module: string) {
  if (module && !dirtyDataScopeModules.value.includes(module)) {
    dirtyDataScopeModules.value = [...dirtyDataScopeModules.value, module];
  }
}

function ensureDataScopeInitialized(module: string) {
  if (
    !module ||
    !canConfigureActiveFormDataScope.value ||
    dataScopesByModule.value[module]
  ) {
    return;
  }
  dataScopesByModule.value = {
    ...dataScopesByModule.value,
    [module]: {
      dataScope: DEFAULT_DATA_SCOPE,
      dataScopeDeptIds: [],
    },
  };
}

function updateActiveDataScope(dataScope: number, dataScopeDeptIds: number[]) {
  const module = activeFormKey.value;
  if (!module || !canConfigureActiveFormDataScope.value) {
    return;
  }
  dataScopesByModule.value = {
    ...dataScopesByModule.value,
    [module]: {
      dataScope,
      dataScopeDeptIds:
        dataScope === SystemDataScopeEnum.DEPT_CUSTOM ? dataScopeDeptIds : [],
    },
  };
  markDataScopeModuleDirty(module);
}

function handleButtonSelectAll() {
  if (!canConfigureActiveFormMenu.value) {
    return;
  }
  updateMenuCheckedKeys(
    activeButtonNodes.value.map((item) => item.id),
    true,
  );
}

function handleButtonClear() {
  if (!canConfigureActiveFormMenu.value) {
    return;
  }
  updateMenuCheckedKeys(
    activeButtonNodes.value.map((item) => item.id),
    false,
  );
}

function handleFieldSelectAll() {
  if (!canConfigureActiveFormFields.value) {
    return;
  }
  visibleFieldIdsByModule.value = {
    ...visibleFieldIdsByModule.value,
    [activeFormKey.value]: activeDefinitions.value.map((field) => field.id),
  };
  markActiveFieldModuleDirty();
}

function handleFieldClear() {
  if (!canConfigureActiveFormFields.value) {
    return;
  }
  visibleFieldIdsByModule.value = {
    ...visibleFieldIdsByModule.value,
    [activeFormKey.value]: [],
  };
  markActiveFieldModuleDirty();
}

function getInitialExpandedMenuIds(nodes: MenuTreeNode[]) {
  return nodes.flatMap((root) => [
    root.id,
    ...(root.children || [])
      .filter((child) => child.children?.length)
      .map((child) => child.id),
  ]);
}

async function loadMenuPermissions() {
  menuLoading.value = true;
  try {
    const [allMenus, assignableMenus, menuIds, formDataScopes, departments] =
      await Promise.all([
        canQueryMenuDetail.value ? getMenuList() : Promise.resolve(undefined),
        getSimpleMenusList(),
        canQueryRoleMenus.value
          ? getRoleMenuList(roleId.value)
          : Promise.resolve([]),
        canAssignDataScope.value
          ? getRoleFormDataScopes(roleId.value)
          : Promise.resolve([]),
        canAssignDataScope.value ? getDeptList() : Promise.resolve([]),
      ]);
    const menus = allMenus
      ? filterAssignableMenus(allMenus, assignableMenus)
      : assignableMenus;
    const normalizedDirtyDataScopeModules: string[] = [];
    dataScopesByModule.value = Object.fromEntries(
      formDataScopes.map((item) => {
        const dataScope = normalizeDataScope(item.dataScope);
        if (dataScope !== item.dataScope) {
          normalizedDirtyDataScopeModules.push(item.formKey);
        }
        return [
          item.formKey,
          {
            dataScope,
            dataScopeDeptIds:
              dataScope === SystemDataScopeEnum.DEPT_CUSTOM
                ? item.dataScopeDeptIds || []
                : [],
          },
        ];
      }),
    );
    dirtyDataScopeModules.value = [...new Set(normalizedDirtyDataScopeModules)];
    deptTreeOptions.value = handleTree(departments);
    allMenuTree.value = buildMenuTree(menus);
    permissionScope.value = buildPermissionFormScope(menus, {
      includeTenantList: canManageTenantListPermissions.value,
    });
    originalMenuIds.value = [...menuIds];
    menuCheckedKeys.value = [...menuIds];
    expandedMenuIds.value = getInitialExpandedMenuIds(
      permissionScope.value.displayTree,
    );
    const firstForm = getFirstVisibleForm(permissionScope.value.displayTree);
    activeMenuId.value = firstForm?.id || 0;
    if (firstForm) {
      await selectForm(firstForm.id);
    }
  } finally {
    menuLoading.value = false;
  }
}

async function submitMenuPermissions() {
  if (!canAssignMenuPermission.value) {
    return;
  }
  const menuIds = normalizeMenuCheckedKeys(
    mergeManagedMenuIds(
      menuCheckedKeys.value,
      originalMenuIds.value,
      managedMenuIdSet.value,
    ),
  );
  menuCheckedKeys.value = menuIds;
  await assignRoleMenu({ menuIds, roleId: roleId.value });
}

async function submitFieldPermissions() {
  if (!canAssignFieldPermission.value || !dirtyFieldModules.value.length) {
    return;
  }
  await Promise.all(
    dirtyFieldModules.value.map(async (module) => {
      if (!loadedFieldModules.value.includes(module)) {
        throw new Error(`Field permissions are not loaded: ${module}`);
      }
      const visibleIds = new Set(visibleFieldIdsByModule.value[module] || []);
      const hiddenFieldIds = (definitionsByModule.value[module] || [])
        .map((field) => field.id)
        .filter((id) => !visibleIds.has(id));
      await assignRoleFieldPermission({
        hiddenFieldIds,
        module,
        roleId: roleId.value,
      });
    }),
  );
}

async function submitDataScopePermissions() {
  if (!canAssignDataScope.value || !dirtyDataScopeModules.value.length) {
    return;
  }
  await Promise.all(
    dirtyDataScopeModules.value.map(async (module) => {
      const scope = dataScopesByModule.value[module] || {
        dataScope: DEFAULT_DATA_SCOPE,
        dataScopeDeptIds: [],
      };
      if (
        scope.dataScope === SystemDataScopeEnum.DEPT_CUSTOM &&
        !scope.dataScopeDeptIds.length
      ) {
        throw new Error('请选择指定部门');
      }
      await assignRoleFormDataScope({
        dataScope: scope.dataScope,
        dataScopeDeptIds: scope.dataScopeDeptIds,
        formKey: module,
        roleId: roleId.value,
      });
    }),
  );
}

function resetState() {
  roleId.value = 0;
  roleName.value = '';
  formKeyword.value = '';
  activeMenuId.value = 0;
  expandedMenuIds.value = [];
  allMenuTree.value = [];
  permissionScope.value = EMPTY_PERMISSION_SCOPE;
  menuCheckedKeys.value = [];
  originalMenuIds.value = [];
  definitionsByModule.value = {};
  visibleFieldIdsByModule.value = {};
  expandedFieldKeysByModule.value = {};
  loadedFieldModules.value = [];
  loadingFieldModules.value = [];
  dirtyFieldModules.value = [];
  fieldPermissionLoadPromises.clear();
  dataScopesByModule.value = {};
  dirtyDataScopeModules.value = [];
  deptTreeOptions.value = [];
  dataScopeLoading.value = false;
  formPermissionConfigsByModule.value = {};
  loadedFormPermissionConfigModules.value = [];
  loadingFormPermissionConfigModules.value = [];
  formPermissionConfigLoadPromises.clear();
}

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    modalApi.lock();
    dataScopeLoading.value = true;
    try {
      await Promise.all([
        submitMenuPermissions(),
        submitFieldPermissions(),
        submitDataScopePermissions(),
      ]);
      await modalApi.close();
      emit('success');
      message.success($t('ui.actionMessage.operationSuccess'));
    } catch (error: any) {
      message.error(error?.message || '保存失败，请检查后重试');
    } finally {
      dataScopeLoading.value = false;
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      resetState();
      return;
    }
    const data = modalApi.getData<SystemRoleApi.Role>();
    if (!data?.id) {
      return;
    }
    roleId.value = data.id;
    roleName.value = data.name || '';
    modalApi.lock();
    try {
      await loadMenuPermissions();
    } finally {
      modalApi.unlock();
    }
  },
});
</script>

<template>
  <Modal title="权限配置" class="w-[1320px]">
    <div class="mx-4 flex h-[72vh] min-h-[560px] gap-4 overflow-hidden">
      <aside
        class="flex min-h-0 w-96 shrink-0 flex-col border-r border-gray-100 pr-4"
      >
        <div class="mb-3">
          <div class="text-base font-medium text-gray-800">页面树</div>
          <div class="mt-1 text-xs text-gray-400">
            ERP、商城及指定系统管理页面，平台租户可配置租户列表 · 当前角色：{{
              roleName || '-'
            }}
          </div>
        </div>
        <InputSearch
          v-model:value="formKeyword"
          allow-clear
          class="mb-3"
          placeholder="搜索页面或目录"
          size="small"
        />
        <div
          class="mb-3 flex items-center justify-between rounded border border-gray-100 bg-gray-50 px-3 py-2 text-sm"
        >
          <Checkbox
            :checked="allFormCheckedState.checked"
            :disabled="menuLoading || !canAssignMenuPermission"
            :indeterminate="allFormCheckedState.indeterminate"
            @change="handleAllFormCheckChange"
          >
            全选可见页面
          </Checkbox>
          <span class="text-xs text-gray-400">{{ visibleFormCount }}</span>
        </div>
        <Spin
          :spinning="menuLoading"
          wrapper-class-name="role-permission-sidebar-spin min-h-0 flex-1"
        >
          <div class="min-h-0 flex-1 overflow-y-auto pr-1">
            <Tree
              v-if="filteredFormTree.length"
              :auto-expand-parent="!!formKeyword.trim()"
              block-node
              check-strictly
              :checkable="canAssignMenuPermission"
              :checked-keys="formTreeCheckedKeys"
              :expanded-keys="expandedMenuIds"
              :field-names="menuTreeFieldNames"
              :selected-keys="activeMenuId ? [activeMenuId] : []"
              show-line
              :tree-data="filteredFormTreeData"
              @check="handleFormTreeCheck"
              @expand="handleFormTreeExpand"
              @select="handleFormTreeSelect"
            />
            <Empty v-else description="未找到页面" />
          </div>
        </Spin>
      </aside>

      <section
        class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden pr-1"
      >
        <div
          class="mb-4 flex items-start justify-between border-b border-gray-100 pb-3"
        >
          <div>
            <div class="text-lg font-medium text-gray-900">
              {{ activeMenuNode?.name || '请选择页面' }}
            </div>
            <div class="mt-1 text-sm text-gray-400">
              {{ activeMenuBreadcrumb }}
            </div>
          </div>
        </div>

        <Spin
          :spinning="dataScopeLoading"
          wrapper-class-name="role-data-scope-spin mb-4 shrink-0"
        >
          <section
            class="rounded border border-blue-100 bg-blue-50 px-4 py-3"
            :class="{ 'opacity-50': !canConfigureActiveFormDataScope }"
          >
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div class="font-medium text-gray-800">数据权限</div>
                <div class="mt-1 text-xs text-gray-500">
                  <template v-if="canAssignDataScope">
                    配置当前表单的基础数据范围；若后台开启额外表单规则，将与基础范围取并集
                  </template>
                  <template v-else>当前账号无数据授权权限</template>
                </div>
              </div>
              <div
                v-if="canConfigureActiveFormDataScope"
                class="rounded bg-white px-2 py-1 text-xs text-blue-600"
              >
                当前页面：{{ activeMenuNode?.name || '-' }}
              </div>
            </div>
            <template v-if="canConfigureActiveFormDataScope">
              <RadioGroup
                v-model:value="activeDataScopeValue"
                class="role-data-scope-radio mt-3"
              >
                <Radio
                  v-for="option in DATA_SCOPE_OPTIONS"
                  :key="option.value"
                  :value="option.value"
                >
                  {{ option.label }}
                </Radio>
              </RadioGroup>
              <div
                class="mt-3 grid gap-2 rounded border border-blue-100 bg-white/80 p-3 text-xs text-gray-600 md:grid-cols-3"
              >
                <div>
                  <span class="text-gray-400">基础数据范围：</span>
                  <span class="font-medium text-gray-700">
                    {{ activeDataScopeLabel }}
                  </span>
                </div>
                <div>
                  <span class="text-gray-400">额外表单规则：</span>
                  <span class="font-medium text-gray-700">
                    {{ activeFormExtraRuleDescription }}
                  </span>
                </div>
                <div>
                  <span class="text-gray-400">最终效果：</span>
                  <span class="font-medium text-blue-600">
                    {{ activeFinalDataScopeDescription }}
                  </span>
                </div>
              </div>
              <div v-if="activeDataScopeIsCustom" class="mt-3 max-w-[560px]">
                <div class="mb-2 text-xs text-gray-500">指定部门</div>
                <TreeSelect
                  v-model:value="activeDataScopeDeptIds"
                  allow-clear
                  class="w-full"
                  multiple
                  placeholder="请选择指定部门"
                  show-search
                  tree-checkable
                  tree-default-expand-all
                  tree-node-filter-prop="label"
                  :field-names="{
                    children: 'children',
                    label: 'name',
                    value: 'id',
                  }"
                  :tree-data="deptTreeOptions"
                />
              </div>
            </template>
            <Empty v-else :description="dataScopeEmptyDescription" />
          </section>
        </Spin>

        <div
          class="grid min-h-0 flex-1 grid-cols-1 gap-4 overflow-hidden pr-1 xl:grid-cols-[minmax(300px,0.4fr)_minmax(480px,0.6fr)]"
        >
          <section class="flex min-h-0 flex-col overflow-hidden">
            <div class="mb-3 flex items-center justify-between">
              <div>
                <div class="font-medium text-gray-800">当前页面功能按钮</div>
                <div class="mt-1 text-xs text-gray-400">
                  勾选表示按钮可用，取消勾选表示对该角色隐藏
                </div>
              </div>
              <div class="flex gap-2">
                <Button
                  :disabled="
                    !canConfigureActiveFormMenu || !activeButtonNodes.length
                  "
                  size="small"
                  @click="handleButtonSelectAll"
                >
                  全选
                </Button>
                <Button
                  :disabled="
                    !canConfigureActiveFormMenu || !activeButtonNodes.length
                  "
                  size="small"
                  @click="handleButtonClear"
                >
                  清空
                </Button>
              </div>
            </div>
            <div
              class="min-h-0 flex-1 overflow-y-auto rounded border border-gray-100 p-3"
              :class="{ 'opacity-50': !canConfigureActiveFormMenu }"
            >
              <div
                v-if="isActiveFormChecked && activeButtonNodes.length"
                class="min-h-40"
              >
                <div class="mb-2 text-xs text-gray-400">
                  已勾选 {{ activeCheckedButtonCount }} /
                  {{ activeButtonNodes.length }} 个按钮
                </div>
                <div
                  v-for="node in activeButtonNodes"
                  :key="node.id"
                  class="role-permission-check-row flex items-center gap-2 border-b border-gray-100 px-1 py-2 text-sm transition last:border-b-0 hover:bg-gray-50"
                >
                  <Checkbox
                    class="min-w-0"
                    :checked="menuCheckedKeys.includes(node.id)"
                    :disabled="!canConfigureActiveFormMenu"
                    @change="handleMenuButtonCheckChange(node.id, $event)"
                  >
                    <span
                      class="inline-block max-w-full truncate align-bottom text-gray-800"
                    >
                      {{ node.name }}
                    </span>
                  </Checkbox>
                </div>
              </div>
              <Empty v-else :description="buttonPermissionEmptyDescription" />
            </div>
          </section>

          <section class="flex min-h-0 flex-col overflow-hidden">
            <div class="mb-3 flex items-center justify-between">
              <div>
                <div class="font-medium text-gray-800">字段权限</div>
                <div class="mt-1 text-xs text-gray-400">
                  <template v-if="canAssignFieldPermission">
                    勾选表示字段可见，取消勾选表示对该角色隐藏
                  </template>
                  <template v-else>当前账号无字段授权权限</template>
                </div>
              </div>
              <div class="flex gap-2">
                <Button
                  :disabled="
                    !canConfigureActiveFormFields || !activeDefinitions.length
                  "
                  size="small"
                  @click="handleFieldSelectAll"
                >
                  全选
                </Button>
                <Button
                  :disabled="
                    !canConfigureActiveFormFields || !activeDefinitions.length
                  "
                  size="small"
                  @click="handleFieldClear"
                >
                  取消全选
                </Button>
              </div>
            </div>
            <Spin :spinning="activeFieldLoading" class="min-h-0 flex-1">
              <div
                class="flex min-h-0 h-full flex-1 flex-col rounded border border-gray-100 p-3"
                :class="{ 'opacity-50': !canConfigureActiveFormFields }"
              >
                <div
                  v-if="isActiveFormChecked && activeDefinitions.length"
                  class="mb-2 text-xs text-gray-400"
                >
                  已勾选 {{ activeVisibleFieldIds.length }} /
                  {{ activeDefinitions.length }} 个字段
                </div>
                <div
                  v-if="isActiveFormChecked && activeDefinitions.length"
                  class="min-h-40 flex-1 overflow-y-auto pr-1"
                >
                  <Tree
                    :checked-keys="activeVisibleFieldIds"
                    checkable
                    :disabled="!canConfigureActiveFormFields"
                    :expanded-keys="activeFieldExpandedKeys"
                    :selectable="false"
                    :tree-data="activeFieldTreeData"
                    @check="handleFieldTreeCheck"
                    @expand="handleFieldTreeExpand"
                  />
                </div>
                <Empty v-else :description="fieldPermissionEmptyDescription" />
              </div>
            </Spin>
          </section>
        </div>
      </section>
    </div>
  </Modal>
</template>

<style scoped>
:deep(.role-permission-sidebar-spin),
:deep(.role-permission-sidebar-spin .ant-spin-container) {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
}

:deep(.ant-spin-nested-loading),
:deep(.ant-spin-container) {
  min-height: 0;
  height: 100%;
}

:deep(.role-data-scope-spin),
:deep(.role-data-scope-spin .ant-spin-container) {
  min-height: 0;
  height: auto;
}

.role-data-scope-radio {
  display: grid;
  width: 100%;
  grid-template-columns: repeat(auto-fit, minmax(116px, 1fr));
  gap: 8px;
}

.role-data-scope-radio :deep(.ant-radio-wrapper) {
  min-height: 38px;
  align-items: center;
  margin-inline-end: 0;
  padding: 8px 10px;
  border: 1px solid #d9e4f5;
  border-radius: 6px;
  background: #fff;
  transition:
    border-color 0.2s ease,
    background 0.2s ease,
    color 0.2s ease;
}

.role-data-scope-radio :deep(.ant-radio-wrapper-checked) {
  border-color: #1677ff;
  background: #f0f6ff;
  color: #0958d9;
}

.role-data-scope-radio :deep(.ant-radio) {
  margin-inline-end: 6px;
}
</style>
