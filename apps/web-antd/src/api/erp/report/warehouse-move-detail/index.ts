import type { PageParam, PageResult } from '@vben/request';

import { requestClient } from '#/api/request';

export namespace ErpWarehouseMoveDetailReportApi {
  export interface Query extends PageParam {
    approveTime?: string[];
    fromWarehouseId?: number;
    keyword?: string;
    orderDirection?: 'asc' | 'desc';
    orderField?: string;
    toWarehouseId?: number;
  }

  export interface Row {
    approveTime?: string;
    approveUserName?: string;
    brand?: string;
    costAmount?: null | number | string;
    costPrice?: null | number | string;
    costVisible?: boolean;
    count?: number | string;
    creatorName?: string;
    documentNo?: string;
    drawingNo?: string;
    featureCode?: string;
    fromShelf?: string;
    fromWarehouseId?: number;
    fromWarehouseName?: string;
    hiddenFields?: string[];
    itemId: number;
    itemRemark?: string;
    moveAmount?: null | number | string;
    moveId?: number;
    movePrice?: null | number | string;
    movePriceVisible?: boolean;
    originPlace?: string;
    productCode?: string;
    productId?: number;
    productName?: string;
    standard?: string;
    toShelf?: string;
    toWarehouseId?: number;
    toWarehouseName?: string;
    unitName?: string;
    vehicleModel?: string;
  }

  export interface Summary {
    costVisible?: boolean;
    hiddenFields?: string[];
    movePriceVisible?: boolean;
    rowCount?: number;
    totalCostAmount?: null | number | string;
    totalCount?: null | number | string;
    totalMoveAmount?: null | number | string;
  }
}

const BASE_URL = '/erp/business-report/warehouse-move-detail';

export function getWarehouseMoveDetailPage(
  params: ErpWarehouseMoveDetailReportApi.Query,
) {
  return requestClient.get<PageResult<ErpWarehouseMoveDetailReportApi.Row>>(
    `${BASE_URL}/page`,
    { params, timeout: 60_000 },
  );
}

export function getWarehouseMoveDetailSummary(
  params: ErpWarehouseMoveDetailReportApi.Query,
) {
  return requestClient.get<ErpWarehouseMoveDetailReportApi.Summary>(
    `${BASE_URL}/summary`,
    { params, timeout: 30_000 },
  );
}

export function exportWarehouseMoveDetail(
  params: ErpWarehouseMoveDetailReportApi.Query,
) {
  return requestClient.download(`${BASE_URL}/export-excel`, { params });
}
