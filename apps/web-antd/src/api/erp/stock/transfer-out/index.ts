import type { PageParam, PageResult } from '@vben/request';

import type { ErpStockMoveApi } from '#/api/erp/stock/move';

import { stockDecimalRequestClient as requestClient } from '#/views/erp/stock/utils/stock-decimal-request';

export const STOCK_TRANSFER_OUT_STATUS = {
  APPROVE: 20,
  DRAFT: 0,
  PROCESS: 10,
} as const;

export namespace ErpStockTransferOutApi {
  export type StockTransferOut = ErpStockMoveApi.StockMove;
  export type StockTransferOutItem = ErpStockMoveApi.StockMoveItem;
  export type StockImportResult = ErpStockMoveApi.StockImportResult;
  export type StockTransferOutSummary = ErpStockMoveApi.StockMoveSummary;

  export interface ExportField {
    field: string;
    label: string;
    group?: string;
    groupLabel?: string;
    required?: boolean;
    sort?: number;
  }
}

export function getStockTransferOutPage(params: PageParam) {
  return requestClient.get<PageResult<ErpStockTransferOutApi.StockTransferOut>>(
    '/erp/stock-transfer-out/page',
    { params, timeout: 60_000 },
  );
}

export function getStockTransferOutSummary(
  params: Record<string, any>,
  signal?: AbortSignal,
) {
  return requestClient.get<ErpStockTransferOutApi.StockTransferOutSummary>(
    '/erp/stock-transfer-out/summary',
    { params, signal, timeout: 30_000 },
  );
}

export function getStockTransferOut(id: number) {
  return getStockTransferOutWithOptions(id);
}

export function getStockTransferOutWithOptions(
  id: number,
  options: { includeItems?: boolean } = {},
) {
  const params: Record<string, any> = { id };
  if (options.includeItems !== undefined) {
    params.includeItems = options.includeItems;
  }
  return requestClient.get<ErpStockTransferOutApi.StockTransferOut>(
    '/erp/stock-transfer-out/get',
    { params },
  );
}

export function getStockTransferOutItemPage(
  params: ErpStockMoveApi.StockMoveItemPageReq,
) {
  return requestClient.get<
    PageResult<ErpStockTransferOutApi.StockTransferOutItem>
  >('/erp/stock-transfer-out/item-page', { params });
}

export function getStockTransferOutEditItemPage(
  data: ErpStockMoveApi.StockMoveItemPageReq,
) {
  return requestClient.post<
    PageResult<ErpStockTransferOutApi.StockTransferOutItem>
  >('/erp/stock-transfer-out/item-page', data);
}

export function matchStockTransferOutItems(data: {
  documentId: number;
  excludedItemIds?: number[];
  keys: Array<{
    fromWarehouseId?: number;
    productId?: number;
    toWarehouseId?: number;
  }>;
  pageSize: number;
}) {
  return requestClient.post<ErpStockMoveApi.StockItemMatchResult>(
    '/erp/stock-transfer-out/item-match',
    data,
  );
}

export function createStockTransferOut(
  data: ErpStockTransferOutApi.StockTransferOut,
  decimalOptions: { decimalHiddenFields?: string[] } = {},
) {
  return requestClient.post(
    '/erp/stock-transfer-out/create',
    data,
    decimalOptions,
  );
}

export function createStockTransferOutDraft(
  data: ErpStockTransferOutApi.StockTransferOut,
  decimalOptions: { decimalHiddenFields?: string[] } = {},
) {
  return requestClient.post<number>(
    '/erp/stock-transfer-out/create-draft',
    data,
    decimalOptions,
  );
}

export function createAndSubmitStockTransferOut(
  data: ErpStockTransferOutApi.StockTransferOut,
  decimalOptions: { decimalHiddenFields?: string[] } = {},
) {
  return requestClient.post<number>(
    '/erp/stock-transfer-out/create-and-submit',
    data,
    decimalOptions,
  );
}

export function updateStockTransferOut(
  data: ErpStockTransferOutApi.StockTransferOut,
  decimalOptions: { decimalHiddenFields?: string[] } = {},
) {
  return requestClient.put(
    '/erp/stock-transfer-out/update',
    data,
    decimalOptions,
  );
}

export function updateStockTransferOutDraft(
  data: ErpStockTransferOutApi.StockTransferOut,
  decimalOptions: { decimalHiddenFields?: string[] } = {},
) {
  return requestClient.put(
    '/erp/stock-transfer-out/update-draft',
    data,
    decimalOptions,
  );
}

export function updateAndSubmitStockTransferOutDraft(
  data: ErpStockTransferOutApi.StockTransferOut,
  decimalOptions: { decimalHiddenFields?: string[] } = {},
) {
  return requestClient.put(
    '/erp/stock-transfer-out/update-and-submit',
    data,
    decimalOptions,
  );
}

export function submitStockTransferOutDraft(id: number) {
  return requestClient.put('/erp/stock-transfer-out/submit', null, {
    params: { id },
  });
}

export function updateStockTransferOutRemark(data: {
  id: number;
  remark: string;
}) {
  return requestClient.put('/erp/stock-transfer-out/update-remark', data);
}

export function approveStockTransferOut(id: number) {
  return requestClient.put('/erp/stock-transfer-out/approve', null, {
    params: { id },
    timeout: 30_000,
  });
}

export function unlockSaleCart(id: number) {
  return requestClient.put('/erp/stock-transfer-out/unlock-cart', null, {
    params: { id },
  });
}

export function deleteStockTransferOut(ids: number[]) {
  return requestClient.delete('/erp/stock-transfer-out/delete', {
    params: {
      ids: ids.join(','),
    },
  });
}

export function updateStockTransferOutStatus(id: number, status: number) {
  return requestClient.put('/erp/stock-transfer-out/update-status', null, {
    params: { id, status },
  });
}

export function exportStockTransferOut(params: any) {
  return requestClient.download('/erp/stock-transfer-out/export-excel', {
    params,
  });
}

export function getStockTransferOutExportFields() {
  return requestClient.get<ErpStockTransferOutApi.ExportField[]>(
    '/erp/stock-transfer-out/export-fields',
  );
}

export function getStockTransferOutFromDeptSimpleList() {
  return requestClient.get<any[]>(
    '/erp/stock-transfer-out/from-dept-simple-list',
  );
}

export function getStockTransferOutToDeptSimpleList() {
  return requestClient.get<any[]>(
    '/erp/stock-transfer-out/to-dept-simple-list',
  );
}

export function getStockTransferOutFromDeptSimplePage(params: PageParam) {
  return requestClient.get<PageResult<any>>(
    '/erp/stock-transfer-out/from-dept-simple-page',
    { params },
  );
}

export function getStockTransferOutToDeptSimplePage(params: PageParam) {
  return requestClient.get<PageResult<any>>(
    '/erp/stock-transfer-out/to-dept-simple-page',
    { params },
  );
}

export function getStockTransferOutUserSimplePage(params: PageParam) {
  return requestClient.get<PageResult<any>>(
    '/erp/stock-transfer-out/user-simple-page',
    { params },
  );
}

export function getStockTransferOutImportTemplate() {
  return requestClient.download('/erp/stock-transfer-out/import-template');
}

export function importStockTransferOut(file: File) {
  return requestClient.upload<ErpStockTransferOutApi.StockImportResult>(
    '/erp/stock-transfer-out/import',
    { file },
  );
}

export function downloadStockTransferOutImportFailureDetails(recordId: number) {
  return requestClient.download(
    '/erp/stock-transfer-out/import-failure-details/download',
    {
      params: { recordId },
    },
  );
}
