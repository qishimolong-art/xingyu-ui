import type { PageParam, PageResult } from '@vben/request';

import { requestClient } from '#/api/request';

export namespace ErpSaleQuoteDetailReportApi {
  export interface Query extends Partial<PageParam> {
    customerId?: number;
    deptId?: number;
    documentNo?: string;
    orderDirection?: 'asc' | 'desc';
    orderField?: string;
    orderStatus?: number;
    outStatus?: number;
    productKeyword?: string;
    quoteDate?: [string, string];
    saleUserId?: number;
    sourceNo?: string;
    warehouseId?: number;
  }

  export interface Row {
    actualOutCount?: number;
    availableCount?: number;
    brand?: string;
    convertedCount?: number;
    count?: number;
    creatorName?: string;
    customerCode?: string;
    customerName?: string;
    customerRegion?: string;
    deptName?: string;
    documentNo?: string;
    documentRemark?: string;
    drawingNo?: string;
    expectedDeliveryDate?: string;
    featureCode?: string;
    giftFlagText?: string;
    itemId: number;
    orderStatus?: string;
    originPlace?: string;
    outStatus?: string;
    pendingOutCount?: number;
    priceType?: string;
    priceVisible?: boolean;
    productCode?: string;
    productId?: number;
    productName?: string;
    productPrice?: number;
    quoteDate?: string;
    quoteId?: number;
    saleUserName?: string;
    sourceBusinessId?: number;
    sourceDocumentTypeCode?: string;
    sourceNo?: string;
    standard?: string;
    stockCount?: number;
    stockCountAtOrder?: number;
    stockMax?: number;
    stockMin?: number;
    stockStandard?: number;
    totalPrice?: number;
    unitName?: string;
    vehicleModel?: string;
    warehouseId?: number;
    warehouseName?: string;
    warehousePosition?: string;
  }

  export interface Summary {
    actualOutCount?: number;
    convertedCount?: number;
    pendingOutCount?: number;
    priceVisible?: boolean;
    rowCount?: number;
    totalCount?: number;
    totalPrice?: number;
  }
}

export function getSaleQuoteDetailReportPage(
  params: ErpSaleQuoteDetailReportApi.Query,
) {
  return requestClient.get<PageResult<ErpSaleQuoteDetailReportApi.Row>>(
    '/erp/sale-quote-detail-report/page',
    { params },
  );
}

export function getSaleQuoteDetailReportSummary(
  params: ErpSaleQuoteDetailReportApi.Query,
) {
  return requestClient.get<ErpSaleQuoteDetailReportApi.Summary>(
    '/erp/sale-quote-detail-report/summary',
    { params },
  );
}

export function exportSaleQuoteDetailReport(
  params: ErpSaleQuoteDetailReportApi.Query,
) {
  return requestClient.download('/erp/sale-quote-detail-report/export-excel', {
    params,
  });
}
