<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpWarehouseApi } from '#/api/erp/stock/warehouse';

import { nextTick, onMounted, ref, watch } from 'vue';

import { useAccess } from '@vben/access';
import { DocAlert, Page, useVbenModal } from '@vben/common-ui';
import { CommonStatusEnum } from '@vben/constants';
import { downloadFileFromBlobPart } from '@vben/utils';

import { useDebounceFn, useResizeObserver } from '@vueuse/core';
import { message } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  batchDisableWarehouse,
  deleteWarehouseList,
  exportWarehouse,
  getWarehouseExportFields,
  getWarehousePage,
  restoreWarehouse,
} from '#/api/erp/stock/warehouse';
import { useFieldPermission } from '#/composables/useFieldPermission';
import { $t } from '#/locales';
import ErpActivationRefreshMask from '#/views/erp/components/ErpActivationRefreshMask.vue';
import ExportFieldModalComponent from '#/views/erp/components/export-field-modal.vue';
import { useStockShortcut } from '#/views/erp/composables/useStockShortcut';
import {
  applyPurchaseDocumentListColumnCustomization,
  releasePurchaseDocumentTrailingColumnResize,
  syncPurchaseDocumentColumnDefaults,
  syncPurchaseDocumentOperationColumn,
} from '#/views/erp/purchase/utils/document-list-table';
import { useVxeActivationRefresh } from '#/views/erp/utils/activation-refresh';
import { withErpKeywordSearchSchema } from '#/views/erp/utils/form-defaults';
import { submitSearchFormOnEnterAndBlur } from '#/views/erp/utils/keyboard';
import { settleVxeColumnCustomization } from '#/views/erp/utils/vxe-column-custom';
import { createVxeHeaderSort } from '#/views/erp/utils/vxe-header-sort';

import { useGridColumns, useGridFormSchema } from './data';
import BatchEditForm from './modules/batch-edit-form.vue';
import WarehouseForm from './modules/form.vue';
import ImportForm from './modules/import-form.vue';
import PickerUserModal from './modules/picker-user-modal.vue';
import UserPermissionModal from './modules/user-permission-modal.vue';

/** 仓库管理 */
defineOptions({ name: 'ErpWarehouse' });

const checkedIds = ref<number[]>([]);
const currentPageRows = ref<ErpWarehouseApi.Warehouse[]>([]);
const stockWarehouseGridShellRef = ref<HTMLElement>();
const FIELD_PERMISSION_MODULE = 'erp_warehouse';
const { hiddenFields, loadHiddenFields } = useFieldPermission(
  FIELD_PERMISSION_MODULE,
);
const { hasAccessByCodes } = useAccess();
const pendingExportParams = ref<Record<string, any>>({});
const listLoading = ref(false);
const exportLoading = ref(false);
const mutating = ref(false);
const warehouseSortFieldMap: Record<string, string> = {
  name: 'name',
  remark: 'remark',
  warehouseType: 'warehouseType',
  status: 'status',
  saleEnabled: 'saleEnabled',
  purchaseEnabled: 'purchaseEnabled',
  deptName: 'deptId',
  stockBillEnabled: 'stockBillEnabled',
  longitude: 'longitude',
  latitude: 'latitude',
};
const { buildSortParams, handleSortChange, restoreSortState } =
  createVxeHeaderSort(warehouseSortFieldMap);

/** 刷新表格 */
function handleRefresh() {
  checkedIds.value = [];
  gridApi.grid?.clearCheckboxRow?.();
  gridApi.grid?.clearCheckboxReserve?.();
  return gridApi.query();
}

function handleSearchEnter(event: KeyboardEvent) {
  submitSearchFormOnEnterAndBlur(event, () => gridApi.formApi.submitForm());
}

/** 导出仓库 */
async function handleExport() {
  if (exportLoading.value || !hasAccessByCodes(['erp:warehouse:export']))
    return;
  pendingExportParams.value = {
    ...(await gridApi.formApi.getValues()),
    ...buildSortParams(),
    ids:
      checkedIds.value.length > 0 ? [...checkedIds.value].join(',') : undefined,
  };
  exportFieldModalApi
    .setData({
      moduleKey: FIELD_PERMISSION_MODULE,
      preserveDecimalPrecision: true,
      loadFields: getWarehouseExportFields,
    })
    .open();
}
async function handleExportConfirm(fields: string[]) {
  exportLoading.value = true;
  try {
    const data = await exportWarehouse({
      ...pendingExportParams.value,
      fields: fields.join(','),
    });
    downloadFileFromBlobPart({ fileName: '仓库.xlsx', source: data });
  } finally {
    exportLoading.value = false;
  }
}

/** 新增仓库 */
function handleCreate() {
  if (
    listLoading.value ||
    activationRefreshMaskVisible.value ||
    !hasAccessByCodes(['erp:warehouse:create'])
  )
    return;
  formModalApi.setData(null).open();
}

function handleImport() {
  if (
    listLoading.value ||
    activationRefreshMaskVisible.value ||
    !hasAccessByCodes(['erp:warehouse:import'])
  )
    return;
  importModalApi.open();
}

/** 编辑仓库 */
function handleEdit(row: ErpWarehouseApi.Warehouse) {
  if (
    row.readonlyBySaleDistribution ||
    !hasAccessByCodes(['erp:warehouse:update'])
  )
    return;
  formModalApi.setData(row).open();
}

function handleDetail(row: ErpWarehouseApi.Warehouse) {
  if (!hasAccessByCodes(['erp:warehouse:query'])) return;
  formModalApi.setData({ type: 'detail', id: row.id }).open();
}

function handleUserPermission(row: ErpWarehouseApi.Warehouse) {
  if (
    row.readonlyBySaleDistribution ||
    !hasAccessByCodes(['erp:warehouse-permission:update'])
  )
    return;
  userPermissionModalApi.setData(row).open();
}

function handlePickerUser(row: ErpWarehouseApi.Warehouse) {
  if (
    row.readonlyBySaleDistribution ||
    !hasAccessByCodes(['erp:warehouse-picker:update'])
  )
    return;
  pickerUserModalApi.setData(row).open();
}

useStockShortcut({
  onCreate: handleCreate,
  onImport: handleImport,
});

function handleBatchEdit() {
  if (checkedIds.value.length === 0) {
    message.warning('请先勾选至少一条数据');
    return;
  }
  batchEditModalApi.setData({ ids: checkedIds.value }).open();
}

async function handleBatchDisable() {
  if (checkedIds.value.length === 0) {
    message.warning('请先勾选至少一条数据');
    return;
  }
  const hideLoading = message.loading({
    content: `正在停用 ${checkedIds.value.length} 个仓库`,
    duration: 0,
  });
  try {
    await batchDisableWarehouse(checkedIds.value);
    message.success('批量停用成功');
    handleRefresh();
  } finally {
    hideLoading();
  }
}

async function handleBatchDelete() {
  if (mutating.value || !hasAccessByCodes(['erp:warehouse:delete'])) return;
  if (checkedIds.value.length === 0) {
    message.warning('请先勾选至少一条数据');
    return;
  }
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting'),
    duration: 0,
  });
  try {
    mutating.value = true;
    const count = checkedIds.value.length;
    await deleteWarehouseList([...checkedIds.value]);
    const pager = gridApi.grid?.getProxyInfo?.()?.pager;
    if (pager) {
      const lastPage = Math.max(
        1,
        Math.ceil((pager.total - count) / pager.pageSize),
      );
      if (pager.currentPage > lastPage)
        gridApi.setGridOptions({ pagerConfig: { currentPage: lastPage } });
    }
    message.success($t('ui.actionMessage.deleteSuccess'));
    await handleRefresh();
  } finally {
    mutating.value = false;
    hideLoading();
  }
}

async function handleDisable(row: ErpWarehouseApi.Warehouse) {
  const hideLoading = message.loading({
    content: `正在停用仓库「${row.name}」`,
    duration: 0,
  });
  try {
    await batchDisableWarehouse([row.id!]);
    message.success('停用成功');
    handleRefresh();
  } finally {
    hideLoading();
  }
}

async function handleRestore(row: ErpWarehouseApi.Warehouse) {
  const hideLoading = message.loading({
    content: `正在启用仓库「${row.name}」`,
    duration: 0,
  });
  try {
    await restoreWarehouse([row.id!]);
    message.success('启用成功');
    handleRefresh();
  } finally {
    hideLoading();
  }
}

function handleRowCheckboxChange({
  records,
}: {
  records: ErpWarehouseApi.Warehouse[];
}) {
  checkedIds.value = records
    .filter((item) => !item.readonlyBySaleDistribution)
    .map((item) => item.id!)
    .filter(Boolean);
}

function isReadonlyBySaleDistribution(row: ErpWarehouseApi.Warehouse) {
  return row.readonlyBySaleDistribution === true;
}

function getRowClassName({ row }: { row: ErpWarehouseApi.Warehouse }) {
  return row.status === CommonStatusEnum.DISABLE
    ? 'erp-disabled-row-highlight'
    : '';
}

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: WarehouseForm,
  destroyOnClose: true,
});

const [ExportFieldModal, exportFieldModalApi] = useVbenModal({
  connectedComponent: ExportFieldModalComponent,
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

const [UserPermissionModalComponent, userPermissionModalApi] = useVbenModal({
  connectedComponent: UserPermissionModal,
  destroyOnClose: true,
});

const [PickerUserModalComponent, pickerUserModalApi] = useVbenModal({
  connectedComponent: PickerUserModal,
  destroyOnClose: true,
});

function buildWarehouseColumns(rows = currentPageRows.value, preserve = true) {
  const columns = (useGridColumns(hiddenFields.value, rows) ?? []) as any[];
  const action = columns.find((column) => column.field === 'actions');
  if (action) {
    const widths = [
      hasAccessByCodes(['erp:warehouse-permission:update']) ? 66 : 0,
      hasAccessByCodes(['erp:warehouse-picker:update']) ? 78 : 0,
      hasAccessByCodes(['erp:warehouse:update']) ? 42 : 0,
      hasAccessByCodes(['erp:warehouse:update']) ? 42 : 0,
    ];
    const buttonCount = widths.filter(Boolean).length;
    action.width =
      widths.reduce((sum, value) => sum + value, 16) +
      Math.max(0, buttonCount - 1) * 6;
    action.resizable = false;
    action.visible =
      widths.some(Boolean) &&
      (rows.length === 0 ||
        rows.some((row) => !row.readonlyBySaleDistribution));
  }
  const runtime = preserve ? (gridApi.grid?.getFullColumns?.() ?? []) : [];
  return applyPurchaseDocumentListColumnCustomization(
    columns,
    runtime.length > 0 ? runtime : columns,
    72,
  );
}
async function reloadWarehouseColumns(
  rows = currentPageRows.value,
  preserve = true,
) {
  const columns = buildWarehouseColumns(rows, preserve);
  gridApi.setGridOptions({ columns });
  await gridApi.grid?.reloadColumn?.(columns);
  syncPurchaseDocumentColumnDefaults(
    gridApi.grid?.getFullColumns?.() ?? [],
    buildWarehouseColumns(rows, false),
  );
  await syncPurchaseDocumentOperationColumn(gridApi.grid, columns);
  const runtimeAction = gridApi.grid
    ?.getFullColumns?.()
    .find((column: any) => column.field === 'actions');
  if (runtimeAction) runtimeAction.resizeWidth = 0;
  releasePurchaseDocumentTrailingColumnResize(
    gridApi.grid?.getFullColumns?.() ?? [],
  );
  await nextTick();
  await gridApi.grid?.recalculate?.(true);
}
async function handleColumnCustom({ type }: { type?: string }) {
  if (!(await settleVxeColumnCustomization(gridApi.grid, type))) return;
  await reloadWarehouseColumns(currentPageRows.value, type !== 'reset');
  await restoreSortState(gridApi);
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    commonConfig: { labelWidth: 68 },
    schema: useGridFormSchema(),
  },
  gridOptions: {
    columns: useGridColumns(hiddenFields.value, currentPageRows.value),
    customConfig: {
      storage: {
        fixed: true,
        resizable: true,
        sort: true,
        visible: true,
      },
    },
    fit: true,
    autoResize: true,
    height: 'auto',
    id: 'erp-stock-warehouse-list-v2',
    keepSource: true,
    showHeaderOverflow: 'tooltip',
    showOverflow: 'tooltip',
    scrollX: {
      enabled: true,
      gt: 8,
    },
    scrollY: {
      enabled: true,
      gt: 10,
    },
    proxyConfig: {
      ajax: {
        query: async ({ page, sort, sorts }, formValues) => {
          listLoading.value = true;
          try {
            const pageResult = await getWarehousePage({
              decimalMode: 'string',
              pageNo: page.currentPage,
              pageSize: page.pageSize,
              ...formValues,
              ...buildSortParams(sorts, sort),
            });
            const result = pageResult;
            currentPageRows.value = result.list ?? [];
            await reloadWarehouseColumns(currentPageRows.value);
            return result;
          } finally {
            listLoading.value = false;
          }
        },
        querySuccess: () => {
          checkedIds.value = [];
          gridApi.grid?.clearCheckboxRow?.();
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
      isCurrent: true,
    },
    rowClassName: getRowClassName,
    checkboxConfig: {
      checkMethod: ({ row }: { row: ErpWarehouseApi.Warehouse }) =>
        !isReadonlyBySaleDistribution(row),
    },
    toolbarConfig: {
      custom: true,
      zoom: true,
      refresh: true,
      search: true,
    },
  } as VxeTableGridOptions<ErpWarehouseApi.Warehouse>,
  gridEvents: {
    custom: handleColumnCustom,
    resizableChange: () => resizeColumns(),
    zoom: () => resizeColumns(),
    sortChange: handleSortChange,
    checkboxAll: handleRowCheckboxChange,
    checkboxChange: handleRowCheckboxChange,
  },
});

const { activationRefreshMaskVisible } =
  useVxeActivationRefresh<ErpWarehouseApi.Warehouse>({
    gridApi,
    getParams: async () => ({
      ...(await gridApi.formApi.getValues()),
      ...buildSortParams(),
    }),
    queryPage: async (params) => {
      const pageResult = await getWarehousePage({
        ...params,
        decimalMode: 'string',
      });
      return pageResult;
    },
    onSuccess: async (rows) => {
      currentPageRows.value = rows;
      await reloadWarehouseColumns(rows);
      checkedIds.value = [];
      gridApi.grid?.clearCheckboxRow?.();
      gridApi.grid?.clearCheckboxReserve?.();
      await restoreSortState(gridApi);
    },
    errorMessage: 'Error occurred while refreshing warehouse page:',
  });

const resizeColumns = useDebounceFn(async () => {
  releasePurchaseDocumentTrailingColumnResize(
    gridApi.grid?.getFullColumns?.() ?? [],
  );
  await gridApi.grid?.recalculate?.(true);
}, 80);
useResizeObserver(stockWarehouseGridShellRef, resizeColumns);
watch(hiddenFields, () => {
  void reloadWarehouseColumns();
});

onMounted(async () => {
  await loadHiddenFields();
  gridApi.formApi.setState({
    schema: withErpKeywordSearchSchema(useGridFormSchema()),
  });
  await reloadWarehouseColumns();
});
</script>

<template>
  <Page auto-content-height>
    <template #doc>
      <DocAlert
        title="【库存】仓库管理"
        url="https://doc.iocoder.cn/erp/stock/"
      />
    </template>

    <ExportFieldModal @confirm="handleExportConfirm" />
    <FormModal @edit="handleEdit" @success="handleRefresh" />
    <ImportModal @success="handleRefresh" />
    <BatchEditModal @success="handleRefresh" />
    <UserPermissionModalComponent @success="handleRefresh" />
    <PickerUserModalComponent @success="handleRefresh" />
    <div ref="stockWarehouseGridShellRef" class="stock-warehouse-grid-shell">
      <Grid table-title="仓库列表" @keydown.enter.capture="handleSearchEnter">
        <template #toolbar-tools>
          <TableAction
            :actions="[
              {
                label: '新增',
                type: 'primary',
                icon: ACTION_ICON.ADD,
                auth: ['erp:warehouse:create'],
                tooltip: 'Insert 新增',
                title: 'Insert 新增',
                onClick: handleCreate,
              },
              {
                label: '导入',
                type: 'primary',
                icon: ACTION_ICON.UPLOAD,
                auth: ['erp:warehouse:import'],
                tooltip: 'I 导入',
                title: 'I 导入',
                onClick: handleImport,
              },
              {
                label: '导出',
                type: 'primary',
                icon: ACTION_ICON.DOWNLOAD,
                auth: ['erp:warehouse:export'],
                onClick: handleExport,
              },
              {
                label: '批量修改',
                type: 'primary',
                icon: ACTION_ICON.EDIT,
                ifShow: () => checkedIds.length > 0,
                auth: ['erp:warehouse:update'],
                onClick: handleBatchEdit,
              },
              {
                label: '批量删除',
                type: 'primary',
                danger: true,
                icon: ACTION_ICON.DELETE,
                ifShow: () => checkedIds.length > 0,
                auth: ['erp:warehouse:delete'],
                popConfirm: {
                  title: `是否删除所选 ${checkedIds.length} 个仓库${checkedIds.length === 1 ? `「${currentPageRows.find((row) => row.id === checkedIds[0])?.name || checkedIds[0]}」` : ''}？`,
                  confirm: handleBatchDelete,
                },
              },
              {
                label: '批量停用',
                type: 'primary',
                icon: ACTION_ICON.CLOSE,
                ifShow: () => checkedIds.length > 0,
                auth: ['erp:warehouse:update'],
                popConfirm: {
                  title:
                    '是否停用所选仓库？停用前系统将校验所选仓库库存是否全部为 0。',
                  confirm: handleBatchDisable,
                },
              },
            ]"
          />
        </template>

        <template #name="{ row }">
          <button
            type="button"
            class="warehouse-name-link"
            :title="row.name || ''"
            @click.stop="handleDetail(row)"
          >
            {{ row.name || '-' }}
          </button>
        </template>

        <template #actions="{ row }">
          <TableAction
            :action-gap="6"
            :actions="[
              {
                label: '人员权限',
                type: 'link',
                icon: ACTION_ICON.PERMISSION,
                auth: ['erp:warehouse-permission:update'],
                ifShow: !isReadonlyBySaleDistribution(row),
                onClick: handleUserPermission.bind(null, row),
              },
              {
                label: '拣货员设置',
                type: 'link',
                icon: 'lucide:user-check',
                auth: ['erp:warehouse-picker:update'],
                ifShow: !isReadonlyBySaleDistribution(row),
                onClick: handlePickerUser.bind(null, row),
              },
              {
                label: $t('common.edit'),
                type: 'link',
                icon: ACTION_ICON.EDIT,
                auth: ['erp:warehouse:update'],
                ifShow: !isReadonlyBySaleDistribution(row),
                onClick: handleEdit.bind(null, row),
              },
              {
                label: '停用',
                type: 'link',
                icon: ACTION_ICON.CLOSE,
                auth: ['erp:warehouse:update'],
                ifShow:
                  !isReadonlyBySaleDistribution(row) &&
                  row.status !== CommonStatusEnum.DISABLE,
                popConfirm: {
                  title: `是否停用仓库「${row.name}」？停用前系统将校验该仓库库存是否全部为 0。`,
                  confirm: handleDisable.bind(null, row),
                },
              },
              {
                label: '启用',
                type: 'link',
                icon: 'lucide:check-circle-2',
                auth: ['erp:warehouse:update'],
                ifShow:
                  !isReadonlyBySaleDistribution(row) &&
                  row.status === CommonStatusEnum.DISABLE,
                popConfirm: {
                  title: `是否启用仓库「${row.name}」？`,
                  confirm: handleRestore.bind(null, row),
                },
              },
            ]"
          />
        </template>
      </Grid>
      <ErpActivationRefreshMask
        v-if="activationRefreshMaskVisible"
        class="stock-warehouse-activation-mask"
      />
    </div>
  </Page>
</template>

<style scoped>
.stock-warehouse-grid-shell {
  position: relative;
  height: 100%;
  min-height: 100%;
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

:global(.warehouse-select-dropdown .ant-select-item),
:global(.warehouse-select-dropdown .ant-empty-description) {
  font-size: 12px;
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

:deep(.vxe-body--column .table-actions .ant-btn-link) {
  height: auto;
  padding: 0;
  font-size: 12px;
}

:deep(.warehouse-name-link) {
  display: block;
  width: 100%;
  max-width: 100%;
  padding: 0;
  overflow: hidden;
  color: hsl(var(--primary));
  font: inherit;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  background: transparent;
  border: 0;
}

:deep(.warehouse-name-column .vxe-cell) {
  display: flex;
  justify-content: center;
}

:deep(.warehouse-name-link:hover),
:deep(.warehouse-name-link:focus-visible) {
  text-decoration: underline;
}

:deep(.vxe-grid--pager-wrapper) {
  position: sticky;
  z-index: 5;
  bottom: 0;
  margin-top: 0 !important;
  background: hsl(var(--card));
  box-shadow: 0 -2px 8px rgb(0 0 0 / 8%);
}

:deep(.erp-disabled-row-highlight > td) {
  background-color: rgba(245, 158, 11, 0.16);
  color: #dc2626;
  font-weight: 600;
}

:deep(.erp-disabled-row-highlight:hover > td) {
  background-color: rgba(245, 158, 11, 0.24);
}

:deep(.erp-disabled-row-highlight > td .vxe-cell) {
  color: inherit;
  font-weight: inherit;
}

:deep(.erp-disabled-row-highlight .warehouse-name-link) {
  color: inherit;
}
</style>
