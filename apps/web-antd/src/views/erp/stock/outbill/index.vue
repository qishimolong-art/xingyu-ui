<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpStockOutBillApi } from '#/api/erp/stock/outbill';

import { computed, provide, ref, watch } from 'vue';

import { useAccess } from '@vben/access';
import { DocAlert, Page, useVbenModal } from '@vben/common-ui';
import { downloadFileFromBlobPart } from '@vben/utils';

import { Alert, Tag } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  exportStockOutBill,
  getStockOutBillExportFields,
  getStockOutBillPage,
  getStockOutBillSummary,
  STOCK_OUT_BILL_HISTORY_NOTICE,
} from '#/api/erp/stock/outbill';
import {
  isFieldHidden,
  useFieldPermission,
} from '#/composables/useFieldPermission';
import ErpActivationRefreshMask from '#/views/erp/components/ErpActivationRefreshMask.vue';
import ExportFieldModalComponent from '#/views/erp/components/export-field-modal.vue';
import StockListQuerySummary from '#/views/erp/stock/components/StockListQuerySummary.vue';
import { renderStockCandidatePageSizes } from '#/views/erp/stock/utils/candidate-focus';
import { useStockDocumentColumns } from '#/views/erp/stock/utils/document-columns';
import { prepareStockDocumentListColumns } from '#/views/erp/stock/utils/document-list-table';
import { formatStockNaturalNumber } from '#/views/erp/stock/utils/document-number';
import { stockListNumber } from '#/views/erp/stock/utils/stock-decimal';
import { useStockQuerySummary } from '#/views/erp/stock/utils/use-stock-query-summary';
import { useVxeActivationRefresh } from '#/views/erp/utils/activation-refresh';
import { CANDIDATE_FOCUS_KEY } from '#/views/erp/utils/candidate-focus';
import { submitSearchFormOnEnterAndBlur } from '#/views/erp/utils/keyboard';
import { createVxeHeaderSort } from '#/views/erp/utils/vxe-header-sort';

import { useGridColumns, useGridFormSchema } from './data';
import DetailModal from './modules/detail-modal.vue';
import { stockOutBillHistoryStatus } from './outbill-history';

defineOptions({ name: 'ErpStockOutBill' });

provide(CANDIDATE_FOCUS_KEY, ref(true));

const { hasAccessByCodes } = useAccess();
const canQueryHistory = computed(() =>
  hasAccessByCodes(['erp:stock-out-bill:query']),
);

const { buildSortParams, handleSortChange, restoreSortState } =
  createVxeHeaderSort({
    priority: 'priority',
    no: 'no',
    pick: 'pick',
    billDate: 'billDate',
    shippingArea: 'shippingArea',
    sourceNo: 'sourceNo',
    status: 'status',
    createTime: 'createTime',
    updateTime: 'updateTime',
    auditTime: 'auditTime',
    printTime: 'printTime',
    printCount: 'printCount',
    totalWeight: 'totalWeight',
    sourceRemark: 'sourceRemark',
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
  useFieldPermission('erp_stock_out_bill');
const pendingExportParams = ref<Record<string, any>>({});
const currentPageRows = ref<ErpStockOutBillApi.StockOutBill[]>([]);
const stockOutBillGridShellRef = ref<HTMLElement>();

function formatSummaryNumber(value?: null | number | string, integer = false) {
  if (value === null || value === undefined) return '****';
  return integer ? formatStockNaturalNumber(value) : stockListNumber(value);
}

const querySummaryState = useStockQuerySummary((params, signal) =>
  getStockOutBillSummary(params, signal),
);
const querySummaryItems = computed(() => {
  const value = querySummaryState.summary.value;
  if (!value) return [];
  return [
    {
      key: 'totalWeight',
      label: '总重',
      value: formatSummaryNumber(value.totalWeight),
    },
    {
      key: 'wholeQty',
      label: '整件数',
      value: formatSummaryNumber(value.wholeQty),
    },
    {
      key: 'looseQty',
      label: '散件数',
      value: formatSummaryNumber(value.looseQty),
    },
    {
      key: 'totalCount',
      label: '历史应领数量',
      value: formatSummaryNumber(value.totalCount),
    },
    {
      key: 'pickedCount',
      label: '历史已领数量',
      value: formatSummaryNumber(value.pickedCount),
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

/** 普通查询与重新激活页面共用权限边界，晚响应也不能恢复已撤权的数据。 */
async function queryHistoryPage(
  params: Parameters<typeof getStockOutBillPage>[0],
) {
  await loadHiddenFields();
  if (!canQueryHistory.value) {
    currentPageRows.value = [];
    return { list: [], total: 0 };
  }
  const result = await getStockOutBillPage(params);
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
  if (!hasAccessByCodes(['erp:stock-out-bill:export'])) return;
  const selectedIds = (
    (gridApi.grid?.getCheckboxRecords?.() as
      | ErpStockOutBillApi.StockOutBill[]
      | undefined) ?? []
  )
    .map((item) => item.id!)
    .filter((id) => id !== undefined);
  pendingExportParams.value =
    selectedIds.length > 0
      ? { ids: selectedIds.join(','), ...buildSortParams() }
      : {
          ...normalizeSearchParams(await gridApi.formApi.getValues()),
          ...buildSortParams(),
        };
  exportFieldModalApi
    .setData({
      preserveDecimalPrecision: true,
      loadFields: getStockOutBillExportFields,
      moduleKey: 'erp_stock_out_bill',
    })
    .open();
}

async function handleExportConfirm(fields: string[]) {
  if (!hasAccessByCodes(['erp:stock-out-bill:export'])) return;
  const data = await exportStockOutBill({
    ...pendingExportParams.value,
    fields: fields.join(','),
  });
  if (!hasAccessByCodes(['erp:stock-out-bill:export'])) return;
  downloadFileFromBlobPart({ fileName: '出仓单.xls', source: data });
}

function handleDetail(row: ErpStockOutBillApi.StockOutBill) {
  if (!hasAccessByCodes(['erp:stock-out-bill:query'])) return;
  detailModalApi.setData({ id: row.id, mode: 'detail' }).open();
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
            formatter: ({ cellValue }: any) =>
              formatStockNaturalNumber(cellValue),
          }
        : column,
    );
  return prepareStockDocumentListColumns(columns, currentPageRows.value);
}
const listColumnState = useStockDocumentColumns({
  columns: listColumns,
  grid: () => gridApi,
  wrapper: () => stockOutBillGridShellRef.value,
  fill: false,
  afterReload: () => restoreSortState(gridApi),
});
async function reloadStockOutBillListColumns(
  _rows: any[] = currentPageRows.value,
) {
  await listColumnState.reload();
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    commonConfig: { labelWidth: 68 },
    schema: useGridFormSchema(),
  },
  gridOptions: {
    pagerConfig: { slots: { sizes: renderStockCandidatePageSizes } },
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
    id: 'erp-stock-out-bill-list-v2',
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
          const summaryChanged = canQueryHistory.value
            ? querySummaryState.prepare(params)
            : false;
          if (!canQueryHistory.value) {
            querySummaryState.cancelPending();
          }
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
          currentPageRows.value = result.list || [];
          await reloadStockOutBillListColumns(currentPageRows.value);
          if (!pageFailed && canQueryHistory.value) {
            void querySummaryState.load(params, summaryChanged);
          }
          return result;
        },
        querySuccess: () => {
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
  } as VxeTableGridOptions<ErpStockOutBillApi.StockOutBill>,
  gridEvents: {
    custom: listColumnState.custom,
    resizableChange: listColumnState.queue,
    zoom: listColumnState.queue,
    sortChange: handleSortChange,
  },
});

function clearHistoryRows() {
  querySummaryState.cancelPending();
  querySummaryState.invalidate();
  currentPageRows.value = [];
  const pager = gridApi.grid?.getProxyInfo?.()?.pager;
  if (pager) {
    pager.currentPage = 1;
    pager.total = 0;
  }
  void reloadStockOutBillListColumns([]);
  return gridApi.grid?.loadData?.([]);
}
watch(canQueryHistory, async (allowed) => {
  if (!allowed) {
    await clearHistoryRows();
  }
});

const { activationRefreshMaskVisible } =
  useVxeActivationRefresh<ErpStockOutBillApi.StockOutBill>({
    gridApi,
    getParams: async () => ({
      ...normalizeSearchParams(await gridApi.formApi.getValues()),
      ...buildSortParams(),
    }),
    queryPage: queryHistoryPage,
    onSuccess: async (rows) => {
      if (!canQueryHistory.value) {
        await clearHistoryRows();
        return;
      }
      currentPageRows.value = rows;
      await reloadStockOutBillListColumns(rows);
      await restoreSortState(gridApi);
    },
    onAfterRefresh: () => {
      querySummaryState.invalidate();
      if (canQueryHistory.value) {
        void gridApi.formApi
          .getValues()
          .then((params) =>
            querySummaryState.load(normalizeSearchParams(params)),
          );
      }
    },

    errorMessage: 'Error occurred while refreshing stock out bill page:',
  });
</script>

<template>
  <Page auto-content-height>
    <template #doc>
      <DocAlert
        title="【库存】出仓单"
        url="https://doc.iocoder.cn/erp/stock/"
      />
    </template>

    <DetailModalComponent @success="handleRefresh" />
    <ExportFieldModal @confirm="handleExportConfirm" />
    <Alert class="mb-2" type="info" :message="STOCK_OUT_BILL_HISTORY_NOTICE" />
    <Alert
      v-if="!canQueryHistory"
      class="mb-2"
      type="warning"
      message="没有历史出仓单查询权限"
    />
    <div ref="stockOutBillGridShellRef" class="stock-out-bill-grid-shell">
      <Grid
        table-title="历史出仓单列表"
        @keydown.enter.capture="handleSearchEnter"
      >
        <template #toolbar-tools>
          <TableAction
            :actions="[
              {
                label: '导出',
                type: 'primary',
                icon: ACTION_ICON.DOWNLOAD,
                auth: ['erp:stock-out-bill:export'],
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
          <Tag
            :color="
              row.status === 30
                ? 'green'
                : row.status === 20
                  ? 'blue'
                  : 'orange'
            "
          >
            {{ stockOutBillHistoryStatus(row.status) }}
          </Tag>
        </template>
        <template #no="{ row }">
          <button
            type="button"
            class="stock-out-bill-number-link"
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
        class="stock-out-bill-activation-mask"
      />
    </div>
  </Page>
</template>

<style scoped>
.stock-out-bill-grid-shell {
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

:global(.stock-out-bill-search-select-dropdown .ant-select-item),
:global(.stock-out-bill-search-select-dropdown .ant-empty-description) {
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

:deep(.stock-out-bill-number-link) {
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

:deep(.stock-out-bill-number-link:hover),
:deep(.stock-out-bill-number-link:focus-visible) {
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

.stock-out-bill-bottom-summary {
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

.stock-out-bill-bottom-summary strong {
  margin-right: auto;
}

@media (max-width: 768px) {
  .stock-out-bill-bottom-summary {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
