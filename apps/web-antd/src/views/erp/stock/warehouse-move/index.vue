<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpWarehouseMoveApi } from '#/api/erp/stock/warehouse-move';

import { computed, provide, ref } from 'vue';

import { useAccess } from '@vben/access';
import { DocAlert, Page, useVbenModal } from '@vben/common-ui';
import { downloadFileFromBlobPart } from '@vben/utils';

import { Button, message } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  cancelConfirmWarehouseMove,
  confirmWarehouseMove,
  deleteWarehouseMove,
  exportWarehouseMove,
  getWarehouseMoveExportFields,
  getWarehouseMovePage,
  getWarehouseMoveSummary,
  WAREHOUSE_MOVE_STATUS,
} from '#/api/erp/stock/warehouse-move';
import { useFieldPermission } from '#/composables/useFieldPermission';
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
import { isWarehouseMoveRowDeletable } from './warehouse-move-list-ui';

defineOptions({ name: 'ErpWarehouseMove' });

provide(CANDIDATE_FOCUS_KEY, ref(true));

const { buildSortParams, handleSortChange, restoreSortState } =
  createVxeHeaderSort({
    no: 'no',
    moveTime: 'moveTime',
    fromWarehouseName: 'fromWarehouseName',
    toWarehouseName: 'toWarehouseName',
    handlerName: 'handlerName',
    itemCount: 'itemCount',
    totalCount: 'totalCount',
    totalCostAmount: 'totalCostAmount',
    totalPrice: 'totalPrice',
    status: 'status',
    approveUserName: 'approveUserName',
    approveTime: 'approveTime',
    remark: 'remark',
  });

const FIELD_PERMISSION_MODULE = 'erp_warehouse_move';
const PRINT_TEMPLATE_MODULE = 'warehouse_move';
const PRINT_MODULE_NAME = '仓库移货单';
const { hiddenFields, loadHiddenFields } = useFieldPermission(
  FIELD_PERMISSION_MODULE,
);
const checkedIds = ref<number[]>([]);
const checkedRows = ref<ErpWarehouseMoveApi.WarehouseMove[]>([]);
const currentPageRows = ref<ErpWarehouseMoveApi.WarehouseMove[]>([]);
const pendingExportParams = ref<Record<string, any>>({});
const warehouseMoveGridShellRef = ref<HTMLElement>();

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

const [ImportModal, importModalApi] = useVbenModal({
  connectedComponent: ImportForm,
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

function formatNumber(value?: null | number | string, fractionDigits = 2) {
  if (value === null || value === undefined) return '****';
  return Number(value).toLocaleString('zh-CN', {
    maximumFractionDigits: fractionDigits,
    minimumFractionDigits: fractionDigits,
  });
}

function formatRows(value?: null | number | string) {
  return value === null || value === undefined
    ? '****'
    : `${Number(value).toFixed(0)}`;
}

const querySummaryState = useStockQuerySummary((params, signal) =>
  getWarehouseMoveSummary(params, signal),
);
const summaryItems = computed(() => {
  const value = querySummaryState.summary.value;
  if (!value) return [];
  return [
    { key: 'totalRows', label: '总单数', value: formatRows(value.totalRows) },
    { key: 'totalItems', label: '总项数', value: formatRows(value.totalItems) },
    {
      key: 'totalCount',
      label: '移货数量',
      value: formatStockNaturalNumber(value.totalCount),
    },
    {
      key: 'totalCostAmount',
      label: '成本金额',
      value: formatNumber(value.totalCostAmount),
    },
    {
      key: 'totalPrice',
      label: '移货金额',
      value: formatNumber(value.totalPrice),
    },
  ];
});
const canBatchDelete = computed(() => checkedRows.value.length > 0);

function handleRefresh() {
  querySummaryState.invalidate();
  gridApi.query();
}

const listLoading = ref(false);
const { hasAccessByCodes } = useAccess();
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
function handleCreate() {
  if (listActionBlocked() || !hasAccessByCodes(['erp:warehouse-move:create']))
    return;
  formModalApi.setData({ type: 'create' }).open();
}

function handleImport() {
  if (listActionBlocked() || !hasAccessByCodes(['erp:warehouse-move:create']))
    return;
  importModalApi.open();
}

function handleEdit(row: ErpWarehouseMoveApi.WarehouseMove) {
  formModalApi.setData({ id: row.id, type: 'edit' }).open();
}

function handleDetail(row: ErpWarehouseMoveApi.WarehouseMove) {
  formModalApi.setData({ id: row.id, type: 'detail' }).open();
}

function openWarehouseMovePrintModal(data: {
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
} = useErpPrintTemplate<ErpWarehouseMoveApi.WarehouseMove>({
  moduleKey: PRINT_TEMPLATE_MODULE,
  moduleName: PRINT_MODULE_NAME,
  openModal: openWarehouseMovePrintModal,
});

function isDeleteAllowed(row: ErpWarehouseMoveApi.WarehouseMove) {
  return isWarehouseMoveRowDeletable(row);
}

function handleRowCheckboxChange({
  records,
}: {
  records: ErpWarehouseMoveApi.WarehouseMove[];
}) {
  checkedRows.value = records;
  checkedIds.value = records.map((item) => item.id!).filter(Boolean);
}

async function handleDelete(
  ids: number[],
  rows: ErpWarehouseMoveApi.WarehouseMove[] = [],
) {
  const targetRows =
    rows.length > 0 ? rows.filter((row) => isDeleteAllowed(row)) : [];
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
    await deleteWarehouseMove(targetIds);
    message.success(
      skippedCount > 0
        ? `已删除 ${targetIds.length} 条，已跳过 ${skippedCount} 条`
        : $t('ui.actionMessage.deleteSuccess'),
    );
    checkedIds.value = [];
    checkedRows.value = [];
    gridApi.grid.clearCheckboxRow?.();
    gridApi.grid.clearCheckboxReserve?.();
    const currentPage = Number(
      gridApi.grid.getProxyInfo?.()?.pager?.currentPage ?? 1,
    );
    if (targetIds.length >= currentPageRows.value.length && currentPage > 1)
      gridApi.setGridOptions({ pagerConfig: { currentPage: currentPage - 1 } });
    handleRefresh();
  } catch (error) {
    const reasons = [
      (error as any)?.response?.data?.msg,
      (error as any)?.data?.msg,
      (error as any)?.message,
      typeof error === 'string' ? error : undefined,
    ];
    message.error(
      reasons.find(
        (value) =>
          typeof value === 'string' &&
          value.trim() &&
          !value.startsWith('[object '),
      ) || '删除失败，请稍后重试',
    );
  } finally {
    hideLoading();
  }
}

async function handleConfirm(row: ErpWarehouseMoveApi.WarehouseMove) {
  const hideLoading = message.loading({
    content: '正在生成仓库移货拣货任务',
    duration: 0,
  });
  try {
    await confirmWarehouseMove(row.id!);
    message.success('下单确认成功，已生成拣货任务');
    handleRefresh();
  } finally {
    hideLoading();
  }
}

async function handleCancelConfirm(row: ErpWarehouseMoveApi.WarehouseMove) {
  const hideLoading = message.loading({
    content: '正在撤销下单确认',
    duration: 0,
  });
  try {
    await cancelConfirmWarehouseMove(row.id!);
    message.success('已撤销下单确认');
    handleRefresh();
  } finally {
    hideLoading();
  }
}

async function handleExport() {
  const selectedIds = checkedIds.value;
  pendingExportParams.value =
    selectedIds.length > 0
      ? { ids: selectedIds.join(','), ...buildSortParams() }
      : { ...(await gridApi.formApi.getValues()), ...buildSortParams() };
  exportFieldModalApi
    .setData({
      preserveDecimalPrecision: true,
      loadFields: getWarehouseMoveExportFields,
      moduleKey: FIELD_PERMISSION_MODULE,
    })
    .open();
}

async function handleExportConfirm(fields: string[]) {
  const data = await exportWarehouseMove({
    ...pendingExportParams.value,
    fields: fields.join(','),
  });
  downloadFileFromBlobPart({ fileName: '仓库移货单.xlsx', source: data });
}

function handleSearchEnter(event: KeyboardEvent) {
  submitSearchFormOnEnterAndBlur(event, () => gridApi.formApi.submitForm());
}

useStockShortcut({
  onCreate: handleCreate,
  onImport: handleImport,
});

async function reloadWarehouseMoveListColumns(
  rows = currentPageRows.value,
  _fields = hiddenFields.value,
) {
  currentPageRows.value = rows;
  await listColumns.reload();
}

function listDefaultColumns() {
  const candidates = currentPageRows.value;
  let maximum = 0;
  for (const row of candidates) {
    const labels: string[] = [];
    if (
      [0, 10].includes(Number(row.status)) &&
      hasAccessByCodes(['erp:warehouse-move:update'])
    )
      labels.push('编辑');
    if (row.status === 10 && hasAccessByCodes(['erp:warehouse-move:confirm']))
      labels.push('下单确认');
    if (
      row.status === 15 &&
      Number(row.pickedItemCount || 0) === 0 &&
      hasAccessByCodes(['erp:warehouse-move:cancel-confirm'])
    )
      labels.push('撤销确认');
    maximum = Math.max(
      maximum,
      labels.reduce((width, label) => width + label.length * 12 + 32, 16),
    );
  }
  return (useGridColumns(hiddenFields.value, currentPageRows.value) || [])
    .filter((column: any) => column.visible !== false)
    .map((column: any) =>
      column.field === 'actions'
        ? {
            ...column,
            width: Math.max(64, maximum),
            minWidth: Math.max(64, maximum),
          }
        : column,
    );
}
const listColumns = useStockDocumentColumns({
  columns: listDefaultColumns,
  grid: () => gridApi,
  wrapper: () => warehouseMoveGridShellRef.value,
});
const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    commonConfig: { labelWidth: 84 },
    schema: useGridFormSchema(),
    collapsed: true,
    collapsedRows: 2,
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
    fit: false,
    height: 'auto',
    id: 'erp-stock-warehouse-move-list-v2',
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
          listLoading.value = true;
          try {
            const summaryChanged = querySummaryState.prepare(formValues);
            let pageFailed = false;
            const queryParams = {
              pageNo: page.currentPage,
              pageSize: page.pageSize,
              includeItems: false,
              ...formValues,
              ...buildSortParams(sorts, sort),
            };
            const pageResult = await getWarehouseMovePage(queryParams).catch(
              (error) => {
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
              },
            );
            currentPageRows.value = pageResult.list || [];
            await reloadWarehouseMoveListColumns();
            if (!pageFailed)
              void querySummaryState.load(formValues, summaryChanged);
            return pageResult;
          } finally {
            listLoading.value = false;
          }
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
      isCurrent: true,
      isHover: true,
      keyField: 'id',
    },
    rowClassName: ({ row }) =>
      row.status === WAREHOUSE_MOVE_STATUS.DRAFT
        ? 'warehouse-move-draft-row'
        : '',
    toolbarConfig: {
      custom: true,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<ErpWarehouseMoveApi.WarehouseMove>,
  gridEvents: {
    custom: listColumns.custom,
    resizableChange: listColumns.queue,
    zoom: listColumns.queue,
    checkboxAll: handleRowCheckboxChange,
    checkboxChange: handleRowCheckboxChange,
    sortChange: handleSortChange,
  },
});

let appliedHiddenFields = [...hiddenFields.value];

const { activationRefreshMaskVisible } =
  useVxeActivationRefresh<ErpWarehouseMoveApi.WarehouseMove>({
    gridApi,
    getParams: async () => ({
      ...(await gridApi.formApi.getValues()),
      ...buildSortParams(),
    }),
    queryPage: (params) =>
      getWarehouseMovePage({ ...params, includeItems: false }),
    onSuccess: async (rows) => {
      currentPageRows.value = rows;
      checkedIds.value = [];
      checkedRows.value = [];
      gridApi.grid?.clearCheckboxRow?.();
      gridApi.grid?.clearCheckboxReserve?.();
      await reloadWarehouseMoveListColumns(rows);
      await restoreSortState(gridApi);
    },
    onAfterRefresh: () => {
      querySummaryState.invalidate();
      void gridApi.formApi
        .getValues()
        .then((params) => querySummaryState.load(params));
    },
    onFirstActivated: () => {},
    errorMessage: 'Error occurred while refreshing warehouse move page:',
  });

loadHiddenFields().then(() => {
  const fields = hiddenFields.value;
  if (isSameFieldSet(appliedHiddenFields, fields)) {
    return;
  }
  appliedHiddenFields = [...fields];
  void reloadWarehouseMoveListColumns(currentPageRows.value, fields);
});
</script>

<template>
  <Page auto-content-height>
    <template #doc>
      <DocAlert
        title="【库存】仓库移货单"
        url="https://doc.iocoder.cn/erp/stock/"
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
    <div ref="warehouseMoveGridShellRef" class="warehouse-move-grid-shell">
      <Grid
        table-title="仓库移货单列表"
        @keydown.enter.capture="handleSearchEnter"
      >
        <template #toolbar-tools>
          <TableAction
            :actions="[
              {
                label: '新增',
                type: 'primary',
                icon: ACTION_ICON.ADD,
                auth: ['erp:warehouse-move:create'],
                tooltip: 'Insert 新增',
                title: 'Insert 新增',
                onClick: handleCreate,
              },
              {
                label: '导入',
                type: 'primary',
                icon: ACTION_ICON.UPLOAD,
                auth: ['erp:warehouse-move:create'],
                tooltip: 'I 导入',
                title: 'I 导入',
                onClick: handleImport,
              },
              {
                label: '导出',
                type: 'primary',
                icon: ACTION_ICON.DOWNLOAD,
                auth: ['erp:warehouse-move:export'],
                onClick: handleExport,
              },
              {
                label: '打印模板',
                type: 'primary',
                icon: ACTION_ICON.EDIT,
                auth: ['erp:warehouse-move:print-template'],
                onClick: handleOpenPrintTemplateDesigner,
              },
              {
                label: '批量删除',
                type: 'primary',
                danger: true,
                ifShow: () => canBatchDelete,
                icon: ACTION_ICON.DELETE,
                auth: ['erp:warehouse-move:delete'],
                popConfirm: {
                  title: `确认删除 ${checkedRows.filter((row) => isDeleteAllowed(row)).length} 张可删除单据吗？不可删除数据将自动跳过`,
                  confirm: handleDelete.bind(null, checkedIds, checkedRows),
                },
              },
            ]"
          />
        </template>
        <template #no="{ row }">
          <button
            type="button"
            class="warehouse-move-number-link"
            :title="row.no || ''"
            @click.stop="handleDetail(row)"
          >
            {{ row.no || '-' }}
          </button>
        </template>
        <template #status="{ row }">
          <span
            v-if="row.status === WAREHOUSE_MOVE_STATUS.DRAFT"
            class="warehouse-move-draft-status"
            title="草稿：页面关闭时自动保存，尚未正式提交"
          >
            草稿
          </span>
          <span v-else>
            {{
              row.status === WAREHOUSE_MOVE_STATUS.APPROVE
                ? '已审核'
                : row.status === WAREHOUSE_MOVE_STATUS.VOIDED
                  ? '已作废'
                  : row.status === WAREHOUSE_MOVE_STATUS.PICKING
                    ? row.pickStatus === 20
                      ? '部分拣货'
                      : '待拣货'
                    : '待下单确认'
            }}
          </span>
        </template>
        <template #deleteAction="{ row }">
          <TableAction
            :actions="[
              {
                label: '删除',
                type: 'link',
                danger: true,
                auth: ['erp:warehouse-move:delete'],
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
            v-access:code="['erp:warehouse-move:print']"
            class="warehouse-move-action-link"
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
                auth: ['erp:warehouse-move:update'],
                ifShow: () =>
                  row.status === WAREHOUSE_MOVE_STATUS.DRAFT ||
                  row.status === WAREHOUSE_MOVE_STATUS.PROCESS,
                onClick: handleEdit.bind(null, row),
              },
              {
                label: '下单确认',
                type: 'link',
                icon: ACTION_ICON.AUDIT,
                auth: ['erp:warehouse-move:confirm'],
                ifShow: () => row.status === WAREHOUSE_MOVE_STATUS.PROCESS,
                popConfirm: {
                  title: `确认${row.no}并生成拣货任务吗？确认后单据将锁定。`,
                  confirm: handleConfirm.bind(null, row),
                },
              },
              {
                label: '撤销确认',
                icon: 'lucide:undo-2',
                type: 'link',
                auth: ['erp:warehouse-move:cancel-confirm'],
                ifShow: () =>
                  row.status === WAREHOUSE_MOVE_STATUS.PICKING &&
                  Number(row.pickedItemCount || 0) === 0,
                popConfirm: {
                  title: `确认撤销${row.no}的下单确认吗？`,
                  confirm: handleCancelConfirm.bind(null, row),
                },
              },
            ]"
          />
        </template>
        <template #bottom>
          <div>
            <div class="warehouse-move-row-legend">
              <span
                class="warehouse-move-row-legend__swatch"
                aria-hidden="true"
              ></span>
              <span>浅蓝色行表示未正式提交的草稿</span>
            </div>
            <StockListQuerySummary
              :error="querySummaryState.error.value"
              :items="summaryItems"
              :loading="querySummaryState.loading.value"
              @retry="querySummaryState.retry"
            />
          </div>
        </template>
      </Grid>
      <ErpActivationRefreshMask
        v-if="activationRefreshMaskVisible"
        class="warehouse-move-activation-mask"
      />
    </div>
  </Page>
</template>

<style scoped>
.warehouse-move-grid-shell {
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

:deep(.vxe-grid--form-wrapper .ant-picker) {
  height: 28px;
  padding: 2px 8px;
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

:global(.warehouse-move-search-select-dropdown .ant-select-item),
:global(.warehouse-move-search-select-dropdown .ant-empty-description) {
  font-size: 12px;
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

:deep(.warehouse-move-action-link) {
  height: auto;
  padding: 0;
  font-size: 12px;
}

:deep(.warehouse-move-number-link) {
  display: block;
  max-width: 100%;
  padding: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font: inherit;
  color: hsl(var(--primary));
  white-space: nowrap;
  cursor: pointer;
  background: transparent;
  border: 0;
}

:deep(.warehouse-move-number-link:hover),
:deep(.warehouse-move-number-link:focus-visible) {
  text-decoration: underline;
}

:deep(.vxe-grid--bottom-wrapper) {
  position: sticky;
  bottom: 36px;
  z-index: 4;
  background: hsl(var(--card));
}

:deep(.vxe-grid--pager-wrapper) {
  position: sticky;
  bottom: 0;
  z-index: 5;
  margin-top: 0 !important;
  background: hsl(var(--card));
  box-shadow: 0 -2px 8px rgb(0 0 0 / 8%);
}

:deep(.warehouse-move-draft-row .vxe-body--column) {
  background-color: hsl(var(--primary) / 7%) !important;
}

:deep(.warehouse-move-draft-row.row--hover .vxe-body--column) {
  background-color: hsl(var(--primary) / 13%) !important;
}

.warehouse-move-draft-status {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  font-weight: 600;
  color: hsl(var(--primary));
}

.warehouse-move-draft-status::before {
  width: 6px;
  height: 6px;
  content: '';
  background: hsl(var(--primary));
  border-radius: 999px;
}

.warehouse-move-bottom-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  align-items: center;
  justify-content: space-between;
  min-height: 40px;
  padding: 5px 8px;
  font-size: 12px;
  line-height: 18px;
  color: hsl(var(--muted-foreground));
  border-top: 1px solid hsl(var(--border));
}

.warehouse-move-row-legend,
.warehouse-move-summary-values {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  align-items: center;
}

.warehouse-move-row-legend {
  gap: 6px;
}

.warehouse-move-row-legend__swatch {
  width: 18px;
  height: 10px;
  background: hsl(var(--primary) / 10%);
  border: 1px solid hsl(var(--primary) / 30%);
  border-radius: 2px;
}

.warehouse-move-summary-values > b,
.warehouse-move-summary-item b {
  font-weight: 600;
  color: hsl(var(--foreground));
}
</style>
