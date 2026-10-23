import type { PageParam, PageResult } from '@vben/request';

import { financeDecimalRequestClient as requestClient } from '#/views/erp/finance/utils/finance-decimal-request';

export namespace ErpOtherIncomeReportApi {
  export interface Query extends Partial<PageParam> {
    accountId?: number;
    amountMax?: number;
    amountMin?: number;
    approveDate?: [string, string];
    billingDeptId?: number;
    documentNo?: string;
    handlerId?: number;
    invoice?: string;
    itemName?: string;
    occurrenceDate?: [string, string];
    orderDirection?: 'asc' | 'desc';
    orderField?: string;
    party?: string;
    projectDeptId?: number;
    summary?: string;
    voucherNo?: string;
  }

  export interface Row {
    accountName?: string;
    amount?: number;
    amountVisible?: boolean;
    approveDate?: string;
    billingDeptName?: string;
    documentNo?: string;
    handlerName?: string;
    incomeId: number;
    invoice?: string;
    itemName?: string;
    occurrenceDate?: string;
    party?: string;
    projectDeptName?: string;
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

export function getOtherIncomeReportPage(
  params: ErpOtherIncomeReportApi.Query,
) {
  return requestClient.get<PageResult<ErpOtherIncomeReportApi.Row>>(
    '/erp/other-income-report/page',
    { params },
  );
}

export function getOtherIncomeReportSummary(
  params: ErpOtherIncomeReportApi.Query,
) {
  return requestClient.get<ErpOtherIncomeReportApi.Summary>(
    '/erp/other-income-report/summary',
    { params },
  );
}

export function exportOtherIncomeReport(params: ErpOtherIncomeReportApi.Query) {
  return requestClient.download('/erp/other-income-report/export-excel', {
    params,
  });
}
