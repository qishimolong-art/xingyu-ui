<script setup lang="ts">
import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpSaleOutDetailReportApi } from '#/api/erp/report/sale-out-detail';
import type { ReportDocumentType } from '#/views/erp/report/components/report-document-detail';

import { computed, ref } from 'vue';

import { useAccess } from '@vben/access';
import { downloadFileFromBlobPart } from '@vben/utils';

import { message } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  exportSaleOutDetailReport,
  getSaleOutDetailReportPage,
  getSaleOutDetailReportSummary,
} from '#/api/erp/report/sale-out-detail';
import { getCustomerSimplePage } from '#/api/erp/sale/customer';
import { getSaleOutDeptSimplePage } from '#/api/erp/sale/out';
import { getSaleWarehouseSimplePage } from '#/api/erp/stock/warehouse';
import { getRangePickerDefaultProps } from '#/utils';
import { prepareSaleDocumentListColumns } from '#/views/erp/sale/utils/document-list-table';
import ReportDocumentDetailModal from '#/views/erp/report/components/report-document-detail-modal.vue';
import ReportDocumentLink from '#/views/erp/report/components/report-document-link.vue';
import { REPORT_DOCUMENT_TYPES } from '#/views/erp/report/components/report-document-detail';
import { createVxeHeaderSort } from '#/views/erp/utils/vxe-header-sort';
import { formatSaleAmount, formatSaleDecimal } from '../../utils/decimal';

defineOptions({ name: 'ErpSaleOutDetailReportTable' });

type ReportRow = ErpSaleOutDetailReportApi.Row;
const { hasAccessByCodes } = useAccess();
const canExport = computed(
  () =>
    hasAccessByCodes(['erp:sale-out-detail-report:export']) &&
    hasAccessByCodes(['erp:sale-out:export']) &&
    hasAccessByCodes(['erp:sale-return:export']) &&
    hasAccessByCodes(['erp:sale-price-adjust:query']),
);
const summary = ref<ErpSaleOutDetailReportApi.Summary>({});
const currentRows = ref<ReportRow[]>([]);
const exporting = ref(false);
const documentDetailModalRef =
  ref<InstanceType<typeof ReportDocumentDetailModal>>();
const priceVisible = computed(
  () =>
    summary.value.priceVisible !== false &&
    currentRows.value.every((row) => row.priceVisible !== false),
);
const costVisible = computed(
  () =>
    summary.value.costVisible !== false &&
    currentRows.value.every((row) => row.costVisible !== false),
);
const priceFields = new Set([
  'freightAmount',
  'freightIncludedPrice',
  'invoiceAmount',
  'previousSalePrice',
  'productPrice',
  'totalAmount',
]);
const costFields = new Set(['saleCostAmount', 'saleCostPrice']);
const grossProfitFields = new Set(['grossProfitAmount', 'grossProfitRate']);

const sortFieldMap: Record<string, string> = {
  approveDate: 'approveDate',
  count: 'count',
  customerName: 'customerName',
  documentNo: 'documentNo',
  documentType: 'documentType',
  productCode: 'productCode',
  productName: 'productName',
  productPrice: 'productPrice',
  totalAmount: 'totalAmount',
  warehouseName: 'warehouseName',
};
const { buildSortParams, handleSortChange, restoreSortState } =
  createVxeHeaderSort(sortFieldMap);

function lazySelect(api: Function, placeholder: string) {
  return {
    allowClear: true,
    api,
    labelField: 'name',
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
      fieldName: 'approveDate',
      label: '审核日期',
      component: 'RangePicker',
      componentProps: { ...getRangePickerDefaultProps(), allowClear: true },
    },
    {
      fieldName: 'documentTypes',
      label: '单据类型',
      component: 'Select',
      componentProps: {
        allowClear: true,
        mode: 'multiple',
        maxTagCount: 1,
        placeholder: '全部类型',
        options: [
          { label: '销售出库', value: 'SALE_OUT' },
          { label: '销售退货', value: 'SALE_RETURN' },
          { label: '销售调价', value: 'SALE_ADJUST' },
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
      fieldName: 'thirdPartyNo',
      label: '第三方单号',
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
      fieldName: 'saleUserKeyword',
      label: '业务员',
      component: 'Input',
      componentProps: { allowClear: true, placeholder: '姓名关键词' },
    },
    {
      fieldName: 'deptId',
      label: '部门',
      component: 'ErpLazyPageSelect',
      componentProps: lazySelect(getSaleOutDeptSimplePage, '部门'),
    },
    {
      fieldName: 'warehouseId',
      label: '仓库',
      component: 'ErpLazyPageSelect',
      componentProps: lazySelect(getSaleWarehouseSimplePage, '仓库'),
    },
    {
      fieldName: 'invoiceStatus',
      label: '开票状态',
      component: 'Select',
      componentProps: {
        allowClear: true,
        placeholder: '全部状态',
        options: [
          { label: '未开票', value: '未开票' },
          { label: '部分开票', value: '部分开票' },
          { label: '已开票', value: '已开票' },
          { label: '不适用', value: '不适用' },
        ],
      },
    },
  ];
}

function formatNumber(value: unknown, fractionDigits = 6) {
  void fractionDigits;
  return formatSaleDecimal(value, '-');
}
function formatMoney(value: unknown, fractionDigits = 2) {
  void fractionDigits;
  return formatSaleAmount(value, '-');
}
const quantityFormatter = ({ cellValue }: { cellValue: unknown }) =>
  formatNumber(cellValue);
const moneyFormatter = ({ cellValue }: { cellValue: unknown }) =>
  formatMoney(cellValue);
const preciseMoneyFormatter = ({ cellValue }: { cellValue: unknown }) =>
  formatMoney(cellValue, 6);
const textFormatter = ({ cellValue }: { cellValue: unknown }) =>
  cellValue === null || cellValue === undefined || cellValue === ''
    ? '-'
    : String(cellValue);

function useGridColumns(
  showPrice = true,
  showCost = true,
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
      field: 'thirdPartyNo',
      title: '第三方单号',
      width: 150,
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
      width: 160,
      showOverflow: 'tooltip',
      formatter: textFormatter,
    },
    {
      field: 'featureCode',
      title: '特征码',
      width: 128,
      formatter: textFormatter,
    },
    {
      field: 'count',
      title: '数量',
      width: 100,
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
      formatter: preciseMoneyFormatter,
    },
    {
      field: 'freightIncludedPrice',
      title: '含运费单价',
      width: 126,
      align: 'right',
      formatter: preciseMoneyFormatter,
    },
    {
      field: 'previousSalePrice',
      title: '上次销售价',
      width: 126,
      align: 'right',
      formatter: preciseMoneyFormatter,
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
      field: 'saleCostPrice',
      title: '销售成本单价',
      width: 126,
      align: 'right',
      formatter: preciseMoneyFormatter,
    },
    {
      field: 'saleCostAmount',
      title: '销售成本金额',
      width: 126,
      align: 'right',
      formatter: moneyFormatter,
    },
    {
      field: 'grossProfitAmount',
      title: '毛利额',
      width: 112,
      align: 'right',
      formatter: moneyFormatter,
    },
    {
      field: 'grossProfitRate',
      title: '毛利率',
      width: 104,
      align: 'right',
      formatter: textFormatter,
    },
    {
      field: 'originPlace',
      title: '产地',
      width: 104,
      formatter: textFormatter,
    },
    { field: 'brand', title: '品牌', width: 104, formatter: textFormatter },
    {
      field: 'customerName',
      title: '客户名称',
      width: 190,
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
      field: 'saleUserName',
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
    { field: 'drawingNo', title: '图号', width: 120, formatter: textFormatter },
    { field: 'unitName', title: '单位', width: 90, formatter: textFormatter },
    {
      field: 'giftFlagText',
      title: '是否赠品',
      width: 96,
      formatter: textFormatter,
    },
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
      field: 'freightType',
      title: '运费类型',
      width: 112,
      formatter: textFormatter,
    },
    {
      field: 'freightAmount',
      title: '运费',
      width: 112,
      align: 'right',
      formatter: moneyFormatter,
    },
  ];
  const visibleColumns = columns.filter((column) => {
    const field = String(column.field);
    if (!showPrice && priceFields.has(field)) return false;
    if (!showCost && costFields.has(field)) return false;
    return !((!showPrice || !showCost) && grossProfitFields.has(field));
  });
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
    items.push(
      { label: '总金额', value: formatMoney(summary.value.totalAmount) },
      {
        label: '税务开票金额',
        value: formatMoney(summary.value.invoiceAmount),
      },
      { label: '已分摊运费', value: formatMoney(summary.value.freightAmount) },
    );
  if (costVisible.value)
    items.push({
      label: '销售成本金额',
      value:
        Number(summary.value.missingSaleCostCount || 0) > 0
          ? `成本数据不完整（${formatNumber(summary.value.missingSaleCostCount, 0)} 行缺失）`
          : formatMoney(summary.value.totalSaleCostAmount),
    });
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
    id: 'erp-sale-out-detail-report-list-v1',
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
          } as ErpSaleOutDetailReportApi.Query;
          const [pageResult, summaryResult] = await Promise.all([
            getSaleOutDetailReportPage(params),
            getSaleOutDetailReportSummary({
              ...params,
              pageNo: 1,
              pageSize: 20,
            }),
          ]);
          if (requestId === queryRequestId) {
            currentRows.value = pageResult.list || [];
            summary.value = summaryResult || {};
            await gridApi.grid?.reloadColumn?.(
              useGridColumns(
                priceVisible.value,
                costVisible.value,
                currentRows.value,
              ) as any[],
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
    const formValues = normalizeQueryValues(await gridApi.formApi.getValues());
    const data = await exportSaleOutDetailReport({
      ...formValues,
      ...buildSortParams(),
    });
    downloadFileFromBlobPart({
      fileName: '配件出库明细查询报表.xlsx',
      source: data,
    });
    message.success('导出成功');
  } finally {
    exporting.value = false;
  }
}

const currentDocumentTypeMap: Partial<
  Record<ErpSaleOutDetailReportApi.DocumentType, ReportDocumentType>
> = {
  SALE_ADJUST: REPORT_DOCUMENT_TYPES.SALE_PRICE_ADJUST,
  SALE_OUT: REPORT_DOCUMENT_TYPES.SALE_OUT,
  SALE_RETURN: REPORT_DOCUMENT_TYPES.SALE_RETURN,
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
  <div class="sale-detail-report" data-report="sale-out-detail">
    <Grid
      class="sale-detail-report__grid"
      table-title="配件出库明细查询报表"
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
        <div class="sale-detail-report__summary">
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
