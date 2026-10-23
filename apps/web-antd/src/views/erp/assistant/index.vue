<script setup lang="ts">
import { Page } from '@vben/common-ui';

import AssistantPanel from './AssistantPanel.vue';

defineOptions({ name: 'ErpAssistant' });
</script>

<template>
  <Page auto-content-height title="智能问数">
    <AssistantPanel mode="page" />
  </Page>
</template>
