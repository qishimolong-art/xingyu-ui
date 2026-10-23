<script lang="ts" setup>
import { provideFinanceCandidateFocus } from '#/views/erp/finance/utils/candidate-focus';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpReceivableOtherIncomeApi } from '#/api/erp/finance/receivable/other-income';

import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue';

import { useAccess } from '@vben/access';
import { Page, useVbenModal } from '@vben/common-ui';
import { downloadFileFromBlobPart } from '@vben/utils';

import { message, Tag } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import { getBaseDataSimpleList } from '#/api/erp/base';
import {
  batchUpdateOtherIncome,
  deleteOtherIncome,
  downloadOtherIncomeImportFailureDetails,
  exportOtherIncome,
  getOtherIncomeExportFields,
  getOtherIncomeImportTemplate,
  getOtherIncomePage,
  getOtherIncomeSummary,
  importOtherIncome,
  updateOtherIncomeStatus,
} from '#/api/erp/finance/receivable/other-income';
import { $t } from '#/locales';
import ErpActivationRefreshMask from '#/views/erp/components/ErpActivationRefreshMask.vue';
import ExportFieldModalComponent from '#/views/erp/components/export-field-modal.vue';
import PrintTemplateModal from '#/views/erp/components/PrintTemplateModal.vue';
import PrintTemplateSelector from '#/views/erp/components/PrintTemplateSelector.vue';
import { useFinanceShortcut } from '#/views/erp/composables/useFinanceShortcut';
import FinanceListQuerySummary from '#/views/erp/finance/components/FinanceListQuerySummary.vue';
import {
  applyFinanceDocumentListColumnCustomization,
  fitFinanceDocumentListColumnsToWidth,
} from '#/views/erp/finance/utils/document-list-table';
import { useFinanceQuerySummary } from '#/views/erp/finance/utils/use-finance-query-summary';
import { useVxeActivationRefresh } from '#/views/erp/utils/activation-refresh';
import { useErpPrintTemplate } from '#/views/erp/utils/print-template';
import { createVxeHeaderSort } from '#/views/erp/utils/vxe-header-sort';

import BatchEditModal from '../../components/batch-edit-modal.vue';
import ImportModal from '../../components/import-modal.vue';
import {
  OTHER_INCOME_DOC_TYPE,
  OTHER_INCOME_TYPE,
  useGridColumns,
  useGridFormSchema,
} from './data';
import Form from './modules/form.vue';
import { formatOtherIncomeAmount, normalizeOtherIncomeListRow } from './ui';
const { candidateSchema, candidatePagerConfig } =
  provideFinanceCandidateFocus();

defineOptions({ name: 'ErpReceivableOtherIncome' });

const PRINT_TEMPLATE_MODULE = 'receivable_other_income';
const rows = ref<ErpReceivableOtherIncomeApi.OtherIncome[]>([]);
const checkedIds = ref<number[]>([]);
const checkedRows = ref<ErpReceivableOtherIncomeApi.OtherIncome[]>([]);
const gridShellRef = ref<HTMLElement>();
const { hasAccessByCodes } = useAccess();

function getOtherIncomeStatusLabel(status?: number) {
  if (status === 0) return '草稿';
  if (status === 10) return '未审核';
  if (status === 20) return '已审核';
  return '-';
}

function getOtherIncomeStatusColor(status?: number) {
  if (status === 0) return 'blue';
  if (status === 10) return 'orange';
  if (status === 20) return 'green';
  return 'default';
}

const querySummaryState = useFinanceQuerySummary((params, signal) =>
  getOtherIncomeSummary(params, signal),
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
          : `￥${formatOtherIncomeAmount(value.totalAmount)}`,
    },
  ];
});

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
  // VXE does not emit a page event when page one is already active. Query
  // explicitly so create/import/audit completion always refreshes the list.
  await gridApi.query();
}

const pendingExportParams = ref<Record<string, any>>({});

async function handleExport() {
  const selectedIds = (
    (gridApi.grid?.getCheckboxRecords?.() as
      | ErpReceivableOtherIncomeApi.OtherIncome[]
      | undefined) ?? []
  )
    .map((item) => item.id!)
    .filter((id) => id !== undefined);
  pendingExportParams.value =
    selectedIds.length > 0
      ? { ids: selectedIds, ...buildSortParams() }
      : { ...(await gridApi.formApi.getValues()), ...buildSortParams() };
  exportFieldModalApi
    .setData({
      loadFields: getOtherIncomeExportFields,
      moduleKey: 'erp_finance_receivable_other_income',
    })
    .open();
}

async function handleExportConfirm(fields: string[]) {
  const data = await exportOtherIncome({
    ...pendingExportParams.value,
    fields: fields.join(','),
  });
  downloadFileFromBlobPart({ fileName: '其他收入.xls', source: data });
}

function handleCreate() {
  formModalApi.setData({ type: 'create' }).open();
}

useFinanceShortcut({
  onCreate: () => {
    if (hasAccessByCodes(['erp:receivable-other-income:create']))
      handleCreate();
  },
  onImport: () => {
    if (hasAccessByCodes(['erp:receivable-other-income:import']))
      handleImport();
  },
});

function handleImport() {
  importFormModalApi
    .setData({
      failureDownload: {
        fileName: '其他收入错误数据.xls',
        request: downloadOtherIncomeImportFailureDetails,
      },
      importRequest: importOtherIncome,
      templateFileName: '其他收入导入模板.xls',
      templateRequest: getOtherIncomeImportTemplate,
      title: '导入其他收入',
    })
    .open();
}

async function handleImportSuccess() {
  await handleRefresh(true);
}

function toBatchSelectOptions(list: Array<{ name?: string }>) {
  return (list || [])
    .filter((item) => item.name)
    .map((item) => ({ label: item.name!, value: item.name! }));
}

async function handleBatchEdit() {
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
  const [settleMethodList, incomeTypeList, docTypeList] = await Promise.all([
    getBaseDataSimpleList('settle_method'),
    getBaseDataSimpleList(OTHER_INCOME_TYPE),
    getBaseDataSimpleList(OTHER_INCOME_DOC_TYPE),
  ]);
  batchEditFormModalApi
    .setData({
      ids: editableIds,
      title: '批量修改其他收入',
      updateRequest: batchUpdateOtherIncome,
      fields: [
        {
          field: 'settleMethod',
          label: '结算方式',
          component: 'select',
          options: toBatchSelectOptions(settleMethodList),
        },
        { field: 'voucherNo', label: '凭证号', component: 'input' },
        {
          field: 'incomeType',
          label: '收入类型',
          component: 'select',
          options: toBatchSelectOptions(incomeTypeList),
        },
        {
          field: 'docType',
          label: '单据类型',
          component: 'select',
          options: toBatchSelectOptions(docTypeList),
        },
        { field: 'relatedBiz', label: '关联业务', component: 'input' },
        { field: 'remark', label: '备注', component: 'textarea' },
        { field: 'fileUrl', label: '附件 URL', component: 'input' },
      ],
    })
    .open();
}

function handleEdit(row: ErpReceivableOtherIncomeApi.OtherIncome) {
  formModalApi.setData({ type: 'edit', id: row.id }).open();
}

function handleDetail(row: ErpReceivableOtherIncomeApi.OtherIncome) {
  formModalApi.setData({ type: 'detail', id: row.id }).open();
}

function handleCopy(row: ErpReceivableOtherIncomeApi.OtherIncome) {
  formModalApi.setData({ type: 'copy', id: row.id }).open();
}

function openOtherIncomePrintModal(data: {
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
} = useErpPrintTemplate<ErpReceivableOtherIncomeApi.OtherIncome>({
  moduleKey: PRINT_TEMPLATE_MODULE,
  moduleName: '其他收入',
  openModal: openOtherIncomePrintModal,
});

async function handleBatchDelete(ids: number[], skippedCount = 0) {
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting'),
    duration: 0,
  });
  try {
    await deleteOtherIncome(ids);
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
  await handleBatchDelete(deletableIds, skippedCount);
}

async function handleDelete(row: ErpReceivableOtherIncomeApi.OtherIncome) {
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting', [row.no]),
    duration: 0,
  });
  try {
    await deleteOtherIncome([row.id as number]);
    message.success($t('ui.actionMessage.deleteSuccess', [row.no]));
    await handleRefresh();
  } finally {
    hideLoading();
  }
}

async function handleAudit(row: ErpReceivableOtherIncomeApi.OtherIncome) {
  const hideLoading = message.loading({ content: '审核中...', duration: 0 });
  try {
    await updateOtherIncomeStatus(row.id as number, 20);
    message.success('审核成功');
    await handleRefresh();
  } finally {
    hideLoading();
  }
}

async function handleDetailAudit(row: ErpReceivableOtherIncomeApi.OtherIncome) {
  await handleAudit(row);
  await formModalApi.close();
}

const otherIncomeSortFieldMap = {
  no: 'no',
  bizTime: 'bizTime',
  incomeType: 'incomeType',
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
  createVxeHeaderSort(otherIncomeSortFieldMap);

function buildGridColumns(
  currentRows: ErpReceivableOtherIncomeApi.OtherIncome[] = rows.value,
) {
  return (useGridColumns(currentRows) || []).map((column) =>
    column.field && column.field in otherIncomeSortFieldMap
      ? { ...column, sortable: true }
      : column,
  );
}

function buildCustomizedGridColumns(
  currentRows: ErpReceivableOtherIncomeApi.OtherIncome[] = rows.value,
) {
  return fitFinanceDocumentListColumnsToWidth(
    applyFinanceDocumentListColumnCustomization(
      buildGridColumns(currentRows),
      gridApi.grid.getFullColumns?.() ?? [],
      72,
    ),
    gridShellRef.value?.clientWidth ?? 0,
  );
}

async function reloadAdaptiveGridColumns(
  currentRows: ErpReceivableOtherIncomeApi.OtherIncome[] = rows.value,
) {
  await nextTick();
  await gridApi.grid?.reloadColumn?.(buildCustomizedGridColumns(currentRows));
  await restoreSortState(gridApi);
}

async function handleGridColumnCustom({ type }: { type?: string }) {
  if (type !== 'confirm' && type !== 'reset') return;
  await reloadAdaptiveGridColumns();
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
    id: 'erp-finance-receivable-other-income-list-v2',
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
          const result = await getOtherIncomePage({
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
            normalizeOtherIncomeListRow(row),
          );
          rows.value = result.list;
          void reloadAdaptiveGridColumns(rows.value);
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
    rowClassName: ({ row }) =>
      row.status === 0 ? 'other-income-draft-row' : '',
    toolbarConfig: {
      custom: true,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<ErpReceivableOtherIncomeApi.OtherIncome>,
  gridEvents: {
    custom: handleGridColumnCustom,
    sortChange: handleSortChange,
    checkboxAll: ({
      records,
    }: {
      records: ErpReceivableOtherIncomeApi.OtherIncome[];
    }) => {
      checkedIds.value = records.map((item) => item.id!).filter(Boolean);
      checkedRows.value = records;
    },
    checkboxChange: ({
      records,
    }: {
      records: ErpReceivableOtherIncomeApi.OtherIncome[];
    }) => {
      checkedIds.value = records.map((item) => item.id!).filter(Boolean);
      checkedRows.value = records;
    },
  },
});

const { activationRefreshMaskVisible } =
  useVxeActivationRefresh<ErpReceivableOtherIncomeApi.OtherIncome>({
    gridApi,
    errorMessage: 'Error occurred while refreshing other income page:',
    getParams: async () => ({
      ...(await gridApi.formApi.getValues()),
      ...buildSortParams(),
      includeItems: false,
    }),
    queryPage: async (params) => {
      querySummaryState.invalidate();
      const result = await getOtherIncomePage({
        ...params,
        includeItems: false,
      });
      const list = (result.list || []).map((row) =>
        normalizeOtherIncomeListRow(row),
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
      void reloadAdaptiveGridColumns(activatedRows);
    },
  });

function handleGridResize() {
  void reloadAdaptiveGridColumns(rows.value);
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
    <div ref="gridShellRef" class="other-income-grid-shell">
      <Grid
        class="other-income-grid"
        table-title="其他收入列表"
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
                auth: ['erp:receivable-other-income:create'],
                onClick: handleCreate,
              },
              {
                label: '导入',
                type: 'primary',
                icon: ACTION_ICON.UPLOAD,
                tooltip: 'I 导入',
                title: 'I 导入',
                auth: ['erp:receivable-other-income:import'],
                onClick: handleImport,
              },
              {
                label: $t('ui.actionTitle.export'),
                type: 'primary',
                icon: ACTION_ICON.DOWNLOAD,
                auth: ['erp:receivable-other-income:export'],
                onClick: handleExport,
              },
              {
                label: '打印模板',
                type: 'primary',
                icon: ACTION_ICON.EDIT,
                auth: ['erp:receivable-other-income:print-template'],
                onClick: handleOpenPrintTemplateDesigner,
              },
              {
                label: '批量修改',
                type: 'primary',
                icon: ACTION_ICON.EDIT,
                ifShow: () => checkedRows.some((item) => item.status !== 20),
                auth: ['erp:receivable-other-income:update'],
                onClick: handleBatchEdit,
              },
              {
                label: '批量删除',
                type: 'primary',
                danger: true,
                icon: ACTION_ICON.DELETE,
                ifShow: () => checkedRows.length > 0,
                auth: ['erp:receivable-other-income:delete'],
                popConfirm: {
                  title: '确认删除选中的其他收入单据？不可删除数据将自动跳过',
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
                auth: ['erp:receivable-other-income:delete'],
                ifShow: () => row.status !== 20,
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
                auth: ['erp:receivable-other-income:print'],
                onClick: handlePrint.bind(null, row),
              },
            ]"
          />
        </template>
        <template #no="{ row }">
          <button
            class="other-income-grid__document-link"
            type="button"
            @click.stop="handleDetail(row)"
          >
            {{ row.no || '-' }}
          </button>
        </template>
        <template #status="{ row }">
          <Tag
            :color="getOtherIncomeStatusColor(row.status)"
            class="m-0"
            :title="
              row.status === 0
                ? '草稿：关闭新增或草稿编辑页面时自动保存，尚未正式提交'
                : undefined
            "
          >
            {{ getOtherIncomeStatusLabel(row.status) }}
          </Tag>
        </template>
        <template #actions="{ row }">
          <TableAction
            :actions="[
              {
                label: row.status === 0 ? '编辑草稿' : $t('common.edit'),
                type: 'link',
                icon: ACTION_ICON.EDIT,
                auth: ['erp:receivable-other-income:update'],
                ifShow: () => row.status !== 20,
                onClick: handleEdit.bind(null, row),
              },
              {
                label: '复制',
                type: 'link',
                icon: ACTION_ICON.COPY,
                auth: ['erp:receivable-other-income:create'],
                onClick: handleCopy.bind(null, row),
              },
              {
                label: '审核',
                type: 'link',
                icon: ACTION_ICON.AUDIT,
                auth: ['erp:receivable-other-income:update-status'],
                ifShow: () => row.status === 10,
                popConfirm: {
                  title: `确认审核其他收入单 ${row.no} 吗？`,
                  confirm: handleAudit.bind(null, row),
                },
              },
            ]"
          />
        </template>
        <template #bottom>
          <div class="other-income-summary">
            <div class="other-income-row-legend">
              <span
                class="other-income-row-legend__swatch"
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
        class="other-income-activation-mask"
      />
    </div>
  </Page>
</template>

<style scoped>
.other-income-grid-shell {
  position: relative;
  height: 100%;
  min-height: 100%;
}

:deep(.other-income-grid .vxe-table--render-default),
:deep(.other-income-grid .vxe-grid--form-wrapper) {
  font-size: 12px;
}

@media (min-width: 1280px) {
  :deep(.other-income-grid .vxe-grid--form-wrapper form > .grid) {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}

:deep(.other-income-grid .vxe-grid--form-wrapper .ant-form-item) {
  margin-bottom: 8px;
}

:deep(.other-income-grid .vxe-grid--form-wrapper label),
:deep(.other-income-grid .vxe-grid--form-wrapper .ant-input),
:deep(.other-income-grid .vxe-grid--form-wrapper .ant-picker),
:deep(.other-income-grid .vxe-grid--form-wrapper .ant-picker-input > input),
:deep(.other-income-grid .vxe-grid--form-wrapper .ant-select),
:deep(.other-income-grid .vxe-grid--form-wrapper .ant-btn) {
  font-size: 12px;
}

:deep(.other-income-grid .vxe-grid--form-wrapper .ant-input-affix-wrapper) {
  min-height: 28px;
  padding: 2px 8px;
}

:deep(.other-income-grid .vxe-grid--form-wrapper .ant-select-single),
:deep(
  .other-income-grid
    .vxe-grid--form-wrapper
    .ant-select-single
    .ant-select-selector
) {
  height: 28px;
  min-height: 28px;
  font-size: 12px;
}

:deep(.other-income-grid .vxe-grid--form-wrapper .ant-picker) {
  height: 28px;
  padding: 2px 8px;
}

:deep(.other-income-grid .vxe-grid--form-wrapper .ant-btn),
:deep(.other-income-grid .vxe-toolbar .table-actions .ant-btn) {
  height: 28px;
  padding: 2px 10px;
  font-size: 12px;
}

:deep(.other-income-grid .vxe-toolbar .vxe-button) {
  box-sizing: border-box;
  width: 28px !important;
  min-width: 28px !important;
  height: 28px;
  padding: 0;
  font-size: 12px;
}

:deep(.other-income-grid .vxe-header--column .vxe-cell--title) {
  white-space: nowrap;
}

:deep(.other-income-grid .vxe-header--column.is--sortable .vxe-cell--title) {
  color: #1677ff;
}

:deep(.other-income-grid .vxe-header--column .vxe-cell--sort) {
  display: none;
}

:deep(.other-income-grid .vxe-body--column .table-actions .ant-btn-link) {
  height: auto;
  padding: 0;
  font-size: 12px;
}

:deep(.other-income-grid .other-income-amount-cell) {
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.other-income-grid__document-link {
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

.other-income-grid__document-link:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.other-income-grid__document-link:focus-visible {
  border-radius: 3px;
  outline: 2px solid hsl(var(--primary));
  outline-offset: 2px;
}

:deep(.other-income-grid .other-income-draft-row .vxe-body--column) {
  background-color: hsl(var(--primary) / 7%) !important;
}

:deep(.other-income-grid .other-income-draft-row.row--hover .vxe-body--column) {
  background-color: hsl(var(--primary) / 13%) !important;
}

:deep(.other-income-grid .vxe-grid--bottom-wrapper) {
  position: sticky;
  z-index: 4;
  bottom: 36px;
  background: hsl(var(--card));
}

:deep(.other-income-grid .vxe-grid--pager-wrapper) {
  position: sticky;
  z-index: 5;
  bottom: 0;
  margin-top: 0 !important;
  background: hsl(var(--card));
  box-shadow: 0 -2px 8px rgb(0 0 0 / 8%);
}

.other-income-summary {
  display: flex;
  min-height: 44px;
  align-items: stretch;
  justify-content: flex-end;
  border-top: 1px solid hsl(var(--border));
  background: hsl(var(--card));
  font-size: 12px;
}

.other-income-row-legend {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  color: hsl(var(--muted-foreground));
}

.other-income-row-legend__swatch {
  width: 18px;
  height: 10px;
  border: 1px solid hsl(var(--primary) / 30%);
  border-radius: 2px;
  background: hsl(var(--primary) / 10%);
}

.other-income-summary__identity,
.other-income-summary__metric {
  display: flex;
  min-width: 160px;
  flex-direction: column;
  justify-content: center;
  padding: 6px 16px;
}

.other-income-summary__identity {
  margin-right: auto;
  border-left: 3px solid hsl(var(--primary));
}

.other-income-summary__identity span,
.other-income-summary__metric span {
  color: hsl(var(--muted-foreground));
  font-size: 11px;
}

.other-income-summary__metric {
  min-width: 210px;
  align-items: flex-end;
  border-left: 1px solid hsl(var(--border));
  background: hsl(var(--primary) / 6%);
}

.other-income-summary__identity strong,
.other-income-summary__metric b {
  margin-top: 1px;
  font-variant-numeric: tabular-nums;
}

.other-income-summary__metric b {
  color: hsl(var(--primary));
  font-size: 16px;
}

:global(.other-income-search-select-dropdown .ant-select-item),
:global(.other-income-search-select-dropdown .ant-select-tree),
:global(.other-income-search-select-dropdown .ant-empty-description) {
  font-size: 12px;
}

@media (max-width: 768px) {
  .other-income-summary {
    flex-wrap: wrap;
  }

  .other-income-summary__identity,
  .other-income-summary__metric {
    min-width: 50%;
    flex: 1 1 50%;
  }
}
</style>
