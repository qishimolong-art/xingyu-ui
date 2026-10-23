<script lang="ts" setup>
import type { Ref } from 'vue';
import type { ReportDocumentType } from './report-document-detail';

import { defineAsyncComponent, nextTick, onBeforeUnmount, ref } from 'vue';

import { useAccess } from '@vben/access';
import { useVbenModal } from '@vben/common-ui';

import { message } from 'ant-design-vue';

import { ensureModalReady } from '#/views/erp/utils/lazy-modal';

import {
  getReportDocumentPermission,
  isReportDocumentType,
  REPORT_DOCUMENT_TYPES,
} from './report-document-detail';
import { provideReportViewOnly } from './report-view-only';

provideReportViewOnly();
const { hasAccessByCodes } = useAccess();

const loadFinancePaymentForm = () =>
  import('#/views/erp/finance/settlement/payment/modules/form.vue');
const FinancePaymentForm = defineAsyncComponent(loadFinancePaymentForm);

const loadFinanceReceiptForm = () =>
  import('#/views/erp/finance/settlement/receipt/modules/form.vue');
const FinanceReceiptForm = defineAsyncComponent(loadFinanceReceiptForm);
const loadFinanceTransferForm = () =>
  import('#/views/erp/finance/cash-bank/transfer/modules/form.vue');
const FinanceTransferForm = defineAsyncComponent(loadFinanceTransferForm);
const loadOtherIncomeForm = () =>
  import('#/views/erp/finance/receivable/other-income/modules/form.vue');
const OtherIncomeForm = defineAsyncComponent(loadOtherIncomeForm);
const loadPayableExpenseForm = () =>
  import('#/views/erp/finance/payable/expense/modules/form.vue');
const PayableExpenseForm = defineAsyncComponent(loadPayableExpenseForm);
const loadPayableMiscForm = () =>
  import('#/views/erp/finance/payable/misc/modules/form.vue');
const PayableMiscForm = defineAsyncComponent(loadPayableMiscForm);
const loadPayableOtherForm = () =>
  import('#/views/erp/finance/payable/other/modules/form.vue');
const PayableOtherForm = defineAsyncComponent(loadPayableOtherForm);
const loadPurchaseOrderForm = () =>
  import('#/views/erp/purchase/order/modules/form.vue');
const PurchaseOrderForm = defineAsyncComponent(loadPurchaseOrderForm);
const loadPurchaseInForm = () =>
  import('#/views/erp/purchase/in/modules/form.vue');
const PurchaseInForm = defineAsyncComponent(loadPurchaseInForm);
const loadPurchaseInvoiceForm = () =>
  import('#/views/erp/purchase/invoice/modules/form.vue');
const PurchaseInvoiceForm = defineAsyncComponent(loadPurchaseInvoiceForm);
const loadPurchasePriceAdjustForm = () =>
  import('#/views/erp/purchase/priceadjust/modules/form.vue');
const PurchasePriceAdjustForm = defineAsyncComponent(
  loadPurchasePriceAdjustForm,
);
const loadPurchaseReturnForm = () =>
  import('#/views/erp/purchase/return/modules/form.vue');
const PurchaseReturnForm = defineAsyncComponent(loadPurchaseReturnForm);
const loadReceivableMiscForm = () =>
  import('#/views/erp/finance/receivable/misc/modules/form.vue');
const ReceivableMiscForm = defineAsyncComponent(loadReceivableMiscForm);
const loadReceivableOtherForm = () =>
  import('#/views/erp/finance/receivable/other-receivable/modules/form.vue');
const ReceivableOtherForm = defineAsyncComponent(loadReceivableOtherForm);
const loadSaleCartForm = () => import('#/views/erp/sale/cart/modules/form.vue');
const SaleCartForm = defineAsyncComponent(loadSaleCartForm);
const loadSaleOrderForm = () =>
  import('#/views/erp/sale/order/modules/form.vue');
const SaleOrderForm = defineAsyncComponent(loadSaleOrderForm);
const loadSaleOutForm = () => import('#/views/erp/sale/out/modules/form.vue');
const SaleOutForm = defineAsyncComponent(loadSaleOutForm);
const loadSaleQuoteForm = () =>
  import('#/views/erp/sale/quote/modules/form.vue');
const SaleQuoteForm = defineAsyncComponent(loadSaleQuoteForm);
const loadSaleReturnForm = () =>
  import('#/views/erp/sale/return/modules/form.vue');
const SaleReturnForm = defineAsyncComponent(loadSaleReturnForm);
const loadSalePriceAdjustForm = () =>
  import('#/views/erp/sale/priceadjust/modules/form.vue');
const SalePriceAdjustForm = defineAsyncComponent(loadSalePriceAdjustForm);
const loadStockTransferOutForm = () =>
  import('#/views/erp/stock/transfer-out/modules/form.vue');
const StockTransferOutForm = defineAsyncComponent(loadStockTransferOutForm);
const loadStockTransferInForm = () =>
  import('#/views/erp/stock/transfer-in/modules/form.vue');
const StockTransferInForm = defineAsyncComponent(loadStockTransferInForm);

const [FinancePaymentModal, financePaymentModalApi] = useVbenModal({
  connectedComponent: FinancePaymentForm,
  destroyOnClose: true,
});
const shouldRenderFinancePayment = ref(false);
const [FinanceReceiptModal, financeReceiptModalApi] = useVbenModal({
  connectedComponent: FinanceReceiptForm,
  destroyOnClose: true,
});
const shouldRenderFinanceReceipt = ref(false);
const [FinanceTransferModal, financeTransferModalApi] = useVbenModal({
  connectedComponent: FinanceTransferForm,
  destroyOnClose: true,
});
const shouldRenderFinanceTransfer = ref(false);
const [OtherIncomeModal, otherIncomeModalApi] = useVbenModal({
  connectedComponent: OtherIncomeForm,
  destroyOnClose: true,
});
const shouldRenderOtherIncome = ref(false);
const [PayableExpenseModal, payableExpenseModalApi] = useVbenModal({
  connectedComponent: PayableExpenseForm,
  destroyOnClose: true,
});
const shouldRenderPayableExpense = ref(false);
const [PayableMiscModal, payableMiscModalApi] = useVbenModal({
  connectedComponent: PayableMiscForm,
  destroyOnClose: true,
});
const shouldRenderPayableMisc = ref(false);
const [PayableOtherModal, payableOtherModalApi] = useVbenModal({
  connectedComponent: PayableOtherForm,
  destroyOnClose: true,
});
const shouldRenderPayableOther = ref(false);
const [PurchaseOrderModal, purchaseOrderModalApi] = useVbenModal({
  connectedComponent: PurchaseOrderForm,
  destroyOnClose: true,
});
const shouldRenderPurchaseOrder = ref(false);
const [PurchaseInModal, purchaseInModalApi] = useVbenModal({
  connectedComponent: PurchaseInForm,
  destroyOnClose: true,
});
const shouldRenderPurchaseIn = ref(false);
const [PurchaseInvoiceModal, purchaseInvoiceModalApi] = useVbenModal({
  connectedComponent: PurchaseInvoiceForm,
  destroyOnClose: true,
});
const shouldRenderPurchaseInvoice = ref(false);
const [PurchasePriceAdjustModal, purchasePriceAdjustModalApi] = useVbenModal({
  connectedComponent: PurchasePriceAdjustForm,
  destroyOnClose: true,
});
const shouldRenderPurchasePriceAdjust = ref(false);
const [PurchaseReturnModal, purchaseReturnModalApi] = useVbenModal({
  connectedComponent: PurchaseReturnForm,
  destroyOnClose: true,
});
const shouldRenderPurchaseReturn = ref(false);
const [ReceivableMiscModal, receivableMiscModalApi] = useVbenModal({
  connectedComponent: ReceivableMiscForm,
  destroyOnClose: true,
});
const shouldRenderReceivableMisc = ref(false);
const [ReceivableOtherModal, receivableOtherModalApi] = useVbenModal({
  connectedComponent: ReceivableOtherForm,
  destroyOnClose: true,
});
const shouldRenderReceivableOther = ref(false);
const [SaleCartModal, saleCartModalApi] = useVbenModal({
  connectedComponent: SaleCartForm,
  destroyOnClose: true,
});
const shouldRenderSaleCart = ref(false);
const [SaleOrderModal, saleOrderModalApi] = useVbenModal({
  connectedComponent: SaleOrderForm,
  destroyOnClose: true,
});
const shouldRenderSaleOrder = ref(false);
const [SaleOutModal, saleOutModalApi] = useVbenModal({
  connectedComponent: SaleOutForm,
  destroyOnClose: true,
});
const shouldRenderSaleOut = ref(false);
const [SaleQuoteModal, saleQuoteModalApi] = useVbenModal({
  connectedComponent: SaleQuoteForm,
  destroyOnClose: true,
});
const shouldRenderSaleQuote = ref(false);
const [SaleReturnModal, saleReturnModalApi] = useVbenModal({
  connectedComponent: SaleReturnForm,
  destroyOnClose: true,
});
const shouldRenderSaleReturn = ref(false);
const [SalePriceAdjustModal, salePriceAdjustModalApi] = useVbenModal({
  connectedComponent: SalePriceAdjustForm,
  destroyOnClose: true,
});
const shouldRenderSalePriceAdjust = ref(false);
const [StockTransferOutModal, stockTransferOutModalApi] = useVbenModal({
  connectedComponent: StockTransferOutForm,
  destroyOnClose: true,
});
const shouldRenderStockTransferOut = ref(false);
const [StockTransferInModal, stockTransferInModalApi] = useVbenModal({
  connectedComponent: StockTransferInForm,
  destroyOnClose: true,
});
const shouldRenderStockTransferIn = ref(false);

type ModalApi = typeof financeReceiptModalApi;
type DocumentModalConfig = {
  loadComponent: () => Promise<unknown>;
  modalApi: ModalApi;
  shouldRender: Ref<boolean>;
};

const modalConfigMap: Record<ReportDocumentType, DocumentModalConfig> = {
  [REPORT_DOCUMENT_TYPES.FINANCE_PAYMENT]: {
    loadComponent: loadFinancePaymentForm,
    modalApi: financePaymentModalApi,
    shouldRender: shouldRenderFinancePayment,
  },
  [REPORT_DOCUMENT_TYPES.FINANCE_RECEIPT]: {
    loadComponent: loadFinanceReceiptForm,
    modalApi: financeReceiptModalApi,
    shouldRender: shouldRenderFinanceReceipt,
  },
  [REPORT_DOCUMENT_TYPES.FINANCE_TRANSFER]: {
    loadComponent: loadFinanceTransferForm,
    modalApi: financeTransferModalApi,
    shouldRender: shouldRenderFinanceTransfer,
  },
  [REPORT_DOCUMENT_TYPES.OTHER_INCOME]: {
    loadComponent: loadOtherIncomeForm,
    modalApi: otherIncomeModalApi,
    shouldRender: shouldRenderOtherIncome,
  },
  [REPORT_DOCUMENT_TYPES.PAYABLE_EXPENSE]: {
    loadComponent: loadPayableExpenseForm,
    modalApi: payableExpenseModalApi,
    shouldRender: shouldRenderPayableExpense,
  },
  [REPORT_DOCUMENT_TYPES.PAYABLE_MISC]: {
    loadComponent: loadPayableMiscForm,
    modalApi: payableMiscModalApi,
    shouldRender: shouldRenderPayableMisc,
  },
  [REPORT_DOCUMENT_TYPES.PAYABLE_OTHER]: {
    loadComponent: loadPayableOtherForm,
    modalApi: payableOtherModalApi,
    shouldRender: shouldRenderPayableOther,
  },
  [REPORT_DOCUMENT_TYPES.PURCHASE_ORDER]: {
    loadComponent: loadPurchaseOrderForm,
    modalApi: purchaseOrderModalApi,
    shouldRender: shouldRenderPurchaseOrder,
  },
  [REPORT_DOCUMENT_TYPES.PURCHASE_IN]: {
    loadComponent: loadPurchaseInForm,
    modalApi: purchaseInModalApi,
    shouldRender: shouldRenderPurchaseIn,
  },
  [REPORT_DOCUMENT_TYPES.PURCHASE_INVOICE]: {
    loadComponent: loadPurchaseInvoiceForm,
    modalApi: purchaseInvoiceModalApi,
    shouldRender: shouldRenderPurchaseInvoice,
  },
  [REPORT_DOCUMENT_TYPES.PURCHASE_PRICE_ADJUST]: {
    loadComponent: loadPurchasePriceAdjustForm,
    modalApi: purchasePriceAdjustModalApi,
    shouldRender: shouldRenderPurchasePriceAdjust,
  },
  [REPORT_DOCUMENT_TYPES.PURCHASE_RETURN]: {
    loadComponent: loadPurchaseReturnForm,
    modalApi: purchaseReturnModalApi,
    shouldRender: shouldRenderPurchaseReturn,
  },
  [REPORT_DOCUMENT_TYPES.RECEIVABLE_MISC]: {
    loadComponent: loadReceivableMiscForm,
    modalApi: receivableMiscModalApi,
    shouldRender: shouldRenderReceivableMisc,
  },
  [REPORT_DOCUMENT_TYPES.RECEIVABLE_OTHER]: {
    loadComponent: loadReceivableOtherForm,
    modalApi: receivableOtherModalApi,
    shouldRender: shouldRenderReceivableOther,
  },
  [REPORT_DOCUMENT_TYPES.SALE_CART]: {
    loadComponent: loadSaleCartForm,
    modalApi: saleCartModalApi,
    shouldRender: shouldRenderSaleCart,
  },
  [REPORT_DOCUMENT_TYPES.SALE_ORDER]: {
    loadComponent: loadSaleOrderForm,
    modalApi: saleOrderModalApi,
    shouldRender: shouldRenderSaleOrder,
  },
  [REPORT_DOCUMENT_TYPES.SALE_OUT]: {
    loadComponent: loadSaleOutForm,
    modalApi: saleOutModalApi,
    shouldRender: shouldRenderSaleOut,
  },
  [REPORT_DOCUMENT_TYPES.SALE_RETURN]: {
    loadComponent: loadSaleReturnForm,
    modalApi: saleReturnModalApi,
    shouldRender: shouldRenderSaleReturn,
  },
  [REPORT_DOCUMENT_TYPES.SALE_PRICE_ADJUST]: {
    loadComponent: loadSalePriceAdjustForm,
    modalApi: salePriceAdjustModalApi,
    shouldRender: shouldRenderSalePriceAdjust,
  },
  [REPORT_DOCUMENT_TYPES.SALE_QUOTE]: {
    loadComponent: loadSaleQuoteForm,
    modalApi: saleQuoteModalApi,
    shouldRender: shouldRenderSaleQuote,
  },
  [REPORT_DOCUMENT_TYPES.STOCK_TRANSFER_OUT]: {
    loadComponent: loadStockTransferOutForm,
    modalApi: stockTransferOutModalApi,
    shouldRender: shouldRenderStockTransferOut,
  },
  [REPORT_DOCUMENT_TYPES.STOCK_TRANSFER_IN]: {
    loadComponent: loadStockTransferInForm,
    modalApi: stockTransferInModalApi,
    shouldRender: shouldRenderStockTransferIn,
  },
};

let openSequence = 0;

async function open(
  type: null | string | undefined,
  id: null | number | undefined,
) {
  const documentId = Number(id);
  if (!Number.isSafeInteger(documentId) || documentId <= 0) {
    message.warning('缺少来源关联，无法打开详情');
    return;
  }
  if (!isReportDocumentType(type)) {
    message.warning('当前单据类型暂不支持查看详情');
    return;
  }
  const permission = getReportDocumentPermission(type);
  if (!hasAccessByCodes([permission])) {
    message.warning('无该单据查看权限');
    return;
  }
  const sequence = ++openSequence;
  const config = modalConfigMap[type];
  for (const item of Object.values(modalConfigMap)) {
    item.shouldRender.value = false;
  }
  await nextTick();
  try {
    await ensureModalReady(
      config.shouldRender,
      config.modalApi,
      config.loadComponent,
    );
    if (sequence !== openSequence) return;
    config.modalApi
      .setData({ id: documentId, reportViewOnly: true, type: 'detail' })
      .open();
  } catch {
    if (sequence !== openSequence) return;
    config.shouldRender.value = false;
    message.error('单据详情加载失败，请稍后重试');
  }
}

onBeforeUnmount(() => {
  openSequence += 1;
});

defineExpose({ open });
</script>

<template>
  <FinancePaymentModal v-if="shouldRenderFinancePayment" />
  <FinanceReceiptModal v-if="shouldRenderFinanceReceipt" />
  <FinanceTransferModal v-if="shouldRenderFinanceTransfer" />
  <OtherIncomeModal v-if="shouldRenderOtherIncome" />
  <PayableExpenseModal v-if="shouldRenderPayableExpense" />
  <PayableMiscModal v-if="shouldRenderPayableMisc" />
  <PayableOtherModal v-if="shouldRenderPayableOther" />
  <PurchaseOrderModal v-if="shouldRenderPurchaseOrder" />
  <PurchaseInModal v-if="shouldRenderPurchaseIn" />
  <PurchaseInvoiceModal v-if="shouldRenderPurchaseInvoice" />
  <PurchasePriceAdjustModal v-if="shouldRenderPurchasePriceAdjust" />
  <PurchaseReturnModal v-if="shouldRenderPurchaseReturn" />
  <ReceivableMiscModal v-if="shouldRenderReceivableMisc" />
  <ReceivableOtherModal v-if="shouldRenderReceivableOther" />
  <SaleCartModal v-if="shouldRenderSaleCart" />
  <SaleOrderModal v-if="shouldRenderSaleOrder" />
  <SaleOutModal v-if="shouldRenderSaleOut" />
  <SaleReturnModal v-if="shouldRenderSaleReturn" />
  <SalePriceAdjustModal v-if="shouldRenderSalePriceAdjust" />
  <SaleQuoteModal v-if="shouldRenderSaleQuote" />
  <StockTransferOutModal v-if="shouldRenderStockTransferOut" />
  <StockTransferInModal v-if="shouldRenderStockTransferIn" />
</template>
