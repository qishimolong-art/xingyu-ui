import type { PageParam, PageResult } from '@vben/request';

import type { ErpStockMoveApi } from '#/api/erp/stock/move';

import { stockDecimalRequestClient as requestClient } from '#/views/erp/stock/utils/stock-decimal-request';

export namespace ErpStockTransferInApi {
  export type StockTransferIn = ErpStockMoveApi.StockMove;
  export type StockTransferInItem = ErpStockMoveApi.StockMoveItem;
  export type StockTransferInSummary = ErpStockMoveApi.StockMoveSummary;

  export interface ExportField {
    field: string;
    label: string;
    group?: string;
    groupLabel?: string;
    required?: boolean;
    sort?: number;
  }
}

export function getStockTransferInPage(params: PageParam) {
  return requestClient.get<PageResult<ErpStockTransferInApi.StockTransferIn>>(
    '/erp/stock-transfer-in/page',
    { params, timeout: 60_000 },
  );
}

export function getStockTransferInSummary(
  params: Record<string, any>,
  signal?: AbortSignal,
) {
  return requestClient.get<ErpStockTransferInApi.StockTransferInSummary>(
    '/erp/stock-transfer-in/summary',
    { params, signal, timeout: 30_000 },
  );
}

export function getStockTransferIn(id: number) {
  return getStockTransferInWithOptions(id);
}

export function getStockTransferInWithOptions(
  id: number,
  options: { includeItems?: boolean } = {},
) {
  const params: Record<string, any> = { id };
  if (options.includeItems !== undefined) {
    params.includeItems = options.includeItems;
  }
  return requestClient.get<ErpStockTransferInApi.StockTransferIn>(
    '/erp/stock-transfer-in/get',
    { params },
  );
}

export function getStockTransferInItemPage(
  params: ErpStockMoveApi.StockMoveItemPageReq,
) {
  return requestClient.get<
    PageResult<ErpStockTransferInApi.StockTransferInItem>
  >('/erp/stock-transfer-in/item-page', { params });
}

export function exportStockTransferIn(params: any) {
  return requestClient.download('/erp/stock-transfer-in/export-excel', {
    params,
  });
}

export function getStockTransferInExportFields() {
  return requestClient.get<ErpStockTransferInApi.ExportField[]>(
    '/erp/stock-transfer-in/export-fields',
  );
}

export function getStockTransferInFromDeptSimpleList() {
  return requestClient.get<any[]>(
    '/erp/stock-transfer-in/from-dept-simple-list',
  );
}

export function getStockTransferInToDeptSimpleList() {
  return requestClient.get<any[]>('/erp/stock-transfer-in/to-dept-simple-list');
}

export function getStockTransferInFromDeptSimplePage(params: PageParam) {
  return requestClient.get<PageResult<any>>(
    '/erp/stock-transfer-in/from-dept-simple-page',
    { params },
  );
}

export function getStockTransferInToDeptSimplePage(params: PageParam) {
  return requestClient.get<PageResult<any>>(
    '/erp/stock-transfer-in/to-dept-simple-page',
    { params },
  );
}

export function getStockTransferInUserSimplePage(params: PageParam) {
  return requestClient.get<PageResult<any>>(
    '/erp/stock-transfer-in/user-simple-page',
    { params },
  );
}
