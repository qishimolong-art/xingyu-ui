<script setup lang="ts">
import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpPurchaseInvoiceDetailReportApi } from '#/api/erp/report/purchase-invoice-detail';
import type { ReportDocumentType } from '#/views/erp/report/components/report-document-detail';

import { computed, ref } from 'vue';
import { useAccess } from '@vben/access';
import { downloadFileFromBlobPart } from '@vben/utils';
import dayjs from 'dayjs';
import { message } from 'ant-design-vue';
import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import { getSupplierSimplePage } from '#/api/erp/purchase/supplier';
import {
  exportPurchaseInvoiceDetailReport,
  getPurchaseInvoiceDetailReportPage,
  getPurchaseInvoiceDetailReportSummary,
} from '#/api/erp/report/purchase-invoice-detail';
import { getRangePickerDefaultProps } from '#/utils';
import { preparePurchaseDocumentListColumns } from '#/views/erp/purchase/utils/document-list-table';
import ReportDocumentDetailModal from '#/views/erp/report/components/report-document-detail-modal.vue';
import ReportDocumentLink from '#/views/erp/report/components/report-document-link.vue';
import { REPORT_DOCUMENT_TYPES } from '#/views/erp/report/components/report-document-detail';
import { createVxeHeaderSort } from '#/views/erp/utils/vxe-header-sort';

import { formatPurchaseInvoiceDetailReportDate } from './purchase-invoice-detail-report-date';

defineOptions({ name: 'ErpPurchaseInvoiceDetailReportTable' });
type ReportRow = ErpPurchaseInvoiceDetailReportApi.Row;
const { hasAccessByCodes } = useAccess();
const summary = ref<ErpPurchaseInvoiceDetailReportApi.Summary>({});
const currentRows = ref<ReportRow[]>([]);
const exporting = ref(false);
const documentDetailModalRef =
  ref<InstanceType<typeof ReportDocumentDetailModal>>();
const hiddenFields = computed(() => new Set(summary.value.hiddenFields || []));
const canExport = computed(
  () =>
    hasAccessByCodes(['erp:purchase-invoice-detail-report:export']) &&
    hasAccessByCodes(['erp:purchase-invoice:export']),
);
const sortFieldMap: Record<string, string> = {
  approveDate: 'approveDate',
  businessApproveDate: 'businessApproveDate',
  businessNo: 'businessNo',
  count: 'count',
  createDate: 'createDate',
  documentNo: 'documentNo',
  invoiceDate: 'invoiceDate',
  invoiceNo: 'invoiceNo',
  invoiceType: 'invoiceType',
  productCode: 'productCode',
  productName: 'productName',
  productPrice: 'productPrice',
  settlementStatus: 'settlementStatus',
  supplierName: 'supplierName',
  totalAmount: 'totalAmount',
};
const { buildSortParams, handleSortChange, restoreSortState } =
  createVxeHeaderSort(sortFieldMap);

const rangeProps = () => ({
  ...getRangePickerDefaultProps(),
  allowClear: true,
});
const text = (placeholder: string) => ({ allowClear: true, placeholder });
function formSchema(): VbenFormSchema[] {
  const schema: VbenFormSchema[] = [
    {
      fieldName: 'approveDate',
      label: '票据审核日期',
      component: 'RangePicker',
      defaultValue: [
        dayjs().startOf('month').format('YYYY-MM-DD HH:mm:ss'),
        dayjs().endOf('month').format('YYYY-MM-DD HH:mm:ss'),
      ],
      componentProps: rangeProps(),
    },
    {
      fieldName: 'documentNo',
      label: '单号',
      component: 'Input',
      componentProps: text('请输入票据单号'),
    },
    {
      fieldName: 'supplierId',
      label: '供应商',
      component: 'ErpLazyPageSelect',
      componentProps: {
        allowClear: true,
        api: getSupplierSimplePage,
        labelField: 'name',
        pageSize: 10,
        placeholder: '请选择供应商',
        popupClassName: 'purchase-invoice-detail-select-dropdown',
        showSearch: true,
        valueField: 'id',
      },
    },
    {
      fieldName: 'invoiceNo',
      label: '发票号码',
      component: 'Input',
      componentProps: text('请输入发票号码'),
    },
    {
      fieldName: 'businessNo',
      label: '业务单号',
      component: 'Input',
      componentProps: text('请输入业务单号'),
    },
    {
      fieldName: 'productKeyword',
      label: '配件关键字',
      component: 'Input',
      componentProps: text('编码/名称'),
    },
    {
      fieldName: 'createDate',
      label: '创建日期',
      component: 'RangePicker',
      componentProps: rangeProps(),
    },
    {
      fieldName: 'invoiceDate',
      label: '开票日期',
      component: 'RangePicker',
      componentProps: rangeProps(),
    },
    {
      fieldName: 'businessApproveDate',
      label: '业务审核日期',
      component: 'RangePicker',
      componentProps: rangeProps(),
    },
    {
      fieldName: 'invoiceType',
      label: '开票类型',
      component: 'Input',
      componentProps: text('请输入开票类型'),
    },
    {
      fieldName: 'settlementStatus',
      label: '结算情况',
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: ['未结算', '部分结算', '已结算'].map((value) => ({
          label: value,
          value,
        })),
      },
    },
    ...['count', 'price', 'amount'].flatMap(
      (field) =>
        [
          {
            fieldName: `${field}Min`,
            label: `${field === 'count' ? '数量' : field === 'price' ? '单价' : '金额'}下限`,
            component: 'InputNumber',
            componentProps: { style: { width: '100%' } },
          },
          {
            fieldName: `${field}Max`,
            label: `${field === 'count' ? '数量' : field === 'price' ? '单价' : '金额'}上限`,
            component: 'InputNumber',
            componentProps: { style: { width: '100%' } },
          },
        ] as VbenFormSchema[],
    ),
    ...[
      ['vehicleModel', '车型'],
      ['brand', '品牌'],
      ['originPlace', '产地'],
      ['drawingNo', '图号'],
      ['standard', '规格'],
      ['itemRemark', '备注'],
    ].map(
      ([fieldName, label]) =>
        ({
          fieldName,
          label,
          component: 'Input',
          componentProps: text(`请输入${label}`),
        }) as VbenFormSchema,
    ),
    {
      fieldName: 'weightMin',
      label: '重量下限',
      component: 'InputNumber',
      componentProps: { style: { width: '100%' } },
    },
    {
      fieldName: 'weightMax',
      label: '重量上限',
      component: 'InputNumber',
      componentProps: { style: { width: '100%' } },
    },
  ];
  const hidden = hiddenFields.value;
  return schema.filter(({ fieldName }) => {
    if (fieldName === 'supplierId') return !hidden.has('supplierName');
    if (fieldName === 'productKeyword') {
      return !(hidden.has('productCode') && hidden.has('productName'));
    }
    if (fieldName === 'invoiceDate') return !hidden.has('invoiceDate');
    if (fieldName === 'countMin' || fieldName === 'countMax') {
      return !hidden.has('count');
    }
    if (
      fieldName === 'priceMin' ||
      fieldName === 'priceMax' ||
      fieldName === 'amountMin' ||
      fieldName === 'amountMax'
    ) {
      return summary.value.priceVisible !== false;
    }
    const directField: Record<string, string> = {
      brand: 'brand',
      businessApproveDate: 'businessApproveDate',
      businessNo: 'businessNo',
      documentNo: 'documentNo',
      drawingNo: 'drawingNo',
      invoiceNo: 'invoiceNo',
      invoiceType: 'invoiceType',
      itemRemark: 'itemRemark',
      originPlace: 'originPlace',
      settlementStatus: 'settlementStatus',
      standard: 'standard',
      vehicleModel: 'vehicleModel',
      weightMax: 'weight',
      weightMin: 'weight',
    };
    return !hidden.has(directField[fieldName] || '');
  });
}

const emptyFormatter = () => '';
const textFormatter = ({ cellValue }: { cellValue: unknown }) =>
  cellValue === null || cellValue === undefined || cellValue === ''
    ? '-'
    : String(cellValue);
const dateFormatter = ({ cellValue }: { cellValue: unknown }) =>
  formatPurchaseInvoiceDetailReportDate(cellValue);
const numberFormatter = ({ cellValue }: { cellValue: unknown }) =>
  cellValue === null || cellValue === undefined
    ? '-'
    : Number(cellValue).toLocaleString('zh-CN', { maximumFractionDigits: 6 });
const moneyFormatter = ({ cellValue }: { cellValue: unknown }) =>
  cellValue === null || cellValue === undefined
    ? '-'
    : Number(cellValue).toLocaleString('zh-CN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 6,
      });
function columns(
  rows: ReportRow[] = currentRows.value,
): VxeTableGridOptions<ReportRow>['columns'] {
  const values: NonNullable<VxeTableGridOptions<ReportRow>['columns']> = [
    { field: 'sequence', title: '序号', width: 68 },
    {
      field: 'createDate',
      title: '创建日期',
      width: 108,
      sortable: true,
      formatter: dateFormatter,
    },
    {
      field: 'documentNo',
      title: '单号',
      width: 176,
      sortable: true,
      slots: { default: 'documentNo' },
    },
    {
      field: 'supplierName',
      title: '供应商名称',
      width: 180,
      sortable: true,
      formatter: textFormatter,
    },
    {
      field: 'invoiceDate',
      title: '开票日期',
      width: 108,
      sortable: true,
      formatter: dateFormatter,
    },
    {
      field: 'invoiceType',
      title: '开票类型',
      width: 108,
      sortable: true,
      formatter: textFormatter,
    },
    {
      field: 'invoiceNo',
      title: '发票号码',
      width: 150,
      sortable: true,
      slots: { default: 'invoiceNo' },
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
      minWidth: 180,
      sortable: true,
      formatter: textFormatter,
    },
    { field: 'unitName', title: '单位', width: 76, formatter: textFormatter },
    {
      field: 'count',
      title: '数量',
      width: 100,
      align: 'right',
      sortable: true,
      formatter: numberFormatter,
    },
    {
      field: 'productPrice',
      title: '含税单价',
      width: 112,
      align: 'right',
      sortable: true,
      formatter: moneyFormatter,
    },
    {
      field: 'totalAmount',
      title: '含税金额',
      width: 120,
      align: 'right',
      sortable: true,
      formatter: moneyFormatter,
    },
    {
      field: 'settlementStatus',
      title: '结算情况',
      width: 104,
      sortable: true,
      formatter: textFormatter,
    },
    { field: 'taxRate', title: '税率', width: 86, formatter: emptyFormatter },
    {
      field: 'vehicleModel',
      title: '车型',
      width: 140,
      formatter: textFormatter,
    },
    { field: 'brand', title: '品牌', width: 108, formatter: textFormatter },
    {
      field: 'originPlace',
      title: '产地',
      width: 108,
      formatter: textFormatter,
    },
    { field: 'drawingNo', title: '图号', width: 124, formatter: textFormatter },
    { field: 'standard', title: '规格', width: 130, formatter: textFormatter },
    { field: 'volume', title: '体积', width: 90, formatter: emptyFormatter },
    {
      field: 'weight',
      title: '重量',
      width: 100,
      align: 'right',
      formatter: numberFormatter,
    },
    {
      field: 'taxCategoryCode',
      title: '税收分类编码',
      width: 130,
      formatter: emptyFormatter,
    },
    {
      field: 'taxProductName',
      title: '税收产品名称',
      width: 130,
      formatter: emptyFormatter,
    },
    {
      field: 'taxProductModel',
      title: '税收产品型号',
      width: 130,
      formatter: emptyFormatter,
    },
    {
      field: 'taxUnit',
      title: '税收单位',
      width: 100,
      formatter: emptyFormatter,
    },
    {
      field: 'approveDate',
      title: '票据审核日期',
      width: 120,
      sortable: true,
      formatter: dateFormatter,
    },
    {
      field: 'itemRemark',
      title: '备注',
      width: 170,
      formatter: textFormatter,
    },
    {
      field: 'businessNo',
      title: '业务单号',
      width: 172,
      sortable: true,
      slots: { default: 'businessNo' },
    },
    {
      field: 'businessApproveDate',
      title: '业务审核日期',
      width: 120,
      sortable: true,
      formatter: dateFormatter,
    },
  ];
  return preparePurchaseDocumentListColumns(
    values.filter((item) => !hiddenFields.value.has(String(item.field))),
    rows,
  );
}
function normalize(values: Record<string, any>) {
  const result: Record<string, any> = {};
  Object.entries(values || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (typeof value === 'string') {
      if (value.trim()) result[key] = value.trim();
    } else if (!Array.isArray(value) || value.length) result[key] = value;
  });
  return result;
}
const summaryItems = computed(() => [
  { label: '明细行', value: summary.value.rowCount },
  { label: '数量', value: summary.value.totalCount },
  ...(summary.value.priceVisible === false
    ? []
    : [{ label: '含税金额', value: summary.value.totalAmount }]),
]);
let requestId = 0;
const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    collapsed: true,
    collapsedRows: 2,
    commonConfig: { labelWidth: 86 },
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
    id: 'erp-purchase-invoice-detail-report-list',
    showHeaderOverflow: 'tooltip',
    showOverflow: 'tooltip',
    scrollX: { enabled: true, gt: 8 },
    scrollY: { enabled: true, gt: 10 },
    proxyConfig: {
      ajax: {
        query: async ({ page, sort, sorts }, formValues) => {
          const current = ++requestId;
          const params = {
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            ...normalize(formValues),
            ...buildSortParams(sorts, sort),
          } as ErpPurchaseInvoiceDetailReportApi.Query;
          const pageResult = await getPurchaseInvoiceDetailReportPage(params);
          if (current === requestId) {
            currentRows.value = pageResult.list || [];
            void getPurchaseInvoiceDetailReportSummary({
              ...params,
              pageNo: 1,
              pageSize: 20,
            })
              .then(async (value) => {
                if (current !== requestId) return;
                summary.value = value || {};
                await gridApi.formApi.setState({ schema: formSchema() });
                await gridApi.grid?.reloadColumn?.(
                  columns(currentRows.value) as any[],
                );
              })
              .catch(() => {
                if (current === requestId) {
                  summary.value = {
                    hiddenFields: summary.value.hiddenFields,
                    priceVisible: summary.value.priceVisible,
                  };
                }
              });
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
    pagerConfig: { pageSize: 10, pageSizes: [10, 20, 50] },
  } as VxeTableGridOptions<ReportRow>,
  gridEvents: { sortChange: handleSortChange },
});
function handleEnter(event: KeyboardEvent) {
  if (
    event.isComposing ||
    !(event.target instanceof HTMLInputElement) ||
    event.target.closest('.ant-picker, .ant-select')
  )
    return;
  event.preventDefault();
  void gridApi.formApi.submitForm();
}
async function handleExport() {
  exporting.value = true;
  try {
    const data = await exportPurchaseInvoiceDetailReport({
      ...normalize(await gridApi.formApi.getValues()),
      ...buildSortParams(),
    });
    downloadFileFromBlobPart({
      fileName: '采购票据明细查询.xlsx',
      source: data,
    });
    message.success('导出成功');
  } finally {
    exporting.value = false;
  }
}

function getSourceDocumentType(sourceType?: number) {
  const typeMap: Record<number, ReportDocumentType> = {
    10: REPORT_DOCUMENT_TYPES.PURCHASE_IN,
    20: REPORT_DOCUMENT_TYPES.PURCHASE_PRICE_ADJUST,
    30: REPORT_DOCUMENT_TYPES.PURCHASE_RETURN,
  };
  return sourceType === undefined ? undefined : typeMap[sourceType];
}

function openInvoiceDetail(row: ReportRow) {
  void documentDetailModalRef.value?.open(
    REPORT_DOCUMENT_TYPES.PURCHASE_INVOICE,
    row.invoiceId,
  );
}

function openBusinessDetail(row: ReportRow) {
  void documentDetailModalRef.value?.open(
    getSourceDocumentType(row.sourceType),
    row.sourceDocId,
  );
}
</script>

<template>
  <div class="purchase-invoice-detail-report">
    <Grid table-title="采购票据明细查询" @keydown.enter.capture="handleEnter"
      ><template #toolbar-tools
        ><TableAction
          v-if="canExport"
          :actions="[
            {
              label: '导出',
              type: 'primary',
              icon: ACTION_ICON.DOWNLOAD,
              loading: exporting,
              onClick: handleExport,
            },
          ]" /></template
      ><template #documentNo="{ row }"
        ><ReportDocumentLink
          :value="row.documentNo"
          @open="openInvoiceDetail(row)" /></template
      ><template #invoiceNo="{ row }"
        ><ReportDocumentLink
          :value="row.invoiceNo"
          @open="openInvoiceDetail(row)" /></template
      ><template #businessNo="{ row }"
        ><ReportDocumentLink
          :value="row.businessNo"
          @open="openBusinessDetail(row)" /></template
      ><template #bottom
        ><div class="report-summary">
          <b>全条件合计：</b
          ><span v-for="item in summaryItems" :key="item.label"
            >{{ item.label }}：<b>{{ item.value ?? '-' }}</b></span
          >
        </div></template
      ></Grid
    >
    <ReportDocumentDetailModal ref="documentDetailModalRef" />
  </div>
</template>

<style scoped>
.purchase-invoice-detail-report {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.report-summary {
  display: flex;
  min-height: 40px;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 4px 16px;
  padding: 5px 8px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  border-top: 1px solid hsl(var(--border));
}
.report-summary b {
  color: hsl(var(--foreground));
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
@media (min-width: 1280px) {
  :deep(.vxe-grid--form-wrapper form > .grid) {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}
:global(.purchase-invoice-detail-select-dropdown .ant-select-item) {
  font-size: 12px;
}
</style>
