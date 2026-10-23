import type { ErpCustomerApi } from '#/api/erp/sale/customer';

export const CUSTOMER_BUSINESS_LICENSE_ACCEPT_EXTS = new Set([
  'jpeg',
  'jpg',
  'png',
]);
export const CUSTOMER_BUSINESS_LICENSE_MAX_SIZE = 10 * 1024 * 1024;
export const CUSTOMER_BUSINESS_LICENSE_IMAGE_TYPE = '营业执照';
export const CUSTOMER_BUSINESS_LICENSE_UPLOAD_DIRECTORY =
  'erp/customer/business-license';

export function hasCustomerBusinessLicenseText(value: unknown) {
  return (
    value !== undefined && value !== null && String(value).trim().length > 0
  );
}

export function readCustomerBusinessLicenseFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result || '')));
    reader.addEventListener('error', () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

export function toCustomerBusinessLicenseBase64Payload(dataUrl: string) {
  const separatorIndex = dataUrl.indexOf(',');
  return separatorIndex === -1 ? dataUrl : dataUrl.slice(separatorIndex + 1);
}

export function resolveCustomerBusinessLicenseUploadedFileUrl(response: any) {
  const url =
    response?.url ??
    response?.data?.url ??
    response?.data ??
    response?.response?.url ??
    response;
  return typeof url === 'string' ? url : '';
}

function getOcrText(
  result: ErpCustomerApi.BusinessLicenseOcrResp | undefined,
  field: keyof ErpCustomerApi.BusinessLicenseOcrResp,
) {
  const value = result?.[field];
  return hasCustomerBusinessLicenseText(value)
    ? String(value).trim()
    : undefined;
}

export function buildCustomerBusinessInfoFromOcr(
  customerId: number,
  result: ErpCustomerApi.BusinessLicenseOcrResp | undefined,
) {
  if (!result) {
    return undefined;
  }

  const data: ErpCustomerApi.CustomerBusinessInfo = {
    customerId,
    creditCode:
      getOcrText(result, 'unifiedCreditCode') || getOcrText(result, 'taxNo'),
    legalPerson: getOcrText(result, 'legalPerson'),
    registeredCapital: getOcrText(result, 'registeredCapital'),
    establishDate: getOcrText(result, 'establishDate'),
    businessScope: getOcrText(result, 'businessScope'),
    rawData: JSON.stringify(result.raw || result.data || result),
    remark: '营业执照 OCR 自动识别',
  };

  return data;
}
