import type { PageParam, PageResult } from '@vben/request';

import { financeDecimalRequestClient as requestClient } from '#/views/erp/finance/utils/finance-decimal-request';

export namespace ErpPayableReportApi {
  export interface PayableReport {
    balance?: number | string | null;
    contact?: string;
    deptId?: number;
    deptName?: string;
    handlerId?: number;
    handlerName?: string;
    lastBizTime?: string;
    mobile?: string;
    otherPayableAmount?: number | string | null;
    settledAmount?: number | string | null;
    supplierId?: number;
    supplierName?: string;
  }

  export interface PayableReportDetail {
    allocatedAmount?: number | string | null;
    balance?: number | string | null;
    bizId?: number;
    bizType?: number;
    docDate?: string;
    docNo?: string;
    docType?: string;
    fileUrl?: string;
    increaseAmount?: number | string | null;
    paymentAmount?: number | string | null;
    prevBalance?: number | string | null;
    remark?: string;
    rowKey?: string;
    writeOffAmount?: number | string | null;
    writeOffBaseAmount?: number | string | null;
  }
}

export function getPayableReportPage(params: PageParam & Record<string, any>) {
  return requestClient.get<PageResult<ErpPayableReportApi.PayableReport>>(
    '/erp/payable-report/page',
    { params },
  );
}

export function getPayableReportDeptSimpleList() {
  return requestClient.get<any[]>('/erp/payable-report/dept-simple-list');
}

export function getPayableReportDeptSimplePage(params: PageParam) {
  return requestClient.get<PageResult<any>>(
    '/erp/payable-report/dept-simple-page',
    { params },
  );
}

export function getPayableReportUserSimplePage(params: PageParam) {
  return requestClient.get<PageResult<any>>(
    '/erp/payable-report/user-simple-page',
    { params },
  );
}

export function getPayableReportDetailList(params: Record<string, any>) {
  return requestClient.get<ErpPayableReportApi.PayableReportDetail[]>(
    '/erp/payable-report/detail',
    { params },
  );
}

export function exportPayableReport(params: Record<string, any>) {
  return requestClient.download('/erp/payable-report/export', { params });
}

export function exportPayableReportDetail(params: Record<string, any>) {
  return requestClient.download('/erp/payable-report/export-detail', {
    params,
  });
}
