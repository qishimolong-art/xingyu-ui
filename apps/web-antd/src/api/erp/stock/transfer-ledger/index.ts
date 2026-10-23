import type { PageParam, PageResult } from '@vben/request';

import dayjs from 'dayjs';

import { stockDecimalRequestClient as requestClient } from '#/views/erp/stock/utils/stock-decimal-request';

export namespace ErpStockTransferLedgerApi {
  export type MatchStatus = 'ABNORMAL' | 'NORMAL';

  export interface QueryParams extends PageParam {
    exceptionCode?: string;
    fromDeptId?: number;
    fromWarehouseId?: number;
    keyword?: string;
    matchStatus?: MatchStatus;
    moveTime: string[];
    orderDirection?: string;
    orderField?: string;
    productId?: number;
    productKeyword?: string;
    sourceNo?: string;
    status?: number;
    toDeptId?: number;
    toWarehouseId?: number;
    transferInNo?: string;
    transferOutNo?: string;
  }

  export interface Summary {
    abnormalGroupCount: number;
    businessDate: string;
    completedGroupCount: number;
    differenceCount: number;
    ledgerStatus: MatchStatus;
    pendingGroupCount: number;
    transferInCount: number;
    transferInDocumentCount: number;
    transferOutCount: number;
    transferOutDocumentCount: number;
  }

  export interface Total {
    abnormalGroupCount: number;
    differenceCount: number;
    transferInCount: number;
    transferOutCount: number;
  }

  export interface Detail {
    batchNo?: string;
    packageQty?: number;
    productUnitName?: string;
    weight?: null | number | string;
    totalWeight?: null | number | string;
    businessDate: string;
    differenceCount: number;
    exceptionCodes: string[];
    exceptionReason?: string;
    fromDeptName?: string;
    fromWarehouseName?: string;
    groupKey: number;
    matchStatus: MatchStatus;
    productCode?: string;
    productName?: string;
    rowKey: string;
    sourceNo?: string;
    toDeptName?: string;
    toWarehouseName?: string;
    transferInCount: number;
    transferInId?: number;
    transferInNo?: string;
    transferInStatus?: number;
    transferOutCount: number;
    transferOutId?: number;
    transferOutNo?: string;
    transferOutStatus?: number;
  }
}

export function normalizeStockTransferLedgerDate(
  value: unknown,
  format = 'YYYY-MM-DD HH:mm:ss',
) {
  if (Array.isArray(value) && value.length >= 3) {
    const [year, month, day, hour = 0, minute = 0, second = 0] = value;
    const datePart = [year, month, day]
      .map((part, index) =>
        index === 0 ? String(part) : String(part).padStart(2, '0'),
      )
      .join('-');
    if (format === 'YYYY-MM-DD') {
      return datePart;
    }
    return `${datePart} ${[hour, minute, second]
      .map((part) => String(part).padStart(2, '0'))
      .join(':')}`;
  }
  const parsed = dayjs(value as any);
  return parsed.isValid() ? parsed.format(format) : String(value ?? '');
}

export function normalizeStockTransferLedgerParams<
  T extends Partial<ErpStockTransferLedgerApi.QueryParams>,
>(params: T): T {
  if (!Array.isArray(params.moveTime)) {
    return params;
  }
  return {
    ...params,
    moveTime: params.moveTime.map((value) =>
      normalizeStockTransferLedgerDate(value),
    ),
  };
}

export async function getStockTransferLedgerPage(
  params: ErpStockTransferLedgerApi.QueryParams,
) {
  const result = await requestClient.get<
    PageResult<ErpStockTransferLedgerApi.Summary>
  >('/erp/stock-transfer-ledger/page', {
    params: normalizeStockTransferLedgerParams(params),
  });
  return {
    ...result,
    list: (result.list ?? []).map((row) => ({
      ...row,
      businessDate: normalizeStockTransferLedgerDate(
        row.businessDate,
        'YYYY-MM-DD',
      ),
    })),
  };
}

export function getStockTransferLedgerTotal(
  params: ErpStockTransferLedgerApi.QueryParams,
) {
  return requestClient.get<ErpStockTransferLedgerApi.Total>(
    '/erp/stock-transfer-ledger/total',
    { params: normalizeStockTransferLedgerParams(params) },
  );
}

export function getStockTransferLedgerDetailPage(
  params: ErpStockTransferLedgerApi.QueryParams & { businessDate: string },
) {
  const normalizedParams = {
    ...normalizeStockTransferLedgerParams(params),
    businessDate: normalizeStockTransferLedgerDate(
      params.businessDate,
      'YYYY-MM-DD',
    ),
  };
  return requestClient.get<PageResult<ErpStockTransferLedgerApi.Detail>>(
    '/erp/stock-transfer-ledger/detail-page',
    { params: normalizedParams },
  );
}

export function exportStockTransferLedger(
  params: ErpStockTransferLedgerApi.QueryParams,
) {
  return requestClient.download('/erp/stock-transfer-ledger/export-excel', {
    params: normalizeStockTransferLedgerParams(params),
  });
}

export function getStockTransferLedgerFromDeptSimpleList() {
  return requestClient.get<any[]>(
    '/erp/stock-transfer-ledger/from-dept-simple-list',
  );
}

export function getStockTransferLedgerFromDeptSimplePage(params: PageParam) {
  return requestClient.get<PageResult<any>>(
    '/erp/stock-transfer-ledger/from-dept-simple-page',
    { params },
  );
}

export function getStockTransferLedgerToDeptSimpleList() {
  return requestClient.get<any[]>(
    '/erp/stock-transfer-ledger/to-dept-simple-list',
  );
}

export function getStockTransferLedgerToDeptSimplePage(params: PageParam) {
  return requestClient.get<PageResult<any>>(
    '/erp/stock-transfer-ledger/to-dept-simple-page',
    { params },
  );
}
