<script lang="ts" setup>
import { provideReportViewOnly } from '../components/report-view-only';
import ReceivableAccountPage from '../../finance/receivable/account/index.vue';

defineOptions({ name: 'ErpReceivableAccountReport' });

provideReportViewOnly();
</script>

<template>
  <ReceivableAccountPage :candidate-focus-highlight="false" report-mode />
</template>
