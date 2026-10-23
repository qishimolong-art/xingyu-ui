import { message } from 'ant-design-vue';

import {
  ERP_DETAIL_PERMISSION_ERROR_TEXT,
  isErpPermissionError,
} from '#/views/erp/utils/detail-load-error';

export function getPurchaseFormErrorText(error: unknown) {
  if (!error || typeof error !== 'object') {
    return '';
  }
  const data = (error as any).response?.data ?? (error as any).data ?? error;
  return data?.msg ?? data?.message ?? data?.error ?? '';
}

export function showPurchaseFormOpenError(moduleName: string, error: unknown) {
  console.error(`Failed to open ${moduleName} form`, error);
  const errorText = getPurchaseFormErrorText(error);
  message.destroy();
  if (isErpPermissionError(error)) {
    message.error(ERP_DETAIL_PERMISSION_ERROR_TEXT);
    return;
  }
  message.error(
    errorText && errorText !== '系统异常'
      ? `加载${moduleName}失败：${errorText}`
      : `加载${moduleName}失败，请稍后重试`,
  );
}

export function showPurchaseFormActionError(
  moduleName: string,
  error: unknown,
  fallback = '操作失败，请稍后重试',
) {
  console.error(`Failed to submit ${moduleName} form`, error);
  const errorText = getPurchaseFormErrorText(error);
  message.destroy();
  message.error(errorText && errorText !== '系统异常' ? errorText : fallback);
}
