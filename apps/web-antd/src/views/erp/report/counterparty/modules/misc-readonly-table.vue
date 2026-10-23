<script lang="ts" setup>
import type { PageParam } from '@vben/request';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import { computed, ref } from 'vue';

import { erpPriceInputFormatter } from '@vben/utils';

import { Tag } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { getPayableMiscPage } from '#/api/erp/finance/payable/misc';
import { getReceivableMiscPage } from '#/api/erp/finance/receivable/misc';
import { withErpKeywordSearchSchema } from '#/views/erp/utils/form-defaults';
import { createVxeHeaderSort } from '#/views/erp/utils/vxe-header-sort';

import {
  PAYABLE_MISC_SORT_FIELD_MAP,
  useGridColumns as usePayableMiscColumns,
  useGridFormSchema as usePayableMiscFormSchema,
} from '../../../finance/payable/misc/data';
import {
  RECEIVABLE_MISC_SORT_FIELD_MAP,
  useGridColumns as useReceivableMiscColumns,
  useGridFormSchema as useReceivableMiscFormSchema,
} from '../../../finance/receivable/misc/data';

const props = defineProps<{
  reportType: 'payable' | 'receivable';
}>();

const pageRows = ref<any[]>([]);
const isReceivable = computed(() => props.reportType === 'receivable');
const tableTitle = computed(() =>
  isReceivable.value ? '其他应收明细' : '其他应付明细',
);
const helpText = computed(() =>
  isReceivable.value
    ? '只读复用其他应收分页，当前按客户范围展示已登记发生额；员工、其他单位、项目、约定收款日期、账龄、逾期及独立收回/核销/冲销/调整闭环仍待后续扩展。其他应收与销售应收隔离，历史已审核发生额不能直接视为未结余额；本表展示登记发生额和状态参考，不能用“已审核金额 - 已转收付款”直接推导正式余额；本页为参考合计，草稿/待审核只作过程核对，正式余额需按独立往来闭环、期初核对、核销/冲销/调整形成。'
    : '只读复用其他应付分页，当前按供应商范围展示已登记发生额；员工、其他单位、项目、约定付款日期、账龄、逾期及独立支付/核销/冲销/调整闭环仍待后续扩展。其他应付与采购应付隔离，历史已审核发生额不能直接视为未结余额；本表展示登记发生额和状态参考，不能用“已审核金额 - 已转收付款”直接推导正式余额；本页为参考合计，草稿/待审核只作过程核对，正式余额需按独立往来闭环、期初核对、核销/冲销/调整形成。',
);
const gridId = computed(() =>
  isReceivable.value
    ? 'erp-business-report-receivable-misc-list-v1'
    : 'erp-business-report-payable-misc-list-v1',
);

const sortFieldMap = isReceivable.value
  ? RECEIVABLE_MISC_SORT_FIELD_MAP
  : PAYABLE_MISC_SORT_FIELD_MAP;
const { buildSortParams, handleSortChange, restoreSortState } =
  createVxeHeaderSort(sortFieldMap);

const pageSummary = computed(() => ({
  amount: pageRows.value.reduce(
    (total, row) => total + Number(row.amount || 0),
    0,
  ),
  documentCount: pageRows.value.length,
}));

function buildSupplementColumns(): NonNullable<VxeTableGridOptions['columns']> {
  return isReceivable.value
    ? [
        {
          field: 'customerContact',
          title: '客户联系人',
          width: 110,
          showOverflow: 'tooltip' as const,
        },
        {
          field: 'customerMobile',
          title: '客户手机号',
          width: 130,
          showOverflow: 'tooltip' as const,
        },
      ]
    : [
        {
          field: 'supplierContact',
          title: '供应商联系人',
          width: 120,
          showOverflow: 'tooltip' as const,
        },
        {
          field: 'supplierMobile',
          title: '供应商手机号',
          width: 130,
          showOverflow: 'tooltip' as const,
        },
      ];
}

function insertAfterField(
  columns: NonNullable<VxeTableGridOptions['columns']>,
  targetField: string,
  appendColumns: NonNullable<VxeTableGridOptions['columns']>,
) {
  const existingFields = new Set(columns.map((column: any) => column.field));
  const missingColumns = appendColumns.filter(
    (column: any) => !existingFields.has(column.field),
  );
  if (missingColumns.length === 0) return columns;
  const targetIndex = columns.findIndex(
    (column: any) => column.field === targetField,
  );
  const insertIndex = targetIndex === -1 ? columns.length : targetIndex + 1;
  columns.splice(insertIndex, 0, ...missingColumns);
  return columns;
}

function readonlyColumns(columns: NonNullable<VxeTableGridOptions['columns']>) {
  const readonly = columns
    .filter((column: any) => column.type !== 'checkbox')
    .filter(
      (column: any) =>
        column.field !== 'actions' && column.slots?.default !== 'actions',
    )
    .map((column: any) => {
      const nextColumn = { ...column };
      if (!['fileUrl', 'status'].includes(nextColumn.field)) {
        delete nextColumn.slots;
      }
      if (nextColumn.fixed === 'right') delete nextColumn.fixed;
      return nextColumn;
    });
  insertAfterField(
    readonly,
    isReceivable.value ? 'customerName' : 'supplierName',
    buildSupplementColumns(),
  );
  insertAfterField(readonly, 'deptName', [
    {
      field: 'handlerName',
      title: '经办人',
      width: 100,
      showOverflow: 'tooltip' as const,
    },
  ]);
  return readonly;
}

function statusTag(status: unknown) {
  if (Number(status) === 0) return { color: 'warning', label: '草稿' };
  if (Number(status) === 10) return { color: 'processing', label: '待审核' };
  if (Number(status) === 20) return { color: 'success', label: '已审核' };
  return { color: 'default', label: '状态未知' };
}

async function queryPage(params: PageParam & Record<string, any>) {
  const result = isReceivable.value
    ? await getReceivableMiscPage(params)
    : await getPayableMiscPage(params);
  pageRows.value = result.list || [];
  return result;
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
    commonConfig: { labelWidth: 70 },
    schema: withErpKeywordSearchSchema(
      isReceivable.value
        ? useReceivableMiscFormSchema()
        : usePayableMiscFormSchema(),
    ),
    collapsed: true,
    collapsedRows: 1,
  },
  gridOptions: {
    columns: readonlyColumns(
      (isReceivable.value
        ? useReceivableMiscColumns()
        : usePayableMiscColumns()) || [],
    ),
    customConfig: {
      storage: { fixed: true, resizable: true, sort: true, visible: true },
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
  gridEvents: { sortChange: handleSortChange },
});
</script>

<template>
  <div class="counterparty-misc-readonly-table">
    <Grid
      class="counterparty-misc-readonly-table__grid"
      :table-title="tableTitle"
      @keydown.enter.capture="handleSearchEnter"
    >
      <template #status="{ row }">
        <Tag :color="statusTag(row.status).color">
          {{ statusTag(row.status).label }}
        </Tag>
      </template>
      <template #fileUrl="{ row }">
        <a
          v-if="row.fileUrl"
          :href="row.fileUrl"
          target="_blank"
          rel="noopener noreferrer"
        >
          查看
        </a>
        <span v-else>-</span>
      </template>
      <template #bottom>
        <div class="counterparty-misc-readonly-table__summary">
          <b>本页参考合计：</b>
          <span
            >单据数：<b>{{ pageSummary.documentCount }}</b></span
          >
          <span>
            金额：<b>{{ erpPriceInputFormatter(pageSummary.amount) }}</b>
          </span>
        </div>
      </template>
    </Grid>
    <p class="counterparty-misc-readonly-table__hint">{{ helpText }}</p>
  </div>
</template>

<style scoped>
.counterparty-misc-readonly-table {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.counterparty-misc-readonly-table__grid {
  flex: 1 1 auto;
  min-height: 0;
}

.counterparty-misc-readonly-table__hint {
  flex: 0 0 auto;
  margin: 6px 0 0;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  line-height: 18px;
}

.counterparty-misc-readonly-table__summary {
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

.counterparty-misc-readonly-table__summary b {
  color: hsl(var(--foreground));
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

:deep(.counterparty-misc-readonly-table__grid .vxe-grid--pager-wrapper) {
  position: sticky;
  bottom: 0;
  z-index: 5;
  margin-top: 0 !important;
  background: hsl(var(--card));
  box-shadow: 0 -2px 8px rgb(0 0 0 / 8%);
}
</style>
