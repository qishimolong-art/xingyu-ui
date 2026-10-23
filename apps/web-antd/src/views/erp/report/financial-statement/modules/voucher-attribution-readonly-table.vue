<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpVoucherAttributionApi } from '#/api/erp/finance/accounting/voucher-attribution';

import { computed, ref } from 'vue';

import { downloadFileFromBlobPart, erpPriceInputFormatter } from '@vben/utils';

import { Button, message, Tag } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { STATUS_LABELS } from '#/api/erp/finance/accounting/voucher-rule';
import { getFinancialVoucherAttributionSourcePage } from '#/api/erp/report/financial-statement';

import {
  ATTRIBUTION_STATUS_COLOR,
  ATTRIBUTION_STATUS_MAP,
  SOURCE_BIZ_TYPE_MAP,
  useGridColumns,
  useGridFormSchema,
} from '../../../accounting/voucher-attribution/data';
import { buildCsvBlob } from './report-export';

const pageRows = ref<ErpVoucherAttributionApi.VoucherAttribution[]>([]);
const exportLoading = ref(false);

const attributionColumns = computed<
  VxeTableGridOptions<ErpVoucherAttributionApi.VoucherAttribution>['columns']
>(() =>
  ((useGridColumns() || []) as any[])
    .filter((column) => column.type !== 'checkbox')
    .map((column) => {
      const nextColumn = { ...column };
      if (nextColumn.fixed === 'left') delete nextColumn.fixed;
      return nextColumn;
    }),
);

const pageSummary = computed(() => ({
  bizAmount: pageRows.value.reduce(
    (sum, row) => sum + Number(row.bizAmount || 0),
    0,
  ),
  count: pageRows.value.length,
}));

function getAttributionStatus(status?: number) {
  return status ?? 10;
}

const exportColumns = [
  {
    field: 'bizType',
    title: '业务类型',
    formatter: (value: unknown) =>
      SOURCE_BIZ_TYPE_MAP[Number(value)] || String(value || ''),
  },
  { field: 'bizNo', title: '业务单号' },
  { field: 'bizDate', title: '业务日期' },
  { field: 'transactionParty', title: '往来对象' },
  { field: 'bizAmount', title: '原始金额' },
  { field: 'generationStatus', title: '凭证生成检查' },
  {
    field: 'attributionStatus',
    title: '归属状态',
    formatter: (value: unknown) =>
      ATTRIBUTION_STATUS_MAP[getAttributionStatus(Number(value))] || '未归属',
  },
  { field: 'voucherMakeDate', title: '凭证日期' },
  { field: 'attributionYear', title: '归属年' },
  { field: 'attributionMonth', title: '归属月' },
];

async function handleExport() {
  exportLoading.value = true;
  try {
    const formValues = (await gridApi.formApi?.getValues?.()) ?? {};
    const { bizDate, ...rest } = formValues;
    let bizDateStart: string | undefined;
    let bizDateEnd: string | undefined;
    if (Array.isArray(bizDate) && bizDate.length === 2) {
      bizDateStart = bizDate[0];
      bizDateEnd = bizDate[1];
    }
    const result = await getFinancialVoucherAttributionSourcePage({
      pageNo: 1,
      pageSize: 50_000,
      bizDateStart,
      bizDateEnd,
      ...rest,
    });
    downloadFileFromBlobPart({
      fileName: '凭证归集来源.csv',
      source: buildCsvBlob((result.list || []) as any[], exportColumns),
    });
  } catch (error) {
    console.error(error);
    message.error('导出失败，请稍后重试');
  } finally {
    exportLoading.value = false;
  }
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
    commonConfig: { labelWidth: 78 },
    schema: useGridFormSchema(),
    collapsed: true,
    collapsedRows: 1,
  },
  gridOptions: {
    columns: attributionColumns.value,
    customConfig: {
      storage: {
        fixed: true,
        resizable: true,
        visible: true,
      },
    },
    height: 'auto',
    id: 'erp-business-report-voucher-attribution-readonly-list-v1',
    keepSource: true,
    showHeaderOverflow: 'tooltip',
    showOverflow: 'tooltip',
    scrollX: { enabled: true, gt: 8 },
    scrollY: { enabled: true, gt: 10 },
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          const { bizDate, ...rest } = formValues || {};
          let bizDateStart: string | undefined;
          let bizDateEnd: string | undefined;
          if (Array.isArray(bizDate) && bizDate.length === 2) {
            bizDateStart = bizDate[0];
            bizDateEnd = bizDate[1];
          }
          const result = await getFinancialVoucherAttributionSourcePage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            bizDateStart,
            bizDateEnd,
            ...rest,
          });
          pageRows.value = (result.list || []).map((row) => ({
            ...row,
            id: row.id ?? `${row.bizType}:${row.bizId}`,
          }));
          return { ...result, list: pageRows.value };
        },
      },
    },
    rowConfig: { keyField: 'id', isHover: true, isCurrent: true },
    pagerConfig: { pageSize: 10, pageSizes: [10, 20, 50] },
    toolbarConfig: { refresh: true, search: true, custom: true },
  } as VxeTableGridOptions<ErpVoucherAttributionApi.VoucherAttribution>,
});
</script>

<template>
  <div class="voucher-attribution-readonly-table">
    <Grid
      class="voucher-attribution-readonly-table__grid"
      table-title="凭证归集来源"
      @keydown.enter.capture="handleSearchEnter"
    >
      <template #toolbar-tools>
        <Button size="small" :loading="exportLoading" @click="handleExport"
          >导出</Button
        >
      </template>
      <template #generationStatus="{ row }">
        <Tag>
          {{ STATUS_LABELS[row.generationStatus || 'INCOMPLETE'] || '待补充' }}
        </Tag>
        <span class="voucher-attribution-readonly-table__issues">
          {{ row.generationIssues?.join('；') || '' }}
        </span>
      </template>
      <template #attributionStatus="{ row }">
        <Tag
          :color="
            ATTRIBUTION_STATUS_COLOR[
              getAttributionStatus(row.attributionStatus)
            ] || 'default'
          "
        >
          {{
            ATTRIBUTION_STATUS_MAP[
              getAttributionStatus(row.attributionStatus)
            ] || '未归属'
          }}
        </Tag>
      </template>
      <template #bizType="{ row }">
        {{ SOURCE_BIZ_TYPE_MAP[Number(row.bizType)] || row.bizType || '-' }}
      </template>
      <template #bottom>
        <div class="voucher-attribution-readonly-table__summary">
          <b>本页合计：</b>
          <span
            >记录数：<b>{{ pageSummary.count }}</b></span
          >
          <span>
            原始金额：<b>{{ erpPriceInputFormatter(pageSummary.bizAmount) }}</b>
          </span>
          <span class="voucher-attribution-readonly-table__hint">
            展示业务单据来源、凭证生成检查、归属状态和原始金额。
          </span>
        </div>
      </template>
    </Grid>
  </div>
</template>

<style scoped>
.voucher-attribution-readonly-table {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.voucher-attribution-readonly-table__grid {
  flex: 1 1 auto;
  min-height: 0;
}

.voucher-attribution-readonly-table__summary {
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

.voucher-attribution-readonly-table__summary b {
  color: hsl(var(--foreground));
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.voucher-attribution-readonly-table__hint,
.voucher-attribution-readonly-table__issues {
  color: hsl(var(--muted-foreground));
}

:deep(.voucher-attribution-readonly-table__grid .vxe-table--render-default),
:deep(.voucher-attribution-readonly-table__grid .vxe-grid--form-wrapper),
:deep(.voucher-attribution-readonly-table__grid .vxe-toolbar) {
  font-size: 12px;
}

:deep(
  .voucher-attribution-readonly-table__grid .vxe-grid--form-wrapper form > .grid
) {
  grid-template-columns: repeat(5, minmax(0, 1fr));
}

:deep(
  .voucher-attribution-readonly-table__grid
    .vxe-grid--form-wrapper
    .ant-form-item
) {
  margin-bottom: 8px;
}

:deep(.voucher-attribution-readonly-table__grid .vxe-grid--pager-wrapper) {
  position: sticky;
  bottom: 0;
  z-index: 5;
  margin-top: 0 !important;
  background: hsl(var(--card));
  box-shadow: 0 -2px 8px rgb(0 0 0 / 8%);
}

@media (max-width: 1280px) {
  :deep(
    .voucher-attribution-readonly-table__grid
      .vxe-grid--form-wrapper
      form
      > .grid
  ) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
