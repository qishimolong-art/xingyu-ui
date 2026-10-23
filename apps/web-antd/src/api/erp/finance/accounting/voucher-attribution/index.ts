import type { PageParam, PageResult } from '@vben/request';

import { financeDecimalRequestClient as requestClient } from '#/views/erp/finance/utils/finance-decimal-request';

export namespace ErpVoucherAttributionApi {
  /** 凭证归属记录 */
  export interface VoucherAttribution {
    generationStatus?: string;
    generationIssues?: string[];
    id?: number;
    bizType: number;
    bizId?: number;
    bizNo?: string;
    bizDate: string;
    bizAmount?: number | string | null | string;
    discountAmount?: number | string | null | string;
    receivedAmount?: number | string | null | string;
    voucherMakeDate?: string;
    attributionYear?: number;
    attributionMonth?: number;
    attributionStatus?: number;
    voucherId?: number;
    transactionParty?: string;
    handlerUserId?: number;
    auditorUserId?: number;
    auditTime?: string;
    settleMethod?: string;
    deptId?: number;
    shippingMethod?: string;
    receivableConfirmed?: boolean;
    invoiceIssued?: boolean;
    shipStatus?: number;
    summary?: string;
    remark?: string;
    createTime?: string;
  }

  /** 批量应用归属请求 */
  export interface ApplyReq {
    ids: number[];
    attributionYear: number;
    attributionMonth: number;
  }

  /** 批量生成凭证请求 */
  export interface GenerateReq {
    ids: number[];
  }

  /** 从业务单据快照生成凭证-单条快照 */
  export interface GenerateFromBizItem {
    bizType: number;
    bizId: number;
    bizNo?: string;
    bizDate?: string;
    bizAmount?: number | string | null | string;
    transactionParty?: string;
    remark?: string;
  }

  /** 从业务单据快照生成凭证请求 */
  export interface GenerateFromBizReq {
    items: GenerateFromBizItem[];
    voucherMakeDate: string;
    attributionYear: number;
    attributionMonth: number;
  }

  /** 查询业务单据来源参数 */
  export interface SearchSourceBizParams {
    sourceBizType?: number;
    bizDateStart?: string;
    bizDateEnd?: string;
    bizNo?: string;
    partyName?: string;
    pageNo?: number;
    pageSize?: number;
  }
}

/** 查询凭证归属分页 */
export function getVoucherAttributionPage(params: PageParam) {
  return requestClient.get<
    PageResult<ErpVoucherAttributionApi.VoucherAttribution>
  >('/erp/voucher-attribution/page', { params });
}

/** 查询凭证归属详情 */
export function getVoucherAttribution(id: number) {
  return requestClient.get<ErpVoucherAttributionApi.VoucherAttribution>(
    `/erp/voucher-attribution/get?id=${id}`,
  );
}

/** 新增凭证归属 */
export function createVoucherAttribution(
  data: ErpVoucherAttributionApi.VoucherAttribution,
) {
  return requestClient.post<number>('/erp/voucher-attribution/create', data);
}

/** 修改凭证归属 */
export function updateVoucherAttribution(
  data: ErpVoucherAttributionApi.VoucherAttribution,
) {
  return requestClient.put('/erp/voucher-attribution/update', data);
}

/** 删除凭证归属 */
export function deleteVoucherAttribution(id: number) {
  return requestClient.delete(`/erp/voucher-attribution/delete?id=${id}`);
}

/** 批量应用归属月份 */
export function applyVoucherAttribution(
  data: ErpVoucherAttributionApi.ApplyReq,
) {
  return requestClient.put('/erp/voucher-attribution/apply', data);
}

/** 批量生成凭证 */
export function generateVouchers(data: ErpVoucherAttributionApi.GenerateReq) {
  return requestClient.post('/erp/voucher-attribution/generate-vouchers', data);
}

/** 从业务单据快照生成凭证（凭证生成页专用） */
export function generateVouchersFromBiz(
  data: ErpVoucherAttributionApi.GenerateFromBizReq,
) {
  return requestClient.post(
    '/erp/voucher-attribution/generate-vouchers-from-biz',
    data,
  );
}

/** 查询业务单据来源（凭证生成页专用） */
export function searchSourceBiz(
  params: ErpVoucherAttributionApi.SearchSourceBizParams,
) {
  return requestClient.get<
    PageResult<ErpVoucherAttributionApi.VoucherAttribution>
  >('/erp/voucher-attribution/search-source-biz', { params });
}
