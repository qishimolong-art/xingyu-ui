<script lang="ts" setup>
import { provideFinanceCandidateFocus } from '#/views/erp/finance/utils/candidate-focus';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpAccountApi } from '#/api/erp/finance/account';

import { onBeforeUnmount, onMounted, ref } from 'vue';

import { useAccess } from '@vben/access';
import {
  confirm,
  DocAlert,
  Page,
  useVbenDrawer,
  useVbenModal,
} from '@vben/common-ui';
import { downloadFileFromBlobPart, isEmpty } from '@vben/utils';

import { Alert, message, Tag } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  ACCOUNT_DOCUMENT_STATUS,
  batchUpdateAccount,
  deleteAccount,
  downloadAccountImportFailureDetails,
  exportAccount,
  getAccountExportFields,
  getAccountImportTemplate,
  getAccountPage,
  importAccount,
  updateAccountDefaultStatus,
} from '#/api/erp/finance/account';
import {
  isFieldHidden,
  useFieldPermission,
} from '#/composables/useFieldPermission';
import { $t } from '#/locales';
import ErpActivationRefreshMask from '#/views/erp/components/ErpActivationRefreshMask.vue';
import ExportFieldModalComponent from '#/views/erp/components/export-field-modal.vue';
import { useFinanceShortcut } from '#/views/erp/composables/useFinanceShortcut';
import { fitFinanceDocumentListColumnsToWidth } from '#/views/erp/finance/utils/document-list-table';
import { useVxeActivationRefresh } from '#/views/erp/utils/activation-refresh';
import { createVxeHeaderSort } from '#/views/erp/utils/vxe-header-sort';

import BatchEditModal from '../../components/batch-edit-modal.vue';
import ImportModal from '../../components/import-modal.vue';
import {
  ACCOUNT_SORT_FIELD_MAP,
  useGridColumns,
  useGridFormSchema,
} from './data';
import Form from './modules/form.vue';
import TransactionDrawer from './modules/transaction-drawer.vue';
const { candidateSchema, candidatePagerConfig } =
  provideFinanceCandidateFocus();

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: false,
  onClosed: handleFormModalClosed,
  onOpenChange: handleFormModalOpenChange,
});

const [BatchEditFormModal, batchEditFormModalApi] = useVbenModal({
  connectedComponent: BatchEditModal,
  destroyOnClose: true,
});

const currentAccountId = ref<number>();
const gridShellRef = ref<HTMLElement>();
const checkedIds = ref<number[]>([]);
const checkedRows = ref<ErpAccountApi.Account[]>([]);
const pageRows = ref<ErpAccountApi.Account[]>([]);
const { buildSortParams, handleSortChange, restoreSortState } =
  createVxeHeaderSort(ACCOUNT_SORT_FIELD_MAP);
const [TransactionDrawerModal, transactionDrawerApi] = useVbenDrawer({
  title: '账户交易流水',
  footer: false,
  destroyOnClose: false,
});

let isFormModalOpen = false;
let ignoreRowClickUntil = 0;
const { hasAccessByCodes } = useAccess();
const { hiddenFields } = useFieldPermission('erp_account');

const [ImportFormModal, importFormModalApi] = useVbenModal({
  connectedComponent: ImportModal,
  destroyOnClose: true,
});
const [ExportFieldModal, exportFieldModalApi] = useVbenModal({
  connectedComponent: ExportFieldModalComponent,
  destroyOnClose: true,
});
const pendingExportParams = ref<Record<string, any>>({});
let gridResizeObserver: ResizeObserver | undefined;

function isAccountDraft(row: ErpAccountApi.Account) {
  return row.documentStatus === ACCOUNT_DOCUMENT_STATUS.DRAFT;
}

function handleFormModalOpenChange(isOpen: boolean) {
  isFormModalOpen = isOpen;
  if (!isOpen) {
    ignoreRowClickUntil = Date.now() + 300;
  }
}

function handleFormModalClosed() {
  isFormModalOpen = false;
  ignoreRowClickUntil = Date.now() + 300;
}

function handleRefresh() {
  checkedIds.value = [];
  checkedRows.value = [];
  gridApi.query();
}

function handleCreate() {
  formModalApi.setData({ type: 'create' }).open();
}

function handleImport() {
  importFormModalApi
    .setData({
      failureDownload: {
        fileName: '结算账户错误数据.xls',
        request: downloadAccountImportFailureDetails,
      },
      importRequest: importAccount,
      templateFileName: '结算账户导入模板.xls',
      templateRequest: getAccountImportTemplate,
      title: '导入结算账户',
    })
    .open();
}

async function handleExport() {
  const formValues = (await gridApi.formApi.getValues()) ?? {};
  pendingExportParams.value = checkedIds.value.length
    ? { ids: checkedIds.value, ...buildSortParams() }
    : { ...formValues, ...buildSortParams() };
  exportFieldModalApi
    .setData({
      loadFields: () => getAccountExportFields('account'),
      moduleKey: 'erp_account',
    })
    .open();
}

async function handleExportConfirm(fields: string[]) {
  const data = await exportAccount({
    ...pendingExportParams.value,
    fields: fields.join(','),
  });
  downloadFileFromBlobPart({ fileName: '结算账户.xls', source: data });
}

useFinanceShortcut({
  onCreate: () => {
    if (hasAccessByCodes(['erp:account:create'])) handleCreate();
  },
  onImport: () => {
    if (hasAccessByCodes(['erp:account:import'])) handleImport();
  },
});

function handleBatchEdit() {
  if (checkedRows.value.some((row) => isAccountDraft(row))) {
    message.warning('草稿不能批量修改，请提交后再统一修改');
    return;
  }
  batchEditFormModalApi
    .setData({
      ids: checkedIds.value,
      title: '批量修改账户',
      updateRequest: batchUpdateAccount,
      fields: [
        {
          field: 'status',
          label: '启用状态',
          component: 'radio',
          options: [
            { label: '开启', value: 0 },
            { label: '关闭', value: 1 },
          ],
        },
        {
          field: 'remark',
          label: '备注',
          component: 'textarea',
        },
      ],
    })
    .open();
}

function handleEdit(row: ErpAccountApi.Account) {
  formModalApi.setData({ type: 'edit', id: row.id }).open();
}

function handleDetail(row: ErpAccountApi.Account) {
  formModalApi.setData({ type: 'detail', id: row.id }).open();
}

function handleOpenTransactions(row: ErpAccountApi.Account) {
  currentAccountId.value = row.id;
  transactionDrawerApi
    .setState({
      title: row.name ? `账户交易流水 - ${row.name}` : '账户交易流水',
    })
    .open();
}

function handleCellClick({
  column,
  row,
}: {
  column: any;
  row: ErpAccountApi.Account;
}) {
  if (
    !column?.field ||
    column?.field === 'actions' ||
    column?.type === 'checkbox' ||
    column?.slots?.default === 'actions' ||
    column?.cellRender?.name === 'CellSwitch'
  ) {
    return;
  }
  if (isFormModalOpen || Date.now() < ignoreRowClickUntil) {
    return;
  }
  handleDetail(row);
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

async function handleDelete(row: ErpAccountApi.Account) {
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting', [row.name]),
    duration: 0,
  });
  try {
    await deleteAccount(row.id as number);
    message.success($t('ui.actionMessage.deleteSuccess', [row.name]));
    await refreshAfterDelete(1);
  } finally {
    hideLoading();
  }
}

async function handleBatchDelete() {
  if (checkedRows.value.length === 0) {
    message.warning('请先勾选要删除的数据');
    return;
  }
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting'),
    duration: 0,
  });
  try {
    await Promise.all(
      checkedRows.value.map((row) => deleteAccount(row.id as number)),
    );
    message.success($t('ui.actionMessage.deleteSuccess'));
    await refreshAfterDelete(checkedRows.value.length);
  } finally {
    hideLoading();
  }
}

async function refreshAfterDelete(deletedCount: number) {
  const pager = gridApi.grid?.getProxyInfo?.()?.pager;
  const shouldFallback =
    pager && deletedCount >= pageRows.value.length && pager.currentPage > 1;
  checkedIds.value = [];
  checkedRows.value = [];
  gridApi.grid?.clearCheckboxRow?.();
  gridApi.grid?.clearCheckboxReserve?.();
  if (shouldFallback) {
    await gridApi.grid?.setCurrentPage?.(pager.currentPage - 1);
  }
  await gridApi.query();
}

function handleRowCheckboxChange({
  records,
}: {
  records: ErpAccountApi.Account[];
}) {
  checkedIds.value = records.map((item) => item.id!).filter(Boolean);
  checkedRows.value = records;
}

async function handleDefaultStatusChange(
  newStatus: boolean,
  row: ErpAccountApi.Account,
): Promise<boolean | undefined> {
  if (isAccountDraft(row)) {
    message.warning('草稿尚未正式提交，不能设置为默认账户');
    return false;
  }
  return new Promise((resolve, reject) => {
    const text = newStatus ? '设置' : '取消';
    confirm({
      content: `确认${text}“${row.name}”为默认账户？`,
    })
      .then(async () => {
        await updateAccountDefaultStatus(row.id!, newStatus);
        message.success(`${text}默认账户成功`);
        handleRefresh();
        resolve(true);
      })
      .catch(() => {
        reject(new Error('取消操作'));
      });
  });
}

function buildGridColumns(rows: ErpAccountApi.Account[] = pageRows.value) {
  return fitFinanceDocumentListColumnsToWidth(
    useGridColumns(handleDefaultStatusChange, rows).filter(
      (column: any) =>
        !column.field || !isFieldHidden(hiddenFields.value, column.field),
    ),
    gridShellRef.value?.clientWidth ?? 0,
  );
}

async function handleGridColumnCustom({ type }: { type?: string }) {
  if (type !== 'confirm' && type !== 'reset') return;
  await gridApi.grid?.reloadColumn?.(buildGridColumns());
  await restoreSortState(gridApi);
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    commonConfig: { labelWidth: 68 },
    schema: candidateSchema(useGridFormSchema()),
  },
  gridOptions: {
    pagerConfig: candidatePagerConfig(),
    columns: buildGridColumns([]),
    customConfig: {
      storage: {
        fixed: true,
        resizable: true,
        sort: true,
        visible: true,
      },
    },
    fit: false,
    height: 'auto',
    id: 'erp-finance-cash-bank-account-list-v2',
    keepSource: true,
    showHeaderOverflow: 'tooltip',
    showOverflow: 'tooltip',
    scrollX: {
      enabled: true,
      gt: 8,
    },
    scrollY: {
      enabled: true,
      gt: 10,
    },
    proxyConfig: {
      ajax: {
        query: async ({ page, sort, sorts }, formValues) =>
          await getAccountPage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
            ...buildSortParams(sorts, sort),
          }).then((result) => {
            pageRows.value = result.list || [];
            void gridApi.grid?.reloadColumn?.(buildGridColumns(pageRows.value));
            return result;
          }),
        querySuccess: () => void restoreSortState(gridApi),
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
    rowClassName: ({ row }) =>
      isAccountDraft(row) ? 'account-management-draft-row' : '',
    toolbarConfig: {
      custom: true,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<ErpAccountApi.Account>,
  gridEvents: {
    custom: handleGridColumnCustom,
    sortChange: handleSortChange,
    cellClick: handleCellClick,
    checkboxAll: handleRowCheckboxChange,
    checkboxChange: handleRowCheckboxChange,
  },
});

const { activationRefreshMaskVisible } =
  useVxeActivationRefresh<ErpAccountApi.Account>({
    gridApi,
    errorMessage: 'Error occurred while refreshing finance account page:',
    getParams: async () => ({
      ...(await gridApi.formApi.getValues()),
      ...buildSortParams(),
    }),
    queryPage: getAccountPage,
    onSuccess: (rows) => {
      pageRows.value = rows;
      void gridApi.grid?.reloadColumn?.(buildGridColumns(rows));
      checkedIds.value = [];
      checkedRows.value = [];
      gridApi.grid?.clearCheckboxRow?.();
      gridApi.grid?.clearCheckboxReserve?.();
      void restoreSortState(gridApi);
    },
  });

onMounted(() => {
  if (typeof ResizeObserver === 'undefined' || !gridShellRef.value) return;
  gridResizeObserver = new ResizeObserver(() => {
    void gridApi.grid?.reloadColumn?.(buildGridColumns());
  });
  gridResizeObserver.observe(gridShellRef.value);
});

onBeforeUnmount(() => gridResizeObserver?.disconnect());
</script>

<template>
  <Page auto-content-height>
    <template #doc>
      <DocAlert
        title="账户管理"
        url="https://doc.iocoder.cn/sale/finance-payment-receipt/"
      />
    </template>

    <FormModal @success="handleRefresh" />
    <ImportFormModal @success="handleRefresh" />
    <ExportFieldModal @confirm="handleExportConfirm" />
    <BatchEditFormModal @success="handleRefresh" />
    <TransactionDrawerModal class="w-[75vw]">
      <TransactionDrawer :account-id="currentAccountId" />
    </TransactionDrawerModal>
    <div ref="gridShellRef" class="account-management-grid-shell">
      <Alert
        class="mb-2"
        type="info"
        show-icon
        message="账户资金流水需要区分业务来源、业务归属部门和账户管理部门。"
        description="总部代收代付后续需要与其他往来关联，避免重复记债权债务；已确认后的错误资金流水使用反向资金单处理，保留原流水。"
      />
      <Grid
        class="account-management-grid"
        table-title="账户列表"
        @keydown.enter.capture="handleSearchEnter"
      >
        <template #toolbar-tools>
          <TableAction
            :actions="[
              {
                label: '新增',
                type: 'primary',
                icon: ACTION_ICON.ADD,
                tooltip: 'Insert 新增',
                title: 'Insert 新增',
                auth: ['erp:account:create'],
                onClick: handleCreate,
              },
              {
                label: '导入',
                type: 'primary',
                icon: ACTION_ICON.UPLOAD,
                tooltip: 'I 导入',
                title: 'I 导入',
                auth: ['erp:account:import'],
                onClick: handleImport,
              },
              {
                label: '导出',
                type: 'primary',
                icon: ACTION_ICON.DOWNLOAD,
                auth: ['erp:account:export'],
                onClick: handleExport,
              },
              {
                label: '批量修改',
                type: 'primary',
                icon: ACTION_ICON.EDIT,
                ifShow: () => !isEmpty(checkedIds),
                auth: ['erp:account:update'],
                onClick: handleBatchEdit,
              },
              {
                label: '批量删除',
                type: 'primary',
                danger: true,
                icon: ACTION_ICON.DELETE,
                ifShow: () => !isEmpty(checkedIds),
                auth: ['erp:account:delete'],
                popConfirm: {
                  title: '是否删除选中的账户？',
                  confirm: handleBatchDelete,
                },
              },
            ]"
          />
        </template>
        <template #accountName="{ row }">
          <button
            class="account-management-grid__name-link"
            type="button"
            @click.stop="handleDetail(row)"
          >
            {{ row.name || '-' }}
          </button>
        </template>
        <template #documentStatus="{ row }">
          <Tag
            :color="isAccountDraft(row) ? 'blue' : 'green'"
            class="m-0"
            :title="
              isAccountDraft(row)
                ? '草稿：关闭新增或草稿编辑页面时自动保存，尚未正式提交'
                : '正式账户：可按启用状态参与业务选择'
            "
          >
            {{ isAccountDraft(row) ? '草稿' : '正式' }}
          </Tag>
        </template>
        <template #actions="{ row }">
          <TableAction
            :actions="[
              {
                label: '流水',
                type: 'link',
                icon: ACTION_ICON.VIEW,
                auth: ['erp:account:query'],
                ifShow: () => !isAccountDraft(row),
                onClick: handleOpenTransactions.bind(null, row),
              },
              {
                label: isAccountDraft(row) ? '编辑草稿' : $t('common.edit'),
                type: 'link',
                icon: ACTION_ICON.EDIT,
                auth: ['erp:account:update'],
                onClick: handleEdit.bind(null, row),
              },
              {
                label: $t('common.delete'),
                type: 'link',
                danger: true,
                icon: ACTION_ICON.DELETE,
                auth: ['erp:account:delete'],
                popConfirm: {
                  title: $t('ui.actionMessage.deleteConfirm', [row.name]),
                  confirm: handleDelete.bind(null, row),
                },
              },
            ]"
            @click.stop
          />
        </template>
        <template #bottom>
          <div class="account-management-draft-legend">
            <span
              class="account-management-draft-legend__swatch"
              aria-hidden="true"
            ></span>
            <span>浅蓝色行表示未正式提交的账户草稿</span>
          </div>
        </template>
      </Grid>
      <ErpActivationRefreshMask
        v-if="activationRefreshMaskVisible"
        class="account-management-activation-mask"
      />
    </div>
  </Page>
</template>

<style scoped>
.account-management-grid-shell {
  position: relative;
  height: 100%;
  min-height: 100%;
}

:deep(.account-management-grid .vxe-table--render-default),
:deep(.account-management-grid .vxe-grid--form-wrapper),
:deep(.account-management-grid .vxe-toolbar) {
  font-size: 12px;
}

@media (min-width: 1280px) {
  :deep(.account-management-grid .vxe-grid--form-wrapper form > .grid) {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}

:deep(.account-management-grid .vxe-grid--form-wrapper .ant-form-item) {
  margin-bottom: 8px;
}

:deep(.account-management-grid .vxe-grid--form-wrapper label),
:deep(.account-management-grid .vxe-grid--form-wrapper .ant-input),
:deep(.account-management-grid .vxe-grid--form-wrapper .ant-select),
:deep(.account-management-grid .vxe-grid--form-wrapper .ant-btn) {
  font-size: 12px;
}

:deep(
  .account-management-grid .vxe-grid--form-wrapper .ant-input-affix-wrapper
) {
  min-height: 28px;
  padding: 2px 8px;
}

:deep(.account-management-grid .vxe-grid--form-wrapper .ant-select-single),
:deep(
  .account-management-grid
    .vxe-grid--form-wrapper
    .ant-select-single
    .ant-select-selector
) {
  height: 28px;
  min-height: 28px;
}

:deep(
  .account-management-grid
    .vxe-grid--form-wrapper
    .ant-select-single
    .ant-select-selection-item
),
:deep(
  .account-management-grid
    .vxe-grid--form-wrapper
    .ant-select-single
    .ant-select-selection-placeholder
) {
  line-height: 26px;
}

:deep(.account-management-grid .vxe-grid--form-wrapper .ant-btn),
:deep(.account-management-grid .vxe-toolbar .table-actions .ant-btn) {
  height: 28px;
  padding: 2px 10px;
  font-size: 12px;
}

:deep(.account-management-grid .vxe-toolbar .vxe-button) {
  box-sizing: border-box;
  width: 28px !important;
  min-width: 28px !important;
  height: 28px;
  padding: 0;
  font-size: 12px;
}

:deep(.account-management-grid .vxe-header--column) {
  height: 34px;
  font-size: 12px;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
}

:deep(.account-management-grid .vxe-header--column .vxe-cell--title) {
  white-space: nowrap;
}

:deep(
  .account-management-grid .vxe-header--column.is--sortable .vxe-cell--title
) {
  color: #1677ff;
}

:deep(.account-management-grid .vxe-header--column .vxe-cell--sort) {
  display: none;
}

:deep(.account-management-grid .vxe-body--column) {
  height: 36px;
  font-size: 12px;
  line-height: 20px;
}

:deep(.account-management-grid .account-amount-cell) {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

:deep(.account-management-grid .vxe-body--column .table-actions .ant-btn-link) {
  height: auto;
  padding: 0;
  font-size: 12px;
}

.account-management-grid__name-link {
  display: block;
  max-width: 100%;
  padding: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font: inherit;
  font-weight: 600;
  color: hsl(var(--primary));
  white-space: nowrap;
  cursor: pointer;
  background: transparent;
  border: 0;
}

.account-management-grid__name-link:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.account-management-grid__name-link:focus-visible {
  outline: 2px solid hsl(var(--primary));
  outline-offset: 2px;
  border-radius: 3px;
}

:deep(.account-management-draft-row .vxe-body--column) {
  background: hsl(var(--primary) / 8%);
}

:deep(.account-management-draft-row.row--hover .vxe-body--column) {
  background: hsl(var(--primary) / 14%);
}

.account-management-draft-legend {
  display: flex;
  gap: 8px;
  align-items: center;
  min-height: 34px;
  padding: 6px 12px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--card));
  border-top: 1px solid hsl(var(--border));
}

.account-management-draft-legend__swatch {
  width: 20px;
  height: 12px;
  background: hsl(var(--primary) / 12%);
  border: 1px solid hsl(var(--primary) / 28%);
  border-radius: 3px;
}

:deep(.account-management-grid .vxe-grid--pager-wrapper) {
  position: sticky;
  bottom: 0;
  z-index: 5;
  margin-top: 0 !important;
  background: hsl(var(--card));
  box-shadow: 0 -2px 8px rgb(0 0 0 / 8%);
}

:global(.account-search-select-dropdown .ant-select-item),
:global(.account-search-select-dropdown .ant-empty-description) {
  font-size: 12px;
}
</style>
