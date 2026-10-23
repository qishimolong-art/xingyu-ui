<script lang="ts" setup>
import type { ErpAttachmentScanApi } from '#/api/erp/attachment-scan';

import { computed, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';

import { useAccessStore } from '@vben/stores';

import {
  Button,
  Empty,
  List,
  message,
  Progress,
  Result,
  Space,
  Spin,
  Tag,
} from 'ant-design-vue';

import {
  getAttachmentScanSession,
  uploadAttachmentScanFile,
} from '#/api/erp/attachment-scan';

defineOptions({ name: 'ErpAttachmentScanMobile' });

const route = useRoute();
const accessStore = useAccessStore();

const statusText: Record<number, string> = {
  10: '待上传',
  20: '已上传',
  30: '已过期',
  40: '已取消',
};

const ticket = ref('');
const loading = ref(true);
const uploading = ref(false);
const uploadPercent = ref(0);
const session = ref<ErpAttachmentScanApi.SessionResp>();
const uploadedFiles = ref<ErpAttachmentScanApi.UploadResp[]>([]);
const fileInputRef = ref<HTMLInputElement>();
const cameraInputRef = ref<HTMLInputElement>();

const canUpload = computed(
  () =>
    !!session.value &&
    (session.value.status === 10 || session.value.status === 20) &&
    session.value.uploadedCount < session.value.maxFileCount,
);

function syncTenantFromQuery() {
  const tenantId = Number(route.query.tenantId);
  if (Number.isFinite(tenantId) && tenantId > 0) {
    accessStore.setTenantId(tenantId);
  }
}

async function loadSession() {
  loading.value = true;
  try {
    ticket.value = String(route.query.ticket || '');
    if (!ticket.value) {
      return;
    }
    session.value = await getAttachmentScanSession(ticket.value);
  } finally {
    loading.value = false;
  }
}

async function uploadOne(file: File) {
  uploading.value = true;
  uploadPercent.value = 0;
  try {
    const result = await uploadAttachmentScanFile(ticket.value, file,
      (event) => {
        if (event.total) {
          uploadPercent.value = Math.round((event.loaded / event.total) * 100);
        }
      },
    );
    uploadedFiles.value.unshift(result);
    if (session.value) {
      session.value.status = result.status;
      session.value.uploadedCount = result.uploadedCount;
    }
    message.success('上传成功');
  } finally {
    uploading.value = false;
  }
}

async function handleFilesChange(event: Event) {
  const input = event.target as HTMLInputElement;
  const files = Array.from(input.files || []);
  input.value = '';
  for (const file of files) {
    if (!canUpload.value) {
      break;
    }
    await uploadOne(file);
  }
}

onMounted(async () => {
  syncTenantFromQuery();
  await loadSession();
});
</script>

<template>
  <div class="min-h-screen bg-neutral-50 px-4 py-6">
    <div class="mx-auto max-w-md">
      <Spin v-if="loading" class="mt-20 flex justify-center" />
      <Result
        v-else-if="!ticket"
        status="error"
        title="二维码无效"
        sub-title="请重新从电脑端生成上传二维码"
      />
      <Result
        v-else-if="!session"
        status="error"
        title="会话不存在"
        sub-title="请确认二维码是否已经失效"
      />
      <div v-else class="rounded bg-white p-4 shadow-sm">
        <div class="mb-4 flex items-center justify-between gap-3">
          <h1 class="m-0 truncate text-lg font-semibold">
            {{ session.title || '扫码上传附件' }}
          </h1>
          <Tag>{{ statusText[session.status] }}</Tag>
        </div>
        <div class="mb-4 text-sm text-neutral-500">
          <div v-if="session.bizNo">单号：{{ session.bizNo }}</div>
          <div>
            已上传：{{ session.uploadedCount }} / {{ session.maxFileCount }}
          </div>
        </div>

        <Result
          v-if="session.status === 30"
          status="warning"
          title="二维码已过期"
          sub-title="请回到电脑端重新生成二维码"
        />
        <Result
          v-else-if="session.status === 40"
          status="info"
          title="会话已取消"
          sub-title="当前二维码不能继续上传"
        />
        <div v-else>
          <input
            ref="fileInputRef"
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
            class="hidden"
            multiple
            type="file"
            @change="handleFilesChange"
          />
          <input
            ref="cameraInputRef"
            accept="image/*"
            capture="environment"
            class="hidden"
            type="file"
            @change="handleFilesChange"
          />
          <Space direction="vertical" class="w-full">
            <Button
              block
              size="large"
              type="primary"
              :disabled="!canUpload"
              :loading="uploading"
              @click="fileInputRef?.click()"
            >
              选择附件上传
            </Button>
            <Button
              block
              size="large"
              :disabled="!canUpload"
              :loading="uploading"
              @click="cameraInputRef?.click()"
            >
              拍照上传
            </Button>
          </Space>
          <Progress
            v-if="uploading"
            class="mt-4"
            :percent="uploadPercent"
            size="small"
          />
          <Result
            v-if="!canUpload && session.uploadedCount >= session.maxFileCount"
            status="success"
            title="附件数量已满"
            sub-title="请回到电脑端查看上传结果"
          />
        </div>

        <List
          v-if="uploadedFiles.length > 0"
          class="mt-4"
          :data-source="uploadedFiles"
          bordered
          size="small"
        >
          <template #header>本次上传</template>
          <template #renderItem="{ item }">
            <List.Item>
              <a :href="item.fileUrl" target="_blank" rel="noreferrer">
                {{ item.fileName }}
              </a>
            </List.Item>
          </template>
        </List>
        <Empty
          v-else-if="canUpload"
          class="mt-6"
          description="请选择文件或拍照上传"
        />
      </div>
    </div>
  </div>
</template>
