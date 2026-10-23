import type { PageParam, PageResult } from '@vben/request';

import { financeDecimalRequestClient as requestClient } from '#/views/erp/finance/utils/finance-decimal-request';

type PreReceiptPageParam = PageParam & Record<string, any>;

export namespace ErpPreReceiptApi {
  export interface PreReceiptItem {
    id?: number;
    preReceiptId?: number;
    summary?: string;
    amount?: number | string | null;
    remark?: string;
  }

  export interface PreReceipt {
    id?: number;
    no?: string;
    status?: number;
    bizTime?: string;
    partyType?: number;
    partyId?: number;
    partyName?: string;
    accountId?: number;
    totalAmount?: number | string | null;
    discountAmount?: number | string | null;
    actualAmount?: number | string | null;
    remark?: string;
    fileUrl?: string;
    createTime?: string;
    items?: PreReceiptItem[];
  }
}

/** 查询预收款单分页 */
export function getPreReceiptPage(params: PreReceiptPageParam) {
  return requestClient.get<PageResult<ErpPreReceiptApi.PreReceipt>>(
    '/erp/pre-receipt/page',
    { params },
  );
}

/** 查询预收款单详情 */
export function getPreReceipt(id: number) {
  return requestClient.get<ErpPreReceiptApi.PreReceipt>(
    `/erp/pre-receipt/get?id=${id}`,
  );
}

/** 新增预收款单 */
export function createPreReceipt(data: ErpPreReceiptApi.PreReceipt) {
  return requestClient.post<number>('/erp/pre-receipt/create', data);
}

/** 修改预收款单 */
export function updatePreReceipt(data: ErpPreReceiptApi.PreReceipt) {
  return requestClient.put('/erp/pre-receipt/update', data);
}

/** 审核/反审核预收款单 */
export function updatePreReceiptStatus(id: number, status: number) {
  return requestClient.put('/erp/pre-receipt/update-status', { id, status });
}

/** 删除预收款单 */
export function deletePreReceipt(id: number) {
  return requestClient.delete(`/erp/pre-receipt/delete?id=${id}`);
}
