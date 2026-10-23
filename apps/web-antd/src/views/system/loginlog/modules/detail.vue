<script lang="ts" setup>
import type { SystemLoginLogApi } from '#/api/system/login-log';

import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { useDescription } from '#/components/description';

import { useDetailSchema } from '../data';

const formData = ref<SystemLoginLogApi.LoginLog>();
const hasDetailData = computed(() => Boolean(formData.value?.id));

const [Descriptions] = useDescription({
  bordered: true,
  column: { lg: 2, md: 2, sm: 1, xl: 2, xs: 1, xxl: 2 },
  schema: useDetailSchema(),
  size: 'small',
  useCard: false,
});

const [Modal, modalApi] = useVbenModal({
  onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      formData.value = undefined;
      return;
    }
    // 加载数据
    const data = modalApi.getData<SystemLoginLogApi.LoginLog>();
    if (!data || !data.id) {
      formData.value = undefined;
      return;
    }
    formData.value = data;
  },
});
</script>

<template>
  <Modal
    title="登录日志详情"
    class="login-log-detail-modal !w-[min(900px,calc(100vw-24px))]"
    :show-cancel-button="false"
    :show-confirm-button="false"
  >
    <div v-if="hasDetailData" class="login-log-detail">
      <div class="login-log-detail__section-title">日志信息</div>
      <Descriptions :data="formData" />
    </div>
    <div v-else class="login-log-detail__empty">
      未获取到登录日志详情，请关闭后重试。
    </div>
  </Modal>
</template>

<style scoped>
.login-log-detail,
.login-log-detail__empty {
  font-size: 12px;
}

.login-log-detail__section-title {
  margin-bottom: 8px;
  font-size: 13px;
  font-weight: 600;
  color: hsl(var(--foreground));
}

.login-log-detail__empty {
  padding: 32px 16px;
  color: hsl(var(--muted-foreground));
  text-align: center;
}

.login-log-detail :deep(.ant-descriptions) {
  font-size: 12px !important;
}

.login-log-detail :deep(.ant-descriptions-item-label) {
  width: 112px;
  min-width: 112px;
  font-size: 12px !important;
  color: hsl(var(--muted-foreground));
  white-space: nowrap;
}

.login-log-detail :deep(.ant-descriptions-item-content) {
  min-width: 0;
  font-size: 12px !important;
  line-height: 20px;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
</style>
