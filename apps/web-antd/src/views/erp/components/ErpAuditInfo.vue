<script lang="ts" setup>
import { computed, onMounted, ref } from 'vue';

import { useAccess } from '@vben/access';
import { formatDateTime } from '@vben/utils';

import type { SystemDeptApi } from '#/api/system/dept';
import { getAllSimpleDeptList, getSimpleDeptList } from '#/api/system/dept';

interface AuditRecord {
  [key: string]: any;
}

const AUDIT_TITLE = '\u5ba1\u8ba1\u4fe1\u606f';
const LABEL_DEPT = '\u6240\u5c5e\u90e8\u95e8';
const LABEL_CREATOR = '\u521b\u5efa\u4eba';
const LABEL_CREATE_TIME = '\u521b\u5efa\u65f6\u95f4';
const LABEL_UPDATER = '\u4fee\u6539\u4eba';
const LABEL_UPDATE_TIME = '\u4fee\u6539\u65f6\u95f4';
const EMPTY_TEXT = '-';
const DEPT_SEPARATOR = ', ';

const props = withDefaults(
  defineProps<{
    departmentKeys?: string[];
    departmentLabel?: string;
    record?: AuditRecord | null;
    title?: string;
  }>(),
  {
    departmentKeys: () => [],
    departmentLabel: LABEL_DEPT,
    record: null,
    title: AUDIT_TITLE,
  },
);

const deptList = ref<SystemDeptApi.Dept[]>([]);
const { hasAccessByCodes } = useAccess();

function pickValue(...keys: string[]) {
  const record = props.record || {};
  for (const key of keys) {
    const value = record[key];
    if (value !== undefined && value !== null && value !== '') {
      return value;
    }
  }
  return EMPTY_TEXT;
}

function normalizeDateValue(value: unknown) {
  if (typeof value === 'number') {
    return value > 0 && value < 1_000_000_000_000 ? value * 1000 : value;
  }
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    const timestamp = Number(value);
    return timestamp > 0 && timestamp < 1_000_000_000_000
      ? timestamp * 1000
      : timestamp;
  }
  return value as Date | number | string;
}

function pickDateValue(...keys: string[]) {
  const value = pickValue(...keys);
  if (value === EMPTY_TEXT) {
    return EMPTY_TEXT;
  }
  return formatDateTime(normalizeDateValue(value)) || EMPTY_TEXT;
}

function collectDeptMap(
  rows: SystemDeptApi.Dept[] = [],
  map = new Map<number, SystemDeptApi.Dept>(),
) {
  rows.forEach((row) => {
    if (row.id !== undefined && row.id !== null) {
      map.set(Number(row.id), row);
    }
    if (row.children?.length) {
      collectDeptMap(row.children, map);
    }
  });
  return map;
}

const deptMap = computed(() => collectDeptMap(deptList.value));

const deptFullNameMap = computed(() => {
  const map = deptMap.value;
  const fullNameMap = new Map<number, string>();
  const resolving = new Set<number>();

  function resolveName(id: number): string {
    if (fullNameMap.has(id)) {
      return fullNameMap.get(id) || '';
    }
    const dept = map.get(id);
    if (!dept?.name) {
      return '';
    }
    if (resolving.has(id)) {
      return dept.name;
    }

    resolving.add(id);
    const parentName =
      dept.parentId && dept.parentId !== 0
        ? resolveName(Number(dept.parentId))
        : '';
    resolving.delete(id);

    const fullName = parentName ? `${parentName} / ${dept.name}` : dept.name;
    fullNameMap.set(id, fullName);
    return fullName;
  }

  map.forEach((_, id) => resolveName(id));
  return fullNameMap;
});

function parseDepartmentIds(value: unknown): number[] {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return [value];
  }
  if (typeof value === 'string') {
    const text = value.trim();
    if (!/^\d+(?:\s*[,/\u3001\uFF0C]\s*\d+)*$/.test(text)) {
      return [];
    }
    return text
      .split(/[,/\u3001\uFF0C]/)
      .map((item) => Number(item.trim()))
      .filter((item) => Number.isFinite(item));
  }
  if (Array.isArray(value)) {
    return value.flatMap((item) => parseDepartmentIds(item));
  }
  if (value && typeof value === 'object' && 'id' in value) {
    return parseDepartmentIds((value as { id?: unknown }).id);
  }
  return [];
}

function getDepartmentNamesByIds(ids: number[]) {
  const names = ids
    .map((id) => deptFullNameMap.value.get(id))
    .filter((name): name is string => Boolean(name));
  return Array.from(new Set(names)).join(DEPT_SEPARATOR);
}

function joinDepartmentNames(names: string[]) {
  return Array.from(new Set(names.filter(Boolean))).join(DEPT_SEPARATOR);
}

function getDepartmentName(value: unknown): string {
  if (typeof value === 'string') {
    const text = value.trim();
    if (!text) {
      return '';
    }
    const ids = parseDepartmentIds(text);
    return ids.length > 0 ? getDepartmentNamesByIds(ids) : text;
  }
  if (Array.isArray(value)) {
    return joinDepartmentNames(value.map(getDepartmentName));
  }
  if (value && typeof value === 'object') {
    const objectValue = value as {
      id?: unknown;
      label?: unknown;
      name?: unknown;
    };
    const name =
      getDepartmentName(objectValue.name) ||
      getDepartmentName(objectValue.label);
    return name || getDepartmentNamesByIds(parseDepartmentIds(objectValue.id));
  }
  return getDepartmentNamesByIds(parseDepartmentIds(value));
}

function pickDepartmentValue() {
  const record = props.record || {};
  if (props.departmentKeys.length > 0) {
    for (const key of props.departmentKeys) {
      const departmentName = getDepartmentName(record[key]);
      if (departmentName) {
        return departmentName;
      }
    }
    return EMPTY_TEXT;
  }
  const openDeptNames = getDepartmentName(record.openDeptNames);
  if (openDeptNames) {
    return openDeptNames;
  }
  const openDeptFullNames = getDepartmentName(record.openDeptFullNames);
  if (openDeptFullNames) {
    return openDeptFullNames;
  }
  const deptIds = getDepartmentName(record.deptIds);
  if (deptIds) {
    return deptIds;
  }
  const deptId = getDepartmentName(record.deptId);
  if (deptId) {
    return deptId;
  }
  const deptNames = getDepartmentName(record.deptNames);
  if (deptNames) {
    return deptNames;
  }
  const deptName = getDepartmentName(record.deptName);
  if (deptName) {
    return deptName;
  }
  const departmentName = getDepartmentName(record.departmentName);
  if (departmentName) {
    return departmentName;
  }
  const dept = getDepartmentName(record.dept);
  if (dept) {
    return dept;
  }
  return EMPTY_TEXT;
}

onMounted(async () => {
  if (hasAccessByCodes(['system:dept:query'])) {
    deptList.value = await getAllSimpleDeptList();
    return;
  }

  try {
    deptList.value = await getSimpleDeptList();
  } catch {
    deptList.value = [];
  }
});

const items = computed(() => [
  {
    label: LABEL_CREATOR,
    value: pickValue(
      'creatorName',
      'createUserName',
      'creatorNickname',
      'creator',
    ),
  },
  {
    label: LABEL_UPDATER,
    value: pickValue(
      'updaterName',
      'updateUserName',
      'updater',
      'approverName',
      'approveUserName',
      'approver',
    ),
  },
  {
    label: props.departmentLabel,
    value: pickDepartmentValue(),
  },
  {
    label: LABEL_CREATE_TIME,
    value: pickDateValue('createTime', 'createdTime', 'createdAt'),
  },
  {
    label: LABEL_UPDATE_TIME,
    value: pickDateValue(
      'updateTime',
      'approveTime',
      'updatedTime',
      'updatedAt',
    ),
  },
]);
</script>

<template>
  <section class="erp-audit-info">
    <div class="mb-2 text-sm font-medium text-gray-700 dark:text-gray-200">
      {{ title }}
    </div>
    <div class="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
      <div v-for="item in items" :key="item.label" class="flex min-w-0 text-sm">
        <span class="mr-2 shrink-0 text-gray-500">{{ item.label }}:</span>
        <span
          class="min-w-0 break-words text-gray-800 dark:text-gray-100"
          :title="String(item.value)"
        >
          {{ item.value }}
        </span>
      </div>
    </div>
  </section>
</template>
