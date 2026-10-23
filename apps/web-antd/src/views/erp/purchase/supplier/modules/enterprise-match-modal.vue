<script lang="ts" setup>
import type { UploadFile, UploadProps } from 'ant-design-vue';

import type { ErpSupplierApi } from '#/api/erp/purchase/supplier';

import { ref } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import { Button, Descriptions, message, Upload } from 'ant-design-vue';

import { recognizeSupplierBusinessLicense } from '#/api/erp/purchase/supplier';
import { createSupplierBusinessInfo } from '#/api/erp/purchase/supplier/business-info';
import { createSupplierImage } from '#/api/erp/purchase/supplier/image';
import { useUpload } from '#/components/upload/use-upload';
import { confirmBusinessLicenseNameMismatch } from '#/views/erp/sale/customer/utils/business-license-confirm';
import { getBusinessLicenseNameMismatch } from '#/views/erp/sale/customer/utils/business-license-ocr';

import {
  buildSupplierBusinessInfoFromOcr,
  hasSupplierBusinessLicenseText,
  readSupplierBusinessLicenseFileAsDataUrl,
  resolveSupplierBusinessLicenseUploadedFileUrl,
  SUPPLIER_BUSINESS_LICENSE_ACCEPT_EXTS,
  SUPPLIER_BUSINESS_LICENSE_IMAGE_TYPE,
  SUPPLIER_BUSINESS_LICENSE_MAX_SIZE,
  SUPPLIER_BUSINESS_LICENSE_UPLOAD_DIRECTORY,
  toSupplierBusinessLicenseBase64Payload,
} from '../utils/business-license';

const emit = defineEmits<{
  success: [];
}>();

const supplier = ref<ErpSupplierApi.Supplier>();
const businessLicenseFile = ref<File>();
const businessLicenseFileList = ref<UploadFile[]>([]);
const recognizing = ref(false);
let requestVersion = 0;
function invalidateRecognition() {
  requestVersion += 1;
  recognizing.value = false;
}
const uploader = useUpload(SUPPLIER_BUSINESS_LICENSE_UPLOAD_DIRECTORY);

function resetState() {
  invalidateRecognition();
  supplier.value = undefined;
  businessLicenseFile.value = undefined;
  businessLicenseFileList.value = [];
  recognizing.value = false;
}

const beforeUpload: UploadProps['beforeUpload'] = (file) => {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (!extension || !SUPPLIER_BUSINESS_LICENSE_ACCEPT_EXTS.has(extension)) {
    message.error('营业执照仅支持 jpg、jpeg、png 格式');
    return Upload.LIST_IGNORE;
  }
  if (file.size > SUPPLIER_BUSINESS_LICENSE_MAX_SIZE) {
    message.error('营业执照图片不能超过 10MB');
    return Upload.LIST_IGNORE;
  }
  invalidateRecognition();
  businessLicenseFile.value = file as File;
  businessLicenseFileList.value = [file as unknown as UploadFile];
  return false;
};

function handleRemove() {
  invalidateRecognition();
  businessLicenseFile.value = undefined;
  businessLicenseFileList.value = [];
  return true;
}

function handlePreview(file: UploadFile) {
  const source = file.url || file.thumbUrl;
  if (source) {
    window.open(source, '_blank', 'noopener,noreferrer');
    return;
  }
  const originFile = file.originFileObj;
  if (!originFile) return;
  const previewUrl = URL.createObjectURL(originFile as Blob);
  window.open(previewUrl, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(previewUrl), 60_000);
}

async function saveBusinessLicenseImage(
  supplierId: number,
  file: File,
  isCurrent: () => boolean,
) {
  const uploadResponse = await uploader.httpRequest(file);
  const imageUrl =
    resolveSupplierBusinessLicenseUploadedFileUrl(uploadResponse);
  if (!hasSupplierBusinessLicenseText(imageUrl)) {
    throw new Error('Business license image upload response has no url');
  }
  if (!isCurrent()) return;
  await createSupplierImage({
    supplierId,
    imageType: SUPPLIER_BUSINESS_LICENSE_IMAGE_TYPE,
    imageName: file.name || SUPPLIER_BUSINESS_LICENSE_IMAGE_TYPE,
    imageUrl,
    sort: 0,
  });
}

async function handleRecognizeAndSave() {
  if (recognizing.value) return;
  const supplierId = supplier.value?.id;
  if (!supplierId) {
    message.warning('缺少供应商信息，请刷新列表后重试');
    return;
  }
  if (!businessLicenseFile.value) {
    message.warning('请先上传营业执照图片');
    return;
  }

  const selectedFile = businessLicenseFile.value;
  const currentRequest = ++requestVersion;
  const isCurrent = () => currentRequest === requestVersion;
  recognizing.value = true;
  try {
    const image = toSupplierBusinessLicenseBase64Payload(
      await readSupplierBusinessLicenseFileAsDataUrl(selectedFile),
    );
    if (!isCurrent()) return;
    const result = await recognizeSupplierBusinessLicense({ image });
    if (!isCurrent()) return;
    if (result?.success === false) {
      message.error(result.message || '营业执照识别失败，请重新上传或稍后重试');
      return;
    }
    const confirmed = await confirmBusinessLicenseNameMismatch(
      getBusinessLicenseNameMismatch(supplier.value?.name, result, '供应商'),
      '继续保存',
    );
    if (!confirmed || !isCurrent()) return;
    const businessInfo = buildSupplierBusinessInfoFromOcr(supplierId, result);
    if (!businessInfo) {
      message.warning('营业执照识别完成，但未识别到可保存的工商信息');
      return;
    }

    await Promise.all([
      createSupplierBusinessInfo(businessInfo),
      saveBusinessLicenseImage(supplierId, selectedFile, isCurrent),
    ]);
    if (!isCurrent()) return;
    message.success('营业执照识别完成，工商信息已同步');
    emit('success');
    await modalApi.close();
  } catch (error) {
    if (!isCurrent()) return;
    console.error('Failed to recognize supplier enterprise match', error);
    message.error('营业执照识别或保存失败，请稍后重试');
  } finally {
    if (isCurrent()) recognizing.value = false;
  }
}

const [Modal, modalApi] = useVbenModal({
  destroyOnClose: true,
  async onConfirm() {
    await handleRecognizeAndSave();
  },
  onOpenChange(isOpen: boolean) {
    if (!isOpen) {
      resetState();
      return;
    }
    invalidateRecognition();
    supplier.value = modalApi.getData<ErpSupplierApi.Supplier>();
  },
});

defineExpose({
  modalApi,
});
</script>

<template>
  <Modal
    class="w-[640px]"
    title="企业匹配"
    :confirm-loading="recognizing"
    confirm-text="识别并同步"
  >
    <div class="supplier-enterprise-match">
      <Descriptions :column="1" size="small" bordered>
        <Descriptions.Item label="供应商">
          {{ supplier?.name || '-' }}
        </Descriptions.Item>
        <Descriptions.Item label="当前状态">未同步</Descriptions.Item>
      </Descriptions>

      <div class="supplier-enterprise-match__upload">
        <Upload
          :before-upload="beforeUpload"
          :file-list="businessLicenseFileList"
          :max-count="1"
          :multiple="false"
          accept=".jpg,.jpeg,.png,image/jpeg,image/png"
          @preview="handlePreview"
          @remove="handleRemove"
        >
          <Button>
            <IconifyIcon icon="lucide:upload" />
            上传营业执照
          </Button>
        </Upload>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
.supplier-enterprise-match {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.supplier-enterprise-match__upload {
  min-height: 72px;
}

.supplier-enterprise-match__upload :deep(.ant-btn) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
</style>
