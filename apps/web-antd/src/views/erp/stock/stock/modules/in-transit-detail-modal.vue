<script lang="ts" setup>
import type { ErpStockApi } from '#/api/erp/stock/stock';

import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { getStockInTransitDetails } from '#/api/erp/stock/stock';
import PurchaseOrderForm from '#/views/erp/purchase/order/modules/form.vue';

import StockQuantityDetailTable from './stock-quantity-detail-table.vue';

interface ModalData {
  batchNo?: string;
  batchRow?: boolean;
  productId: number;
  productCode?: string;
  productName?: string;
  warehouseId: number;
  warehouseName?: string;
}

const loading = ref(false);
const loadError = ref('');
const modalData = ref<ModalData>();
const details = ref<ErpStockApi.StockInTransitDetail[]>([]);
let loadSequence = 0;

const title = computed(() => {
  const productLabel = [
    modalData.value?.productCode,
    modalData.value?.productName,
  ]
    .filter(Boolean)
    .join(' ');
  const warehouseLabel = modalData.value?.warehouseName;
  const batchLabel = modalData.value?.batchRow
    ? `批次：${modalData.value.batchNo || '未指定批次'}`
    : undefined;
  return ['在途明细', productLabel, warehouseLabel, batchLabel]
    .filter(Boolean)
    .join(' - ');
});

const [Modal, modalApi] = useVbenModal({
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      loadSequence += 1;
      loading.value = false;
      loadError.value = '';
      modalData.value = undefined;
      details.value = [];
      return;
    }
    const data = modalApi.getData<ModalData>();
    const sequence = ++loadSequence;
    modalApi.setState({ fullscreen: true });
    loadError.value = '';
    details.value = [];
    if (!data?.productId || !data?.warehouseId) {
      loadError.value = '在途明细参数无效，请关闭后重试';
      return;
    }
    modalData.value = data;
    loading.value = true;
    try {
      const result = await getStockInTransitDetails({
        decimalMode: 'string',
        productId: data.productId,
        warehouseId: data.warehouseId,
        batchNo: data.batchNo,
        unassignedBatch: data.batchRow === true && !data.batchNo,
      });
      if (sequence !== loadSequence) return;
      details.value = result ?? [];
    } catch {
      if (sequence === loadSequence) {
        loadError.value = '在途明细加载失败，请关闭后重试';
        details.value = [];
      }
    } finally {
      if (sequence === loadSequence) {
        loading.value = false;
      }
    }
  },
});

const [PurchaseOrderModal, purchaseOrderModalApi] = useVbenModal({
  connectedComponent: PurchaseOrderForm,
  destroyOnClose: true,
});

function handleDocumentDetail(record: ErpStockApi.StockInTransitDetail) {
  if (!record.orderId) return;
  purchaseOrderModalApi.setData({ type: 'detail', id: record.orderId }).open();
}
</script>

<template>
  <Modal
    :title="title"
    class="!w-full"
    content-class="p-0"
    :show-confirm-button="false"
  >
    <StockQuantityDetailTable
      :error="loadError"
      :loading="loading"
      :rows="details"
      @open-document="handleDocumentDetail"
    />
  </Modal>
  <PurchaseOrderModal />
</template>
