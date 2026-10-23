<script lang="ts" setup>
import { provideFinanceCandidateFocus } from '#/views/erp/finance/utils/candidate-focus';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpReceivableMiscApi } from '#/api/erp/finance/receivable/misc';
import type { PageParam } from '@vben/request';

import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import { useAccess } from '@vben/access';
import { Page, useVbenModal } from '@vben/common-ui';
import { downloadFileFromBlobPart } from '@vben/utils';

import { Modal as AntModal, message, Tag } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deleteReceivableMisc,
  exportReceivableMisc,
  getReceivableMiscExportFields,
  getReceivableMiscImportTemplate,
  getReceivableMiscPage,
  getReceivableMiscSummary,
  importReceivableMisc,
  updateReceivableMiscStatus,
} from '#/api/erp/finance/receivable/misc';
import ErpActivationRefreshMask from '#/views/erp/components/ErpActivationRefreshMask.vue';
import ExportFieldModalComponent from '#/views/erp/components/export-field-modal.vue';
import PrintTemplateModal from '#/views/erp/components/PrintTemplateModal.vue';
import PrintTemplateSelector from '#/views/erp/components/PrintTemplateSelector.vue';
import { useFinanceShortcut } from '#/views/erp/composables/useFinanceShortcut';
import FinanceListQuerySummary from '#/views/erp/finance/components/FinanceListQuerySummary.vue';
import { fitFinanceDocumentListColumnsToWidth } from '#/views/erp/finance/utils/document-list-table';
import { useFinanceQuerySummary } from '#/views/erp/finance/utils/use-finance-query-summary';
import { useVxeActivationRefresh } from '#/views/erp/utils/activation-refresh';
import { withErpKeywordSearchSchema } from '#/views/erp/utils/form-defaults';
import { useErpPrintTemplate } from '#/views/erp/utils/print-template';
import { createVxeHeaderSort } from '#/views/erp/utils/vxe-header-sort';

import ImportModal from '../../components/import-modal.vue';
import {
  RECEIVABLE_MISC_SORT_FIELD_MAP,
  useGridColumns,
  useGridFormSchema,
} from './data';
import Form from './modules/form.vue';
const { candidateSchema, candidatePagerConfig } =
  provideFinanceCandidateFocus();

defineOptions({ name: 'ErpReceivableMisc' });

const PRINT_TEMPLATE_MODULE = 'receivable_misc';
const PRINT_MODULE_NAME = '其他应收';
const receivableMiscGridShellRef = ref<HTMLElement>();
const exportLoading = ref(false);
const pageRows = ref<ErpReceivableMiscApi.ReceivableMisc[]>([]);
const { hasAccessByCodes } = useAccess();
const checkedRows = ref<ErpReceivableMiscApi.ReceivableMisc[]>([]);
const currentRows = ref<ErpReceivableMiscApi.ReceivableMisc[]>([]);
const querySummaryState = useFinanceQuerySummary((params, signal) =>
  getReceivableMiscSummary(params, signal),
);
function formatAmount(value?: null | number) {
  return value === null || value === undefined
    ? '****'
    : `￥${Number(value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
const querySummaryItems = computed(() => {
  const value = querySummaryState.summary.value;
  if (!value) return [];
  return [
    { key: 'amount', label: '原金额', value: formatAmount(value.amount) },
    {
      key: 'settledAmount',
      label: '已收金额',
      value: formatAmount(value.settledAmount),
    },
    {
      key: 'balanceAmount',
      label: '剩余金额',
      value: formatAmount(value.balanceAmount),
    },
    {
      key: 'pendingTransferAmount',
      label: '待审批占用',
      value: formatAmount(value.pendingTransferAmount),
    },
    {
      key: 'transferAvailableAmount',
      label: '剩余可转金额',
      value: formatAmount(value.transferAvailableAmount),
    },
  ];
});

async function queryReceivableMiscPage(
  params: PageParam & Record<string, any>,
) {
  const summaryChanged = querySummaryState.prepare(params);
  let pageRequestFailed = false;
  const result = await getReceivableMiscPage(params).catch((error) => {
    pageRequestFailed = true;
    querySummaryState.cancelPending();
    if (currentRows.value.length > 0)
      return {
        list: currentRows.value,
        total:
          gridApi.grid?.getProxyInfo?.()?.pager?.total ??
          currentRows.value.length,
      };
    throw error;
  });
  currentRows.value = result.list || [];
  if (!pageRequestFailed) void querySummaryState.load(params, summaryChanged);
  return result;
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
const [PrintTemplateDesignModal, printTemplateDesignModalApi] = useVbenModal({
  connectedComponent: PrintTemplateModal,
  destroyOnClose: true,
});

function openReceivableMiscPrintModal(data: {
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
  selectedTemplateId: selectedPrintTemplateId,
  selectorOpen: printTemplateSelectOpen,
  templateOptions: printTemplateOptions,
} = useErpPrintTemplate<ErpReceivableMiscApi.ReceivableMisc>({
  moduleKey: PRINT_TEMPLATE_MODULE,
  moduleName: PRINT_MODULE_NAME,
  openModal: openReceivableMiscPrintModal,
});

function isDraftRow(row: Pick<ErpReceivableMiscApi.ReceivableMisc, 'status'>) {
  return Number(row.status) === 0;
}

function isPendingRow(
  row: Pick<ErpReceivableMiscApi.ReceivableMisc, 'status'>,
) {
  return Number(row.status) === 10;
}

function getStatusTag(
  row: Pick<ErpReceivableMiscApi.ReceivableMisc, 'status'>,
) {
  if (Number(row.status) === 0) return { color: 'warning', label: '草稿' };
  if (Number(row.status) === 10)
    return { color: 'processing', label: '待审核' };
  if (Number(row.status) === 20) return { color: 'success', label: '已审核' };
  return { color: 'default', label: '状态未知' };
}

function handleCreate() {
  formModalApi.setData({ type: 'create' }).open();
}

useFinanceShortcut({
  onCreate: () => {
    if (hasAccessByCodes(['erp:receivable-misc:create'])) handleCreate();
  },
  onImport: () => {
    if (hasAccessByCodes(['erp:receivable-misc:import'])) handleImport();
  },
});

function handleImport() {
  importFormModalApi
    .setData({
      importRequest: importReceivableMisc,
      templateFileName: '其他应收导入模板.xls',
      templateGuideSummary:
        '其他应收导入模板用于批量创建待审核其他应收单；日期由系统在导入时自动生成。',
      templateGuideTips: [
        '客户ID、金额为必填项，金额可为正数或负数但不能为 0。',
        '备注和附件URL可按需填写，导入后仍需审核才会进入其他应收报表。',
      ],
      templateRequest: getReceivableMiscImportTemplate,
      title: '导入其他应收',
    })
    .open();
}

function handleEdit(row: ErpReceivableMiscApi.ReceivableMisc) {
  formModalApi.setData({ type: 'edit', id: row.id }).open();
}

function handleDetail(row: ErpReceivableMiscApi.ReceivableMisc) {
  formModalApi.setData({ type: 'detail', id: row.id }).open();
}

async function handleExport() {
  const formValues = await gridApi.formApi.getValues();
  const selectedIds = checkedRows.value
    .map((item) => item.id!)
    .filter((id) => id !== undefined);
  pendingExportParams.value = {
    ...(selectedIds.length > 0 ? { ids: selectedIds } : formValues),
    ...buildSortParams(),
  };
  exportFieldModalApi
    .setData({
      loadFields: getReceivableMiscExportFields,
      moduleKey: 'erp_finance_receivable_misc',
    })
    .open();
}

const pendingExportParams = ref<Record<string, any>>({});

async function handleExportConfirm(fields: string[]) {
  exportLoading.value = true;
  try {
    const data = await exportReceivableMisc({
      ...pendingExportParams.value,
      fields: fields.join(','),
    });
    downloadFileFromBlobPart({ fileName: '其他应收.xls', source: data });
  } finally {
    exportLoading.value = false;
  }
}

function refreshList() {
  querySummaryState.invalidate();
  gridApi.query();
}

function handleDelete(row: ErpReceivableMiscApi.ReceivableMisc) {
  AntModal.confirm({
    title: `确认删除其他应收单 ${row.no} 吗？`,
    content: '已审核单据不可删除。',
    async onOk() {
      await deleteReceivableMisc(row.id!);
      refreshList();
    },
  });
}

async function handleBatchDelete(ids: number[], skippedCount = 0) {
  const hideLoading = message.loading({
    content: '正在删除其他应收单据',
    duration: 0,
  });
  try {
    await Promise.all(ids.map((id) => deleteReceivableMisc(id)));
    message.success(
      skippedCount > 0
        ? `已删除 ${ids.length} 条，已跳过 ${skippedCount} 条不可删除数据`
        : '删除成功',
    );
    checkedRows.value = [];
    gridApi.grid?.clearCheckboxRow?.();
    gridApi.grid?.clearCheckboxReserve?.();
    refreshList();
  } finally {
    hideLoading();
  }
}

async function handleBatchDeleteChecked() {
  const deletableIds = checkedRows.value
    .filter((item) => Number(item.status) !== 20)
    .map((item) => item.id!)
    .filter((id) => id !== undefined);
  const skippedCount = checkedRows.value.length - deletableIds.length;
  if (deletableIds.length === 0) {
    message.warning('当前勾选数据没有可删除项');
    return;
  }
  await handleBatchDelete(deletableIds, skippedCount);
}

function handleAudit(row: ErpReceivableMiscApi.ReceivableMisc) {
  AntModal.confirm({
    title: `确认审核其他应收单 ${row.no} 吗？`,
    content: '审核通过后会进入其他应收报表，且不可再修改或删除。',
    async onOk() {
      await updateReceivableMiscStatus(row.id!, 20);
      refreshList();
    },
  });
}

function handleFormSuccess() {
  refreshList();
}

const { buildSortParams, handleSortChange, restoreSortState } =
  createVxeHeaderSort(RECEIVABLE_MISC_SORT_FIELD_MAP);

function buildGridColumns(
  rows: ErpReceivableMiscApi.ReceivableMisc[] = pageRows.value,
) {
  return fitFinanceDocumentListColumnsToWidth(
    useGridColumns(rows) || [],
    receivableMiscGridShellRef.value?.clientWidth ?? 0,
  );
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    commonConfig: { labelWidth: 70 },
    schema: candidateSchema(withErpKeywordSearchSchema(useGridFormSchema())),
    collapsed: true,
    collapsedRows: 1,
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
    height: 'auto',
    id: 'erp-finance-receivable-misc-list-v1',
    keepSource: true,
    showHeaderOverflow: 'tooltip',
    showOverflow: 'tooltip',
    scrollX: { enabled: true, gt: 8 },
    proxyConfig: {
      ajax: {
        query: async ({ page, sort, sorts }, formValues) => {
          const result = await queryReceivableMiscPage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
            ...buildSortParams(sorts, sort),
          });
          pageRows.value = result.list || [];
          void gridApi.grid?.reloadColumn?.(buildGridColumns(pageRows.value));
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
    rowConfig: { keyField: 'id', isHover: true },
    rowClassName: ({ row }: { row: ErpReceivableMiscApi.ReceivableMisc }) =>
      isDraftRow(row) ? 'receivable-misc-draft-row' : '',
    toolbarConfig: { custom: true, refresh: true, search: true, zoom: true },
  } as VxeTableGridOptions<ErpReceivableMiscApi.ReceivableMisc>,
  gridEvents: {
    sortChange: handleSortChange,
    checkboxAll: ({
      records,
    }: {
      records: ErpReceivableMiscApi.ReceivableMisc[];
    }) => {
      checkedRows.value = records;
    },
    checkboxChange: ({
      records,
    }: {
      records: ErpReceivableMiscApi.ReceivableMisc[];
    }) => {
      checkedRows.value = records;
    },
  },
});

const { activationRefreshMaskVisible } =
  useVxeActivationRefresh<ErpReceivableMiscApi.ReceivableMisc>({
    gridApi,
    errorMessage: 'Error occurred while refreshing receivable misc page:',
    getParams: async () => ({
      ...(await gridApi.formApi.getValues()),
      ...buildSortParams(),
    }),
    queryPage: async (params) => {
      querySummaryState.invalidate();
      return queryReceivableMiscPage(params);
    },
    onSuccess: (rows) => {
      pageRows.value = rows;
      void gridApi.grid?.reloadColumn?.(buildGridColumns(rows));
      checkedRows.value = [];
      gridApi.grid?.clearCheckboxRow?.();
      gridApi.grid?.clearCheckboxReserve?.();
      void restoreSortState(gridApi);
    },
  });

function handleGridResize() {
  void gridApi.grid?.reloadColumn?.(buildGridColumns(pageRows.value));
}

onMounted(() => window.addEventListener('resize', handleGridResize));
onBeforeUnmount(() => window.removeEventListener('resize', handleGridResize));
</script>

<template>
  <Page auto-content-height>
    <FormModal @success="handleFormSuccess" @audit="handleAudit" />
    <ImportFormModal @success="handleFormSuccess" />
    <ExportFieldModal @confirm="handleExportConfirm" />
    <PrintTemplateDesignModal @printed="handleFormSuccess" />
    <PrintTemplateSelector
      v-model:open="printTemplateSelectOpen"
      v-model:selected-id="selectedPrintTemplateId"
      :templates="printTemplateOptions"
      @cancel="cancelTemplateSelect"
      @confirm="confirmTemplate"
    />
    <div ref="receivableMiscGridShellRef" class="receivable-misc-grid-shell">
      <Grid class="receivable-misc-grid" table-title="其他应收列表">
        <template #toolbar-tools>
          <TableAction
            :actions="[
              {
                label: '新增',
                type: 'primary',
                icon: ACTION_ICON.ADD,
                tooltip: 'Insert 新增',
                title: 'Insert 新增',
                auth: ['erp:receivable-misc:create'],
                onClick: handleCreate,
              },
              {
                label: '导入',
                type: 'primary',
                icon: ACTION_ICON.UPLOAD,
                tooltip: 'I 导入',
                title: 'I 导入',
                auth: ['erp:receivable-misc:import'],
                onClick: handleImport,
              },
              {
                label: '导出',
                type: 'primary',
                icon: ACTION_ICON.DOWNLOAD,
                auth: ['erp:receivable-misc:export'],
                loading: exportLoading,
                onClick: handleExport,
              },
              {
                label: '打印模板',
                type: 'primary',
                icon: ACTION_ICON.EDIT,
                auth: ['erp:receivable-misc:print-template'],
                onClick: handleOpenPrintTemplateDesigner,
              },
              {
                label: '批量删除',
                type: 'primary',
                danger: true,
                icon: ACTION_ICON.DELETE,
                ifShow: () => checkedRows.length > 0,
                auth: ['erp:receivable-misc:delete'],
                popConfirm: {
                  title: '确认删除选中的其他应收单据？已审核数据将自动跳过',
                  confirm: handleBatchDeleteChecked,
                },
              },
            ]"
          />
        </template>

        <template #no="{ row }">
          <a
            class="cursor-pointer text-primary"
            @click.stop="handleDetail(row)"
          >
            {{ row.no }}
          </a>
        </template>

        <template #status="{ row }">
          <Tag :color="getStatusTag(row).color">{{
            getStatusTag(row).label
          }}</Tag>
        </template>

        <template #fileUrl="{ row }">
          <a
            v-if="row.fileUrl"
            :href="row.fileUrl"
            target="_blank"
            rel="noreferrer"
            >查看</a
          >
          <span v-else>-</span>
        </template>

        <template #actions="{ row }">
          <TableAction
            :actions="[
              {
                label: '编辑',
                type: 'link',
                icon: ACTION_ICON.EDIT,
                auth: ['erp:receivable-misc:update'],
                ifShow: () => Number(row.status) !== 20,
                onClick: handleEdit.bind(null, row),
              },
              {
                label: '审核',
                type: 'link',
                icon: ACTION_ICON.AUDIT,
                auth: ['erp:receivable-misc:update-status'],
                ifShow: () => isPendingRow(row),
                onClick: handleAudit.bind(null, row),
              },
              {
                label: '删除',
                type: 'link',
                danger: true,
                icon: ACTION_ICON.DELETE,
                auth: ['erp:receivable-misc:delete'],
                ifShow: () => Number(row.status) !== 20,
                onClick: handleDelete.bind(null, row),
              },
            ]"
          />
        </template>
        <template #bottom>
          <FinanceListQuerySummary
            :error="querySummaryState.error.value"
            :items="querySummaryItems"
            :loading="querySummaryState.loading.value"
            @retry="querySummaryState.retry"
          />
        </template>
      </Grid>
      <ErpActivationRefreshMask
        v-if="activationRefreshMaskVisible"
        class="receivable-misc-activation-mask"
      />
    </div>
  </Page>
</template>

<style scoped>
.receivable-misc-grid-shell {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

:deep(.receivable-misc-grid .vxe-table--render-default),
:deep(.receivable-misc-grid .vxe-grid--form-wrapper) {
  font-size: 12px;
}

@media (min-width: 1280px) {
  :deep(.receivable-misc-grid .vxe-grid--form-wrapper form > .grid) {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}

:deep(.receivable-misc-grid .vxe-grid--form-wrapper .ant-form-item) {
  margin-bottom: 8px;
}

:deep(.receivable-misc-grid .vxe-grid--form-wrapper label),
:deep(.receivable-misc-grid .vxe-grid--form-wrapper .ant-input),
:deep(.receivable-misc-grid .vxe-grid--form-wrapper .ant-picker),
:deep(.receivable-misc-grid .vxe-grid--form-wrapper .ant-picker-input > input),
:deep(.receivable-misc-grid .vxe-grid--form-wrapper .ant-select),
:deep(.receivable-misc-grid .vxe-grid--form-wrapper .ant-btn),
:deep(.receivable-misc-grid .vxe-grid--form-wrapper .vben-link) {
  font-size: 12px;
}

:deep(.receivable-misc-grid .vxe-grid--form-wrapper .ant-input-affix-wrapper) {
  min-height: 28px;
  padding: 2px 8px;
}

:deep(.receivable-misc-grid .vxe-grid--form-wrapper .ant-select-single),
:deep(.receivable-misc-grid .vxe-grid--form-wrapper .ant-picker) {
  height: 28px;
}

:deep(
  .receivable-misc-grid
    .vxe-grid--form-wrapper
    .ant-select-single
    .ant-select-selector
) {
  height: 28px;
  padding: 0 8px;
}

:deep(
  .receivable-misc-grid
    .vxe-grid--form-wrapper
    .ant-select-single
    .ant-select-selection-item
),
:deep(
  .receivable-misc-grid
    .vxe-grid--form-wrapper
    .ant-select-single
    .ant-select-selection-placeholder
) {
  line-height: 26px;
}

:global(.receivable-misc-search-select-dropdown .ant-select-item),
:global(.receivable-misc-search-select-dropdown .ant-empty-description) {
  font-size: 12px;
}

:deep(.receivable-misc-grid .vxe-grid--form-wrapper .ant-btn),
:deep(.receivable-misc-grid .vxe-toolbar .table-actions .ant-btn) {
  height: 28px;
  padding: 2px 10px;
  font-size: 12px;
  line-height: 20px;
}

:deep(.receivable-misc-grid .vxe-toolbar .vxe-button) {
  box-sizing: border-box;
  width: 28px !important;
  min-width: 28px !important;
  height: 28px;
  padding: 0;
  font-size: 12px;
}

:deep(.receivable-misc-grid .vxe-header--column) {
  height: 34px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  font-weight: 600;
}

:deep(.receivable-misc-grid .vxe-header--column .vxe-cell--title) {
  white-space: nowrap;
}

:deep(.receivable-misc-grid .vxe-header--column.is--sortable .vxe-cell--title) {
  color: hsl(var(--primary));
}

:deep(.receivable-misc-grid .vxe-header--column .vxe-cell--sort) {
  display: none;
}

:deep(.receivable-misc-grid .vxe-body--column) {
  height: 36px;
  font-size: 12px;
  line-height: 20px;
}

:deep(.receivable-misc-grid .vxe-body--column .table-actions .ant-btn-link) {
  height: auto;
  padding: 0;
  font-size: 12px;
}

:deep(.receivable-misc-grid .receivable-misc-draft-row .vxe-body--column) {
  background-color: hsl(var(--primary) / 7%) !important;
}

:deep(
  .receivable-misc-grid .receivable-misc-draft-row.row--hover .vxe-body--column
) {
  background-color: hsl(var(--primary) / 13%) !important;
}
</style>
