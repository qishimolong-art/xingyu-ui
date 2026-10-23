<script lang="ts" setup>
import type { ErpAttachmentScanApi } from '#/api/erp/attachment-scan';

import { computed, onBeforeUnmount, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { formatDate } from '@vben/utils';

import {
  Button,
  Card,
  Descriptions,
  Empty,
  Form,
  Input,
  InputNumber,
  List,
  message,
  QRCode,
  Space,
  Tag,
} from 'ant-design-vue';

import {
  cancelAttachmentScan,
  createAttachmentScan,
  getAttachmentScanStatus,
} from '#/api/erp/attachment-scan';

defineOptions({ name: 'ErpAttachmentScanDemo' });

const statusText: Record<number, string> = {
  10: '待上传',
  20: '已上传',
  30: '已过期',
  40: '已取消',
};

const statusColor: Record<number, string> = {
  10: 'processing',
  20: 'success',
  30: 'default',
  40: 'warning',
};

const form = ref<ErpAttachmentScanApi.CreateReq>({
  maxFileCount: 9,
  title: '扫码上传附件',
});
const creating = ref(false);
const canceling = ref(false);
const session = ref<ErpAttachmentScanApi.CreateResp>();
const status = ref<ErpAttachmentScanApi.StatusResp>();
const now = ref(Date.now());
let pollTimer: ReturnType<typeof setInterval> | undefined;
let clockTimer: ReturnType<typeof setInterval> | undefined;

const canPoll = computed(() => {
  const current = status.value?.status ?? session.value?.status;
  return !!session.value && current !== 30 && current !== 40;
});

const remainText = computed(() => {
  if (!session.value?.expireTime) {
    return '-';
  }
  const remain = new Date(session.value.expireTime).getTime() - now.value;
  if (remain <= 0) {
    return '已过期';
  }
  const seconds = Math.ceil(remain / 1000);
  const minutes = Math.floor(seconds / 60);
  const restSeconds = seconds % 60;
  return `${minutes}分${String(restSeconds).padStart(2, '0')}秒`;
});

async function handleCreate() {
  creating.value = true;
  try {
    const data = await createAttachmentScan({ ...form.value });
    session.value = data;
    status.value = {
      ...data,
      files: [],
      maxFileCount: form.value.maxFileCount || 9,
      uploadedCount: 0,
      title: form.value.title || '扫码上传附件',
    };
    message.success('二维码已生成');
    startPolling();
  } finally {
    creating.value = false;
  }
}

async function refreshStatus() {
  if (!session.value) {
    return;
  }
  status.value = await getAttachmentScanStatus(session.value.sessionId);
  if (!canPoll.value) {
    stopPolling();
  }
}

async function handleCancel() {
  if (!session.value) {
    return;
  }
  canceling.value = true;
  try {
    await cancelAttachmentScan(session.value.sessionId);
    message.success('已取消');
    await refreshStatus();
  } finally {
    canceling.value = false;
  }
}

function startPolling() {
  stopPolling();
  void refreshStatus();
  pollTimer = setInterval(refreshStatus, 2000);
  clockTimer = setInterval(() => {
    now.value = Date.now();
    if (!canPoll.value) {
      stopPolling();
    }
  }, 1000);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = undefined;
  }
  if (clockTimer) {
    clearInterval(clockTimer);
    clockTimer = undefined;
  }
}

function formatSize(size: number) {
  if (size >= 1024 * 1024) {
    return `${(size / 1024 / 1024).toFixed(2)} MB`;
  }
  if (size >= 1024) {
    return `${(size / 1024).toFixed(1)} KB`;
  }
  return `${size} B`;
}

onBeforeUnmount(stopPolling);
</script>

<template>
  <Page auto-content-height title="扫码上传附件测试">
    <div class="grid gap-4 lg:grid-cols-[360px_1fr]">
      <Card title="生成二维码">
        <Form layout="vertical">
          <Form.Item label="标题">
            <Input v-model:value="form.title" :maxlength="100" />
          </Form.Item>
          <Form.Item label="业务类型">
            <Input v-model:value="form.bizType" :maxlength="64" />
          </Form.Item>
          <Form.Item label="业务单号">
            <Input v-model:value="form.bizNo" :maxlength="64" />
          </Form.Item>
          <Form.Item label="业务 ID">
            <InputNumber v-model:value="form.bizId" class="w-full" :min="1" />
          </Form.Item>
          <Form.Item label="最大附件数">
            <InputNumber
              v-model:value="form.maxFileCount"
              class="w-full"
              :max="9"
              :min="1"
            />
          </Form.Item>
          <Button
            block
            type="primary"
            :loading="creating"
            @click="handleCreate"
          >
            生成上传二维码
          </Button>
        </Form>
      </Card>

      <Card title="二维码与上传结果">
        <div v-if="session" class="grid gap-6 xl:grid-cols-[260px_1fr]">
          <div class="flex flex-col items-center gap-3">
            <QRCode :value="session.qrUrl" :size="220" />
            <a :href="session.qrUrl" target="_blank" rel="noreferrer">
              打开手机上传页
            </a>
            <Space>
              <Button @click="refreshStatus">刷新状态</Button>
              <Button danger :loading="canceling" @click="handleCancel">
                取消会话
              </Button>
            </Space>
          </div>
          <div class="min-w-0">
            <Descriptions bordered :column="2" size="small">
              <Descriptions.Item label="状态">
                <Tag :color="statusColor[status?.status || session.status]">
                  {{ statusText[status?.status || session.status] }}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="剩余时间">
                {{ remainText }}
              </Descriptions.Item>
              <Descriptions.Item label="已上传">
                {{ status?.uploadedCount || 0 }} /
                {{ status?.maxFileCount || form.maxFileCount || 9 }}
              </Descriptions.Item>
              <Descriptions.Item label="过期时间">
                {{ formatDate(session.expireTime) }}
              </Descriptions.Item>
            </Descriptions>
            <List
              class="mt-4"
              :data-source="status?.files || []"
              bordered
              size="small"
            >
              <template #renderItem="{ item }">
                <List.Item>
                  <a :href="item.fileUrl" target="_blank" rel="noreferrer">
                    {{ item.fileName }}
                  </a>
                  <span class="text-muted-foreground">
                    {{ formatSize(item.fileSize) }}
                  </span>
                </List.Item>
              </template>
              <template #header>附件列表</template>
            </List>
          </div>
        </div>
        <Empty v-else description="请先生成二维码" />
      </Card>
    </div>
  </Page>
</template>
