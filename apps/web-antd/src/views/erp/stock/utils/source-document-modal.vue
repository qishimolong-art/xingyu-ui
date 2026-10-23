<script lang="ts" setup>
import type { Ref } from 'vue';

import { defineAsyncComponent, nextTick, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { ensureModalReady } from '#/views/erp/utils/lazy-modal';

import {
  canNavigateStockSourceDocument,
  STOCK_SOURCE_DOCUMENT_TYPES,
} from './source-document-navigation';

const loadPurchaseOrderForm = () =>
  import('#/views/erp/purchase/order/modules/form.vue');
const PurchaseOrderForm = defineAsyncComponent(loadPurchaseOrderForm);
const loadPurchaseInForm = () =>
  import('#/views/erp/purchase/in/modules/form.vue');
const PurchaseInForm = defineAsyncComponent(loadPurchaseInForm);
const loadPurchaseReturnForm = () =>
  import('#/views/erp/purchase/return/modules/form.vue');
const PurchaseReturnForm = defineAsyncComponent(loadPurchaseReturnForm);
const loadPurchasePriceAdjustForm = () =>
  import('#/views/erp/purchase/priceadjust/modules/form.vue');
const PurchasePriceAdjustForm = defineAsyncComponent(
  loadPurchasePriceAdjustForm,
);
const loadSaleOrderForm = () =>
  import('#/views/erp/sale/order/modules/form.vue');
const SaleOrderForm = defineAsyncComponent(loadSaleOrderForm);
const loadSaleOutForm = () => import('#/views/erp/sale/out/modules/form.vue');
const SaleOutForm = defineAsyncComponent(loadSaleOutForm);
const loadSaleReturnForm = () =>
  import('#/views/erp/sale/return/modules/form.vue');
const SaleReturnForm = defineAsyncComponent(loadSaleReturnForm);
const loadSalePriceAdjustForm = () =>
  import('#/views/erp/sale/priceadjust/modules/form.vue');
const SalePriceAdjustForm = defineAsyncComponent(loadSalePriceAdjustForm);

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
const [PurchaseReturnModal, purchaseReturnModalApi] = useVbenModal({
  connectedComponent: PurchaseReturnForm,
  destroyOnClose: true,
});
const shouldRenderPurchaseReturn = ref(false);
const [PurchasePriceAdjustModal, purchasePriceAdjustModalApi] = useVbenModal({
  connectedComponent: PurchasePriceAdjustForm,
  destroyOnClose: true,
});
const shouldRenderPurchasePriceAdjust = ref(false);
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

type SourceModalConfig = {
  loadComponent: () => Promise<unknown>;
  modalApi: typeof purchaseOrderModalApi;
  shouldRender: Ref<boolean>;
};

const modalConfigMap: Record<number, SourceModalConfig> = {
  [STOCK_SOURCE_DOCUMENT_TYPES.PURCHASE_ORDER]: {
    loadComponent: loadPurchaseOrderForm,
    modalApi: purchaseOrderModalApi,
    shouldRender: shouldRenderPurchaseOrder,
  },
  [STOCK_SOURCE_DOCUMENT_TYPES.PURCHASE_IN]: {
    loadComponent: loadPurchaseInForm,
    modalApi: purchaseInModalApi,
    shouldRender: shouldRenderPurchaseIn,
  },
  [STOCK_SOURCE_DOCUMENT_TYPES.PURCHASE_RETURN]: {
    loadComponent: loadPurchaseReturnForm,
    modalApi: purchaseReturnModalApi,
    shouldRender: shouldRenderPurchaseReturn,
  },
  [STOCK_SOURCE_DOCUMENT_TYPES.PURCHASE_PRICE_ADJUST]: {
    loadComponent: loadPurchasePriceAdjustForm,
    modalApi: purchasePriceAdjustModalApi,
    shouldRender: shouldRenderPurchasePriceAdjust,
  },
  [STOCK_SOURCE_DOCUMENT_TYPES.SALE_ORDER]: {
    loadComponent: loadSaleOrderForm,
    modalApi: saleOrderModalApi,
    shouldRender: shouldRenderSaleOrder,
  },
  [STOCK_SOURCE_DOCUMENT_TYPES.SALE_OUT]: {
    loadComponent: loadSaleOutForm,
    modalApi: saleOutModalApi,
    shouldRender: shouldRenderSaleOut,
  },
  [STOCK_SOURCE_DOCUMENT_TYPES.SALE_RETURN]: {
    loadComponent: loadSaleReturnForm,
    modalApi: saleReturnModalApi,
    shouldRender: shouldRenderSaleReturn,
  },
  [STOCK_SOURCE_DOCUMENT_TYPES.SALE_PRICE_ADJUST]: {
    loadComponent: loadSalePriceAdjustForm,
    modalApi: salePriceAdjustModalApi,
    shouldRender: shouldRenderSalePriceAdjust,
  },
};

async function open(sourceType?: number, sourceId?: number) {
  if (!canNavigateStockSourceDocument(sourceType, sourceId)) return;
  const config = modalConfigMap[sourceType!];
  if (!config) return;

  for (const item of Object.values(modalConfigMap)) {
    item.shouldRender.value = false;
  }
  await nextTick();
  await ensureModalReady(
    config.shouldRender,
    config.modalApi,
    config.loadComponent,
  );
  config.modalApi.setData({ type: 'detail', id: sourceId }).open();
}

defineExpose({ open });
</script>

<template>
  <PurchaseOrderModal v-if="shouldRenderPurchaseOrder" />
  <PurchaseInModal v-if="shouldRenderPurchaseIn" />
  <PurchaseReturnModal v-if="shouldRenderPurchaseReturn" />
  <PurchasePriceAdjustModal v-if="shouldRenderPurchasePriceAdjust" />
  <SaleOrderModal v-if="shouldRenderSaleOrder" />
  <SaleOutModal v-if="shouldRenderSaleOut" />
  <SaleReturnModal v-if="shouldRenderSaleReturn" />
  <SalePriceAdjustModal v-if="shouldRenderSalePriceAdjust" />
</template>
