<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpBaseDataApi } from '#/api/erp/base';

import { onActivated, onMounted, ref, watch } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { CommonStatusEnum } from '@vben/constants';

import { message } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import { deleteBaseData, getBaseDataPage } from '#/api/erp/base';
import { useFieldPermission } from '#/composables/useFieldPermission';
import { $t } from '#/locales';
import { useBaseShortcut } from '#/views/erp/composables/useBaseShortcut';
import { queueFocusArchiveSearchInput } from '#/views/erp/base/utils/archive-search-focus';
import { submitSearchFormOnEnterAndBlur } from '#/views/erp/utils/keyboard';
import { createVxeHeaderSort } from '#/views/erp/utils/vxe-header-sort';

import { useGridColumns, useGridFormSchema } from '../data';
import Form from '../modules/form.vue';

const props = defineProps<{
  embedded?: boolean;
  title: string;
  type: string;
}>();
const { hiddenFields, loadHiddenFields } = useFieldPermission('erp_base_data');
const baseDataGridShellRef = ref<HTMLElement>();
const currentPageRows = ref<ErpBaseDataApi.BaseData[]>([]);

const baseDataSortFieldMap: Record<string, string> = {
  id: 'id',
  name: 'name',
  code: 'code',
  sort: 'sort',
  status: 'status',
  createTime: 'createTime',
};
const { buildSortParams, handleSortChange, restoreSortState } =
  createVxeHeaderSort(baseDataSortFieldMap);

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

/** 刷新表格 */
function handleRefresh() {
  gridApi.query();
}

/** 创建 */
function handleCreate() {
  formModalApi.setData({ type: props.type, title: props.title }).open();
}

useBaseShortcut({
  onCreate: handleCreate,
});

/** 编辑 */
function handleEdit(row: ErpBaseDataApi.BaseData) {
  formModalApi.setData({ type: props.type, title: props.title, row }).open();
}

/** 删除 */
async function handleDelete(row: ErpBaseDataApi.BaseData) {
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting', [row.name]),
    duration: 0,
  });
  try {
    await deleteBaseData(row.id as number);
    message.success($t('ui.actionMessage.deleteSuccess', [row.name]));
    handleRefresh();
  } finally {
    hideLoading();
  }
}

function handleSearchEnter(event: KeyboardEvent) {
  submitSearchFormOnEnterAndBlur(event, () => gridApi.formApi.submitForm());
}

function getRowClassName({ row }: { row: ErpBaseDataApi.BaseData }) {
  return row.status === CommonStatusEnum.DISABLE
    ? 'erp-disabled-row-highlight'
    : '';
}

async function reloadBaseDataColumns(
  rows: ErpBaseDataApi.BaseData[] = currentPageRows.value,
) {
  const columns = useGridColumns(hiddenFields.value, rows);
  await gridApi.grid?.reloadColumn?.(columns as any[]);
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    commonConfig: { labelWidth: 68 },
    schema: useGridFormSchema(),
  },
  gridOptions: {
    columns: useGridColumns(hiddenFields.value, currentPageRows.value),
    fit: false,
    height: 'auto',
    id: `erp-base-data-list-v2-${props.type}`,
    keepSource: true,
    showHeaderOverflow: 'tooltip',
    showOverflow: 'tooltip',
    scrollX: {
      enabled: true,
      gt: 6,
    },
    proxyConfig: {
      sort: true,
      ajax: {
        query: async ({ page, sort, sorts }, formValues) => {
          const sortParams = buildSortParams(sorts, sort);
          const result = await getBaseDataPage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            type: props.type,
            ...formValues,
            ...sortParams,
          });
          currentPageRows.value = result.list ?? [];
          await reloadBaseDataColumns(currentPageRows.value);
          return result;
        },
        querySuccess: () => {
          void restoreSortState(gridApi);
        },
      },
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
    rowClassName: getRowClassName,
    toolbarConfig: {
      refresh: true,
      search: true,
    },
  } as VxeTableGridOptions<ErpBaseDataApi.BaseData>,
  gridEvents: {
    sortChange: handleSortChange,
  },
});

onMounted(async () => {
  queueFocusArchiveSearchInput(baseDataGridShellRef);
  await loadHiddenFields();
  await reloadBaseDataColumns();
  queueFocusArchiveSearchInput(baseDataGridShellRef);
});

onActivated(() => {
  queueFocusArchiveSearchInput(baseDataGridShellRef);
});

watch(
  () => props.type,
  () => {
    currentPageRows.value = [];
    gridApi.query();
  },
);

defineExpose({
  refresh: handleRefresh,
});
</script>

<template>
  <div
    v-if="props.embedded"
    ref="baseDataGridShellRef"
    class="base-data-grid-shell h-full min-h-0"
  >
    <FormModal @success="handleRefresh" />
    <Grid
      class="base-data-grid"
      :table-title="`${props.title}列表`"
      @keydown.enter.capture="handleSearchEnter"
    >
      <template #toolbar-tools>
        <TableAction
          :actions="[
            {
              label: $t('ui.actionTitle.create', [props.title]),
              type: 'primary',
              icon: ACTION_ICON.ADD,
              tooltip: 'Insert 新增',
              title: 'Insert 新增',
              auth: [`erp:base-data:create`],
              onClick: handleCreate,
            },
          ]"
        />
      </template>
      <template #actions="{ row }">
        <TableAction
          :actions="[
            {
              label: $t('common.edit'),
              type: 'link',
              icon: ACTION_ICON.EDIT,
              auth: [`erp:base-data:update`],
              onClick: handleEdit.bind(null, row),
            },
            {
              label: $t('common.delete'),
              type: 'link',
              danger: true,
              icon: ACTION_ICON.DELETE,
              auth: [`erp:base-data:delete`],
              popConfirm: {
                title: $t('ui.actionMessage.deleteConfirm', [row.name]),
                confirm: handleDelete.bind(null, row),
              },
            },
          ]"
        />
      </template>
      <template #bottom>
        <div class="base-data-grid__legend">
          <span class="base-data-grid__disabled-swatch"></span>
          <span>浅黄色背景和红色文字表示该选项已停用</span>
        </div>
      </template>
    </Grid>
  </div>
  <Page v-else auto-content-height>
    <FormModal @success="handleRefresh" />
    <div ref="baseDataGridShellRef" class="base-data-grid-shell h-full min-h-0">
      <Grid
        class="base-data-grid"
        :table-title="`${props.title}列表`"
        @keydown.enter.capture="handleSearchEnter"
      >
        <template #toolbar-tools>
          <TableAction
            :actions="[
              {
                label: $t('ui.actionTitle.create', [props.title]),
                type: 'primary',
                icon: ACTION_ICON.ADD,
                tooltip: 'Insert 新增',
                title: 'Insert 新增',
                auth: [`erp:base-data:create`],
                onClick: handleCreate,
              },
            ]"
          />
        </template>
        <template #actions="{ row }">
          <TableAction
            :actions="[
              {
                label: $t('common.edit'),
                type: 'link',
                icon: ACTION_ICON.EDIT,
                auth: [`erp:base-data:update`],
                onClick: handleEdit.bind(null, row),
              },
              {
                label: $t('common.delete'),
                type: 'link',
                danger: true,
                icon: ACTION_ICON.DELETE,
                auth: [`erp:base-data:delete`],
                popConfirm: {
                  title: $t('ui.actionMessage.deleteConfirm', [row.name]),
                  confirm: handleDelete.bind(null, row),
                },
              },
            ]"
          />
        </template>
        <template #bottom>
          <div class="base-data-grid__legend">
            <span class="base-data-grid__disabled-swatch"></span>
            <span>浅黄色背景和红色文字表示该选项已停用</span>
          </div>
        </template>
      </Grid>
    </div>
  </Page>
</template>

<style scoped>
:deep(.base-data-grid .vxe-table--render-default),
:deep(.base-data-grid .vxe-grid--form-wrapper),
:deep(.base-data-grid .vxe-toolbar) {
  font-size: 12px;
}

@media (min-width: 1280px) {
  :deep(.base-data-grid .vxe-grid--form-wrapper form > .grid) {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}

:deep(.base-data-grid .vxe-grid--form-wrapper .ant-form-item) {
  margin-bottom: 8px;
}

:deep(.base-data-grid .vxe-grid--form-wrapper label),
:deep(.base-data-grid .vxe-grid--form-wrapper .ant-input),
:deep(.base-data-grid .vxe-grid--form-wrapper .ant-select),
:deep(.base-data-grid .vxe-grid--form-wrapper .ant-btn) {
  font-size: 12px;
}

:deep(.base-data-grid .vxe-grid--form-wrapper .ant-input-affix-wrapper) {
  min-height: 28px;
  padding: 2px 8px;
}

:deep(.base-data-grid .vxe-grid--form-wrapper .ant-select-single),
:deep(
  .base-data-grid
    .vxe-grid--form-wrapper
    .ant-select-single
    .ant-select-selector
) {
  height: 28px;
  min-height: 28px;
}

:deep(
  .base-data-grid
    .vxe-grid--form-wrapper
    .ant-select-single
    .ant-select-selection-item
),
:deep(
  .base-data-grid
    .vxe-grid--form-wrapper
    .ant-select-single
    .ant-select-selection-placeholder
) {
  line-height: 26px;
}

:deep(.base-data-grid .vxe-grid--form-wrapper .ant-btn),
:deep(.base-data-grid .vxe-toolbar .table-actions .ant-btn) {
  height: 28px;
  padding: 2px 10px;
  font-size: 12px;
}

:deep(.base-data-grid .vxe-toolbar .vxe-button) {
  box-sizing: border-box;
  width: 28px !important;
  min-width: 28px !important;
  height: 28px;
  padding: 0;
  font-size: 12px;
}

:deep(.base-data-grid .vxe-header--column) {
  height: 34px;
  font-size: 12px;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
}

:deep(.base-data-grid .vxe-header--column .vxe-cell--title) {
  white-space: nowrap;
}

:deep(.base-data-grid .vxe-header--column.is--sortable .vxe-cell--title) {
  color: #1677ff;
}

:deep(.base-data-grid .vxe-header--column .vxe-cell--sort) {
  display: none;
}

:deep(.base-data-grid .vxe-body--column) {
  height: 36px;
  font-size: 12px;
  line-height: 20px;
}

:deep(.base-data-grid .vxe-body--column .table-actions .ant-btn-link) {
  height: auto;
  padding: 0;
  font-size: 12px;
}

:deep(.base-data-grid .erp-disabled-row-highlight > td) {
  font-weight: 600;
  color: #dc2626;
  background-color: rgb(245 158 11 / 16%);
}

:deep(.base-data-grid .erp-disabled-row-highlight:hover > td) {
  background-color: rgb(245 158 11 / 24%);
}

:deep(.base-data-grid .erp-disabled-row-highlight > td .vxe-cell) {
  font-weight: inherit;
  color: inherit;
}

.base-data-grid__legend {
  display: flex;
  gap: 6px;
  align-items: center;
  min-height: 32px;
  padding: 6px 12px;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  background: hsl(var(--card));
  border-top: 1px solid hsl(var(--border));
}

.base-data-grid__disabled-swatch {
  width: 14px;
  height: 10px;
  background: rgb(245 158 11 / 20%);
  border: 1px solid rgb(220 38 38 / 55%);
  border-radius: 2px;
}

:global(.base-data-search-select-dropdown .ant-select-item),
:global(.base-data-search-select-dropdown .ant-empty-description) {
  font-size: 12px;
}
</style>
