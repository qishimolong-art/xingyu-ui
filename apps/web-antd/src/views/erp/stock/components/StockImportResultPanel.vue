<script lang="ts" setup>
import { computed } from 'vue';

import { Alert, Button, Tag, Typography } from 'ant-design-vue';

interface StockImportFailureItem {
  rowNo?: number;
  orderNo?: string;
  code?: string;
  reason?: string;
}

interface StockImportResult {
  recordId?: number;
  successCount?: number;
  createCount?: number;
  updateCount?: number;
  failureCount?: number;
  failureDetails?: Array<Record<string, any> | string>;
}

const props = withDefaults(
  defineProps<{
    result: StockImportResult;
    unit?: string;
    showUpdateCount?: boolean;
    canDownloadFailureDetails?: boolean;
  }>(),
  {
    unit: '张',
    showUpdateCount: false,
    canDownloadFailureDetails: false,
  },
);

const emit = defineEmits<{
  downloadFailureDetails: [];
}>();

const failureDetails = computed<StockImportFailureItem[]>(() => {
  return (props.result.failureDetails ?? []).map((item) =>
    typeof item === 'string' ? { reason: item } : item,
  );
});

const hasImportFailures = computed(() => (props.result.failureCount ?? 0) > 0);
const hasFailureDetails = computed(() => failureDetails.value.length > 0);
</script>

<template>
  <div
    class="rounded border p-3"
    :class="hasImportFailures ? 'bg-red-50' : 'bg-green-50'"
  >
    <Typography.Title :level="5" class="!mb-2">导入结果</Typography.Title>
    <div class="space-y-1 text-sm">
      <div>
        <Tag color="green">成功</Tag>
        {{ result.successCount ?? 0 }} {{ unit }}
      </div>
      <div>
        <Tag color="blue">新增</Tag>
        {{ result.createCount ?? 0 }} {{ unit }}
      </div>
      <div v-if="showUpdateCount">
        <Tag color="cyan">更新</Tag>
        {{ result.updateCount ?? 0 }} {{ unit }}
      </div>
      <div>
        <Tag :color="hasImportFailures ? 'red' : 'default'">失败</Tag>
        {{ result.failureCount ?? 0 }} {{ unit }}
      </div>
    </div>
    <Alert
      v-if="hasImportFailures"
      class="mt-3"
      type="warning"
      show-icon
      message="部分数据导入失败，请下载错误数据，修正后重新选择文件导入。"
    />
    <div v-if="hasImportFailures" class="mt-3 flex flex-wrap gap-2">
      <Button
        v-if="canDownloadFailureDetails"
        danger
        ghost
        @click="emit('downloadFailureDetails')"
      >
        下载错误数据
      </Button>
    </div>
    <div v-if="hasFailureDetails" class="mt-3">
      <div class="mb-2 font-medium text-red-600">失败原因</div>
      <div class="max-h-40 overflow-auto rounded bg-white p-2 text-xs">
        <div
          v-for="(item, index) in failureDetails"
          :key="index"
          class="mb-1 text-red-600 last:mb-0"
        >
          <span v-if="item.rowNo != null">第{{ item.rowNo }}行</span>
          <span v-if="item.orderNo">（{{ item.orderNo }}）</span>
          <span v-if="item.code">（{{ item.code }}）</span>
          ：{{ item.reason || '未知错误' }}
        </div>
      </div>
    </div>
  </div>
</template>
