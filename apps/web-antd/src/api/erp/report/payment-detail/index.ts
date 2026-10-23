import type { PageParam, PageResult } from '@vben/request';

import { financeDecimalRequestClient as requestClient } from '#/views/erp/finance/utils/finance-decimal-request';

export namespace ErpPaymentDetailReportApi {
  export type BusinessType = 11 | 12 | 13 | 14;

  export interface Query extends Partial<PageParam> {
    accountId?: number;
    businessNo?: string;
    businessTypes?: BusinessType[];
    deptId?: number;
    orderDirection?: 'asc' | 'desc';
    orderField?: string;
    payerId?: number;
    paymentDate?: [string, string];
    paymentMethod?: number;
    paymentNo?: string;
    paymentVoucherNo?: string;
    settlementMethod?: string;
    sourceCreatorId?: number;
    supplierId?: number;
    supplierType?: string;
    voucherNo?: string;
  }

  export interface Row {
    accountName?: string;
    actualPaymentAmount?: number;
    businessId?: number;
    amountVisible?: boolean;
    businessNo?: string;
    businessType?: string;
    businessTypeCode?: BusinessType;
    creatorName?: string;
    deptName?: string;
    payerName?: string;
    paymentDate?: string;
    paymentId: number;
    paymentItemId: number;
    paymentMethod?: string;
    paymentNo?: string;
    paymentVoucherNo?: string;
    purchaserName?: string;
    settlementAmount?: number;
    settlementMethod?: string;
    supplierName?: string;
    supplierType?: string;
    voucherNo?: string;
  }

  export interface Summary {
    actualPaymentAmount?: number;
    amountVisible?: boolean;
    rowCount?: number;
    settlementAmount?: number;
  }
}

export function getPaymentDetailReportPage(
  params: ErpPaymentDetailReportApi.Query,
) {
  return requestClient.get<PageResult<ErpPaymentDetailReportApi.Row>>(
    '/erp/payment-detail-report/page',
    { params },
  );
}

export function getPaymentDetailReportSummary(
  params: ErpPaymentDetailReportApi.Query,
) {
  return requestClient.get<ErpPaymentDetailReportApi.Summary>(
    '/erp/payment-detail-report/summary',
    { params },
  );
}

export function exportPaymentDetailReport(
  params: ErpPaymentDetailReportApi.Query,
) {
  return requestClient.download('/erp/payment-detail-report/export-excel', {
    params,
  });
}
