<script lang="ts" setup>
import type { FileType } from 'ant-design-vue/es/upload/interface';

import type { ErpCustomerApi } from '#/api/erp/sale/customer';

import { computed, onBeforeUnmount, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';
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
  downloadCustomerImportFailures,
  getCustomerImportTemplate,
  importCustomer,
} from '#/api/erp/sale/customer';
import ImportTemplateGuide from '#/components/import-template-guide/ImportTemplateGuide.vue';

const emit = defineEmits(['success']);

const uploadFile = ref<File | null>(null);
const importing = ref(false);
const errorDownloading = ref(false);
let requestSequence = 0;
onBeforeUnmount(() => {
  requestSequence += 1;
});
const importResult = ref<ErpCustomerApi.CustomerImportResult | null>(null);

const failureDetails = computed(() => {
  return (importResult.value?.failureDetails ?? []).map((item) =>
    typeof item === 'string' ? { reason: item } : item,
  );
});

const hasFailureDetails = computed(() => failureDetails.value.length > 0);

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
    typeof result.createCount === 'number'
      ? `新增 ${result.createCount} 条`
      : '',
    typeof result.updateCount === 'number'
      ? `更新 ${result.updateCount} 条`
      : '',
    `失败 ${result.failureCount ?? 0} 条`,
  ]
    .filter(Boolean)
    .join('，');
}

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    if (importing.value) return;
    if (importResult.value) {
      await modalApi.close();
      return;
    }
    if (!uploadFile.value) {
      message.warning('请先选择 Excel 文件');
      return;
    }
    const current = requestSequence;
    importing.value = true;
    modalApi.lock();
    try {
      const result = await importCustomer(uploadFile.value);
      if ((result?.successCount ?? 0) > 0) emit('success');
      if (current !== requestSequence) return;
      importResult.value = result;
      if ((result?.failureCount ?? 0) > 0) {
        message.warning(buildImportResultMessage(result));
        return;
      }
      await modalApi.close();
      message.success(buildImportResultMessage(result));
    } finally {
      if (current === requestSequence) {
        importing.value = false;
        modalApi.unlock();
      }
    }
  },
  onOpenChange(isOpen: boolean) {
    requestSequence += 1;
    importing.value = false;
    if (!isOpen) {
      uploadFile.value = null;
      importResult.value = null;
    }
  },
});

function beforeUpload(file: FileType) {
  if (importing.value) return Upload.LIST_IGNORE;
  uploadFile.value = file as unknown as File;
  importResult.value = null;
  return false;
}

async function handleDownloadErrors() {
  const recordId = importResult.value?.recordId;
  if (!recordId || errorDownloading.value) return;
  errorDownloading.value = true;
  try {
    downloadFileFromBlobPart({
      fileName: '客户导入错误数据.xlsx',
      source: await downloadCustomerImportFailures(recordId),
    });
  } finally {
    errorDownloading.value = false;
  }
}
async function handleDownload() {
  const data = await getCustomerImportTemplate();
  downloadFileFromBlobPart({ fileName: '客户导入模板.xls', source: data });
}
</script>

<template>
  <Modal title="导入客户" class="w-1/3">
    <div class="mx-4 my-4 space-y-4">
      <ImportTemplateGuide
        summary="客户导入模板用于批量维护客户资料，系统会根据客户编码执行新增或更新，并支持导入时分配部门。"
        :tips="[
          '黄色表头为必填项，请按模板填写后再导入。',
          '客户编码用于识别唯一客户，请勿重复填写不同客户。',
          '更新已有客户时，空白字段不会覆盖原有资料。',
          '所属部门、适用部门请填写系统中已启用且当前用户有权限的部门名称。',
          '适用部门支持用逗号、顿号或分号分隔多个部门；已有客户填写部门会覆盖原部门分配，部门留空则不覆盖。',
          '地区、客户等级、负责人等关联字段请填写系统中已存在且启用的数据。',
        ]"
      />
      <Upload :max-count="1" accept=".xls,.xlsx" :before-upload="beforeUpload">
        <Button type="primary">
          <IconifyIcon icon="lucide:upload" />
          选择 Excel 文件
        </Button>
      </Upload>
      <div
        v-if="importResult"
        class="rounded border p-3"
        :class="hasFailureDetails ? 'bg-red-50' : 'bg-green-50'"
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
            <Tag :color="hasFailureDetails ? 'red' : 'default'">失败</Tag>
            {{ importResult.failureCount ?? 0 }} 条
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
              <span v-if="item.code">（{{ item.code }}）</span>
              ：{{ item.reason || '未知错误' }}
            </div>
          </div>
        </div>
      </div>
    </div>
    <template #prepend-footer>
      <div class="flex flex-auto items-center gap-2">
        <Button
          v-if="importResult?.recordId && hasFailureDetails"
          :loading="errorDownloading"
          @click="handleDownloadErrors"
        >
          下载错误数据
        </Button>
        <Button @click="handleDownload">
          <IconifyIcon icon="lucide:download" />
          下载导入模板
        </Button>
      </div>
    </template>
    <template #confirmText>
      {{ importResult ? '关闭' : '开始导入' }}
    </template>
  </Modal>
</template>
