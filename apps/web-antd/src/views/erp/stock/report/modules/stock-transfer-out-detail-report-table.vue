<script setup lang="ts">
import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpStockTransferOutDetailReportApi } from '#/api/erp/report/stock-transfer-out-detail';

import { computed, ref } from 'vue';

import { useAccess } from '@vben/access';
import { downloadFileFromBlobPart } from '@vben/utils';

import { message } from 'ant-design-vue';
import dayjs from 'dayjs';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  exportStockTransferOutDetailReport,
  getStockTransferOutDetailReportPage,
  getStockTransferOutDetailReportSummary,
} from '#/api/erp/report/stock-transfer-out-detail';
import { getStockTransferOutUserSimplePage } from '#/api/erp/stock/transfer-out';
import { getWarehouseSimplePage } from '#/api/erp/stock/warehouse';
import { getRangePickerDefaultProps } from '#/utils';
import { REPORT_DOCUMENT_TYPES } from '#/views/erp/report/components/report-document-detail';
import ReportDocumentDetailModal from '#/views/erp/report/components/report-document-detail-modal.vue';
import ReportDocumentLink from '#/views/erp/report/components/report-document-link.vue';
import { createVxeHeaderSort } from '#/views/erp/utils/vxe-header-sort';

import {
  formatStockReportMoney,
  formatStockReportQuantity,
} from './stock-report-number-format';

defineOptions({ name: 'ErpStockTransferOutDetailReportTable' });

type ReportRow = ErpStockTransferOutDetailReportApi.Row;
const { hasAccessByCodes } = useAccess();
const summary = ref<ErpStockTransferOutDetailReportApi.Summary>({});
const currentRows = ref<ReportRow[]>([]);
const exporting = ref(false);
const documentDetailModalRef =
  ref<InstanceType<typeof ReportDocumentDetailModal>>();
const hiddenFields = computed(() => new Set(summary.value.hiddenFields || []));
const canExport = computed(
  () =>
    hasAccessByCodes(['erp:stock-transfer-out-detail-report:export']) &&
    hasAccessByCodes(['erp:stock-transfer-out:export']),
);
const sortFieldMap: Record<string, string> = {
  costAmount: 'costAmount',
  costUnitPrice: 'costUnitPrice',
  count: 'count',
  creatorName: 'creatorName',
  documentNo: 'documentNo',
  drawingNo: 'drawingNo',
  fromWarehouseName: 'fromWarehouseName',
  moveDate: 'moveDate',
  originPlace: 'originPlace',
  productCode: 'productCode',
  productName: 'productName',
  productPrice: 'productPrice',
  standard: 'standard',
  toWarehouseName: 'toWarehouseName',
  totalAmount: 'totalAmount',
  vehicleModel: 'vehicleModel',
};
const { buildSortParams, handleSortChange, restoreSortState } =
  createVxeHeaderSort(sortFieldMap);

const rangeProps = () => ({
  ...getRangePickerDefaultProps(),
  allowClear: true,
});
const text = (placeholder: string) => ({ allowClear: true, placeholder });
const numericFieldLabels: Record<string, string> = {
  amount: '金额',
  count: '数量',
  price: '单价',
};
function formSchema(): VbenFormSchema[] {
  const schema: VbenFormSchema[] = [
    {
      component: 'RangePicker',
      componentProps: rangeProps(),
      defaultValue: [
        dayjs().startOf('month').format('YYYY-MM-DD HH:mm:ss'),
        dayjs().endOf('month').format('YYYY-MM-DD HH:mm:ss'),
      ],
      fieldName: 'moveDate',
      label: '发生日期',
    },
    {
      component: 'Input',
      componentProps: text('请输入调拨出库单号'),
      fieldName: 'documentNo',
      label: '单号',
    },
    {
      component: 'Input',
      componentProps: text('编码/名称/车型/规格等'),
      fieldName: 'productKeyword',
      label: '配件关键字',
    },
    {
      component: 'ErpLazyPageSelect',
      componentProps: {
        allowClear: true,
        api: (params: any) =>
          getWarehouseSimplePage({ ...params, bizType: 'stockMoveFrom' }),
        labelField: 'name',
        pageSize: 10,
        placeholder: '请选择调出仓库',
        popupClassName: 'stock-transfer-out-report-select-dropdown',
        showSearch: true,
        valueField: 'id',
      },
      fieldName: 'fromWarehouseId',
      label: '调出仓库',
    },
    {
      component: 'ErpLazyPageSelect',
      componentProps: {
        allowClear: true,
        api: (params: any) =>
          getWarehouseSimplePage({ ...params, bizType: 'stock' }),
        labelField: 'name',
        pageSize: 10,
        placeholder: '请选择调入仓库',
        popupClassName: 'stock-transfer-out-report-select-dropdown',
        showSearch: true,
        valueField: 'id',
      },
      fieldName: 'toWarehouseId',
      label: '调入仓库',
    },
    ...['count', 'price', 'amount'].flatMap(
      (field) =>
        [
          {
            component: 'InputNumber',
            componentProps: { stringMode: true, style: { width: '100%' } },
            fieldName: `${field}Min`,
            label: `${numericFieldLabels[field]}下限`,
          },
          {
            component: 'InputNumber',
            componentProps: { stringMode: true, style: { width: '100%' } },
            fieldName: `${field}Max`,
            label: `${numericFieldLabels[field]}上限`,
          },
        ] as VbenFormSchema[],
    ),
    {
      component: 'ErpLazyPageSelect',
      componentProps: {
        allowClear: true,
        api: getStockTransferOutUserSimplePage,
        labelField: 'nickname',
        pageSize: 10,
        placeholder: '请选择制单人',
        popupClassName: 'stock-transfer-out-report-select-dropdown',
        showSearch: true,
        valueField: 'id',
      },
      fieldName: 'creatorId',
      label: '制单人',
    },
    ...[
      ['vehicleModel', '适用车型'],
      ['originPlace', '产地'],
      ['standard', '规格'],
      ['drawingNo', '图号'],
    ].map(
      ([fieldName, label]) =>
        ({
          component: 'Input',
          componentProps: text(`请输入${label}`),
          fieldName,
          label,
        }) as VbenFormSchema,
    ),
  ];
  const hidden = hiddenFields.value;
  return schema.filter(({ fieldName }) => {
    if (fieldName === 'productKeyword') {
      return ![
        'productCode',
        'productName',
        'vehicleModel',
        'originPlace',
        'standard',
        'drawingNo',
      ].every((field) => hidden.has(field));
    }
    if (fieldName === 'countMin' || fieldName === 'countMax') {
      return !hidden.has('count');
    }
    if (fieldName === 'priceMin' || fieldName === 'priceMax') {
      return summary.value.priceVisible !== false;
    }
    if (fieldName === 'amountMin' || fieldName === 'amountMax') {
      return summary.value.amountVisible !== false;
    }
    const direct: Record<string, string> = {
      creatorId: 'creatorName',
      documentNo: 'documentNo',
      drawingNo: 'drawingNo',
      fromWarehouseId: 'fromWarehouseName',
      moveDate: 'moveDate',
      originPlace: 'originPlace',
      standard: 'standard',
      toWarehouseId: 'toWarehouseName',
      vehicleModel: 'vehicleModel',
    };
    return !hidden.has(direct[fieldName] || '');
  });
}

const textFormatter = ({ cellValue }: { cellValue: unknown }) =>
  cellValue === null || cellValue === undefined || cellValue === ''
    ? '-'
    : String(cellValue);
const dateFormatter = ({ cellValue }: { cellValue: unknown }) =>
  cellValue ? dayjs(cellValue as any).format('YYYY-MM-DD') : '-';
const quantityFormatter = ({ cellValue }: { cellValue: unknown }) =>
  formatStockReportQuantity(cellValue, 2);
const moneyFormatter = ({ cellValue }: { cellValue: unknown }) =>
  formatStockReportMoney(cellValue);

function columns(): VxeTableGridOptions<ReportRow>['columns'] {
  const values: NonNullable<VxeTableGridOptions<ReportRow>['columns']> = [
    {
      field: 'moveDate',
      fixed: 'left',
      formatter: dateFormatter,
      sortable: true,
      title: '发生日期',
      width: 108,
    },
    {
      field: 'documentNo',
      fixed: 'left',
      slots: { default: 'documentNo' },
      sortable: true,
      title: '单号',
      width: 176,
    },
    {
      field: 'productCode',
      formatter: textFormatter,
      sortable: true,
      title: '零件编码',
      width: 132,
    },
    {
      field: 'productName',
      formatter: textFormatter,
      minWidth: 180,
      sortable: true,
      title: '零件名称',
    },
    {
      field: 'vehicleModel',
      formatter: textFormatter,
      sortable: true,
      title: '适用车型',
      width: 140,
    },
    {
      field: 'originPlace',
      formatter: textFormatter,
      sortable: true,
      title: '产地',
      width: 100,
    },
    {
      field: 'fromWarehouseName',
      formatter: textFormatter,
      sortable: true,
      title: '调出仓库',
      width: 138,
    },
    {
      align: 'right',
      field: 'count',
      formatter: quantityFormatter,
      sortable: true,
      title: '数量',
      width: 104,
    },
    {
      align: 'right',
      field: 'productPrice',
      formatter: moneyFormatter,
      sortable: true,
      title: '单价',
      width: 112,
    },
    {
      align: 'right',
      field: 'totalAmount',
      formatter: moneyFormatter,
      sortable: true,
      title: '金额',
      width: 120,
    },
    {
      align: 'right',
      field: 'costUnitPrice',
      formatter: moneyFormatter,
      sortable: true,
      title: '成本单价',
      width: 112,
    },
    {
      align: 'right',
      field: 'costAmount',
      formatter: moneyFormatter,
      sortable: true,
      title: '成本金额',
      width: 120,
    },
    {
      field: 'creatorName',
      formatter: textFormatter,
      sortable: true,
      title: '制单人',
      width: 112,
    },
    {
      field: 'toWarehouseName',
      formatter: textFormatter,
      sortable: true,
      title: '调入仓库',
      width: 138,
    },
    {
      field: 'standard',
      formatter: textFormatter,
      sortable: true,
      title: '规格',
      width: 132,
    },
    {
      field: 'drawingNo',
      formatter: textFormatter,
      sortable: true,
      title: '图号',
      width: 124,
    },
  ];
  return values.filter(
    (column) => !hiddenFields.value.has(String(column.field)),
  );
}

function normalize(values: Record<string, any>) {
  const result: Record<string, any> = {};
  Object.entries(values || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (typeof value === 'string') {
      if (value.trim()) result[key] = value.trim();
    } else if (!Array.isArray(value) || value.length > 0) result[key] = value;
  });
  return result;
}

const summaryItems = computed(() => [
  { label: '明细行', value: summary.value.rowCount },
  ...(hiddenFields.value.has('count')
    ? []
    : [
        {
          label: '数量',
          value: formatStockReportQuantity(summary.value.totalCount, 2),
        },
      ]),
  ...(summary.value.amountVisible === false
    ? []
    : [
        {
          label: '金额',
          value: formatStockReportMoney(summary.value.totalAmount),
        },
        {
          label: '成本金额',
          value: formatStockReportMoney(summary.value.totalCostAmount),
        },
      ]),
]);

let pageRequestId = 0;
let summaryRequestId = 0;
const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    collapsed: true,
    collapsedRows: 1,
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
    id: 'erp-stock-transfer-out-detail-report-list',
    pagerConfig: { pageSize: 10, pageSizes: [10, 20, 50] },
    proxyConfig: {
      ajax: {
        query: async ({ page, sort, sorts }, formValues) => {
          const currentPageRequest = ++pageRequestId;
          const params = {
            ...normalize(formValues),
            ...buildSortParams(sorts, sort),
            pageNo: page.currentPage,
            pageSize: page.pageSize,
          } as ErpStockTransferOutDetailReportApi.Query;
          const pageResult = await getStockTransferOutDetailReportPage(params);
          if (currentPageRequest !== pageRequestId) return pageResult;
          currentRows.value = pageResult.list || [];
          const currentSummaryRequest = ++summaryRequestId;
          void getStockTransferOutDetailReportSummary({
            ...params,
            pageNo: 1,
            pageSize: 10,
          })
            .then(async (value) => {
              if (
                currentPageRequest !== pageRequestId ||
                currentSummaryRequest !== summaryRequestId
              )
                return;
              summary.value = value || {};
              await gridApi.formApi.setState({ schema: formSchema() });
              await gridApi.grid?.reloadColumn?.(columns() as any[]);
            })
            .catch(() => {
              if (currentSummaryRequest === summaryRequestId) {
                message.warning('汇总加载失败，列表数据不受影响');
              }
            });
          return pageResult;
        },
        querySuccess: () => void restoreSortState(gridApi),
      },
      sort: true,
    },
    rowConfig: { isCurrent: true, isHover: true, keyField: 'itemId' },
    scrollX: { enabled: true, gt: 8 },
    scrollY: { enabled: true, gt: 10 },
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
    const data = await exportStockTransferOutDetailReport({
      ...normalize(await gridApi.formApi.getValues()),
      ...buildSortParams(),
    });
    downloadFileFromBlobPart({
      fileName: '调拨出库查询报表.xlsx',
      source: data,
    });
    message.success('导出成功');
  } finally {
    exporting.value = false;
  }
}

function openDocument(row: ReportRow) {
  void documentDetailModalRef.value?.open(
    REPORT_DOCUMENT_TYPES.STOCK_TRANSFER_OUT,
    row.moveId,
  );
}
</script>

<template>
  <div class="stock-transfer-out-detail-report">
    <Grid table-title="调拨出库查询报表" @keydown.enter.capture="handleEnter">
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
      <template #documentNo="{ row }">
        <ReportDocumentLink
          v-if="row.moveId && row.documentNo"
          :value="row.documentNo"
          @open="openDocument(row)"
        />
        <span v-else>{{ row.documentNo || '-' }}</span>
      </template>
      <template #bottom>
        <div class="report-summary">
          <b>全条件合计：</b>
          <span v-for="item in summaryItems" :key="item.label">
            {{ item.label }}：<b>{{ item.value ?? '-' }}</b>
          </span>
        </div>
      </template>
    </Grid>
    <ReportDocumentDetailModal ref="documentDetailModalRef" />
  </div>
</template>

<style scoped>
.stock-transfer-out-detail-report {
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

:deep(.vxe-table--render-default) {
  font-size: 12px;
}

:deep(.vxe-header--column .vxe-cell--title) {
  white-space: nowrap;
}

:deep(.vxe-header--column.is--sortable .vxe-cell--title) {
  color: #1677ff;
}

:deep(.vxe-header--column .vxe-cell--sort) {
  display: none;
}

@media (min-width: 1280px) {
  :deep(.vxe-grid--form-wrapper form > .grid) {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}

:deep(.vxe-grid--form-wrapper .ant-input::placeholder),
:deep(.vxe-grid--form-wrapper .ant-input-number-input::placeholder),
:deep(.vxe-grid--form-wrapper .ant-select-selection-placeholder),
:deep(.vxe-grid--form-wrapper .ant-select-selection-search-input::placeholder),
:deep(.vxe-grid--form-wrapper .ant-picker-input > input::placeholder) {
  font-size: 12px;
}

:global(.stock-transfer-out-report-select-dropdown .ant-select-item) {
  font-size: 12px;
}
</style>
