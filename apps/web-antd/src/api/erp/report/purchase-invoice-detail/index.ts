import type { PageParam, PageResult } from '@vben/request';

import { requestClient } from '#/api/request';

export namespace ErpPurchaseInvoiceDetailReportApi {
  export type DateTimeValue = number | string;

  export interface Query extends Partial<PageParam> {
    amountMax?: number;
    amountMin?: number;
    approveDate?: string[];
    brand?: string;
    businessApproveDate?: string[];
    businessNo?: string;
    countMax?: number;
    countMin?: number;
    createDate?: string[];
    documentNo?: string;
    drawingNo?: string;
    invoiceDate?: string[];
    invoiceNo?: string;
    invoiceType?: string;
    itemRemark?: string;
    orderDirection?: string;
    orderField?: string;
    originPlace?: string;
    priceMax?: number;
    priceMin?: number;
    productKeyword?: string;
    settlementStatus?: string;
    standard?: string;
    supplierId?: number;
    vehicleModel?: string;
    weightMax?: number;
    weightMin?: number;
  }
  export interface Row {
    approveDate?: DateTimeValue;
    brand?: string;
    businessApproveDate?: DateTimeValue;
    businessNo?: string;
    count?: number;
    createDate?: DateTimeValue;
    documentNo?: string;
    drawingNo?: string;
    invoiceDate?: string;
    invoiceId: number;
    invoiceNo?: string;
    invoiceType?: string;
    itemId: number;
    itemRemark?: string;
    originPlace?: string;
    productCode?: string;
    productName?: string;
    productPrice?: number;
    sequence?: number;
    settlementStatus?: string;
    sourceDocId?: number;
    sourceType?: number;
    standard?: string;
    supplierName?: string;
    totalAmount?: number;
    unitName?: string;
    vehicleModel?: string;
    weight?: number;
    taxRate?: string;
    volume?: string;
    taxCategoryCode?: string;
    taxProductName?: string;
    taxProductModel?: string;
    taxUnit?: string;
  }
  export interface Summary {
    hiddenFields?: string[];
    priceVisible?: boolean;
    rowCount?: number;
    totalAmount?: number;
    totalCount?: number;
  }
}

export function getPurchaseInvoiceDetailReportPage(
  params: ErpPurchaseInvoiceDetailReportApi.Query,
) {
  return requestClient.get<PageResult<ErpPurchaseInvoiceDetailReportApi.Row>>(
    '/erp/purchase-invoice-detail-report/page',
    { params },
  );
}
export function getPurchaseInvoiceDetailReportSummary(
  params: ErpPurchaseInvoiceDetailReportApi.Query,
) {
  return requestClient.get<ErpPurchaseInvoiceDetailReportApi.Summary>(
    '/erp/purchase-invoice-detail-report/summary',
    { params },
  );
}
export function exportPurchaseInvoiceDetailReport(
  params: ErpPurchaseInvoiceDetailReportApi.Query,
) {
  return requestClient.download(
    '/erp/purchase-invoice-detail-report/export-excel',
    { params },
  );
}
