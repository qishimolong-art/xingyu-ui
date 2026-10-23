<script lang="ts" setup>
import type { TableColumnsType } from 'ant-design-vue';

import type { ErpWarehouseApi } from '#/api/erp/stock/warehouse';
import type { SystemDeptApi } from '#/api/system/dept';

import { computed, onBeforeUnmount, ref, watch } from 'vue';

import { useAccess } from '@vben/access';

import {
  Button,
  Checkbox,
  Empty,
  Input,
  message,
  Radio,
  Table,
  Tag,
} from 'ant-design-vue';

import {
  getWarehouseSaleDeptOptions,
  getWarehouseSaleDeptPermissions,
  saveWarehouseSaleDeptPermissions,
} from '#/api/erp/stock/warehouse';

const props = defineProps<{
  detail?: boolean;
  warehouse?: ErpWarehouseApi.Warehouse;
}>();

const HIDDEN_TOP_DEPT_NAME = '四川兴宇科技服务有限公司';

interface DeptTableRow {
  id: number;
  name: string;
  fullName: string;
  level: number;
  parentName?: string;
  status?: number;
}

const { hasAccessByCodes } = useAccess();
const loading = ref(false);
const saving = ref(false);
const loadError = ref('');
const loaded = ref(false);
let requestSequence = 0;
onBeforeUnmount(() => {
  requestSequence += 1;
});
const canQuery = computed(() =>
  hasAccessByCodes([
    'erp:warehouse-permission:query',
    'erp:warehouse-permission:update',
  ]),
);
const deptOptions = ref<SystemDeptApi.Dept[]>([]);
const deptIds = ref<number[]>([]);
const scopeType = ref<ErpWarehouseApi.WarehouseSaleDeptScopeType>('SPECIFIED');
const keyword = ref('');

const warehouseId = computed(() => props.warehouse?.id);
const ownerDeptId = computed(() => props.warehouse?.deptId);
const isDirectWarehouse = computed(
  () => props.warehouse?.directWarehouse === true,
);
const isAllScope = computed(() => scopeType.value === 'ALL');
const canSave = computed(
  () =>
    !props.detail &&
    loaded.value &&
    !loading.value &&
    !saving.value &&
    !loadError.value &&
    Boolean(warehouseId.value) &&
    hasAccessByCodes(['erp:warehouse-permission:update']),
);
const deptRows = computed(() => buildDeptRows(deptOptions.value));
const deptRowMap = computed(
  () => new Map(deptRows.value.map((item) => [item.id, item])),
);
const childrenMap = computed(() => buildChildrenMap(deptOptions.value));
const hiddenTopDeptIds = computed(() =>
  findHiddenTopDeptIds(deptOptions.value),
);
const ownerDeptName = computed(() => {
  const ownerId = ownerDeptId.value;
  return ownerId ? deptRowMap.value.get(ownerId)?.fullName || '-' : '-';
});
const selectedSet = computed(() =>
  isAllScope.value
    ? new Set(deptRows.value.map((item) => item.id))
    : new Set(filterVisibleDeptIds(deptIds.value)),
);
const filteredDeptRows = computed(() =>
  deptRows.value.filter((item) => matchesKeyword(item)),
);
const selectableFilteredRows = computed(() =>
  filteredDeptRows.value.filter(
    (item) => item.id !== ownerDeptId.value && item.status === 0,
  ),
);
const selectedCount = computed(
  () => deptRows.value.filter((item) => selectedSet.value.has(item.id)).length,
);
const headerChecked = computed(
  () =>
    selectableFilteredRows.value.length > 0 &&
    selectableFilteredRows.value.every((item) =>
      selectedSet.value.has(item.id),
    ),
);
const headerIndeterminate = computed(() => {
  const checkedCount = selectableFilteredRows.value.filter((item) =>
    selectedSet.value.has(item.id),
  ).length;
  return checkedCount > 0 && checkedCount < selectableFilteredRows.value.length;
});

const columns: TableColumnsType<DeptTableRow> = [
  { title: '', dataIndex: 'selected', width: 56 },
  { title: '部门名称', dataIndex: 'fullName', width: 260 },
  { title: '部门ID', dataIndex: 'id', width: 90 },
  { title: '状态', dataIndex: 'status', width: 180 },
];

function isHiddenTopDept(dept: SystemDeptApi.Dept, level: number) {
  return level === 0 && String(dept.name || '').trim() === HIDDEN_TOP_DEPT_NAME;
}

function findHiddenTopDeptIds(depts: SystemDeptApi.Dept[]) {
  return new Set(
    depts
      .filter((dept) => dept.id && isHiddenTopDept(dept, 0))
      .map((dept) => dept.id as number),
  );
}

function isHiddenTopDeptId(deptId?: number) {
  return deptId !== undefined && hiddenTopDeptIds.value.has(deptId);
}

function filterVisibleDeptIds(ids: number[] = []) {
  return ids.filter((id) => !isHiddenTopDeptId(id));
}

function flattenDepts(depts: SystemDeptApi.Dept[]) {
  const rows: SystemDeptApi.Dept[] = [];
  const append = (dept: SystemDeptApi.Dept, parentId?: number) => {
    rows.push({
      ...dept,
      parentId: dept.parentId ?? parentId,
    });
    (dept.children || []).forEach((child) => append(child, dept.id));
  };
  depts.forEach((dept) => append(dept));
  return rows;
}

function normalizeText(value?: null | number | string) {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

function matchesKeyword(item: DeptTableRow) {
  const input = normalizeText(keyword.value);
  if (!input) {
    return true;
  }
  return [item.id, item.name, item.fullName, item.parentName].some((value) =>
    normalizeText(value).includes(input),
  );
}

function buildChildrenMap(depts: SystemDeptApi.Dept[]) {
  const flatDepts = flattenDepts(depts);
  const map = new Map<number, number[]>();
  flatDepts.forEach((dept) => {
    if (!dept.id || !dept.parentId) {
      return;
    }
    const children = map.get(dept.parentId) || [];
    children.push(dept.id);
    map.set(dept.parentId, children);
  });
  return map;
}

function buildDeptRows(depts: SystemDeptApi.Dept[]) {
  const flatDepts = flattenDepts(depts);
  const deptMap = new Map<number, SystemDeptApi.Dept>();
  flatDepts.forEach((dept) => {
    if (dept.id) {
      deptMap.set(dept.id, dept);
    }
  });
  const rows: DeptTableRow[] = [];
  const visited = new Set<number>();
  const append = (dept: SystemDeptApi.Dept, parentName = '', level = 0) => {
    if (!dept.id || visited.has(dept.id)) {
      return;
    }
    visited.add(dept.id);
    const fullName = parentName ? `${parentName} / ${dept.name}` : dept.name;
    if (isHiddenTopDeptId(dept.id)) {
      flatDepts
        .filter((item) => item.parentId === dept.id)
        .forEach((child) => append(child, parentName, level));
      return;
    }
    rows.push({
      id: dept.id,
      name: dept.name,
      fullName,
      parentName,
      level,
      status: dept.status,
    });
    flatDepts
      .filter((item) => item.parentId === dept.id)
      .forEach((child) => append(child, fullName, level + 1));
  };
  flatDepts
    .filter((dept) => !dept.parentId || !deptMap.has(dept.parentId))
    .forEach((dept) => append(dept));
  flatDepts.forEach((dept) => append(dept));
  return rows;
}

function getDescendantDeptIds(deptId: number, ids = new Set<number>()) {
  (childrenMap.value.get(deptId) || []).forEach((childId) => {
    ids.add(childId);
    getDescendantDeptIds(childId, ids);
  });
  return [...ids];
}

function isChecked(deptId: number) {
  return (
    isAllScope.value ||
    deptId === ownerDeptId.value ||
    selectedSet.value.has(deptId)
  );
}

function canToggleDept(item?: DeptTableRow) {
  return (
    canSave.value &&
    !isAllScope.value &&
    item?.status === 0 &&
    item.id !== ownerDeptId.value
  );
}

function getToggleIds(item: DeptTableRow) {
  return [item.id, ...getDescendantDeptIds(item.id)].filter(
    (id) =>
      id !== ownerDeptId.value &&
      !isHiddenTopDeptId(id) &&
      deptRowMap.value.get(id)?.status === 0,
  );
}

function handleScopeChange(
  nextScopeType: ErpWarehouseApi.WarehouseSaleDeptScopeType,
) {
  if (!canSave.value || isDirectWarehouse.value) {
    return;
  }
  if (scopeType.value === 'ALL' && nextScopeType === 'SPECIFIED') {
    deptIds.value = deptRows.value
      .filter((item) => item.status === 0 && item.id !== ownerDeptId.value)
      .map((item) => item.id);
  }
  scopeType.value = nextScopeType;
}

function toggleDept(item: DeptTableRow, checked: boolean) {
  if (!canToggleDept(item)) {
    return;
  }
  const next = new Set(selectedSet.value);
  getToggleIds(item).forEach((id) => {
    if (checked) {
      next.add(id);
      return;
    }
    next.delete(id);
  });
  deptIds.value = [...next];
}

function canToggleRecord(record: Record<string, any>) {
  return canToggleDept(record as DeptTableRow);
}

function toggleRecord(record: Record<string, any>, checked: boolean) {
  toggleDept(record as DeptTableRow, checked);
}

function toggleFilteredDepts(checked: boolean) {
  if (!canSave.value) {
    return;
  }
  const next = new Set(selectedSet.value);
  selectableFilteredRows.value.forEach((item) => {
    getToggleIds(item).forEach((id) => {
      if (checked) {
        next.add(id);
        return;
      }
      next.delete(id);
    });
  });
  deptIds.value = [...next];
}

async function loadPermissions() {
  const sequence = ++requestSequence;
  loaded.value = false;
  loadError.value = '';
  keyword.value = '';
  if (!warehouseId.value || !canQuery.value) {
    deptOptions.value = [];
    deptIds.value = [];
    scopeType.value = 'SPECIFIED';
    return;
  }
  loading.value = true;
  try {
    const [data, options] = await Promise.all([
      getWarehouseSaleDeptPermissions(warehouseId.value),
      getWarehouseSaleDeptOptions(),
    ]);
    if (sequence !== requestSequence) return;
    deptOptions.value = options || [];
    scopeType.value = isDirectWarehouse.value
      ? 'SPECIFIED'
      : data?.scopeType || 'SPECIFIED';
    deptIds.value = filterVisibleDeptIds(data?.deptIds || []);
    loaded.value = true;
  } catch {
    if (sequence === requestSequence)
      loadError.value = '权限配置加载失败，请重试';
  } finally {
    if (sequence === requestSequence) loading.value = false;
  }
}

async function handleSave() {
  if (!warehouseId.value || !canSave.value) return;
  const id = warehouseId.value;
  const sequence = requestSequence;
  saving.value = true;
  try {
    await saveWarehouseSaleDeptPermissions({
      warehouseId: warehouseId.value,
      scopeType: isDirectWarehouse.value ? 'SPECIFIED' : scopeType.value,
      deptIds: isAllScope.value ? [] : filterVisibleDeptIds(deptIds.value),
    });
    if (sequence !== requestSequence || id !== warehouseId.value) return;
    message.success('保存成功');
    await loadPermissions();
  } finally {
    saving.value = false;
  }
}

watch(
  () => [warehouseId.value, canQuery.value],
  () => {
    void loadPermissions();
  },
  { immediate: true },
);
</script>

<template>
  <div class="warehouse-permission-content">
    <Empty
      v-if="!warehouseId"
      description="请先保存仓库基础信息，再配置权限分发"
    />
    <Empty v-else-if="!canQuery" description="暂无权限分发查询权限" />
    <div v-else class="space-y-3">
      <div v-if="loadError" class="text-red-500">
        {{ loadError }}
        <Button size="small" @click="loadPermissions">重试</Button>
      </div>
      <div class="warehouse-permission-summary">
        <div>仓库名称：{{ warehouse?.name || '-' }}</div>
        <div>所属部门：{{ ownerDeptName }}</div>
        <div>
          授权范围：{{
            isAllScope ? '全部部门可用' : `指定部门（${selectedCount} 个）`
          }}
        </div>
      </div>

      <div class="warehouse-permission-scope">
        <span class="warehouse-permission-scope__label">销售部门范围</span>
        <Radio.Group
          v-if="!isDirectWarehouse"
          :disabled="!canSave"
          :value="scopeType"
          @change="
            (event) =>
              handleScopeChange(
                event.target
                  .value as ErpWarehouseApi.WarehouseSaleDeptScopeType,
              )
          "
        >
          <Radio value="ALL">全部部门可用</Radio>
          <Radio value="SPECIFIED">指定部门可用</Radio>
        </Radio.Group>
        <div v-else class="warehouse-permission-hint">
          系统自动生成的直发仓固定为“指定部门可用”，所属部门不可取消
        </div>
      </div>

      <div class="warehouse-permission-toolbar">
        <Input
          v-model:value="keyword"
          allow-clear
          class="warehouse-permission-search"
          placeholder="搜索部门名称 / ID"
        />
        <div class="flex flex-wrap items-center gap-3">
          <div class="warehouse-permission-hint">
            <template v-if="isAllScope">
              当前及以后新增的部门均自动可用
            </template>
            <template v-else>
              当前选择 {{ selectedCount }} 个；所属部门默认可用
            </template>
          </div>
          <Button
            v-if="canSave"
            :loading="saving"
            size="small"
            type="primary"
            @click="handleSave"
          >
            保存权限分发
          </Button>
        </div>
      </div>

      <Table
        class="warehouse-permission-table"
        :columns="columns"
        :data-source="filteredDeptRows"
        :loading="loading"
        :pagination="false"
        :row-key="(row) => row.id"
        :scroll="{ x: 'max-content', y: 360 }"
        bordered
        size="small"
      >
        <template #headerCell="{ column }">
          <template v-if="column.dataIndex === 'selected'">
            <Checkbox
              :checked="headerChecked"
              :disabled="
                !canSave || isAllScope || selectableFilteredRows.length === 0
              "
              :indeterminate="headerIndeterminate"
              @change="(event) => toggleFilteredDepts(event.target.checked)"
            />
          </template>
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'selected'">
            <Checkbox
              :checked="isChecked(record.id)"
              :disabled="!canToggleRecord(record)"
              @change="(event) => toggleRecord(record, event.target.checked)"
            />
          </template>
          <template v-else-if="column.dataIndex === 'fullName'">
            <span :style="{ paddingLeft: `${record.level * 16}px` }">
              {{ record.fullName }}{{ record.status === 0 ? '' : '（已停用）' }}
            </span>
          </template>
          <template v-else-if="column.dataIndex === 'status'">
            <Tag v-if="record.id === ownerDeptId" color="blue">仓库所属</Tag>
            <Tag v-else-if="isAllScope" color="green">全部部门</Tag>
            <Tag v-else-if="selectedSet.has(record.id)" color="green">
              已分发
            </Tag>
            <Tag v-else color="default">未分发</Tag>
            <Tag
              v-if="record.status !== undefined && record.status !== 0"
              color="orange"
            >
              已停用
            </Tag>
          </template>
        </template>
      </Table>
    </div>
  </div>
</template>

<style scoped>
.warehouse-permission-content {
  padding: 12px;
  font-size: 12px;
}

.warehouse-permission-summary {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;
  padding: 10px 12px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 20%);
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.warehouse-permission-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.warehouse-permission-scope {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 16px;
  padding: 10px 12px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.warehouse-permission-scope__label {
  color: hsl(var(--foreground));
  font-weight: 500;
}

.warehouse-permission-search {
  width: min(360px, 100%);
  height: 32px;
  font-size: 12px;
}

.warehouse-permission-hint {
  color: hsl(var(--muted-foreground));
  font-size: 12px;
}

.warehouse-permission-content :deep(.ant-btn-sm) {
  height: 28px;
  padding: 2px 10px;
  font-size: 12px;
}

.warehouse-permission-table :deep(.ant-table),
.warehouse-permission-table :deep(.ant-table-cell),
.warehouse-permission-content :deep(.ant-empty-description) {
  font-size: 12px;
}

.warehouse-permission-table :deep(.ant-table-thead > tr > th),
.warehouse-permission-table :deep(.ant-table-tbody > tr > td) {
  padding-top: 7px;
  padding-bottom: 7px;
}

@media (max-width: 767px) {
  .warehouse-permission-summary {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
