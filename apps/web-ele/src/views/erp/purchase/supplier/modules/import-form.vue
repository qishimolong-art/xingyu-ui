<script lang="ts" setup>
import { useVbenModal } from '@vben/common-ui';
import { downloadFileFromBlobPart } from '@vben/utils';

import { ElButton, ElMessage, ElUpload } from 'element-plus';

import {
  importSupplier,
  importSupplierTemplate,
} from '#/api/erp/purchase/supplier';
import { $t } from '#/locales';

const emit = defineEmits(['success']);

let uploadFile: File | null = null;

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    if (!uploadFile) {
      ElMessage.warning('请先选择 Excel 文件');
      return;
    }
    modalApi.lock();
    try {
      await importSupplier({ file: uploadFile });
      await modalApi.close();
      emit('success');
      ElMessage.success($t('ui.actionMessage.operationSuccess'));
    } finally {
      modalApi.unlock();
    }
  },
  onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      uploadFile = null;
    }
  },
});

/** 文件改变时 */
function handleChange(file: any) {
  if (file.raw) {
    uploadFile = file.raw;
  }
}

/** 下载模版 */
async function handleDownload() {
  const data = await importSupplierTemplate();
  downloadFileFromBlobPart({ fileName: '供应商导入模板.xls', source: data });
}
</script>

<template>
  <Modal title="供应商导入" class="w-1/3">
    <div class="mx-4 my-4">
      <p class="mb-4 text-gray-500">
        请上传 Excel 文件，系统将按供应商编码导入；若编码为空则按默认规则新增。
      </p>
      <ElUpload
        :limit="1"
        accept=".xls,.xlsx"
        :on-change="handleChange"
        :auto-upload="false"
      >
        <ElButton type="primary">选择 Excel 文件</ElButton>
      </ElUpload>
    </div>
    <template #prepend-footer>
      <div class="flex flex-auto items-center">
        <ElButton @click="handleDownload">下载导入模板</ElButton>
      </div>
    </template>
  </Modal>
</template>
