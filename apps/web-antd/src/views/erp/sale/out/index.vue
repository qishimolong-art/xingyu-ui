<script lang="ts" setup>
import type { VxeTableGridOptions } from '#/adapter/vxe-table';
import type { ErpPrintApi } from '#/api/erp/print';
import type { ErpSaleOutApi } from '#/api/erp/sale/out';

import { computed, nextTick, onActivated, ref } from 'vue';

import { Page, useVbenModal } from '@vben/common-ui';
import { downloadFileFromBlobPart } from '@vben/utils';

import { Button, message, Spin, Tag } from 'ant-design-vue';

import { ACTION_ICON, TableAction, useVbenVxeGrid } from '#/adapter/vxe-table';
import {
  exportSaleOut,
  getSaleOutPage,
  getSaleOutSummary,
  updateSaleOutStatus,
} from '#/api/erp/sale/out';
import PrintTemplateModal from '#/views/erp/components/PrintTemplateModal.vue';
import PrintTemplateSelector from '#/views/erp/components/PrintTemplateSelector.vue';
import SaleListQuerySummary from '#/views/erp/sale/components/SaleListQuerySummary.vue';
import {
  applySaleDocumentListColumnCustomization,
  syncSaleDocumentColumnDefaults,
  syncSaleDocumentOperationColumn,
} from '#/views/erp/sale/utils/document-list-table';
import { useSaleQuerySummary } from '#/views/erp/sale/utils/use-sale-query-summary';
import SalePriceAdjustForm from '#/views/erp/sale/priceadjust/modules/form.vue';
import SaleQuoteForm from '#/views/erp/sale/quote/modules/form.vue';
import SaleReturnForm from '#/views/erp/sale/return/modules/form.vue';
import { useErpPrintTemplate } from '#/views/erp/utils/print-template';
import { submitSearchFormOnEnterAndBlur } from '#/views/erp/utils/keyboard';
import { settleVxeColumnCustomization } from '#/views/erp/utils/vxe-column-custom';
import { createVxeHeaderSort } from '#/views/erp/utils/vxe-header-sort';

import { useGridColumns, useGridFormSchema } from './data';
import DetailModal from './modules/form.vue';
import CloudPrintPreviewModal from './modules/CloudPrintPreviewModal.vue';

defineOptions({ name: 'ErpSaleOut' });

const PRINT_TEMPLATE_MODULE = 'sale_out';
const PRINT_MODULE_NAME = '销售出库';

const checkedIds = ref<number[]>([]);
const currentPageRows = ref<ErpSaleOutApi.SaleOut[]>([]);
const activationRefreshMaskVisible = ref(false);
const cloudPrintingIds = ref(new Set<number>());
const cloudPrintPreviewRef = ref<InstanceType<typeof CloudPrintPreviewModal>>();

const [DetailModalComp, detailModalApi] = useVbenModal({
  connectedComponent: DetailModal,
  destroyOnClose: true,
});
const [SalePriceAdjustModal, salePriceAdjustModalApi] = useVbenModal({
  connectedComponent: SalePriceAdjustForm,
  destroyOnClose: true,
});
const [SaleReturnModal, saleReturnModalApi] = useVbenModal({
  connectedComponent: SaleReturnForm,
  destroyOnClose: true,
});
const [SaleQuoteModal, saleQuoteModalApi] = useVbenModal({
  connectedComponent: SaleQuoteForm,
  destroyOnClose: true,
});
const [PrintTemplateDesignModal, printTemplateDesignModalApi] = useVbenModal({
  connectedComponent: PrintTemplateModal,
  destroyOnClose: true,
});

function formatSummaryAmount(value?: null | number) {
  if (value === null || value === undefined) return '****';
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatSummaryQuantity(value?: null | number) {
  if (value === null || value === undefined) return '****';
  return value.toLocaleString('zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}

const querySummaryState = useSaleQuerySummary((params, signal) =>
  getSaleOutSummary(params, signal),
);
const querySummaryItems = computed(() => {
  const value = querySummaryState.summary.value;
  if (!value) return [];
  return [
    {
      key: 'totalCount',
      label: '总数量',
      value: formatSummaryQuantity(value.totalCount),
    },
    {
      key: 'totalProductPrice',
      label: '销售金额',
      value: formatSummaryAmount(value.totalProductPrice),
    },
    {
      key: 'reductionAmount',
      label: '优惠金额',
      value: formatSummaryAmount(value.reductionAmount),
    },
    {
      key: 'afterReductionAmount',
      label: '应收金额',
      value: formatSummaryAmount(value.afterReductionAmount),
    },
    {
      key: 'billAmount',
      label: '票据金额',
      value: formatSummaryAmount(value.billAmount),
    },
    {
      key: 'freight',
      label: '运费',
      value: formatSummaryAmount(value.freight),
    },
  ];
});

const saleOutSortFieldMap: Record<string, string> = {
  printCount: 'printCount',
  no: 'no',
  settleStatus: 'settleStatus',
  outTime: 'outTime',
  status: 'status',
  customerName: 'customerId',
  deliveryMethod: 'deliveryMethod',
  settleMethod: 'settleMethod',
  totalProductPrice: 'totalProductPrice',
  reductionAmount: 'reductionAmount',
  afterReductionAmount: 'afterReductionAmount',
  billAmount: 'billAmount',
  freight: 'freight',
  totalCount: 'totalCount',
  cancelCount: 'cancelCount',
  cancelAmount: 'cancelAmount',
  afterCancelAmount: 'afterCancelAmount',
  receiverName: 'receiverName',
  receiverPhone: 'receiverPhone',
  remark: 'remark',
  totalWeight: 'totalWeight',
  customerCode: 'customerId',
  billNo: 'billNo',
  sourceNo: 'sourceNo',
  sourceCreateTime: 'sourceCreateTime',
  vin: 'vin',
  extraFee: 'extraFee',
};
const { buildSortParams, handleSortChange, restoreSortState } =
  createVxeHeaderSort(saleOutSortFieldMap);

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

async function handleExport() {
  const data = await exportSaleOut({
    ...normalizeSearchParams(await gridApi.formApi.getValues()),
    ...buildSortParams(),
    ids: checkedIds.value.length > 0 ? checkedIds.value : undefined,
  });
  downloadFileFromBlobPart({ fileName: '销售单.xls', source: data });
}

function handleDetail(row: ErpSaleOutApi.SaleOut) {
  detailModalApi.setData({ id: row.id }).open();
}

function formatAmount(value: null | number | string | undefined, scale = 2) {
  if (value === undefined || value === null || value === '') {
    return '-';
  }
  const numericValue = Number(value);
  return Number.isFinite(numericValue)
    ? numericValue.toFixed(scale)
    : String(value);
}

function getFirstValue(...values: Array<null | number | string | undefined>) {
  return values.find(
    (value) => value !== undefined && value !== null && value !== '',
  );
}

function getSettleStatusText(row: ErpSaleOutApi.SaleOut) {
  if (row.settleStatus === 2) return '已结清';
  if (row.settleStatus === 1) return '部分结清';
  if (row.settleStatus === 0) return '未结清';

  const totalPrice = Number(row.totalPrice || 0);
  const receiptPrice = Number(row.receiptPrice || 0);
  if (totalPrice !== 0 && Math.abs(receiptPrice) >= Math.abs(totalPrice)) {
    return '已结清';
  }
  if (receiptPrice !== 0) {
    return '部分结清';
  }
  return '未结清';
}

function getSettleStatusColor(row: ErpSaleOutApi.SaleOut) {
  const statusText = getSettleStatusText(row);
  if (statusText === '已结清') return 'green';
  if (statusText === '部分结清') return 'blue';
  return 'default';
}

function getAdjustStatus(row: ErpSaleOutApi.SaleOut) {
  if (
    row.adjustStatus === 2 ||
    (row.adjustStatus === undefined && row.adjusted)
  ) {
    return { text: '已调价', tone: 'adjust-done' };
  }
  if (row.adjustStatus === 1) {
    return { text: '部分调价', tone: 'adjust-done' };
  }
  return { text: '未调价', tone: 'none' };
}

function getReturnStatus(row: ErpSaleOutApi.SaleOut) {
  if (row.returnStatus === 2) return { text: '已退货', tone: 'return-done' };
  if (row.returnStatus === 1) return { text: '部分退货', tone: 'partial' };
  return { text: '未退货', tone: 'none' };
}

function canOpenQuote(row: ErpSaleOutApi.SaleOut) {
  return row.sourceType === 20 && !!row.sourceId;
}

function handleQuoteDetail(row: ErpSaleOutApi.SaleOut) {
  if (!canOpenQuote(row)) return;
  saleQuoteModalApi.setData({ type: 'detail', id: row.sourceId }).open();
}

function openSalePrintModal(data: {
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
} = useErpPrintTemplate<ErpSaleOutApi.SaleOut>({
  moduleKey: PRINT_TEMPLATE_MODULE,
  moduleName: PRINT_MODULE_NAME,
  openModal: openSalePrintModal,
});

function handleWxNotice(row: ErpSaleOutApi.SaleOut) {
  message.warning(`微信通知功能待接入，单号：${row.no || '-'}`);
}

async function handleCloudPrint(
  row: ErpSaleOutApi.SaleOut,
  templateId?: number | string,
  itemOrderField?: string,
  itemOrderDirection?: 'asc' | 'desc',
) {
  if (!row.id) return;
  if (cloudPrintingIds.value.has(row.id)) return;
  cloudPrintingIds.value = new Set(cloudPrintingIds.value).add(row.id);
  try {
    if (!templateId) {
      message.error('请选择打印模板');
      return;
    }
    await cloudPrintPreviewRef.value?.open(
      row.id,
      templateId,
      itemOrderField,
      itemOrderDirection,
    );
  } finally {
    const next = new Set(cloudPrintingIds.value);
    next.delete(row.id);
    cloudPrintingIds.value = next;
  }
}

function handleCloudPrintConfirmed(tasks: ErpPrintApi.CloudPrintTask[]) {
  const queueMessages = [
    ...new Set(tasks.map((task) => task.queueMessage).filter(Boolean)),
  ];
  const text = queueMessages.join('；') || '云打印任务已加入队列';
  if (tasks.some((task) => task.queueState === 'PAUSED')) {
    message.warning(text);
  } else {
    message.success(text);
  }
  handleRefresh();
}

function handleCloudPrintRow(row: ErpSaleOutApi.SaleOut) {
  return selectPrintTemplate(row, (targetRow, templateId) =>
    handleCloudPrint(targetRow, templateId),
  );
}

function handleDetailPrint(payload: any) {
  const row = {
    ...payload.row,
    itemOrderDirection: payload.itemOrderDirection,
    itemOrderField: payload.itemOrderField,
  };
  return selectPrintTemplate(row, (targetRow, templateId) =>
    handleCloudPrint(
      targetRow,
      templateId,
      (targetRow as any).itemOrderField,
      (targetRow as any).itemOrderDirection,
    ),
  );
}

function handleSearchEnter(event: KeyboardEvent) {
  submitSearchFormOnEnterAndBlur(event, () => gridApi.formApi.submitForm());
}

/** 跳转销售调价页面 */
function handlePriceAdjust(row: ErpSaleOutApi.SaleOut) {
  salePriceAdjustModalApi
    .setData({
      type: 'create',
      sourceSaleOut: row,
    })
    .open();
}

function handleReturn(row: ErpSaleOutApi.SaleOut) {
  saleReturnModalApi
    .setData({
      type: 'create',
      sourceSaleOut: row,
    })
    .open();
}

async function handleAudit(row: ErpSaleOutApi.SaleOut) {
  await updateSaleOutStatus(row.id!, 20);
  message.success('审批成功');
  handleRefresh();
}

function handleRowCheckboxChange({
  records,
}: {
  records: ErpSaleOutApi.SaleOut[];
}) {
  checkedIds.value = records.map((item) => item.id!);
}

async function reloadSaleOutColumns(
  rows: ErpSaleOutApi.SaleOut[] = currentPageRows.value,
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

async function handleSaleOutColumnCustom({ type }: { type?: string }) {
  const settled = await settleVxeColumnCustomization(gridApi.grid, type);
  if (!settled) return;
  await reloadSaleOutColumns(currentPageRows.value, type !== 'reset');
  await restoreSortState(gridApi);
}

const [Grid, gridApi] = useVbenVxeGrid({
  formOptions: {
    commonConfig: { labelWidth: 68 },
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
    id: 'erp-sale-out-list-v2',
    showHeaderOverflow: 'tooltip',
    showOverflow: 'tooltip',
    scrollX: { enabled: true, gt: 8 },
    scrollY: { enabled: true, gt: 10 },
    keepSource: true,
    rowClassName: ({ row }) =>
      (row.hasExpressFile ?? Boolean(row.expressFileUrl))
        ? ''
        : 'highlight-no-express',
    proxyConfig: {
      ajax: {
        query: async ({ page, sort, sorts }, formValues) => {
          const params = normalizeSearchParams(formValues);
          const summaryChanged = querySummaryState.prepare(params);
          let pageFailed = false;
          const result = await getSaleOutPage({
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
          await reloadSaleOutColumns(rows);
          if (!pageFailed) void querySummaryState.load(params, summaryChanged);
          return result;
        },
        querySuccess: () => {
          checkedIds.value = [];
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
  } as VxeTableGridOptions<ErpSaleOutApi.SaleOut>,
  gridEvents: {
    custom: handleSaleOutColumnCustom,
    sortChange: handleSortChange,
    checkboxAll: handleRowCheckboxChange,
    checkboxChange: handleRowCheckboxChange,
  },
});

let activatedOnce = false;
let activationRefreshVersion = 0;

async function refreshActivatedSaleOutPage() {
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
    let result = await getSaleOutPage({
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
      result = await getSaleOutPage({
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
    await reloadSaleOutColumns(rows);
    await gridApi.grid?.loadData?.(rows);
    querySummaryState.invalidate();
    void querySummaryState.load(formValues);
    checkedIds.value = [];
    await restoreSortState(gridApi);
  } catch (error) {
    console.error('Error occurred while refreshing sale out page:', error);
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
  void refreshActivatedSaleOutPage();
});
</script>

<template>
  <Page auto-content-height>
    <DetailModalComp @print="handleDetailPrint" @success="handleRefresh" />
    <SalePriceAdjustModal @success="handleRefresh" />
    <SaleReturnModal @success="handleRefresh" />
    <SaleQuoteModal />
    <PrintTemplateDesignModal @printed="handleRefresh" />
    <CloudPrintPreviewModal
      ref="cloudPrintPreviewRef"
      @confirmed="handleCloudPrintConfirmed"
    />
    <PrintTemplateSelector
      v-model:open="printTemplateSelectOpen"
      v-model:selected-id="selectedPrintTemplateId"
      :templates="printTemplateOptions"
      @cancel="cancelTemplateSelect"
      @confirm="confirmTemplate"
    />
    <div class="sale-out-grid-shell">
      <Grid table-title="销售单列表" @keydown.enter.capture="handleSearchEnter">
        <template #toolbar-tools>
          <TableAction
            :actions="[
              {
                label: '导出',
                type: 'primary',
                icon: ACTION_ICON.DOWNLOAD,
                auth: ['erp:sale-out:export'],
                onClick: handleExport,
              },
              {
                label: '打印模板',
                type: 'primary',
                icon: ACTION_ICON.EDIT,
                auth: ['erp:sale-out:print-template'],
                onClick: handleOpenPrintTemplateDesigner,
              },
            ]"
          />
        </template>
        <template #no="{ row }">
          <span class="sale-out-number-cell">
            <button
              type="button"
              class="sale-out-number-link"
              :title="row.no || ''"
              @click.stop="handleDetail(row)"
            >
              {{ row.no || '-' }}
            </button>
          </span>
        </template>
        <template #adjustStatus="{ row }">
          <span
            class="sale-out-business-status-text"
            :class="`sale-out-business-status-text--${getAdjustStatus(row).tone}`"
          >
            {{ getAdjustStatus(row).text }}
          </span>
        </template>
        <template #returnStatus="{ row }">
          <span
            class="sale-out-business-status-text"
            :class="`sale-out-business-status-text--${getReturnStatus(row).tone}`"
          >
            {{ getReturnStatus(row).text }}
          </span>
        </template>
        <template #settleStatus="{ row }">
          <Tag :color="getSettleStatusColor(row)">
            {{ getSettleStatusText(row) }}
          </Tag>
        </template>
        <template #reductionAmount="{ row }">
          <span>{{
            formatAmount(
              getFirstValue(row.reductionAmount, row.discountPrice),
              2,
            )
          }}</span>
        </template>
        <template #afterReductionAmount="{ row }">
          <span>{{
            formatAmount(
              getFirstValue(row.afterReductionAmount, row.totalPrice),
              2,
            )
          }}</span>
        </template>
        <template #extraFee="{ row }">
          <span>{{
            formatAmount(getFirstValue(row.extraFee, row.feeAmount), 2)
          }}</span>
        </template>
        <template #printAction="{ row }">
          <Button
            v-access:code="['erp:sale-out:print']"
            class="sale-out-link"
            type="link"
            @click="handlePrint(row)"
          >
            打印
          </Button>
        </template>
        <template #cloudPrintAction="{ row }">
          <Button
            v-access:code="['erp:sale-out:print']"
            class="sale-out-link"
            :loading="Boolean(row.id && cloudPrintingIds.has(row.id))"
            type="link"
            @click="handleCloudPrintRow(row)"
          >
            云打印
          </Button>
        </template>
        <template #wechatNotifyAction="{ row }">
          <Button
            v-access:code="['erp:sale-out:query']"
            class="sale-out-link"
            type="link"
            @click="handleWxNotice(row)"
          >
            发信
          </Button>
        </template>
        <template #quoteAction="{ row }">
          <Button
            v-if="canOpenQuote(row)"
            v-access:code="['erp:sale-quote:query']"
            class="sale-out-link"
            type="link"
            :title="row.sourceNo || '查看来源单据'"
            @click="handleQuoteDetail(row)"
          >
            查看
          </Button>
        </template>
        <template #expenseAction><span aria-hidden="true"></span></template>
        <template #signAction><span aria-hidden="true"></span></template>
        <template #actions="{ row }">
          <TableAction
            :actions="[
              {
                label: '调价',
                icon: ACTION_ICON.EDIT,
                type: 'link',
                auth: ['erp:sale-price-adjust:create'],
                ifShow: () => row.status === 20,
                onClick: handlePriceAdjust.bind(null, row),
              },
              {
                label: '退货',
                icon: ACTION_ICON.REVERSE,
                type: 'link',
                auth: ['erp:sale-return:create'],
                ifShow: () => row.status === 20 && row.returnStatus !== 2,
                onClick: handleReturn.bind(null, row),
              },
              {
                label: '审批',
                icon: ACTION_ICON.AUDIT,
                type: 'link',
                auth: ['erp:sale-out:update-status'],
                ifShow: () => row.status === 10,
                popConfirm: {
                  title: `确认审批 ${row.no} 并直接扣减库存吗？`,
                  confirm: handleAudit.bind(null, row),
                },
              },
            ]"
          />
        </template>
        <template #bottom>
          <div class="sale-out-bottom-summary">
            <div class="sale-out-state-notes" aria-label="销售单状态标记说明">
              <span>
                <i class="sale-out-express-swatch"></i>
                浅黄色行表示未上传快递单
              </span>
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
      <div v-if="activationRefreshMaskVisible" class="sale-out-activation-mask">
        <div class="sale-out-activation-mask__content">
          <Spin size="small" />
          <span>同步最新数据中...</span>
        </div>
      </div>
    </div>
  </Page>
</template>

<style scoped>
.sale-out-grid-shell {
  position: relative;
  height: 100%;
  min-height: 100%;
}

.sale-out-activation-mask {
  position: absolute;
  z-index: 20;
  inset: 0;
  display: grid;
  place-items: center;
  background: hsl(var(--background) / 58%);
}

.sale-out-activation-mask__content {
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

:global(.sale-out-search-select-dropdown .ant-select-item),
:global(.sale-out-search-select-dropdown .ant-empty-description) {
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

:deep(.highlight-no-express .vxe-body--column) {
  background-color: hsl(var(--warning) / 22%) !important;
}

:deep(.highlight-no-express.row--hover .vxe-body--column) {
  background-color: hsl(var(--warning) / 30%) !important;
}

:deep(.sale-out-link.ant-btn-link),
:deep(.vxe-body--column .table-actions .ant-btn-link) {
  height: auto;
  padding: 0;
  font-size: 12px;
  white-space: nowrap;
}

:deep(.vxe-body--column .ant-tag) {
  max-width: 100%;
  margin-inline-end: 0;
  overflow: hidden;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

:deep(.sale-out-number-link) {
  display: block;
  min-width: 0;
  max-width: 100%;
  padding: 0;
  color: hsl(var(--primary));
  font: inherit;
  white-space: nowrap;
  cursor: pointer;
  background: transparent;
  border: 0;
}

.sale-out-number-cell {
  display: flex;
  min-width: 0;
  align-items: center;
}

.sale-out-business-status-text {
  font-size: 12px;
  font-weight: 600;
}

.sale-out-business-status-text--adjust-done {
  color: #1677ff;
}

.sale-out-business-status-text--partial {
  color: #fa8c16;
}

.sale-out-business-status-text--return-done {
  color: #ff4d4f;
}

:deep(.sale-out-number-link:hover),
:deep(.sale-out-number-link:focus-visible) {
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

.sale-out-bottom-summary {
  display: flex;
  min-height: 40px;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 4px 20px;
  padding: 5px 8px;
  border-top: 1px solid hsl(var(--border));
  font-size: 12px;
  line-height: 18px;
}

.sale-out-state-notes,
.sale-out-total-line,
.sale-out-state-notes > span {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
}

.sale-out-state-notes {
  gap: 4px 14px;
  font-weight: 600;
}

.sale-out-state-notes > span {
  gap: 6px;
  white-space: nowrap;
}

.sale-out-express-swatch {
  display: inline-block;
  width: 14px;
  height: 14px;
  flex: 0 0 14px;
  border: 1px solid hsl(var(--warning) / 70%);
  background-color: hsl(var(--warning) / 22%);
}

.sale-out-total-line {
  justify-content: flex-end;
  gap: 4px 14px;
}

@media (max-width: 768px) {
  .sale-out-bottom-summary {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
