import type { PageParam, PageResult } from '@vben/request';

import { financeDecimalRequestClient as requestClient } from '#/views/erp/finance/utils/finance-decimal-request';

export namespace ErpPayableAgingReportApi {
  export interface Query extends Partial<PageParam> {
    asOfDate?: string;
    orderDirection?: 'asc' | 'desc';
    orderField?: string;
    purchaser?: string;
    supplierId?: number;
    supplierType?: string;
  }

  export interface Amounts {
    balance?: number;
    month01?: number;
    month02?: number;
    month03?: number;
    month04?: number;
    month05?: number;
    month06?: number;
    month07?: number;
    month08?: number;
    month09?: number;
    month10?: number;
    month11?: number;
    month12?: number;
    overThreeYears?: number;
    withinThreeYears?: number;
    withinTwoYears?: number;
  }

  export interface Row extends Amounts {
    amountVisible?: boolean;
    purchaser?: string;
    supplierId: number;
    supplierName?: string;
    supplierType?: string;
  }

  export interface Summary extends Amounts {
    amountVisible?: boolean;
    purchaserVisible?: boolean;
    rowCount?: number;
    supplierTypeVisible?: boolean;
  }
}

export function getPayableAgingReportPage(
  params: ErpPayableAgingReportApi.Query,
) {
  return requestClient.get<PageResult<ErpPayableAgingReportApi.Row>>(
    '/erp/payable-aging-report/page',
    { params },
  );
}

export function getPayableAgingReportSummary(
  params: ErpPayableAgingReportApi.Query,
) {
  return requestClient.get<ErpPayableAgingReportApi.Summary>(
    '/erp/payable-aging-report/summary',
    { params },
  );
}

export function exportPayableAgingReport(
  params: ErpPayableAgingReportApi.Query,
) {
  return requestClient.download('/erp/payable-aging-report/export-excel', {
    params,
  });
}
