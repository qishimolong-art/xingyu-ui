<script lang="ts" setup>
import type { ErpStockApi } from '#/api/erp/stock/stock';

import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { getStockPendingInDetails } from '#/api/erp/stock/stock';
import PurchaseInForm from '#/views/erp/purchase/in/modules/form.vue';
import SaleReturnForm from '#/views/erp/sale/return/modules/form.vue';
import StockCheckForm from '#/views/erp/stock/check/modules/form.vue';
import StockInForm from '#/views/erp/stock/in/modules/form.vue';
import StockInBillDetail from '#/views/erp/stock/inbill/modules/detail-modal.vue';
import StockTransferInForm from '#/views/erp/stock/transfer-in/modules/form.vue';
import WarehouseMoveForm from '#/views/erp/stock/warehouse-move/modules/form.vue';

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
const details = ref<ErpStockApi.StockPendingInDetail[]>([]);
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
  return ['未入明细', productLabel, warehouseLabel, batchLabel]
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
      loadError.value = '未入明细参数无效，请关闭后重试';
      return;
    }
    modalData.value = data;
    loading.value = true;
    try {
      const result = await getStockPendingInDetails({
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
        loadError.value = '未入明细加载失败，请关闭后重试';
        details.value = [];
      }
    } finally {
      if (sequence === loadSequence) {
        loading.value = false;
      }
    }
  },
});

const [PurchaseInModal, purchaseInModalApi] = useVbenModal({
  connectedComponent: PurchaseInForm,
  destroyOnClose: true,
});

const [StockCheckModal, stockCheckModalApi] = useVbenModal({
  connectedComponent: StockCheckForm,
  destroyOnClose: true,
});

const [SaleReturnModal, saleReturnModalApi] = useVbenModal({
  connectedComponent: SaleReturnForm,
  destroyOnClose: true,
});
const [StockInModal, stockInModalApi] = useVbenModal({
  connectedComponent: StockInForm,
  destroyOnClose: true,
});
const [StockTransferInModal, stockTransferInModalApi] = useVbenModal({
  connectedComponent: StockTransferInForm,
  destroyOnClose: true,
});
const [WarehouseMoveModal, warehouseMoveModalApi] = useVbenModal({
  connectedComponent: WarehouseMoveForm,
  destroyOnClose: true,
});
const [StockInBillModal, stockInBillModalApi] = useVbenModal({
  connectedComponent: StockInBillDetail,
  destroyOnClose: true,
});

function handleDocumentDetail(record: ErpStockApi.StockPendingInDetail) {
  if (record.documentId && record.documentType) {
    const modalMap = {
      PURCHASE_IN: purchaseInModalApi,
      SALE_RETURN: saleReturnModalApi,
      STOCK_CHECK: stockCheckModalApi,
      STOCK_IN: stockInModalApi,
      STOCK_TRANSFER_IN: stockTransferInModalApi,
      WAREHOUSE_MOVE: warehouseMoveModalApi,
    } as const;
    if (record.documentType === 'STOCK_IN_BILL') {
      stockInBillModalApi
        .setData({ id: record.documentId, mode: 'detail' })
        .open();
      return;
    }
    modalMap[record.documentType]
      ?.setData({ type: 'detail', id: record.documentId })
      .open();
    return;
  }
  if (record.checkId) {
    stockCheckModalApi.setData({ type: 'detail', id: record.checkId }).open();
  } else if (record.inId) {
    purchaseInModalApi.setData({ type: 'detail', id: record.inId }).open();
  }
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
  <PurchaseInModal />
  <StockCheckModal />
  <SaleReturnModal />
  <StockInModal />
  <StockTransferInModal />
  <WarehouseMoveModal />
  <StockInBillModal />
</template>
