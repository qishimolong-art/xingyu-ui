<script lang="ts" setup>
import { provideFinanceCandidateFocus } from '#/views/erp/finance/utils/candidate-focus';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpPayableExpenseApi } from '#/api/erp/finance/payable/expense';

import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import { useAccess } from '@vben/access';
import { Page, useVbenModal } from '@vben/common-ui';
import { downloadFileFromBlobPart } from '@vben/utils';

import { message } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  batchUpdatePayableExpense,
  deletePayableExpense,
  downloadPayableExpenseImportFailureDetails,
  exportPayableExpense,
  getPayableExpenseExportFields,
  getPayableExpenseImportTemplate,
  getPayableExpensePage,
  getPayableExpenseSummary,
  importPayableExpense,
  updatePayableExpenseStatus,
} from '#/api/erp/finance/payable/expense';
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
import {
  formatPayableExpenseAmount,
  normalizePayableExpenseListRow,
} from './ui';
const { candidateSchema, candidatePagerConfig } =
  provideFinanceCandidateFocus();

defineOptions({ name: 'ErpPayableExpense' });

const PRINT_TEMPLATE_MODULE = 'payable_expense';
const rows = ref<ErpPayableExpenseApi.PayableExpense[]>([]);
const checkedIds = ref<number[]>([]);
const checkedRows = ref<ErpPayableExpenseApi.PayableExpense[]>([]);
const gridShellRef = ref<HTMLElement>();
const { hasAccessByCodes } = useAccess();

const querySummaryState = useFinanceQuerySummary((params, signal) =>
  getPayableExpenseSummary(params, signal),
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
    {
      key: 'totalAmount',
      label: '总金额',
      value:
        value.totalAmount === null || value.totalAmount === undefined
          ? '****'
          : `￥${formatPayableExpenseAmount(value.totalAmount)}`,
    },
  ];
});

function isDraftRow(row: Pick<ErpPayableExpenseApi.PayableExpense, 'status'>) {
  return Number(row.status) === 0;
}

function isPendingRow(
  row: Pick<ErpPayableExpenseApi.PayableExpense, 'status'>,
) {
  return Number(row.status) === 10;
}

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

const [ImportFormModal, importFormModalApi] = useVbenModal({
  connectedComponent: ImportModal,
  destroyOnClose: true,
});
const [ExportFieldModal, exportFieldModalApi] = useVbenModal({
  connectedComponent: ExportFieldModalComponent,
  destroyOnClose: true,
});

const [BatchEditFormModal, batchEditFormModalApi] = useVbenModal({
  connectedComponent: BatchEditModal,
  destroyOnClose: true,
});
const [PrintTemplateDesignModal, printTemplateDesignModalApi] = useVbenModal({
  connectedComponent: PrintTemplateModal,
  destroyOnClose: true,
});

async function handleRefresh(resetToFirstPage = false) {
  querySummaryState.invalidate();
  const proxyInfo = gridApi.grid?.getProxyInfo?.();
  if (
    resetToFirstPage &&
    proxyInfo?.pager?.currentPage !== undefined &&
    proxyInfo.pager.currentPage !== 1
  ) {
    await gridApi.grid.commitProxy('page', { currentPage: 1 });
    return;
  }
  await gridApi.query();
}

const pendingExportParams = ref<Record<string, any>>({});

async function handleExport() {
  const selectedIds = (
    (gridApi.grid?.getCheckboxRecords?.() as
      | ErpPayableExpenseApi.PayableExpense[]
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
      loadFields: getPayableExpenseExportFields,
      moduleKey: 'erp_finance_payable_expense',
    })
    .open();
}

async function handleExportConfirm(fields: string[]) {
  const data = await exportPayableExpense({
    ...pendingExportParams.value,
    fields: fields.join(','),
  });
  downloadFileFromBlobPart({ fileName: '费用支付.xls', source: data });
}

function handleCreate() {
  formModalApi.setData({ type: 'create' }).open();
}

useFinanceShortcut({
  onCreate: () => {
    if (hasAccessByCodes(['erp:payable-expense:create'])) handleCreate();
  },
  onImport: () => {
    if (hasAccessByCodes(['erp:payable-expense:import'])) handleImport();
  },
});

function handleImport() {
  importFormModalApi
    .setData({
      failureDownload: {
        fileName: '费用支付错误数据.xls',
        request: downloadPayableExpenseImportFailureDetails,
      },
      importRequest: importPayableExpense,
      templateFileName: '费用支付导入模板.xls',
      templateRequest: getPayableExpenseImportTemplate,
      title: '导入费用支付',
    })
    .open();
}

async function handleImportSuccess() {
  await handleRefresh(true);
}

function handleBatchEdit() {
  const editableIds = checkedRows.value
    .filter((row) => isPendingRow(row))
    .map((item) => item.id!)
    .filter(Boolean);
  if (editableIds.length === 0) {
    message.warning('只有正式提交且未审核的单据可以批量修改');
    return;
  }
  if (editableIds.length < checkedRows.value.length) {
    message.warning('已跳过草稿和已审核单据');
  }
  batchEditFormModalApi
    .setData({
      ids: editableIds,
      title: '批量修改费用支付',
      updateRequest: batchUpdatePayableExpense,
      fields: [
        { field: 'settleMethod', label: '结算方式', component: 'input' },
        { field: 'voucherNo', label: '凭证号', component: 'input' },
        { field: 'expenseType', label: '支出类型', component: 'input' },
        { field: 'party', label: '对象', component: 'input' },
        { field: 'docType', label: '单据类型', component: 'input' },
        { field: 'relatedBiz', label: '相关业务', component: 'input' },
        { field: 'remark', label: '备注', component: 'textarea' },
        { field: 'fileUrl', label: '附件 URL', component: 'input' },
      ],
    })
    .open();
}

function handleEdit(row: ErpPayableExpenseApi.PayableExpense) {
  formModalApi.setData({ type: 'edit', id: row.id }).open();
}

function handleDetail(row: ErpPayableExpenseApi.PayableExpense) {
  formModalApi.setData({ type: 'detail', id: row.id }).open();
}

function handleCopy(row: ErpPayableExpenseApi.PayableExpense) {
  formModalApi.setData({ type: 'copy', id: row.id }).open();
}

function openPayableExpensePrintModal(data: {
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
} = useErpPrintTemplate<ErpPayableExpenseApi.PayableExpense>({
  moduleKey: PRINT_TEMPLATE_MODULE,
  moduleName: '费用支付',
  openModal: openPayableExpensePrintModal,
});

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

async function handleDelete(ids: number[], skippedCount = 0) {
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting'),
    duration: 0,
  });
  try {
    await deletePayableExpense(ids);
    if (skippedCount > 0) {
      message.success(`已删除 ${ids.length} 条，已跳过 ${skippedCount} 条`);
    } else {
      message.success($t('ui.actionMessage.deleteSuccess'));
    }
    checkedIds.value = [];
    checkedRows.value = [];
    await handleRefresh();
  } finally {
    hideLoading();
  }
}

async function handleBatchDeleteChecked() {
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

async function handleAudit(row: ErpPayableExpenseApi.PayableExpense) {
  const hideLoading = message.loading({ content: '审核中...', duration: 0 });
  try {
    await updatePayableExpenseStatus(row.id as number, 20);
    message.success('审核成功');
    await handleRefresh();
  } finally {
    hideLoading();
  }
}

async function handleDetailAudit(row: ErpPayableExpenseApi.PayableExpense) {
  await handleAudit(row);
  await formModalApi.close();
}

function handleRowCheckboxChange({
  records,
}: {
  records: ErpPayableExpenseApi.PayableExpense[];
}) {
  checkedIds.value = records.map((item) => item.id!).filter(Boolean);
  checkedRows.value = records;
}

const expenseSortFieldMap = {
  no: 'no',
  bizTime: 'bizTime',
  expenseBizType: 'expenseBizType',
  expenseType: 'expenseType',
  totalAmount: 'totalAmount',
  accountName: 'accountId',
  status: 'status',
  handlerName: 'handlerId',
  party: 'party',
  auditTime: 'updateTime',
  remark: 'remark',
  creatorName: 'creator',
  relatedBiz: 'relatedBiz',
  deptName: 'deptId',
  auditorName: 'updater',
};
const { buildSortParams, handleSortChange, restoreSortState } =
  createVxeHeaderSort(expenseSortFieldMap);

function buildGridColumns(
  currentRows: ErpPayableExpenseApi.PayableExpense[] = rows.value,
) {
  return fitFinanceDocumentListColumnsToWidth(
    (useGridColumns(currentRows) || []).map((column) =>
      column.field && column.field in expenseSortFieldMap
        ? { ...column, sortable: true }
        : column,
    ),
    gridShellRef.value?.clientWidth ?? 0,
  );
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
    id: 'erp-finance-payable-expense-list-v2',
    keepSource: true,
    showHeaderOverflow: 'tooltip',
    showOverflow: 'tooltip',
    scrollX: { enabled: true, gt: 8 },
    proxyConfig: {
      ajax: {
        query: async ({ page, sort, sorts }, formValues) => {
          const summaryChanged = querySummaryState.prepare(formValues);
          let pageRequestFailed = false;
          const result = await getPayableExpensePage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            includeItems: false,
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
          result.list = (result.list || []).map((row) =>
            normalizePayableExpenseListRow(row),
          );
          rows.value = result.list;
          void gridApi.grid?.reloadColumn?.(buildGridColumns(rows.value));
          if (!pageRequestFailed)
            void querySummaryState.load(formValues, summaryChanged);
          return result;
        },
        querySuccess: () => {
          checkedIds.value = [];
          checkedRows.value = [];
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
    rowClassName: ({ row }: { row: ErpPayableExpenseApi.PayableExpense }) =>
      isDraftRow(row) ? 'payable-expense-draft-row' : '',
    toolbarConfig: { custom: true, refresh: true, search: true, zoom: true },
  } as VxeTableGridOptions<ErpPayableExpenseApi.PayableExpense>,
  gridEvents: {
    sortChange: handleSortChange,
    checkboxAll: handleRowCheckboxChange,
    checkboxChange: handleRowCheckboxChange,
  },
});

const { activationRefreshMaskVisible } =
  useVxeActivationRefresh<ErpPayableExpenseApi.PayableExpense>({
    gridApi,
    errorMessage: 'Error occurred while refreshing payable expense page:',
    getParams: async () => ({
      ...(await gridApi.formApi.getValues()),
      ...buildSortParams(),
      includeItems: false,
    }),
    queryPage: async (params) => {
      querySummaryState.invalidate();
      const result = await getPayableExpensePage({
        ...params,
        includeItems: false,
      });
      const list = (result.list || []).map((row) =>
        normalizePayableExpenseListRow(row),
      );
      void querySummaryState.load(params, true);
      return { ...result, list };
    },
    onSuccess: (activatedRows) => {
      rows.value = activatedRows;
      checkedIds.value = [];
      checkedRows.value = [];
      gridApi.grid?.clearCheckboxRow?.();
      gridApi.grid?.clearCheckboxReserve?.();
      void restoreSortState(gridApi);
    },
  });

function handleGridResize() {
  void gridApi.grid?.reloadColumn?.(buildGridColumns(rows.value));
}

onMounted(() => window.addEventListener('resize', handleGridResize));
onBeforeUnmount(() => window.removeEventListener('resize', handleGridResize));
</script>

<template>
  <Page auto-content-height>
    <FormModal @success="handleRefresh(true)" @audit="handleDetailAudit" />
    <ImportFormModal @success="handleImportSuccess" />
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
    <div ref="gridShellRef" class="payable-expense-grid-shell">
      <Grid
        class="payable-expense-grid"
        table-title="费用支付列表"
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
                auth: ['erp:payable-expense:create'],
                onClick: handleCreate,
              },
              {
                label: '导入',
                type: 'primary',
                icon: ACTION_ICON.UPLOAD,
                tooltip: 'I 导入',
                title: 'I 导入',
                auth: ['erp:payable-expense:import'],
                onClick: handleImport,
              },
              {
                label: $t('ui.actionTitle.export'),
                type: 'primary',
                icon: ACTION_ICON.DOWNLOAD,
                auth: ['erp:payable-expense:export'],
                onClick: handleExport,
              },
              {
                label: '打印模板',
                type: 'primary',
                icon: ACTION_ICON.EDIT,
                auth: ['erp:payable-expense:print-template'],
                onClick: handleOpenPrintTemplateDesigner,
              },
              {
                label: '批量修改',
                type: 'primary',
                icon: ACTION_ICON.EDIT,
                ifShow: () => checkedRows.some(isPendingRow),
                auth: ['erp:payable-expense:update'],
                onClick: handleBatchEdit,
              },
              {
                label: '批量删除',
                type: 'primary',
                danger: true,
                icon: ACTION_ICON.DELETE,
                ifShow: () => checkedRows.length > 0,
                auth: ['erp:payable-expense:delete'],
                popConfirm: {
                  title: '确认删除选中的费用支付单据？不可删除数据将自动跳过',
                  confirm: handleBatchDeleteChecked,
                },
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
                auth: ['erp:payable-expense:delete'],
                ifShow: () => isDraftRow(row) || isPendingRow(row),
                popConfirm: {
                  title: $t('ui.actionMessage.deleteConfirm', [row.no]),
                  confirm: handleDelete.bind(null, [row.id!]),
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
                auth: ['erp:payable-expense:print'],
                onClick: handlePrint.bind(null, row),
              },
            ]"
          />
        </template>
        <template #no="{ row }">
          <button
            class="payable-expense-grid__document-link"
            type="button"
            @click.stop="handleDetail(row)"
          >
            {{ row.no || '-' }}
          </button>
        </template>
        <template #status="{ row }">
          <span
            class="payable-expense-grid__status"
            :class="`is-status-${row.status}`"
            :title="
              isDraftRow(row)
                ? '草稿：页面关闭时自动保存，尚未正式提交'
                : undefined
            "
          >
            {{
              isDraftRow(row)
                ? '草稿'
                : isPendingRow(row)
                  ? '未审核'
                  : Number(row.status) === 20
                    ? '已审核'
                    : '未知'
            }}
          </span>
        </template>
        <template #actions="{ row }">
          <TableAction
            :actions="[
              {
                label: isDraftRow(row) ? '编辑草稿' : $t('common.edit'),
                type: 'link',
                icon: ACTION_ICON.EDIT,
                auth: ['erp:payable-expense:update'],
                ifShow: () => isDraftRow(row) || isPendingRow(row),
                onClick: handleEdit.bind(null, row),
              },
              {
                label: '复制',
                type: 'link',
                icon: ACTION_ICON.COPY,
                auth: ['erp:payable-expense:create'],
                onClick: handleCopy.bind(null, row),
              },
              {
                label: '审核',
                type: 'link',
                icon: ACTION_ICON.AUDIT,
                auth: ['erp:payable-expense:update-status'],
                ifShow: () => isPendingRow(row),
                popConfirm: {
                  title: `确认审核费用支付单 ${row.no} 吗？`,
                  confirm: handleAudit.bind(null, row),
                },
              },
            ]"
          />
        </template>
        <template #bottom>
          <div class="payable-expense-summary">
            <div class="payable-expense-summary__draft-legend">
              <span aria-hidden="true"></span>
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
        class="payable-expense-activation-mask"
      />
    </div>
  </Page>
</template>

<style scoped>
.payable-expense-grid-shell {
  position: relative;
  height: 100%;
  min-height: 100%;
}

:deep(.payable-expense-grid .vxe-table--render-default),
:deep(.payable-expense-grid .vxe-grid--form-wrapper),
:deep(.payable-expense-grid .vxe-toolbar) {
  font-size: 12px;
}

@media (min-width: 1280px) {
  :deep(.payable-expense-grid .vxe-grid--form-wrapper form > .grid) {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}

:deep(.payable-expense-grid .vxe-grid--form-wrapper .ant-form-item) {
  margin-bottom: 8px;
}

:deep(.payable-expense-grid .vxe-grid--form-wrapper label),
:deep(.payable-expense-grid .vxe-grid--form-wrapper .ant-input),
:deep(.payable-expense-grid .vxe-grid--form-wrapper .ant-picker),
:deep(.payable-expense-grid .vxe-grid--form-wrapper .ant-picker-input > input),
:deep(.payable-expense-grid .vxe-grid--form-wrapper .ant-select),
:deep(.payable-expense-grid .vxe-grid--form-wrapper .ant-btn) {
  font-size: 12px;
}

:deep(.payable-expense-grid .vxe-grid--form-wrapper .ant-input-affix-wrapper) {
  min-height: 28px;
  padding: 2px 8px;
}

:deep(.payable-expense-grid .vxe-grid--form-wrapper .ant-select-single),
:deep(
  .payable-expense-grid
    .vxe-grid--form-wrapper
    .ant-select-single
    .ant-select-selector
),
:deep(.payable-expense-grid .vxe-grid--form-wrapper .ant-picker) {
  height: 28px;
  min-height: 28px;
}

:deep(
  .payable-expense-grid
    .vxe-grid--form-wrapper
    .ant-select-single
    .ant-select-selection-item
),
:deep(
  .payable-expense-grid
    .vxe-grid--form-wrapper
    .ant-select-single
    .ant-select-selection-placeholder
) {
  line-height: 26px;
}

:deep(.payable-expense-grid .vxe-grid--form-wrapper .ant-picker) {
  padding: 2px 8px;
}

:deep(.payable-expense-grid .vxe-grid--form-wrapper .ant-btn),
:deep(.payable-expense-grid .vxe-toolbar .table-actions .ant-btn) {
  height: 28px;
  padding: 2px 10px;
  font-size: 12px;
}

:deep(.payable-expense-grid .vxe-toolbar .vxe-button) {
  box-sizing: border-box;
  width: 28px !important;
  min-width: 28px !important;
  height: 28px;
  padding: 0;
  font-size: 12px;
}

:deep(.payable-expense-grid .vxe-header--column) {
  height: 34px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  font-weight: 600;
}

:deep(.payable-expense-grid .vxe-header--column .vxe-cell--title) {
  white-space: nowrap;
}

:deep(.payable-expense-grid .vxe-header--column.is--sortable .vxe-cell--title) {
  color: #1677ff;
}

:deep(.payable-expense-grid .vxe-header--column .vxe-cell--sort) {
  display: none;
}

:deep(.payable-expense-grid .vxe-body--column) {
  height: 36px;
  font-size: 12px;
  line-height: 20px;
}

:deep(.payable-expense-grid .payable-expense-amount-cell) {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

:deep(.payable-expense-grid .vxe-body--column .table-actions .ant-btn-link) {
  height: auto;
  padding: 0;
  font-size: 12px;
}

.payable-expense-grid__document-link {
  max-width: 100%;
  overflow: hidden;
  padding: 0;
  border: 0;
  color: hsl(var(--primary));
  font: inherit;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: transparent;
  cursor: pointer;
}

.payable-expense-grid__document-link:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.payable-expense-grid__document-link:focus-visible {
  border-radius: 3px;
  outline: 2px solid hsl(var(--primary));
  outline-offset: 2px;
}

:deep(.payable-expense-grid .payable-expense-draft-row) {
  background-color: hsl(var(--primary) / 7%) !important;
}

:deep(.payable-expense-grid .payable-expense-draft-row .vxe-body--column) {
  background-color: hsl(var(--primary) / 7%) !important;
}

:deep(.payable-expense-grid .payable-expense-draft-row.row--hover) {
  background-color: hsl(var(--primary) / 13%) !important;
}

:deep(
  .payable-expense-grid .payable-expense-draft-row.row--hover .vxe-body--column
) {
  background-color: hsl(var(--primary) / 13%) !important;
}

.payable-expense-grid__status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  white-space: nowrap;
}

.payable-expense-grid__status::before {
  width: 6px;
  height: 6px;
  flex: 0 0 auto;
  border-radius: 50%;
  background: currentcolor;
  content: '';
}

.payable-expense-grid__status.is-status-0 {
  color: hsl(var(--primary));
  font-weight: 600;
}

.payable-expense-grid__status.is-status-10 {
  color: hsl(var(--warning));
}

.payable-expense-grid__status.is-status-20 {
  color: hsl(var(--success));
}

:deep(.payable-expense-grid .vxe-grid--bottom-wrapper) {
  position: sticky;
  z-index: 4;
  bottom: 36px;
  background: hsl(var(--card));
}

:deep(.payable-expense-grid .vxe-grid--pager-wrapper) {
  position: sticky;
  z-index: 5;
  bottom: 0;
  margin-top: 0 !important;
  background: hsl(var(--card));
  box-shadow: 0 -2px 8px rgb(0 0 0 / 8%);
}

.payable-expense-summary {
  display: flex;
  min-height: 44px;
  align-items: stretch;
  justify-content: flex-end;
  border-top: 1px solid hsl(var(--border));
  background: hsl(var(--card));
  font-size: 12px;
}

.payable-expense-summary__draft-legend {
  display: flex;
  min-width: 250px;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  border-left: 3px solid hsl(var(--primary));
  color: hsl(var(--muted-foreground));
  font-size: 11px;
}

.payable-expense-summary__draft-legend > span:first-child {
  width: 18px;
  height: 10px;
  border: 1px solid hsl(var(--primary) / 28%);
  border-radius: 2px;
  background: hsl(var(--primary) / 12%);
}

.payable-expense-summary__identity,
.payable-expense-summary__metric {
  display: flex;
  min-width: 160px;
  flex-direction: column;
  justify-content: center;
  padding: 6px 16px;
}

.payable-expense-summary__identity {
  margin-right: auto;
  border-left: 3px solid hsl(var(--primary));
}

.payable-expense-summary__identity span,
.payable-expense-summary__metric span {
  color: hsl(var(--muted-foreground));
  font-size: 11px;
}

.payable-expense-summary__metric {
  min-width: 210px;
  align-items: flex-end;
  border-left: 1px solid hsl(var(--border));
  background: hsl(var(--primary) / 6%);
}

.payable-expense-summary__identity strong,
.payable-expense-summary__metric b {
  margin-top: 1px;
  font-variant-numeric: tabular-nums;
}

.payable-expense-summary__metric b {
  color: hsl(var(--primary));
  font-size: 16px;
}

:global(.payable-expense-search-select-dropdown .ant-select-item),
:global(.payable-expense-search-select-dropdown .ant-empty-description) {
  font-size: 12px;
}

@media (max-width: 768px) {
  .payable-expense-summary {
    flex-wrap: wrap;
  }

  .payable-expense-summary__identity,
  .payable-expense-summary__metric {
    min-width: 50%;
    flex: 1 1 50%;
  }
}
</style>
