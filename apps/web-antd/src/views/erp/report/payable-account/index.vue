<script lang="ts" setup>
import PayableAccountPage from '../../finance/payable/account/index.vue';

defineOptions({ name: 'ErpPayableAccountReport' });
</script>

<template>
  <PayableAccountPage :candidate-focus-highlight="false" />
</template>
