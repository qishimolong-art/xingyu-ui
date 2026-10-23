import type { PageParam, PageResult } from '@vben/request';

import { requestClient } from '#/api/request';

export namespace ErpSalePickDeliveryDetailReportApi {
  export type Mode = 'delivery' | 'pick';
  export interface Query extends Partial<PageParam> {
    availableCountMax?: number;
    availableCountMin?: number;
    completeTime?: [string, string];
    countMax?: number;
    countMin?: number;
    customerId?: number;
    deliveredCountMax?: number;
    deliveredCountMin?: number;
    deptId?: number;
    operationTime?: [string, string];
    operationUserId?: number;
    orderDirection?: 'asc' | 'desc';
    orderField?: string;
    pickedCountMax?: number;
    pickedCountMin?: number;
    productKeyword?: string;
    remainingCountMax?: number;
    remainingCountMin?: number;
    saleOutDate?: [string, string];
    saleOutNo?: string;
    saleUserId?: number;
    sourceCartNo?: string;
    status?: number;
    taskCreateDate?: [string, string];
    warehouseId?: number;
  }
  export interface Row {
    availableDeliveryCount?: number;
    completeTime?: string;
    count?: number;
    customerName?: string;
    deliveredCount?: number;
    deptName?: string;
    hiddenFields?: string[];
    itemId: number;
    operationTime?: string;
    operationUserName?: string;
    orderId?: number;
    packageQty?: number;
    pickedCount?: number;
    pieceCount?: number;
    productCode?: string;
    productName?: string;
    remainingDeliveryCount?: number;
    remainingPickCount?: number;
    saleOutDate?: string;
    saleOutId?: number;
    saleOutNo?: string;
    saleUserName?: string;
    sequence?: number;
    sourceCartId?: number;
    sourceCartNo?: string;
    sourceType?: number;
    standard?: string;
    status?: number;
    statusText?: string;
    taskCreateDate?: string;
    taskId?: number;
    warehouseName?: string;
    warehousePosition?: string;
  }
  export interface Summary {
    availableDeliveryCount?: number;
    deliveredCount?: number;
    hiddenFields?: string[];
    pickedCount?: number;
    pieceCount?: number;
    remainingDeliveryCount?: number;
    remainingPickCount?: number;
    rowCount?: number;
    totalCount?: number;
  }
}

const prefix = (mode: ErpSalePickDeliveryDetailReportApi.Mode) =>
  `/erp/sale-${mode}-detail-report`;

export function getSalePickDeliveryDetailReportPage(
  mode: ErpSalePickDeliveryDetailReportApi.Mode,
  params: ErpSalePickDeliveryDetailReportApi.Query,
) {
  return requestClient.get<PageResult<ErpSalePickDeliveryDetailReportApi.Row>>(
    `${prefix(mode)}/page`,
    { params },
  );
}

export function getSalePickDeliveryDetailReportSummary(
  mode: ErpSalePickDeliveryDetailReportApi.Mode,
  params: ErpSalePickDeliveryDetailReportApi.Query,
) {
  return requestClient.get<ErpSalePickDeliveryDetailReportApi.Summary>(
    `${prefix(mode)}/summary`,
    { params },
  );
}

export function exportSalePickDeliveryDetailReport(
  mode: ErpSalePickDeliveryDetailReportApi.Mode,
  params: ErpSalePickDeliveryDetailReportApi.Query,
) {
  return requestClient.download(`${prefix(mode)}/export-excel`, { params });
}
