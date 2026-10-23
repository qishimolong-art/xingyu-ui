import type { PageParam, PageResult } from '@vben/request';

import { financeDecimalRequestClient as requestClient } from '#/views/erp/finance/utils/finance-decimal-request';

type PreReceivablePageParam = PageParam & Record<string, any>;

export namespace ErpPreReceivableApi {
  /** 预收账款单子表明细 */
  export interface PreReceivableItem {
    id?: number;
    preReceivableId?: number;
    summary?: string;
    amount?: number | string | null | string;
    remark?: string;
  }

  /** 预收账款单 */
  export interface PreReceivable {
    id?: number;
    no?: string;
    /** 10=未审核 20=已审核 30=已反审 */
    status?: number;
    bizTime?: number | string;
    /** 1=客户 2=供应商 3=员工 */
    partyType?: number;
    partyId?: number;
    partyName?: string;
    accountId?: number;
    totalAmount?: number | string | null | string;
    discountAmount?: number | string | null | string;
    actualAmount?: number | string | null | string;
    remark?: string;
    fileUrl?: string;
    createTime?: string;
    items?: PreReceivableItem[];
  }
}

/** 查询预收账款单分页 */
export function getPreReceivablePage(params: PreReceivablePageParam) {
  return requestClient.get<PageResult<ErpPreReceivableApi.PreReceivable>>(
    '/erp/pre-receivable/page',
    { params },
  );
}

/** 查询预收账款单详情（含子表） */
export function getPreReceivable(id: number) {
  return requestClient.get<ErpPreReceivableApi.PreReceivable>(
    `/erp/pre-receivable/get?id=${id}`,
  );
}

/** 新增预收账款单 */
export function createPreReceivable(data: ErpPreReceivableApi.PreReceivable) {
  return requestClient.post<number>('/erp/pre-receivable/create', data);
}

/** 修改预收账款单 */
export function updatePreReceivable(data: ErpPreReceivableApi.PreReceivable) {
  return requestClient.put('/erp/pre-receivable/update', data);
}

/** 删除预收账款单 */
export function deletePreReceivable(id: number) {
  return requestClient.delete(`/erp/pre-receivable/delete?id=${id}`);
}

/** 审核/反审核预收账款单 */
export function updatePreReceivableStatus(id: number, status: number) {
  return requestClient.put('/erp/pre-receivable/update-status', { id, status });
}
