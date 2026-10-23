import type { PageParam, PageResult } from '@vben/request';

import { financeDecimalRequestClient as requestClient } from '#/views/erp/finance/utils/finance-decimal-request';

export namespace ErpPayableDetailReportApi {
  export type DocumentType =
    | 'FINANCE_PAYMENT'
    | 'PAYABLE_ADJUST'
    | 'PURCHASE_ADJUST'
    | 'PURCHASE_IN'
    | 'PURCHASE_RETURN';

  export interface Query extends Partial<PageParam> {
    creatorId?: number;
    documentDate?: [string, string];
    documentNo?: string;
    documentTypes?: DocumentType[];
    orderDirection?: 'asc' | 'desc';
    orderField?: string;
    supplierCode?: string;
    supplierId?: number;
    supplierType?: string;
    voucherNo?: string;
  }

  export interface Row {
    amountVisible?: boolean;
    businessId: number;
    creatorName?: string;
    documentDate?: string;
    documentNo?: string;
    documentType?: string;
    documentTypeCode?: DocumentType;
    endingPayable?: number;
    increasePayable?: number;
    paymentAmount?: number;
    previousBalance?: number;
    remark?: string;
    rowKey: string;
    supplierCode?: string;
    supplierName?: string;
    supplierType?: string;
    voucherNo?: string;
  }

  export interface Summary {
    amountVisible?: boolean;
    endingPayable?: number;
    increasePayable?: number;
    paymentAmount?: number;
    rowCount?: number;
  }
}

export function getPayableDetailReportPage(
  params: ErpPayableDetailReportApi.Query,
) {
  return requestClient.get<PageResult<ErpPayableDetailReportApi.Row>>(
    '/erp/payable-detail-report/page',
    { params },
  );
}

export function getPayableDetailReportSummary(
  params: ErpPayableDetailReportApi.Query,
) {
  return requestClient.get<ErpPayableDetailReportApi.Summary>(
    '/erp/payable-detail-report/summary',
    { params },
  );
}

export function exportPayableDetailReport(
  params: ErpPayableDetailReportApi.Query,
) {
  return requestClient.download('/erp/payable-detail-report/export-excel', {
    params,
  });
}
