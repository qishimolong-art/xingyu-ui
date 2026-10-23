<script lang="ts" setup>
import type { UploadFile, UploadProps } from 'ant-design-vue';

import type { ErpSaleOutApi } from '#/api/erp/sale/out';

import { computed, ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { useAppConfig } from '@vben/hooks';
import { PlusOutlined } from '@vben/icons';

import { message, Upload } from 'ant-design-vue';

import { uploadSaleOutExpressFile } from '#/api/erp/sale/out';

import { resolveSaleOutExpressFileUrl } from '../utils/express-file';

defineOptions({ name: 'ErpSaleOutExpressUpload' });

const emit = defineEmits<{
  success: [];
}>();

const saleOut = ref<ErpSaleOutApi.SaleOut>();
const currentExpressFileUrl = ref('');
const selectedFile = ref<File>();
const fileList = ref<UploadFile[]>([]);
const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);

function createExistingFile(url: string): UploadFile {
  return {
    name: '当前快递单',
    status: 'done',
    uid: 'existing-express-file',
    url,
  };
}

const beforeUpload: UploadProps['beforeUpload'] = (file) => {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (!extension || !['jpeg', 'jpg', 'png'].includes(extension)) {
    message.error('快递单仅支持 jpg、jpeg、png 格式');
    return Upload.LIST_IGNORE;
  }
  if (file.size > 5 * 1024 * 1024) {
    message.error('快递单图片不能超过 5MB');
    return Upload.LIST_IGNORE;
  }
  selectedFile.value = file as File;
  fileList.value = [file as unknown as UploadFile];
  return false;
};

function handleRemove() {
  selectedFile.value = undefined;
  fileList.value = [];
  return true;
}

function handlePreview(file: UploadFile) {
  if (file.url) {
    window.open(
      resolveSaleOutExpressFileUrl(file.url, apiURL),
      '_blank',
      'noopener,noreferrer',
    );
    return;
  }
  if (!file.originFileObj) return;
  const previewUrl = URL.createObjectURL(file.originFileObj as Blob);
  window.open(previewUrl, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(previewUrl), 60_000);
}

const modalTitle = computed(() => {
  const no = saleOut.value?.no ? ` - ${saleOut.value.no}` : '';
  return `上传快递单${no}`;
});

const [Modal, modalApi] = useVbenModal({
  async onConfirm() {
    if (!saleOut.value?.id) {
      message.error('销售单数据不存在');
      return;
    }
    if (!selectedFile.value) {
      if (currentExpressFileUrl.value) {
        await modalApi.close();
        return;
      }
      message.warning('请先上传快递单图片');
      return;
    }
    modalApi.lock();
    try {
      await uploadSaleOutExpressFile(saleOut.value.id, selectedFile.value);
      emit('success');
      await modalApi.close();
      message.success('快递单上传成功');
    } finally {
      modalApi.unlock();
    }
  },
  onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      saleOut.value = undefined;
      currentExpressFileUrl.value = '';
      selectedFile.value = undefined;
      fileList.value = [];
      return;
    }
    const data = modalApi.getData<ErpSaleOutApi.SaleOut>();
    saleOut.value = data;
    currentExpressFileUrl.value = resolveSaleOutExpressFileUrl(
      data?.expressFileUrl || '',
      apiURL,
    );
    fileList.value = currentExpressFileUrl.value
      ? [createExistingFile(currentExpressFileUrl.value)]
      : [];
  },
});
</script>

<template>
  <Modal :title="modalTitle" class="w-[520px]">
    <div class="mx-4 my-4 space-y-4">
      <div class="text-sm text-gray-500">
        请上传销售单对应的快递单图片，已上传时可在此替换。
      </div>
      <Upload
        :before-upload="beforeUpload"
        :file-list="fileList"
        :max-count="1"
        :multiple="false"
        accept=".jpg,.jpeg,.png,image/jpeg,image/png"
        list-type="picture-card"
        @preview="handlePreview"
        @remove="handleRemove"
      >
        <div v-if="fileList.length === 0">
          <PlusOutlined />
          <div class="mt-2">选择图片</div>
        </div>
      </Upload>
      <div class="text-xs text-gray-500">
        支持 jpg / jpeg / png，单张不超过 5MB；点击“确认”后上传并绑定销售单。
      </div>
    </div>
  </Modal>
</template>
