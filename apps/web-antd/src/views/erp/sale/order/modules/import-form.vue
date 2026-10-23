<script lang="ts" setup>
import type { FileType } from 'ant-design-vue/es/upload/interface';
import type { SaleOrderImportResp } from '#/api/erp/sale/order';

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
  exportSaleOrderImportTemplate,
  importSaleOrder,
} from '#/api/erp/sale/order';
import ImportTemplateGuide from '#/components/import-template-guide/ImportTemplateGuide.vue';

interface SaleOrderImportModalData {
  failureDownload?: {
    request: (recordId: number) => Promise<BlobPart>;
    fileName: string;
  };
}

const emit = defineEmits<{
  success: [data: SaleOrderImportResp];
}>();

const uploadFile = ref<File | null>(null);
const importResult = ref<SaleOrderImportResp | null>(null);
const modalData = ref<SaleOrderImportModalData | null>(null);

const failureDetails = computed(() => importResult.value?.failureDetails ?? []);
const hasFailureDetails = computed(() => failureDetails.value.length > 0);
const hasImportFailures = computed(
  () => (importResult.value?.failureCount ?? 0) > 0,
);
const canDownloadFailureDetails = computed(
  () =>
    hasImportFailures.value &&
    Boolean(importResult.value?.recordId) &&
    Boolean(modalData.value?.failureDownload),
);

function buildImportResultMessage(result?: SaleOrderImportResp) {
  return `导入成功 ${result?.successCount ?? 0} 行，失败 ${result?.failureCount ?? 0} 行`;
}

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    if (importResult.value) {
      await modalApi.close();
      return;
    }
    if (!uploadFile.value) {
      message.warning('请先选择 Excel 文件');
      return;
    }
    modalApi.lock();
    try {
      const data = await importSaleOrder(uploadFile.value);
      importResult.value = data;
      if ((data.failureCount ?? 0) > 0) {
        if (!modalData.value?.failureDownload) {
          emit('success', data);
        }
        message.warning(buildImportResultMessage(data));
        return;
      }
      emit('success', data);
      await modalApi.close();
      message.success(buildImportResultMessage(data));
    } finally {
      modalApi.unlock();
    }
  },
  onOpenChange(isOpen: boolean) {
    if (isOpen) {
      modalData.value = modalApi.getData<SaleOrderImportModalData>() ?? {};
      return;
    }
    uploadFile.value = null;
    importResult.value = null;
    modalData.value = null;
  },
});

function beforeUpload(file: FileType) {
  uploadFile.value = file as unknown as File;
  importResult.value = null;
  return false;
}

async function handleDownload() {
  const data = await exportSaleOrderImportTemplate();
  downloadFileFromBlobPart({
    fileName: '销售订单明细导入模板.xls',
    source: data,
  });
}

async function handleDownloadFailureDetails() {
  const recordId = importResult.value?.recordId;
  const failureDownload = modalData.value?.failureDownload;
  if (!recordId || !failureDownload) {
    message.warning('暂无可下载的错误数据');
    return;
  }
  const data = await failureDownload.request(recordId);
  downloadFileFromBlobPart({
    fileName: failureDownload.fileName,
    source: data,
  });
}
</script>

<template>
  <Modal
    title="导入销售单"
    class="top-6 max-h-[calc(100vh-48px)] w-[720px] max-w-[calc(100vw-32px)]"
    content-class="!min-h-0"
    footer-class="flex-wrap gap-2 border-t bg-background px-4 py-3"
    :fullscreen-button="false"
  >
    <div
      class="mx-4 my-4 max-h-[calc(100vh-180px)] space-y-4 overflow-y-auto pr-1"
    >
      <ImportTemplateGuide
        summary="销售单导入模板用于解析当前销售单明细，上传后系统会按产品、数量、价格等字段回填到新建表单。"
        :tips="[
          '配件编码、配件名称、厂家编码是三选一字段：填写其中任意一个即可；如果多列都填，必须对应同一配件。',
          '数量、单价、税率等数值字段请按模板示例填写。',
        ]"
      />
      <Upload :max-count="1" accept=".xls,.xlsx" :before-upload="beforeUpload">
        <Button type="primary">选择 Excel 文件</Button>
      </Upload>
      <div
        v-if="importResult"
        class="rounded border p-3"
        :class="hasImportFailures ? 'bg-red-50' : 'bg-green-50'"
      >
        <Typography.Title :level="5" class="!mb-2">导入结果</Typography.Title>
        <div class="space-y-1 text-sm">
          <div>
            <Tag color="green">成功</Tag>
            {{ importResult.successCount ?? 0 }}
          </div>
          <div>
            <Tag :color="hasImportFailures ? 'red' : 'default'">失败</Tag>
            {{ importResult.failureCount ?? 0 }}
          </div>
        </div>
        <Alert
          v-if="hasImportFailures"
          class="mt-3"
          type="warning"
          show-icon
          message="部分行导入失败，请根据下方错误明细修改后重新导入。"
        />
        <div v-if="hasFailureDetails" class="mt-3">
          <div class="mb-2 font-medium text-red-600">错误明细</div>
          <div class="max-h-40 overflow-auto rounded bg-white p-2 text-xs">
            <div
              v-for="(item, index) in failureDetails"
              :key="index"
              class="mb-1 text-red-600 last:mb-0"
            >
              第 {{ item.rowNo ?? '-' }} 行
              <span v-if="item.productCode">（{{ item.productCode }}）</span>
              ：{{ item.reason || '未知错误' }}
            </div>
          </div>
        </div>
      </div>
    </div>
    <template #prepend-footer>
      <div class="flex flex-auto flex-wrap items-center gap-2">
        <Button @click="handleDownload">下载导入模板</Button>
        <Button
          v-if="canDownloadFailureDetails"
          danger
          ghost
          @click="handleDownloadFailureDetails"
        >
          下载错误数据
        </Button>
      </div>
    </template>
    <template #confirmText>
      {{ importResult ? '关闭' : '开始导入' }}
    </template>
  </Modal>
</template>
