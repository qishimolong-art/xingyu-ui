<script lang="ts" setup>
import type { FileType, UploadFile } from 'ant-design-vue/es/upload/interface';

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

interface FinanceImportFailureItem {
  name?: string;
  reason?: string;
  rowNo?: number;
}

interface FinanceImportResp {
  createCount?: number;
  failureCount?: number;
  failureDetails?: FinanceImportFailureItem[];
  recordId?: number;
  successCount?: number;
  updateCount?: number;
}

interface FinanceFailureDownloadConfig {
  fileName: string;
  request: (recordId: number) => Promise<BlobPart>;
}

interface FinanceImportModalData {
  failureDownload?: FinanceFailureDownloadConfig;
  importRequest: (file: File) => Promise<FinanceImportResp>;
  templateGuideSummary?: string;
  templateGuideTips?: string[];
  templateFileName: string;
  templateRequest: () => Promise<BlobPart>;
  title: string;
}

const emit = defineEmits<{
  success: [];
}>();

const uploadFile = ref<File | null>(null);
const fileList = ref<UploadFile[]>([]);
const importResult = ref<FinanceImportResp | null>(null);
const modalData = ref<FinanceImportModalData | null>(null);

const failureDetails = computed(() => importResult.value?.failureDetails ?? []);
const hasFailures = computed(() => (importResult.value?.failureCount ?? 0) > 0);
const canDownloadFailureDetails = computed(
  () =>
    hasFailures.value &&
    Boolean(importResult.value?.recordId) &&
    Boolean(modalData.value?.failureDownload),
);
const templateGuideSummary = computed(
  () =>
    modalData.value?.templateGuideSummary ||
    `${modalData.value?.title || '当前数据'}导入模板用于批量创建财务单据。请按模板表头填写，系统会按模板字段解析并生成对应业务数据。`,
);
const templateGuideTips = computed(
  () =>
    modalData.value?.templateGuideTips ?? [
      '往来单位、账户、部门等关联字段请填写系统中已存在且启用的数据。',
      '金额字段请填写数字；旧模板中的主单日期或时间可留空，系统会默认当前日期或时间。',
    ],
);

function buildImportResultMessage(result?: FinanceImportResp) {
  return `成功 ${result?.successCount ?? 0} 条，失败 ${result?.failureCount ?? 0} 条`;
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
    if (!modalData.value) {
      message.error('导入配置缺失，请关闭后重试');
      return;
    }
    modalApi.lock();
    try {
      const result = await modalData.value.importRequest(uploadFile.value);
      importResult.value = result;
      if ((result.failureCount ?? 0) > 0) {
        message.warning(buildImportResultMessage(result));
        return;
      }
      emit('success');
      await modalApi.close();
      message.success(buildImportResultMessage(result));
    } finally {
      modalApi.unlock();
    }
  },
  onOpenChange(isOpen: boolean) {
    if (isOpen) {
      modalData.value = modalApi.getData<FinanceImportModalData>();
      return;
    }
    uploadFile.value = null;
    fileList.value = [];
    importResult.value = null;
    modalData.value = null;
  },
});

function beforeUpload(file: FileType) {
  uploadFile.value = file as unknown as File;
  fileList.value = [file as UploadFile];
  importResult.value = null;
  return false;
}

function handleRemove() {
  uploadFile.value = null;
  fileList.value = [];
  importResult.value = null;
  return true;
}

async function handleDownload() {
  if (!modalData.value) {
    message.error('模板配置缺失，请关闭后重试');
    return;
  }
  const data = await modalData.value.templateRequest();
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
    :title="modalData?.title || '导入'"
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
      <Upload
        v-model:file-list="fileList"
        :max-count="1"
        accept=".xls,.xlsx"
        :before-upload="beforeUpload"
        @remove="handleRemove"
      >
        <Button type="primary">选择导入文件</Button>
      </Upload>
      <div
        v-if="importResult"
        class="rounded border p-3"
        :class="hasFailures ? 'bg-red-50' : 'bg-green-50'"
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
            <Tag :color="hasFailures ? 'red' : 'default'">失败</Tag>
            {{ importResult.failureCount ?? 0 }} 条
          </div>
        </div>
        <Alert
          v-if="hasFailures"
          class="mt-3"
          type="warning"
          show-icon
          message="部分数据导入失败，请查看失败原因并修正后重新导入。"
        />
        <Button
          v-if="canDownloadFailureDetails"
          class="mt-3"
          danger
          @click="handleDownloadFailureDetails"
        >
          下载错误数据
        </Button>
        <div v-if="failureDetails.length > 0" class="mt-3">
          <div class="mb-2 font-medium text-red-600">失败原因</div>
          <div class="max-h-40 overflow-auto rounded bg-white p-2 text-xs">
            <div
              v-for="(item, index) in failureDetails"
              :key="index"
              class="mb-1 text-red-600 last:mb-0"
            >
              第 {{ item.rowNo ?? '-' }} 行
              <span v-if="item.name">（{{ item.name }}）</span>
              ：{{ item.reason || '未知错误' }}
            </div>
          </div>
        </div>
      </div>
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
