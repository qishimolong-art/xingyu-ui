<script lang="ts" setup>
import { computed } from 'vue';

import { Alert, Tag, Typography } from 'ant-design-vue';

interface PurchaseImportFailureDetail {
  orderNo?: string;
  productCode?: string;
  reason?: string;
  rowNo?: number;
}

interface PurchaseImportResult {
  successCount?: number;
  failureCount?: number;
  failureDetails?: PurchaseImportFailureDetail[];
}

const props = defineProps<{
  documentName: string;
  result: PurchaseImportResult;
}>();

const failureDetails = computed(() => props.result.failureDetails ?? []);
const hasFailureDetails = computed(() => failureDetails.value.length > 0);
</script>

<template>
  <div
    class="rounded border p-3"
    :class="hasFailureDetails ? 'bg-red-50' : 'bg-green-50'"
  >
    <Typography.Title :level="5" class="!mb-2">导入结果</Typography.Title>
    <div class="space-y-1 text-sm">
      <div>
        <Tag color="green">成功</Tag>
        {{ result.successCount ?? 0 }} 张
      </div>
      <div>
        <Tag :color="hasFailureDetails ? 'red' : 'default'">失败</Tag>
        {{ result.failureCount ?? 0 }} 行
      </div>
    </div>
    <Alert
      v-if="hasFailureDetails"
      class="mt-3"
      type="warning"
      show-icon
      :message="`部分${documentName}导入失败，请下载错误数据，修正后重新选择文件导入。`"
    />
    <div v-if="hasFailureDetails" class="mt-3">
      <div class="mb-2 font-medium text-red-600">失败原因</div>
      <div class="max-h-40 overflow-auto rounded bg-white p-2 text-xs">
        <div
          v-for="(item, index) in failureDetails.slice(0, 10)"
          :key="index"
          class="mb-1 text-red-600 last:mb-0"
        >
          <span v-if="item.rowNo != null">第{{ item.rowNo }}行</span>
          <span v-if="item.orderNo">（{{ item.orderNo }}）</span>
          <span v-if="item.productCode"> {{ item.productCode }}</span>
          ：{{ item.reason || '未知错误' }}
        </div>
      </div>
    </div>
  </div>
</template>
