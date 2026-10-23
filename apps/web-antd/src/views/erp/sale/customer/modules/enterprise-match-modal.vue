<script lang="ts" setup>
import type { UploadFile, UploadProps } from 'ant-design-vue';

import type { ErpCustomerApi } from '#/api/erp/sale/customer';

import { ref, onBeforeUnmount } from 'vue';

import { useVbenModal } from '@vben/common-ui';
import { IconifyIcon } from '@vben/icons';

import { Button, Descriptions, message, Upload } from 'ant-design-vue';

import {
  createCustomerBusinessInfo,
  createCustomerImage,
  recognizeCustomerBusinessLicense,
} from '#/api/erp/sale/customer';
import { useUpload } from '#/components/upload/use-upload';

import {
  buildCustomerBusinessInfoFromOcr,
  CUSTOMER_BUSINESS_LICENSE_ACCEPT_EXTS,
  CUSTOMER_BUSINESS_LICENSE_IMAGE_TYPE,
  CUSTOMER_BUSINESS_LICENSE_MAX_SIZE,
  CUSTOMER_BUSINESS_LICENSE_UPLOAD_DIRECTORY,
  hasCustomerBusinessLicenseText,
  readCustomerBusinessLicenseFileAsDataUrl,
  resolveCustomerBusinessLicenseUploadedFileUrl,
  toCustomerBusinessLicenseBase64Payload,
} from '../utils/business-license';
import { confirmBusinessLicenseNameMismatch } from '../utils/business-license-confirm';
import { getBusinessLicenseNameMismatch } from '../utils/business-license-ocr';

const emit = defineEmits<{
  success: [];
}>();

let requestSequence = 0;
onBeforeUnmount(() => {
  requestSequence += 1;
});
const customer = ref<ErpCustomerApi.Customer>();
const businessLicenseFile = ref<File>();
const businessLicenseFileList = ref<UploadFile[]>([]);
const recognizing = ref(false);
const uploader = useUpload(CUSTOMER_BUSINESS_LICENSE_UPLOAD_DIRECTORY);

function resetState() {
  customer.value = undefined;
  businessLicenseFile.value = undefined;
  businessLicenseFileList.value = [];
  recognizing.value = false;
}

const beforeUpload: UploadProps['beforeUpload'] = (file) => {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (!extension || !CUSTOMER_BUSINESS_LICENSE_ACCEPT_EXTS.has(extension)) {
    message.error('营业执照仅支持 jpg、jpeg、png 格式');
    return Upload.LIST_IGNORE;
  }
  if (file.size > CUSTOMER_BUSINESS_LICENSE_MAX_SIZE) {
    message.error('营业执照图片不能超过 10MB');
    return Upload.LIST_IGNORE;
  }
  requestSequence += 1;
  recognizing.value = false;
  businessLicenseFile.value = file as File;
  businessLicenseFileList.value = [file as unknown as UploadFile];
  return false;
};

function handleRemove() {
  requestSequence += 1;
  recognizing.value = false;
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

async function saveBusinessLicenseImage(customerId: number, file: File) {
  const uploadResponse = await uploader.httpRequest(file);
  const imageUrl =
    resolveCustomerBusinessLicenseUploadedFileUrl(uploadResponse);
  if (!hasCustomerBusinessLicenseText(imageUrl)) {
    throw new Error('Business license image upload response has no url');
  }
  await createCustomerImage({
    customerId,
    imageType: CUSTOMER_BUSINESS_LICENSE_IMAGE_TYPE,
    imageName: file.name || CUSTOMER_BUSINESS_LICENSE_IMAGE_TYPE,
    imageUrl,
    sort: 0,
  });
}

async function handleRecognizeAndSave() {
  if (recognizing.value) return;
  const customerId = customer.value?.id;
  if (!customerId) {
    message.warning('缺少客户信息，请刷新列表后重试');
    return;
  }
  if (!businessLicenseFile.value) {
    message.warning('请先上传营业执照图片');
    return;
  }

  const current = requestSequence;
  recognizing.value = true;
  const selectedFile = businessLicenseFile.value;
  const selectedCustomer = customer.value;
  try {
    const image = toCustomerBusinessLicenseBase64Payload(
      await readCustomerBusinessLicenseFileAsDataUrl(businessLicenseFile.value),
    );
    const result = await recognizeCustomerBusinessLicense({ image });
    if (current !== requestSequence) return;
    if (
      selectedFile !== businessLicenseFile.value ||
      selectedCustomer !== customer.value
    )
      return;
    if (result?.success === false) {
      message.error(result.message || '营业执照识别失败，请重新上传或稍后重试');
      return;
    }
    const nameMismatch = getBusinessLicenseNameMismatch(
      customer.value?.name,
      result,
    );
    const confirmed = await confirmBusinessLicenseNameMismatch(
      nameMismatch,
      '继续保存',
    );
    if (
      current !== requestSequence ||
      !confirmed ||
      selectedFile !== businessLicenseFile.value ||
      selectedCustomer !== customer.value
    )
      return;
    const businessInfo = buildCustomerBusinessInfoFromOcr(customerId, result);
    if (!businessInfo) {
      message.warning('营业执照识别完成，但未识别到可保存的工商信息');
      return;
    }

    await Promise.all([
      createCustomerBusinessInfo(businessInfo),
      saveBusinessLicenseImage(customerId, selectedFile),
    ]);
    if (current !== requestSequence) {
      emit('success');
      return;
    }
    message.success('营业执照识别完成，工商信息已同步');
    emit('success');
    await modalApi.close();
  } catch (error) {
    if (current !== requestSequence) return;
    console.error('Failed to recognize customer enterprise match', error);
    message.error('营业执照识别或保存失败，请稍后重试');
  } finally {
    if (current === requestSequence) recognizing.value = false;
  }
}

const [Modal, modalApi] = useVbenModal({
  destroyOnClose: true,
  async onConfirm() {
    await handleRecognizeAndSave();
  },
  onOpenChange(isOpen: boolean) {
    requestSequence += 1;
    if (!isOpen) {
      resetState();
      return;
    }
    customer.value = modalApi.getData<ErpCustomerApi.Customer>();
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
    <div class="customer-enterprise-match">
      <Descriptions :column="1" size="small" bordered>
        <Descriptions.Item label="客户">
          {{ customer?.name || '-' }}
        </Descriptions.Item>
        <Descriptions.Item label="当前状态">未同步</Descriptions.Item>
      </Descriptions>

      <div class="customer-enterprise-match__upload">
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
.customer-enterprise-match {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.customer-enterprise-match__upload {
  min-height: 72px;
}

.customer-enterprise-match__upload :deep(.ant-btn) {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
</style>
