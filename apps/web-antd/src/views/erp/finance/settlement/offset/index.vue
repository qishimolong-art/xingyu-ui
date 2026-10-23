<script lang="ts" setup>
import { financeListMoney as erpPriceInputFormatter } from '#/views/erp/finance/utils/finance-decimal';

import { provideFinanceCandidateFocus } from '#/views/erp/finance/utils/candidate-focus';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpSettlementOffsetApi } from '#/api/erp/finance/settlement/offset';
import type { PageParam } from '@vben/request';

import { computed, onMounted, ref } from 'vue';

import { Page, useVbenDrawer } from '@vben/common-ui';


import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  getSettlementOffsetPage,
  getSettlementOffsetSummary,
} from '#/api/erp/finance/settlement/offset';
import ErpActivationRefreshMask from '#/views/erp/components/ErpActivationRefreshMask.vue';
import FinanceListQuerySummary from '#/views/erp/finance/components/FinanceListQuerySummary.vue';
import { useFinanceQuerySummary } from '#/views/erp/finance/utils/use-finance-query-summary';
import { useVxeActivationRefresh } from '#/views/erp/utils/activation-refresh';
import { withErpKeywordSearchSchema } from '#/views/erp/utils/form-defaults';
import { submitSearchFormOnEnterAndBlur } from '#/views/erp/utils/keyboard';
import { createVxeHeaderSort } from '#/views/erp/utils/vxe-header-sort';

import { queueFocusFinanceKeywordSearchInput } from '../../utils/keyword-search-focus';
import { useGridColumns, useGridFormSchema } from './data';
import DetailDrawer from './modules/detail-drawer.vue';
import { getOffsetDirection, getOffsetDirectionLabel } from './offset-ui';
const { candidateSchema, candidatePagerConfig } =
  provideFinanceCandidateFocus();

defineOptions({ name: 'ErpSettlementOffset' });

const settlementOffsetGridShellRef = ref<HTMLElement>();
const currentCustomerId = ref<number>();
const currentSupplierId = ref<number>();
const currentApproveTime = ref<string[]>([]);
const pageRows = ref<ErpSettlementOffsetApi.SettlementOffset[]>([]);

const [Drawer, drawerApi] = useVbenDrawer({
  title: '应收冲应付明细',
  footer: false,
  destroyOnClose: true,
});

const querySummaryState = useFinanceQuerySummary((params, signal) =>
  getSettlementOffsetSummary(params, signal),
);
const summary = computed(() => ({
  receivable: querySummaryState.summary.value?.receivableBalance,
  payable: querySummaryState.summary.value?.payableBalance,
  offset: querySummaryState.summary.value?.offsetBalance,
}));
const summaryDirection = computed(() =>
  getOffsetDirection(Number(summary.value.offset || 0)),
);
const summaryDirectionLabel = computed(() =>
  getOffsetDirectionLabel(summaryDirection.value),
);
const querySummaryItems = computed(() => {
  const value = querySummaryState.summary.value;
  if (!value) return [];
  const amount = (input?: null | number) =>
    input === null || input === undefined
      ? '****'
      : erpPriceInputFormatter(input);
  return [
    {
      key: 'documentCount',
      label: '往来主体',
      value: `${value.documentCount ?? 0} 个`,
    },
    {
      key: 'receivableBalance',
      label: '应收余额',
      value: amount(value.receivableBalance),
    },
    {
      key: 'payableBalance',
      label: '应付余额',
      value: amount(value.payableBalance),
    },
    {
      key: 'offsetBalance',
      label: `轧抵净额 · ${summaryDirectionLabel.value}`,
      value: amount(value.offsetBalance),
    },
  ];
});

async function querySettlementOffsetPage(
  params: PageParam & Record<string, any>,
) {
  const approvalParams = { ...params, dateBasis: 'approveTime' };
  const summaryChanged = querySummaryState.prepare(approvalParams);
  let pageRequestFailed = false;
  const result = await getSettlementOffsetPage(approvalParams).catch(
    (error) => {
      pageRequestFailed = true;
      querySummaryState.cancelPending();
      if (pageRows.value.length > 0)
        return {
          list: pageRows.value,
          total:
            gridApi.grid?.getProxyInfo?.()?.pager?.total ??
            pageRows.value.length,
        };
      throw error;
    },
  );
  pageRows.value = result.list || [];
  if (!pageRequestFailed)
    void querySummaryState.load(approvalParams, summaryChanged);
  return result;
}

async function handleOpenDetail(row: ErpSettlementOffsetApi.SettlementOffset) {
  currentCustomerId.value = row.customerId;
  currentSupplierId.value = row.supplierId;
  const formValues = await gridApi.formApi.getValues();
  currentApproveTime.value = formValues.approveTime || [];
  drawerApi
    .setState({
      title: row.subjectName
        ? `应收冲应付明细 - ${row.subjectName}`
        : '应收冲应付明细',
    })
    .open();
}

function handleSearchEnter(event: KeyboardEvent) {
  submitSearchFormOnEnterAndBlur(event, () => gridApi.formApi.submitForm());
}

const offsetSortFieldMap = {
  customerCode: 'customerCode',
  subjectName: 'subjectName',
  receivableBalance: 'receivableBalance',
  payableBalance: 'payableBalance',
  offsetBalance: 'offsetBalance',
};
const { buildSortParams, handleSortChange, restoreSortState } =
  createVxeHeaderSort(offsetSortFieldMap);

function buildGridColumns(
  rows: ErpSettlementOffsetApi.SettlementOffset[] = pageRows.value,
) {
  return (useGridColumns(rows) || []).map((column) =>
    column.field && column.field in offsetSortFieldMap
      ? { ...column, sortable: true }
      : column,
  );
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    commonConfig: { labelWidth: 72 },
    schema: candidateSchema(withErpKeywordSearchSchema(useGridFormSchema())),
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
    fit: false,
    height: 'auto',
    id: 'erp-finance-settlement-offset-list-v2',
    keepSource: true,
    showHeaderOverflow: 'tooltip',
    showOverflow: 'tooltip',
    scrollX: { enabled: true, gt: 6 },
    scrollY: { enabled: true, gt: 10 },
    proxyConfig: {
      ajax: {
        query: async ({ page, sort, sorts }, formValues) =>
          await querySettlementOffsetPage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
            ...buildSortParams(sorts, sort),
          }).then((result) => {
            void gridApi.grid?.reloadColumn?.(buildGridColumns(pageRows.value));
            return result;
          }),
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
      keyField: 'customerId',
      isHover: true,
    },
    toolbarConfig: {
      refresh: true,
      search: true,
    },
  } as VxeTableGridOptions<ErpSettlementOffsetApi.SettlementOffset>,
  gridEvents: {
    sortChange: handleSortChange,
  },
});

const { activationRefreshMaskVisible } =
  useVxeActivationRefresh<ErpSettlementOffsetApi.SettlementOffset>({
    gridApi,
    errorMessage: 'Error occurred while refreshing settlement offset page:',
    onAfterRefresh: () =>
      queueFocusFinanceKeywordSearchInput(settlementOffsetGridShellRef),
    onFirstActivated: () =>
      queueFocusFinanceKeywordSearchInput(settlementOffsetGridShellRef),
    getParams: async () => ({
      ...(await gridApi.formApi.getValues()),
      ...buildSortParams(),
    }),
    queryPage: async (params) => {
      querySummaryState.invalidate();
      return querySettlementOffsetPage(params);
    },
    onSuccess: (rows) => {
      pageRows.value = rows;
      void gridApi.grid?.reloadColumn?.(buildGridColumns(rows));
      void restoreSortState(gridApi);
    },
  });

onMounted(() =>
  queueFocusFinanceKeywordSearchInput(settlementOffsetGridShellRef),
);
</script>

<template>
  <Page auto-content-height>
    <Drawer class="w-[85vw]">
      <DetailDrawer
        :approve-time="currentApproveTime"
        :customer-id="currentCustomerId"
        :supplier-id="currentSupplierId"
      />
    </Drawer>
    <div
      ref="settlementOffsetGridShellRef"
      class="settlement-offset-grid-shell"
    >
      <Grid
        table-title="应收冲应付列表"
        @keydown.enter.capture="handleSearchEnter"
      >
        <template #subjectName="{ row }">
          <button
            type="button"
            class="offset-subject-link"
            :title="row.subjectName || ''"
            @click.stop="handleOpenDetail(row)"
          >
            {{ row.subjectName || '-' }}
          </button>
        </template>
        <template #offsetBalance="{ row }">
          <span
            :class="{
              'text-blue-600': Number(row.offsetBalance) > 0,
              'text-red-500': Number(row.offsetBalance) < 0,
              'text-muted-foreground': Number(row.offsetBalance) === 0,
            }"
          >
            {{ erpPriceInputFormatter(row.offsetBalance) }}
          </span>
        </template>
        <template #actions="{ row }">
          <TableAction
            :actions="[
              {
                label: '明细',
                type: 'link',
                icon: ACTION_ICON.VIEW,
                auth: ['erp:settlement-offset:query'],
                onClick: handleOpenDetail.bind(null, row),
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
        class="settlement-offset-activation-mask"
      />
    </div>
  </Page>
</template>

<style scoped>
.settlement-offset-grid-shell {
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
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

:deep(.vxe-grid--form-wrapper label),
:deep(.vxe-grid--form-wrapper .ant-input),
:deep(.vxe-grid--form-wrapper .ant-picker),
:deep(.vxe-grid--form-wrapper .ant-picker-input > input),
:deep(.vxe-grid--form-wrapper .ant-switch),
:deep(.vxe-grid--form-wrapper .ant-btn),
:deep(.vxe-grid--form-wrapper .vben-link) {
  font-size: 12px;
}

:deep(.vxe-grid--form-wrapper .ant-input-affix-wrapper) {
  min-height: 28px;
  padding: 2px 8px;
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

.offset-subject-link {
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

.offset-subject-link:hover,
.offset-subject-link:focus-visible {
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

.offset-summary {
  display: grid;
  overflow: hidden;
  border-top: 1px solid hsl(var(--border));
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.offset-summary__item {
  display: flex;
  min-width: 0;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 12px;
  border-right: 1px solid hsl(var(--border));
}

.offset-summary__item:last-child {
  border-right: 0;
}

.offset-summary__item span {
  overflow: hidden;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.offset-summary__item strong {
  color: hsl(var(--foreground));
  font-size: 14px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.offset-summary__item--receivable {
  box-shadow: inset 3px 0 0 #1677ff;
}

.offset-summary__item--payable {
  box-shadow: inset 3px 0 0 #d97706;
}

.offset-summary__item--result {
  background: hsl(var(--muted) / 28%);
}

.offset-summary__item--receivable.offset-summary__item--result strong {
  color: #1677ff;
}

.offset-summary__item--payable.offset-summary__item--result strong {
  color: hsl(var(--destructive));
}

.offset-summary__item--balanced.offset-summary__item--result strong {
  color: hsl(var(--success));
}

@media (max-width: 900px) {
  .offset-summary {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .offset-summary__item:nth-child(2) {
    border-right: 0;
  }
}

@media (max-width: 560px) {
  .offset-summary {
    grid-template-columns: minmax(0, 1fr);
  }

  .offset-summary__item {
    border-right: 0;
    border-bottom: 1px solid hsl(var(--border));
  }
}
</style>
