<script lang="ts" setup>
import type { FileType } from 'ant-design-vue/es/upload/interface';

import type { ErpProductBrandApi } from '#/api/erp/product/brand';

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
  getProductBrandImportTemplate,
  importProductBrand,
} from '#/api/erp/product/brand';
import ImportTemplateGuide from '#/components/import-template-guide/ImportTemplateGuide.vue';

const emit = defineEmits(['success']);

const uploadFile = ref<File | null>(null);
const importResult = ref<ErpProductBrandApi.ProductBrandImportResult | null>(
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
      const result = await importProductBrand(uploadFile.value);
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
  const data = await getProductBrandImportTemplate();
  downloadFileFromBlobPart({
    fileName: '配件品牌导入模板.xls',
    source: data,
  });
}
</script>

<template>
  <Modal title="导入配件品牌" class="w-[640px]">
    <div class="product-brand-import-content mx-4 my-4 space-y-4">
      <ImportTemplateGuide
        summary="配件品牌导入用于批量维护品牌档案，系统会根据品牌名称执行新增或更新。"
        :tips="[
          '黄色表头为必填项，请按模板填写后再导入。',
          '品牌名称同租户内唯一，导入时同名品牌会更新状态和排序。',
          '状态为空时新增品牌默认为启用，排序为空时新增品牌默认为 0。',
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
.product-brand-import-content,
.product-brand-import-content :deep(.ant-btn),
.product-brand-import-content :deep(.ant-alert),
.product-brand-import-content :deep(.ant-typography) {
  font-size: 12px;
}

.product-brand-import-content :deep(.ant-btn) {
  height: 28px;
  padding: 2px 10px;
}
</style>
