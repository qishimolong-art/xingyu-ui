import type { PageParam, PageResult } from '@vben/request';

import { financeDecimalRequestClient as requestClient } from '#/views/erp/finance/utils/finance-decimal-request';

export namespace ErpAccountLedgerReportApi {
  export type DocumentType =
    | 'expense'
    | 'other_income'
    | 'payment'
    | 'receipt'
    | 'transfer';

  export interface Query extends Partial<PageParam> {
    accountId?: number;
    businessDate?: [string, string];
    businessNo?: string;
    direction?: 'credit' | 'debit';
    documentTypes?: DocumentType[];
    orderDirection?: 'asc' | 'desc';
    orderField?: string;
    paymentVoucherNo?: string;
    partyCode?: string;
    partyName?: string;
    payerId?: number;
    receiverId?: number;
    remark?: string;
    voucherNo?: string;
  }

  export interface Row {
    accountId?: number;
    accountName?: string;
    amountVisible?: boolean;
    balance?: number;
    businessDate?: string;
    businessNo?: string;
    direction?: string;
    documentType?: string;
    expenseAmount?: number;
    incomeAmount?: number;
    legRank?: number;
    onlinePaymentOrderNo?: string;
    onlinePaymentVoucherNo?: string;
    partyCode?: string;
    partyName?: string;
    payerId?: number;
    payerName?: string;
    paymentVoucherNo?: string;
    receiverId?: number;
    receiverName?: string;
    remark?: string;
    rowKey: string;
    sourceId?: number;
    sourceType?: DocumentType;
    voucherNo?: string;
  }

  export interface Summary {
    amountVisible?: boolean;
    expenseAmount?: number;
    incomeAmount?: number;
    netAmount?: number;
    rowCount?: number;
  }
}

export function getAccountLedgerReportPage(
  params: ErpAccountLedgerReportApi.Query,
) {
  return requestClient.get<PageResult<ErpAccountLedgerReportApi.Row>>(
    '/erp/account-ledger-report/page',
    { params },
  );
}

export function getAccountLedgerReportSummary(
  params: ErpAccountLedgerReportApi.Query,
) {
  return requestClient.get<ErpAccountLedgerReportApi.Summary>(
    '/erp/account-ledger-report/summary',
    { params },
  );
}

export function getAccountLedgerReportUserSimplePage(params: PageParam) {
  return requestClient.get<PageResult<any>>(
    '/erp/account-ledger-report/user-simple-page',
    { params },
  );
}

export function exportAccountLedgerReport(
  params: ErpAccountLedgerReportApi.Query,
) {
  return requestClient.download('/erp/account-ledger-report/export-excel', {
    params,
  });
}
