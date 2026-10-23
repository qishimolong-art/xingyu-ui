<script lang="ts" setup>
import type { FileType } from 'ant-design-vue/es/upload/interface';

import type { ErpProductApi } from '#/api/erp/product/product';

import { computed, onBeforeUnmount, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { useAccessStore, useUserStore } from '@vben/stores';
import { downloadFileFromBlobPart } from '@vben/utils';

import {
  Alert,
  Button,
  message,
  Progress,
  Tag,
  Typography,
  Upload,
} from 'ant-design-vue';

import {
  getActiveProductImportTask,
  getProductImportTask,
  getProductImportTemplate,
  startProductImportTask,
} from '#/api/erp/product/product';
import ImportTemplateGuide from '#/components/import-template-guide/ImportTemplateGuide.vue';

const emit = defineEmits(['success']);

const accessStore = useAccessStore();
const userStore = useUserStore();
const uploadFile = ref<File | null>(null);
const importTask = ref<ErpProductApi.ProductImportTaskResult | null>(null);
const currentTaskId = ref<number>();
const modalOpen = ref(false);
const pollingInterrupted = ref(false);
const notifiedTaskId = ref<number>();

let pollTimer: ReturnType<typeof setTimeout> | undefined;
let polling = false;
let disposed = false;

const taskStorageKey = computed(() => {
  const tenantId =
    accessStore.visitTenantId ?? accessStore.tenantId ?? 'default';
  const userId = userStore.userInfo?.userId ?? 'anonymous';
  return `erp:product-import-task:${tenantId}:${userId}`;
});

const isProcessing = computed(() => importTask.value?.status === 'PROCESSING');
const hasTask = computed(() => importTask.value !== null);
const failureDetails = computed(() => {
  return (importTask.value?.failureDetails ?? []).map((item) =>
    typeof item === 'string' ? { reason: item } : item,
  );
});
const hasFailureDetails = computed(
  () =>
    failureDetails.value.length > 0 ||
    (importTask.value?.failureCount ?? 0) > 0,
);
const confirmText = computed(() => {
  if (hasTask.value) {
    return isProcessing.value ? '后台运行' : '关闭';
  }
  return '开始导入';
});

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
    `新增 ${result.createCount ?? 0} 条`,
    `更新 ${result.updateCount ?? 0} 条`,
    `失败 ${result.failureCount ?? 0} 条`,
  ].join('，');
}

function formatDuration(durationMs?: number) {
  const seconds = Math.max(0, Math.floor((durationMs ?? 0) / 1000));
  if (seconds < 60) {
    return `${seconds} 秒`;
  }
  const minutes = Math.floor(seconds / 60);
  return `${minutes} 分 ${seconds % 60} 秒`;
}

function saveTaskId(taskId?: number) {
  if (taskId === undefined) {
    sessionStorage.removeItem(taskStorageKey.value);
    return;
  }
  sessionStorage.setItem(taskStorageKey.value, String(taskId));
}

function readTaskId() {
  const value = Number(sessionStorage.getItem(taskStorageKey.value));
  return Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

function clearPollTimer() {
  if (pollTimer !== undefined) {
    clearTimeout(pollTimer);
    pollTimer = undefined;
  }
}

function schedulePoll(delay?: number) {
  clearPollTimer();
  if (disposed || !currentTaskId.value || !isProcessing.value) {
    return;
  }
  pollTimer = setTimeout(
    () => void pollTask(),
    delay ?? (modalOpen.value ? 1000 : 5000),
  );
}

function notifyTaskFinished(task: ErpProductApi.ProductImportTaskResult) {
  if (notifiedTaskId.value === task.taskId) {
    return;
  }
  notifiedTaskId.value = task.taskId;
  emit('success');
  const resultMessage = buildImportResultMessage(task);
  if (task.status === 'FAILURE') {
    message.error(task.errorMessage || resultMessage);
  } else if ((task.failureCount ?? 0) > 0) {
    message.warning(resultMessage);
  } else {
    message.success(resultMessage);
  }
}

function applyTask(task: ErpProductApi.ProductImportTaskResult) {
  importTask.value = task;
  currentTaskId.value = task.taskId;
  saveTaskId(task.taskId);
  pollingInterrupted.value = false;
  if (task.status !== 'PROCESSING') {
    clearPollTimer();
    notifyTaskFinished(task);
  }
}

async function pollTask() {
  if (polling || disposed || !currentTaskId.value) {
    return;
  }
  polling = true;
  try {
    applyTask(await getProductImportTask(currentTaskId.value));
  } catch {
    pollingInterrupted.value = true;
  } finally {
    polling = false;
    if (isProcessing.value) {
      schedulePoll(pollingInterrupted.value ? 3000 : undefined);
    }
  }
}

async function restoreTask() {
  clearPollTimer();
  const savedTaskId = readTaskId();
  if (savedTaskId) {
    currentTaskId.value = savedTaskId;
    try {
      applyTask(await getProductImportTask(savedTaskId));
      schedulePoll();
      return;
    } catch {
      saveTaskId();
      currentTaskId.value = undefined;
    }
  }
  try {
    const activeTask = await getActiveProductImportTask();
    if (activeTask) {
      applyTask(activeTask);
      schedulePoll();
      return;
    }
  } catch {
    message.warning('暂时无法查询正在执行的配件导入任务');
  }
  importTask.value = null;
}

function clearFinishedTask() {
  if (isProcessing.value) {
    return;
  }
  saveTaskId();
  currentTaskId.value = undefined;
  importTask.value = null;
  uploadFile.value = null;
  pollingInterrupted.value = false;
}

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    if (hasTask.value) {
      await modalApi.close();
      return;
    }
    if (!uploadFile.value) {
      message.warning('请先选择导入文件');
      return;
    }
    modalApi.lock();
    try {
      const result = await startProductImportTask(uploadFile.value);
      currentTaskId.value = result.taskId;
      saveTaskId(result.taskId);
      uploadFile.value = null;
      if (result.reused) {
        message.info('当前租户已有配件导入任务，已切换到该任务进度');
      }
      await pollTask();
      schedulePoll();
    } finally {
      modalApi.unlock();
    }
  },
  async onOpenChange(isOpen: boolean) {
    modalOpen.value = isOpen;
    if (isOpen) {
      await restoreTask();
      return;
    }
    if (isProcessing.value) {
      schedulePoll(5000);
      return;
    }
    clearFinishedTask();
  },
});

function beforeUpload(file: FileType) {
  uploadFile.value = file as unknown as File;
  return false;
}

async function handleDownload() {
  const data = await getProductImportTemplate();
  downloadFileFromBlobPart({ fileName: '配件导入模板.xls', source: data });
}

onBeforeUnmount(() => {
  disposed = true;
  clearPollTimer();
});
</script>

<template>
  <Modal title="导入配件" class="w-1/3">
    <div class="mx-4 my-4 space-y-4">
      <ImportTemplateGuide
        v-if="!hasTask"
        summary="配件导入用于批量维护配件基础资料，系统会根据配件编码执行新增或更新。"
        :tips="[
          '黄色表头为必填项，请按模板填写后再导入。',
          '配件编码用于识别唯一配件，请勿重复填写不同配件。',
          '默认仓库需填写已启用仓库名称，分类、单位等关联字段请与系统资料保持一致。',
        ]"
      />
      <Upload
        v-if="!hasTask"
        :max-count="1"
        accept=".xls,.xlsx,.csv"
        :before-upload="beforeUpload"
      >
        <Button type="primary">选择导入文件</Button>
      </Upload>

      <div v-if="importTask" class="rounded border bg-slate-50 p-4">
        <div class="mb-3 flex items-center justify-between gap-3">
          <Typography.Title :level="5" class="!mb-0">
            {{ isProcessing ? '导入进度' : '导入结果' }}
          </Typography.Title>
          <Tag
            :color="
              isProcessing
                ? 'processing'
                : hasFailureDetails
                  ? 'orange'
                  : 'success'
            "
          >
            {{ importTask.stageName }}
          </Tag>
        </div>

        <Progress
          :percent="importTask.progressPercent ?? 0"
          :status="importTask.status === 'FAILURE' ? 'exception' : undefined"
        />

        <div class="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            已处理：{{ importTask.processedCount ?? 0 }} /
            {{ importTask.totalCount ?? 0 }}
          </div>
          <div>已耗时：{{ formatDuration(importTask.durationMs) }}</div>
          <div>
            <Tag color="green">成功</Tag>{{ importTask.successCount ?? 0 }} 条
          </div>
          <div>
            <Tag color="blue">新增</Tag>{{ importTask.createCount ?? 0 }} 条
          </div>
          <div>
            <Tag color="cyan">更新</Tag>{{ importTask.updateCount ?? 0 }} 条
          </div>
          <div>
            <Tag :color="hasFailureDetails ? 'red' : 'default'">失败</Tag
            >{{ importTask.failureCount ?? 0 }} 条
          </div>
        </div>

        <div class="mt-3 text-xs text-gray-500">
          <span v-if="importTask.fileName"
            >文件：{{ importTask.fileName }}</span
          >
          <span v-if="importTask.operatorName" class="ml-3"
            >操作人：{{ importTask.operatorName }}</span
          >
        </div>

        <Alert
          v-if="pollingInterrupted && isProcessing"
          class="mt-3"
          type="warning"
          show-icon
          message="进度查询暂时中断，系统正在自动重试，后台导入不会停止。"
        />
        <Alert
          v-if="importTask.errorMessage"
          class="mt-3"
          type="error"
          show-icon
          :message="importTask.errorMessage"
        />
        <Alert
          v-else-if="!isProcessing && hasFailureDetails"
          class="mt-3"
          type="warning"
          show-icon
          message="部分数据导入失败，请查看失败原因并修正后重新导入。"
        />

        <div v-if="failureDetails.length > 0" class="mt-3">
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
    <template #confirmText>{{ confirmText }}</template>
  </Modal>
</template>
