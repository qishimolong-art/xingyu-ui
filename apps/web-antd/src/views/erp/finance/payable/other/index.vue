<script lang="ts" setup>
import { provideFinanceCandidateFocus } from '#/views/erp/finance/utils/candidate-focus';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpPayableOtherApi } from '#/api/erp/finance/payable/other';

import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import { useAccess } from '@vben/access';
import { Page, useVbenModal } from '@vben/common-ui';
import { downloadFileFromBlobPart } from '@vben/utils';

import { message } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  batchUpdatePayableOther,
  deletePayableOther,
  downloadPayableOtherImportFailureDetails,
  exportPayableOther,
  getPayableOtherExportFields,
  getPayableOtherImportTemplate,
  getPayableOtherPage,
  getPayableOtherSummary,
  importPayableOther,
  updatePayableOtherStatus,
} from '#/api/erp/finance/payable/other';
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
import { formatOtherPayableAmount } from './ui';
const { candidateSchema, candidatePagerConfig } =
  provideFinanceCandidateFocus();

defineOptions({ name: 'ErpPayableOther' });

const PRINT_TEMPLATE_MODULE = 'payable_other';
const rows = ref<ErpPayableOtherApi.PayableOther[]>([]);
const checkedRows = ref<ErpPayableOtherApi.PayableOther[]>([]);
const gridShellRef = ref<HTMLElement>();
const { hasAccessByCodes } = useAccess();

const querySummaryState = useFinanceQuerySummary((params, signal) =>
  getPayableOtherSummary(params, signal),
);
const querySummaryItems = computed(() => {
  const value = querySummaryState.summary.value;
  if (!value) return [];
  const amount = (input?: null | number) =>
    input === null || input === undefined
      ? '****'
      : `￥${formatOtherPayableAmount(input)}`;
  return [
    {
      key: 'documentCount',
      label: '单据数',
      value: `${value.documentCount ?? 0} 张`,
    },
    {
      key: 'payableAmount',
      label: '应付金额',
      value: amount(value.payableAmount),
    },
    {
      key: 'settledAmount',
      label: '已结算金额',
      value: amount(value.settledAmount),
    },
    {
      key: 'outstandingAmount',
      label: '未结算金额',
      value: amount(value.outstandingAmount),
    },
  ];
});

function isDraftRow(row: Pick<ErpPayableOtherApi.PayableOther, 'status'>) {
  return Number(row.status) === 0;
}

function isPendingRow(row: Pick<ErpPayableOtherApi.PayableOther, 'status'>) {
  return Number(row.status) === 10;
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

const pendingExportParams = ref<Record<string, any>>({});

async function handleExport() {
  const selectedIds = (
    (gridApi.grid?.getCheckboxRecords?.() as
      | ErpPayableOtherApi.PayableOther[]
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
      loadFields: getPayableOtherExportFields,
      moduleKey: 'erp_finance_payable_other',
    })
    .open();
}

async function handleExportConfirm(fields: string[]) {
  const data = await exportPayableOther({
    ...pendingExportParams.value,
    fields: fields.join(','),
  });
  downloadFileFromBlobPart({ fileName: '应付调账.xls', source: data });
}

function handleCreate() {
  formModalApi.setData({ type: 'create' }).open();
}

useFinanceShortcut({
  onCreate: () => {
    if (hasAccessByCodes(['erp:payable-other:create'])) handleCreate();
  },
  onImport: () => {
    if (hasAccessByCodes(['erp:payable-other:import'])) handleImport();
  },
});

function handleImport() {
  importFormModalApi
    .setData({
      failureDownload: {
        fileName: '应付调账错误数据.xls',
        request: downloadPayableOtherImportFailureDetails,
      },
      importRequest: importPayableOther,
      templateFileName: '应付调账导入模板.xls',
      templateRequest: getPayableOtherImportTemplate,
      title: '导入应付调账',
    })
    .open();
}

function handleBatchEdit() {
  const editableIds = checkedRows.value
    .filter((item) => isPendingRow(item))
    .map((item) => item.id!)
    .filter(Boolean);
  if (editableIds.length === 0) {
    message.warning('只有待审核单据可以批量修改');
    return;
  }
  if (editableIds.length < checkedRows.value.length) {
    message.warning('已跳过草稿和已审核单据');
  }
  batchEditFormModalApi
    .setData({
      ids: editableIds,
      title: '批量修改应付调账',
      updateRequest: batchUpdatePayableOther,
      fields: [
        { field: 'voucherNo', label: '凭证号', component: 'input' },
        { field: 'project', label: '费用项目', component: 'input' },
        { field: 'sourceType', label: '来源类型', component: 'input' },
        { field: 'remark', label: '调整原因/备注', component: 'textarea' },
        { field: 'fileUrl', label: '附件 URL', component: 'input' },
      ],
    })
    .open();
}

function handleEdit(row: ErpPayableOtherApi.PayableOther) {
  formModalApi.setData({ type: 'edit', id: row.id }).open();
}

function handleDetail(row: ErpPayableOtherApi.PayableOther) {
  formModalApi.setData({ type: 'detail', id: row.id }).open();
}

function handleCopy(row: ErpPayableOtherApi.PayableOther) {
  formModalApi.setData({ type: 'copy', id: row.id }).open();
}

function openOtherPayablePrintModal(data: {
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
} = useErpPrintTemplate<ErpPayableOtherApi.PayableOther>({
  moduleKey: PRINT_TEMPLATE_MODULE,
  moduleName: '应付调账',
  openModal: openOtherPayablePrintModal,
});

async function handleDelete(row: ErpPayableOtherApi.PayableOther) {
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting', [row.no]),
    duration: 0,
  });
  try {
    await deletePayableOther(row.id as number);
    message.success($t('ui.actionMessage.deleteSuccess', [row.no]));
    handleRefresh();
  } finally {
    hideLoading();
  }
}

async function handleBatchDelete(ids: number[], skippedCount = 0) {
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting'),
    duration: 0,
  });
  try {
    await Promise.all(ids.map((id) => deletePayableOther(id)));
    if (skippedCount > 0) {
      message.success(`已删除 ${ids.length} 条，已跳过 ${skippedCount} 条`);
    } else {
      message.success($t('ui.actionMessage.deleteSuccess'));
    }
    checkedRows.value = [];
    handleRefresh();
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
  await handleBatchDelete(deletableIds, skippedCount);
}

async function handleAudit(row: ErpPayableOtherApi.PayableOther) {
  await updatePayableOtherStatus(row.id as number, 20);
  message.success('审核成功');
  handleRefresh();
}

async function handleDetailAudit(row: ErpPayableOtherApi.PayableOther) {
  await handleAudit(row);
  await formModalApi.close();
}

const otherPayableSortFieldMap = {
  auditTime: 'updateTime',
  auditorName: 'updater',
  bizTime: 'bizTime',
  createTime: 'createTime',
  creatorName: 'creator',
  handlerName: 'handlerId',
  increasePayableAmount: 'payableAmount',
  no: 'no',
  payableAmount: 'payableAmount',
  remark: 'remark',
  settledAmount: 'settledAmount',
  sourceType: 'sourceType',
  status: 'status',
  supplierName: 'supplierId',
  voucherNo: 'voucherNo',
};
const { buildSortParams, handleSortChange, restoreSortState } =
  createVxeHeaderSort(otherPayableSortFieldMap);

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
  currentRows: ErpPayableOtherApi.PayableOther[] = rows.value,
) {
  return fitFinanceDocumentListColumnsToWidth(
    (useGridColumns(currentRows) || []).map((column) =>
      column.field && column.field in otherPayableSortFieldMap
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
    id: 'erp-finance-payable-other-list-v2',
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
          const result = await getPayableOtherPage({
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
          result.list = (result.list || []).map((row) => ({
            ...row,
            increasePayableAmount: row.payableAmount,
          }));
          rows.value = result.list;
          void gridApi.grid?.reloadColumn?.(buildGridColumns(rows.value));
          if (!pageRequestFailed)
            void querySummaryState.load(formValues, summaryChanged);
          return result;
        },
        querySuccess: () => {
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
    },
    rowClassName: ({ row }: { row: ErpPayableOtherApi.PayableOther }) =>
      isDraftRow(row) ? 'other-payable-draft-row' : '',
    toolbarConfig: {
      custom: true,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<ErpPayableOtherApi.PayableOther>,
  gridEvents: {
    sortChange: handleSortChange,
    checkboxAll: ({
      records,
    }: {
      records: ErpPayableOtherApi.PayableOther[];
    }) => {
      checkedRows.value = records;
    },
    checkboxChange: ({
      records,
    }: {
      records: ErpPayableOtherApi.PayableOther[];
    }) => {
      checkedRows.value = records;
    },
  },
});

const { activationRefreshMaskVisible } =
  useVxeActivationRefresh<ErpPayableOtherApi.PayableOther>({
    gridApi,
    errorMessage: 'Error occurred while refreshing other payable page:',
    getParams: async () => ({
      ...(await gridApi.formApi.getValues()),
      ...buildSortParams(),
    }),
    queryPage: async (params) => {
      querySummaryState.invalidate();
      const result = await getPayableOtherPage(params);
      const list = (result.list || []).map((row) => ({
        ...row,
        increasePayableAmount: row.payableAmount,
      }));
      void querySummaryState.load(params, true);
      return { ...result, list };
    },
    onSuccess: (activatedRows) => {
      rows.value = activatedRows;
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
    <div ref="gridShellRef" class="other-payable-grid-shell">
      <Grid
        class="other-payable-grid"
        table-title="应付调账列表"
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
                auth: ['erp:payable-other:create'],
                onClick: handleCreate,
              },
              {
                label: '导入',
                type: 'primary',
                icon: ACTION_ICON.UPLOAD,
                tooltip: 'I 导入',
                title: 'I 导入',
                auth: ['erp:payable-other:import'],
                onClick: handleImport,
              },
              {
                label: $t('ui.actionTitle.export'),
                type: 'primary',
                icon: ACTION_ICON.DOWNLOAD,
                auth: ['erp:payable-other:export'],
                onClick: handleExport,
              },
              {
                label: '打印模板',
                type: 'primary',
                icon: ACTION_ICON.EDIT,
                auth: ['erp:payable-other:print-template'],
                onClick: handleOpenPrintTemplateDesigner,
              },
              {
                label: '批量修改',
                type: 'primary',
                icon: ACTION_ICON.EDIT,
                ifShow: () => checkedRows.some(isPendingRow),
                auth: ['erp:payable-other:update'],
                onClick: handleBatchEdit,
              },
              {
                label: '批量删除',
                type: 'primary',
                danger: true,
                icon: ACTION_ICON.DELETE,
                ifShow: () => checkedRows.length > 0,
                auth: ['erp:payable-other:delete'],
                popConfirm: {
                  title: '确认删除选中的应付调账单据？不可删除数据将自动跳过',
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
                auth: ['erp:payable-other:delete'],
                ifShow: () => isDraftRow(row) || isPendingRow(row),
                popConfirm: {
                  title: $t('ui.actionMessage.deleteConfirm', [row.no]),
                  confirm: handleDelete.bind(null, row),
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
                auth: ['erp:payable-other:print'],
                onClick: handlePrint.bind(null, row),
              },
            ]"
          />
        </template>
        <template #otherPayableNo="{ row }">
          <button
            class="other-payable-grid__document-link"
            type="button"
            @click.stop="handleDetail(row)"
          >
            {{ row.no || '-' }}
          </button>
        </template>
        <template #status="{ row }">
          <span
            class="other-payable-grid__status"
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
                auth: ['erp:payable-other:update'],
                ifShow: () => isDraftRow(row) || isPendingRow(row),
                onClick: handleEdit.bind(null, row),
              },
              {
                label: '复制',
                type: 'link',
                icon: ACTION_ICON.COPY,
                auth: ['erp:payable-other:create'],
                onClick: handleCopy.bind(null, row),
              },
              {
                label: '审核',
                type: 'link',
                icon: ACTION_ICON.AUDIT,
                auth: ['erp:payable-other:update-status'],
                ifShow: () => isPendingRow(row),
                popConfirm: {
                  title: `确认审核应付调账单 ${row.no} 吗？`,
                  confirm: handleAudit.bind(null, row),
                },
              },
            ]"
          />
        </template>
        <template #bottom>
          <div class="other-payable-summary">
            <div class="other-payable-summary__draft-legend">
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
        class="other-payable-activation-mask"
      />
    </div>
  </Page>
</template>

<style scoped>
.other-payable-grid-shell {
  position: relative;
  height: 100%;
  min-height: 100%;
}

:deep(.other-payable-grid .vxe-table--render-default),
:deep(.other-payable-grid .vxe-grid--form-wrapper) {
  font-size: 12px;
}

@media (min-width: 1280px) {
  :deep(.other-payable-grid .vxe-grid--form-wrapper form > .grid) {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}

:deep(.other-payable-grid .vxe-grid--form-wrapper .ant-form-item) {
  margin-bottom: 8px;
}

:deep(.other-payable-grid .vxe-grid--form-wrapper label),
:deep(.other-payable-grid .vxe-grid--form-wrapper .ant-input),
:deep(.other-payable-grid .vxe-grid--form-wrapper .ant-picker),
:deep(.other-payable-grid .vxe-grid--form-wrapper .ant-picker-input > input),
:deep(.other-payable-grid .vxe-grid--form-wrapper .ant-select),
:deep(.other-payable-grid .vxe-grid--form-wrapper .ant-btn),
:deep(.other-payable-grid .vxe-grid--form-wrapper .vben-link) {
  font-size: 12px;
}

:deep(.other-payable-grid .vxe-grid--form-wrapper .ant-input-affix-wrapper) {
  min-height: 28px;
  padding: 2px 8px;
}

:deep(.other-payable-grid .vxe-grid--form-wrapper .ant-select-single),
:deep(.other-payable-grid .vxe-grid--form-wrapper .ant-picker) {
  height: 28px;
}

:deep(
  .other-payable-grid
    .vxe-grid--form-wrapper
    .ant-select-single
    .ant-select-selector
) {
  height: 28px;
  padding: 0 8px;
}

:deep(
  .other-payable-grid
    .vxe-grid--form-wrapper
    .ant-select-single
    .ant-select-selection-item
),
:deep(
  .other-payable-grid
    .vxe-grid--form-wrapper
    .ant-select-single
    .ant-select-selection-placeholder
) {
  line-height: 26px;
}

:global(.other-payable-search-select-dropdown .ant-select-item),
:global(.other-payable-search-select-dropdown .ant-empty-description) {
  font-size: 12px;
}

:deep(.other-payable-grid .vxe-grid--form-wrapper .ant-btn),
:deep(.other-payable-grid .vxe-toolbar .table-actions .ant-btn) {
  height: 28px;
  padding: 2px 10px;
  font-size: 12px;
  line-height: 20px;
}

:deep(.other-payable-grid .vxe-toolbar .vxe-button) {
  box-sizing: border-box;
  width: 28px !important;
  min-width: 28px !important;
  height: 28px;
  padding: 0;
  font-size: 12px;
}

:deep(.other-payable-grid .vxe-header--column) {
  height: 34px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  font-weight: 600;
}

:deep(.other-payable-grid .vxe-header--column .vxe-cell--title) {
  white-space: nowrap;
}

:deep(.other-payable-grid .vxe-header--column.is--sortable .vxe-cell--title) {
  color: hsl(var(--primary));
}

:deep(.other-payable-grid .vxe-header--column .vxe-cell--sort) {
  display: none;
}

:deep(.other-payable-grid .vxe-body--column) {
  height: 36px;
  font-size: 12px;
  line-height: 20px;
}

:deep(.other-payable-grid .other-payable-amount-cell) {
  font-variant-numeric: tabular-nums;
  font-weight: 500;
}

:deep(
  .other-payable-grid .other-payable-amount-cell--primary .vxe-cell--label
) {
  color: hsl(var(--primary));
  font-weight: 700;
}

:deep(.other-payable-grid .vxe-body--column .table-actions .ant-btn-link) {
  height: auto;
  padding: 0;
  font-size: 12px;
}

.other-payable-grid__document-link {
  display: block;
  max-width: 100%;
  padding: 0;
  overflow: hidden;
  color: hsl(var(--primary));
  font: inherit;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  background: transparent;
  border: 0;
}

.other-payable-grid__document-link:hover,
.other-payable-grid__document-link:focus-visible {
  text-decoration: underline;
  text-underline-offset: 3px;
}

:deep(.other-payable-grid .other-payable-draft-row) {
  background-color: hsl(var(--primary) / 7%) !important;
}

:deep(.other-payable-grid .other-payable-draft-row .vxe-body--column) {
  background-color: hsl(var(--primary) / 7%) !important;
}

:deep(.other-payable-grid .other-payable-draft-row.row--hover) {
  background-color: hsl(var(--primary) / 13%) !important;
}

:deep(
  .other-payable-grid .other-payable-draft-row.row--hover .vxe-body--column
) {
  background-color: hsl(var(--primary) / 13%) !important;
}

.other-payable-grid__status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  white-space: nowrap;
}

.other-payable-grid__status::before {
  width: 6px;
  height: 6px;
  flex: 0 0 auto;
  background: currentcolor;
  border-radius: 50%;
  content: '';
}

.other-payable-grid__status.is-status-0 {
  color: hsl(var(--primary));
  font-weight: 600;
}

.other-payable-grid__status.is-status-10 {
  color: hsl(var(--warning));
}

.other-payable-grid__status.is-status-20 {
  color: hsl(var(--success));
}

.other-payable-grid__document-link:focus-visible {
  border-radius: 3px;
  outline: 2px solid hsl(var(--primary));
  outline-offset: 2px;
}

:deep(.other-payable-grid .vxe-grid--bottom-wrapper) {
  position: sticky;
  z-index: 4;
  bottom: 36px;
  background: hsl(var(--card));
}

:deep(.other-payable-grid .vxe-grid--pager-wrapper) {
  position: sticky;
  z-index: 5;
  bottom: 0;
  margin-top: 0 !important;
  background: hsl(var(--card));
  box-shadow: 0 -2px 8px rgb(0 0 0 / 8%);
}

.other-payable-summary {
  display: flex;
  min-height: 52px;
  align-items: stretch;
  border-top: 1px solid hsl(var(--border));
  background: hsl(var(--card));
}

.other-payable-summary__draft-legend {
  display: flex;
  min-width: 250px;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  color: hsl(var(--muted-foreground));
  font-size: 11px;
  border-left: 3px solid hsl(var(--primary));
}

.other-payable-summary__draft-legend > span:first-child {
  width: 18px;
  height: 10px;
  background: hsl(var(--primary) / 12%);
  border: 1px solid hsl(var(--primary) / 28%);
  border-radius: 2px;
}

.other-payable-summary__identity,
.other-payable-summary__metric {
  display: flex;
  min-width: 156px;
  flex-direction: column;
  justify-content: center;
  padding: 6px 16px;
}

.other-payable-summary__identity {
  min-width: 180px;
  margin-right: auto;
  border-left: 3px solid hsl(var(--primary));
}

.other-payable-summary__metric > span {
  color: hsl(var(--muted-foreground));
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
}

.other-payable-summary__identity strong {
  margin-top: 2px;
  font-size: 12px;
}

.other-payable-summary__metric {
  border-left: 1px solid hsl(var(--border));
  text-align: right;
}

.other-payable-summary__metric b {
  margin-top: 2px;
  color: hsl(var(--foreground));
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.other-payable-summary__metric--outstanding b {
  color: hsl(var(--primary));
}

@media (max-width: 900px) {
  .other-payable-summary {
    flex-wrap: wrap;
  }

  .other-payable-summary__identity {
    width: 100%;
    min-height: 40px;
    border-bottom: 1px solid hsl(var(--border));
  }

  .other-payable-summary__metric {
    min-width: 0;
    flex: 1 1 33.333%;
    padding: 6px 10px;
  }

  :deep(.other-payable-grid .vxe-grid--bottom-wrapper) {
    bottom: 40px;
  }
}

@media (max-width: 640px) {
  .other-payable-summary__metric {
    flex-basis: 100%;
    flex-direction: row;
    justify-content: space-between;
    border-top: 1px solid hsl(var(--border));
    text-align: left;
  }
}
</style>
