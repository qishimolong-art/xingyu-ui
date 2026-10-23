<script lang="ts" setup>
import type { ErpProductApi } from '#/api/erp/product/product';

import { ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import StockDistribution from './tabs/stock-distribution.vue';

const emit = defineEmits(['success']);

const product = ref<ErpProductApi.Product | null>(null);

const [Modal, modalApi] = useVbenModal({
  async onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      product.value = null;
      return;
    }
    product.value = modalApi.getData<ErpProductApi.Product>();
  },
});

function handleSuccess() {
  emit('success');
}
</script>

<template>
  <Modal
    :show-confirm-button="false"
    :title="`库存分发 - ${product?.name ?? ''}`.trim()"
    class="w-[860px]"
  >
    <StockDistribution
      v-if="product"
      :value="product"
      @success="handleSuccess"
    />
  </Modal>
</template>
