import { Modal } from 'ant-design-vue';

import { getBusinessLicenseNameMismatch } from './business-license-ocr';

export function confirmBusinessLicenseNameMismatch(
  mismatch: ReturnType<typeof getBusinessLicenseNameMismatch>,
  okText: string,
): Promise<boolean> {
  if (!mismatch) return Promise.resolve(true);
  return new Promise((resolve) => {
    Modal.confirm({
      title: mismatch.message,
      content: mismatch.description,
      okText,
      cancelText: '取消',
      autoFocusButton: 'cancel',
      maskClosable: false,
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
      afterClose: () => resolve(false),
    });
  });
}
