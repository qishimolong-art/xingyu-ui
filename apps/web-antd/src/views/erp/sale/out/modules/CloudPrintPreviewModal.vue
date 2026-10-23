<script lang="ts" setup>
import type { ErpPrintApi } from '#/api/erp/print';

import { computed, onBeforeUnmount, ref } from 'vue';

import { Alert, Button, message, Modal, Spin, Tabs } from 'ant-design-vue';

import {
  getSaleOutCloudPrintPreviewFile,
  previewSaleOutCloudPrint,
  submitSaleOutCloudPrint,
} from '#/api/erp/print';

type PreviewItemState = ErpPrintApi.CloudPrintPreviewItem & {
  blobUrl?: string;
  error?: string;
  loading?: boolean;
};

const emit = defineEmits<{
  confirmed: [tasks: ErpPrintApi.CloudPrintTask[]];
}>();

const openState = ref(false);
const previewLoading = ref(false);
const confirming = ref(false);
const preview = ref<ErpPrintApi.CloudPrintPreview>();
const items = ref<PreviewItemState[]>([]);
const activeItemId = ref('');
const now = ref(Date.now());
const context = ref<{
  itemOrderDirection?: 'asc' | 'desc';
  itemOrderField?: string;
  saleOutId: number;
  templateId: number | string;
}>();
let clock: ReturnType<typeof setInterval> | undefined;

const expired = computed(() => {
  const expiresAt = preview.value?.expiresAt;
  return !expiresAt || now.value >= new Date(expiresAt).getTime();
});
const allReady = computed(
  () =>
    items.value.length > 0 &&
    items.value.every((item) => item.blobUrl && !item.loading && !item.error),
);

function releaseBlobUrls() {
  items.value.forEach((item) => {
    if (item.blobUrl) URL.revokeObjectURL(item.blobUrl);
  });
  items.value = [];
}

function resetClock() {
  if (clock) clearInterval(clock);
  now.value = Date.now();
  clock = setInterval(() => {
    now.value = Date.now();
  }, 1000);
}

async function loadItem(item: PreviewItemState) {
  if (!preview.value) return;
  item.loading = true;
  item.error = undefined;
  if (item.blobUrl) {
    URL.revokeObjectURL(item.blobUrl);
    item.blobUrl = undefined;
  }
  try {
    const response = await getSaleOutCloudPrintPreviewFile({
      previewItemId: item.previewItemId,
      previewToken: preview.value.previewToken,
    });
    const blob = response instanceof Blob ? response : new Blob([response]);
    item.blobUrl = URL.createObjectURL(
      blob.type === 'application/pdf'
        ? blob
        : new Blob([blob], { type: 'application/pdf' }),
    );
  } catch (error: any) {
    item.error = error?.message || 'PDF 加载失败';
  } finally {
    item.loading = false;
  }
}

async function loadPreview() {
  if (!context.value) return;
  releaseBlobUrls();
  preview.value = undefined;
  previewLoading.value = true;
  try {
    const result = await previewSaleOutCloudPrint(context.value);
    preview.value = result;
    items.value = result.items.map((item) => ({ ...item, loading: true }));
    activeItemId.value = items.value[0]?.previewItemId || '';
    resetClock();
    await Promise.all(items.value.map(loadItem));
  } catch (error: any) {
    message.error(error?.message || '生成云打印预览失败');
  } finally {
    previewLoading.value = false;
  }
}

async function open(
  saleOutId: number,
  templateId: number | string,
  itemOrderField?: string,
  itemOrderDirection?: 'asc' | 'desc',
) {
  context.value = { saleOutId, templateId, itemOrderField, itemOrderDirection };
  openState.value = true;
  await loadPreview();
}

function close() {
  openState.value = false;
}

function afterClose() {
  releaseBlobUrls();
  preview.value = undefined;
  context.value = undefined;
  if (clock) clearInterval(clock);
  clock = undefined;
}

function openPdf(item: PreviewItemState) {
  if (item.blobUrl) window.open(item.blobUrl, '_blank', 'noopener,noreferrer');
}

function downloadPdf(item: PreviewItemState) {
  if (!item.blobUrl) return;
  const link = document.createElement('a');
  link.href = item.blobUrl;
  link.download = item.fileName;
  link.click();
}

async function confirmPrint() {
  if (!preview.value || !allReady.value || expired.value || confirming.value)
    return;
  confirming.value = true;
  try {
    const tasks = await submitSaleOutCloudPrint({
      previewToken: preview.value.previewToken,
    });
    emit('confirmed', tasks);
    close();
  } catch (error: any) {
    message.error(error?.message || '确认云打印失败，请重试');
  } finally {
    confirming.value = false;
  }
}

onBeforeUnmount(afterClose);
defineExpose({ open });
</script>

<template>
  <Modal
    v-model:open="openState"
    :after-close="afterClose"
    :closable="!confirming"
    :keyboard="!confirming"
    :mask-closable="false"
    title="云打印预览"
    width="92vw"
    @cancel="close"
  >
    <Spin :spinning="previewLoading">
      <Alert
        v-if="expired && preview"
        class="preview-alert"
        message="预览已过期，确认前请重新生成"
        show-icon
        type="warning"
      />
      <Tabs v-if="items.length" v-model:active-key="activeItemId">
        <Tabs.TabPane
          v-for="item in items"
          :key="item.previewItemId"
          :tab="`${item.warehouseName} · ${item.printerName} · ${item.copies}份`"
        >
          <div class="preview-toolbar">
            <span>仓库：{{ item.warehouseName }}</span>
            <span>打印机：{{ item.printerName }}</span>
            <span>份数：{{ item.copies }}</span>
            <Button
              :disabled="!item.blobUrl"
              size="small"
              @click="openPdf(item)"
            >
              新窗口查看
            </Button>
            <Button
              :disabled="!item.blobUrl"
              size="small"
              @click="downloadPdf(item)"
            >
              下载 PDF
            </Button>
          </div>
          <div class="preview-frame-wrap">
            <Spin v-if="item.loading" />
            <Alert
              v-else-if="item.error"
              :message="item.error"
              show-icon
              type="error"
            >
              <template #action>
                <Button size="small" @click="loadItem(item)">重试</Button>
              </template>
            </Alert>
            <iframe
              v-else-if="item.blobUrl"
              :src="item.blobUrl"
              class="preview-frame"
              title="云打印 PDF 预览"
            ></iframe>
          </div>
        </Tabs.TabPane>
      </Tabs>
    </Spin>
    <template #footer>
      <Button :disabled="confirming" @click="close">取消</Button>
      <Button
        :disabled="confirming"
        :loading="previewLoading"
        @click="loadPreview"
      >
        重新生成预览
      </Button>
      <Button
        :disabled="!allReady || expired"
        :loading="confirming"
        type="primary"
        @click="confirmPrint"
      >
        确认云打印
      </Button>
    </template>
  </Modal>
</template>

<style scoped>
.preview-alert {
  margin-bottom: 10px;
}

.preview-toolbar {
  display: flex;
  min-height: 36px;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 16px;
  margin-bottom: 8px;
}

.preview-frame-wrap {
  display: flex;
  height: calc(100vh - 260px);
  min-height: 420px;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  background: #f5f5f5;
  border: 1px solid #d9d9d9;
}

.preview-frame {
  width: 100%;
  height: 100%;
  border: 0;
}
</style>
