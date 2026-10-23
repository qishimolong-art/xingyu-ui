<script setup lang="ts">
import { formatPurchaseAmount } from "#/views/erp/purchase/utils/decimal";
import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpPurchaseInDetailReportApi } from '#/api/erp/report/purchase-in-detail';
import type { ReportDocumentType } from '#/views/erp/report/components/report-document-detail';

import { computed, ref } from 'vue';

import { useAccess } from '@vben/access';
import { downloadFileFromBlobPart } from '@vben/utils';

import { message } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import { getSupplierSimplePage } from '#/api/erp/purchase/supplier';
import {
  exportPurchaseInDetailReport,
  getPurchaseInDetailReportPage,
  getPurchaseInDetailReportSummary,
} from '#/api/erp/report/purchase-in-detail';
import { getPurchaseWarehouseSimplePage } from '#/api/erp/stock/warehouse';
import { getRangePickerDefaultProps } from '#/utils';
import { preparePurchaseDocumentListColumns } from '#/views/erp/purchase/utils/document-list-table';
import { REPORT_DOCUMENT_TYPES } from '#/views/erp/report/components/report-document-detail';
import ReportDocumentDetailModal from '#/views/erp/report/components/report-document-detail-modal.vue';
import ReportDocumentLink from '#/views/erp/report/components/report-document-link.vue';
import { createVxeHeaderSort } from '#/views/erp/utils/vxe-header-sort';

defineOptions({ name: 'ErpPurchaseInDetailReportTable' });

type ReportRow = ErpPurchaseInDetailReportApi.Row;

const { hasAccessByCodes } = useAccess();
const summary = ref<ErpPurchaseInDetailReportApi.Summary>({});
const currentRows = ref<ReportRow[]>([]);
const exporting = ref(false);
const documentDetailModalRef =
  ref<InstanceType<typeof ReportDocumentDetailModal>>();

const documentTypeOptions = [
  { label: '采购入库', value: 'PURCHASE_IN' },
  { label: '采购退货', value: 'PURCHASE_RETURN' },
  { label: '采购调价', value: 'PURCHASE_ADJUST' },
];
const invoiceStatusOptions = ['未开票', '部分开票', '已开票', '不适用'].map(
  (value) => ({ label: value, value }),
);

const canExport = computed(
  () =>
    hasAccessByCodes(['erp:purchase-in-detail-report:export']) &&
    hasAccessByCodes(['erp:purchase-in:export']) &&
    hasAccessByCodes(['erp:purchase-return:export']) &&
    hasAccessByCodes(['erp:purchase-price-adjust:export']),
);
const priceVisible = computed(
  () =>
    summary.value.priceVisible !== false &&
    currentRows.value.every((row) => row.priceVisible !== false),
);

const priceFields = new Set([
  'freight1',
  'freightIncludedPrice',
  'invoiceAmount',
  'previousPurchasePrice',
  'productPrice',
  'totalAmount',
]);

const sortFieldMap: Record<string, string> = {
  approveDate: 'approveDate',
  count: 'count',
  documentNo: 'documentNo',
  documentType: 'documentType',
  productCode: 'productCode',
  productName: 'productName',
  productPrice: 'productPrice',
  supplierName: 'supplierName',
  totalAmount: 'totalAmount',
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
      fieldName: 'approveDate',
      label: '审核日期',
      component: 'RangePicker',
      componentProps: {
        ...getRangePickerDefaultProps(),
        allowClear: true,
      },
    },
    {
      fieldName: 'documentTypes',
      label: '单据类型',
      component: 'Select',
      componentProps: {
        allowClear: true,
        maxTagCount: 1,
        mode: 'multiple',
        options: documentTypeOptions,
        placeholder: '全部类型',
      },
    },
    {
      fieldName: 'documentNo',
      label: '单号',
      component: 'Input',
      componentProps: { allowClear: true, placeholder: '请输入业务单号' },
    },
    {
      fieldName: 'sourceNo',
      label: '来源单号',
      component: 'Input',
      componentProps: { allowClear: true, placeholder: '请输入订单/入库单号' },
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
        popupClassName: 'purchase-in-detail-search-select-dropdown',
        showSearch: true,
        valueField: 'id',
      },
    },
    {
      fieldName: 'purchaserKeyword',
      label: '业务员',
      component: 'Input',
      componentProps: { allowClear: true, placeholder: '请输入姓名关键词' },
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
        popupClassName: 'purchase-in-detail-search-select-dropdown',
        showSearch: true,
        valueField: 'id',
      },
    },
    {
      fieldName: 'invoiceStatus',
      label: '开票状态',
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: invoiceStatusOptions,
        placeholder: '全部状态',
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

function formatMoney(value: unknown, fractionDigits = 2) {
  void fractionDigits;
  return formatPurchaseAmount(value, '-');
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
      field: 'approveDate',
      title: '审核日期',
      width: 164,
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
      field: 'documentType',
      title: '单据类型',
      width: 104,
      sortable: true,
      formatter: textFormatter,
    },
    {
      field: 'sourceNo',
      title: '来源单号',
      width: 172,
      slots: { default: 'sourceNo' },
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
      width: 160,
      showOverflow: 'tooltip',
      formatter: textFormatter,
    },
    {
      field: 'featureCode',
      title: '特征码',
      width: 128,
      showOverflow: 'tooltip',
      formatter: textFormatter,
    },
    {
      field: 'count',
      title: '数量',
      width: 108,
      align: 'right',
      sortable: true,
      formatter: quantityFormatter,
    },
    {
      field: 'productPrice',
      title: '单价',
      width: 112,
      align: 'right',
      sortable: true,
      formatter: moneyFormatter,
    },
    {
      field: 'freightIncludedPrice',
      title: '含运费单价',
      width: 126,
      align: 'right',
      formatter: moneyFormatter,
    },
    {
      field: 'previousPurchasePrice',
      title: '上次采购价',
      width: 126,
      align: 'right',
      formatter: moneyFormatter,
    },
    {
      field: 'totalAmount',
      title: '总金额',
      width: 126,
      align: 'right',
      sortable: true,
      formatter: moneyFormatter,
    },
    {
      field: 'invoiceAmount',
      title: '税务开票金额',
      width: 132,
      align: 'right',
      formatter: moneyFormatter,
    },
    {
      field: 'invoiceStatus',
      title: '开票状态',
      width: 104,
      formatter: textFormatter,
    },
    {
      field: 'originPlace',
      title: '产地',
      width: 108,
      formatter: textFormatter,
    },
    {
      field: 'factoryOrderNo',
      title: '厂家单号',
      width: 150,
      formatter: textFormatter,
    },
    { field: 'brand', title: '品牌', width: 108, formatter: textFormatter },
    {
      field: 'supplierName',
      title: '供应商',
      width: 190,
      sortable: true,
      showOverflow: 'tooltip',
      formatter: textFormatter,
    },
    {
      field: 'supplierCode',
      title: '供应商编码',
      width: 126,
      formatter: textFormatter,
    },
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
      width: 120,
      formatter: textFormatter,
    },
    {
      field: 'purchaserName',
      title: '业务员',
      width: 112,
      formatter: textFormatter,
    },
    {
      field: 'standard',
      title: '规格',
      width: 132,
      showOverflow: 'tooltip',
      formatter: textFormatter,
    },
    { field: 'drawingNo', title: '图号', width: 130, formatter: textFormatter },
    { field: 'unitName', title: '单位', width: 90, formatter: textFormatter },
    {
      field: 'creatorName',
      title: '建立人',
      width: 112,
      formatter: textFormatter,
    },
    {
      field: 'itemRemark',
      title: '备注',
      width: 180,
      showOverflow: 'tooltip',
      formatter: textFormatter,
    },
    {
      field: 'documentRemark',
      title: '单据备注',
      width: 200,
      showOverflow: 'tooltip',
      formatter: textFormatter,
    },
    {
      field: 'factoryCode',
      title: '厂家编码',
      width: 132,
      formatter: textFormatter,
    },
    {
      field: 'factoryName',
      title: '厂家名称',
      width: 132,
      formatter: textFormatter,
    },
    {
      field: 'factoryModel',
      title: '厂家型号',
      width: 132,
      formatter: textFormatter,
    },
    {
      field: 'supplierRegion',
      title: '供应商区域',
      width: 120,
      formatter: textFormatter,
    },
    {
      field: 'freightType1',
      title: '运费类型1',
      width: 112,
      formatter: textFormatter,
    },
    {
      field: 'freight1',
      title: '运费1',
      width: 112,
      align: 'right',
      formatter: moneyFormatter,
    },
  ];
  const visibleColumns = showPrice
    ? columns
    : columns.filter((column) => !priceFields.has(String(column.field)));
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
    items.push(
      { label: '总金额', value: formatMoney(summary.value.totalAmount) },
      {
        label: '税务开票金额',
        value: formatMoney(summary.value.invoiceAmount),
      },
      {
        label: '已分摊运费',
        value: formatMoney(summary.value.freightAmount),
      },
    );
  }
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
    id: 'erp-purchase-in-detail-report-list-v2',
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
          } as ErpPurchaseInDetailReportApi.Query;
          const [pageResult, summaryResult] = await Promise.all([
            getPurchaseInDetailReportPage(params),
            getPurchaseInDetailReportSummary({
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
    const data = await exportPurchaseInDetailReport({
      ...formValues,
      ...buildSortParams(),
    });
    downloadFileFromBlobPart({
      fileName: '配件入库明细查询报表.xlsx',
      source: data,
    });
    message.success('导出成功');
  } finally {
    exporting.value = false;
  }
}

const currentDocumentTypeMap: Record<
  ErpPurchaseInDetailReportApi.DocumentType,
  ReportDocumentType
> = {
  PURCHASE_ADJUST: REPORT_DOCUMENT_TYPES.PURCHASE_PRICE_ADJUST,
  PURCHASE_IN: REPORT_DOCUMENT_TYPES.PURCHASE_IN,
  PURCHASE_RETURN: REPORT_DOCUMENT_TYPES.PURCHASE_RETURN,
};

function openCurrentDocumentDetail(row: ReportRow) {
  void documentDetailModalRef.value?.open(
    row.documentTypeCode
      ? currentDocumentTypeMap[row.documentTypeCode]
      : undefined,
    row.businessId,
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
  <div class="purchase-in-detail-report" data-report="purchase-in-detail">
    <Grid
      class="purchase-in-detail-report__grid"
      table-title="配件入库明细查询报表"
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
          @open="openCurrentDocumentDetail(row)"
        />
      </template>
      <template #sourceNo="{ row }">
        <ReportDocumentLink
          :value="row.sourceNo"
          @open="openSourceDocumentDetail(row)"
        />
      </template>
      <template #bottom>
        <div class="purchase-in-detail-report__summary">
          <b>全条件合计：</b>
          <span
            v-for="item in summaryItems"
            :key="item.label"
            class="purchase-in-detail-report__summary-item"
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
.purchase-in-detail-report {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.purchase-in-detail-report__grid {
  min-height: 0;
}

.purchase-in-detail-report__summary {
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

.purchase-in-detail-report__summary > b,
.purchase-in-detail-report__summary-item b {
  color: hsl(var(--foreground));
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

:deep(.purchase-in-detail-report__grid .vxe-table--render-default),
:deep(.purchase-in-detail-report__grid .vxe-grid--form-wrapper) {
  font-size: 12px;
}

@media (min-width: 1280px) {
  :deep(.purchase-in-detail-report__grid .vxe-grid--form-wrapper form > .grid) {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}

:deep(.purchase-in-detail-report__grid .vxe-grid--form-wrapper label),
:deep(.purchase-in-detail-report__grid .vxe-grid--form-wrapper .ant-input),
:deep(.purchase-in-detail-report__grid .vxe-grid--form-wrapper .ant-picker),
:deep(
  .purchase-in-detail-report__grid
    .vxe-grid--form-wrapper
    .ant-picker-input
    > input
),
:deep(.purchase-in-detail-report__grid .vxe-grid--form-wrapper .ant-select),
:deep(.purchase-in-detail-report__grid .vxe-grid--form-wrapper .ant-btn),
:deep(.purchase-in-detail-report__grid .vxe-grid--form-wrapper .vben-link) {
  font-size: 12px;
}

:deep(
  .purchase-in-detail-report__grid
    .vxe-grid--form-wrapper
    .ant-input-affix-wrapper
) {
  min-height: 28px;
  padding: 2px 8px;
}

:deep(
  .purchase-in-detail-report__grid .vxe-grid--form-wrapper .ant-select-single
),
:deep(.purchase-in-detail-report__grid .vxe-grid--form-wrapper .ant-picker) {
  height: 28px;
}

:deep(
  .purchase-in-detail-report__grid
    .vxe-grid--form-wrapper
    .ant-select-single
    .ant-select-selector
) {
  height: 28px;
  padding: 0 8px;
}

:global(.purchase-in-detail-search-select-dropdown .ant-select-item),
:global(.purchase-in-detail-search-select-dropdown .ant-empty-description) {
  font-size: 12px;
}

:deep(.purchase-in-detail-report__grid .vxe-toolbar .table-actions .ant-btn) {
  height: 28px;
  padding: 2px 10px;
  font-size: 12px;
  line-height: 20px;
}

:deep(.purchase-in-detail-report__grid .vxe-toolbar .vxe-button) {
  box-sizing: border-box;
  width: 28px !important;
  min-width: 28px !important;
  height: 28px;
  padding: 0;
  font-size: 12px;
}

:deep(.purchase-in-detail-report__grid .vxe-header--column .vxe-cell--title) {
  white-space: nowrap;
}

:deep(
  .purchase-in-detail-report__grid
    .vxe-header--column.is--sortable
    .vxe-cell--title
) {
  color: #1677ff;
}

:deep(.purchase-in-detail-report__grid .vxe-header--column .vxe-cell--sort) {
  display: none;
}

:deep(.purchase-in-detail-report__grid .vxe-grid--bottom-wrapper) {
  position: sticky;
  bottom: 36px;
  z-index: 4;
  background: hsl(var(--card));
}

:deep(.purchase-in-detail-report__grid .vxe-grid--pager-wrapper) {
  position: sticky;
  bottom: 0;
  z-index: 5;
  margin-top: 0 !important;
  background: hsl(var(--card));
  box-shadow: 0 -2px 8px rgb(0 0 0 / 8%);
}
</style>
