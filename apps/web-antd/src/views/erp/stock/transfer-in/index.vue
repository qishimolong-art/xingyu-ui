<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpStockTransferInApi } from '#/api/erp/stock/transfer-in';

import { computed, onMounted, provide, ref } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { downloadFileFromBlobPart } from '@vben/utils';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  exportStockTransferIn,
  getStockTransferInExportFields,
  getStockTransferInPage,
  getStockTransferInSummary,
} from '#/api/erp/stock/transfer-in';
import { useFieldPermission } from '#/composables/useFieldPermission';
import ErpActivationRefreshMask from '#/views/erp/components/ErpActivationRefreshMask.vue';
import ExportFieldModalComponent from '#/views/erp/components/export-field-modal.vue';
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
import { withErpKeywordSearchSchema } from '#/views/erp/utils/form-defaults';
import { submitSearchFormOnEnterAndBlur } from '#/views/erp/utils/keyboard';
import { createVxeHeaderSort } from '#/views/erp/utils/vxe-header-sort';

import { useGridColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

defineOptions({ name: 'ErpStockTransferIn' });

provide(CANDIDATE_FOCUS_KEY, ref(true));

const { buildSortParams, handleSortChange, restoreSortState } =
  createVxeHeaderSort({
    no: 'no',
    fromWarehouseNames: 'fromWarehouseNames',
    fromDeptName: 'fromDeptName',
    moveTime: 'moveTime',
    toWarehouseNames: 'toWarehouseNames',
    toDeptName: 'toDeptName',
    totalCount: 'totalCount',
    totalPrice: 'totalPrice',
    creatorName: 'creatorName',
    remark: 'remark',
    createTime: 'createTime',
    updaterName: 'updaterName',
    updateTime: 'updateTime',
  });

const FIELD_PERMISSION_MODULE = 'erp_stock_transfer_in';
const { hiddenFields, loadHiddenFields } = useFieldPermission(
  FIELD_PERMISSION_MODULE,
);
const currentPageRows = ref<ErpStockTransferInApi.StockTransferIn[]>([]);
const pendingExportParams = ref<Record<string, any>>({});
const stockTransferInGridShellRef = ref<HTMLElement>();

function formatSummaryValue(value?: null | number | string, _scale = 2) {
  if (value === null || value === undefined) return '****';
  return stockListNumber(value);
}

const querySummaryState = useStockQuerySummary((params, signal) =>
  getStockTransferInSummary(params, signal),
);
const querySummaryItems = computed(() => {
  const value = querySummaryState.summary.value;
  if (!value) return [];
  return [
    {
      key: 'totalCount',
      label: '调拨入库数量',
      value: formatStockNaturalNumber(value.totalCount),
    },
    {
      key: 'totalPrice',
      label: '调拨入库金额',
      value: formatSummaryValue(value.totalPrice),
    },
  ];
});

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

const [ExportFieldModal, exportFieldModalApi] = useVbenModal({
  connectedComponent: ExportFieldModalComponent,
  destroyOnClose: true,
});

function buildSearchSchema() {
  return withErpKeywordSearchSchema(
    withCandidateFocus(useGridFormSchema(hiddenFields.value)),
  );
}

function handleRefresh() {
  querySummaryState.invalidate();
  gridApi.query();
}

async function handleExport() {
  pendingExportParams.value = {
    ...(await gridApi.formApi.getValues()),
    ...buildSortParams(),
  };
  exportFieldModalApi
    .setData({
      preserveDecimalPrecision: true,
      loadFields: getStockTransferInExportFields,
      moduleKey: FIELD_PERMISSION_MODULE,
    })
    .open();
}

async function handleExportConfirm(fields: string[]) {
  const data = await exportStockTransferIn({
    ...pendingExportParams.value,
    fields: fields.join(','),
  });
  downloadFileFromBlobPart({ fileName: '调拨入库单.xlsx', source: data });
}

function handleDetail(row: ErpStockTransferInApi.StockTransferIn) {
  formModalApi.setData({ id: row.id }).open();
}

function handleSearchEnter(event: KeyboardEvent) {
  submitSearchFormOnEnterAndBlur(event, () => gridApi.formApi.submitForm());
}

async function reloadTransferInListColumns(
  rows = currentPageRows.value,
  _fields = hiddenFields.value,
) {
  currentPageRows.value = rows;
  await listColumns.reload();
}

const listColumns = useStockDocumentColumns({
  columns: () =>
    (useGridColumns(hiddenFields.value, currentPageRows.value) || []).filter(
      (column: any) => column.visible !== false,
    ),
  grid: () => gridApi,
  wrapper: () => stockTransferInGridShellRef.value,
});
const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    commonConfig: { labelWidth: 88 },
    schema: buildSearchSchema(),
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
    id: 'erp-stock-transfer-in-list-v2',
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
          const result = await getStockTransferInPage({
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
          await reloadTransferInListColumns();
          if (!pageFailed)
            void querySummaryState.load(formValues, summaryChanged);
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
    toolbarConfig: {
      refresh: true,
      search: true,
    },
  } as VxeTableGridOptions<ErpStockTransferInApi.StockTransferIn>,
  gridEvents: {
    custom: listColumns.custom,
    resizableChange: listColumns.queue,
    zoom: listColumns.queue,
    sortChange: handleSortChange,
  },
});

let appliedHiddenFields = [...hiddenFields.value];

const { activationRefreshMaskVisible } =
  useVxeActivationRefresh<ErpStockTransferInApi.StockTransferIn>({
    gridApi,
    getParams: async () => ({
      ...(await gridApi.formApi.getValues()),
      ...buildSortParams(),
    }),
    queryPage: (params) =>
      getStockTransferInPage({ ...params, includeItems: false }),
    onSuccess: async (rows) => {
      currentPageRows.value = rows;
      await reloadTransferInListColumns(rows);
      await restoreSortState(gridApi);
    },
    onAfterRefresh: () => {
      querySummaryState.invalidate();
      void gridApi.formApi
        .getValues()
        .then((params) => querySummaryState.load(params));
    },
    onFirstActivated: () => {},
    errorMessage: 'Error occurred while refreshing stock transfer in page:',
  });

onMounted(async () => {
  await loadHiddenFields();
  const fields = hiddenFields.value;
  if (isSameFieldSet(appliedHiddenFields, fields)) {
    return;
  }
  appliedHiddenFields = [...fields];
  gridApi.formApi?.setState?.({ schema: buildSearchSchema() });
  await reloadTransferInListColumns(currentPageRows.value, fields);
});
</script>

<template>
  <Page auto-content-height>
    <FormModal @success="handleRefresh" />
    <ExportFieldModal @confirm="handleExportConfirm" />
    <div ref="stockTransferInGridShellRef" class="stock-transfer-in-grid-shell">
      <Grid
        table-title="调拨入库单列表"
        @keydown.enter.capture="handleSearchEnter"
      >
        <template #toolbar-tools>
          <TableAction
            :actions="[
              {
                label: '导出',
                type: 'primary',
                icon: ACTION_ICON.DOWNLOAD,
                auth: ['erp:stock-transfer-in:export'],
                onClick: handleExport,
              },
            ]"
          />
        </template>
        <template #no="{ row }">
          <button
            type="button"
            class="stock-transfer-in-number-link"
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
        class="stock-transfer-in-activation-mask"
      />
    </div>
  </Page>
</template>

<style scoped>
.stock-transfer-in-grid-shell {
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

:deep(.vxe-grid--form-wrapper .ant-picker) {
  height: 28px;
  padding: 2px 8px;
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

:global(.stock-transfer-in-search-select-dropdown .ant-select-item),
:global(.stock-transfer-in-search-select-dropdown .ant-empty-description) {
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

:deep(.vxe-body--column .table-actions .ant-btn-link),
:deep(.vxe-body--column .ant-btn-link) {
  height: auto;
  padding: 0;
  font-size: 12px;
}

.stock-transfer-in-number-link {
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

.stock-transfer-in-number-link:hover,
.stock-transfer-in-number-link:focus-visible {
  text-decoration: underline;
}

:deep(.vxe-grid--pager-wrapper) {
  position: sticky;
  z-index: 5;
  bottom: 0;
  margin-top: 0 !important;
  background: hsl(var(--card));
  box-shadow: 0 -2px 8px rgb(0 0 0 / 8%);
}
</style>
