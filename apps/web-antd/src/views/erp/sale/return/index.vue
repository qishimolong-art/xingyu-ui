<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpSaleReturnApi } from '#/api/erp/sale/return';

import { computed, nextTick, onActivated, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { useAccess } from '@vben/access';
import { DocAlert, Page, useVbenModal } from '@vben/common-ui';
import { downloadFileFromBlobPart, formatDateTime } from '@vben/utils';

import { Button, message, Spin, Tag } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  cancelConfirmSaleReturn,
  confirmSaleReturn,
  deleteSaleReturn,
  downloadSaleReturnImportFailureDetails,
  exportSaleReturn,
  exportSaleReturnOrderImportTemplate,
  getSaleReturnExportFields,
  getSaleReturnPage,
  getSaleReturnSummary,
  importSaleReturnOrder,
} from '#/api/erp/sale/return';
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

import { useGridColumns, useGridFormSchema } from './data';
import Form from './modules/form.vue';
import CurrentCostReview from './modules/current-cost-review.vue';

defineOptions({ name: 'ErpSaleReturn' });

const route = useRoute();
const router = useRouter();
const { hasAccessByCodes } = useAccess();
const PRINT_TEMPLATE_MODULE = 'sale_return';
const PRINT_MODULE_NAME = '销售退货';
const currentCostReview = ref<InstanceType<typeof CurrentCostReview>>();
const preparingCurrentCost = ref(false);

async function handleCurrentCostOrderConfirm(row: ErpSaleReturnApi.SaleReturn) {
  if (!row.id || preparingCurrentCost.value) return;
  preparingCurrentCost.value = true;
  try {
    if (!currentCostReview.value)
      throw new Error('成本预览尚未就绪，请稍后重试');
    await currentCostReview.value.prepareOrderConfirm(row.id);
  } finally {
    preparingCurrentCost.value = false;
  }
}
function handleCurrentCostConfirmed() {
  message.success('下单确认成功，已生成拣货任务');
  handleRefresh();
}

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
const currentPageRows = ref<ErpSaleReturnApi.SaleReturn[]>([]);
const activationRefreshMaskVisible = ref(false);

function formatSummaryValue(value?: null | number, fractionDigits = 2) {
  if (value === null || value === undefined) return '****';
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

const querySummaryState = useSaleQuerySummary((params, signal) =>
  getSaleReturnSummary(params, signal),
);
const querySummaryItems = computed(() => {
  const value = querySummaryState.summary.value;
  if (!value) return [];
  return [
    {
      key: 'totalCount',
      label: '退货总数量',
      value: formatSummaryValue(value.totalCount, 3),
    },
    {
      key: 'totalProductPrice',
      label: '实际金额',
      value: formatSummaryValue(value.totalProductPrice),
    },
    {
      key: 'discountPrice',
      label: '优惠',
      value: formatSummaryValue(value.discountPrice),
    },
    {
      key: 'totalPrice',
      label: '应收金额',
      value: formatSummaryValue(value.totalPrice),
    },
  ];
});

const saleReturnSortFieldMap: Record<string, string> = {
  no: 'no',
  settlementStatus: 'refundStatus',
  returnTime: 'returnTime',
  status: 'status',
  customerName: 'customerId',
  returnMode: 'returnMode',
  orderMethod: 'orderMethod',
  totalCount: 'totalCount',
  settleMethod: 'settleMethod',
  deliveryMethod: 'deliveryMethod',
  totalProductPrice: 'totalProductPrice',
  discountPrice: 'discountPrice',
  totalPrice: 'totalPrice',
  invoiceType: 'invoiceType',
  billNo: 'billNo',
  logisticsCompany: 'logisticsCompany',
  deptName: 'deptId',
  saleUserName: 'saleUserId',
  handlerName: 'handler',
  priority: 'priority',
  remark: 'remark',
};
const { buildSortParams, handleSortChange, restoreSortState } =
  createVxeHeaderSort(saleReturnSortFieldMap);

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
    if (key === 'workflowStatus') {
      if (value === 'pick-waiting' || value === 'pick-partial') {
        params.status = 15;
        params.pickStatus = value === 'pick-waiting' ? 10 : 20;
      } else if (value !== '') {
        params.status = Number(value);
      }
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
      loadFields: getSaleReturnExportFields,
      moduleKey: 'erp_sale_return',
    })
    .open();
}

async function handleExportConfirm(fields: string[]) {
  const data = await exportSaleReturn({
    ...pendingExportParams.value,
    fields: fields.join(','),
  });
  downloadFileFromBlobPart({ fileName: '销售退货.xls', source: data });
}

function handleCreate(presetData?: {
  outId?: string;
  saleOutId?: string;
  sourceOutId?: string;
}) {
  formModalApi.setData({ type: 'create', ...presetData }).open();
}

function handleImport() {
  importModalApi
    .setData({
      title: '导入销售退货整单',
      templateFileName: '销售退货整单导入模板.xls',
      importRequest: importSaleReturnOrder,
      exportTemplateRequest: exportSaleReturnOrderImportTemplate,
      failureDownload: {
        request: downloadSaleReturnImportFailureDetails,
        fileName: '销售退货错误数据.xls',
      },
      templateGuideSummary:
        '列表入口用于批量创建完整销售退货单；退货模式、客户、来源销售单和明细必须按模板填写。',
      templateGuideTips: [
        '按销售单退货会校验来源、客户、商品及累计可退数量。',
        '按库存退货不得填写来源字段；任一单据校验失败时不会部分创建。',
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
      !hasAccessByCodes(['erp:sale-return:create'])
    )
      return;
    handleCreate();
  },
  onImport: () => {
    if (
      activationRefreshMaskVisible.value ||
      !hasAccessByCodes(['erp:sale-return:create'])
    )
      return;
    handleImport();
  },
});

function handleEdit(row: ErpSaleReturnApi.SaleReturn) {
  formModalApi.setData({ type: 'edit', id: row.id, initialData: row }).open();
}

function isDraftReturn(row: ErpSaleReturnApi.SaleReturn) {
  return row.status === 0;
}

function isEditableReturn(row: ErpSaleReturnApi.SaleReturn) {
  return [0, 10].includes(Number(row.status));
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
    await deleteSaleReturn(ids);
    message.success(successMessage);
    handleRefresh();
  } finally {
    hideLoading();
  }
}

async function handleOrderConfirm(row: ErpSaleReturnApi.SaleReturn) {
  const hideLoading = message.loading({
    content: '下单确认中...',
    duration: 0,
  });
  try {
    await confirmSaleReturn(row.id!);
    message.success('下单确认成功，已生成拣货任务');
    handleRefresh();
  } finally {
    hideLoading();
  }
}

async function handleCancelOrderConfirm(row: ErpSaleReturnApi.SaleReturn) {
  const hideLoading = message.loading({
    content: '撤销下单确认中...',
    duration: 0,
  });
  try {
    await cancelConfirmSaleReturn(row.id!);
    message.success('已撤销下单确认，可继续编辑');
    handleRefresh();
  } finally {
    hideLoading();
  }
}

function getReturnStatusText(row: ErpSaleReturnApi.SaleReturn) {
  if (row.status === 0) return '草稿';
  if (row.status === 10) return '待下单确认';
  if (row.status === 20) return '已审批';
  if (row.status === 15) return row.pickStatus === 20 ? '部分拣货' : '待拣货';
  return '-';
}

function getPickProgressText(row: ErpSaleReturnApi.SaleReturn) {
  if (row.status !== 15) return '-';
  return `${Number(row.pickedItemCount || 0)}/${Number(row.pickTotalItemCount || 0)}`;
}

const checkedRows = ref<ErpSaleReturnApi.SaleReturn[]>([]);
const checkedIds = computed(() => checkedRows.value.map((item) => item.id!));
const deletableCheckedRows = computed(() =>
  checkedRows.value.filter((item) => isEditableReturn(item)),
);
const skippedCheckedRows = computed(() =>
  checkedRows.value.filter((item) => !isEditableReturn(item)),
);
const deletableCheckedIds = computed(() =>
  deletableCheckedRows.value
    .map((item) => item.id)
    .filter((id): id is number => id !== undefined),
);
function handleRowCheckboxChange({
  records,
}: {
  records: ErpSaleReturnApi.SaleReturn[];
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

function handleDetail(row: ErpSaleReturnApi.SaleReturn) {
  formModalApi.setData({ type: 'detail', id: row.id }).open();
}

function handleContinueBuy(row: ErpSaleReturnApi.SaleReturn) {
  if (![0, 10].includes(Number(row.status))) {
    message.warning('下单确认后的销售退货单不能继续选购');
    return;
  }
  handleEdit(row);
}

function getSettlementStatus(row: ErpSaleReturnApi.SaleReturn) {
  const totalPrice = Number(row.totalPrice || 0);
  const refundPrice = Number(row.refundPrice || 0);
  if (totalPrice !== 0 && Math.abs(refundPrice) >= Math.abs(totalPrice)) {
    return { color: 'green', text: '全部退款' };
  }
  if (refundPrice !== 0) {
    return { color: 'blue', text: '部分退款' };
  }
  return { color: 'default', text: '未退款' };
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
} = useErpPrintTemplate<ErpSaleReturnApi.SaleReturn>({
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

function handleWechatNotice(row: ErpSaleReturnApi.SaleReturn) {
  message.info(`微信通知功能待接入，单号：${row.no || '-'}`);
}

function formatListDate(value?: Date | number | string) {
  return value ? formatDateTime(value) || '-' : '-';
}

function getApproveTime(row: ErpSaleReturnApi.SaleReturn) {
  return row.approveTime ?? (row.status === 20 ? row.updateTime : undefined);
}

function getAuditorName(row: ErpSaleReturnApi.SaleReturn) {
  return row.auditorName ?? (row.status === 20 ? row.updaterName : undefined);
}

function handleSearchEnter(event: KeyboardEvent) {
  submitSearchFormOnEnterAndBlur(event, () => gridApi.formApi.submitForm());
}

async function reloadSaleReturnColumns(
  rows: ErpSaleReturnApi.SaleReturn[] = currentPageRows.value,
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
    id: 'erp-sale-return-list-v2',
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
    rowClassName: ({ row }) =>
      isDraftReturn(row) ? 'sale-return-draft-row' : '',
    keepSource: true,
    proxyConfig: {
      ajax: {
        query: async ({ page, sort, sorts }, formValues) => {
          const params = normalizeSearchParams(formValues);
          const summaryChanged = querySummaryState.prepare(params);
          let pageFailed = false;
          const result = await getSaleReturnPage({
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
          await reloadSaleReturnColumns(rows);
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
    },
    toolbarConfig: {
      refresh: true,
      search: true,
    },
  } as VxeTableGridOptions<ErpSaleReturnApi.SaleReturn>,
  gridEvents: {
    sortChange: handleSortChange,
    checkboxAll: handleRowCheckboxChange,
    checkboxChange: handleRowCheckboxChange,
  },
});

let activatedOnce = false;
let activationRefreshVersion = 0;

async function refreshActivatedSaleReturnPage() {
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
    let result = await getSaleReturnPage({
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
      result = await getSaleReturnPage({
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
    await reloadSaleReturnColumns(rows);
    await gridApi.grid?.loadData?.(rows);
    querySummaryState.invalidate();
    void querySummaryState.load(formValues);
    checkedRows.value = [];
    await restoreSortState(gridApi);
  } catch (error) {
    console.error('Error occurred while refreshing sale return page:', error);
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
  void refreshActivatedSaleReturnPage();
});

watch(
  () => [
    route.query.action,
    route.query.sourceOutId,
    route.query.outId,
    route.query.saleOutId,
  ],
  ([action, sourceOutId, outId, saleOutId]) => {
    if (action !== 'create') return;
    handleCreate({
      sourceOutId: sourceOutId as string | undefined,
      outId: outId as string | undefined,
      saleOutId: saleOutId as string | undefined,
    });
    router.replace({
      path: route.path,
      query: {
        ...route.query,
        action: undefined,
        sourceOutId: undefined,
        outId: undefined,
        saleOutId: undefined,
      },
    });
  },
  { immediate: true },
);
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
    <CurrentCostReview
      ref="currentCostReview"
      @confirmed="handleCurrentCostConfirmed"
    />
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
    <div class="sale-return-grid-shell">
      <Grid
        table-title="销售退货列表"
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
                auth: ['erp:sale-return:create'],
                onClick: handleCreate,
              },
              {
                label: '导入',
                type: 'primary',
                icon: ACTION_ICON.UPLOAD,
                tooltip: 'I 导入',
                auth: ['erp:sale-return:create'],
                onClick: handleImport,
              },
              {
                label: '导出',
                type: 'primary',
                icon: ACTION_ICON.DOWNLOAD,
                auth: ['erp:sale-return:export'],
                onClick: handleExport,
              },
              {
                label: '打印模板',
                type: 'primary',
                icon: ACTION_ICON.EDIT,
                auth: ['erp:sale-return:print-template'],
                onClick: handleOpenPrintTemplateDesigner,
              },
              {
                label: '批量删除',
                type: 'primary',
                danger: true,
                ifShow: () => checkedIds.length > 0,
                icon: ACTION_ICON.DELETE,
                auth: ['erp:sale-return:delete'],
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
                auth: ['erp:sale-return:delete'],
                ifShow: () => isEditableReturn(row),
                popConfirm: {
                  title: $t('ui.actionMessage.deleteConfirm', [row.no]),
                  confirm: handleDelete.bind(null, [row.id!]),
                },
              },
            ]"
          />
        </template>
        <template #no="{ row }">
          <button
            type="button"
            class="sale-return-number-link"
            :title="row.no || ''"
            @click.stop="handleDetail(row)"
          >
            {{ row.no || '-' }}
          </button>
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
            v-if="row.status === 0"
            class="sale-return-draft-status"
            title="草稿：页面关闭时自动保存，尚未正式提交"
          >
            草稿
          </span>
          <span v-else>{{ getReturnStatusText(row) }}</span>
        </template>
        <template #pickProgress="{ row }">
          <span>{{ getPickProgressText(row) }}</span>
        </template>
        <template #printAction="{ row }">
          <Button
            v-access:code="['erp:sale-return:print']"
            class="sale-return-link"
            type="link"
            @click="handlePrint(row)"
          >
            打印
          </Button>
        </template>
        <template #wechatNotifyAction="{ row }">
          <Button
            v-access:code="['erp:sale-return:query']"
            class="sale-return-link"
            type="link"
            @click="handleWechatNotice(row)"
          >
            发信
          </Button>
        </template>
        <template #continueBuyAction="{ row }">
          <TableAction
            :actions="[
              {
                label: '继续选购',
                type: 'link',
                auth: ['erp:sale-return:update'],
                ifShow: () => isEditableReturn(row),
                onClick: handleContinueBuy.bind(null, row),
              },
            ]"
          />
        </template>
        <template #approveTime="{ row }">
          <span>{{ formatListDate(getApproveTime(row)) }}</span>
        </template>
        <template #handlerName="{ row }">
          <span>{{ row.handlerName || row.creatorName || '-' }}</span>
        </template>
        <template #auditorName="{ row }">
          <span>{{ getAuditorName(row) || '-' }}</span>
        </template>
        <template #actions="{ row }">
          <TableAction
            :actions="[
              {
                label: '编辑',
                type: 'link',
                auth: ['erp:sale-return:update'],
                ifShow: () => isEditableReturn(row),
                onClick: handleEdit.bind(null, row),
              },
              {
                label: '下单确认',
                type: 'link',
                icon: ACTION_ICON.AUDIT,
                auth: ['erp:sale-return:confirm'],
                ifShow: () => row.status === 10 && row.returnMode !== 20,
                popConfirm: {
                  title: `确认锁定 ${row.no} 并生成拣货任务吗？`,
                  confirm: handleOrderConfirm.bind(null, row),
                },
              },
              {
                label: '下单确认',
                type: 'link',
                icon: ACTION_ICON.AUDIT,
                auth: ['erp:sale-return:confirm'],
                ifShow: () => row.status === 10 && row.returnMode === 20,
                disabled: preparingCurrentCost,
                onClick: handleCurrentCostOrderConfirm.bind(null, row),
              },
              {
                label: '撤销下单确认',
                type: 'link',
                danger: true,
                auth: ['erp:sale-return:cancel-confirm'],
                ifShow: () =>
                  row.status === 15 && Number(row.pickedItemCount || 0) === 0,
                popConfirm: {
                  title: `确认撤销 ${row.no} 的下单确认吗？`,
                  confirm: handleCancelOrderConfirm.bind(null, row),
                },
              },
            ]"
          />
        </template>
        <template #bottom>
          <div class="sale-return-bottom-summary">
            <div class="sale-return-row-legend">
              <span
                class="sale-return-row-legend__swatch"
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
        class="sale-return-activation-mask"
      >
        <div class="sale-return-activation-mask__content">
          <Spin size="small" />
          <span>同步最新数据中...</span>
        </div>
      </div>
    </div>
  </Page>
</template>

<style scoped>
.sale-return-grid-shell {
  position: relative;
  height: 100%;
  min-height: 100%;
}

.sale-return-activation-mask {
  position: absolute;
  z-index: 20;
  inset: 0;
  display: grid;
  place-items: center;
  background: hsl(var(--background) / 58%);
}

.sale-return-activation-mask__content {
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

:global(.sale-return-search-select-dropdown .ant-select-item),
:global(.sale-return-search-select-dropdown .ant-empty-description) {
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

:deep(.sale-return-link.ant-btn-link),
:deep(.vxe-body--column .table-actions .ant-btn-link) {
  height: auto;
  padding: 0;
  font-size: 12px;
}

:deep(.sale-return-number-link) {
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

:deep(.sale-return-number-link:hover),
:deep(.sale-return-number-link:focus-visible) {
  text-decoration: underline;
}

:deep(.sale-return-draft-row .vxe-body--column) {
  background-color: hsl(var(--primary) / 7%) !important;
}

:deep(.sale-return-draft-row.row--hover .vxe-body--column) {
  background-color: hsl(var(--primary) / 13%) !important;
}

.sale-return-draft-status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: hsl(var(--primary));
  font-weight: 500;
  cursor: help;
}

.sale-return-draft-status::before {
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

.sale-return-bottom-summary {
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

.sale-return-row-legend {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-right: auto;
  color: hsl(var(--muted-foreground));
}

.sale-return-row-legend__swatch {
  width: 22px;
  height: 12px;
  background-color: hsl(var(--primary) / 9%);
  border: 1px solid hsl(var(--primary) / 22%);
  border-radius: 3px;
}

.sale-return-bottom-summary b {
  margin-left: 8px;
}
</style>
