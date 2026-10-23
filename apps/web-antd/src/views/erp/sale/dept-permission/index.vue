<script lang="ts" setup>
import type { TableColumnsType } from 'ant-design-vue';

import type { SystemDeptApi } from '#/api/system/dept';

import { computed, onMounted, ref } from 'vue';

import { useAccess } from '@vben/access';
import { Page } from '@vben/common-ui';
import { handleTree } from '@vben/utils';

import {
  Button,
  Checkbox,
  Empty,
  Input,
  message,
  Spin,
  Table,
  Tag,
} from 'ant-design-vue';

import {
  getSaleDirectForbiddenDepts,
  saveSaleDirectForbiddenDepts,
} from '#/api/erp/sale/dept-permission';
import { getSimpleDeptList } from '#/api/system/dept';

defineOptions({ name: 'ErpSaleDeptPermission' });

const HIDDEN_TOP_DEPT_NAME = '四川兴宇科技服务有限公司';

interface DeptRow {
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
const keyword = ref('');
const deptTree = ref<SystemDeptApi.Dept[]>([]);
const selectedDeptIds = ref<number[]>([]);

const canSave = computed(() =>
  hasAccessByCodes(['erp:sale-dept-permission:update']),
);
const deptRows = computed(() => buildDeptRows(deptTree.value));
const selectedSet = computed(() => new Set(selectedDeptIds.value));
const filteredRows = computed(() =>
  deptRows.value.filter((item) => matchesKeyword(item)),
);
const selectableFilteredRows = computed(() =>
  filteredRows.value.filter((item) => canToggleDept(item)),
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

const columns: TableColumnsType<DeptRow> = [
  { title: '', dataIndex: 'selected', width: 56 },
  { title: '部门名称', dataIndex: 'fullName', width: 320 },
  { title: '部门ID', dataIndex: 'id', width: 100 },
  { title: '开单权限', dataIndex: 'status', width: 160 },
];

function normalizeText(value?: null | number | string) {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

function isHiddenTopDept(dept: SystemDeptApi.Dept, level: number) {
  return level === 0 && String(dept.name || '').trim() === HIDDEN_TOP_DEPT_NAME;
}

function matchesKeyword(item: DeptRow) {
  const input = normalizeText(keyword.value);
  if (!input) {
    return true;
  }
  return [item.id, item.name, item.fullName, item.parentName].some((value) =>
    normalizeText(value).includes(input),
  );
}

function buildDeptRows(depts: SystemDeptApi.Dept[]) {
  const rows: DeptRow[] = [];
  const append = (dept: SystemDeptApi.Dept, parentName = '', level = 0) => {
    if (!dept.id) {
      return;
    }
    const fullName = parentName ? `${parentName} / ${dept.name}` : dept.name;
    if (isHiddenTopDept(dept, level)) {
      (dept.children || []).forEach((child) =>
        append(child, parentName, level),
      );
      return;
    }
    rows.push({
      id: dept.id,
      name: dept.name,
      fullName,
      parentName,
      level,
      // simple-list 只返回启用部门，旧版精简响应不携带 status。
      status: dept.status ?? 0,
    });
    (dept.children || []).forEach((child) =>
      append(child, fullName, level + 1),
    );
  };
  depts.forEach((dept) => append(dept));
  return rows;
}

function canToggleDept(item?: DeptRow) {
  return canSave.value && item?.status === 0;
}

function isChecked(deptId: number) {
  return selectedSet.value.has(deptId);
}

function toggleDept(item: DeptRow, checked: boolean) {
  if (!canToggleDept(item)) {
    return;
  }
  const next = new Set(selectedSet.value);
  if (checked) {
    next.add(item.id);
  } else {
    next.delete(item.id);
  }
  selectedDeptIds.value = [...next];
}

function canToggleDeptRecord(record: Record<string, any>) {
  return canToggleDept(record as DeptRow);
}

function toggleDeptRecord(record: Record<string, any>, checked: boolean) {
  toggleDept(record as DeptRow, checked);
}

function toggleFilteredDepts(checked: boolean) {
  if (!canSave.value) {
    return;
  }
  const next = new Set(selectedSet.value);
  selectableFilteredRows.value.forEach((item) => {
    if (checked) {
      next.add(item.id);
    } else {
      next.delete(item.id);
    }
  });
  selectedDeptIds.value = [...next];
}

async function loadData() {
  loading.value = true;
  try {
    const [depts, forbiddenDepts] = await Promise.all([
      getSimpleDeptList(),
      getSaleDirectForbiddenDepts(),
    ]);
    deptTree.value = handleTree(depts || []) as SystemDeptApi.Dept[];
    selectedDeptIds.value = (forbiddenDepts || [])
      .map((item) => item.deptId)
      .filter((id): id is number => Number.isFinite(id));
  } finally {
    loading.value = false;
  }
}

async function handleSave() {
  saving.value = true;
  try {
    await saveSaleDirectForbiddenDepts({
      deptIds: selectedDeptIds.value,
    });
    message.success('保存成功');
    await loadData();
  } finally {
    saving.value = false;
  }
}

onMounted(() => {
  void loadData();
});
</script>

<template>
  <Page auto-content-height>
    <div class="sale-dept-permission-page">
      <div class="sale-dept-permission-toolbar">
        <Input
          v-model:value="keyword"
          allow-clear
          class="sale-dept-permission-search"
          placeholder="搜索部门名称 / ID"
        />
        <div class="sale-dept-permission-actions">
          <span class="sale-dept-permission-count">
            已禁开 {{ selectedCount }} 个部门
          </span>
          <Button :loading="loading" @click="loadData">刷新</Button>
          <Button
            v-if="canSave"
            :loading="saving"
            type="primary"
            @click="handleSave"
          >
            保存
          </Button>
        </div>
      </div>

      <div class="sale-dept-permission-count">
        勾选表示禁止该部门直接开单，取消勾选表示允许，修改后点击保存生效。
      </div>

      <Spin :spinning="loading" wrapper-class-name="sale-dept-permission-spin">
        <Empty v-if="deptRows.length === 0" description="暂无部门" />
        <Table
          v-else
          class="sale-dept-permission-table"
          :columns="columns"
          :data-source="filteredRows"
          :pagination="false"
          :row-key="(row) => row.id"
          :scroll="{ x: 'max-content', y: 'calc(100vh - 260px)' }"
          bordered
          size="small"
        >
          <template #headerCell="{ column }">
            <template v-if="column.dataIndex === 'selected'">
              <Checkbox
                :checked="headerChecked"
                :disabled="!canSave || selectableFilteredRows.length === 0"
                :indeterminate="headerIndeterminate"
                @change="(event) => toggleFilteredDepts(event.target.checked)"
              />
            </template>
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'selected'">
              <Checkbox
                :checked="isChecked(record.id)"
                :disabled="!canToggleDeptRecord(record)"
                @change="
                  (event) => toggleDeptRecord(record, event.target.checked)
                "
              />
            </template>
            <template v-else-if="column.dataIndex === 'fullName'">
              <span
                class="sale-dept-permission-name"
                :style="{ paddingLeft: `${record.level * 16}px` }"
              >
                {{ record.fullName }}
                <span v-if="record.status !== 0">（已停用）</span>
              </span>
            </template>
            <template v-else-if="column.dataIndex === 'status'">
              <Tag v-if="selectedSet.has(record.id)" color="orange">
                禁止开单
              </Tag>
              <Tag v-else color="green">允许开单</Tag>
            </template>
          </template>
        </Table>
      </Spin>
    </div>
  </Page>
</template>

<style scoped>
.sale-dept-permission-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  gap: 12px;
}

.sale-dept-permission-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.sale-dept-permission-search {
  width: min(360px, 100%);
}

.sale-dept-permission-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.sale-dept-permission-count {
  color: hsl(var(--muted-foreground));
  font-size: 12px;
}

.sale-dept-permission-spin,
.sale-dept-permission-spin :deep(.ant-spin-container) {
  min-height: 0;
  flex: 1;
}

.sale-dept-permission-table {
  min-height: 0;
  flex: 1;
}

.sale-dept-permission-table :deep(.ant-table),
.sale-dept-permission-table :deep(.ant-table-cell) {
  font-size: 12px;
}

.sale-dept-permission-table :deep(.ant-table-thead > tr > th),
.sale-dept-permission-table :deep(.ant-table-tbody > tr > td) {
  padding-top: 7px;
  padding-bottom: 7px;
}

.sale-dept-permission-name {
  display: inline-block;
  max-width: 100%;
}
</style>
