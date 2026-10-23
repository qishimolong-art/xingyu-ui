<script lang="ts" setup>
import { computed } from 'vue';
import { useRoute } from 'vue-router';

import { DocAlert, Page } from '@vben/common-ui';

import StockRecordTab from './modules/stock-record-tab.vue';

defineOptions({ name: 'ErpStockRecord' });

const route = useRoute();

function parseQueryNumber(value: unknown) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return undefined;
  }

  const numberValue = Number(rawValue);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

const initialParams = computed(() => {
  if (route.query.source !== 'stock') {
    return {};
  }
  return {
    productId: parseQueryNumber(route.query.productId),
    warehouseId: parseQueryNumber(route.query.warehouseId),
  };
});
</script>

<template>
  <Page
    auto-content-height
    class="stock-record-report-page"
    content-class="stock-record-report-page__content"
  >
    <template #doc>
      <DocAlert
        title="【库存】进出流水明细账"
        url="https://doc.iocoder.cn/erp/stock/"
      />
    </template>

    <StockRecordTab fixed-height :initial-params="initialParams" />
  </Page>
</template>

<style scoped>
:global(.stock-record-report-page) {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

:global(.stock-record-report-page__content) {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  height: 100%;
  min-height: min(640px, max(360px, calc(100vh - 188px)));
  overflow: hidden;
}
</style>
