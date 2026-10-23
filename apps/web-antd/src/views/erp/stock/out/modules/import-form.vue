<script lang="ts" setup>
import type { FileType } from 'ant-design-vue/es/upload/interface';

import type { ErpStockOutApi } from '#/api/erp/stock/out';

import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { downloadFileFromBlobPart } from '@vben/utils';

import { Button, message, Upload } from 'ant-design-vue';

import {
  downloadStockOutImportFailureDetails,
  getStockOutImportTemplate,
  importStockOut,
} from '#/api/erp/stock/out';
import ImportTemplateGuide from '#/components/import-template-guide/ImportTemplateGuide.vue';
import StockImportResultPanel from '#/views/erp/stock/components/StockImportResultPanel.vue';

const emit = defineEmits(['success']);

const uploadFile = ref<File | null>(null);
const importResult = ref<ErpStockOutApi.StockImportResult | null>(null);

const canDownloadFailureDetails = computed(
  () =>
    (importResult.value?.failureCount ?? 0) > 0 &&
    Boolean(importResult.value?.recordId),
);

function buildImportResultMessage(result?: ErpStockOutApi.StockImportResult) {
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
      const result = await importStockOut(uploadFile.value);
      importResult.value = result;
      if ((result?.successCount ?? result?.createCount ?? 0) > 0)
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
  const data = await getStockOutImportTemplate();
  downloadFileFromBlobPart({ fileName: '其它出库导入模板.xls', source: data });
}

async function handleDownloadFailureDetails() {
  const recordId = importResult.value?.recordId;
  if (!recordId) {
    message.warning('暂无可下载的错误数据');
    return;
  }
  const data = await downloadStockOutImportFailureDetails(recordId);
  downloadFileFromBlobPart({ fileName: '其它出库错误数据.xls', source: data });
}
</script>

<template>
  <Modal
    title="导入其它出库单"
    class="top-6 max-h-[calc(100vh-48px)] w-[720px] max-w-[calc(100vw-32px)]"
    content-class="!min-h-0"
    footer-class="flex-wrap gap-2 border-t bg-background px-4 py-3"
    :fullscreen-button="false"
  >
    <div
      class="mx-4 my-4 max-h-[calc(100vh-180px)] space-y-4 overflow-y-auto pr-1"
    >
      <ImportTemplateGuide
        summary="其它出库导入模板用于批量创建待下单确认出库单，系统会按单据编号分组生成单据和明细。"
        :tips="[
          '同一单据编号下的仓库、备注等主表信息需保持一致。',
          '配件编码、配件名称、厂家编码是三选一字段：填写其中任意一个即可；如果多列都填，必须对应同一配件。',
          '仓库、数量等字段请填写系统中已存在且启用的数据。',
        ]"
      />
      <Upload :max-count="1" accept=".xls,.xlsx" :before-upload="beforeUpload">
        <Button type="primary">选择导入文件</Button>
      </Upload>
      <StockImportResultPanel
        v-if="importResult"
        :result="importResult"
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
