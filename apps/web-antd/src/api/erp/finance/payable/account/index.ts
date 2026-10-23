import type { PageParam, PageResult } from '@vben/request';

import { financeDecimalRequestClient as requestClient } from '#/views/erp/finance/utils/finance-decimal-request';

export namespace ErpPayableAccountApi {
  export type PayableDrilldownType =
    | 'BALANCE'
    | 'MISC_PAYABLE'
    | 'OPENING_BALANCE'
    | 'PAYABLE_ADJUST'
    | 'PAYMENT'
    | 'PRICE_ADJUST'
    | 'PURCHASE_IN'
    | 'PURCHASE_RETURN'
    | 'WRITE_OFF';

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

  export interface PayableAccount {
    supplierId?: number;
    supplierName?: string;
    contact?: string;
    mobile?: string;
    deptId?: number;
    deptName?: string;
    handlerId?: number;
    handlerName?: string;
    purchaseInAmount?: number | string | null;
    purchaseReturnAmount?: number | string | null;
    priceAdjustAmount?: number | string | null;
    otherPayableAmount?: number | string | null;
    miscPayableAmount?: number | string | null;
    openingPayableBalance?: number | string | null;
    paymentAmount?: number | string | null;
    writeOffAmount?: number | string | null;
    balance?: number | string | null;
    unclearedPrepayment?: number;
    lastBizTime?: string;
  }

  export interface PayableAccountSummary {
    supplierCount?: number;
    purchaseInAmount?: number | string | null;
    paymentAmount?: number | string | null;
    balance?: number | string | null;
    openingPayableBalance?: number | string | null;
    miscPayableAmount?: number | string | null;
    unclearedPrepayment?: number;
  }

  export interface PayableDetail {
    approveTime?: string;
    docType?: string;
    bizType?: number;
    bizId?: number;
    docDate?: string;
    docNo?: string;
    businessUserName?: string;
    priceAdjusted?: boolean;
    changeAmount?: number | string | null;
    deptId?: number;
    deptName?: string;
    prevBalance?: number | string | null;
    increaseAmount?: number | string | null;
    paymentAmount?: number | string | null;
    paymentDisplayAmount?: number | string | null;
    writeOffAmount?: number | string | null;
    allocatedAmount?: number | string | null;
    writeOffBaseAmount?: number | string | null;
    balance?: number | string | null;
    sourceNo?: string;
    sourceType?: 'FINANCE_PAYMENT' | 'PURCHASE_ORDER';
    sourceId?: number;
    factoryOrderNo?: string;
    invoiceStatus?: string;
    remark?: string;
    voucherNo?: string;
    confirmTime?: string;
    eventKey?: string;
    rowKey?: string;
  }
}

export function getPayableDrilldownPage(
  params: PageParam & Record<string, any>,
) {
  return requestClient.get<
    ErpPayableAccountApi.DrilldownPage<ErpPayableAccountApi.PayableDetail>
  >('/erp/payable-account/drilldown-page', { params });
}

export function exportPayableDrilldown(params: Record<string, any>) {
  return requestClient.download('/erp/payable-account/export-drilldown', {
    params,
  });
}

export function getPayableAccountPage(params: PageParam & Record<string, any>) {
  return requestClient.get<PageResult<ErpPayableAccountApi.PayableAccount>>(
    '/erp/payable-account/page',
    { params, timeout: 60_000 },
  );
}

export function getPayableAccountSummary(
  params: Record<string, any>,
  signal?: AbortSignal,
) {
  return requestClient.get<ErpPayableAccountApi.PayableAccountSummary>(
    '/erp/payable-account/summary',
    { params, signal, timeout: 30_000 },
  );
}

export function getPayableAccountDeptSimpleList() {
  return requestClient.get<any[]>('/erp/payable-account/dept-simple-list');
}

export function getPayableAccountDeptSimplePage(params: PageParam) {
  return requestClient.get<PageResult<any>>(
    '/erp/payable-account/dept-simple-page',
    { params },
  );
}

export function getPayableAccountUserSimplePage(params: PageParam) {
  return requestClient.get<PageResult<any>>(
    '/erp/payable-account/user-simple-page',
    { params },
  );
}

export function getPayableDetailList(params: Record<string, any>) {
  return requestClient.get<ErpPayableAccountApi.PayableDetail[]>(
    '/erp/payable-account/detail',
    { params },
  );
}

export function exportPayableAccount(params: Record<string, any>) {
  return requestClient.download('/erp/payable-account/export', { params });
}

export function exportPayableDetail(params: Record<string, any>) {
  return requestClient.download('/erp/payable-account/export-detail', {
    params,
  });
}

export function getPayableAccountExportFields(
  scope: 'detail' | 'drilldown' | 'overview' = 'overview',
  options: {
    dateBasis?: 'approveTime' | 'bizTime';
    detailType?: ErpPayableAccountApi.PayableDrilldownType;
  } = {},
) {
  return requestClient.get<
    Array<{ field: string; group?: string; groupLabel?: string; label: string }>
  >('/erp/payable-account/export-fields', {
    params: { scope, ...options },
  });
}

export function writeOffPayable(data: {
  bizId?: number;
  bizNo?: string;
  bizType?: number;
  remark?: string;
  supplierId: number;
  writeOffAmount: number | string | null;
}) {
  return requestClient.post('/erp/payable-account/writeoff', data);
}
