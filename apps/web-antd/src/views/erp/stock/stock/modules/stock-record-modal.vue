<script lang="ts" setup>
import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import StockRecordTab from '#/views/erp/stock/record/modules/stock-record-tab.vue';

interface ModalData {
  productId: number;
  productCode?: string;
  productName?: string;
  warehouseId: number;
  warehouseName?: string;
  batchRow?: boolean;
  batchNo?: string;
}

const modalData = ref<ModalData>();

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
  return ['库存流水明细', productLabel, warehouseLabel, batchLabel]
    .filter(Boolean)
    .join(' - ');
});

const initialParams = computed(() => ({
  productId: modalData.value?.productId,
  stockView: true,
  warehouseId: modalData.value?.warehouseId,
  batchNo: modalData.value?.batchNo,
  unassignedBatch:
    modalData.value?.batchRow === true && !modalData.value?.batchNo,
}));

const [Modal, modalApi] = useVbenModal({
  onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      modalData.value = undefined;
      return;
    }
    modalApi.setState({ fullscreen: true });
    modalData.value = modalApi.getData<ModalData>();
  },
});
</script>

<template>
  <Modal
    :title="title"
    class="!w-full"
    content-class="p-0"
    :show-confirm-button="false"
  >
    <div class="stock-record-detail-modal">
      <StockRecordTab
        v-if="modalData?.productId && modalData?.warehouseId"
        fixed-height
        :initial-params="initialParams"
        scene="stockDetailModal"
        table-title="库存流水明细"
      />
    </div>
  </Modal>
</template>

<style scoped>
.stock-record-detail-modal {
  height: calc(100vh - 72px);
  min-height: 0;
  padding: 12px;
  overflow: hidden;
  background: hsl(var(--muted) / 28%);
}
</style>
