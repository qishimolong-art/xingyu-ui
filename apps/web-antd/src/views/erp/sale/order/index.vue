<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type {
  ErpSaleOrderApi,
  SaleOrderImportResp,
} from '#/api/erp/sale/order';

import { computed, nextTick, onActivated, ref } from 'vue';

import { useAccess } from '@vben/access';
import { DocAlert, Page, useVbenModal } from '@vben/common-ui';
import { downloadFileFromBlobPart } from '@vben/utils';

import { message, Spin } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  deleteSaleOrder,
  downloadSaleOrderImportFailureDetails,
  exportSaleOrder,
  exportSaleOrderOrderImportTemplate,
  getSaleOrderExportFields,
  getSaleOrderPage,
  importSaleOrderOrder,
  updateSaleOrderStatus,
} from '#/api/erp/sale/order';
import { $t } from '#/locales';
import ExportFieldModalComponent from '#/views/erp/components/export-field-modal.vue';
import PrintTemplateModal from '#/views/erp/components/PrintTemplateModal.vue';
import PrintTemplateSelector from '#/views/erp/components/PrintTemplateSelector.vue';
import { useSaleShortcut } from '#/views/erp/composables/useSaleShortcut';
import SaleOrderImportModal from '#/views/erp/sale/components/sale-order-import-modal.vue';
import {
  applySaleDocumentListColumnCustomization,
  syncSaleDocumentColumnDefaults,
  syncSaleDocumentOperationColumn,
} from '#/views/erp/sale/utils/document-list-table';
import { useErpPrintTemplate } from '#/views/erp/utils/print-template';
import { submitSearchFormOnEnterAndBlur } from '#/views/erp/utils/keyboard';
import { settleVxeColumnCustomization } from '#/views/erp/utils/vxe-column-custom';
import { createVxeHeaderSort } from '#/views/erp/utils/vxe-header-sort';

import { useGridColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';

defineOptions({ name: 'ErpSaleOrder' });

const PRINT_TEMPLATE_MODULE = 'sale_order';
const PRINT_MODULE_NAME = '销售订单';
const { hasAccessByCodes } = useAccess();

const saleOrderSortFieldMap: Record<string, string> = {
  no: 'no',
  orderType: 'orderType',
  customerName: 'customerId',
  orderTime: 'orderTime',
  creatorName: 'creator',
  totalCount: 'totalCount',
  outCount: 'outCount',
  returnCount: 'returnCount',
  totalProductPrice: 'totalProductPrice',
  totalPrice: 'totalPrice',
  depositPrice: 'depositPrice',
  status: 'status',
};
const { buildSortParams, handleSortChange, restoreSortState } =
  createVxeHeaderSort(saleOrderSortFieldMap);

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
const activationRefreshMaskVisible = ref(false);
const currentPageRows = ref<ErpSaleOrderApi.SaleOrder[]>([]);
const pendingExportParams = ref<Record<string, any>>({});

function handleRefresh() {
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

async function handleExport() {
  const params: Record<string, any> = {
    ...normalizeSearchParams(await gridApi.formApi.getValues()),
    ...buildSortParams(),
  };
  if (checkedIds.value.length > 0) params.ids = checkedIds.value;
  pendingExportParams.value = params;
  exportFieldModalApi
    .setData({
      loadFields: getSaleOrderExportFields,
      moduleKey: 'erp_sale_order',
    })
    .open();
}

async function handleExportConfirm(fields: string[]) {
  const data = await exportSaleOrder({
    ...pendingExportParams.value,
    fields: fields.join(','),
  });
  downloadFileFromBlobPart({ fileName: '销售单.xls', source: data });
}

function handleCreate() {
  formModalApi.setData({ type: 'create' }).open();
}

function normalizeSearchParams(values: Record<string, any>) {
  const params = { ...values };
  ['no', 'remark'].forEach((field) => {
    if (typeof params[field] === 'string') {
      const normalized = params[field].trim().replaceAll(/\s+/g, '%');
      params[field] = normalized || undefined;
    }
  });
  return params;
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
} = useErpPrintTemplate<ErpSaleOrderApi.SaleOrder>({
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

function handleImport() {
  importModalApi
    .setData({
      title: '导入销售订单整单',
      templateFileName: '销售订单整单导入模板.xls',
      importRequest: importSaleOrderOrder,
      exportTemplateRequest: exportSaleOrderOrderImportTemplate,
      failureDownload: {
        request: downloadSaleOrderImportFailureDetails,
        fileName: '销售订单错误数据.xls',
      },
      templateGuideSummary:
        '销售订单整单导入模板用于批量创建完整销售订单；同一导入单号的多行明细会合并为一张销售订单。',
      templateGuideTips: [
        '同一张销售订单下的客户、下单时间、销售员和备注等主表信息需保持一致。',
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
      !hasAccessByCodes(['erp:sale-order:create'])
    ) {
      return;
    }
    handleCreate();
  },
  onImport: () => {
    if (
      activationRefreshMaskVisible.value ||
      !hasAccessByCodes(['erp:sale-order:create'])
    ) {
      return;
    }
    handleImport();
  },
});

function handleEdit(row: ErpSaleOrderApi.SaleOrder) {
  formModalApi.setData({ type: 'edit', id: row.id }).open();
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
    await deleteSaleOrder(ids);
    message.success(options.successMessage ?? '删除成功');
    await refreshActivatedSaleOrderPage();
  } catch (error) {
    message.error(resolveSaleOrderDeleteError(error));
  } finally {
    hideLoading();
  }
}

function resolveSaleOrderDeleteError(error: unknown) {
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

async function handleUpdateStatus(
  row: ErpSaleOrderApi.SaleOrder,
  status: number,
) {
  if (status !== 20) return;
  const hideLoading = message.loading({
    content: '确定审核该订单吗？',
    duration: 0,
  });
  try {
    await updateSaleOrderStatus(row.id!, status);
    message.success('审核成功');
    handleRefresh();
  } finally {
    hideLoading();
  }
}

const checkedRows = ref<ErpSaleOrderApi.SaleOrder[]>([]);
const checkedIds = computed(() => checkedRows.value.map((item) => item.id!));

function isSaleOrderBatchDeletable(row: ErpSaleOrderApi.SaleOrder) {
  return row.status !== 20;
}

const deletableCheckedRows = computed(() =>
  checkedRows.value.filter((item) => isSaleOrderBatchDeletable(item)),
);
const skippedCheckedRows = computed(() =>
  checkedRows.value.filter((item) => !isSaleOrderBatchDeletable(item)),
);
const deletableCheckedIds = computed(() =>
  deletableCheckedRows.value
    .map((item) => item.id)
    .filter((id): id is number => id !== undefined),
);

function handleRowCheckboxChange({
  records,
}: {
  records: ErpSaleOrderApi.SaleOrder[];
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

function handleDetail(row: ErpSaleOrderApi.SaleOrder) {
  formModalApi.setData({ type: 'detail', id: row.id }).open();
}

async function reloadSaleOrderColumns(
  rows: ErpSaleOrderApi.SaleOrder[] = currentPageRows.value,
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

async function handleSaleOrderColumnCustom({ type }: { type?: string }) {
  const settled = await settleVxeColumnCustomization(gridApi.grid, type);
  if (!settled) return;
  await reloadSaleOrderColumns(currentPageRows.value, type !== 'reset');
  await restoreSortState(gridApi);
}

function handleSearchEnter(event: KeyboardEvent) {
  submitSearchFormOnEnterAndBlur(event, () => gridApi.formApi.submitForm());
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
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
    id: 'erp-sale-order-list-v2',
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
          const result = await getSaleOrderPage({
            pageNo: page.currentPage,
            pageSize: page.pageSize,
            includeItems: false,
            ...normalizeSearchParams(formValues),
            ...buildSortParams(sorts, sort),
          });
          const rows = result.list || [];
          currentPageRows.value = rows;
          await reloadSaleOrderColumns(rows);
          return result;
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
    },
    toolbarConfig: {
      custom: true,
      refresh: true,
      search: true,
      zoom: true,
    },
  } as VxeTableGridOptions<ErpSaleOrderApi.SaleOrder>,
  gridEvents: {
    custom: handleSaleOrderColumnCustom,
    sortChange: handleSortChange,
    checkboxAll: handleRowCheckboxChange,
    checkboxChange: handleRowCheckboxChange,
  },
});

let activatedOnce = false;
let activationRefreshVersion = 0;

async function refreshActivatedSaleOrderPage() {
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
    let result = await getSaleOrderPage({
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
      result = await getSaleOrderPage({
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
    await reloadSaleOrderColumns(rows);
    await gridApi.grid?.loadData?.(rows);
    checkedRows.value = [];
    await restoreSortState(gridApi);
  } catch (error) {
    console.error('Error occurred while refreshing sale order page:', error);
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
  void refreshActivatedSaleOrderPage();
});
</script>

<template>
  <Page auto-content-height>
    <template #doc>
      <DocAlert
        title="【销售】销售订单、出库、退货"
        url="https://doc.iocoder.cn/erp/sale/"
      />
    </template>

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
    <div class="sale-order-grid-shell">
      <Grid
        table-title="销售订单列表"
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
                auth: ['erp:sale-order:create'],
                onClick: handleCreate,
              },
              {
                label: '导入',
                type: 'primary',
                icon: ACTION_ICON.UPLOAD,
                tooltip: 'I 导入',
                auth: ['erp:sale-order:create'],
                onClick: handleImport,
              },
              {
                label: '导出',
                type: 'primary',
                icon: ACTION_ICON.DOWNLOAD,
                auth: ['erp:sale-order:export'],
                onClick: handleExport,
              },
              {
                label: '打印模板',
                type: 'primary',
                icon: ACTION_ICON.EDIT,
                auth: ['erp:sale-order:print-template'],
                onClick: handleOpenPrintTemplateDesigner,
              },
              {
                label: '批量删除',
                type: 'primary',
                danger: true,
                ifShow: () => checkedIds.length > 0,
                icon: ACTION_ICON.DELETE,
                auth: ['erp:sale-order:delete'],
                popConfirm: {
                  title: `是否删除所选数据？不可删除数据将自动跳过。`,
                  confirm: () => handleBatchDelete(),
                },
              },
            ]"
          />
        </template>
        <template #no="{ row }">
          <a @click.stop="handleDetail(row)">{{ row.no }}</a>
        </template>
        <template #printAction="{ row }">
          <TableAction
            :actions="[
              {
                label: '打印',
                type: 'link',
                auth: ['erp:sale-order:print'],
                onClick: handlePrint.bind(null, row),
              },
            ]"
          />
        </template>
        <template #actions="{ row }">
          <TableAction
            :actions="[
              {
                label: $t('common.edit'),
                type: 'link',
                icon: ACTION_ICON.EDIT,
                auth: ['erp:sale-order:update'],
                ifShow: () => row.status !== 20,
                onClick: handleEdit.bind(null, row),
              },
              {
                label: '审核',
                type: 'link',
                icon: ACTION_ICON.AUDIT,
                auth: ['erp:sale-order:update-status'],
                ifShow: () => row.status === 10,
                popConfirm: {
                  title: `确认审核 ${row.no} 吗？`,
                  confirm: handleUpdateStatus.bind(null, row, 20),
                },
              },
              {
                label: $t('common.delete'),
                type: 'link',
                danger: true,
                icon: ACTION_ICON.DELETE,
                auth: ['erp:sale-order:delete'],
                popConfirm: {
                  title: $t('ui.actionMessage.deleteConfirm', [row.no]),
                  confirm: () => handleDelete([row.id!]),
                },
              },
            ]"
          />
        </template>
      </Grid>
      <div
        v-if="activationRefreshMaskVisible"
        class="sale-order-activation-mask"
      >
        <div class="sale-order-activation-mask__content">
          <Spin size="small" />
          <span>同步最新数据中...</span>
        </div>
      </div>
    </div>
  </Page>
</template>

<style scoped>
.sale-order-grid-shell {
  position: relative;
  height: 100%;
  min-height: 100%;
}

.sale-order-activation-mask {
  position: absolute;
  z-index: 20;
  inset: 0;
  display: grid;
  place-items: center;
  background: hsl(var(--background) / 58%);
}

.sale-order-activation-mask__content {
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
</style>
