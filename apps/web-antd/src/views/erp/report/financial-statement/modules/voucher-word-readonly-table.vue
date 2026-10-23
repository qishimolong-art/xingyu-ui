<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpVoucherWordApi } from '#/api/erp/finance/accounting/voucher-word';

import { computed, ref } from 'vue';

import { downloadFileFromBlobPart } from '@vben/utils';

import { Button, message, Tag } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { getFinancialVoucherWordPage } from '#/api/erp/report/financial-statement';

import { useGridFormSchema } from '../../../accounting/voucher-word/data';
import { buildCsvBlob } from './report-export';

const pageRows = ref<ErpVoucherWordApi.VoucherWord[]>([]);
const exportLoading = ref(false);

const voucherWordColumns: VxeTableGridOptions<ErpVoucherWordApi.VoucherWord>['columns'] =
  [
    { type: 'seq', title: '序号', width: 54 },
    {
      field: 'code',
      title: '凭证字代码',
      width: 120,
      showOverflow: 'tooltip',
    },
    {
      field: 'name',
      title: '名称',
      minWidth: 160,
      showOverflow: 'tooltip',
    },
    {
      field: 'enable',
      title: '是否启用',
      width: 90,
      slots: { default: 'enable' },
    },
    {
      field: 'sort',
      title: '排序',
      width: 80,
      align: 'right',
      headerAlign: 'right',
    },
    {
      field: 'remark',
      title: '备注',
      minWidth: 180,
      showOverflow: 'tooltip',
    },
    {
      field: 'createTime',
      title: '创建时间',
      width: 150,
      formatter: 'formatDateTime',
    },
  ];

const pageSummary = computed(() => ({
  count: pageRows.value.length,
  enabledCount: pageRows.value.filter((row) => row.enable).length,
}));

const exportColumns = [
  { field: 'code', title: '凭证字代码' },
  { field: 'name', title: '名称' },
  {
    field: 'enable',
    title: '是否启用',
    formatter: (value: unknown) => (value ? '启用' : '停用'),
  },
  { field: 'sort', title: '排序' },
  { field: 'remark', title: '备注' },
  { field: 'createTime', title: '创建时间' },
];

async function handleExport() {
  exportLoading.value = true;
  try {
    const formValues = (await gridApi.formApi?.getValues?.()) ?? {};
    const result = await getFinancialVoucherWordPage({
      pageNo: 1,
      pageSize: 50_000,
      ...formValues,
    });
    downloadFileFromBlobPart({
      fileName: '凭证字基础资料.csv',
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
    commonConfig: { labelWidth: 82 },
    schema: useGridFormSchema(),
    collapsed: true,
    collapsedRows: 1,
  },
  gridOptions: {
    columns: voucherWordColumns,
    customConfig: {
      storage: {
        fixed: true,
        resizable: true,
        visible: true,
      },
    },
    height: 'auto',
    id: 'erp-business-report-voucher-word-readonly-list-v1',
    keepSource: true,
    showHeaderOverflow: 'tooltip',
    showOverflow: 'tooltip',
    scrollX: { enabled: true, gt: 6 },
    scrollY: { enabled: true, gt: 10 },
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          const result = await getFinancialVoucherWordPage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
          });
          pageRows.value = result.list || [];
          return result;
        },
      },
    },
    rowConfig: { keyField: 'id', isHover: true },
    pagerConfig: { pageSize: 10, pageSizes: [10, 20, 50] },
    toolbarConfig: { refresh: true, search: true, custom: true },
  } as VxeTableGridOptions<ErpVoucherWordApi.VoucherWord>,
});
</script>

<template>
  <div class="voucher-word-readonly-table">
    <Grid
      class="voucher-word-readonly-table__grid"
      table-title="凭证字基础资料"
      @keydown.enter.capture="handleSearchEnter"
    >
      <template #toolbar-tools>
        <Button size="small" :loading="exportLoading" @click="handleExport"
          >导出</Button
        >
      </template>
      <template #enable="{ row }">
        <Tag :color="row.enable ? 'green' : 'default'">
          {{ row.enable ? '启用' : '停用' }}
        </Tag>
      </template>
      <template #bottom>
        <div class="voucher-word-readonly-table__summary">
          <b>本页合计：</b>
          <span
            >记录数：<b>{{ pageSummary.count }}</b></span
          >
          <span
            >启用数：<b>{{ pageSummary.enabledCount }}</b></span
          >
          <span>凭证字用于凭证基础资料核对。</span>
        </div>
      </template>
    </Grid>
  </div>
</template>

<style scoped>
.voucher-word-readonly-table {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.voucher-word-readonly-table__grid {
  flex: 1 1 auto;
  min-height: 0;
}

.voucher-word-readonly-table__summary {
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

.voucher-word-readonly-table__summary b {
  color: hsl(var(--foreground));
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

:deep(.voucher-word-readonly-table__grid .vxe-table--render-default),
:deep(.voucher-word-readonly-table__grid .vxe-grid--form-wrapper),
:deep(.voucher-word-readonly-table__grid .vxe-toolbar) {
  font-size: 12px;
}

:deep(.voucher-word-readonly-table__grid .vxe-grid--form-wrapper form > .grid) {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

:deep(
  .voucher-word-readonly-table__grid .vxe-grid--form-wrapper .ant-form-item
) {
  margin-bottom: 8px;
}

:deep(.voucher-word-readonly-table__grid .vxe-grid--pager-wrapper) {
  position: sticky;
  bottom: 0;
  z-index: 5;
  margin-top: 0 !important;
  background: hsl(var(--card));
  box-shadow: 0 -2px 8px rgb(0 0 0 / 8%);
}

@media (max-width: 1280px) {
  :deep(
    .voucher-word-readonly-table__grid .vxe-grid--form-wrapper form > .grid
  ) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
