<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpStockCheckApi } from '#/api/erp/stock/check';

import { computed, provide, ref, watch } from 'vue';

import { useAccess } from '@vben/access';
import { DocAlert, Page, useVbenModal } from '@vben/common-ui';
import { downloadFileFromBlobPart, formatDateTime } from '@vben/utils';

import { message } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deleteStockCheck,
  exportStockCheck,
  getStockCheckExportFields,
  getStockCheckPage,
  getStockCheckSummary,
  ErpStockCheckApi as StockCheckApi,
  updateStockCheckStatus,
} from '#/api/erp/stock/check';
import { useFieldPermission } from '#/composables/useFieldPermission';
import { $t } from '#/locales';
import ErpActivationRefreshMask from '#/views/erp/components/ErpActivationRefreshMask.vue';
import ExportFieldModalComponent from '#/views/erp/components/export-field-modal.vue';
import PrintTemplateModal from '#/views/erp/components/PrintTemplateModal.vue';
import PrintTemplateSelector from '#/views/erp/components/PrintTemplateSelector.vue';
import { useStockShortcut } from '#/views/erp/composables/useStockShortcut';
import StockListQuerySummary from '#/views/erp/stock/components/StockListQuerySummary.vue';
import { renderStockCandidatePageSizes } from '#/views/erp/stock/utils/candidate-focus';
import { useStockQuerySummary } from '#/views/erp/stock/utils/use-stock-query-summary';
import { useVxeActivationRefresh } from '#/views/erp/utils/activation-refresh';
import { CANDIDATE_FOCUS_KEY } from '#/views/erp/utils/candidate-focus';
import {
  hasOpenDialogOverlay,
  submitSearchFormOnEnterAndBlur,
} from '#/views/erp/utils/keyboard';
import { useErpPrintTemplate } from '#/views/erp/utils/print-template';
import { createVxeHeaderSort } from '#/views/erp/utils/vxe-header-sort';

import {
  applyStockListColumnPermission,
  applyStockQueryFieldPermission,
} from '../utils/field-permission';
import { useGridColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';
import ImportForm from './modules/import-form.vue';
import { useStockCheckColumns } from './stock-check-columns';
import {
  formatStockCheckSummaryAmount,
  formatStockCheckSummaryCount,
  isStockCheckRowDeletable,
} from './stock-check-list-ui';

/** ERP 库存盘点单列表 */
defineOptions({ name: 'ErpStockCheck' });

provide(CANDIDATE_FOCUS_KEY, ref(true));

const FIELD_PERMISSION_MODULE = 'erp_stock_check';
const { hasAccessByCodes } = useAccess();
const { hiddenFields } = useFieldPermission(FIELD_PERMISSION_MODULE);
const listLoading = ref(false);
const [ExportFieldModal, exportFieldModalApi] = useVbenModal({
  connectedComponent: ExportFieldModalComponent,
  destroyOnClose: true,
});
const pendingExportParams = ref<Record<string, any>>({});
const PRINT_TEMPLATE_MODULE = 'stock_check';
const PRINT_MODULE_NAME = '库存盘点单';
const currentPageRows = ref<ErpStockCheckApi.StockCheck[]>([]);
const stockCheckGridShellRef = ref<HTMLElement>();

const querySummaryState = useStockQuerySummary((params, signal) =>
  getStockCheckSummary(params, signal),
);
const querySummaryItems = computed(() => {
  const value = querySummaryState.summary.value;
  if (!value) return [];
  return [
    {
      key: 'totalCount',
      label: '盘点数量',
      value: formatStockCheckSummaryCount(value.totalCount),
    },
    {
      key: 'totalPrice',
      label: '盈亏金额',
      value: formatStockCheckSummaryAmount(value.totalPrice),
    },
  ];
});

const { buildSortParams, handleSortChange, restoreSortState } =
  createVxeHeaderSort({
    no: 'no',
    productNames: 'productNames',
    productCodes: 'productCodes',
    deptName: 'deptName',
    checkType: 'checkType',
    checkTime: 'checkTime',
    creatorName: 'creatorName',
    updateTime: 'updateTime',
    totalCount: 'totalCount',
    totalPrice: 'totalPrice',
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

/** 刷新表格 */
function handleRefresh() {
  querySummaryState.invalidate();
  gridApi.query();
}

/** 导出表格 */
async function handleExport() {
  const selectedIds = checkedIds.value;
  pendingExportParams.value =
    selectedIds.length > 0
      ? { ids: selectedIds.join(','), ...buildSortParams() }
      : { ...(await gridApi.formApi.getValues()), ...buildSortParams() };
  exportFieldModalApi
    .setData({
      moduleKey: FIELD_PERMISSION_MODULE,
      preserveDecimalPrecision: true,
      loadFields: getStockCheckExportFields,
    })
    .open();
}
async function handleExportConfirm(fields: string[]) {
  const data = await exportStockCheck({
    ...pendingExportParams.value,
    fields: fields.join(','),
  });
  downloadFileFromBlobPart({ fileName: '库存盘点单.xls', source: data });
}

/** 新增库存盘点单 */
function handleCreate() {
  if (
    !hasAccessByCodes(['erp:stock-check:create']) ||
    listLoading.value ||
    hasOpenDialogOverlay()
  )
    return;
  formModalApi.setData({ type: 'create' }).open();
}

/** 导入 */
function handleImport() {
  if (
    !hasAccessByCodes(['erp:stock-check:import']) ||
    listLoading.value ||
    hasOpenDialogOverlay()
  )
    return;
  importModalApi.open();
}

function openStockCheckPrintModal(data: {
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
} = useErpPrintTemplate<ErpStockCheckApi.StockCheck>({
  moduleKey: PRINT_TEMPLATE_MODULE,
  moduleName: PRINT_MODULE_NAME,
  openModal: openStockCheckPrintModal,
});

/** 编辑库存盘点单 */
function handleEdit(row: ErpStockCheckApi.StockCheck) {
  formModalApi.setData({ type: 'edit', id: row.id }).open();
}

/** 删除库存盘点单 */
async function handleDelete(
  ids: number[],
  rows: ErpStockCheckApi.StockCheck[] = [],
) {
  const targetRows =
    rows.length > 0 ? rows.filter(isStockCheckRowDeletable) : [];
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
    await deleteStockCheck(targetIds);
    message.success(
      skippedCount > 0
        ? `已删除 ${targetIds.length} 条，已跳过 ${skippedCount} 条`
        : $t('ui.actionMessage.deleteSuccess'),
    );
    checkedIds.value = [];
    checkedRows.value = [];
    gridApi.grid?.clearCheckboxRow?.();
    const pager = gridApi.grid?.getProxyInfo?.()?.pager;
    if (
      pager &&
      targetIds.length >= currentPageRows.value.length &&
      pager.currentPage > 1
    ) {
      if (gridApi.grid?.setCurrentPage)
        await gridApi.grid.setCurrentPage(pager.currentPage - 1);
      else pager.currentPage -= 1;
    }
    handleRefresh();
  } catch (error) {
    const candidates = [
      (error as any)?.response?.data?.msg,
      (error as any)?.data?.msg,
      (error as any)?.message,
      typeof error === 'string' ? error : undefined,
    ];
    message.error(
      candidates.find(
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

/** 审批操作 */
async function handleUpdateStatus(
  row: ErpStockCheckApi.StockCheck,
  status: number,
) {
  if (status !== 20) return;
  const hideLoading = message.loading({
    content: '确定审批该盘点单吗？',
    duration: 0,
  });
  try {
    await updateStockCheckStatus(row.id!, status);
    message.success('审批成功');
    handleRefresh();
  } finally {
    hideLoading();
  }
}

const checkedIds = ref<number[]>([]);
const checkedRows = ref<ErpStockCheckApi.StockCheck[]>([]);
const batchDeleteAllowed = computed(() => checkedRows.value.length > 0);
function handleRowCheckboxChange({
  records,
}: {
  records: ErpStockCheckApi.StockCheck[];
}) {
  checkedRows.value = records;
  checkedIds.value = records.map((item) => item.id!).filter(Boolean);
}

/** 查看详情 */
function handleDetail(row: ErpStockCheckApi.StockCheck) {
  formModalApi.setData({ type: 'detail', id: row.id }).open();
}

function formatApprovedTime(row: ErpStockCheckApi.StockCheck) {
  if (row.status !== StockCheckApi.STATUS_APPROVE || !row.updateTime) {
    return '-';
  }
  return formatDateTime(row.updateTime) || '-';
}

useStockShortcut({
  onCreate: handleCreate,
  onImport: handleImport,
});

function handleSearchEnter(event: KeyboardEvent) {
  submitSearchFormOnEnterAndBlur(event, () => gridApi.formApi.submitForm());
}

function buildListColumns() {
  const columns =
    applyStockListColumnPermission(
      useGridColumns(currentPageRows.value),
      hiddenFields.value,
    ) ?? [];
  const rows =
    currentPageRows.value.length > 0 ? currentPageRows.value : [{ status: 10 }];
  const buttons = Math.max(
    0,
    ...rows.map(
      (row) =>
        (row.status !== 20 && hasAccessByCodes(['erp:stock-check:update'])
          ? 1
          : 0) +
        (row.status === 10 &&
        hasAccessByCodes(['erp:stock-check:update-status'])
          ? 1
          : 0) +
        (row.status !== 20 && hasAccessByCodes(['erp:stock-check:delete'])
          ? 1
          : 0),
    ),
  );
  return columns.map((column) =>
    column.field === 'actions'
      ? { ...column, width: Math.max(72, buttons * 66 + 12) }
      : column,
  );
}
const listColumns = useStockCheckColumns({
  columns: buildListColumns,
  grid: () => gridApi,
  wrapper: () => stockCheckGridShellRef.value,
  minimum: 72,
});
async function reloadStockCheckListColumns(rows = currentPageRows.value) {
  currentPageRows.value = rows;
  await listColumns.reload();
}
watch(hiddenFields, () => {
  gridApi.formApi.setState({
    schema: applyStockQueryFieldPermission(
      useGridFormSchema(),
      hiddenFields.value,
    ),
  });
  void listColumns.reload();
});

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    commonConfig: { labelWidth: 84 },
    schema: applyStockQueryFieldPermission(
      useGridFormSchema(),
      hiddenFields.value,
    ),
    collapsed: true,
    collapsedRows: 2,
  },
  gridOptions: {
    pagerConfig: { slots: { sizes: renderStockCandidatePageSizes } },
    columns: buildListColumns(),
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
    autoResize: true,
    height: 'auto',
    id: 'erp-stock-check-list-v2',
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
          const summaryChanged = querySummaryState.prepare(formValues);
          let pageFailed = false;
          listLoading.value = true;
          const result = await getStockCheckPage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            includeItems: false,
            ...formValues,
            ...buildSortParams(sorts, sort),
          })
            .catch((error) => {
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
            })
            .finally(() => {
              listLoading.value = false;
            });
          currentPageRows.value = result.list || [];
          await reloadStockCheckListColumns();
          if (!pageFailed)
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
      row.status === StockCheckApi.STATUS_DRAFT ? 'stock-check-draft-row' : '',
    toolbarConfig: {
      refresh: true,
      custom: true,
      zoom: true,
      search: true,
    },
  } as VxeTableGridOptions<ErpStockCheckApi.StockCheck>,
  gridEvents: {
    custom: listColumns.custom,
    resizableChange: listColumns.queue,
    zoom: listColumns.queue,
    checkboxAll: handleRowCheckboxChange,
    checkboxChange: handleRowCheckboxChange,
    sortChange: handleSortChange,
  },
});

const { activationRefreshMaskVisible } =
  useVxeActivationRefresh<ErpStockCheckApi.StockCheck>({
    gridApi,
    getParams: async () => ({
      ...(await gridApi.formApi.getValues()),
      ...buildSortParams(),
    }),
    queryPage: (params) =>
      getStockCheckPage({ ...params, includeItems: false }),
    onSuccess: async (rows) => {
      currentPageRows.value = rows;
      checkedIds.value = [];
      checkedRows.value = [];
      gridApi.grid?.clearCheckboxRow?.();
      gridApi.grid?.clearCheckboxReserve?.();
      await reloadStockCheckListColumns(rows);
      await restoreSortState(gridApi);
    },
    onAfterRefresh: () => {
      querySummaryState.invalidate();
      void gridApi.formApi
        .getValues()
        .then((params) => querySummaryState.load(params));
    },

    errorMessage: 'Error occurred while refreshing stock check page:',
  });
</script>

<template>
  <ExportFieldModal @confirm="handleExportConfirm" />
  <Page auto-content-height>
    <template #doc>
      <DocAlert
        title="【库存】库存调拨、库存盘点"
        url="https://doc.iocoder.cn/erp/stock-move-check/"
      />
    </template>

    <FormModal
      @edit="handleEdit"
      @print="handlePrint"
      @success="handleRefresh"
    />
    <ImportModal @success="handleRefresh" />
    <PrintTemplateDesignModal @printed="handleRefresh" />
    <PrintTemplateSelector
      v-model:open="printTemplateSelectOpen"
      v-model:selected-id="selectedPrintTemplateId"
      :templates="printTemplateOptions"
      @cancel="cancelTemplateSelect"
      @confirm="confirmTemplate"
    />
    <div ref="stockCheckGridShellRef" class="stock-check-grid-shell">
      <Grid
        table-title="库存盘点单列表"
        @keydown.enter.capture="handleSearchEnter"
      >
        <template #toolbar-tools>
          <TableAction
            :actions="[
              {
                label: '新增',
                type: 'primary',
                icon: ACTION_ICON.ADD,
                auth: ['erp:stock-check:create'],
                tooltip: 'Insert 新增',
                title: 'Insert 新增',
                onClick: handleCreate,
              },
              {
                label: '导入',
                type: 'primary',
                icon: ACTION_ICON.UPLOAD,
                auth: ['erp:stock-check:import'],
                tooltip: 'I 导入',
                title: 'I 导入',
                onClick: handleImport,
              },
              {
                label: '导出',
                type: 'primary',
                icon: ACTION_ICON.DOWNLOAD,
                auth: ['erp:stock-check:export'],
                onClick: handleExport,
              },
              {
                label: '打印模板',
                type: 'primary',
                icon: ACTION_ICON.EDIT,
                auth: ['erp:stock-check:print-template'],
                onClick: handleOpenPrintTemplateDesigner,
              },
              {
                label: '批量删除',
                type: 'primary',
                danger: true,
                ifShow: () => batchDeleteAllowed,
                icon: ACTION_ICON.DELETE,
                auth: ['erp:stock-check:delete'],
                popConfirm: {
                  title: `确认删除所选 ${checkedRows.filter(isStockCheckRowDeletable).length} 条盘点单？不可删除数据将自动跳过`,
                  confirm: handleDelete.bind(null, checkedIds, checkedRows),
                },
              },
            ]"
          />
        </template>
        <template #no="{ row }">
          <a
            class="text-primary cursor-pointer"
            @click.stop="handleDetail(row)"
          >
            {{ row.no || '-' }}
          </a>
        </template>
        <template #status="{ row }">
          <span
            v-if="row.status === StockCheckApi.STATUS_DRAFT"
            class="stock-check-draft-status"
            title="草稿：页面关闭时自动保存，尚未正式提交"
          >
            草稿
          </span>
          <span v-else>
            {{
              row.status === StockCheckApi.STATUS_APPROVE ? '已审核' : '待审核'
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
                auth: ['erp:stock-check:delete'],
                ifShow: () => row.status !== StockCheckApi.STATUS_APPROVE,
                popConfirm: {
                  title: $t('ui.actionMessage.deleteConfirm', [row.no]),
                  confirm: handleDelete.bind(null, [row.id!], [row]),
                },
              },
            ]"
          />
        </template>
        <template #printAction="{ row }">
          <a
            v-access:code="['erp:stock-check:print']"
            class="stock-check-action-link"
            @click.stop="handlePrint(row)"
          >
            打印({{ row.printCount ?? 0 }})
          </a>
        </template>
        <template #approveTime="{ row }">
          {{ formatApprovedTime(row) }}
        </template>
        <template #actions="{ row }">
          <TableAction
            :actions="[
              {
                label: $t('common.edit'),
                type: 'link',
                icon: ACTION_ICON.EDIT,
                auth: ['erp:stock-check:update'],
                ifShow: () => row.status !== 20,
                onClick: handleEdit.bind(null, row),
              },
              {
                label: '审批',
                type: 'link',
                icon: ACTION_ICON.AUDIT,
                auth: ['erp:stock-check:update-status'],
                ifShow: () => row.status === 10,
                popConfirm: {
                  title: `确认审批${row.no}吗？`,
                  confirm: handleUpdateStatus.bind(null, row, 20),
                },
              },
              {
                label: $t('common.delete'),
                type: 'link',
                danger: true,
                icon: ACTION_ICON.DELETE,
                auth: ['erp:stock-check:delete'],
                ifShow: () => row.status !== 20,
                popConfirm: {
                  title: $t('ui.actionMessage.deleteConfirm', [row.no]),
                  confirm: handleDelete.bind(null, [row.id!], [row]),
                },
              },
            ]"
          />
        </template>
        <template #bottom>
          <div>
            <div class="stock-check-row-legend">
              <span
                class="stock-check-row-legend__swatch"
                aria-hidden="true"
              ></span>
              <span>浅蓝色行表示未正式提交的草稿</span>
            </div>
            <StockListQuerySummary
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
        class="stock-check-activation-mask"
      />
    </div>
  </Page>
</template>

<style scoped>
.stock-check-grid-shell {
  position: relative;
  height: 100%;
  min-height: 100%;
}

.stock-check-action-link {
  color: hsl(var(--primary));
  cursor: pointer;
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

:global(.stock-search-select-dropdown .ant-select-item),
:global(.stock-search-select-dropdown .ant-empty-description) {
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

:deep(.vxe-grid--pager-wrapper) {
  position: sticky;
  bottom: 0;
  z-index: 5;
  margin-top: 0 !important;
  background: hsl(var(--card));
  box-shadow: 0 -2px 8px rgb(0 0 0 / 8%);
}

:deep(.stock-check-draft-row .vxe-body--column) {
  background-color: hsl(var(--primary) / 7%) !important;
}

:deep(.stock-check-draft-row.row--hover .vxe-body--column) {
  background-color: hsl(var(--primary) / 13%) !important;
}

.stock-check-draft-status {
  font-weight: 600;
  color: hsl(var(--primary));
}

.stock-check-row-legend {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 8px 12px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
}

.stock-check-row-legend__swatch {
  width: 18px;
  height: 10px;
  background-color: hsl(var(--primary) / 10%);
  border: 1px solid hsl(var(--primary) / 25%);
  border-radius: 2px;
}
</style>
