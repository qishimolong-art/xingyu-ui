import type { PageParam, PageResult } from '@vben/request';

import { stockDecimalRequestClient as requestClient } from '#/views/erp/stock/utils/stock-decimal-request';

export namespace ErpStockInDetailReportApi {
  export type DateTimeValue = number | string;

  export interface Query extends Partial<PageParam> {
    approveTime?: string[];
    businessUserId?: number;
    categoryId?: number;
    deptId?: number;
    documentTime?: string[];
    keyword?: string;
    orderDirection?: string;
    orderField?: string;
    relatedPartyId?: number;
    warehouseId?: number;
  }

  export interface Row {
    approveTime?: DateTimeValue;
    brand?: string;
    businessUserId?: number;
    businessUserName?: string;
    categoryId?: number;
    categoryName?: string;
    count?: number;
    deptId?: number;
    deptName?: string;
    documentNo?: string;
    documentTime?: DateTimeValue;
    drawingNo?: string;
    hiddenFields?: string[];
    itemId: number;
    itemRemark?: string;
    originPlace?: string;
    priceVisible?: boolean;
    productCode?: string;
    productId?: number;
    productName?: string;
    productPrice?: number;
    relatedPartyId?: number;
    relatedPartyName?: string;
    shelf?: string;
    standard?: string;
    stockInId?: number;
    totalAmount?: number;
    vehicleModel?: string;
    warehouseId?: number;
    warehouseName?: string;
  }

  export interface Summary {
    hiddenFields?: string[];
    priceVisible?: boolean;
    rowCount?: number;
    totalAmount?: number;
    totalCount?: number;
  }
}

export function getStockInDetailReportPage(
  params: ErpStockInDetailReportApi.Query,
) {
  return requestClient.get<PageResult<ErpStockInDetailReportApi.Row>>(
    '/erp/stock-in-detail-report/page',
    { params },
  );
}

export function getStockInDetailReportSummary(
  params: ErpStockInDetailReportApi.Query,
) {
  return requestClient.get<ErpStockInDetailReportApi.Summary>(
    '/erp/stock-in-detail-report/summary',
    { params },
  );
}

export function exportStockInDetailReport(
  params: ErpStockInDetailReportApi.Query,
) {
  return requestClient.download('/erp/stock-in-detail-report/export-excel', {
    params,
  });
}
