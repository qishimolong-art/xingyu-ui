<script setup lang="ts">
import { financeMoneyGrouped } from '#/views/erp/finance/utils/finance-decimal';
import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpPayableAgingReportApi } from '#/api/erp/report/payable-aging';

import { computed, ref } from 'vue';

import { useAccess } from '@vben/access';
import { downloadFileFromBlobPart } from '@vben/utils';

import { Alert, message } from 'ant-design-vue';
import dayjs from 'dayjs';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import { getSupplierSimplePage } from '#/api/erp/purchase/supplier';
import {
  exportPayableAgingReport,
  getPayableAgingReportPage,
  getPayableAgingReportSummary,
} from '#/api/erp/report/payable-aging';
import { createVxeHeaderSort } from '#/views/erp/utils/vxe-header-sort';

defineOptions({ name: 'ErpPayableAgingReport' });

type ReportRow = ErpPayableAgingReportApi.Row;

const { hasAccessByCodes } = useAccess();
const canExport = computed(
  () =>
    hasAccessByCodes(['erp:payable-aging-report:export']) &&
    hasAccessByCodes(['erp:payable-account:query']),
);
const summary = ref<ErpPayableAgingReportApi.Summary>({});
const currentRows = ref<ReportRow[]>([]);
const exporting = ref(false);
const amountVisible = computed(
  () =>
    summary.value.amountVisible !== false &&
    currentRows.value.every((row) => row.amountVisible !== false),
);
const sortFieldMap: Record<string, string> = {
  balance: 'balance',
  month01: 'month01',
  month02: 'month02',
  month03: 'month03',
  month04: 'month04',
  month05: 'month05',
  month06: 'month06',
  month07: 'month07',
  month08: 'month08',
  month09: 'month09',
  month10: 'month10',
  month11: 'month11',
  month12: 'month12',
  overThreeYears: 'overThreeYears',
  purchaser: 'purchaser',
  supplierName: 'supplierName',
  supplierType: 'supplierType',
  withinThreeYears: 'withinThreeYears',
  withinTwoYears: 'withinTwoYears',
};
const { buildSortParams, handleSortChange, restoreSortState } =
  createVxeHeaderSort(sortFieldMap);

function useGridFormSchema(): VbenFormSchema[] {
  const fields: VbenFormSchema[] = [
    {
      fieldName: 'asOfDate',
      label: '截止日期',
      component: 'DatePicker',
      componentProps: {
        allowClear: false,
        format: 'YYYY-MM-DD',
        valueFormat: 'YYYY-MM-DD',
      },
      defaultValue: dayjs().format('YYYY-MM-DD'),
    },
    {
      fieldName: 'supplierId',
      label: '供应商',
      component: 'ErpLazyPageSelect',
      componentProps: {
        allowClear: true,
        api: getSupplierSimplePage,
        labelField: 'name',
        loadErrorMessage: '供应商列表加载失败，请重试',
        pageSize: 10,
        placeholder: '请选择供应商',
        popupClassName: 'payable-aging-report-search-select-dropdown',
        showSearch: true,
        valueField: 'id',
      },
    },
  ];
  if (summary.value.supplierTypeVisible !== false) {
    fields.push({
      fieldName: 'supplierType',
      label: '供应商类型',
      component: 'Input',
      componentProps: { allowClear: true },
    });
  }
  if (summary.value.purchaserVisible !== false) {
    fields.push({
      fieldName: 'purchaser',
      label: '采购员',
      component: 'Input',
      componentProps: { allowClear: true },
    });
  }
  return fields;
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

const summaryItems = computed(() => {
  const items = [
    {
      label: '供应商行数',
      value: Number(summary.value.rowCount ?? 0).toLocaleString('zh-CN'),
    },
  ];
  if (!amountVisible.value) return items;
  return [
    ...items,
    { label: '余额', value: formatMoney(summary.value.balance) },
    { label: '一月', value: formatMoney(summary.value.month01) },
    { label: '二月', value: formatMoney(summary.value.month02) },
    { label: '三月', value: formatMoney(summary.value.month03) },
    { label: '四月', value: formatMoney(summary.value.month04) },
    { label: '五月', value: formatMoney(summary.value.month05) },
    { label: '六月', value: formatMoney(summary.value.month06) },
    { label: '七月', value: formatMoney(summary.value.month07) },
    { label: '八月', value: formatMoney(summary.value.month08) },
    { label: '九月', value: formatMoney(summary.value.month09) },
    { label: '十月', value: formatMoney(summary.value.month10) },
    { label: '十一月', value: formatMoney(summary.value.month11) },
    { label: '十二月', value: formatMoney(summary.value.month12) },
    { label: '两年内', value: formatMoney(summary.value.withinTwoYears) },
    { label: '三年内', value: formatMoney(summary.value.withinThreeYears) },
    { label: '三年以上', value: formatMoney(summary.value.overThreeYears) },
  ];
});

function monthColumn(month: number, title: string) {
  const field = `month${String(month).padStart(2, '0')}`;
  return {
    align: 'right' as const,
    field,
    formatter: moneyFormatter,
    sortable: true,
    title,
    width: 112,
  };
}

function useGridColumns(): VxeTableGridOptions<ReportRow>['columns'] {
  const columns: NonNullable<VxeTableGridOptions<ReportRow>['columns']> = [
    {
      field: 'supplierName',
      title: '供应商',
      minWidth: 210,
      sortable: true,
      showOverflow: 'tooltip',
      formatter: textFormatter,
    },
  ];
  if (summary.value.supplierTypeVisible !== false) {
    columns.push({
      field: 'supplierType',
      title: '供应商类型',
      width: 130,
      sortable: true,
      formatter: textFormatter,
    });
  }
  if (summary.value.purchaserVisible !== false) {
    columns.push({
      field: 'purchaser',
      title: '采购员',
      width: 116,
      sortable: true,
      formatter: textFormatter,
    });
  }
  if (!amountVisible.value) return columns;
  columns.push(
    {
      field: 'balance',
      title: '余额',
      width: 132,
      align: 'right',
      sortable: true,
      formatter: moneyFormatter,
    },
    {
      title: '一年内',
      children: [
        monthColumn(1, '一月'),
        monthColumn(2, '二月'),
        monthColumn(3, '三月'),
        monthColumn(4, '四月'),
        monthColumn(5, '五月'),
        monthColumn(6, '六月'),
        monthColumn(7, '七月'),
        monthColumn(8, '八月'),
        monthColumn(9, '九月'),
        monthColumn(10, '十月'),
        monthColumn(11, '十一月'),
        monthColumn(12, '十二月'),
      ],
    },
    {
      field: 'withinTwoYears',
      title: '两年内',
      width: 122,
      align: 'right',
      sortable: true,
      formatter: moneyFormatter,
    },
    {
      field: 'withinThreeYears',
      title: '三年内',
      width: 122,
      align: 'right',
      sortable: true,
      formatter: moneyFormatter,
    },
    {
      field: 'overThreeYears',
      title: '三年以上',
      width: 132,
      align: 'right',
      sortable: true,
      formatter: moneyFormatter,
    },
  );
  return columns;
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
    params[key] = value;
  });
  return params;
}

let queryRequestId = 0;
const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    collapsed: true,
    collapsedRows: 1,
    commonConfig: { labelWidth: 88 },
    schema: useGridFormSchema(),
  },
  gridOptions: {
    columns: useGridColumns(),
    fit: false,
    height: 'auto',
    id: 'erp-payable-aging-report-list-v1',
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
          } as ErpPayableAgingReportApi.Query;
          const [pageResult, summaryResult] = await Promise.all([
            getPayableAgingReportPage(params),
            getPayableAgingReportSummary({
              ...params,
              pageNo: 1,
              pageSize: 20,
            }),
          ]);
          if (requestId === queryRequestId) {
            currentRows.value = pageResult.list || [];
            summary.value = summaryResult || {};
            await gridApi.formApi.setState({ schema: useGridFormSchema() });
            await gridApi.grid?.reloadColumn?.(useGridColumns() as any[]);
          }
          return pageResult;
        },
        querySuccess: () => void restoreSortState(gridApi),
      },
      sort: true,
    },
    rowConfig: { keyField: 'supplierId', isHover: true, isCurrent: true },
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
    const data = await exportPayableAgingReport({
      ...values,
      ...buildSortParams(),
    });
    downloadFileFromBlobPart({ fileName: '应付账龄分析.xlsx', source: data });
    message.success('导出成功');
  } finally {
    exporting.value = false;
  }
}
</script>

<template>
  <div class="payable-aging-report" data-report="payable-aging">
    <Alert
      class="payable-aging-report__notice"
      message="本报表按业务发生日期带符号分桶，不按未结单先进先出重算；手工核销和预付款不参与余额。"
      type="info"
      show-icon
    />
    <Grid
      class="payable-aging-report__grid"
      table-title="应付账龄分析"
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
      <template #bottom>
        <div class="payable-aging-report__summary">
          <b>全条件合计：</b>
          <span v-for="item in summaryItems" :key="item.label">
            {{ item.label }}：<b>{{ item.value }}</b>
          </span>
        </div>
      </template>
    </Grid>
  </div>
</template>

<style scoped>
.payable-aging-report {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.payable-aging-report__notice {
  margin: 0 0 8px;
}
.payable-aging-report__grid {
  min-height: 0;
}
.payable-aging-report__summary {
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
.payable-aging-report__summary b {
  color: hsl(var(--foreground));
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
:deep(.payable-aging-report__grid .vxe-table--render-default),
:deep(.payable-aging-report__grid .vxe-grid--form-wrapper) {
  font-size: 12px;
}
:deep(.payable-aging-report__grid .vxe-header--column .vxe-cell--title) {
  white-space: nowrap;
}
:deep(
  .payable-aging-report__grid .vxe-header--column.is--sortable .vxe-cell--title
) {
  color: #1677ff;
}
:deep(.payable-aging-report__grid .vxe-header--column .vxe-cell--sort) {
  display: none;
}
:deep(.payable-aging-report__grid .vxe-grid--bottom-wrapper) {
  position: sticky;
  bottom: 36px;
  z-index: 4;
  flex-shrink: 0;
  background: hsl(var(--card));
}
:deep(.payable-aging-report__grid .vxe-grid--pager-wrapper) {
  position: sticky;
  bottom: 0;
  z-index: 5;
  margin-top: 0 !important;
  background: hsl(var(--card));
  box-shadow: 0 -2px 8px rgb(0 0 0 / 8%);
}
:global(.payable-aging-report-search-select-dropdown .ant-select-item),
:global(.payable-aging-report-search-select-dropdown .ant-empty-description) {
  font-size: 14px;
}
</style>
