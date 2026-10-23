<script lang="ts" setup>
import type { FileType } from 'ant-design-vue/es/upload/interface';

import { useVbenModal } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';
import { downloadFileFromBlobPart } from '@vben/utils';

import { Button, message, Upload } from 'ant-design-vue';

import {
  getPurchaseOrderDetailImportTemplate,
  parsePurchaseOrderDetailImportExcel,
} from '#/api/erp/purchase/order';
import ImportTemplateGuide from '#/components/import-template-guide/ImportTemplateGuide.vue';

const emit = defineEmits(['success']);

let uploadFile: File | null = null;

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    if (!uploadFile) {
      message.warning('请先选择 Excel 文件');
      return;
    }
    modalApi.lock();
    try {
      const data = await parsePurchaseOrderDetailImportExcel(uploadFile);
      await modalApi.close();
      emit('success', data);
      message.success('导入解析成功');
    } finally {
      modalApi.unlock();
    }
  },
  onOpenChange(isOpen) {
    if (!isOpen) {
      uploadFile = null;
    }
  },
});

function beforeUpload(file: FileType) {
  uploadFile = file as unknown as File;
  return false;
}

async function handleDownload() {
  const data = await getPurchaseOrderDetailImportTemplate();
  downloadFileFromBlobPart({
    fileName: '采购订单明细导入模板.xls',
    source: data,
  });
}
</script>

<template>
  <Modal
    title="导入采购订单明细"
    class="w-[720px] max-w-[calc(100vw-32px)]"
    content-class="!flex-none"
    :fullscreen-button="false"
  >
    <div class="mx-4 my-4 space-y-4">
      <ImportTemplateGuide
        summary="采购订单明细模板用于解析当前采购订单的配件行，上传后系统会按配件编码或配件名称匹配配件并回填明细。"
        :tips="[
          '配件编码、配件名称、厂家编码是三选一字段：填写其中任意一个即可；如果多列都填，必须对应同一配件。',
          '数量、单价、税率、仓库等字段请按模板示例填写。',
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
      <div class="flex flex-auto items-center">
        <Button @click="handleDownload">
          <IconifyIcon icon="lucide:download" />
          下载明细模板
        </Button>
      </div>
    </template>
  </Modal>
</template>
