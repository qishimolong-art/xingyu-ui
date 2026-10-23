import type { PageParam, PageResult } from '@vben/request';

import { financeDecimalRequestClient as requestClient } from '#/views/erp/finance/utils/finance-decimal-request';

export namespace ErpReceivableAgingReportApi {
  export type Bucket =
    | 'ALL'
    | 'MONTHS_3_TO_6'
    | 'MONTHS_6_TO_12'
    | 'OVER_1_YEAR'
    | 'WITHIN_1_MONTH'
    | 'WITHIN_2_MONTHS'
    | 'WITHIN_3_MONTHS';

  export interface Query extends Partial<PageParam> {
    analysisDate: string;
    areaId?: number;
    customerId?: number;
    customerType?: number;
    deptId?: number;
    developerUserId?: number;
    orderDirection?: 'asc' | 'desc';
    orderField?: string;
    saleUserId?: number;
  }

  export interface Amounts {
    balance?: number;
    creditBalance?: number;
    creditLimit?: number;
    months3To6?: number;
    months6To12?: number;
    over1Year?: number;
    within1Month?: number;
    within2Months?: number;
    within3Months?: number;
  }

  export interface Row extends Amounts {
    amountVisible?: boolean;
    areaId?: number;
    areaName?: string;
    customerId?: number;
    customerName?: string;
    customerTypeId?: number;
    customerTypeName?: string;
    deptId?: number;
    deptName?: string;
    developerName?: string;
    developerUserId?: number;
    rowKey: string;
    saleUserId?: number;
    saleUserName?: string;
  }

  export interface Summary extends Amounts {
    amountVisible?: boolean;
    areaVisible?: boolean;
    creditVisible?: boolean;
    customerNameVisible?: boolean;
    customerTypeVisible?: boolean;
    deptVisible?: boolean;
    developerVisible?: boolean;
    rowCount?: number;
    saleUserVisible?: boolean;
  }

  export interface DetailQuery extends Partial<PageParam> {
    analysisDate: string;
    bucket: Bucket;
    customerId: number;
    deptId?: number;
    deptUnassigned?: boolean;
    orderDirection?: 'asc' | 'desc';
    orderField?: string;
  }

  export interface DetailRow {
    amount?: number;
    amountVisible?: boolean;
    businessDate?: string;
    businessId?: number;
    businessType?: string;
    businessUserName?: string;
    customerName?: string;
    deptName?: string;
    description?: string;
    documentNo?: string;
    documentTypeCode?: string;
    rowKey: string;
  }
}

export function getReceivableAgingReportPage(
  params: ErpReceivableAgingReportApi.Query,
) {
  return requestClient.get<PageResult<ErpReceivableAgingReportApi.Row>>(
    '/erp/receivable-aging-report/page',
    { params },
  );
}

export function getReceivableAgingReportSummary(
  params: ErpReceivableAgingReportApi.Query,
) {
  return requestClient.get<ErpReceivableAgingReportApi.Summary>(
    '/erp/receivable-aging-report/summary',
    { params },
  );
}

export function getReceivableAgingReportDetailPage(
  params: ErpReceivableAgingReportApi.DetailQuery,
) {
  return requestClient.get<PageResult<ErpReceivableAgingReportApi.DetailRow>>(
    '/erp/receivable-aging-report/detail-page',
    { params },
  );
}

export function exportReceivableAgingReport(
  params: ErpReceivableAgingReportApi.Query,
) {
  return requestClient.download('/erp/receivable-aging-report/export-excel', {
    params,
  });
}
