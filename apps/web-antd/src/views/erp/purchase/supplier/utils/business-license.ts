import type { ErpSupplierApi } from '#/api/erp/purchase/supplier';
import type { ErpSupplierBusinessInfoApi } from '#/api/erp/purchase/supplier/business-info';

export const SUPPLIER_BUSINESS_LICENSE_ACCEPT_EXTS = new Set([
  'jpeg',
  'jpg',
  'png',
]);
export const SUPPLIER_BUSINESS_LICENSE_MAX_SIZE = 10 * 1024 * 1024;
export const SUPPLIER_BUSINESS_LICENSE_IMAGE_TYPE = '营业执照';
export const SUPPLIER_BUSINESS_LICENSE_UPLOAD_DIRECTORY =
  'erp/supplier/business-license';

export function hasSupplierBusinessLicenseText(value: unknown) {
  return (
    value !== undefined &&
    value !== null &&
    String(value).trim().length > 0
  );
}

export function readSupplierBusinessLicenseFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener('load', () => resolve(String(reader.result || '')));
    reader.addEventListener('error', () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

export function toSupplierBusinessLicenseBase64Payload(dataUrl: string) {
  const separatorIndex = dataUrl.indexOf(',');
  return separatorIndex === -1 ? dataUrl : dataUrl.slice(separatorIndex + 1);
}

export function resolveSupplierBusinessLicenseUploadedFileUrl(response: any) {
  const url =
    response?.url ??
    response?.data?.url ??
    response?.data ??
    response?.response?.url ??
    response;
  return typeof url === 'string' ? url : '';
}

function getOcrText(
  result: ErpSupplierApi.BusinessLicenseOcrResp | undefined,
  field: keyof ErpSupplierApi.BusinessLicenseOcrResp,
) {
  const value = result?.[field];
  return hasSupplierBusinessLicenseText(value) ? String(value).trim() : undefined;
}

export function buildSupplierBusinessInfoFromOcr(
  supplierId: number,
  result: ErpSupplierApi.BusinessLicenseOcrResp | undefined,
) {
  if (!result) {
    return undefined;
  }

  const data: ErpSupplierBusinessInfoApi.SupplierBusinessInfo = {
    supplierId,
    companyName: getOcrText(result, 'invoiceCompany'),
    creditCode:
      getOcrText(result, 'unifiedCreditCode') || getOcrText(result, 'taxNo'),
    legalPerson: getOcrText(result, 'legalPerson'),
    registeredAddress: getOcrText(result, 'invoiceAddress'),
    registeredCapital: getOcrText(result, 'registeredCapital'),
    establishDate: getOcrText(result, 'establishDate'),
    businessScope: getOcrText(result, 'businessScope'),
    rawData: JSON.stringify(result.raw || result.data || result),
    remark: '营业执照 OCR 自动识别',
  };

  return data;
}
