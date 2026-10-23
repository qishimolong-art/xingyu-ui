<script lang="ts" setup>
import type { FileType } from 'ant-design-vue/es/upload/interface';

import type { ErpWarehouseApi } from '#/api/erp/stock/warehouse';

import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { downloadFileFromBlobPart } from '@vben/utils';

import { Button, message, Upload } from 'ant-design-vue';

import {
  downloadWarehouseImportFailureDetails,
  getWarehouseImportTemplate,
  importWarehouse,
} from '#/api/erp/stock/warehouse';
import ImportTemplateGuide from '#/components/import-template-guide/ImportTemplateGuide.vue';
import StockImportResultPanel from '#/views/erp/stock/components/StockImportResultPanel.vue';

const emit = defineEmits(['success']);

const uploadFile = ref<File | null>(null);
let refreshPending = false;
const importResult = ref<ErpWarehouseApi.WarehouseImportResult | null>(null);

const canDownloadFailureDetails = computed(
  () =>
    (importResult.value?.failureCount ?? 0) > 0 &&
    Boolean(importResult.value?.recordId),
);

function buildImportResultMessage(
  result?: ErpWarehouseApi.WarehouseImportResult,
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
      const result = await importWarehouse(uploadFile.value);
      importResult.value = result;
      refreshPending ||= (result?.successCount ?? 0) > 0;
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
      if (refreshPending) {
        refreshPending = false;
        emit('success');
      }
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
  const data = await getWarehouseImportTemplate();
  downloadFileFromBlobPart({ fileName: '仓库导入模板.xls', source: data });
}

async function handleDownloadFailureDetails() {
  const recordId = importResult.value?.recordId;
  if (!recordId) {
    message.warning('暂无可下载的错误数据');
    return;
  }
  const data = await downloadWarehouseImportFailureDetails(recordId);
  downloadFileFromBlobPart({ fileName: '仓库错误数据.xls', source: data });
}
</script>

<template>
  <Modal
    title="导入仓库"
    class="top-6 max-h-[calc(100vh-48px)] w-[720px] max-w-[calc(100vw-32px)]"
    content-class="!min-h-0"
    footer-class="flex-wrap gap-2 border-t bg-background px-4 py-3"
    :fullscreen-button="false"
  >
    <div
      class="mx-4 my-4 max-h-[calc(100vh-180px)] space-y-4 overflow-y-auto pr-1"
    >
      <ImportTemplateGuide
        summary="仓库导入用于批量维护仓库资料，系统会根据仓库编码或仓库名称执行新增、更新。"
        :tips="[
          '黄色表头为必填项，请按模板填写后再导入。',
          '仓库编码和仓库名称请尽量保持唯一。',
          '仓库地址、地图名称、经度、纬度为选填项；经纬度请填写 GCJ-02 坐标。',
          '负责人、状态等字段请按模板示例填写，避免导入后资料不可用。',
        ]"
      />
      <Upload :max-count="1" accept=".xls,.xlsx" :before-upload="beforeUpload">
        <Button type="primary">选择导入文件</Button>
      </Upload>
      <StockImportResultPanel
        v-if="importResult"
        :result="importResult"
        unit="条"
        show-update-count
        :can-download-failure-details="canDownloadFailureDetails"
        @download-failure-details="handleDownloadFailureDetails"
      />
    </div>
    <template #prepend-footer>
      <div class="flex flex-auto flex-wrap items-center gap-2">
        <Button @click="handleDownload">下载导入模板</Button>
      </div>
    </template>
    <template #confirmText>
      {{ importResult ? '关闭' : '开始导入' }}
    </template>
  </Modal>
</template>
