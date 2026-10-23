import type { PageParam, PageResult } from '@vben/request';

import { requestClient } from '#/api/request';

export namespace ErpPurchaseInDetailReportApi {
  export type DocumentType =
    | 'PURCHASE_ADJUST'
    | 'PURCHASE_IN'
    | 'PURCHASE_RETURN';

  export interface Query extends Partial<PageParam> {
    approveDate?: [string, string];
    documentNo?: string;
    documentTypes?: DocumentType[];
    factoryOrderNo?: string;
    invoiceStatus?: string;
    orderDirection?: 'asc' | 'desc';
    orderField?: string;
    productKeyword?: string;
    purchaserKeyword?: string;
    sourceNo?: string;
    supplierId?: number;
    warehouseId?: number;
  }

  export interface Row {
    approveDate?: string;
    brand?: string;
    businessId?: number;
    count?: number;
    creatorName?: string;
    documentNo?: string;
    documentRemark?: string;
    documentType?: string;
    documentTypeCode?: DocumentType;
    drawingNo?: string;
    factoryCode?: string;
    factoryModel?: string;
    factoryName?: string;
    factoryOrderNo?: string;
    featureCode?: string;
    freight1?: number;
    freightIncludedPrice?: number;
    freightType1?: string;
    invoiceAmount?: number;
    invoiceStatus?: string;
    itemId: number;
    itemRemark?: string;
    originPlace?: string;
    previousPurchasePrice?: number;
    priceVisible?: boolean;
    productCode?: string;
    productId?: number;
    productName?: string;
    productPrice?: number;
    purchaserName?: string;
    rowKey: string;
    sourceBusinessId?: number;
    sourceDocumentTypeCode?: 'PURCHASE_IN' | 'PURCHASE_ORDER';
    sourceNo?: string;
    standard?: string;
    supplierCode?: string;
    supplierName?: string;
    supplierRegion?: string;
    totalAmount?: number;
    unitName?: string;
    vehicleModel?: string;
    warehouseId?: number;
    warehouseName?: string;
    warehousePosition?: string;
  }

  export interface Summary {
    freightAmount?: number;
    invoiceAmount?: number;
    priceVisible?: boolean;
    rowCount?: number;
    totalAmount?: number;
    totalCount?: number;
  }
}

export function getPurchaseInDetailReportPage(
  params: ErpPurchaseInDetailReportApi.Query,
) {
  return requestClient.get<PageResult<ErpPurchaseInDetailReportApi.Row>>(
    '/erp/purchase-in-detail-report/page',
    { params },
  );
}

export function getPurchaseInDetailReportSummary(
  params: ErpPurchaseInDetailReportApi.Query,
) {
  return requestClient.get<ErpPurchaseInDetailReportApi.Summary>(
    '/erp/purchase-in-detail-report/summary',
    { params },
  );
}

export function exportPurchaseInDetailReport(
  params: ErpPurchaseInDetailReportApi.Query,
) {
  return requestClient.download('/erp/purchase-in-detail-report/export-excel', {
    params,
  });
}
