<script lang="ts" setup>
import type { FileType } from 'ant-design-vue/es/upload/interface';

import type { ErpProductCategoryApi } from '#/api/erp/product/category';

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
  getProductCategoryImportTemplate,
  importProductCategory,
} from '#/api/erp/product/category';
import ImportTemplateGuide from '#/components/import-template-guide/ImportTemplateGuide.vue';

const emit = defineEmits(['success']);

const uploadFile = ref<File | null>(null);
const importResult =
  ref<ErpProductCategoryApi.ProductCategoryImportResult | null>(null);

const failureDetails = computed(() => {
  return (importResult.value?.failureDetails ?? []).map((item) =>
    typeof item === 'string' ? { reason: item } : item,
  );
});

const hasFailureDetails = computed(() => failureDetails.value.length > 0);

function buildImportResultMessage(
  result?: ErpProductCategoryApi.ProductCategoryImportResult,
) {
  if (!result) {
    return '导入成功';
  }
  return [
    `成功 ${result.successCount ?? 0} 条`,
    `新增 ${result.createCount ?? 0} 条`,
    `更新 ${result.updateCount ?? 0} 条`,
    `失败 ${result.failureCount ?? 0} 条`,
  ].join('，');
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
      const result = await importProductCategory(uploadFile.value);
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
  const data = await getProductCategoryImportTemplate();
  downloadFileFromBlobPart({ fileName: '配件分类导入模板.xls', source: data });
}
</script>

<template>
  <Modal title="导入配件分类" class="w-[640px]">
    <div class="product-category-import-content mx-4 my-4 space-y-4">
      <ImportTemplateGuide
        summary="配件分类导入用于批量维护分类层级，系统会根据分类编码执行新增或更新。"
        :tips="[
          '黄色表头为必填项，请按模板填写后再导入。',
          '上级分类编码为空时导入为顶级分类。',
          '填写上级分类编码时，请确保上级分类已存在，或在模板中位于子分类之前。',
        ]"
      />
      <Upload :max-count="1" accept=".xls,.xlsx" :before-upload="beforeUpload">
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
            <Tag color="green">成功</Tag>{{ importResult.successCount ?? 0 }} 条
          </div>
          <div>
            <Tag color="blue">新增</Tag>{{ importResult.createCount ?? 0 }} 条
          </div>
          <div>
            <Tag color="cyan">更新</Tag>{{ importResult.updateCount ?? 0 }} 条
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
              <span v-if="item.code">（{{ item.code }}）</span>
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
.product-category-import-content,
.product-category-import-content :deep(.ant-btn),
.product-category-import-content :deep(.ant-alert),
.product-category-import-content :deep(.ant-typography) {
  font-size: 12px;
}

.product-category-import-content :deep(.ant-btn) {
  height: 28px;
  padding: 2px 10px;
}
</style>
