import type { PageParam, PageResult } from '@vben/request';

import { financeDecimalRequestClient as requestClient } from '#/views/erp/finance/utils/finance-decimal-request';

export namespace ErpVoucherApi {
  /** 凭证分录明细 */
  export interface VoucherItem {
    auxiliaries?: import('../voucher-rule').Auxiliary[];
    id?: number;
    voucherId?: number;
    lineNo?: number;
    summary?: string;
    subjectId?: number;
    subjectCode?: string;
    subjectName?: string;
    auxiliaryType?: string;
    auxiliaryId?: number;
    auxiliaryName?: string;
    debitAmount?: number | string | null | string;
    creditAmount?: number | string | null | string;
    // 前端临时主键
    seq?: number;
  }

  /** 凭证 */
  export interface Voucher {
    generationSnapshot?: string;
    id?: number;
    voucherWord?: string;
    voucherNo?: string;
    voucherDate?: number | string;
    period?: string;
    periodYear?: number;
    periodMonth?: number;
    attachmentCount?: number | string;
    summary?: string;
    totalDebit?: number | string;
    totalCredit?: number | string;
    /** 10=未审核 20=已审核 30=已反审 */
    auditStatus?: number;
    /** 1=手动 2=自动 3=跨期 */
    sourceType?: number;
    sourceBizType?: string;
    sourceBizId?: number;
    sourceBizNo?: string;
    sourceBizAmount?: number | string | null | string;
    generateBusinessDoc?: boolean;
    /** 业务单据类型（银行转账/代垫运费） */
    bizDocType?: string;
    projectId?: number;
    deptId?: number;
    deptName?: string;
    customerId?: number;
    customerName?: string;
    personUserId?: number;
    personUserName?: string;
    makerUserId?: number;
    makerUserName?: string;
    bookkeeper?: string;
    bookkeeperTime?: number | string;
    bookkeeperUserId?: number;
    cashier?: string;
    cashierUserId?: number;
    supervisor?: string;
    supervisorUserId?: number;
    auditorUserId?: number;
    auditorUserName?: string;
    auditTime?: number | string;
    remark?: string;
    creator?: string;
    creatorName?: string;
    createTime?: Date | number | string;
    items?: VoucherItem[];
  }
}

/** 查询凭证分页 */
export function getVoucherPage(params: PageParam) {
  return requestClient.get<PageResult<ErpVoucherApi.Voucher>>(
    '/erp/voucher/page',
    { params },
  );
}

/** 查询凭证用户精简分页 */
export function getVoucherUserSimplePage(params: PageParam) {
  return requestClient.get<PageResult<any>>('/erp/voucher/user-simple-page', {
    params,
  });
}

/** 查询凭证详情（含分录） */
export function getVoucher(id: number) {
  return requestClient.get<ErpVoucherApi.Voucher>(`/erp/voucher/get?id=${id}`);
}

/** 新增凭证 */
export function createVoucher(data: ErpVoucherApi.Voucher) {
  return requestClient.post<number>('/erp/voucher/create', data);
}

/** 修改凭证 */
export function updateVoucher(data: ErpVoucherApi.Voucher) {
  return requestClient.put('/erp/voucher/update', data);
}

/** 删除凭证（仅未审核） */
export function deleteVoucher(id: number) {
  return requestClient.delete(`/erp/voucher/delete?id=${id}`);
}

/** 审核凭证 */
export function auditVoucher(id: number) {
  return requestClient.put('/erp/voucher/audit', null, {
    params: { id },
  });
}

/** 反审凭证 */
export function processVoucher(id: number) {
  return requestClient.put('/erp/voucher/process', null, {
    params: { id },
  });
}

/** 导出凭证 Excel */
export function exportVoucher(params: any) {
  const exportParams = { ...params };
  if (Array.isArray(exportParams.ids)) {
    exportParams.ids = exportParams.ids.join(',');
  }
  return requestClient.download('/erp/voucher/export-excel', {
    params: exportParams,
  });
}
