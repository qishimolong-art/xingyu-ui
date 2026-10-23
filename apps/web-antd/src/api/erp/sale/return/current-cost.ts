import { requestClient } from '#/api/request';

export namespace SaleReturnCurrentCostApi {
  export interface Header {
    id: number;
    no: string;
    enabled: boolean;
    status:
      | 'DISABLED'
      | 'NOT_APPLICABLE'
      | 'READY'
      | 'CONFIRMATION_REQUIRED'
      | 'SCHEMA_MISSING'
      | 'STOCK_RECONCILIATION_REQUIRED'
      | 'POSTED'
      | 'HISTORICAL_COST_MISSING';
    reason: string;
    sourceStatus: number;
    sourceSignature: string;
    basisSignature: string;
    sourceItemCount: number;
    latestRevision: number;
    confirmationId?: number | null;
    costMasked: boolean;
    canConfirm: boolean;
    canApprove: boolean;
    financialAmount: string | null;
    settlementAmount: string | null;
  }
  export interface Item {
    sourceItemId: number;
    productId: number;
    productCode?: string;
    productName?: string;
    warehouseId: number;
    warehouseName?: string;
    quantity: string;
    financialAmount: string | null;
    settlementAmount: string | null;
    costSource: 'CURRENT_AVERAGE' | 'MANUAL_CONFIRMED' | 'MISSING';
    reason: string;
    sourceSignature: string;
    basisSignature: string;
    evidence?: string;
  }
  export interface Confirmation {
    id: number;
    expectedSourceSignature: string;
    expectedBasisSignature: string;
    expectedRevision: number;
    requestKey: string;
    evidence: string;
    items: Array<{
      sourceItemId: number;
      financialAmount: string;
      settlementAmount: string;
      evidence: string;
    }>;
  }
}
const base = '/erp/sale-return-current-cost';
export const getSaleReturnCurrentCostPreview = (id: number) =>
  requestClient.get<SaleReturnCurrentCostApi.Header>(`${base}/preview`, {
    params: { id },
  });
export const getSaleReturnCurrentCostItems = (
  header: SaleReturnCurrentCostApi.Header,
  pageNo: number,
  pageSize: number,
) =>
  requestClient.get<{ list: SaleReturnCurrentCostApi.Item[]; total: number }>(
    `${base}/item-page`,
    {
      params: {
        id: header.id,
        expectedSourceSignature: header.sourceSignature,
        expectedBasisSignature: header.basisSignature,
        pageNo,
        pageSize,
      },
    },
  );
export const confirmSaleReturnCurrentCost = (
  body: SaleReturnCurrentCostApi.Confirmation,
) =>
  requestClient.post<SaleReturnCurrentCostApi.Header>(`${base}/confirm`, body);
