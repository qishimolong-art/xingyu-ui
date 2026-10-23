<script setup lang="ts">
import { financeMoneyGrouped } from '#/views/erp/finance/utils/finance-decimal';
import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpPayableDetailReportApi } from '#/api/erp/report/payable-detail';
import type { ReportDocumentType } from '#/views/erp/report/components/report-document-detail';

import { computed, ref } from 'vue';

import { useAccess } from '@vben/access';
import { downloadFileFromBlobPart } from '@vben/utils';

import { message } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import { getPayableAccountUserSimplePage } from '#/api/erp/finance/payable/account';
import { getSupplierSimplePage } from '#/api/erp/purchase/supplier';
import {
  exportPayableDetailReport,
  getPayableDetailReportPage,
  getPayableDetailReportSummary,
} from '#/api/erp/report/payable-detail';
import { getRangePickerDefaultProps } from '#/utils';
import ReportDocumentDetailModal from '#/views/erp/report/components/report-document-detail-modal.vue';
import ReportDocumentLink from '#/views/erp/report/components/report-document-link.vue';
import { REPORT_DOCUMENT_TYPES } from '#/views/erp/report/components/report-document-detail';
import { prepareSaleDocumentListColumns } from '#/views/erp/sale/utils/document-list-table';
import { createVxeHeaderSort } from '#/views/erp/utils/vxe-header-sort';

defineOptions({ name: 'ErpPayableDetailReport' });

type ReportRow = ErpPayableDetailReportApi.Row;
const { hasAccessByCodes } = useAccess();
const canExport = computed(
  () =>
    hasAccessByCodes(['erp:payable-detail-report:export']) &&
    hasAccessByCodes(['erp:payable-account:query']),
);
const summary = ref<ErpPayableDetailReportApi.Summary>({});
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
  'endingPayable',
  'increasePayable',
  'paymentAmount',
  'previousBalance',
]);
const sortFieldMap: Record<string, string> = {
  creatorName: 'creatorName',
  documentDate: 'documentDate',
  documentNo: 'documentNo',
  documentType: 'documentType',
  endingPayable: 'endingPayable',
  increasePayable: 'increasePayable',
  paymentAmount: 'paymentAmount',
  previousBalance: 'previousBalance',
  supplierCode: 'supplierCode',
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
    popupClassName: 'payable-detail-report-search-select-dropdown',
    showSearch: true,
    valueField: 'id',
  };
}

function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      fieldName: 'documentDate',
      label: '单据日期',
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
      fieldName: 'supplierCode',
      label: '供应商编码',
      component: 'Input',
      componentProps: { allowClear: true },
    },
    {
      fieldName: 'supplierType',
      label: '供应商类型',
      component: 'Input',
      componentProps: { allowClear: true },
    },
    {
      fieldName: 'documentTypes',
      label: '单据类型',
      component: 'Select',
      componentProps: {
        allowClear: true,
        mode: 'multiple',
        maxTagCount: 1,
        options: [
          { label: '采购入库', value: 'PURCHASE_IN' },
          { label: '采购退货', value: 'PURCHASE_RETURN' },
          { label: '采购调价', value: 'PURCHASE_ADJUST' },
          { label: '应付调账', value: 'PAYABLE_ADJUST' },
          { label: '付款单', value: 'FINANCE_PAYMENT' },
        ],
      },
    },
    {
      fieldName: 'documentNo',
      label: '业务单号',
      component: 'Input',
      componentProps: { allowClear: true },
    },
    {
      fieldName: 'creatorId',
      label: '制单人',
      component: 'ErpLazyPageSelect',
      componentProps: lazySelect(
        getPayableAccountUserSimplePage,
        '制单人',
        'nickname',
      ),
    },
    {
      fieldName: 'voucherNo',
      label: '凭证号',
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
      field: 'supplierCode',
      title: '供应商编码',
      width: 132,
      sortable: true,
      formatter: textFormatter,
    },
    {
      field: 'supplierName',
      title: '供应商',
      minWidth: 190,
      sortable: true,
      showOverflow: 'tooltip',
      formatter: textFormatter,
    },
    {
      field: 'documentDate',
      title: '单据日期',
      width: 164,
      sortable: true,
      formatter: 'formatDateTime',
    },
    {
      field: 'documentType',
      title: '单据类型',
      width: 112,
      sortable: true,
      formatter: textFormatter,
    },
    {
      field: 'documentNo',
      title: '业务单号',
      width: 174,
      sortable: true,
      slots: { default: 'documentNo' },
    },
    {
      field: 'creatorName',
      title: '制单人',
      width: 108,
      sortable: true,
      formatter: textFormatter,
    },
    {
      field: 'increasePayable',
      title: '增加应付',
      width: 128,
      align: 'right',
      sortable: true,
      formatter: moneyFormatter,
    },
    {
      field: 'paymentAmount',
      title: '付款金额',
      width: 128,
      align: 'right',
      sortable: true,
      formatter: moneyFormatter,
    },
    {
      field: 'previousBalance',
      title: '上日余额',
      width: 128,
      align: 'right',
      sortable: true,
      formatter: moneyFormatter,
    },
    {
      field: 'endingPayable',
      title: '末期应付',
      width: 128,
      align: 'right',
      sortable: true,
      formatter: moneyFormatter,
    },
    {
      field: 'voucherNo',
      title: '凭证号',
      width: 150,
      formatter: textFormatter,
    },
    {
      field: 'remark',
      title: '备注',
      minWidth: 190,
      showOverflow: 'tooltip',
      formatter: textFormatter,
    },
    {
      field: 'supplierType',
      title: '供应商类型',
      width: 126,
      sortable: true,
      formatter: textFormatter,
    },
  ];
  const visibleColumns = showAmount
    ? columns
    : columns.filter((column) => !amountFields.has(String(column.field)));
  return prepareSaleDocumentListColumns(visibleColumns, rows, {
    baseWidths: { remark: 190, supplierName: 190 },
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
      { label: '增加应付', value: formatMoney(summary.value.increasePayable) },
      { label: '付款金额', value: formatMoney(summary.value.paymentAmount) },
      { label: '期末应付', value: formatMoney(summary.value.endingPayable) },
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
    id: 'erp-payable-detail-report-list-v1',
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
          } as ErpPayableDetailReportApi.Query;
          const [pageResult, summaryResult] = await Promise.all([
            getPayableDetailReportPage(params),
            getPayableDetailReportSummary({
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
    const data = await exportPayableDetailReport({
      ...values,
      ...buildSortParams(),
    });
    downloadFileFromBlobPart({ fileName: '应付账明细查询.xlsx', source: data });
    message.success('导出成功');
  } finally {
    exporting.value = false;
  }
}

function getDocumentType(type?: ErpPayableDetailReportApi.DocumentType) {
  const typeMap: Partial<
    Record<ErpPayableDetailReportApi.DocumentType, ReportDocumentType>
  > = {
    FINANCE_PAYMENT: REPORT_DOCUMENT_TYPES.FINANCE_PAYMENT,
    PAYABLE_ADJUST: REPORT_DOCUMENT_TYPES.PAYABLE_OTHER,
    PURCHASE_ADJUST: REPORT_DOCUMENT_TYPES.PURCHASE_PRICE_ADJUST,
    PURCHASE_IN: REPORT_DOCUMENT_TYPES.PURCHASE_IN,
    PURCHASE_RETURN: REPORT_DOCUMENT_TYPES.PURCHASE_RETURN,
  };
  return type ? typeMap[type] : undefined;
}

function openDocumentDetail(row: ReportRow) {
  void documentDetailModalRef.value?.open(
    getDocumentType(row.documentTypeCode),
    row.businessId,
  );
}
</script>

<template>
  <div class="payable-detail-report" data-report="payable-detail">
    <Grid
      class="payable-detail-report__grid"
      table-title="应付账明细查询"
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
      <template #documentNo="{ row }">
        <ReportDocumentLink
          :value="row.documentNo"
          @open="openDocumentDetail(row)"
        />
      </template>
      <template #bottom>
        <div class="payable-detail-report__summary">
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
.payable-detail-report {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.payable-detail-report__grid {
  min-height: 0;
}
.payable-detail-report__summary {
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
.payable-detail-report__summary b {
  color: hsl(var(--foreground));
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
:deep(.payable-detail-report__grid .vxe-table--render-default),
:deep(.payable-detail-report__grid .vxe-grid--form-wrapper) {
  font-size: 12px;
}
@media (min-width: 1280px) {
  :deep(.payable-detail-report__grid .vxe-grid--form-wrapper form > .grid) {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}
:deep(
  .payable-detail-report__grid .vxe-header--column.is--sortable .vxe-cell--title
) {
  color: #1677ff;
}
:deep(.payable-detail-report__grid .vxe-header--column .vxe-cell--sort) {
  display: none;
}
:deep(.payable-detail-report__grid .vxe-grid--bottom-wrapper) {
  position: sticky;
  bottom: 36px;
  z-index: 4;
  background: hsl(var(--card));
}
:deep(.payable-detail-report__grid .vxe-grid--pager-wrapper) {
  position: sticky;
  bottom: 0;
  z-index: 5;
  margin-top: 0 !important;
  background: hsl(var(--card));
  box-shadow: 0 -2px 8px rgb(0 0 0 / 8%);
}
:global(.payable-detail-report-search-select-dropdown .ant-select-item),
:global(.payable-detail-report-search-select-dropdown .ant-empty-description) {
  font-size: 12px;
}
</style>
