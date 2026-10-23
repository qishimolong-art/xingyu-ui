<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpStockApi } from '#/api/erp/stock/stock';

import { computed, ref } from 'vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { getStockPage, getStockSummary } from '#/api/erp/stock/stock';
import { stockNatural } from '#/views/erp/stock/utils/stock-decimal';
import { withErpKeywordSearchSchema } from '#/views/erp/utils/form-defaults';
import { createVxeHeaderSort } from '#/views/erp/utils/vxe-header-sort';

import { useGridFormSchema as useStockGridFormSchema } from '../../stock/data';
import StockQuantitySourceReadonlyModal from './stock-quantity-source-readonly-modal.vue';
import { formatStockReportQuantity } from './stock-report-number-format';

const realtimeStockSortFieldMap: Record<string, string> = {
  warehouseName: 'warehouseId',
  deptName: 'deptId',
  productName: 'productName',
  unitName: 'unitName',
  categoryName: 'categoryName',
  count: 'count',
  availableCount: 'availableCount',
  occupiedCount: 'occupiedCount',
  pendingInCount: 'pendingInCount',
  inTransitCount: 'inTransitCount',
  batchNoSummary: 'batchNo',
  productCode: 'productCode',
  drawingNo: 'drawingNo',
  standard: 'standard',
  featureCode: 'featureCode',
  vehicleModel: 'vehicleModel',
  brand: 'brand',
  originPlace: 'originPlace',
  shelf: 'shelf',
};

const realtimeStockFormFields = new Set([
  'barCode',
  'brand',
  'categoryId',
  'countFilter',
  'countMax',
  'countMin',
  'deptId',
  'drawingNo',
  'factoryCode',
  'featureCode',
  'oeNumber',
  'originPlace',
  'positiveCountOnly',
  'productCode',
  'productKeyword',
  'productName',
  'productStatus',
  'shelf',
  'standard',
  'vehicleModel',
  'warehouseId',
]);

const realtimeStockColumns: VxeTableGridOptions<ErpStockApi.Stock>['columns'] =
  [
    { type: 'seq', title: '序号', width: 54 },
    { field: 'warehouseName', title: '仓库', width: 112, sortable: true },
    { field: 'deptName', title: '所属部门', width: 104, sortable: true },
    { field: 'productCode', title: '编码', width: 112, sortable: true },
    { field: 'productName', title: '配件名称', minWidth: 160, sortable: true },
    { field: 'unitName', title: '单位', width: 72, sortable: true },
    { field: 'categoryName', title: '分类', width: 104, sortable: true },
    {
      field: 'count',
      title: '现存数',
      width: 92,
      sortable: true,
      formatter: ({ cellValue }: any) => stockNatural(cellValue),
    },
    {
      field: 'availableCount',
      title: '可用数',
      width: 92,
      sortable: true,
      formatter: ({ cellValue }: any) => stockNatural(cellValue),
    },
    {
      field: 'occupiedCount',
      title: '销售/出库占用',
      width: 118,
      sortable: true,
      formatter: ({ cellValue }: any) => stockNatural(cellValue),
      slots: { default: 'occupiedCount' },
    },
    {
      field: 'pendingInCount',
      title: '采购/退货未入',
      width: 118,
      sortable: true,
      formatter: ({ cellValue }: any) => stockNatural(cellValue),
      slots: { default: 'pendingInCount' },
    },
    {
      field: 'inTransitCount',
      title: '采购在途',
      width: 96,
      sortable: true,
      formatter: ({ cellValue }: any) => stockNatural(cellValue),
      slots: { default: 'inTransitCount' },
    },
    { field: 'batchNoSummary', title: '批次概况', width: 136, sortable: true },
    { field: 'drawingNo', title: '图号', width: 96, sortable: true },
    { field: 'vehicleModel', title: '适用车型', width: 120, sortable: true },
    { field: 'brand', title: '品牌', width: 88, sortable: true },
    { field: 'shelf', title: '货架', width: 88, sortable: true },
  ];

const stockSummary = ref<ErpStockApi.StockSummary>({});
let stockSummaryRequestId = 0;
const sourceModalRef =
  ref<InstanceType<typeof StockQuantitySourceReadonlyModal>>();

const { buildSortParams, handleSortChange, restoreSortState } =
  createVxeHeaderSort(realtimeStockSortFieldMap);

function useRealtimeStockFormSchema() {
  return useStockGridFormSchema().filter((schema) =>
    realtimeStockFormFields.has(String(schema.fieldName)),
  );
}

function formatRows(value?: number) {
  return `${Number(value ?? 0).toFixed(0)}`;
}

async function refreshStockSummary(params: ErpStockApi.StockPageReqVO) {
  const requestId = ++stockSummaryRequestId;
  const summaryResult = await getStockSummary({
    ...params,
    decimalMode: 'string',
  });
  if (requestId !== stockSummaryRequestId) return;
  stockSummary.value = summaryResult || {};
}

const summaryItems = computed(() => [
  { label: '库存行数', value: formatRows(stockSummary.value.totalRows) },
  {
    label: '现存数',
    value: formatStockReportQuantity(
      stockSummary.value.totalStockCount ?? 0,
      3,
    ),
  },
  {
    label: '占用数',
    value: formatStockReportQuantity(
      stockSummary.value.totalOccupiedCount ?? 0,
      3,
    ),
  },
  {
    label: '未入数',
    value: formatStockReportQuantity(
      stockSummary.value.totalPendingInCount ?? 0,
      3,
    ),
  },
  {
    label: '采购在途',
    value: formatStockReportQuantity(
      stockSummary.value.totalInTransitCount ?? 0,
      3,
    ),
  },
]);

function formatQuantity(value?: number) {
  return formatStockReportQuantity(value ?? 0, 3);
}

function showSourceDetail(
  type: 'inTransit' | 'occupied' | 'pendingIn',
  row: ErpStockApi.Stock,
) {
  sourceModalRef.value?.show(type, row);
}

function handleSearchEnter(event: KeyboardEvent) {
  if (event.isComposing) return;
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (target.closest('.ant-picker, .ant-select')) return;
  event.preventDefault();
  event.stopPropagation();
  void gridApi.formApi.submitForm();
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    commonConfig: { labelWidth: 84 },
    schema: withErpKeywordSearchSchema(useRealtimeStockFormSchema()),
    collapsed: true,
    collapsedRows: 1,
  },
  gridOptions: {
    columns: realtimeStockColumns,
    customConfig: {
      storage: {
        fixed: true,
        resizable: true,
        sort: true,
        visible: true,
      },
    },
    height: 'auto',
    id: 'erp-business-report-realtime-stock-list-v1',
    keepSource: true,
    showHeaderOverflow: 'tooltip',
    showOverflow: 'tooltip',
    scrollX: { enabled: true, gt: 8 },
    scrollY: { enabled: true, gt: 10 },
    proxyConfig: {
      ajax: {
        query: async ({ page, sort, sorts }, formValues) => {
          const queryParams = {
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
            ...buildSortParams(sorts, sort),
          };
          void refreshStockSummary(queryParams);
          return getStockPage({ ...queryParams, decimalMode: 'string' });
        },
        querySuccess: () => void restoreSortState(gridApi),
      },
      sort: true,
    },
    sortConfig: {
      remote: true,
      multiple: false,
      trigger: 'cell',
      orders: ['asc', 'desc', null],
      allowBtn: false,
    },
    rowConfig: { keyField: 'rowKey', isHover: true, isCurrent: true },
    toolbarConfig: { refresh: true, search: true, custom: true },
  } as VxeTableGridOptions<ErpStockApi.Stock>,
  gridEvents: { sortChange: handleSortChange },
});
</script>

<template>
  <div class="stock-realtime-report">
    <Grid
      class="stock-realtime-report__grid"
      table-title="实时库存"
      @keydown.enter.capture="handleSearchEnter"
    >
      <template #occupiedCount="{ row }">
        <a
          class="text-primary cursor-pointer font-medium"
          @click.stop="showSourceDetail('occupied', row)"
        >
          {{ formatQuantity(row.occupiedCount) }}
        </a>
      </template>
      <template #pendingInCount="{ row }">
        <a
          class="text-primary cursor-pointer font-medium"
          @click.stop="showSourceDetail('pendingIn', row)"
        >
          {{ formatQuantity(row.pendingInCount) }}
        </a>
      </template>
      <template #inTransitCount="{ row }">
        <a
          class="text-primary cursor-pointer font-medium"
          @click.stop="showSourceDetail('inTransit', row)"
        >
          {{ formatQuantity(row.inTransitCount) }}
        </a>
      </template>
      <template #bottom>
        <div class="stock-realtime-report__summary">
          <b>全部合计：</b>
          <span
            v-for="item in summaryItems"
            :key="item.label"
            class="stock-realtime-report__summary-item"
          >
            {{ item.label }}：<b>{{ item.value }}</b>
          </span>
        </div>
      </template>
    </Grid>
    <StockQuantitySourceReadonlyModal ref="sourceModalRef" />
  </div>
</template>

<style scoped>
.stock-realtime-report {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.stock-realtime-report__grid {
  min-height: 0;
}

.stock-realtime-report__summary {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  align-items: center;
  justify-content: flex-end;
  min-height: 40px;
  padding: 5px 8px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  line-height: 18px;
  border-top: 1px solid hsl(var(--border));
}

.stock-realtime-report__summary > b,
.stock-realtime-report__summary-item b {
  color: hsl(var(--foreground));
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

:deep(.stock-realtime-report__grid .vxe-table--render-default),
:deep(.stock-realtime-report__grid .vxe-grid--form-wrapper) {
  font-size: 12px;
}

:deep(.stock-realtime-report__grid .vxe-grid--form-wrapper form > .grid) {
  grid-template-columns: repeat(5, minmax(0, 1fr));
}

:deep(.stock-realtime-report__grid .vxe-grid--form-wrapper label),
:deep(.stock-realtime-report__grid .vxe-grid--form-wrapper .ant-input),
:deep(.stock-realtime-report__grid .vxe-grid--form-wrapper .ant-input-number),
:deep(
  .stock-realtime-report__grid .vxe-grid--form-wrapper .ant-input-number-input
),
:deep(.stock-realtime-report__grid .vxe-grid--form-wrapper .ant-select),
:deep(
  .stock-realtime-report__grid .vxe-grid--form-wrapper .ant-checkbox-wrapper
),
:deep(.stock-realtime-report__grid .vxe-grid--form-wrapper .ant-btn),
:deep(.stock-realtime-report__grid .vxe-grid--form-wrapper .vben-link) {
  font-size: 12px;
}

:deep(
  .stock-realtime-report__grid .vxe-grid--form-wrapper .ant-input-affix-wrapper
) {
  min-height: 28px;
  padding: 2px 8px;
}

:deep(.stock-realtime-report__grid .vxe-grid--form-wrapper .ant-select-single),
:deep(.stock-realtime-report__grid .vxe-grid--form-wrapper .ant-picker),
:deep(.stock-realtime-report__grid .vxe-grid--form-wrapper .ant-input-number) {
  height: 28px;
}

:deep(
  .stock-realtime-report__grid
    .vxe-grid--form-wrapper
    .ant-select-single
    .ant-select-selector
) {
  height: 28px;
  padding: 0 8px;
}

:deep(.stock-realtime-report__grid .vxe-grid--bottom-wrapper) {
  position: sticky;
  bottom: 36px;
  z-index: 4;
  background: hsl(var(--card));
}

:deep(.stock-realtime-report__grid .vxe-grid--pager-wrapper) {
  position: sticky;
  bottom: 0;
  z-index: 5;
  margin-top: 0 !important;
  background: hsl(var(--card));
  box-shadow: 0 -2px 8px rgb(0 0 0 / 8%);
}

@media (max-width: 1280px) {
  :deep(.stock-realtime-report__grid .vxe-grid--form-wrapper form > .grid) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
