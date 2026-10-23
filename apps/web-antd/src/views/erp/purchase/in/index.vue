<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpPurchaseInApi } from '#/api/erp/purchase/in';

import {
  computed,
  nextTick,
  onActivated,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from 'vue';

import { useAccess } from '@vben/access';
import { DocAlert, Page, useVbenModal } from '@vben/common-ui';
import { downloadFileFromBlobPart } from '@vben/utils';

import { message, Spin, Tag } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deletePurchaseIn,
  exportPurchaseIn,
  getPurchaseInExportFields,
  getPurchaseInPage,
  getPurchaseInSummary,
  PURCHASE_IN_STATUS,
  updatePurchaseInStatus,
} from '#/api/erp/purchase/in';
import { useFieldPermission } from '#/composables/useFieldPermission';
import ExportFieldModalComponent from '#/views/erp/components/export-field-modal.vue';
import PrintTemplateModal from '#/views/erp/components/PrintTemplateModal.vue';
import PrintTemplateSelector from '#/views/erp/components/PrintTemplateSelector.vue';
import { usePurchaseShortcut } from '#/views/erp/composables/usePurchaseShortcut';
import {
  applyPurchaseDocumentListColumnCustomization,
  fitPurchaseDocumentColumnsToWidth,
  releasePurchaseDocumentTrailingColumnResize,
  syncPurchaseDocumentColumnDefaults,
  syncPurchaseDocumentOperationColumn,
} from '#/views/erp/purchase/utils/document-list-table';
import { isSameFieldSet } from '#/views/erp/purchase/utils/field-permission';
import { withErpKeywordSearchSchema } from '#/views/erp/utils/form-defaults';
import { submitSearchFormOnEnterAndBlur } from '#/views/erp/utils/keyboard';
import { useErpPrintTemplate } from '#/views/erp/utils/print-template';
import { settleVxeColumnCustomization } from '#/views/erp/utils/vxe-column-custom';
import { createVxeHeaderSort } from '#/views/erp/utils/vxe-header-sort';

import PurchaseListQuerySummary from '../components/PurchaseListQuerySummary.vue';
import { usePurchaseQuerySummary } from '../utils/use-purchase-query-summary';
import { useGridColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';
import OrderImportForm from './modules/order-import-form.vue';

defineOptions({ name: 'ErpPurchaseIn' });

const FIELD_PERMISSION_MODULE = 'erp_purchase_in';
const PRINT_TEMPLATE_MODULE = 'purchase_in';
const PRINT_MODULE_NAME = '采购入库';
const PURCHASE_LIST_KEYWORD_SEARCH_PLACEHOLDER =
  '请输入关键词，产品多个条件可用 / 或空格分隔';
const { hiddenFields } = useFieldPermission(FIELD_PERMISSION_MODULE);
const { hasAccessByCodes } = useAccess();

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});
const [OrderImportFormModal, orderImportFormModalApi] = useVbenModal({
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

function buildGridFormSchema(fields = hiddenFields.value) {
  return withErpKeywordSearchSchema(useGridFormSchema(fields), {
    placeholder: PURCHASE_LIST_KEYWORD_SEARCH_PLACEHOLDER,
  });
}

const currentPageRows = ref<ErpPurchaseInApi.PurchaseIn[]>([]);
const activationRefreshMaskVisible = ref(false);
const purchaseInGridShellRef = ref<HTMLElement | null>(null);

function getPurchaseInTableWidth(
  rows: ErpPurchaseInApi.PurchaseIn[] = currentPageRows.value,
) {
  const table =
    purchaseInGridShellRef.value?.querySelector<HTMLElement>('.vxe-table');
  const header = purchaseInGridShellRef.value?.querySelector<HTMLElement>(
    '.vxe-table--header-wrapper.body--wrapper',
  );
  const headerWidth =
    header?.clientWidth ?? purchaseInGridShellRef.value?.clientWidth ?? 0;
  if (!table || rows.length === 0) return headerWidth;

  const scrollbarWidth =
    purchaseInGridShellRef.value
      ?.querySelector<HTMLElement>('.vxe-table--scroll-y-virtual')
      ?.getBoundingClientRect().width ?? 0;
  const alreadyReserved = Math.max(table.clientWidth - headerWidth, 0);
  return Math.max(
    headerWidth - Math.max(scrollbarWidth - alreadyReserved, 0),
    0,
  );
}

function buildPurchaseInListColumns(
  rows = currentPageRows.value,
  fields = hiddenFields.value,
  applyCustomization = true,
) {
  const preparedColumns = (useGridColumns(fields, rows) ?? []) as any[];
  return fitPurchaseDocumentColumnsToWidth(
    applyCustomization
      ? applyPurchaseDocumentListColumnCustomization(
          preparedColumns,
          gridApi.grid?.getFullColumns?.() ?? [],
          72,
        )
      : preparedColumns,
    getPurchaseInTableWidth(rows),
  );
}

async function reloadPurchaseInListColumns(
  rows = currentPageRows.value,
  fields = hiddenFields.value,
  applyCustomization = true,
) {
  const columns = buildPurchaseInListColumns(rows, fields, applyCustomization);
  gridApi.setGridOptions({ columns });
  await gridApi.grid?.reloadColumn?.(columns as any[]);
  await nextTick();
  syncPurchaseDocumentColumnDefaults(
    gridApi.grid?.getFullColumns?.() ?? [],
    (useGridColumns(fields, rows) ?? []) as any[],
  );
  await syncPurchaseDocumentOperationColumn(gridApi.grid, columns);
  releasePurchaseDocumentTrailingColumnResize(
    gridApi.grid?.getFullColumns?.() ?? [],
  );
  await gridApi.grid?.refreshColumn?.();
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
  getPurchaseInSummary(params, signal),
);
const querySummaryItems = computed(() => {
  const value = querySummaryState.summary.value;
  const amount = (field: keyof ErpPurchaseInApi.PurchaseInSummary) =>
    value?.[field] === null || value?.[field] === undefined
      ? '****'
      : formatSummaryAmount(Number(value[field]));
  return [
    {
      key: 'totalCount',
      label: '入库数量',
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
    { key: 'totalFreight1', label: '运费', value: amount('totalFreight1') },
    { key: 'totalPrice', label: '入库总额', value: amount('totalPrice') },
    {
      key: 'totalWithFreight',
      label: '含运费合计',
      value: amount('totalWithFreight'),
    },
  ];
});

const pendingExportParams = ref<Record<string, any>>({});
const purchaseInSortFieldMap: Record<string, string> = {
  no: 'no',
  paymentStatus: 'paymentStatus',
  factoryOrderNo: 'factoryOrderNo',
  createTime: 'createTime',
  status: 'status',
  supplierName: 'supplierId',
  totalProductPrice: 'totalProductPrice',
  discountPrice: 'discountPrice',
  totalPrice: 'totalPrice',
  freightType1: 'freightType1',
  totalFreight1: 'totalFreight1',
  itemCount: 'itemCount',
  totalCount: 'totalCount',
  creatorName: 'creator',
  purchaserName: 'purchaser',
  deptName: 'deptId',
  orderMethod: 'orderMethod',
  settleMethod: 'settleMethod',
  invoiceType: 'invoiceType',
  orderNo: 'orderNo',
  remark: 'remark',
};
const { buildSortParams, handleSortChange, restoreSortState } =
  createVxeHeaderSort(purchaseInSortFieldMap);

async function handleRefresh(resetToFirstPage = false) {
  querySummaryState.invalidate();
  const proxyInfo = gridApi.grid?.getProxyInfo?.();
  if (
    resetToFirstPage &&
    proxyInfo?.pager?.currentPage !== undefined &&
    proxyInfo.pager.currentPage !== 1
  ) {
    await gridApi.grid.commitProxy('page', { currentPage: 1 });
    return;
  }
  // 当前在第一页时，VXE 不会触发分页变化，需要显式查询并刷新数据。
  await gridApi.query();
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

async function handleExport() {
  const selectedIds = (
    (gridApi.grid?.getCheckboxRecords?.() as
      | ErpPurchaseInApi.PurchaseIn[]
      | undefined) ?? []
  )
    .map((item) => item.id!)
    .filter((id) => id !== undefined);
  pendingExportParams.value =
    selectedIds.length > 0
      ? { ids: selectedIds.join(',') }
      : normalizeSearchParams(await gridApi.formApi.getValues());
  exportFieldModalApi
    .setData({
      loadFields: getPurchaseInExportFields,
      moduleKey: 'erp_purchase_in',
    })
    .open();
}

async function handleExportConfirm(fields: string[]) {
  const data = await exportPurchaseIn({
    ...pendingExportParams.value,
    fields: fields.join(','),
  });
  downloadFileFromBlobPart({ fileName: '采购入库.xls', source: data });
}

function handleRowExport(row: ErpPurchaseInApi.PurchaseIn) {
  pendingExportParams.value = { ids: String(row.id) };
  exportFieldModalApi
    .setData({
      loadFields: getPurchaseInExportFields,
      moduleKey: 'erp_purchase_in',
    })
    .open();
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
} = useErpPrintTemplate<ErpPurchaseInApi.PurchaseIn>({
  moduleKey: PRINT_TEMPLATE_MODULE,
  moduleName: PRINT_MODULE_NAME,
  openModal: openPurchasePrintModal,
});

function handleCreate() {
  formModalApi.setData({ type: 'create' }).open();
}

function handleOpenImport() {
  orderImportFormModalApi.open();
}

function handleImportSuccess() {
  handleRefresh(true);
}

function handleEdit(row: ErpPurchaseInApi.PurchaseIn) {
  formModalApi.setData({ type: 'edit', id: row.id, initialData: row }).open();
}

async function handleDelete(
  ids: number[],
  options: { successMessage?: string } = {},
) {
  const hideLoading = message.loading({ content: '删除中...', duration: 0 });
  try {
    await deletePurchaseIn(ids);
    message.success(options.successMessage ?? '删除成功');
    await refreshActivatedPurchaseInPage();
  } catch (error) {
    message.error(resolvePurchaseInDeleteError(error));
  } finally {
    hideLoading();
  }
}

function resolvePurchaseInDeleteError(error: unknown) {
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

async function handleUpdateStatus(
  row: ErpPurchaseInApi.PurchaseIn,
  status: number,
) {
  const hideLoading = message.loading({ content: '审批中...', duration: 0 });
  try {
    await updatePurchaseInStatus(row.id!, status);
    message.success('审批成功');
    handleRefresh();
  } finally {
    hideLoading();
  }
}

const checkedRows = ref<ErpPurchaseInApi.PurchaseIn[]>([]);
const checkedIds = computed(() => checkedRows.value.map((item) => item.id!));
function isPurchaseInDeletable(row: ErpPurchaseInApi.PurchaseIn) {
  return row.status !== PURCHASE_IN_STATUS.APPROVE;
}
const deletableCheckedRows = computed(() =>
  checkedRows.value.filter((item) => isPurchaseInDeletable(item)),
);
const skippedCheckedRows = computed(() =>
  checkedRows.value.filter((item) => !isPurchaseInDeletable(item)),
);
const deletableCheckedIds = computed(() =>
  deletableCheckedRows.value
    .map((item) => item.id)
    .filter((id): id is number => id !== undefined),
);
function handleRowCheckboxChange({
  records,
}: {
  records: ErpPurchaseInApi.PurchaseIn[];
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
      : '删除成功';
  await handleDelete(ids, { successMessage });
}

function handleDetail(row: ErpPurchaseInApi.PurchaseIn) {
  formModalApi.setData({ type: 'detail', id: row.id }).open();
}

function getSettlementStatus(row: ErpPurchaseInApi.PurchaseIn) {
  const status = row.paymentStatus;
  if (status === 2) return { color: 'green', text: '已结算' };
  if (status === 1) return { color: 'blue', text: '部分结算' };
  if (status === 0) return { color: 'default', text: '未结算' };

  const totalPrice = Number(row.totalPrice || 0);
  const paymentPrice = Number(row.paymentPrice || 0);
  if (totalPrice !== 0 && Math.abs(paymentPrice) >= Math.abs(totalPrice)) {
    return { color: 'green', text: '已结算' };
  }
  if (paymentPrice !== 0) {
    return { color: 'blue', text: '部分结算' };
  }
  return { color: 'default', text: '未结算' };
}

function getInvoiceStatus(row: ErpPurchaseInApi.PurchaseIn) {
  return row.hasInvoice
    ? { text: '已开票', tone: 'invoice-done' }
    : { text: '未开票', tone: 'none' };
}

function getAdjustStatus(row: ErpPurchaseInApi.PurchaseIn) {
  if (
    row.adjustStatus === 2 ||
    (row.adjustStatus === undefined && row.adjusted)
  ) {
    return { text: '已调价', tone: 'adjust-done' };
  }
  if (row.adjustStatus === 1) return { text: '部分调价', tone: 'partial' };
  return { text: '未调价', tone: 'none' };
}

function getReturnStatus(row: ErpPurchaseInApi.PurchaseIn) {
  if (row.returnStatus === 2) return { text: '已退货', tone: 'return-done' };
  if (row.returnStatus === 1) return { text: '部分退货', tone: 'partial' };
  return { text: '未退货', tone: 'none' };
}

function getTransferOutStatus(row: ErpPurchaseInApi.PurchaseIn) {
  if (row.transferOutStatus === 2) {
    return { text: '已调拨', tone: 'transfer-done' };
  }
  if (row.transferOutStatus === 1) {
    return { text: '部分调拨', tone: 'partial' };
  }
  return { text: '未调拨', tone: 'none' };
}

function handleSearchEnter(event: KeyboardEvent) {
  submitSearchFormOnEnterAndBlur(event, () => gridApi.formApi.submitForm());
}

usePurchaseShortcut({
  onCreate: () => {
    if (
      activationRefreshMaskVisible.value ||
      !hasAccessByCodes(['erp:purchase-in:create'])
    ) {
      return;
    }
    handleCreate();
  },
  onImport: () => {
    if (
      activationRefreshMaskVisible.value ||
      !hasAccessByCodes(['erp:purchase-in:create'])
    ) {
      return;
    }
    handleOpenImport();
  },
});

async function handlePurchaseInColumnCustom({ type }: { type?: string }) {
  const settled = await settleVxeColumnCustomization(gridApi.grid, type);
  if (!settled) return;
  await reloadPurchaseInListColumns(
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
    columns: useGridColumns(hiddenFields.value),
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
    fit: false,
    id: 'erp-purchase-in-list-v2',
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
          const result = await getPurchaseInPage({
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
          await reloadPurchaseInListColumns(currentPageRows.value);
          if (!pageFailed) void querySummaryState.load(params, summaryChanged);
          return result;
        },
        querySuccess: async () => {
          checkedRows.value = [];
          await nextTick();
          await waitForFrame();
          await waitForFrame();
          await reloadPurchaseInListColumns(currentPageRows.value);
          await restoreSortState(gridApi);
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
      row.status === PURCHASE_IN_STATUS.DRAFT ? 'purchase-in-draft-row' : '',
    toolbarConfig: {
      custom: true,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<ErpPurchaseInApi.PurchaseIn>,
  gridEvents: {
    custom: handlePurchaseInColumnCustom,
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
  void reloadPurchaseInListColumns(currentPageRows.value, fields);
});

let activatedOnce = false;
let activationRefreshVersion = 0;
let listResizeFrame = 0;
let lastListGridWidth = 0;

function handleListWindowResize() {
  cancelAnimationFrame(listResizeFrame);
  listResizeFrame = requestAnimationFrame(() => {
    const width = getPurchaseInTableWidth();
    if (width <= 0 || width === lastListGridWidth) return;
    lastListGridWidth = width;
    void reloadPurchaseInListColumns();
  });
}
async function refreshActivatedPurchaseInPage() {
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
    let result = await getPurchaseInPage({
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
      result = await getPurchaseInPage({
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
    await reloadPurchaseInListColumns(rows);
    if (pager) {
      pager.currentPage = finalPage;
      pager.pageSize = pageSize;
      pager.total = Number(result.total || 0);
    }
    await gridApi.grid?.loadData?.(rows);
    await gridApi.grid?.clearCheckboxRow?.();
    querySummaryState.invalidate();
    void querySummaryState.load(formValues);
    checkedRows.value = [];
    await restoreSortState(gridApi);
  } catch (error) {
    console.error('Error occurred while refreshing purchase in page:', error);
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
  void refreshActivatedPurchaseInPage();
});

onMounted(() => {
  lastListGridWidth = getPurchaseInTableWidth();
  window.addEventListener('resize', handleListWindowResize);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleListWindowResize);
  cancelAnimationFrame(listResizeFrame);
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
      @success="handleRefresh(true)"
    />
    <OrderImportFormModal @success="handleImportSuccess" />
    <ExportFieldModal @confirm="handleExportConfirm" />
    <PrintTemplateDesignModal @printed="handleRefresh" />
    <PrintTemplateSelector
      v-model:open="printTemplateSelectOpen"
      v-model:selected-id="selectedPrintTemplateId"
      :templates="printTemplateOptions"
      @cancel="cancelTemplateSelect"
      @confirm="confirmTemplate"
    />
    <div ref="purchaseInGridShellRef" class="purchase-in-grid-shell">
      <Grid
        table-title="采购入库列表"
        @keydown.enter.capture="handleSearchEnter"
      >
        <template #toolbar-tools>
          <div class="purchase-in-toolbar-tools">
            <TableAction
              :actions="[
                {
                  label: '新增',
                  type: 'primary',
                  icon: ACTION_ICON.ADD,
                  tooltip: 'Insert 新增',
                  auth: ['erp:purchase-in:create'],
                  onClick: handleCreate,
                },
                {
                  label: '导入',
                  type: 'primary',
                  icon: ACTION_ICON.UPLOAD,
                  tooltip: 'I 导入',
                  auth: ['erp:purchase-in:create'],
                  onClick: handleOpenImport,
                },
                {
                  label: '导出',
                  type: 'primary',
                  icon: ACTION_ICON.DOWNLOAD,
                  auth: ['erp:purchase-in:export'],
                  onClick: handleExport,
                },
                {
                  label: '打印模板',
                  type: 'primary',
                  icon: ACTION_ICON.EDIT,
                  auth: ['erp:purchase-in:print-template'],
                  onClick: handleOpenPrintTemplateDesigner,
                },
                {
                  label: '批量删除',
                  type: 'primary',
                  danger: true,
                  ifShow: () => checkedIds.length > 0,
                  icon: ACTION_ICON.DELETE,
                  auth: ['erp:purchase-in:delete'],
                  popConfirm: {
                    title: `确认删除已选的 ${deletableCheckedIds.length} 条可删除数据吗？不可删除数据将自动跳过。`,
                    confirm: handleBatchDelete,
                  },
                },
              ]"
            />
          </div>
        </template>
        <template #deleteAction="{ row }">
          <TableAction
            :actions="[
              {
                label: '删除',
                type: 'link',
                danger: true,
                auth: ['erp:purchase-in:delete'],
                ifShow: () => isPurchaseInDeletable(row),
                popConfirm: {
                  title: `确认删除 ${row.no} 吗？`,
                  confirm: () => handleDelete([row.id!]),
                },
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
                auth: ['erp:purchase-in:print'],
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
                auth: ['erp:purchase-in:export'],
                onClick: handleRowExport.bind(null, row),
              },
            ]"
          />
        </template>
        <template #no="{ row }">
          <span class="purchase-in-no-cell">
            <a
              class="purchase-in-no-cell__link"
              :title="row.no"
              @click.stop="handleDetail(row)"
            >
              {{ row.no }}
            </a>
          </span>
        </template>
        <template #invoiceStatus="{ row }">
          <span
            class="purchase-in-business-status-text"
            :class="`purchase-in-business-status-text--${getInvoiceStatus(row).tone}`"
          >
            {{ getInvoiceStatus(row).text }}
          </span>
        </template>
        <template #adjustStatus="{ row }">
          <span
            class="purchase-in-business-status-text"
            :class="`purchase-in-business-status-text--${getAdjustStatus(row).tone}`"
          >
            {{ getAdjustStatus(row).text }}
          </span>
        </template>
        <template #returnStatus="{ row }">
          <span
            class="purchase-in-business-status-text"
            :class="`purchase-in-business-status-text--${getReturnStatus(row).tone}`"
          >
            {{ getReturnStatus(row).text }}
          </span>
        </template>
        <template #transferOutStatus="{ row }">
          <span
            class="purchase-in-business-status-text"
            :class="`purchase-in-business-status-text--${getTransferOutStatus(row).tone}`"
          >
            {{ getTransferOutStatus(row).text }}
          </span>
        </template>
        <template #settlementStatus="{ row }">
          <Tag :color="getSettlementStatus(row).color">
            {{ getSettlementStatus(row).text }}
          </Tag>
        </template>
        <template #status="{ row }">
          <span
            v-if="row.status === PURCHASE_IN_STATUS.DRAFT"
            class="purchase-in-draft-status"
            title="草稿：页面关闭时自动保存，尚未正式提交"
          >
            草稿
          </span>
          <span v-else>
            {{
              row.status === PURCHASE_IN_STATUS.APPROVE ? '已审核' : '待审核'
            }}
          </span>
        </template>
        <template #continueBuyAction="{ row }">
          <TableAction
            :actions="[
              {
                label: '继续选购',
                type: 'link',
                auth: ['erp:purchase-in:update'],
                ifShow: () => row.status !== 20,
                onClick: handleEdit.bind(null, row),
              },
            ]"
          />
        </template>
        <template #actions="{ row }">
          <TableAction
            :actions="[
              {
                label: '编辑',
                type: 'link',
                icon: ACTION_ICON.EDIT,
                auth: ['erp:purchase-in:update'],
                ifShow: () => row.status !== 20,
                onClick: handleEdit.bind(null, row),
              },
              {
                label: '审批',
                type: 'link',
                icon: ACTION_ICON.AUDIT,
                auth: ['erp:purchase-in:update-status'],
                ifShow: () => row.status === 10,
                popConfirm: {
                  title: `确认审批 ${row.no} 吗？`,
                  confirm: handleUpdateStatus.bind(null, row, 20),
                },
              },
            ]"
          />
        </template>
        <template #bottom>
          <div class="purchase-in-bottom-summary">
            <div class="purchase-in-row-legend">
              <span
                class="purchase-in-row-legend__swatch"
                aria-hidden="true"
              ></span>
              <span>浅蓝色行表示未正式提交的草稿</span>
            </div>
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
        class="purchase-in-activation-mask"
      >
        <div class="purchase-in-activation-mask__content">
          <Spin size="small" />
          <span>同步最新数据中...</span>
        </div>
      </div>
    </div>
  </Page>
</template>

<style scoped>
.purchase-in-grid-shell {
  position: relative;
  height: 100%;
  min-height: 100%;
}

.purchase-in-activation-mask {
  position: absolute;
  z-index: 20;
  inset: 0;
  display: grid;
  place-items: center;
  background: hsl(var(--background) / 58%);
}

.purchase-in-activation-mask__content {
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

:global(.purchase-in-search-select-dropdown .ant-select-item),
:global(.purchase-in-search-select-dropdown .ant-select-tree),
:global(.purchase-in-search-select-dropdown .ant-empty-description) {
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

.purchase-in-toolbar-tools {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.purchase-in-no-cell {
  display: inline-flex;
  width: 100%;
  min-width: 0;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}

.purchase-in-no-cell__link {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.purchase-in-business-status-text {
  color: inherit;
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}

.purchase-in-business-status-text--invoice-done {
  color: #52c41a;
}

.purchase-in-business-status-text--adjust-done {
  color: #1677ff;
}

.purchase-in-business-status-text--return-done {
  color: #fa8c16;
}

.purchase-in-business-status-text--transfer-done {
  color: #722ed1;
}

.purchase-in-business-status-text--partial {
  color: #faad14;
}

:global(html.dark) .purchase-in-business-status-text--invoice-done {
  color: #95de64;
}

:global(html.dark) .purchase-in-business-status-text--adjust-done {
  color: #69b1ff;
}

:global(html.dark) .purchase-in-business-status-text--return-done {
  color: #ffc069;
}

:global(html.dark) .purchase-in-business-status-text--transfer-done {
  color: #b37feb;
}

:global(html.dark) .purchase-in-business-status-text--partial {
  color: #ffd666;
}

:deep(.purchase-in-draft-row .vxe-body--column) {
  background-color: hsl(var(--primary) / 7%) !important;
}

:deep(.purchase-in-draft-row.row--hover .vxe-body--column) {
  background-color: hsl(var(--primary) / 13%) !important;
}

.purchase-in-draft-status {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: hsl(var(--primary));
  font-weight: 600;
}

.purchase-in-draft-status::before {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: currentcolor;
  content: '';
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

.purchase-in-bottom-summary {
  display: flex;
  min-height: 40px;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 4px 14px;
  padding: 5px 8px;
  border-top: 1px solid hsl(var(--border));
  font-size: 12px;
  line-height: 18px;
}

.purchase-in-total-line {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 4px 14px;
}

.purchase-in-row-legend {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

.purchase-in-row-legend__swatch {
  width: 18px;
  height: 10px;
  border: 1px solid hsl(var(--primary) / 24%);
  border-radius: 2px;
  background: hsl(var(--primary) / 7%);
}

@media (max-width: 768px) {
  .purchase-in-bottom-summary {
    align-items: flex-start;
    flex-direction: column;
  }

  .purchase-in-total-line {
    justify-content: flex-start;
  }
}
</style>
