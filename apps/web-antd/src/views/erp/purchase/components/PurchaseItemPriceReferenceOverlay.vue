<script lang="ts" setup>
import ItemPriceReferenceOverlay from '#/views/erp/components/ItemPriceReferenceOverlay.vue';

defineOptions({ name: 'PurchaseItemPriceReferenceOverlay' });
</script>

<template>
  <ItemPriceReferenceOverlay v-bind="$attrs" />
</template>
