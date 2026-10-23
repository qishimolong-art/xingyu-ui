import type { PageResult } from '@vben/request';

import { requestClient } from '#/api/request';

export namespace StockReportV2Api {
  /** v2 接口以字符串返回 BigDecimal，禁止先经 Number 丢失精度。 */
  export type Decimal = string | null;
  export type ReportType = 'BALANCE' | 'MOVEMENT';
  export interface Status {
    status: 'DISABLED' | 'READY' | 'SCHEMA_MISSING' | 'INVALID_CONFIG';
    reason?: string;
    cutoverAt?: string;
  }
  export interface Query {
    postedFrom: string;
    postedTo: string;
    productId?: number;
    warehouseId?: number;
    stockDeptIds?: number[];
    bizTypes?: number[];
    batchNo?: string;
    pageNo?: number;
    pageSize?: number;
    orderField?: string;
    orderDirection?: 'asc' | 'desc';
  }
  export interface Row {
    stockId: number;
    productId: number;
    productCode?: string;
    productName?: string;
    warehouseId: number;
    warehouseName?: string;
    stockDeptId?: number;
    accountingDeptId?: number;
    financialMasked: boolean;
    settlementMasked: boolean;
    balanceMasked?: boolean;
    dataStatus?: string;
    byBizType?: BusinessTypeAmount[] | null;
    postingId?: number;
    bizType?: number;
    bizTypeName?: string;
    bizId?: number;
    bizItemId?: number;
    bizNo?: string;
    batchNo?: string;
    sourceBizType?: number;
    sourceBizId?: number;
    sourceBizItemId?: number;
    reversalPostingId?: number;
    postedAt?: string;
    bizDate?: string;
    cutoverAt?: string;
    /** 核算起点依据；缺余额时为null，不得推定人工期初。 */
    originKind?: 'MANUAL_OPENING' | 'NEW_DIMENSION' | null;
    availableFrom?: string | null;
    quantity?: Decimal;
    financialMovement?: Decimal;
    settlementMovement?: Decimal;
    balanceQuantity?: Decimal;
    financialBalance?: Decimal;
    settlementBalance?: Decimal;
    openingQuantity?: Decimal;
    inQuantity?: Decimal;
    outQuantity?: Decimal;
    closingQuantity?: Decimal;
    openingFinancialAmount?: Decimal;
    financialInAmount?: Decimal;
    financialOutAmount?: Decimal;
    closingFinancialAmount?: Decimal;
    openingSettlementAmount?: Decimal;
    settlementInAmount?: Decimal;
    settlementOutAmount?: Decimal;
    closingSettlementAmount?: Decimal;
  }
  export interface Summary {
    rowCount?: number;
    dataStatus?: 'COMPLETE' | 'INCOMPLETE';
    missingOpeningCount?: number;
    outsideCoverageCount?: number;
    staleCount?: number;
    financialMasked?: boolean;
    settlementMasked?: boolean;
    byBizType?: BusinessTypeAmount[] | null;
    openingQuantity?: Decimal;
    inQuantity?: Decimal;
    outQuantity?: Decimal;
    closingQuantity?: Decimal;
    openingFinancialAmount?: Decimal;
    financialInAmount?: Decimal;
    financialOutAmount?: Decimal;
    closingFinancialAmount?: Decimal;
    openingSettlementAmount?: Decimal;
    settlementInAmount?: Decimal;
    settlementOutAmount?: Decimal;
    closingSettlementAmount?: Decimal;
  }
  export interface ProductOption {
    id: number;
    code?: string;
    name: string;
  }
  export interface BusinessTypeAmount {
    bizType: number;
    bizTypeName?: string;
    stockId?: number;
    quantity: Decimal;
    financialMovement: Decimal;
    settlementMovement: Decimal;
  }
  export interface HistoricalOption {
    id: number;
    name: string;
    status?: number;
    archived?: boolean;
  }
  export interface ReportOptions {
    warehouses: HistoricalOption[];
    stockDepartments: HistoricalOption[];
  }
  export interface Opening {
    productId: number;
    warehouseId: number;
    quantity: string;
    financialAmount: string;
    settlementAmount: string;
    cutoverAt: string;
    evidence: string;
  }
}

const BASE = '/erp/business-report/stock-v2';
export const getStockReportStatus = () =>
  requestClient.get<StockReportV2Api.Status>(`${BASE}/status`);
export const getStockReportOptions = () =>
  requestClient.get<StockReportV2Api.ReportOptions>(`${BASE}/report-options`);
export const getStockReportPage = (
  reportType: StockReportV2Api.ReportType,
  params: StockReportV2Api.Query,
) =>
  requestClient.get<PageResult<StockReportV2Api.Row>>(
    `${BASE}/${reportType.toLowerCase()}-page`,
    { params },
  );
export const getStockReportSummary = (
  reportType: StockReportV2Api.ReportType,
  params: StockReportV2Api.Query,
) =>
  requestClient.get<StockReportV2Api.Summary>(
    `${BASE}/${reportType.toLowerCase()}-summary`,
    { params },
  );
export const exportStockReportV2 = (
  reportType: StockReportV2Api.ReportType,
  params: StockReportV2Api.Query,
) =>
  requestClient.download(`${BASE}/export-excel`, {
    params: { ...params, reportType },
  });
export const getReportProductOptions = (keyword = '', warehouseId?: number) =>
  requestClient.get<PageResult<StockReportV2Api.ProductOption>>(
    `${BASE}/product-options`,
    { params: { keyword, warehouseId, pageNo: 1, pageSize: 20 } },
  );
export const confirmStockReportOpening = (data: StockReportV2Api.Opening) =>
  requestClient.post<boolean>('/erp/report-stock-opening/confirm', data);
