<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpStockOutApi } from '#/api/erp/stock/out';

import { computed, provide, ref, watch } from 'vue';

import { useAccess } from '@vben/access';
import { DocAlert, Page, useVbenModal } from '@vben/common-ui';
import { downloadFileFromBlobPart } from '@vben/utils';

import { Button, message } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  cancelConfirmStockOut,
  confirmStockOut,
  deleteStockOut,
  exportStockOut,
  getStockOutExportFields,
  getStockOutPage,
  getStockOutSummary,
} from '#/api/erp/stock/out';
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
import {
  applyStockListColumnPermission,
  applyStockQueryFieldPermission,
} from '#/views/erp/stock/utils/field-permission';
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

/** ERP 其它出库单列表 */
defineOptions({ name: 'ErpStockOut' });

provide(CANDIDATE_FOCUS_KEY, ref(true));

const FIELD_PERMISSION_MODULE = 'erp_stock_out';
const { hiddenFields, loadHiddenFields } = useFieldPermission(
  FIELD_PERMISSION_MODULE,
);
const PRINT_TEMPLATE_MODULE = 'stock_out';
const PRINT_MODULE_NAME = '其它出库单';

const { buildSortParams, handleSortChange, restoreSortState } =
  createVxeHeaderSort({
    no: 'no',
    outTime: 'outTime',
    updateTime: 'updateTime',
    status: 'status',
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

const currentPageRows = ref<ErpStockOutApi.StockOut[]>([]);
const stockOutGridShellRef = ref<HTMLElement>();
const checkedRows = ref<ErpStockOutApi.StockOut[]>([]);
const checkedIds = computed(() => checkedRows.value.map((item) => item.id!));
const canBatchDelete = computed(() => checkedRows.value.length > 0);

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
  hasAccessByCodes(['erp:stock-out:query']),
);
const listLoading = ref(false);
let permissionEpoch = 0;
async function queryDocumentPage(params: any) {
  const epoch = permissionEpoch;
  await loadHiddenFields();
  if (!canQueryDocument.value) return { list: [], total: 0 };
  listLoading.value = true;
  try {
    const result = await getStockOutPage(params);
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
    ? getStockOutSummary(params, signal)
    : Promise.resolve({ totalCount: null, totalPrice: null }),
);
const querySummaryItems = computed(() => {
  if (!canQueryDocument.value) return [];
  const value = querySummaryState.summary.value;
  if (!value) return [];
  return [
    {
      key: 'totalCount',
      label: '出库数量',
      value: formatOtherStockListQuantity(
        isQuantityHidden() ? '****' : value.totalCount,
      ),
    },
    {
      key: 'totalPrice',
      label: '出库金额',
      value: formatSummaryValue(value.totalPrice),
    },
  ];
});

function normalizeSearchParams(values: Record<string, any>) {
  const params: Record<string, any> = {};
  Object.entries(values || {}).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (typeof value === 'string') {
      const normalized = value.trim();
      if (normalized) params[key] = normalized;
      return;
    }
    if (Array.isArray(value)) {
      if (value.length > 0) params[key] = value;
      return;
    }
    params[key] = value;
  });
  return params;
}

/** 刷新表格 */
function handleRefresh() {
  querySummaryState.invalidate();
  gridApi.query();
}

/** 导出表格 */
async function handleExport() {
  if (!hasAccessByCodes(['erp:stock-out:export']) || listActionBlocked())
    return;
  pendingExportParams.value =
    checkedIds.value.length > 0
      ? { ids: checkedIds.value.join(','), ...buildSortParams() }
      : { ...(await gridApi.formApi.getValues()), ...buildSortParams() };
  exportFieldModalApi
    .setData({
      preserveDecimalPrecision: true,
      loadFields: getStockOutExportFields,
      moduleKey: FIELD_PERMISSION_MODULE,
    })
    .open();
}
async function handleExportConfirm(fields: string[]) {
  if (!hasAccessByCodes(['erp:stock-out:export'])) return;
  const data = await exportStockOut({
    ...pendingExportParams.value,
    fields: fields.join(','),
  });
  downloadFileFromBlobPart({ fileName: '其它出库单.xlsx', source: data });
}

/** 新增其它出库单 */
function handleCreate() {
  if (listActionBlocked() || !hasAccessByCodes(['erp:stock-out:create']))
    return;
  formModalApi.setData({ type: 'create' }).open();
}

/** 导入 */
function handleImport() {
  if (listActionBlocked() || !hasAccessByCodes(['erp:stock-out:import']))
    return;
  importModalApi.open();
}

/** 编辑其它出库单 */
function handleEdit(row: ErpStockOutApi.StockOut) {
  formModalApi.setData({ type: 'edit', id: row.id }).open();
}

function handleContinueBuy(row: ErpStockOutApi.StockOut) {
  if (row.status !== 10) {
    message.warning('已确认的其它出库单不能继续选购');
    return;
  }
  handleEdit(row);
}

function openStockOutPrintModal(data: {
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
} = useErpPrintTemplate<ErpStockOutApi.StockOut>({
  moduleKey: PRINT_TEMPLATE_MODULE,
  moduleName: PRINT_MODULE_NAME,
  openModal: openStockOutPrintModal,
});

/** 删除其它出库单 */
function isDeleteAllowed(row: ErpStockOutApi.StockOut) {
  return row.status === 10;
}

async function handleDelete(
  ids: number[],
  rows: ErpStockOutApi.StockOut[] = [],
) {
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
    await deleteStockOut(targetIds);
    checkedRows.value = [];
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

function handleBatchDelete() {
  return handleDelete(checkedIds.value, checkedRows.value);
}

function shouldShowBatchDelete() {
  return canBatchDelete.value;
}

async function handleConfirm(row: ErpStockOutApi.StockOut) {
  if (row.status !== 10) return;
  const hideLoading = message.loading({
    content: '正在生成拣货任务...',
    duration: 0,
  });
  try {
    await confirmStockOut(row.id!);
    message.success('下单确认成功');
    handleRefresh();
  } finally {
    hideLoading();
  }
}

async function handleCancelConfirm(row: ErpStockOutApi.StockOut) {
  const hideLoading = message.loading({
    content: '正在撤销确认...',
    duration: 0,
  });
  try {
    await cancelConfirmStockOut(row.id!);
    message.success('撤销确认成功');
    handleRefresh();
  } finally {
    hideLoading();
  }
}

function handleRowCheckboxChange({
  records,
}: {
  records: ErpStockOutApi.StockOut[];
}) {
  checkedRows.value = records;
}

/** 查看详情 */
function handleDetail(row: ErpStockOutApi.StockOut) {
  formModalApi.setData({ type: 'detail', id: row.id }).open();
}

async function reloadStockOutListColumns(
  rows = currentPageRows.value,
  _fields = hiddenFields.value,
) {
  currentPageRows.value = rows;
  await listColumns.reload();
}
const listColumns = useStockDocumentColumns({
  columns: () => {
    const columns = (applyStockListColumnPermission(
      useGridColumns(currentPageRows.value),
      hiddenFields.value,
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
              (hasAccessByCodes(['erp:stock-out:update']) ? 58 : 0) +
              (hasAccessByCodes(['erp:stock-out:confirm']) ? 84 : 0)
            );
          return row.status === 15 &&
            Number(row.pickedItemCount ?? 0) === 0 &&
            hasAccessByCodes(['erp:stock-out:cancel-confirm'])
            ? 90
            : 0;
        });
        column.width = Math.max(72, ...widths);
      }
    }
    return columns;
  },
  grid: () => gridApi,
  wrapper: () => stockOutGridShellRef.value,
  fill: false,
  afterReload: () => restoreSortState(gridApi),
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
    schema: applyStockQueryFieldPermission(
      useGridFormSchema(),
      hiddenFields.value,
    ),
  },
  gridOptions: {
    pagerConfig: { slots: { sizes: renderStockCandidatePageSizes } },
    columns: useGridColumns(currentPageRows.value),
    customConfig: {
      restoreStore: listColumns.restoreStore,
      storage: {
        fixed: true,
        resizable: true,
        sort: true,
        visible: true,
      },
    },
    autoResize: true,
    fit: false,
    height: 'auto',
    id: 'erp-stock-out-list-v2',
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
        query: async ({ page, sort, sorts }, formValues) => {
          const params = normalizeSearchParams(formValues);
          const summaryChanged = querySummaryState.prepare(params);
          let pageFailed = false;
          const result = await queryDocumentPage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            includeItems: false,
            ...params,
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
          checkedRows.value = [];
          currentPageRows.value = result.list || [];
          await reloadStockOutListColumns();
          if (!pageFailed && canQueryDocument.value)
            void querySummaryState.load(params, summaryChanged);
          return result;
        },
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
    checkboxConfig: {
      highlight: true,
      range: true,
    },
    toolbarConfig: {
      refresh: true,
      zoom: true,
      custom: true,
      search: true,
    },
  } as VxeTableGridOptions<ErpStockOutApi.StockOut>,
  gridEvents: {
    checkboxAll: handleRowCheckboxChange,
    checkboxChange: handleRowCheckboxChange,
    custom: listColumns.custom,
    zoom: listColumns.queue,
    resizableChange: listColumns.queue,
    sortChange: handleSortChange,
  },
});

const { activationRefreshMaskVisible } =
  useVxeActivationRefresh<ErpStockOutApi.StockOut>({
    gridApi,
    getParams: async () => ({
      ...(await gridApi.formApi.getValues()),
      ...buildSortParams(),
    }),
    queryPage: (params) =>
      queryDocumentPage({ ...params, includeItems: false }),
    onSuccess: async (rows) => {
      if (!canQueryDocument.value) return;
      checkedRows.value = [];
      currentPageRows.value = rows;
      await reloadStockOutListColumns(rows);
      gridApi.grid?.clearCheckboxRow?.();
      gridApi.grid?.clearCheckboxReserve?.();
      await restoreSortState(gridApi);
    },
    onAfterRefresh: () => {
      querySummaryState.invalidate();
      void gridApi.formApi
        .getValues()
        .then((params) =>
          querySummaryState.load(normalizeSearchParams(params)),
        );
    },
    errorMessage: 'Error occurred while refreshing stock out page:',
  });

watch(canQueryDocument, async (allowed) => {
  permissionEpoch += 1;
  if (allowed) return;
  querySummaryState.cancelPending();
  querySummaryState.invalidate();
  querySummaryState.summary.value = undefined;
  querySummaryState.error.value = false;
  currentPageRows.value = [];
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
loadHiddenFields().then(() => {
  gridApi.formApi.setState({
    schema: applyStockQueryFieldPermission(
      useGridFormSchema(),
      hiddenFields.value,
    ),
  });
  void listColumns.reload();
});
</script>

<template>
  <Page auto-content-height>
    <template #doc>
      <DocAlert
        title="【库存】其它入库、其它出库"
        url="https://doc.iocoder.cn/erp/stock-in-out/"
      />
    </template>

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
    <div ref="stockOutGridShellRef" class="stock-out-grid-shell">
      <Grid
        table-title="其它出库单列表"
        @keydown.enter.capture="handleSearchEnter"
      >
        <template #toolbar-tools>
          <TableAction
            :actions="[
              {
                label: '新增',
                type: 'primary',
                icon: ACTION_ICON.ADD,
                auth: ['erp:stock-out:create'],
                tooltip: 'Insert 新增',
                title: 'Insert 新增',
                onClick: handleCreate,
              },
              {
                label: '导入',
                type: 'primary',
                icon: ACTION_ICON.UPLOAD,
                auth: ['erp:stock-out:import'],
                tooltip: 'I 导入',
                title: 'I 导入',
                onClick: handleImport,
              },
              {
                label: '导出',
                type: 'primary',
                icon: ACTION_ICON.DOWNLOAD,
                auth: ['erp:stock-out:export'],
                onClick: handleExport,
              },
              {
                label: '打印模板',
                type: 'primary',
                icon: ACTION_ICON.EDIT,
                auth: ['erp:stock-out:print-template'],
                onClick: handleOpenPrintTemplateDesigner,
              },
              {
                label: '批量删除',
                type: 'primary',
                danger: true,
                ifShow: shouldShowBatchDelete,
                icon: ACTION_ICON.DELETE,
                auth: ['erp:stock-out:delete'],
                popConfirm: {
                  title: `是否删除所选中数据？不可删除数据将自动跳过`,
                  confirm: handleBatchDelete,
                },
              },
            ]"
          />
        </template>
        <template #no="{ row }">
          <button
            type="button"
            class="stock-out-number-link"
            :title="row.no || ''"
            @click.stop="handleDetail(row)"
          >
            {{ row.no || '-' }}
          </button>
        </template>
        <template #deleteAction="{ row }">
          <TableAction
            :actions="[
              {
                label: $t('common.delete'),
                type: 'link',
                danger: true,
                auth: ['erp:stock-out:delete'],
                ifShow: () => isDeleteAllowed(row),
                popConfirm: {
                  title: $t('ui.actionMessage.deleteConfirm', [row.no]),
                  confirm: handleDelete.bind(null, [row.id!], [row]),
                },
              },
            ]"
          />
        </template>
        <template #printAction="{ row }">
          <Button
            v-access:code="['erp:stock-out:print']"
            class="stock-out-action-link"
            type="link"
            @click.stop="handlePrint(row)"
          >
            打印
          </Button>
        </template>
        <template #continueBuyAction="{ row }">
          <TableAction
            :actions="[
              {
                label: '继续选购',
                type: 'link',
                auth: ['erp:stock-out:update'],
                ifShow: () => row.status === 10,
                onClick: handleContinueBuy.bind(null, row),
              },
            ]"
          />
        </template>
        <template #actions="{ row }">
          <TableAction
            :actions="[
              {
                label: $t('common.edit'),
                type: 'link',
                icon: ACTION_ICON.EDIT,
                auth: ['erp:stock-out:update'],
                ifShow: () => row.status === 10,
                onClick: handleEdit.bind(null, row),
              },
              {
                label: '下单确认',
                type: 'link',
                icon: ACTION_ICON.AUDIT,
                auth: ['erp:stock-out:confirm'],
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
                auth: ['erp:stock-out:cancel-confirm'],
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
                auth: ['erp:stock-out:delete'],
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
        class="stock-out-activation-mask"
      />
    </div>
  </Page>
</template>

<style scoped>
.stock-out-grid-shell {
  position: relative;
  height: 100%;
  min-height: 100%;
}

:deep(.vxe-table--render-default),
:deep(.vxe-grid--form-wrapper),
:deep(.vxe-toolbar) {
  font-size: 12px;
}

@media (min-width: 1280px) {
  :deep(.vxe-grid--form-wrapper form > .grid) {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}

:deep(.vxe-grid--form-wrapper label),
:deep(.vxe-grid--form-wrapper .ant-input),
:deep(.vxe-grid--form-wrapper .ant-input-number-input),
:deep(.vxe-grid--form-wrapper .ant-picker),
:deep(.vxe-grid--form-wrapper .ant-picker-input > input),
:deep(.vxe-grid--form-wrapper .ant-select),
:deep(.vxe-grid--form-wrapper .ant-btn),
:deep(.vxe-grid--form-wrapper .vben-link) {
  font-size: 12px;
}

:deep(.vxe-grid--form-wrapper .ant-input-affix-wrapper),
:deep(.vxe-grid--form-wrapper .ant-input-number),
:deep(.vxe-grid--form-wrapper .ant-picker),
:deep(.vxe-grid--form-wrapper .ant-select-single),
:deep(.vxe-grid--form-wrapper .ant-select-single .ant-select-selector),
:deep(.vxe-grid--form-wrapper .ant-btn) {
  min-height: 28px;
  height: 28px;
  font-size: 12px;
}

:deep(.vxe-grid--form-wrapper .ant-input-affix-wrapper),
:deep(.vxe-grid--form-wrapper .ant-picker),
:deep(.vxe-grid--form-wrapper .ant-select-single .ant-select-selector) {
  padding: 2px 8px;
}

:deep(.vxe-grid--form-wrapper .ant-select-selection-item),
:deep(.vxe-grid--form-wrapper .ant-select-selection-placeholder) {
  line-height: 26px;
}

:global(.stock-out-search-select-dropdown .ant-select-item),
:global(.stock-out-search-select-dropdown .ant-select-tree),
:global(.stock-out-search-select-dropdown .ant-empty-description) {
  font-size: 12px;
}

:deep(.vxe-toolbar .table-actions .ant-btn) {
  min-height: 28px;
  height: 28px;
  padding: 2px 10px;
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
  color: hsl(var(--primary));
}

:deep(.vxe-header--column .vxe-cell--sort) {
  display: none;
}

:deep(.vxe-body--column .table-actions .ant-btn-link) {
  height: auto;
  padding: 0;
  font-size: 12px;
}

:deep(.stock-out-action-link) {
  height: auto;
  padding: 0;
  font-size: 12px;
  line-height: inherit;
}

:deep(.stock-out-number-link) {
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

:deep(.stock-out-number-link:hover),
:deep(.stock-out-number-link:focus-visible) {
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

.stock-out-bottom-summary {
  display: flex;
  min-height: 40px;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 4px 18px;
  padding: 5px 8px;
  border-top: 1px solid hsl(var(--border));
  font-size: 12px;
  line-height: 18px;
}

.stock-out-bottom-summary strong {
  margin-right: auto;
}

@media (max-width: 768px) {
  .stock-out-bottom-summary {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
