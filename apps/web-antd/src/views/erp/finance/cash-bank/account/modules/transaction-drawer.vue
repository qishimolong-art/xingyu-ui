<script lang="ts" setup>import { financeAdd } from '#/views/erp/finance/utils/finance-decimal';

import { financeMoney as erpPriceInputFormatter } from '#/views/erp/finance/utils/finance-decimal';

import { useFinanceCandidateFocus } from '#/views/erp/finance/utils/candidate-focus';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpAccountApi } from '#/api/erp/finance/account';

import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { downloadFileFromBlobPart } from '@vben/utils';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  exportAccountTransactions,
  getAccountExportFields,
  getAccountTransactionPage,
} from '#/api/erp/finance/account';
import ExportFieldModalComponent from '#/views/erp/components/export-field-modal.vue';
import { fitFinanceDocumentListColumnsToWidth } from '#/views/erp/finance/utils/document-list-table';
import { createVxeHeaderSort } from '#/views/erp/utils/vxe-header-sort';

import {
  ACCOUNT_TRANSACTION_SORT_FIELD_MAP,
  resolveTransactionPaymentAmount,
  resolveTransactionReceiptAmount,
  useTransactionGridColumns,
  useTransactionGridFormSchema,
} from '../data';
const { candidateSchema, candidatePagerConfig } = useFinanceCandidateFocus();

const props = withDefaults(
  defineProps<{
    accountId?: number;
  }>(),
  {
    accountId: undefined,
  },
);

const pageRows = ref<ErpAccountApi.AccountTransaction[]>([]);
const transactionViewRef = ref<HTMLElement>();
const [ExportFieldModal, exportFieldModalApi] = useVbenModal({
  connectedComponent: ExportFieldModalComponent,
  destroyOnClose: true,
});
let transactionResizeObserver: ResizeObserver | undefined;
const summary = computed(() => ({
  count: pageRows.value.length,
  receiptAmount: pageRows.value
    .map((item) => resolveTransactionReceiptAmount(item) || 0)
    .reduce((sum, amount) => financeAdd(sum, amount), 0),
  paymentAmount: pageRows.value
    .map((item) => resolveTransactionPaymentAmount(item) || 0)
    .reduce((sum, amount) => financeAdd(sum, amount), 0),
  balance: pageRows.value.find((item) => item.balance !== undefined)?.balance,
}));
const formattedReceiptAmount = computed(() =>
  erpPriceInputFormatter(summary.value.receiptAmount),
);
const formattedPaymentAmount = computed(() =>
  erpPriceInputFormatter(summary.value.paymentAmount),
);
const formattedBalance = computed(() =>
  summary.value.balance === undefined
    ? '-'
    : erpPriceInputFormatter(summary.value.balance),
);

const { buildSortParams, handleSortChange, restoreSortState } =
  createVxeHeaderSort(ACCOUNT_TRANSACTION_SORT_FIELD_MAP);

function buildTransactionColumns(
  rows: ErpAccountApi.AccountTransaction[] = pageRows.value,
) {
  return fitFinanceDocumentListColumnsToWidth(
    useTransactionGridColumns(rows),
    transactionViewRef.value?.clientWidth ?? 0,
  );
}

function handleExport() {
  if (!props.accountId) return;
  exportFieldModalApi
    .setData({
      loadFields: () => getAccountExportFields('transaction'),
      moduleKey: 'erp_account_transaction',
    })
    .open();
}

async function handleExportConfirm(fields: string[]) {
  const formValues = (await gridApi.formApi.getValues()) ?? {};
  const data = await exportAccountTransactions({
    accountId: props.accountId,
    ...formValues,
    ...buildSortParams(),
    fields: fields.join(','),
  });
  downloadFileFromBlobPart({ fileName: '结算账户流水.xls', source: data });
}

function handleSearchEnter(event: KeyboardEvent) {
  if (event.isComposing) {
    return;
  }
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }
  if (target.closest('.ant-picker, .ant-select')) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  void gridApi.formApi.submitForm();
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    commonConfig: { labelWidth: 68 },
    schema: candidateSchema(useTransactionGridFormSchema()),
  },
  gridOptions: {
    pagerConfig: candidatePagerConfig(),
    columns: buildTransactionColumns([]),
    fit: false,
    height: '100%',
    keepSource: true,
    showHeaderOverflow: 'tooltip',
    showOverflow: 'tooltip',
    scrollX: {
      enabled: true,
      gt: 5,
    },
    proxyConfig: {
      ajax: {
        query: async ({ page, sort, sorts }, formValues) => {
          if (!props.accountId) {
            pageRows.value = [];
            return { list: [], total: 0 };
          }
          try {
            const result = await getAccountTransactionPage({
              pageNo: page.currentPage,
              pageSize: page.pageSize,
              accountId: props.accountId,
              ...formValues,
              ...buildSortParams(sorts, sort),
            });
            pageRows.value = result.list || [];
            void gridApi.grid?.reloadColumn?.(
              buildTransactionColumns(pageRows.value),
            );
            return result;
          } catch (error) {
            pageRows.value = [];
            throw error;
          }
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
      keyField: 'no',
      isHover: true,
    },
    toolbarConfig: {
      custom: true,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<ErpAccountApi.AccountTransaction>,
  gridEvents: { sortChange: handleSortChange },
});

watch(
  () => props.accountId,
  () => {
    gridApi.query();
  },
);

onMounted(() => {
  if (typeof ResizeObserver === 'undefined' || !transactionViewRef.value)
    return;
  transactionResizeObserver = new ResizeObserver(() => {
    void gridApi.grid?.reloadColumn?.(buildTransactionColumns());
  });
  transactionResizeObserver.observe(transactionViewRef.value);
});

onBeforeUnmount(() => transactionResizeObserver?.disconnect());
</script>

<template>
  <div ref="transactionViewRef" class="account-transaction-view">
    <ExportFieldModal @confirm="handleExportConfirm" />
    <Grid
      class="account-transaction-grid h-[64vh]"
      @keydown.enter.capture="handleSearchEnter"
    >
      <template #toolbar-tools>
        <TableAction
          :actions="[
            {
              label: '导出',
              type: 'primary',
              icon: ACTION_ICON.DOWNLOAD,
              auth: ['erp:account:export'],
              onClick: handleExport,
            },
          ]"
        />
      </template>
    </Grid>
    <div class="account-transaction-summary">
      <span>本页流水数量：{{ summary.count }}</span>
      <span>收款：{{ formattedReceiptAmount }}</span>
      <span>付款：{{ formattedPaymentAmount }}</span>
      <span>余额：{{ formattedBalance }}</span>
    </div>
  </div>
</template>

<style scoped>
.account-transaction-view {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 70vh;
  font-size: 12px;
}

:deep(.account-transaction-grid .vxe-table--render-default),
:deep(.account-transaction-grid .vxe-grid--form-wrapper),
:deep(.account-transaction-grid .vxe-toolbar) {
  font-size: 12px;
}

:deep(.account-transaction-grid .vxe-grid--form-wrapper .ant-form-item) {
  margin-bottom: 8px;
}

:deep(.account-transaction-grid .vxe-grid--form-wrapper label),
:deep(.account-transaction-grid .vxe-grid--form-wrapper .ant-input),
:deep(.account-transaction-grid .vxe-grid--form-wrapper .ant-picker),
:deep(.account-transaction-grid .vxe-grid--form-wrapper .ant-select),
:deep(.account-transaction-grid .vxe-grid--form-wrapper .ant-btn) {
  font-size: 12px;
}

:deep(
  .account-transaction-grid .vxe-grid--form-wrapper .ant-input-affix-wrapper
),
:deep(.account-transaction-grid .vxe-grid--form-wrapper .ant-picker) {
  min-height: 28px;
  padding: 2px 8px;
}

:deep(.account-transaction-grid .vxe-grid--form-wrapper .ant-select-single),
:deep(
  .account-transaction-grid
    .vxe-grid--form-wrapper
    .ant-select-single
    .ant-select-selector
),
:deep(.account-transaction-grid .vxe-grid--form-wrapper .ant-picker) {
  height: 28px;
  min-height: 28px;
}

:deep(
  .account-transaction-grid
    .vxe-grid--form-wrapper
    .ant-select-single
    .ant-select-selection-item
),
:deep(
  .account-transaction-grid
    .vxe-grid--form-wrapper
    .ant-select-single
    .ant-select-selection-placeholder
) {
  line-height: 26px;
}

:deep(.account-transaction-grid .vxe-grid--form-wrapper .ant-btn),
:deep(.account-transaction-grid .vxe-toolbar .vxe-button) {
  height: 28px;
  font-size: 12px;
}

:deep(.account-transaction-grid .vxe-toolbar .vxe-button) {
  width: 28px !important;
  min-width: 28px !important;
  padding: 0;
}

:deep(.account-transaction-grid .vxe-header--column) {
  height: 34px;
  font-size: 12px;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
}

:deep(.account-transaction-grid .vxe-header--column .vxe-cell--title) {
  white-space: nowrap;
}

:deep(
  .account-transaction-grid .vxe-header--column.is--sortable .vxe-cell--title
) {
  color: #1677ff;
}

:deep(.account-transaction-grid .vxe-header--column .vxe-cell--sort) {
  display: none;
}

:deep(.account-transaction-grid .vxe-body--column) {
  height: 36px;
  font-size: 12px;
}

:deep(.account-transaction-grid .account-transaction-amount-cell) {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.account-transaction-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 24px;
  align-items: center;
  justify-content: flex-end;
  min-height: 42px;
  padding: 8px 12px;
  font-size: 12px;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.account-transaction-summary span {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: hsl(var(--primary));
}
</style>
