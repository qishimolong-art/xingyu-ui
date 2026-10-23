<script lang="ts" setup>
import type { PurchasePriceAdjustAmountField } from './purchase-price-adjust-list';

import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpPurchasePriceAdjustApi } from '#/api/erp/purchase/priceadjust';

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
import { Page, useVbenModal } from '@vben/common-ui';
import { downloadFileFromBlobPart } from '@vben/utils';

import { message, Spin, Tag } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deletePurchasePriceAdjust,
  exportPurchasePriceAdjust,
  getPurchasePriceAdjustExportFields,
  getPurchasePriceAdjustPage,
  getPurchasePriceAdjustSummary,
  updatePurchasePriceAdjustStatus,
} from '#/api/erp/purchase/priceadjust';
import { useFieldPermission } from '#/composables/useFieldPermission';
import { $t } from '#/locales';
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
import { formatPurchasePriceAdjustAmount } from './purchase-price-adjust-list';
import PurchaseListQuerySummary from '../components/PurchaseListQuerySummary.vue';
import { usePurchaseQuerySummary } from '../utils/use-purchase-query-summary';

/** ERP 采购调价单列表 */
defineOptions({ name: 'ErpPurchasePriceAdjust' });

const FIELD_PERMISSION_MODULE = 'erp_purchase_price_adjust';
const PRINT_TEMPLATE_MODULE = 'purchase_price_adjust';
const PRINT_MODULE_NAME = '采购调价';
const PURCHASE_LIST_KEYWORD_SEARCH_PLACEHOLDER =
  '请输入关键词，产品多个条件可用 / 或空格分隔';
const { hiddenFields } = useFieldPermission(FIELD_PERMISSION_MODULE);
const { hasAccessByCodes } = useAccess();
const canImportPurchasePriceAdjust = computed(
  () =>
    hasAccessByCodes(['erp:purchase-price-adjust:create']) &&
    hasAccessByCodes(['erp:purchase-price-adjust:update-status']),
);

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
const currentPageRows = ref<ErpPurchasePriceAdjustApi.PurchasePriceAdjust[]>(
  [],
);
const purchasePriceAdjustGridShellRef = ref<HTMLElement>();
const activationRefreshMaskVisible = ref(false);

function getPurchasePriceAdjustTableWidth(
  rows: ErpPurchasePriceAdjustApi.PurchasePriceAdjust[] = currentPageRows.value,
) {
  const table =
    purchasePriceAdjustGridShellRef.value?.querySelector<HTMLElement>(
      '.vxe-table',
    );
  const header =
    purchasePriceAdjustGridShellRef.value?.querySelector<HTMLElement>(
      '.vxe-table--header-wrapper.body--wrapper',
    );
  const headerWidth =
    header?.clientWidth ??
    purchasePriceAdjustGridShellRef.value?.clientWidth ??
    0;
  if (!table || rows.length === 0) return headerWidth;

  const scrollbarWidth =
    purchasePriceAdjustGridShellRef.value
      ?.querySelector<HTMLElement>('.vxe-table--scroll-y-virtual')
      ?.getBoundingClientRect().width ?? 0;
  const alreadyReserved = Math.max(table.clientWidth - headerWidth, 0);
  return Math.max(
    headerWidth - Math.max(scrollbarWidth - alreadyReserved, 0),
    0,
  );
}

function buildPurchasePriceAdjustListColumns(
  rows = currentPageRows.value,
  fields = hiddenFields.value,
  applyCustomization = true,
) {
  const preparedColumns = (useGridColumns(fields, rows, {
    canEdit: hasAccessByCodes(['erp:purchase-price-adjust:update']),
    canUpdateStatus: hasAccessByCodes([
      'erp:purchase-price-adjust:update-status',
    ]),
  }) ?? []) as any[];
  return fitPurchaseDocumentColumnsToWidth(
    applyCustomization
      ? applyPurchaseDocumentListColumnCustomization(
          preparedColumns,
          gridApi.grid?.getFullColumns?.() ?? [],
          90,
        )
      : preparedColumns,
    getPurchasePriceAdjustTableWidth(rows),
  );
}

async function reloadPurchasePriceAdjustListColumns(
  rows = currentPageRows.value,
  fields = hiddenFields.value,
  applyCustomization = true,
) {
  const columns = buildPurchasePriceAdjustListColumns(
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
const summaryFieldLabels: Array<{
  field: PurchasePriceAdjustAmountField;
  label: string;
}> = [
  { field: 'originalTotalPrice', label: '原单金额' },
  { field: 'adjustedTotalPrice', label: '调后金额' },
  { field: 'totalAdjustPrice', label: '调价差额' },
  { field: 'paymentPrice', label: '已结算金额' },
];
const visibleGridFields = computed(
  () =>
    new Set(
      (useGridColumns(hiddenFields.value) || [])
        .map((column: any) => column.field)
        .filter(Boolean),
    ),
);
const querySummaryState = usePurchaseQuerySummary((params, signal) =>
  getPurchasePriceAdjustSummary(params, signal),
);
const querySummaryItems = computed(() =>
  summaryFieldLabels
    .filter(({ field }) => visibleGridFields.value.has(field))
    .map(({ field, label }) => ({
      key: field,
      label,
      value:
        querySummaryState.summary.value?.[field] === null ||
        querySummaryState.summary.value?.[field] === undefined
          ? '****'
          : formatPurchasePriceAdjustAmount(
              Number(querySummaryState.summary.value[field]),
            ),
    })),
);

function getStatusLabel(status?: number) {
  if (status === 0) return '草稿';
  if (status === 20) return '已审核';
  if (status === 30) return '已拒绝';
  return '待审核';
}

function getStatusColor(status?: number) {
  if (status === 0) return 'blue';
  if (status === 20) return 'green';
  if (status === 30) return 'red';
  return 'orange';
}

const purchasePriceAdjustSortFieldMap: Record<string, string> = {
  no: 'no',
  supplierName: 'supplierId',
  adjustTime: 'adjustTime',
  status: 'status',
  originalTotalPrice: 'originalTotalPrice',
  adjustedTotalPrice: 'adjustedTotalPrice',
  totalAdjustPrice: 'totalAdjustPrice',
  adjusterName: 'adjuster',
  approverName: 'approverName',
  approveTime: 'approveTime',
  remark: 'remark',
};
const { buildSortParams, handleSortChange, restoreSortState } =
  createVxeHeaderSort(purchasePriceAdjustSortFieldMap);

/** 刷新 */
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
  if (typeof params.no === 'string') {
    const normalized = params.no.trim().replaceAll(/\s+/g, '%');
    params.no = normalized || undefined;
  }
  return params;
}

async function handleExport() {
  const selectedIds = (
    (gridApi.grid?.getCheckboxRecords?.() as
      | ErpPurchasePriceAdjustApi.PurchasePriceAdjust[]
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
      loadFields: getPurchasePriceAdjustExportFields,
      moduleKey: 'erp_purchase_price_adjust',
    })
    .open();
}

async function handleExportConfirm(fields: string[]) {
  const data = await exportPurchasePriceAdjust({
    ...pendingExportParams.value,
    fields: fields.join(','),
  });
  downloadFileFromBlobPart({ fileName: '采购调价单.xls', source: data });
}

/** 新增 */
function handleCreate() {
  formModalApi.setData({ type: 'create' }).open();
}

function handleImport() {
  orderImportFormModalApi.open();
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
} = useErpPrintTemplate<ErpPurchasePriceAdjustApi.PurchasePriceAdjust>({
  moduleKey: PRINT_TEMPLATE_MODULE,
  moduleName: PRINT_MODULE_NAME,
  openModal: openPurchasePrintModal,
});

/** 详情 */
function handleDetail(row: ErpPurchasePriceAdjustApi.PurchasePriceAdjust) {
  formModalApi.setData({ type: 'detail', id: row.id }).open();
}

function handleEdit(row: ErpPurchasePriceAdjustApi.PurchasePriceAdjust) {
  formModalApi.setData({ type: 'edit', id: row.id, initialData: row }).open();
}

/** 删除 */
async function handleDelete(
  ids: number[],
  options: { successMessage?: string } = {},
) {
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting'),
    duration: 0,
  });
  try {
    await deletePurchasePriceAdjust(ids);
    message.success(
      options.successMessage ?? $t('ui.actionMessage.deleteSuccess'),
    );
    await refreshActivatedPurchasePriceAdjustPage();
  } catch (error) {
    message.error(resolvePurchasePriceAdjustDeleteError(error));
  } finally {
    hideLoading();
  }
}

function resolvePurchasePriceAdjustDeleteError(error: unknown) {
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
  row: ErpPurchasePriceAdjustApi.PurchasePriceAdjust,
  status: number,
) {
  const hideLoading = message.loading({ content: '审批中...', duration: 0 });
  try {
    await updatePurchasePriceAdjustStatus(row.id!, status);
    message.success('审批成功');
    handleRefresh();
  } finally {
    hideLoading();
  }
}

const checkedRows = ref<ErpPurchasePriceAdjustApi.PurchasePriceAdjust[]>([]);
const checkedIds = computed(() => checkedRows.value.map((item) => item.id!));
function isPurchasePriceAdjustDeletable(
  row: ErpPurchasePriceAdjustApi.PurchasePriceAdjust,
) {
  return row.status === 0 || row.status === 10;
}
const deletableCheckedRows = computed(() =>
  checkedRows.value.filter((item) => isPurchasePriceAdjustDeletable(item)),
);
const skippedCheckedRows = computed(() =>
  checkedRows.value.filter((item) => !isPurchasePriceAdjustDeletable(item)),
);
const deletableCheckedIds = computed(() =>
  deletableCheckedRows.value
    .map((item) => item.id)
    .filter((id): id is number => id !== undefined),
);
function handleRowCheckboxChange({
  records,
}: {
  records: ErpPurchasePriceAdjustApi.PurchasePriceAdjust[];
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

usePurchaseShortcut({
  onCreate: () => {
    if (
      activationRefreshMaskVisible.value ||
      !hasAccessByCodes(['erp:purchase-price-adjust:create'])
    ) {
      return;
    }
    handleCreate();
  },
  onImport: () => {
    if (
      activationRefreshMaskVisible.value ||
      !canImportPurchasePriceAdjust.value
    ) {
      return;
    }
    handleImport();
  },
});

function handleSearchEnter(event: KeyboardEvent) {
  submitSearchFormOnEnterAndBlur(event, () => gridApi.formApi.submitForm());
}

async function handlePurchasePriceAdjustColumnCustom({
  type,
}: {
  type?: string;
}) {
  const settled = await settleVxeColumnCustomization(gridApi.grid, type);
  if (!settled) return;
  await reloadPurchasePriceAdjustListColumns(
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
    id: 'erp-purchase-price-adjust-list-v2',
    keepSource: true,
    showHeaderOverflow: 'tooltip',
    showOverflow: 'tooltip',
    scrollX: { enabled: true, gt: 8 },
    scrollY: { enabled: true, gt: 10 },
    proxyConfig: {
      ajax: {
        query: async ({ page, sort, sorts }, formValues) => {
          const params = normalizeSearchParams(formValues);
          const summaryChanged = querySummaryState.prepare(params);
          let pageFailed = false;
          const result = await getPurchasePriceAdjustPage({
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
          currentPageRows.value = result.list || [];
          await reloadPurchasePriceAdjustListColumns(currentPageRows.value);
          if (!pageFailed) void querySummaryState.load(params, summaryChanged);
          return result;
        },
        querySuccess: async () => {
          checkedRows.value = [];
          await nextTick();
          await waitForFrame();
          await waitForFrame();
          await reloadPurchasePriceAdjustListColumns(currentPageRows.value);
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
    rowConfig: { keyField: 'id', isHover: true, isCurrent: true },
    rowClassName: ({ row }) =>
      row.status === 0 ? 'purchase-price-adjust-draft-row' : '',
    toolbarConfig: {
      custom: true,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<ErpPurchasePriceAdjustApi.PurchasePriceAdjust>,
  gridEvents: {
    custom: handlePurchasePriceAdjustColumnCustom,
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
  void reloadPurchasePriceAdjustListColumns(currentPageRows.value, fields);
});

let activatedOnce = false;
let activationRefreshVersion = 0;
let listResizeFrame = 0;
let lastListGridWidth = 0;

function handleListWindowResize() {
  cancelAnimationFrame(listResizeFrame);
  listResizeFrame = requestAnimationFrame(() => {
    const width = getPurchasePriceAdjustTableWidth();
    if (width <= 0 || width === lastListGridWidth) return;
    lastListGridWidth = width;
    void reloadPurchasePriceAdjustListColumns();
  });
}

async function refreshActivatedPurchasePriceAdjustPage() {
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
    let result = await getPurchasePriceAdjustPage({
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
      result = await getPurchasePriceAdjustPage({
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
    await reloadPurchasePriceAdjustListColumns(rows);
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
      'Error occurred while refreshing purchase price adjust page:',
      error,
    );
  } finally {
    if (refreshVersion === activationRefreshVersion) {
      activationRefreshMaskVisible.value = false;
    }
  }
}

onMounted(() => {
  lastListGridWidth = getPurchasePriceAdjustTableWidth();
  window.addEventListener('resize', handleListWindowResize);
  void nextTick().then(() => reloadPurchasePriceAdjustListColumns());
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
  void refreshActivatedPurchasePriceAdjustPage();
});
</script>

<template>
  <Page auto-content-height>
    <FormModal
      @edit="handleEdit"
      @print="handlePrint"
      @success="handleRefresh"
    />
    <OrderImportFormModal @success="handleRefresh" />
    <ExportFieldModal @confirm="handleExportConfirm" />
    <PrintTemplateDesignModal @printed="handleRefresh" />
    <PrintTemplateSelector
      v-model:open="printTemplateSelectOpen"
      v-model:selected-id="selectedPrintTemplateId"
      :templates="printTemplateOptions"
      @cancel="cancelTemplateSelect"
      @confirm="confirmTemplate"
    />
    <div
      ref="purchasePriceAdjustGridShellRef"
      class="purchase-price-adjust-grid-shell"
    >
      <Grid
        table-title="采购调价单列表"
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
                auth: ['erp:purchase-price-adjust:create'],
                onClick: handleCreate,
              },
              {
                label: '导入',
                type: 'primary',
                icon: ACTION_ICON.UPLOAD,
                tooltip: 'I 导入',
                auth: ['erp:purchase-price-adjust:create'],
                ifShow: () => canImportPurchasePriceAdjust,
                onClick: handleImport,
              },
              {
                label: $t('ui.actionTitle.export'),
                type: 'primary',
                icon: ACTION_ICON.DOWNLOAD,
                auth: ['erp:purchase-price-adjust:export'],
                onClick: handleExport,
              },
              {
                label: '打印模板',
                type: 'primary',
                icon: ACTION_ICON.EDIT,
                auth: ['erp:purchase-price-adjust:print-template'],
                onClick: handleOpenPrintTemplateDesigner,
              },
              {
                label: '批量删除',
                type: 'primary',
                danger: true,
                ifShow: () => checkedIds.length > 0,
                icon: ACTION_ICON.DELETE,
                auth: ['erp:purchase-price-adjust:delete'],
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
                auth: ['erp:purchase-price-adjust:delete'],
                ifShow: () => isPurchasePriceAdjustDeletable(row),
                popConfirm: {
                  title: $t('ui.actionMessage.deleteConfirm', [row.no]),
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
                auth: ['erp:purchase-price-adjust:print'],
                onClick: handlePrint.bind(null, row),
              },
            ]"
          />
        </template>
        <template #no="{ row }">
          <button
            type="button"
            class="purchase-price-adjust-number-link"
            :title="row.no || ''"
            @click.stop="handleDetail(row)"
          >
            {{ row.no || '-' }}
          </button>
        </template>
        <template #status="{ row }">
          <Tag
            :color="getStatusColor(row.status)"
            class="m-0"
            :title="
              row.status === 0
                ? '草稿：关闭新增或草稿编辑页面时自动保存，尚未正式提交'
                : undefined
            "
          >
            {{ getStatusLabel(row.status) }}
          </Tag>
        </template>
        <template #actions="{ row }">
          <TableAction
            :actions="[
              {
                label: row.status === 0 ? '编辑草稿' : '编辑',
                type: 'link',
                icon: ACTION_ICON.EDIT,
                auth: ['erp:purchase-price-adjust:update'],
                ifShow: () => row.status === 0 || row.status === 10,
                onClick: handleEdit.bind(null, row),
              },
              {
                label: '审批',
                type: 'link',
                icon: ACTION_ICON.AUDIT,
                auth: ['erp:purchase-price-adjust:update-status'],
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
          <div class="purchase-price-adjust-bottom-summary">
            <div class="purchase-price-adjust-row-legend">
              <span
                class="purchase-price-adjust-row-legend__swatch"
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
        class="purchase-price-adjust-activation-mask"
      >
        <div class="purchase-price-adjust-activation-mask__content">
          <Spin size="small" />
          <span>同步最新数据中...</span>
        </div>
      </div>
    </div>
  </Page>
</template>

<style scoped>
.purchase-price-adjust-grid-shell {
  position: relative;
  height: 100%;
  min-height: 100%;
}

.purchase-price-adjust-activation-mask {
  position: absolute;
  z-index: 20;
  inset: 0;
  display: grid;
  place-items: center;
  background: hsl(var(--background) / 58%);
}

.purchase-price-adjust-activation-mask__content {
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

:global(.purchase-price-adjust-search-select-dropdown .ant-select-item),
:global(.purchase-price-adjust-search-select-dropdown .ant-select-tree),
:global(.purchase-price-adjust-search-select-dropdown .ant-empty-description),
:global(
  .purchase-price-adjust-search-picker-dropdown .ant-picker-panel-container
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

:deep(.vxe-toolbar .vxe-tool--item-wrapper),
:deep(.vxe-toolbar .table-actions .ant-btn) {
  font-size: 12px;
}

:deep(.vxe-toolbar .table-actions .ant-btn) {
  height: 28px;
  padding: 2px 10px;
  line-height: 20px;
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

:deep(.purchase-price-adjust-link.ant-btn-link),
:deep(.vxe-body--column .table-actions .ant-btn-link) {
  height: auto;
  padding: 0;
  font-size: 12px;
}

:deep(.purchase-price-adjust-number-link) {
  display: block;
  max-width: 100%;
  padding: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font: inherit;
  color: hsl(var(--primary));
  white-space: nowrap;
  cursor: pointer;
  background: transparent;
  border: 0;
}

:deep(.purchase-price-adjust-number-link:hover),
:deep(.purchase-price-adjust-number-link:focus-visible) {
  text-decoration: underline;
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

.purchase-price-adjust-bottom-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 18px;
  align-items: center;
  justify-content: flex-end;
  min-height: 40px;
  padding: 5px 8px;
  font-size: 12px;
  line-height: 18px;
  border-top: 1px solid hsl(var(--border));
}

.purchase-price-adjust-row-legend {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  margin-right: auto;
  color: hsl(var(--muted-foreground));
}

.purchase-price-adjust-row-legend__swatch {
  width: 18px;
  height: 10px;
  background: hsl(var(--primary) / 10%);
  border: 1px solid hsl(var(--primary) / 30%);
  border-radius: 2px;
}

:deep(.purchase-price-adjust-draft-row .vxe-body--column) {
  background-color: hsl(var(--primary) / 7%) !important;
}

:deep(.purchase-price-adjust-draft-row.row--hover .vxe-body--column) {
  background-color: hsl(var(--primary) / 13%) !important;
}

@media (max-width: 768px) {
  .purchase-price-adjust-bottom-summary {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
