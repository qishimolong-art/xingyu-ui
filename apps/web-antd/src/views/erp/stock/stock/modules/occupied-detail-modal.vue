<script lang="ts" setup>
import type { ErpStockApi } from '#/api/erp/stock/stock';

import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { getStockOccupiedDetails } from '#/api/erp/stock/stock';
import PurchaseReturnForm from '#/views/erp/purchase/return/modules/form.vue';
import SaleCartForm from '#/views/erp/sale/cart/modules/form.vue';
import SaleOutForm from '#/views/erp/sale/out/modules/form.vue';
import StockCheckForm from '#/views/erp/stock/check/modules/form.vue';
import StockMoveForm from '#/views/erp/stock/move/modules/form.vue';
import StockOutForm from '#/views/erp/stock/out/modules/form.vue';
import StockOutBillDetail from '#/views/erp/stock/outbill/modules/detail-modal.vue';
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
const details = ref<ErpStockApi.StockOccupiedDetail[]>([]);
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
  return ['占用明细', productLabel, warehouseLabel, batchLabel]
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
      loadError.value = '占用明细参数无效，请关闭后重试';
      return;
    }
    modalData.value = data;
    loading.value = true;
    try {
      const result = await getStockOccupiedDetails({
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
        loadError.value = '占用明细加载失败，请关闭后重试';
        details.value = [];
      }
    } finally {
      if (sequence === loadSequence) {
        loading.value = false;
      }
    }
  },
});

const [SaleCartModal, saleCartModalApi] = useVbenModal({
  connectedComponent: SaleCartForm,
  destroyOnClose: true,
});

const [SaleOutModal, saleOutModalApi] = useVbenModal({
  connectedComponent: SaleOutForm,
  destroyOnClose: true,
});
const [PurchaseReturnModal, purchaseReturnModalApi] = useVbenModal({
  connectedComponent: PurchaseReturnForm,
  destroyOnClose: true,
});
const [StockOutModal, stockOutModalApi] = useVbenModal({
  connectedComponent: StockOutForm,
  destroyOnClose: true,
});
const [StockMoveModal, stockMoveModalApi] = useVbenModal({
  connectedComponent: StockMoveForm,
  destroyOnClose: true,
});
const [WarehouseMoveModal, warehouseMoveModalApi] = useVbenModal({
  connectedComponent: WarehouseMoveForm,
  destroyOnClose: true,
});
const [StockCheckModal, stockCheckModalApi] = useVbenModal({
  connectedComponent: StockCheckForm,
  destroyOnClose: true,
});
const [StockOutBillModal, stockOutBillModalApi] = useVbenModal({
  connectedComponent: StockOutBillDetail,
  destroyOnClose: true,
});

function handleDocumentDetail(record: ErpStockApi.StockOccupiedDetail) {
  if (record.documentId && record.documentType) {
    const modalMap = {
      PURCHASE_RETURN: purchaseReturnModalApi,
      SALE_CART: saleCartModalApi,
      SALE_OUT: saleOutModalApi,
      STOCK_CHECK: stockCheckModalApi,
      STOCK_MOVE: stockMoveModalApi,
      STOCK_OUT: stockOutModalApi,
      WAREHOUSE_MOVE: warehouseMoveModalApi,
    } as const;
    if (record.documentType === 'STOCK_OUT_BILL') {
      stockOutBillModalApi
        .setData({ id: record.documentId, mode: 'detail' })
        .open();
      return;
    }
    modalMap[record.documentType]
      ?.setData({ type: 'detail', id: record.documentId })
      .open();
    return;
  }
  if (!record.cartId) return;
  saleCartModalApi.setData({ type: 'detail', id: record.cartId }).open();
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
  <SaleCartModal />
  <SaleOutModal />
  <PurchaseReturnModal />
  <StockOutModal />
  <StockMoveModal />
  <WarehouseMoveModal />
  <StockCheckModal />
  <StockOutBillModal />
</template>
