<script setup lang="ts">
import { financeMoneyGrouped } from '#/views/erp/finance/utils/finance-decimal';
import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpPayableExpenseDetailReportApi } from '#/api/erp/report/payable-expense-detail';

import { computed, ref } from 'vue';

import { useAccess } from '@vben/access';
import { useVbenModal } from '@vben/common-ui';
import { downloadFileFromBlobPart } from '@vben/utils';
import dayjs from 'dayjs';

import { message } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import { getAccountSimplePage } from '#/api/erp/finance/account';
import {
  getPayableExpenseDeptSimplePage,
  getPayableExpenseUserSimplePage,
} from '#/api/erp/finance/payable/expense';
import {
  exportPayableExpenseDetailReport,
  getPayableExpenseDetailReportPage,
  getPayableExpenseDetailReportSummary,
} from '#/api/erp/report/payable-expense-detail';
import { getRangePickerDefaultProps } from '#/utils';
import PayableExpenseForm from '#/views/erp/finance/payable/expense/modules/form.vue';
import ReportDocumentLink from '#/views/erp/report/components/report-document-link.vue';
import { prepareSaleDocumentListColumns } from '#/views/erp/sale/utils/document-list-table';
import { createVxeHeaderSort } from '#/views/erp/utils/vxe-header-sort';

defineOptions({ name: 'ErpPayableExpenseDetailReport' });

type ReportRow = ErpPayableExpenseDetailReportApi.Row;
const { hasAccessByCodes } = useAccess();
const canExport = computed(
  () =>
    hasAccessByCodes(['erp:payable-expense-detail-report:export']) &&
    hasAccessByCodes(['erp:payable-expense:export']),
);
const summary = ref<ErpPayableExpenseDetailReportApi.Summary>({});
const currentRows = ref<ReportRow[]>([]);
const exporting = ref(false);
const [DetailModal, detailModalApi] = useVbenModal({
  connectedComponent: PayableExpenseForm,
  destroyOnClose: true,
});
const amountVisible = computed(
  () =>
    summary.value.amountVisible !== false &&
    currentRows.value.every((row) => row.amountVisible !== false),
);
const sortFieldMap: Record<string, string> = {
  accountName: 'accountName',
  amount: 'amount',
  approveDate: 'approveDate',
  billingDeptName: 'billingDeptName',
  businessUserName: 'businessUserName',
  deptName: 'deptName',
  documentNo: 'documentNo',
  handlerName: 'handlerName',
  itemName: 'itemName',
  party: 'party',
  summary: 'summary',
  voucherNo: 'voucherNo',
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
    popupClassName: 'payable-expense-detail-report-search-select-dropdown',
    showSearch: true,
    valueField: 'id',
  };
}

function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      fieldName: 'approveDate',
      label: '审批日期',
      component: 'RangePicker',
      defaultValue: [
        dayjs().startOf('month').format('YYYY-MM-DD HH:mm:ss'),
        dayjs().endOf('month').format('YYYY-MM-DD HH:mm:ss'),
      ],
      componentProps: { ...getRangePickerDefaultProps(), allowClear: true },
    },
    {
      fieldName: 'accountId',
      label: '结算账户',
      component: 'ErpLazyPageSelect',
      componentProps: lazySelect(getAccountSimplePage, '结算账户'),
    },
    {
      fieldName: 'documentNo',
      label: '单号',
      component: 'Input',
      componentProps: { allowClear: true },
    },
    {
      fieldName: 'itemName',
      label: '费用项目',
      component: 'Input',
      componentProps: { allowClear: true },
    },
    {
      fieldName: 'amountMin',
      label: '金额下限',
      component: 'InputNumber',
      componentProps: {  style: { width: '100%' } },
    },
    {
      fieldName: 'amountMax',
      label: '金额上限',
      component: 'InputNumber',
      componentProps: {  style: { width: '100%' } },
    },
    {
      fieldName: 'voucherNo',
      label: '凭证号',
      component: 'Input',
      componentProps: { allowClear: true },
    },
    {
      fieldName: 'summary',
      label: '摘要',
      component: 'Input',
      componentProps: { allowClear: true },
    },
    {
      fieldName: 'handlerId',
      label: '经办人',
      component: 'ErpLazyPageSelect',
      componentProps: lazySelect(
        getPayableExpenseUserSimplePage,
        '经办人',
        'nickname',
      ),
    },
    {
      fieldName: 'party',
      label: '对象',
      component: 'Input',
      componentProps: { allowClear: true },
    },
    {
      fieldName: 'billingDeptId',
      label: '开单部门',
      component: 'ErpLazyPageSelect',
      componentProps: lazySelect(getPayableExpenseDeptSimplePage, '开单部门'),
    },
    {
      fieldName: 'deptId',
      label: '部门',
      component: 'ErpLazyPageSelect',
      componentProps: lazySelect(getPayableExpenseDeptSimplePage, '部门'),
    },
    {
      fieldName: 'businessUserId',
      label: '业务员',
      component: 'ErpLazyPageSelect',
      componentProps: lazySelect(
        getPayableExpenseUserSimplePage,
        '业务员',
        'nickname',
      ),
    },
  ];
}

const textFormatter = ({ cellValue }: { cellValue: unknown }) =>
  cellValue === null || cellValue === undefined || cellValue === ''
    ? '-'
    : String(cellValue);
const emptyFormatter = () => '';
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
      field: 'approveDate',
      title: '审批日期',
      width: 112,
      sortable: true,
      formatter: textFormatter,
    },
    {
      field: 'accountName',
      title: '结算账户',
      minWidth: 150,
      sortable: true,
      formatter: textFormatter,
    },
    {
      field: 'documentNo',
      title: '单号',
      width: 174,
      sortable: true,
      formatter: textFormatter,
      slots: { default: 'documentNo' },
    },
    {
      field: 'itemName',
      title: '费用项目名称',
      minWidth: 160,
      sortable: true,
      formatter: textFormatter,
    },
    {
      field: 'amount',
      title: '金额',
      width: 128,
      align: 'right',
      sortable: true,
      formatter: moneyFormatter,
    },
    {
      field: 'voucherNo',
      title: '凭证号',
      width: 150,
      sortable: true,
      formatter: textFormatter,
    },
    {
      field: 'summary',
      title: '摘要',
      minWidth: 190,
      sortable: true,
      showOverflow: 'tooltip',
      formatter: textFormatter,
    },
    {
      field: 'handlerName',
      title: '经办人',
      width: 108,
      sortable: true,
      formatter: textFormatter,
    },
    {
      field: 'party',
      title: '对象',
      minWidth: 150,
      sortable: true,
      formatter: textFormatter,
    },
    { field: 'type', title: '类型', width: 96, formatter: emptyFormatter },
    {
      field: 'billingDeptName',
      title: '开单部门',
      width: 132,
      sortable: true,
      formatter: textFormatter,
    },
    {
      field: 'deptName',
      title: '部门',
      width: 132,
      sortable: true,
      formatter: textFormatter,
    },
    {
      field: 'businessUserName',
      title: '业务员',
      width: 108,
      sortable: true,
      formatter: textFormatter,
    },
    { field: 'invoice', title: '发票', width: 96, formatter: emptyFormatter },
    {
      field: 'occurrenceDate',
      title: '发生日期',
      width: 112,
      formatter: emptyFormatter,
    },
  ];
  const visibleColumns = showAmount
    ? columns
    : columns.filter((column) => column.field !== 'amount');
  return prepareSaleDocumentListColumns(visibleColumns, rows, {
    baseWidths: { accountName: 150, itemName: 160, party: 150, summary: 190 },
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
    items.push({ label: '金额', value: formatMoney(summary.value.amount) });
  return items;
});

let queryRequestId = 0;
const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    collapsed: true,
    collapsedRows: 1,
    commonConfig: { labelWidth: 86 },
    schema: useGridFormSchema(),
  },
  gridOptions: {
    columns: useGridColumns(),
    fit: false,
    height: 'auto',
    id: 'erp-payable-expense-detail-report-list-v1',
    pagerConfig: { pageSize: 10, pageSizes: [10, 20, 50] },
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
          } as ErpPayableExpenseDetailReportApi.Query;
          const [pageResult, summaryResult] = await Promise.all([
            getPayableExpenseDetailReportPage(params),
            getPayableExpenseDetailReportSummary({
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
    rowConfig: { keyField: 'rowKey', isHover: true, isCurrent: true },
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

function handleDetail(row: ReportRow) {
  if (!row.expenseId || !row.documentNo) return;
  detailModalApi
    .setData({ type: 'detail', id: row.expenseId, strictReadonly: true })
    .open();
}

async function handleExport() {
  exporting.value = true;
  try {
    const values = normalizeQueryValues(await gridApi.formApi.getValues());
    const data = await exportPayableExpenseDetailReport({
      ...values,
      ...buildSortParams(),
    });
    downloadFileFromBlobPart({ fileName: '费用支付查询.xlsx', source: data });
    message.success('导出成功');
  } finally {
    exporting.value = false;
  }
}
</script>

<template>
  <div
    class="payable-expense-detail-report"
    data-report="payable-expense-detail"
  >
    <DetailModal />
    <Grid
      class="payable-expense-detail-report__grid"
      table-title="费用支付查询"
      @keydown.enter.capture="handleSearchEnter"
    >
      <template #documentNo="{ row }">
        <ReportDocumentLink
          v-if="row.expenseId && row.documentNo"
          :value="row.documentNo"
          @open="handleDetail(row)"
        />
        <span v-else>{{ row.documentNo || '-' }}</span>
      </template>
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
      <template #bottom>
        <div class="payable-expense-detail-report__summary">
          <b>全条件合计：</b
          ><span v-for="item in summaryItems" :key="item.label"
            >{{ item.label }}：<b>{{ item.value }}</b></span
          >
        </div>
      </template>
    </Grid>
  </div>
</template>

<style scoped>
.payable-expense-detail-report {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.payable-expense-detail-report__grid {
  min-height: 0;
}
.payable-expense-detail-report__summary {
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
.payable-expense-detail-report__summary b {
  color: hsl(var(--foreground));
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
:deep(.payable-expense-detail-report__grid .vxe-table--render-default),
:deep(.payable-expense-detail-report__grid .vxe-grid--form-wrapper) {
  font-size: 12px;
}
@media (min-width: 1280px) {
  :deep(
    .payable-expense-detail-report__grid .vxe-grid--form-wrapper form > .grid
  ) {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}
:deep(
  .payable-expense-detail-report__grid
    .vxe-header--column.is--sortable
    .vxe-cell--title
) {
  color: #1677ff;
}
:deep(
  .payable-expense-detail-report__grid .vxe-header--column .vxe-cell--sort
) {
  display: none;
}
:deep(.payable-expense-detail-report__grid .vxe-grid--bottom-wrapper) {
  position: sticky;
  bottom: 36px;
  z-index: 4;
  background: hsl(var(--card));
}
:deep(.payable-expense-detail-report__grid .vxe-grid--pager-wrapper) {
  position: sticky;
  bottom: 0;
  z-index: 5;
  margin-top: 0 !important;
  background: hsl(var(--card));
  box-shadow: 0 -2px 8px rgb(0 0 0 / 8%);
}
:global(.payable-expense-detail-report-search-select-dropdown .ant-select-item),
:global(
  .payable-expense-detail-report-search-select-dropdown .ant-empty-description
) {
  font-size: 12px;
}
</style>
