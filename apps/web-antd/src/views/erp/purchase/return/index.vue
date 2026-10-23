<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpPurchaseReturnApi } from '#/api/erp/purchase/return';

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
  deletePurchaseReturn,
  exportPurchaseReturn,
  getPurchaseReturnExportFields,
  getPurchaseReturnPage,
  getPurchaseReturnSummary,
  PURCHASE_RETURN_STATUS,
  updatePurchaseReturnStatus,
} from '#/api/erp/purchase/return';
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
import OrderImportForm from './modules/order-import-form.vue';
import PurchaseListQuerySummary from '../components/PurchaseListQuerySummary.vue';
import { usePurchaseQuerySummary } from '../utils/use-purchase-query-summary';

defineOptions({ name: 'ErpPurchaseReturn' });

const FIELD_PERMISSION_MODULE = 'erp_purchase_return';
const PRINT_TEMPLATE_MODULE = 'purchase_return';
const PRINT_MODULE_NAME = '采购退货';
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

const pendingExportParams = ref<Record<string, any>>({});
const currentPageRows = ref<ErpPurchaseReturnApi.PurchaseReturn[]>([]);
const purchaseReturnGridShellRef = ref<HTMLElement>();
const activationRefreshMaskVisible = ref(false);

function getPurchaseReturnTableWidth(
  rows: ErpPurchaseReturnApi.PurchaseReturn[] = currentPageRows.value,
) {
  const table =
    purchaseReturnGridShellRef.value?.querySelector<HTMLElement>('.vxe-table');
  const header = purchaseReturnGridShellRef.value?.querySelector<HTMLElement>(
    '.vxe-table--header-wrapper.body--wrapper',
  );
  const headerWidth =
    header?.clientWidth ?? purchaseReturnGridShellRef.value?.clientWidth ?? 0;
  if (!table || rows.length === 0) return headerWidth;

  const scrollbarWidth =
    purchaseReturnGridShellRef.value
      ?.querySelector<HTMLElement>('.vxe-table--scroll-y-virtual')
      ?.getBoundingClientRect().width ?? 0;
  const alreadyReserved = Math.max(table.clientWidth - headerWidth, 0);
  return Math.max(
    headerWidth - Math.max(scrollbarWidth - alreadyReserved, 0),
    0,
  );
}

function buildPurchaseReturnListColumns(
  rows = currentPageRows.value,
  fields = hiddenFields.value,
  applyCustomization = true,
) {
  const preparedColumns = (useGridColumns(fields, rows, {
    canEdit: hasAccessByCodes(['erp:purchase-return:update']),
    canUpdateStatus: hasAccessByCodes(['erp:purchase-return:update-status']),
  }) ?? []) as any[];
  return fitPurchaseDocumentColumnsToWidth(
    applyCustomization
      ? applyPurchaseDocumentListColumnCustomization(
          preparedColumns,
          gridApi.grid?.getFullColumns?.() ?? [],
          72,
        )
      : preparedColumns,
    getPurchaseReturnTableWidth(rows),
  );
}

async function reloadPurchaseReturnListColumns(
  rows = currentPageRows.value,
  fields = hiddenFields.value,
  applyCustomization = true,
) {
  const columns = buildPurchaseReturnListColumns(
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

function formatSummaryCount(value: number, maximumFractionDigits = 3) {
  return value.toLocaleString('zh-CN', { maximumFractionDigits });
}

const querySummaryState = usePurchaseQuerySummary((params, signal) =>
  getPurchaseReturnSummary(params, signal),
);
const querySummaryItems = computed(() => {
  const value = querySummaryState.summary.value;
  const count = (field: 'documentCount' | 'itemCount', digits = 0) =>
    value?.[field] === null || value?.[field] === undefined
      ? '****'
      : formatSummaryCount(Number(value[field]), digits);
  return [
    { key: 'documentCount', label: '退货单数', value: count('documentCount') },
    { key: 'itemCount', label: '明细项数', value: count('itemCount') },
    {
      key: 'totalCount',
      label: '退货数量',
      value:
        value?.totalCount === null || value?.totalCount === undefined
          ? '****'
          : formatSummaryCount(Number(value.totalCount)),
    },
    {
      key: 'totalPrice',
      label: '退货总额',
      value:
        value?.totalPrice === null || value?.totalPrice === undefined
          ? '****'
          : formatSummaryAmount(Number(value.totalPrice)),
    },
  ];
});

const purchaseReturnSortFieldMap: Record<string, string> = {
  no: 'no',
  settlementStatus: 'settlementStatus',
  returnTime: 'returnTime',
  supplierName: 'supplierId',
  itemCount: 'itemCount',
  totalCount: 'totalCount',
  totalPrice: 'totalPrice',
  purchaser: 'purchaser',
  status: 'status',
  deptName: 'deptId',
  remark: 'remark',
  creatorName: 'creator',
};
const { buildSortParams, handleSortChange, restoreSortState } =
  createVxeHeaderSort(purchaseReturnSortFieldMap);

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
  // VXE does not emit a page change when it is already on page one. Query
  // explicitly so create/edit/audit success always refreshes the list data.
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
  for (const field of ['no', 'orderNo', 'sourceInNo', 'remark']) {
    if (typeof params[field] === 'string') {
      const normalized = params[field].trim().replaceAll(/\s+/g, '%');
      params[field] = normalized || undefined;
    }
  }
  return params;
}

function handleCreate() {
  formModalApi.setData({ type: 'create' }).open();
}

function handleImport() {
  orderImportFormModalApi.open();
}

async function handleImportSuccess() {
  await handleRefresh(true);
}

function handleEdit(row: ErpPurchaseReturnApi.PurchaseReturn) {
  formModalApi.setData({ type: 'edit', id: row.id, initialData: row }).open();
}

function handleDetail(row: ErpPurchaseReturnApi.PurchaseReturn) {
  formModalApi.setData({ type: 'detail', id: row.id }).open();
}

async function handleDelete(
  ids: number[],
  options: { successMessage?: string } = {},
) {
  const hideLoading = message.loading({ content: '删除中...', duration: 0 });
  try {
    await deletePurchaseReturn(ids);
    message.success(options.successMessage ?? '删除成功');
    await refreshActivatedPurchaseReturnPage();
  } catch (error) {
    message.error(resolvePurchaseReturnDeleteError(error));
  } finally {
    hideLoading();
  }
}

function resolvePurchaseReturnDeleteError(error: unknown) {
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
  row: ErpPurchaseReturnApi.PurchaseReturn,
  status: number,
) {
  const hideLoading = message.loading({ content: '审批中...', duration: 0 });
  try {
    await updatePurchaseReturnStatus(row.id!, status);
    message.success('审批成功');
    await handleRefresh();
  } finally {
    hideLoading();
  }
}

async function handleExport() {
  const selectedIds = (
    (gridApi.grid?.getCheckboxRecords?.() as
      | ErpPurchaseReturnApi.PurchaseReturn[]
      | undefined) ?? []
  )
    .map((item) => item.id!)
    .filter((id) => id !== undefined);
  pendingExportParams.value =
    selectedIds.length > 0
      ? { ids: selectedIds.join(',') }
      : {
          ...normalizeSearchParams(await gridApi.formApi.getValues()),
          ...buildSortParams(),
        };
  exportFieldModalApi
    .setData({
      loadFields: getPurchaseReturnExportFields,
      moduleKey: 'erp_purchase_return',
    })
    .open();
}

async function handleExportConfirm(fields: string[]) {
  const data = await exportPurchaseReturn({
    ...pendingExportParams.value,
    fields: fields.join(','),
  });
  downloadFileFromBlobPart({ fileName: '采购退货.xls', source: data });
}

function handleRowExport(row: ErpPurchaseReturnApi.PurchaseReturn) {
  pendingExportParams.value = { ids: String(row.id) };
  exportFieldModalApi
    .setData({
      loadFields: getPurchaseReturnExportFields,
      moduleKey: 'erp_purchase_return',
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
} = useErpPrintTemplate<ErpPurchaseReturnApi.PurchaseReturn>({
  moduleKey: PRINT_TEMPLATE_MODULE,
  moduleName: PRINT_MODULE_NAME,
  openModal: openPurchasePrintModal,
});

const checkedRows = ref<ErpPurchaseReturnApi.PurchaseReturn[]>([]);
const checkedIds = computed(() => checkedRows.value.map((item) => item.id!));
function isPurchaseReturnDeletable(row: ErpPurchaseReturnApi.PurchaseReturn) {
  return row.status !== PURCHASE_RETURN_STATUS.APPROVE;
}
const deletableCheckedRows = computed(() =>
  checkedRows.value.filter((item) => isPurchaseReturnDeletable(item)),
);
const skippedCheckedRows = computed(() =>
  checkedRows.value.filter((item) => !isPurchaseReturnDeletable(item)),
);
const deletableCheckedIds = computed(() =>
  deletableCheckedRows.value
    .map((item) => item.id)
    .filter((id): id is number => id !== undefined),
);
function handleRowCheckboxChange({
  records,
}: {
  records: ErpPurchaseReturnApi.PurchaseReturn[];
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

function getSettlementStatus(row: ErpPurchaseReturnApi.PurchaseReturn) {
  if (row.status !== 20) {
    return { color: 'default', text: '' };
  }

  const totalPrice = Number(row.totalPrice || 0);
  const refundPrice = Number(row.refundPrice || 0);
  if (totalPrice !== 0 && Math.abs(refundPrice) >= Math.abs(totalPrice)) {
    return { color: 'green', text: '已结算' };
  }
  if (refundPrice !== 0) {
    return { color: 'blue', text: '部分结算' };
  }
  return { color: 'default', text: '待结算' };
}

function handleSearchEnter(event: KeyboardEvent) {
  submitSearchFormOnEnterAndBlur(event, () => gridApi.formApi.submitForm());
}

usePurchaseShortcut({
  onCreate: () => {
    if (
      activationRefreshMaskVisible.value ||
      !hasAccessByCodes(['erp:purchase-return:create'])
    ) {
      return;
    }
    handleCreate();
  },
  onImport: () => {
    if (
      activationRefreshMaskVisible.value ||
      !hasAccessByCodes(['erp:purchase-return:create'])
    ) {
      return;
    }
    handleImport();
  },
});

async function handlePurchaseReturnColumnCustom({ type }: { type?: string }) {
  const settled = await settleVxeColumnCustomization(gridApi.grid, type);
  if (!settled) return;
  await reloadPurchaseReturnListColumns(
    currentPageRows.value,
    hiddenFields.value,
    type !== 'reset',
  );
  await restoreSortState(gridApi);
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
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
    id: 'erp-purchase-return-list-v2',
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
          const result = await getPurchaseReturnPage({
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
          await reloadPurchaseReturnListColumns(currentPageRows.value);
          if (!pageFailed) void querySummaryState.load(params, summaryChanged);
          return result;
        },
        querySuccess: async () => {
          checkedRows.value = [];
          await nextTick();
          await waitForFrame();
          await waitForFrame();
          await reloadPurchaseReturnListColumns(currentPageRows.value);
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
      row.status === PURCHASE_RETURN_STATUS.DRAFT
        ? 'purchase-return-draft-row'
        : '',
    toolbarConfig: {
      custom: true,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<ErpPurchaseReturnApi.PurchaseReturn>,
  gridEvents: {
    custom: handlePurchaseReturnColumnCustom,
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
  void reloadPurchaseReturnListColumns(currentPageRows.value, fields);
});

let activatedOnce = false;
let activationRefreshVersion = 0;
let listResizeFrame = 0;
let lastListGridWidth = 0;

function handleListWindowResize() {
  cancelAnimationFrame(listResizeFrame);
  listResizeFrame = requestAnimationFrame(() => {
    const width = getPurchaseReturnTableWidth();
    if (width <= 0 || width === lastListGridWidth) return;
    lastListGridWidth = width;
    void reloadPurchaseReturnListColumns();
  });
}

async function refreshActivatedPurchaseReturnPage() {
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
    let result = await getPurchaseReturnPage({
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
      result = await getPurchaseReturnPage({
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
    await reloadPurchaseReturnListColumns(rows);
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
      'Error occurred while refreshing purchase return page:',
      error,
    );
  } finally {
    if (refreshVersion === activationRefreshVersion) {
      activationRefreshMaskVisible.value = false;
    }
  }
}

onMounted(() => {
  window.addEventListener('resize', handleListWindowResize);
  void nextTick().then(() => reloadPurchaseReturnListColumns());
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
  void refreshActivatedPurchaseReturnPage();
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
    <div ref="purchaseReturnGridShellRef" class="purchase-return-grid-shell">
      <Grid
        table-title="采购退货列表"
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
                auth: ['erp:purchase-return:create'],
                onClick: handleCreate,
              },
              {
                label: '导入',
                type: 'primary',
                icon: ACTION_ICON.UPLOAD,
                tooltip: 'I 导入',
                auth: ['erp:purchase-return:create'],
                onClick: handleImport,
              },
              {
                label: '导出',
                type: 'primary',
                icon: ACTION_ICON.DOWNLOAD,
                auth: ['erp:purchase-return:export'],
                onClick: handleExport,
              },
              {
                label: '打印模板',
                type: 'primary',
                icon: ACTION_ICON.EDIT,
                auth: ['erp:purchase-return:print-template'],
                onClick: handleOpenPrintTemplateDesigner,
              },
              {
                label: '批量删除',
                type: 'primary',
                danger: true,
                ifShow: () => checkedIds.length > 0,
                icon: ACTION_ICON.DELETE,
                auth: ['erp:purchase-return:delete'],
                popConfirm: {
                  title: `确认删除已选的 ${deletableCheckedIds.length} 条可删除数据吗？不可删除数据将自动跳过。`,
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
                auth: ['erp:purchase-return:delete'],
                ifShow: () => isPurchaseReturnDeletable(row),
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
                auth: ['erp:purchase-return:print'],
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
                auth: ['erp:purchase-return:export'],
                onClick: handleRowExport.bind(null, row),
              },
            ]"
          />
        </template>
        <template #no="{ row }">
          <a @click.stop="handleDetail(row)">{{ row.no }}</a>
        </template>
        <template #settlementStatus="{ row }">
          <Tag
            v-if="getSettlementStatus(row).text"
            :color="getSettlementStatus(row).color"
          >
            {{ getSettlementStatus(row).text }}
          </Tag>
        </template>
        <template #status="{ row }">
          <span
            v-if="row.status === PURCHASE_RETURN_STATUS.DRAFT"
            class="purchase-return-draft-status"
            title="草稿：页面关闭时自动保存，尚未正式提交"
          >
            草稿
          </span>
          <span v-else>
            {{
              row.status === PURCHASE_RETURN_STATUS.APPROVE
                ? '已审核'
                : '待审核'
            }}
          </span>
        </template>
        <template #continueBuyAction="{ row }">
          <TableAction
            :actions="[
              {
                label: '继续选购',
                type: 'link',
                auth: ['erp:purchase-return:update'],
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
                auth: ['erp:purchase-return:update'],
                ifShow: () => row.status !== 20,
                onClick: handleEdit.bind(null, row),
              },
              {
                label: '审批',
                type: 'link',
                icon: ACTION_ICON.AUDIT,
                auth: ['erp:purchase-return:update-status'],
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
          <div class="purchase-return-bottom-summary">
            <div class="purchase-return-row-legend">
              <span
                class="purchase-return-row-legend__swatch"
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
        class="purchase-return-activation-mask"
      >
        <div class="purchase-return-activation-mask__content">
          <Spin size="small" />
          <span>同步最新数据中...</span>
        </div>
      </div>
    </div>
  </Page>
</template>

<style scoped>
.purchase-return-grid-shell {
  position: relative;
  height: 100%;
  min-height: 100%;
}

.purchase-return-activation-mask {
  position: absolute;
  z-index: 20;
  inset: 0;
  display: grid;
  place-items: center;
  background: hsl(var(--background) / 58%);
}

.purchase-return-activation-mask__content {
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

:global(.purchase-return-search-select-dropdown .ant-select-item),
:global(.purchase-return-search-select-dropdown .ant-select-tree),
:global(.purchase-return-search-select-dropdown .ant-empty-description) {
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

:deep(.purchase-return-draft-row .vxe-body--column) {
  background-color: hsl(var(--primary) / 7%) !important;
}

:deep(.purchase-return-draft-row.row--hover .vxe-body--column) {
  background-color: hsl(var(--primary) / 13%) !important;
}

.purchase-return-draft-status {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: hsl(var(--primary));
  font-weight: 600;
}

.purchase-return-draft-status::before {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: currentcolor;
  content: '';
}

.purchase-return-bottom-summary {
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

.purchase-return-row-legend {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-right: auto;
  color: hsl(var(--muted-foreground));
}

.purchase-return-row-legend__swatch {
  width: 18px;
  height: 10px;
  border: 1px solid hsl(var(--primary) / 24%);
  border-radius: 2px;
  background: hsl(var(--primary) / 10%);
}

@media (max-width: 768px) {
  .purchase-return-bottom-summary {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
