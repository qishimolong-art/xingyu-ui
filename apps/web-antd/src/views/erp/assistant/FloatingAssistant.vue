<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { useAccess } from '@vben/access';
import { IconifyIcon } from '@vben/icons';

import { useMediaQuery } from '@vueuse/core';
import { Button, Drawer, Tooltip } from 'ant-design-vue';

import AssistantPanel from './AssistantPanel.vue';

defineOptions({ name: 'ErpFloatingAssistant' });

const { hasAccessByCodes } = useAccess();
const route = useRoute();
const router = useRouter();
const open = ref(false);
const initialized = ref(false);
const busy = ref(false);
const narrowScreen = useMediaQuery('(max-width: 680px)');
const drawerWidth = computed(() => (narrowScreen.value ? '100vw' : 620));
const visible = computed(
  () =>
    hasAccessByCodes(['erp:assistant:query']) &&
    !route.path.startsWith('/erp/assistant'),
);

function openAssistant() {
  initialized.value = true;
  open.value = true;
}

async function openFullPage() {
  open.value = false;
  await router.push('/erp/assistant');
}

watch(visible, (value) => {
  if (!value) {
    open.value = false;
    initialized.value = false;
  }
});
</script>

<template>
  <Tooltip v-if="visible" placement="left" title="智能问数">
    <Button
      class="assistant-float-button"
      data-testid="erp-assistant-float-button"
      shape="circle"
      size="large"
      type="primary"
      aria-label="打开智能问数"
      @click="openAssistant"
    >
      <IconifyIcon
        :icon="busy ? 'lucide:loader-circle' : 'lucide:bot'"
        class="assistant-float-icon"
        :class="{ 'assistant-float-icon--busy': busy }"
      />
    </Button>
  </Tooltip>

  <Drawer
    v-if="initialized && visible"
    v-model:open="open"
    :body-style="{ height: '100%', overflow: 'hidden', padding: '16px' }"
    :destroy-on-close="false"
    :width="drawerWidth"
    class="assistant-float-drawer"
    title="智能问数"
  >
    <AssistantPanel
      :active="open"
      :current-page="route.fullPath"
      mode="drawer"
      @busy-change="busy = $event"
      @open-full-page="openFullPage"
    />
  </Drawer>
</template>

<style scoped>
.assistant-float-button {
  position: fixed;
  right: 18px;
  bottom: 32%;
  z-index: 900;
  width: 52px;
  height: 52px;
  box-shadow: 0 8px 24px rgb(0 0 0 / 22%);
}

.assistant-float-icon {
  width: 24px;
  height: 24px;
}

.assistant-float-icon--busy {
  animation: assistant-spin 1s linear infinite;
}

@keyframes assistant-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 680px) {
  .assistant-float-button {
    right: 12px;
    bottom: 24%;
    width: 48px;
    height: 48px;
  }
}
</style>
