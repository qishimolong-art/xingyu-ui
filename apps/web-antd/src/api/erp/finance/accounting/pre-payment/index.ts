import type { PageParam, PageResult } from '@vben/request';

import { financeDecimalRequestClient as requestClient } from '#/views/erp/finance/utils/finance-decimal-request';

type PrePaymentPageParam = PageParam & Record<string, any>;

export namespace ErpPrePaymentApi {
  export interface PrePaymentItem {
    id?: number;
    prePaymentId?: number;
    summary?: string;
    amount?: number | string | null;
    remark?: string;
    seq?: number;
  }

  export interface PrePayment {
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
    totalAmount?: number | string | null;
    discountAmount?: number | string | null;
    actualAmount?: number | string | null;
    remark?: string;
    fileUrl?: string;
    createTime?: string;
    items?: PrePaymentItem[];
  }
}

/** 查询预付款单分页 */
export function getPrePaymentPage(params: PrePaymentPageParam) {
  return requestClient.get<PageResult<ErpPrePaymentApi.PrePayment>>(
    '/erp/pre-payment/page',
    { params },
  );
}

/** 查询预付款单详情 */
export function getPrePayment(id: number) {
  return requestClient.get<ErpPrePaymentApi.PrePayment>(
    `/erp/pre-payment/get?id=${id}`,
  );
}

/** 新增预付款单 */
export function createPrePayment(data: ErpPrePaymentApi.PrePayment) {
  return requestClient.post<number>('/erp/pre-payment/create', data);
}

/** 修改预付款单 */
export function updatePrePayment(data: ErpPrePaymentApi.PrePayment) {
  return requestClient.put('/erp/pre-payment/update', data);
}

/** 删除预付款单 */
export function deletePrePayment(id: number) {
  return requestClient.delete(`/erp/pre-payment/delete?id=${id}`);
}

/** 审核/反审核 */
export function updatePrePaymentStatus(id: number, status: number) {
  return requestClient.put('/erp/pre-payment/update-status', { id, status });
}
