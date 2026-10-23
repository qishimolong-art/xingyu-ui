<script lang="ts" setup>
import type { UploadFile, UploadProps } from 'ant-design-vue';

import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import {
  Alert,
  Button,
  Checkbox,
  Input,
  message,
  Upload,
} from 'ant-design-vue';

import { uploadPurchaseInvoiceOcrBatch } from '#/api/erp/purchase/invoice-ocr';
import { uploadFile as uploadInfraFile } from '#/api/infra/file';

defineOptions({ name: 'ErpPurchaseInvoiceOcrUploadModal' });

const emit = defineEmits<{
  success: [batchId: number];
}>();

const selectedFiles = ref<File[]>([]);
const fileList = ref<UploadFile[]>([]);
const remark = ref('');
const autoProcess = ref(true);

const acceptExts = ['pdf', 'jpg', 'jpeg', 'png'];
const confirmText = computed(() =>
  autoProcess.value ? '上传并自动处理' : '仅上传批次',
);

const beforeUpload: UploadProps['beforeUpload'] = (file) => {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (!extension || !acceptExts.includes(extension)) {
    message.error('发票文件仅支持 pdf、jpg、jpeg、png 格式');
    return Upload.LIST_IGNORE;
  }
  if (file.size > 20 * 1024 * 1024) {
    message.error('单个发票文件不能超过 20MB');
    return Upload.LIST_IGNORE;
  }
  selectedFiles.value.push(file as File);
  fileList.value.push(file as unknown as UploadFile);
  return false;
};

function handleRemove(file: UploadFile) {
  const index = fileList.value.findIndex((item) => item.uid === file.uid);
  if (index >= 0) {
    fileList.value.splice(index, 1);
    selectedFiles.value.splice(index, 1);
  }
  return true;
}

function resetState() {
  selectedFiles.value = [];
  fileList.value = [];
  remark.value = '';
  autoProcess.value = true;
}

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    if (selectedFiles.value.length === 0) {
      message.warning('请先选择发票文件');
      return;
    }
    modalApi.lock();
    try {
      const files = [];
      for (const file of selectedFiles.value) {
        const uploadResult = await uploadInfraFile({
          directory: 'erp/purchase-invoice-ocr',
          file,
        });
        const fileUrl = resolveUploadUrl(uploadResult);
        if (!fileUrl) {
          message.error(`文件 ${file.name} 上传后未返回地址`);
          return;
        }
        files.push({
          fileName: file.name,
          fileUrl,
          fileType: file.type,
          fileSize: file.size,
        });
      }
      const batchId = await uploadPurchaseInvoiceOcrBatch({
        remark: remark.value?.trim() || undefined,
        autoProcess: autoProcess.value,
        files,
      });
      emit('success', batchId);
      await modalApi.close();
      message.success(
        autoProcess.value
          ? '发票已上传，自动处理已结束，请查看结果'
          : '发票批次已创建',
      );
    } finally {
      modalApi.unlock();
    }
  },
  onOpenChange(isOpen) {
    if (!isOpen) {
      resetState();
    }
  },
});

function resolveUploadUrl(result: any) {
  if (typeof result === 'string') return result;
  return result?.url || result?.data?.url || result?.data || '';
}
</script>

<template>
  <Modal title="上传发票" class="w-[620px]">
    <div class="invoice-ocr-upload">
      <Alert
        show-icon
        type="info"
        message="默认上传后自动识别并匹配入库"
        description="系统会先上传文件，再调用 OCR 识别并按厂家单号汇总匹配采购入库；异常结果会直接显示在当前批次明细中。"
      />
      <Upload
        :before-upload="beforeUpload"
        :file-list="fileList"
        :max-count="20"
        :multiple="true"
        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
        @remove="handleRemove"
      >
        <Button type="primary">
          <IconifyIcon icon="lucide:upload" />
          选择发票文件
        </Button>
      </Upload>
      <div class="invoice-ocr-upload__hint">
        支持 PDF、JPG、JPEG、PNG，单个文件不超过
        20MB；同一批次内会按厂家单号汇总金额。
      </div>
      <Checkbox v-model:checked="autoProcess">
        上传后自动 OCR 识别并匹配入库
      </Checkbox>
      <Input.TextArea
        v-model:value="remark"
        :maxlength="200"
        :rows="3"
        placeholder="批次备注，可填写本次上传来源或处理说明"
        show-count
      />
    </div>
    <template #confirmText>
      {{ confirmText }}
    </template>
  </Modal>
</template>

<style scoped>
.invoice-ocr-upload {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
}

.invoice-ocr-upload__hint {
  color: hsl(var(--muted-foreground));
  font-size: 12px;
  line-height: 20px;
}
</style>
