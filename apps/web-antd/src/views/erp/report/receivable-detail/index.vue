<script setup lang="ts">
import { financeMoneyGrouped } from '#/views/erp/finance/utils/finance-decimal';
import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpReceivableDetailReportApi } from '#/api/erp/report/receivable-detail';
import type { ReportDocumentType } from '#/views/erp/report/components/report-document-detail';

import { computed, ref } from 'vue';

import { useAccess } from '@vben/access';
import { downloadFileFromBlobPart } from '@vben/utils';

import { message } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  getReceivableAccountDeptSimplePage,
  getReceivableAccountUserSimplePage,
} from '#/api/erp/finance/receivable/account';
import {
  exportReceivableDetailReport,
  getReceivableDetailReportPage,
  getReceivableDetailReportSummary,
} from '#/api/erp/report/receivable-detail';
import { getCustomerSimplePage } from '#/api/erp/sale/customer';
import { getRangePickerDefaultProps } from '#/utils';
import ReportDocumentDetailModal from '#/views/erp/report/components/report-document-detail-modal.vue';
import {
  isReportDocumentType,
  REPORT_DOCUMENT_TYPES,
} from '#/views/erp/report/components/report-document-detail';
import ReportDocumentLink from '#/views/erp/report/components/report-document-link.vue';
import { prepareSaleDocumentListColumns } from '#/views/erp/sale/utils/document-list-table';
import { createVxeHeaderSort } from '#/views/erp/utils/vxe-header-sort';

defineOptions({ name: 'ErpReceivableDetailReport' });

type ReportRow = ErpReceivableDetailReportApi.Row;
const { hasAccessByCodes } = useAccess();
const documentDetailModalRef =
  ref<InstanceType<typeof ReportDocumentDetailModal>>();
const mainDocumentTypeMap: Partial<
  Record<ErpReceivableDetailReportApi.DocumentType, ReportDocumentType>
> = {
  FINANCE_RECEIPT: REPORT_DOCUMENT_TYPES.FINANCE_RECEIPT,
  RECEIVABLE_ADJUST: REPORT_DOCUMENT_TYPES.RECEIVABLE_OTHER,
  SALE_ADJUST: REPORT_DOCUMENT_TYPES.SALE_PRICE_ADJUST,
  SALE_OUT: REPORT_DOCUMENT_TYPES.SALE_OUT,
  SALE_RETURN: REPORT_DOCUMENT_TYPES.SALE_RETURN,
};
const canExport = computed(
  () =>
    hasAccessByCodes(['erp:receivable-detail-report:export']) &&
    hasAccessByCodes(['erp:receivable-account:query']),
);
const summary = ref<ErpReceivableDetailReportApi.Summary>({});
const currentRows = ref<ReportRow[]>([]);
const exporting = ref(false);
const amountVisible = computed(
  () =>
    summary.value.amountVisible !== false &&
    currentRows.value.every((row) => row.amountVisible !== false),
);
const amountFields = new Set([
  'balance',
  'increaseAmount',
  'previousBalance',
  'receiptAmount',
  'receivedAmount',
  'unconfirmedReceivable',
  'writeOffAmount',
]);
const sortFieldMap: Record<string, string> = {
  approveTime: 'approveTime',
  balance: 'balance',
  businessDate: 'businessDate',
  customerName: 'customerName',
  documentNo: 'documentNo',
  documentType: 'documentType',
  increaseAmount: 'increaseAmount',
  receiptAmount: 'receiptAmount',
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
    popupClassName: 'receivable-detail-report-search-select-dropdown',
    showSearch: true,
    valueField: 'id',
  };
}

function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      fieldName: 'businessDate',
      label: '日期',
      component: 'RangePicker',
      componentProps: { ...getRangePickerDefaultProps(), allowClear: true },
    },
    {
      fieldName: 'approveDate',
      label: '审核时间',
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
      fieldName: 'customerCode',
      label: '客户编码',
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
          { label: '销售出库', value: 'SALE_OUT' },
          { label: '销售退货', value: 'SALE_RETURN' },
          { label: '销售调价', value: 'SALE_ADJUST' },
          { label: '收款单', value: 'FINANCE_RECEIPT' },
          { label: '应收调账', value: 'RECEIVABLE_ADJUST' },
        ],
      },
    },
    {
      fieldName: 'documentNo',
      label: '单号',
      component: 'Input',
      componentProps: { allowClear: true },
    },
    {
      fieldName: 'sourceNo',
      label: '来源单号',
      component: 'Input',
      componentProps: { allowClear: true },
    },
    {
      fieldName: 'settleMethod',
      label: '结算方式',
      component: 'Input',
      componentProps: { allowClear: true },
    },
    {
      fieldName: 'deliveryMethod',
      label: '运输方式',
      component: 'Input',
      componentProps: { allowClear: true },
    },
    {
      fieldName: 'creatorId',
      label: '制单人',
      component: 'ErpLazyPageSelect',
      componentProps: lazySelect(
        getReceivableAccountUserSimplePage,
        '制单人',
        'nickname',
      ),
    },
    {
      fieldName: 'updaterId',
      label: '修改人',
      component: 'ErpLazyPageSelect',
      componentProps: lazySelect(
        getReceivableAccountUserSimplePage,
        '修改人',
        'nickname',
      ),
    },
    {
      fieldName: 'businessUserId',
      label: '业务员',
      component: 'ErpLazyPageSelect',
      componentProps: lazySelect(
        getReceivableAccountUserSimplePage,
        '业务员',
        'nickname',
      ),
    },
    {
      fieldName: 'voucherNo',
      label: '凭证号',
      component: 'Input',
      componentProps: { allowClear: true },
    },
    {
      fieldName: 'settledStatus',
      label: '是否结算',
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          { label: '是', value: '是' },
          { label: '否', value: '否' },
          { label: '不适用', value: '-' },
        ],
      },
    },
    {
      fieldName: 'deptId',
      label: '部门',
      component: 'ErpLazyPageSelect',
      componentProps: lazySelect(getReceivableAccountDeptSimplePage, '部门'),
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
      field: 'businessDate',
      title: '日期',
      width: 164,
      sortable: true,
      formatter: 'formatDateTime',
    },
    {
      field: 'customerName',
      title: '客户',
      minWidth: 180,
      sortable: true,
      showOverflow: 'tooltip',
      formatter: textFormatter,
    },
    {
      field: 'documentType',
      title: '单据类型',
      width: 108,
      sortable: true,
      formatter: textFormatter,
    },
    {
      field: 'settleMethod',
      title: '结算方式',
      width: 116,
      formatter: textFormatter,
    },
    {
      field: 'updaterName',
      title: '修改人',
      width: 106,
      formatter: textFormatter,
    },
    {
      field: 'creatorName',
      title: '制单人',
      width: 106,
      formatter: textFormatter,
    },
    {
      field: 'businessUserName',
      title: '业务员',
      width: 106,
      formatter: textFormatter,
    },
    {
      field: 'deliveryMethod',
      title: '运输方式',
      width: 116,
      formatter: textFormatter,
    },
    {
      field: 'customerCode',
      title: '客户编码',
      width: 126,
      formatter: textFormatter,
    },
    {
      field: 'documentNo',
      title: '单号',
      width: 172,
      sortable: true,
      slots: { default: 'documentNo' },
    },
    {
      field: 'previousBalance',
      title: '上笔余额',
      width: 126,
      align: 'right',
      formatter: moneyFormatter,
    },
    {
      field: 'increaseAmount',
      title: '增加应收',
      width: 126,
      align: 'right',
      sortable: true,
      formatter: moneyFormatter,
    },
    {
      field: 'receiptAmount',
      title: '收款金额',
      width: 126,
      align: 'right',
      sortable: true,
      formatter: moneyFormatter,
    },
    {
      field: 'balance',
      title: '余额',
      width: 126,
      align: 'right',
      sortable: true,
      formatter: moneyFormatter,
    },
    {
      field: 'unconfirmedReceivable',
      title: '未确认应收',
      width: 132,
      align: 'right',
      formatter: moneyFormatter,
    },
    {
      field: 'approveTime',
      title: '审核时间',
      width: 164,
      sortable: true,
      formatter: 'formatDateTime',
    },
    {
      field: 'voucherNo',
      title: '凭证号',
      width: 150,
      formatter: textFormatter,
    },
    {
      field: 'writeOffAmount',
      title: '已核销金额',
      width: 126,
      align: 'right',
      formatter: moneyFormatter,
    },
    {
      field: 'receivedAmount',
      title: '已收款金额',
      width: 126,
      align: 'right',
      formatter: moneyFormatter,
    },
    {
      field: 'sourceNo',
      title: '来源单号',
      width: 172,
      slots: { default: 'sourceNo' },
    },
    {
      field: 'description',
      title: '说明',
      minWidth: 190,
      showOverflow: 'tooltip',
      formatter: textFormatter,
    },
    {
      field: 'settledStatus',
      title: '是否结算',
      width: 104,
      formatter: textFormatter,
    },
  ];
  const visibleColumns = showAmount
    ? columns
    : columns.filter((column) => !amountFields.has(String(column.field)));
  return prepareSaleDocumentListColumns(visibleColumns, rows, {
    baseWidths: { customerName: 180, description: 190 },
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
      { label: '增加应收', value: formatMoney(summary.value.increaseAmount) },
      { label: '收款金额', value: formatMoney(summary.value.receiptAmount) },
      { label: '已核销金额', value: formatMoney(summary.value.writeOffAmount) },
      { label: '期末余额', value: formatMoney(summary.value.endingBalance) },
    );
  return items;
});

let queryRequestId = 0;
const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    collapsed: true,
    collapsedRows: 1,
    commonConfig: { labelWidth: 76 },
    schema: useGridFormSchema(),
  },
  gridOptions: {
    columns: useGridColumns(),
    fit: false,
    height: 'auto',
    id: 'erp-receivable-detail-report-list-v1',
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
          } as ErpReceivableDetailReportApi.Query;
          const [pageResult, summaryResult] = await Promise.all([
            getReceivableDetailReportPage(params),
            getReceivableDetailReportSummary({
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
    const data = await exportReceivableDetailReport({
      ...values,
      ...buildSortParams(),
    });
    downloadFileFromBlobPart({ fileName: '应收账明细查询.xlsx', source: data });
    message.success('导出成功');
  } finally {
    exporting.value = false;
  }
}

function isPositiveDocumentId(value: null | number | undefined) {
  return Number.isSafeInteger(value) && Number(value) > 0;
}

function getMainDocumentType(row: ReportRow) {
  if (!row.documentNo?.trim() || !isPositiveDocumentId(row.businessId)) return;
  return row.documentTypeCode
    ? mainDocumentTypeMap[row.documentTypeCode]
    : undefined;
}

function getSourceDocumentType(row: ReportRow) {
  if (
    !row.sourceNo?.trim() ||
    !isPositiveDocumentId(row.sourceBusinessId) ||
    !isReportDocumentType(row.sourceDocumentTypeCode)
  )
    return;
  return row.sourceDocumentTypeCode;
}

function openMainDocument(row: ReportRow) {
  const type = getMainDocumentType(row);
  if (!type) return;
  void documentDetailModalRef.value?.open(type, row.businessId);
}

function openSourceDocument(row: ReportRow) {
  const type = getSourceDocumentType(row);
  if (!type) return;
  void documentDetailModalRef.value?.open(type, row.sourceBusinessId);
}
</script>

<template>
  <div class="receivable-detail-report" data-report="receivable-detail">
    <Grid
      class="receivable-detail-report__grid"
      table-title="应收账明细查询"
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
          v-if="getMainDocumentType(row)"
          :value="row.documentNo"
          @open="openMainDocument(row)"
        />
        <span v-else>{{ row.documentNo || '-' }}</span>
      </template>
      <template #sourceNo="{ row }">
        <ReportDocumentLink
          v-if="getSourceDocumentType(row)"
          :value="row.sourceNo"
          @open="openSourceDocument(row)"
        />
        <span v-else>{{ row.sourceNo || '-' }}</span>
      </template>
      <template #bottom>
        <div class="receivable-detail-report__summary">
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
.receivable-detail-report {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.receivable-detail-report__grid {
  min-height: 0;
}
.receivable-detail-report__summary {
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
.receivable-detail-report__summary b {
  color: hsl(var(--foreground));
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
:deep(.receivable-detail-report__grid .vxe-table--render-default),
:deep(.receivable-detail-report__grid .vxe-grid--form-wrapper) {
  font-size: 12px;
}
@media (min-width: 1280px) {
  :deep(.receivable-detail-report__grid .vxe-grid--form-wrapper form > .grid) {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}
:deep(
  .receivable-detail-report__grid
    .vxe-header--column.is--sortable
    .vxe-cell--title
) {
  color: #1677ff;
}
:deep(.receivable-detail-report__grid .vxe-header--column .vxe-cell--sort) {
  display: none;
}
:deep(.receivable-detail-report__grid .vxe-grid--bottom-wrapper) {
  position: sticky;
  bottom: 36px;
  z-index: 4;
  background: hsl(var(--card));
}
:deep(.receivable-detail-report__grid .vxe-grid--pager-wrapper) {
  position: sticky;
  bottom: 0;
  z-index: 5;
  margin-top: 0 !important;
  background: hsl(var(--card));
  box-shadow: 0 -2px 8px rgb(0 0 0 / 8%);
}
:global(.receivable-detail-report-search-select-dropdown .ant-select-item),
:global(
  .receivable-detail-report-search-select-dropdown .ant-empty-description
) {
  font-size: 12px;
}
</style>
