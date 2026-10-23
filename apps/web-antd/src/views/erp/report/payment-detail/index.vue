<script setup lang="ts">
import { financeMoneyGrouped } from '#/views/erp/finance/utils/finance-decimal';
import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpPaymentDetailReportApi } from '#/api/erp/report/payment-detail';
import type { ReportDocumentType } from '#/views/erp/report/components/report-document-detail';

import { computed, ref } from 'vue';

import { useAccess } from '@vben/access';
import { downloadFileFromBlobPart } from '@vben/utils';

import { message } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import { getAccountSimplePage } from '#/api/erp/finance/account';
import {
  getFinancePaymentDeptSimplePage,
  getFinancePaymentUserSimplePage,
} from '#/api/erp/finance/payment';
import { getSupplierSimplePage } from '#/api/erp/purchase/supplier';
import {
  exportPaymentDetailReport,
  getPaymentDetailReportPage,
  getPaymentDetailReportSummary,
} from '#/api/erp/report/payment-detail';
import { getRangePickerDefaultProps } from '#/utils';
import ReportDocumentDetailModal from '#/views/erp/report/components/report-document-detail-modal.vue';
import ReportDocumentLink from '#/views/erp/report/components/report-document-link.vue';
import { REPORT_DOCUMENT_TYPES } from '#/views/erp/report/components/report-document-detail';
import { prepareSaleDocumentListColumns } from '#/views/erp/sale/utils/document-list-table';
import { createVxeHeaderSort } from '#/views/erp/utils/vxe-header-sort';

defineOptions({ name: 'ErpPaymentDetailReport' });

type ReportRow = ErpPaymentDetailReportApi.Row;
const { hasAccessByCodes } = useAccess();
const canExport = computed(
  () =>
    hasAccessByCodes(['erp:payment-detail-report:export']) &&
    hasAccessByCodes(['erp:finance-payment:query']),
);
const summary = ref<ErpPaymentDetailReportApi.Summary>({});
const currentRows = ref<ReportRow[]>([]);
const exporting = ref(false);
const documentDetailModalRef =
  ref<InstanceType<typeof ReportDocumentDetailModal>>();
const amountVisible = computed(
  () =>
    summary.value.amountVisible !== false &&
    currentRows.value.every((row) => row.amountVisible !== false),
);
const amountFields = new Set(['actualPaymentAmount', 'settlementAmount']);
const sortFieldMap: Record<string, string> = {
  accountName: 'accountName',
  actualPaymentAmount: 'actualPaymentAmount',
  businessNo: 'businessNo',
  businessType: 'businessType',
  creatorName: 'creatorName',
  deptName: 'deptName',
  payerName: 'payerName',
  paymentDate: 'paymentDate',
  paymentMethod: 'paymentMethod',
  paymentNo: 'paymentNo',
  purchaserName: 'purchaserName',
  settlementAmount: 'settlementAmount',
  settlementMethod: 'settlementMethod',
  supplierName: 'supplierName',
  supplierType: 'supplierType',
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
    popupClassName: 'payment-detail-report-search-select-dropdown',
    showSearch: true,
    valueField: 'id',
  };
}

function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      fieldName: 'paymentDate',
      label: '付款日期',
      component: 'RangePicker',
      componentProps: { ...getRangePickerDefaultProps(), allowClear: true },
    },
    {
      fieldName: 'supplierId',
      label: '供应商',
      component: 'ErpLazyPageSelect',
      componentProps: lazySelect(getSupplierSimplePage, '供应商'),
    },
    {
      fieldName: 'paymentNo',
      label: '付款单号',
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
          { label: '采购入库', value: 11 },
          { label: '采购退货', value: 12 },
          { label: '采购调价', value: 13 },
          { label: '其他应付', value: 14 },
        ],
      },
    },
    {
      fieldName: 'accountId',
      label: '付款账户',
      component: 'ErpLazyPageSelect',
      componentProps: lazySelect(getAccountSimplePage, '付款账户'),
    },
    {
      fieldName: 'payerId',
      label: '付款人',
      component: 'ErpLazyPageSelect',
      componentProps: lazySelect(
        getFinancePaymentUserSimplePage,
        '付款人',
        'nickname',
      ),
    },
    {
      fieldName: 'sourceCreatorId',
      label: '采购员/制单人',
      component: 'ErpLazyPageSelect',
      componentProps: lazySelect(
        getFinancePaymentUserSimplePage,
        '业务制单人',
        'nickname',
      ),
    },
    {
      fieldName: 'supplierType',
      label: '供应商类型',
      component: 'Input',
      componentProps: { allowClear: true },
    },
    {
      fieldName: 'paymentMethod',
      label: '付款方式',
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
      fieldName: 'settlementMethod',
      label: '结算方式',
      component: 'Input',
      componentProps: { allowClear: true },
    },
    {
      fieldName: 'deptId',
      label: '部门',
      component: 'ErpLazyPageSelect',
      componentProps: lazySelect(getFinancePaymentDeptSimplePage, '部门'),
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
      field: 'supplierName',
      title: '供应商',
      minWidth: 180,
      sortable: true,
      showOverflow: 'tooltip',
      formatter: textFormatter,
    },
    {
      field: 'paymentDate',
      title: '付款日期',
      width: 164,
      sortable: true,
      formatter: 'formatDateTime',
    },
    {
      field: 'paymentNo',
      title: '付款单号',
      width: 174,
      sortable: true,
      slots: { default: 'paymentNo' },
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
      width: 108,
      sortable: true,
      formatter: textFormatter,
    },
    {
      field: 'settlementAmount',
      title: '结算金额',
      width: 124,
      align: 'right',
      sortable: true,
      formatter: moneyFormatter,
    },
    {
      field: 'actualPaymentAmount',
      title: '实付金额',
      width: 124,
      align: 'right',
      sortable: true,
      formatter: moneyFormatter,
    },
    {
      field: 'accountName',
      title: '付款账户',
      width: 150,
      sortable: true,
      formatter: textFormatter,
    },
    {
      field: 'paymentVoucherNo',
      title: '凭证号',
      width: 150,
      formatter: textFormatter,
    },
    {
      field: 'voucherNo',
      title: '会计凭证号',
      width: 150,
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
      field: 'purchaserName',
      title: '采购员',
      width: 104,
      sortable: true,
      formatter: textFormatter,
    },
    {
      field: 'supplierType',
      title: '供应商类型',
      width: 120,
      sortable: true,
      formatter: textFormatter,
    },
    {
      field: 'paymentMethod',
      title: '付款方式',
      width: 112,
      sortable: true,
      formatter: textFormatter,
    },
    {
      field: 'creatorName',
      title: '制单人',
      width: 104,
      sortable: true,
      formatter: textFormatter,
    },
    {
      field: 'settlementMethod',
      title: '结算方式',
      width: 120,
      sortable: true,
      formatter: textFormatter,
    },
    {
      field: 'deptName',
      title: '部门',
      minWidth: 140,
      sortable: true,
      formatter: textFormatter,
    },
  ];
  const visibleColumns = showAmount
    ? columns
    : columns.filter((column) => !amountFields.has(String(column.field)));
  return prepareSaleDocumentListColumns(visibleColumns, rows, {
    baseWidths: { deptName: 140, supplierName: 180 },
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
        label: '实付金额',
        value: formatMoney(summary.value.actualPaymentAmount),
      },
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
    id: 'erp-payment-detail-report-list-v1',
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
          } as ErpPaymentDetailReportApi.Query;
          const [pageResult, summaryResult] = await Promise.all([
            getPaymentDetailReportPage(params),
            getPaymentDetailReportSummary({
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
    rowConfig: { keyField: 'paymentItemId', isHover: true, isCurrent: true },
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
    const data = await exportPaymentDetailReport({
      ...values,
      ...buildSortParams(),
    });
    downloadFileFromBlobPart({ fileName: '付款明细查询.xlsx', source: data });
    message.success('导出成功');
  } finally {
    exporting.value = false;
  }
}

function getBusinessDocumentType(
  type?: ErpPaymentDetailReportApi.BusinessType,
) {
  const typeMap: Record<
    ErpPaymentDetailReportApi.BusinessType,
    ReportDocumentType
  > = {
    11: REPORT_DOCUMENT_TYPES.PURCHASE_IN,
    12: REPORT_DOCUMENT_TYPES.PURCHASE_RETURN,
    13: REPORT_DOCUMENT_TYPES.PURCHASE_PRICE_ADJUST,
    14: REPORT_DOCUMENT_TYPES.PAYABLE_MISC,
  };
  return type === undefined ? undefined : typeMap[type];
}

function openPaymentDetail(row: ReportRow) {
  void documentDetailModalRef.value?.open(
    REPORT_DOCUMENT_TYPES.FINANCE_PAYMENT,
    row.paymentId,
  );
}

function openBusinessDetail(row: ReportRow) {
  void documentDetailModalRef.value?.open(
    getBusinessDocumentType(row.businessTypeCode),
    row.businessId,
  );
}
</script>

<template>
  <div class="payment-detail-report" data-report="payment-detail">
    <Grid
      class="payment-detail-report__grid"
      table-title="付款明细查询"
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
      <template #paymentNo="{ row }">
        <ReportDocumentLink
          :value="row.paymentNo"
          @open="openPaymentDetail(row)"
        />
      </template>
      <template #businessNo="{ row }">
        <ReportDocumentLink
          :value="row.businessNo"
          @open="openBusinessDetail(row)"
        />
      </template>
      <template #bottom>
        <div class="payment-detail-report__summary">
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
.payment-detail-report {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.payment-detail-report__grid {
  min-height: 0;
}
.payment-detail-report__summary {
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
.payment-detail-report__summary b {
  color: hsl(var(--foreground));
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
:deep(.payment-detail-report__grid .vxe-table--render-default),
:deep(.payment-detail-report__grid .vxe-grid--form-wrapper) {
  font-size: 12px;
}
@media (min-width: 1280px) {
  :deep(.payment-detail-report__grid .vxe-grid--form-wrapper form > .grid) {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}
:deep(
  .payment-detail-report__grid .vxe-header--column.is--sortable .vxe-cell--title
) {
  color: #1677ff;
}
:deep(.payment-detail-report__grid .vxe-header--column .vxe-cell--sort) {
  display: none;
}
:deep(.payment-detail-report__grid .vxe-grid--bottom-wrapper) {
  position: sticky;
  bottom: 36px;
  z-index: 4;
  background: hsl(var(--card));
}
:deep(.payment-detail-report__grid .vxe-grid--pager-wrapper) {
  position: sticky;
  bottom: 0;
  z-index: 5;
  margin-top: 0 !important;
  background: hsl(var(--card));
  box-shadow: 0 -2px 8px rgb(0 0 0 / 8%);
}
:global(.payment-detail-report-search-select-dropdown .ant-select-item),
:global(.payment-detail-report-search-select-dropdown .ant-empty-description) {
  font-size: 12px;
}
</style>
