import type { PageParam, PageResult } from '@vben/request';

import { financeDecimalRequestClient as requestClient } from '#/views/erp/finance/utils/finance-decimal-request';

export namespace ErpReceiptDetailReportApi {
  export type BusinessType =
    | 'RECEIVABLE_MISC'
    | 'SALE_OUT'
    | 'SALE_PRICE_ADJUST'
    | 'SALE_RETURN';

  export interface Query extends Partial<PageParam> {
    accountId?: number;
    accountType?: number;
    businessCreatorId?: number;
    businessDate?: [string, string];
    businessNo?: string;
    businessTypes?: BusinessType[];
    businessUserId?: number;
    customerId?: number;
    customerTypeId?: number;
    deptId?: number;
    orderDirection?: 'asc' | 'desc';
    orderField?: string;
    paymentVoucherNo?: string;
    receiptDate?: [string, string];
    receiptNo?: string;
    receiptUserId?: number;
    settleMethod?: string;
    voucherNo?: string;
  }

  export interface Row {
    accountName?: string;
    accountType?: string;
    actualReceiptAmount?: number;
    amountVisible?: boolean;
    businessId: number;
    businessCreatorName?: string;
    businessDate?: string;
    businessNo?: string;
    businessType?: string;
    businessTypeCode?: BusinessType;
    businessUserName?: string;
    costAmount?: number;
    customerName?: string;
    customerType?: string;
    deptName?: string;
    developerName?: string;
    grossProfit?: number;
    grossProfitRate?: number;
    receiptDate?: string;
    receiptId: number;
    receiptNo?: string;
    receiptUserName?: string;
    remark?: string;
    rowKey: string;
    settlementAmount?: number;
    settleMethod?: string;
    paymentVoucherNo?: string;
    voucherNo?: string;
  }

  export interface Summary {
    actualReceiptAmount?: number;
    amountVisible?: boolean;
    rowCount?: number;
    settlementAmount?: number;
  }
}

export function getReceiptDetailReportPage(
  params: ErpReceiptDetailReportApi.Query,
) {
  return requestClient.get<PageResult<ErpReceiptDetailReportApi.Row>>(
    '/erp/receipt-detail-report/page',
    { params },
  );
}

export function getReceiptDetailReportSummary(
  params: ErpReceiptDetailReportApi.Query,
) {
  return requestClient.get<ErpReceiptDetailReportApi.Summary>(
    '/erp/receipt-detail-report/summary',
    { params },
  );
}

export function exportReceiptDetailReport(
  params: ErpReceiptDetailReportApi.Query,
) {
  return requestClient.download('/erp/receipt-detail-report/export-excel', {
    params,
  });
}
