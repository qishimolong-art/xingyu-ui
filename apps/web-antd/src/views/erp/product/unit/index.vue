<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpProductUnitApi } from '#/api/erp/product/unit';

import { onActivated, onMounted, ref, watch } from 'vue';

import { DocAlert, Page, useVbenModal } from '@vben/common-ui';
import { CommonStatusEnum } from '@vben/constants';
import { downloadFileFromBlobPart } from '@vben/utils';

import { message } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  batchDeleteProductUnit,
  deleteProductUnit,
  exportProductUnit,
  getProductUnitPage,
} from '#/api/erp/product/unit';
import { useFieldPermission } from '#/composables/useFieldPermission';
import { $t } from '#/locales';
import { queueFocusArchiveSearchInput } from '#/views/erp/base/utils/archive-search-focus';
import { useProductShortcut } from '#/views/erp/composables/useProductShortcut';
import { submitSearchFormOnEnterAndBlur } from '#/views/erp/utils/keyboard';
import { createVxeHeaderSort } from '#/views/erp/utils/vxe-header-sort';

import { useGridColumns, useGridFormSchema } from './data';
import BatchEditForm from './modules/batch-edit-form.vue';
import Form from './modules/form.vue';
import ImportForm from './modules/import-form.vue';

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});
const [ImportModal, importModalApi] = useVbenModal({
  connectedComponent: ImportForm,
  destroyOnClose: true,
});
const [BatchEditModal, batchEditModalApi] = useVbenModal({
  connectedComponent: BatchEditForm,
  destroyOnClose: true,
});

const { hiddenFields } = useFieldPermission('erp_product_unit');
const checkedIds = ref<number[]>([]);
const productUnitGridShellRef = ref<HTMLElement>();
const productUnitSortFieldMap: Record<string, string> = {
  id: 'id',
  name: 'name',
  status: 'status',
  createTime: 'createTime',
};
const { buildSortParams, handleSortChange, restoreSortState } =
  createVxeHeaderSort(productUnitSortFieldMap);

/** 刷新表格 */
function handleRefresh() {
  checkedIds.value = [];
  gridApi.query();
}

/** 导出单位 */
async function handleExport() {
  const data = await exportProductUnit({
    ...(await gridApi.formApi.getValues()),
    ...buildSortParams(),
  });
  downloadFileFromBlobPart({ fileName: '配件单位.xls', source: data });
}

/** 创建配件单位 */
function handleCreate() {
  formModalApi.setData(null).open();
}

function handleImport() {
  importModalApi.open();
}

useProductShortcut({
  onCreate: handleCreate,
  onImport: handleImport,
});

/** 编辑配件单位 */
function handleEdit(row: ErpProductUnitApi.ProductUnit) {
  formModalApi.setData(row).open();
}

/** 删除配件单位 */
async function handleDelete(row: ErpProductUnitApi.ProductUnit) {
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting', [row.name]),
    duration: 0,
  });
  try {
    await deleteProductUnit(row.id as number);
    message.success($t('ui.actionMessage.deleteSuccess', [row.name]));
    handleRefresh();
  } finally {
    hideLoading();
  }
}

function handleBatchEdit() {
  if (checkedIds.value.length === 0) {
    message.warning('请先勾选至少一个配件单位');
    return;
  }
  batchEditModalApi.setData({ ids: checkedIds.value }).open();
}

async function handleBatchDelete() {
  if (checkedIds.value.length === 0) {
    message.warning('请先勾选至少一个配件单位');
    return;
  }
  const hideLoading = message.loading({
    content: `正在删除 ${checkedIds.value.length} 个配件单位`,
    duration: 0,
  });
  try {
    await batchDeleteProductUnit(checkedIds.value);
    message.success('批量删除成功');
    handleRefresh();
  } finally {
    hideLoading();
  }
}

function handleRowCheckboxChange({
  records,
}: {
  records: ErpProductUnitApi.ProductUnit[];
}) {
  checkedIds.value = records.map((item) => item.id!).filter(Boolean);
}

function handleSearchEnter(event: KeyboardEvent) {
  submitSearchFormOnEnterAndBlur(event, () => gridApi.formApi.submitForm());
}

function getRowClassName({ row }: { row: ErpProductUnitApi.ProductUnit }) {
  return row.status === CommonStatusEnum.DISABLE
    ? 'erp-disabled-row-highlight'
    : '';
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    commonConfig: { labelWidth: 68 },
    schema: useGridFormSchema(),
  },
  gridOptions: {
    columns: useGridColumns(hiddenFields.value),
    height: 'auto',
    keepSource: true,
    showHeaderOverflow: 'tooltip',
    showOverflow: 'tooltip',
    scrollX: {
      enabled: true,
      gt: 5,
    },
    proxyConfig: {
      ajax: {
        query: async ({ page, sort, sorts }, formValues) => {
          return await getProductUnitPage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            ...formValues,
            ...buildSortParams(sorts, sort),
          });
        },
        querySuccess: () => {
          checkedIds.value = [];
          void restoreSortState(gridApi);
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
    rowClassName: getRowClassName,
    toolbarConfig: {
      refresh: true,
      search: true,
    },
  } as VxeTableGridOptions<ErpProductUnitApi.ProductUnit>,
  gridEvents: {
    sortChange: handleSortChange,
    checkboxAll: handleRowCheckboxChange,
    checkboxChange: handleRowCheckboxChange,
  },
});

watch(hiddenFields, (fields) => {
  gridApi.setGridOptions({
    columns: useGridColumns(fields),
  });
});

onMounted(() => {
  queueFocusArchiveSearchInput(productUnitGridShellRef);
});

onActivated(() => {
  queueFocusArchiveSearchInput(productUnitGridShellRef);
});
</script>

<template>
  <Page auto-content-height>
    <template #doc>
      <DocAlert
        title="【ERP】产品信息、产品分类、产品单位"
        url="https://doc.iocoder.cn/erp/product/"
      />
    </template>
    <FormModal @success="handleRefresh" />
    <ImportModal @success="handleRefresh" />
    <BatchEditModal @success="handleRefresh" />
    <div ref="productUnitGridShellRef" class="product-unit-grid-shell">
      <Grid
        class="product-unit-grid"
        table-title="配件单位列表"
        @keydown.enter.capture="handleSearchEnter"
      >
        <template #toolbar-tools>
          <TableAction
            :actions="[
              {
                label: '新增',
                type: 'primary',
                icon: ACTION_ICON.ADD,
                tooltip: 'Insert 新增',
                auth: ['erp:product-unit:create'],
                onClick: handleCreate,
              },
              {
                label: $t('ui.actionTitle.import'),
                type: 'primary',
                icon: ACTION_ICON.UPLOAD,
                tooltip: 'I 导入',
                auth: ['erp:product-unit:import'],
                onClick: handleImport,
              },
              {
                label: $t('ui.actionTitle.export'),
                type: 'primary',
                icon: ACTION_ICON.DOWNLOAD,
                auth: ['erp:product-unit:export'],
                onClick: handleExport,
              },
              {
                label: '批量修改',
                type: 'primary',
                icon: ACTION_ICON.EDIT,
                ifShow: () => checkedIds.length > 0,
                auth: ['erp:product-unit:update'],
                onClick: handleBatchEdit,
              },
              {
                label: '批量删除',
                type: 'primary',
                danger: true,
                icon: ACTION_ICON.DELETE,
                ifShow: () => checkedIds.length > 0,
                auth: ['erp:product-unit:delete'],
                popConfirm: {
                  title: '是否删除所选配件单位？',
                  confirm: handleBatchDelete,
                },
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
                auth: ['erp:product-unit:update'],
                onClick: handleEdit.bind(null, row),
              },
              {
                label: $t('common.delete'),
                type: 'link',
                danger: true,
                icon: ACTION_ICON.DELETE,
                auth: ['erp:product-unit:delete'],
                popConfirm: {
                  title: $t('ui.actionMessage.deleteConfirm', [row.name]),
                  confirm: handleDelete.bind(null, row),
                },
              },
            ]"
          />
        </template>
        <template #bottom>
          <div class="product-unit-grid__legend">
            <span class="product-unit-grid__disabled-swatch"></span>
            <span>浅黄色背景和红色文字表示该单位已停用</span>
          </div>
        </template>
      </Grid>
    </div>
  </Page>
</template>

<style scoped>
.product-unit-grid-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

:deep(.product-unit-grid .vxe-table--render-default),
:deep(.product-unit-grid .vxe-grid--form-wrapper),
:deep(.product-unit-grid .vxe-toolbar) {
  font-size: 12px;
}

@media (min-width: 1280px) {
  :deep(.product-unit-grid .vxe-grid--form-wrapper form > .grid) {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}

:deep(.product-unit-grid .vxe-grid--form-wrapper .ant-form-item) {
  margin-bottom: 8px;
}

:deep(.product-unit-grid .vxe-grid--form-wrapper label),
:deep(.product-unit-grid .vxe-grid--form-wrapper .ant-input),
:deep(.product-unit-grid .vxe-grid--form-wrapper .ant-select),
:deep(.product-unit-grid .vxe-grid--form-wrapper .ant-btn) {
  font-size: 12px;
}

:deep(.product-unit-grid .vxe-grid--form-wrapper .ant-input-affix-wrapper) {
  min-height: 28px;
  padding: 2px 8px;
}

:deep(.product-unit-grid .vxe-grid--form-wrapper .ant-select-single),
:deep(
  .product-unit-grid
    .vxe-grid--form-wrapper
    .ant-select-single
    .ant-select-selector
) {
  height: 28px;
  min-height: 28px;
}

:deep(
  .product-unit-grid
    .vxe-grid--form-wrapper
    .ant-select-single
    .ant-select-selection-item
),
:deep(
  .product-unit-grid
    .vxe-grid--form-wrapper
    .ant-select-single
    .ant-select-selection-placeholder
) {
  line-height: 26px;
}

:deep(.product-unit-grid .vxe-grid--form-wrapper .ant-btn),
:deep(.product-unit-grid .vxe-toolbar .table-actions .ant-btn) {
  height: 28px;
  padding: 2px 10px;
  font-size: 12px;
}

:deep(.product-unit-grid .vxe-toolbar .vxe-button) {
  box-sizing: border-box;
  width: 28px !important;
  min-width: 28px !important;
  height: 28px;
  padding: 0;
  font-size: 12px;
}

:deep(.product-unit-grid .vxe-header--column) {
  height: 34px;
  font-size: 12px;
  font-weight: 600;
  color: hsl(var(--muted-foreground));
}

:deep(.product-unit-grid .vxe-header--column .vxe-cell--title) {
  white-space: nowrap;
}

:deep(.product-unit-grid .vxe-header--column.is--sortable .vxe-cell--title) {
  color: #1677ff;
}

:deep(.product-unit-grid .vxe-header--column .vxe-cell--sort) {
  display: none;
}

:deep(.product-unit-grid .vxe-body--column) {
  height: 36px;
  font-size: 12px;
  line-height: 20px;
}

:deep(.product-unit-grid .vxe-body--column .table-actions .ant-btn-link) {
  height: auto;
  padding: 0;
  font-size: 12px;
}

:deep(.product-unit-grid .erp-disabled-row-highlight > td) {
  font-weight: 600;
  color: #dc2626;
  background-color: rgb(245 158 11 / 16%);
}

:deep(.product-unit-grid .erp-disabled-row-highlight:hover > td) {
  background-color: rgb(245 158 11 / 24%);
}

:deep(.product-unit-grid .erp-disabled-row-highlight > td .vxe-cell) {
  font-weight: inherit;
  color: inherit;
}

.product-unit-grid__legend {
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

.product-unit-grid__disabled-swatch {
  width: 14px;
  height: 10px;
  background: rgb(245 158 11 / 20%);
  border: 1px solid rgb(220 38 38 / 55%);
  border-radius: 2px;
}

:global(.product-unit-search-select-dropdown .ant-select-item),
:global(.product-unit-search-select-dropdown .ant-empty-description) {
  font-size: 12px;
}
</style>
