<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type {
  ErpSaleCartApi,
  SaleCartOrderImportResp,
} from '#/api/erp/sale/cart';

import {
  computed,
  h,
  nextTick,
  onActivated,
  onBeforeUnmount,
  onDeactivated,
  onMounted,
  ref,
} from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { useAccess } from '@vben/access';
import { downloadFileFromBlobPart } from '@vben/utils';

import { Button, message, notification, Spin, Tabs } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  cancelFirstApproveSaleCart,
  confirmSaleCart,
  convertSaleCartToQuote,
  deleteSaleCart,
  downloadSaleCartImportFailureDetails,
  exportSaleCart,
  exportSaleCartOrderImportTemplate,
  finalApproveSaleCart,
  firstApproveSaleCart,
  getSaleCartExportFields,
  getSaleCartFirstApproveConfig,
  getLatestOnlineOrder,
  getSaleCartPage,
  getSaleCartSummary,
  importSaleCartOrder,
} from '#/api/erp/sale/cart';
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
import BasicInfoModal from './modules/basic-info-modal.vue';
import Form from './modules/form.vue';
import { createOnlineOrderPolling } from './online-order-polling';
import {
  buildSaleCartOrderSourceParams,
  canCreateSaleCart,
  SALE_CART_ORDER_TAB,
} from './sale-cart-order-tabs';
import type { SaleCartOrderTab } from './sale-cart-order-tabs';

defineOptions({ name: 'ErpSaleCart' });

const PRINT_TEMPLATE_MODULE = 'sale_cart';
const PRINT_MODULE_NAME = '销售手推车';
const { hasAccessByCodes } = useAccess();
const activeOrderTab = ref<SaleCartOrderTab>(SALE_CART_ORDER_TAB.SALE_CART);
const canCreateInCurrentTab = computed(() =>
  canCreateSaleCart(activeOrderTab.value),
);
const currentTableTitle = computed(() =>
  activeOrderTab.value === SALE_CART_ORDER_TAB.ONLINE_ORDER
    ? '网上订单列表'
    : '销售手推车列表',
);

function buildCurrentOrderSourceParams() {
  return buildSaleCartOrderSourceParams(activeOrderTab.value);
}

const [FormModal, formModalApi] = useVbenModal({
  connectedComponent: Form,
  destroyOnClose: true,
});
const [BasicInfoModalRef, basicInfoModalApi] = useVbenModal({
  connectedComponent: BasicInfoModal,
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
const firstApproveConfig = ref<ErpSaleCartApi.FirstApproveConfig>({
  enabled: true,
  deptAuthEnabled: false,
  includeChildDept: true,
  deptIds: [],
  currentUserAllowed: true,
});
const currentPageRows = ref<ErpSaleCartApi.SaleCart[]>([]);
const activationRefreshMaskVisible = ref(false);
const saleCartGridShellRef = ref<HTMLElement>();
let activatedOnce = false;
let activationRefreshVersion = 0;
const cartStatusLabelMap: Record<number, string> = {
  10: '草稿',
  15: '待开单确认',
  20: '待初审',
  30: '待终审',
  40: '终审通过',
  50: '已生成销售单',
  60: '已转报价',
  90: '已取消',
};

function formatSummaryAmount(value?: null | number) {
  if (value === null || value === undefined) return '****';
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const querySummaryState = useSaleQuerySummary((params, signal) =>
  getSaleCartSummary(params, signal),
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
    {
      key: 'feeAmount',
      label: '费用金额',
      value: formatSummaryAmount(value.feeAmount),
    },
  ];
});
const saleCartSortFieldMap: Record<string, string> = {
  no: 'no',
  cartTime: 'cartTime',
  customerName: 'customerId',
  creatorName: 'creator',
  totalProductPrice: 'totalProductPrice',
  discountPrice: 'discountPrice',
  totalPrice: 'totalPrice',
  settleMethod: 'settleMethod',
  deliveryMethod: 'deliveryMethod',
  vin: 'vin',
  logisticsCompany: 'logisticsCompany',
  saleUserName: 'saleUserId',
  deptName: 'deptId',
  priority: 'priority',
  invoiceType: 'invoiceType',
  status: 'status',
  createTime: 'createTime',
};
const { buildSortParams, handleSortChange, restoreSortState } =
  createVxeHeaderSort(saleCartSortFieldMap);

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

function isFirstApproveRequired(row: ErpSaleCartApi.SaleCart) {
  return row.firstApproveRequired !== false;
}

function isFinalApproveAllowed(row: ErpSaleCartApi.SaleCart) {
  return (
    !row.pickDeliveryOrderId &&
    (row.status === 30 ||
      (row.status === 20 && row.firstApproveRequired === false) ||
      (!firstApproveConfig.value.enabled && row.status === 20))
  );
}

function isBeforeFirstApprove(row: ErpSaleCartApi.SaleCart) {
  return (
    row.status === 10 ||
    row.status === 15 ||
    (row.status === 20 && !row.billingConfirmTime)
  );
}

function canConvertToQuote(row: ErpSaleCartApi.SaleCart) {
  return (
    isBeforeFirstApprove(row) &&
    Boolean(row.customerId) &&
    (row.itemCount ?? row.items?.length ?? 0) > 0
  );
}

function getCartStatusLabel(status?: number) {
  return status === undefined ? '-' : (cartStatusLabelMap[status] ?? status);
}

function getFulfillmentStatusText(row: ErpSaleCartApi.SaleCart) {
  if (!row.pickDeliveryOrderId) {
    return '';
  }
  if (row.pickStatus !== 30) {
    return '拣货中';
  }
  if (row.deliveryStatus !== 30) {
    return '送货中';
  }
  return '自动终审中';
}

function getFulfillmentStatusDescription(row: ErpSaleCartApi.SaleCart) {
  if (!row.pickDeliveryOrderId) {
    return '';
  }
  if (row.pickStatus !== 30) {
    return '拣货中，全部送货完成后系统将自动终审';
  }
  if (row.deliveryStatus !== 30) {
    return '送货中，全部送货完成后系统将自动终审';
  }
  return '送货已完成，系统正在自动终审';
}

async function loadFirstApproveConfig() {
  firstApproveConfig.value = {
    ...firstApproveConfig.value,
    ...(await getSaleCartFirstApproveConfig()),
  };
}

function handleCreate() {
  if (
    !canCreateInCurrentTab.value ||
    activationRefreshMaskVisible.value ||
    !hasAccessByCodes(['erp:sale-cart:create'])
  ) {
    return;
  }
  formModalApi.setData({ type: 'create' }).open();
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

function handleImport() {
  if (
    !canCreateInCurrentTab.value ||
    activationRefreshMaskVisible.value ||
    !hasAccessByCodes(['erp:sale-cart:create'])
  ) {
    return;
  }
  importModalApi
    .setData({
      title: '导入销售手推车整单',
      templateFileName: '销售手推车整单导入模板.xls',
      importRequest: importSaleCartOrder,
      exportTemplateRequest: exportSaleCartOrderImportTemplate,
      failureDownload: {
        request: downloadSaleCartImportFailureDetails,
        fileName: '销售手推车错误数据.xls',
      },
      templateGuideSummary:
        '销售手推车整单导入模板用于批量创建完整手推车；每个填写客户名称的主表行开始一张新手推车，后续空客户行归入同一张单据。',
      templateGuideTips: [
        '同一张手推车的客户、备注等主表信息只在首行填写；下一张单据请在新行重新填写客户名称。',
        '配件编码、配件名称、厂家编码三选一；仓库、数量、单价、赠品和明细备注请按模板示例填写。',
      ],
    })
    .open();
}

function handleImportSuccess(_data: SaleCartOrderImportResp) {
  handleRefresh();
}

useSaleShortcut({
  onCreate: handleCreate,
  onImport: handleImport,
});

function handleEdit(row: ErpSaleCartApi.SaleCart) {
  formModalApi.setData({ type: 'edit', id: row.id, initialData: row }).open();
}

function handleBasicEdit(row: ErpSaleCartApi.SaleCart) {
  basicInfoModalApi.setData(row).open();
}

function handleDetail(row: ErpSaleCartApi.SaleCart) {
  formModalApi.setData({ type: 'detail', id: row.id }).open();
}

async function handleFirstApprove(row: ErpSaleCartApi.SaleCart) {
  await firstApproveSaleCart(row.id!);
  message.success('初审成功');
  handleRefresh();
}

async function handleBillingConfirm(row: ErpSaleCartApi.SaleCart) {
  const result = await confirmSaleCart(row.id!);
  const status =
    typeof result === 'object' && result ? result.status : undefined;
  message.success(
    status === 20
      ? '开单确认成功，已进入待初审'
      : status === 30
        ? '开单确认成功，已进入待终审'
        : '开单确认成功',
  );
  handleRefresh();
}

async function handleFinalApprove(row: ErpSaleCartApi.SaleCart) {
  const result = await finalApproveSaleCart(row.id!);
  const ids = Array.isArray(result) ? result : [result];
  message.success(`终审成功，已生成 ${ids.length} 张销售单`);
  handleRefresh();
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
    await deleteSaleCart(ids);
    message.success(options.successMessage ?? '删除成功');
    await refreshActivatedSaleCartPage();
  } catch (error) {
    message.error(resolveSaleCartDeleteError(error));
  } finally {
    hideLoading();
  }
}

function resolveSaleCartDeleteError(error: unknown) {
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

async function handleExport() {
  const params: Record<string, any> = {
    ...normalizeSearchParams(await gridApi.formApi.getValues()),
    ...buildCurrentOrderSourceParams(),
  };
  if (checkedIds.value.length > 0) {
    params.ids = checkedIds.value;
  }
  pendingExportParams.value = params;
  exportFieldModalApi
    .setData({
      loadFields: getSaleCartExportFields,
      moduleKey: 'erp_sale_cart',
    })
    .open();
}

async function handleExportConfirm(fields: string[]) {
  const data = await exportSaleCart({
    ...pendingExportParams.value,
    fields: fields.join(','),
  } as any);
  downloadFileFromBlobPart({ fileName: '销售手推车.xls', source: data });
}

function openSaleCartPrintModal(data: {
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
  selectTemplate: selectPrintTemplate,
  selectedTemplateId: selectedPrintTemplateId,
  selectorOpen: printTemplateSelectOpen,
  templateOptions: printTemplateOptions,
} = useErpPrintTemplate<ErpSaleCartApi.SaleCart>({
  moduleKey: PRINT_TEMPLATE_MODULE,
  moduleName: PRINT_MODULE_NAME,
  openModal: openSaleCartPrintModal,
});

function handleDetailPrint(payload: {
  itemOrderDirection?: 'asc' | 'desc';
  itemOrderField?: string;
  row: ErpSaleCartApi.SaleCart;
}) {
  return selectPrintTemplate(payload.row, (row, templateId) => {
    openSaleCartPrintModal({
      businessId: row.id,
      businessNo: row.no,
      itemOrderDirection: payload.itemOrderDirection,
      itemOrderField: payload.itemOrderField,
      moduleKey: PRINT_TEMPLATE_MODULE,
      moduleName: PRINT_MODULE_NAME,
      templateId,
    });
  });
}

async function handleCancelFirstApprove(row: ErpSaleCartApi.SaleCart) {
  await cancelFirstApproveSaleCart(row.id!);
  message.success('撤销初审成功');
  handleRefresh();
}

function handleWechatNotice(row: ErpSaleCartApi.SaleCart) {
  message.info(`微信通知功能待接入，单号：${row.no || '-'}`);
}

function handleEmail(row: ErpSaleCartApi.SaleCart) {
  message.info(`邮件发送功能待接入，单号：${row.no || '-'}`);
}

function handleContinueBuy(row: ErpSaleCartApi.SaleCart) {
  if (!isBeforeFirstApprove(row)) {
    message.warning('已初审后的销售手推车不能继续选购');
    return;
  }
  handleEdit(row);
}

async function handleConvertQuote(row: ErpSaleCartApi.SaleCart) {
  await convertSaleCartToQuote(row.id!, []);
  message.success('已成功转为报价订单');
  handleRefresh();
}

const checkedRows = ref<ErpSaleCartApi.SaleCart[]>([]);
const checkedIds = computed(() => checkedRows.value.map((item) => item.id!));
const deletableCheckedRows = computed(() =>
  checkedRows.value.filter((item) => isBeforeFirstApprove(item)),
);
const skippedCheckedRows = computed(() =>
  checkedRows.value.filter((item) => !isBeforeFirstApprove(item)),
);
const deletableCheckedIds = computed(() =>
  deletableCheckedRows.value
    .map((item) => item.id)
    .filter((id): id is number => id !== undefined),
);
function handleSearchEnter(event: KeyboardEvent) {
  submitSearchFormOnEnterAndBlur(event, () => gridApi.formApi.submitForm());
}

function handleRowCheckboxChange({
  records,
}: {
  records: ErpSaleCartApi.SaleCart[];
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

async function reloadSaleCartColumns(
  rows: ErpSaleCartApi.SaleCart[] = currentPageRows.value,
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

async function handleSaleCartColumnCustom({ type }: { type?: string }) {
  const settled = await settleVxeColumnCustomization(gridApi.grid, type);
  if (!settled) return;
  await reloadSaleCartColumns(currentPageRows.value, type !== 'reset');
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
    id: 'erp-sale-cart-list-v2',
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
    rowClassName: ({ row }) => (row.status === 10 ? 'sale-cart-draft-row' : ''),
    proxyConfig: {
      ajax: {
        query: async ({ page, sort, sorts }, formValues) => {
          const params = {
            ...normalizeSearchParams(formValues),
            ...buildCurrentOrderSourceParams(),
          };
          const summaryChanged = querySummaryState.prepare(params);
          let pageFailed = false;
          const result = await getSaleCartPage({
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
          await reloadSaleCartColumns(rows);
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
  } as VxeTableGridOptions<ErpSaleCartApi.SaleCart>,
  gridEvents: {
    custom: handleSaleCartColumnCustom,
    sortChange: handleSortChange,
    checkboxAll: handleRowCheckboxChange,
    checkboxChange: handleRowCheckboxChange,
  },
});

async function handleOrderTabChange() {
  activationRefreshVersion++;
  querySummaryState.cancelPending();
  querySummaryState.invalidate();
  checkedRows.value = [];
  currentPageRows.value = [];
  const pager = gridApi.grid?.getProxyInfo?.()?.pager;
  if (pager) {
    pager.currentPage = 1;
    pager.total = 0;
  }
  await gridApi.grid?.loadData?.([]);
  await gridApi.query();
}

async function refreshActivatedSaleCartPage() {
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
    const formValues = {
      ...normalizeSearchParams(await gridApi.formApi.getValues()),
      ...buildCurrentOrderSourceParams(),
    };
    const sortParams = buildSortParams();
    let result = await getSaleCartPage({
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
      result = await getSaleCartPage({
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
    await reloadSaleCartColumns(rows);
    await gridApi.grid?.loadData?.(rows);
    querySummaryState.invalidate();
    void querySummaryState.load(formValues);
    checkedRows.value = [];
    await restoreSortState(gridApi);
  } catch (error) {
    console.error('Error occurred while refreshing sale cart page:', error);
  } finally {
    if (refreshVersion === activationRefreshVersion) {
      activationRefreshMaskVisible.value = false;
    }
  }
}

async function openOnlineOrderTabFromNotification(notificationKey: string) {
  notification.close(notificationKey);
  if (activeOrderTab.value === SALE_CART_ORDER_TAB.ONLINE_ORDER) {
    await refreshActivatedSaleCartPage();
    return;
  }
  activeOrderTab.value = SALE_CART_ORDER_TAB.ONLINE_ORDER;
  await handleOrderTabChange();
}

async function handleNewOnlineOrder(order: ErpSaleCartApi.LatestOnlineOrder) {
  const notificationKey = `sale-cart-online-order-${order.id}`;
  const orderLabel = order.sourceNo || order.no;
  const isOnlineOrderTab =
    activeOrderTab.value === SALE_CART_ORDER_TAB.ONLINE_ORDER;
  notification.info({
    key: notificationKey,
    message: '收到新的网上订单',
    description: orderLabel
      ? `订单 ${orderLabel} 已生成销售手推车${isOnlineOrderTab ? '，正在自动刷新列表' : ''}`
      : `新的网上订单已生成${isOnlineOrderTab ? '，正在自动刷新列表' : ''}`,
    duration: 8,
    btn: isOnlineOrderTab
      ? undefined
      : h(
          Button,
          {
            size: 'small',
            type: 'primary',
            onClick: () =>
              void openOnlineOrderTabFromNotification(notificationKey),
          },
          () => '查看网上订单',
        ),
  });
  if (isOnlineOrderTab) {
    await refreshActivatedSaleCartPage();
  }
}

const onlineOrderPolling = createOnlineOrderPolling({
  fetchLatest: getLatestOnlineOrder,
  isVisible: () => typeof document === 'undefined' || !document.hidden,
  onNewOrder: handleNewOnlineOrder,
});
let saleCartPageActive = false;

function syncOnlineOrderPolling() {
  if (
    saleCartPageActive &&
    (typeof document === 'undefined' || !document.hidden)
  ) {
    onlineOrderPolling.start();
    return;
  }
  onlineOrderPolling.stop();
}

function handlePageVisibilityChange() {
  syncOnlineOrderPolling();
}

onMounted(() => {
  saleCartPageActive = true;
  document.addEventListener('visibilitychange', handlePageVisibilityChange);
  syncOnlineOrderPolling();
});

onActivated(() => {
  saleCartPageActive = true;
  syncOnlineOrderPolling();
  if (!activatedOnce) {
    activatedOnce = true;
    return;
  }
  void refreshActivatedSaleCartPage();
});

onDeactivated(() => {
  saleCartPageActive = false;
  syncOnlineOrderPolling();
});

onBeforeUnmount(() => {
  saleCartPageActive = false;
  onlineOrderPolling.stop();
  document.removeEventListener('visibilitychange', handlePageVisibilityChange);
});

loadFirstApproveConfig();
</script>

<template>
  <Page auto-content-height>
    <FormModal
      @edit="handleEdit"
      @edit-basic="handleBasicEdit"
      @print="handleDetailPrint"
      @success="handleRefresh"
    />
    <BasicInfoModalRef @success="handleRefresh" />
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
    <div ref="saleCartGridShellRef" class="sale-cart-grid-shell">
      <Tabs
        v-model:active-key="activeOrderTab"
        class="sale-cart-order-tabs"
        type="card"
        @change="handleOrderTabChange"
      >
        <Tabs.TabPane :key="SALE_CART_ORDER_TAB.SALE_CART" tab="销售手推车" />
        <Tabs.TabPane :key="SALE_CART_ORDER_TAB.ONLINE_ORDER" tab="网上订单" />
      </Tabs>
      <Grid
        :table-title="currentTableTitle"
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
                auth: ['erp:sale-cart:create'],
                ifShow: () => canCreateInCurrentTab,
                onClick: handleCreate,
              },
              {
                label: '导入',
                type: 'primary',
                icon: ACTION_ICON.UPLOAD,
                tooltip: 'I 导入',
                auth: ['erp:sale-cart:create'],
                ifShow: () => canCreateInCurrentTab,
                onClick: handleImport,
              },
              {
                label: '导出',
                type: 'primary',
                icon: ACTION_ICON.DOWNLOAD,
                auth: ['erp:sale-cart:export'],
                onClick: handleExport,
              },
              {
                label: '打印模板',
                type: 'primary',
                icon: ACTION_ICON.EDIT,
                auth: ['erp:sale-cart:print-template'],
                onClick: handleOpenPrintTemplateDesigner,
              },
              {
                label: '批量删除',
                type: 'primary',
                danger: true,
                ifShow: () => checkedIds.length > 0,
                icon: ACTION_ICON.DELETE,
                auth: ['erp:sale-cart:delete'],
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
                auth: ['erp:sale-cart:delete'],
                ifShow: () => isBeforeFirstApprove(row),
                popConfirm: {
                  title: $t('ui.actionMessage.deleteConfirm', [row.no]),
                  confirm: () => handleDelete([row.id!]),
                },
              },
            ]"
          />
        </template>
        <template #printAction="{ row }">
          <Button
            v-access:code="['erp:sale-cart:print']"
            class="sale-cart-link"
            type="link"
            @click="handlePrint(row)"
          >
            打印
          </Button>
        </template>
        <template #wechatNotifyAction="{ row }">
          <Button
            v-access:code="['erp:sale-cart:query']"
            class="sale-cart-link"
            type="link"
            @click="handleWechatNotice(row)"
          >
            发信
          </Button>
        </template>
        <template #quoteAction="{ row }">
          <TableAction
            :actions="[
              {
                label: '转报价',
                type: 'link',
                ifShow: () => canConvertToQuote(row),
                tooltip: '仅初审前可转报价',
                auth: ['erp:sale-cart:convert-quote'],
                popConfirm: {
                  title: `确认将 ${row.no} 转为报价订单吗？转出后当前手推车不能继续编辑`,
                  confirm: handleConvertQuote.bind(null, row),
                },
              },
            ]"
          />
        </template>
        <template #no="{ row }">
          <button
            type="button"
            class="sale-cart-number-link"
            :title="row.no || ''"
            @click.stop="handleDetail(row)"
          >
            {{ row.no || '-' }}
          </button>
        </template>
        <template #continueBuyAction="{ row }">
          <Button
            v-if="isBeforeFirstApprove(row)"
            v-access:code="['erp:sale-cart:update']"
            class="sale-cart-link"
            type="link"
            @click="handleContinueBuy(row)"
          >
            继续选购
          </Button>
        </template>
        <template #status="{ row }">
          <span
            v-if="row.status === 10"
            class="sale-cart-draft-status"
            title="草稿：新增页面关闭时自动保存，尚未正式提交"
          >
            草稿
          </span>
          <span v-else>{{ getCartStatusLabel(row.status) }}</span>
          <span
            v-if="row.pickDeliveryOrderId"
            class="sale-cart-fulfillment-status"
            :title="getFulfillmentStatusDescription(row)"
          >
            {{ getFulfillmentStatusText(row) }}
          </span>
        </template>
        <template #emailAction="{ row }">
          <Button
            v-access:code="['erp:sale-cart:query']"
            class="sale-cart-link"
            type="link"
            @click="handleEmail(row)"
          >
            邮件
          </Button>
        </template>
        <template #actions="{ row }">
          <TableAction
            :actions="[
              {
                label: '修改信息',
                type: 'link',
                icon: ACTION_ICON.EDIT,
                auth: ['erp:sale-cart:update'],
                ifShow: () => row.status === 40 || row.status === 50,
                onClick: handleBasicEdit.bind(null, row),
              },
              {
                label: $t('common.edit'),
                type: 'link',
                icon: ACTION_ICON.EDIT,
                auth: ['erp:sale-cart:update'],
                ifShow: () => isBeforeFirstApprove(row),
                onClick: handleEdit.bind(null, row),
              },
              {
                label: '开单确认',
                type: 'link',
                icon: ACTION_ICON.AUDIT,
                auth: ['erp:sale-cart:confirm'],
                ifShow: () => row.status === 15,
                popConfirm: {
                  title: `确认锁定 ${row.no} 的开单内容并进入审核流程吗？`,
                  confirm: handleBillingConfirm.bind(null, row),
                },
              },
              {
                label: '初审',
                type: 'link',
                icon: ACTION_ICON.AUDIT,
                auth: ['erp:sale-cart:first-approve'],
                ifShow: () =>
                  firstApproveConfig.enabled &&
                  isFirstApproveRequired(row) &&
                  row.status === 20,
                popConfirm: {
                  title: `确认初审 ${row.no} 吗？`,
                  confirm: handleFirstApprove.bind(null, row),
                },
              },
              {
                label: '撤销初审',
                type: 'link',
                danger: true,
                icon: ACTION_ICON.REVERSE,
                auth: ['erp:sale-cart:cancel-first-approve'],
                ifShow: () => row.status === 30 && !row.pickDeliveryOrderId,
                popConfirm: {
                  title: `确认撤销 ${row.no} 的初审吗？`,
                  confirm: handleCancelFirstApprove.bind(null, row),
                },
              },
              {
                label: '终审',
                type: 'link',
                icon: ACTION_ICON.AUDIT,
                auth: ['erp:sale-cart:final-approve'],
                ifShow: () => isFinalApproveAllowed(row),
                popConfirm: {
                  title: `确认终审 ${row.no} 吗？终审后将生成销售单`,
                  confirm: handleFinalApprove.bind(null, row),
                },
              },
            ]"
          />
        </template>
        <template #bottom>
          <div class="sale-cart-bottom-summary">
            <div class="sale-cart-row-legend">
              <span
                class="sale-cart-row-legend__swatch"
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
        class="sale-cart-activation-mask"
      >
        <div class="sale-cart-activation-mask__content">
          <Spin size="small" />
          <span>同步最新数据中...</span>
        </div>
      </div>
    </div>
  </Page>
</template>

<style scoped>
.sale-cart-grid-shell {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 100%;
}

.sale-cart-order-tabs {
  flex: none;
  margin-bottom: 8px;
}

:deep(.sale-cart-order-tabs .ant-tabs-content-holder) {
  display: none;
}

:deep(.sale-cart-grid-shell > .vxe-grid) {
  flex: 1;
  min-height: 0;
}

.sale-cart-activation-mask {
  position: absolute;
  z-index: 20;
  inset: 0;
  display: grid;
  place-items: center;
  background: hsl(var(--background) / 58%);
}

.sale-cart-activation-mask__content {
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

:deep(.vxe-table--render-default) {
  font-size: 12px;
}

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

:global(.sale-cart-search-select-dropdown .ant-select-item),
:global(.sale-cart-search-select-dropdown .ant-empty-description) {
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

:deep(.sale-cart-link.ant-btn-link),
:deep(.vxe-body--column .table-actions .ant-btn-link) {
  height: auto;
  padding: 0;
  font-size: 12px;
}

:deep(.sale-cart-number-link) {
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

:deep(.sale-cart-number-link:hover),
:deep(.sale-cart-number-link:focus-visible) {
  text-decoration: underline;
}

:deep(.sale-cart-draft-row .vxe-body--column) {
  background-color: hsl(var(--primary) / 7%) !important;
}

:deep(.sale-cart-draft-row.row--hover .vxe-body--column) {
  background-color: hsl(var(--primary) / 13%) !important;
}

.sale-cart-draft-status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: hsl(var(--primary));
  font-weight: 500;
  cursor: help;
}

.sale-cart-draft-status::before {
  width: 6px;
  height: 6px;
  flex: 0 0 auto;
  background: currentcolor;
  border-radius: 50%;
  content: '';
}

.sale-cart-fulfillment-status {
  display: block;
  margin-top: 2px;
  color: hsl(var(--warning));
  font-size: 12px;
  line-height: 16px;
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

.sale-cart-bottom-summary {
  display: flex;
  min-height: 40px;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 4px 20px;
  border-top: 1px solid hsl(var(--border));
  padding: 5px 8px;
  font-size: 12px;
  line-height: 18px;
}

.sale-cart-total-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 14px;
}

.sale-cart-row-legend {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-right: auto;
  color: hsl(var(--muted-foreground));
}

.sale-cart-row-legend__swatch {
  width: 18px;
  height: 10px;
  background: hsl(var(--primary) / 10%);
  border: 1px solid hsl(var(--primary) / 30%);
  border-radius: 2px;
}

@media (max-width: 768px) {
  .sale-cart-bottom-summary {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
