<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpStockMoveApi } from '#/api/erp/stock/move';

import { computed, onMounted, provide, ref } from 'vue';

import { DocAlert, Page, useVbenModal } from '@vben/common-ui';
import { downloadFileFromBlobPart } from '@vben/utils';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  exportStockMove,
  getStockMovePage,
  getStockMoveSummary,
} from '#/api/erp/stock/move';
import ErpActivationRefreshMask from '#/views/erp/components/ErpActivationRefreshMask.vue';
import StockListQuerySummary from '#/views/erp/stock/components/StockListQuerySummary.vue';
import { renderStockCandidatePageSizes } from '#/views/erp/stock/utils/candidate-focus';
import { queueFocusStockKeywordSearchInput } from '#/views/erp/stock/utils/keyword-search-focus';
import { stockListNumber } from '#/views/erp/stock/utils/stock-decimal';
import { useStockQuerySummary } from '#/views/erp/stock/utils/use-stock-query-summary';
import { useVxeActivationRefresh } from '#/views/erp/utils/activation-refresh';
import { CANDIDATE_FOCUS_KEY } from '#/views/erp/utils/candidate-focus';
import { createVxeHeaderSort } from '#/views/erp/utils/vxe-header-sort';

import { useGridColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

/** ERP 原库存调拨历史记录（只读）。 */
defineOptions({ name: 'ErpStockMove' });

provide(CANDIDATE_FOCUS_KEY, ref(true));

const { buildSortParams, handleSortChange, restoreSortState } =
  createVxeHeaderSort({
    no: 'no',
    moveTime: 'moveTime',
    updateTime: 'updateTime',
    status: 'status',
  });

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});
const currentPageRows = ref<ErpStockMoveApi.StockMove[]>([]);
const stockMoveGridShellRef = ref<HTMLElement>();

function formatSummaryValue(value?: null | number | string, _scale = 2) {
  if (value === null || value === undefined) return '****';
  return stockListNumber(value);
}

const querySummaryState = useStockQuerySummary((params, signal) =>
  getStockMoveSummary(params, signal),
);
const querySummaryItems = computed(() => {
  const value = querySummaryState.summary.value;
  if (!value) return [];
  return [
    {
      key: 'totalCount',
      label: '调拨数量',
      value: formatSummaryValue(value.totalCount, 3),
    },
    {
      key: 'totalPrice',
      label: '调拨金额',
      value: formatSummaryValue(value.totalPrice),
    },
  ];
});

function handleRefresh() {
  querySummaryState.invalidate();
  gridApi.query();
}

async function handleExport() {
  const data = await exportStockMove({
    ...(await gridApi.formApi.getValues()),
    ...buildSortParams(),
  });
  downloadFileFromBlobPart({ fileName: '库存调拨历史记录.xls', source: data });
}

function handleDetail(row: ErpStockMoveApi.StockMove) {
  formModalApi.setData({ type: 'detail', id: row.id }).open();
}

function buildStockMoveListColumns(rows = currentPageRows.value) {
  return (useGridColumns(rows) ?? []).filter(
    (column: any) => column.type !== 'checkbox',
  );
}

async function reloadStockMoveListColumns(rows = currentPageRows.value) {
  const columns = buildStockMoveListColumns(rows);
  gridApi.setGridOptions({ columns });
  await gridApi.grid?.reloadColumn?.(columns as any[]);
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    schema: useGridFormSchema(),
  },
  gridOptions: {
    pagerConfig: { slots: { sizes: renderStockCandidatePageSizes } },
    columns: buildStockMoveListColumns(),
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
    id: 'erp-stock-move-list-v2',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page, sort, sorts }, formValues) => {
          const summaryChanged = querySummaryState.prepare(formValues);
          let pageFailed = false;
          const result = await getStockMovePage({
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
          await reloadStockMoveListColumns();
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
  } as VxeTableGridOptions<ErpStockMoveApi.StockMove>,
  gridEvents: {
    sortChange: handleSortChange,
  },
});

const { activationRefreshMaskVisible } =
  useVxeActivationRefresh<ErpStockMoveApi.StockMove>({
    gridApi,
    getParams: async () => ({
      ...(await gridApi.formApi.getValues()),
      ...buildSortParams(),
    }),
    queryPage: (params) => getStockMovePage({ ...params, includeItems: false }),
    onSuccess: async (rows) => {
      currentPageRows.value = rows;
      await reloadStockMoveListColumns(rows);
      await restoreSortState(gridApi);
    },
    onAfterRefresh: () => {
      querySummaryState.invalidate();
      void gridApi.formApi
        .getValues()
        .then((params) => querySummaryState.load(params));
      queueFocusStockKeywordSearchInput(stockMoveGridShellRef);
    },
    onFirstActivated: () => {
      queueFocusStockKeywordSearchInput(stockMoveGridShellRef);
    },
    errorMessage: 'Error occurred while refreshing stock move page:',
  });

onMounted(() => {
  queueFocusStockKeywordSearchInput(stockMoveGridShellRef);
});
</script>

<template>
  <Page auto-content-height>
    <template #doc>
      <DocAlert
        title="库存调拨（历史只读，新业务请使用调拨出库单）"
        url="https://doc.iocoder.cn/erp/stock-move-check/"
      />
    </template>

    <FormModal @success="handleRefresh" />
    <div ref="stockMoveGridShellRef" class="stock-move-grid-shell">
      <Grid table-title="库存调拨历史记录">
        <template #toolbar-tools>
          <TableAction
            :actions="[
              {
                label: '导出',
                type: 'primary',
                icon: ACTION_ICON.DOWNLOAD,
                auth: ['erp:stock-move:export'],
                onClick: handleExport,
              },
            ]"
          />
        </template>
        <template #no="{ row }">
          <button
            type="button"
            class="stock-move-number-link"
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
        class="stock-move-activation-mask"
      />
    </div>
  </Page>
</template>

<style scoped>
.stock-move-grid-shell {
  position: relative;
  height: 100%;
  min-height: 100%;
}
</style>
