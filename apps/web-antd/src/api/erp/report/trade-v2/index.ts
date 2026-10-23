import { requestClient } from '#/api/request';

export namespace TradeReportApi {
  export type Kind = 'purchase' | 'sale';
  export type Scalar = boolean | number | string | null;
  export interface Row {
    [key: string]: Scalar | Record<string, string> | undefined;
    metricStates?: Record<string, string>;
    returnMode?: 10 | 20 | null;
    sourcePurchaseInId?: number | null;
    sourcePurchaseInItemId?: number | null;
    sourcePurchaseInNo?: string | null;
    sourceOrderId?: number | null;
    sourceOrderItemId?: number | null;
    sourceOrderNo?: string | null;
    originalBizId?: number | null;
    originalBizItemId?: number | null;
    originalBizNo?: string | null;
    returnDocumentOrderId?: number | null;
    returnDocumentOrderItemId?: number | null;
    returnDocumentOrderNo?: string | null;
    traceSaleReturnId?: number | null;
    traceSaleReturnItemId?: number | null;
    traceSaleReturnNo?: string | null;
    costBasis?: 'CURRENT_AVERAGE' | 'MANUAL_CONFIRMED' | null;
    returnDifferenceStatus?: string | null;
  }
  export interface Query {
    postedFrom: string;
    postedTo: string;
    pageNo: number;
    pageSize: number;
    groupBy: string;
    orderField: 'postedAt' | 'postingId';
    orderDirection: 'asc' | 'desc';
    businessTypes?: string[];
    bizNo?: string;
    productId?: number;
    customerId?: number;
    supplierId?: number;
    saleUserId?: number;
    purchaser?: string;
    brand?: string;
    oeNumber?: string;
    categoryId?: number;
    accountingDeptIds?: number[];
    stockDeptIds?: number[];
    warehouseIds?: number[];
    noOriginalSale?: boolean;
  }
  export interface Bundle {
    page: { list: Row[]; total: number };
    summary: Row;
    queryContext: { postedFrom: string; postedTo: string; consistency: string };
  }
  export interface Status {
    status: 'DISABLED' | 'INVALID_CONFIG' | 'READY' | 'SCHEMA_MISSING';
    reason: string;
    cutoverAt?: string;
    availableBusinessTypes: string[];
    coverageWarnings: string[];
  }
  export interface Option {
    value: number | string | null;
    label: string;
  }
}
const base = (kind: TradeReportApi.Kind) => `/erp/business-report/${kind}-v2`;
export const getTradeStatus = (kind: TradeReportApi.Kind) =>
  requestClient.get<TradeReportApi.Status>(`${base(kind)}/status`);
export const getTradePage = (
  kind: TradeReportApi.Kind,
  query: TradeReportApi.Query,
  grouped: boolean,
) =>
  requestClient.get<TradeReportApi.Bundle>(
    `${base(kind)}/${grouped ? 'group-page' : 'item-page'}`,
    { params: query },
  );
export const getTradeOptions = (
  kind: TradeReportApi.Kind,
  query: TradeReportApi.Query,
  dimension: string,
  keyword?: string,
) =>
  requestClient.get<{ list: TradeReportApi.Option[]; total: number }>(
    `${base(kind)}/filter-options`,
    { params: { ...query, dimension, keyword } },
  );
export const exportTradeReport = (
  kind: TradeReportApi.Kind,
  query: TradeReportApi.Query,
  grouped: boolean,
) =>
  requestClient.download(`${base(kind)}/export-excel`, {
    params: { ...query, view: grouped ? 'GROUP' : 'DETAIL' },
  });
