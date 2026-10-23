<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpProductBrandApi } from '#/api/erp/product/brand';

import { onActivated, onMounted, ref, watch } from 'vue';

import { DocAlert, Page, useVbenModal } from '@vben/common-ui';
import { CommonStatusEnum } from '@vben/constants';
import { downloadFileFromBlobPart } from '@vben/utils';

import { message } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  batchDeleteProductBrand,
  deleteProductBrand,
  exportProductBrand,
  getProductBrandPage,
} from '#/api/erp/product/brand';
import { useFieldPermission } from '#/composables/useFieldPermission';
import { $t } from '#/locales';
import { queueFocusArchiveSearchInput } from '#/views/erp/base/utils/archive-search-focus';
import { useProductShortcut } from '#/views/erp/composables/useProductShortcut';
import { submitSearchFormOnEnterAndBlur } from '#/views/erp/utils/keyboard';
import { createVxeHeaderSort } from '#/views/erp/utils/vxe-header-sort';

import { useGridColumns, useGridFormSchema } from './data';
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

const { hiddenFields } = useFieldPermission('erp_product_brand');
const checkedIds = ref<number[]>([]);
const productBrandGridShellRef = ref<HTMLElement>();
const productBrandSortFieldMap: Record<string, string> = {
  id: 'id',
  name: 'name',
  status: 'status',
  sort: 'sort',
  createTime: 'createTime',
};
const { buildSortParams, handleSortChange, restoreSortState } =
  createVxeHeaderSort(productBrandSortFieldMap);

function handleRefresh() {
  checkedIds.value = [];
  gridApi.query();
}

async function handleExport() {
  const data = await exportProductBrand({
    ...(await gridApi.formApi.getValues()),
    ...buildSortParams(),
  });
  downloadFileFromBlobPart({ fileName: '配件品牌.xls', source: data });
}

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

function handleEdit(row: ErpProductBrandApi.ProductBrand) {
  formModalApi.setData(row).open();
}

async function handleDelete(row: ErpProductBrandApi.ProductBrand) {
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting', [row.name]),
    duration: 0,
  });
  try {
    await deleteProductBrand(row.id as number);
    message.success($t('ui.actionMessage.deleteSuccess', [row.name]));
    handleRefresh();
  } finally {
    hideLoading();
  }
}

async function handleBatchDelete() {
  if (checkedIds.value.length === 0) {
    message.warning('请先勾选至少一个配件品牌');
    return;
  }
  const hideLoading = message.loading({
    content: `正在删除 ${checkedIds.value.length} 个配件品牌`,
    duration: 0,
  });
  try {
    await batchDeleteProductBrand(checkedIds.value);
    message.success('批量删除成功');
    handleRefresh();
  } finally {
    hideLoading();
  }
}

function handleRowCheckboxChange({
  records,
}: {
  records: ErpProductBrandApi.ProductBrand[];
}) {
  checkedIds.value = records.map((item) => item.id!).filter(Boolean);
}

function handleSearchEnter(event: KeyboardEvent) {
  submitSearchFormOnEnterAndBlur(event, () => gridApi.formApi.submitForm());
}

function getRowClassName({ row }: { row: ErpProductBrandApi.ProductBrand }) {
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
          return await getProductBrandPage({
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
  } as VxeTableGridOptions<ErpProductBrandApi.ProductBrand>,
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
  queueFocusArchiveSearchInput(productBrandGridShellRef);
});

onActivated(() => {
  queueFocusArchiveSearchInput(productBrandGridShellRef);
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
    <div ref="productBrandGridShellRef" class="product-brand-grid-shell">
      <Grid
        class="product-brand-grid"
        table-title="配件品牌列表"
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
                auth: ['erp:product-brand:create'],
                onClick: handleCreate,
              },
              {
                label: $t('ui.actionTitle.import'),
                type: 'primary',
                icon: ACTION_ICON.UPLOAD,
                tooltip: 'I 导入',
                auth: ['erp:product-brand:import'],
                onClick: handleImport,
              },
              {
                label: $t('ui.actionTitle.export'),
                type: 'primary',
                icon: ACTION_ICON.DOWNLOAD,
                auth: ['erp:product-brand:export'],
                onClick: handleExport,
              },
              {
                label: '批量删除',
                type: 'primary',
                danger: true,
                icon: ACTION_ICON.DELETE,
                ifShow: () => checkedIds.length > 0,
                auth: ['erp:product-brand:delete'],
                popConfirm: {
                  title: '是否删除所选配件品牌？',
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
                auth: ['erp:product-brand:update'],
                onClick: handleEdit.bind(null, row),
              },
              {
                label: $t('common.delete'),
                type: 'link',
                danger: true,
                icon: ACTION_ICON.DELETE,
                auth: ['erp:product-brand:delete'],
                popConfirm: {
                  title: $t('ui.actionMessage.deleteConfirm', [row.name]),
                  confirm: handleDelete.bind(null, row),
                },
              },
            ]"
          />
        </template>
        <template #bottom>
          <div class="product-brand-grid__legend">
            <span class="product-brand-grid__disabled-swatch"></span>
            <span>浅黄色背景和红色文字表示该品牌已停用</span>
          </div>
        </template>
      </Grid>
    </div>
  </Page>
</template>

<style scoped>
.product-brand-grid-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

:deep(.product-brand-grid .vxe-table--render-default),
:deep(.product-brand-grid .vxe-grid--form-wrapper),
:deep(.product-brand-grid .vxe-toolbar) {
  font-size: 12px;
}

@media (min-width: 1280px) {
  :deep(.product-brand-grid .vxe-grid--form-wrapper form > .grid) {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}

:deep(.product-brand-grid .vxe-grid--form-wrapper .ant-form-item) {
  margin-bottom: 8px;
}

:deep(.product-brand-grid .vxe-header--column.is--sortable .vxe-cell--title) {
  color: #1677ff;
}

:deep(.product-brand-grid .vxe-header--column .vxe-cell--sort) {
  display: none;
}

:deep(.product-brand-grid .erp-disabled-row-highlight > td) {
  font-weight: 600;
  color: #dc2626;
  background-color: rgb(245 158 11 / 16%);
}

:deep(.product-brand-grid .erp-disabled-row-highlight:hover > td) {
  background-color: rgb(245 158 11 / 24%);
}

.product-brand-grid__legend {
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

.product-brand-grid__disabled-swatch {
  width: 14px;
  height: 10px;
  background: rgb(245 158 11 / 20%);
  border: 1px solid rgb(220 38 38 / 55%);
  border-radius: 2px;
}

:global(.product-brand-search-select-dropdown .ant-select-item),
:global(.product-brand-search-select-dropdown .ant-empty-description) {
  font-size: 12px;
}
</style>
