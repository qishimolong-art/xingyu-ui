import type { PageResult } from '@vben/request';
import { requestClient } from '#/api/request';

export namespace PurchaseCostApi {
  export interface Header {
    purchaseInId: number;
    purchaseNo?: string;
    sourceSignature: string;
    latestRevision: number;
    sourceItemCount: number;
    status: 'NONE' | 'CONFIRMED' | 'STALE' | 'CONSUMED' | 'SCHEMA_MISSING';
    reason?: string;
    priceBasis: string;
    taxStatus: string;
    costMasked: boolean;
    canConfirm?: boolean;
    sourceStatus?: number;
    confirmBlockedReason?: string;
    rawProductAmount?: string | null;
    discountAmount?: string | null;
    feeAmount?: string | null;
    freight1?: string | null;
    freight2?: string | null;
    confirmationId?: number;
    confirmedAt?: string;
    confirmedBy?: number;
    evidence?: string | null;
    feeTreatment?: string | null;
  }
  export interface Item {
    sourceSignature: string;
    sourceItemId: number;
    productId: number;
    productCode?: string;
    productName?: string;
    warehouseId: number;
    quantity: string;
    rawUnitPrice?: string | null;
    rawLineAmount?: string | null;
    gift?: boolean;
    confirmedNetTotalAmount?: string | null;
    evidence?: string | null;
  }
  export interface Confirmation {
    purchaseInId: number;
    expectedSignature: string;
    expectedRevision: number;
    requestKey: string;
    evidence: string;
    feeTreatment: string;
    items: Array<{
      sourceItemId: number;
      confirmedNetTotalAmount: string;
      evidence: string;
    }>;
  }
}
const BASE = '/erp/purchase-cost-confirmation';
export const getPurchaseCostPreview = (purchaseInId: number) =>
  requestClient.get<PurchaseCostApi.Header>(`${BASE}/preview`, {
    params: { purchaseInId },
  });
export const getPurchaseCostConfirmation = (purchaseInId: number) =>
  requestClient.get<PurchaseCostApi.Header>(`${BASE}/confirmation`, {
    params: { purchaseInId },
  });
export const getPurchaseCostItems = (
  purchaseInId: number,
  expectedSignature: string,
  pageNo = 1,
  pageSize = 20,
) =>
  requestClient.get<PageResult<PurchaseCostApi.Item>>(`${BASE}/item-page`, {
    params: { purchaseInId, expectedSignature, pageNo, pageSize },
  });
export const confirmPurchaseCost = (data: PurchaseCostApi.Confirmation) =>
  requestClient.post<PurchaseCostApi.Header>(`${BASE}/confirm`, data);
