<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpCustomerApi } from '#/api/erp/sale/customer';

import { nextTick, onActivated, ref } from 'vue';
import { useAccess } from '@vben/access';
import { useDebounceFn, useResizeObserver } from '@vueuse/core';
import {
  applyPurchaseDocumentListColumnCustomization,
  releasePurchaseDocumentTrailingColumnResize,
  syncPurchaseDocumentColumnDefaults,
  syncPurchaseDocumentOperationColumn,
} from '#/views/erp/purchase/utils/document-list-table';
import { settleVxeColumnCustomization } from '#/views/erp/utils/vxe-column-custom';
import { loadCustomerRoleFields } from './utils/field-visibility';

import { DocAlert, Page, useVbenModal } from '@vben/common-ui';
import { CommonStatusEnum } from '@vben/constants';
import { useUserStore } from '@vben/stores';
import { downloadFileFromBlobPart, isEmpty } from '@vben/utils';

import { Alert, message, Modal, Spin, Tag } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import { getBaseDataSimpleList } from '#/api/erp/base';
import {
  batchDisableCustomer,
  exportCustomer,
  getCustomerExportFields,
  getCustomerPage,
  getCustomerMergePage,
  mergeCustomer,
  restoreCustomer,
} from '#/api/erp/sale/customer';
import { $t } from '#/locales';
import ArchiveMergeModalComponent from '#/views/erp/components/archive-merge-modal.vue';
import ExportFieldModalComponent from '#/views/erp/components/export-field-modal.vue';
import ExportSmsVerifyModalComponent from '#/views/erp/components/ExportSmsVerifyModal.vue';
import { useSaleShortcut } from '#/views/erp/composables/useSaleShortcut';

import { buildPriceLevelNameMap } from '#/views/erp/sale/utils/price-level';
import { submitSearchFormOnEnterAndBlur } from '#/views/erp/utils/keyboard';
import { createVxeHeaderSort } from '#/views/erp/utils/vxe-header-sort';

import { useGridColumns, useGridFormSchema } from './data';
import BatchEditForm from './modules/batch-edit-form.vue';
import DeptCreditModalComponent from './modules/dept-credit-modal.vue';
import Detail from './modules/detail.vue';
import EnterpriseMatchModal from './modules/enterprise-match-modal.vue';
import Form from './modules/form.vue';
import ImportForm from './modules/import-form.vue';

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});
const [DetailModal, detailModalApi] = useVbenModal({
  connectedComponent: Detail,
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
const [DeptCreditModal, deptCreditModalApi] = useVbenModal({
  connectedComponent: DeptCreditModalComponent,
  destroyOnClose: true,
});
const [EnterpriseMatchModalInstance, enterpriseMatchModalApi] = useVbenModal({
  connectedComponent: EnterpriseMatchModal,
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

const userStore = useUserStore();
const saleUserNameMap = ref<Record<number, string>>({});
const routeNameMap = ref<Record<number, string>>({});
const saleAreaNameMap = ref<Record<number, string>>({});
const customerTypeNameMap = ref<Record<number, string>>({});
const priceLevelNameMap = ref<Record<number, string>>({});
let priceLabelPromise: Promise<void> | undefined;
const settleMethodNameMap = ref<Record<number, string>>({});
const pendingExportParams = ref<Record<string, any>>({});
const activationRefreshMaskVisible = ref(false);
const { hasAccessByCodes } = useAccess();
const hiddenFields = ref<string[]>([]);
let appliedListPermissionKey = '';
async function loadListPermissions() {
  const fields = await loadCustomerRoleFields();
  hiddenFields.value = fields;
  const key = fields.toSorted().join('|');
  if (key !== appliedListPermissionKey) {
    appliedListPermissionKey = key;
    gridApi.formApi.setState({
      schema: useGridFormSchema().filter(
        (field) =>
          !fields.includes(String(field.fieldName)) &&
          !fields.includes(`col_${String(field.fieldName)}`),
      ),
    });
  }
}
const listLoading = ref(false);
const listError = ref('');
const exportLoading = ref(false);
const pendingExportSmsCode = ref('');
const currentPageRows = ref<ErpCustomerApi.Customer[]>([]);
const customerGridShellRef = ref<HTMLElement>();

const customerSortFieldMap: Record<string, string> = {
  code: 'code',
  name: 'name',
  enterpriseMatchStatusAction: 'enterpriseMatchStatus',
  status: 'status',
  settleMethodName: 'settleMethod',
  areaName: 'areaId',
  routeName: 'routeId',
  priceLevelName: 'priceLevel',
  saleUserName: 'saleUserId',
  customerTypeName: 'customerType',
  detailAddress: 'detailAddress',
  remark: 'remark',
  creator: 'creator',
  createTime: 'createTime',
  mobile: 'mobile',
};
type CustomerFormSuccessPayload =
  | number
  | {
      activeTab?: 'business' | 'images';
      id?: number;
    };
const { buildSortParams, handleSortChange, restoreSortState } =
  createVxeHeaderSort(customerSortFieldMap);

async function loadDisplayOptions() {
  if (!priceLabelPromise)
    priceLabelPromise = getBaseDataSimpleList('price_level')
      .then((options) => {
        priceLevelNameMap.value = buildPriceLevelNameMap(options);
      })
      .catch((error) => {
        priceLabelPromise = undefined;
        throw error;
      });
  await priceLabelPromise;
}

loadDisplayOptions();

function formatMappedName(
  value: null | number | string | undefined,
  nameMap: Record<number, string>,
) {
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  let numericValue = Number.NaN;
  if (typeof value === 'number') {
    numericValue = value;
  } else if (/^\d+$/.test(String(value))) {
    numericValue = Number(value);
  }
  if (!Number.isNaN(numericValue) && nameMap[numericValue]) {
    return nameMap[numericValue];
  }
  return String(value);
}

function mapCustomerDisplayFields(row: ErpCustomerApi.Customer) {
  return {
    ...row,
    areaName:
      row.areaName ?? formatMappedName(row.areaId, saleAreaNameMap.value),
    routeName:
      row.routeName ?? formatMappedName(row.routeId, routeNameMap.value),
    saleUserName:
      row.saleUserName ??
      formatMappedName(row.saleUserId, saleUserNameMap.value),
    customerTypeName:
      row.customerTypeName ??
      formatMappedName(row.customerType, customerTypeNameMap.value),
    priceLevelName: formatMappedName(row.priceLevel, priceLevelNameMap.value),
    settleMethodName:
      row.settleMethodName ??
      formatMappedName(row.settleMethod, settleMethodNameMap.value),
  };
}

/** 刷新表格 */
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

function waitForFrame() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
}

async function handleFormSuccess(payload?: CustomerFormSuccessPayload) {
  handleRefresh();
  const id = typeof payload === 'number' ? payload : payload?.id;
  if (id) {
    const activeTab =
      typeof payload === 'number' ? undefined : payload?.activeTab;
    detailModalApi
      .setData({ id, activeTab } as unknown as ErpCustomerApi.Customer)
      .open();
  }
}

/** 导出数据 */
async function handleExport() {
  if (exportLoading.value || !hasAccessByCodes(['erp:customer:export'])) return;
  pendingExportSmsCode.value = '';
  pendingExportParams.value = {
    ...(checkedIds.value.length
      ? { ids: [...checkedIds.value].join(',') }
      : await gridApi.formApi.getValues()),
    ...buildSortParams(),
  };
  exportSmsVerifyModalApi
    .setData({
      mobile: userStore.userInfo?.mobile,
    })
    .open();
}

async function handleExportSmsConfirm(code: string) {
  pendingExportSmsCode.value = code;
  exportFieldModalApi
    .setData({
      loadFields: getCustomerExportFields,
      moduleKey: 'erp_customer',
    })
    .open();
}

async function handleExportConfirm(fields: string[]) {
  if (exportLoading.value || !hasAccessByCodes(['erp:customer:export'])) return;
  exportLoading.value = true;
  try {
    const data = await exportCustomer({
      ...pendingExportParams.value,
      captchaCode: pendingExportSmsCode.value,
      fields: fields.join(','),
    });
    downloadFileFromBlobPart({ fileName: '客户信息.xlsx', source: data });
  } catch {
    exportSmsVerifyModalApi
      .setData({ mobile: userStore.userInfo?.mobile })
      .open();
  } finally {
    exportLoading.value = false;
  }
}

/** 新增客户 */
function handleCreate() {
  if (
    listLoading.value ||
    activationRefreshMaskVisible.value ||
    !hasAccessByCodes(['erp:customer:create'])
  )
    return;
  formModalApi.setData(null).open();
}

/** 编辑客户 */
function handleEdit(row: ErpCustomerApi.Customer) {
  formModalApi.setData(row).open();
}

/** 查看客户详情 */
function handleDetail(row: ErpCustomerApi.Customer) {
  detailModalApi.setData(row).open();
}

function handleDeptCredit(row: ErpCustomerApi.Customer) {
  deptCreditModalApi.setData(row).open();
}

function handleContactDetail(row: ErpCustomerApi.Customer) {
  handleDetail(row);
}

function handleEnterpriseMatch(row: ErpCustomerApi.Customer) {
  if (row.businessInfoSynced) {
    detailModalApi.setData({ ...row, activeTab: 'business' }).open();
    return;
  }
  enterpriseMatchModalApi.setData(row).open();
}

function getEnterpriseMatchText(row: ErpCustomerApi.Customer) {
  return row.businessInfoSynced === true ? '已同步' : '未同步';
}

/** 打开导入弹窗 */
function handleImport() {
  if (
    listLoading.value ||
    activationRefreshMaskVisible.value ||
    !hasAccessByCodes(['erp:customer:import'])
  )
    return;
  importModalApi.open();
}

useSaleShortcut({
  onCreate: handleCreate,
  onImport: handleImport,
});

/** 打开批量编辑弹窗 */
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
    content: `正在停用 ${checkedIds.value.length} 个客户`,
    duration: 0,
  });
  try {
    await batchDisableCustomer(checkedIds.value);
    message.success('批量停用成功');
    handleRefresh();
  } finally {
    hideLoading();
  }
}

function handleMerge() {
  mergeModalApi
    .setData({
      title: '合并客户',
      archiveName: '客户',
      loadOptions: async () => [],
      loadPage: getCustomerMergePage,
      mergeApi: mergeCustomer,
    })
    .open();
}

function handleToggleStatus(row: ErpCustomerApi.Customer) {
  const isDisabled = row.status === CommonStatusEnum.DISABLE;
  const actionText = isDisabled ? '启用' : '停用';
  Modal.confirm({
    title: `${actionText}确认`,
    content: isDisabled
      ? `确认要启用客户「${row.name}」吗？`
      : `确认要停用客户「${row.name}」吗？停用前系统会校验该客户应收账款是否已结清。`,
    okText: '确认',
    cancelText: '取消',
    onOk: async () => {
      await (isDisabled
        ? restoreCustomer([row.id!])
        : batchDisableCustomer([row.id!]));
      message.success(`${actionText}成功`);
      handleRefresh();
    },
  });
}

const checkedIds = ref<number[]>([]);
function handleRowCheckboxChange({
  records,
}: {
  records: ErpCustomerApi.Customer[];
}) {
  checkedIds.value = records.map((item) => item.id!);
}

function handleSearchEnter(event: KeyboardEvent) {
  submitSearchFormOnEnterAndBlur(event, () => gridApi.formApi.submitForm());
}

function getRowClassName({ row }: { row: ErpCustomerApi.Customer }) {
  if (row.creditBlocked) {
    return 'erp-credit-blocked-row-highlight';
  }
  return row.status === CommonStatusEnum.DISABLE
    ? 'erp-disabled-row-highlight'
    : '';
}

function buildCustomerColumns(rows = currentPageRows.value, preserve = true) {
  const aliases: Record<string, string> = {
    contactAction: 'contact',
    enterpriseMatchStatusAction: 'enterpriseMatchStatus',
    settleMethodName: 'settleMethod',
    priceLevelName: 'priceLevel',
    areaName: 'areaId',
    routeName: 'routeId',
    saleUserName: 'saleUserId',
    customerTypeName: 'customerType',
    creditStatus: 'creditEnabled',
  };
  const hidden = (field: string) =>
    hiddenFields.value.includes(field) ||
    hiddenFields.value.includes(`col_${field}`);
  const columns = (useGridColumns(rows) as any[]).filter(
    (column) => !hidden(aliases[column.field] ?? column.field),
  );
  const action = columns.find((column) => column.field === 'actions');
  if (action) {
    const buttons =
      (hasAccessByCodes(['erp:customer:update']) ? 2 : 0) +
      (hasAccessByCodes(['erp:customer:dept-credit']) ? 1 : 0);
    action.width = buttons
      ? 18 +
        (hasAccessByCodes(['erp:customer:update']) ? 96 : 0) +
        (hasAccessByCodes(['erp:customer:dept-credit']) ? 88 : 0) +
        Math.max(0, buttons - 1) * 8
      : 0;
    action.visible = buttons > 0;
    action.resizable = false;
  }
  const runtime = preserve ? (gridApi.grid?.getFullColumns?.() ?? []) : [];
  return applyPurchaseDocumentListColumnCustomization(
    columns,
    runtime.length ? runtime : columns,
    72,
  );
}
async function reloadCustomerColumns(
  rows = currentPageRows.value,
  preserve = true,
) {
  const columns = buildCustomerColumns(rows, preserve);
  await gridApi.grid?.reloadColumn?.(columns);
  const runtime = gridApi.grid?.getFullColumns?.() ?? [];
  syncPurchaseDocumentColumnDefaults(
    runtime,
    buildCustomerColumns(rows, false),
  );
  await syncPurchaseDocumentOperationColumn(gridApi.grid, columns);
  const action = runtime.find((column: any) => column.field === 'actions');
  if (action) action.resizeWidth = 0;
  releasePurchaseDocumentTrailingColumnResize(runtime);
  await nextTick();
  await gridApi.grid?.recalculate?.(true);
}
async function handleColumnCustom({ type }: { type?: string }) {
  if (await settleVxeColumnCustomization(gridApi.grid, type))
    await reloadCustomerColumns(currentPageRows.value, type !== 'reset');
}
useResizeObserver(
  customerGridShellRef,
  useDebounceFn(() => gridApi.grid?.recalculate?.(true), 60),
);

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    commonConfig: { labelWidth: 84 },
    schema: useGridFormSchema(),
  },
  gridOptions: {
    columns: useGridColumns(currentPageRows.value),
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
    id: 'erp-sale-customer-list-v2',
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
            await loadListPermissions();
            listError.value = '';
            await loadDisplayOptions();
            const result = await getCustomerPage({
              pageNo: page.currentPage,
              pageSize: page.pageSize,
              ...formValues,
              ...buildSortParams(sorts, sort),
            });
            const rows = (result.list || []).map((item) =>
              mapCustomerDisplayFields(item),
            );
            currentPageRows.value = rows;
            await reloadCustomerColumns(rows);
            return {
              ...result,
              list: rows,
            };
          } catch (error) {
            listError.value = '客户列表或权限加载失败，请刷新重试';
            throw error;
          } finally {
            listLoading.value = false;
          }
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
  } as VxeTableGridOptions<ErpCustomerApi.Customer>,
  gridEvents: {
    custom: handleColumnCustom,
    sortChange: handleSortChange,
    checkboxAll: handleRowCheckboxChange,
    checkboxChange: handleRowCheckboxChange,
  },
});

let activatedOnce = false;
let activationRefreshVersion = 0;

async function refreshActivatedCustomerPage() {
  const refreshVersion = ++activationRefreshVersion;
  activationRefreshMaskVisible.value = true;
  try {
    await nextTick();
    await waitForFrame();
    await waitForFrame();
    if (refreshVersion !== activationRefreshVersion) {
      return;
    }
    const proxyInfo = gridApi.grid?.getProxyInfo?.();
    const pager = proxyInfo?.pager;
    const pageSize = Number(pager?.pageSize || 20);
    const currentPage = Number(pager?.currentPage || 1);
    await loadListPermissions();
    await loadDisplayOptions();
    const formValues = await gridApi.formApi.getValues();
    const sortParams = buildSortParams();
    let result = await getCustomerPage({
      pageNo: currentPage,
      pageSize,
      ...formValues,
      ...sortParams,
    });
    const total = Number(result.total || 0);
    const pageCount = Math.max(Math.ceil(total / pageSize), 1);
    const finalPage = Math.min(currentPage, pageCount);
    if (finalPage !== currentPage) {
      result = await getCustomerPage({
        pageNo: finalPage,
        pageSize,
        ...formValues,
        ...sortParams,
      });
    }
    if (refreshVersion !== activationRefreshVersion) {
      return;
    }
    const rows = (result.list ?? []).map((item) =>
      mapCustomerDisplayFields(item),
    );
    currentPageRows.value = rows;
    await reloadCustomerColumns(rows);
    if (pager) {
      pager.currentPage = finalPage;
      pager.pageSize = pageSize;
      pager.total = Number(result.total || 0);
    }
    await gridApi.grid?.loadData?.(rows);
    checkedIds.value = [];
    gridApi.grid?.clearCheckboxRow?.();
    await restoreSortState(gridApi);
  } catch (error) {
    console.error('Error occurred while refreshing customer page:', error);
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
  void refreshActivatedCustomerPage();
});
</script>

<template>
  <Page auto-content-height>
    <template #doc>
      <DocAlert
        title="【销售】客户档案"
        url="https://doc.iocoder.cn/erp/sale/"
      />
    </template>
    <FormModal @success="handleFormSuccess" />
    <DetailModal @success="handleRefresh" />
    <ImportModal @success="handleRefresh" />
    <BatchEditModal @success="handleRefresh" />
    <DeptCreditModal @success="handleRefresh" />
    <EnterpriseMatchModalInstance @success="handleRefresh" />
    <ExportSmsVerifyModal @confirm="handleExportSmsConfirm" />
    <ExportFieldModal @confirm="handleExportConfirm" />
    <MergeModal @success="handleRefresh" />
    <div ref="customerGridShellRef" class="customer-grid-shell">
      <Alert v-if="listError" :message="listError" type="error" show-icon />
      <Grid table-title="客户列表" @keydown.enter.capture="handleSearchEnter">
        <template #toolbar-tools>
          <TableAction
            :actions="[
              {
                label: '新增',
                type: 'primary',
                icon: ACTION_ICON.ADD,
                tooltip: 'Insert 新增',
                auth: ['erp:customer:create'],
                onClick: handleCreate,
              },
              {
                label: '导入',
                type: 'primary',
                icon: ACTION_ICON.UPLOAD,
                tooltip: 'I 导入',
                auth: ['erp:customer:import'],
                onClick: handleImport,
              },
              {
                label: '导出',
                type: 'primary',
                icon: ACTION_ICON.DOWNLOAD,
                auth: ['erp:customer:export'],
                onClick: handleExport,
              },
              {
                label: '批量修改',
                type: 'primary',
                icon: ACTION_ICON.EDIT,
                disabled: isEmpty(checkedIds),
                auth: ['erp:customer:update'],
                onClick: handleBatchEdit,
              },
              {
                label: '批量停用',
                type: 'primary',
                icon: ACTION_ICON.CLOSE,
                disabled: isEmpty(checkedIds),
                auth: ['erp:customer:update'],
                popConfirm: {
                  title:
                    '是否停用所选客户？停用前系统会校验所选客户应收账款是否已结清。',
                  confirm: handleBatchDisable,
                },
              },
              {
                label: '合并',
                type: 'primary',
                icon: ACTION_ICON.COPY,
                auth: ['erp:customer:merge'],
                onClick: handleMerge,
              },
            ]"
          />
        </template>
        <template #contactAction="{ row }">
          <a @click.stop.prevent="handleContactDetail(row)">查看</a>
        </template>
        <template #name="{ row }">
          <button
            type="button"
            class="customer-name-link"
            :title="row.name || ''"
            @click.stop="handleDetail(row)"
          >
            {{ row.name || '-' }}
          </button>
        </template>
        <template #enterpriseMatchStatusAction="{ row }">
          <a @click.stop.prevent="handleEnterpriseMatch(row)">
            {{ getEnterpriseMatchText(row) }}
          </a>
        </template>
        <template #creditStatus="{ row }">
          <Tag v-if="row.creditBlocked" color="red">
            {{
              row.creditTermExceeded && row.creditAmountExceeded
                ? '超额/超期'
                : row.creditAmountExceeded
                  ? '超额'
                  : '超期'
            }}
          </Tag>
          <Tag v-else-if="row.creditEnabled" color="green">正常</Tag>
          <span v-else>-</span>
        </template>
        <template #actions="{ row }">
          <TableAction
            :actions="[
              {
                label: $t('common.edit'),
                type: 'link',
                icon: ACTION_ICON.EDIT,
                auth: ['erp:customer:update'],
                onClick: handleEdit.bind(null, row),
              },
              {
                label: '分部门授信',
                type: 'link',
                icon: ACTION_ICON.EDIT,
                auth: ['erp:customer:dept-credit'],
                onClick: handleDeptCredit.bind(null, row),
              },
              {
                label:
                  row.status === CommonStatusEnum.DISABLE ? '启用' : '停用',
                type: 'link',
                icon: ACTION_ICON.CLOSE,
                auth: ['erp:customer:update'],
                onClick: handleToggleStatus.bind(null, row),
              },
            ]"
          />
        </template>
      </Grid>
      <div v-if="activationRefreshMaskVisible" class="customer-activation-mask">
        <Spin size="small" />
      </div>
    </div>
  </Page>
</template>

<style scoped>
.customer-grid-shell {
  position: relative;
  height: 100%;
  min-height: 100%;
}

.customer-activation-mask {
  position: absolute;
  inset: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  background: rgb(255 255 255 / 38%);
  backdrop-filter: blur(1px);
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

:global(.customer-search-select-dropdown .ant-select-item),
:global(.customer-search-select-dropdown .ant-empty-description),
:global(
  .customer-search-select-dropdown .ant-select-tree-node-content-wrapper
) {
  font-size: 12px;
}

:deep(.vxe-grid--form-wrapper .ant-picker) {
  height: 28px;
  padding: 2px 8px;
}

:deep(.vxe-grid--form-wrapper .ant-btn) {
  height: 28px;
  padding: 2px 10px;
  line-height: 20px;
}

:deep(.vxe-toolbar .vxe-tool--item-wrapper) {
  font-size: 12px;
}

:deep(.vxe-toolbar .table-actions .ant-btn) {
  height: 28px;
  padding: 2px 10px;
  font-size: 12px;
  line-height: 20px;
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

:deep(.vxe-body--column .table-actions .ant-btn-link) {
  height: auto;
  padding: 0;
  font-size: 12px;
}

:deep(.customer-name-link) {
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

:deep(.customer-name-link:hover),
:deep(.customer-name-link:focus-visible) {
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

:deep(.erp-credit-blocked-row-highlight > td) {
  background-color: rgba(239, 68, 68, 0.1);
}

:deep(.erp-credit-blocked-row-highlight:hover > td) {
  background-color: rgba(239, 68, 68, 0.16);
}
</style>
