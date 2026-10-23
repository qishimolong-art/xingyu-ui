<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpFieldConfigApi } from '#/api/erp/config/field';
import type { ErpProductApi } from '#/api/erp/product/product';

import { computed, onActivated, onMounted, ref, watch } from 'vue';

import { DocAlert, Page, useVbenModal } from '@vben/common-ui';
import { CommonStatusEnum } from '@vben/constants';
import { IconifyIcon } from '@vben/icons';
import { useUserStore } from '@vben/stores';
import { downloadFileFromBlobPart, isEmpty } from '@vben/utils';

import { Button, message, Tag } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  batchDisableProduct,
  exportProduct,
  getProductPage,
  getProductSimpleList,
  mergeProduct,
  restoreProduct,
} from '#/api/erp/product/product';
import {
  isFieldHidden,
  useFieldPermission,
} from '#/composables/useFieldPermission';
import { $t } from '#/locales';
import { queueFocusArchiveSearchInput } from '#/views/erp/base/utils/archive-search-focus';
import ArchiveMergeModalComponent from '#/views/erp/components/archive-merge-modal.vue';
import ExportSmsVerifyModalComponent from '#/views/erp/components/ExportSmsVerifyModal.vue';
import { useProductShortcut } from '#/views/erp/composables/useProductShortcut';
import { withErpKeywordSearchSchema } from '#/views/erp/utils/form-defaults';
import { submitSearchFormOnEnterAndBlur } from '#/views/erp/utils/keyboard';
import { createVxeHeaderSort } from '#/views/erp/utils/vxe-header-sort';

import {
  normalizeGridSearchValues,
  useGridColumns,
  useGridFormSchema,
  withProductArchiveKeywordSearchMode,
} from './data';
import BatchEditForm from './modules/batch-edit-form.vue';
import CategorySidebar from './modules/category-sidebar.vue';
import Form from './modules/form.vue';
import ImportForm from './modules/import-form.vue';
import { getProductCustomFieldConfigs } from './utils/custom-fields';

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});

const [ImportModal, importModalApi] = useVbenModal({
  connectedComponent: ImportForm,
  destroyOnClose: false,
});
const [BatchEditModal, batchEditModalApi] = useVbenModal({
  connectedComponent: BatchEditForm,
  destroyOnClose: true,
});
const [ExportSmsVerifyModal, exportSmsVerifyModalApi] = useVbenModal({
  connectedComponent: ExportSmsVerifyModalComponent,
  destroyOnClose: true,
});
const [MergeModal, mergeModalApi] = useVbenModal({
  connectedComponent: ArchiveMergeModalComponent,
  destroyOnClose: true,
});

const userStore = useUserStore();
const { hiddenFields } = useFieldPermission('erp_product');
const pendingExportParams = ref<Record<string, any>>({});
const checkedIds = ref<number[]>([]);
const currentPageRows = ref<ErpProductApi.Product[]>([]);
const customFieldConfigs = ref<ErpFieldConfigApi.FieldConfig[]>([]);
const categorySidebarCollapsed = ref(true);
const productGridShellRef = ref<HTMLElement>();
const selectedCategoryId = ref<number>();
const canShowCategorySidebar = computed(
  () => !isFieldHidden(hiddenFields.value, 'categoryId'),
);
const productSortFieldMap: Record<string, string> = {
  code: 'code',
  name: 'name',
  vehicleModel: 'vehicleModel',
  brand: 'brand',
  standard: 'standard',
  barCode: 'barCode',
  factoryCode: 'factoryCode',
  retailPrice: 'retailPrice',
  referencePrice: 'referencePrice',
  sharePrice: 'sharePrice',
  status: 'status',
  createTime: 'createTime',
  updateTime: 'updateTime',
};
const { buildSortParams, handleSortChange, restoreSortState } =
  createVxeHeaderSort(productSortFieldMap);

function mergeCategoryFilter<T extends Record<string, any>>(values: T) {
  if (canShowCategorySidebar.value && selectedCategoryId.value !== undefined) {
    return {
      ...values,
      categoryId: selectedCategoryId.value,
    };
  }
  return values;
}

function handleRefresh() {
  checkedIds.value = [];
  gridApi.query();
}

function handleCategorySelect(category?: { categoryId?: number }) {
  selectedCategoryId.value = category?.categoryId;
  checkedIds.value = [];
  gridApi.query();
}

async function refreshCustomFieldColumns() {
  customFieldConfigs.value = await getProductCustomFieldConfigs();
  await reloadProductColumns();
}

async function reloadProductColumns(rows = currentPageRows.value) {
  await gridApi.grid?.reloadColumn?.(
    useGridColumns(hiddenFields.value, customFieldConfigs.value, rows) as any[],
  );
}

async function handleExport() {
  pendingExportParams.value = mergeCategoryFilter(
    normalizeGridSearchValues(await gridApi.formApi.getValues()),
  );
  pendingExportParams.value.includeSaleDistributedArchive = true;
  exportSmsVerifyModalApi
    .setData({
      mobile: userStore.userInfo?.mobile,
    })
    .open();
}

async function handleExportSmsConfirm(code: string) {
  const data = await exportProduct({
    ...pendingExportParams.value,
    captchaCode: code,
  });
  downloadFileFromBlobPart({ fileName: '配件信息.xls', source: data });
}

function handleCreate() {
  formModalApi.setData({ type: 'create' }).open();
}

function handleImport() {
  importModalApi.open();
}

useProductShortcut({
  onCreate: handleCreate,
  onImport: handleImport,
});

function handleEdit(row: ErpProductApi.Product) {
  if (isReadonlyBySaleDistribution(row)) {
    message.warning('该配件来自销售仓库分发，仅可查看，不能修改');
    return;
  }
  formModalApi.setData({ type: 'edit', id: row.id }).open();
}

function handleDetail(row: ErpProductApi.Product) {
  formModalApi
    .setData({
      type: 'detail',
      id: row.id,
      readonlyBySaleDistribution: row.readonlyBySaleDistribution,
    })
    .open();
}

async function handleDisable(row: ErpProductApi.Product) {
  const hideLoading = message.loading({
    content: `正在停用配件“${row.name}”`,
    duration: 0,
  });
  try {
    await batchDisableProduct([row.id as number]);
    message.success('停用成功');
    handleRefresh();
  } finally {
    hideLoading();
  }
}

async function handleRestore(row: ErpProductApi.Product) {
  const hideLoading = message.loading({
    content: `正在启用配件“${row.name}”`,
    duration: 0,
  });
  try {
    await restoreProduct([row.id as number]);
    message.success('启用成功');
    handleRefresh();
  } finally {
    hideLoading();
  }
}

function handleBatchEdit() {
  if (checkedIds.value.length === 0) {
    message.warning('请先勾选至少一个配件');
    return;
  }
  batchEditModalApi.setData({ ids: checkedIds.value }).open();
}

async function handleBatchDisable() {
  if (checkedIds.value.length === 0) {
    message.warning('请先勾选至少一个配件');
    return;
  }
  const hideLoading = message.loading({
    content: `正在停用 ${checkedIds.value.length} 个配件`,
    duration: 0,
  });
  try {
    await batchDisableProduct(checkedIds.value);
    message.success('批量停用成功');
    handleRefresh();
  } finally {
    hideLoading();
  }
}

function handleMerge() {
  mergeModalApi
    .setData({
      title: '合并配件',
      archiveName: '配件',
      loadOptions: getProductSimpleList,
      mergeApi: mergeProduct,
    })
    .open();
}

function handleRowCheckboxChange({
  records,
}: {
  records: ErpProductApi.Product[];
}) {
  checkedIds.value = records
    .filter((item) => !isReadonlyBySaleDistribution(item))
    .map((item) => item.id!)
    .filter(Boolean);
}

function isReadonlyBySaleDistribution(row: ErpProductApi.Product) {
  return row.readonlyBySaleDistribution === true;
}

function handleSearchEnter(event: KeyboardEvent) {
  submitSearchFormOnEnterAndBlur(event, () => gridApi.formApi.submitForm());
}

function getRowClassName({ row }: { row: ErpProductApi.Product }) {
  return [
    row.status === CommonStatusEnum.DISABLE ? 'erp-disabled-row-highlight' : '',
    row.batchNoEnabled === true ? 'product-batch-row-highlight' : '',
  ]
    .filter(Boolean)
    .join(' ');
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    commonConfig: { labelWidth: 68 },
    schema: useGridFormSchema(hiddenFields.value),
  },
  gridOptions: {
    columns: useGridColumns(
      hiddenFields.value,
      customFieldConfigs.value,
      currentPageRows.value,
    ),
    fit: false,
    height: 'auto',
    id: 'erp-product-list-v2',
    keepSource: true,
    showHeaderOverflow: 'tooltip',
    showOverflow: 'tooltip',
    scrollX: {
      enabled: true,
      gt: 8,
    },
    proxyConfig: {
      ajax: {
        query: async ({ page, sort, sorts }, formValues) => {
          const searchValues = mergeCategoryFilter(
            normalizeGridSearchValues(formValues),
          );
          const result = await getProductPage(
            withProductArchiveKeywordSearchMode({
              pageNo: page.currentPage,
              pageSize: page.pageSize,
              ...searchValues,
              includeSaleDistributedArchive: true,
              ...buildSortParams(sorts, sort),
            }),
          );
          currentPageRows.value = result.list ?? [];
          await reloadProductColumns(currentPageRows.value);
          return result;
        },
        querySuccess: () => {
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
    rowConfig: { keyField: 'id', isHover: true, isCurrent: true },
    rowClassName: getRowClassName,
    checkboxConfig: {
      checkMethod: ({ row }: { row: ErpProductApi.Product }) =>
        !isReadonlyBySaleDistribution(row),
    },
    toolbarConfig: { refresh: true, search: true },
  } as VxeTableGridOptions<ErpProductApi.Product>,
  gridEvents: {
    sortChange: handleSortChange,
    checkboxAll: handleRowCheckboxChange,
    checkboxChange: handleRowCheckboxChange,
  },
});

watch(hiddenFields, (fields) => {
  gridApi.formApi?.setState?.({
    schema: withErpKeywordSearchSchema(useGridFormSchema(fields)),
  });
  void reloadProductColumns(currentPageRows.value);
});

let activatedOnce = false;
onActivated(() => {
  if (!activatedOnce) {
    activatedOnce = true;
    queueFocusArchiveSearchInput(productGridShellRef);
    return;
  }
  void refreshCustomFieldColumns().finally(() => {
    queueFocusArchiveSearchInput(productGridShellRef);
  });
});

onMounted(() => {
  queueFocusArchiveSearchInput(productGridShellRef);
  void refreshCustomFieldColumns();
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
    <ExportSmsVerifyModal @confirm="handleExportSmsConfirm" />
    <MergeModal @success="handleRefresh" />
    <div class="product-page-layout flex h-full min-h-0 gap-3">
      <aside
        v-if="canShowCategorySidebar && !categorySidebarCollapsed"
        class="product-category-sidebar h-full w-[260px] flex-none"
      >
        <CategorySidebar
          @collapse="categorySidebarCollapsed = true"
          @select="handleCategorySelect"
        />
      </aside>

      <aside
        v-else-if="canShowCategorySidebar"
        class="product-category-collapsed-rail flex h-full w-11 flex-none flex-col items-center"
      >
        <Button
          class="product-category-rail-button mt-2"
          type="text"
          title="展开配件分类"
          @click="categorySidebarCollapsed = false"
        >
          <template #icon>
            <IconifyIcon icon="lucide:panel-left-open" class="size-4" />
          </template>
        </Button>
        <button
          class="product-category-rail-label mt-4 flex flex-1 items-center justify-center"
          type="button"
          title="展开配件分类"
          @click="categorySidebarCollapsed = false"
        >
          <span>配件分类</span>
          <span
            v-if="selectedCategoryId !== undefined"
            class="product-category-rail-dot"
          ></span>
        </button>
      </aside>

      <section
        ref="productGridShellRef"
        class="product-grid-shell h-full min-h-0 min-w-0 flex-1"
      >
        <Grid table-title="配件列表" @keydown.enter.capture="handleSearchEnter">
          <template #toolbar-tools>
            <TableAction
              :actions="[
                {
                  label: '新增',
                  type: 'primary',
                  icon: ACTION_ICON.ADD,
                  tooltip: 'Insert 新增',
                  title: 'Insert 新增',
                  auth: ['erp:product:create'],
                  onClick: handleCreate,
                },
                {
                  label: $t('ui.actionTitle.import'),
                  type: 'primary',
                  icon: ACTION_ICON.UPLOAD,
                  tooltip: 'I 导入',
                  title: 'I 导入',
                  auth: ['erp:product:import'],
                  onClick: handleImport,
                },
                {
                  label: $t('ui.actionTitle.export'),
                  type: 'primary',
                  icon: ACTION_ICON.DOWNLOAD,
                  auth: ['erp:product:export'],
                  onClick: handleExport,
                },
                {
                  label: '批量修改',
                  type: 'primary',
                  icon: ACTION_ICON.EDIT,
                  disabled: isEmpty(checkedIds),
                  auth: ['erp:product:update'],
                  onClick: handleBatchEdit,
                },
                {
                  label: '批量停用',
                  type: 'primary',
                  icon: ACTION_ICON.CLOSE,
                  disabled: isEmpty(checkedIds),
                  auth: ['erp:product:update'],
                  popConfirm: {
                    title: '是否停用所选配件？停用后将不能用于后续业务单据。',
                    confirm: handleBatchDisable,
                  },
                },
                {
                  label: '合并',
                  type: 'primary',
                  icon: ACTION_ICON.COPY,
                  auth: ['erp:product:merge'],
                  onClick: handleMerge,
                },
              ]"
            />
          </template>
          <template #productName="{ row }">
            <button
              type="button"
              class="product-name-cell product-name-link"
              :title="row.name || ''"
              @click.stop="handleDetail(row)"
            >
              <span
                v-if="isReadonlyBySaleDistribution(row)"
                class="product-warehouse-distribution-dot"
                role="img"
                aria-label="该配件来自销售仓库分发"
                title="该配件来自销售仓库分发，仅可查看，不能修改"
              ></span>
              <span class="product-name-text">{{ row.name }}</span>
            </button>
          </template>
          <template #currentStock="{ row }">
            <span>{{ row.currentStock ?? 0 }}</span>
            <Tag v-if="row.lowStockWarning" color="warning" class="ml-2">
              低于安全库存
            </Tag>
          </template>
          <template #actions="{ row }">
            <TableAction
              :actions="[
                {
                  label: $t('common.edit'),
                  type: 'link',
                  icon: ACTION_ICON.EDIT,
                  auth: ['erp:product:update'],
                  ifShow: !isReadonlyBySaleDistribution(row),
                  onClick: handleEdit.bind(null, row),
                },
                {
                  label: '停用',
                  type: 'link',
                  icon: ACTION_ICON.CLOSE,
                  auth: ['erp:product:update'],
                  ifShow:
                    !isReadonlyBySaleDistribution(row) &&
                    row.status !== CommonStatusEnum.DISABLE,
                  popConfirm: {
                    title: `是否停用配件“${row.name}”？停用后将不能用于后续业务单据。`,
                    confirm: handleDisable.bind(null, row),
                  },
                },
                {
                  label: '启用',
                  type: 'link',
                  icon: 'lucide:check-circle-2',
                  auth: ['erp:product:update'],
                  ifShow:
                    !isReadonlyBySaleDistribution(row) &&
                    row.status === CommonStatusEnum.DISABLE,
                  popConfirm: {
                    title: `是否启用配件“${row.name}”？`,
                    confirm: handleRestore.bind(null, row),
                  },
                },
              ]"
            />
          </template>
          <template #bottom>
            <div class="product-bottom-note">
              <span class="product-batch-swatch"></span>
              <span>黄色列表表示该配件已开启批次号管理</span>
              <span class="product-bottom-note__divider"></span>
              <span class="product-warehouse-distribution-dot"></span>
              <span>橙色圆点表示该配件来自销售仓库分发</span>
            </div>
          </template>
        </Grid>
      </section>
    </div>
  </Page>
</template>

<style scoped>
.product-page-layout {
  overflow: hidden;
}

:deep(.vxe-table--render-default),
:deep(.vxe-grid--form-wrapper) {
  font-size: 12px;
}

@media (min-width: 1280px) {
  :deep(.vxe-grid--form-wrapper form > .grid) {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
}

:deep(.vxe-grid--form-wrapper label),
:deep(.vxe-grid--form-wrapper .ant-input),
:deep(.vxe-grid--form-wrapper .ant-picker),
:deep(.vxe-grid--form-wrapper .ant-picker-input > input),
:deep(.vxe-grid--form-wrapper .ant-select),
:deep(.vxe-grid--form-wrapper .ant-btn),
:deep(.vxe-grid--form-wrapper .vben-link) {
  font-size: 12px;
}

:deep(.vxe-grid--form-wrapper label) {
  line-height: 20px;
}

:deep(.vxe-grid--form-wrapper .ant-input-affix-wrapper) {
  min-height: 28px;
  padding: 2px 8px;
  font-size: 12px;
}

:deep(.vxe-grid--form-wrapper .ant-input-affix-wrapper .ant-input) {
  line-height: 22px;
}

:deep(.vxe-grid--form-wrapper .ant-select-single) {
  height: 28px;
}

:deep(.vxe-grid--form-wrapper .ant-select-single .ant-select-selector) {
  height: 28px;
  padding: 0 8px;
  font-size: 12px;
}

:deep(
  .vxe-grid--form-wrapper .ant-select-single .ant-select-selection-search-input
) {
  height: 26px;
}

:deep(.vxe-grid--form-wrapper .ant-select-single .ant-select-selection-item),
:deep(
  .vxe-grid--form-wrapper .ant-select-single .ant-select-selection-placeholder
) {
  line-height: 26px;
}

:global(.product-search-select-dropdown .ant-select-item),
:global(.product-search-select-dropdown .ant-select-tree),
:global(.product-search-select-dropdown .ant-empty-description) {
  font-size: 12px;
}

:deep(.vxe-grid--form-wrapper .ant-picker) {
  height: 28px;
  padding: 2px 8px;
}

:deep(.vxe-grid--form-wrapper .ant-btn),
:deep(.vxe-toolbar .table-actions .ant-btn) {
  height: 28px;
  padding: 2px 10px;
  font-size: 12px;
  line-height: 20px;
}

:deep(.vxe-toolbar .vxe-tool--item-wrapper) {
  font-size: 12px;
}

:deep(.vxe-toolbar .table-actions .ant-btn .anticon) {
  font-size: 12px;
}

:deep(.vxe-toolbar .vxe-button) {
  box-sizing: border-box;
  width: 28px !important;
  min-width: 28px !important;
  height: 28px;
  padding: 0;
  font-size: 12px;
}

:deep(.vxe-header--column .vxe-cell--title) {
  white-space: nowrap;
}

:deep(.vxe-header--column.is--sortable .vxe-cell--title) {
  color: #1677ff;
}

:deep(.vxe-header--column .vxe-cell--sort) {
  display: none;
}

.product-category-sidebar {
  overflow: hidden;
}

.product-category-collapsed-rail {
  background: hsl(var(--muted) / 45%);
  border-right: 1px solid hsl(var(--border));
}

.product-category-rail-button {
  width: 32px;
  padding-inline: 0;
}

.product-category-rail-label {
  gap: 8px;
  width: 100%;
  font-size: 12px;
  color: hsl(var(--muted-foreground));
  letter-spacing: 0;
  cursor: pointer;
  background: transparent;
  border: 0;
  writing-mode: vertical-rl;
}

.product-category-rail-label:hover {
  color: hsl(var(--foreground));
}

.product-category-rail-dot {
  width: 6px;
  height: 6px;
  background: hsl(var(--primary));
  border-radius: 999px;
  writing-mode: horizontal-tb;
}

.product-name-cell {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  max-width: 100%;
  vertical-align: middle;
}

.product-name-link {
  padding: 0;
  color: hsl(var(--primary));
  font: inherit;
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: 0;
}

.product-name-link:hover,
.product-name-link:focus-visible {
  text-decoration: underline;
}

.product-name-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.product-warehouse-distribution-dot {
  flex: none;
  width: 7px;
  height: 7px;
  background: #f59e0b;
  border: 1px solid rgb(217 119 6 / 72%);
  border-radius: 999px;
  box-shadow: 0 0 0 2px rgb(245 158 11 / 14%);
}

:deep(.vxe-body--column .table-actions .ant-btn-link) {
  height: auto;
  padding: 0;
  font-size: 12px;
}

:deep(.vxe-body--column .table-actions .ant-btn-link .anticon) {
  font-size: 12px;
}

:deep(.erp-disabled-row-highlight > td) {
  font-weight: 600;
  color: #dc2626;
  background-color: rgb(245 158 11 / 16%);
}

:deep(.erp-disabled-row-highlight:hover > td) {
  background-color: rgb(245 158 11 / 24%);
}

:deep(.erp-disabled-row-highlight > td .vxe-cell) {
  font-weight: inherit;
  color: inherit;
}

:deep(.product-batch-row-highlight .vxe-body--column) {
  background-color: rgb(6 182 212 / 16%) !important;
}

:deep(.product-batch-row-highlight.row--hover .vxe-body--column) {
  background-color: rgb(6 182 212 / 24%) !important;
}

:deep(.vxe-grid--bottom-wrapper) {
  position: sticky;
  bottom: 36px;
  z-index: 4;
  background: hsl(var(--card));
}

:deep(.vxe-grid--pager-wrapper) {
  position: sticky;
  bottom: 0;
  z-index: 5;
  margin-top: 0 !important;
  background: hsl(var(--card));
  box-shadow: 0 -2px 8px rgb(0 0 0 / 8%);
}

.product-bottom-note {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  min-height: 36px;
  padding: 5px 8px;
  font-size: 12px;
  line-height: 18px;
  border-top: 1px solid hsl(var(--border));
}

.product-bottom-note__divider {
  align-self: stretch;
  width: 1px;
  min-height: 16px;
  margin: 1px 4px;
  background: hsl(var(--border));
}

.product-batch-swatch {
  flex: none;
  width: 14px;
  height: 14px;
  background: rgb(6 182 212 / 24%);
  border: 1px solid rgb(6 182 212 / 48%);
  border-radius: 3px;
}
</style>
