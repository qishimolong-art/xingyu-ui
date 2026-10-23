import type { PageParam, PageResult } from '@vben/request';

import { financeDecimalRequestClient as requestClient } from '#/views/erp/finance/utils/finance-decimal-request';

type OtherPayablePageParam = PageParam & Record<string, any>;

export namespace ErpOtherPayableApi {
  export interface OtherPayableItem {
    id?: number;
    payableId?: number;
    summary?: string;
    amount?: number | string | null;
    remark?: string;
  }

  export interface OtherPayable {
    id?: number;
    no?: string;
    status?: number;
    bizTime?: number;
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
    items?: OtherPayableItem[];
  }
}

/** 查询其他应付单分页 */
export function getOtherPayablePage(params: OtherPayablePageParam) {
  return requestClient.get<PageResult<ErpOtherPayableApi.OtherPayable>>(
    '/erp/other-payable/page',
    { params },
  );
}

/** 查询其他应付单详情 */
export function getOtherPayable(id: number) {
  return requestClient.get<ErpOtherPayableApi.OtherPayable>(
    `/erp/other-payable/get?id=${id}`,
  );
}

/** 新增其他应付单 */
export function createOtherPayable(data: ErpOtherPayableApi.OtherPayable) {
  return requestClient.post<number>('/erp/other-payable/create', data);
}

/** 修改其他应付单 */
export function updateOtherPayable(data: ErpOtherPayableApi.OtherPayable) {
  return requestClient.put('/erp/other-payable/update', data);
}

/** 审核/反审核其他应付单 */
export function updateOtherPayableStatus(id: number, status: number) {
  return requestClient.put('/erp/other-payable/update-status', { id, status });
}

/** 删除其他应付单 */
export function deleteOtherPayable(id: number) {
  return requestClient.delete(`/erp/other-payable/delete?id=${id}`);
}
