<script lang="ts" setup>
import type { TableColumnsType, TreeSelectProps } from 'ant-design-vue';

import type { DeptPriceFieldApi } from '#/api/system/permission/dept-price-field';

import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { onBeforeRouteLeave } from 'vue-router';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';
import { handleTree } from '@vben/utils';

import {
  Button,
  Card,
  Checkbox,
  CheckboxGroup,
  Input,
  message,
  Modal,
  Popconfirm,
  Popover,
  Select,
  Table,
  Tag,
  Tooltip,
  TreeSelect,
} from 'ant-design-vue';

import {
  getDeptPriceFieldConfig,
  updateDeptPriceFieldConfig,
} from '#/api/system/permission/dept-price-field';
import { clearFieldPermissionCache } from '#/composables/useFieldPermission';

defineOptions({ name: 'ErpProductPricePermission' });

type FieldRow = DeptPriceFieldApi.Field;

interface PermissionGroup {
  changed: boolean;
  deptIds: number[];
  deptNames: string[];
  fieldKeys: string[];
  fieldLabels: string[];
  groupKey: string;
}

const { hasAccessByCodes } = useAccess();
const loading = ref(false);
const saving = ref(false);
const createOpen = ref(false);
const editOpen = ref(false);
const configVersion = ref('');
const fields = ref<FieldRow[]>([]);
const departments = ref<DeptPriceFieldApi.Department[]>([]);
const originalDeptIds = ref<Record<string, string>>({});
const keyword = ref('');
const fieldFilter = ref('all');
const editingGroupKey = ref('');
const draftDeptIds = ref<number[]>([]);
const draftFieldKeys = ref<string[]>([]);

const canUpdate = computed(() =>
  hasAccessByCodes(['erp:product-price-permission:update']),
);

const activeDepartments = computed(() =>
  departments.value.filter((dept) => dept.status === 0),
);

const departmentMap = computed(
  () => new Map(departments.value.map((dept) => [dept.id, dept])),
);

const fieldMap = computed(
  () => new Map(fields.value.map((field) => [field.fieldKey, field])),
);

const configuredDeptIdSet = computed(() => {
  const result = new Set<number>();
  fields.value.forEach((field) => {
    normalizeIds(field.deptIds).forEach((deptId) => result.add(deptId));
  });
  return result;
});

const activeConfiguredDeptCount = computed(
  () =>
    activeDepartments.value.filter((dept) =>
      configuredDeptIdSet.value.has(dept.id),
    ).length,
);

const availableDeptCount = computed(() =>
  Math.max(activeDepartments.value.length - activeConfiguredDeptCount.value, 0),
);

const editingGroup = computed(() =>
  permissionGroups.value.find(
    (group) => group.groupKey === editingGroupKey.value,
  ),
);

const editingDeptIdSet = computed(
  () => new Set(editingGroup.value?.deptIds || []),
);

const modalOpen = computed({
  get: () => createOpen.value || editOpen.value,
  set: (open: boolean) => {
    if (!open) resetDraft();
  },
});

const modalTitle = computed(() =>
  editOpen.value ? '编辑价格查看授权' : '新增价格查看授权',
);

const modalOkText = computed(() => (editOpen.value ? '确定修改' : '确定新增'));

const modalDeptPlaceholder = computed(() =>
  editOpen.value ? '选择当前组或未设置权限的部门' : '选择未设置过权限的部门',
);

const modalDeptHint = computed(() =>
  editOpen.value
    ? '当前组部门可调整；其他权限组中的部门不可重复选择。'
    : `当前还有 ${availableDeptCount.value} 个启用部门可新增授权。`,
);

const modalPreviewText = computed(() =>
  editOpen.value
    ? `将把 ${draftDeptIds.value.length} 个部门调整为 ${draftFieldKeys.value.length} 个价格字段`
    : `将为 ${draftDeptIds.value.length} 个部门设置 ${draftFieldKeys.value.length} 个价格字段`,
);

const createDeptTreeData = computed<TreeSelectProps['treeData']>(() =>
  buildDeptTreeData(new Set<number>()),
);

const editableDeptTreeData = computed<TreeSelectProps['treeData']>(() =>
  buildDeptTreeData(editingDeptIdSet.value),
);

const modalDeptTreeData = computed<TreeSelectProps['treeData']>(() =>
  editOpen.value ? editableDeptTreeData.value : createDeptTreeData.value,
);

const modalSelectableDeptIds = computed(() =>
  departments.value
    .filter((dept) => isDeptSelectableInModal(dept.id))
    .map((dept) => dept.id)
    .toSorted(compareDept),
);

const selectedSelectableDeptCount = computed(() => {
  const selectableIds = new Set(modalSelectableDeptIds.value);
  return normalizeIds(draftDeptIds.value).filter((deptId) =>
    selectableIds.has(deptId),
  ).length;
});

const allModalDeptSelected = computed(
  () =>
    modalSelectableDeptIds.value.length > 0 &&
    selectedSelectableDeptCount.value === modalSelectableDeptIds.value.length,
);

const someModalDeptSelected = computed(
  () =>
    selectedSelectableDeptCount.value > 0 &&
    selectedSelectableDeptCount.value < modalSelectableDeptIds.value.length,
);

function buildDeptTreeData(currentDeptIds: Set<number>) {
  const flat = departments.value.map((dept) => {
    const inCurrentGroup = currentDeptIds.has(dept.id);
    const configuredByOtherGroup =
      configuredDeptIdSet.value.has(dept.id) && !inCurrentGroup;
    const disabled =
      configuredByOtherGroup || (dept.status !== 0 && !inCurrentGroup);
    let suffix = '';
    if (dept.status !== 0 && !inCurrentGroup) {
      suffix = '（已停用）';
    } else if (configuredByOtherGroup) {
      suffix = '（已设置）';
    }
    return {
      ...dept,
      disabled,
      name: `${dept.name}${suffix}`,
    };
  });
  return handleTree(flat) as TreeSelectProps['treeData'];
}

function isDeptSelectableInModal(deptId: number) {
  const dept = departmentMap.value.get(deptId);
  if (!dept) return false;
  if (editOpen.value && editingDeptIdSet.value.has(deptId)) return true;
  return dept.status === 0 && !configuredDeptIdSet.value.has(deptId);
}

const dirtyFieldKeys = computed(() =>
  fields.value
    .filter(
      (field) =>
        normalizeIds(field.deptIds).join(',') !==
        originalDeptIds.value[field.fieldKey],
    )
    .map((field) => field.fieldKey),
);

const dirty = computed(() => dirtyFieldKeys.value.length > 0);

const fieldOptions = computed(() =>
  fields.value.map((field) => ({
    label: getFieldLabel(field.fieldKey),
    value: field.fieldKey,
  })),
);

const permissionGroups = computed<PermissionGroup[]>(() => {
  const groups = new Map<string, PermissionGroup>();
  const deptIds = [...configuredDeptIdSet.value].toSorted(compareDept);

  deptIds.forEach((deptId) => {
    const fieldKeys = getCurrentFieldKeysByDept(deptId);
    if (fieldKeys.length === 0) return;

    const groupKey = fieldKeys.join('|');
    const group =
      groups.get(groupKey) ||
      ({
        changed: false,
        deptIds: [],
        deptNames: [],
        fieldKeys,
        fieldLabels: fieldKeys.map((fieldKey) => getFieldLabel(fieldKey)),
        groupKey,
      } satisfies PermissionGroup);

    group.deptIds.push(deptId);
    group.deptNames.push(getDeptLabel(deptId));
    group.changed =
      group.changed ||
      groupKey !== getOriginalFieldKeysByDept(deptId).join('|');
    groups.set(groupKey, group);
  });

  return [...groups.values()].toSorted((a, b) => {
    const firstDeptCompare = compareDept(a.deptIds[0] || 0, b.deptIds[0] || 0);
    if (firstDeptCompare !== 0) return firstDeptCompare;
    return a.groupKey.localeCompare(b.groupKey);
  });
});

const visiblePermissionGroups = computed(() => {
  const query = keyword.value.trim().toLocaleLowerCase();
  return permissionGroups.value.filter((group) => {
    if (
      fieldFilter.value !== 'all' &&
      !group.fieldKeys.includes(fieldFilter.value)
    ) {
      return false;
    }
    if (!query) return true;

    return [...group.fieldKeys, ...group.fieldLabels, ...group.deptNames].some(
      (text) => text.toLocaleLowerCase().includes(query),
    );
  });
});

const matchingGroup = computed(() => {
  const groupKey = normalizeFieldKeys(draftFieldKeys.value).join('|');
  if (!groupKey) return;
  return permissionGroups.value.find(
    (group) =>
      group.groupKey === groupKey && group.groupKey !== editingGroupKey.value,
  );
});

const canSubmitPermission = computed(
  () => draftDeptIds.value.length > 0 && draftFieldKeys.value.length > 0,
);

const columns: TableColumnsType = [
  { key: 'index', title: '序号', width: 64 },
  { key: 'fields', title: '可查看价格字段', width: 360 },
  { key: 'deptCount', title: '部门数', width: 100 },
  { key: 'departments', title: '授权部门', width: 460 },
  { key: 'state', title: '状态', width: 110 },
  { fixed: 'right', key: 'action', title: '操作', width: 150 },
];

function normalizeIds(ids: number[]) {
  return [...new Set((ids || []).filter((id) => Number.isFinite(id)))].toSorted(
    (a, b) => a - b,
  );
}

function normalizeFieldKeys(keys: string[]) {
  const fieldOrder = new Map(
    fields.value.map((field, index) => [field.fieldKey, index]),
  );
  return [...new Set(keys)]
    .filter((key) => fieldMap.value.has(key))
    .toSorted((a, b) => (fieldOrder.get(a) ?? 0) - (fieldOrder.get(b) ?? 0));
}

function compareDept(a: number, b: number) {
  const deptA = departmentMap.value.get(a);
  const deptB = departmentMap.value.get(b);
  if (!deptA || !deptB) return a - b;
  return (
    (deptA.sort ?? 0) - (deptB.sort ?? 0) ||
    deptA.name.localeCompare(deptB.name) ||
    deptA.id - deptB.id
  );
}

function getDeptLabel(deptId: number) {
  const dept = departmentMap.value.get(deptId);
  if (!dept) return `部门 ${deptId}`;
  return dept.status === 0 ? dept.name : `${dept.name}（已停用）`;
}

function getFieldLabel(fieldKey: string) {
  return fieldMap.value.get(fieldKey)?.fieldLabel || '未命名价格字段';
}

function getCurrentFieldKeysByDept(deptId: number) {
  return normalizeFieldKeys(
    fields.value
      .filter((field) => normalizeIds(field.deptIds).includes(deptId))
      .map((field) => field.fieldKey),
  );
}

function getOriginalFieldKeysByDept(deptId: number) {
  return normalizeFieldKeys(
    fields.value
      .filter((field) => {
        const snapshot = originalDeptIds.value[field.fieldKey] || '';
        if (!snapshot) return false;
        return snapshot.split(',').map(Number).includes(deptId);
      })
      .map((field) => field.fieldKey),
  );
}

function snapshotCurrentFields() {
  originalDeptIds.value = Object.fromEntries(
    fields.value.map((field) => [
      field.fieldKey,
      normalizeIds(field.deptIds).join(','),
    ]),
  );
}

async function loadConfig(force = false) {
  if (dirty.value && !force) {
    Modal.confirm({
      content: '刷新会丢失当前未保存的部门授权修改。',
      okText: '继续刷新',
      title: '确认刷新配置？',
      onOk: () => loadConfig(true),
    });
    return;
  }
  loading.value = true;
  try {
    const config = await getDeptPriceFieldConfig();
    configVersion.value = config.configVersion;
    departments.value = config.departments || [];
    fields.value = (config.fields || []).map((field) => ({
      ...field,
      deptIds: normalizeIds(field.deptIds || []),
    }));
    snapshotCurrentFields();
    resetDraft();
  } finally {
    loading.value = false;
  }
}

function resetChanges() {
  fields.value.forEach((field) => {
    const value = originalDeptIds.value[field.fieldKey] || '';
    field.deptIds = value ? value.split(',').map(Number) : [];
  });
  resetDraft();
  message.success('已重置未保存修改');
}

function openCreateModal() {
  if (!canUpdate.value) return;
  resetDraft();
  createOpen.value = true;
}

function openEditModal(group: PermissionGroup) {
  if (!canUpdate.value) return;
  resetDraft();
  editingGroupKey.value = group.groupKey;
  draftDeptIds.value = normalizeIds(group.deptIds);
  draftFieldKeys.value = normalizeFieldKeys(group.fieldKeys);
  editOpen.value = true;
}

function resetDraft() {
  createOpen.value = false;
  editOpen.value = false;
  editingGroupKey.value = '';
  draftDeptIds.value = [];
  draftFieldKeys.value = [];
}

function validateDraftPermission() {
  if (draftDeptIds.value.length === 0) {
    message.warning('请选择需要设置的部门');
    return false;
  }
  if (draftFieldKeys.value.length === 0) {
    message.warning('请选择允许查看的价格字段');
    return false;
  }
  return true;
}

function toggleAllModalDepts(checked: boolean) {
  draftDeptIds.value = checked ? [...modalSelectableDeptIds.value] : [];
}

function handleAllModalDeptsChange(event: Event) {
  toggleAllModalDepts((event.target as HTMLInputElement).checked);
}

function handleSubmitPermission() {
  if (editOpen.value) {
    handleEditPermission();
    return;
  }
  handleCreatePermission();
}

function handleCreatePermission() {
  if (!validateDraftPermission()) return;

  const allowedDeptIds = normalizeIds(draftDeptIds.value).filter((deptId) => {
    const dept = departmentMap.value.get(deptId);
    return dept?.status === 0 && !configuredDeptIdSet.value.has(deptId);
  });
  if (allowedDeptIds.length === 0) {
    message.warning('所选部门已设置过权限或已停用，请重新选择');
    draftDeptIds.value = [];
    return;
  }

  const mergeIntoExistingGroup = Boolean(matchingGroup.value);
  const fieldKeys = new Set(normalizeFieldKeys(draftFieldKeys.value));
  fields.value.forEach((field) => {
    if (!fieldKeys.has(field.fieldKey)) return;
    field.deptIds = normalizeIds([...field.deptIds, ...allowedDeptIds]);
  });

  const mergeTip = mergeIntoExistingGroup ? '，已并入相同权限组' : '';
  message.success(
    `已新增 ${allowedDeptIds.length} 个部门的价格查看权限${mergeTip}`,
  );
  resetDraft();
}

function handleEditPermission() {
  if (!validateDraftPermission()) return;

  const currentGroup = editingGroup.value;
  if (!currentGroup) {
    message.warning('当前权限组已变化，请刷新后重试');
    resetDraft();
    return;
  }

  const currentDeptIds = new Set(currentGroup.deptIds);
  const allowedDeptIds = normalizeIds(draftDeptIds.value).filter((deptId) => {
    const dept = departmentMap.value.get(deptId);
    if (currentDeptIds.has(deptId)) return true;
    return dept?.status === 0 && !configuredDeptIdSet.value.has(deptId);
  });
  if (allowedDeptIds.length === 0) {
    message.warning('请选择当前组部门或未设置过权限的启用部门');
    return;
  }

  const mergeIntoExistingGroup = Boolean(matchingGroup.value);
  const fieldKeys = new Set(normalizeFieldKeys(draftFieldKeys.value));
  clearDepartmentsFromAllFields(currentGroup.deptIds);
  fields.value.forEach((field) => {
    if (!fieldKeys.has(field.fieldKey)) return;
    field.deptIds = normalizeIds([...field.deptIds, ...allowedDeptIds]);
  });

  const mergeTip = mergeIntoExistingGroup ? '，已并入相同权限组' : '';
  message.success(`权限组已更新${mergeTip}`);
  resetDraft();
}

function clearDepartmentsFromAllFields(deptIds: number[]) {
  const deptIdSet = new Set(deptIds);
  fields.value.forEach((field) => {
    field.deptIds = normalizeIds(
      field.deptIds.filter((deptId) => !deptIdSet.has(deptId)),
    );
  });
}

function removeDeptFromGroup(deptId: number) {
  clearDepartmentsFromAllFields([deptId]);
  message.success(`${getDeptLabel(deptId)} 已从当前权限组移除`);
}

function removeGroup(group: PermissionGroup) {
  Modal.confirm({
    content: `将清空 ${group.deptIds.length} 个部门的价格查看权限，保存后生效。`,
    okButtonProps: { danger: true },
    okText: '删除权限组',
    title: '确认删除这个权限组？',
    onOk: () => {
      clearDepartmentsFromAllFields(group.deptIds);
      message.success('权限组已删除');
    },
  });
}

async function saveConfig() {
  if (!dirty.value) {
    message.info('当前没有需要保存的修改');
    return;
  }
  saving.value = true;
  try {
    const dirtyKeys = new Set(dirtyFieldKeys.value);
    await updateDeptPriceFieldConfig({
      configVersion: configVersion.value,
      items: fields.value
        .filter((field) => dirtyKeys.has(field.fieldKey))
        .map((field) => ({
          deptIds: normalizeIds(field.deptIds),
          fieldKey: field.fieldKey,
        })),
    });
    clearFieldPermissionCache('erp_product');
    message.success('配件价格查看权限已保存');
    await loadConfig(true);
  } finally {
    saving.value = false;
  }
}

function handleBeforeUnload(event: BeforeUnloadEvent) {
  if (!dirty.value) return;
  event.preventDefault();
  event.returnValue = '';
}

onBeforeRouteLeave(() => {
  if (!dirty.value) return true;
  return window.confirm('存在未保存的价格查看权限修改，确认离开当前页面？');
});

onMounted(() => {
  window.addEventListener('beforeunload', handleBeforeUnload);
  void loadConfig(true);
});

onBeforeUnmount(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload);
});
</script>

<template>
  <Page title="配件价格查看权限">
    <div class="price-permission-page">
      <div class="permission-overview mb-4">
        <div class="overview-metrics">
          <div class="metric">
            <strong>{{ permissionGroups.length }}</strong
            ><span>权限组</span>
          </div>
          <div class="metric metric-blue">
            <strong>{{ activeConfiguredDeptCount }}</strong
            ><span>已设置部门</span>
          </div>
          <div class="metric metric-green">
            <strong>{{ availableDeptCount }}</strong
            ><span>可新增部门</span>
          </div>
          <div class="metric">
            <strong>{{ fields.length }}</strong
            ><span>价格字段</span>
          </div>
        </div>
      </div>

      <Card :bordered="false" class="permission-card">
        <div class="toolbar">
          <div class="toolbar-search">
            <Input
              v-model:value="keyword"
              allow-clear
              class="w-[280px]"
              placeholder="搜索部门或价格字段"
            />
            <Select v-model:value="fieldFilter" class="w-[180px]">
              <Select.Option value="all">全部价格字段</Select.Option>
              <Select.Option
                v-for="field in fieldOptions"
                :key="field.value"
                :value="field.value"
              >
                {{ field.label }}
              </Select.Option>
            </Select>
            <Button :loading="loading" @click="loadConfig(false)">刷新</Button>
          </div>
          <div class="toolbar-actions">
            <span v-if="dirty" class="dirty-tip"
              >{{ dirtyFieldKeys.length }} 项字段未保存</span
            >
            <Button :disabled="!dirty" @click="resetChanges">重置</Button>
            <Button
              v-access:code="['erp:product-price-permission:update']"
              type="primary"
              :disabled="!canUpdate"
              @click="openCreateModal"
            >
              <template #icon>
                <IconifyIcon icon="lucide:plus" />
              </template>
              新增授权
            </Button>
            <Button
              v-access:code="['erp:product-price-permission:update']"
              type="primary"
              :disabled="!canUpdate || !dirty"
              :loading="saving"
              @click="saveConfig"
            >
              保存修改
            </Button>
          </div>
        </div>

        <Table
          :columns="columns"
          :data-source="visiblePermissionGroups"
          :loading="loading"
          :pagination="false"
          row-key="groupKey"
          :scroll="{ x: 'max-content', y: 'calc(100vh - 270px)' }"
          size="middle"
        >
          <template #bodyCell="{ column, record, index }">
            <template v-if="column.key === 'index'">
              <span class="row-index">{{ index + 1 }}</span>
            </template>

            <template v-else-if="column.key === 'fields'">
              <div class="tag-list field-tags">
                <Tooltip
                  v-for="fieldKey in record.fieldKeys"
                  :key="fieldKey"
                  :title="getFieldLabel(fieldKey)"
                >
                  <Tag class="field-tag" color="blue">
                    {{ getFieldLabel(fieldKey) }}
                  </Tag>
                </Tooltip>
              </div>
            </template>

            <template v-else-if="column.key === 'deptCount'">
              <span class="count-text">{{ record.deptIds.length }}</span>
            </template>

            <template v-else-if="column.key === 'departments'">
              <div class="dept-cell">
                <div class="tag-list dept-tags">
                  <Tag
                    v-for="deptId in record.deptIds.slice(0, 6)"
                    :key="deptId"
                    class="dept-tag"
                  >
                    {{ getDeptLabel(deptId) }}
                    <Popconfirm
                      v-if="canUpdate"
                      title="确认移除该部门的价格查看权限？"
                      ok-text="移除"
                      cancel-text="取消"
                      @confirm="removeDeptFromGroup(deptId)"
                    >
                      <button class="tag-remove" type="button">×</button>
                    </Popconfirm>
                  </Tag>
                  <Popover
                    v-if="record.deptIds.length > 6"
                    placement="bottomLeft"
                    trigger="click"
                  >
                    <template #content>
                      <div class="dept-popover">
                        <div
                          v-for="deptId in record.deptIds"
                          :key="deptId"
                          class="dept-popover-row"
                        >
                          <span>{{ getDeptLabel(deptId) }}</span>
                          <Popconfirm
                            v-if="canUpdate"
                            title="确认移除该部门的价格查看权限？"
                            ok-text="移除"
                            cancel-text="取消"
                            @confirm="removeDeptFromGroup(deptId)"
                          >
                            <Button danger size="small" type="link">
                              移除
                            </Button>
                          </Popconfirm>
                        </div>
                      </div>
                    </template>
                    <Tag class="more-tag">+{{ record.deptIds.length - 6 }}</Tag>
                  </Popover>
                </div>
              </div>
            </template>

            <template v-else-if="column.key === 'state'">
              <Tag v-if="record.changed" color="orange">已修改</Tag>
              <Tag v-else color="green">已保存</Tag>
            </template>

            <template v-else-if="column.key === 'action'">
              <div class="action-buttons">
                <Button
                  size="small"
                  type="link"
                  :disabled="!canUpdate"
                  @click="openEditModal(record)"
                >
                  <template #icon>
                    <IconifyIcon icon="lucide:pencil" />
                  </template>
                  编辑
                </Button>
                <Button
                  danger
                  size="small"
                  type="link"
                  :disabled="!canUpdate"
                  @click="removeGroup(record)"
                >
                  <template #icon>
                    <IconifyIcon icon="lucide:trash-2" />
                  </template>
                  删除
                </Button>
              </div>
            </template>
          </template>

          <template #emptyText>
            <div class="empty-state">
              <strong>暂无权限组</strong>
              <span
                >点击“新增授权”为未设置过的部门批量选择可查看价格字段。</span
              >
            </div>
          </template>
        </Table>
      </Card>

      <Modal
        v-model:open="modalOpen"
        :title="modalTitle"
        width="920px"
        :ok-text="modalOkText"
        cancel-text="取消"
        :ok-button-props="{ disabled: !canSubmitPermission }"
        @cancel="resetDraft"
        @ok="handleSubmitPermission"
      >
        <div class="create-modal">
          <div class="create-panel">
            <div class="panel-title panel-title-row">
              <div class="panel-title-text">
                <span>选择部门</span>
                <small>{{ modalDeptHint }}</small>
              </div>
              <div class="dept-select-actions">
                <Checkbox
                  :checked="allModalDeptSelected"
                  :disabled="modalSelectableDeptIds.length === 0"
                  :indeterminate="someModalDeptSelected"
                  @change="handleAllModalDeptsChange"
                >
                  全选可选部门
                </Checkbox>
                <Button
                  size="small"
                  type="link"
                  :disabled="draftDeptIds.length === 0"
                  @click="draftDeptIds = []"
                >
                  清空
                </Button>
              </div>
            </div>
            <TreeSelect
              v-model:value="draftDeptIds"
              allow-clear
              class="w-full"
              :field-names="{
                label: 'name',
                value: 'id',
                children: 'children',
              }"
              :max-tag-count="4"
              multiple
              :placeholder="modalDeptPlaceholder"
              show-search
              tree-node-filter-prop="name"
              tree-checkable
              tree-default-expand-all
              :tree-data="modalDeptTreeData"
            />
          </div>

          <div class="create-panel">
            <div class="panel-title">
              <span>选择价格字段</span>
              <small>所选部门将拥有完全相同的字段查看权限</small>
            </div>
            <CheckboxGroup
              v-model:value="draftFieldKeys"
              class="field-checkbox-group"
            >
              <Checkbox
                v-for="field in fields"
                :key="field.fieldKey"
                :value="field.fieldKey"
                class="field-checkbox"
              >
                <Tooltip :title="getFieldLabel(field.fieldKey)">
                  <span class="checkbox-label">
                    {{ getFieldLabel(field.fieldKey) }}
                  </span>
                </Tooltip>
              </Checkbox>
            </CheckboxGroup>
          </div>
        </div>

        <div class="create-preview">
          <span>{{ modalPreviewText }}</span>
          <Tag v-if="matchingGroup" color="blue">将并入已有相同权限组</Tag>
          <Tag
            v-else-if="draftFieldKeys.length > 0 && createOpen"
            color="green"
          >
            将创建新权限组
          </Tag>
        </div>
      </Modal>
    </div>
  </Page>
</template>

<style scoped>
.price-permission-page {
  --ink: #172033;
  --line: #e4e7ec;
  --muted: #667085;
  --surface-soft: #f7f9fc;
}

.permission-overview {
  display: flex;
  min-height: 62px;
  align-items: center;
  padding: 12px 18px;
  border: 1px solid #dbe2ee;
  border-left: 4px solid #244c8f;
  border-radius: 8px;
  background: #fff;
}

.overview-metrics {
  display: grid;
  width: 100%;
  grid-template-columns: repeat(4, minmax(100px, 1fr));
}

.metric {
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 8px;
  border-right: 1px solid var(--line);
}

.metric:last-child {
  border-right: 0;
}

.metric strong {
  color: var(--ink);
  font-size: 24px;
  font-variant-numeric: tabular-nums;
}

.metric span {
  color: var(--muted);
  font-size: 12px;
}

.metric-blue strong {
  color: #1d4ed8;
}

.metric-green strong {
  color: #15803d;
}

.permission-card :deep(.ant-card-body) {
  padding: 0;
}

.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--line);
}

.toolbar-search,
.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.dirty-tip {
  color: #b45309;
  font-size: 12px;
  white-space: nowrap;
}

.row-index {
  color: #98a2b3;
  font-variant-numeric: tabular-nums;
}

.count-text {
  color: var(--ink);
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.field-tags,
.dept-tags {
  max-width: 100%;
}

.field-tag,
.dept-tag,
.more-tag {
  display: inline-flex;
  max-width: 160px;
  align-items: center;
  margin-inline-end: 0;
  overflow: hidden;
  border-radius: 4px;
  font-size: 12px;
}

.dept-tag {
  gap: 4px;
}

.tag-remove {
  display: inline-flex;
  width: 14px;
  height: 14px;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: 0;
  background: transparent;
  color: #667085;
  cursor: pointer;
  font-size: 13px;
  line-height: 1;
}

.tag-remove:hover {
  color: #dc2626;
}

.dept-popover {
  display: flex;
  width: 260px;
  max-height: 280px;
  flex-direction: column;
  gap: 4px;
  overflow: auto;
}

.dept-popover-row {
  display: flex;
  min-height: 28px;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  color: var(--ink);
  font-size: 12px;
}

.action-buttons {
  display: flex;
  align-items: center;
  gap: 4px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 30px 0;
  color: var(--muted);
}

.empty-state strong {
  color: var(--ink);
}

.create-modal {
  display: grid;
  grid-template-columns: minmax(260px, 0.9fr) minmax(360px, 1.1fr);
  gap: 16px;
}

.create-panel {
  min-height: 260px;
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fff;
}

.panel-title {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
  color: var(--ink);
  font-size: 14px;
  font-weight: 600;
}

.panel-title-row {
  flex-direction: row;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.panel-title-text {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}

.dept-select-actions {
  display: flex;
  flex: none;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

.dept-select-actions :deep(.ant-checkbox-wrapper) {
  color: var(--ink);
  font-size: 12px;
  font-weight: 400;
}

.panel-title small,
.modal-hint {
  color: var(--muted);
  font-size: 12px;
  font-weight: 400;
}

.modal-hint {
  margin-top: 10px;
}

.field-checkbox-group {
  display: grid;
  max-height: 330px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  overflow: auto;
}

.field-checkbox {
  display: flex;
  min-height: 38px;
  align-items: center;
  margin-inline-start: 0 !important;
  padding: 6px 8px;
  border: 1px solid #edf0f5;
  border-radius: 6px;
  background: var(--surface-soft);
}

.field-checkbox :deep(.ant-checkbox + span) {
  display: block;
  min-width: 0;
  flex: 1;
}

.checkbox-label {
  display: block;
  max-width: 100%;
  overflow: hidden;
  color: var(--ink);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.create-preview {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 14px;
  padding: 10px 12px;
  border: 1px solid #dbe2ee;
  border-radius: 6px;
  background: var(--surface-soft);
  color: var(--muted);
  font-size: 12px;
}

@media (max-width: 900px) {
  .permission-overview,
  .toolbar {
    align-items: stretch;
    flex-direction: column;
  }

  .overview-metrics,
  .create-modal {
    width: 100%;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    row-gap: 12px;
  }

  .toolbar-search,
  .toolbar-actions {
    flex-wrap: wrap;
  }
}

@media (max-width: 640px) {
  .overview-metrics,
  .create-modal,
  .field-checkbox-group {
    grid-template-columns: 1fr;
  }
}
</style>
