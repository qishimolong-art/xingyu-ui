<script lang="ts" setup>
import type { FileType } from 'ant-design-vue/es/upload/interface';

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

import ImportTemplateGuide from '#/components/import-template-guide/ImportTemplateGuide.vue';

interface SaleImportFailureItem {
  rowNo?: number;
  productCode?: string;
  reason?: string;
}

interface SaleDetailImportResp<TItem = any> {
  recordId?: number;
  successCount?: number;
  failureCount?: number;
  items?: TItem[];
  failureDetails?: SaleImportFailureItem[];
}

interface FailureDownloadConfig {
  request: (recordId: number) => Promise<BlobPart>;
  fileName: string;
}

interface SaleDetailImportModalData<TItem = any> {
  title: string;
  templateFileName: string;
  importRequest: (file: File) => Promise<SaleDetailImportResp<TItem>>;
  exportTemplateRequest: () => Promise<BlobPart>;
  failureDownload?: FailureDownloadConfig;
  templateGuideSummary?: string;
  templateGuideTips?: string[];
}

const emit = defineEmits<{
  success: [data: SaleDetailImportResp];
}>();

const uploadFile = ref<File | null>(null);
const importResult = ref<SaleDetailImportResp | null>(null);
const modalData = ref<SaleDetailImportModalData | null>(null);

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
const templateGuideSummary = computed(
  () =>
    modalData.value?.templateGuideSummary ||
    `${modalData.value?.title || '销售明细'}模板用于解析当前单据明细，上传后系统会按产品信息、数量、价格等字段回填到当前表单。`,
);
const templateGuideTips = computed(
  () =>
    modalData.value?.templateGuideTips ?? [
      '配件编码、配件名称、厂家编码是三选一字段：填写其中任意一个即可；如果多列都填，必须对应同一配件。',
      '数量、单价、税率等数值字段请按模板示例填写。',
    ],
);

function buildImportResultMessage(result?: SaleDetailImportResp) {
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
    if (!modalData.value) {
      message.error('导入配置缺失，请关闭后重试');
      return;
    }

    modalApi.lock();
    try {
      const data = await modalData.value.importRequest(uploadFile.value);
      importResult.value = data;
      if ((data.failureCount ?? 0) > 0) {
        if (!modalData.value.failureDownload) {
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
      modalData.value = modalApi.getData<SaleDetailImportModalData>();
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
  if (!modalData.value) {
    message.error('模板配置缺失，请关闭后重试');
    return;
  }
  const data = await modalData.value.exportTemplateRequest();
  downloadFileFromBlobPart({
    fileName: modalData.value.templateFileName,
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
    :title="modalData?.title || '导入销售明细'"
    class="top-6 max-h-[calc(100vh-48px)] w-[720px] max-w-[calc(100vw-32px)]"
    content-class="!min-h-0"
    footer-class="flex-wrap gap-2 border-t bg-background px-4 py-3"
    :fullscreen-button="false"
  >
    <div
      class="mx-4 my-4 max-h-[calc(100vh-180px)] space-y-4 overflow-y-auto pr-1"
    >
      <ImportTemplateGuide
        :summary="templateGuideSummary"
        :tips="templateGuideTips"
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
        <Button @click="handleDownload">下载模板</Button>
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
