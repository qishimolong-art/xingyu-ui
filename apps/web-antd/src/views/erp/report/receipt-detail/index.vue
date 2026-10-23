<script setup lang="ts">
import { financeMoneyGrouped } from '#/views/erp/finance/utils/finance-decimal';
import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpReceiptDetailReportApi } from '#/api/erp/report/receipt-detail';
import type { ReportDocumentTarget } from '#/views/erp/report/components/report-document-detail';

import { computed, ref } from 'vue';

import { useAccess } from '@vben/access';
import { downloadFileFromBlobPart } from '@vben/utils';
import dayjs from 'dayjs';

import { message } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import { getBaseDataPage } from '#/api/erp/base';
import { getAccountSimplePage } from '#/api/erp/finance/account';
import {
  getFinanceReceiptDeptSimplePage,
  getFinanceReceiptUserSimplePage,
} from '#/api/erp/finance/receipt';
import {
  exportReceiptDetailReport,
  getReceiptDetailReportPage,
  getReceiptDetailReportSummary,
} from '#/api/erp/report/receipt-detail';
import { getCustomerSimplePage } from '#/api/erp/sale/customer';
import { getRangePickerDefaultProps } from '#/utils';
import ReportDocumentDetailModal from '#/views/erp/report/components/report-document-detail-modal.vue';
import {
  REPORT_DOCUMENT_TYPES,
  resolveReportDocumentTarget,
} from '#/views/erp/report/components/report-document-detail';
import { prepareSaleDocumentListColumns } from '#/views/erp/sale/utils/document-list-table';
import { createVxeHeaderSort } from '#/views/erp/utils/vxe-header-sort';

defineOptions({ name: 'ErpReceiptDetailReport' });

type ReportRow = ErpReceiptDetailReportApi.Row;
const { hasAccessByCodes } = useAccess();
const canExport = computed(
  () =>
    hasAccessByCodes(['erp:receipt-detail-report:export']) &&
    hasAccessByCodes(['erp:finance-receipt:query']) &&
    hasAccessByCodes(['erp:finance-receipt:export']),
);
const summary = ref<ErpReceiptDetailReportApi.Summary>({});
const currentRows = ref<ReportRow[]>([]);
const exporting = ref(false);
const documentDetailModalRef =
  ref<InstanceType<typeof ReportDocumentDetailModal>>();
const amountVisible = computed(
  () =>
    summary.value.amountVisible !== false &&
    currentRows.value.every((row) => row.amountVisible !== false),
);
const amountFields = new Set([
  'actualReceiptAmount',
  'costAmount',
  'grossProfit',
  'grossProfitRate',
  'settlementAmount',
]);
const sortFieldMap: Record<string, string> = {
  actualReceiptAmount: 'actualReceiptAmount',
  businessDate: 'businessDate',
  businessNo: 'businessNo',
  businessType: 'businessType',
  customerName: 'customerName',
  customerType: 'customerType',
  deptName: 'deptName',
  receiptDate: 'receiptDate',
  receiptNo: 'receiptNo',
  settlementAmount: 'settlementAmount',
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
    popupClassName: 'receipt-detail-report-search-select-dropdown',
    showSearch: true,
    valueField: 'id',
  };
}

const getCustomerTypePage = (params: Record<string, any>) =>
  getBaseDataPage({ ...params, status: 1, type: 'customer_type' });

function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      fieldName: 'receiptDate',
      label: '收款日期',
      component: 'RangePicker',
      defaultValue: [
        dayjs().startOf('month').format('YYYY-MM-DD HH:mm:ss'),
        dayjs().endOf('day').format('YYYY-MM-DD HH:mm:ss'),
      ],
      componentProps: { ...getRangePickerDefaultProps(), allowClear: true },
    },
    {
      fieldName: 'businessDate',
      label: '业务日期',
      component: 'RangePicker',
      componentProps: { ...getRangePickerDefaultProps(), allowClear: true },
    },
    {
      fieldName: 'customerId',
      label: '客户',
      component: 'ErpLazyPageSelect',
      componentProps: lazySelect(getCustomerSimplePage, '客户'),
    },
    {
      fieldName: 'receiptNo',
      label: '收款单号',
      component: 'Input',
      componentProps: { allowClear: true },
    },
    {
      fieldName: 'businessNo',
      label: '业务单号',
      component: 'Input',
      componentProps: { allowClear: true },
    },
    {
      fieldName: 'businessTypes',
      label: '业务类型',
      component: 'Select',
      componentProps: {
        allowClear: true,
        mode: 'multiple',
        maxTagCount: 1,
        options: [
          { label: '销售单', value: 'SALE_OUT' },
          { label: '销售退货单', value: 'SALE_RETURN' },
          { label: '销售调价单', value: 'SALE_PRICE_ADJUST' },
          { label: '其他应收单', value: 'RECEIVABLE_MISC' },
        ],
      },
    },
    {
      fieldName: 'settleMethod',
      label: '结算方式',
      component: 'Input',
      componentProps: { allowClear: true },
    },
    {
      fieldName: 'accountType',
      label: '账户类型',
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          { label: '银行账户', value: 1 },
          { label: '现金账户', value: 2 },
          { label: '其他账户', value: 3 },
        ],
      },
    },
    {
      fieldName: 'accountId',
      label: '收款账户',
      component: 'ErpLazyPageSelect',
      componentProps: lazySelect(getAccountSimplePage, '收款账户'),
    },
    {
      fieldName: 'receiptUserId',
      label: '收款人',
      component: 'ErpLazyPageSelect',
      componentProps: lazySelect(
        getFinanceReceiptUserSimplePage,
        '收款人',
        'nickname',
      ),
    },
    {
      fieldName: 'businessUserId',
      label: '业务员',
      component: 'ErpLazyPageSelect',
      componentProps: lazySelect(
        getFinanceReceiptUserSimplePage,
        '业务员',
        'nickname',
      ),
    },
    {
      fieldName: 'businessCreatorId',
      label: '制单人',
      component: 'ErpLazyPageSelect',
      componentProps: lazySelect(
        getFinanceReceiptUserSimplePage,
        '制单人',
        'nickname',
      ),
    },
    {
      fieldName: 'customerTypeId',
      label: '客户类型',
      component: 'ErpLazyPageSelect',
      componentProps: lazySelect(getCustomerTypePage, '客户类型'),
    },
    {
      fieldName: 'deptId',
      label: '部门',
      component: 'ErpLazyPageSelect',
      componentProps: lazySelect(getFinanceReceiptDeptSimplePage, '部门'),
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
const rateFormatter = ({ cellValue }: { cellValue: unknown }) => {
  if (cellValue === null || cellValue === undefined || cellValue === '')
    return '-';
  const number = Number(cellValue);
  return Number.isFinite(number) ? `${(number * 100).toFixed(2)}%` : '-';
};

function formatMoney(value: unknown) {
  return financeMoneyGrouped(value as any);
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
      field: 'customerName',
      title: '客户',
      minWidth: 180,
      sortable: true,
      formatter: textFormatter,
    },
    {
      field: 'receiptDate',
      title: '收款日期',
      width: 164,
      sortable: true,
      formatter: 'formatDateTime',
    },
    {
      field: 'receiptNo',
      title: '收款单号',
      width: 174,
      sortable: true,
      slots: { default: 'receiptNo' },
    },
    {
      field: 'businessNo',
      title: '业务单号',
      width: 174,
      sortable: true,
      slots: { default: 'businessNo' },
    },
    {
      field: 'businessType',
      title: '业务类型',
      width: 118,
      sortable: true,
      formatter: textFormatter,
    },
    {
      field: 'settlementAmount',
      title: '结算金额',
      width: 128,
      align: 'right',
      sortable: true,
      formatter: moneyFormatter,
    },
    {
      field: 'actualReceiptAmount',
      title: '实收金额',
      width: 128,
      align: 'right',
      sortable: true,
      formatter: moneyFormatter,
    },
    {
      field: 'settleMethod',
      title: '结算方式',
      width: 112,
      formatter: textFormatter,
    },
    {
      field: 'accountType',
      title: '账户类型',
      width: 112,
      formatter: textFormatter,
    },
    {
      field: 'accountName',
      title: '收款账户',
      minWidth: 150,
      formatter: textFormatter,
    },
    {
      field: 'paymentVoucherNo',
      title: '凭证号',
      width: 160,
      formatter: textFormatter,
    },
    {
      field: 'voucherNo',
      title: '会计凭证号',
      width: 160,
      formatter: textFormatter,
    },
    {
      field: 'receiptUserName',
      title: '收款人',
      width: 108,
      formatter: textFormatter,
    },
    {
      field: 'businessUserName',
      title: '业务员',
      width: 108,
      formatter: textFormatter,
    },
    {
      field: 'developerName',
      title: '开发员',
      width: 108,
      formatter: textFormatter,
    },
    {
      field: 'businessCreatorName',
      title: '制单人',
      width: 108,
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
      field: 'costAmount',
      title: '成本金额',
      width: 128,
      align: 'right',
      formatter: moneyFormatter,
    },
    {
      field: 'grossProfit',
      title: '毛利',
      width: 128,
      align: 'right',
      formatter: moneyFormatter,
    },
    {
      field: 'grossProfitRate',
      title: '毛利率',
      width: 108,
      align: 'right',
      formatter: rateFormatter,
    },
    {
      field: 'customerType',
      title: '客户类型',
      width: 126,
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
      field: 'remark',
      title: '备注',
      minWidth: 190,
      showOverflow: 'tooltip',
      formatter: textFormatter,
    },
  ];
  const visibleColumns = showAmount
    ? columns
    : columns.filter((column) => !amountFields.has(String(column.field)));
  return prepareSaleDocumentListColumns(visibleColumns, rows, {
    baseWidths: { customerName: 180, remark: 190 },
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
      { label: '结算金额', value: formatMoney(summary.value.settlementAmount) },
      {
        label: '实收金额',
        value: formatMoney(summary.value.actualReceiptAmount),
      },
    );
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
    id: 'erp-receipt-detail-report-list-v1',
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
          } as ErpReceiptDetailReportApi.Query;
          const [pageResult, summaryResult] = await Promise.all([
            getReceiptDetailReportPage(params),
            getReceiptDetailReportSummary({
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

async function handleExport() {
  exporting.value = true;
  try {
    const values = normalizeQueryValues(await gridApi.formApi.getValues());
    const data = await exportReceiptDetailReport({
      ...values,
      ...buildSortParams(),
    });
    downloadFileFromBlobPart({ fileName: '收款明细查询.xlsx', source: data });
    message.success('导出成功');
  } finally {
    exporting.value = false;
  }
}

function getReceiptDocumentTarget(row: ReportRow) {
  return resolveReportDocumentTarget(
    REPORT_DOCUMENT_TYPES.FINANCE_RECEIPT,
    row.receiptId,
    row.receiptNo,
    hasAccessByCodes,
  );
}

function getBusinessDocumentTarget(row: ReportRow) {
  return resolveReportDocumentTarget(
    row.businessTypeCode,
    row.businessId,
    row.businessNo,
    hasAccessByCodes,
  );
}

function openDocumentDetail(target?: ReportDocumentTarget) {
  if (!target) return;
  void documentDetailModalRef.value?.open(target.type, target.id);
}
</script>

<template>
  <div class="receipt-detail-report" data-report="receipt-detail">
    <Grid
      class="receipt-detail-report__grid"
      table-title="收款明细查询"
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
      <template #receiptNo="{ row }">
        <button
          v-if="getReceiptDocumentTarget(row)"
          type="button"
          class="receipt-detail-report__document-link"
          :title="row.receiptNo || ''"
          @click.stop="openDocumentDetail(getReceiptDocumentTarget(row))"
        >
          {{ row.receiptNo }}
        </button>
        <span v-else>{{ row.receiptNo || '-' }}</span>
      </template>
      <template #businessNo="{ row }">
        <button
          v-if="getBusinessDocumentTarget(row)"
          type="button"
          class="receipt-detail-report__document-link"
          :title="row.businessNo || ''"
          @click.stop="openDocumentDetail(getBusinessDocumentTarget(row))"
        >
          {{ row.businessNo }}
        </button>
        <span v-else>{{ row.businessNo || '-' }}</span>
      </template>
      <template #bottom>
        <div class="receipt-detail-report__summary">
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
.receipt-detail-report {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.receipt-detail-report__grid {
  min-height: 0;
}
.receipt-detail-report__summary {
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
.receipt-detail-report__summary b {
  color: hsl(var(--foreground));
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.receipt-detail-report__document-link {
  display: block;
  max-width: 100%;
  padding: 0;
  overflow: hidden;
  color: #1677ff;
  font: inherit;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  background: transparent;
  border: 0;
}
.receipt-detail-report__document-link:hover {
  color: #4096ff;
  text-decoration: underline;
}
.receipt-detail-report__document-link:focus-visible {
  outline: 2px solid #1677ff;
  outline-offset: 2px;
}
:deep(.receipt-detail-report__grid .vxe-table--render-default),
:deep(.receipt-detail-report__grid .vxe-grid--form-wrapper) {
  font-size: 12px;
}
@media (min-width: 1280px) {
  :deep(.receipt-detail-report__grid .vxe-grid--form-wrapper form > .grid) {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}
:deep(
  .receipt-detail-report__grid .vxe-header--column.is--sortable .vxe-cell--title
) {
  color: #1677ff;
}
:deep(.receipt-detail-report__grid .vxe-header--column .vxe-cell--sort) {
  display: none;
}
:deep(.receipt-detail-report__grid .vxe-grid--bottom-wrapper) {
  position: sticky;
  bottom: 36px;
  z-index: 4;
  background: hsl(var(--card));
}
:deep(.receipt-detail-report__grid .vxe-grid--pager-wrapper) {
  position: sticky;
  bottom: 0;
  z-index: 5;
  margin-top: 0 !important;
  background: hsl(var(--card));
  box-shadow: 0 -2px 8px rgb(0 0 0 / 8%);
}
:global(.receipt-detail-report-search-select-dropdown .ant-select-item),
:global(.receipt-detail-report-search-select-dropdown .ant-empty-description) {
  font-size: 12px;
}
</style>
