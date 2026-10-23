<script lang="ts" setup>
import { provideFinanceCandidateFocus } from '#/views/erp/finance/utils/candidate-focus';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpFinanceTransferApi } from '#/api/erp/finance/transfer';

import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import { useAccess } from '@vben/access';
import { Page, useVbenModal } from '@vben/common-ui';
import { downloadFileFromBlobPart } from '@vben/utils';

import { Alert, message, Tag } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  batchUpdateFinanceTransfer,
  deleteFinanceTransfer,
  downloadFinanceTransferImportFailureDetails,
  exportFinanceTransfer,
  getFinanceTransferExportFields,
  getFinanceTransferImportTemplate,
  getFinanceTransferPage,
  getFinanceTransferSummary,
  importFinanceTransfer,
  updateFinanceTransferStatus,
} from '#/api/erp/finance/transfer';
import {
  isFieldHidden,
  useFieldPermission,
} from '#/composables/useFieldPermission';
import { $t } from '#/locales';
import ErpActivationRefreshMask from '#/views/erp/components/ErpActivationRefreshMask.vue';
import ExportFieldModalComponent from '#/views/erp/components/export-field-modal.vue';
import PrintTemplateModal from '#/views/erp/components/PrintTemplateModal.vue';
import PrintTemplateSelector from '#/views/erp/components/PrintTemplateSelector.vue';
import { useFinanceShortcut } from '#/views/erp/composables/useFinanceShortcut';
import FinanceListQuerySummary from '#/views/erp/finance/components/FinanceListQuerySummary.vue';
import { fitFinanceDocumentListColumnsToWidth } from '#/views/erp/finance/utils/document-list-table';
import { useFinanceQuerySummary } from '#/views/erp/finance/utils/use-finance-query-summary';
import { useVxeActivationRefresh } from '#/views/erp/utils/activation-refresh';
import { useErpPrintTemplate } from '#/views/erp/utils/print-template';
import { createVxeHeaderSort } from '#/views/erp/utils/vxe-header-sort';

import BatchEditModal from '../../components/batch-edit-modal.vue';
import ImportModal from '../../components/import-modal.vue';
import { useGridColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';
import { formatBankTransferAmount } from './ui';
const { candidateSchema, candidatePagerConfig } =
  provideFinanceCandidateFocus();

defineOptions({ name: 'ErpFinanceTransfer' });

const PRINT_TEMPLATE_MODULE = 'finance_transfer';
const PRINT_MODULE_NAME = '银行转账';

const rows = ref<ErpFinanceTransferApi.FinanceTransfer[]>([]);
const checkedRows = ref<ErpFinanceTransferApi.FinanceTransfer[]>([]);
const gridShellRef = ref<HTMLElement>();
const { hasAccessByCodes } = useAccess();
const { hiddenFields } = useFieldPermission('erp_finance_transfer');
const querySummaryState = useFinanceQuerySummary((params, signal) =>
  getFinanceTransferSummary(params, signal),
);
const querySummaryItems = computed(() => {
  const value = querySummaryState.summary.value;
  if (!value) return [];
  return [
    {
      key: 'documentCount',
      label: '单据数',
      value: `${value.documentCount ?? 0} 张`,
    },
    { key: 'draftCount', label: '草稿', value: `${value.draftCount ?? 0} 张` },
    {
      key: 'processCount',
      label: '待审核',
      value: `${value.processCount ?? 0} 张`,
    },
    {
      key: 'approveCount',
      label: '已审核',
      value: `${value.approveCount ?? 0} 张`,
    },
    {
      key: 'transferPrice',
      label: '转账金额',
      value:
        value.transferPrice === null || value.transferPrice === undefined
          ? '****'
          : `￥${formatBankTransferAmount(value.transferPrice)}`,
    },
  ];
});

function getBankTransferStatusLabel(status?: number) {
  if (status === 0) return '草稿';
  if (status === 10) return '待审核';
  if (status === 20) return '已审核';
  return '-';
}

function getBankTransferStatusColor(status?: number) {
  if (status === 0) return 'blue';
  if (status === 10) return 'orange';
  if (status === 20) return 'green';
  return 'default';
}

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: false,
});

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

const [BatchEditFormModal, batchEditFormModalApi] = useVbenModal({
  connectedComponent: BatchEditModal,
  destroyOnClose: true,
});

const [PrintTemplateDesignModal, printTemplateDesignModalApi] = useVbenModal({
  connectedComponent: PrintTemplateModal,
  destroyOnClose: true,
});

function handleRefresh() {
  querySummaryState.invalidate();
  gridApi.query();
}

function openFinancePrintModal(data: {
  businessId?: number | string;
  businessNo?: string;
  moduleKey: string;
  moduleName: string;
  templateId?: number | string;
}) {
  printTemplateDesignModalApi.setData(data).open();
}

const {
  cancelTemplateSelect,
  confirmTemplate,
  openDesigner: handleOpenPrintTemplateDesigner,
  printRow: handlePrint,
  selectedTemplateId: selectedPrintTemplateId,
  selectorOpen: printTemplateSelectOpen,
  templateOptions: printTemplateOptions,
} = useErpPrintTemplate<ErpFinanceTransferApi.FinanceTransfer>({
  moduleKey: PRINT_TEMPLATE_MODULE,
  moduleName: PRINT_MODULE_NAME,
  openModal: openFinancePrintModal,
});

async function handleExport() {
  const selectedIds = (
    (gridApi.grid?.getCheckboxRecords?.() as
      | ErpFinanceTransferApi.FinanceTransfer[]
      | undefined) ?? []
  )
    .map((item) => item.id!)
    .filter((id) => id !== undefined);
  const formValues = (await gridApi.formApi?.getValues?.()) ?? {};
  pendingExportParams.value =
    selectedIds.length > 0
      ? { ids: selectedIds, ...buildSortParams() }
      : { ...formValues, ...buildSortParams() };
  exportFieldModalApi
    .setData({
      loadFields: getFinanceTransferExportFields,
      moduleKey: 'erp_finance_transfer',
    })
    .open();
}

async function handleExportConfirm(fields: string[]) {
  const data = await exportFinanceTransfer({
    ...pendingExportParams.value,
    fields: fields.join(','),
  });
  downloadFileFromBlobPart({ fileName: '银行转账.xls', source: data });
}

function handleCreate() {
  formModalApi.setData({ type: 'create' }).open();
}

useFinanceShortcut({
  onCreate: () => {
    if (hasAccessByCodes(['erp:finance-transfer:create'])) handleCreate();
  },
  onImport: () => {
    if (hasAccessByCodes(['erp:finance-transfer:import'])) handleImport();
  },
});

function handleImport() {
  importFormModalApi
    .setData({
      failureDownload: {
        fileName: '银行转账错误数据.xls',
        request: downloadFinanceTransferImportFailureDetails,
      },
      importRequest: importFinanceTransfer,
      templateFileName: '银行转账导入模板.xls',
      templateRequest: getFinanceTransferImportTemplate,
      title: '导入银行转账',
    })
    .open();
}

function handleBatchEdit() {
  const editableIds = checkedRows.value
    .filter((item) => item.status !== 20)
    .map((item) => item.id!)
    .filter(Boolean);
  if (editableIds.length === 0) {
    message.warning('已审核数据禁止批量修改');
    return;
  }
  if (editableIds.length < checkedRows.value.length) {
    message.warning('已跳过不能修改的数据');
  }
  batchEditFormModalApi
    .setData({
      ids: editableIds,
      title: '批量修改银行转账',
      updateRequest: batchUpdateFinanceTransfer,
      fields: [
        {
          field: 'remark',
          label: '备注',
          component: 'textarea',
        },
        {
          field: 'fileUrl',
          label: '附件 URL',
          component: 'input',
        },
      ],
    })
    .open();
}

function handleEdit(row: ErpFinanceTransferApi.FinanceTransfer) {
  formModalApi.setData({ type: 'edit', id: row.id }).open();
}

function handleDetail(row: ErpFinanceTransferApi.FinanceTransfer) {
  formModalApi.setData({ type: 'detail', id: row.id }).open();
}

function handleCopy(row: ErpFinanceTransferApi.FinanceTransfer) {
  formModalApi.setData({ type: 'copy', id: row.id }).open();
}

async function handleDelete(ids: number[], skippedCount = 0) {
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting'),
    duration: 0,
  });
  try {
    await deleteFinanceTransfer(ids);
    if (skippedCount > 0) {
      message.success(`已删除 ${ids.length} 条，已跳过 ${skippedCount} 条`);
    } else {
      message.success($t('ui.actionMessage.deleteSuccess'));
    }
    const pager = gridApi.grid?.getProxyInfo?.()?.pager;
    if (pager && ids.length >= rows.value.length && pager.currentPage > 1) {
      await gridApi.grid?.setCurrentPage?.(pager.currentPage - 1);
    }
    checkedRows.value = [];
    gridApi.grid?.clearCheckboxRow?.();
    gridApi.grid?.clearCheckboxReserve?.();
    await gridApi.query();
  } finally {
    hideLoading();
  }
}

async function handleApprove(row: ErpFinanceTransferApi.FinanceTransfer) {
  const hideLoading = message.loading({
    content: `审核 ${row.no} 中`,
    duration: 0,
  });
  try {
    await updateFinanceTransferStatus(row.id!, 20);
    message.success('审核成功');
    handleRefresh();
  } finally {
    hideLoading();
  }
}

async function handleDetailAudit(row: ErpFinanceTransferApi.FinanceTransfer) {
  await handleApprove(row);
  await formModalApi.close();
}

function handleRowCheckboxChange({
  records,
}: {
  records: ErpFinanceTransferApi.FinanceTransfer[];
}) {
  checkedRows.value = records;
}

async function handleBatchDelete() {
  const deletableIds = checkedRows.value
    .filter((item) => item.status !== 20)
    .map((item) => item.id!)
    .filter(Boolean);
  const skippedCount = checkedRows.value.length - deletableIds.length;
  if (deletableIds.length === 0) {
    message.warning('当前勾选数据没有可删除项');
    return;
  }
  await handleDelete(deletableIds, skippedCount);
}

const transferSortFieldMap = {
  auditTime: 'updateTime',
  auditorName: 'updater',
  no: 'no',
  transferTime: 'transferTime',
  outAccountName: 'outAccountId',
  inAccountName: 'inAccountId',
  transferPrice: 'transferPrice',
  financeUserName: 'financeUserId',
  status: 'status',
  remark: 'remark',
};
const { buildSortParams, handleSortChange, restoreSortState } =
  createVxeHeaderSort(transferSortFieldMap);

function handleSearchEnter(event: KeyboardEvent) {
  if (event.isComposing) return;
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (target.closest('.ant-picker, .ant-select')) return;
  event.preventDefault();
  event.stopPropagation();
  void gridApi.formApi.submitForm();
}

function buildGridColumns(
  currentRows: ErpFinanceTransferApi.FinanceTransfer[] = rows.value,
) {
  return fitFinanceDocumentListColumnsToWidth(
    (useGridColumns(currentRows) || [])
      .filter((column: any) => {
        if (!column.field) return true;
        const permissionField =
          column.field === 'outAccountName'
            ? 'outAccountId'
            : column.field === 'inAccountName'
              ? 'inAccountId'
              : column.field;
        return !isFieldHidden(hiddenFields.value, permissionField);
      })
      .map((column) =>
        column.field && column.field in transferSortFieldMap
          ? { ...column, sortable: true }
          : column,
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
    id: 'erp-finance-cash-bank-transfer-list-v2',
    keepSource: true,
    showHeaderOverflow: 'tooltip',
    showOverflow: 'tooltip',
    scrollX: {
      enabled: true,
      gt: 8,
    },
    proxyConfig: {
      ajax: {
        query: async ({ page, sort, sorts }, formValues) => {
          const summaryChanged = querySummaryState.prepare(formValues);
          let pageRequestFailed = false;
          const result = await getFinanceTransferPage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
            ...buildSortParams(sorts, sort),
          }).catch((error) => {
            pageRequestFailed = true;
            querySummaryState.cancelPending();
            if (rows.value.length > 0)
              return {
                list: rows.value,
                total:
                  gridApi.grid?.getProxyInfo?.()?.pager?.total ??
                  rows.value.length,
              };
            throw error;
          });
          rows.value = result.list || [];
          void gridApi.grid?.reloadColumn?.(buildGridColumns(rows.value));
          if (!pageRequestFailed)
            void querySummaryState.load(formValues, summaryChanged);
          return result;
        },
        querySuccess: () => {
          checkedRows.value = [];
          gridApi.grid?.clearCheckboxRow?.();
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
    },
    rowClassName: ({ row }) =>
      row.status === 0 ? 'bank-transfer-draft-row' : '',
    toolbarConfig: {
      custom: true,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<ErpFinanceTransferApi.FinanceTransfer>,
  gridEvents: {
    custom: handleGridColumnCustom,
    sortChange: handleSortChange,
    checkboxAll: handleRowCheckboxChange,
    checkboxChange: handleRowCheckboxChange,
  },
});

const { activationRefreshMaskVisible } =
  useVxeActivationRefresh<ErpFinanceTransferApi.FinanceTransfer>({
    gridApi,
    errorMessage: 'Error occurred while refreshing bank transfer page:',
    getParams: async () => ({
      ...(await gridApi.formApi.getValues()),
      ...buildSortParams(),
    }),
    queryPage: async (params) => {
      querySummaryState.invalidate();
      const result = await getFinanceTransferPage(params);
      void querySummaryState.load(params, true);
      return result;
    },
    onSuccess: (activatedRows) => {
      rows.value = activatedRows;
      void gridApi.grid?.reloadColumn?.(buildGridColumns(activatedRows));
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
    <FormModal @success="handleRefresh" @audit="handleDetailAudit" />
    <ImportFormModal @success="handleRefresh" />
    <ExportFieldModal @confirm="handleExportConfirm" />
    <BatchEditFormModal @success="handleRefresh" />
    <PrintTemplateDesignModal @printed="handleRefresh" />
    <PrintTemplateSelector
      v-model:open="printTemplateSelectOpen"
      v-model:selected-id="selectedPrintTemplateId"
      :templates="printTemplateOptions"
      @cancel="cancelTemplateSelect"
      @confirm="confirmTemplate"
    />
    <div ref="gridShellRef" class="bank-transfer-grid-shell">
      <Alert
        class="mb-2"
        type="info"
        show-icon
        message="银行转账本金只作为账户间资金流转展示，不计入收入或费用。"
        description="跨日转出确认、到账确认、转账在途资金属于后续账户资金正式改造；手续费需要独立记录并归实际承担部门；当前页面沿用现有审核状态和账户流水展示。"
      />
      <Grid
        class="bank-transfer-grid"
        table-title="银行转账列表"
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
                auth: ['erp:finance-transfer:create'],
                onClick: handleCreate,
              },
              {
                label: '导入',
                type: 'primary',
                icon: ACTION_ICON.UPLOAD,
                tooltip: 'I 导入',
                title: 'I 导入',
                auth: ['erp:finance-transfer:import'],
                onClick: handleImport,
              },
              {
                label: $t('ui.actionTitle.export'),
                type: 'primary',
                icon: ACTION_ICON.DOWNLOAD,
                auth: ['erp:finance-transfer:export'],
                onClick: handleExport,
              },
              {
                label: '打印模板',
                type: 'primary',
                icon: ACTION_ICON.EDIT,
                auth: ['erp:finance-transfer:print-template'],
                onClick: handleOpenPrintTemplateDesigner,
              },
              {
                label: '批量修改',
                type: 'primary',
                icon: ACTION_ICON.EDIT,
                ifShow: () => checkedRows.some((item) => item.status !== 20),
                auth: ['erp:finance-transfer:update'],
                onClick: handleBatchEdit,
              },
              {
                label: '批量删除',
                type: 'primary',
                danger: true,
                icon: ACTION_ICON.DELETE,
                ifShow: () => checkedRows.length > 0,
                auth: ['erp:finance-transfer:delete'],
                popConfirm: {
                  title: '是否删除选中的银行转账单？不可删除数据将自动跳过',
                  confirm: handleBatchDelete,
                },
              },
            ]"
          />
        </template>
        <template #printAction="{ row }">
          <TableAction
            :actions="[
              {
                label: '打印',
                type: 'link',
                auth: ['erp:finance-transfer:print'],
                onClick: handlePrint.bind(null, row),
              },
            ]"
          />
        </template>
        <template #deleteAction="{ row }">
          <TableAction
            :actions="[
              {
                label: '删除',
                type: 'link',
                danger: true,
                auth: ['erp:finance-transfer:delete'],
                ifShow: () => row.status !== 20,
                popConfirm: {
                  title: $t('ui.actionMessage.deleteConfirm', [row.no]),
                  confirm: handleDelete.bind(null, [row.id!]),
                },
              },
            ]"
          />
        </template>
        <template #bankTransferNo="{ row }">
          <button
            class="bank-transfer-grid__document-link"
            type="button"
            @click.stop="handleDetail(row)"
          >
            {{ row.no || '-' }}
          </button>
        </template>
        <template #status="{ row }">
          <Tag
            :color="getBankTransferStatusColor(row.status)"
            class="m-0"
            :title="
              row.status === 0
                ? '草稿：关闭新增或草稿编辑页面时自动保存，尚未正式提交'
                : undefined
            "
          >
            {{ getBankTransferStatusLabel(row.status) }}
          </Tag>
        </template>
        <template #actions="{ row }">
          <TableAction
            :actions="[
              {
                label: row.status === 0 ? '编辑草稿' : $t('common.edit'),
                type: 'link',
                icon: ACTION_ICON.EDIT,
                auth: ['erp:finance-transfer:update'],
                ifShow: () => row.status !== 20,
                onClick: handleEdit.bind(null, row),
              },
              {
                label: '复制',
                type: 'link',
                icon: ACTION_ICON.COPY,
                auth: ['erp:finance-transfer:create'],
                onClick: handleCopy.bind(null, row),
              },
              {
                label: '审核',
                type: 'link',
                icon: ACTION_ICON.AUDIT,
                auth: ['erp:finance-transfer:update-status'],
                ifShow: () => row.status === 10,
                popConfirm: {
                  title: `确认审核 ${row.no} 吗？`,
                  confirm: handleApprove.bind(null, row),
                },
              },
            ]"
          />
        </template>
        <template #bottom>
          <div class="bank-transfer-summary">
            <div class="bank-transfer-row-legend">
              <span
                class="bank-transfer-row-legend__swatch"
                aria-hidden="true"
              ></span>
              <span>浅蓝色行表示未正式提交的草稿</span>
            </div>
            <FinanceListQuerySummary
              :error="querySummaryState.error.value"
              :items="querySummaryItems"
              :loading="querySummaryState.loading.value"
              @retry="querySummaryState.retry"
            />
          </div>
        </template>
      </Grid>
      <ErpActivationRefreshMask
        v-if="activationRefreshMaskVisible"
        class="bank-transfer-activation-mask"
      />
    </div>
  </Page>
</template>

<style scoped>
.bank-transfer-grid-shell {
  position: relative;
  height: 100%;
  min-height: 100%;
}

:deep(.bank-transfer-grid .vxe-table--render-default),
:deep(.bank-transfer-grid .vxe-grid--form-wrapper) {
  font-size: 12px;
}

@media (min-width: 1280px) {
  :deep(.bank-transfer-grid .vxe-grid--form-wrapper form > .grid) {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}

:deep(.bank-transfer-grid .vxe-grid--form-wrapper .ant-form-item) {
  margin-bottom: 8px;
}

:deep(.bank-transfer-grid .vxe-grid--form-wrapper label),
:deep(.bank-transfer-grid .vxe-grid--form-wrapper .ant-input),
:deep(.bank-transfer-grid .vxe-grid--form-wrapper .ant-picker),
:deep(.bank-transfer-grid .vxe-grid--form-wrapper .ant-picker-input > input),
:deep(.bank-transfer-grid .vxe-grid--form-wrapper .ant-select),
:deep(.bank-transfer-grid .vxe-grid--form-wrapper .ant-btn),
:deep(.bank-transfer-grid .vxe-grid--form-wrapper .vben-link) {
  font-size: 12px;
}

:deep(.bank-transfer-grid .vxe-grid--form-wrapper .ant-input-affix-wrapper) {
  min-height: 28px;
  padding: 2px 8px;
}

:deep(.bank-transfer-grid .vxe-grid--form-wrapper .ant-select-single),
:deep(.bank-transfer-grid .vxe-grid--form-wrapper .ant-picker) {
  height: 28px;
}

:deep(
  .bank-transfer-grid
    .vxe-grid--form-wrapper
    .ant-select-single
    .ant-select-selector
) {
  height: 28px;
  padding: 0 8px;
}

:deep(
  .bank-transfer-grid
    .vxe-grid--form-wrapper
    .ant-select-single
    .ant-select-selection-item
),
:deep(
  .bank-transfer-grid
    .vxe-grid--form-wrapper
    .ant-select-single
    .ant-select-selection-placeholder
) {
  line-height: 26px;
}

:global(.bank-transfer-search-select-dropdown .ant-select-item),
:global(.bank-transfer-search-select-dropdown .ant-empty-description) {
  font-size: 12px;
}

:deep(.bank-transfer-grid .vxe-grid--form-wrapper .ant-btn),
:deep(.bank-transfer-grid .vxe-toolbar .table-actions .ant-btn) {
  height: 28px;
  padding: 2px 10px;
  font-size: 12px;
  line-height: 20px;
}

:deep(.bank-transfer-grid .vxe-toolbar .vxe-button) {
  box-sizing: border-box;
  width: 28px !important;
  min-width: 28px !important;
  height: 28px;
  padding: 0;
  font-size: 12px;
}

:deep(.bank-transfer-grid .vxe-header--column) {
  height: 34px;
  font-size: 12px;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
}

:deep(.bank-transfer-grid .vxe-header--column .vxe-cell--title) {
  white-space: nowrap;
}

:deep(.bank-transfer-grid .vxe-header--column.is--sortable .vxe-cell--title) {
  color: hsl(var(--primary));
}

:deep(.bank-transfer-grid .vxe-header--column .vxe-cell--sort) {
  display: none;
}

:deep(.bank-transfer-grid .vxe-body--column) {
  height: 36px;
  font-size: 12px;
  line-height: 20px;
}

:deep(.bank-transfer-grid .bank-transfer-amount-cell) {
  font-weight: 500;
  font-variant-numeric: tabular-nums;
}

:deep(
  .bank-transfer-grid .bank-transfer-amount-cell--primary .vxe-cell--label
) {
  font-weight: 700;
  color: hsl(var(--primary));
}

:deep(.bank-transfer-grid .vxe-body--column .table-actions .ant-btn-link) {
  height: auto;
  padding: 0;
  font-size: 12px;
}

.bank-transfer-grid__document-link {
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

.bank-transfer-grid__document-link:hover,
.bank-transfer-grid__document-link:focus-visible {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.bank-transfer-grid__document-link:focus-visible {
  outline: 2px solid hsl(var(--primary));
  outline-offset: 2px;
  border-radius: 3px;
}

:deep(.bank-transfer-grid .bank-transfer-draft-row .vxe-body--column) {
  background-color: hsl(var(--primary) / 7%) !important;
}

:deep(
  .bank-transfer-grid .bank-transfer-draft-row.row--hover .vxe-body--column
) {
  background-color: hsl(var(--primary) / 13%) !important;
}

:deep(.bank-transfer-grid .vxe-grid--bottom-wrapper) {
  position: sticky;
  bottom: 36px;
  z-index: 4;
  background: hsl(var(--card));
}

:deep(.bank-transfer-grid .vxe-grid--pager-wrapper) {
  position: sticky;
  bottom: 0;
  z-index: 5;
  margin-top: 0 !important;
  background: hsl(var(--card));
  box-shadow: 0 -2px 8px rgb(0 0 0 / 8%);
}

.bank-transfer-summary {
  display: flex;
  align-items: stretch;
  min-height: 52px;
  background: hsl(var(--card));
  border-top: 1px solid hsl(var(--border));
}

.bank-transfer-row-legend {
  display: flex;
  gap: 8px;
  align-items: center;
  min-width: 250px;
  padding: 6px 16px;
  font-size: 11px;
  color: hsl(var(--muted-foreground));
}

.bank-transfer-row-legend__swatch {
  flex: 0 0 auto;
  width: 22px;
  height: 12px;
  background: hsl(var(--primary) / 10%);
  border: 1px solid hsl(var(--primary) / 25%);
  border-radius: 3px;
}

.bank-transfer-summary__identity,
.bank-transfer-summary__metric {
  display: flex;
  flex-direction: column;
  justify-content: center;
  min-width: 132px;
  padding: 6px 16px;
}

.bank-transfer-summary__identity {
  min-width: 180px;
  margin-right: auto;
  border-left: 3px solid hsl(var(--primary));
}

.bank-transfer-summary__eyebrow,
.bank-transfer-summary__metric > span {
  font-size: 11px;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
  letter-spacing: 0.06em;
}

.bank-transfer-summary__identity strong {
  margin-top: 2px;
  font-size: 12px;
}

.bank-transfer-summary__metric {
  text-align: right;
  border-left: 1px solid hsl(var(--border));
}

.bank-transfer-summary__metric b {
  margin-top: 2px;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  color: hsl(var(--foreground));
}

.bank-transfer-summary__metric--amount {
  min-width: 184px;
}

.bank-transfer-summary__metric--amount b {
  color: hsl(var(--primary));
}

@media (max-width: 900px) {
  .bank-transfer-summary {
    flex-wrap: wrap;
  }

  .bank-transfer-summary__identity {
    width: 100%;
    min-height: 40px;
    border-bottom: 1px solid hsl(var(--border));
  }

  .bank-transfer-row-legend {
    width: 100%;
    min-height: 36px;
    border-bottom: 1px solid hsl(var(--border));
  }

  .bank-transfer-summary__metric {
    flex: 1 1 33.333%;
    min-width: 0;
    padding: 6px 10px;
  }

  :deep(.bank-transfer-grid .vxe-grid--bottom-wrapper) {
    bottom: 40px;
  }
}

@media (max-width: 640px) {
  .bank-transfer-summary__metric {
    flex-basis: 100%;
    flex-direction: row;
    justify-content: space-between;
    text-align: left;
    border-top: 1px solid hsl(var(--border));
  }
}
</style>
