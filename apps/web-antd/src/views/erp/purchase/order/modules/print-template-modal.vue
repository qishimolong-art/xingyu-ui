<script lang="ts" setup>
import type { ErpPurchaseOrderApi } from '#/api/erp/purchase/order';

import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { useAccessStore } from '@vben/stores';

interface PrintTemplateModalData {
  order?: ErpPurchaseOrderApi.PurchaseOrder;
  templateId?: number | string;
}

const modalData = ref<PrintTemplateModalData>({});
const order = computed(() => modalData.value.order);
const frameRef = ref<HTMLIFrameElement>();
const accessStore = useAccessStore();
const cacheVersion = import.meta.env.DEV
  ? `&t=${Date.now()}`
  : '&v=20261016-first-page-header-pagination-sale-cart-item-sort-print-amount-two-decimals';
const emit = defineEmits<{ printed: [] }>();

const title = computed(() =>
  order.value?.no
    ? `采购订单打印模板：${order.value.no}`
    : '采购订单打印模板设计',
);

const templateUrl = computed(() => {
  const params = new URLSearchParams({
    moduleKey: 'purchase_order',
    templateName: '默认模板',
  });
  if (order.value?.id) {
    params.set('businessId', String(order.value.id));
    params.set('mode', 'print');
  } else {
    params.set('mode', 'design');
  }
  if (order.value?.no) {
    params.set('businessNo', order.value.no);
  }
  if (modalData.value.templateId) {
    params.set('templateId', String(modalData.value.templateId));
  }
  return `/static/erp/purchase-order-print-template-demo.html?${params.toString()}${cacheVersion}`;
});

const [Modal, modalApi] = useVbenModal({
  footer: false,
  onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      modalData.value = {};
      return;
    }
    const data = modalApi.getData() as
      | ErpPurchaseOrderApi.PurchaseOrder
      | PrintTemplateModalData
      | undefined;
    modalData.value =
      data && ('order' in data || 'templateId' in data)
        ? (data as PrintTemplateModalData)
        : { order: data as ErpPurchaseOrderApi.PurchaseOrder | undefined };
  },
});

function postFrameAuth() {
  if (!accessStore.accessToken) return;
  frameRef.value?.contentWindow?.postMessage(
    {
      payload: {
        accessToken: accessStore.accessToken,
        tenantId: accessStore.tenantId,
        visitTenantId: accessStore.visitTenantId,
      },
      source: 'erp-print-template-parent',
      type: 'auth',
    },
    window.location.origin,
  );
}

function handleFrameMessage(event: MessageEvent) {
  if (event.origin !== window.location.origin) return;
  if (event.data?.source !== 'erp-print-template') return;
  if (event.data?.type === 'ready-for-auth') {
    postFrameAuth();
    return;
  }
  if (event.data?.type === 'printed') {
    emit('printed');
  }
}

onMounted(() => window.addEventListener('message', handleFrameMessage));
onBeforeUnmount(() =>
  window.removeEventListener('message', handleFrameMessage),
);
watch(
  () => accessStore.accessToken,
  () => postFrameAuth(),
);
</script>

<template>
  <Modal
    :title="title"
    class="purchase-order-print-template-modal"
    content-class="purchase-order-print-template-content"
  >
    <iframe
      ref="frameRef"
      :key="templateUrl"
      :src="templateUrl"
      class="purchase-order-print-template-frame"
      @load="postFrameAuth"
      title="采购订单打印模板设计"
    ></iframe>
  </Modal>
</template>

<style scoped>
:global(.purchase-order-print-template-modal) {
  height: min(880px, calc(100vh - 32px));
  width: min(1600px, calc(100vw - 32px)) !important;
}

:global(.purchase-order-print-template-content) {
  min-height: 0;
  padding: 0;
  overflow: hidden;
}

.purchase-order-print-template-frame {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 0;
  border: 0;
  background: #fff;
}
</style>
