<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';

import { ref } from 'vue';

import { downloadFileFromBlobPart } from '@vben/utils';

import { Button } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { exportOperateLog, getOperateLogPage } from '#/api/system/operate-log';
import { createVxeHeaderSort } from '#/views/erp/utils/vxe-header-sort';

import {
  useGridColumns as useOperateLogColumns,
  useGridFormSchema as useOperateLogFormSchema,
} from '../../../../system/operatelog/data';

const operateLogSortFieldMap: Record<string, string> = {
  createTime: 'createTime',
  id: 'id',
  subType: 'subType',
  type: 'type',
  userIp: 'userIp',
};

const pageRows = ref<any[]>([]);

const { buildSortParams, handleSortChange, restoreSortState } =
  createVxeHeaderSort(operateLogSortFieldMap);

function readonlyColumns(columns: NonNullable<VxeTableGridOptions['columns']>) {
  const readonly = columns
    .filter((column: any) => column.type !== 'checkbox')
    .filter((column: any) => column.field !== 'actions')
    .map((column: any) => {
      const nextColumn = { ...column };
      delete nextColumn.slots;
      if (nextColumn.fixed === 'right') delete nextColumn.fixed;
      return nextColumn;
    });
  const existingFields = new Set(readonly.map((column: any) => column.field));
  const auditColumns = [
    {
      field: 'bizId',
      title: '业务ID',
      width: 96,
      showOverflow: 'tooltip',
    },
    {
      field: 'requestMethod',
      title: '请求方式',
      width: 92,
      showOverflow: 'tooltip',
    },
    {
      field: 'requestUrl',
      title: '请求地址',
      minWidth: 220,
      showOverflow: 'tooltip',
    },
    {
      field: 'traceId',
      title: '链路追踪号',
      minWidth: 180,
      showOverflow: 'tooltip',
    },
    {
      field: 'userAgent',
      title: '客户端信息',
      minWidth: 220,
      showOverflow: 'tooltip',
    },
    {
      field: 'extra',
      title: '拓展参数',
      minWidth: 220,
      showOverflow: 'tooltip',
    },
  ].filter((column) => !existingFields.has(column.field));
  const userIpIndex = readonly.findIndex(
    (column: any) => column.field === 'userIp',
  );
  readonly.splice(
    userIpIndex === -1 ? readonly.length : userIpIndex + 1,
    0,
    ...auditColumns,
  );
  return readonly;
}

async function queryPage(params: Record<string, any>) {
  const result = await getOperateLogPage(params as any);
  pageRows.value = result.list || [];
  return { ...result, list: pageRows.value };
}

async function getCurrentQueryParams() {
  const values = await gridApi.formApi.getValues();
  const proxyInfo = gridApi.grid.getProxyInfo();
  return {
    pageNo: proxyInfo?.pager.currentPage || 1,
    pageSize: proxyInfo?.pager.pageSize || 10,
    ...values,
    ...buildSortParams(),
  };
}

async function handleExport() {
  const data = await exportOperateLog(await getCurrentQueryParams());
  downloadFileFromBlobPart({
    fileName: '系统操作日志审计.xlsx',
    source: data,
  });
}

function handleSearchEnter(event: KeyboardEvent) {
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
    schema: useOperateLogFormSchema(),
    collapsed: true,
    collapsedRows: 1,
  },
  gridOptions: {
    columns: readonlyColumns(useOperateLogColumns() || []),
    customConfig: {
      storage: {
        fixed: true,
        resizable: true,
        sort: true,
        visible: true,
      },
    },
    height: 'auto',
    id: 'erp-business-report-operate-log-readonly-v1',
    keepSource: true,
    showHeaderOverflow: 'tooltip',
    showOverflow: 'tooltip',
    scrollX: { enabled: true, gt: 6 },
    scrollY: { enabled: true, gt: 12 },
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
      allowBtn: false,
      multiple: false,
      orders: ['asc', 'desc', null],
      remote: true,
      trigger: 'cell',
    },
    rowConfig: { isCurrent: true, isHover: true, keyField: 'id' },
    toolbarConfig: { custom: true, refresh: true, search: true },
  } as VxeTableGridOptions<any>,
  gridEvents: { sortChange: handleSortChange },
});
</script>

<template>
  <div class="operate-log-readonly-table">
    <Grid
      class="operate-log-readonly-table__grid"
      table-title="系统操作日志审计"
      @keydown.enter.capture="handleSearchEnter"
    >
      <template #toolbar-tools>
        <Button type="primary" size="small" @click="handleExport">导出</Button>
      </template>
      <template #bottom>
        <div class="operate-log-readonly-table__summary">
          <b>本页合计：</b>
          <span
            >日志数：<b>{{ pageRows.length }}</b></span
          >
        </div>
      </template>
    </Grid>
  </div>
</template>

<style scoped>
.operate-log-readonly-table {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.operate-log-readonly-table__grid {
  flex: 1 1 auto;
  min-height: 0;
}

.operate-log-readonly-table__summary {
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

.operate-log-readonly-table__summary b {
  color: hsl(var(--foreground));
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

:deep(.operate-log-readonly-table__grid .vxe-table--render-default),
:deep(.operate-log-readonly-table__grid .vxe-grid--form-wrapper),
:deep(.operate-log-readonly-table__grid .vxe-toolbar) {
  font-size: 12px;
}

:deep(.operate-log-readonly-table__grid .vxe-grid--form-wrapper form > .grid) {
  grid-template-columns: repeat(5, minmax(0, 1fr));
}

:deep(.operate-log-readonly-table__grid .vxe-grid--pager-wrapper) {
  position: sticky;
  bottom: 0;
  z-index: 5;
  margin-top: 0 !important;
  background: hsl(var(--card));
  box-shadow: 0 -2px 8px rgb(0 0 0 / 8%);
}

@media (max-width: 1280px) {
  :deep(
    .operate-log-readonly-table__grid .vxe-grid--form-wrapper form > .grid
  ) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
