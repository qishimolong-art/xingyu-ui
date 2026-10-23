<script setup lang="ts">
import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpStockProfitLossDetailReportApi } from '#/api/erp/report/stock-profit-loss-detail';

import { computed, ref } from 'vue';

import { useAccess } from '@vben/access';
import { downloadFileFromBlobPart } from '@vben/utils';

import { message } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  exportStockProfitLossDetail,
  getStockProfitLossDetailPage,
  getStockProfitLossDetailSummary,
} from '#/api/erp/report/stock-profit-loss-detail';
import { getRangePickerDefaultProps } from '#/utils';
import { prepareSaleDocumentListColumns } from '#/views/erp/sale/utils/document-list-table';
import { withErpKeywordSearchSchema } from '#/views/erp/utils/form-defaults';
import { createVxeHeaderSort } from '#/views/erp/utils/vxe-header-sort';

import SourceDetail from './source-detail.vue';
import { formatStockProfitLossDetailReportDate } from './stock-profit-loss-detail-report-date';
import {
  formatStockReportMoney,
  formatStockReportQuantity,
} from './stock-report-number-format';

defineOptions({ name: 'ErpStockProfitLossDetailTable' });

type ReportRow = ErpStockProfitLossDetailReportApi.Row;

const { hasAccessByCodes } = useAccess();
const canExport = computed(() => hasAccessByCodes(['erp:stock-check:export']));
const sourceDetailRef = ref<InstanceType<typeof SourceDetail>>();
const exporting = ref(false);
const currentRows = ref<ReportRow[]>([]);
const summary = ref<ErpStockProfitLossDetailReportApi.Summary>({});

const hiddenFields = computed(
  () =>
    new Set(
      summary.value.hiddenFields || currentRows.value[0]?.hiddenFields || [],
    ),
);
const priceVisible = computed(
  () =>
    summary.value.priceVisible !== false &&
    currentRows.value.every((row) => row.priceVisible !== false),
);

const sortFieldMap: Record<string, string> = {
  actualCount: 'actualCount',
  adjustedUnitPrice: 'adjustedUnitPrice',
  checkDate: 'checkDate',
  costUnitPrice: 'costUnitPrice',
  creatorName: 'creatorName',
  documentNo: 'documentNo',
  productCode: 'productCode',
  productName: 'productName',
  profitLossAmount: 'profitLossAmount',
  profitLossCount: 'profitLossCount',
  warehouseName: 'warehouseName',
};
const { buildSortParams, handleSortChange, restoreSortState } =
  createVxeHeaderSort(sortFieldMap);

function formSchema(): VbenFormSchema[] {
  return [
    {
      fieldName: 'documentNo',
      label: '单号',
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: '请输入盘点单号',
      },
    },
    {
      fieldName: 'checkDate',
      label: '日期',
      component: 'RangePicker',
      componentProps: {
        ...getRangePickerDefaultProps(),
        allowClear: true,
      },
    },
    {
      fieldName: 'checkType',
      label: '盘点类型',
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: [
          { label: '盘数量', value: 1 },
          { label: '盘成本', value: 2 },
        ],
        placeholder: '全部类型',
      },
    },
    {
      fieldName: 'creatorKeyword',
      label: '制单人',
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: '请输入制单人',
      },
    },
  ];
}

const textFormatter = ({ cellValue }: { cellValue: unknown }) =>
  cellValue === null || cellValue === undefined || cellValue === ''
    ? '-'
    : String(cellValue);
const quantityFormatter = ({ cellValue }: { cellValue: unknown }) => {
  return formatStockReportQuantity(cellValue, 3);
};
const moneyFormatter = ({ cellValue }: { cellValue: unknown }) => {
  if (!priceVisible.value) return '****';
  return formatStockReportMoney(cellValue);
};
const dateFormatter = ({ cellValue }: { cellValue: unknown }) =>
  formatStockProfitLossDetailReportDate(cellValue);

function columns(rows: ReportRow[] = currentRows.value) {
  const values: NonNullable<VxeTableGridOptions<ReportRow>['columns']> = [
    {
      field: 'checkTypeName',
      title: '盘点类型',
      width: 88,
      formatter: textFormatter,
    },
    {
      field: 'documentNo',
      title: '单号',
      sortable: true,
      slots: { default: 'documentNo' },
    },
    {
      field: 'checkDate',
      title: '日期',
      sortable: true,
      formatter: dateFormatter,
    },
    {
      field: 'productCode',
      title: '编码',
      sortable: true,
      formatter: textFormatter,
    },
    {
      field: 'productName',
      title: '名称',
      sortable: true,
      formatter: textFormatter,
    },
    {
      field: 'warehouseName',
      title: '仓库',
      sortable: true,
      formatter: textFormatter,
    },
    { field: 'shelf', title: '货架', formatter: textFormatter },
    {
      field: 'profitLossCount',
      title: '盈亏数',
      sortable: true,
      formatter: quantityFormatter,
    },
    {
      field: 'costUnitPrice',
      title: '成本单价',
      sortable: true,
      formatter: moneyFormatter,
    },
    {
      field: 'adjustedUnitPrice',
      title: '调整单价',
      sortable: true,
      formatter: moneyFormatter,
    },
    {
      field: 'actualCount',
      title: '实盘数',
      sortable: true,
      formatter: quantityFormatter,
    },
    {
      field: 'profitLossAmount',
      title: '盈亏额',
      sortable: true,
      formatter: moneyFormatter,
    },
    {
      field: 'creatorName',
      title: '制单人',
      sortable: true,
      formatter: textFormatter,
    },
    { field: 'vehicleModel', title: '车型', formatter: textFormatter },
    { field: 'reason', title: '原因', formatter: textFormatter },
    { field: 'originPlace', title: '产地', formatter: textFormatter },
    { field: 'standard', title: '规格', formatter: textFormatter },
    { field: 'drawingNo', title: '图号', formatter: textFormatter },
    { field: 'relatedNo', title: '关联单号', formatter: textFormatter },
    { field: 'itemRemark', title: '明细备注', formatter: textFormatter },
  ];
  return prepareSaleDocumentListColumns(
    values.filter((column) => !hiddenFields.value.has(String(column.field))),
    rows,
    {
      baseWidths: {
        checkDate: 160,
        documentNo: 156,
        itemRemark: 140,
        productName: 150,
        reason: 140,
        relatedNo: 140,
        standard: 112,
        vehicleModel: 128,
      },
    },
  );
}

function normalize(values: Record<string, any>) {
  const result: Record<string, any> = {};
  Object.entries(values || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) result[key] = trimmed;
      return;
    }
    if (!Array.isArray(value) || value.length > 0) result[key] = value;
  });
  return result;
}

function formatSummaryNumber(value: unknown, fractionDigits = 3) {
  return formatStockReportQuantity(value, fractionDigits);
}

function formatSummaryMoney(value: unknown) {
  if (!priceVisible.value) return '****';
  return formatStockReportMoney(value);
}

const summaryItems = computed(() => [
  {
    key: 'rowCount',
    label: '明细行',
    value: formatSummaryNumber(summary.value.rowCount, 0),
  },
  {
    key: 'profitLossCount',
    label: '盈亏数',
    value: formatSummaryNumber(summary.value.profitLossCount),
  },
  {
    key: 'profitLossAmount',
    label: '盈亏额',
    value: formatSummaryMoney(summary.value.profitLossAmount),
  },
]);

let requestId = 0;
const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    commonConfig: { labelWidth: 68 },
    schema: withErpKeywordSearchSchema(formSchema(), {
      placeholder: '请输入编码、名称、车型、规格或图号',
    }),
  },
  gridOptions: {
    columns: columns(),
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
    id: 'erp-stock-profit-loss-detail-list-v2',
    showHeaderOverflow: 'tooltip',
    showOverflow: 'tooltip',
    scrollX: { enabled: true, gt: 8 },
    scrollY: { enabled: true, gt: 10 },
    proxyConfig: {
      ajax: {
        query: async ({ page, sort, sorts }, formValues) => {
          const currentRequestId = ++requestId;
          const params = {
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            ...normalize(formValues),
            ...buildSortParams(sorts, sort),
          } as ErpStockProfitLossDetailReportApi.Query;
          const [pageResult, summaryResult] = await Promise.all([
            getStockProfitLossDetailPage(params),
            getStockProfitLossDetailSummary({
              ...params,
              pageNo: 1,
              pageSize: 20,
            }),
          ]);
          if (currentRequestId === requestId) {
            currentRows.value = pageResult.list || [];
            summary.value = summaryResult || {};
            await gridApi.grid?.reloadColumn?.(
              columns(currentRows.value) as any[],
            );
          }
          return pageResult;
        },
        querySuccess: () => void restoreSortState(gridApi),
      },
      sort: true,
    },
    rowConfig: { keyField: 'itemId', isHover: true },
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
  ) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  void gridApi.formApi.submitForm();
}

async function handleExport() {
  exporting.value = true;
  try {
    const data = await exportStockProfitLossDetail({
      ...normalize(await gridApi.formApi.getValues()),
      ...buildSortParams(),
    } as ErpStockProfitLossDetailReportApi.Query);
    downloadFileFromBlobPart({ fileName: '配件盈亏明细表.xlsx', source: data });
    message.success('导出成功');
  } finally {
    exporting.value = false;
  }
}

function openDocument(row: ReportRow) {
  const checkId = Number(row.checkId);
  if (!Number.isSafeInteger(checkId) || checkId <= 0) return;
  void sourceDetailRef.value?.open(40, checkId);
}
</script>

<template>
  <div class="stock-profit-loss-detail">
    <Grid
      class="stock-profit-loss-detail__grid"
      table-title="配件盈亏明细表"
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
        <button
          type="button"
          class="stock-profit-loss-detail__number-link"
          :title="row.documentNo || ''"
          @click.stop="openDocument(row)"
        >
          {{ row.documentNo || '-' }}
        </button>
      </template>
      <template #bottom>
        <div class="stock-profit-loss-detail__summary">
          <b>全条件合计：</b>
          <span v-for="item in summaryItems" :key="item.key">
            {{ item.label }}：<b>{{ item.value }}</b>
          </span>
        </div>
      </template>
    </Grid>
    <SourceDetail ref="sourceDetailRef" />
  </div>
</template>

<style scoped>
.stock-profit-loss-detail {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.stock-profit-loss-detail__grid {
  min-height: 0;
}

:deep(.stock-profit-loss-detail__grid .vxe-table--render-default),
:deep(.stock-profit-loss-detail__grid .vxe-grid--form-wrapper) {
  font-size: 12px;
}

@media (min-width: 1280px) {
  :deep(.stock-profit-loss-detail__grid .vxe-grid--form-wrapper form > .grid) {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}

:deep(.stock-profit-loss-detail__grid .vxe-grid--form-wrapper label),
:deep(.stock-profit-loss-detail__grid .vxe-grid--form-wrapper .ant-input),
:deep(.stock-profit-loss-detail__grid .vxe-grid--form-wrapper .ant-picker),
:deep(
  .stock-profit-loss-detail__grid
    .vxe-grid--form-wrapper
    .ant-picker-input
    > input
),
:deep(.stock-profit-loss-detail__grid .vxe-grid--form-wrapper .ant-select),
:deep(.stock-profit-loss-detail__grid .vxe-grid--form-wrapper .ant-btn),
:deep(.stock-profit-loss-detail__grid .vxe-grid--form-wrapper .vben-link) {
  font-size: 12px;
}

:deep(.stock-profit-loss-detail__grid .vxe-grid--form-wrapper label) {
  line-height: 20px;
}

:deep(
  .stock-profit-loss-detail__grid
    .vxe-grid--form-wrapper
    .ant-input-affix-wrapper
) {
  min-height: 28px;
  padding: 2px 8px;
  font-size: 12px;
}

:deep(
  .stock-profit-loss-detail__grid
    .vxe-grid--form-wrapper
    .ant-input-affix-wrapper
    .ant-input
) {
  line-height: 22px;
}

:deep(
  .stock-profit-loss-detail__grid .vxe-grid--form-wrapper .ant-select-single
) {
  height: 28px;
}

:deep(
  .stock-profit-loss-detail__grid
    .vxe-grid--form-wrapper
    .ant-select-single
    .ant-select-selector
) {
  height: 28px;
  padding: 0 8px;
  font-size: 12px;
}

:deep(
  .stock-profit-loss-detail__grid
    .vxe-grid--form-wrapper
    .ant-select-single
    .ant-select-selection-search-input
) {
  height: 26px;
}

:deep(
  .stock-profit-loss-detail__grid
    .vxe-grid--form-wrapper
    .ant-select-single
    .ant-select-selection-item
),
:deep(
  .stock-profit-loss-detail__grid
    .vxe-grid--form-wrapper
    .ant-select-single
    .ant-select-selection-placeholder
) {
  line-height: 26px;
}

:deep(.stock-profit-loss-detail__grid .vxe-grid--form-wrapper .ant-picker) {
  height: 28px;
  padding: 2px 8px;
}

:deep(.stock-profit-loss-detail__grid .vxe-grid--form-wrapper .ant-btn),
:deep(.stock-profit-loss-detail__grid .vxe-toolbar .table-actions .ant-btn) {
  height: 28px;
  padding: 2px 10px;
  font-size: 12px;
  line-height: 20px;
}

:deep(.stock-profit-loss-detail__grid .vxe-toolbar .vxe-tool--item-wrapper) {
  font-size: 12px;
}

:deep(.stock-profit-loss-detail__grid .vxe-toolbar .vxe-button) {
  box-sizing: border-box;
  width: 28px !important;
  min-width: 28px !important;
  height: 28px;
  padding: 0;
  font-size: 12px;
}

:deep(.stock-profit-loss-detail__grid .vxe-header--column .vxe-cell--title) {
  white-space: nowrap;
}

:deep(
  .stock-profit-loss-detail__grid
    .vxe-header--column.is--sortable
    .vxe-cell--title
) {
  color: #1677ff;
}

:deep(.stock-profit-loss-detail__grid .vxe-header--column .vxe-cell--sort) {
  display: none;
}

.stock-profit-loss-detail__number-link {
  display: block;
  max-width: 100%;
  padding: 0;
  color: hsl(var(--primary));
  font: inherit;
  white-space: nowrap;
  cursor: pointer;
  background: transparent;
  border: 0;
}

.stock-profit-loss-detail__number-link:hover,
.stock-profit-loss-detail__number-link:focus-visible {
  text-decoration: underline;
}

:deep(.stock-profit-loss-detail__grid .vxe-grid--bottom-wrapper) {
  position: sticky;
  z-index: 4;
  bottom: 36px;
  background: hsl(var(--card));
}

:deep(.stock-profit-loss-detail__grid .vxe-grid--pager-wrapper) {
  position: sticky;
  z-index: 5;
  bottom: 0;
  margin-top: 0 !important;
  background: hsl(var(--card));
  box-shadow: 0 -2px 8px rgb(0 0 0 / 8%);
}

.stock-profit-loss-detail__summary {
  display: flex;
  min-height: 40px;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 4px 20px;
  padding: 5px 8px;
  border-top: 1px solid hsl(var(--border));
  font-size: 12px;
  line-height: 18px;
}

.stock-profit-loss-detail__summary > b,
.stock-profit-loss-detail__summary span b {
  color: hsl(var(--foreground));
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
</style>
