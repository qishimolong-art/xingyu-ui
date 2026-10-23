<script lang="ts" setup>
import type { VbenFormSchema } from '#/adapter/form';
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpAccountingSubjectApi } from '#/api/erp/finance/accounting/subject';

import { computed, ref } from 'vue';

import { downloadFileFromBlobPart, erpPriceInputFormatter } from '@vben/utils';

import { Button, message, Tag } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  exportFinancialAccountingSubject,
  getFinancialAccountingSubjectPage,
} from '#/api/erp/report/financial-statement';

import {
  BALANCE_DIRECTION_MAP,
  formatAuxiliaryTypes,
  SUBJECT_CATEGORY_MAP,
  SUBJECT_CATEGORY_OPTIONS,
} from '../../../accounting/subject/data';

const pageRows = ref<ErpAccountingSubjectApi.Subject[]>([]);
const exportLoading = ref(false);

const subjectSearchSchema: VbenFormSchema[] = [
  {
    component: 'Input',
    fieldName: 'subjectCode',
    label: '科目编码',
    componentProps: {
      allowClear: true,
      placeholder: '请输入科目编码',
    },
  },
  {
    component: 'Input',
    fieldName: 'subjectName',
    label: '科目名称',
    componentProps: {
      allowClear: true,
      placeholder: '请输入科目名称',
    },
  },
  {
    component: 'Select',
    fieldName: 'subjectCategory',
    label: '科目类型',
    componentProps: {
      allowClear: true,
      options: SUBJECT_CATEGORY_OPTIONS,
      placeholder: '请选择科目类型',
    },
  },
  {
    component: 'Select',
    fieldName: 'enable',
    label: '启用状态',
    componentProps: {
      allowClear: true,
      options: [
        { label: '启用', value: true },
        { label: '禁用', value: false },
      ],
      placeholder: '请选择启用状态',
    },
  },
];

const subjectColumns: VxeTableGridOptions<ErpAccountingSubjectApi.Subject>['columns'] =
  [
    { type: 'seq', title: '序号', width: 54 },
    {
      field: 'subjectCode',
      title: '科目编码',
      width: 120,
      showOverflow: 'tooltip',
    },
    {
      field: 'subjectName',
      title: '科目名称',
      minWidth: 160,
      showOverflow: 'tooltip',
    },
    {
      field: 'shortName',
      title: '科目别名',
      width: 120,
      showOverflow: 'tooltip',
    },
    {
      field: 'subjectCategory',
      title: '科目类型',
      width: 92,
      formatter: ({ cellValue }) =>
        SUBJECT_CATEGORY_MAP[Number(cellValue)] || '-',
    },
    {
      field: 'parentCode',
      title: '父科目编码',
      width: 110,
      showOverflow: 'tooltip',
    },
    {
      field: 'subjectLevel',
      title: '层级',
      width: 72,
    },
    {
      field: 'isLeaf',
      title: '末级',
      width: 72,
      formatter: ({ cellValue }) => (cellValue ? '是' : '否'),
    },
    {
      field: 'balanceDirection',
      title: '余额方向',
      width: 86,
      formatter: ({ cellValue }) =>
        BALANCE_DIRECTION_MAP[Number(cellValue)] || '-',
    },
    {
      field: 'openingBalance',
      title: '期初余额',
      width: 112,
      align: 'right',
      headerAlign: 'right',
      formatter: 'formatAmount2',
    },
    {
      field: 'auxiliaryTypes',
      title: '辅助核算',
      minWidth: 130,
      formatter: ({ cellValue }) => formatAuxiliaryTypes(cellValue),
      showOverflow: 'tooltip',
    },
    {
      field: 'enable',
      title: '状态',
      width: 78,
      slots: { default: 'enable' },
    },
    {
      field: 'remark',
      title: '备注',
      minWidth: 160,
      showOverflow: 'tooltip',
    },
  ];

const pageSummary = computed(() => ({
  count: pageRows.value.length,
  openingBalance: pageRows.value.reduce(
    (sum, row) => sum + Number(row.openingBalance || 0),
    0,
  ),
}));

async function handleExport() {
  exportLoading.value = true;
  try {
    const formValues = (await gridApi.formApi?.getValues?.()) ?? {};
    const data = await exportFinancialAccountingSubject(formValues);
    downloadFileFromBlobPart({
      fileName: '会计科目及辅助核算.xls',
      source: data,
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
    commonConfig: { labelWidth: 72 },
    schema: subjectSearchSchema,
    collapsed: true,
    collapsedRows: 1,
  },
  gridOptions: {
    columns: subjectColumns,
    customConfig: {
      storage: {
        fixed: true,
        resizable: true,
        visible: true,
      },
    },
    height: 'auto',
    id: 'erp-business-report-accounting-subject-readonly-list-v1',
    keepSource: true,
    showHeaderOverflow: 'tooltip',
    showOverflow: 'tooltip',
    scrollX: { enabled: true, gt: 8 },
    scrollY: { enabled: true, gt: 10 },
    proxyConfig: {
      ajax: {
        query: async ({ page }, formValues) => {
          const result = await getFinancialAccountingSubjectPage({
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
  } as VxeTableGridOptions<ErpAccountingSubjectApi.Subject>,
});
</script>

<template>
  <div class="subject-readonly-table">
    <Grid
      class="subject-readonly-table__grid"
      table-title="会计科目及辅助核算"
      @keydown.enter.capture="handleSearchEnter"
    >
      <template #toolbar-tools>
        <Button size="small" :loading="exportLoading" @click="handleExport"
          >导出</Button
        >
      </template>
      <template #enable="{ row }">
        <Tag :color="row.enable ? 'green' : 'default'">
          {{ row.enable ? '启用' : '禁用' }}
        </Tag>
      </template>
      <template #bottom>
        <div class="subject-readonly-table__summary">
          <b>本页合计：</b>
          <span
            >记录数：<b>{{ pageSummary.count }}</b></span
          >
          <span>
            期初余额：<b>{{
              erpPriceInputFormatter(pageSummary.openingBalance)
            }}</b>
          </span>
        </div>
      </template>
    </Grid>
  </div>
</template>

<style scoped>
.subject-readonly-table {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.subject-readonly-table__grid {
  flex: 1 1 auto;
  min-height: 0;
}

.subject-readonly-table__summary {
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

.subject-readonly-table__summary b {
  color: hsl(var(--foreground));
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

:deep(.subject-readonly-table__grid .vxe-table--render-default),
:deep(.subject-readonly-table__grid .vxe-grid--form-wrapper),
:deep(.subject-readonly-table__grid .vxe-toolbar) {
  font-size: 12px;
}

:deep(.subject-readonly-table__grid .vxe-grid--form-wrapper form > .grid) {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

:deep(.subject-readonly-table__grid .vxe-grid--form-wrapper .ant-form-item) {
  margin-bottom: 8px;
}

:deep(.subject-readonly-table__grid .vxe-grid--pager-wrapper) {
  position: sticky;
  bottom: 0;
  z-index: 5;
  margin-top: 0 !important;
  background: hsl(var(--card));
  box-shadow: 0 -2px 8px rgb(0 0 0 / 8%);
}

@media (max-width: 1280px) {
  :deep(.subject-readonly-table__grid .vxe-grid--form-wrapper form > .grid) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
