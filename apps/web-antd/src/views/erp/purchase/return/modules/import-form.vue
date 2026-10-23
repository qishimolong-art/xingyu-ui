<script lang="ts" setup>
import type { FileType } from 'ant-design-vue/es/upload/interface';
import type { ErpPurchaseReturnApi } from '#/api/erp/purchase/return';

import { ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';
import { downloadFileFromBlobPart } from '@vben/utils';

import { Button, message, Upload } from 'ant-design-vue';

import {
  getPurchaseReturnImportTemplate,
  importPurchaseReturn,
} from '#/api/erp/purchase/return';
import ImportTemplateGuide from '#/components/import-template-guide/ImportTemplateGuide.vue';

const emit = defineEmits<{
  success: [data: ErpPurchaseReturnApi.PurchaseReturnImportResult];
}>();

const uploadFile = ref<File | null>(null);

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    if (!uploadFile.value) {
      message.warning('请先选择 Excel 文件');
      return;
    }
    modalApi.lock();
    try {
      const data = await importPurchaseReturn(uploadFile.value);
      emit('success', data);
      await modalApi.close();
      message.success('导入解析成功');
    } finally {
      modalApi.unlock();
    }
  },
  onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      uploadFile.value = null;
    }
  },
});

function beforeUpload(file: FileType) {
  uploadFile.value = file as unknown as File;
  return false;
}

async function handleDownload() {
  const data = await getPurchaseReturnImportTemplate();
  downloadFileFromBlobPart({
    fileName: '采购退货明细导入模板.xls',
    source: data,
  });
}
</script>

<template>
  <Modal title="导入采购退货明细" class="w-1/3">
    <div class="mx-4 my-4 space-y-4">
      <ImportTemplateGuide
        summary="采购退货明细模板用于解析当前退货单的产品行，上传后系统会将明细回填到创建表单。"
        :tips="[
          '配件编码、配件名称、厂家编码是三选一字段：填写其中任意一个即可；如果多列都填，必须对应同一配件。',
          '退货仓库、数量、单价等字段请按模板示例填写。',
        ]"
      />
      <Upload :max-count="1" accept=".xls,.xlsx" :before-upload="beforeUpload">
        <Button type="primary">
          <IconifyIcon icon="lucide:upload" />
          选择 Excel 文件
        </Button>
      </Upload>
    </div>
    <template #prepend-footer>
      <Button @click="handleDownload">
        <IconifyIcon icon="lucide:download" />
        下载明细模板
      </Button>
    </template>
  </Modal>
</template>
