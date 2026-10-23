<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpStockInApi } from '#/api/erp/stock/in';

import { computed, provide, ref, watch } from 'vue';

import { useAccess } from '@vben/access';
import { Page, useVbenModal } from '@vben/common-ui';
import { downloadFileFromBlobPart } from '@vben/utils';

import { Button, message } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  cancelConfirmStockIn,
  confirmStockIn,
  deleteStockIn,
  exportStockIn,
  getStockInExportFields,
  getStockInPage,
  getStockInSummary,
} from '#/api/erp/stock/in';
import {
  isFieldHidden,
  useFieldPermission,
} from '#/composables/useFieldPermission';
import { $t } from '#/locales';
import ErpActivationRefreshMask from '#/views/erp/components/ErpActivationRefreshMask.vue';
import ExportFieldModalComponent from '#/views/erp/components/export-field-modal.vue';
import PrintTemplateModal from '#/views/erp/components/PrintTemplateModal.vue';
import PrintTemplateSelector from '#/views/erp/components/PrintTemplateSelector.vue';
import { useStockShortcut } from '#/views/erp/composables/useStockShortcut';
import StockListQuerySummary from '#/views/erp/stock/components/StockListQuerySummary.vue';
import { renderStockCandidatePageSizes } from '#/views/erp/stock/utils/candidate-focus';
import { useStockDocumentColumns } from '#/views/erp/stock/utils/document-columns';
import { formatStockNaturalNumber } from '#/views/erp/stock/utils/document-number';
import { isSameFieldSet } from '#/views/erp/stock/utils/field-permission';
import { formatOtherStockListQuantity } from '#/views/erp/stock/utils/other-stock-item';
import { stockListNumber } from '#/views/erp/stock/utils/stock-decimal';
import { useStockQuerySummary } from '#/views/erp/stock/utils/use-stock-query-summary';
import { useVxeActivationRefresh } from '#/views/erp/utils/activation-refresh';
import { CANDIDATE_FOCUS_KEY } from '#/views/erp/utils/candidate-focus';
import {
  hasOpenFormControlPopup,
  submitSearchFormOnEnterAndBlur,
} from '#/views/erp/utils/keyboard';
import { useErpPrintTemplate } from '#/views/erp/utils/print-template';
import { createVxeHeaderSort } from '#/views/erp/utils/vxe-header-sort';

import { useGridColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';
import ImportForm from './modules/import-form.vue';

/** ERP 其它入库单列表 */
defineOptions({ name: 'ErpStockIn' });

provide(CANDIDATE_FOCUS_KEY, ref(true));

const { buildSortParams, handleSortChange, restoreSortState } =
  createVxeHeaderSort({
    no: 'no',
    inTime: 'inTime',
    updateTime: 'updateTime',
    status: 'status',
  });

const FIELD_PERMISSION_MODULE = 'erp_stock_in';
const PRINT_TEMPLATE_MODULE = 'stock_in';
const PRINT_MODULE_NAME = '其它入库单';
const { hiddenFields, loadHiddenFields } = useFieldPermission(
  FIELD_PERMISSION_MODULE,
);
const currentPageRows = ref<ErpStockInApi.StockIn[]>([]);
const stockInGridShellRef = ref<HTMLElement>();

function isQuantityHidden() {
  return ['totalCount', 'col_totalCount', 'item_count'].some((field) =>
    isFieldHidden(hiddenFields.value, field),
  );
}
function formatSummaryValue(value?: null | number | string, _scale = 2) {
  if (value === null || value === undefined)
    return [
      'totalPrice',
      'col_totalPrice',
      'item_count',
      'item_productPrice',
      'item_totalPrice',
    ].some((field) => isFieldHidden(hiddenFields.value, field))
      ? '****'
      : '-';
  return stockListNumber(value);
}

const { hasAccessByCodes } = useAccess();
const canQueryDocument = computed(() =>
  hasAccessByCodes(['erp:stock-in:query']),
);
const listLoading = ref(false);
let permissionEpoch = 0;
async function queryDocumentPage(params: any) {
  const epoch = permissionEpoch;
  await loadHiddenFields();
  if (!canQueryDocument.value) return { list: [], total: 0 };
  listLoading.value = true;
  try {
    const result = await getStockInPage(params);
    return canQueryDocument.value && epoch === permissionEpoch
      ? result
      : { list: [], total: 0 };
  } finally {
    listLoading.value = false;
  }
}
function listActionBlocked() {
  return (
    listLoading.value ||
    hasOpenFormControlPopup() ||
    Boolean(
      document.querySelector(
        '[role="dialog"][data-state="open"], .ant-modal-wrap:not([style*="display: none"])',
      ),
    )
  );
}
const pendingExportParams = ref<Record<string, any>>({});
const [ExportFieldModal, exportFieldModalApi] = useVbenModal({
  connectedComponent: ExportFieldModalComponent,
  destroyOnClose: true,
});
const querySummaryState = useStockQuerySummary((params, signal) =>
  canQueryDocument.value
    ? getStockInSummary(params, signal)
    : Promise.resolve({ totalCount: null, totalPrice: null }),
);
const querySummaryItems = computed(() => {
  if (!canQueryDocument.value) return [];
  const value = querySummaryState.summary.value;
  if (!value) return [];
  return [
    {
      key: 'totalCount',
      label: '入库数量',
      value: formatOtherStockListQuantity(
        isQuantityHidden() ? '****' : value.totalCount,
      ),
    },
    {
      key: 'totalPrice',
      label: '入库金额',
      value: formatSummaryValue(value.totalPrice),
    },
  ];
});

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

const [ImportModal, importModalApi] = useVbenModal({
  connectedComponent: ImportForm,
  destroyOnClose: true,
});
const [PrintTemplateDesignModal, printTemplateDesignModalApi] = useVbenModal({
  connectedComponent: PrintTemplateModal,
  destroyOnClose: true,
});

/** 刷新表格 */
function handleRefresh() {
  querySummaryState.invalidate();
  gridApi.query();
}

/** 导出表格 */
async function handleExport() {
  if (!hasAccessByCodes(['erp:stock-in:export']) || listActionBlocked()) return;
  pendingExportParams.value =
    checkedIds.value.length > 0
      ? { ids: checkedIds.value.join(','), ...buildSortParams() }
      : { ...(await gridApi.formApi.getValues()), ...buildSortParams() };
  exportFieldModalApi
    .setData({
      preserveDecimalPrecision: true,
      loadFields: getStockInExportFields,
      moduleKey: FIELD_PERMISSION_MODULE,
    })
    .open();
}
async function handleExportConfirm(fields: string[]) {
  if (!hasAccessByCodes(['erp:stock-in:export'])) return;
  const data = await exportStockIn({
    ...pendingExportParams.value,
    fields: fields.join(','),
  });
  downloadFileFromBlobPart({ fileName: '其它入库单.xlsx', source: data });
}

/** 新增其它入库单 */
function handleCreate() {
  if (listActionBlocked() || !hasAccessByCodes(['erp:stock-in:create'])) return;
  formModalApi.setData({ type: 'create' }).open();
}

/** 导入 */
function handleImport() {
  if (listActionBlocked() || !hasAccessByCodes(['erp:stock-in:import'])) return;
  importModalApi.open();
}

/** 编辑其它入库单 */
function handleEdit(row: ErpStockInApi.StockIn) {
  formModalApi.setData({ type: 'edit', id: row.id }).open();
}

/** 删除其它入库单 */
function isDeleteAllowed(row: ErpStockInApi.StockIn) {
  return row.status === 10;
}

async function handleDelete(ids: number[], rows: ErpStockInApi.StockIn[] = []) {
  const targetRows =
    rows.length > 0 ? rows.filter((item) => isDeleteAllowed(item)) : [];
  const targetIds =
    rows.length > 0 ? targetRows.map((item) => item.id!).filter(Boolean) : ids;
  const skippedCount = rows.length > 0 ? rows.length - targetRows.length : 0;
  if (targetIds.length === 0) {
    message.warning('当前勾选数据没有可删除项');
    return;
  }
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting'),
    duration: 0,
  });
  try {
    await deleteStockIn(targetIds);
    checkedRows.value = [];
    checkedIds.value = [];
    gridApi.grid?.clearCheckboxRow?.();
    gridApi.grid?.clearCheckboxReserve?.();
    const pager = gridApi.grid?.getProxyInfo?.()?.pager;
    if (
      pager &&
      pager.currentPage > 1 &&
      currentPageRows.value.every((row) => targetIds.includes(row.id!))
    )
      pager.currentPage -= 1;
    message.success(
      skippedCount > 0
        ? `已删除 ${targetIds.length} 条，已跳过 ${skippedCount} 条`
        : $t('ui.actionMessage.deleteSuccess'),
    );
    handleRefresh();
  } finally {
    hideLoading();
  }
}

async function handleConfirm(row: ErpStockInApi.StockIn) {
  if (row.status !== 10) return;
  const hideLoading = message.loading({
    content: '正在生成拣货任务...',
    duration: 0,
  });
  try {
    await confirmStockIn(row.id!);
    message.success('下单确认成功');
    handleRefresh();
  } finally {
    hideLoading();
  }
}

async function handleCancelConfirm(row: ErpStockInApi.StockIn) {
  const hideLoading = message.loading({
    content: '正在撤销确认...',
    duration: 0,
  });
  try {
    await cancelConfirmStockIn(row.id!);
    message.success('撤销确认成功');
    handleRefresh();
  } finally {
    hideLoading();
  }
}

const checkedIds = ref<number[]>([]);
const checkedRows = ref<ErpStockInApi.StockIn[]>([]);
const batchDeleteAllowed = computed(() => checkedRows.value.length > 0);
function handleRowCheckboxChange({
  records,
}: {
  records: ErpStockInApi.StockIn[];
}) {
  checkedRows.value = records;
  checkedIds.value = records.map((item) => item.id!);
}

function clearCheckedRows() {
  checkedIds.value = [];
  checkedRows.value = [];
  gridApi.grid?.clearCheckboxRow?.();
  gridApi.grid?.clearCheckboxReserve?.();
}

async function reloadStockInListColumns(
  rows = currentPageRows.value,
  _fields = hiddenFields.value,
) {
  currentPageRows.value = rows;
  await listColumns.reload();
}
const listColumns = useStockDocumentColumns({
  columns: () => {
    const columns = (useGridColumns(
      hiddenFields.value,
      currentPageRows.value,
    ) || []) as any[];
    for (const column of columns) {
      if (column.field === 'totalCount')
        column.formatter = ({ row }: any) =>
          formatOtherStockListQuantity(
            isQuantityHidden() ? '****' : row.totalCount,
          );
      if (column.field === 'totalWeight')
        column.formatter = ({ row }: any) =>
          formatStockNaturalNumber(row.totalWeight);
    }
    for (const column of columns) {
      if (column.field === 'totalCount')
        column.width = Math.max(
          Number(column.width) || 0,
          ...currentPageRows.value.map(
            (row) =>
              (row.totalCount === null || row.totalCount === undefined
                ? 4
                : Number(row.totalCount).toFixed(2).length) *
                8 +
              32,
          ),
        );
      if (column.field === 'actions' || column.slots?.default === 'actions') {
        const widths = currentPageRows.value.map((row) => {
          if (row.status === 10)
            return (
              (hasAccessByCodes(['erp:stock-in:update']) ? 58 : 0) +
              (hasAccessByCodes(['erp:stock-in:confirm']) ? 84 : 0) +
              (hasAccessByCodes(['erp:stock-in:delete']) ? 58 : 0)
            );
          return row.status === 15 &&
            Number(row.pickedItemCount ?? 0) === 0 &&
            hasAccessByCodes(['erp:stock-in:cancel-confirm'])
            ? 90
            : 0;
        });
        column.width = Math.max(72, ...widths);
      }
    }
    return columns;
  },
  grid: () => gridApi,
  wrapper: () => stockInGridShellRef.value,
  fill: false,
  afterReload: () => restoreSortState(gridApi),
});

/** 查看详情 */
function handleDetail(row: ErpStockInApi.StockIn) {
  formModalApi.setData({ type: 'detail', id: row.id }).open();
}

function openStockInPrintModal(data: {
  businessId?: number | string;
  businessNo?: string;
  itemOrderDirection?: 'asc' | 'desc';
  itemOrderField?: string;
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
} = useErpPrintTemplate<ErpStockInApi.StockIn>({
  moduleKey: PRINT_TEMPLATE_MODULE,
  moduleName: PRINT_MODULE_NAME,
  openModal: openStockInPrintModal,
});

useStockShortcut({
  onCreate: handleCreate,
  onImport: handleImport,
});

function handleSearchEnter(event: KeyboardEvent) {
  submitSearchFormOnEnterAndBlur(event, () => gridApi.formApi.submitForm());
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    commonConfig: { labelWidth: 68 },
    schema: useGridFormSchema(hiddenFields.value),
  },
  gridOptions: {
    pagerConfig: { slots: { sizes: renderStockCandidatePageSizes } },
    columns: useGridColumns(hiddenFields.value, currentPageRows.value),
    customConfig: {
      restoreStore: listColumns.restoreStore,
      storage: {
        fixed: true,
        resizable: true,
        sort: true,
        visible: true,
      },
    },
    height: 'auto',
    keepSource: false,
    autoResize: true,
    fit: false,
    id: 'erp-stock-in-list-v2',
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
        query: async ({ page, sort, sorts }, formValues) => {
          const summaryChanged = querySummaryState.prepare(formValues);
          let pageFailed = false;
          const result = await queryDocumentPage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            includeItems: false,
            ...formValues,
            ...buildSortParams(sorts, sort),
          }).catch((error) => {
            pageFailed = true;
            querySummaryState.cancelPending();
            if (currentPageRows.value.length > 0) {
              return {
                list: currentPageRows.value,
                total:
                  gridApi.grid?.getProxyInfo?.()?.pager?.total ??
                  currentPageRows.value.length,
              };
            }
            throw error;
          });
          currentPageRows.value = result.list || [];
          await reloadStockInListColumns();
          if (!pageFailed && canQueryDocument.value)
            void querySummaryState.load(formValues, summaryChanged);
          return result;
        },
        querySuccess: () => {
          clearCheckedRows();
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
      zoom: true,
      custom: true,
      search: true,
    },
  } as VxeTableGridOptions<ErpStockInApi.StockIn>,
  gridEvents: {
    checkboxAll: handleRowCheckboxChange,
    checkboxChange: handleRowCheckboxChange,
    custom: listColumns.custom,
    zoom: listColumns.queue,
    resizableChange: listColumns.queue,
    sortChange: handleSortChange,
  },
});

let appliedHiddenFields = [...hiddenFields.value];

const { activationRefreshMaskVisible } =
  useVxeActivationRefresh<ErpStockInApi.StockIn>({
    gridApi,
    getParams: async () => ({
      ...(await gridApi.formApi.getValues()),
      ...buildSortParams(),
    }),
    queryPage: (params) =>
      queryDocumentPage({ ...params, includeItems: false }),
    onSuccess: async (rows) => {
      if (!canQueryDocument.value) return;
      currentPageRows.value = rows;
      clearCheckedRows();
      await reloadStockInListColumns(rows);
      await restoreSortState(gridApi);
    },
    onAfterRefresh: () => {
      querySummaryState.invalidate();
      void gridApi.formApi
        .getValues()
        .then((params) => querySummaryState.load(params));
    },
    errorMessage: 'Error occurred while refreshing stock in page:',
  });

loadHiddenFields().then(() => {
  const fields = hiddenFields.value;
  if (isSameFieldSet(appliedHiddenFields, fields)) {
    return;
  }
  appliedHiddenFields = [...fields];
  gridApi.formApi.setState({ schema: useGridFormSchema(fields) });
  void reloadStockInListColumns(currentPageRows.value, fields);
});
watch(canQueryDocument, async (allowed) => {
  permissionEpoch += 1;
  if (allowed) return;
  querySummaryState.cancelPending();
  querySummaryState.invalidate();
  querySummaryState.summary.value = undefined;
  querySummaryState.error.value = false;
  currentPageRows.value = [];
  checkedIds.value = [];
  checkedRows.value = [];
  gridApi.grid?.clearCurrentRow?.();
  gridApi.grid?.clearCheckboxRow?.();
  const pager = gridApi.grid?.getProxyInfo?.()?.pager;
  if (pager) {
    pager.currentPage = 1;
    pager.total = 0;
  }
  await gridApi.grid?.loadData?.([]);
});
</script>

<template>
  <Page auto-content-height>
    <FormModal
      @edit="handleEdit"
      @print="handlePrint"
      @success="handleRefresh"
    />
    <ImportModal @success="handleRefresh" />
    <ExportFieldModal @confirm="handleExportConfirm" />
    <PrintTemplateDesignModal @printed="handleRefresh" />
    <PrintTemplateSelector
      v-model:open="printTemplateSelectOpen"
      v-model:selected-id="selectedPrintTemplateId"
      :templates="printTemplateOptions"
      @cancel="cancelTemplateSelect"
      @confirm="confirmTemplate"
    />
    <div ref="stockInGridShellRef" class="stock-in-grid-shell">
      <Grid
        table-title="其它入库单列表"
        @keydown.enter.capture="handleSearchEnter"
      >
        <template #toolbar-tools>
          <TableAction
            :actions="[
              {
                label: '新增',
                type: 'primary',
                icon: ACTION_ICON.ADD,
                auth: ['erp:stock-in:create'],
                tooltip: 'Insert 新增',
                title: 'Insert 新增',
                onClick: handleCreate,
              },
              {
                label: '导入',
                type: 'primary',
                icon: ACTION_ICON.UPLOAD,
                auth: ['erp:stock-in:import'],
                tooltip: 'I 导入',
                title: 'I 导入',
                onClick: handleImport,
              },
              {
                label: '导出',
                type: 'primary',
                icon: ACTION_ICON.DOWNLOAD,
                auth: ['erp:stock-in:export'],
                onClick: handleExport,
              },
              {
                label: '打印模板',
                type: 'primary',
                icon: ACTION_ICON.EDIT,
                auth: ['erp:stock-in:print-template'],
                onClick: handleOpenPrintTemplateDesigner,
              },
              {
                label: '批量删除',
                type: 'primary',
                danger: true,
                ifShow: () => batchDeleteAllowed,
                icon: ACTION_ICON.DELETE,
                auth: ['erp:stock-in:delete'],
                popConfirm: {
                  title: `是否删除所选中数据？不可删除数据将自动跳过`,
                  confirm: handleDelete.bind(null, checkedIds, checkedRows),
                },
              },
            ]"
          />
        </template>
        <template #no="{ row }">
          <button
            type="button"
            class="stock-in-number-link"
            :title="row.no || ''"
            @click.stop="handleDetail(row)"
          >
            {{ row.no || '-' }}
          </button>
        </template>
        <template #printAction="{ row }">
          <Button
            v-access:code="['erp:stock-in:print']"
            class="stock-in-action-link"
            type="link"
            @click.stop="handlePrint(row)"
          >
            打印
          </Button>
        </template>
        <template #actions="{ row }">
          <TableAction
            :actions="[
              {
                label: $t('common.edit'),
                type: 'link',
                icon: ACTION_ICON.EDIT,
                auth: ['erp:stock-in:update'],
                ifShow: () => row.status === 10,
                onClick: handleEdit.bind(null, row),
              },
              {
                label: '下单确认',
                type: 'link',
                icon: ACTION_ICON.AUDIT,
                auth: ['erp:stock-in:confirm'],
                ifShow: () => row.status === 10,
                popConfirm: {
                  title: `确认${row.no}并生成拣货任务吗？`,
                  confirm: handleConfirm.bind(null, row),
                },
              },
              {
                label: '撤销确认',
                icon: ACTION_ICON.EDIT,
                type: 'link',
                auth: ['erp:stock-in:cancel-confirm'],
                ifShow: () =>
                  row.status === 15 && Number(row.pickedItemCount ?? 0) === 0,
                popConfirm: {
                  title: `确认撤销${row.no}的下单确认吗？`,
                  confirm: handleCancelConfirm.bind(null, row),
                },
              },
              {
                label: $t('common.delete'),
                type: 'link',
                danger: true,
                icon: ACTION_ICON.DELETE,
                auth: ['erp:stock-in:delete'],
                ifShow: () => isDeleteAllowed(row),
                popConfirm: {
                  title: $t('ui.actionMessage.deleteConfirm', [row.no]),
                  confirm: handleDelete.bind(null, [row.id!], [row]),
                },
              },
            ]"
          />
        </template>
        <template #bottom>
          <StockListQuerySummary
            :error="querySummaryState.error.value"
            :items="querySummaryItems"
            :loading="querySummaryState.loading.value"
            @retry="querySummaryState.retry"
          />
        </template>
      </Grid>
      <ErpActivationRefreshMask
        v-if="activationRefreshMaskVisible"
        class="stock-in-activation-mask"
      />
    </div>
  </Page>
</template>

<style scoped>
.stock-in-grid-shell {
  position: relative;
  height: 100%;
  min-height: 100%;
}

:deep(.vxe-table--render-default),
:deep(.vxe-grid--form-wrapper) {
  font-size: 12px;
}

@media (min-width: 1280px) {
  :deep(.vxe-grid--form-wrapper form > .grid) {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}

:deep(.vxe-grid--form-wrapper label),
:deep(.vxe-grid--form-wrapper .ant-input),
:deep(.vxe-grid--form-wrapper .ant-picker),
:deep(.vxe-grid--form-wrapper .ant-picker-input > input),
:deep(.vxe-grid--form-wrapper .ant-select),
:deep(.vxe-grid--form-wrapper .ant-btn),
:deep(.vxe-grid--form-wrapper .vben-link) {
  font-size: 12px;
}

:deep(.vxe-grid--form-wrapper label) {
  line-height: 20px;
}

:deep(.vxe-grid--form-wrapper .ant-input-affix-wrapper) {
  min-height: 28px;
  padding: 2px 8px;
  font-size: 12px;
}

:deep(.vxe-grid--form-wrapper .ant-input-affix-wrapper .ant-input) {
  line-height: 22px;
}

:deep(.vxe-grid--form-wrapper .ant-select-single) {
  height: 28px;
}

:deep(.vxe-grid--form-wrapper .ant-select-single .ant-select-selector) {
  height: 28px;
  padding: 0 8px;
  font-size: 12px;
}

:deep(
  .vxe-grid--form-wrapper .ant-select-single .ant-select-selection-search-input
) {
  height: 26px;
}

:deep(.vxe-grid--form-wrapper .ant-select-single .ant-select-selection-item),
:deep(
  .vxe-grid--form-wrapper .ant-select-single .ant-select-selection-placeholder
) {
  line-height: 26px;
}

:global(.stock-in-search-select-dropdown .ant-select-item),
:global(.stock-in-search-select-dropdown .ant-empty-description) {
  font-size: 12px;
}

:deep(.vxe-grid--form-wrapper .ant-picker) {
  height: 28px;
  padding: 2px 8px;
}

:deep(.vxe-grid--form-wrapper .ant-btn),
:deep(.vxe-toolbar .table-actions .ant-btn) {
  height: 28px;
  padding: 2px 10px;
  font-size: 12px;
  line-height: 20px;
}

:deep(.vxe-toolbar .vxe-tool--item-wrapper) {
  font-size: 12px;
}

:deep(.vxe-toolbar .vxe-button) {
  box-sizing: border-box;
  width: 28px !important;
  min-width: 28px !important;
  height: 28px;
  padding: 0;
  font-size: 12px;
}

:deep(.vxe-header--column .vxe-cell--title) {
  white-space: nowrap;
}

:deep(.vxe-header--column.is--sortable .vxe-cell--title) {
  color: #1677ff;
}

:deep(.vxe-header--column .vxe-cell--sort) {
  display: none;
}

:deep(.vxe-body--column .table-actions .ant-btn-link) {
  height: auto;
  padding: 0;
  font-size: 12px;
}

:deep(.stock-in-action-link) {
  height: auto;
  padding: 0;
  font-size: 12px;
  line-height: inherit;
}

.stock-in-number-link {
  display: block;
  max-width: 100%;
  padding: 0;
  overflow: hidden;
  color: hsl(var(--primary));
  font: inherit;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  background: transparent;
  border: 0;
}

.stock-in-number-link:hover,
.stock-in-number-link:focus-visible {
  text-decoration: underline;
}

:deep(.vxe-grid--bottom-wrapper) {
  position: sticky;
  z-index: 4;
  bottom: 36px;
  background: hsl(var(--card));
}

:deep(.vxe-grid--pager-wrapper) {
  position: sticky;
  z-index: 5;
  bottom: 0;
  margin-top: 0 !important;
  background: hsl(var(--card));
  box-shadow: 0 -2px 8px rgb(0 0 0 / 8%);
}

.stock-in-bottom-summary {
  display: flex;
  min-height: 40px;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 4px 18px;
  padding: 5px 8px;
  font-size: 12px;
  line-height: 18px;
  border-top: 1px solid hsl(var(--border));
}

.stock-in-bottom-summary strong {
  margin-right: auto;
}

@media (max-width: 768px) {
  .stock-in-bottom-summary {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
