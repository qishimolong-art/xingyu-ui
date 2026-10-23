import type { PageParam, PageResult } from '@vben/request';

import { financeDecimalRequestClient as requestClient } from '#/views/erp/finance/utils/finance-decimal-request';

export namespace ErpReceivableReportApi {
  export interface ReceivableReport {
    balance?: number | string | null;
    contact?: string;
    customerId?: number;
    customerName?: string;
    deptId?: number;
    deptName?: string;
    handlerId?: number;
    handlerName?: string;
    lastBizTime?: string;
    mobile?: string;
    otherReceivableAmount?: number | string | null;
    settledAmount?: number | string | null;
  }

  export interface ReceivableReportDetail {
    allocatedAmount?: number | string | null;
    balance?: number | string | null;
    bizId?: number;
    bizType?: number;
    docDate?: string;
    docNo?: string;
    docType?: string;
    fileUrl?: string;
    increaseAmount?: number | string | null;
    prevBalance?: number | string | null;
    remark?: string;
    receiptAmount?: number | string | null;
    rowKey?: string;
    writeOffAmount?: number | string | null;
    writeOffBaseAmount?: number | string | null;
  }
}

export function getReceivableReportPage(
  params: PageParam & Record<string, any>,
) {
  return requestClient.get<PageResult<ErpReceivableReportApi.ReceivableReport>>(
    '/erp/receivable-report/page',
    { params },
  );
}

export function getReceivableReportDeptSimpleList() {
  return requestClient.get<any[]>('/erp/receivable-report/dept-simple-list');
}

export function getReceivableReportDeptSimplePage(params: PageParam) {
  return requestClient.get<PageResult<any>>(
    '/erp/receivable-report/dept-simple-page',
    { params },
  );
}

export function getReceivableReportUserSimplePage(params: PageParam) {
  return requestClient.get<PageResult<any>>(
    '/erp/receivable-report/user-simple-page',
    { params },
  );
}

export function getReceivableReportDetailList(params: Record<string, any>) {
  return requestClient.get<ErpReceivableReportApi.ReceivableReportDetail[]>(
    '/erp/receivable-report/detail',
    { params },
  );
}

export function exportReceivableReport(params: Record<string, any>) {
  return requestClient.download('/erp/receivable-report/export', { params });
}

export function exportReceivableReportDetail(params: Record<string, any>) {
  return requestClient.download('/erp/receivable-report/export-detail', {
    params,
  });
}
