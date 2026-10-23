<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SystemDeptApi } from '#/api/system/dept';
import type { MoveEvent, SortableEvent } from 'sortablejs';

import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';

import { confirm, Page, useVbenModal } from '@vben/common-ui';
import { downloadFileFromBlobPart, isEmpty } from '@vben/utils';

import { message } from 'ant-design-vue';
import Sortable from 'sortablejs';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deleteDept,
  deleteDeptList,
  exportDept,
  getDeptList,
  updateDeptSortBatch,
} from '#/api/system/dept';
import { useFieldPermission } from '#/composables/useFieldPermission';
import { $t } from '#/locales';

import { useGridColumns, useGridFormSchema } from './data';
import BatchEditForm from './modules/batch-edit-form.vue';
import Form from './modules/form.vue';
import ImportForm from './modules/import-form.vue';

const FIELD_PERMISSION_MODULE = 'system_dept';
const { hiddenFields, loadHiddenFields } = useFieldPermission(
  FIELD_PERMISSION_MODULE,
);
const isHeaderSortActive = ref(false);

const deptSortFieldMap: Record<string, string> = {
  createTime: 'createTime',
  id: 'id',
  leaderUserId: 'leaderUserId',
  name: 'name',
  sort: 'sort',
  status: 'status',
};

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

const [ImportModal, importModalApi] = useVbenModal({
  connectedComponent: ImportForm,
  destroyOnClose: true,
});

const [BatchEditModal, batchEditModalApi] = useVbenModal({
  connectedComponent: BatchEditForm,
  destroyOnClose: true,
});

interface DeptSortEvent {
  item: HTMLElement;
  newIndex?: number;
  oldIndex?: number;
  to: HTMLElement;
}

let sortableInstance: Sortable | undefined;

function findDeptById(
  rows: SystemDeptApi.Dept[],
  id: number,
): SystemDeptApi.Dept | undefined {
  for (const row of rows) {
    if (row.id === id) {
      return row;
    }
    const matched = row.children ? findDeptById(row.children, id) : undefined;
    if (matched) {
      return matched;
    }
  }
}

function getTableRows() {
  return gridApi.grid.getTableData().fullData as SystemDeptApi.Dept[];
}

function resolveRow(el: HTMLElement): SystemDeptApi.Dept | undefined {
  const rowId = el.getAttribute('rowid');
  return rowId ? findDeptById(getTableRows(), Number(rowId)) : undefined;
}

function resolveSiblingRowsFromDom(
  tbody: HTMLElement,
  parentId?: number,
): SystemDeptApi.Dept[] {
  return [...tbody.children]
    .map((item) => resolveRow(item as HTMLElement))
    .filter(
      (row): row is SystemDeptApi.Dept => !!row && row.parentId === parentId,
    );
}

async function initSortable() {
  await nextTick();
  if (isHeaderSortActive.value) {
    sortableInstance?.destroy();
    sortableInstance = undefined;
    return;
  }
  const tbody = document.querySelector<HTMLElement>(
    '.vxe-grid .vxe-table--body tbody',
  );
  if (!tbody || sortableInstance) {
    return;
  }
  sortableInstance = Sortable.create(tbody, {
    animation: 150,
    handle: '.dept-drag-handle',
    onMove: (event: MoveEvent) => {
      const draggedRow = resolveRow(event.dragged as HTMLElement);
      const relatedRow = resolveRow(event.related as HTMLElement);
      return (
        !!draggedRow &&
        !!relatedRow &&
        draggedRow.parentId === relatedRow.parentId
      );
    },
    onEnd: (event: SortableEvent) => {
      handleSortEnd(event);
    },
  });
}

async function handleSortEnd(event: DeptSortEvent) {
  const draggedRow = resolveRow(event.item);
  if (!draggedRow || event.oldIndex === event.newIndex) {
    await handleRefresh();
    return;
  }
  const siblings = resolveSiblingRowsFromDom(event.to, draggedRow.parentId);
  if (
    siblings.length === 0 ||
    !siblings.some((item) => item.id === draggedRow.id)
  ) {
    await handleRefresh();
    message.warning('只能调整同级部门的排序');
    return;
  }
  const hideLoading = message.loading({
    content: '正在保存排序',
    duration: 0,
  });
  try {
    await updateDeptSortBatch(
      siblings.map((item, index) => ({
        id: item.id!,
        sort: (index + 1) * 10,
      })),
    );
    message.success('排序已保存');
    await handleRefresh();
  } finally {
    hideLoading();
  }
}

/** 切换树形展开/收缩状态 */
const isExpanded = ref(true);
function handleExpand() {
  isExpanded.value = !isExpanded.value;
  gridApi.grid.setAllTreeExpand(isExpanded.value);
}

/** 刷新表格 */
async function handleRefresh() {
  await gridApi.query();
  sortableInstance?.destroy();
  sortableInstance = undefined;
  await initSortable();
}

async function handleRefreshAndClearChecked() {
  checkedIds.value = [];
  await gridApi.grid.clearCheckboxRow?.();
  await handleRefresh();
}

onBeforeUnmount(() => {
  sortableInstance?.destroy();
  sortableInstance = undefined;
});

/** 创建部门 */
function handleCreate() {
  formModalApi
    .setData({ hiddenFields: hiddenFields.value, type: 'create' })
    .open();
}

/** 导入部门 */
function handleImport() {
  importModalApi.open();
}

/** 导出部门 */
async function handleExport() {
  const data = await exportDept(
    normalizeSearchParams(await gridApi.formApi.getValues()),
  );
  downloadFileFromBlobPart({ fileName: '部门.xls', source: data });
}

/** 批量修改部门 */
function handleBatchEdit() {
  if (checkedIds.value.length === 0) {
    message.warning('请先勾选至少一个部门');
    return;
  }
  batchEditModalApi.setData({ ids: checkedIds.value }).open();
}

/** 添加下级部门 */
function handleAppend(row: SystemDeptApi.Dept) {
  formModalApi
    .setData({
      hiddenFields: hiddenFields.value,
      row: { parentId: row.id },
      type: 'create',
    })
    .open();
}

/** 编辑部门 */
function handleEdit(row: SystemDeptApi.Dept) {
  formModalApi
    .setData({ hiddenFields: hiddenFields.value, row, type: 'edit' })
    .open();
}

/** 查看部门详情 */
function handleDetail(row: SystemDeptApi.Dept) {
  formModalApi
    .setData({ hiddenFields: hiddenFields.value, row, type: 'detail' })
    .open();
}

/** 删除部门 */
async function handleDelete(row: SystemDeptApi.Dept) {
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting', [row.name]),
    duration: 0,
  });
  try {
    await deleteDept(row.id!);
    message.success($t('ui.actionMessage.deleteSuccess', [row.name]));
    handleRefresh();
  } finally {
    hideLoading();
  }
}

/** 批量删除部门 */
async function handleDeleteBatch() {
  await confirm($t('ui.actionMessage.deleteBatchConfirm'));
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deletingBatch'),
    duration: 0,
  });
  try {
    await deleteDeptList(checkedIds.value);
    checkedIds.value = [];
    message.success($t('ui.actionMessage.deleteSuccess'));
    handleRefresh();
  } finally {
    hideLoading();
  }
}

const checkedIds = ref<number[]>([]);
function handleRowCheckboxChange({
  records,
}: {
  records: SystemDeptApi.Dept[];
}) {
  checkedIds.value = records.map((item) => item.id!);
}

function normalizeSearchParams(values: Record<string, any>) {
  const params: Record<string, any> = {};
  Object.entries(values || {}).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }
    if (typeof value === 'string') {
      const normalized = value.trim();
      if (normalized) {
        params[key] = normalized;
      }
      return;
    }
    if (Array.isArray(value)) {
      if (value.length > 0) {
        params[key] = value;
      }
      return;
    }
    params[key] = value;
  });
  return params as SystemDeptApi.DeptListParams;
}

function buildDeptSortParams(sorts?: any | any[]) {
  const sortList = Array.isArray(sorts) ? sorts : sorts ? [sorts] : [];
  const activeSort = sortList.find((item) => item?.order);
  const orderField = deptSortFieldMap[activeSort?.field];
  const orderDirection =
    activeSort?.order === 'asc' || activeSort?.order === 'desc'
      ? activeSort.order
      : undefined;

  return orderField && orderDirection
    ? {
        orderField,
        orderDirection,
      }
    : {};
}

function updateHeaderSortState(params: Partial<SystemDeptApi.DeptListParams>) {
  const active = !!params.orderField && !!params.orderDirection;
  isHeaderSortActive.value = active;
  if (active) {
    sortableInstance?.destroy();
    sortableInstance = undefined;
  }
}

function isIgnoredDetailClick(column: any, event?: MouseEvent) {
  const target = event?.target;
  if (
    column?.type === 'checkbox' ||
    column?.field === 'actions' ||
    column?.slots?.default === 'actions' ||
    column?.slots?.default === 'dragHandle'
  ) {
    return true;
  }
  return (
    target instanceof HTMLElement &&
    !!target.closest(
      'button,a,input,.ant-btn,.ant-checkbox-wrapper,.dept-drag-handle,.table-actions,.vxe-tree--btn-wrapper',
    )
  );
}

function handleCellClick({
  $event,
  column,
  row,
}: {
  $event?: MouseEvent;
  column: any;
  row: SystemDeptApi.Dept;
}) {
  if (isIgnoredDetailClick(column, $event)) {
    return;
  }
  handleDetail(row);
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: useGridFormSchema(hiddenFields.value),
  },
  gridOptions: {
    columns: useGridColumns(hiddenFields.value),
    height: 'auto',
    pagerConfig: {
      enabled: false,
    },
    proxyConfig: {
      ajax: {
        query: async ({ sorts }, formValues) => {
          const sortParams = buildDeptSortParams(sorts);
          updateHeaderSortState(sortParams);
          const data = await getDeptList({
            ...normalizeSearchParams(formValues),
            ...sortParams,
          });
          initSortable();
          return data;
        },
      },
      sort: true,
    },
    sortConfig: {
      remote: true,
      multiple: false,
      trigger: 'cell',
      orders: ['asc', 'desc', null],
    },
    rowConfig: {
      keyField: 'id',
      isHover: true,
    },
    toolbarConfig: {
      refresh: true,
      search: true,
    },
    customConfig: {
      mode: 'modal',
      visibleMethod: ({ column }: { column: any }) =>
        !column.params?.systemColumn,
    },
    treeConfig: {
      parentField: 'parentId',
      rowField: 'id',
      transform: true,
      expandAll: true,
      reserve: true,
    },
  } as VxeTableGridOptions<SystemDeptApi.Dept>,
  gridEvents: {
    checkboxAll: handleRowCheckboxChange,
    checkboxChange: handleRowCheckboxChange,
    cellClick: handleCellClick,
  },
});

onMounted(async () => {
  await loadHiddenFields();
  gridApi.setGridOptions({
    columns: useGridColumns(hiddenFields.value),
  });
  gridApi.formApi.setState({
    schema: useGridFormSchema(hiddenFields.value),
  });
});
</script>

<template>
  <Page auto-content-height>
    <FormModal
      @append="handleAppend"
      @edit="handleEdit"
      @success="handleRefresh"
    />
    <ImportModal @success="handleRefresh" />
    <BatchEditModal @success="handleRefreshAndClearChecked" />
    <Grid class="department-management-grid" table-title="部门列表">
      <template #dragHandle>
        <span class="dept-drag-handle" title="拖动排序">::</span>
      </template>
      <template #toolbar-tools>
        <TableAction
          :actions="[
            {
              label: '新增',
              type: 'primary',
              icon: ACTION_ICON.ADD,
              auth: ['system:dept:create'],
              onClick: handleCreate,
            },
            {
              label: '导入',
              type: 'primary',
              icon: ACTION_ICON.UPLOAD,
              auth: ['system:dept:import'],
              onClick: handleImport,
            },
            {
              label: '导出',
              type: 'primary',
              icon: ACTION_ICON.DOWNLOAD,
              auth: ['system:dept:export'],
              onClick: handleExport,
            },
            {
              label: '批量修改',
              type: 'primary',
              icon: ACTION_ICON.EDIT,
              auth: ['system:dept:update'],
              disabled: isEmpty(checkedIds),
              onClick: handleBatchEdit,
            },
            {
              label: $t('ui.actionTitle.deleteBatch'),
              type: 'primary',
              danger: true,
              icon: ACTION_ICON.DELETE,
              auth: ['system:dept:delete'],
              disabled: isEmpty(checkedIds),
              onClick: handleDeleteBatch,
            },
            {
              label: isExpanded ? '收缩' : '展开',
              type: 'primary',
              onClick: handleExpand,
            },
          ]"
        />
      </template>
      <template #actions="{ row }">
        <TableAction
          :actions="[
            {
              label: '新增下级',
              type: 'link',
              icon: ACTION_ICON.ADD,
              auth: ['system:dept:create'],
              onClick: handleAppend.bind(null, row),
            },
            {
              label: $t('common.edit'),
              type: 'link',
              icon: ACTION_ICON.EDIT,
              auth: ['system:dept:update'],
              onClick: handleEdit.bind(null, row),
            },
            {
              label: $t('common.delete'),
              type: 'link',
              danger: true,
              icon: ACTION_ICON.DELETE,
              auth: ['system:dept:delete'],
              disabled: row.children && row.children.length > 0,
              popConfirm: {
                title: $t('ui.actionMessage.deleteConfirm', [row.name]),
                confirm: handleDelete.bind(null, row),
              },
            },
          ]"
        />
      </template>
    </Grid>
  </Page>
</template>

<style scoped>
.dept-drag-handle {
  cursor: move;
  display: inline-flex;
  font-weight: 600;
  letter-spacing: 0;
  user-select: none;
}

:deep(.department-management-grid .vxe-table--render-default),
:deep(.department-management-grid .vxe-grid--form-wrapper) {
  font-size: 12px;
}

:deep(.department-management-grid .vxe-grid--form-wrapper label),
:deep(.department-management-grid .vxe-grid--form-wrapper .ant-input),
:deep(.department-management-grid .vxe-grid--form-wrapper .ant-picker),
:deep(
  .department-management-grid .vxe-grid--form-wrapper .ant-picker-input > input
),
:deep(.department-management-grid .vxe-grid--form-wrapper .ant-select),
:deep(.department-management-grid .vxe-grid--form-wrapper .ant-btn),
:deep(.department-management-grid .vxe-grid--form-wrapper .vben-link) {
  font-size: 12px;
}

:deep(
  .department-management-grid .vxe-grid--form-wrapper .ant-input-affix-wrapper
) {
  min-height: 28px;
  padding: 2px 8px;
  font-size: 12px;
}

:deep(.department-management-grid .vxe-grid--form-wrapper .ant-select-single) {
  height: 28px;
}

:deep(
  .department-management-grid
    .vxe-grid--form-wrapper
    .ant-select-single
    .ant-select-selector
) {
  height: 28px;
  padding: 0 8px;
  font-size: 12px;
}

:deep(
  .department-management-grid
    .vxe-grid--form-wrapper
    .ant-select-single
    .ant-select-selection-search-input
) {
  height: 26px;
}

:deep(
  .department-management-grid
    .vxe-grid--form-wrapper
    .ant-select-single
    .ant-select-selection-item
),
:deep(
  .department-management-grid
    .vxe-grid--form-wrapper
    .ant-select-single
    .ant-select-selection-placeholder
) {
  line-height: 26px;
}

:deep(.department-management-grid .vxe-grid--form-wrapper .ant-btn),
:deep(.department-management-grid .vxe-toolbar .table-actions .ant-btn) {
  height: 28px;
  padding: 2px 10px;
  font-size: 12px;
  line-height: 20px;
}

:deep(
  .department-management-grid .vxe-toolbar .table-actions .ant-btn .anticon
) {
  font-size: 12px;
}

:deep(.department-management-grid .vxe-toolbar .vxe-tool--item-wrapper) {
  font-size: 12px;
}

:deep(
  .department-management-grid .vxe-body--column .table-actions .ant-btn-link
) {
  height: auto;
  padding: 0;
  font-size: 12px;
  line-height: 20px;
}

:deep(
  .department-management-grid
    .vxe-body--column
    .table-actions
    .ant-btn-link
    .anticon
) {
  font-size: 12px;
}

:deep(.department-management-grid .vxe-body--row) {
  cursor: pointer;
}

:deep(.department-management-grid .vxe-body--column .table-actions),
:deep(.department-management-grid .vxe-body--column .vxe-checkbox--input),
:deep(.department-management-grid .dept-drag-handle),
:deep(.department-management-grid .vxe-tree--btn-wrapper) {
  cursor: default;
}

:deep(.department-management-grid .dept-drag-handle) {
  cursor: move;
}

:deep(.department-management-grid .vxe-toolbar .vxe-button) {
  box-sizing: border-box;
  width: 28px !important;
  min-width: 28px !important;
  height: 28px;
  padding: 0;
  font-size: 12px;
}

:deep(
  .department-management-grid .vxe-header--column.is--sortable .vxe-cell--title
) {
  color: hsl(var(--primary));
  font-weight: 600;
}

:deep(.department-management-grid .vxe-header--column .vxe-cell--sort) {
  display: none;
}

:global(.department-search-select-dropdown .ant-select-item),
:global(.department-search-select-dropdown .ant-empty-description) {
  font-size: 12px;
}
</style>
