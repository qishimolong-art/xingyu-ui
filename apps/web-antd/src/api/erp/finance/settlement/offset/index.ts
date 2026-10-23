import type { PageParam, PageResult } from '@vben/request';

import { financeDecimalRequestClient as requestClient } from '#/views/erp/finance/utils/finance-decimal-request';
import type { FinanceQuerySummary } from '../../query-summary';

export namespace ErpSettlementOffsetApi {
  export interface SettlementOffset {
    customerCode?: string;
    subjectName: string;
    customerId: number;
    supplierId: number;
    deptId?: number;
    deptName?: string;
    contact?: string;
    mobile?: string;
    receivableBalance: number | string | null;
    payableBalance: number | string | null;
    offsetBalance: number | string | null;
  }

  export interface ReceivableDetail {
    approveTime?: string;
    eventKey?: string;
    docType?: string;
    docDate?: string;
    docNo?: string;
    deptId?: number;
    deptName?: string;
    prevBalance?: number | string | null;
    increaseAmount?: number | string | null;
    receiptAmount?: number | string | null;
    writeOffAmount?: number | string | null;
    allocatedAmount?: number | string | null;
    writeOffBaseAmount?: number | string | null;
    balance?: number | string | null;
  }

  export interface PayableDetail {
    approveTime?: string;
    eventKey?: string;
    docType?: string;
    docDate?: string;
    docNo?: string;
    deptId?: number;
    deptName?: string;
    prevBalance?: number | string | null;
    increaseAmount?: number | string | null;
    paymentAmount?: number | string | null;
    writeOffAmount?: number | string | null;
    allocatedAmount?: number | string | null;
    writeOffBaseAmount?: number | string | null;
    balance?: number | string | null;
  }

  export interface SettlementOffsetDetail {
    receivableDetails: ReceivableDetail[];
    payableDetails: PayableDetail[];
  }
}

export function getSettlementOffsetPage(
  params: PageParam & Record<string, any>,
) {
  return requestClient.get<PageResult<ErpSettlementOffsetApi.SettlementOffset>>(
    '/erp/settlement-offset/page',
    { params, timeout: 60_000 },
  );
}

export function getSettlementOffsetSummary(
  params: Record<string, any>,
  signal?: AbortSignal,
) {
  return requestClient.get<FinanceQuerySummary>(
    '/erp/settlement-offset/summary',
    {
      params,
      signal,
      timeout: 30_000,
    },
  );
}

export function getSettlementOffsetDetail(params: Record<string, any>) {
  return requestClient.get<ErpSettlementOffsetApi.SettlementOffsetDetail>(
    '/erp/settlement-offset/detail',
    { params },
  );
}

export function exportSettlementOffsetDetail(params: Record<string, any>) {
  return requestClient.download('/erp/settlement-offset/export-detail', {
    params,
  });
}
