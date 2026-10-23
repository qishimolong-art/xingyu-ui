<script setup lang="ts">
import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpStockInDetailReportApi } from '#/api/erp/report/stock-in-detail';

import { computed, ref } from 'vue';

import { useAccess } from '@vben/access';
import { downloadFileFromBlobPart } from '@vben/utils';

import { Alert, message } from 'ant-design-vue';
import dayjs from 'dayjs';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import { getProductCategorySimpleList } from '#/api/erp/product/category';
import { getSupplierSimplePage } from '#/api/erp/purchase/supplier';
import {
  exportStockInDetailReport,
  getStockInDetailReportPage,
  getStockInDetailReportSummary,
} from '#/api/erp/report/stock-in-detail';
import {
  getStockInDeptSimplePage,
  getStockInUserSimplePage,
} from '#/api/erp/stock/in';
import { getWarehouseSimplePage } from '#/api/erp/stock/warehouse';
import { getRangePickerDefaultProps } from '#/utils';
import {
  stockNaturalGrouped as stockNatural,
  stockSumKnown,
} from '#/views/erp/stock/utils/stock-decimal';
import { createVxeHeaderSort } from '#/views/erp/utils/vxe-header-sort';

defineOptions({ name: 'ErpStockInDetailReportTable' });

type ReportRow = ErpStockInDetailReportApi.Row;
const { hasAccessByCodes } = useAccess();
const summary = ref<ErpStockInDetailReportApi.Summary>({});
const currentRows = ref<ReportRow[]>([]);
const exporting = ref(false);
const loadError = ref(false);
const hiddenFields = computed(() => new Set(summary.value.hiddenFields || []));
const canExport = computed(
  () =>
    hasAccessByCodes(['erp:stock-in-detail-report:export']) &&
    hasAccessByCodes(['erp:stock-in:export']),
);
const defaultApproveTime = () => [
  dayjs().subtract(29, 'day').startOf('day').format('YYYY-MM-DD HH:mm:ss'),
  dayjs().endOf('day').format('YYYY-MM-DD HH:mm:ss'),
];
const sortFieldMap: Record<string, string> = {
  approveTime: 'approveTime',
  brand: 'brand',
  businessUserName: 'businessUserName',
  categoryName: 'categoryName',
  count: 'count',
  deptName: 'deptName',
  documentNo: 'documentNo',
  documentTime: 'documentTime',
  drawingNo: 'drawingNo',
  itemRemark: 'itemRemark',
  originPlace: 'originPlace',
  productCode: 'productCode',
  productName: 'productName',
  productPrice: 'productPrice',
  relatedPartyName: 'relatedPartyName',
  shelf: 'shelf',
  standard: 'standard',
  totalAmount: 'totalAmount',
  vehicleModel: 'vehicleModel',
  warehouseName: 'warehouseName',
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
      component: 'RangePicker',
      componentProps: rangeProps(),
      defaultValue: defaultApproveTime(),
      fieldName: 'approveTime',
      label: '审核日期',
    },
    {
      component: 'RangePicker',
      componentProps: rangeProps(),
      fieldName: 'documentTime',
      label: '单据日期',
    },
    {
      component: 'Input',
      componentProps: text('单号/配件/相关对象等'),
      fieldName: 'keyword',
      label: '关键词',
    },
    {
      component: 'ErpLazyPageSelect',
      componentProps: {
        allowClear: true,
        api: (params: any) =>
          getWarehouseSimplePage({ ...params, bizType: 'stock' }),
        labelField: 'name',
        pageSize: 10,
        placeholder: '请选择仓库',
        popupClassName: 'stock-in-detail-report-select-dropdown',
        showSearch: true,
        valueField: 'id',
      },
      fieldName: 'warehouseId',
      label: '仓库',
    },
    {
      component: 'ErpLazyPageSelect',
      componentProps: {
        allowClear: true,
        api: getSupplierSimplePage,
        labelField: 'name',
        pageSize: 10,
        placeholder: '请选择相关对象',
        popupClassName: 'stock-in-detail-report-select-dropdown',
        showSearch: true,
        valueField: 'id',
      },
      fieldName: 'relatedPartyId',
      label: '相关对象',
    },
    {
      component: 'ApiSelect',
      componentProps: {
        allowClear: true,
        api: getProductCategorySimpleList,
        labelField: 'name',
        placeholder: '请选择商品类型',
        showSearch: true,
        valueField: 'id',
      },
      fieldName: 'categoryId',
      label: '商品类型',
    },
    {
      component: 'ErpLazyPageSelect',
      componentProps: {
        allowClear: true,
        api: getStockInDeptSimplePage,
        labelField: 'name',
        pageSize: 10,
        placeholder: '请选择部门',
        popupClassName: 'stock-in-detail-report-select-dropdown',
        showSearch: true,
        valueField: 'id',
      },
      fieldName: 'deptId',
      label: '部门',
    },
    {
      component: 'ErpLazyPageSelect',
      componentProps: {
        allowClear: true,
        api: getStockInUserSimplePage,
        labelField: 'nickname',
        pageSize: 10,
        placeholder: '请选择业务员',
        popupClassName: 'stock-in-detail-report-select-dropdown',
        showSearch: true,
        valueField: 'id',
      },
      fieldName: 'businessUserId',
      label: '业务员',
    },
  ];
  const hidden = hiddenFields.value;
  return schema.filter(({ fieldName }) => {
    if (fieldName === 'keyword') return true;
    const direct: Record<string, string> = {
      approveTime: 'approveTime',
      businessUserId: 'businessUserName',
      categoryId: 'categoryName',
      deptId: 'deptName',
      documentTime: 'documentTime',
      relatedPartyId: 'relatedPartyName',
      warehouseId: 'warehouseName',
    };
    return !hidden.has(direct[fieldName] || '');
  });
}

const textFormatter = ({ cellValue }: { cellValue: unknown }) =>
  cellValue === null || cellValue === undefined || cellValue === ''
    ? '-'
    : String(cellValue);
const dateTimeFormatter = ({ cellValue }: { cellValue: unknown }) =>
  cellValue ? dayjs(cellValue as any).format('YYYY-MM-DD HH:mm:ss') : '-';
const quantityFormatter = ({ cellValue }: { cellValue: unknown }) =>
  formatNumber(cellValue, 0, 6);
const moneyFormatter = ({ cellValue }: { cellValue: unknown }) =>
  formatNumber(cellValue, 2, 2);

function columns(): VxeTableGridOptions<ReportRow>['columns'] {
  const values: NonNullable<VxeTableGridOptions<ReportRow>['columns']> = [
    {
      field: 'warehouseName',
      fixed: 'left',
      formatter: textFormatter,
      sortable: true,
      title: '仓库',
      width: 128,
    },
    {
      field: 'documentNo',
      fixed: 'left',
      formatter: textFormatter,
      sortable: true,
      title: '单号',
      width: 176,
    },
    {
      field: 'relatedPartyName',
      formatter: textFormatter,
      minWidth: 160,
      sortable: true,
      title: '相关对象',
    },
    {
      field: 'productCode',
      formatter: textFormatter,
      sortable: true,
      title: '编码',
      width: 132,
    },
    {
      field: 'drawingNo',
      formatter: textFormatter,
      sortable: true,
      title: '图号',
      width: 124,
    },
    {
      field: 'productName',
      formatter: textFormatter,
      minWidth: 180,
      sortable: true,
      title: '产品名称',
    },
    {
      field: 'vehicleModel',
      formatter: textFormatter,
      sortable: true,
      title: '适用车型',
      width: 140,
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
      field: 'brand',
      formatter: textFormatter,
      sortable: true,
      title: '品牌',
      width: 112,
    },
    {
      field: 'originPlace',
      formatter: textFormatter,
      sortable: true,
      title: '产地',
      width: 100,
    },
    {
      field: 'standard',
      formatter: textFormatter,
      sortable: true,
      title: '规格',
      width: 132,
    },
    {
      field: 'categoryName',
      formatter: textFormatter,
      sortable: true,
      title: '商品类型',
      width: 124,
    },
    {
      field: 'shelf',
      formatter: textFormatter,
      sortable: true,
      title: '货架',
      width: 104,
    },
    {
      field: 'approveTime',
      formatter: dateTimeFormatter,
      sortable: true,
      title: '审核日期',
      width: 168,
    },
    {
      field: 'documentTime',
      formatter: dateTimeFormatter,
      sortable: true,
      title: '单据日期',
      width: 168,
    },
    {
      field: 'itemRemark',
      formatter: textFormatter,
      minWidth: 160,
      sortable: true,
      title: '备注',
    },
    {
      field: 'deptName',
      formatter: textFormatter,
      sortable: true,
      title: '部门',
      width: 128,
    },
    {
      field: 'businessUserName',
      formatter: textFormatter,
      sortable: true,
      title: '业务员',
      width: 112,
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

function sumRows(field: 'count' | 'totalAmount') {
  return stockSumKnown(currentRows.value.map((row) => row[field]));
}

const pageSummaryItems = computed(() => [
  { label: '明细行', value: currentRows.value.length },
  ...(hiddenFields.value.has('count')
    ? []
    : [{ label: '数量', value: formatNumber(sumRows('count'), 0, 6) }]),
  ...(summary.value.priceVisible === false
    ? []
    : [{ label: '金额', value: formatNumber(sumRows('totalAmount'), 2, 2) }]),
]);
const totalSummaryItems = computed(() => [
  { label: '明细行', value: summary.value.rowCount ?? 0 },
  ...(hiddenFields.value.has('count')
    ? []
    : [{ label: '数量', value: formatNumber(summary.value.totalCount, 0, 6) }]),
  ...(summary.value.priceVisible === false
    ? []
    : [
        { label: '金额', value: formatNumber(summary.value.totalAmount, 2, 2) },
      ]),
]);

function formatNumber(value: unknown, _precision?: number, _maximum?: number) {
  return stockNatural(value as null | number | string | undefined);
}

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
    id: 'erp-stock-in-detail-report-list',
    pagerConfig: { pageSize: 10, pageSizes: [10, 20, 50, 100] },
    proxyConfig: {
      ajax: {
        query: async ({ page, sort, sorts }, formValues) => {
          const currentPageRequest = ++pageRequestId;
          loadError.value = false;
          const params = {
            ...normalize(formValues),
            ...buildSortParams(sorts, sort),
            pageNo: page.currentPage,
            pageSize: page.pageSize,
          } as ErpStockInDetailReportApi.Query;
          try {
            const pageResult = await getStockInDetailReportPage(params);
            if (currentPageRequest !== pageRequestId) return pageResult;
            currentRows.value = pageResult.list || [];
            const rowVisibility = currentRows.value[0];
            if (rowVisibility) {
              summary.value = {
                ...summary.value,
                hiddenFields: rowVisibility.hiddenFields,
                priceVisible: rowVisibility.priceVisible,
              };
              await gridApi.formApi.setState({ schema: formSchema() });
              await gridApi.grid?.reloadColumn?.(columns() as any[]);
            }
            const currentSummaryRequest = ++summaryRequestId;
            void getStockInDetailReportSummary({
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
          } catch (error) {
            if (currentPageRequest === pageRequestId) {
              loadError.value = true;
              currentRows.value = [];
              message.error('其他入库明细加载失败，请稍后重试');
            }
            throw error;
          }
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
    const data = await exportStockInDetailReport({
      ...normalize(await gridApi.formApi.getValues()),
      ...buildSortParams(),
    });
    downloadFileFromBlobPart({
      fileName: '其他入库明细报表.xlsx',
      source: data,
    });
    message.success('导出成功');
  } catch (error) {
    console.error('Failed to export stock in detail report:', error);
    message.error('其他入库明细导出失败，请稍后重试');
  } finally {
    exporting.value = false;
  }
}
</script>

<template>
  <div class="stock-in-detail-report">
    <Alert
      v-if="loadError"
      class="stock-in-detail-report__error"
      message="其他入库明细加载失败，请检查网络或查询条件后重试。"
      show-icon
      type="error"
    />
    <Grid table-title="其他入库明细报表" @keydown.enter.capture="handleEnter">
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
      <template #bottom>
        <div class="report-summary">
          <div>
            <b>本页小计：</b>
            <span v-for="item in pageSummaryItems" :key="item.label">
              {{ item.label }}：<b>{{ item.value }}</b>
            </span>
          </div>
          <div>
            <b>全条件合计：</b>
            <span v-for="item in totalSummaryItems" :key="item.label">
              {{ item.label }}：<b>{{ item.value }}</b>
            </span>
          </div>
        </div>
      </template>
    </Grid>
  </div>
</template>

<style scoped>
.stock-in-detail-report {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.stock-in-detail-report__error {
  margin-bottom: 8px;
}

.report-summary {
  display: flex;
  min-height: 42px;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 4px 20px;
  padding: 5px 8px;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  border-top: 1px solid hsl(var(--border));
}

.report-summary > div {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
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
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

:deep(.vxe-grid--form-wrapper .ant-input::placeholder),
:deep(.vxe-grid--form-wrapper .ant-input-number-input::placeholder),
:deep(.vxe-grid--form-wrapper .ant-select-selection-placeholder),
:deep(.vxe-grid--form-wrapper .ant-select-selection-search-input::placeholder),
:deep(.vxe-grid--form-wrapper .ant-picker-input > input::placeholder) {
  font-size: 12px;
}

:global(.stock-in-detail-report-select-dropdown .ant-select-item) {
  font-size: 12px;
}
</style>
