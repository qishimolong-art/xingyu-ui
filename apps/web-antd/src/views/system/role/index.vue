<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SystemRoleApi } from '#/api/system/role';

import { ref } from 'vue';

import { confirm, DocAlert, Page, useVbenModal } from '@vben/common-ui';
import { CommonStatusEnum, SystemRoleTypeEnum } from '@vben/constants';
import { downloadFileFromBlobPart } from '@vben/utils';

import { message } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deleteRole,
  deleteRoleList,
  exportRole,
  getRolePage,
} from '#/api/system/role';
import { $t } from '#/locales';

import { useGridColumns, useGridFormSchema } from './data';
import AssignPermissionForm from './modules/assign-permission-form.vue';
import Form from './modules/form.vue';

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

const [AssignPermissionFormModal, assignPermissionFormApi] = useVbenModal({
  connectedComponent: AssignPermissionForm,
  destroyOnClose: true,
});

const roleSortFieldMap: Record<string, string> = {
  id: 'id',
  name: 'name',
  type: 'type',
  remark: 'remark',
  status: 'status',
  createTime: 'createTime',
};

const ASSIGN_PERMISSION_AUTH_CODES = [
  'system:permission:assign-role-menu',
  'system:permission:assign-role-field-permission',
  'system:permission:assign-role-data-scope',
];

function buildRoleSortParams(sorts?: any | any[]) {
  let sortList: any[] = [];
  if (Array.isArray(sorts)) {
    sortList = sorts;
  } else if (sorts) {
    sortList = [sorts];
  }
  const activeSort = sortList.find((item) => item?.order);
  const orderField = roleSortFieldMap[activeSort?.field];
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

/** 刷新表格 */
function handleRefresh() {
  gridApi.query();
}

/** 导出表格 */
async function handleExport() {
  const params = await gridApi.formApi.getValues();
  if (checkedIds.value.length > 0) {
    params.ids = checkedIds.value;
  }
  const data = await exportRole(params);
  downloadFileFromBlobPart({ fileName: '角色.xls', source: data });
}

/** 创建角色 */
function handleCreate() {
  formModalApi.setData({ mode: 'create' }).open();
}

/** 编辑角色 */
function handleEdit(row: SystemRoleApi.Role) {
  formModalApi.setData({ ...row, mode: 'edit' }).open();
}

/** 查看角色详情 */
function handleDetail(row: SystemRoleApi.Role) {
  formModalApi.setData({ ...row, mode: 'detail' }).open();
}

async function handleDelete(row: SystemRoleApi.Role) {
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting', [row.name]),
    duration: 0,
  });
  try {
    await deleteRole(row.id!);
    message.success($t('ui.actionMessage.deleteSuccess', [row.name]));
    handleRefresh();
  } finally {
    hideLoading();
  }
}

/** 批量删除角色 */
async function handleDeleteBatch() {
  await confirm($t('ui.actionMessage.deleteBatchConfirm'));
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deletingBatch'),
    duration: 0,
  });
  try {
    await deleteRoleList(checkedIds.value);
    checkedIds.value = [];
    checkedRows.value = [];
    message.success($t('ui.actionMessage.deleteSuccess'));
    handleRefresh();
  } finally {
    hideLoading();
  }
}

const checkedIds = ref<number[]>([]);
const checkedRows = ref<SystemRoleApi.Role[]>([]);
function canBatchOperate() {
  return (
    checkedRows.value.length > 0 &&
    checkedRows.value.every((item) => item.type !== SystemRoleTypeEnum.SYSTEM)
  );
}
function handleRowCheckboxChange({
  records,
}: {
  records: SystemRoleApi.Role[];
}) {
  checkedRows.value = records;
  checkedIds.value = records.map((item) => item.id!);
}

function handleSearchEnter(event: KeyboardEvent) {
  if (event.isComposing) {
    return;
  }
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }
  if (target.closest('.ant-picker, .ant-select')) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  void gridApi.formApi.submitForm();
}

function getRoleRowClassName({ row }: { row: SystemRoleApi.Role }) {
  return row.status === CommonStatusEnum.DISABLE ? 'role-row--disabled' : '';
}

/** 打开权限配置弹窗 */
function handleAssignPermission(row: SystemRoleApi.Role) {
  assignPermissionFormApi.setData(row).open();
}

function isIgnoredDetailClick(column: any, event?: MouseEvent) {
  const target = event?.target;
  if (
    column?.type === 'checkbox' ||
    column?.field === 'actions' ||
    column?.slots?.default === 'actions'
  ) {
    return true;
  }
  return (
    target instanceof HTMLElement &&
    !!target.closest(
      'button,a,input,.ant-btn,.ant-checkbox-wrapper,.table-actions',
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
  row: SystemRoleApi.Role;
}) {
  if (isIgnoredDetailClick(column, $event)) {
    return;
  }
  handleDetail(row);
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    commonConfig: { labelWidth: 68 },
    schema: useGridFormSchema(),
  },
  gridOptions: {
    columns: useGridColumns(),
    height: 'auto',
    keepSource: true,
    showHeaderOverflow: 'tooltip',
    showOverflow: 'tooltip',
    scrollX: {
      enabled: true,
      gt: 6,
    },
    scrollY: {
      enabled: true,
      gt: 12,
    },
    proxyConfig: {
      ajax: {
        query: async ({ page, sorts }, formValues) => {
          return await getRolePage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
            ...buildRoleSortParams(sorts),
          });
        },
      },
      sort: true,
    },
    sortConfig: {
      remote: true,
      multiple: false,
      trigger: 'cell',
      orders: ['asc', 'desc', null],
      allowBtn: false,
    },
    rowConfig: {
      keyField: 'id',
      isHover: true,
    },
    rowClassName: getRoleRowClassName,
    toolbarConfig: {
      refresh: true,
      search: true,
    },
  } as VxeTableGridOptions<SystemRoleApi.Role>,
  gridEvents: {
    checkboxAll: handleRowCheckboxChange,
    checkboxChange: handleRowCheckboxChange,
    cellClick: handleCellClick,
  },
});
</script>

<template>
  <Page auto-content-height>
    <template #doc>
      <DocAlert
        title="功能权限"
        url="https://doc.iocoder.cn/resource-permission"
      />
    </template>

    <FormModal
      @assign-permission="handleAssignPermission"
      @edit="handleEdit"
      @success="handleRefresh"
    />
    <AssignPermissionFormModal @success="handleRefresh" />
    <Grid
      class="role-management-grid"
      table-title="角色列表"
      @keydown.enter.capture="handleSearchEnter"
    >
      <template #toolbar-tools>
        <div class="role-management-grid__toolbar-actions">
          <span v-if="checkedIds.length > 0" class="role-selection-indicator">
            已选 {{ checkedIds.length }} 个角色
          </span>
          <TableAction
            :actions="[
              {
                label: '新增',
                type: 'primary',
                icon: ACTION_ICON.ADD,
                tooltip: '新增角色',
                auth: ['system:role:create'],
                onClick: handleCreate,
              },
              {
                label: '导出',
                type: 'primary',
                icon: ACTION_ICON.DOWNLOAD,
                auth: ['system:role:export'],
                onClick: handleExport,
              },
              {
                label: $t('ui.actionTitle.deleteBatch'),
                type: 'primary',
                danger: true,
                icon: ACTION_ICON.DELETE,
                ifShow: canBatchOperate,
                auth: ['system:role:delete'],
                onClick: handleDeleteBatch,
              },
            ]"
          />
        </div>
      </template>
      <template #actions="{ row }">
        <TableAction
          :actions="[
            {
              label: $t('common.edit'),
              type: 'link',
              icon: ACTION_ICON.EDIT,
              auth: ['system:role:update'],
              ifShow: () => row.type !== SystemRoleTypeEnum.SYSTEM,
              onClick: handleEdit.bind(null, row),
            },
            {
              label: $t('common.delete'),
              type: 'link',
              danger: true,
              icon: ACTION_ICON.DELETE,
              auth: ['system:role:delete'],
              ifShow: () => row.type !== SystemRoleTypeEnum.SYSTEM,
              popConfirm: {
                title: $t('ui.actionMessage.deleteConfirm', [row.name]),
                confirm: handleDelete.bind(null, row),
              },
            },
            {
              label: '权限配置',
              type: 'link',
              icon: ACTION_ICON.PERMISSION,
              auth: ASSIGN_PERMISSION_AUTH_CODES,
              onClick: handleAssignPermission.bind(null, row),
            },
          ]"
        />
      </template>
      <template #bottom>
        <div class="role-management-grid__legend">
          <span class="role-management-grid__disabled-swatch"></span>
          <span>浅橙色背景和红色文字表示该角色已停用</span>
          <span class="role-management-grid__legend-divider"></span>
          <span>内置角色仅保留权限配置，不允许修改或删除</span>
        </div>
      </template>
    </Grid>
  </Page>
</template>

<style scoped>
.role-management-grid__toolbar-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.role-selection-indicator {
  padding: 3px 9px;
  font-size: 12px;
  font-weight: 600;
  color: hsl(var(--primary));
  white-space: nowrap;
  background: hsl(var(--primary) / 9%);
  border-radius: 999px;
}

:deep(.role-management-grid .vxe-table--render-default),
:deep(.role-management-grid .vxe-grid--form-wrapper),
:deep(.role-management-grid .vxe-toolbar) {
  font-size: 12px;
}

@media (min-width: 1280px) {
  :deep(.role-management-grid .vxe-grid--form-wrapper form > .grid) {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}

:deep(.role-management-grid .vxe-grid--form-wrapper .ant-form-item) {
  margin-bottom: 8px;
}

:deep(.role-management-grid .vxe-grid--form-wrapper label),
:deep(.role-management-grid .vxe-grid--form-wrapper .ant-input),
:deep(.role-management-grid .vxe-grid--form-wrapper .ant-select),
:deep(.role-management-grid .vxe-grid--form-wrapper .ant-picker),
:deep(.role-management-grid .vxe-grid--form-wrapper .ant-btn) {
  font-size: 12px;
}

:deep(.role-management-grid .vxe-grid--form-wrapper .ant-input-affix-wrapper),
:deep(.role-management-grid .vxe-grid--form-wrapper .ant-picker) {
  min-height: 28px;
  padding: 2px 8px;
}

:deep(.role-management-grid .vxe-grid--form-wrapper .ant-select-single),
:deep(
  .role-management-grid
    .vxe-grid--form-wrapper
    .ant-select-single
    .ant-select-selector
) {
  height: 28px;
  min-height: 28px;
}

:deep(
  .role-management-grid
    .vxe-grid--form-wrapper
    .ant-select-single
    .ant-select-selection-item
),
:deep(
  .role-management-grid
    .vxe-grid--form-wrapper
    .ant-select-single
    .ant-select-selection-placeholder
) {
  line-height: 26px;
}

:deep(.role-management-grid .vxe-grid--form-wrapper .ant-btn),
:deep(.role-management-grid .vxe-toolbar .table-actions .ant-btn) {
  height: 28px;
  padding: 2px 10px;
  font-size: 12px;
}

:deep(.role-management-grid .vxe-toolbar .vxe-button) {
  box-sizing: border-box;
  width: 28px !important;
  min-width: 28px !important;
  height: 28px;
  padding: 0;
  font-size: 12px;
}

:deep(.role-management-grid .vxe-header--column) {
  height: 34px;
  font-size: 12px;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
}

:deep(.role-management-grid .vxe-header--column .vxe-cell--title) {
  white-space: nowrap;
}

:deep(.role-management-grid .vxe-header--column.is--sortable .vxe-cell--title) {
  color: #1677ff;
}

:deep(.role-management-grid .vxe-header--column .vxe-cell--sort) {
  display: none;
}

:deep(.role-management-grid .vxe-body--column) {
  height: 36px;
  font-size: 12px;
  line-height: 20px;
}

:deep(.role-management-grid .vxe-body--column .table-actions .ant-btn-link) {
  height: auto;
  padding: 0;
  font-size: 12px;
}

:deep(.role-management-grid .vxe-body--row) {
  cursor: pointer;
}

:deep(.role-management-grid .vxe-body--column .table-actions),
:deep(.role-management-grid .vxe-body--column .vxe-checkbox--input) {
  cursor: default;
}

:deep(.role-management-grid .role-row--disabled > td) {
  font-weight: 600;
  color: #dc2626;
  background-color: rgb(245 158 11 / 16%);
}

:deep(.role-management-grid .role-row--disabled:hover > td) {
  background-color: rgb(245 158 11 / 24%);
}

:deep(.role-management-grid .role-row--disabled > td .vxe-cell) {
  font-weight: inherit;
  color: inherit;
}

.role-management-grid__legend {
  display: flex;
  gap: 6px;
  align-items: center;
  min-height: 32px;
  padding: 6px 12px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--card));
  border-top: 1px solid hsl(var(--border));
}

.role-management-grid__disabled-swatch {
  width: 14px;
  height: 10px;
  background: rgb(245 158 11 / 20%);
  border: 1px solid rgb(220 38 38 / 55%);
  border-radius: 2px;
}

.role-management-grid__legend-divider {
  width: 1px;
  height: 14px;
  margin: 0 4px;
  background: hsl(var(--border));
}

:global(.role-management-search-select-dropdown .ant-select-item),
:global(.role-management-search-select-dropdown .ant-empty-description) {
  font-size: 12px;
}

@media (max-width: 767px) {
  .role-management-grid__legend {
    flex-wrap: wrap;
  }

  .role-management-grid__legend-divider {
    display: none;
  }
}
</style>
