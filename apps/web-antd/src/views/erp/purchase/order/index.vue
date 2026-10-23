<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpPurchaseOrderApi } from '#/api/erp/purchase/order';

import { computed, nextTick, onActivated, ref, watch } from 'vue';

import { useAccess } from '@vben/access';
import { DocAlert, Page, useVbenModal } from '@vben/common-ui';
import { downloadFileFromBlobPart } from '@vben/utils';

import { message, Spin, Tag } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deletePurchaseOrder,
  exportPurchaseOrder,
  getPurchaseOrderExportFields,
  getPurchaseOrderPage,
  getPurchaseOrderSummary,
  orderPurchaseOrder,
  PURCHASE_ORDER_STATUS,
  reverseSubmitPurchaseOrder,
  submitPurchaseOrder,
} from '#/api/erp/purchase/order';
import { useFieldPermission } from '#/composables/useFieldPermission';
import { $t } from '#/locales';
import ExportFieldModalComponent from '#/views/erp/components/export-field-modal.vue';
import PrintTemplateModal from '#/views/erp/components/PrintTemplateModal.vue';
import PrintTemplateSelector from '#/views/erp/components/PrintTemplateSelector.vue';
import { usePurchaseShortcut } from '#/views/erp/composables/usePurchaseShortcut';
import { isSameFieldSet } from '#/views/erp/purchase/utils/field-permission';
import { applyPurchaseDocumentListColumnCustomization } from '#/views/erp/purchase/utils/document-list-table';
import { withErpKeywordSearchSchema } from '#/views/erp/utils/form-defaults';
import { submitSearchFormOnEnterAndBlur } from '#/views/erp/utils/keyboard';
import { useErpPrintTemplate } from '#/views/erp/utils/print-template';
import { settleVxeColumnCustomization } from '#/views/erp/utils/vxe-column-custom';
import { createVxeHeaderSort } from '#/views/erp/utils/vxe-header-sort';

import { useGridColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';
import OrderImportForm from './modules/order-import-form.vue';
import PurchaseInModal from './modules/purchase-in-modal.vue';
import PurchaseListQuerySummary from '../components/PurchaseListQuerySummary.vue';
import { usePurchaseQuerySummary } from '../utils/use-purchase-query-summary';

/** ERP 采购订单列表 */
defineOptions({ name: 'ErpPurchaseOrder' });

const FIELD_PERMISSION_MODULE = 'erp_purchase_order';
const PRINT_TEMPLATE_MODULE = 'purchase_order';
const PURCHASE_LIST_KEYWORD_SEARCH_PLACEHOLDER =
  '请输入关键词，产品多个条件可用 / 或空格分隔';
const { hiddenFields } = useFieldPermission(FIELD_PERMISSION_MODULE);
const { hasAccessByCodes } = useAccess();
const purchaseOrderActionPermissions = {
  canEdit: hasAccessByCodes(['erp:purchase-order:update']),
  canUpdateStatus: hasAccessByCodes(['erp:purchase-order:update-status']),
};

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});
const [ImportFormModal, importFormModalApi] = useVbenModal({
  connectedComponent: OrderImportForm,
  destroyOnClose: true,
});
const [ExportFieldModal, exportFieldModalApi] = useVbenModal({
  connectedComponent: ExportFieldModalComponent,
  destroyOnClose: true,
});
const [PrintTemplateDesignModal, printTemplateDesignModalApi] = useVbenModal({
  connectedComponent: PrintTemplateModal,
  destroyOnClose: true,
});
const purchaseInModalRef = ref<InstanceType<typeof PurchaseInModal>>();
const currentPageRows = ref<ErpPurchaseOrderApi.PurchaseOrder[]>([]);
const activationRefreshMaskVisible = ref(false);

function buildGridFormSchema(fields = hiddenFields.value) {
  return withErpKeywordSearchSchema(useGridFormSchema(fields), {
    placeholder: PURCHASE_LIST_KEYWORD_SEARCH_PLACEHOLDER,
  });
}

function buildPurchaseOrderListColumns(
  rows = currentPageRows.value,
  fields = hiddenFields.value,
  preserveRuntimeCustomization = true,
) {
  return applyPurchaseDocumentListColumnCustomization(
    (useGridColumns(fields, rows, purchaseOrderActionPermissions) ??
      []) as any[],
    preserveRuntimeCustomization
      ? (gridApi.grid?.getFullColumns?.() ?? [])
      : [],
    72,
  );
}

async function reloadPurchaseOrderListColumns(
  rows = currentPageRows.value,
  fields = hiddenFields.value,
  preserveRuntimeCustomization = true,
) {
  const columns = buildPurchaseOrderListColumns(
    rows,
    fields,
    preserveRuntimeCustomization,
  );
  gridApi.setGridOptions({ columns });
  await gridApi.grid?.reloadColumn?.(columns);
  await nextTick();
  await gridApi.grid?.recalculate?.(true);
}

function formatSummaryAmount(value: number) {
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatSummaryCount(value: number) {
  return value.toLocaleString('zh-CN', {
    maximumFractionDigits: 3,
  });
}

const querySummaryState = usePurchaseQuerySummary((params, signal) =>
  getPurchaseOrderSummary(params, signal),
);
const querySummaryItems = computed(() => {
  const value = querySummaryState.summary.value;
  const amount = (field: keyof ErpPurchaseOrderApi.PurchaseOrderSummary) =>
    value?.[field] === null || value?.[field] === undefined
      ? '****'
      : formatSummaryAmount(Number(value[field]));
  return [
    {
      key: 'totalCount',
      label: '订货数量',
      value:
        value?.totalCount === null || value?.totalCount === undefined
          ? '****'
          : formatSummaryCount(Number(value.totalCount)),
    },
    {
      key: 'totalProductPrice',
      label: '商品金额',
      value: amount('totalProductPrice'),
    },
    { key: 'discountPrice', label: '优惠金额', value: amount('discountPrice') },
    { key: 'feeAmount', label: '其他费用', value: amount('feeAmount') },
    { key: 'depositPrice', label: '预付金额', value: amount('depositPrice') },
    { key: 'totalPrice', label: '订单总额', value: amount('totalPrice') },
  ];
});

const pendingExportParams = ref<Record<string, any>>({});
const purchaseOrderSortFieldMap: Record<string, string> = {
  no: 'no',
  createTime: 'createTime',
  factoryOrderNo: 'factoryOrderNo',
  supplierName: 'supplierId',
  status: 'status',
  inStatus: 'inStatus',
  orderDate: 'orderDate',
  arrivalDate: 'arrivalDate',
  totalCount: 'totalCount',
  totalProductPrice: 'totalProductPrice',
  remark: 'remark',
  deptName: 'deptId',
  creatorName: 'creator',
  purchaserName: 'purchaser',
};
const { buildSortParams, handleSortChange, restoreSortState } =
  createVxeHeaderSort(purchaseOrderSortFieldMap);

/** 刷新表格 */
function handleRefresh() {
  querySummaryState.invalidate();
  gridApi.query();
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

function normalizeSearchParams(values: Record<string, any>) {
  const params = { ...values };
  for (const field of ['no', 'factoryOrderNo', 'remark']) {
    if (typeof params[field] === 'string') {
      const normalized = params[field].trim().replaceAll(/\s+/g, '%');
      params[field] = normalized || undefined;
    }
  }
  return params;
}

/** 导出数据 */
async function handleExport() {
  const selectedIds = (
    (gridApi.grid?.getCheckboxRecords?.() as
      | ErpPurchaseOrderApi.PurchaseOrder[]
      | undefined) ?? []
  )
    .map((item) => item.id!)
    .filter((id) => id !== undefined);
  pendingExportParams.value =
    selectedIds.length > 0
      ? { ids: selectedIds }
      : normalizeSearchParams(await gridApi.formApi.getValues());
  exportFieldModalApi
    .setData({
      loadFields: getPurchaseOrderExportFields,
      moduleKey: 'erp_purchase_order',
    })
    .open();
}

async function handleExportConfirm(fields: string[]) {
  const data = await exportPurchaseOrder({
    ...pendingExportParams.value,
    fields: fields.join(','),
  });
  downloadFileFromBlobPart({ fileName: '采购订单.xls', source: data });
}

async function handleRowExport(row: ErpPurchaseOrderApi.PurchaseOrder) {
  const data = await exportPurchaseOrder({ ids: [row.id!] });
  downloadFileFromBlobPart({ fileName: '采购订单.xls', source: data });
}

function openPurchasePrintModal(data: {
  businessId?: number | string;
  businessNo?: string;
  itemOrderDirection?: 'asc' | 'desc';
  itemOrderField?: string;
  moduleKey: string;
  moduleName: string;
  templateId?: number | string;
}) {
  printTemplateDesignModalApi.setData(data).open();
}

const {
  cancelTemplateSelect,
  confirmTemplate,
  openDesigner: handleOpenPrintTemplateDesigner,
  printRow: handlePrint,
  selectedTemplateId: selectedPrintTemplateId,
  selectorOpen: printTemplateSelectOpen,
  templateOptions: printTemplateOptions,
} = useErpPrintTemplate<ErpPurchaseOrderApi.PurchaseOrder>({
  moduleKey: PRINT_TEMPLATE_MODULE,
  moduleName: '采购订单',
  openModal: openPurchasePrintModal,
});

function handleWechatNotify() {
  message.info('微信通知功能待接入');
}

function handleDepositView() {
  message.info('预付款查看功能待接入');
}

function getPurchaseOrderInStatusText(inStatus?: number) {
  if (inStatus === 2) {
    return '已入库';
  }
  if (inStatus === 1) {
    return '部分入库';
  }
  return '未入库';
}

function getPurchaseOrderInStatusColor(inStatus?: number) {
  if (inStatus === 2) {
    return 'green';
  }
  if (inStatus === 1) {
    return 'orange';
  }
  return 'default';
}

function getPurchaseOrderStatusText(status?: number) {
  if (status === PURCHASE_ORDER_STATUS.DRAFT) {
    return '草稿';
  }
  if (status === PURCHASE_ORDER_STATUS.APPROVE) {
    return '已审核';
  }
  if (status === PURCHASE_ORDER_STATUS.PROCESS) {
    return '待审核';
  }
  return '-';
}

function getPurchaseOrderStatusColor(status?: number) {
  if (status === PURCHASE_ORDER_STATUS.DRAFT) {
    return 'blue';
  }
  if (status === PURCHASE_ORDER_STATUS.APPROVE) {
    return 'green';
  }
  if (status === PURCHASE_ORDER_STATUS.PROCESS) {
    return 'orange';
  }
  return 'default';
}

function isPurchaseOrderInCompleted(row: ErpPurchaseOrderApi.PurchaseOrder) {
  const totalCount = row.totalCount ?? row.count ?? 0;
  const inCount = row.inCount ?? 0;
  return row.inStatus === 2 || (totalCount > 0 && inCount >= totalCount);
}

function hasPurchaseOrderInbound(row: ErpPurchaseOrderApi.PurchaseOrder) {
  return Number(row.inCount ?? 0) > 0;
}

function hasPurchaseOrderReturn(row: ErpPurchaseOrderApi.PurchaseOrder) {
  return Number(row.returnCount ?? 0) > 0;
}

function canReverseSubmit(row: ErpPurchaseOrderApi.PurchaseOrder) {
  return (
    row.status === PURCHASE_ORDER_STATUS.APPROVE &&
    !hasPurchaseOrderInbound(row) &&
    !hasPurchaseOrderReturn(row)
  );
}

/** 新增采购订单 */
function handleCreate() {
  formModalApi.setData({ type: 'create' }).open();
}

function handleImport() {
  importFormModalApi.open();
}

function handleImportSuccess() {
  handleRefresh();
}

function handleOpenPurchaseIn(row: ErpPurchaseOrderApi.PurchaseOrder) {
  if (!row.id) {
    return;
  }
  purchaseInModalRef.value?.open(row.id);
}

/** 编辑采购订单 */
function handleEdit(row: ErpPurchaseOrderApi.PurchaseOrder) {
  formModalApi.setData({ type: 'edit', id: row.id, initialData: row }).open();
}

/** 删除采购订单 */
async function handleDelete(
  ids: number[],
  options: { successMessage?: string } = {},
) {
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting'),
    duration: 0,
  });
  try {
    await deletePurchaseOrder(ids);
    message.success(
      options.successMessage ?? $t('ui.actionMessage.deleteSuccess'),
    );
    await refreshActivatedPurchaseOrderPage();
  } catch (error) {
    message.error(resolvePurchaseOrderDeleteError(error));
  } finally {
    hideLoading();
  }
}

function resolvePurchaseOrderDeleteError(error: unknown) {
  const candidates = [
    (error as any)?.response?.data?.msg,
    (error as any)?.response?.data?.message,
    (error as any)?.data?.msg,
    (error as any)?.data?.message,
    error instanceof Error ? error.message : undefined,
  ];
  const messageText = candidates.find(
    (value) =>
      typeof value === 'string' &&
      value.trim() &&
      !/^\[object\s+(?:Object|PointerEvent)\]$/i.test(value.trim()),
  );
  return messageText?.trim() || '删除失败，请稍后重试';
}

async function handleSubmitOrder(row: ErpPurchaseOrderApi.PurchaseOrder) {
  const hideLoading = message.loading({ content: '提交中...', duration: 0 });
  try {
    await submitPurchaseOrder(row.id!);
    message.success('提交成功');
    handleRefresh();
  } finally {
    hideLoading();
  }
}

async function handleOrderPurchaseOrder(
  row: ErpPurchaseOrderApi.PurchaseOrder,
) {
  const hideLoading = message.loading({ content: '下订中...', duration: 0 });
  try {
    await orderPurchaseOrder(row.id!);
    message.success('下订成功');
    handleRefresh();
  } finally {
    hideLoading();
  }
}

async function handleReverseSubmitOrder(
  row: ErpPurchaseOrderApi.PurchaseOrder,
) {
  const hideLoading = message.loading({ content: '反下订中...', duration: 0 });
  try {
    await reverseSubmitPurchaseOrder(row.id!);
    message.success('反下订成功');
    handleRefresh();
  } finally {
    hideLoading();
  }
}

const checkedRows = ref<ErpPurchaseOrderApi.PurchaseOrder[]>([]);
const checkedIds = computed(() => checkedRows.value.map((item) => item.id!));
function isPurchaseOrderDeletable(row: ErpPurchaseOrderApi.PurchaseOrder) {
  return row.status !== PURCHASE_ORDER_STATUS.APPROVE;
}
const deletableCheckedRows = computed(() =>
  checkedRows.value.filter((item) => isPurchaseOrderDeletable(item)),
);
const skippedCheckedRows = computed(() =>
  checkedRows.value.filter((item) => !isPurchaseOrderDeletable(item)),
);
const deletableCheckedIds = computed(() =>
  deletableCheckedRows.value
    .map((item) => item.id)
    .filter((id): id is number => id !== undefined),
);
function handleRowCheckboxChange({
  records,
}: {
  records: ErpPurchaseOrderApi.PurchaseOrder[];
}) {
  checkedRows.value = records;
}

async function handleBatchDelete() {
  const ids = deletableCheckedIds.value;
  const skippedCount = skippedCheckedRows.value.length;

  if (ids.length === 0) {
    message.warning('当前勾选数据没有可删除项');
    return;
  }

  const successMessage =
    skippedCount > 0
      ? `已删除 ${ids.length} 条，已跳过 ${skippedCount} 条不可删除数据`
      : $t('ui.actionMessage.deleteSuccess');
  await handleDelete(ids, { successMessage });
}

/** 查看详情 */
function handleDetail(row: ErpPurchaseOrderApi.PurchaseOrder) {
  formModalApi.setData({ type: 'detail', id: row.id }).open();
}

function handleSearchEnter(event: KeyboardEvent) {
  submitSearchFormOnEnterAndBlur(event, () => gridApi.formApi.submitForm());
}

usePurchaseShortcut({
  onCreate: () => {
    if (
      activationRefreshMaskVisible.value ||
      !hasAccessByCodes(['erp:purchase-order:create'])
    ) {
      return;
    }
    handleCreate();
  },
  onImport: handleImport,
});

async function handlePurchaseOrderColumnCustom({ type }: { type?: string }) {
  const settled = await settleVxeColumnCustomization(gridApi.grid, type);
  if (!settled) return;
  await reloadPurchaseOrderListColumns(
    currentPageRows.value,
    hiddenFields.value,
    type !== 'reset',
  );
  await restoreSortState(gridApi);
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    commonConfig: { labelWidth: 68 },
    schema: buildGridFormSchema(),
  },
  gridOptions: {
    columns: useGridColumns(
      hiddenFields.value,
      currentPageRows.value,
      purchaseOrderActionPermissions,
    ),
    customConfig: {
      storage: {
        fixed: true,
        resizable: true,
        sort: true,
        visible: true,
      },
    },
    height: 'auto',
    autoResize: true,
    fit: true,
    id: 'erp-purchase-order-list-v4',
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
          const params = normalizeSearchParams(formValues);
          const summaryChanged = querySummaryState.prepare(params);
          let pageFailed = false;
          const result = await getPurchaseOrderPage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            includeItems: false,
            ...params,
            ...buildSortParams(sorts, sort),
          }).catch((error) => {
            pageFailed = true;
            querySummaryState.cancelPending();
            if (currentPageRows.value.length > 0) {
              return {
                list: currentPageRows.value,
                total:
                  gridApi.grid?.getProxyInfo?.()?.pager?.total ??
                  currentPageRows.value.length,
              };
            }
            throw error;
          });
          currentPageRows.value = result.list ?? [];
          await reloadPurchaseOrderListColumns(currentPageRows.value);
          if (!pageFailed) void querySummaryState.load(params, summaryChanged);
          return result;
        },
        querySuccess: () => {
          checkedRows.value = [];
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
    rowClassName: ({ row }) =>
      row.status === PURCHASE_ORDER_STATUS.DRAFT
        ? 'purchase-order-draft-row'
        : '',
    toolbarConfig: {
      refresh: true,
      search: true,
    },
  } as VxeTableGridOptions<ErpPurchaseOrderApi.PurchaseOrder>,
  gridEvents: {
    custom: handlePurchaseOrderColumnCustom,
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
  gridApi.formApi?.setState?.({ schema: buildGridFormSchema(fields) });
  void reloadPurchaseOrderListColumns(currentPageRows.value, fields);
});

let activatedOnce = false;
let activationRefreshVersion = 0;

async function refreshActivatedPurchaseOrderPage() {
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
    const formValues = normalizeSearchParams(await gridApi.formApi.getValues());
    const sortParams = buildSortParams();
    let result = await getPurchaseOrderPage({
      pageNo: currentPage,
      pageSize,
      includeItems: false,
      ...formValues,
      ...sortParams,
    });
    const total = Number(result.total || 0);
    const pageCount = Math.max(Math.ceil(total / pageSize), 1);
    const finalPage = Math.min(currentPage, pageCount);

    if (finalPage !== currentPage) {
      result = await getPurchaseOrderPage({
        pageNo: finalPage,
        pageSize,
        includeItems: false,
        ...formValues,
        ...sortParams,
      });
    }

    if (refreshVersion !== activationRefreshVersion) {
      return;
    }

    const rows = result.list ?? [];
    currentPageRows.value = rows;
    await reloadPurchaseOrderListColumns(rows);
    if (pager) {
      pager.currentPage = finalPage;
      pager.pageSize = pageSize;
      pager.total = Number(result.total || 0);
    }
    await gridApi.grid?.loadData?.(rows);
    querySummaryState.invalidate();
    void querySummaryState.load(formValues);
    checkedRows.value = [];
    await restoreSortState(gridApi);
  } catch (error) {
    console.error(
      'Error occurred while refreshing purchase order page:',
      error,
    );
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
  void refreshActivatedPurchaseOrderPage();
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

    <FormModal
      @edit="handleEdit"
      @print="handlePrint"
      @success="handleRefresh"
    />
    <ImportFormModal @success="handleImportSuccess" />
    <ExportFieldModal @confirm="handleExportConfirm" />
    <PrintTemplateDesignModal @printed="handleRefresh" />
    <PrintTemplateSelector
      v-model:open="printTemplateSelectOpen"
      v-model:selected-id="selectedPrintTemplateId"
      :templates="printTemplateOptions"
      @cancel="cancelTemplateSelect"
      @confirm="confirmTemplate"
    />
    <PurchaseInModal ref="purchaseInModalRef" @success="handleRefresh" />
    <div class="purchase-order-grid-shell">
      <Grid
        table-title="采购订单列表"
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
                auth: ['erp:purchase-order:create'],
                onClick: handleCreate,
              },
              {
                label: '导入',
                type: 'primary',
                icon: ACTION_ICON.UPLOAD,
                tooltip: 'I 导入',
                onClick: handleImport,
              },
              {
                label: $t('ui.actionTitle.export'),
                type: 'primary',
                icon: ACTION_ICON.DOWNLOAD,
                auth: ['erp:purchase-order:export'],
                onClick: handleExport,
              },
              {
                label: '打印模板',
                type: 'primary',
                icon: ACTION_ICON.EDIT,
                auth: ['erp:purchase-order:print-template'],
                onClick: handleOpenPrintTemplateDesigner,
              },
              {
                label: '批量删除',
                type: 'primary',
                danger: true,
                ifShow: () => checkedIds.length > 0,
                icon: ACTION_ICON.DELETE,
                auth: ['erp:purchase-order:delete'],
                popConfirm: {
                  title: `确认删除已选 ${checkedIds.length} 条采购订单吗？不可删除数据将自动跳过。`,
                  confirm: handleBatchDelete,
                },
              },
            ]"
          />
        </template>
        <template #deleteAction="{ row }">
          <TableAction
            :actions="[
              {
                label: '删除',
                type: 'link',
                danger: true,
                auth: ['erp:purchase-order:delete'],
                ifShow: () => isPurchaseOrderDeletable(row),
                popConfirm: {
                  title: $t('ui.actionMessage.deleteConfirm', [row.no]),
                  confirm: () => handleDelete([row.id!]),
                },
              },
            ]"
          />
        </template>
        <template #emptyCell>
          <span></span>
        </template>
        <template #inAction="{ row }">
          <TableAction
            :actions="[
              {
                label: '入库',
                type: 'link',
                auth: ['erp:purchase-in:create'],
                ifShow: () =>
                  row.status === PURCHASE_ORDER_STATUS.APPROVE &&
                  !isPurchaseOrderInCompleted(row),
                onClick: handleOpenPurchaseIn.bind(null, row),
              },
            ]"
          />
        </template>
        <template #printAction="{ row }">
          <TableAction
            :actions="[
              {
                label: '打印',
                type: 'link',
                auth: ['erp:purchase-order:print'],
                onClick: handlePrint.bind(null, row),
              },
            ]"
          />
        </template>
        <template #exportAction="{ row }">
          <TableAction
            :actions="[
              {
                label: '导出',
                type: 'link',
                auth: ['erp:purchase-order:export'],
                onClick: handleRowExport.bind(null, row),
              },
            ]"
          />
        </template>
        <template #no="{ row }">
          <a @click.stop="handleDetail(row)">{{ row.no }}</a>
        </template>
        <template #continueBuyAction="{ row }">
          <TableAction
            :actions="[
              {
                label: '继续选购',
                type: 'link',
                auth: ['erp:purchase-order:update'],
                ifShow: () => row.status !== PURCHASE_ORDER_STATUS.APPROVE,
                onClick: handleEdit.bind(null, row),
              },
            ]"
          />
        </template>
        <template #fixedInStatus="{ row }">
          <Tag :color="getPurchaseOrderInStatusColor(row.inStatus)">
            {{ getPurchaseOrderInStatusText(row.inStatus) }}
          </Tag>
        </template>
        <template #orderStatus="{ row }">
          <span
            v-if="row.status === PURCHASE_ORDER_STATUS.DRAFT"
            class="purchase-order-draft-status"
            title="草稿：创建页面关闭时自动保存，尚未正式提交"
          >
            草稿
          </span>
          <Tag v-else :color="getPurchaseOrderStatusColor(row.status)">
            {{ getPurchaseOrderStatusText(row.status) }}
          </Tag>
        </template>
        <template #wechatNotifyAction>
          <a @click.stop="handleWechatNotify">通知</a>
        </template>
        <template #depositAction>
          <a @click.stop="handleDepositView">查看</a>
        </template>
        <template #printFrequency="{ row }">
          <span>{{ row.printFrequency ?? 0 }}</span>
        </template>
        <template #actions="{ row }">
          <TableAction
            :action-gap="4"
            :actions="[
              {
                label: '编辑',
                type: 'link',
                icon: ACTION_ICON.EDIT,
                auth: ['erp:purchase-order:update'],
                ifShow: () => row.status !== PURCHASE_ORDER_STATUS.APPROVE,
                onClick: handleEdit.bind(null, row),
              },
              {
                label: '提交',
                type: 'link',
                icon: ACTION_ICON.SUBMIT,
                auth: ['erp:purchase-order:update-status'],
                ifShow: () => row.status === PURCHASE_ORDER_STATUS.DRAFT,
                popConfirm: {
                  title: `确认提交采购订单 ${row.no} 吗？提交后将不能再按草稿修改。`,
                  confirm: handleSubmitOrder.bind(null, row),
                },
              },
              {
                label: '下订',
                type: 'link',
                icon: ACTION_ICON.ORDER,
                auth: ['erp:purchase-order:update-status'],
                ifShow: () => row.status === PURCHASE_ORDER_STATUS.PROCESS,
                popConfirm: {
                  title: `确认下订采购订单 ${row.no} 吗？`,
                  confirm: handleOrderPurchaseOrder.bind(null, row),
                },
              },
              {
                label: '反下订',
                type: 'link',
                icon: ACTION_ICON.REVERSE,
                auth: ['erp:purchase-order:update-status'],
                ifShow: () => canReverseSubmit(row),
                popConfirm: {
                  title: `确认反下订 ${row.no} 吗？`,
                  confirm: handleReverseSubmitOrder.bind(null, row),
                },
              },
            ]"
          />
        </template>
        <template #bottom>
          <div class="purchase-order-bottom-summary">
            <span class="purchase-order-row-legend">
              <span
                class="purchase-order-row-legend__swatch"
                aria-hidden="true"
              ></span>
              浅蓝色行表示未正式提交的草稿
            </span>
            <PurchaseListQuerySummary
              :error="querySummaryState.error.value"
              :items="querySummaryItems"
              :loading="querySummaryState.loading.value"
              @retry="querySummaryState.retry"
            />
          </div>
        </template>
      </Grid>
      <div
        v-if="activationRefreshMaskVisible"
        class="purchase-order-activation-mask"
      >
        <div class="purchase-order-activation-mask__content">
          <Spin size="small" />
          <span>同步最新数据中...</span>
        </div>
      </div>
    </div>
  </Page>
</template>

<style scoped>
.purchase-order-grid-shell {
  position: relative;
  height: 100%;
  min-height: 100%;
}

.purchase-order-activation-mask {
  position: absolute;
  z-index: 20;
  inset: 0;
  display: grid;
  place-items: center;
  background: hsl(var(--background) / 58%);
}

.purchase-order-activation-mask__content {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border: 1px solid hsl(var(--border));
  background: hsl(var(--card) / 92%);
  border-radius: 6px;
  box-shadow: 0 8px 24px rgb(15 23 42 / 12%);
  color: hsl(var(--foreground));
  font-size: 13px;
  line-height: 20px;
}

:deep(.purchase-order-draft-row .vxe-body--column) {
  background-color: hsl(var(--primary) / 7%) !important;
}

:deep(.purchase-order-draft-row.row--hover .vxe-body--column) {
  background-color: hsl(var(--primary) / 13%) !important;
}

.purchase-order-draft-status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: hsl(var(--primary));
  font-weight: 500;
  cursor: help;
}

.purchase-order-draft-status::before {
  width: 6px;
  height: 6px;
  flex: 0 0 auto;
  background: currentcolor;
  border-radius: 50%;
  content: '';
}

.purchase-order-print-template-select {
  display: grid;
  gap: 8px;
  width: 100%;
}

.purchase-order-print-template-option {
  display: flex;
  width: 100%;
  min-height: 40px;
  align-items: center;
  gap: 8px;
  margin-inline-end: 0;
  padding: 6px 8px;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
}

.purchase-order-print-template-option__name {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.purchase-order-print-template-option__time {
  color: hsl(var(--muted-foreground));
  font-size: 12px;
}

.purchase-order-row-legend {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-right: auto;
  color: hsl(var(--muted-foreground));
}

.purchase-order-row-legend__swatch {
  width: 18px;
  height: 10px;
  background: hsl(var(--primary) / 10%);
  border: 1px solid hsl(var(--primary) / 30%);
  border-radius: 2px;
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

:global(.purchase-order-search-select-dropdown .ant-select-item),
:global(.purchase-order-search-select-dropdown .ant-select-tree),
:global(.purchase-order-search-select-dropdown .ant-empty-description) {
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

:deep(.vxe-body--column .table-actions .ant-btn-link) {
  height: auto;
  padding: 0;
  font-size: 12px;
}

:deep(.vxe-grid--bottom-wrapper) {
  position: sticky;
  z-index: 4;
  bottom: 36px;
  background: hsl(var(--card));
}

:deep(.vxe-grid--pager-wrapper) {
  position: sticky;
  z-index: 5;
  bottom: 0;
  margin-top: 0 !important;
  background: hsl(var(--card));
  box-shadow: 0 -2px 8px rgb(0 0 0 / 8%);
}

.purchase-order-bottom-summary {
  display: flex;
  min-height: 40px;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 4px 14px;
  padding: 5px 8px;
  border-top: 1px solid hsl(var(--border));
  font-size: 12px;
  line-height: 18px;
}

@media (max-width: 768px) {
  .purchase-order-bottom-summary {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
