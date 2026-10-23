<script setup lang="ts">
import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpStockAgeReportApi } from '#/api/erp/report/stock-age';

import { computed, ref } from 'vue';

import { useAccess } from '@vben/access';
import { downloadFileFromBlobPart, formatDateTime } from '@vben/utils';

import { Alert, message, Tag } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import { getProductCategorySimpleList } from '#/api/erp/product/category';
import {
  exportStockAgeReport,
  getStockAgeReportPage,
  getStockAgeReportSummary,
} from '#/api/erp/report/stock-age';
import {
  getStockWarehouseFilterOptionPage,
  getWarehouseDeptSimplePage,
} from '#/api/erp/stock/warehouse';
import { prepareSaleDocumentListColumns } from '#/views/erp/sale/utils/document-list-table';
import { stockNaturalGrouped as stockNatural } from '#/views/erp/stock/utils/stock-decimal';
import { createVxeHeaderSort } from '#/views/erp/utils/vxe-header-sort';

defineOptions({ name: 'ErpStockAgeTable' });

type ReportRow = ErpStockAgeReportApi.Row;
type ReportColumn = NonNullable<
  VxeTableGridOptions<ReportRow>['columns']
>[number];

const ageBucketOptions = [
  { label: '1月以内（0～30天）', value: 'WITHIN_1_MONTH' },
  { label: '2～3月（31～90天）', value: 'MONTHS_2_TO_3' },
  { label: '4～6月（91～180天）', value: 'MONTHS_4_TO_6' },
  { label: '7～12月（181～365天）', value: 'MONTHS_7_TO_12' },
  { label: '1～2年（366～730天）', value: 'YEARS_1_TO_2' },
  { label: '2～3年（731～1095天）', value: 'YEARS_2_TO_3' },
  { label: '3年以上（1096天以上）', value: 'OVER_3_YEARS' },
  { label: '无法计算', value: 'UNCLASSIFIED' },
];
const outboundStateOptions = [
  { label: '从未出库', value: 'NEVER_OUT' },
  { label: '有出库', value: 'HAS_OUT' },
];
const bucketDefinitions = [
  {
    amount: 'within1MonthAmount',
    label: '1月以内',
    quantity: 'within1MonthQuantity',
  },
  {
    amount: 'months2To3Amount',
    label: '2～3月',
    quantity: 'months2To3Quantity',
  },
  {
    amount: 'months4To6Amount',
    label: '4～6月',
    quantity: 'months4To6Quantity',
  },
  {
    amount: 'months7To12Amount',
    label: '7～12月',
    quantity: 'months7To12Quantity',
  },
  {
    amount: 'years1To2Amount',
    label: '1～2年',
    quantity: 'years1To2Quantity',
  },
  {
    amount: 'years2To3Amount',
    label: '2～3年',
    quantity: 'years2To3Quantity',
  },
  {
    amount: 'over3YearsAmount',
    label: '3年以上',
    quantity: 'over3YearsQuantity',
  },
] as const;

const sortFieldMap: Record<string, string> = {
  ageDays: 'ageDays',
  brand: 'brand',
  categoryName: 'categoryName',
  costAmount: 'costAmount',
  costUnitPrice: 'costUnitPrice',
  lastInboundTime: 'lastInboundTime',
  lastOutboundTime: 'lastOutboundTime',
  productCode: 'productCode',
  productName: 'productName',
  stockQuantity: 'stockQuantity',
  warehouseName: 'warehouseName',
};
const { buildSortParams, handleSortChange, restoreSortState } =
  createVxeHeaderSort(sortFieldMap);

const { hasAccessByCodes } = useAccess();
const canExport = computed(() => hasAccessByCodes(['erp:stock-record:export']));
const currentRows = ref<ReportRow[]>([]);
const summary = ref<ErpStockAgeReportApi.Summary>({});
const exporting = ref(false);
const loadError = ref(false);
const amountVisible = computed(
  () =>
    summary.value.amountVisible ?? currentRows.value[0]?.amountVisible ?? true,
);

function formSchema(): VbenFormSchema[] {
  return [
    {
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: '编码、名称、规格、车型等',
      },
      fieldName: 'keyword',
      label: '关键词',
    },
    {
      component: 'ErpLazyPageSelect',
      componentProps: {
        allowClear: true,
        api: getWarehouseDeptSimplePage,
        labelField: 'name',
        onChange: () => {
          void gridApi.formApi.setFieldValue('warehouseId', undefined);
        },
        pageSize: 10,
        placeholder: '请选择所属部门',
        popupClassName: 'stock-age-report-select-dropdown',
        showSearch: true,
        valueField: 'id',
      },
      fieldName: 'deptId',
      label: '所属部门',
    },
    {
      component: 'ErpLazyPageSelect',
      componentProps: (values: Record<string, any>) => ({
        allowClear: true,
        api: (params: any) =>
          getStockWarehouseFilterOptionPage({
            ...params,
            deptId: values.deptId,
          }),
        labelField: 'displayName',
        pageSize: 10,
        placeholder: '请选择仓库',
        popupClassName: 'stock-age-report-select-dropdown',
        showSearch: true,
        valueField: 'id',
      }),
      dependencies: { triggerFields: ['deptId'] },
      fieldName: 'warehouseId',
      label: '仓库',
    },
    {
      component: 'ApiSelect',
      componentProps: {
        allowClear: true,
        api: getProductCategorySimpleList,
        labelField: 'name',
        placeholder: '请选择类别',
        popupClassName: 'stock-age-report-select-dropdown',
        showSearch: true,
        valueField: 'id',
      },
      fieldName: 'categoryId',
      label: '类别',
    },
    {
      component: 'Input',
      componentProps: { allowClear: true, placeholder: '请输入品牌' },
      fieldName: 'brand',
      label: '品牌',
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: ageBucketOptions,
        placeholder: '全部区间',
      },
      fieldName: 'ageBucket',
      label: '库龄区间',
    },
    {
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: outboundStateOptions,
        placeholder: '全部状态',
      },
      fieldName: 'outboundState',
      label: '出库状态',
    },
  ];
}

function formatQuantity(value: unknown, _precision?: number) {
  return stockNatural(value as null | number | string | undefined);
}

function formatMoney(value: unknown, _precision?: number) {
  return stockNatural(value as null | number | string | undefined);
}

const textFormatter = ({ cellValue }: { cellValue: unknown }) =>
  cellValue === null || cellValue === undefined || cellValue === ''
    ? '-'
    : String(cellValue);
const quantityFormatter = ({ cellValue }: { cellValue: unknown }) =>
  formatQuantity(cellValue);
const moneyFormatter = ({ cellValue }: { cellValue: unknown }) =>
  formatMoney(cellValue);
const dateTimeFormatter = ({ cellValue }: { cellValue: unknown }) =>
  cellValue ? formatDateTime(cellValue as string) || String(cellValue) : '-';

function prepareLeafColumns(columns: ReportColumn[], rows: ReportRow[]) {
  return prepareSaleDocumentListColumns(columns, rows, {
    baseWidths: {
      agingBasis: 112,
      brand: 96,
      categoryName: 108,
      costAmount: 112,
      costUnitPrice: 112,
      deptName: 120,
      drawingNo: 108,
      featureCode: 108,
      lastInboundTime: 160,
      lastOutboundTime: 160,
      lastWarehouseMoveInboundTime: 174,
      originPlace: 88,
      productCode: 124,
      productName: 164,
      standard: 112,
      stockQuantity: 96,
      vehicleModel: 128,
      warehouseName: 116,
    },
  });
}

function columns(
  rows: ReportRow[] = currentRows.value,
): VxeTableGridOptions<ReportRow>['columns'] {
  const leadingColumns: ReportColumn[] = [
    { title: '序', type: 'seq', width: 52 },
    {
      field: 'warehouseName',
      formatter: textFormatter,
      sortable: true,
      title: '仓库',
    },
    {
      field: 'productCode',
      formatter: textFormatter,
      sortable: true,
      title: '编码',
    },
    {
      field: 'productName',
      formatter: textFormatter,
      sortable: true,
      title: '配件名称',
    },
    {
      align: 'right',
      field: 'stockQuantity',
      formatter: quantityFormatter,
      sortable: true,
      title: '库存数量',
    },
  ];
  if (amountVisible.value) {
    leadingColumns.push(
      {
        align: 'right',
        field: 'costUnitPrice',
        formatter: moneyFormatter,
        sortable: true,
        title: '库存成本单价',
      },
      {
        align: 'right',
        field: 'costAmount',
        formatter: moneyFormatter,
        sortable: true,
        title: '库存金额',
      },
    );
  }

  const bucketColumns = bucketDefinitions.map((bucket) => {
    const children: ReportColumn[] = [
      {
        align: 'right',
        field: bucket.quantity,
        formatter: quantityFormatter,
        title: '数量',
      },
    ];
    if (amountVisible.value) {
      children.push({
        align: 'right',
        field: bucket.amount,
        formatter: moneyFormatter,
        title: '金额',
      });
    }
    return {
      children: prepareLeafColumns(children, rows),
      title: bucket.label,
    } as ReportColumn;
  });

  const trailingColumns: ReportColumn[] = [
    {
      field: 'lastInboundTime',
      formatter: dateTimeFormatter,
      sortable: true,
      title: '最后一次入库时间',
    },
    {
      field: 'lastWarehouseMoveInboundTime',
      formatter: dateTimeFormatter,
      title: '最后一次移仓入库时间',
    },
    {
      field: 'lastOutboundTime',
      formatter: dateTimeFormatter,
      sortable: true,
      title: '最后一次出库时间',
    },
    {
      align: 'right',
      field: 'ageDays',
      formatter: quantityFormatter,
      sortable: true,
      title: '库龄天数',
    },
    {
      field: 'agingBasis',
      slots: { default: 'agingBasis' },
      title: '计算依据',
    },
    { field: 'standard', formatter: textFormatter, title: '规格' },
    { field: 'vehicleModel', formatter: textFormatter, title: '车型' },
    { field: 'drawingNo', formatter: textFormatter, title: '图号' },
    { field: 'originPlace', formatter: textFormatter, title: '产地' },
    {
      field: 'categoryName',
      formatter: textFormatter,
      sortable: true,
      title: '类别',
    },
    { field: 'featureCode', formatter: textFormatter, title: '特征码' },
    {
      field: 'brand',
      formatter: textFormatter,
      sortable: true,
      title: '品牌',
    },
    { field: 'deptName', formatter: textFormatter, title: '所属部门' },
  ];

  return [
    ...prepareLeafColumns(leadingColumns, rows),
    ...bucketColumns,
    ...prepareLeafColumns(trailingColumns, rows),
  ];
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

const summaryItems = computed(() => {
  const items = [
    {
      key: 'rowCount',
      label: '库存行数',
      value: Number(summary.value.rowCount || 0).toLocaleString('zh-CN'),
    },
    {
      key: 'totalQuantity',
      label: '库存数量',
      value: formatQuantity(summary.value.totalQuantity),
    },
  ];
  if (amountVisible.value) {
    items.push({
      key: 'totalAmount',
      label: '库存金额',
      value: formatMoney(summary.value.totalAmount),
    });
  }
  for (const bucket of bucketDefinitions) {
    const quantity = formatQuantity(summary.value[bucket.quantity]);
    const amount = amountVisible.value
      ? ` / ${formatMoney(summary.value[bucket.amount])}`
      : '';
    items.push({
      key: bucket.quantity,
      label: bucket.label,
      value: `${quantity}${amount}`,
    });
  }
  const unclassifiedAmount = amountVisible.value
    ? ` / ${formatMoney(summary.value.unclassifiedAmount)}`
    : '';
  items.push({
    key: 'unclassified',
    label: '无法计算',
    value: `${Number(summary.value.unclassifiedRowCount || 0)} 行 / ${formatQuantity(summary.value.unclassifiedQuantity)}${unclassifiedAmount}`,
  });
  return items;
});

let requestId = 0;
const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    collapsed: true,
    collapsedRows: 1,
    commonConfig: { labelWidth: 76 },
    schema: formSchema(),
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
    id: 'erp-stock-age-report-list-v2',
    pagerConfig: { pageSize: 10, pageSizes: [10, 20, 50, 100] },
    proxyConfig: {
      ajax: {
        query: async ({ page, sort, sorts }, formValues) => {
          const currentRequestId = ++requestId;
          loadError.value = false;
          const params = {
            ...normalize(formValues),
            ...buildSortParams(sorts, sort),
            pageNo: page.currentPage,
            pageSize: page.pageSize,
          } as ErpStockAgeReportApi.Query;
          try {
            const [pageResult, summaryResult] = await Promise.all([
              getStockAgeReportPage(params),
              getStockAgeReportSummary({
                ...params,
                pageNo: 1,
                pageSize: 10,
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
          } catch (error) {
            if (currentRequestId === requestId) {
              loadError.value = true;
              currentRows.value = [];
              message.error('库龄报表加载失败，请稍后重试');
            }
            throw error;
          }
        },
        querySuccess: () => void restoreSortState(gridApi),
      },
      sort: true,
    },
    rowConfig: { isCurrent: true, isHover: true, keyField: 'stockId' },
    scrollX: { enabled: true, gt: 8 },
    scrollY: { enabled: true, gt: 10 },
    seqConfig: {
      seqMethod: ({ rowIndex }) => {
        const pager = gridApi.grid?.getProxyInfo?.()?.pager;
        const currentPage = Number(pager?.currentPage || 1);
        const currentPageSize = Number(pager?.pageSize || 10);
        return (currentPage - 1) * currentPageSize + rowIndex + 1;
      },
    },
    showHeaderOverflow: 'tooltip',
    showOverflow: 'tooltip',
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
    const data = await exportStockAgeReport({
      ...normalize(await gridApi.formApi.getValues()),
      ...buildSortParams(),
    } as ErpStockAgeReportApi.Query);
    downloadFileFromBlobPart({
      fileName: '库龄及长期未出库辅助报表.xlsx',
      source: data,
    });
    message.success('导出成功');
  } catch (error) {
    console.error('Failed to export stock age report:', error);
    message.error('库龄报表导出失败，请稍后重试');
  } finally {
    exporting.value = false;
  }
}
</script>

<template>
  <div class="stock-age-report">
    <Alert
      class="stock-age-report__rule"
      message="按最后有效出库时间计算；从未出库按最后入库时间计算；每行库存仅进入一个区间，非批次 FIFO 库龄。"
      show-icon
      type="warning"
    />
    <Alert
      v-if="loadError"
      class="stock-age-report__error"
      message="库龄报表加载失败，请检查网络或查询条件后重试。"
      show-icon
      type="error"
    />
    <Grid
      class="stock-age-report__grid"
      table-title="库龄分析"
      @keydown.enter.capture="handleSearchEnter"
    >
      <template #toolbar-tools>
        <TableAction
          v-if="canExport"
          :actions="[
            {
              icon: ACTION_ICON.DOWNLOAD,
              label: '导出',
              loading: exporting,
              onClick: handleExport,
              type: 'primary',
            },
          ]"
        />
      </template>
      <template #agingBasis="{ row }">
        <Tag
          :color="
            row.ageDays === undefined || row.ageDays === null
              ? 'warning'
              : 'blue'
          "
        >
          {{ row.agingBasis || '无法计算' }}
        </Tag>
      </template>
      <template #bottom>
        <div class="stock-age-report__summary">
          <b>全条件合计：</b>
          <span v-for="item in summaryItems" :key="item.key">
            {{ item.label }}：<b>{{ item.value }}</b>
          </span>
        </div>
      </template>
    </Grid>
  </div>
</template>

<style scoped>
.stock-age-report {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.stock-age-report__rule,
.stock-age-report__error {
  flex: 0 0 auto;
  margin-bottom: 8px;
  padding-block: 5px;
}

.stock-age-report__grid {
  min-height: 0;
}

:deep(.stock-age-report__grid .vxe-table--render-default),
:deep(.stock-age-report__grid .vxe-grid--form-wrapper) {
  font-size: 12px;
}

@media (min-width: 1280px) {
  :deep(.stock-age-report__grid .vxe-grid--form-wrapper form > .grid) {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}

:deep(.stock-age-report__grid .vxe-grid--form-wrapper label),
:deep(.stock-age-report__grid .vxe-grid--form-wrapper .ant-input),
:deep(.stock-age-report__grid .vxe-grid--form-wrapper .ant-select),
:deep(.stock-age-report__grid .vxe-grid--form-wrapper .ant-btn),
:deep(.stock-age-report__grid .vxe-grid--form-wrapper .vben-link) {
  font-size: 12px;
}

:deep(.stock-age-report__grid .vxe-grid--form-wrapper .ant-input::placeholder),
:deep(
  .stock-age-report__grid
    .vxe-grid--form-wrapper
    .ant-select-selection-placeholder
),
:deep(
  .stock-age-report__grid
    .vxe-grid--form-wrapper
    .ant-select-selection-search-input::placeholder
),
:deep(
  .stock-age-report__grid
    .vxe-grid--form-wrapper
    .ant-picker-input
    > input::placeholder
) {
  font-size: 12px;
}

:deep(
  .stock-age-report__grid .vxe-grid--form-wrapper .ant-input-affix-wrapper
) {
  min-height: 28px;
  padding: 2px 8px;
}

:deep(.stock-age-report__grid .vxe-grid--form-wrapper .ant-select-single) {
  height: 28px;
}

:deep(
  .stock-age-report__grid
    .vxe-grid--form-wrapper
    .ant-select-single
    .ant-select-selector
) {
  height: 28px;
  padding: 0 8px;
}

:deep(.stock-age-report__grid .vxe-grid--form-wrapper .ant-btn),
:deep(.stock-age-report__grid .vxe-toolbar .table-actions .ant-btn) {
  height: 28px;
  padding: 2px 10px;
  font-size: 12px;
  line-height: 20px;
}

:deep(.stock-age-report__grid .vxe-toolbar .vxe-button) {
  box-sizing: border-box;
  width: 28px !important;
  min-width: 28px !important;
  height: 28px;
  padding: 0;
  font-size: 12px;
}

:deep(.stock-age-report__grid .vxe-header--column .vxe-cell--title) {
  white-space: nowrap;
}

:deep(
  .stock-age-report__grid .vxe-header--column.is--sortable .vxe-cell--title
) {
  color: #1677ff;
}

:deep(.stock-age-report__grid .vxe-header--column .vxe-cell--sort) {
  display: none;
}

:deep(.stock-age-report__grid .vxe-grid--bottom-wrapper) {
  position: sticky;
  z-index: 4;
  bottom: 36px;
  background: hsl(var(--card));
}

:deep(.stock-age-report__grid .vxe-grid--pager-wrapper) {
  position: sticky;
  z-index: 5;
  bottom: 0;
  margin-top: 0 !important;
  background: hsl(var(--card));
  box-shadow: 0 -2px 8px rgb(0 0 0 / 8%);
}

.stock-age-report__summary {
  display: flex;
  min-height: 40px;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 4px 18px;
  padding: 5px 8px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  line-height: 18px;
  border-top: 1px solid hsl(var(--border));
}

.stock-age-report__summary > b,
.stock-age-report__summary span b {
  color: hsl(var(--foreground));
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

:global(.stock-age-report-select-dropdown .ant-select-item),
:global(.stock-age-report-select-dropdown .ant-empty-description) {
  font-size: 12px;
}
</style>
