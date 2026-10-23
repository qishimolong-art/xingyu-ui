<script setup lang="ts">
/* eslint-disable vue/html-closing-bracket-newline -- Oxfmt manages multiline template layout. */
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import { computed, ref } from 'vue';

import { Tag } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { getStockTransferInPage } from '#/api/erp/stock/transfer-in';
import { getStockTransferOutPage } from '#/api/erp/stock/transfer-out';
import {
  stockMoney as erpPriceInputFormatter,
  stockNatural,
} from '#/views/erp/stock/utils/stock-decimal';
import { createVxeHeaderSort } from '#/views/erp/utils/vxe-header-sort';

import {
  useGridColumns as useTransferInColumns,
  useGridFormSchema as useTransferInFormSchema,
} from '../../transfer-in/data';
import {
  useGridColumns as useTransferOutColumns,
  useGridFormSchema as useTransferOutFormSchema,
} from '../../transfer-out/data';

type ReportType = 'transferIn' | 'transferOut';

const props = defineProps<{
  reportType: ReportType;
}>();

const emit = defineEmits<{
  openDocument: [type: ReportType, id: number];
}>();

const pageRows = ref<any[]>([]);

const sortFieldMap: Record<string, string> = {
  approveTime: 'approveTime',
  createTime: 'createTime',
  creatorName: 'creatorName',
  fromDeptName: 'fromDeptName',
  fromWarehouseNames: 'fromWarehouseNames',
  logisticsCompany: 'logisticsCompany',
  logisticsNo: 'logisticsNo',
  moveTime: 'moveTime',
  no: 'no',
  relatedMoveNo: 'relatedMoveNo',
  sourceNo: 'sourceNo',
  sourceOutNo: 'sourceOutNo',
  status: 'status',
  toDeptName: 'toDeptName',
  toWarehouseNames: 'toWarehouseNames',
  totalCount: 'totalCount',
  totalPrice: 'totalPrice',
  updateTime: 'updateTime',
};

const { buildSortParams, handleSortChange, restoreSortState } =
  createVxeHeaderSort(sortFieldMap);

const tableTitle = computed(() =>
  props.reportType === 'transferOut'
    ? '调拨出库单只读参考'
    : '调拨入库单只读参考',
);

const gridId = computed(() =>
  props.reportType === 'transferOut'
    ? 'erp-business-report-transfer-out-readonly-list-v1'
    : 'erp-business-report-transfer-in-readonly-list-v1',
);

const helpText = computed(() =>
  props.reportType === 'transferOut'
    ? '只读复用调拨出库单分页，展示调出部门、调入部门、仓库、来源单、审批状态和本页单据金额；单据金额仅用于来源追溯，不代表正式在途结算成本、调拨收入或内部利润；不提供新增、修改、提交、审核、删除、解锁、打印或微信通知动作。'
    : '只读复用调拨入库单分页，展示来源出库单、实际入库日期、调出调入部门、仓库和本页单据金额；单据金额仅用于来源追溯，不代表正式在途结算成本、调拨收入或内部利润；不提供收货、修改、删除、导出或明细维护动作。',
);

const pageSummary = computed(() => {
  let totalCount = 0;
  let totalPrice = 0;
  for (const row of pageRows.value) {
    totalCount += Number(row.totalCount || 0);
    totalPrice += Number(row.totalPrice || 0);
  }
  return {
    count: pageRows.value.length,
    totalCount,
    totalPrice,
  };
});

function hasColumn(
  columns: NonNullable<VxeTableGridOptions['columns']>,
  field: string,
) {
  return columns.some((column: any) => column.field === field);
}

function insertColumnAfter(
  columns: NonNullable<VxeTableGridOptions['columns']>,
  afterField: string,
  column: NonNullable<VxeTableGridOptions['columns']>[number],
) {
  if (hasColumn(columns, (column as any).field)) return;
  const index = columns.findIndex((item: any) => item.field === afterField);
  columns.splice(index === -1 ? columns.length : index + 1, 0, column);
}

function appendReportReferenceColumns(
  columns: NonNullable<VxeTableGridOptions['columns']>,
) {
  if (props.reportType === 'transferIn') {
    insertColumnAfter(columns, 'no', {
      field: 'relatedMoveNo',
      title: '来源出库单号',
      minWidth: 150,
      sortable: true,
      showOverflow: 'tooltip',
    });
    insertColumnAfter(columns, 'relatedMoveNo', {
      field: 'sourceNo',
      title: '来源单号',
      minWidth: 150,
      sortable: true,
      showOverflow: 'tooltip',
    });
    insertColumnAfter(columns, 'sourceNo', {
      field: 'sourceOutNo',
      title: '关联出库单号',
      minWidth: 150,
      sortable: true,
      showOverflow: 'tooltip',
    });
  }
  insertColumnAfter(columns, 'deliveryMethod', {
    field: 'logisticsNo',
    title: '物流单号',
    minWidth: 130,
    sortable: true,
    showOverflow: 'tooltip',
  });
  insertColumnAfter(columns, 'logisticsNo', {
    field: 'logisticsCompany',
    title: '物流公司',
    minWidth: 130,
    sortable: true,
    showOverflow: 'tooltip',
  });
}

function readonlyColumns(columns: NonNullable<VxeTableGridOptions['columns']>) {
  appendReportReferenceColumns(columns);
  const blockedFields = new Set([
    'actions',
    'continueBuyAction',
    'deleteAction',
    'printAction',
    'wechatNotifyAction',
  ]);
  const readonly = columns
    .filter((column: any) => column.type !== 'checkbox')
    .filter((column: any) => !blockedFields.has(column.field))
    .filter((column: any) => column.title !== '操作' && column.title !== '删除')
    .map((column: any) => {
      const nextColumn = { ...column };
      if (nextColumn.field === 'totalPrice') {
        nextColumn.title = '单据金额';
      }
      if (nextColumn.fixed === 'right') delete nextColumn.fixed;
      return nextColumn;
    });
  readonly.push({
    field: 'reportDetailAction',
    title: '查看',
    width: 64,
    fixed: 'right',
    slots: { default: 'actions' },
  });
  return readonly;
}

function useCurrentFormSchema() {
  return props.reportType === 'transferOut'
    ? useTransferOutFormSchema()
    : useTransferInFormSchema();
}

function useCurrentColumns() {
  return readonlyColumns(
    (props.reportType === 'transferOut'
      ? useTransferOutColumns()
      : useTransferInColumns()) || [],
  );
}

function getStatusLabel(status?: number) {
  if (status === 0) return '草稿';
  if (status === 10) return '待审核';
  if (status === 20) return '已审核';
  return '未知';
}

function getStatusColor(status?: number) {
  if (status === 0) return 'default';
  if (status === 10) return 'processing';
  if (status === 20) return 'success';
  return 'default';
}

function formatNumber(value: unknown) {
  return stockNatural(value as null | number | string | undefined);
}

async function queryPage(params: Record<string, any>) {
  const result =
    props.reportType === 'transferOut'
      ? await getStockTransferOutPage({
          ...params,
          pageNo: Number(params.pageNo ?? 1),
          pageSize: Number(params.pageSize ?? 10),
          includeItems: false,
        })
      : await getStockTransferInPage({
          ...params,
          pageNo: Number(params.pageNo ?? 1),
          pageSize: Number(params.pageSize ?? 10),
          includeItems: false,
        });
  pageRows.value = result.list || [];
  return result;
}

function openDocument(row: Record<string, any>) {
  if (!row.id) return;
  emit('openDocument', props.reportType, Number(row.id));
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
    commonConfig: { labelWidth: 82 },
    schema: useCurrentFormSchema(),
    collapsed: true,
    collapsedRows: 1,
  },
  gridOptions: {
    columns: useCurrentColumns(),
    customConfig: {
      storage: {
        fixed: true,
        resizable: true,
        sort: true,
        visible: true,
      },
    },
    height: 'auto',
    id: gridId.value,
    keepSource: true,
    showHeaderOverflow: 'tooltip',
    showOverflow: 'tooltip',
    scrollX: { enabled: true, gt: 8 },
    scrollY: { enabled: true, gt: 10 },
    proxyConfig: {
      ajax: {
        query: async ({ page, sort, sorts }, formValues) =>
          queryPage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
            ...buildSortParams(sorts, sort),
          }),
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
    rowConfig: { keyField: 'id', isHover: true, isCurrent: true },
    toolbarConfig: { refresh: true, search: true, custom: true },
  } as VxeTableGridOptions<any>,
  gridEvents: {
    cellClick: ({ row, column }: { column: { field?: string }; row: any }) => {
      if (column.field !== 'reportDetailAction') openDocument(row);
    },
    sortChange: handleSortChange,
  },
});
</script>

<template>
  <div class="transfer-document-readonly-table">
    <Grid
      class="transfer-document-readonly-table__grid"
      :table-title="tableTitle"
      @keydown.enter.capture="handleSearchEnter"
    >
      <template #no="{ row }">
        <button
          class="transfer-document-readonly-table__link"
          type="button"
          @click.stop="openDocument(row)"
        >
          {{ row.no || '-' }}
        </button>
      </template>
      <template #status="{ row }">
        <Tag :color="getStatusColor(row.status)">
          {{ getStatusLabel(row.status) }}
        </Tag>
      </template>
      <template #actions="{ row }">
        <button
          class="transfer-document-readonly-table__link"
          type="button"
          @click.stop="openDocument(row)"
        >
          查看
        </button>
      </template>
      <template #bottom>
        <div class="transfer-document-readonly-table__summary">
          <b>本页合计：</b>
          <span
            >单据数：<b>{{ pageSummary.count }}</b></span
          >
          <span
            >数量：<b>{{ formatNumber(pageSummary.totalCount) }}</b></span
          >
          <span>
            本页单据金额：<b>{{
              erpPriceInputFormatter(pageSummary.totalPrice)
            }}</b>
          </span>
          <span class="transfer-document-readonly-table__summary-note">
            单据金额仅用于来源追溯，不代表正式在途结算成本、调拨收入或内部利润。
          </span>
        </div>
      </template>
    </Grid>
    <p class="transfer-document-readonly-table__hint">{{ helpText }}</p>
  </div>
</template>

<style scoped>
.transfer-document-readonly-table {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.transfer-document-readonly-table__grid {
  flex: 1 1 auto;
  min-height: 0;
}

.transfer-document-readonly-table__summary {
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

.transfer-document-readonly-table__summary b {
  color: hsl(var(--foreground));
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.transfer-document-readonly-table__summary-note {
  color: hsl(var(--muted-foreground));
}

.transfer-document-readonly-table__hint {
  flex: 0 0 auto;
  margin: 6px 0 0;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
}

.transfer-document-readonly-table__link {
  padding: 0;
  color: hsl(var(--primary));
  font: inherit;
  cursor: pointer;
  background: transparent;
  border: 0;
}

.transfer-document-readonly-table__link:hover,
.transfer-document-readonly-table__link:focus-visible {
  text-decoration: underline;
}

:deep(.transfer-document-readonly-table__grid .vxe-table--render-default),
:deep(.transfer-document-readonly-table__grid .vxe-grid--form-wrapper),
:deep(.transfer-document-readonly-table__grid .vxe-toolbar) {
  font-size: 12px;
}

:deep(
  .transfer-document-readonly-table__grid .vxe-grid--form-wrapper form > .grid
) {
  grid-template-columns: repeat(5, minmax(0, 1fr));
}

:deep(
  .transfer-document-readonly-table__grid .vxe-grid--form-wrapper .ant-form-item
) {
  margin-bottom: 8px;
}

:deep(.transfer-document-readonly-table__grid .vxe-grid--form-wrapper label),
:deep(
  .transfer-document-readonly-table__grid .vxe-grid--form-wrapper .ant-input
),
:deep(
  .transfer-document-readonly-table__grid .vxe-grid--form-wrapper .ant-picker
),
:deep(
  .transfer-document-readonly-table__grid
    .vxe-grid--form-wrapper
    .ant-picker-input
    > input
),
:deep(
  .transfer-document-readonly-table__grid .vxe-grid--form-wrapper .ant-select
),
:deep(
  .transfer-document-readonly-table__grid .vxe-grid--form-wrapper .ant-btn
) {
  font-size: 12px;
}

:deep(
  .transfer-document-readonly-table__grid
    .vxe-grid--form-wrapper
    .ant-input-affix-wrapper
),
:deep(
  .transfer-document-readonly-table__grid .vxe-grid--form-wrapper .ant-picker
),
:deep(
  .transfer-document-readonly-table__grid
    .vxe-grid--form-wrapper
    .ant-select-single
) {
  min-height: 28px;
  font-size: 12px;
}

:deep(
  .transfer-document-readonly-table__grid
    .vxe-grid--form-wrapper
    .ant-input-affix-wrapper
),
:deep(
  .transfer-document-readonly-table__grid .vxe-grid--form-wrapper .ant-picker
) {
  padding: 2px 8px;
}

:deep(
  .transfer-document-readonly-table__grid
    .vxe-grid--form-wrapper
    .ant-select-single
),
:deep(
  .transfer-document-readonly-table__grid
    .vxe-grid--form-wrapper
    .ant-select-single
    .ant-select-selector
) {
  height: 28px;
}

:deep(.transfer-document-readonly-table__grid .vxe-grid--pager-wrapper) {
  position: sticky;
  z-index: 5;
  bottom: 0;
  margin-top: 0 !important;
  background: hsl(var(--card));
  box-shadow: 0 -2px 8px rgb(0 0 0 / 8%);
}

@media (max-width: 1280px) {
  :deep(
    .transfer-document-readonly-table__grid .vxe-grid--form-wrapper form > .grid
  ) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
