<script setup lang="ts">
import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpStockOutDetailReportApi } from '#/api/erp/report/stock-out-detail';

import { computed, ref } from 'vue';

import { useAccess } from '@vben/access';
import { downloadFileFromBlobPart } from '@vben/utils';

import { Alert, message } from 'ant-design-vue';
import dayjs from 'dayjs';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import { getProductCategorySimpleList } from '#/api/erp/product/category';
import {
  exportStockOutDetailReport,
  getStockOutDetailReportPage,
  getStockOutDetailReportSummary,
} from '#/api/erp/report/stock-out-detail';
import { getCustomerSimplePage } from '#/api/erp/sale/customer';
import {
  getStockOutDeptSimplePage,
  getStockOutUserSimplePage,
} from '#/api/erp/stock/out';
import { getWarehouseSimplePage } from '#/api/erp/stock/warehouse';
import { getRangePickerDefaultProps } from '#/utils';
import { stockNaturalGrouped as stockNatural } from '#/views/erp/stock/utils/stock-decimal';
import { createVxeHeaderSort } from '#/views/erp/utils/vxe-header-sort';

defineOptions({ name: 'ErpStockOutDetailReportTable' });

type ReportRow = ErpStockOutDetailReportApi.Row;

const { hasAccessByCodes } = useAccess();
const summary = ref<ErpStockOutDetailReportApi.Summary>({});
const exporting = ref(false);
const loadError = ref(false);
const hiddenFields = computed(() => new Set(summary.value.hiddenFields || []));
const canExport = computed(
  () =>
    hasAccessByCodes(['erp:stock-out-detail-report:export']) &&
    hasAccessByCodes(['erp:stock-out:export']),
);
const defaultApproveTime = () => [
  dayjs().subtract(29, 'day').startOf('day').format('YYYY-MM-DD HH:mm:ss'),
  dayjs().endOf('day').format('YYYY-MM-DD HH:mm:ss'),
];
const sortFields = [
  'warehouseName',
  'documentNo',
  'relatedPartyName',
  'productCode',
  'drawingNo',
  'productName',
  'vehicleModel',
  'featureCode',
  'count',
  'unitPrice',
  'totalAmount',
  'costUnitPrice',
  'costAmount',
  'productPrice',
  'productAmount',
  'cancelCount',
  'afterCancelCount',
  'afterCancelAmount',
  'documentTime',
  'approveTime',
  'brand',
  'originPlace',
  'standard',
  'productCategoryName',
  'shelf',
  'businessUserName',
  'creatorName',
  'deptName',
  'itemRemark',
];
const sortFieldMap = Object.fromEntries(
  sortFields.map((field) => [field, field]),
);
const { buildSortParams, handleSortChange, restoreSortState } =
  createVxeHeaderSort(sortFieldMap);

const rangeProps = () => ({
  ...getRangePickerDefaultProps(),
  allowClear: true,
});

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
      componentProps: { allowClear: true, placeholder: '单号/客户/配件等' },
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
        popupClassName: 'stock-out-detail-report-select-dropdown',
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
        api: getCustomerSimplePage,
        labelField: 'name',
        pageSize: 10,
        placeholder: '请选择客户',
        popupClassName: 'stock-out-detail-report-select-dropdown',
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
        placeholder: '请选择商品类别',
        showSearch: true,
        valueField: 'id',
      },
      fieldName: 'categoryId',
      label: '商品类别',
    },
    {
      component: 'ErpLazyPageSelect',
      componentProps: {
        allowClear: true,
        api: getStockOutDeptSimplePage,
        labelField: 'name',
        pageSize: 10,
        placeholder: '请选择部门',
        popupClassName: 'stock-out-detail-report-select-dropdown',
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
        api: getStockOutUserSimplePage,
        labelField: 'nickname',
        pageSize: 10,
        placeholder: '请选择业务员/制单人',
        popupClassName: 'stock-out-detail-report-select-dropdown',
        showSearch: true,
        valueField: 'id',
      },
      fieldName: 'businessUserId',
      label: '业务员/制单人',
    },
  ];
  const direct: Record<string, string> = {
    approveTime: 'approveTime',
    businessUserId: 'businessUserName',
    categoryId: 'productCategoryName',
    deptId: 'deptName',
    documentTime: 'documentTime',
    relatedPartyId: 'relatedPartyName',
    warehouseId: 'warehouseName',
  };
  return schema.filter(({ fieldName }) =>
    fieldName === 'keyword'
      ? true
      : !hiddenFields.value.has(direct[fieldName] || ''),
  );
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

function column(
  field: keyof ReportRow,
  title: string,
  width = 120,
  formatter = textFormatter,
  align?: 'right',
) {
  return { align, field, formatter, sortable: true, title, width };
}

function columns(): VxeTableGridOptions<ReportRow>['columns'] {
  const values: NonNullable<VxeTableGridOptions<ReportRow>['columns']> = [
    { ...column('warehouseName', '仓库', 128), fixed: 'left' },
    { ...column('documentNo', '单号', 176), fixed: 'left' },
    column('relatedPartyName', '相关对象', 160),
    column('productCode', '编码', 132),
    column('drawingNo', '图号', 124),
    column('productName', '产品名称', 180),
    column('vehicleModel', '适用车型', 140),
    column('featureCode', '特征码', 120),
    column('count', '数量', 104, quantityFormatter, 'right'),
    column('unitPrice', '单价', 112, moneyFormatter, 'right'),
    column('totalAmount', '金额', 120, moneyFormatter, 'right'),
    column('costUnitPrice', '成本单价', 112, moneyFormatter, 'right'),
    column('costAmount', '成本金额', 120, moneyFormatter, 'right'),
    column('productPrice', '产品价格', 112, moneyFormatter, 'right'),
    column('productAmount', '产品金额', 120, moneyFormatter, 'right'),
    column('cancelCount', '取消数', 104, quantityFormatter, 'right'),
    column('afterCancelCount', '取消后出库数', 128, quantityFormatter, 'right'),
    column('afterCancelAmount', '取消后出库金额', 136, moneyFormatter, 'right'),
    column('documentTime', '单据日期', 168, dateTimeFormatter),
    column('approveTime', '审核日期', 168, dateTimeFormatter),
    { ...column('sourceNo', '来源单号', 148), sortable: false },
    column('brand', '品牌', 112),
    column('originPlace', '产地', 100),
    column('standard', '规格', 132),
    column('productCategoryName', '商品类别', 124),
    column('shelf', '货架', 104),
    { ...column('documentCategory', '类别', 104), sortable: false },
    column('businessUserName', '业务员', 112),
    column('creatorName', '制单人', 112),
    column('deptName', '部门', 128),
    column('itemRemark', '备注', 160),
  ];
  return values.filter((item) => !hiddenFields.value.has(String(item.field)));
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

const totalSummaryItems = computed(() => [
  { label: '明细行', value: summary.value.rowCount ?? 0 },
  ...(hiddenFields.value.has('count')
    ? []
    : [
        { label: '数量', value: formatNumber(summary.value.totalCount, 0, 6) },
        {
          label: '取消数',
          value: formatNumber(summary.value.totalCancelCount, 0, 6),
        },
        {
          label: '取消后出库数',
          value: formatNumber(summary.value.totalAfterCancelCount, 0, 6),
        },
      ]),
  ...(summary.value.priceVisible === false
    ? []
    : [
        { label: '金额', value: formatNumber(summary.value.totalAmount, 2, 2) },
        {
          label: '产品金额',
          value: formatNumber(summary.value.totalProductAmount, 2, 2),
        },
        {
          label: '取消后出库金额',
          value: formatNumber(summary.value.totalAfterCancelAmount, 2, 2),
        },
      ]),
  ...(summary.value.costVisible === false
    ? []
    : [
        {
          label: '成本金额',
          value:
            summary.value.missingCostCount && summary.value.missingCostCount > 0
              ? `无法完整汇总（缺 ${summary.value.missingCostCount} 行）`
              : formatNumber(summary.value.totalCostAmount, 2, 2),
        },
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
    commonConfig: { labelWidth: 100 },
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
    id: 'erp-stock-out-detail-report-list',
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
          } as ErpStockOutDetailReportApi.Query;
          try {
            const pageResult = await getStockOutDetailReportPage(params);
            if (currentPageRequest !== pageRequestId) return pageResult;
            const rowVisibility = pageResult.list?.[0];
            if (rowVisibility) {
              summary.value = {
                ...summary.value,
                costVisible: rowVisibility.costVisible,
                hiddenFields: rowVisibility.hiddenFields,
                priceVisible: rowVisibility.priceVisible,
              };
              await refreshSchemaAndColumns();
            }
            const currentSummaryRequest = ++summaryRequestId;
            void getStockOutDetailReportSummary({
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
                await refreshSchemaAndColumns();
              })
              .catch(() => {
                if (currentSummaryRequest === summaryRequestId)
                  message.warning('汇总加载失败，列表数据不受影响');
              });
            return pageResult;
          } catch (error) {
            if (currentPageRequest === pageRequestId) {
              loadError.value = true;
              message.error('其他出库明细加载失败，请稍后重试');
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

async function refreshSchemaAndColumns() {
  await gridApi.formApi.setState({ schema: formSchema() });
  await gridApi.grid?.reloadColumn?.(columns() as any[]);
}

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
    const data = await exportStockOutDetailReport({
      ...normalize(await gridApi.formApi.getValues()),
      ...buildSortParams(),
    });
    downloadFileFromBlobPart({
      fileName: '其他出库明细报表.xlsx',
      source: data,
    });
    message.success('导出成功');
  } catch (error) {
    console.error('Failed to export stock out detail report:', error);
    message.error('其他出库明细导出失败，请稍后重试');
  } finally {
    exporting.value = false;
  }
}
</script>

<template>
  <div class="stock-out-detail-report">
    <Alert
      v-if="loadError"
      class="stock-out-detail-report__error"
      message="其他出库明细加载失败，请检查网络或查询条件后重试。"
      show-icon
      type="error"
    />
    <Grid table-title="其他出库明细报表" @keydown.enter.capture="handleEnter">
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
.stock-out-detail-report {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.stock-out-detail-report__error {
  margin-bottom: 8px;
}

.report-summary {
  display: flex;
  min-height: 42px;
  flex-wrap: wrap;
  align-items: center;
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

:global(.stock-out-detail-report-select-dropdown .ant-select-item) {
  font-size: 12px;
}
</style>
