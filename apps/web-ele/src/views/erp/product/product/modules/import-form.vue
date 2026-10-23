<script lang="ts" setup>
import type { UploadProps } from 'element-plus';

import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { downloadFileFromBlobPart } from '@vben/utils';

import { ElAlert, ElButton, ElMessage, ElTag, ElUpload } from 'element-plus';

import type { ErpProductApi } from '#/api/erp/product/product';
import {
  getProductImportTemplate,
  importProduct,
} from '#/api/erp/product/product';

const emit = defineEmits(['success']);

const uploadFile = ref<File | null>(null);
const importResult = ref<ErpProductApi.ProductImportResult | null>(null);

const failureDetails = computed(() => {
  return (importResult.value?.failureDetails ?? []).map((item) =>
    typeof item === 'string' ? { reason: item } : item,
  );
});

const hasFailureDetails = computed(() => failureDetails.value.length > 0);

function buildImportResultMessage(result?: {
  successCount?: number;
  failureCount?: number;
  createCount?: number;
  updateCount?: number;
}) {
  if (!result) {
    return '导入成功';
  }
  return [
    `成功 ${result.successCount ?? 0} 条`,
    typeof result.createCount === 'number'
      ? `新增 ${result.createCount} 条`
      : '',
    typeof result.updateCount === 'number'
      ? `更新 ${result.updateCount} 条`
      : '',
    `失败 ${result.failureCount ?? 0} 条`,
  ]
    .filter(Boolean)
    .join('，');
}

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    if (importResult.value) {
      await modalApi.close();
      return;
    }
    if (!uploadFile.value) {
      ElMessage.warning('请先选择导入文件');
      return;
    }
    modalApi.lock();
    try {
      const result = await importProduct(uploadFile.value);
      importResult.value = result;
      emit('success');
      if ((result?.failureCount ?? 0) > 0) {
        ElMessage.warning(buildImportResultMessage(result));
        return;
      }
      await modalApi.close();
      ElMessage.success(buildImportResultMessage(result));
    } finally {
      modalApi.unlock();
    }
  },
  onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      uploadFile.value = null;
      importResult.value = null;
    }
  },
});

const beforeUpload: UploadProps['beforeUpload'] = (file) => {
  uploadFile.value = file;
  importResult.value = null;
  return false;
};

async function handleDownload() {
  const data = await getProductImportTemplate();
  downloadFileFromBlobPart({ fileName: '产品导入模板.xls', source: data });
}
</script>

<template>
  <Modal title="导入产品" class="w-1/3">
    <div class="mx-4 my-4 space-y-4">
      <p class="mb-4 text-gray-500">
        支持上传 Excel 或 CSV 文件，系统会根据产品编码执行新增或更新。
      </p>
      <ElUpload
        :limit="1"
        accept=".xls,.xlsx,.csv"
        :before-upload="beforeUpload"
        :auto-upload="false"
      >
        <ElButton type="primary">选择导入文件</ElButton>
      </ElUpload>
      <div
        v-if="importResult"
        class="rounded border p-3"
        :class="hasFailureDetails ? 'bg-red-50' : 'bg-green-50'"
      >
        <div class="mb-2 text-base font-medium">导入结果</div>
        <div class="space-y-1 text-sm">
          <div>
            <ElTag type="success">成功</ElTag>
            <span class="ml-2">{{ importResult.successCount ?? 0 }} 条</span>
          </div>
          <div>
            <ElTag type="primary">新增</ElTag>
            <span class="ml-2">{{ importResult.createCount ?? 0 }} 条</span>
          </div>
          <div>
            <ElTag type="info">更新</ElTag>
            <span class="ml-2">{{ importResult.updateCount ?? 0 }} 条</span>
          </div>
          <div>
            <ElTag :type="hasFailureDetails ? 'danger' : 'info'">失败</ElTag>
            <span class="ml-2">{{ importResult.failureCount ?? 0 }} 条</span>
          </div>
        </div>
        <ElAlert
          v-if="hasFailureDetails"
          class="mt-3"
          type="warning"
          :closable="false"
          title="部分数据导入失败，请查看失败原因并修正后重新导入。"
        />
        <div v-if="hasFailureDetails" class="mt-3">
          <div class="mb-2 font-medium text-red-600">失败原因</div>
          <div class="max-h-40 overflow-auto rounded bg-white p-2 text-xs">
            <div
              v-for="(item, index) in failureDetails"
              :key="index"
              class="mb-1 text-red-600 last:mb-0"
            >
              <span v-if="item.rowNo != null">第{{ item.rowNo }}行</span>
              <span v-if="item.code">（{{ item.code }}）</span>
              ：{{ item.reason || '未知错误' }}
            </div>
          </div>
        </div>
      </div>
    </div>
    <template #prepend-footer>
      <div class="flex flex-auto items-center">
        <ElButton @click="handleDownload">下载导入模板</ElButton>
      </div>
    </template>
    <template #confirmText>
      {{ importResult ? '关闭' : '开始导入' }}
    </template>
  </Modal>
</template>
