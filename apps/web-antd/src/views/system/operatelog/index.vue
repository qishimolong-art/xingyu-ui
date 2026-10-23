<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SystemOperateLogApi } from '#/api/system/operate-log';

import { DocAlert, Page, useVbenModal } from '@vben/common-ui';
import { downloadFileFromBlobPart } from '@vben/utils';

import { ref } from 'vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import { exportOperateLog, getOperateLogPage } from '#/api/system/operate-log';
import { $t } from '#/locales';

import { useGridColumns, useGridFormSchema } from './data';
import Detail from './modules/detail.vue';

const operateLogSortFieldMap: Record<string, string> = {
  id: 'id',
  type: 'type',
  subType: 'subType',
  createTime: 'createTime',
  userIp: 'userIp',
};

type OperateLogSortParams = Pick<
  SystemOperateLogApi.OperateLogPageParams,
  'orderDirection' | 'orderField'
>;

function buildOperateLogSortParams(
  sorts?: any | any[],
  sort?: any,
): OperateLogSortParams {
  const sortList = Array.isArray(sorts)
    ? sorts
    : sorts
      ? [sorts]
      : sort
        ? [sort]
        : [];
  const activeSort = sortList.find((item) => item?.order);
  const orderField = operateLogSortFieldMap[activeSort?.field];
  const orderDirection =
    activeSort?.order === 'asc' || activeSort?.order === 'desc'
      ? activeSort.order
      : undefined;

  return orderField && orderDirection
    ? {
        orderField,
        orderDirection,
      }
    : {};
}

const activeSortParams = ref<OperateLogSortParams>({});

const [DetailModal, detailModalApi] = useVbenModal({
  connectedComponent: Detail,
  destroyOnClose: true,
});

/** 刷新表格 */
function handleRefresh() {
  gridApi.query();
}

/** 导出表格 */
async function handleExport() {
  const data = await exportOperateLog({
    ...(await gridApi.formApi.getValues()),
    ...activeSortParams.value,
  });
  downloadFileFromBlobPart({ fileName: '操作日志.xls', source: data });
}

/** 查看操作日志详情 */
function handleDetail(row: SystemOperateLogApi.OperateLog) {
  detailModalApi.setData(row).open();
}

function isIgnoredDetailClick(column: any, event?: MouseEvent) {
  const target = event?.target;
  if (
    column?.type === 'checkbox' ||
    column?.field === 'actions' ||
    column?.slots?.default === 'actions'
  ) {
    return true;
  }
  return (
    target instanceof HTMLElement &&
    !!target.closest('button,a,input,.ant-btn,.table-actions')
  );
}

function handleCellClick({
  $event,
  column,
  row,
}: {
  $event?: MouseEvent;
  column: any;
  row: SystemOperateLogApi.OperateLog;
}) {
  if (isIgnoredDetailClick(column, $event)) {
    return;
  }
  handleDetail(row);
}

/** 输入框回车查询，选择器和日期控件保留原生交互 */
function handleSearchEnter(event: KeyboardEvent) {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }
  if (target.closest('.ant-picker, .ant-select')) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  void gridApi.formApi.submitForm();
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    commonConfig: { labelWidth: 68 },
    schema: useGridFormSchema(),
  },
  gridOptions: {
    columns: useGridColumns(),
    height: 'auto',
    keepSource: true,
    showHeaderOverflow: 'tooltip',
    showOverflow: 'tooltip',
    scrollX: {
      enabled: true,
      gt: 6,
    },
    scrollY: {
      enabled: true,
      gt: 12,
    },
    proxyConfig: {
      ajax: {
        query: async ({ page, sort, sorts }, formValues) => {
          activeSortParams.value = buildOperateLogSortParams(sorts, sort);
          return await getOperateLogPage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
            ...activeSortParams.value,
          });
        },
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
    rowConfig: {
      keyField: 'id',
      isHover: true,
    },
    toolbarConfig: {
      refresh: true,
      search: true,
    },
  } as VxeTableGridOptions<SystemOperateLogApi.OperateLog>,
  gridEvents: {
    cellClick: handleCellClick,
  },
});
</script>

<template>
  <Page auto-content-height>
    <template #doc>
      <DocAlert title="系统日志" url="https://doc.iocoder.cn/system-log/" />
    </template>

    <DetailModal @success="handleRefresh" />
    <Grid
      class="operate-log-grid"
      table-title="操作日志列表"
      @keydown.enter.capture="handleSearchEnter"
    >
      <template #toolbar-tools>
        <TableAction
          :actions="[
            {
              label: $t('ui.actionTitle.export'),
              type: 'primary',
              icon: ACTION_ICON.DOWNLOAD,
              auth: ['system:operate-log:export'],
              onClick: handleExport,
            },
          ]"
        />
      </template>
      <template #actions="{ row }">
        <TableAction
          :actions="[
            {
              label: $t('common.detail'),
              type: 'link',
              icon: ACTION_ICON.VIEW,
              auth: ['system:operate-log:query'],
              onClick: handleDetail.bind(null, row),
            },
          ]"
        />
      </template>
    </Grid>
  </Page>
</template>

<style scoped>
:deep(.operate-log-grid .vxe-table--render-default),
:deep(.operate-log-grid .vxe-grid--form-wrapper) {
  font-size: 12px;
}

@media (min-width: 1280px) {
  :deep(.operate-log-grid .vxe-grid--form-wrapper form > .grid) {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}

:deep(.operate-log-grid .vxe-grid--form-wrapper label),
:deep(.operate-log-grid .vxe-grid--form-wrapper .ant-input),
:deep(.operate-log-grid .vxe-grid--form-wrapper .ant-picker),
:deep(.operate-log-grid .vxe-grid--form-wrapper .ant-picker-input > input),
:deep(.operate-log-grid .vxe-grid--form-wrapper .ant-select),
:deep(.operate-log-grid .vxe-grid--form-wrapper .ant-btn),
:deep(.operate-log-grid .vxe-grid--form-wrapper .vben-link) {
  font-size: 12px;
}

:deep(.operate-log-grid .vxe-grid--form-wrapper label) {
  line-height: 20px;
}

:deep(.operate-log-grid .vxe-grid--form-wrapper .ant-input-affix-wrapper) {
  min-height: 28px;
  padding: 2px 8px;
  font-size: 12px;
}

:deep(
  .operate-log-grid .vxe-grid--form-wrapper .ant-input-affix-wrapper .ant-input
) {
  line-height: 22px;
}

:deep(.operate-log-grid .vxe-grid--form-wrapper .ant-select-single) {
  height: 28px;
}

:deep(
  .operate-log-grid
    .vxe-grid--form-wrapper
    .ant-select-single
    .ant-select-selector
) {
  height: 28px;
  padding: 0 8px;
  font-size: 12px;
}

:deep(
  .operate-log-grid
    .vxe-grid--form-wrapper
    .ant-select-single
    .ant-select-selection-search-input
) {
  height: 26px;
}

:deep(
  .operate-log-grid
    .vxe-grid--form-wrapper
    .ant-select-single
    .ant-select-selection-item
),
:deep(
  .operate-log-grid
    .vxe-grid--form-wrapper
    .ant-select-single
    .ant-select-selection-placeholder
) {
  line-height: 26px;
}

:global(.operate-log-search-select-dropdown .ant-select-item),
:global(.operate-log-search-select-dropdown .ant-empty-description) {
  font-size: 12px;
}

:deep(.operate-log-grid .vxe-grid--form-wrapper .ant-picker) {
  height: 28px;
  padding: 2px 8px;
}

:deep(.operate-log-grid .vxe-grid--form-wrapper .ant-btn),
:deep(.operate-log-grid .vxe-toolbar .table-actions .ant-btn) {
  height: 28px;
  padding: 2px 10px;
  font-size: 12px;
  line-height: 20px;
}

:deep(.operate-log-grid .vxe-toolbar .vxe-button) {
  box-sizing: border-box;
  width: 28px !important;
  min-width: 28px !important;
  height: 28px;
  padding: 0;
  font-size: 12px;
}

:deep(.operate-log-grid .vxe-header--column .vxe-cell--title) {
  white-space: nowrap;
}

:deep(.operate-log-grid .vxe-header--column.is--sortable .vxe-cell--title) {
  color: #1677ff;
}

:deep(.operate-log-grid .vxe-header--column .vxe-cell--sort) {
  display: none;
}

:deep(.operate-log-grid .vxe-body--column .table-actions .ant-btn-link) {
  height: auto;
  padding: 0;
  font-size: 12px;
}

:deep(.operate-log-grid .vxe-body--row) {
  cursor: pointer;
}

:deep(.operate-log-grid .vxe-body--column .table-actions) {
  cursor: default;
}

:deep(.operate-log-grid .vxe-grid--pager-wrapper) {
  position: sticky;
  z-index: 5;
  bottom: 0;
  margin-top: 0 !important;
  background: hsl(var(--card));
  box-shadow: 0 -2px 8px rgb(0 0 0 / 8%);
}
</style>
