<script setup lang="ts">
import BusinessReportShell from '#/views/erp/report/components/business-report-shell.vue';
import BusinessReportStatusBoard from '#/views/erp/report/components/business-report-status-board.vue';

defineOptions({ name: 'ErpReportOverview' });
</script>

<template>
  <BusinessReportShell title="经营报表" body-scrollable>
    <BusinessReportStatusBoard />
  </BusinessReportShell>
</template>
