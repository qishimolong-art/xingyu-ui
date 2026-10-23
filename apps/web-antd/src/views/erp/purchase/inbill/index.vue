<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpStockInBillApi } from '#/api/erp/stock/inbill';

import { computed, ref, watch } from 'vue';

import { useAccess } from '@vben/access';
import { DocAlert, Page, useVbenModal } from '@vben/common-ui';
import { downloadFileFromBlobPart } from '@vben/utils';

import { Alert, Tag } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  exportStockInBill,
  getStockInBillExportFields,
  getStockInBillPage,
  getStockInBillSummary,
} from '#/api/erp/stock/inbill';
import {
  isFieldHidden,
  useFieldPermission,
} from '#/composables/useFieldPermission';
import ErpActivationRefreshMask from '#/views/erp/components/ErpActivationRefreshMask.vue';
import ExportFieldModalComponent from '#/views/erp/components/export-field-modal.vue';
import StockListQuerySummary from '#/views/erp/stock/components/StockListQuerySummary.vue';
import { useStockDocumentColumns } from '#/views/erp/stock/utils/document-columns';
import { prepareStockDocumentListColumns } from '#/views/erp/stock/utils/document-list-table';
import { formatStockNaturalNumber } from '#/views/erp/stock/utils/document-number';
import { stockListNumber } from '#/views/erp/stock/utils/stock-decimal';
import { useStockQuerySummary } from '#/views/erp/stock/utils/use-stock-query-summary';
import { useVxeActivationRefresh } from '#/views/erp/utils/activation-refresh';
import { withErpKeywordSearchSchema } from '#/views/erp/utils/form-defaults';
import { submitSearchFormOnEnterAndBlur } from '#/views/erp/utils/keyboard';
import { createVxeHeaderSort } from '#/views/erp/utils/vxe-header-sort';

import DetailModal from '../../stock/inbill/modules/detail-modal.vue';
import {
  getStockInBillStatusMeta,
  normalizeStockInBillRow,
  normalizeStockInBillSearchParams,
} from '../../stock/inbill/ui';
import { useGridColumns, useGridFormSchema } from './data';

defineOptions({ name: 'ErpPurchaseInBill' });
const { hasAccessByCodes } = useAccess();
const canQueryHistory = computed(() =>
  hasAccessByCodes(['erp:stock-in-bill:query']),
);

const { buildSortParams, handleSortChange, restoreSortState } =
  createVxeHeaderSort({
    priority: 'priority',
    no: 'no',
    pickup: 'pickup',
    billDate: 'billDate',
    sourceNo: 'sourceNo',
    status: 'status',
    createTime: 'createTime',
    updateTime: 'updateTime',
    auditTime: 'auditTime',
    printTime: 'printTime',
    printCount: 'printCount',
    totalWeight: 'totalWeight',
    remark: 'remark',
  });

const [DetailModalComponent, detailModalApi] = useVbenModal({
  connectedComponent: DetailModal,
  destroyOnClose: true,
});
const [ExportFieldModal, exportFieldModalApi] = useVbenModal({
  connectedComponent: ExportFieldModalComponent,
  destroyOnClose: true,
});

const { hiddenFields, loadHiddenFields } =
  useFieldPermission('erp_stock_in_bill');
const pendingExportParams = ref<Record<string, any>>({});
const currentPageRows = ref<ErpStockInBillApi.StockInBill[]>([]);
const stockInBillGridShellRef = ref<HTMLElement>();

function formatSummaryCount(value?: null | number | string, integer = false) {
  if (value == null) return '****';
  return integer ? formatStockNaturalNumber(value) : stockListNumber(value);
}

const querySummaryState = useStockQuerySummary((params, signal) =>
  getStockInBillSummary(params, signal),
);
const querySummaryItems = computed(() => {
  const value = querySummaryState.summary.value;
  if (!value) return [];
  return [
    {
      key: 'documentCount',
      label: '入仓单数',
      value: formatSummaryCount(value.documentCount, true),
    },
    {
      key: 'totalCount',
      label: '应提数量',
      value: formatSummaryCount(value.totalCount),
    },
    {
      key: 'pickedCount',
      label: '已提数量',
      value: formatSummaryCount(value.pickedCount),
    },
    {
      key: 'remainingCount',
      label: '待提数量',
      value: formatSummaryCount(value.remainingCount),
    },
  ];
});

async function queryHistoryPage(
  params: Parameters<typeof getStockInBillPage>[0],
) {
  await loadHiddenFields();
  if (!canQueryHistory.value) {
    currentPageRows.value = [];
    return { list: [], total: 0 };
  }
  const result = await getStockInBillPage(params);
  if (!canQueryHistory.value) {
    currentPageRows.value = [];
    return { list: [], total: 0 };
  }
  return result;
}
function handleRefresh() {
  querySummaryState.invalidate();
  gridApi.query();
}

async function handleExport() {
  if (!hasAccessByCodes(['erp:stock-in-bill:export'])) return;
  const selectedIds = (
    (gridApi.grid?.getCheckboxRecords?.() as
      | ErpStockInBillApi.StockInBill[]
      | undefined) ?? []
  )
    .map((item) => item.id!)
    .filter((id) => id !== undefined);
  pendingExportParams.value =
    selectedIds.length > 0
      ? { ids: selectedIds.join(','), ...buildSortParams() }
      : {
          ...normalizeStockInBillSearchParams(
            await gridApi.formApi.getValues(),
          ),
          ...buildSortParams(),
        };
  exportFieldModalApi
    .setData({
      loadFields: getStockInBillExportFields,
      moduleKey: 'erp_stock_in_bill',
    })
    .open();
}

async function handleExportConfirm(fields: string[]) {
  if (!hasAccessByCodes(['erp:stock-in-bill:export'])) return;
  const data = await exportStockInBill({
    ...pendingExportParams.value,
    fields: fields.join(','),
  });
  if (!hasAccessByCodes(['erp:stock-in-bill:export'])) return;
  downloadFileFromBlobPart({ fileName: '入仓单.xls', source: data });
}

function handleDetail(row: ErpStockInBillApi.StockInBill) {
  if (!canQueryHistory.value) return;
  detailModalApi.setData({ id: row.id, mode: 'detail' }).open();
}

function handleCellClick({ row, column }: any) {
  if (
    column?.type === 'checkbox' ||
    column?.field === 'actions' ||
    column?.slots?.default === 'actions'
  )
    return;
  handleDetail(row);
}

function handleSearchEnter(event: KeyboardEvent) {
  submitSearchFormOnEnterAndBlur(event, () => gridApi.formApi.submitForm());
}

function listColumns() {
  const aliases: Record<string, string> = {
    warehouseName: 'warehouseId',
    creatorName: 'creator',
    updaterName: 'updater',
  };
  const columns = (useGridColumns(currentPageRows.value) || [])
    .filter(
      (column: any) =>
        !isFieldHidden(hiddenFields.value, column.field) &&
        !isFieldHidden(hiddenFields.value, aliases[column.field]),
    )
    .map((column: any) =>
      [
        'looseQty',
        'pickedCount',
        'printCount',
        'remainingCount',
        'totalCount',
        'totalWeight',
        'wholeQty',
      ].includes(column.field)
        ? {
            ...column,
            formatter: ({ cellValue }: any) => stockListNumber(cellValue),
          }
        : column,
    );
  return prepareStockDocumentListColumns(columns, currentPageRows.value);
}
const listColumnState = useStockDocumentColumns({
  columns: listColumns,
  grid: () => gridApi,
  wrapper: () => stockInBillGridShellRef.value,
  fill: false,
  afterReload: () => restoreSortState(gridApi),
});
async function reloadStockInBillListColumns(
  _rows: any[] = currentPageRows.value,
) {
  await listColumnState.reload();
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: withErpKeywordSearchSchema(useGridFormSchema()),
  },
  gridOptions: {
    columns: useGridColumns(currentPageRows.value),
    customConfig: {
      restoreStore: listColumnState.restoreStore,
      storage: {
        fixed: true,
        resizable: true,
        sort: true,
        visible: true,
      },
    },
    fit: false,
    height: 'auto',
    id: 'erp-purchase-in-bill-list-v1',
    keepSource: true,
    showHeaderOverflow: 'tooltip',
    showOverflow: 'tooltip',
    scrollX: { enabled: true, gt: 8 },
    proxyConfig: {
      ajax: {
        query: async ({ page, sort, sorts }, formValues) => {
          const params = normalizeStockInBillSearchParams(formValues);
          const summaryChanged = canQueryHistory.value
            ? querySummaryState.prepare(params)
            : false;
          let pageFailed = false;
          const result = await queryHistoryPage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
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
          result.list = (result.list || []).map((row) =>
            normalizeStockInBillRow(row),
          );
          currentPageRows.value = result.list;
          await reloadStockInBillListColumns(result.list);
          if (!pageFailed && canQueryHistory.value)
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
      search: true,
      custom: true,
      zoom: true,
    },
  } as VxeTableGridOptions<ErpStockInBillApi.StockInBill>,
  gridEvents: {
    cellClick: handleCellClick,
    custom: listColumnState.custom,
    resizableChange: listColumnState.queue,
    zoom: listColumnState.queue,
    sortChange: handleSortChange,
  },
});

watch(canQueryHistory, async (allowed) => {
  if (!allowed) {
    querySummaryState.cancelPending();
    querySummaryState.invalidate();
    currentPageRows.value = [];
    const pager = gridApi.grid?.getProxyInfo?.()?.pager;
    if (pager) {
      pager.currentPage = 1;
      pager.total = 0;
    }
    await gridApi.grid?.loadData?.([]);
  }
});

const { activationRefreshMaskVisible } =
  useVxeActivationRefresh<ErpStockInBillApi.StockInBill>({
    gridApi,
    getParams: async () => ({
      ...normalizeStockInBillSearchParams(await gridApi.formApi.getValues()),
      ...buildSortParams(),
    }),
    queryPage: async (params) => {
      const result = await queryHistoryPage(params);
      result.list = (result.list || []).map((row) =>
        normalizeStockInBillRow(row),
      );
      return result;
    },
    onSuccess: async (rows) => {
      if (!canQueryHistory.value) return;
      currentPageRows.value = rows;
      await reloadStockInBillListColumns(rows);
      await restoreSortState(gridApi);
    },
    onAfterRefresh: () => {
      querySummaryState.invalidate();
      if (!canQueryHistory.value) return;
      void gridApi.formApi
        .getValues()
        .then((params) =>
          querySummaryState.load(normalizeStockInBillSearchParams(params)),
        );
    },

    errorMessage: 'Error occurred while refreshing stock in bill page:',
  });
</script>

<template>
  <Page auto-content-height>
    <template #doc>
      <DocAlert
        title="【库存】入仓单"
        url="https://doc.iocoder.cn/erp/stock/"
      />
    </template>

    <DetailModalComponent @success="handleRefresh" />
    <ExportFieldModal @confirm="handleExportConfirm" />
    <Alert
      class="mb-2"
      type="info"
      message="采购领货流程已取消，审核直接入库；历史入仓单仅供核对，待提数量不会自动补入库存。"
    />
    <div ref="stockInBillGridShellRef" class="stock-in-bill-grid-shell">
      <Grid table-title="入仓单列表" @keydown.enter.capture="handleSearchEnter">
        <template #toolbar-tools>
          <TableAction
            :actions="[
              {
                label: '导出',
                type: 'primary',
                icon: ACTION_ICON.DOWNLOAD,
                auth: ['erp:stock-in-bill:export'],
                onClick: handleExport,
              },
            ]"
          />
        </template>
        <template #timeoutFlag="{ row }">
          <Tag v-if="row.timeoutFlag" color="red">超时</Tag>
          <Tag v-else color="default">正常</Tag>
        </template>
        <template #status="{ row }">
          <Tag :color="getStockInBillStatusMeta(row.status).color">
            {{ getStockInBillStatusMeta(row.status).label }}
          </Tag>
        </template>
        <template #no="{ row }">
          <button
            type="button"
            class="stock-in-bill-number-link"
            :title="row.no || ''"
            @click.stop="handleDetail(row)"
          >
            {{ row.no || '-' }}
          </button>
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
        class="stock-in-bill-activation-mask"
      />
    </div>
  </Page>
</template>

<style scoped>
.stock-in-bill-grid-shell {
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

:deep(.vxe-grid--form-wrapper .ant-input-affix-wrapper),
:deep(.vxe-grid--form-wrapper .ant-picker),
:deep(.vxe-grid--form-wrapper .ant-select-single) {
  min-height: 28px;
  font-size: 12px;
}

:deep(.vxe-grid--form-wrapper .ant-input-affix-wrapper),
:deep(.vxe-grid--form-wrapper .ant-picker) {
  padding: 2px 8px;
}

:deep(.vxe-grid--form-wrapper .ant-select-single),
:deep(.vxe-grid--form-wrapper .ant-select-single .ant-select-selector) {
  height: 28px;
}

:deep(.vxe-grid--form-wrapper .ant-select-single .ant-select-selector) {
  padding: 0 8px;
}

:deep(.vxe-grid--form-wrapper .ant-select-single .ant-select-selection-item),
:deep(
  .vxe-grid--form-wrapper .ant-select-single .ant-select-selection-placeholder
) {
  line-height: 26px;
}

:global(.stock-in-bill-search-select-dropdown .ant-select-item),
:global(.stock-in-bill-search-select-dropdown .ant-empty-description) {
  font-size: 12px;
}

:deep(.vxe-grid--form-wrapper .ant-btn),
:deep(.vxe-toolbar .table-actions .ant-btn) {
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

.stock-in-bill-bottom-summary {
  display: flex;
  min-height: 40px;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 4px 14px;
  padding: 5px 8px;
  border-top: 1px solid hsl(var(--border));
  font-size: 12px;
  line-height: 18px;
}

.stock-in-bill-bottom-summary__remaining {
  color: hsl(var(--primary));
  font-weight: 600;
}

@media (max-width: 768px) {
  .stock-in-bill-bottom-summary {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
