import type { PageParam, PageResult } from '@vben/request';

import { requestClient } from '#/api/request';

export namespace ErpPurchaseHistoryApi {
  export type DocumentType = 'PURCHASE_IN' | 'PURCHASE_RETURN';

  export interface Query extends PageParam {
    businessTime?: [string, string];
    documentTypeCode?: DocumentType;
    orderDirection?: 'asc' | 'desc';
    orderField?: string;
    productId: number;
    supplierId?: number;
  }

  export interface Row {
    businessId: number;
    businessTime?: string;
    count?: number;
    creatorName?: string;
    documentNo?: string;
    documentType?: string;
    documentTypeCode: DocumentType;
    itemId: number;
    productPrice?: number;
    remark?: string;
    rowKey: string;
    supplierId?: number;
    supplierName?: string;
    warehouseName?: string;
  }
}

export function getPurchaseHistoryPage(params: ErpPurchaseHistoryApi.Query) {
  return requestClient.get<PageResult<ErpPurchaseHistoryApi.Row>>(
    '/erp/purchase-history/page',
    { params },
  );
}
