<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpStockTransferOutApi } from '#/api/erp/stock/transfer-out';

import { computed, provide, ref } from 'vue';

import { useAccess } from '@vben/access';
import { Page, useVbenModal } from '@vben/common-ui';
import { downloadFileFromBlobPart } from '@vben/utils';

import { Button, message } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  approveStockTransferOut,
  deleteStockTransferOut,
  exportStockTransferOut,
  getStockTransferOutExportFields,
  getStockTransferOutPage,
  getStockTransferOutSummary,
  STOCK_TRANSFER_OUT_STATUS,
} from '#/api/erp/stock/transfer-out';
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
import { stockListNumber } from '#/views/erp/stock/utils/stock-decimal';
import { useStockQuerySummary } from '#/views/erp/stock/utils/use-stock-query-summary';
import { useVxeActivationRefresh } from '#/views/erp/utils/activation-refresh';
import {
  CANDIDATE_FOCUS_KEY,
  withCandidateFocus,
} from '#/views/erp/utils/candidate-focus';
import {
  hasOpenFormControlPopup,
  submitSearchFormOnEnterAndBlur,
} from '#/views/erp/utils/keyboard';
import { useErpPrintTemplate } from '#/views/erp/utils/print-template';
import { createVxeHeaderSort } from '#/views/erp/utils/vxe-header-sort';

import { useGridColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';
import ImportForm from './modules/import-form.vue';

/** ERP 调拨出库单列表 */
defineOptions({ name: 'ErpStockTransferOut' });

provide(CANDIDATE_FOCUS_KEY, ref(true));

const { buildSortParams, handleSortChange, restoreSortState } =
  createVxeHeaderSort({
    no: 'no',
    moveTime: 'moveTime',
    sourceNo: 'sourceNo',
    fromDeptName: 'fromDeptName',
    toDeptName: 'toDeptName',
    fromWarehouseNames: 'fromWarehouseNames',
    toWarehouseNames: 'toWarehouseNames',
    totalCount: 'totalCount',
    totalPrice: 'totalPrice',
    status: 'status',
    productNames: 'productNames',
    productCodes: 'productCodes',
    remark: 'remark',
    creatorName: 'creatorName',
    createTime: 'createTime',
    updaterName: 'updaterName',
    updateTime: 'updateTime',
  });

const FIELD_PERMISSION_MODULE = 'erp_stock_transfer_out';
const PRINT_TEMPLATE_MODULE = 'stock_transfer_out';
const PRINT_MODULE_NAME = '调拨出库单';
const { hiddenFields, loadHiddenFields } = useFieldPermission(
  FIELD_PERMISSION_MODULE,
);
const currentPageRows = ref<ErpStockTransferOutApi.StockTransferOut[]>([]);
const pendingExportParams = ref<Record<string, any>>({});
const stockTransferOutGridShellRef = ref<HTMLElement>();
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

/** 刷新表格 */
function handleRefresh() {
  querySummaryState.invalidate();
  gridApi.query();
}

function formatSummaryValue(value?: null | number | string, _scale = 2) {
  if (value === null || value === undefined) return '****';
  return stockListNumber(value);
}

const querySummaryState = useStockQuerySummary((params, signal) =>
  getStockTransferOutSummary(params, signal),
);
const querySummaryItems = computed(() => {
  const value = querySummaryState.summary.value;
  if (!value) return [];
  return [
    {
      key: 'totalCount',
      label: '调拨出库数量',
      value: formatStockNaturalNumber(value.totalCount),
    },
    {
      key: 'totalPrice',
      label: '调拨出库金额',
      value: formatSummaryValue(value.totalPrice),
    },
  ];
});

function clearCheckedRows() {
  checkedIds.value = [];
  checkedRows.value = [];
  gridApi.grid?.clearCheckboxRow?.();
  gridApi.grid?.clearCheckboxReserve?.();
}

function handleFormSuccess(event?: { id?: number; type?: string }) {
  if (event?.type === 'unlock-cart') {
    clearCheckedRows();
  }
  handleRefresh();
}

/** 新增调拨出库单 */
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
  if (
    listActionBlocked() ||
    !hasAccessByCodes(['erp:stock-transfer-out:create'])
  )
    return;
  formModalApi.setData({ type: 'create' }).open();
}

function handleImport() {
  if (
    listActionBlocked() ||
    !hasAccessByCodes(['erp:stock-transfer-out:import'])
  )
    return;
  importModalApi.open();
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
      loadFields: getStockTransferOutExportFields,
      moduleKey: FIELD_PERMISSION_MODULE,
    })
    .open();
}

async function handleExportConfirm(fields: string[]) {
  const data = await exportStockTransferOut({
    ...pendingExportParams.value,
    fields: fields.join(','),
  });
  downloadFileFromBlobPart({ fileName: '调拨出库单.xlsx', source: data });
}

/** 编辑调拨出库单 */
function handleEdit(row: ErpStockTransferOutApi.StockTransferOut) {
  if (row.sourceType === 30) {
    message.warning('销售手推车来源调拨出库单不允许编辑');
    return;
  }
  formModalApi.setData({ type: 'edit', id: row.id }).open();
}

function isDraftTransferOut(row: ErpStockTransferOutApi.StockTransferOut) {
  return (
    row.status === STOCK_TRANSFER_OUT_STATUS.DRAFT && row.sourceType !== 30
  );
}

/** 删除禁用原因 */
function getDeleteDisabledReason(row: ErpStockTransferOutApi.StockTransferOut) {
  if (row.sourceType === 30) {
    return '销售手推车来源调拨出库单请使用详情中的“解锁手推车”操作';
  }
  if (row.status === 20) {
    return '已审核的调拨出库单不能删除';
  }
  if (row.deleteAllowed === false) {
    return row.deleteDisabledReason || '当前调拨出库单不能删除';
  }
  return '';
}

function isDeleteAllowed(row: ErpStockTransferOutApi.StockTransferOut) {
  return !getDeleteDisabledReason(row);
}

async function handleDelete(
  ids: number[],
  rows: ErpStockTransferOutApi.StockTransferOut[] = [],
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
    await deleteStockTransferOut(targetIds);
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

async function handleApprove(row: ErpStockTransferOutApi.StockTransferOut) {
  if (row.approveAllowed === false) {
    message.warning(row.approveDisabledReason || '当前调拨出库单不能审核');
    return;
  }
  const hideLoading = message.loading({
    content: '正在审核调拨出库单',
    duration: 0,
  });
  try {
    await approveStockTransferOut(row.id!);
    message.success('调拨出库单审核成功');
    handleRefresh();
  } finally {
    hideLoading();
  }
}

const checkedIds = ref<number[]>([]);
const checkedRows = ref<ErpStockTransferOutApi.StockTransferOut[]>([]);
const canBatchDelete = computed(() => checkedRows.value.length > 0);
function handleRowCheckboxChange({
  records,
}: {
  records: ErpStockTransferOutApi.StockTransferOut[];
}) {
  checkedRows.value = records;
  checkedIds.value = records.map((item) => item.id!);
}

/** 查看详情 */
function handleDetail(row: ErpStockTransferOutApi.StockTransferOut) {
  formModalApi.setData({ type: 'detail', id: row.id }).open();
}

function handleContinueBuy(row: ErpStockTransferOutApi.StockTransferOut) {
  if (row.status === 20) {
    message.warning('已审核的调拨出库单不能继续选购');
    return;
  }
  handleEdit(row);
}

function openTransferOutPrintModal(data: {
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
} = useErpPrintTemplate<ErpStockTransferOutApi.StockTransferOut>({
  moduleKey: PRINT_TEMPLATE_MODULE,
  moduleName: PRINT_MODULE_NAME,
  openModal: openTransferOutPrintModal,
});

function handleWechatNotify(row: ErpStockTransferOutApi.StockTransferOut) {
  message.info(`微信通知暂未接入，请处理单号：${row.no || '-'}`);
}

function getSettlementStatus(row: ErpStockTransferOutApi.StockTransferOut) {
  if (row.status !== 20) {
    return '';
  }
  if (row.settleStatus === undefined || row.settleStatus === null) {
    return '未结算';
  }
  if (typeof row.settleStatus === 'string') {
    return row.settleStatus;
  }
  if (row.settleStatus === 20) {
    return '已结算';
  }
  if (row.settleStatus === 10) {
    return '未结算';
  }
  return '未结算';
}

useStockShortcut({
  onCreate: handleCreate,
  onImport: handleImport,
});

function handleSearchEnter(event: KeyboardEvent) {
  submitSearchFormOnEnterAndBlur(event, () => gridApi.formApi.submitForm());
}

async function reloadTransferOutListColumns(
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
      isDraftTransferOut(row) &&
      hasAccessByCodes(['erp:stock-transfer-out:update'])
    )
      labels.push('编辑');
    if (
      row.status === 10 &&
      row.approveAllowed !== false &&
      hasAccessByCodes(['erp:stock-transfer-out:approve'])
    )
      labels.push('审核');
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
  wrapper: () => stockTransferOutGridShellRef.value,
});
const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    commonConfig: { labelWidth: 68 },
    schema: withCandidateFocus(useGridFormSchema(hiddenFields.value)),
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
    keepSource: false,
    id: 'erp-stock-transfer-out-list-v2',
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
            const result = await getStockTransferOutPage({
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
            await reloadTransferOutListColumns();
            if (!pageFailed)
              void querySummaryState.load(formValues, summaryChanged);
            return result;
          } finally {
            listLoading.value = false;
          }
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
    rowClassName: ({ row }) =>
      row.status === STOCK_TRANSFER_OUT_STATUS.DRAFT
        ? 'transfer-out-draft-row'
        : '',
    toolbarConfig: {
      custom: true,
      zoom: true,
      refresh: true,
      search: true,
    },
  } as VxeTableGridOptions<ErpStockTransferOutApi.StockTransferOut>,
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
  useVxeActivationRefresh<ErpStockTransferOutApi.StockTransferOut>({
    gridApi,
    getParams: async () => ({
      ...(await gridApi.formApi.getValues()),
      ...buildSortParams(),
    }),
    queryPage: (params) =>
      getStockTransferOutPage({ ...params, includeItems: false }),
    onSuccess: async (rows) => {
      currentPageRows.value = rows;
      clearCheckedRows();
      await reloadTransferOutListColumns(rows);
      await restoreSortState(gridApi);
    },
    onAfterRefresh: () => {
      querySummaryState.invalidate();
      void gridApi.formApi
        .getValues()
        .then((params) => querySummaryState.load(params));
    },
    onFirstActivated: () => {},
    errorMessage: 'Error occurred while refreshing stock transfer out page:',
  });

loadHiddenFields().then(() => {
  const fields = hiddenFields.value;
  if (isSameFieldSet(appliedHiddenFields, fields)) {
    return;
  }
  appliedHiddenFields = [...fields];
  gridApi.formApi.setState({
    schema: withCandidateFocus(useGridFormSchema(fields)),
  });
  void reloadTransferOutListColumns(currentPageRows.value, fields);
});
</script>

<template>
  <Page auto-content-height>
    <FormModal
      @edit="handleEdit"
      @print="handlePrint"
      @success="handleFormSuccess"
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
    <div
      ref="stockTransferOutGridShellRef"
      class="stock-transfer-out-grid-shell"
    >
      <Grid
        table-title="调拨出库单列表"
        @keydown.enter.capture="handleSearchEnter"
      >
        <template #toolbar-tools>
          <TableAction
            :actions="[
              {
                label: '新增',
                type: 'primary',
                icon: ACTION_ICON.ADD,
                auth: ['erp:stock-transfer-out:create'],
                tooltip: 'Insert 新增',
                title: 'Insert 新增',
                onClick: handleCreate,
              },
              {
                label: '导入',
                type: 'primary',
                icon: ACTION_ICON.UPLOAD,
                auth: ['erp:stock-transfer-out:import'],
                tooltip: 'I 导入',
                title: 'I 导入',
                onClick: handleImport,
              },
              {
                label: '导出',
                type: 'primary',
                icon: ACTION_ICON.DOWNLOAD,
                auth: ['erp:stock-transfer-out:export'],
                onClick: handleExport,
              },
              {
                label: '打印模板',
                type: 'primary',
                icon: ACTION_ICON.EDIT,
                auth: ['erp:stock-transfer-out:print-template'],
                onClick: handleOpenPrintTemplateDesigner,
              },
              {
                label: '批量删除',
                type: 'primary',
                danger: true,
                ifShow: () => canBatchDelete,
                icon: ACTION_ICON.DELETE,
                auth: ['erp:stock-transfer-out:delete'],
                popConfirm: {
                  title: `是否删除所选调拨出库单？不可删除数据将自动跳过`,
                  confirm: handleDelete.bind(null, checkedIds, checkedRows),
                },
              },
            ]"
          />
        </template>
        <template #no="{ row }">
          <button
            type="button"
            class="transfer-out-number-link"
            :title="row.no || ''"
            @click.stop="handleDetail(row)"
          >
            {{ row.no || '-' }}
          </button>
        </template>
        <template #status="{ row }">
          <span
            v-if="row.status === STOCK_TRANSFER_OUT_STATUS.DRAFT"
            class="transfer-out-draft-status"
            title="草稿：页面关闭时自动保存，尚未正式提交"
          >
            草稿
          </span>
          <span v-else>
            {{
              row.status === STOCK_TRANSFER_OUT_STATUS.APPROVE
                ? '已审核'
                : '待审核'
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
                auth: ['erp:stock-transfer-out:delete'],
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
            v-access:code="['erp:stock-transfer-out:print']"
            class="transfer-out-action-link"
            type="link"
            @click.stop="handlePrint(row)"
          >
            打印({{ row.printCount ?? 0 }})
          </Button>
        </template>
        <template #wechatNotifyAction="{ row }">
          <Button
            v-access:code="['erp:stock-transfer-out:query']"
            class="transfer-out-action-link"
            type="link"
            @click.stop="handleWechatNotify(row)"
          >
            微信通知
          </Button>
        </template>
        <template #settleStatus="{ row }">
          <span>{{ getSettlementStatus(row) }}</span>
        </template>
        <template #continueBuyAction="{ row }">
          <TableAction
            :actions="[
              {
                label: '继续选购',
                type: 'link',
                auth: ['erp:stock-transfer-out:update'],
                ifShow: () => row.status !== 20,
                onClick: handleContinueBuy.bind(null, row),
              },
            ]"
          />
        </template>
        <template #signImageUrl="{ row }">
          <a
            v-if="row.signImageUrl"
            class="transfer-out-action-link"
            :href="row.signImageUrl"
            rel="noopener noreferrer"
            target="_blank"
            @click.stop
          >
            查看
          </a>
          <span v-else>-</span>
        </template>
        <template #handlerName="{ row }">
          <span>{{ row.handlerName || row.creatorName || '-' }}</span>
        </template>
        <template #salespersonName="{ row }">
          <span>{{ row.salespersonName || row.creatorName || '-' }}</span>
        </template>
        <template #actions="{ row }">
          <TableAction
            :actions="[
              {
                label: '编辑',
                icon: ACTION_ICON.EDIT,
                type: 'link',
                auth: ['erp:stock-transfer-out:update'],
                ifShow: () => isDraftTransferOut(row),
                onClick: handleEdit.bind(null, row),
              },
              {
                label: '审核',
                type: 'link',
                icon: ACTION_ICON.AUDIT,
                auth: ['erp:stock-transfer-out:approve'],
                ifShow: () => row.status === 10 && row.approveAllowed !== false,
                popConfirm: {
                  title: `确认审核${row.no}吗？`,
                  confirm: handleApprove.bind(null, row),
                },
              },
            ]"
          />
        </template>
        <template #bottom>
          <div>
            <div class="transfer-out-row-legend">
              <span
                class="transfer-out-row-legend__swatch"
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
        class="stock-transfer-out-activation-mask"
      />
    </div>
  </Page>
</template>

<style scoped>
.stock-transfer-out-grid-shell {
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

:global(.transfer-out-search-select-dropdown .ant-select-item),
:global(.transfer-out-search-select-dropdown .ant-empty-description) {
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

:deep(.transfer-out-action-link) {
  height: auto;
  padding: 0;
  font-size: 12px;
  line-height: inherit;
}

:deep(.transfer-out-number-link) {
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

:deep(.transfer-out-number-link:hover),
:deep(.transfer-out-number-link:focus-visible) {
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

:deep(.transfer-out-draft-row .vxe-body--column) {
  background-color: hsl(var(--primary) / 7%) !important;
}

:deep(.transfer-out-draft-row.row--hover .vxe-body--column) {
  background-color: hsl(var(--primary) / 13%) !important;
}

.transfer-out-draft-status {
  display: inline-flex;
  gap: 4px;
  align-items: center;
  font-weight: 600;
  color: hsl(var(--primary));
}

.transfer-out-draft-status::before {
  width: 6px;
  height: 6px;
  content: '';
  background: hsl(var(--primary));
  border-radius: 999px;
}

.transfer-out-bottom-summary {
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

.transfer-out-row-legend {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-right: auto;
  color: hsl(var(--muted-foreground));
}

.transfer-out-row-legend__swatch {
  width: 18px;
  height: 10px;
  background: hsl(var(--primary) / 10%);
  border: 1px solid hsl(var(--primary) / 30%);
  border-radius: 2px;
}

.transfer-out-bottom-summary strong {
  color: hsl(var(--foreground));
}

@media (max-width: 768px) {
  .transfer-out-bottom-summary {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
