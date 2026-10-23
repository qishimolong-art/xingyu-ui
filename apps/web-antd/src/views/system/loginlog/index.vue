<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { SystemLoginLogApi } from '#/api/system/login-log';

import { ref } from 'vue';

import { DocAlert, Page, useVbenModal } from '@vben/common-ui';
import { downloadFileFromBlobPart } from '@vben/utils';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import { exportLoginLog, getLoginLogPage } from '#/api/system/login-log';
import { $t } from '#/locales';

import { useGridColumns, useGridFormSchema } from './data';
import Detail from './modules/detail.vue';

const LOGIN_SUCCESS_RESULT = 0;

const loginLogSortFieldMap: Record<string, string> = {
  id: 'id',
  logType: 'logType',
  username: 'username',
  userIp: 'userIp',
  userAgent: 'userAgent',
  result: 'result',
  createTime: 'createTime',
};

type LoginLogSortParams = Pick<
  SystemLoginLogApi.LoginLogPageParams,
  'orderDirection' | 'orderField'
>;

function buildLoginLogSortParams(
  sorts?: any | any[],
  sort?: any,
): LoginLogSortParams {
  let sortList: any[] = [];
  if (Array.isArray(sorts)) {
    sortList = sorts;
  } else if (sorts) {
    sortList = [sorts];
  } else if (sort) {
    sortList = [sort];
  }
  const activeSort = sortList.find((item) => item?.order);
  const orderField = loginLogSortFieldMap[activeSort?.field];
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

const activeSortParams = ref<LoginLogSortParams>({});

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
  const data = await exportLoginLog({
    ...(await gridApi.formApi.getValues()),
    ...activeSortParams.value,
  });
  downloadFileFromBlobPart({ fileName: '登录日志.xls', source: data });
}

/** 查看登录日志详情 */
function handleDetail(row: SystemLoginLogApi.LoginLog) {
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
  row: SystemLoginLogApi.LoginLog;
}) {
  if (isIgnoredDetailClick(column, $event)) {
    return;
  }
  handleDetail(row);
}

/** 输入框回车查询，选择器和日期控件保留原生交互 */
function handleSearchEnter(event: KeyboardEvent) {
  if (event.isComposing) {
    return;
  }
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

function getLoginLogRowClassName({ row }: { row: SystemLoginLogApi.LoginLog }) {
  return row.result === LOGIN_SUCCESS_RESULT ? '' : 'login-log-row--failed';
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
          activeSortParams.value = buildLoginLogSortParams(sorts, sort);
          return await getLoginLogPage({
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
    rowClassName: getLoginLogRowClassName,
    toolbarConfig: {
      refresh: true,
      search: true,
    },
  } as VxeTableGridOptions<SystemLoginLogApi.LoginLog>,
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
      class="login-log-grid"
      table-title="登录日志列表"
      @keydown.enter.capture="handleSearchEnter"
    >
      <template #toolbar-tools>
        <TableAction
          :actions="[
            {
              label: $t('ui.actionTitle.export'),
              type: 'primary',
              icon: ACTION_ICON.DOWNLOAD,
              auth: ['system:login-log:export'],
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
              auth: ['system:login-log:query'],
              onClick: handleDetail.bind(null, row),
            },
          ]"
        />
      </template>
      <template #bottom>
        <div class="login-log-grid__legend">
          <span class="login-log-grid__failed-swatch"></span>
          <span>浅红色背景表示登录失败，白色背景表示登录成功</span>
        </div>
      </template>
    </Grid>
  </Page>
</template>

<style scoped>
:deep(.login-log-grid .vxe-table--render-default),
:deep(.login-log-grid .vxe-grid--form-wrapper),
:deep(.login-log-grid .vxe-toolbar),
.login-log-grid__legend {
  font-size: 12px;
}

@media (min-width: 1280px) {
  :deep(.login-log-grid .vxe-grid--form-wrapper form > .grid) {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}

:deep(.login-log-grid .vxe-grid--form-wrapper .ant-form-item) {
  margin-bottom: 8px;
}

:deep(.login-log-grid .vxe-grid--form-wrapper label),
:deep(.login-log-grid .vxe-grid--form-wrapper .ant-input),
:deep(.login-log-grid .vxe-grid--form-wrapper .ant-picker),
:deep(.login-log-grid .vxe-grid--form-wrapper .ant-picker-input > input),
:deep(.login-log-grid .vxe-grid--form-wrapper .ant-select),
:deep(.login-log-grid .vxe-grid--form-wrapper .ant-btn),
:deep(.login-log-grid .vxe-grid--form-wrapper .vben-link) {
  font-size: 12px;
}

:deep(.login-log-grid .vxe-grid--form-wrapper label) {
  line-height: 20px;
}

:deep(.login-log-grid .vxe-grid--form-wrapper .ant-input-affix-wrapper) {
  min-height: 28px;
  padding: 2px 8px;
  font-size: 12px;
}

:deep(
  .login-log-grid .vxe-grid--form-wrapper .ant-input-affix-wrapper .ant-input
) {
  line-height: 22px;
}

:deep(.login-log-grid .vxe-grid--form-wrapper .ant-select-single) {
  height: 28px;
}

:deep(
  .login-log-grid
    .vxe-grid--form-wrapper
    .ant-select-single
    .ant-select-selector
) {
  height: 28px;
  padding: 0 8px;
  font-size: 12px;
}

:deep(
  .login-log-grid
    .vxe-grid--form-wrapper
    .ant-select-single
    .ant-select-selection-search-input
) {
  height: 26px;
}

:deep(
  .login-log-grid
    .vxe-grid--form-wrapper
    .ant-select-single
    .ant-select-selection-item
),
:deep(
  .login-log-grid
    .vxe-grid--form-wrapper
    .ant-select-single
    .ant-select-selection-placeholder
) {
  line-height: 26px;
}

:global(.login-log-search-select-dropdown .ant-select-item),
:global(.login-log-search-select-dropdown .ant-empty-description) {
  font-size: 12px;
}

:deep(.login-log-grid .vxe-grid--form-wrapper .ant-picker) {
  height: 28px;
  padding: 2px 8px;
}

:deep(.login-log-grid .vxe-grid--form-wrapper .ant-btn),
:deep(.login-log-grid .vxe-toolbar .table-actions .ant-btn) {
  height: 28px;
  padding: 2px 10px;
  font-size: 12px;
  line-height: 20px;
}

:deep(.login-log-grid .vxe-toolbar .vxe-button) {
  box-sizing: border-box;
  width: 28px !important;
  min-width: 28px !important;
  height: 28px;
  padding: 0;
  font-size: 12px;
}

:deep(.login-log-grid .vxe-header--column) {
  height: 34px;
}

:deep(.login-log-grid .vxe-body--row) {
  height: 36px;
}

:deep(.login-log-grid .vxe-header--column .vxe-cell--title) {
  white-space: nowrap;
}

:deep(.login-log-grid .vxe-header--column.is--sortable .vxe-cell--title) {
  color: #1677ff;
}

:deep(.login-log-grid .vxe-header--column .vxe-cell--sort) {
  display: none;
}

:deep(.login-log-grid .vxe-body--column .table-actions .ant-btn-link) {
  height: auto;
  padding: 0;
  font-size: 12px;
}

:deep(.login-log-grid .vxe-body--row) {
  cursor: pointer;
}

:deep(.login-log-grid .vxe-body--column .table-actions) {
  cursor: default;
}

:deep(
  .login-log-grid .vxe-body--row.login-log-row--failed > .vxe-body--column
) {
  color: hsl(var(--destructive));
  background-color: hsl(var(--destructive) / 9%);
}

:deep(
  .login-log-grid
    .vxe-body--row.login-log-row--failed.row--hover
    > .vxe-body--column
) {
  background-color: hsl(var(--destructive) / 15%);
}

.login-log-grid__legend {
  display: flex;
  gap: 7px;
  align-items: center;
  min-height: 36px;
  padding: 5px 8px;
  color: hsl(var(--muted-foreground));
  border-top: 1px solid hsl(var(--border));
}

.login-log-grid__failed-swatch {
  width: 14px;
  height: 14px;
  background-color: hsl(var(--destructive) / 9%);
  border: 1px solid hsl(var(--destructive) / 55%);
}

:deep(.login-log-grid .vxe-grid--bottom-wrapper) {
  position: sticky;
  bottom: 36px;
  z-index: 4;
  background: hsl(var(--card));
}

:deep(.login-log-grid .vxe-grid--pager-wrapper) {
  position: sticky;
  bottom: 0;
  z-index: 5;
  margin-top: 0 !important;
  background: hsl(var(--card));
  box-shadow: 0 -2px 8px rgb(0 0 0 / 8%);
}
</style>
