<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SystemDeptApi } from '#/api/system/dept';

import { nextTick, onBeforeUnmount, ref } from 'vue';

import { confirm, Page, useVbenModal } from '@vben/common-ui';
import { isEmpty } from '@vben/utils';

import Sortable, { type MoveEvent, type SortableEvent } from 'sortablejs';

import { message } from '#/adapter/tdesign';
import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deleteDept,
  deleteDeptList,
  getDeptList,
  updateDeptSortBatch,
} from '#/api/system/dept';
import { $t } from '#/locales';

import { useGridColumns } from './data';
import Form from './modules/form.vue';

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
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
    message.close(hideLoading);
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

onBeforeUnmount(() => {
  sortableInstance?.destroy();
  sortableInstance = undefined;
});

/** 创建部门 */
function handleCreate() {
  formModalApi.setData(null).open();
}

/** 添加下级部门 */
function handleAppend(row: SystemDeptApi.Dept) {
  formModalApi.setData({ parentId: row.id }).open();
}

/** 编辑部门 */
function handleEdit(row: SystemDeptApi.Dept) {
  formModalApi.setData(row).open();
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
    message.close(hideLoading);
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
    message.close(hideLoading);
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

const [Grid, gridApi] = useVbenVxeGrid({
  gridOptions: {
    columns: useGridColumns(),
    height: 'auto',
    pagerConfig: {
      enabled: false,
    },
    proxyConfig: {
      ajax: {
        query: async () => {
          const data = await getDeptList();
          initSortable();
          return data;
        },
      },
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
  },
});
</script>

<template>
  <Page auto-content-height>
    <FormModal @success="handleRefresh" />
    <Grid table-title="部门列表">
      <template #dragHandle>
        <span class="dept-drag-handle" title="拖动排序">::</span>
      </template>
      <template #toolbar-tools>
        <TableAction
          :actions="[
            {
              label: $t('ui.actionTitle.create', ['部门']),
              type: 'primary',
              icon: ACTION_ICON.ADD,
              auth: ['system:dept:create'],
              onClick: handleCreate,
            },
            {
              label: isExpanded ? '收缩' : '展开',
              type: 'primary',
              onClick: handleExpand,
            },
            {
              label: $t('ui.actionTitle.deleteBatch'),
              type: 'danger',
              icon: ACTION_ICON.DELETE,
              auth: ['system:dept:delete'],
              disabled: isEmpty(checkedIds),
              onClick: handleDeleteBatch,
            },
          ]"
        />
      </template>
      <template #actions="{ row }">
        <TableAction
          :actions="[
            {
              label: '新增下级',
              type: 'primary',
              variant: 'text',
              icon: ACTION_ICON.ADD,
              auth: ['system:dept:create'],
              onClick: handleAppend.bind(null, row),
            },
            {
              label: $t('common.edit'),
              type: 'primary',
              variant: 'text',
              icon: ACTION_ICON.EDIT,
              auth: ['system:dept:update'],
              onClick: handleEdit.bind(null, row),
            },
            {
              label: $t('common.delete'),
              type: 'danger',
              variant: 'text',
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
</style>
