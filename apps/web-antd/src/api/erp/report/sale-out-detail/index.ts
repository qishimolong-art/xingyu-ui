import type { PageParam, PageResult } from '@vben/request';

import { requestClient } from '#/api/request';

export namespace ErpSaleOutDetailReportApi {
  export type DocumentType = 'SALE_ADJUST' | 'SALE_OUT' | 'SALE_RETURN';

  export interface Query extends Partial<PageParam> {
    approveDate?: [string, string];
    customerId?: number;
    deptId?: number;
    documentNo?: string;
    documentTypes?: DocumentType[];
    invoiceStatus?: string;
    orderDirection?: 'asc' | 'desc';
    orderField?: string;
    productKeyword?: string;
    saleUserKeyword?: string;
    sourceNo?: string;
    thirdPartyNo?: string;
    warehouseId?: number;
  }

  export interface Row {
    approveDate?: string;
    brand?: string;
    businessId?: number;
    costVisible?: boolean;
    creatorName?: string;
    count?: number;
    customerCode?: string;
    customerName?: string;
    customerRegion?: string;
    deptName?: string;
    documentNo?: string;
    documentRemark?: string;
    documentType?: string;
    documentTypeCode?: DocumentType;
    drawingNo?: string;
    factoryCode?: string;
    factoryModel?: string;
    factoryName?: string;
    featureCode?: string;
    freightAmount?: number;
    freightIncludedPrice?: number;
    freightType?: string;
    giftFlagText?: string;
    grossProfitAmount?: number;
    grossProfitRate?: number;
    invoiceAmount?: number;
    invoiceStatus?: string;
    itemId: number;
    itemRemark?: string;
    originPlace?: string;
    previousSalePrice?: number;
    priceVisible?: boolean;
    productCode?: string;
    productId?: number;
    productName?: string;
    productPrice?: number;
    rowKey: string;
    saleCostAmount?: number;
    saleCostPrice?: number;
    saleUserName?: string;
    sourceBusinessId?: number;
    sourceDocumentTypeCode?: string;
    sourceNo?: string;
    standard?: string;
    thirdPartyNo?: string;
    totalAmount?: number;
    unitName?: string;
    vehicleModel?: string;
    warehouseId?: number;
    warehouseName?: string;
    warehousePosition?: string;
  }

  export interface Summary {
    costVisible?: boolean;
    freightAmount?: number;
    invoiceAmount?: number;
    missingSaleCostCount?: number;
    priceVisible?: boolean;
    rowCount?: number;
    totalSaleCostAmount?: null | number;
    totalAmount?: number;
    totalCount?: number;
  }
}

export function getSaleOutDetailReportPage(
  params: ErpSaleOutDetailReportApi.Query,
) {
  return requestClient.get<PageResult<ErpSaleOutDetailReportApi.Row>>(
    '/erp/sale-out-detail-report/page',
    { params },
  );
}

export function getSaleOutDetailReportSummary(
  params: ErpSaleOutDetailReportApi.Query,
) {
  return requestClient.get<ErpSaleOutDetailReportApi.Summary>(
    '/erp/sale-out-detail-report/summary',
    { params },
  );
}

export function exportSaleOutDetailReport(
  params: ErpSaleOutDetailReportApi.Query,
) {
  return requestClient.download('/erp/sale-out-detail-report/export-excel', {
    params,
  });
}
