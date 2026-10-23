<script setup lang="ts">
import { formatPurchaseAmount } from "#/views/erp/purchase/utils/decimal";
import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpPurchaseOrderDetailReportApi } from '#/api/erp/report/purchase-order-detail';

import { computed, ref } from 'vue';

import { downloadFileFromBlobPart } from '@vben/utils';

import { message } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import { getPurchaseOrderUserSimplePage } from '#/api/erp/purchase/order';
import { getSupplierSimplePage } from '#/api/erp/purchase/supplier';
import {
  exportPurchaseOrderDetailReport,
  getPurchaseOrderDetailReportPage,
  getPurchaseOrderDetailReportSummary,
} from '#/api/erp/report/purchase-order-detail';
import { getPurchaseWarehouseSimplePage } from '#/api/erp/stock/warehouse';
import { getRangePickerDefaultProps } from '#/utils';
import { preparePurchaseDocumentListColumns } from '#/views/erp/purchase/utils/document-list-table';
import ReportDocumentDetailModal from '#/views/erp/report/components/report-document-detail-modal.vue';
import ReportDocumentLink from '#/views/erp/report/components/report-document-link.vue';
import { REPORT_DOCUMENT_TYPES } from '#/views/erp/report/components/report-document-detail';
import { createVxeHeaderSort } from '#/views/erp/utils/vxe-header-sort';

defineOptions({ name: 'ErpPurchaseOrderDetailReportTable' });

type ReportRow = ErpPurchaseOrderDetailReportApi.Row;

const summary = ref<ErpPurchaseOrderDetailReportApi.Summary>({});
const currentRows = ref<ReportRow[]>([]);
const exporting = ref(false);
const documentDetailModalRef =
  ref<InstanceType<typeof ReportDocumentDetailModal>>();

const priceVisible = computed(
  () =>
    summary.value.priceVisible !== false &&
    currentRows.value.every((row) => row.priceVisible !== false),
);

const sortFieldMap: Record<string, string> = {
  count: 'count',
  factoryOrderNo: 'factoryOrderNo',
  orderDate: 'orderDate',
  orderInTransitCount: 'orderInTransitCount',
  orderNo: 'orderNo',
  productCode: 'productCode',
  productName: 'productName',
  productPrice: 'productPrice',
  supplierName: 'supplierName',
  totalPrice: 'totalPrice',
  warehouseName: 'warehouseName',
};
const { buildSortParams, handleSortChange, restoreSortState } =
  createVxeHeaderSort(sortFieldMap);

function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      fieldName: 'keyword',
      label: '关键词',
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: '编码/名称/厂家编码/图号/特征码',
      },
    },
    {
      fieldName: 'orderDate',
      label: '订货日期',
      component: 'RangePicker',
      componentProps: {
        ...getRangePickerDefaultProps(),
        allowClear: true,
      },
    },
    {
      fieldName: 'orderNo',
      label: '单号',
      component: 'Input',
      componentProps: { allowClear: true, placeholder: '请输入采购订单号' },
    },
    {
      fieldName: 'factoryOrderNo',
      label: '厂家单号',
      component: 'Input',
      componentProps: { allowClear: true, placeholder: '请输入厂家单号' },
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
        popupClassName: 'purchase-order-detail-search-select-dropdown',
        showSearch: true,
        valueField: 'id',
      },
    },
    {
      fieldName: 'purchaserId',
      label: '采购员',
      component: 'ErpLazyPageSelect',
      componentProps: {
        allowClear: true,
        api: getPurchaseOrderUserSimplePage,
        labelField: 'nickname',
        loadErrorMessage: '采购员列表加载失败，请重试',
        pageSize: 10,
        placeholder: '请选择采购员',
        popupClassName: 'purchase-order-detail-search-select-dropdown',
        showSearch: true,
        valueField: 'id',
      },
    },
    {
      fieldName: 'warehouseId',
      label: '仓库',
      component: 'ErpLazyPageSelect',
      componentProps: {
        allowClear: true,
        api: getPurchaseWarehouseSimplePage,
        labelField: 'name',
        loadErrorMessage: '仓库列表加载失败，请重试',
        pageSize: 10,
        placeholder: '请选择仓库',
        popupClassName: 'purchase-order-detail-search-select-dropdown',
        showSearch: true,
        valueField: 'id',
      },
    },
  ];
}

function formatNumber(value: unknown, fractionDigits = 6) {
  if (value === null || value === undefined || value === '') return '-';
  const number = Number(value);
  if (!Number.isFinite(number)) return '-';
  return number.toLocaleString('zh-CN', {
    maximumFractionDigits: fractionDigits,
  });
}

function formatMoney(value: unknown) {
  return formatPurchaseAmount(value, '-');
}

const quantityFormatter = ({ cellValue }: { cellValue: unknown }) =>
  formatNumber(cellValue);
const moneyFormatter = ({ cellValue }: { cellValue: unknown }) =>
  formatMoney(cellValue);

function useGridColumns(
  showPrice = true,
  rows: ReportRow[] = currentRows.value,
): VxeTableGridOptions<ReportRow>['columns'] {
  const columns: NonNullable<VxeTableGridOptions<ReportRow>['columns']> = [
    {
      field: 'orderDate',
      title: '订货日期',
      width: 150,
      sortable: true,
      formatter: 'formatDateTime',
    },
    {
      field: 'orderNo',
      title: '单号',
      width: 160,
      sortable: true,
      slots: { default: 'orderNo' },
    },
    { field: 'productCode', title: '零件编码', width: 120, sortable: true },
    {
      field: 'productName',
      title: '零件名称',
      minWidth: 160,
      sortable: true,
      showOverflow: 'tooltip',
    },
    { field: 'factoryOrderNo', title: '厂家单号', width: 140, sortable: true },
    {
      field: 'supplierName',
      title: '供应商',
      minWidth: 170,
      sortable: true,
      showOverflow: 'tooltip',
    },
    {
      field: 'vehicleModel',
      title: '适用车型',
      width: 140,
      showOverflow: 'tooltip',
    },
    { field: 'warehouseName', title: '仓库', width: 110, sortable: true },
    { field: 'warehousePosition', title: '货架位', width: 100 },
    { field: 'drawingNo', title: '图号', width: 110 },
    { field: 'standard', title: '规格', width: 110, showOverflow: 'tooltip' },
    { field: 'brand', title: '品牌', width: 90 },
    { field: 'originPlace', title: '产地', width: 90 },
    { field: 'purchaserName', title: '采购员', width: 90 },
    { field: 'creatorName', title: '制单人', width: 90 },
    {
      field: 'count',
      title: '数量',
      width: 90,
      align: 'right',
      sortable: true,
      formatter: quantityFormatter,
    },
    {
      field: 'productPrice',
      title: '单价',
      width: 96,
      align: 'right',
      sortable: true,
      formatter: moneyFormatter,
    },
    {
      field: 'totalPrice',
      title: '金额',
      width: 110,
      align: 'right',
      sortable: true,
      formatter: moneyFormatter,
    },
    {
      field: 'inTransitCount',
      title: '在途数',
      width: 96,
      align: 'right',
      formatter: quantityFormatter,
    },
    {
      field: 'pendingInCount',
      title: '未入数',
      width: 96,
      align: 'right',
      formatter: quantityFormatter,
    },
    {
      field: 'stockCountAtOrder',
      title: '下订时库存数',
      width: 118,
      align: 'right',
      formatter: quantityFormatter,
    },
    {
      field: 'stockMax',
      title: '库存上限',
      width: 96,
      align: 'right',
      formatter: quantityFormatter,
    },
    {
      field: 'stockMin',
      title: '库存下限',
      width: 96,
      align: 'right',
      formatter: quantityFormatter,
    },
    {
      field: 'stockStandard',
      title: '标准库存',
      width: 96,
      align: 'right',
      formatter: quantityFormatter,
    },
    {
      field: 'orderInTransitCount',
      title: '订单在途数',
      width: 112,
      align: 'right',
      sortable: true,
      formatter: quantityFormatter,
    },
    {
      field: 'expectedArrivalDate',
      title: '预计到货日期',
      width: 150,
      formatter: 'formatDateTime',
    },
    {
      field: 'documentRemark',
      title: '单据备注',
      width: 190,
      showOverflow: 'tooltip',
    },
    {
      field: 'featureCode',
      title: '特征码',
      width: 110,
      showOverflow: 'tooltip',
    },
  ];
  const visibleColumns = showPrice
    ? columns
    : columns.filter(
        (column) =>
          !['productPrice', 'totalPrice'].includes(String(column.field)),
      );
  return preparePurchaseDocumentListColumns(visibleColumns, rows);
}

function normalizeQueryValues(values: Record<string, any>) {
  const params: Record<string, any> = {};
  Object.entries(values || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (typeof value === 'string') {
      const normalized = value.trim();
      if (normalized) {
        params[key === 'keyword' ? 'productKeyword' : key] = normalized;
      }
      return;
    }
    if (!Array.isArray(value) || value.length > 0) params[key] = value;
  });
  return params;
}

const summaryItems = computed(() => {
  const items = [
    { label: '明细行', value: formatNumber(summary.value.rowCount, 0) },
    { label: '数量', value: formatNumber(summary.value.totalCount) },
  ];
  if (priceVisible.value) {
    items.push({ label: '金额', value: formatMoney(summary.value.totalPrice) });
  }
  items.push(
    {
      label: '在途数（产品+仓库去重）',
      value: formatNumber(summary.value.inTransitCount),
    },
    {
      label: '未入数（产品+仓库去重）',
      value: formatNumber(summary.value.pendingInCount),
    },
    {
      label: '订单在途数',
      value: formatNumber(summary.value.orderInTransitCount),
    },
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
    id: 'erp-purchase-order-detail-report-list-v2',
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
          } as ErpPurchaseOrderDetailReportApi.Query;
          const [pageResult, summaryResult] = await Promise.all([
            getPurchaseOrderDetailReportPage(params),
            getPurchaseOrderDetailReportSummary({
              ...params,
              pageNo: 1,
              pageSize: 20,
            }),
          ]);
          if (requestId === queryRequestId) {
            currentRows.value = pageResult.list || [];
            summary.value = summaryResult || {};
            await gridApi.grid?.reloadColumn?.(
              useGridColumns(priceVisible.value, currentRows.value) as any[],
            );
          }
          return pageResult;
        },
        querySuccess: () => void restoreSortState(gridApi),
      },
      sort: true,
    },
    rowConfig: { keyField: 'itemId', isHover: true, isCurrent: true },
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
  if (event.isComposing) return;
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) return;
  if (target.closest('.ant-picker, .ant-select')) return;
  event.preventDefault();
  event.stopPropagation();
  void gridApi.formApi.submitForm();
}

async function handleExport() {
  exporting.value = true;
  try {
    const formValues = normalizeQueryValues(await gridApi.formApi.getValues());
    const data = await exportPurchaseOrderDetailReport({
      ...formValues,
      ...buildSortParams(),
    });
    downloadFileFromBlobPart({ fileName: '配件订货明细表.xlsx', source: data });
    message.success('导出成功');
  } finally {
    exporting.value = false;
  }
}

function openOrderDetail(row: ReportRow) {
  void documentDetailModalRef.value?.open(
    REPORT_DOCUMENT_TYPES.PURCHASE_ORDER,
    row.orderId,
  );
}
</script>

<template>
  <div class="purchase-order-detail-report" data-report="purchase-order-detail">
    <Grid
      class="purchase-order-detail-report__grid"
      table-title="配件订货明细表"
      @keydown.enter.capture="handleSearchEnter"
    >
      <template #toolbar-tools>
        <TableAction
          :actions="[
            {
              label: '导出',
              type: 'primary',
              icon: ACTION_ICON.DOWNLOAD,
              loading: exporting,
              auth: ['erp:purchase-order-detail-report:export'],
              onClick: handleExport,
            },
          ]"
        />
      </template>
      <template #orderNo="{ row }">
        <ReportDocumentLink :value="row.orderNo" @open="openOrderDetail(row)" />
      </template>
      <template #bottom>
        <div class="purchase-order-detail-report__summary">
          <b>全条件合计：</b>
          <span
            v-for="item in summaryItems"
            :key="item.label"
            class="purchase-order-detail-report__summary-item"
          >
            {{ item.label }}：<b>{{ item.value }}</b>
          </span>
        </div>
      </template>
    </Grid>
    <ReportDocumentDetailModal ref="documentDetailModalRef" />
  </div>
</template>

<style scoped>
.purchase-order-detail-report {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.purchase-order-detail-report__grid {
  min-height: 0;
}

.purchase-order-detail-report__summary {
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

.purchase-order-detail-report__summary > b,
.purchase-order-detail-report__summary-item b {
  color: hsl(var(--foreground));
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

:deep(.purchase-order-detail-report__grid .vxe-table--render-default),
:deep(.purchase-order-detail-report__grid .vxe-grid--form-wrapper) {
  font-size: 12px;
}

@media (min-width: 1280px) {
  :deep(
    .purchase-order-detail-report__grid .vxe-grid--form-wrapper form > .grid
  ) {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}

:deep(.purchase-order-detail-report__grid .vxe-grid--form-wrapper label),
:deep(.purchase-order-detail-report__grid .vxe-grid--form-wrapper .ant-input),
:deep(.purchase-order-detail-report__grid .vxe-grid--form-wrapper .ant-picker),
:deep(
  .purchase-order-detail-report__grid
    .vxe-grid--form-wrapper
    .ant-picker-input
    > input
),
:deep(.purchase-order-detail-report__grid .vxe-grid--form-wrapper .ant-select),
:deep(.purchase-order-detail-report__grid .vxe-grid--form-wrapper .ant-btn),
:deep(.purchase-order-detail-report__grid .vxe-grid--form-wrapper .vben-link) {
  font-size: 12px;
}

:deep(
  .purchase-order-detail-report__grid
    .vxe-grid--form-wrapper
    .ant-input-affix-wrapper
) {
  min-height: 28px;
  padding: 2px 8px;
}

:deep(
  .purchase-order-detail-report__grid .vxe-grid--form-wrapper .ant-select-single
),
:deep(.purchase-order-detail-report__grid .vxe-grid--form-wrapper .ant-picker) {
  height: 28px;
}

:deep(
  .purchase-order-detail-report__grid
    .vxe-grid--form-wrapper
    .ant-select-single
    .ant-select-selector
) {
  height: 28px;
  padding: 0 8px;
}

:global(.purchase-order-detail-search-select-dropdown .ant-select-item),
:global(.purchase-order-detail-search-select-dropdown .ant-empty-description) {
  font-size: 12px;
}

:deep(
  .purchase-order-detail-report__grid .vxe-toolbar .table-actions .ant-btn
) {
  height: 28px;
  padding: 2px 10px;
  font-size: 12px;
  line-height: 20px;
}

:deep(.purchase-order-detail-report__grid .vxe-toolbar .vxe-button) {
  box-sizing: border-box;
  width: 28px !important;
  min-width: 28px !important;
  height: 28px;
  padding: 0;
  font-size: 12px;
}

:deep(
  .purchase-order-detail-report__grid .vxe-header--column .vxe-cell--title
) {
  white-space: nowrap;
}

:deep(
  .purchase-order-detail-report__grid
    .vxe-header--column.is--sortable
    .vxe-cell--title
) {
  color: #1677ff;
}

:deep(.purchase-order-detail-report__grid .vxe-header--column .vxe-cell--sort) {
  display: none;
}

:deep(.purchase-order-detail-report__grid .vxe-grid--bottom-wrapper) {
  position: sticky;
  bottom: 36px;
  z-index: 4;
  background: hsl(var(--card));
}

:deep(.purchase-order-detail-report__grid .vxe-grid--pager-wrapper) {
  position: sticky;
  bottom: 0;
  z-index: 5;
  margin-top: 0 !important;
  background: hsl(var(--card));
  box-shadow: 0 -2px 8px rgb(0 0 0 / 8%);
}
</style>
