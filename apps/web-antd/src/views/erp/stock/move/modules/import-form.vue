<script lang="ts" setup>
import type { FileType } from 'ant-design-vue/es/upload/interface';
import type { ErpStockMoveApi } from '#/api/erp/stock/move';

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
  getStockMoveImportTemplate,
  importStockMove,
} from '#/api/erp/stock/move';
import ImportTemplateGuide from '#/components/import-template-guide/ImportTemplateGuide.vue';

const emit = defineEmits(['success']);

const uploadFile = ref<File | null>(null);
const importResult = ref<ErpStockMoveApi.StockImportResult | null>(null);

const failureDetails = computed(() => {
  return (importResult.value?.failureDetails ?? []).map((item) =>
    typeof item === 'string' ? { reason: item } : item,
  );
});
const hasFailureDetails = computed(() => failureDetails.value.length > 0);

function buildImportResultMessage(result?: ErpStockMoveApi.StockImportResult) {
  if (!result) {
    return '导入成功';
  }
  return [
    `成功 ${result.successCount ?? 0} 张`,
    `新增 ${result.createCount ?? 0} 张`,
    `失败 ${result.failureCount ?? 0} 张`,
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
      const result = await importStockMove(uploadFile.value);
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
  const data = await getStockMoveImportTemplate();
  downloadFileFromBlobPart({ fileName: '库存调拨导入模板.xls', source: data });
}
</script>

<template>
  <Modal title="导入库存调拨单" class="w-1/3">
    <div class="mx-4 my-4 space-y-4">
      <ImportTemplateGuide
        summary="库存调拨导入模板用于批量创建待审核调拨单，系统会按单据编号分组生成调拨单和明细。"
        :tips="[
          '同一单据编号下的调出仓库、调入仓库、备注等主表信息需保持一致。',
          '配件编码、配件名称、厂家编码是三选一字段：填写其中任意一个即可；如果多列都填，必须对应同一配件。',
          '仓库、数量等字段请填写系统中已存在且启用的数据。',
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
            <Tag color="green">成功</Tag>{{ importResult.successCount ?? 0 }} 张
          </div>
          <div>
            <Tag color="blue">新增</Tag>{{ importResult.createCount ?? 0 }} 张
          </div>
          <div>
            <Tag :color="hasFailureDetails ? 'red' : 'default'">失败</Tag
            >{{ importResult.failureCount ?? 0 }} 张
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
              <span v-if="item.orderNo">（{{ item.orderNo }}）</span>
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
