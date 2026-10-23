<script lang="ts" setup>
import type { SystemOperateLogApi } from '#/api/system/operate-log';

import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';

import { useDescription } from '#/components/description';

import { useDetailSchema } from '../data';

const formData = ref<SystemOperateLogApi.OperateLog>();
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
    const data = modalApi.getData<SystemOperateLogApi.OperateLog>();
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
    title="操作日志详情"
    class="operate-log-detail-modal !w-[min(900px,calc(100vw-24px))]"
    :show-cancel-button="false"
    :show-confirm-button="false"
  >
    <div v-if="hasDetailData" class="operate-log-detail">
      <div class="operate-log-detail__section-title">日志信息</div>
      <Descriptions :data="formData" />
    </div>
    <div v-else class="operate-log-detail__empty">
      未获取到操作日志详情，请关闭后重试。
    </div>
  </Modal>
</template>

<style scoped>
.operate-log-detail,
.operate-log-detail__empty {
  font-size: 12px;
}

.operate-log-detail__section-title {
  margin-bottom: 8px;
  color: hsl(var(--foreground));
  font-size: 13px;
  font-weight: 600;
}

.operate-log-detail__empty {
  padding: 32px 16px;
  color: hsl(var(--muted-foreground));
  text-align: center;
}

.operate-log-detail :deep(.ant-descriptions) {
  font-size: 12px !important;
}

.operate-log-detail :deep(.ant-descriptions-item-label) {
  width: 112px;
  min-width: 112px;
  color: hsl(var(--muted-foreground));
  font-size: 12px !important;
  white-space: nowrap;
}

.operate-log-detail :deep(.ant-descriptions-item-content) {
  min-width: 0;
  font-size: 12px !important;
  line-height: 20px;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}
</style>
