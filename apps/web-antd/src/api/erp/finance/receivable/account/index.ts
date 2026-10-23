import type { PageParam, PageResult } from '@vben/request';

import { financeDecimalRequestClient as requestClient } from '#/views/erp/finance/utils/finance-decimal-request';

export namespace ErpReceivableAccountApi {
  export type ReceivableDrilldownType =
    | 'BALANCE'
    | 'MISC_RECEIVABLE'
    | 'OPENING_BALANCE'
    | 'RECEIPT'
    | 'SALE_OUT'
    | 'SALE_RETURN';

  export interface DrilldownSummary {
    decreaseAmount?: number | string | null;
    detailCount?: number;
    endingAmount?: number | string | null;
    increaseAmount?: number | string | null;
    openingAmount?: number | string | null;
    targetAmount?: number | string | null;
  }

  export interface DrilldownPage<T> extends PageResult<T> {
    summary?: DrilldownSummary;
  }

  export interface ReceivableAccount {
    accountKey?: string;
    deptKey?: string;
    customerId?: number;
    customerName?: string;
    contact?: string;
    mobile?: string;
    areaId?: number;
    areaName?: string;
    customerType?: number;
    customerTypeName?: string;
    saleUserId?: number;
    saleUserName?: string;
    deptId?: number;
    deptName?: string;
    routeId?: number;
    routeName?: string;
    baseAmount?: number | string | null;
    creditLimit?: number;
    creditBalance?: number | string | null;
    creditTermDays?: number;
    saleOutAmount?: number | string | null;
    saleReturnAmount?: number | string | null;
    priceAdjustAmount?: number | string | null;
    receiptAmount?: number | string | null;
    writeOffAmount?: number | string | null;
    otherReceivableAmount?: number | string | null;
    miscReceivableAmount?: number | string | null;
    openingReceivableBalance?: number | string | null;
    receivableAmount?: number | string | null;
    receivedAmount?: number | string | null;
    unreceivedAmount?: number | string | null;
    billType?: string;
    receiveStatus?: string;
    receivableBalance?: number | string | null;
    preAdvanceAmount?: number | string | null;
    totalReceivable?: number;
    lastBizTime?: string;
  }

  export interface ReceivableAccountSummary {
    comboCount?: number;
    customerCount?: number;
    receivableBalance?: number | string | null;
    openingReceivableBalance?: number | string | null;
    preAdvanceAmount?: number | string | null;
    receiptAmount?: number | string | null;
    miscReceivableAmount?: number | string | null;
    creditBalance?: number | string | null;
  }

  export interface ReceivableDetail {
    auditorName?: string;
    deliveryMethod?: string;
    approveTime?: string;
    settleMethod?: string;
    invoiceStatus?: string;
    billAmount?: null | number;
    billNo?: string;
    remark?: string;
    voucherNo?: string;
    customerName?: string;
    internalNote?: string;
    receivedWriteOffAmount?: null | number;
    receivedAmount?: null | number;
    eventKey?: string;
    rowKey?: string;
    docType?: string;
    bizType?: number;
    bizId?: number;
    docDate?: string;
    docNo?: string;
    deptId?: number;
    deptName?: string;
    returnStatus?: number;
    priceAdjusted?: boolean;
    changeAmount?: number | string | null;
    prevBalance?: number | string | null;
    increaseAmount?: number | string | null;
    otherReceivableAmount?: number | string | null;
    receiptAmount?: number | string | null;
    receiptDisplayAmount?: number | string | null;
    writeOffAmount?: number | string | null;
    allocatedAmount?: number | string | null;
    writeOffBaseAmount?: number | string | null;
    balance?: number | string | null;
  }
}

export function getReceivableDrilldownPage(
  params: PageParam & Record<string, any>,
) {
  return requestClient.get<
    ErpReceivableAccountApi.DrilldownPage<ErpReceivableAccountApi.ReceivableDetail>
  >('/erp/receivable-account/drilldown-page', { params });
}

export function exportReceivableDrilldown(params: Record<string, any>) {
  return requestClient.download('/erp/receivable-account/export-drilldown', {
    params,
  });
}

export function getReceivableAccountPage(
  params: PageParam & Record<string, any>,
) {
  return requestClient.get<
    PageResult<ErpReceivableAccountApi.ReceivableAccount>
  >('/erp/receivable-account/page', { params, timeout: 60_000 });
}

export function getReceivableAccountSummary(
  params: Record<string, any>,
  signal?: AbortSignal,
) {
  return requestClient.get<ErpReceivableAccountApi.ReceivableAccountSummary>(
    '/erp/receivable-account/summary',
    {
      params,
      signal,
      timeout: 30_000,
    },
  );
}

export function getReceivableAccountDeptSimpleList() {
  return requestClient.get<any[]>('/erp/receivable-account/dept-simple-list');
}

export function getReceivableAccountDeptSimplePage(params: PageParam) {
  return requestClient.get<PageResult<any>>(
    '/erp/receivable-account/dept-simple-page',
    { params },
  );
}

export function getReceivableAccountUserSimplePage(params: PageParam) {
  return requestClient.get<PageResult<any>>(
    '/erp/receivable-account/user-simple-page',
    { params },
  );
}

export function getReceivableDetailList(params: Record<string, any>) {
  return requestClient.get<ErpReceivableAccountApi.ReceivableDetail[]>(
    '/erp/receivable-account/detail',
    { params },
  );
}

export function exportReceivableDetail(params: Record<string, any>) {
  return requestClient.download('/erp/receivable-account/export-detail', {
    params,
  });
}

export function exportReceivableAccount(params: Record<string, any>) {
  return requestClient.download('/erp/receivable-account/export', {
    params,
  });
}

export function getReceivableAccountExportFields(
  scope: 'detail' | 'drilldown' | 'overview' = 'overview',
  options: {
    dateBasis?: 'approveTime' | 'bizTime';
    detailType?: ErpReceivableAccountApi.ReceivableDrilldownType;
  } = {},
) {
  return requestClient.get<
    Array<{ field: string; group?: string; groupLabel?: string; label: string }>
  >('/erp/receivable-account/export-fields', {
    params: { scope, ...options },
  });
}

export function writeOffReceivable(data: {
  bizId?: number;
  bizNo?: string;
  bizType?: number;
  customerId: number;
  remark?: string;
  writeOffAmount: number | string | null;
}) {
  return requestClient.post('/erp/receivable-account/writeoff', data);
}
