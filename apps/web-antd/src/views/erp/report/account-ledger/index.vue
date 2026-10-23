<script setup lang="ts">
import { financeMoneyGrouped } from '#/views/erp/finance/utils/finance-decimal';
import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpAccountLedgerReportApi } from '#/api/erp/report/account-ledger';
import type { ReportDocumentType } from '#/views/erp/report/components/report-document-detail';

import { computed, ref } from 'vue';

import { useAccess } from '@vben/access';
import { downloadFileFromBlobPart } from '@vben/utils';

import { message } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import { getAccountSimplePage } from '#/api/erp/finance/account';
import {
  exportAccountLedgerReport,
  getAccountLedgerReportPage,
  getAccountLedgerReportSummary,
  getAccountLedgerReportUserSimplePage,
} from '#/api/erp/report/account-ledger';
import { getRangePickerDefaultProps } from '#/utils';
import ReportDocumentDetailModal from '#/views/erp/report/components/report-document-detail-modal.vue';
import ReportDocumentLink from '#/views/erp/report/components/report-document-link.vue';
import { REPORT_DOCUMENT_TYPES } from '#/views/erp/report/components/report-document-detail';
import { prepareSaleDocumentListColumns } from '#/views/erp/sale/utils/document-list-table';
import { createVxeHeaderSort } from '#/views/erp/utils/vxe-header-sort';

defineOptions({ name: 'ErpAccountLedgerReport' });

type ReportRow = ErpAccountLedgerReportApi.Row;
const { hasAccessByCodes } = useAccess();
const canExport = computed(
  () =>
    hasAccessByCodes(['erp:account-ledger-report:export']) &&
    hasAccessByCodes(['erp:account:query']),
);
const summary = ref<ErpAccountLedgerReportApi.Summary>({});
const currentRows = ref<ReportRow[]>([]);
const exporting = ref(false);
const documentDetailModalRef =
  ref<InstanceType<typeof ReportDocumentDetailModal>>();
const amountVisible = computed(
  () =>
    summary.value.amountVisible !== false &&
    currentRows.value.every((row) => row.amountVisible !== false),
);
const amountFields = new Set(['balance', 'expenseAmount', 'incomeAmount']);
const sortFieldMap: Record<string, string> = {
  accountName: 'accountName',
  balance: 'balance',
  businessDate: 'businessDate',
  businessNo: 'businessNo',
  direction: 'direction',
  documentType: 'documentType',
  expenseAmount: 'expenseAmount',
  incomeAmount: 'incomeAmount',
  partyCode: 'partyCode',
  partyName: 'partyName',
  payerName: 'payerName',
  receiverName: 'receiverName',
  remark: 'remark',
};
const { buildSortParams, handleSortChange, restoreSortState } =
  createVxeHeaderSort(sortFieldMap);

function lazySelect(api: Function, placeholder: string, labelField = 'name') {
  return {
    allowClear: true,
    api,
    labelField,
    loadErrorMessage: `${placeholder}列表加载失败，请重试`,
    pageSize: 10,
    placeholder: `请选择${placeholder}`,
    popupClassName: 'account-ledger-report-search-select-dropdown',
    showSearch: true,
    valueField: 'id',
  };
}

function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      fieldName: 'businessDate',
      label: '业务日期',
      component: 'RangePicker',
      componentProps: {
        ...getRangePickerDefaultProps(),
        allowClear: true,
        showTime: true,
        valueFormat: 'YYYY-MM-DD HH:mm:ss',
      },
    },
    {
      fieldName: 'partyName',
      label: '交易单位',
      component: 'Input',
      componentProps: { allowClear: true },
    },
    {
      fieldName: 'partyCode',
      label: '单位编码',
      component: 'Input',
      componentProps: { allowClear: true },
    },
    {
      fieldName: 'accountId',
      label: '账户',
      component: 'ErpLazyPageSelect',
      componentProps: lazySelect(getAccountSimplePage, '账户'),
    },
    {
      fieldName: 'businessNo',
      label: '业务单号',
      component: 'Input',
      componentProps: { allowClear: true },
    },
    {
      fieldName: 'documentTypes',
      label: '单据类型',
      component: 'Select',
      componentProps: {
        allowClear: true,
        maxTagCount: 1,
        mode: 'multiple',
        options: [
          { label: '收款单', value: 'receipt' },
          { label: '付款单', value: 'payment' },
          { label: '其他收入', value: 'other_income' },
          { label: '费用支出', value: 'expense' },
          { label: '银行转账', value: 'transfer' },
        ],
      },
    },
    {
      fieldName: 'direction',
      label: '方向',
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          { label: '借方', value: 'debit' },
          { label: '贷方', value: 'credit' },
        ],
      },
    },
    {
      fieldName: 'receiverId',
      label: '收款人',
      component: 'ErpLazyPageSelect',
      componentProps: lazySelect(
        getAccountLedgerReportUserSimplePage,
        '收款人',
        'nickname',
      ),
    },
    {
      fieldName: 'payerId',
      label: '付款人',
      component: 'ErpLazyPageSelect',
      componentProps: lazySelect(
        getAccountLedgerReportUserSimplePage,
        '付款人',
        'nickname',
      ),
    },
    {
      fieldName: 'remark',
      label: '备注',
      component: 'Input',
      componentProps: { allowClear: true },
    },
    {
      fieldName: 'paymentVoucherNo',
      label: '凭证号',
      component: 'Input',
      componentProps: { allowClear: true },
    },
    {
      fieldName: 'voucherNo',
      label: '会计凭证号',
      component: 'Input',
      componentProps: { allowClear: true },
    },
  ];
}

const textFormatter = ({ cellValue }: { cellValue: unknown }) =>
  cellValue === null || cellValue === undefined || cellValue === ''
    ? '-'
    : String(cellValue);
const moneyFormatter = ({ cellValue }: { cellValue: unknown }) =>
  formatMoney(cellValue);

function formatMoney(value: unknown) { return financeMoneyGrouped(value as any);
}

function formatNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString('zh-CN') : '-';
}

function useGridColumns(
  showAmount = true,
  rows: ReportRow[] = currentRows.value,
): VxeTableGridOptions<ReportRow>['columns'] {
  const columns: NonNullable<VxeTableGridOptions<ReportRow>['columns']> = [
    {
      field: 'partyName',
      title: '交易单位',
      minWidth: 180,
      sortable: true,
      showOverflow: 'tooltip',
      formatter: textFormatter,
    },
    {
      field: 'partyCode',
      title: '交易单位编码',
      width: 142,
      sortable: true,
      formatter: textFormatter,
    },
    {
      field: 'accountName',
      title: '账户',
      minWidth: 150,
      sortable: true,
      formatter: textFormatter,
    },
    {
      field: 'businessDate',
      title: '业务日期',
      width: 164,
      sortable: true,
      formatter: 'formatDateTime',
    },
    {
      field: 'businessNo',
      title: '业务单号',
      width: 174,
      sortable: true,
      slots: { default: 'businessNo' },
    },
    {
      field: 'documentType',
      title: '单据类型',
      width: 112,
      sortable: true,
      formatter: textFormatter,
    },
    {
      field: 'direction',
      title: '方向',
      width: 80,
      sortable: true,
      formatter: textFormatter,
    },
    {
      field: 'incomeAmount',
      title: '收入金额',
      width: 124,
      align: 'right',
      sortable: true,
      formatter: moneyFormatter,
    },
    {
      field: 'expenseAmount',
      title: '支出金额',
      width: 124,
      align: 'right',
      sortable: true,
      formatter: moneyFormatter,
    },
    {
      field: 'balance',
      title: '余额',
      width: 130,
      align: 'right',
      sortable: true,
      formatter: moneyFormatter,
    },
    {
      field: 'receiverName',
      title: '收款人',
      width: 104,
      sortable: true,
      formatter: textFormatter,
    },
    {
      field: 'payerName',
      title: '付款人',
      width: 104,
      sortable: true,
      formatter: textFormatter,
    },
    {
      field: 'remark',
      title: '备注',
      minWidth: 180,
      sortable: true,
      showOverflow: 'tooltip',
      formatter: textFormatter,
    },
    {
      field: 'paymentVoucherNo',
      title: '凭证号',
      width: 140,
      formatter: textFormatter,
    },
    {
      field: 'voucherNo',
      title: '会计凭证号',
      width: 140,
      formatter: textFormatter,
    },
    {
      field: 'onlinePaymentOrderNo',
      title: '在线支付订单号',
      width: 160,
      formatter: textFormatter,
    },
    {
      field: 'onlinePaymentVoucherNo',
      title: '在线支付凭证号',
      width: 160,
      formatter: textFormatter,
    },
  ];
  const visibleColumns = showAmount
    ? columns
    : columns.filter((column) => !amountFields.has(String(column.field)));
  return prepareSaleDocumentListColumns(visibleColumns, rows, {
    baseWidths: { accountName: 150, partyName: 180, remark: 180 },
  });
}

function normalizeQueryValues(values: Record<string, any>) {
  const params: Record<string, any> = {};
  Object.entries(values || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (typeof value === 'string') {
      const normalized = value.trim();
      if (normalized) params[key] = normalized;
      return;
    }
    if (!Array.isArray(value) || value.length > 0) params[key] = value;
  });
  return params;
}

const summaryItems = computed(() => {
  const items = [
    { label: '明细行', value: formatNumber(summary.value.rowCount) },
  ];
  if (amountVisible.value)
    items.push(
      { label: '收入金额', value: formatMoney(summary.value.incomeAmount) },
      { label: '支出金额', value: formatMoney(summary.value.expenseAmount) },
      { label: '净额', value: formatMoney(summary.value.netAmount) },
    );
  return items;
});

let queryRequestId = 0;
const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    collapsed: true,
    collapsedRows: 1,
    commonConfig: { labelWidth: 94 },
    schema: useGridFormSchema(),
  },
  gridOptions: {
    columns: useGridColumns(),
    fit: false,
    height: 'auto',
    id: 'erp-account-ledger-report-list-v1',
    showHeaderOverflow: 'tooltip',
    showOverflow: 'tooltip',
    scrollX: { enabled: true, gt: 8 },
    scrollY: { enabled: true, gt: 10 },
    proxyConfig: {
      ajax: {
        query: async ({ page, sort, sorts }, formValues) => {
          const requestId = ++queryRequestId;
          const params = {
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            ...normalizeQueryValues(formValues),
            ...buildSortParams(sorts, sort),
          } as ErpAccountLedgerReportApi.Query;
          const [pageResult, summaryResult] = await Promise.all([
            getAccountLedgerReportPage(params),
            getAccountLedgerReportSummary({
              ...params,
              pageNo: 1,
              pageSize: 20,
            }),
          ]);
          if (requestId === queryRequestId) {
            currentRows.value = pageResult.list || [];
            summary.value = summaryResult || {};
            await gridApi.grid?.reloadColumn?.(
              useGridColumns(amountVisible.value, currentRows.value) as any[],
            );
          }
          return pageResult;
        },
        querySuccess: () => void restoreSortState(gridApi),
      },
      sort: true,
    },
    rowConfig: { keyField: 'rowKey', isCurrent: true, isHover: true },
    sortConfig: {
      allowBtn: false,
      multiple: false,
      orders: ['asc', 'desc', null],
      remote: true,
      trigger: 'cell',
    },
    toolbarConfig: { refresh: true, search: true },
  } as VxeTableGridOptions<ReportRow>,
  gridEvents: { sortChange: handleSortChange },
});

function handleSearchEnter(event: KeyboardEvent) {
  if (
    event.isComposing ||
    !(event.target instanceof HTMLInputElement) ||
    event.target.closest('.ant-picker, .ant-select')
  )
    return;
  event.preventDefault();
  event.stopPropagation();
  void gridApi.formApi.submitForm();
}

async function handleExport() {
  exporting.value = true;
  try {
    const values = normalizeQueryValues(await gridApi.formApi.getValues());
    const data = await exportAccountLedgerReport({
      ...values,
      ...buildSortParams(),
    });
    downloadFileFromBlobPart({ fileName: '账户流水报表.xlsx', source: data });
    message.success('导出成功');
  } finally {
    exporting.value = false;
  }
}

function getDocumentType(type?: ErpAccountLedgerReportApi.DocumentType) {
  const typeMap: Record<
    ErpAccountLedgerReportApi.DocumentType,
    ReportDocumentType
  > = {
    expense: REPORT_DOCUMENT_TYPES.PAYABLE_EXPENSE,
    other_income: REPORT_DOCUMENT_TYPES.OTHER_INCOME,
    payment: REPORT_DOCUMENT_TYPES.FINANCE_PAYMENT,
    receipt: REPORT_DOCUMENT_TYPES.FINANCE_RECEIPT,
    transfer: REPORT_DOCUMENT_TYPES.FINANCE_TRANSFER,
  };
  return type === undefined ? undefined : typeMap[type];
}

function openDocumentDetail(row: ReportRow) {
  void documentDetailModalRef.value?.open(
    getDocumentType(row.sourceType),
    row.sourceId,
  );
}
</script>

<template>
  <div class="account-ledger-report" data-report="account-ledger">
    <Grid
      class="account-ledger-report__grid"
      table-title="账户流水报表"
      @keydown.enter.capture="handleSearchEnter"
    >
      <template #toolbar-tools>
        <TableAction
          v-if="canExport"
          :actions="[
            {
              label: '导出',
              type: 'primary',
              icon: ACTION_ICON.DOWNLOAD,
              loading: exporting,
              onClick: handleExport,
            },
          ]"
        />
      </template>
      <template #businessNo="{ row }">
        <ReportDocumentLink
          :value="row.businessNo"
          @open="openDocumentDetail(row)"
        />
      </template>
      <template #bottom>
        <div class="account-ledger-report__summary">
          <b>全条件合计：</b
          ><span v-for="item in summaryItems" :key="item.label"
            >{{ item.label }}：<b>{{ item.value }}</b></span
          >
        </div>
      </template>
    </Grid>
    <ReportDocumentDetailModal ref="documentDetailModalRef" />
  </div>
</template>

<style scoped>
.account-ledger-report {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.account-ledger-report__grid {
  min-height: 0;
}
.account-ledger-report__summary {
  display: flex;
  min-height: 40px;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 4px 16px;
  padding: 5px 8px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  line-height: 18px;
  border-top: 1px solid hsl(var(--border));
}
.account-ledger-report__summary b {
  color: hsl(var(--foreground));
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
:deep(.account-ledger-report__grid .vxe-table--render-default),
:deep(.account-ledger-report__grid .vxe-grid--form-wrapper) {
  font-size: 12px;
}
@media (min-width: 1280px) {
  :deep(.account-ledger-report__grid .vxe-grid--form-wrapper form > .grid) {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}
:deep(
  .account-ledger-report__grid .vxe-header--column.is--sortable .vxe-cell--title
) {
  color: #1677ff;
}
:deep(.account-ledger-report__grid .vxe-header--column .vxe-cell--sort) {
  display: none;
}
:deep(.account-ledger-report__grid .vxe-grid--bottom-wrapper) {
  position: sticky;
  bottom: 36px;
  z-index: 4;
  background: hsl(var(--card));
}
:deep(.account-ledger-report__grid .vxe-grid--pager-wrapper) {
  position: sticky;
  bottom: 0;
  z-index: 5;
  margin-top: 0 !important;
  background: hsl(var(--card));
  box-shadow: 0 -2px 8px rgb(0 0 0 / 8%);
}
:global(.account-ledger-report-search-select-dropdown .ant-select-item),
:global(.account-ledger-report-search-select-dropdown .ant-empty-description) {
  font-size: 12px;
}
</style>
