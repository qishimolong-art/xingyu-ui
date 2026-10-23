import type { PageParam, PageResult } from '@vben/request';

import { financeDecimalRequestClient as requestClient } from '#/views/erp/finance/utils/finance-decimal-request';

export namespace ErpReceivableDetailReportApi {
  export type DocumentType =
    | 'FINANCE_RECEIPT'
    | 'RECEIVABLE_ADJUST'
    | 'SALE_ADJUST'
    | 'SALE_OUT'
    | 'SALE_RETURN';

  export interface Query extends Partial<PageParam> {
    approveDate?: [string, string];
    businessDate?: [string, string];
    businessUserId?: number;
    creatorId?: number;
    customerCode?: string;
    customerId?: number;
    deliveryMethod?: string;
    deptId?: number;
    documentNo?: string;
    documentTypes?: DocumentType[];
    orderDirection?: 'asc' | 'desc';
    orderField?: string;
    settleMethod?: string;
    settledStatus?: string;
    sourceNo?: string;
    updaterId?: number;
    voucherNo?: string;
  }

  export interface Row {
    amountVisible?: boolean;
    approveTime?: string;
    balance?: number;
    businessDate?: string;
    businessId: number;
    businessUserName?: string;
    creatorName?: string;
    customerCode?: string;
    customerName?: string;
    deliveryMethod?: string;
    description?: string;
    documentNo?: string;
    documentType?: string;
    documentTypeCode?: DocumentType;
    increaseAmount?: number;
    previousBalance?: number;
    receiptAmount?: number;
    receivedAmount?: number;
    rowKey: string;
    settleMethod?: string;
    settledStatus?: string;
    sourceBusinessId?: number;
    sourceDocumentTypeCode?: string;
    sourceNo?: string;
    unconfirmedReceivable?: number;
    updaterName?: string;
    voucherNo?: string;
    writeOffAmount?: number;
  }

  export interface Summary {
    amountVisible?: boolean;
    endingBalance?: number;
    increaseAmount?: number;
    receiptAmount?: number;
    rowCount?: number;
    writeOffAmount?: number;
  }
}

export function getReceivableDetailReportPage(
  params: ErpReceivableDetailReportApi.Query,
) {
  return requestClient.get<PageResult<ErpReceivableDetailReportApi.Row>>(
    '/erp/receivable-detail-report/page',
    { params },
  );
}

export function getReceivableDetailReportSummary(
  params: ErpReceivableDetailReportApi.Query,
) {
  return requestClient.get<ErpReceivableDetailReportApi.Summary>(
    '/erp/receivable-detail-report/summary',
    { params },
  );
}

export function exportReceivableDetailReport(
  params: ErpReceivableDetailReportApi.Query,
) {
  return requestClient.download('/erp/receivable-detail-report/export-excel', {
    params,
  });
}
