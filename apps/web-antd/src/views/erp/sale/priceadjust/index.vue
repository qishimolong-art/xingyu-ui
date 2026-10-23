<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpSalePriceAdjustApi } from '#/api/erp/sale/priceadjust';

import { computed, nextTick, onActivated, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { useAccess } from '@vben/access';
import { Page, useVbenModal } from '@vben/common-ui';
import { downloadFileFromBlobPart } from '@vben/utils';

import { Button, message, Spin, Tag } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deleteSalePriceAdjust,
  downloadSalePriceAdjustImportFailureDetails,
  exportSalePriceAdjust,
  exportSalePriceAdjustOrderImportTemplate,
  getSalePriceAdjustExportFields,
  getSalePriceAdjustPage,
  getSalePriceAdjustSummary,
  importSalePriceAdjustOrder,
  updateSalePriceAdjustStatus,
} from '#/api/erp/sale/priceadjust';
import { $t } from '#/locales';
import ExportFieldModalComponent from '#/views/erp/components/export-field-modal.vue';
import PrintTemplateModal from '#/views/erp/components/PrintTemplateModal.vue';
import PrintTemplateSelector from '#/views/erp/components/PrintTemplateSelector.vue';
import { useSaleShortcut } from '#/views/erp/composables/useSaleShortcut';
import SaleOrderImportModal from '#/views/erp/sale/components/sale-order-import-modal.vue';
import SaleListQuerySummary from '#/views/erp/sale/components/SaleListQuerySummary.vue';
import { useSaleQuerySummary } from '#/views/erp/sale/utils/use-sale-query-summary';
import { useErpPrintTemplate } from '#/views/erp/utils/print-template';
import { submitSearchFormOnEnterAndBlur } from '#/views/erp/utils/keyboard';
import { createVxeHeaderSort } from '#/views/erp/utils/vxe-header-sort';

import {
  priceAdjustStatusOptions,
  useGridColumns,
  useGridFormSchema,
} from './data';
import Form from './modules/form.vue';
import { normalizePriceAdjustListRow } from './sale-price-adjust-list';

defineOptions({ name: 'ErpSalePriceAdjust' });

const route = useRoute();
const router = useRouter();
const { hasAccessByCodes } = useAccess();
const PRINT_TEMPLATE_MODULE = 'sale_price_adjust';
const PRINT_MODULE_NAME = '销售调价';

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});
const [ImportModal, importModalApi] = useVbenModal({
  connectedComponent: SaleOrderImportModal,
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
const currentPageRows = ref<ErpSalePriceAdjustApi.PriceAdjust[]>([]);
const activationRefreshMaskVisible = ref(false);

function formatSummaryAmount(value?: null | number) {
  if (value === null || value === undefined) return '****';
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const querySummaryState = useSaleQuerySummary((params, signal) =>
  getSalePriceAdjustSummary(params, signal),
);
const querySummaryItems = computed(() => {
  const value = querySummaryState.summary.value;
  if (!value) return [];
  return [
    {
      key: 'totalOriginalPrice',
      label: '原价金额',
      value: formatSummaryAmount(value.totalOriginalPrice),
    },
    {
      key: 'totalAdjustedPrice',
      label: '调后金额',
      value: formatSummaryAmount(value.totalAdjustedPrice),
    },
    {
      key: 'totalAdjustPrice',
      label: '销售差额',
      value: formatSummaryAmount(value.totalAdjustPrice),
    },
    {
      key: 'taxExclusiveAdjustPrice',
      label: '不含税销售差额',
      value: formatSummaryAmount(value.taxExclusiveAdjustPrice),
    },
    {
      key: 'taxPrice',
      label: '税额',
      value: formatSummaryAmount(value.taxPrice),
    },
  ];
});

function getStatusLabel(status?: number) {
  return (
    priceAdjustStatusOptions.find((item) => item.value === status)?.label || '-'
  );
}

function getStatusColor(status?: number) {
  if (status === 0) return 'blue';
  if (status === 20) return 'green';
  if (status === 30) return 'red';
  return 'orange';
}

const salePriceAdjustSortFieldMap: Record<string, string> = {
  no: 'no',
  customerName: 'customerId',
  adjustDate: 'adjustDate',
  status: 'status',
  totalAdjustPrice: 'totalAdjustPrice',
  creatorName: 'creator',
  createTime: 'createTime',
  updaterName: 'updater',
  updateTime: 'updateTime',
  adjustUserName: 'adjustUserId',
  auditorName: 'updater',
  approveTime: 'updateTime',
};
const { buildSortParams, handleSortChange, restoreSortState } =
  createVxeHeaderSort(salePriceAdjustSortFieldMap);

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

function handleCreate(presetData?: {
  customerId?: string;
  saleOutId?: string;
}) {
  formModalApi.setData({ type: 'create', ...presetData }).open();
}

function handleImport() {
  importModalApi
    .setData({
      title: '导入销售调价明细',
      templateFileName: '销售调价整单导入模板.xls',
      importRequest: importSalePriceAdjustOrder,
      exportTemplateRequest: exportSalePriceAdjustOrderImportTemplate,
      failureDownload: {
        request: downloadSalePriceAdjustImportFailureDetails,
        fileName: '销售调价错误数据.xls',
      },
      templateGuideSummary:
        '列表入口用于批量创建完整销售调价单；同一导入单号的连续明细会合并为一张单据。',
      templateGuideTips: [
        '销售单号用于锁定来源明细，来源商品、数量和原价均不允许由模板改写。',
        '任一单据校验失败时不会创建该单据，错误行可下载后修正。',
      ],
    })
    .open();
}

function handleImportSuccess() {
  handleRefresh();
}

useSaleShortcut({
  onCreate: () => {
    if (
      activationRefreshMaskVisible.value ||
      !hasAccessByCodes(['erp:sale-price-adjust:create'])
    )
      return;
    handleCreate();
  },
  onImport: () => {
    if (
      activationRefreshMaskVisible.value ||
      !hasAccessByCodes(['erp:sale-price-adjust:create'])
    )
      return;
    handleImport();
  },
});

async function handleExport() {
  pendingExportParams.value = {
    ...normalizeSearchParams(await gridApi.formApi.getValues()),
    ids: checkedIds.value.length > 0 ? checkedIds.value : undefined,
  };
  exportFieldModalApi
    .setData({
      loadFields: getSalePriceAdjustExportFields,
      moduleKey: 'erp_sale_price_adjust',
    })
    .open();
}

async function handleExportConfirm(fields: string[]) {
  const data = await exportSalePriceAdjust({
    ...pendingExportParams.value,
    fields: fields.join(','),
  });
  downloadFileFromBlobPart({ fileName: '销售调价单.xls', source: data });
}

function handleEdit(row: ErpSalePriceAdjustApi.PriceAdjust) {
  formModalApi.setData({ type: 'edit', id: row.id, initialData: row }).open();
}

function handleDetail(row: ErpSalePriceAdjustApi.PriceAdjust) {
  formModalApi.setData({ type: 'detail', id: row.id }).open();
}

async function handleDelete(
  ids: number[],
  successMessage = $t('ui.actionMessage.deleteSuccess'),
) {
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting'),
    duration: 0,
  });
  try {
    await deleteSalePriceAdjust(ids);
    message.success(successMessage);
    handleRefresh();
  } finally {
    hideLoading();
  }
}

async function handleApprove(row: ErpSalePriceAdjustApi.PriceAdjust) {
  await updateSalePriceAdjustStatus(row.id!, 20);
  message.success('审批成功，已修改原销售单价格并标记调价');
  handleRefresh();
}

function openSalePrintModal(data: {
  businessId?: number | string;
  businessNo?: string;
  moduleKey: string;
  moduleName: string;
  itemOrderDirection?: 'asc' | 'desc';
  itemOrderField?: string;
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
} = useErpPrintTemplate<ErpSalePriceAdjustApi.PriceAdjust>({
  moduleKey: PRINT_TEMPLATE_MODULE,
  moduleName: PRINT_MODULE_NAME,
  openModal: openSalePrintModal,
});

function handleDetailPrint(payload: any) {
  return handlePrint({
    ...payload.row,
    itemOrderField: payload.itemOrderField,
    itemOrderDirection: payload.itemOrderDirection,
  });
}

const checkedRows = ref<ErpSalePriceAdjustApi.PriceAdjust[]>([]);
const checkedIds = computed(() => checkedRows.value.map((item) => item.id!));
function isPriceAdjustDeletable(row: ErpSalePriceAdjustApi.PriceAdjust) {
  return row.status === 0 || row.status === 10 || row.status === 30;
}
const deletableCheckedRows = computed(() =>
  checkedRows.value.filter((item) => isPriceAdjustDeletable(item)),
);
const skippedCheckedRows = computed(() =>
  checkedRows.value.filter((item) => !isPriceAdjustDeletable(item)),
);
const deletableCheckedIds = computed(() =>
  deletableCheckedRows.value
    .map((item) => item.id)
    .filter((id): id is number => id !== undefined),
);

function handleRowCheckboxChange({
  records,
}: {
  records: ErpSalePriceAdjustApi.PriceAdjust[];
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
  await handleDelete(ids, successMessage);
}

function handleSearchEnter(event: KeyboardEvent) {
  submitSearchFormOnEnterAndBlur(event, () => gridApi.formApi.submitForm());
}

async function reloadSalePriceAdjustColumns(
  rows: ErpSalePriceAdjustApi.PriceAdjust[] = currentPageRows.value,
) {
  await gridApi.grid?.reloadColumn?.(useGridColumns(rows) as any[]);
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    commonConfig: { labelWidth: 68 },
    keywordSearchPlaceholder: '请输入关键词，产品多个条件可用 / 或空格分隔',
    schema: useGridFormSchema(),
  } as any,
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
    fit: false,
    height: 'auto',
    id: 'erp-sale-price-adjust-list-v2',
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
          const params = normalizeSearchParams(formValues);
          const summaryChanged = querySummaryState.prepare(params);
          let pageFailed = false;
          const result = await getSalePriceAdjustPage({
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
          result.list = (result.list || []).map((row) =>
            normalizePriceAdjustListRow(row),
          );
          currentPageRows.value = result.list;
          await reloadSalePriceAdjustColumns(result.list);
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
    rowConfig: { keyField: 'id', isHover: true },
    rowClassName: ({ row }) =>
      row.status === 0 ? 'sale-price-adjust-draft-row' : '',
    toolbarConfig: { refresh: true, search: true },
  } as VxeTableGridOptions<ErpSalePriceAdjustApi.PriceAdjust>,
  gridEvents: {
    sortChange: handleSortChange,
    checkboxAll: handleRowCheckboxChange,
    checkboxChange: handleRowCheckboxChange,
  },
});

let activatedOnce = false;
let activationRefreshVersion = 0;

async function refreshActivatedSalePriceAdjustPage() {
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
    let result = await getSalePriceAdjustPage({
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
      result = await getSalePriceAdjustPage({
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

    const rows = (result.list ?? []).map((row) =>
      normalizePriceAdjustListRow(row),
    );
    currentPageRows.value = rows;
    if (pager) {
      pager.currentPage = finalPage;
      pager.pageSize = pageSize;
      pager.total = Number(result.total || 0);
    }
    await reloadSalePriceAdjustColumns(rows);
    await gridApi.grid?.loadData?.(rows);
    querySummaryState.invalidate();
    void querySummaryState.load(formValues);
    checkedRows.value = [];
    await restoreSortState(gridApi);
  } catch (error) {
    console.error(
      'Error occurred while refreshing sale price adjust page:',
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
  void refreshActivatedSalePriceAdjustPage();
});

watch(
  () => [route.query.action, route.query.customerId, route.query.saleOutId],
  ([action, customerId, saleOutId]) => {
    if (action !== 'create') return;
    handleCreate({
      customerId: customerId as string | undefined,
      saleOutId: saleOutId as string | undefined,
    });
    router.replace({
      path: route.path,
      query: {
        ...route.query,
        action: undefined,
        customerId: undefined,
        saleOutId: undefined,
      },
    });
  },
  { immediate: true },
);
</script>

<template>
  <Page auto-content-height>
    <FormModal @print="handleDetailPrint" @success="handleRefresh" />
    <ImportModal @success="handleImportSuccess" />
    <ExportFieldModal @confirm="handleExportConfirm" />
    <PrintTemplateDesignModal @printed="handleRefresh" />
    <PrintTemplateSelector
      v-model:open="printTemplateSelectOpen"
      v-model:selected-id="selectedPrintTemplateId"
      :templates="printTemplateOptions"
      @cancel="cancelTemplateSelect"
      @confirm="confirmTemplate"
    />
    <div class="sale-price-adjust-grid-shell">
      <Grid
        table-title="销售调价单列表"
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
                auth: ['erp:sale-price-adjust:create'],
                onClick: handleCreate,
              },
              {
                label: '导入',
                type: 'primary',
                icon: ACTION_ICON.UPLOAD,
                tooltip: 'I 导入',
                auth: ['erp:sale-price-adjust:create'],
                onClick: handleImport,
              },
              {
                label: '导出',
                type: 'primary',
                icon: ACTION_ICON.DOWNLOAD,
                auth: ['erp:sale-price-adjust:query'],
                onClick: handleExport,
              },
              {
                label: '打印模板',
                type: 'primary',
                icon: ACTION_ICON.EDIT,
                auth: ['erp:sale-price-adjust:print-template'],
                onClick: handleOpenPrintTemplateDesigner,
              },
              {
                label: '批量删除',
                type: 'primary',
                danger: true,
                ifShow: () => checkedIds.length > 0,
                icon: ACTION_ICON.DELETE,
                auth: ['erp:sale-price-adjust:delete'],
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
                auth: ['erp:sale-price-adjust:delete'],
                ifShow: () => isPriceAdjustDeletable(row),
                popConfirm: {
                  title: $t('ui.actionMessage.deleteConfirm', [row.no]),
                  confirm: handleDelete.bind(null, [row.id!]),
                },
              },
            ]"
          />
        </template>
        <template #printAction="{ row }">
          <Button
            v-access:code="['erp:sale-price-adjust:print']"
            class="sale-price-adjust-link"
            type="link"
            @click="handlePrint(row)"
          >
            打印
          </Button>
        </template>
        <template #no="{ row }">
          <button
            type="button"
            class="sale-price-adjust-number-link"
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
                ? '草稿：关闭页面或草稿编辑页时自动保存，尚未正式提交'
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
                label: $t('common.edit'),
                type: 'link',
                icon: ACTION_ICON.EDIT,
                auth: ['erp:sale-price-adjust:update'],
                ifShow: () =>
                  row.status === 0 || row.status === 10 || row.status === 30,
                onClick: handleEdit.bind(null, row),
              },
              {
                label: '审批',
                type: 'link',
                icon: ACTION_ICON.AUDIT,
                auth: ['erp:sale-price-adjust:update-status'],
                ifShow: () => row.status === 10,
                popConfirm: {
                  title: '确认审批？审批后会修改原销售单价格并标记调价',
                  confirm: handleApprove.bind(null, row),
                },
              },
            ]"
          />
        </template>
        <template #bottom>
          <div class="sale-price-adjust-bottom-summary">
            <div class="sale-price-adjust-row-legend">
              <span
                class="sale-price-adjust-row-legend__swatch"
                aria-hidden="true"
              ></span>
              <span>浅蓝色行表示未正式提交的草稿</span>
            </div>
            <SaleListQuerySummary
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
        class="sale-price-adjust-activation-mask"
      >
        <div class="sale-price-adjust-activation-mask__content">
          <Spin size="small" />
          <span>同步最新数据中...</span>
        </div>
      </div>
    </div>
  </Page>
</template>

<style scoped>
.sale-price-adjust-grid-shell {
  position: relative;
  height: 100%;
  min-height: 100%;
}

.sale-price-adjust-activation-mask {
  position: absolute;
  z-index: 20;
  inset: 0;
  display: grid;
  place-items: center;
  background: hsl(var(--background) / 58%);
}

.sale-price-adjust-activation-mask__content {
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

:global(.sale-price-adjust-search-select-dropdown .ant-select-item),
:global(.sale-price-adjust-search-select-dropdown .ant-select-tree),
:global(.sale-price-adjust-search-select-dropdown .ant-empty-description),
:global(.sale-price-adjust-search-picker-dropdown .ant-picker-panel-container) {
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

:deep(.sale-price-adjust-link.ant-btn-link),
:deep(.vxe-body--column .table-actions .ant-btn-link) {
  height: auto;
  padding: 0;
  font-size: 12px;
}

:deep(.sale-price-adjust-number-link) {
  display: block;
  max-width: 100%;
  padding: 0;
  color: hsl(var(--primary));
  font: inherit;
  white-space: nowrap;
  cursor: pointer;
  background: transparent;
  border: 0;
}

:deep(.sale-price-adjust-number-link:hover),
:deep(.sale-price-adjust-number-link:focus-visible) {
  text-decoration: underline;
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

.sale-price-adjust-bottom-summary {
  display: flex;
  min-height: 40px;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 4px 18px;
  border-top: 1px solid hsl(var(--border));
  padding: 5px 8px;
  font-size: 12px;
  line-height: 18px;
}

.sale-price-adjust-row-legend {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-right: auto;
  color: hsl(var(--muted-foreground));
}

.sale-price-adjust-row-legend__swatch {
  width: 18px;
  height: 10px;
  background: hsl(var(--primary) / 10%);
  border: 1px solid hsl(var(--primary) / 30%);
  border-radius: 2px;
}

:deep(.sale-price-adjust-draft-row .vxe-body--column) {
  background-color: hsl(var(--primary) / 7%) !important;
}

:deep(.sale-price-adjust-draft-row.row--hover .vxe-body--column) {
  background-color: hsl(var(--primary) / 13%) !important;
}

@media (max-width: 768px) {
  .sale-price-adjust-bottom-summary {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
