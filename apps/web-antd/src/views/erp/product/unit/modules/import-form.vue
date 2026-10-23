<script lang="ts" setup>
import type { FileType } from 'ant-design-vue/es/upload/interface';

import type { ErpProductUnitApi } from '#/api/erp/product/unit';

import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { downloadFileFromBlobPart } from '@vben/utils';

import {
  Alert,
  Button,
  message,
  Tag,
  Typography,
  Upload,
} from 'ant-design-vue';

import {
  getProductUnitImportTemplate,
  importProductUnit,
} from '#/api/erp/product/unit';
import ImportTemplateGuide from '#/components/import-template-guide/ImportTemplateGuide.vue';

const emit = defineEmits(['success']);

const uploadFile = ref<File | null>(null);
const importResult = ref<ErpProductUnitApi.ProductUnitImportResult | null>(
  null,
);

const failureDetails = computed(() => {
  return (importResult.value?.failureDetails ?? []).map((item) =>
    typeof item === 'string' ? { reason: item } : item,
  );
});

const hasFailureDetails = computed(() => failureDetails.value.length > 0);

function buildImportResultMessage(result?: {
  createCount?: number;
  failureCount?: number;
  successCount?: number;
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
      message.warning('请先选择导入文件');
      return;
    }
    modalApi.lock();
    try {
      const result = await importProductUnit(uploadFile.value);
      importResult.value = result;
      emit('success');
      if ((result?.failureCount ?? 0) > 0) {
        message.warning(buildImportResultMessage(result));
        return;
      }
      await modalApi.close();
      message.success(buildImportResultMessage(result));
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

function beforeUpload(file: FileType) {
  uploadFile.value = file as unknown as File;
  importResult.value = null;
  return false;
}

async function handleDownload() {
  const data = await getProductUnitImportTemplate();
  downloadFileFromBlobPart({
    fileName: '配件单位导入模板.xls',
    source: data,
  });
}
</script>

<template>
  <Modal title="导入配件单位" class="w-[640px]">
    <div class="product-unit-import-content mx-4 my-4 space-y-4">
      <ImportTemplateGuide
        summary="配件单位导入用于批量维护配件计量单位，系统会根据单位编码或名称执行新增、更新。"
        :tips="[
          '黄色表头为必填项，请按模板填写后再导入。',
          '单位编码建议保持唯一，避免不同单位使用相同编码。',
          '启用状态、排序等字段请按模板示例填写。',
        ]"
      />
      <Upload
        :max-count="1"
        accept=".xls,.xlsx,.csv"
        :before-upload="beforeUpload"
      >
        <Button type="primary">选择导入文件</Button>
      </Upload>
      <div
        v-if="importResult"
        class="rounded border p-3"
        :class="hasFailureDetails ? 'bg-red-50' : 'bg-green-50'"
      >
        <Typography.Title :level="5" class="!mb-2">导入结果</Typography.Title>
        <div class="space-y-1 text-sm">
          <div>
            <Tag color="green">成功</Tag>
            {{ importResult.successCount ?? 0 }} 条
          </div>
          <div>
            <Tag color="blue">新增</Tag>
            {{ importResult.createCount ?? 0 }} 条
          </div>
          <div>
            <Tag color="cyan">更新</Tag>
            {{ importResult.updateCount ?? 0 }} 条
          </div>
          <div>
            <Tag :color="hasFailureDetails ? 'red' : 'default'">失败</Tag>
            {{ importResult.failureCount ?? 0 }} 条
          </div>
        </div>
        <Alert
          v-if="hasFailureDetails"
          class="mt-3"
          type="warning"
          show-icon
          message="部分数据导入失败，请查看失败原因并修正后重新导入。"
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
              <span v-if="item.name">（{{ item.name }}）</span>
              ：{{ item.reason || '未知错误' }}
            </div>
          </div>
        </div>
      </div>
    </div>
    <template #prepend-footer>
      <div class="flex flex-auto items-center">
        <Button @click="handleDownload">下载导入模板</Button>
      </div>
    </template>
    <template #confirmText>
      {{ importResult ? '关闭' : '开始导入' }}
    </template>
  </Modal>
</template>

<style scoped>
.product-unit-import-content,
.product-unit-import-content :deep(.ant-btn),
.product-unit-import-content :deep(.ant-alert),
.product-unit-import-content :deep(.ant-typography) {
  font-size: 12px;
}

.product-unit-import-content :deep(.ant-btn) {
  height: 28px;
  padding: 2px 10px;
}
</style>
