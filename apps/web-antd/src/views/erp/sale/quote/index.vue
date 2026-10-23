<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type {
  ErpSaleQuoteApi,
  SaleOrderImportResp,
} from '#/api/erp/sale/quote';

import { computed, nextTick, onActivated, ref } from 'vue';

import { useAccess } from '@vben/access';
import { Page, useVbenModal } from '@vben/common-ui';
import { downloadFileFromBlobPart } from '@vben/utils';

import { Button, message, Modal, Spin } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deleteSaleQuote,
  downloadSaleQuoteImportFailureDetails,
  exportSaleQuote,
  exportSaleQuoteOrderImportTemplate,
  getSaleQuoteExportFields,
  getSaleQuotePage,
  getSaleQuoteSummary,
  importSaleQuoteOrder,
  approveSaleQuote,
  reverseOrderSaleQuote,
} from '#/api/erp/sale/quote';
import { $t } from '#/locales';
import ExportFieldModalComponent from '#/views/erp/components/export-field-modal.vue';
import PrintTemplateModal from '#/views/erp/components/PrintTemplateModal.vue';
import PrintTemplateSelector from '#/views/erp/components/PrintTemplateSelector.vue';
import { useSaleShortcut } from '#/views/erp/composables/useSaleShortcut';
import SaleOrderImportModal from '#/views/erp/sale/components/sale-order-import-modal.vue';
import SaleListQuerySummary from '#/views/erp/sale/components/SaleListQuerySummary.vue';
import {
  applySaleDocumentListColumnCustomization,
  syncSaleDocumentColumnDefaults,
  syncSaleDocumentOperationColumn,
} from '#/views/erp/sale/utils/document-list-table';
import { useSaleQuerySummary } from '#/views/erp/sale/utils/use-sale-query-summary';
import { useErpPrintTemplate } from '#/views/erp/utils/print-template';
import { submitSearchFormOnEnterAndBlur } from '#/views/erp/utils/keyboard';
import { settleVxeColumnCustomization } from '#/views/erp/utils/vxe-column-custom';
import { createVxeHeaderSort } from '#/views/erp/utils/vxe-header-sort';

import { useGridColumns, useGridFormSchema } from './data';
import ConvertCartModal from './modules/convert-cart-modal.vue';
import Form from './modules/form.vue';

defineOptions({ name: 'ErpSaleQuote' });

const PRINT_TEMPLATE_MODULE = 'sale_quote';
const PRINT_MODULE_NAME = '销售报价';
const { hasAccessByCodes } = useAccess();

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

const convertCartModalRef = ref<InstanceType<typeof ConvertCartModal>>();
const pendingExportParams = ref<Record<string, any>>({});
const currentPageRows = ref<ErpSaleQuoteApi.SaleQuote[]>([]);
const activationRefreshMaskVisible = ref(false);
const saleQuoteGridShellRef = ref<HTMLElement>();
function formatSummaryAmount(value?: null | number) {
  if (value === null || value === undefined) return '****';
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const querySummaryState = useSaleQuerySummary((params, signal) =>
  getSaleQuoteSummary(params, signal),
);
const querySummaryItems = computed(() => {
  const value = querySummaryState.summary.value;
  if (!value) return [];
  return [
    {
      key: 'totalProductPrice',
      label: '总金额',
      value: formatSummaryAmount(value.totalProductPrice),
    },
    {
      key: 'discountPrice',
      label: '优惠金额',
      value: formatSummaryAmount(value.discountPrice),
    },
    {
      key: 'totalPrice',
      label: '实收金额',
      value: formatSummaryAmount(value.totalPrice),
    },
  ];
});
const saleQuoteSortFieldMap: Record<string, string> = {
  no: 'no',
  quoteTime: 'quoteTime',
  orderStatus: 'status',
  outStatus: 'status',
  customerName: 'customerId',
  totalProductPrice: 'totalProductPrice',
  discountPrice: 'discountPrice',
  totalPrice: 'totalPrice',
  saleUserName: 'saleUserId',
  deptName: 'deptId',
  deliveryAddress: 'deliveryAddress',
  expectedDeliveryTime: 'expectedDeliveryTime',
  remark: 'remark',
  internalRemark: 'internalRemark',
  creatorName: 'creator',
  createTime: 'createTime',
  updaterName: 'updater',
  updateTime: 'updateTime',
};
const { buildSortParams, handleSortChange, restoreSortState } =
  createVxeHeaderSort(saleQuoteSortFieldMap);

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
  const params: Record<string, any> = {};
  Object.entries(values || {}).forEach(([key, value]) => {
    if (value === undefined || value === null) {
      return;
    }
    if (typeof value === 'string') {
      const normalized = value.trim();
      if (!normalized) {
        return;
      }
      params[key] = normalized;
      return;
    }
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return;
      }
      params[key] = value;
      return;
    }
    params[key] = value;
  });
  return params;
}

function handleCreate() {
  formModalApi.setData({ type: 'create' }).open();
}

function handleImport() {
  importModalApi
    .setData({
      title: '导入报价订单整单',
      templateFileName: '报价订单整单导入模板.xls',
      importRequest: importSaleQuoteOrder,
      exportTemplateRequest: exportSaleQuoteOrderImportTemplate,
      failureDownload: {
        request: downloadSaleQuoteImportFailureDetails,
        fileName: '销售报价错误数据.xls',
      },
      templateGuideSummary:
        '报价订单整单导入模板用于批量创建完整报价单；同一导入单号的多行明细会合并为一张报价单。',
      templateGuideTips: [
        '同一张报价单下的客户、备注等主表信息需保持一致。',
        '产品、仓库、数量、单价、赠品等明细字段请按模板示例填写。',
      ],
    })
    .open();
}

function handleImportSuccess(_data: SaleOrderImportResp) {
  handleRefresh();
}

useSaleShortcut({
  onCreate: () => {
    if (
      activationRefreshMaskVisible.value ||
      !hasAccessByCodes(['erp:sale-quote:create'])
    ) {
      return;
    }
    handleCreate();
  },
  onImport: () => {
    if (
      activationRefreshMaskVisible.value ||
      !hasAccessByCodes(['erp:sale-quote:create'])
    ) {
      return;
    }
    handleImport();
  },
});

function handleEdit(row: ErpSaleQuoteApi.SaleQuote) {
  formModalApi.setData({ type: 'edit', id: row.id, initialData: row }).open();
}

function handleDetail(row: ErpSaleQuoteApi.SaleQuote) {
  formModalApi.setData({ type: 'detail', id: row.id }).open();
}

function isEditableQuote(row: ErpSaleQuoteApi.SaleQuote) {
  return row.status === 0 || row.status === 10 || row.status === 90;
}

function isDraftQuote(row: ErpSaleQuoteApi.SaleQuote) {
  return row.status === 0;
}

function isConvertibleQuote(row: ErpSaleQuoteApi.SaleQuote) {
  return row.status === 20 || row.status === 30;
}

function getOrderStatusLabel(row: ErpSaleQuoteApi.SaleQuote) {
  if (row.orderStatus === 90) return '已作废';
  return row.orderStatus === 20 ? '已下订' : '未下订';
}

function getOutStatusLabel(row: ErpSaleQuoteApi.SaleQuote) {
  if (row.outStatus === 50) return '已出库';
  if (row.outStatus === 40) return '全部转手推车';
  if (row.outStatus === 30) return '部分转手推车';
  return '未出库';
}

async function handleDelete(
  ids: number[],
  options: { successMessage?: string } = {},
) {
  const hideLoading = message.loading({
    content: $t('ui.actionMessage.deleting'),
    duration: 0,
  });
  try {
    await deleteSaleQuote(ids);
    message.success(options.successMessage ?? '删除成功');
    await refreshActivatedSaleQuotePage();
  } catch (error) {
    message.error(resolveSaleQuoteDeleteError(error));
  } finally {
    hideLoading();
  }
}

function resolveSaleQuoteDeleteError(error: unknown) {
  const candidates = [
    (error as any)?.response?.data?.msg,
    (error as any)?.response?.data?.message,
    (error as any)?.data?.msg,
    (error as any)?.data?.message,
    error instanceof Error ? error.message : undefined,
  ];
  const readable = candidates.find(
    (value) =>
      typeof value === 'string' &&
      value.trim() &&
      !/^\[object\s+(?:Object|PointerEvent)\]$/i.test(value.trim()),
  );
  return readable?.trim() || '删除失败，请稍后重试';
}

function handleConvertCart(row: ErpSaleQuoteApi.SaleQuote) {
  convertCartModalRef.value?.open(row.id!);
}

function handleOrder(row: ErpSaleQuoteApi.SaleQuote) {
  Modal.confirm({
    title: `确认下订报价订单 ${row.no || ''} 吗？`,
    content: '下订不会占用或扣减库存，下订后才可以分批出库生成销售手推车。',
    async onOk() {
      await approveSaleQuote(row.id!);
      message.success('下订成功');
      handleRefresh();
    },
  });
}

function handleReverseOrder(row: ErpSaleQuoteApi.SaleQuote) {
  Modal.confirm({
    title: `确认反下订报价订单 ${row.no || ''} 吗？`,
    content: '只有尚未生成销售手推车的报价订单可以反下订。',
    async onOk() {
      await reverseOrderSaleQuote(row.id!);
      message.success('反下订成功');
      handleRefresh();
    },
  });
}

async function handleExport() {
  const params: Record<string, any> = {
    ...normalizeSearchParams(await gridApi.formApi.getValues()),
    ...buildSortParams(),
  };
  if (checkedIds.value.length > 0) {
    params.ids = checkedIds.value;
  }
  pendingExportParams.value = params;
  exportFieldModalApi
    .setData({
      loadFields: getSaleQuoteExportFields,
      moduleKey: 'erp_sale_quote',
    })
    .open();
}

async function handleExportConfirm(fields: string[]) {
  const data = await exportSaleQuote({
    ...pendingExportParams.value,
    fields: fields.join(','),
  } as any);
  downloadFileFromBlobPart({ fileName: '销售报价单.xls', source: data });
}

async function handleRowExport(row: ErpSaleQuoteApi.SaleQuote) {
  const data = await exportSaleQuote({ ids: [row.id!] } as any);
  downloadFileFromBlobPart({ fileName: '销售报价单.xls', source: data });
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
} = useErpPrintTemplate<ErpSaleQuoteApi.SaleQuote>({
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

function handleWechatNotice(row: ErpSaleQuoteApi.SaleQuote) {
  message.info(`微信通知功能待接入，单号：${row.no || '-'}`);
}

function handleSearchEnter(event: KeyboardEvent) {
  submitSearchFormOnEnterAndBlur(event, () => gridApi.formApi.submitForm());
}

const checkedRows = ref<ErpSaleQuoteApi.SaleQuote[]>([]);
const checkedIds = computed(() => checkedRows.value.map((item) => item.id!));
const deletableCheckedRows = computed(() =>
  checkedRows.value.filter((item) => isEditableQuote(item)),
);
const skippedCheckedRows = computed(() =>
  checkedRows.value.filter((item) => !isEditableQuote(item)),
);
const deletableCheckedIds = computed(() =>
  deletableCheckedRows.value
    .map((item) => item.id)
    .filter((id): id is number => id !== undefined),
);

function handleRowCheckboxChange({
  records,
}: {
  records: ErpSaleQuoteApi.SaleQuote[];
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

async function reloadSaleQuoteColumns(
  rows: ErpSaleQuoteApi.SaleQuote[] = currentPageRows.value,
  applyCustomization = true,
) {
  const defaults = (useGridColumns(rows) ?? []) as any[];
  const columns = applyCustomization
    ? applySaleDocumentListColumnCustomization(
        defaults,
        gridApi.grid?.getFullColumns?.() ?? [],
        90,
      )
    : defaults;
  gridApi.setGridOptions({ columns });
  await gridApi.grid?.reloadColumn?.(columns);
  await nextTick();
  syncSaleDocumentColumnDefaults(
    gridApi.grid?.getFullColumns?.() ?? [],
    defaults,
  );
  await syncSaleDocumentOperationColumn(gridApi.grid, columns);
  await gridApi.grid?.refreshColumn?.();
  await gridApi.grid?.recalculate?.(true);
}

async function handleSaleQuoteColumnCustom({ type }: { type?: string }) {
  const settled = await settleVxeColumnCustomization(gridApi.grid, type);
  if (!settled) return;
  await reloadSaleQuoteColumns(currentPageRows.value, type !== 'reset');
  await restoreSortState(gridApi);
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    commonConfig: { labelWidth: 68 },
    keywordSearchPlaceholder: '请输入关键词，产品多个条件可用 / 或空格分隔',
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
    autoResize: true,
    fit: true,
    height: 'auto',
    id: 'erp-sale-quote-list-v2',
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
    rowClassName: ({ row }) => (row.status === 0 ? 'sale-quote-draft-row' : ''),
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page, sort, sorts }, formValues) => {
          const params = normalizeSearchParams(formValues);
          const summaryChanged = querySummaryState.prepare(params);
          let pageFailed = false;
          const result = await getSaleQuotePage({
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
          const rows = result.list || [];
          currentPageRows.value = rows;
          await reloadSaleQuoteColumns(rows);
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
    toolbarConfig: {
      custom: true,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<ErpSaleQuoteApi.SaleQuote>,
  gridEvents: {
    custom: handleSaleQuoteColumnCustom,
    sortChange: handleSortChange,
    checkboxAll: handleRowCheckboxChange,
    checkboxChange: handleRowCheckboxChange,
  },
});

let activatedOnce = false;
let activationRefreshVersion = 0;

async function refreshActivatedSaleQuotePage() {
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
    let result = await getSaleQuotePage({
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
      result = await getSaleQuotePage({
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
    if (pager) {
      pager.currentPage = finalPage;
      pager.pageSize = pageSize;
      pager.total = Number(result.total || 0);
    }
    await reloadSaleQuoteColumns(rows);
    await gridApi.grid?.loadData?.(rows);
    querySummaryState.invalidate();
    void querySummaryState.load(formValues);
    checkedRows.value = [];
    await restoreSortState(gridApi);
  } catch (error) {
    console.error('Error occurred while refreshing sale quote page:', error);
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
  void refreshActivatedSaleQuotePage();
});
</script>

<template>
  <Page auto-content-height>
    <FormModal @print="handleDetailPrint" @success="handleRefresh" />
    <ImportModal @success="handleImportSuccess" />
    <ExportFieldModal @confirm="handleExportConfirm" />
    <ConvertCartModal ref="convertCartModalRef" @success="handleRefresh" />
    <PrintTemplateDesignModal @printed="handleRefresh" />
    <PrintTemplateSelector
      v-model:open="printTemplateSelectOpen"
      v-model:selected-id="selectedPrintTemplateId"
      :templates="printTemplateOptions"
      @cancel="cancelTemplateSelect"
      @confirm="confirmTemplate"
    />
    <div ref="saleQuoteGridShellRef" class="sale-quote-grid-shell">
      <Grid
        table-title="销售报价单列表"
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
                auth: ['erp:sale-quote:create'],
                onClick: handleCreate,
              },
              {
                label: '导入',
                type: 'primary',
                icon: ACTION_ICON.UPLOAD,
                tooltip: 'I 导入',
                auth: ['erp:sale-quote:create'],
                onClick: handleImport,
              },
              {
                label: '导出',
                type: 'primary',
                icon: ACTION_ICON.DOWNLOAD,
                auth: ['erp:sale-quote:export'],
                onClick: handleExport,
              },
              {
                label: '打印模板',
                type: 'primary',
                icon: ACTION_ICON.EDIT,
                auth: ['erp:sale-quote:print-template'],
                onClick: handleOpenPrintTemplateDesigner,
              },
              {
                label: '批量删除',
                type: 'primary',
                danger: true,
                ifShow: () => checkedIds.length > 0,
                icon: ACTION_ICON.DELETE,
                auth: ['erp:sale-quote:delete'],
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
                auth: ['erp:sale-quote:delete'],
                ifShow: () => isEditableQuote(row),
                popConfirm: {
                  title: $t('ui.actionMessage.deleteConfirm', [row.no]),
                  confirm: () => handleDelete([row.id!]),
                },
              },
            ]"
          />
        </template>
        <template #outAction="{ row }">
          <TableAction
            :actions="[
              {
                label: '出库',
                type: 'link',
                auth: ['erp:sale-quote:convert-cart'],
                ifShow: () => isConvertibleQuote(row),
                onClick: handleConvertCart.bind(null, row),
              },
            ]"
          />
        </template>
        <template #no="{ row }">
          <button
            type="button"
            class="sale-quote-number-link"
            :title="row.no || ''"
            @click.stop="handleDetail(row)"
          >
            {{ row.no || '-' }}
          </button>
        </template>
        <template #orderStatus="{ row }">
          <span>{{ getOrderStatusLabel(row) }}</span>
        </template>
        <template #outStatus="{ row }">
          <span>{{ getOutStatusLabel(row) }}</span>
        </template>
        <template #printAction="{ row }">
          <Button
            v-access:code="['erp:sale-quote:print']"
            class="sale-quote-link"
            type="link"
            @click="handlePrint(row)"
          >
            打印
          </Button>
        </template>
        <template #wechatNotifyAction="{ row }">
          <Button
            v-access:code="['erp:sale-quote:query']"
            class="sale-quote-link"
            type="link"
            @click="handleWechatNotice(row)"
          >
            发信
          </Button>
        </template>
        <template #exportAction="{ row }">
          <TableAction
            :actions="[
              {
                label: '导出',
                type: 'link',
                auth: ['erp:sale-quote:export'],
                onClick: handleRowExport.bind(null, row),
              },
            ]"
          />
        </template>
        <template #continueBuyAction="{ row }">
          <TableAction
            :actions="[
              {
                label: '继续选购',
                type: 'link',
                auth: ['erp:sale-quote:update'],
                ifShow: () => isEditableQuote(row),
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
                auth: ['erp:sale-quote:update'],
                ifShow: () => isDraftQuote(row),
                onClick: handleEdit.bind(null, row),
              },
              {
                label: '下订',
                type: 'link',
                icon: ACTION_ICON.ORDER,
                auth: ['erp:sale-quote:approve'],
                ifShow: () => row.status === 10,
                onClick: handleOrder.bind(null, row),
              },
              {
                label: '反下订',
                type: 'link',
                icon: ACTION_ICON.REVERSE,
                auth: ['erp:sale-quote:approve'],
                ifShow: () => row.status === 20,
                onClick: handleReverseOrder.bind(null, row),
              },
            ]"
          />
        </template>
        <template #bottom>
          <div class="sale-quote-bottom-summary">
            <div class="sale-quote-row-legend">
              <span
                class="sale-quote-row-legend__swatch"
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
        class="sale-quote-activation-mask"
      >
        <div class="sale-quote-activation-mask__content">
          <Spin size="small" />
          <span>同步最新数据中...</span>
        </div>
      </div>
    </div>
  </Page>
</template>

<style scoped>
.sale-quote-grid-shell {
  position: relative;
  height: 100%;
  min-height: 100%;
}

.sale-quote-activation-mask {
  position: absolute;
  z-index: 20;
  inset: 0;
  display: grid;
  place-items: center;
  background: hsl(var(--background) / 58%);
}

.sale-quote-activation-mask__content {
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

:global(.sale-quote-search-select-dropdown .ant-select-item),
:global(.sale-quote-search-select-dropdown .ant-empty-description) {
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

:deep(.sale-quote-link.ant-btn-link),
:deep(.vxe-body--column .table-actions .ant-btn-link) {
  height: auto;
  padding: 0;
  font-size: 12px;
}

:deep(.sale-quote-number-link) {
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

:deep(.sale-quote-number-link:hover),
:deep(.sale-quote-number-link:focus-visible) {
  text-decoration: underline;
}

:deep(.sale-quote-draft-row .vxe-body--column) {
  background-color: hsl(var(--primary) / 7%) !important;
}

:deep(.sale-quote-draft-row.row--hover .vxe-body--column) {
  background-color: hsl(var(--primary) / 13%) !important;
}

.sale-quote-draft-status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: hsl(var(--primary));
  font-weight: 500;
  cursor: help;
}

.sale-quote-draft-status::before {
  width: 6px;
  height: 6px;
  background: currentcolor;
  border-radius: 50%;
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

.sale-quote-bottom-summary {
  display: flex;
  min-height: 40px;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 4px 20px;
  padding: 5px 8px;
  border-top: 1px solid hsl(var(--border));
  font-size: 12px;
  line-height: 18px;
}

.sale-quote-total-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 14px;
}

.sale-quote-row-legend {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-right: auto;
  color: hsl(var(--muted-foreground));
}

.sale-quote-row-legend__swatch {
  width: 18px;
  height: 10px;
  background: hsl(var(--primary) / 10%);
  border: 1px solid hsl(var(--primary) / 30%);
  border-radius: 2px;
}

@media (max-width: 768px) {
  .sale-quote-bottom-summary {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
