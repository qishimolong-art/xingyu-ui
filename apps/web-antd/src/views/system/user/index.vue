<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SystemDeptApi } from '#/api/system/dept';
import type { SystemUserApi } from '#/api/system/user';

import { computed, onMounted, ref } from 'vue';

import { confirm, DocAlert, Page, useVbenModal } from '@vben/common-ui';
import { DICT_TYPE } from '@vben/constants';
import { getDictLabel } from '@vben/hooks';
import { downloadFileFromBlobPart } from '@vben/utils';

import { Card, message, Tag, Tooltip } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import { getSimpleRoleList } from '#/api/system/role';
import {
  deleteUser,
  deleteUserList,
  exportUser,
  getUserPage,
  updateUserStatus,
} from '#/api/system/user';
import { useFieldPermission } from '#/composables/useFieldPermission';
import { $t } from '#/locales';
import { createVxeHeaderSort } from '#/views/erp/utils/vxe-header-sort';

import { useGridColumns, useGridFormSchema } from './data';
import BatchEditForm from './modules/batch-edit-form.vue';
import DeptTree from './modules/dept-tree.vue';
import Form from './modules/form.vue';
import ImportForm from './modules/import-form.vue';
import ResetPasswordForm from './modules/reset-password-form.vue';
import UserDetailModal from './modules/user-detail-modal.vue';

const FIELD_PERMISSION_MODULE = 'system_users';
const { hiddenFields, loadHiddenFields } = useFieldPermission(
  FIELD_PERMISSION_MODULE,
);
const roleNameMap = ref<Record<number, string>>({});
const searchDeptId = ref<number>();
const selectedDeptName = ref('');
const gridTitle = computed(() =>
  selectedDeptName.value ? `${selectedDeptName.value} · 用户列表` : '全部用户',
);

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

const [ResetPasswordModal, resetPasswordModalApi] = useVbenModal({
  connectedComponent: ResetPasswordForm,
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

const [UserDetailModalComp, userDetailModalApi] = useVbenModal({
  connectedComponent: UserDetailModal,
  destroyOnClose: true,
});

const userSortFieldMap: Record<string, string> = {
  id: 'id',
  nickname: 'nickname',
  email: 'email',
  mobile: 'mobile',
  sex: 'sex',
  status: 'status',
  createTime: 'createTime',
  deptName: 'deptName',
  roleNames: 'roleNames',
};
const { buildSortParams, handleSortChange, restoreSortState } =
  createVxeHeaderSort(userSortFieldMap);

function getUserDisplayName(row: SystemUserApi.User) {
  return row.mobile || row.nickname || row.username || String(row.id ?? '');
}

function getUserRoleNames(row: SystemUserApi.User): string[] {
  const roleNames = row.roleNames
    ?.split(/[,，]/)
    .map((name) => name.trim())
    .filter(Boolean);
  if (roleNames?.length) {
    return roleNames;
  }
  return (
    row.roleIds
      ?.map((roleId) => roleNameMap.value[roleId])
      .filter((name): name is string => Boolean(name)) ?? []
  );
}

/** 刷新表格 */
function handleRefresh() {
  gridApi.query();
}

async function handleRefreshAndClearChecked() {
  checkedIds.value = [];
  checkedUsers.value = [];
  await gridApi.grid.clearCheckboxRow?.();
  handleRefresh();
}

/** 导出表格 */
async function handleExport() {
  const data = await exportUser({
    ...(await gridApi.formApi.getValues()),
    deptId: searchDeptId.value,
  });
  downloadFileFromBlobPart({ fileName: '用户.xls', source: data });
}

/** 选择部门 */
async function handleDeptSelect(dept?: SystemDeptApi.Dept) {
  searchDeptId.value = dept?.id;
  selectedDeptName.value = dept?.name || '';
  await handleRefreshAndClearChecked();
}

function handleDeptClear() {
  void handleDeptSelect();
}

/** 创建用户 */
function handleCreate() {
  formModalApi.setData({ hiddenFields: hiddenFields.value }).open();
}

/** 导入用户 */
function handleImport() {
  importModalApi.open();
}

/** 批量修改用户 */
function handleBatchEdit() {
  if (checkedIds.value.length === 0) {
    message.warning('请先选择需要批量修改的用户');
    return;
  }
  batchEditModalApi
    .setData({
      hiddenFields: hiddenFields.value,
      ids: checkedIds.value,
      users: checkedUsers.value,
    })
    .open();
}

/** 编辑用户 */
function handleEdit(row: SystemUserApi.User) {
  userDetailModalApi
    .setData({ hiddenFields: hiddenFields.value, row, type: 'edit' })
    .open();
}

/** 查看用户详情 */
function handleDetail(row: SystemUserApi.User) {
  userDetailModalApi
    .setData({ hiddenFields: hiddenFields.value, row, type: 'detail' })
    .open();
}

/** 删除用户 */
async function handleDelete(row: SystemUserApi.User) {
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting', [getUserDisplayName(row)]),
    duration: 0,
  });
  try {
    await deleteUser(row.id!);
    message.success(
      $t('ui.actionMessage.deleteSuccess', [getUserDisplayName(row)]),
    );
    handleRefresh();
  } finally {
    hideLoading();
  }
}

/** 批量删除用户 */
async function handleDeleteBatch() {
  await confirm($t('ui.actionMessage.deleteBatchConfirm'));
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deletingBatch'),
    duration: 0,
  });
  try {
    await deleteUserList(checkedIds.value);
    message.success($t('ui.actionMessage.deleteSuccess'));
    await handleRefreshAndClearChecked();
  } finally {
    hideLoading();
  }
}

const checkedIds = ref<number[]>([]);
const checkedUsers = ref<SystemUserApi.User[]>([]);
function handleRowCheckboxChange({
  records,
}: {
  records: SystemUserApi.User[];
}) {
  checkedIds.value = records.map((item) => item.id!);
  checkedUsers.value = records;
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

/** 重置密码 */
function handleResetPassword(row: SystemUserApi.User) {
  resetPasswordModalApi.setData(row).open();
}

/** 更新用户状态 */
async function handleStatusChange(
  newStatus: number,
  row: SystemUserApi.User,
): Promise<boolean | undefined> {
  return new Promise((resolve, reject) => {
    confirm({
      content: `你要将${getUserDisplayName(row)}的状态切换为【${getDictLabel(DICT_TYPE.COMMON_STATUS, newStatus)}】吗？`,
    })
      .then(async () => {
        await updateUserStatus(row.id!, newStatus);
        message.success($t('ui.actionMessage.operationSuccess'));
        resolve(true);
      })
      .catch(() => {
        reject(new Error('取消操作'));
      });
  });
}

function isIgnoredDetailClick(column: any, event?: MouseEvent) {
  const target = event?.target;
  if (
    column?.type === 'checkbox' ||
    column?.field === 'actions' ||
    column?.field === 'status' ||
    column?.slots?.default === 'actions'
  ) {
    return true;
  }
  return (
    target instanceof HTMLElement &&
    !!target.closest(
      'button,a,input,.ant-btn,.ant-switch,.ant-checkbox-wrapper,.table-actions',
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
  row: SystemUserApi.User;
}) {
  if (isIgnoredDetailClick(column, $event)) {
    return;
  }
  handleDetail(row);
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    commonConfig: { labelWidth: 68 },
    collapsed: true,
    collapsedRows: 1,
    schema: useGridFormSchema(hiddenFields.value),
  },
  gridOptions: {
    columns: useGridColumns(
      handleStatusChange,
      hiddenFields.value,
      roleNameMap.value,
    ),
    height: 'auto',
    keepSource: true,
    showHeaderOverflow: 'tooltip',
    showOverflow: 'tooltip',
    scrollX: {
      enabled: true,
      gt: 8,
    },
    scrollY: {
      enabled: true,
      gt: 12,
    },
    proxyConfig: {
      ajax: {
        query: async ({ page, sort, sorts }, formValues) => {
          return await getUserPage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
            ...buildSortParams(sorts, sort),
            deptId: searchDeptId.value,
          });
        },
        querySuccess: () => {
          checkedIds.value = [];
          checkedUsers.value = [];
          void restoreSortState(gridApi);
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
      isCurrent: true,
    },
    toolbarConfig: {
      refresh: true,
      search: true,
    },
  } as VxeTableGridOptions<SystemUserApi.User>,
  gridEvents: {
    sortChange: handleSortChange,
    checkboxAll: handleRowCheckboxChange,
    checkboxChange: handleRowCheckboxChange,
    cellClick: handleCellClick,
  },
});

onMounted(async () => {
  const roles = await getSimpleRoleList();
  roleNameMap.value = Object.fromEntries(
    roles
      .filter((role) => role.id !== undefined)
      .map((role) => [role.id!, role.name]),
  );
  await loadHiddenFields();
  gridApi.formApi.setState({ schema: useGridFormSchema(hiddenFields.value) });
  gridApi.setGridOptions({
    columns: useGridColumns(
      handleStatusChange,
      hiddenFields.value,
      roleNameMap.value,
    ),
  });
});
</script>

<template>
  <Page auto-content-height>
    <template #doc>
      <DocAlert title="用户体系" url="https://doc.iocoder.cn/user-center/" />
      <DocAlert title="三方登录" url="https://doc.iocoder.cn/social-user/" />
      <DocAlert
        title="Excel 导入导出"
        url="https://doc.iocoder.cn/excel-import-and-export/"
      />
    </template>

    <FormModal @success="handleRefresh" />
    <ResetPasswordModal @success="handleRefresh" />
    <ImportModal @success="handleRefresh" />
    <BatchEditModal @success="handleRefreshAndClearChecked" />
    <UserDetailModalComp @success="handleRefresh" />

    <div class="flex h-full min-h-0 w-full">
      <!-- 左侧部门树 -->
      <Card class="user-dept-card mr-4 h-full min-h-0 w-[224px] flex-none">
        <div class="dept-panel">
          <div class="dept-panel__header">
            <div class="min-w-0">
              <div class="dept-panel__eyebrow">部门筛选</div>
              <div
                class="dept-panel__title"
                :title="selectedDeptName || '全部部门'"
              >
                {{ selectedDeptName || '全部部门' }}
              </div>
            </div>
            <button
              v-if="searchDeptId"
              type="button"
              class="dept-panel__clear"
              @click="handleDeptClear"
            >
              查看全部
            </button>
          </div>
          <div class="dept-panel__body">
            <DeptTree :selected-key="searchDeptId" @select="handleDeptSelect" />
          </div>
        </div>
      </Card>
      <!-- 右侧用户列表 -->
      <div class="min-w-0 flex-1">
        <Grid
          class="user-management-grid"
          :table-title="gridTitle"
          @keydown.enter.capture="handleSearchEnter"
        >
          <template #toolbar-tools>
            <div class="toolbar-action-group">
              <span v-if="checkedIds.length" class="selection-indicator">
                已选 {{ checkedIds.length }} 人
              </span>
              <TableAction
                :actions="[
                  {
                    label: '新增',
                    type: 'primary',
                    icon: ACTION_ICON.ADD,
                    auth: ['system:user:create'],
                    onClick: handleCreate,
                  },
                  {
                    label: '导入',
                    type: 'primary',
                    icon: ACTION_ICON.UPLOAD,
                    auth: ['system:user:import'],
                    onClick: handleImport,
                  },
                  {
                    label: '导出',
                    type: 'primary',
                    icon: ACTION_ICON.DOWNLOAD,
                    auth: ['system:user:export'],
                    onClick: handleExport,
                  },
                ]"
              />
              <TableAction
                v-if="checkedIds.length"
                :actions="[
                  {
                    label: '批量修改',
                    type: 'primary',
                    icon: ACTION_ICON.EDIT,
                    auth: ['system:user:update'],
                    onClick: handleBatchEdit,
                  },
                  {
                    label: $t('ui.actionTitle.deleteBatch'),
                    type: 'primary',
                    danger: true,
                    icon: ACTION_ICON.DELETE,
                    auth: ['system:user:delete'],
                    onClick: handleDeleteBatch,
                  },
                ]"
              />
            </div>
          </template>
          <template #userIdentity="{ row }">
            <div class="user-identity">
              <span class="user-identity__name" :title="row.nickname || ''">
                {{ row.nickname || '未命名用户' }}
              </span>
            </div>
          </template>
          <template #userRoles="{ row }">
            <div v-if="getUserRoleNames(row).length" class="user-role-list">
              <Tag
                v-for="roleName in getUserRoleNames(row).slice(0, 2)"
                :key="roleName"
                color="blue"
                class="user-role-tag"
              >
                {{ roleName }}
              </Tag>
              <Tooltip
                v-if="getUserRoleNames(row).length > 2"
                :title="getUserRoleNames(row).join('、')"
              >
                <span class="user-role-more">
                  +{{ getUserRoleNames(row).length - 2 }}
                </span>
              </Tooltip>
            </div>
            <span v-else class="cell-empty">未配置</span>
          </template>
          <template #actions="{ row }">
            <TableAction
              :actions="[
                {
                  label: $t('common.edit'),
                  type: 'link',
                  icon: ACTION_ICON.EDIT,
                  auth: ['system:user:update'],
                  onClick: handleEdit.bind(null, row),
                },
                {
                  label: $t('common.delete'),
                  type: 'link',
                  danger: true,
                  icon: ACTION_ICON.DELETE,
                  auth: ['system:user:delete'],
                  popConfirm: {
                    title: $t('ui.actionMessage.deleteConfirm', [
                      getUserDisplayName(row),
                    ]),
                    confirm: handleDelete.bind(null, row),
                  },
                },
                {
                  label: '重置密码',
                  type: 'link',
                  icon: ACTION_ICON.RESET_PASSWORD,
                  auth: ['system:user:update-password'],
                  onClick: handleResetPassword.bind(null, row),
                },
              ]"
            />
          </template>
        </Grid>
      </div>
    </div>
  </Page>
</template>

<style scoped>
:deep(.user-dept-card .ant-card-body) {
  box-sizing: border-box;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  padding: 0;
}

.dept-panel {
  display: flex;
  height: 100%;
  min-height: 0;
  flex-direction: column;
}

.dept-panel__header {
  display: flex;
  min-height: 54px;
  flex: none;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border-bottom: 1px solid hsl(var(--border));
  padding: 8px 12px;
  background: hsl(var(--primary) / 5%);
}

.dept-panel__eyebrow {
  color: hsl(var(--muted-foreground));
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
}

.dept-panel__title {
  overflow: hidden;
  margin-top: 2px;
  color: hsl(var(--foreground));
  font-size: 14px;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dept-panel__clear {
  flex: none;
  border: 0;
  color: hsl(var(--primary));
  background: transparent;
  cursor: pointer;
  font-size: 12px;
}

.dept-panel__clear:hover {
  text-decoration: underline;
}

.dept-panel__clear:focus-visible {
  border-radius: 4px;
  outline: 2px solid hsl(var(--primary) / 55%);
  outline-offset: 2px;
}

.dept-panel__body {
  min-height: 0;
  flex: 1;
  padding: 10px 8px 8px;
}

.toolbar-action-group,
.user-identity,
.user-role-list {
  display: flex;
  align-items: center;
}

.toolbar-action-group {
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px 8px;
}

.selection-indicator {
  border-radius: 999px;
  padding: 2px 8px;
  color: hsl(var(--primary));
  background: hsl(var(--primary) / 9%);
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.user-identity {
  min-width: 0;
  gap: 6px;
}

.user-identity__name {
  overflow: hidden;
  color: hsl(var(--foreground));
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-role-list {
  min-width: 0;
  gap: 4px;
  overflow: hidden;
}

.user-role-tag,
.data-scope-tag {
  overflow: hidden;
  margin-inline-end: 0;
  padding-inline: 5px;
  font-size: 11px;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-role-tag {
  max-width: 58px;
}

.user-role-more {
  flex: none;
  color: hsl(var(--muted-foreground));
  cursor: help;
  font-size: 12px;
}

.cell-empty {
  color: hsl(var(--muted-foreground));
  font-size: 12px;
}

:deep(.user-management-grid .vxe-table--render-default),
:deep(.user-management-grid .vxe-grid--form-wrapper) {
  font-size: 12px;
}

@media (min-width: 1440px) {
  :deep(.user-management-grid .vxe-grid--form-wrapper form > .grid) {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}

:deep(.user-management-grid .vxe-grid--form-wrapper label),
:deep(.user-management-grid .vxe-grid--form-wrapper .ant-input),
:deep(.user-management-grid .vxe-grid--form-wrapper .ant-picker),
:deep(.user-management-grid .vxe-grid--form-wrapper .ant-picker-input > input),
:deep(.user-management-grid .vxe-grid--form-wrapper .ant-select),
:deep(.user-management-grid .vxe-grid--form-wrapper .ant-btn),
:deep(.user-management-grid .vxe-grid--form-wrapper .vben-link) {
  font-size: 12px;
}

:deep(.user-management-grid .vxe-grid--form-wrapper label) {
  line-height: 20px;
}

:deep(.user-management-grid .vxe-grid--form-wrapper .ant-input-affix-wrapper) {
  min-height: 28px;
  padding: 2px 8px;
  font-size: 12px;
}

:deep(
  .user-management-grid
    .vxe-grid--form-wrapper
    .ant-input-affix-wrapper
    .ant-input
) {
  line-height: 22px;
}

:deep(.user-management-grid .vxe-grid--form-wrapper .ant-select-single) {
  height: 28px;
}

:deep(
  .user-management-grid
    .vxe-grid--form-wrapper
    .ant-select-single
    .ant-select-selector
) {
  height: 28px;
  padding: 0 8px;
  font-size: 12px;
}

:deep(
  .user-management-grid
    .vxe-grid--form-wrapper
    .ant-select-single
    .ant-select-selection-search-input
) {
  height: 26px;
}

:deep(
  .user-management-grid
    .vxe-grid--form-wrapper
    .ant-select-single
    .ant-select-selection-item
),
:deep(
  .user-management-grid
    .vxe-grid--form-wrapper
    .ant-select-single
    .ant-select-selection-placeholder
) {
  line-height: 26px;
}

:global(.user-management-search-select-dropdown .ant-select-item),
:global(.user-management-search-select-dropdown .ant-empty-description) {
  font-size: 12px;
}

:deep(.user-management-grid .vxe-grid--form-wrapper .ant-picker) {
  height: 28px;
  padding: 2px 8px;
}

:deep(.user-management-grid .vxe-grid--form-wrapper .ant-btn) {
  height: 28px;
  padding: 2px 10px;
  line-height: 20px;
}

:deep(.user-management-grid .vxe-toolbar .vxe-tool--item-wrapper) {
  font-size: 12px;
}

:deep(.user-management-grid .vxe-toolbar .table-actions .ant-btn) {
  height: 28px;
  padding: 2px 10px;
  font-size: 12px;
  line-height: 20px;
}

:deep(.user-management-grid .vxe-toolbar .table-actions .ant-btn .anticon) {
  font-size: 12px;
}

:deep(.user-management-grid .vxe-toolbar .vxe-button) {
  box-sizing: border-box;
  width: 28px !important;
  min-width: 28px !important;
  height: 28px;
  padding: 0;
  font-size: 12px;
}

:deep(.user-management-grid .vxe-header--column) {
  color: hsl(var(--muted-foreground));
  background: hsl(var(--muted) / 66%);
  font-weight: 600;
}

:deep(.user-management-grid .vxe-header--column .vxe-cell--title) {
  white-space: nowrap;
}

:deep(.user-management-grid .vxe-header--column.is--sortable .vxe-cell--title) {
  color: #1677ff;
}

:deep(.user-management-grid .vxe-header--column .vxe-cell--sort) {
  display: none;
}

:deep(.user-management-grid .user-mobile-column .vxe-cell--label) {
  font-family: ui-monospace, 'SFMono-Regular', consolas, monospace;
  font-variant-numeric: tabular-nums;
}

:deep(.user-management-grid .vxe-body--column .table-actions .ant-btn-link) {
  height: auto;
  padding: 0;
  font-size: 12px;
}

:deep(.user-management-grid .vxe-body--row) {
  cursor: pointer;
}

:deep(.user-management-grid .vxe-body--column .table-actions),
:deep(.user-management-grid .vxe-body--column .ant-switch),
:deep(.user-management-grid .vxe-body--column .vxe-checkbox--input) {
  cursor: default;
}

:deep(.user-management-grid .vxe-grid--pager-wrapper) {
  position: sticky;
  z-index: 5;
  bottom: 0;
  margin-top: 0 !important;
  background: hsl(var(--card));
  box-shadow: 0 -2px 8px rgb(0 0 0 / 8%);
}

@media (max-width: 1024px) {
  .user-dept-card {
    width: 200px;
  }
}
</style>
