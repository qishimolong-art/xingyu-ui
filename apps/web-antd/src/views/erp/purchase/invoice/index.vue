<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpPurchaseInvoiceApi } from '#/api/erp/purchase/invoice';

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

import { message, Spin } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deletePurchaseInvoice,
  exportPurchaseInvoice,
  getPurchaseInvoiceExportFields,
  getPurchaseInvoicePage,
  getPurchaseInvoiceSummary,
  PURCHASE_INVOICE_STATUS,
  updatePurchaseInvoiceStatus,
} from '#/api/erp/purchase/invoice';
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

import { useGridColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';
import ImportForm from './modules/import-form.vue';
import PurchaseListQuerySummary from '../components/PurchaseListQuerySummary.vue';
import { usePurchaseQuerySummary } from '../utils/use-purchase-query-summary';

defineOptions({ name: 'ErpPurchaseInvoice' });

const FIELD_PERMISSION_MODULE = 'erp_purchase_invoice';
const PRINT_TEMPLATE_MODULE = 'purchase_invoice';
const PRINT_MODULE_NAME = '采购发票';
const PURCHASE_LIST_KEYWORD_SEARCH_PLACEHOLDER =
  '请输入关键词，产品多个条件可用 / 或空格分隔';
const { hiddenFields } = useFieldPermission(FIELD_PERMISSION_MODULE);
const { hasAccessByCodes } = useAccess();

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});
const [ImportFormModal, importFormModalApi] = useVbenModal({
  connectedComponent: ImportForm,
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

const currentPageRows = ref<ErpPurchaseInvoiceApi.PurchaseInvoice[]>([]);
const purchaseInvoiceGridShellRef = ref<HTMLElement>();
const activationRefreshMaskVisible = ref(false);

function getPurchaseInvoiceTableWidth(
  rows: ErpPurchaseInvoiceApi.PurchaseInvoice[] = currentPageRows.value,
) {
  const table =
    purchaseInvoiceGridShellRef.value?.querySelector<HTMLElement>('.vxe-table');
  const header = purchaseInvoiceGridShellRef.value?.querySelector<HTMLElement>(
    '.vxe-table--header-wrapper.body--wrapper',
  );
  const headerWidth =
    header?.clientWidth ?? purchaseInvoiceGridShellRef.value?.clientWidth ?? 0;
  if (!table || rows.length === 0) return headerWidth;
  const scrollbarWidth =
    purchaseInvoiceGridShellRef.value
      ?.querySelector<HTMLElement>('.vxe-table--scroll-y-virtual')
      ?.getBoundingClientRect().width ?? 0;
  const alreadyReserved = Math.max(table.clientWidth - headerWidth, 0);
  return Math.max(
    headerWidth - Math.max(scrollbarWidth - alreadyReserved, 0),
    0,
  );
}

function buildPurchaseInvoiceListColumns(
  rows = currentPageRows.value,
  fields = hiddenFields.value,
  applyCustomization = true,
) {
  const preparedColumns = (useGridColumns(fields, rows, {
    canEdit: hasAccessByCodes(['erp:purchase-invoice:update']),
    canUpdateStatus: hasAccessByCodes(['erp:purchase-invoice:update-status']),
  }) ?? []) as any[];
  return fitPurchaseDocumentColumnsToWidth(
    applyCustomization
      ? applyPurchaseDocumentListColumnCustomization(
          preparedColumns,
          gridApi.grid?.getFullColumns?.() ?? [],
          90,
        )
      : preparedColumns,
    getPurchaseInvoiceTableWidth(rows),
  );
}

async function reloadPurchaseInvoiceListColumns(
  rows = currentPageRows.value,
  fields = hiddenFields.value,
  applyCustomization = true,
) {
  const columns = buildPurchaseInvoiceListColumns(
    rows,
    fields,
    applyCustomization,
  );
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

function buildGridFormSchema(fields = hiddenFields.value) {
  return withErpKeywordSearchSchema(useGridFormSchema(fields), {
    placeholder: PURCHASE_LIST_KEYWORD_SEARCH_PLACEHOLDER,
  });
}

function formatSummaryAmount(value: number) {
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const querySummaryState = usePurchaseQuerySummary((params, signal) =>
  getPurchaseInvoiceSummary(params, signal),
);
const querySummaryItems = computed(() => {
  const value = querySummaryState.summary.value;
  const amount = (field: 'taxAmount' | 'taxExclusiveAmount' | 'totalAmount') =>
    value?.[field] === null || value?.[field] === undefined
      ? '****'
      : formatSummaryAmount(Number(value[field]));
  return [
    {
      key: 'invoiceCount',
      label: '发票数量',
      value:
        value?.invoiceCount === null || value?.invoiceCount === undefined
          ? '****'
          : Number(value.invoiceCount).toLocaleString('zh-CN'),
    },
    { key: 'totalAmount', label: '总价税额', value: amount('totalAmount') },
    { key: 'taxAmount', label: '税额', value: amount('taxAmount') },
    {
      key: 'taxExclusiveAmount',
      label: '不含税金额',
      value: amount('taxExclusiveAmount'),
    },
  ];
});
const exportLoading = ref(false);
const pendingExportParams = ref<Record<string, any>>({});
const purchaseInvoiceSortFieldMap: Record<string, string> = {
  auditTime: 'auditTime',
  auditUserName: 'auditUserName',
  createTime: 'createTime',
  creatorName: 'creator',
  displayTaxPercent: 'taxPercent',
  invoiceDate: 'invoiceDate',
  invoiceNo: 'invoiceNo',
  invoiceType: 'invoiceType',
  no: 'no',
  remark: 'remark',
  status: 'status',
  supplierName: 'supplierId',
  supplierType: 'supplierType',
  taxAmount: 'taxAmount',
  taxExclusiveAmount: 'taxExclusiveAmount',
  totalAmount: 'totalAmount',
};
const { buildSortParams, handleSortChange, restoreSortState } =
  createVxeHeaderSort(purchaseInvoiceSortFieldMap);

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
  const showCompleted = params.showCompleted === true;
  delete params.showCompleted;
  if (showCompleted) {
    delete params.invoiceStatus;
  } else {
    params.invoiceStatus = 0;
  }
  if (typeof params.no === 'string') {
    const normalized = params.no.trim().replaceAll(/\s+/g, '%');
    params.no = normalized || undefined;
  }
  if (typeof params.invoiceNo === 'string') {
    const normalized = params.invoiceNo.trim().replaceAll(/\s+/g, '%');
    params.invoiceNo = normalized || undefined;
  }
  return params;
}

function handleCreate() {
  formModalApi.setData({ type: 'create' }).open();
}

function handleOpenImport() {
  importFormModalApi.open();
}

function handleImportSuccess() {
  handleRefresh();
}

function handleDetail(row: ErpPurchaseInvoiceApi.PurchaseInvoice) {
  formModalApi.setData({ type: 'detail', id: row.id }).open();
}

function handleEdit(row: ErpPurchaseInvoiceApi.PurchaseInvoice) {
  formModalApi.setData({ type: 'edit', id: row.id, initialData: row }).open();
}

async function handleDelete(ids: number[], successMessage = '删除成功') {
  const hideLoading = message.loading({ content: '删除中...', duration: 0 });
  try {
    await deletePurchaseInvoice(ids);
    message.success(successMessage);
    await refreshActivatedPurchaseInvoicePage();
  } catch (error) {
    message.error(resolvePurchaseInvoiceDeleteError(error));
  } finally {
    hideLoading();
  }
}

function resolvePurchaseInvoiceDeleteError(error: unknown) {
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
  row: ErpPurchaseInvoiceApi.PurchaseInvoice,
  status: number,
) {
  const hideLoading = message.loading({ content: '审批中...', duration: 0 });
  try {
    await updatePurchaseInvoiceStatus(row.id!, status);
    message.success('审批成功');
    handleRefresh();
  } finally {
    hideLoading();
  }
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
} = useErpPrintTemplate<ErpPurchaseInvoiceApi.PurchaseInvoice>({
  moduleKey: PRINT_TEMPLATE_MODULE,
  moduleName: PRINT_MODULE_NAME,
  openModal: openPurchasePrintModal,
});

async function handleExport() {
  if (exportLoading.value) return;
  const selectedIds = (
    (gridApi.grid?.getCheckboxRecords?.() as
      | ErpPurchaseInvoiceApi.PurchaseInvoice[]
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
      loadFields: getPurchaseInvoiceExportFields,
      moduleKey: 'erp_purchase_invoice',
    })
    .open();
}

async function handleExportConfirm(fields: string[]) {
  exportLoading.value = true;
  const hideLoading = message.loading({ content: '导出中...', duration: 0 });
  try {
    const data = await exportPurchaseInvoice({
      ...pendingExportParams.value,
      fields: fields.join(','),
    });
    downloadFileFromBlobPart({ fileName: '采购发票.xls', source: data });
  } finally {
    hideLoading();
    exportLoading.value = false;
  }
}

const checkedRows = ref<ErpPurchaseInvoiceApi.PurchaseInvoice[]>([]);
const checkedIds = computed(() => checkedRows.value.map((item) => item.id!));
function isEditableStatus(status?: number) {
  return (
    status === PURCHASE_INVOICE_STATUS.DRAFT ||
    status === PURCHASE_INVOICE_STATUS.PROCESS
  );
}
function isPurchaseInvoiceDeletable(
  row: ErpPurchaseInvoiceApi.PurchaseInvoice,
) {
  return isEditableStatus(row.status);
}
const deletableCheckedRows = computed(() =>
  checkedRows.value.filter((item) => isPurchaseInvoiceDeletable(item)),
);
const skippedCheckedRows = computed(() =>
  checkedRows.value.filter((item) => !isPurchaseInvoiceDeletable(item)),
);
const deletableCheckedIds = computed(() =>
  deletableCheckedRows.value
    .map((item) => item.id)
    .filter((id): id is number => id !== undefined),
);
function handleRowCheckboxChange({
  records,
}: {
  records: ErpPurchaseInvoiceApi.PurchaseInvoice[];
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
  await handleDelete(ids, successMessage);
}

function handleSearchEnter(event: KeyboardEvent) {
  submitSearchFormOnEnterAndBlur(event, () => gridApi.formApi.submitForm());
}

usePurchaseShortcut({
  onCreate: () => {
    if (
      activationRefreshMaskVisible.value ||
      !hasAccessByCodes(['erp:purchase-invoice:create'])
    ) {
      return;
    }
    handleCreate();
  },
  onImport: () => {
    if (
      activationRefreshMaskVisible.value ||
      !hasAccessByCodes(['erp:purchase-invoice:import'])
    ) {
      return;
    }
    handleOpenImport();
  },
});

async function handlePurchaseInvoiceColumnCustom({ type }: { type?: string }) {
  const settled = await settleVxeColumnCustomization(gridApi.grid, type);
  if (!settled) return;
  await reloadPurchaseInvoiceListColumns(
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
    fit: false,
    id: 'erp-purchase-invoice-list-v2',
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
          const res = await getPurchaseInvoicePage({
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
          currentPageRows.value = res.list ?? [];
          await reloadPurchaseInvoiceListColumns(currentPageRows.value);
          if (!pageFailed) void querySummaryState.load(params, summaryChanged);
          return res;
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
      row.status === PURCHASE_INVOICE_STATUS.DRAFT
        ? 'purchase-invoice-draft-row'
        : '',
    toolbarConfig: {
      custom: true,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<ErpPurchaseInvoiceApi.PurchaseInvoice>,
  gridEvents: {
    custom: handlePurchaseInvoiceColumnCustom,
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
  void reloadPurchaseInvoiceListColumns(currentPageRows.value, fields);
});

let activatedOnce = false;
let activationRefreshVersion = 0;
let listResizeFrame = 0;
let lastListGridWidth = 0;

function handleListWindowResize() {
  cancelAnimationFrame(listResizeFrame);
  listResizeFrame = requestAnimationFrame(() => {
    const width = getPurchaseInvoiceTableWidth();
    if (width <= 0 || width === lastListGridWidth) return;
    lastListGridWidth = width;
    void reloadPurchaseInvoiceListColumns();
  });
}

async function refreshActivatedPurchaseInvoicePage() {
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
    let result = await getPurchaseInvoicePage({
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
      result = await getPurchaseInvoicePage({
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
    await reloadPurchaseInvoiceListColumns(rows);
    if (pager) {
      pager.currentPage = finalPage;
      pager.pageSize = pageSize;
      pager.total = Number(result.total || 0);
    }
    await gridApi.grid?.loadData?.(rows);
    querySummaryState.invalidate();
    void querySummaryState.load(formValues);
    checkedRows.value = [];
    await gridApi.grid?.clearCheckboxRow?.();
    await restoreSortState(gridApi);
  } catch (error) {
    console.error(
      'Error occurred while refreshing purchase invoice page:',
      error,
    );
  } finally {
    if (refreshVersion === activationRefreshVersion) {
      activationRefreshMaskVisible.value = false;
    }
  }
}

onMounted(() => {
  lastListGridWidth = getPurchaseInvoiceTableWidth();
  window.addEventListener('resize', handleListWindowResize);
  void nextTick().then(() => reloadPurchaseInvoiceListColumns());
});

onBeforeUnmount(() => {
  cancelAnimationFrame(listResizeFrame);
  window.removeEventListener('resize', handleListWindowResize);
});

onActivated(() => {
  if (!activatedOnce) {
    activatedOnce = true;
    return;
  }
  void refreshActivatedPurchaseInvoicePage();
});
</script>

<template>
  <Page auto-content-height>
    <template #doc>
      <DocAlert
        title="【采购】采购发票"
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
    <div ref="purchaseInvoiceGridShellRef" class="purchase-invoice-grid-shell">
      <Grid
        table-title="采购发票列表"
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
                auth: ['erp:purchase-invoice:create'],
                onClick: handleCreate,
              },
              {
                label: '导入',
                type: 'primary',
                icon: ACTION_ICON.UPLOAD,
                tooltip: 'I 导入',
                auth: ['erp:purchase-invoice:import'],
                onClick: handleOpenImport,
              },
              {
                label: '导出',
                type: 'primary',
                icon: ACTION_ICON.DOWNLOAD,
                disabled: exportLoading,
                auth: ['erp:purchase-invoice:export'],
                onClick: handleExport,
              },
              {
                label: '打印模板',
                type: 'primary',
                icon: ACTION_ICON.EDIT,
                auth: ['erp:purchase-invoice:print-template'],
                onClick: handleOpenPrintTemplateDesigner,
              },
              {
                label: '批量删除',
                type: 'primary',
                danger: true,
                ifShow: () => checkedIds.length > 0,
                icon: ACTION_ICON.DELETE,
                auth: ['erp:purchase-invoice:delete'],
                popConfirm: {
                  title: `是否删除所选数据？不可删除数据将自动跳过。`,
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
                auth: ['erp:purchase-invoice:delete'],
                ifShow: () => isPurchaseInvoiceDeletable(row),
                popConfirm: {
                  title: `确认删除 ${row.no} 吗？`,
                  confirm: handleDelete.bind(null, [row.id!]),
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
                auth: ['erp:purchase-invoice:print'],
                onClick: handlePrint.bind(null, row),
              },
            ]"
          />
        </template>
        <template #no="{ row }">
          <a @click.stop="handleDetail(row)">{{ row.no }}</a>
        </template>
        <template #status="{ row }">
          <span
            v-if="row.status === PURCHASE_INVOICE_STATUS.DRAFT"
            class="purchase-invoice-draft-status"
            title="草稿：页面关闭时自动保存，尚未正式提交"
          >
            草稿
          </span>
          <span v-else>
            {{
              row.status === PURCHASE_INVOICE_STATUS.APPROVE
                ? '已审核'
                : '待审核'
            }}
          </span>
        </template>
        <template #bottom>
          <div class="purchase-invoice-bottom-summary">
            <div class="purchase-invoice-row-legend">
              <span
                class="purchase-invoice-row-legend__swatch"
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
        <template #actions="{ row }">
          <TableAction
            :actions="[
              {
                label: '编辑',
                type: 'link',
                icon: ACTION_ICON.EDIT,
                auth: ['erp:purchase-invoice:update'],
                ifShow: () => isEditableStatus(row.status),
                onClick: handleEdit.bind(null, row),
              },
              {
                label: '审批',
                type: 'link',
                icon: ACTION_ICON.AUDIT,
                auth: ['erp:purchase-invoice:update-status'],
                ifShow: () => row.status === PURCHASE_INVOICE_STATUS.PROCESS,
                popConfirm: {
                  title: `确认审批 ${row.no} 吗？`,
                  confirm: handleUpdateStatus.bind(null, row, 20),
                },
              },
            ]"
          />
        </template>
      </Grid>
      <div
        v-if="activationRefreshMaskVisible"
        class="purchase-invoice-activation-mask"
      >
        <div class="purchase-invoice-activation-mask__content">
          <Spin size="small" />
          <span>同步最新数据中...</span>
        </div>
      </div>
    </div>
  </Page>
</template>

<style scoped>
.purchase-invoice-grid-shell {
  position: relative;
  height: 100%;
  min-height: 100%;
}

.purchase-invoice-activation-mask {
  position: absolute;
  z-index: 20;
  inset: 0;
  display: grid;
  place-items: center;
  background: hsl(var(--background) / 58%);
}

.purchase-invoice-activation-mask__content {
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

:global(.purchase-invoice-search-select-dropdown .ant-select-item),
:global(.purchase-invoice-search-select-dropdown .ant-select-tree),
:global(.purchase-invoice-search-select-dropdown .ant-empty-description) {
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

:deep(.purchase-invoice-draft-row .vxe-body--column) {
  background-color: hsl(var(--primary) / 7%) !important;
}

:deep(.purchase-invoice-draft-row.row--hover .vxe-body--column) {
  background-color: hsl(var(--primary) / 13%) !important;
}

.purchase-invoice-draft-status {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: hsl(var(--primary));
  font-weight: 600;
}

.purchase-invoice-draft-status::before {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: currentcolor;
  content: '';
}

.purchase-invoice-bottom-summary {
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

.purchase-invoice-row-legend {
  display: inline-flex;
  align-items: center;
  margin-right: auto;
  gap: 6px;
  color: hsl(var(--muted-foreground));
}

.purchase-invoice-row-legend__swatch {
  width: 18px;
  height: 10px;
  border: 1px solid hsl(var(--primary) / 25%);
  border-radius: 2px;
  background: hsl(var(--primary) / 7%);
}

@media (max-width: 768px) {
  .purchase-invoice-bottom-summary {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
