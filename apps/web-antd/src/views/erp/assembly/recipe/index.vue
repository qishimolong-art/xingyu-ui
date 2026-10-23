<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpAssemblyRecipeApi } from '#/api/erp/assembly/recipe';

import { Page, useVbenModal } from '@vben/common-ui';

import { message, Tag } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deleteAssemblyRecipe,
  getAssemblyRecipePage,
} from '#/api/erp/assembly/recipe';

import { useGridColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

defineOptions({ name: 'ErpAssemblyRecipe' });

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});
function refresh() {
  gridApi.query();
}

function openCreate() {
  formModalApi.setData(null).open();
}

function openView(row: ErpAssemblyRecipeApi.Recipe) {
  formModalApi.setData({ ...row, readonly: true }).open();
}

async function remove(row: ErpAssemblyRecipeApi.Recipe) {
  await deleteAssemblyRecipe(row.id!);
  message.success('删除成功');
  refresh();
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    commonConfig: { labelWidth: 72 },
    schema: useGridFormSchema(),
  },
  gridOptions: {
    columns: useGridColumns(),
    height: 'auto',
    showOverflow: 'tooltip',
    proxyConfig: {
      ajax: {
        query: async ({ page }, values) =>
          getAssemblyRecipePage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            ...values,
          }),
      },
    },
    rowConfig: { keyField: 'id', isHover: true },
    toolbarConfig: { refresh: true, search: true },
  } as VxeTableGridOptions<ErpAssemblyRecipeApi.Recipe>,
});
</script>

<template>
  <Page auto-content-height class="assembly-recipe-page">
    <FormModal @success="refresh" />
    <Grid class="assembly-recipe-grid" table-title="模块管理">
      <template #toolbar-tools>
        <TableAction
          :actions="[
            {
              label: '新增模块',
              type: 'primary',
              icon: ACTION_ICON.ADD,
              auth: ['erp:assembly-recipe:create'],
              onClick: openCreate,
            },
          ]"
        />
      </template>
      <template #status="{ row }">
        <Tag :color="row.status === 1 ? 'success' : 'default'">
          {{ row.status === 1 ? '启用' : '停用' }}
        </Tag>
      </template>
      <template #purpose>装配</template>
      <template #moduleCode="{ row }">
        <button
          type="button"
          class="assembly-module-code-link"
          :title="row.moduleCode || ''"
          @click.stop="openView(row)"
        >
          {{ row.moduleCode || '-' }}
        </button>
      </template>
      <template #actions="{ row }">
        <TableAction
          :actions="[
            {
              label: '删除',
              type: 'link',
              danger: true,
              icon: ACTION_ICON.DELETE,
              auth: ['erp:assembly-recipe:delete'],
              popConfirm: {
                title: '只能删除未被组装单引用的配方，确认删除？',
                confirm: () => remove(row),
              },
            },
          ]"
        />
      </template>
    </Grid>
  </Page>
</template>

<style scoped>
.assembly-recipe-page {
  font-size: 12px;
}

:deep(.assembly-recipe-grid .vxe-table--render-default),
:deep(.assembly-recipe-grid .vxe-grid--form-wrapper),
:deep(.assembly-recipe-grid .vxe-toolbar),
:deep(.assembly-recipe-grid .vxe-grid--pager-wrapper) {
  font-size: 12px;
}

:deep(.assembly-recipe-grid .vxe-grid--form-wrapper .ant-form-item) {
  margin-bottom: 8px;
}

:deep(.assembly-recipe-grid .vxe-grid--form-wrapper label),
:deep(.assembly-recipe-grid .vxe-grid--form-wrapper .ant-input),
:deep(.assembly-recipe-grid .vxe-grid--form-wrapper .ant-select),
:deep(.assembly-recipe-grid .vxe-grid--form-wrapper .ant-btn),
:deep(.assembly-recipe-grid .vxe-grid--form-wrapper .vben-link) {
  font-size: 12px;
}

:deep(.assembly-recipe-grid .vxe-grid--form-wrapper .ant-input-affix-wrapper) {
  min-height: 28px;
  padding: 2px 8px;
  font-size: 12px;
}

:deep(
  .assembly-recipe-grid
    .vxe-grid--form-wrapper
    .ant-input-affix-wrapper
    .ant-input
) {
  line-height: 22px;
}

:deep(.assembly-recipe-grid .vxe-grid--form-wrapper .ant-select-single),
:deep(
  .assembly-recipe-grid
    .vxe-grid--form-wrapper
    .ant-select-single
    .ant-select-selector
) {
  height: 28px;
  min-height: 28px;
}

:deep(
  .assembly-recipe-grid
    .vxe-grid--form-wrapper
    .ant-select-single
    .ant-select-selection-item
),
:deep(
  .assembly-recipe-grid
    .vxe-grid--form-wrapper
    .ant-select-single
    .ant-select-selection-placeholder
) {
  font-size: 12px;
  line-height: 26px;
}

:deep(.assembly-recipe-grid .vxe-grid--form-wrapper .ant-btn),
:deep(.assembly-recipe-grid .vxe-toolbar .table-actions .ant-btn) {
  height: 28px;
  padding: 2px 10px;
  font-size: 12px;
  line-height: 20px;
}

:deep(.assembly-recipe-grid .vxe-toolbar .vxe-tool--item-wrapper) {
  font-size: 12px;
}

:deep(.assembly-recipe-grid .vxe-toolbar .vxe-button) {
  box-sizing: border-box;
  width: 28px !important;
  min-width: 28px !important;
  height: 28px;
  padding: 0;
  font-size: 12px;
}

:deep(.assembly-recipe-grid .vxe-header--column),
:deep(.assembly-recipe-grid .vxe-body--column) {
  font-size: 12px;
}

:deep(.assembly-recipe-grid .vxe-header--column .vxe-cell--title) {
  white-space: nowrap;
}

:deep(.assembly-recipe-grid .vxe-body--column .table-actions .ant-btn-link) {
  height: auto;
  padding: 0;
  font-size: 12px;
}

:deep(.assembly-module-code-link) {
  display: block;
  width: 100%;
  max-width: 100%;
  padding: 0;
  overflow: hidden;
  color: hsl(var(--primary));
  font: inherit;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  background: transparent;
  border: 0;
}

:deep(.assembly-module-code-link:hover),
:deep(.assembly-module-code-link:focus-visible) {
  text-decoration: underline;
}
</style>
