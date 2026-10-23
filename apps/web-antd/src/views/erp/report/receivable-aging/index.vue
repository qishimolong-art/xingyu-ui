<script setup lang="ts">
import { financeMoneyGrouped } from '#/views/erp/finance/utils/finance-decimal';
import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpReceivableAgingReportApi } from '#/api/erp/report/receivable-aging';

import { computed, defineAsyncComponent, ref } from 'vue';

import { useAccess } from '@vben/access';
import { useVbenModal } from '@vben/common-ui';
import { downloadFileFromBlobPart } from '@vben/utils';

import { Alert, message } from 'ant-design-vue';
import dayjs from 'dayjs';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import { getBaseDataSimpleList } from '#/api/erp/base';
import {
  getReceivableAccountDeptSimplePage,
  getReceivableAccountUserSimplePage,
} from '#/api/erp/finance/receivable/account';
import {
  exportReceivableAgingReport,
  getReceivableAgingReportPage,
  getReceivableAgingReportSummary,
} from '#/api/erp/report/receivable-aging';
import { getCustomerSimplePage } from '#/api/erp/sale/customer';
import { createVxeHeaderSort } from '#/views/erp/utils/vxe-header-sort';

import DetailModal from './modules/detail-modal.vue';

defineOptions({ name: 'ErpReceivableAgingReport' });

type ReportRow = ErpReceivableAgingReportApi.Row;
type AmountField = keyof ErpReceivableAgingReportApi.Amounts;

const CustomerDetail = defineAsyncComponent(
  () => import('#/views/erp/sale/customer/modules/detail.vue'),
);
const [CustomerDetailModal, customerDetailModalApi] = useVbenModal({
  connectedComponent: CustomerDetail,
  destroyOnClose: true,
});
const [AgingDetailModal, agingDetailModalApi] = useVbenModal({
  connectedComponent: DetailModal,
  destroyOnClose: true,
});

const { hasAccessByCodes } = useAccess();
const canCustomerQuery = computed(() =>
  hasAccessByCodes(['erp:customer:query']),
);
const canExport = computed(
  () =>
    hasAccessByCodes(['erp:receivable-aging-report:export']) &&
    hasAccessByCodes(['erp:receivable-account:query']),
);
const summary = ref<ErpReceivableAgingReportApi.Summary>({});
const exporting = ref(false);
const analysisDate = ref(dayjs().format('YYYY-MM-DD'));
const drilldownFields = new Set<AmountField>([
  'balance',
  'months3To6',
  'months6To12',
  'over1Year',
  'within1Month',
  'within2Months',
  'within3Months',
]);
const bucketMap: Record<
  string,
  { bucket: ErpReceivableAgingReportApi.Bucket; name: string }
> = {
  balance: { bucket: 'ALL', name: '余额' },
  months3To6: { bucket: 'MONTHS_3_TO_6', name: '3个月至半年内' },
  months6To12: { bucket: 'MONTHS_6_TO_12', name: '半年至一年内' },
  over1Year: { bucket: 'OVER_1_YEAR', name: '一年以上' },
  within1Month: { bucket: 'WITHIN_1_MONTH', name: '1个月内' },
  within2Months: { bucket: 'WITHIN_2_MONTHS', name: '2个月内' },
  within3Months: { bucket: 'WITHIN_3_MONTHS', name: '3个月内' },
};
const sortFieldMap = Object.fromEntries(
  [
    'areaName',
    'balance',
    'creditBalance',
    'creditLimit',
    'customerName',
    'customerTypeName',
    'deptName',
    'developerName',
    'months3To6',
    'months6To12',
    'over1Year',
    'saleUserName',
    'within1Month',
    'within2Months',
    'within3Months',
  ].map((field) => [field, field]),
);
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
    popupClassName: 'receivable-aging-report-search-select-dropdown',
    showSearch: true,
    valueField: 'id',
  };
}

const customerTypeOptions = [
  { label: '车主', value: 1 },
  { label: '修理厂', value: 2 },
  { label: '终端客户', value: 3 },
  { label: '客户供应商', value: 4 },
  { label: '供应商', value: 5 },
  { label: '门店', value: 6 },
  { label: '经销商', value: 7 },
];

function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      fieldName: 'analysisDate',
      label: '分析日期',
      component: 'DatePicker',
      defaultValue: dayjs().format('YYYY-MM-DD'),
      componentProps: {
        allowClear: false,
        disabledDate: (date: any) => date?.isAfter(dayjs(), 'day'),
        format: 'YYYY-MM-DD',
        valueFormat: 'YYYY-MM-DD',
      },
    },
    {
      fieldName: 'customerId',
      label: '客户',
      component: 'ErpLazyPageSelect',
      componentProps: lazySelect(getCustomerSimplePage, '客户'),
    },
    {
      fieldName: 'customerType',
      label: '客户类型',
      component: 'Select',
      componentProps: { allowClear: true, options: customerTypeOptions },
    },
    {
      fieldName: 'areaId',
      label: '区域',
      component: 'ApiSelect',
      componentProps: {
        allowClear: true,
        api: () => getBaseDataSimpleList('sales_area'),
        labelField: 'name',
        optionFilterProp: 'label',
        placeholder: '请选择区域',
        showSearch: true,
        valueField: 'id',
      },
    },
    {
      fieldName: 'saleUserId',
      label: '业务员',
      component: 'ErpLazyPageSelect',
      componentProps: lazySelect(
        getReceivableAccountUserSimplePage,
        '业务员',
        'nickname',
      ),
    },
    {
      fieldName: 'deptId',
      label: '部门',
      component: 'ErpLazyPageSelect',
      componentProps: lazySelect(getReceivableAccountDeptSimplePage, '部门'),
    },
    {
      fieldName: 'developerUserId',
      label: '开发员',
      component: 'ErpLazyPageSelect',
      componentProps: lazySelect(
        getReceivableAccountUserSimplePage,
        '开发员',
        'nickname',
      ),
    },
  ].filter((field) => {
    const visibility: Record<string, boolean | undefined> = {
      areaId: summary.value.areaVisible,
      customerId: summary.value.customerNameVisible,
      customerType: summary.value.customerTypeVisible,
      deptId: summary.value.deptVisible,
      developerUserId: summary.value.developerVisible,
      saleUserId: summary.value.saleUserVisible,
    };
    return visibility[field.fieldName] !== false;
  });
}

function formatMoney(value: unknown) {
  return financeMoneyGrouped(value as any);
}
const textFormatter = ({ cellValue }: { cellValue: unknown }) =>
  cellValue === null || cellValue === undefined || cellValue === ''
    ? '-'
    : String(cellValue);
const moneyFormatter = ({ cellValue }: { cellValue: unknown }) =>
  formatMoney(cellValue);

const summaryItems = computed(() => [
  {
    label: '客户部门组合',
    value: Number(summary.value.rowCount ?? 0).toLocaleString('zh-CN'),
  },
  { label: '余额', value: formatMoney(summary.value.balance) },
  { label: '信用额度', value: formatMoney(summary.value.creditLimit) },
  { label: '信用余额', value: formatMoney(summary.value.creditBalance) },
  { label: '1个月内', value: formatMoney(summary.value.within1Month) },
  { label: '2个月内', value: formatMoney(summary.value.within2Months) },
  { label: '3个月内', value: formatMoney(summary.value.within3Months) },
  { label: '3个月至半年内', value: formatMoney(summary.value.months3To6) },
  { label: '半年至一年内', value: formatMoney(summary.value.months6To12) },
  { label: '一年以上', value: formatMoney(summary.value.over1Year) },
]);

function useGridColumns(): VxeTableGridOptions<ReportRow>['columns'] {
  const money = (
    field: AmountField,
    title: string,
    width = 126,
    drilldown = false,
  ) => ({
    align: 'right' as const,
    field,
    formatter: moneyFormatter,
    slots: drilldown ? { default: 'amountLink' } : undefined,
    sortable: true,
    title,
    width,
  });
  return [
    {
      field: 'customerName',
      title: '客户',
      minWidth: 190,
      fixed: 'left',
      sortable: true,
      slots: { default: 'customerName' },
    },
    {
      field: 'customerTypeName',
      title: '客户类型',
      width: 122,
      sortable: true,
      formatter: textFormatter,
    },
    money('balance', '余额', 130, true),
    money('creditLimit', '信用额度', 130),
    money('creditBalance', '信用余额', 130),
    money('within1Month', '1个月内', 126, true),
    money('within2Months', '2个月内', 126, true),
    money('within3Months', '3个月内', 126, true),
    money('months3To6', '3个月至半年内', 150, true),
    money('months6To12', '半年至一年内', 150, true),
    money('over1Year', '一年以上', 126, true),
    {
      field: 'areaName',
      title: '区域',
      width: 120,
      sortable: true,
      formatter: textFormatter,
    },
    {
      field: 'saleUserName',
      title: '业务员',
      width: 116,
      sortable: true,
      formatter: textFormatter,
    },
    {
      field: 'deptName',
      title: '部门',
      width: 150,
      sortable: true,
      formatter: textFormatter,
    },
    {
      field: 'developerName',
      title: '开发员',
      width: 116,
      sortable: true,
      formatter: textFormatter,
    },
  ];
}

function normalizeQuery(values: Record<string, any>) {
  const params: Record<string, any> = {};
  Object.entries(values || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    params[key] = typeof value === 'string' ? value.trim() : value;
  });
  return params;
}

let requestId = 0;
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
    id: 'erp-receivable-aging-report-list-v1',
    showHeaderOverflow: 'tooltip',
    showOverflow: 'tooltip',
    scrollX: { enabled: true, gt: 8 },
    scrollY: { enabled: true, gt: 10 },
    proxyConfig: {
      ajax: {
        query: async ({ page, sort, sorts }, formValues) => {
          const currentId = ++requestId;
          const params = {
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            ...normalizeQuery(formValues),
            ...buildSortParams(sorts, sort),
          } as ErpReceivableAgingReportApi.Query;
          analysisDate.value = params.analysisDate;
          const [pageResult, summaryResult] = await Promise.all([
            getReceivableAgingReportPage(params),
            getReceivableAgingReportSummary({
              ...params,
              pageNo: 1,
              pageSize: 20,
            }),
          ]);
          if (currentId === requestId) {
            summary.value = summaryResult || {};
            await gridApi.formApi.setState({ schema: useGridFormSchema() });
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

function openCustomer(row: ReportRow) {
  if (!canCustomerQuery.value || !row.customerId || !row.customerName) return;
  customerDetailModalApi.setData({ id: row.customerId }).open();
}

function openAmount(row: ReportRow, field: string) {
  const config = bucketMap[field];
  if (
    !config ||
    !drilldownFields.has(field as AmountField) ||
    row.amountVisible === false ||
    !row.customerId
  )
    return;
  agingDetailModalApi
    .setData({
      analysisDate: analysisDate.value,
      bucket: config.bucket,
      bucketName: config.name,
      customerId: row.customerId,
      customerName: row.customerName,
      deptId: row.deptId,
      deptName: row.deptName,
    })
    .open();
}

function isDrilldownField(field: string) {
  return drilldownFields.has(field as AmountField);
}

function rowAmount(row: ReportRow, field: string) {
  return row[field as AmountField];
}

async function handleExport() {
  exporting.value = true;
  try {
    const values = normalizeQuery(
      await gridApi.formApi.getValues(),
    ) as ErpReceivableAgingReportApi.Query;
    const data = await exportReceivableAgingReport({
      ...values,
      ...buildSortParams(),
    });
    downloadFileFromBlobPart({
      fileName: '应收账龄分析报表.xlsx',
      source: data,
    });
    message.success('导出成功');
  } finally {
    exporting.value = false;
  }
}
</script>

<template>
  <div class="receivable-aging-report" data-report="receivable-aging">
    <Alert
      class="mb-2"
      message="按事件日期带符号分桶：收款按收款日期冲减，不执行先进先出；历史日期按当前审核状态回看。"
      type="info"
      show-icon
    />
    <Grid class="receivable-aging-report__grid" table-title="应收账龄分析">
      <template #customerName="{ row }">
        <button
          v-if="canCustomerQuery && row.customerId && row.customerName"
          class="report-link"
          type="button"
          @click.stop="openCustomer(row)"
        >
          {{ row.customerName }}
        </button>
        <span v-else>{{ row.customerName || '-' }}</span>
      </template>
      <template #amountLink="{ row, column }">
        <button
          v-if="row.amountVisible !== false && isDrilldownField(column.field)"
          class="report-link report-link--number"
          type="button"
          @click.stop="openAmount(row, column.field)"
        >
          {{ formatMoney(rowAmount(row, column.field)) }}
        </button>
        <span v-else>{{ formatMoney(rowAmount(row, column.field)) }}</span>
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
        <div class="receivable-aging-report__summary">
          <b>全条件合计：</b
          ><span v-for="item in summaryItems" :key="item.label"
            >{{ item.label }}：<b>{{ item.value }}</b></span
          >
        </div>
      </template>
    </Grid>
    <CustomerDetailModal />
    <AgingDetailModal />
  </div>
</template>

<style scoped>
.receivable-aging-report {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.receivable-aging-report__grid {
  min-height: 0;
}
.receivable-aging-report__summary {
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
.receivable-aging-report__summary b {
  color: hsl(var(--foreground));
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
:deep(.receivable-aging-report__grid .vxe-table--render-default),
:deep(.receivable-aging-report__grid .vxe-grid--form-wrapper) {
  font-size: 12px;
}
:deep(
  .receivable-aging-report__grid
    .vxe-header--column.is--sortable
    .vxe-cell--title
) {
  color: #1677ff;
}
:deep(.receivable-aging-report__grid .vxe-header--column .vxe-cell--sort) {
  display: none;
}
:deep(.receivable-aging-report__grid .vxe-grid--bottom-wrapper) {
  position: sticky;
  bottom: 36px;
  z-index: 4;
  background: hsl(var(--card));
}
:deep(.receivable-aging-report__grid .vxe-grid--pager-wrapper) {
  position: sticky;
  bottom: 0;
  z-index: 5;
  margin-top: 0 !important;
  background: hsl(var(--card));
  box-shadow: 0 -2px 8px rgb(0 0 0 / 8%);
}
.report-link {
  max-width: 100%;
  padding: 0;
  overflow: hidden;
  color: #1677ff;
  font: inherit;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: transparent;
  border: 0;
  cursor: pointer;
}
.report-link:hover {
  color: #4096ff;
  text-decoration: underline;
}
.report-link:focus-visible {
  outline: 2px solid #1677ff;
  outline-offset: 2px;
}
.report-link--number {
  display: block;
  width: 100%;
  text-align: right;
}
</style>
