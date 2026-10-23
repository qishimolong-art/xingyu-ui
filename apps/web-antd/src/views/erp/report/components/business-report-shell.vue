<script setup lang="ts">
import { Page } from '@vben/common-ui';

import { Alert } from 'ant-design-vue';

withDefaults(
  defineProps<{
    bodyScrollable?: boolean;
    denied?: boolean;
    noPermissionMessage?: string;
    notices?: Array<{
      description?: string;
      status?: string;
      title: string;
    }>;
    title?: string;
  }>(),
  {
    bodyScrollable: false,
    denied: false,
    noPermissionMessage: '没有该经营报表查询权限',
    notices: () => [],
    title: '',
  },
);
</script>

<template>
  <Page
    auto-content-height
    class="erp-business-report-shell-layout"
    content-class="erp-business-report-shell-page"
  >
    <section class="erp-business-report-shell">
      <div
        v-if="title || $slots.actions"
        class="erp-business-report-shell__header"
      >
        <span v-if="title" class="erp-business-report-shell__title">{{
          title
        }}</span>
        <div v-if="$slots.actions" class="erp-business-report-shell__actions">
          <slot name="actions"></slot>
        </div>
      </div>
      <div v-if="notices.length > 0" class="erp-business-report-shell__notices">
        <div
          v-for="notice in notices"
          :key="notice.title"
          class="erp-business-report-shell__notice"
        >
          <div class="erp-business-report-shell__notice-title">
            {{ notice.title }}
          </div>
          <div
            v-if="notice.status"
            class="erp-business-report-shell__notice-status"
          >
            {{ notice.status }}
          </div>
          <p v-if="notice.description">{{ notice.description }}</p>
        </div>
      </div>
      <Alert
        v-if="denied"
        type="info"
        :message="noPermissionMessage"
        show-icon
      />
      <div
        v-else
        class="erp-business-report-shell__body"
        :class="{
          'erp-business-report-shell__body--scrollable': bodyScrollable,
        }"
      >
        <slot></slot>
      </div>
    </section>
  </Page>
</template>

<style scoped>
:global(.erp-business-report-shell-layout) {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

:global(.erp-business-report-shell-page) {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  height: 100%;
  min-height: min(640px, max(360px, calc(100vh - 188px)));
  overflow: hidden;
}

:global(.erp-business-report-shell-page > .erp-business-report-shell) {
  flex: 1 1 auto;
}

.erp-business-report-shell {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.erp-business-report-shell__header {
  display: flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.erp-business-report-shell__title {
  font-size: 18px;
  font-weight: 600;
  line-height: 32px;
}

.erp-business-report-shell__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}

.erp-business-report-shell__notices {
  display: grid;
  flex: 0 0 auto;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 8px;
}

.erp-business-report-shell__notice {
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid hsl(var(--border));
  border-radius: 8px;
  background: hsl(var(--card));
}

.erp-business-report-shell__notice-title {
  font-weight: 600;
}

.erp-business-report-shell__notice-status {
  display: inline-block;
  margin: 6px 0;
  padding: 1px 8px;
  color: hsl(var(--primary));
  border: 1px solid hsl(var(--primary) / 30%);
  border-radius: 999px;
  font-size: 12px;
}

.erp-business-report-shell__notice p {
  margin: 0;
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  line-height: 1.6;
}

.erp-business-report-shell__body {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.erp-business-report-shell__body--scrollable {
  overflow-x: hidden;
  overflow-y: auto;
}

.erp-business-report-shell__body :deep(.erp-business-report-tabs) {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
}

.erp-business-report-shell__body
  :deep(.erp-business-report-tabs > .ant-tabs-content-holder) {
  flex: 1 1 auto;
  min-height: 0;
}

.erp-business-report-shell__body
  :deep(
    .erp-business-report-tabs > .ant-tabs-content-holder > .ant-tabs-content
  ) {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.erp-business-report-shell__body
  :deep(.erp-business-report-tabs .ant-tabs-tabpane-active) {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

@media (max-width: 1280px) {
  .erp-business-report-shell__notices {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
