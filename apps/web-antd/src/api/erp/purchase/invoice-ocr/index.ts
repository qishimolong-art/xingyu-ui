import type { PageParam, PageResult } from '@vben/request';

import { requestClient } from '#/api/request';

export const PURCHASE_INVOICE_OCR_BATCH_STATUS = {
  DRAFT: 'DRAFT',
  RECOGNIZING: 'RECOGNIZING',
  RECOGNIZED: 'RECOGNIZED',
  MATCHED: 'MATCHED',
  CONFIRMED: 'CONFIRMED',
  FAILED: 'FAILED',
} as const;

export const PURCHASE_INVOICE_OCR_ITEM_STATUS = {
  PENDING: 'PENDING',
  OCR_FAILED: 'OCR_FAILED',
  NO_FACTORY_NO: 'NO_FACTORY_NO',
  NO_PURCHASE_IN: 'NO_PURCHASE_IN',
  AMOUNT_DIFF: 'AMOUNT_DIFF',
  MATCHED: 'MATCHED',
  CONFIRMED: 'CONFIRMED',
  IGNORED: 'IGNORED',
} as const;

export namespace ErpPurchaseInvoiceOcrApi {
  export type BatchStatus =
    (typeof PURCHASE_INVOICE_OCR_BATCH_STATUS)[keyof typeof PURCHASE_INVOICE_OCR_BATCH_STATUS];

  export type ItemStatus =
    (typeof PURCHASE_INVOICE_OCR_ITEM_STATUS)[keyof typeof PURCHASE_INVOICE_OCR_ITEM_STATUS];

  export interface UploadFile {
    fileName: string;
    fileUrl: string;
    fileType?: string;
    fileSize?: number;
  }

  export interface UploadReq {
    remark?: string;
    autoProcess?: boolean;
    files: UploadFile[];
  }

  export interface UpdateFactoryOrderNoReq {
    factoryOrderNo: string;
  }

  export interface BatchPageReq extends PageParam {
    batchNo?: string;
    status?: BatchStatus | string;
    remark?: string;
  }

  export interface Batch {
    id?: number;
    batchNo?: string;
    status?: BatchStatus | string;
    fileCount?: number;
    generatedInvoiceCount?: number;
    remark?: string;
    errorMsg?: string;
    createTime?: string;
    updateTime?: string;
    items?: Item[];
  }

  export interface Item {
    id?: number;
    batchId?: number;
    status?: ItemStatus | string;
    fileName?: string;
    fileUrl?: string;
    fileType?: string;
    fileSize?: number;
    invoiceNo?: string;
    invoiceDate?: string;
    invoiceType?: string;
    totalAmount?: number | string;
    taxExclusiveAmount?: number | string;
    taxAmount?: number | string;
    invoiceRemark?: string;
    rawJson?: string;
    parsedFactoryOrderNo?: string;
    factoryOrderNo?: string;
    matchedPurchaseInIds?: string;
    matchedPurchaseInNos?: string;
    purchaseInTotalAmount?: number | string;
    diffAmount?: number | string;
    generatedInvoiceId?: number;
    errorMsg?: string;
    createTime?: string;
    updateTime?: string;
  }
}

export function uploadPurchaseInvoiceOcrBatch(
  data: ErpPurchaseInvoiceOcrApi.UploadReq,
) {
  return requestClient.post<number>('/erp/purchase-invoice-ocr/upload', data);
}

export function getPurchaseInvoiceOcrBatchPage(
  params: ErpPurchaseInvoiceOcrApi.BatchPageReq,
) {
  return requestClient.get<PageResult<ErpPurchaseInvoiceOcrApi.Batch>>(
    '/erp/purchase-invoice-ocr/page',
    { params },
  );
}

export function getPurchaseInvoiceOcrBatch(batchId: number) {
  return requestClient.get<ErpPurchaseInvoiceOcrApi.Batch>(
    `/erp/purchase-invoice-ocr/${batchId}`,
  );
}

export function recognizePurchaseInvoiceOcrBatch(batchId: number) {
  return requestClient.post<boolean>(
    `/erp/purchase-invoice-ocr/${batchId}/recognize`,
  );
}

export function matchPurchaseInvoiceOcrBatch(batchId: number) {
  return requestClient.post<boolean>(
    `/erp/purchase-invoice-ocr/${batchId}/match`,
  );
}

export function confirmPurchaseInvoiceOcrBatch(batchId: number) {
  return requestClient.post<boolean>(
    `/erp/purchase-invoice-ocr/${batchId}/confirm`,
  );
}

export function updatePurchaseInvoiceOcrItemFactoryOrderNo(
  itemId: number,
  data: ErpPurchaseInvoiceOcrApi.UpdateFactoryOrderNoReq,
) {
  return requestClient.post<boolean>(
    `/erp/purchase-invoice-ocr/item/${itemId}/update-factory-order-no`,
    data,
  );
}

export function exportPurchaseInvoiceOcrErrors(batchId: number) {
  return requestClient.download(
    `/erp/purchase-invoice-ocr/${batchId}/export-errors`,
  );
}
