<script lang="ts" setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { useAccessStore } from '@vben/stores';

import { buildPrintTemplateAuthPayload } from '#/views/erp/utils/print-template-auth';

interface PurchasePrintTemplateModalData {
  moduleKey?: string;
  moduleName?: string;
  businessId?: number | string;
  businessNo?: string;
  templateId?: number | string;
}

const emit = defineEmits<{ printed: [] }>();

const modalData = ref<PurchasePrintTemplateModalData>({});
const frameRef = ref<HTMLIFrameElement>();
const accessStore = useAccessStore();
const cacheVersion = import.meta.env.DEV
  ? `&t=${Date.now()}`
  : '&v=20261016-first-page-header-pagination-sale-cart-item-sort-print-amount-two-decimals';

const moduleKey = computed(() => modalData.value.moduleKey || 'purchase_order');
const moduleName = computed(() => modalData.value.moduleName || '采购订单');
const title = computed(() =>
  modalData.value.businessNo
    ? `${moduleName.value}打印：${modalData.value.businessNo}`
    : `${moduleName.value}打印模板设计`,
);

const templateUrl = computed(() => {
  const params = new URLSearchParams({
    moduleKey: moduleKey.value,
    templateName: '默认模板',
  });
  if (modalData.value.businessId) {
    params.set('businessId', String(modalData.value.businessId));
    params.set('mode', 'print');
  } else {
    params.set('mode', 'design');
  }
  if (modalData.value.businessNo) {
    params.set('businessNo', modalData.value.businessNo);
  }
  if (modalData.value.templateId) {
    params.set('templateId', String(modalData.value.templateId));
  }
  return `/static/erp/purchase-print-template.html?${params.toString()}${cacheVersion}`;
});

const [Modal, modalApi] = useVbenModal({
  footer: false,
  onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      modalData.value = {};
      return;
    }
    modalData.value =
      (modalApi.getData() as PurchasePrintTemplateModalData | undefined) ?? {};
  },
});

function postFrameAuth() {
  if (!accessStore.accessToken) return;
  frameRef.value?.contentWindow?.postMessage(
    {
      payload: buildPrintTemplateAuthPayload(accessStore),
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
  () => [accessStore.accessToken, accessStore.accessCodes],
  () => postFrameAuth(),
  { deep: true },
);
</script>

<template>
  <Modal
    :title="title"
    class="purchase-print-template-modal"
    content-class="purchase-print-template-content"
  >
    <iframe
      ref="frameRef"
      :key="templateUrl"
      :src="templateUrl"
      class="purchase-print-template-frame"
      @load="postFrameAuth"
      :title="title"
    ></iframe>
  </Modal>
</template>

<style scoped>
:global(.purchase-print-template-modal) {
  height: min(880px, calc(100vh - 32px));
  width: min(1600px, calc(100vw - 32px)) !important;
}

:global(.purchase-print-template-content) {
  min-height: 0;
  padding: 0;
  overflow: hidden;
}

.purchase-print-template-frame {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 0;
  border: 0;
  background: #fff;
}
</style>
