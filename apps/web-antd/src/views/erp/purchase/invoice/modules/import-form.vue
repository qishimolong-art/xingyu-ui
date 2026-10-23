<script lang="ts" setup>
import type { FileType } from 'ant-design-vue/es/upload/interface';
import type { ErpPurchaseInvoiceApi } from '#/api/erp/purchase/invoice';

import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';
import { downloadFileFromBlobPart } from '@vben/utils';

import { Button, message, Upload } from 'ant-design-vue';

import {
  downloadPurchaseInvoiceImportFailureDetails,
  getPurchaseInvoiceImportTemplate,
  importPurchaseInvoice,
} from '#/api/erp/purchase/invoice';
import ImportTemplateGuide from '#/components/import-template-guide/ImportTemplateGuide.vue';

import PurchaseImportResultPanel from '../../components/PurchaseImportResultPanel.vue';

const emit = defineEmits(['success']);

const uploadFile = ref<File | null>(null);
const importResult =
  ref<ErpPurchaseInvoiceApi.PurchaseInvoiceImportResult | null>(null);
const canDownloadFailureDetails = computed(
  () =>
    (importResult.value?.failureCount ?? 0) > 0 &&
    !!importResult.value?.recordId,
);

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
      const data = await importPurchaseInvoice(uploadFile.value);
      importResult.value = data;
      if ((data.failureCount ?? 0) > 0) {
        const firstFailure = data.failureDetails?.[0];
        message.warning(
          firstFailure
            ? formatFailureMessage(firstFailure)
            : '导入失败，请检查 Excel 数据',
        );
        return;
      }
      if ((data.successCount ?? 0) <= 0) {
        message.warning('没有可导入的采购票据数据');
        return;
      }
      await modalApi.close();
      emit('success', data);
      message.success('采购票据导入成功');
    } finally {
      modalApi.unlock();
    }
  },
  onOpenChange(isOpen) {
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

function formatFailureMessage(
  failure: NonNullable<
    ErpPurchaseInvoiceApi.PurchaseInvoiceImportResult['failureDetails']
  >[number],
) {
  const orderNo = failure.orderNo ? `，${failure.orderNo}` : '';
  return `导入失败：第 ${failure.rowNo} 行${orderNo}，${failure.reason}`;
}

async function handleDownload() {
  const data = await getPurchaseInvoiceImportTemplate();
  const errorMessage = await resolveDownloadErrorMessage(data);
  if (errorMessage) {
    message.error(errorMessage);
    return;
  }
  downloadFileFromBlobPart({ fileName: '采购票据导入模板.xls', source: data });
}

async function handleDownloadFailureDetails() {
  const recordId = importResult.value?.recordId;
  if (!recordId) {
    message.warning('暂无可下载的错误数据');
    return;
  }
  const data = await downloadPurchaseInvoiceImportFailureDetails(recordId);
  downloadFileFromBlobPart({ fileName: '采购票据错误数据.xls', source: data });
}

async function resolveDownloadErrorMessage(data: BlobPart) {
  if (!(data instanceof Blob) || !data.type.includes('application/json')) {
    return '';
  }
  const text = await data.text();
  try {
    const result = JSON.parse(text) as { message?: string; msg?: string };
    return result.msg || result.message || text;
  } catch {
    return text;
  }
}
</script>

<template>
  <Modal
    title="导入采购票据"
    class="top-6 max-h-[calc(100vh-48px)] w-[720px] max-w-[calc(100vw-32px)]"
    content-class="!min-h-0"
    footer-class="flex-wrap gap-2 border-t bg-background px-4 py-3"
    :fullscreen-button="false"
  >
    <div class="mx-4 my-4 space-y-4">
      <ImportTemplateGuide
        summary="采购票据导入模板用于批量创建待审批采购票据，系统会识别主表行和明细行并组装成完整票据。"
        :tips="[
          '同一张采购票据下的供应商、票据类型、发票号等主表信息需保持一致。',
          '配件编码、配件名称、厂家编码是三选一字段：填写其中任意一个即可；如果多列都填，必须对应同一配件。',
          '数量、不含税单价等明细字段请按模板示例填写。',
        ]"
      />
      <Upload :max-count="1" accept=".xls,.xlsx" :before-upload="beforeUpload">
        <Button type="primary">
          <IconifyIcon icon="lucide:upload" />
          选择 Excel 文件
        </Button>
      </Upload>
      <PurchaseImportResultPanel
        v-if="importResult"
        document-name="采购票据"
        :result="importResult"
      />
    </div>
    <template #prepend-footer>
      <div class="flex flex-auto flex-wrap items-center gap-2">
        <Button @click="handleDownload">
          <IconifyIcon icon="lucide:download" />
          下载导入模板
        </Button>
        <Button
          v-if="canDownloadFailureDetails"
          danger
          @click="handleDownloadFailureDetails"
        >
          <IconifyIcon icon="lucide:download" />
          下载错误数据
        </Button>
      </div>
    </template>
    <template #confirmText>
      {{ importResult ? '关闭' : '开始导入' }}
    </template>
  </Modal>
</template>
