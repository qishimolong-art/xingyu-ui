<script lang="ts" setup>
import type { TableColumnsType } from 'ant-design-vue';

import type { SystemDeptApi } from '#/api/system/dept';

import { computed, onBeforeUnmount, ref, watch } from 'vue';

import { useAccess } from '@vben/access';
import { handleTree } from '@vben/utils';

import {
  Alert,
  Button,
  Checkbox,
  Empty,
  Input,
  message,
  Spin,
  Table,
  Tag,
} from 'ant-design-vue';

import { getCustomerFormDeptOptions } from '#/api/erp/sale/customer';

const props = withDefaults(
  defineProps<{
    archiveName?: string;
    auth?: string[];
    loadApi: (id: number) => Promise<DeptDistributionData>;
    readonly?: boolean;
    record?: { id?: number; name?: string };
    saveApi: (data: DeptDistributionData) => Promise<unknown>;
    showDeptId?: boolean;
  }>(),
  {
    archiveName: '档案',
    auth: () => [],
    readonly: false,
    record: undefined,
    showDeptId: true,
  },
);

const emit = defineEmits<{ (e: 'success'): void }>();

const HIDDEN_TOP_DEPT_NAME = '四川兴宇科技服务有限公司';

interface DeptDistributionData {
  id: number;
  name?: string;
  deptId?: number;
  deptName?: string;
  deptIds?: number[];
  deptNames?: string;
  deptNameMap?: Record<number, string>;
  allowMultiDept?: boolean;
}

interface DeptDistributionFormData extends Omit<
  DeptDistributionData,
  'deptId' | 'deptIds'
> {
  deptId?: number;
  deptIds: number[];
}

interface DeptTableRow {
  id: number;
  name: string;
  fullName: string;
  level: number;
  parentName?: string;
  status?: number;
}

const { hasAccessByCodes } = useAccess();
const deptRows = ref<DeptTableRow[]>([]);
const deptLabelMap = ref<Record<number, string>>({});
const hiddenTopDeptIds = ref<Set<number>>(new Set());
const formData = ref<DeptDistributionFormData>({
  id: 0,
  allowMultiDept: true,
  deptIds: [],
});
const keyword = ref('');
const loading = ref(false);
const saving = ref(false);
const loaded = ref(false);
const loadError = ref('');
let requestSequence = 0;
let saveSequence = 0;
onBeforeUnmount(() => {
  requestSequence += 1;
});

const recordId = computed(() => props.record?.id);
watch(recordId, () => {
  saveSequence += 1;
  saving.value = false;
});
const hasDistributionAccess = computed(
  () => props.auth.length === 0 || hasAccessByCodes(props.auth),
);
const canSave = computed(
  () =>
    loaded.value &&
    !loading.value &&
    !saving.value &&
    !loadError.value &&
    !props.readonly &&
    Boolean(recordId.value) &&
    hasDistributionAccess.value,
);
const allowDistribution = computed(
  () => !props.showDeptId || formData.value.allowMultiDept === true,
);
const selectedSet = computed(
  () => new Set(filterVisibleDeptIds(formData.value.deptIds)),
);
const ownerDeptId = computed(() => normalizeDeptIds(formData.value.deptId)[0]);
const visibleSelectedSet = computed(() => {
  const next = new Set(selectedSet.value);
  if (
    props.showDeptId &&
    allowDistribution.value &&
    ownerDeptId.value &&
    !isHiddenTopDeptId(ownerDeptId.value)
  ) {
    next.add(ownerDeptId.value);
  }
  return next;
});
const ownerDeptName = computed(() =>
  ownerDeptId.value && !isHiddenTopDeptId(ownerDeptId.value)
    ? deptLabelMap.value[ownerDeptId.value] || '-'
    : '-',
);
const filteredDeptRows = computed(() =>
  deptRows.value.filter((item) => matchesKeyword(item)),
);
const selectableFilteredRows = computed(() =>
  filteredDeptRows.value.filter(
    (item) =>
      item.status === 0 && (!props.showDeptId || item.id !== ownerDeptId.value),
  ),
);
const selectedCount = computed(
  () =>
    deptRows.value.filter((item) => visibleSelectedSet.value.has(item.id))
      .length,
);
const addedCount = computed(
  () =>
    deptRows.value.filter(
      (item) => selectedSet.value.has(item.id) && item.id !== ownerDeptId.value,
    ).length,
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
const columns = computed<TableColumnsType<DeptTableRow>>(() => {
  const baseColumns: TableColumnsType<DeptTableRow> = [
    { title: '', dataIndex: 'selected', width: 56 },
    { title: '部门名称', dataIndex: 'fullName', width: 260 },
    { title: '部门ID', dataIndex: 'id', width: 90 },
    { title: '状态', dataIndex: 'status', width: 150 },
  ];
  if (props.showDeptId) {
    baseColumns.push({ title: '操作', dataIndex: 'actions', width: 110 });
  }
  return baseColumns;
});

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

function isHiddenTopDept(node: SystemDeptApi.Dept, level: number) {
  return level === 0 && String(node.name || '').trim() === HIDDEN_TOP_DEPT_NAME;
}

function isHiddenTopDeptId(deptId?: number) {
  return deptId !== undefined && hiddenTopDeptIds.value.has(deptId);
}

function filterVisibleDeptIds(value: unknown) {
  return normalizeDeptIds(value).filter((id) => !isHiddenTopDeptId(id));
}

async function loadDeptRows() {
  const labels: Record<number, string> = {};
  const rows: DeptTableRow[] = [];
  const hiddenIds = new Set<number>();
  const deptList = await getCustomerFormDeptOptions();
  buildDeptRows(
    handleTree(deptList) as SystemDeptApi.Dept[],
    '',
    0,
    rows,
    labels,
    hiddenIds,
  );
  return { rows, labels, hiddenIds };
}

function buildDeptRows(
  nodes: SystemDeptApi.Dept[] = [],
  parentName = '',
  level = 0,
  rows: DeptTableRow[] = [],
  labels: Record<number, string> = {},
  hiddenIds: Set<number> = new Set(),
) {
  nodes.forEach((node) => {
    if (node.id === undefined) {
      return;
    }
    const id = Number(node.id);
    const fullName = parentName ? `${parentName} / ${node.name}` : node.name;
    labels[id] = fullName;
    if (isHiddenTopDept(node, level)) {
      hiddenIds.add(id);
      buildDeptRows(
        node.children || [],
        parentName,
        level,
        rows,
        labels,
        hiddenIds,
      );
      return;
    }
    rows.push({
      id,
      name: node.name,
      fullName,
      parentName,
      level,
      status: node.status,
    });
    buildDeptRows(
      node.children || [],
      fullName,
      level + 1,
      rows,
      labels,
      hiddenIds,
    );
  });
}

function normalizeDeptIds(value: unknown): number[] {
  if (value === null || value === undefined || value === '') {
    return [];
  }
  const values = Array.isArray(value) ? value : [value];
  return [
    ...new Set(
      values
        .map((item: any) => Number(item?.value ?? item?.key ?? item))
        .filter((id): id is number => Number.isFinite(id)),
    ),
  ];
}

function normalizePayload() {
  const deptIds = filterVisibleDeptIds(formData.value.deptIds);
  const normalizedDeptId =
    normalizeDeptIds(formData.value.deptId).find(
      (id) => !isHiddenTopDeptId(id),
    ) ?? deptIds[0];
  const allowMultiDept =
    !props.showDeptId || formData.value.allowMultiDept === true;
  if (!allowMultiDept) {
    return {
      ...formData.value,
      deptId: normalizedDeptId,
      deptIds: [],
      allowMultiDept: false,
    };
  }
  const normalizedDeptIds = [
    ...new Set(
      [
        ...(props.showDeptId && normalizedDeptId ? [normalizedDeptId] : []),
        ...deptIds,
      ].filter(
        (id): id is number => Number.isFinite(id) && !isHiddenTopDeptId(id),
      ),
    ),
  ];
  return {
    ...formData.value,
    deptId: normalizedDeptId ?? normalizedDeptIds[0],
    deptIds: normalizedDeptIds,
    allowMultiDept: true,
  };
}

function splitDeptNames(value?: string) {
  return String(value || '')
    .split(/[、,，]/)
    .map((name) => name.trim())
    .filter(Boolean);
}

function buildDistributionDeptLabels(distribution: DeptDistributionData) {
  const labels: Record<number, string> = {};
  Object.entries(distribution.deptNameMap || {}).forEach(([id, name]) => {
    const deptId = Number(id);
    if (Number.isFinite(deptId) && name) {
      labels[deptId] = name;
    }
  });
  const deptId = Number(distribution.deptId);
  if (Number.isFinite(deptId) && distribution.deptName) {
    labels[deptId] = distribution.deptName;
  }
  const deptNames = splitDeptNames(distribution.deptNames);
  normalizeDeptIds(distribution.deptIds).forEach((id, index) => {
    if (!labels[id] && deptNames[index]) {
      labels[id] = deptNames[index];
    }
  });
  return labels;
}

function appendMissingSelectedDepts(distribution: DeptDistributionData) {
  const labels = buildDistributionDeptLabels(distribution);
  const selectedDeptIds = [
    ...new Set([
      ...normalizeDeptIds(distribution.deptId),
      ...normalizeDeptIds(distribution.deptIds),
    ]),
  ].filter(
    (id) =>
      !isHiddenTopDeptId(id) &&
      String(labels[id] || '').trim() !== HIDDEN_TOP_DEPT_NAME,
  );
  const existingIds = new Set(deptRows.value.map((item) => item.id));
  const missingRows = selectedDeptIds
    .filter((id) => !existingIds.has(id))
    .map((id) => ({
      id,
      name: labels[id] || String(id),
      fullName: labels[id] || String(id),
      level: 0,
      status: 1,
    }));
  if (missingRows.length > 0) {
    deptRows.value = [...deptRows.value, ...missingRows];
  }
  deptLabelMap.value = { ...deptLabelMap.value, ...labels };
}

function isChecked(deptId: number) {
  return visibleSelectedSet.value.has(deptId);
}

function canToggleDept(item?: DeptTableRow) {
  return (
    canSave.value &&
    allowDistribution.value &&
    (!item || item.status === 0) &&
    (!props.showDeptId || item?.id !== ownerDeptId.value)
  );
}

function toggleDept(item: DeptTableRow, checked: boolean) {
  if (!canToggleDept(item)) {
    return;
  }
  const next = new Set(selectedSet.value);
  if (checked) {
    next.add(item.id);
  } else {
    next.delete(item.id);
  }
  formData.value.deptIds = [...next];
}

function canToggleRecord(record: Record<string, any>) {
  return canToggleDept(record as DeptTableRow);
}

function toggleRecord(record: Record<string, any>, checked: boolean) {
  toggleDept(record as DeptTableRow, checked);
}

function toggleFilteredDepts(checked: boolean) {
  if (!canToggleDept()) {
    return;
  }
  const next = new Set(selectedSet.value);
  selectableFilteredRows.value.forEach((item) => {
    if (checked) {
      next.add(item.id);
      return;
    }
    next.delete(item.id);
  });
  formData.value.deptIds = [...next];
}

function setOwnerDept(item: DeptTableRow) {
  if (!canSave.value || !props.showDeptId) {
    return;
  }
  formData.value.deptId = item.id;
}

function setOwnerRecord(record: Record<string, any>) {
  setOwnerDept(record as DeptTableRow);
}

async function loadDistribution() {
  const current = ++requestSequence;
  const id = recordId.value;
  loaded.value = false;
  loadError.value = '';
  keyword.value = '';
  if (!id || !hasDistributionAccess.value) return;
  loading.value = true;
  try {
    const [options, distribution] = await Promise.all([
      loadDeptRows(),
      props.loadApi(id),
    ]);
    if (current !== requestSequence || id !== recordId.value) return;
    deptRows.value = options.rows;
    deptLabelMap.value = options.labels;
    hiddenTopDeptIds.value = options.hiddenIds;
    appendMissingSelectedDepts(distribution);
    const deptIds = filterVisibleDeptIds(distribution.deptIds);
    formData.value = {
      ...distribution,
      id,
      name: distribution.name ?? props.record?.name,
      deptId: normalizeDeptIds(distribution.deptId)[0],
      deptIds,
      allowMultiDept: props.showDeptId
        ? (distribution.allowMultiDept ?? deptIds.length > 0)
        : true,
    };
    loaded.value = true;
  } catch {
    if (current === requestSequence)
      loadError.value = '部门配置加载失败，禁止保存，请刷新重试';
  } finally {
    if (current === requestSequence) loading.value = false;
  }
}

async function handleSave() {
  if (!canSave.value) return;
  const current = requestSequence;
  const saveRequest = ++saveSequence;
  const payload = normalizePayload();
  if (props.showDeptId && !payload.deptId) {
    message.warning('请选择所属部门');
    return;
  }
  saving.value = true;
  try {
    await props.saveApi(payload);
    if (current !== requestSequence) return;
    message.success('部门分配已保存');
    await loadDistribution();
    emit('success');
  } finally {
    if (saveRequest === saveSequence) saving.value = false;
  }
}

watch(
  [recordId, hasDistributionAccess],
  () => {
    void loadDistribution();
  },
  { immediate: true },
);

defineExpose({ reload: loadDistribution, save: handleSave });
</script>

<template>
  <div class="dept-distribution-panel mx-2 py-2">
    <Alert
      v-if="loadError"
      :message="loadError"
      type="error"
      show-icon
    /><Button v-if="loadError" @click="loadDistribution">重试</Button>
    <Empty v-if="!recordId" description="保存档案后可进行部门分配" />
    <Empty
      v-else-if="!hasDistributionAccess"
      description="暂无部门分配操作权限"
    />
    <Spin v-else :spinning="loading">
      <div class="space-y-3">
        <div class="grid grid-cols-1 gap-3 text-sm md:grid-cols-3">
          <div>
            {{ archiveName }}：{{ formData.name || record?.name || '-' }}
          </div>
          <div v-if="showDeptId">所属部门：{{ ownerDeptName }}</div>
          <div>已分发：{{ selectedCount }} 个部门</div>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-3">
          <Input
            v-model:value="keyword"
            allow-clear
            class="max-w-[360px]"
            placeholder="搜索部门名称 / ID"
          />
          <div class="flex flex-wrap items-center gap-3">
            <Checkbox
              v-if="showDeptId"
              v-model:checked="formData.allowMultiDept"
              :disabled="!canSave"
            >
              启用部门分发
            </Checkbox>
            <div class="text-xs text-gray-500">
              当前选择 {{ selectedCount }} 个；非所属分发 {{ addedCount }} 个
            </div>
            <Button
              v-if="canSave"
              :loading="saving"
              type="primary"
              @click="handleSave"
            >
              保存分配
            </Button>
          </div>
        </div>

        <Table
          :columns="columns"
          :data-source="filteredDeptRows"
          :loading="loading"
          :pagination="false"
          :row-key="(row) => row.id"
          :scroll="{ y: 360 }"
          bordered
          size="small"
        >
          <template #headerCell="{ column }">
            <template v-if="column.dataIndex === 'selected'">
              <Checkbox
                :checked="headerChecked"
                :disabled="
                  !canToggleDept() || selectableFilteredRows.length === 0
                "
                :indeterminate="headerIndeterminate"
                @change="(event) => toggleFilteredDepts(event.target.checked)"
              />
            </template>
          </template>
          <template #bodyCell="{ column, record: row }">
            <template v-if="column.dataIndex === 'selected'">
              <Checkbox
                :checked="isChecked(row.id)"
                :disabled="!canToggleRecord(row)"
                @change="(event) => toggleRecord(row, event.target.checked)"
              />
            </template>
            <template v-else-if="column.dataIndex === 'fullName'">
              <span :style="{ paddingLeft: `${row.level * 16}px` }">
                {{ row.fullName }}
              </span>
            </template>
            <template v-else-if="column.dataIndex === 'status'">
              <Tag v-if="row.id === ownerDeptId" color="blue">所属部门</Tag>
              <Tag v-else-if="isChecked(row.id)" color="green">已分发</Tag>
              <Tag v-else color="default">未分发</Tag>
              <Tag
                v-if="row.status !== undefined && row.status !== 0"
                color="orange"
              >
                已停用
              </Tag>
            </template>
            <template v-else-if="column.dataIndex === 'actions'">
              <Button
                :disabled="!canSave || row.id === ownerDeptId"
                size="small"
                type="link"
                @click="setOwnerRecord(row)"
              >
                设为所属
              </Button>
            </template>
          </template>
        </Table>
      </div>
    </Spin>
  </div>
</template>
