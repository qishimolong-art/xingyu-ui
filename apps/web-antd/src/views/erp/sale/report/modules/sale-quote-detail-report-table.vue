<script setup lang="ts">
import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpSaleQuoteDetailReportApi } from '#/api/erp/report/sale-quote-detail';

import { computed, ref } from 'vue';

import { useAccess } from '@vben/access';
import { downloadFileFromBlobPart } from '@vben/utils';

import { message } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  exportSaleQuoteDetailReport,
  getSaleQuoteDetailReportPage,
  getSaleQuoteDetailReportSummary,
} from '#/api/erp/report/sale-quote-detail';
import { getCustomerSimplePage } from '#/api/erp/sale/customer';
import {
  getSaleQuoteDeptSimplePage,
  getSaleQuoteUserSimplePage,
} from '#/api/erp/sale/quote';
import { getSaleWarehouseSimplePage } from '#/api/erp/stock/warehouse';
import { getRangePickerDefaultProps } from '#/utils';
import { prepareSaleDocumentListColumns } from '#/views/erp/sale/utils/document-list-table';
import ReportDocumentDetailModal from '#/views/erp/report/components/report-document-detail-modal.vue';
import ReportDocumentLink from '#/views/erp/report/components/report-document-link.vue';
import { REPORT_DOCUMENT_TYPES } from '#/views/erp/report/components/report-document-detail';
import { createVxeHeaderSort } from '#/views/erp/utils/vxe-header-sort';
import { formatSaleAmount, formatSaleDecimal } from '../../utils/decimal';

defineOptions({ name: 'ErpSaleQuoteDetailReportTable' });

type ReportRow = ErpSaleQuoteDetailReportApi.Row;
const { hasAccessByCodes } = useAccess();
const canExport = computed(
  () =>
    hasAccessByCodes(['erp:sale-quote-detail-report:export']) &&
    hasAccessByCodes(['erp:sale-quote:export']),
);
const summary = ref<ErpSaleQuoteDetailReportApi.Summary>({});
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
  convertedCount: 'convertedCount',
  count: 'count',
  customerName: 'customerName',
  documentNo: 'documentNo',
  productCode: 'productCode',
  productName: 'productName',
  productPrice: 'productPrice',
  quoteDate: 'quoteDate',
  totalPrice: 'totalPrice',
  warehouseName: 'warehouseName',
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
    popupClassName: 'sale-detail-report-search-select-dropdown',
    showSearch: true,
    valueField: 'id',
  };
}

function useGridFormSchema(): VbenFormSchema[] {
  return [
    {
      fieldName: 'productKeyword',
      label: '零件关键词',
      component: 'Input',
      componentProps: {
        allowClear: true,
        placeholder: '编码/名称/厂家编码/图号/特征码',
      },
    },
    {
      fieldName: 'quoteDate',
      label: '报价日期',
      component: 'RangePicker',
      componentProps: { ...getRangePickerDefaultProps(), allowClear: true },
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
      fieldName: 'customerId',
      label: '客户',
      component: 'ErpLazyPageSelect',
      componentProps: lazySelect(getCustomerSimplePage, '客户'),
    },
    {
      fieldName: 'saleUserId',
      label: '销售员',
      component: 'ErpLazyPageSelect',
      componentProps: lazySelect(
        getSaleQuoteUserSimplePage,
        '销售员',
        'nickname',
      ),
    },
    {
      fieldName: 'deptId',
      label: '部门',
      component: 'ErpLazyPageSelect',
      componentProps: lazySelect(getSaleQuoteDeptSimplePage, '部门'),
    },
    {
      fieldName: 'warehouseId',
      label: '仓库',
      component: 'ErpLazyPageSelect',
      componentProps: lazySelect(getSaleWarehouseSimplePage, '仓库'),
    },
    {
      fieldName: 'outStatus',
      label: '出库状态',
      component: 'Select',
      componentProps: {
        allowClear: true,
        placeholder: '全部状态',
        options: [
          { label: '未转出', value: 0 },
          { label: '部分转手推车', value: 30 },
          { label: '全部转手推车', value: 40 },
          { label: '已出库', value: 50 },
        ],
      },
    },
  ];
}

function formatNumber(value: unknown, fractionDigits = 6) {
  void fractionDigits;
  return formatSaleDecimal(value, '-');
}
function formatMoney(value: unknown) {
  return formatSaleAmount(value, '-');
}
const quantityFormatter = ({ cellValue }: { cellValue: unknown }) =>
  formatNumber(cellValue);
const moneyFormatter = ({ cellValue }: { cellValue: unknown }) =>
  formatMoney(cellValue);
const textFormatter = ({ cellValue }: { cellValue: unknown }) =>
  cellValue === null || cellValue === undefined || cellValue === ''
    ? '-'
    : String(cellValue);

function useGridColumns(
  showPrice = true,
  rows: ReportRow[] = currentRows.value,
): VxeTableGridOptions<ReportRow>['columns'] {
  const columns: NonNullable<VxeTableGridOptions<ReportRow>['columns']> = [
    {
      field: 'quoteDate',
      title: '报价日期',
      width: 160,
      sortable: true,
      formatter: 'formatDateTime',
    },
    {
      field: 'documentNo',
      title: '单号',
      width: 172,
      sortable: true,
      slots: { default: 'documentNo' },
    },
    {
      field: 'sourceNo',
      title: '来源单号',
      width: 172,
      slots: { default: 'sourceNo' },
    },
    {
      field: 'orderStatus',
      title: '订单状态',
      width: 96,
      formatter: textFormatter,
    },
    {
      field: 'outStatus',
      title: '出库状态',
      width: 112,
      formatter: textFormatter,
    },
    {
      field: 'customerName',
      title: '客户名称',
      width: 180,
      sortable: true,
      showOverflow: 'tooltip',
      formatter: textFormatter,
    },
    {
      field: 'customerCode',
      title: '客户编码',
      width: 126,
      formatter: textFormatter,
    },
    {
      field: 'customerRegion',
      title: '客户区域',
      width: 120,
      formatter: textFormatter,
    },
    { field: 'deptName', title: '部门', width: 132, formatter: textFormatter },
    {
      field: 'saleUserName',
      title: '销售员',
      width: 112,
      formatter: textFormatter,
    },
    {
      field: 'creatorName',
      title: '制单人',
      width: 112,
      formatter: textFormatter,
    },
    {
      field: 'expectedDeliveryDate',
      title: '预计交货日期',
      width: 160,
      formatter: 'formatDateTime',
    },
    {
      field: 'priceType',
      title: '价格类型',
      width: 104,
      formatter: textFormatter,
    },
    {
      field: 'productCode',
      title: '零件编码',
      width: 132,
      sortable: true,
      formatter: textFormatter,
    },
    {
      field: 'productName',
      title: '零件名称',
      minWidth: 184,
      sortable: true,
      showOverflow: 'tooltip',
      formatter: textFormatter,
    },
    {
      field: 'vehicleModel',
      title: '适用车型',
      width: 150,
      showOverflow: 'tooltip',
      formatter: textFormatter,
    },
    {
      field: 'featureCode',
      title: '特征码',
      width: 128,
      formatter: textFormatter,
    },
    { field: 'drawingNo', title: '图号', width: 120, formatter: textFormatter },
    {
      field: 'standard',
      title: '规格',
      width: 130,
      showOverflow: 'tooltip',
      formatter: textFormatter,
    },
    { field: 'brand', title: '品牌', width: 100, formatter: textFormatter },
    {
      field: 'originPlace',
      title: '产地',
      width: 100,
      formatter: textFormatter,
    },
    { field: 'unitName', title: '单位', width: 90, formatter: textFormatter },
    {
      field: 'warehouseName',
      title: '仓库',
      width: 132,
      sortable: true,
      formatter: textFormatter,
    },
    {
      field: 'warehousePosition',
      title: '货架位',
      width: 112,
      formatter: textFormatter,
    },
    {
      field: 'giftFlagText',
      title: '是否赠品',
      width: 96,
      formatter: textFormatter,
    },
    {
      field: 'count',
      title: '数量',
      width: 96,
      align: 'right',
      sortable: true,
      formatter: quantityFormatter,
    },
    {
      field: 'productPrice',
      title: '单价',
      width: 108,
      align: 'right',
      sortable: true,
      formatter: moneyFormatter,
    },
    {
      field: 'totalPrice',
      title: '金额',
      width: 120,
      align: 'right',
      sortable: true,
      formatter: moneyFormatter,
    },
    {
      field: 'stockCountAtOrder',
      title: '下订时库存数',
      width: 124,
      align: 'right',
      formatter: quantityFormatter,
    },
    {
      field: 'stockCount',
      title: '当前库存数',
      width: 112,
      align: 'right',
      formatter: quantityFormatter,
    },
    {
      field: 'availableCount',
      title: '可用库存数',
      width: 112,
      align: 'right',
      formatter: quantityFormatter,
    },
    {
      field: 'stockMax',
      title: '库存上限',
      width: 104,
      align: 'right',
      formatter: quantityFormatter,
    },
    {
      field: 'stockMin',
      title: '库存下限',
      width: 104,
      align: 'right',
      formatter: quantityFormatter,
    },
    {
      field: 'stockStandard',
      title: '标准库存',
      width: 104,
      align: 'right',
      formatter: quantityFormatter,
    },
    {
      field: 'convertedCount',
      title: '已转出数',
      width: 104,
      align: 'right',
      sortable: true,
      formatter: quantityFormatter,
    },
    {
      field: 'actualOutCount',
      title: '实际出库数',
      width: 112,
      align: 'right',
      formatter: quantityFormatter,
    },
    {
      field: 'pendingOutCount',
      title: '未出数',
      width: 96,
      align: 'right',
      formatter: quantityFormatter,
    },
    {
      field: 'documentRemark',
      title: '单据备注',
      width: 200,
      showOverflow: 'tooltip',
      formatter: textFormatter,
    },
  ];
  const visibleColumns = showPrice
    ? columns
    : columns.filter(
        (column) =>
          !['productPrice', 'totalPrice'].includes(String(column.field)),
      );
  return prepareSaleDocumentListColumns(visibleColumns, rows, {
    baseWidths: { productName: 184 },
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
    { label: '明细行', value: formatNumber(summary.value.rowCount, 0) },
    { label: '数量', value: formatNumber(summary.value.totalCount) },
  ];
  if (priceVisible.value)
    items.push({ label: '金额', value: formatMoney(summary.value.totalPrice) });
  items.push(
    { label: '已转出数', value: formatNumber(summary.value.convertedCount) },
    { label: '实际出库数', value: formatNumber(summary.value.actualOutCount) },
    { label: '未出数', value: formatNumber(summary.value.pendingOutCount) },
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
    id: 'erp-sale-quote-detail-report-list-v1',
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
          } as ErpSaleQuoteDetailReportApi.Query;
          const [pageResult, summaryResult] = await Promise.all([
            getSaleQuoteDetailReportPage(params),
            getSaleQuoteDetailReportSummary({
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
    const formValues = normalizeQueryValues(await gridApi.formApi.getValues());
    const data = await exportSaleQuoteDetailReport({
      ...formValues,
      ...buildSortParams(),
    });
    downloadFileFromBlobPart({
      fileName: '配件报价订单明细表.xlsx',
      source: data,
    });
    message.success('导出成功');
  } finally {
    exporting.value = false;
  }
}

function openQuoteDetail(row: ReportRow) {
  void documentDetailModalRef.value?.open(
    REPORT_DOCUMENT_TYPES.SALE_QUOTE,
    row.quoteId,
  );
}

function openSourceDocumentDetail(row: ReportRow) {
  void documentDetailModalRef.value?.open(
    row.sourceDocumentTypeCode,
    row.sourceBusinessId,
  );
}
</script>

<template>
  <div class="sale-detail-report" data-report="sale-quote-detail">
    <Grid
      class="sale-detail-report__grid"
      table-title="配件报价订单明细表"
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
          @open="openQuoteDetail(row)"
        />
      </template>
      <template #sourceNo="{ row }">
        <ReportDocumentLink
          :value="row.sourceNo"
          @open="openSourceDocumentDetail(row)"
        />
      </template>
      <template #bottom>
        <div class="sale-detail-report__summary">
          <b>全条件合计：</b>
          <span v-for="item in summaryItems" :key="item.label"
            >{{ item.label }}：<b>{{ item.value }}</b></span
          >
        </div>
      </template>
    </Grid>
    <ReportDocumentDetailModal ref="documentDetailModalRef" />
  </div>
</template>

<style scoped>
.sale-detail-report {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.sale-detail-report__grid {
  min-height: 0;
}
.sale-detail-report__summary {
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
.sale-detail-report__summary b {
  color: hsl(var(--foreground));
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
:deep(.sale-detail-report__grid .vxe-table--render-default),
:deep(.sale-detail-report__grid .vxe-grid--form-wrapper) {
  font-size: 12px;
}
@media (min-width: 1280px) {
  :deep(.sale-detail-report__grid .vxe-grid--form-wrapper form > .grid) {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}
:deep(.sale-detail-report__grid .vxe-grid--form-wrapper label),
:deep(.sale-detail-report__grid .vxe-grid--form-wrapper .ant-input),
:deep(.sale-detail-report__grid .vxe-grid--form-wrapper .ant-picker),
:deep(.sale-detail-report__grid .vxe-grid--form-wrapper .ant-select),
:deep(.sale-detail-report__grid .vxe-grid--form-wrapper .ant-btn) {
  font-size: 12px;
}
:deep(
  .sale-detail-report__grid .vxe-grid--form-wrapper .ant-input-affix-wrapper
) {
  min-height: 28px;
  padding: 2px 8px;
}
:deep(.sale-detail-report__grid .vxe-grid--form-wrapper .ant-select-single),
:deep(.sale-detail-report__grid .vxe-grid--form-wrapper .ant-picker) {
  height: 28px;
}
:global(.sale-detail-report-search-select-dropdown .ant-select-item),
:global(.sale-detail-report-search-select-dropdown .ant-empty-description) {
  font-size: 12px;
}
:deep(
  .sale-detail-report__grid .vxe-header--column.is--sortable .vxe-cell--title
) {
  color: #1677ff;
}
:deep(.sale-detail-report__grid .vxe-header--column .vxe-cell--sort) {
  display: none;
}
:deep(.sale-detail-report__grid .vxe-grid--bottom-wrapper) {
  position: sticky;
  bottom: 36px;
  z-index: 4;
  background: hsl(var(--card));
}
:deep(.sale-detail-report__grid .vxe-grid--pager-wrapper) {
  position: sticky;
  bottom: 0;
  z-index: 5;
  margin-top: 0 !important;
  background: hsl(var(--card));
  box-shadow: 0 -2px 8px rgb(0 0 0 / 8%);
}
</style>
