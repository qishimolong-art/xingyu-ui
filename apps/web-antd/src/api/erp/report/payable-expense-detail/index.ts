import type { PageParam, PageResult } from '@vben/request';

import { financeDecimalRequestClient as requestClient } from '#/views/erp/finance/utils/finance-decimal-request';

export namespace ErpPayableExpenseDetailReportApi {
  export interface Query extends Partial<PageParam> {
    accountId?: number;
    amountMax?: number;
    amountMin?: number;
    approveDate?: [string, string];
    billingDeptId?: number;
    businessUserId?: number;
    deptId?: number;
    documentNo?: string;
    handlerId?: number;
    itemName?: string;
    orderDirection?: 'asc' | 'desc';
    orderField?: string;
    party?: string;
    summary?: string;
    voucherNo?: string;
  }

  export interface Row {
    accountName?: string;
    amount?: number;
    amountVisible?: boolean;
    approveDate?: string;
    billingDeptName?: string;
    businessUserName?: string;
    deptName?: string;
    documentNo?: string;
    expenseId: number;
    handlerName?: string;
    invoice?: string;
    itemName?: string;
    occurrenceDate?: string;
    party?: string;
    rowKey: string;
    summary?: string;
    type?: string;
    voucherNo?: string;
  }

  export interface Summary {
    amount?: number;
    amountVisible?: boolean;
    rowCount?: number;
  }
}

export function getPayableExpenseDetailReportPage(
  params: ErpPayableExpenseDetailReportApi.Query,
) {
  return requestClient.get<PageResult<ErpPayableExpenseDetailReportApi.Row>>(
    '/erp/payable-expense-detail-report/page',
    { params },
  );
}

export function getPayableExpenseDetailReportSummary(
  params: ErpPayableExpenseDetailReportApi.Query,
) {
  return requestClient.get<ErpPayableExpenseDetailReportApi.Summary>(
    '/erp/payable-expense-detail-report/summary',
    { params },
  );
}

export function exportPayableExpenseDetailReport(
  params: ErpPayableExpenseDetailReportApi.Query,
) {
  return requestClient.download(
    '/erp/payable-expense-detail-report/export-excel',
    { params },
  );
}
