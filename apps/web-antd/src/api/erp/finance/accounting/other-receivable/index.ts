import type { PageParam, PageResult } from '@vben/request';

import { financeDecimalRequestClient as requestClient } from '#/views/erp/finance/utils/finance-decimal-request';

type OtherReceivablePageParam = PageParam & Record<string, any>;

export namespace ErpOtherReceivableApi {
  export interface OtherReceivable {
    id?: number;
    no?: string;
    status?: number;
    bizTime?: number;
    partyType?: number;
    partyId?: number;
    partyName?: string;
    accountId?: number;
    accountName?: string;
    totalAmount?: number | string | null;
    discountAmount?: number | string | null;
    actualAmount?: number | string | null;
    remark?: string;
    fileUrl?: string;
    createTime?: string;
    items?: OtherReceivableItem[];
  }

  export interface OtherReceivableItem {
    id?: number;
    receivableId?: number;
    summary?: string;
    amount?: number | string | null;
    remark?: string;
    seq?: number;
  }
}

/** 查询其他应收单分页 */
export function getOtherReceivablePage(params: OtherReceivablePageParam) {
  return requestClient.get<PageResult<ErpOtherReceivableApi.OtherReceivable>>(
    '/erp/other-receivable/page',
    { params },
  );
}

/** 查询其他应收单详情 */
export function getOtherReceivable(id: number) {
  return requestClient.get<ErpOtherReceivableApi.OtherReceivable>(
    `/erp/other-receivable/get?id=${id}`,
  );
}

/** 新增其他应收单 */
export function createOtherReceivable(
  data: ErpOtherReceivableApi.OtherReceivable,
) {
  return requestClient.post<number>('/erp/other-receivable/create', data);
}

/** 修改其他应收单 */
export function updateOtherReceivable(
  data: ErpOtherReceivableApi.OtherReceivable,
) {
  return requestClient.put('/erp/other-receivable/update', data);
}

/** 审核/反审核其他应收单 */
export function updateOtherReceivableStatus(id: number, status: number) {
  return requestClient.put('/erp/other-receivable/update-status', {
    id,
    status,
  });
}

/** 删除其他应收单 */
export function deleteOtherReceivable(id: number) {
  return requestClient.delete(`/erp/other-receivable/delete?id=${id}`);
}
