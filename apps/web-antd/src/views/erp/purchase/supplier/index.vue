<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpSupplierApi } from '#/api/erp/purchase/supplier';

import { nextTick, onActivated, ref, watch } from 'vue';

import { useAccess } from '@vben/access';
import { DocAlert, Page, useVbenModal } from '@vben/common-ui';
import { CommonStatusEnum } from '@vben/constants';
import { useUserStore } from '@vben/stores';
import { downloadFileFromBlobPart, isEmpty } from '@vben/utils';

import { useDebounceFn, useResizeObserver } from '@vueuse/core';
import { Alert, message, Modal, Spin } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  batchDisableSupplier,
  exportSupplier,
  getSupplierExportFields,
  getSupplierMergePage,
  getSupplierPage,
  getSupplierSimpleList,
  mergeSupplier,
  updateSupplierStatus,
} from '#/api/erp/purchase/supplier';
import { $t } from '#/locales';
import ArchiveMergeModalComponent from '#/views/erp/components/archive-merge-modal.vue';
import ExportFieldModalComponent from '#/views/erp/components/export-field-modal.vue';
import ExportSmsVerifyModalComponent from '#/views/erp/components/ExportSmsVerifyModal.vue';
import { usePurchaseShortcut } from '#/views/erp/composables/usePurchaseShortcut';
import {
  applyPurchaseDocumentListColumnCustomization,
  releasePurchaseDocumentTrailingColumnResize,
  syncPurchaseDocumentColumnDefaults,
  syncPurchaseDocumentOperationColumn,
} from '#/views/erp/purchase/utils/document-list-table';
import { isSameFieldSet } from '#/views/erp/purchase/utils/field-permission';
import { submitSearchFormOnEnterAndBlur } from '#/views/erp/utils/keyboard';
import { settleVxeColumnCustomization } from '#/views/erp/utils/vxe-column-custom';
import { createVxeHeaderSort } from '#/views/erp/utils/vxe-header-sort';

import { useGridColumns, useGridFormSchema } from './data';
import BatchEditForm from './modules/batch-edit-form.vue';
import SupplierDetail from './modules/detail.vue';
import EnterpriseMatchModal from './modules/enterprise-match-modal.vue';
import SupplierForm from './modules/form.vue';
import SupplierImportForm from './modules/import-form.vue';
import { loadSupplierRoleFields } from './utils/field-visibility';

defineOptions({ name: 'ErpSupplier' });

const FIELD_PERMISSION_MODULE = 'erp_supplier';
const hiddenFields = ref<string[]>([]);
const listError = ref('');
type SupplierFormSuccessPayload =
  | number
  | {
      id?: number;
      targetTab?: 'business' | 'images';
    };

const userStore = useUserStore();
const { hasAccessByCodes } = useAccess();
const listLoading = ref(false);
const exportLoading = ref(false);
const checkedIds = ref<number[]>([]);
const pendingExportParams = ref<Record<string, any>>({});
const pendingExportSmsCode = ref('');
const activationRefreshMaskVisible = ref(false);
const currentPageRows = ref<ErpSupplierApi.Supplier[]>([]);
const supplierGridShellRef = ref<HTMLElement>();
const supplierSortFieldMap: Record<string, string> = {
  code: 'code',
  name: 'name',
  status: 'status',
  region: 'region',
  address: 'address',
  remark: 'remark',
  createTime: 'createTime',
  contactInfo: 'mobile',
  purchaser: 'purchaser',
};
const { buildSortParams, handleSortChange, restoreSortState } =
  createVxeHeaderSort(supplierSortFieldMap);

async function handleRefresh() {
  checkedIds.value = [];
  gridApi.grid?.clearCheckboxRow?.();
  gridApi.grid?.clearCheckboxReserve?.();
  await gridApi.query();
  const pager = gridApi.grid?.getProxyInfo?.()?.pager;
  if (pager) {
    const lastPage = Math.max(
      1,
      Math.ceil(Number(pager.total ?? 0) / Number(pager.pageSize || 20)),
    );
    if (pager.currentPage > lastPage) {
      gridApi.setGridOptions({ pagerConfig: { currentPage: lastPage } });
      await gridApi.query();
    }
  }
}

async function handleFormSuccess(payload?: SupplierFormSuccessPayload) {
  handleRefresh();
  const id = typeof payload === 'number' ? payload : payload?.id;
  if (id) {
    const activeTab =
      typeof payload === 'number' ? undefined : payload?.targetTab;
    await nextTick();
    detailModalApi
      .setData({
        id,
        activeTab,
        mode: 'detail',
      } as unknown as ErpSupplierApi.Supplier)
      .open();
  }
}

function waitForFrame() {
  return new Promise<void>((resolve) => {
    if (typeof window === 'undefined' || !window.requestAnimationFrame) {
      setTimeout(resolve, 0);
      return;
    }
    window.requestAnimationFrame(() => resolve());
  });
}

function handleCreate() {
  if (
    listLoading.value ||
    activationRefreshMaskVisible.value ||
    !hasAccessByCodes(['erp:supplier:create'])
  )
    return;
  formModalApi.setData(null).open();
}

function handleEdit(row: ErpSupplierApi.Supplier) {
  if (!hasAccessByCodes(['erp:supplier:update'])) return;
  detailModalApi.setData({ ...row, mode: 'edit' }).open();
}

function handleDetail(row: ErpSupplierApi.Supplier) {
  if (!hasAccessByCodes(['erp:supplier:query'])) return;
  detailModalApi.setData({ ...row, mode: 'detail' }).open();
}

function handleContactDetail(row: ErpSupplierApi.Supplier) {
  detailModalApi
    .setData({ ...row, activeTab: 'contacts', mode: 'detail' })
    .open();
}

function handleEnterpriseMatch(row: ErpSupplierApi.Supplier) {
  if (row.businessInfoSynced) {
    detailModalApi
      .setData({ ...row, activeTab: 'business', mode: 'detail' })
      .open();
    return;
  }
  enterpriseMatchModalApi.setData(row).open();
}

function getEnterpriseMatchText(row: ErpSupplierApi.Supplier) {
  return row.businessInfoSynced ? '已同步' : '未同步';
}

function handlePendingFeature(featureName: string) {
  message.info(`${featureName}功能待接入`);
}

function formatCreditLimit(value?: number) {
  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(Number(value))
  ) {
    return '-';
  }
  return `¥${Number(value).toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

async function handleExport() {
  if (exportLoading.value || !hasAccessByCodes(['erp:supplier:export'])) return;
  pendingExportSmsCode.value = '';
  const selectedIds = (
    (gridApi.grid?.getCheckboxRecords?.() as
      | ErpSupplierApi.Supplier[]
      | undefined) ?? []
  )
    .map((item) => item.id!)
    .filter((id) => id !== undefined);
  pendingExportParams.value = {
    ...(selectedIds.length > 0
      ? { ids: selectedIds.join(',') }
      : await gridApi.formApi.getValues()),
    ...buildSortParams(),
  };
  exportSmsVerifyModalApi
    .setData({
      mobile: userStore.userInfo?.mobile,
    })
    .open();
}

function handleExportSmsConfirm(code: string) {
  pendingExportSmsCode.value = code;
  exportFieldModalApi
    .setData({
      loadFields: getSupplierExportFields,
      moduleKey: FIELD_PERMISSION_MODULE,
    })
    .open();
}

async function handleExportConfirm(fields: string[]) {
  if (exportLoading.value || !hasAccessByCodes(['erp:supplier:export'])) return;
  exportLoading.value = true;
  try {
    const data = await exportSupplier({
      ...pendingExportParams.value,
      fields: fields.join(','),
      captchaCode: pendingExportSmsCode.value,
    });
    downloadFileFromBlobPart({ fileName: '供应商.xlsx', source: data });
  } catch {
    exportSmsVerifyModalApi
      .setData({ mobile: userStore.userInfo?.mobile })
      .open();
  } finally {
    exportLoading.value = false;
    pendingExportSmsCode.value = '';
  }
}

function handleImport() {
  if (
    listLoading.value ||
    activationRefreshMaskVisible.value ||
    !hasAccessByCodes(['erp:supplier:import'])
  )
    return;
  importModalApi.open();
}

function handleBatchEdit() {
  if (checkedIds.value.length === 0) {
    message.warning('请先勾选至少一个供应商');
    return;
  }
  batchEditModalApi.setData({ ids: checkedIds.value }).open();
}

async function handleBatchDisable() {
  if (checkedIds.value.length === 0) {
    message.warning('请选择要停用的供应商');
    return;
  }
  const hideLoading = message.loading({
    content: `正在停用 ${checkedIds.value.length} 个供应商`,
    duration: 0,
  });
  try {
    await batchDisableSupplier(checkedIds.value);
    message.success('批量停用成功');
    handleRefresh();
  } finally {
    hideLoading();
  }
}

function handleMerge() {
  mergeModalApi
    .setData({
      title: '合并供应商',
      archiveName: '供应商',
      loadOptions: getSupplierSimpleList,
      loadPage: getSupplierMergePage,
      mergeApi: mergeSupplier,
    })
    .open();
}

function handleToggleStatus(row: ErpSupplierApi.Supplier) {
  const isEnable = row.status === CommonStatusEnum.ENABLE;
  const nextStatus = isEnable
    ? CommonStatusEnum.DISABLE
    : CommonStatusEnum.ENABLE;
  const actionText = isEnable ? '停用' : '启用';
  Modal.confirm({
    title: `${actionText}确认`,
    content: `确定${actionText}供应商“${row.name}”吗？`,
    okText: '确定',
    cancelText: '取消',
    onOk: async () => {
      await updateSupplierStatus(row.id!, nextStatus);
      message.success(`${actionText}成功`);
      handleRefresh();
    },
  });
}

function handleRowCheckboxChange({
  records,
}: {
  records: ErpSupplierApi.Supplier[];
}) {
  checkedIds.value = records.map((item) => item.id!).filter(Boolean);
}

function handleSearchEnter(event: KeyboardEvent) {
  submitSearchFormOnEnterAndBlur(event, () => gridApi.formApi.submitForm());
}

function getRowClassName({ row }: { row: ErpSupplierApi.Supplier }) {
  return row.status === CommonStatusEnum.DISABLE
    ? 'erp-disabled-row-highlight'
    : '';
}

usePurchaseShortcut({
  onCreate: handleCreate,
  onImport: handleImport,
});

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: SupplierForm,
  destroyOnClose: true,
});

const [DetailModal, detailModalApi] = useVbenModal({
  connectedComponent: SupplierDetail,
  destroyOnClose: true,
});

const [ImportModal, importModalApi] = useVbenModal({
  connectedComponent: SupplierImportForm,
  destroyOnClose: true,
});

const [EnterpriseMatchModalInstance, enterpriseMatchModalApi] = useVbenModal({
  connectedComponent: EnterpriseMatchModal,
  destroyOnClose: true,
});

const [BatchEditModal, batchEditModalApi] = useVbenModal({
  connectedComponent: BatchEditForm,
  destroyOnClose: true,
});

const [ExportSmsVerifyModal, exportSmsVerifyModalApi] = useVbenModal({
  connectedComponent: ExportSmsVerifyModalComponent,
  destroyOnClose: true,
});

const [ExportFieldModal, exportFieldModalApi] = useVbenModal({
  connectedComponent: ExportFieldModalComponent,
  destroyOnClose: true,
});

const [MergeModal, mergeModalApi] = useVbenModal({
  connectedComponent: ArchiveMergeModalComponent,
  destroyOnClose: true,
});

function buildSupplierColumns(
  rows = currentPageRows.value,
  fields = hiddenFields.value,
  preserve = true,
) {
  const columns = useGridColumns(fields, rows) as any[];
  const action = columns.find((column) => column.field === 'actions');
  if (action) {
    action.width = 106;
    action.resizable = false;
    action.visible = hasAccessByCodes(['erp:supplier:update']);
  }
  const runtime = preserve ? (gridApi.grid?.getFullColumns?.() ?? []) : [];
  return applyPurchaseDocumentListColumnCustomization(
    columns,
    runtime.length > 0 ? runtime : columns,
    72,
  );
}
async function reloadSupplierColumns(
  rows = currentPageRows.value,
  fields = hiddenFields.value,
  preserve = true,
) {
  const columns = buildSupplierColumns(rows, fields, preserve);
  gridApi.setGridOptions({ columns });
  await gridApi.grid?.reloadColumn?.(columns);
  const runtime = gridApi.grid?.getFullColumns?.() ?? [];
  syncPurchaseDocumentColumnDefaults(
    runtime,
    buildSupplierColumns(rows, fields, false),
  );
  await syncPurchaseDocumentOperationColumn(gridApi.grid, columns);
  const action = runtime.find((column: any) => column.field === 'actions');
  if (action) action.resizeWidth = 0;
  releasePurchaseDocumentTrailingColumnResize(runtime);
  await nextTick();
  await gridApi.grid?.recalculate?.(true);
}
async function handleColumnCustom({ type }: { type?: string }) {
  if (await settleVxeColumnCustomization(gridApi.grid, type)) {
    await reloadSupplierColumns(
      currentPageRows.value,
      hiddenFields.value,
      type !== 'reset',
    );
    await restoreSortState(gridApi);
  }
}
const recalculateGrid = useDebounceFn(
  () => gridApi.grid?.recalculate?.(true),
  60,
);
useResizeObserver(supplierGridShellRef, recalculateGrid);

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    commonConfig: { labelWidth: 68 },
    schema: useGridFormSchema(hiddenFields.value),
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
    id: 'erp-purchase-supplier-list-v2',
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
            hiddenFields.value = await loadSupplierRoleFields();
            listError.value = '';
            const result = await getSupplierPage({
              pageNo: page.currentPage,
              pageSize: page.pageSize,
              ...formValues,
              ...buildSortParams(sorts, sort),
            });
            currentPageRows.value = result.list ?? [];
            await reloadSupplierColumns(currentPageRows.value);
            return result;
          } catch (error) {
            listError.value = '供应商列表或权限加载失败，请刷新重试';
            throw error;
          } finally {
            listLoading.value = false;
          }
        },
        querySuccess: () => {
          checkedIds.value = [];
          gridApi.grid?.clearCheckboxRow?.();
          gridApi.grid?.clearCheckboxReserve?.();
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
    toolbarConfig: {
      refresh: true,
      search: true,
      zoom: true,
      custom: true,
    },
  } as VxeTableGridOptions<ErpSupplierApi.Supplier>,
  gridEvents: {
    custom: handleColumnCustom,
    sortChange: handleSortChange,
    checkboxAll: handleRowCheckboxChange,
    checkboxChange: handleRowCheckboxChange,
  },
});

let appliedHiddenFields = [...hiddenFields.value];
watch(hiddenFields, (fields) => {
  if (isSameFieldSet(appliedHiddenFields, fields)) {
    return;
  }
  appliedHiddenFields = [...fields];
  gridApi.formApi?.setState?.({ schema: useGridFormSchema(fields) });
  void reloadSupplierColumns(currentPageRows.value, fields);
});

let activatedOnce = false;
let activationRefreshVersion = 0;

async function refreshActivatedSupplierPage() {
  const refreshVersion = ++activationRefreshVersion;

  activationRefreshMaskVisible.value = true;
  try {
    await nextTick();
    await waitForFrame();
    await waitForFrame();

    if (refreshVersion !== activationRefreshVersion) {
      return;
    }

    const roleFields = await loadSupplierRoleFields();
    if (refreshVersion !== activationRefreshVersion) return;
    hiddenFields.value = roleFields;
    const proxyInfo = gridApi.grid?.getProxyInfo?.();
    const pager = proxyInfo?.pager;
    const pageSize = Number(pager?.pageSize || 20);
    const currentPage = Number(pager?.currentPage || 1);
    const formValues = await gridApi.formApi.getValues();
    const sortParams = buildSortParams();
    let result = await getSupplierPage({
      pageNo: currentPage,
      pageSize,
      ...formValues,
      ...sortParams,
    });
    const total = Number(result.total || 0);
    const pageCount = Math.max(Math.ceil(total / pageSize), 1);
    const finalPage = Math.min(currentPage, pageCount);

    if (finalPage !== currentPage) {
      result = await getSupplierPage({
        pageNo: finalPage,
        pageSize,
        ...formValues,
        ...sortParams,
      });
    }

    if (refreshVersion !== activationRefreshVersion) {
      return;
    }

    const rows = result.list ?? [];
    currentPageRows.value = rows;
    await reloadSupplierColumns(rows);
    if (pager) {
      pager.currentPage = finalPage;
      pager.pageSize = pageSize;
      pager.total = Number(result.total || 0);
    }
    await gridApi.grid?.loadData?.(rows);
    checkedIds.value = [];
    await restoreSortState(gridApi);
  } catch (error) {
    console.error('Error occurred while refreshing supplier page:', error);
  } finally {
    if (refreshVersion === activationRefreshVersion) {
      activationRefreshMaskVisible.value = false;
    }
  }
}

onActivated(() => {
  if (!activatedOnce) {
    activatedOnce = true;
    return;
  }
  void refreshActivatedSupplierPage();
});
</script>

<template>
  <Page auto-content-height>
    <template #doc>
      <DocAlert
        title="【采购】采购订单、入库、退货"
        url="https://doc.iocoder.cn/erp/purchase/"
      />
    </template>

    <FormModal @success="handleFormSuccess" />
    <DetailModal @success="handleRefresh" />
    <ImportModal @success="handleRefresh" />
    <EnterpriseMatchModalInstance @success="handleRefresh" />
    <BatchEditModal @success="handleRefresh" />
    <ExportSmsVerifyModal @confirm="handleExportSmsConfirm" />
    <ExportFieldModal @confirm="handleExportConfirm" />
    <MergeModal @success="handleRefresh" />
    <div ref="supplierGridShellRef" class="supplier-grid-shell">
      <Alert v-if="listError" :message="listError" type="error" show-icon />
      <Grid table-title="供应商列表" @keydown.enter.capture="handleSearchEnter">
        <template #toolbar-tools>
          <TableAction
            :actions="[
              {
                label: '新增',
                type: 'primary',
                icon: ACTION_ICON.ADD,
                tooltip: 'Insert 新增',
                auth: ['erp:supplier:create'],
                onClick: handleCreate,
              },
              {
                label: '导入',
                type: 'primary',
                icon: ACTION_ICON.UPLOAD,
                tooltip: 'I 导入',
                auth: ['erp:supplier:import'],
                onClick: handleImport,
              },
              {
                label: $t('ui.actionTitle.export'),
                type: 'primary',
                icon: ACTION_ICON.DOWNLOAD,
                auth: ['erp:supplier:export'],
                onClick: handleExport,
              },
              {
                label: '批量修改',
                type: 'primary',
                icon: ACTION_ICON.EDIT,
                ifShow: () => !isEmpty(checkedIds),
                auth: ['erp:supplier:update'],
                onClick: handleBatchEdit,
              },
              {
                label: '批量停用',
                type: 'primary',
                icon: ACTION_ICON.CLOSE,
                ifShow: () => !isEmpty(checkedIds),
                auth: ['erp:supplier:update'],
                popConfirm: {
                  title:
                    '是否停用所选供应商？停用前系统将校验所选供应商是否已结清欠款。',
                  confirm: handleBatchDisable,
                },
              },
              {
                label: '合并',
                type: 'primary',
                icon: ACTION_ICON.COPY,
                auth: ['erp:supplier:merge'],
                onClick: handleMerge,
              },
            ]"
          />
        </template>
        <template #contactListAction="{ row }">
          <button
            type="button"
            class="supplier-list-link"
            @click.stop="handleContactDetail(row)"
          >
            查看
          </button>
        </template>
        <template #supplierPortalAction>
          <button
            type="button"
            class="supplier-list-link"
            @click.stop="handlePendingFeature('供应商门户')"
          >
            开通
          </button>
        </template>
        <template #name="{ row }">
          <button
            type="button"
            class="supplier-list-link"
            :title="row.name || ''"
            @click.stop="handleDetail(row)"
          >
            {{ row.name || '-' }}
          </button>
        </template>
        <template #enterpriseMatch="{ row }">
          <button
            type="button"
            class="supplier-list-link"
            @click.stop="handleEnterpriseMatch(row)"
          >
            {{ getEnterpriseMatchText(row) }}
          </button>
        </template>
        <template #status="{ row }">
          <span
            class="supplier-status"
            :class="
              row.status === CommonStatusEnum.ENABLE
                ? 'is-enabled'
                : 'is-disabled'
            "
          >
            {{ row.status === CommonStatusEnum.ENABLE ? '启用' : '停用' }}
          </span>
        </template>
        <template #wechatService>
          <button
            type="button"
            class="supplier-list-link"
            @click.stop="handlePendingFeature('微信客服')"
          >
            开通
          </button>
        </template>
        <template #accountSetName="{ row }">
          <span :title="row.accountSetName || '-'">
            {{ row.accountSetName || '-' }}
          </span>
        </template>
        <template #creditLimit="{ row }">
          <span class="supplier-credit-value">
            {{ formatCreditLimit(row.creditLimit) }}
          </span>
        </template>
        <template #actions="{ row }">
          <div class="supplier-operation-actions">
            <TableAction
              :action-gap="6"
              :actions="[
                {
                  label: $t('common.edit'),
                  type: 'link',
                  icon: ACTION_ICON.EDIT,
                  auth: ['erp:supplier:update'],
                  onClick: handleEdit.bind(null, row),
                },
                {
                  label: row.status === 0 ? '停用' : '启用',
                  type: 'link',
                  icon: ACTION_ICON.CLOSE,
                  auth: ['erp:supplier:update'],
                  onClick: handleToggleStatus.bind(null, row),
                },
              ]"
            />
          </div>
        </template>
      </Grid>
      <div v-if="activationRefreshMaskVisible" class="supplier-activation-mask">
        <div class="supplier-activation-mask__content">
          <Spin size="small" />
          <span>同步最新数据中...</span>
        </div>
      </div>
    </div>
  </Page>
</template>

<style scoped>
.supplier-grid-shell {
  position: relative;
  height: 100%;
  min-height: 100%;
}

.supplier-activation-mask {
  position: absolute;
  z-index: 20;
  inset: 0;
  display: grid;
  place-items: center;
  background: hsl(var(--background) / 58%);
}

.supplier-activation-mask__content {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
  background: hsl(var(--card) / 92%);
  box-shadow: 0 8px 24px rgb(15 23 42 / 12%);
  color: hsl(var(--foreground));
  font-size: 13px;
  line-height: 20px;
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
  white-space: nowrap;
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

:global(.supplier-search-select-dropdown .ant-select-item),
:global(.supplier-search-select-dropdown .ant-empty-description) {
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

:deep(.supplier-operation-actions .table-actions),
:deep(.supplier-operation-actions .ant-space) {
  gap: 2px !important;
}

:deep(.supplier-operation-actions .ant-btn),
:deep(.supplier-operation-actions .ant-btn > span),
:deep(.supplier-operation-actions .vben-link) {
  height: 24px;
  padding: 0 3px;
  font-size: 12px !important;
  line-height: 22px;
}

:deep(.supplier-operation-actions .anticon) {
  font-size: 12px !important;
}

:deep(.supplier-operation-actions .ant-btn) {
  gap: 2px;
}

:deep(.supplier-operation-actions .ant-btn .ant-btn-icon) {
  margin-inline-end: 0 !important;
}

:deep(.supplier-operation-actions .ant-btn > .iconify + span),
:deep(.supplier-operation-actions .ant-btn > span + .iconify) {
  margin-inline-start: 2px !important;
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

.supplier-list-link {
  max-width: 100%;
  padding: 0;
  overflow: hidden;
  color: hsl(var(--primary));
  font: inherit;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: pointer;
  background: transparent;
  border: 0;
}

.supplier-list-link:hover,
.supplier-list-link:focus-visible {
  text-decoration: underline;
}

.supplier-status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 1px 7px;
  border: 1px solid currentcolor;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  line-height: 18px;
}

.supplier-status::before {
  width: 5px;
  height: 5px;
  background: currentcolor;
  border-radius: 50%;
  content: '';
}

.supplier-status.is-enabled {
  color: hsl(var(--success));
  background: hsl(var(--success) / 10%);
}

.supplier-status.is-disabled {
  color: hsl(var(--destructive));
  background: hsl(var(--destructive) / 10%);
}

.supplier-credit-value {
  font-variant-numeric: tabular-nums;
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
</style>
