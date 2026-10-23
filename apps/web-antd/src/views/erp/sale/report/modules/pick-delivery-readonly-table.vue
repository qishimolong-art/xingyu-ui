<script setup lang="ts">
import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpSalePickDeliveryDetailReportApi } from '#/api/erp/report/sale-pick-delivery-detail';

import { computed, ref } from 'vue';

import { useAccess } from '@vben/access';
import { downloadFileFromBlobPart } from '@vben/utils';
import dayjs from 'dayjs';
import { message } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  exportSalePickDeliveryDetailReport,
  getSalePickDeliveryDetailReportPage,
  getSalePickDeliveryDetailReportSummary,
} from '#/api/erp/report/sale-pick-delivery-detail';
import { getCustomerSimplePage } from '#/api/erp/sale/customer';
import {
  getSaleQuoteDeptSimplePage,
  getSaleQuoteUserSimplePage,
} from '#/api/erp/sale/quote';
import { getSaleWarehouseSimplePage } from '#/api/erp/stock/warehouse';
import { getRangePickerDefaultProps } from '#/utils';
import ReportDocumentDetailModal from '#/views/erp/report/components/report-document-detail-modal.vue';
import { REPORT_DOCUMENT_TYPES } from '#/views/erp/report/components/report-document-detail';
import ReportDocumentLink from '#/views/erp/report/components/report-document-link.vue';
import { prepareSaleDocumentListColumns } from '#/views/erp/sale/utils/document-list-table';
import { createVxeHeaderSort } from '#/views/erp/utils/vxe-header-sort';

defineOptions({ name: 'ErpSalePickDeliveryDetailReportTable' });
const props = defineProps<{ mode: ErpSalePickDeliveryDetailReportApi.Mode }>();
type ReportRow = ErpSalePickDeliveryDetailReportApi.Row;

const isDelivery = computed(() => props.mode === 'delivery');
const reportTitle = computed(() =>
  isDelivery.value ? '送货明细查询' : '拣货明细查询',
);
const { hasAccessByCodes } = useAccess();
const canExport = computed(
  () =>
    hasAccessByCodes([`erp:sale-${props.mode}-detail-report:export`]) &&
    hasAccessByCodes([`erp:sale-${props.mode}:export`]),
);
const summary = ref<ErpSalePickDeliveryDetailReportApi.Summary>({});
const currentRows = ref<ReportRow[]>([]);
const exporting = ref(false);
const documentDetailModalRef =
  ref<InstanceType<typeof ReportDocumentDetailModal>>();
const hiddenFields = computed(() => new Set(summary.value.hiddenFields || []));

const sortFieldMap: Record<string, string> = {
  completeTime: 'completeTime',
  count: 'count',
  customerName: 'customerName',
  deliveredCount: 'deliveredCount',
  operationTime: 'operationTime',
  pickedCount: 'pickedCount',
  productCode: 'productCode',
  productName: 'productName',
  saleOutDate: 'saleOutDate',
  saleOutNo: 'saleOutNo',
  sourceCartNo: 'sourceCartNo',
  taskCreateDate: 'taskCreateDate',
  warehouseName: 'warehouseName',
};
const { buildSortParams, handleSortChange, restoreSortState } =
  createVxeHeaderSort(sortFieldMap);

const rangeProps = () => ({
  ...getRangePickerDefaultProps(),
  allowClear: true,
});
const textProps = (placeholder: string) => ({ allowClear: true, placeholder });
const lazySelect = (api: Function, label: string, labelField = 'name') => ({
  allowClear: true,
  api,
  labelField,
  loadErrorMessage: `${label}列表加载失败，请重试`,
  pageSize: 10,
  placeholder: `请选择${label}`,
  popupClassName: 'sale-pick-delivery-detail-select-dropdown',
  showSearch: true,
  valueField: 'id',
});

function numberSchema(fieldName: string, label: string): VbenFormSchema {
  return {
    fieldName,
    label,
    component: 'InputNumber',
    componentProps: { min: 0, precision: 6, style: { width: '100%' } },
  };
}

function formSchema(): VbenFormSchema[] {
  const values: VbenFormSchema[] = [
    {
      fieldName: 'taskCreateDate',
      label: '任务创建日期',
      component: 'RangePicker',
      defaultValue: [
        dayjs().startOf('month').format('YYYY-MM-DD HH:mm:ss'),
        dayjs().endOf('month').format('YYYY-MM-DD HH:mm:ss'),
      ],
      componentProps: rangeProps(),
    },
    {
      fieldName: 'sourceCartNo',
      label: '手推车单号',
      component: 'Input',
      componentProps: textProps('请输入销售手推车单号'),
    },
    {
      fieldName: 'saleOutNo',
      label: '销售出库单号',
      component: 'Input',
      componentProps: textProps('请输入销售出库单号'),
    },
    {
      fieldName: 'customerId',
      label: '客户',
      component: 'ErpLazyPageSelect',
      componentProps: lazySelect(getCustomerSimplePage, '客户'),
    },
    {
      fieldName: 'warehouseId',
      label: '仓库',
      component: 'ErpLazyPageSelect',
      componentProps: lazySelect(getSaleWarehouseSimplePage, '仓库'),
    },
    {
      fieldName: 'status',
      label: isDelivery.value ? '送货状态' : '拣货状态',
      component: 'Select',
      componentProps: {
        allowClear: true,
        options: isDelivery.value
          ? [
              { label: '待拣货', value: 5 },
              { label: '待送货', value: 10 },
              { label: '部分送货', value: 20 },
              { label: '已送货', value: 30 },
            ]
          : [
              { label: '待拣货', value: 10 },
              { label: '部分拣货', value: 20 },
              { label: '已拣货', value: 30 },
            ],
      },
    },
    {
      fieldName: 'productKeyword',
      label: '配件关键字',
      component: 'Input',
      componentProps: textProps('编码/名称/规格'),
    },
    {
      fieldName: 'saleOutDate',
      label: '销售出库日期',
      component: 'RangePicker',
      componentProps: rangeProps(),
    },
    {
      fieldName: 'deptId',
      label: '开单部门',
      component: 'ErpLazyPageSelect',
      componentProps: lazySelect(getSaleQuoteDeptSimplePage, '部门'),
    },
    {
      fieldName: 'saleUserId',
      label: '业务员',
      component: 'ErpLazyPageSelect',
      componentProps: lazySelect(
        getSaleQuoteUserSimplePage,
        '业务员',
        'nickname',
      ),
    },
    numberSchema(
      'countMin',
      isDelivery.value ? '应送数量下限' : '应拣数量下限',
    ),
    numberSchema(
      'countMax',
      isDelivery.value ? '应送数量上限' : '应拣数量上限',
    ),
    numberSchema('pickedCountMin', '已拣数量下限'),
    numberSchema('pickedCountMax', '已拣数量上限'),
    ...(isDelivery.value
      ? [
          numberSchema('deliveredCountMin', '已送数量下限'),
          numberSchema('deliveredCountMax', '已送数量上限'),
          numberSchema('availableCountMin', '可送数量下限'),
          numberSchema('availableCountMax', '可送数量上限'),
        ]
      : []),
    numberSchema(
      'remainingCountMin',
      isDelivery.value ? '未送数量下限' : '未拣数量下限',
    ),
    numberSchema(
      'remainingCountMax',
      isDelivery.value ? '未送数量上限' : '未拣数量上限',
    ),
    {
      fieldName: 'operationUserId',
      label: isDelivery.value ? '最近送货人' : '最近拣货人',
      component: 'ErpLazyPageSelect',
      componentProps: lazySelect(
        getSaleQuoteUserSimplePage,
        '操作人',
        'nickname',
      ),
    },
    {
      fieldName: 'operationTime',
      label: '最近操作时间',
      component: 'RangePicker',
      componentProps: rangeProps(),
    },
    {
      fieldName: 'completeTime',
      label: '任务完成时间',
      component: 'RangePicker',
      componentProps: rangeProps(),
    },
  ];
  const filterMap: Record<string, string> = {
    availableCountMax: 'count',
    availableCountMin: 'count',
    countMax: 'count',
    countMin: 'count',
    customerId: 'customerName',
    deliveredCountMax: 'count',
    deliveredCountMin: 'count',
    deptId: 'deptName',
    pickedCountMax: 'count',
    pickedCountMin: 'count',
    productKeyword: 'productCode',
    remainingCountMax: 'count',
    remainingCountMin: 'count',
    saleOutNo: 'saleOutNo',
    saleUserId: 'saleUserName',
    sourceCartNo: 'sourceCartNo',
    warehouseId: 'warehouseName',
  };
  return values.filter(
    (item) => !hiddenFields.value.has(filterMap[item.fieldName] || ''),
  );
}

const textFormatter = ({ cellValue }: { cellValue: unknown }) =>
  cellValue === null || cellValue === undefined || cellValue === ''
    ? '-'
    : String(cellValue);
const quantityFormatter = ({ cellValue }: { cellValue: unknown }) => {
  if (cellValue === null || cellValue === undefined || cellValue === '')
    return '-';
  const number = Number(cellValue);
  return Number.isFinite(number)
    ? number.toLocaleString('zh-CN', { maximumFractionDigits: 6 })
    : '-';
};
const dateFormatter = ({ cellValue }: { cellValue: unknown }) =>
  cellValue ? dayjs(String(cellValue)).format('YYYY-MM-DD') : '-';
const dateTimeFormatter = ({ cellValue }: { cellValue: unknown }) =>
  cellValue ? dayjs(String(cellValue)).format('YYYY-MM-DD HH:mm:ss') : '-';

function columns(rows: ReportRow[] = currentRows.value) {
  const values: NonNullable<VxeTableGridOptions<ReportRow>['columns']> = [
    {
      field: 'sequence',
      title: '序号',
      width: 64,
      formatter: quantityFormatter,
    },
    {
      field: 'taskCreateDate',
      title: '任务创建日期',
      sortable: true,
      formatter: dateFormatter,
    },
    {
      field: 'saleOutDate',
      title: '销售出库日期',
      sortable: true,
      formatter: dateFormatter,
    },
    {
      field: 'sourceCartNo',
      title: '销售手推车单号',
      sortable: true,
      slots: { default: 'sourceCartNo' },
    },
    {
      field: 'saleOutNo',
      title: '销售出库单号',
      sortable: true,
      slots: { default: 'saleOutNo' },
    },
    {
      field: 'customerName',
      title: '客户名称',
      sortable: true,
      formatter: textFormatter,
    },
    { field: 'deptName', title: '开单部门', formatter: textFormatter },
    { field: 'saleUserName', title: '业务员', formatter: textFormatter },
    {
      field: 'warehouseName',
      title: '仓库',
      sortable: true,
      formatter: textFormatter,
    },
    {
      field: 'productCode',
      title: '零件编码',
      sortable: true,
      formatter: textFormatter,
    },
    {
      field: 'productName',
      title: '零件名称',
      sortable: true,
      formatter: textFormatter,
    },
    { field: 'standard', title: '规格', formatter: textFormatter },
    { field: 'warehousePosition', title: '仓位', formatter: textFormatter },
    {
      field: 'count',
      title: isDelivery.value ? '应送数量' : '应拣数量',
      sortable: true,
      formatter: quantityFormatter,
    },
    {
      field: 'pickedCount',
      title: '已拣数量',
      sortable: true,
      formatter: quantityFormatter,
    },
    ...(isDelivery.value
      ? [
          {
            field: 'deliveredCount',
            title: '已送数量',
            sortable: true,
            formatter: quantityFormatter,
          },
          {
            field: 'availableDeliveryCount',
            title: '当前可送数量',
            formatter: quantityFormatter,
          },
          {
            field: 'remainingDeliveryCount',
            title: '未送数量',
            formatter: quantityFormatter,
          },
        ]
      : [
          {
            field: 'remainingPickCount',
            title: '未拣数量',
            formatter: quantityFormatter,
          },
        ]),
    { field: 'packageQty', title: '包装数', formatter: quantityFormatter },
    { field: 'pieceCount', title: '件数', formatter: quantityFormatter },
    {
      field: 'statusText',
      title: isDelivery.value ? '送货状态' : '拣货状态',
      formatter: textFormatter,
    },
    {
      field: 'operationUserName',
      title: isDelivery.value ? '最近送货人' : '最近拣货人',
      formatter: textFormatter,
    },
    {
      field: 'operationTime',
      title: isDelivery.value ? '最近送货时间' : '最近拣货时间',
      sortable: true,
      formatter: dateTimeFormatter,
    },
    {
      field: 'completeTime',
      title: isDelivery.value ? '送货任务完成时间' : '拣货任务完成时间',
      sortable: true,
      formatter: dateTimeFormatter,
    },
  ];
  const quantityFields = new Set([
    'availableDeliveryCount',
    'count',
    'deliveredCount',
    'packageQty',
    'pickedCount',
    'pieceCount',
    'remainingDeliveryCount',
    'remainingPickCount',
  ]);
  return prepareSaleDocumentListColumns(
    values.filter((item) => {
      const field = String(item.field || '');
      if (hiddenFields.value.has(field)) return false;
      return !(hiddenFields.value.has('count') && quantityFields.has(field));
    }),
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

const summaryItems = computed(() => {
  const values = [{ label: '明细行', value: summary.value.rowCount }];
  if (!hiddenFields.value.has('count')) {
    values.push(
      {
        label: isDelivery.value ? '应送' : '应拣',
        value: summary.value.totalCount,
      },
      { label: '已拣', value: summary.value.pickedCount },
    );
    if (isDelivery.value) {
      values.push(
        { label: '已送', value: summary.value.deliveredCount },
        { label: '当前可送', value: summary.value.availableDeliveryCount },
        { label: '未送', value: summary.value.remainingDeliveryCount },
      );
    } else
      values.push({ label: '未拣', value: summary.value.remainingPickCount });
    values.push({ label: '件数', value: summary.value.pieceCount });
  }
  return values;
});

let requestId = 0;
const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    collapsed: true,
    collapsedRows: 2,
    commonConfig: { labelWidth: 92 },
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
    id: `erp-sale-${props.mode}-detail-report-list`,
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
          } as ErpSalePickDeliveryDetailReportApi.Query;
          const pageResult = await getSalePickDeliveryDetailReportPage(
            props.mode,
            params,
          );
          if (current === requestId) {
            currentRows.value = pageResult.list || [];
            void getSalePickDeliveryDetailReportSummary(props.mode, {
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
              .catch(() => undefined);
          }
          return pageResult;
        },
        querySuccess: () => void restoreSortState(gridApi),
      },
      sort: true,
    },
    pagerConfig: { pageSize: 10, pageSizes: [10, 20, 50] },
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

function handleEnter(event: KeyboardEvent) {
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
    const data = await exportSalePickDeliveryDetailReport(props.mode, {
      ...normalize(await gridApi.formApi.getValues()),
      ...buildSortParams(),
    });
    downloadFileFromBlobPart({
      fileName: `${reportTitle.value}.xlsx`,
      source: data,
    });
    message.success('导出成功');
  } finally {
    exporting.value = false;
  }
}

function isValidId(value?: number) {
  return Number.isSafeInteger(value) && Number(value) > 0;
}
function openCart(row: ReportRow) {
  void documentDetailModalRef.value?.open(
    REPORT_DOCUMENT_TYPES.SALE_CART,
    row.sourceCartId,
  );
}
function openSaleOut(row: ReportRow) {
  void documentDetailModalRef.value?.open(
    REPORT_DOCUMENT_TYPES.SALE_OUT,
    row.saleOutId,
  );
}
</script>

<template>
  <div
    class="sale-pick-delivery-detail-report"
    :data-report="`sale-${mode}-detail`"
  >
    <Grid :table-title="reportTitle" @keydown.enter.capture="handleEnter">
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
      <template #sourceCartNo="{ row }">
        <ReportDocumentLink
          v-if="row.sourceType === 30 && isValidId(row.sourceCartId)"
          :value="row.sourceCartNo"
          @open="openCart(row)"
        />
        <span v-else>{{ row.sourceCartNo || '-' }}</span>
      </template>
      <template #saleOutNo="{ row }">
        <ReportDocumentLink
          v-if="isValidId(row.saleOutId)"
          :value="row.saleOutNo"
          @open="openSaleOut(row)"
        />
        <span v-else>{{ row.saleOutNo || '-' }}</span>
      </template>
      <template #bottom>
        <div class="sale-pick-delivery-detail-report__summary">
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
.sale-pick-delivery-detail-report {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.sale-pick-delivery-detail-report__summary {
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
.sale-pick-delivery-detail-report__summary b {
  color: hsl(var(--foreground));
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
@media (min-width: 1280px) {
  :deep(.vxe-grid--form-wrapper form > .grid) {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}
:global(.sale-pick-delivery-detail-select-dropdown .ant-select-item) {
  font-size: 12px;
}
</style>
