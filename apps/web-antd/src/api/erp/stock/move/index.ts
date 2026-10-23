import type { PageParam, PageResult } from '@vben/request';

import { stockDecimalRequestClient as requestClient } from '#/views/erp/stock/utils/stock-decimal-request';

export namespace ErpStockMoveApi {
  export interface StockMove {
    id?: number;
    no?: string;
    deptId?: number;
    deptName?: string;
    transferDirection?: number;
    relatedMoveId?: number;
    relatedMoveNo?: string;
    fromDeptId?: number;
    fromDeptName?: string;
    toDeptId?: number;
    toDeptName?: string;
    moveTime?: Date | number;
    outTime?: Date | number;
    sourceType?: number;
    sourceId?: number;
    sourceNo?: string;
    settleStatus?: number | string;
    transferType?: number | string;
    directCustomerName?: string;
    paymentMethod?: string;
    priorityLevel?: string;
    invoiceType?: string;
    invoiceNo?: string;
    deliveryMethod?: string;
    itemCount?: number;
    logisticsNo?: string;
    logisticsCompany?: string;
    signImageUrl?: string;
    handlerName?: string;
    printCount?: number;
    lastPrintTime?: Date | number;
    directSettlementMethod?: string;
    salespersonName?: string;
    totalCount?: null | number | string;
    totalPrice?: null | number | string;
    totalWeight?: null | number | string;
    status?: number;
    remark?: string;
    fileUrl?: string;
    sourceOutId?: number;
    sourceOutNo?: string;
    fromWarehouseId?: number;
    fromWarehouseNames?: string;
    toWarehouseId?: number;
    toWarehouseNames?: string;
    productId?: number;
    productNames?: string;
    productCodes?: string;
    createTime?: Date | number;
    creator?: string;
    creatorName?: string;
    updater?: string;
    updaterName?: string;
    updateTime?: Date | number;
    approveUserId?: number;
    approveUserName?: string;
    approveTime?: Date | number;
    approveAllowed?: boolean;
    approveDisabledReason?: string;
    deleteAllowed?: boolean;
    deleteDisabledReason?: string;
    unlockCartAllowed?: boolean;
    unlockCartDisabledReason?: string;
    items?: StockMoveItem[];
  }

  export interface StockMoveItem {
    clientRowKey?: string;
    id?: number;
    operation?: 'delete' | 'insert' | 'update';
    fromWarehouseId?: number;
    fromWarehouseName?: string;
    fromWarehouseDeptId?: number;
    fromWarehouseDeptName?: string;
    toWarehouseId?: number;
    toWarehouseName?: string;
    toWarehouseDeptId?: number;
    toWarehouseDeptName?: string;
    fromDeptId?: number;
    fromDeptName?: string;
    toDeptId?: number;
    toDeptName?: string;
    productId?: number;
    productName?: string;
    productCode?: string;
    productBarCode?: string;
    productUnitName?: string;
    productUnitId?: number;
    packageQty?: number;
    pieceCount?: number | string;
    weight?: null | number | string;
    totalWeight?: null | number | string;
    count?: null | number | string;
    productPurchasePrice?: number;
    salePrice?: number;
    lastSalePrice?: number;
    minPrice?: number;
    referencePrice?: number;
    retailPrice?: number;
    lastPurchasePrice?: number;
    grossProfitRate?: number;
    backupPrice1?: number;
    wholesalePrice?: number;
    sharePrice?: number;
    priceVisible?: boolean;
    productPrice?: null | number | string;
    totalPrice?: null | number | string;
    stockCount?: null | number | string;
    fromShelf?: string;
    batchNo?: string;
    sourceInId?: number;
    sourceInItemId?: number;
    sourceInNo?: string;
    sourceSaleReturnId?: number;
    sourceSaleReturnItemId?: number;
    sourceSaleReturnNo?: string;
    sourceCount?: number;
    remark?: string;
  }

  export interface StockImportResult {
    recordId?: number;
    successCount?: number;
    createCount?: number;
    updateCount?: number;
    failureCount?: number;
    failureDetails?: Array<Record<string, any> | string>;
  }

  export interface StockMoveItemPageReq extends PageParam {
    excludedItemIds?: number[];
    mask?: boolean;
    moveId: number;
    orderDirection?: 'asc' | 'desc';
    orderField?: string;
  }

  export interface StockItemMatchResult {
    matches: Array<{ itemId: number; keyIndex: number; pageNo: number }>;
  }

  export interface StockMovePageReq extends PageParam {
    includeItems?: boolean;
    productKeyword?: string;
  }

  export interface StockMoveSummary {
    totalCount?: null | number | string;
    totalPrice?: null | number | string;
  }
}

export function getStockMovePage(params: ErpStockMoveApi.StockMovePageReq) {
  return requestClient.get<PageResult<ErpStockMoveApi.StockMove>>(
    '/erp/stock-move/page',
    { params, timeout: 60_000 },
  );
}

export function getStockMoveSummary(
  params: Record<string, any>,
  signal?: AbortSignal,
) {
  return requestClient.get<ErpStockMoveApi.StockMoveSummary>(
    '/erp/stock-move/summary',
    { params, signal, timeout: 30_000 },
  );
}

export function getStockMoveDeptSimplePage(params: PageParam) {
  return requestClient.get<PageResult<any>>(
    '/erp/stock-move/dept-simple-page',
    {
      params,
    },
  );
}

export function getStockMoveUserSimplePage(params: PageParam) {
  return requestClient.get<PageResult<any>>(
    '/erp/stock-move/user-simple-page',
    {
      params,
    },
  );
}

export function getStockMove(
  id: number,
  options: { includeItems?: boolean } = {},
) {
  const params: Record<string, any> = { id };
  if (options.includeItems !== undefined) {
    params.includeItems = options.includeItems;
  }
  return requestClient.get<ErpStockMoveApi.StockMove>('/erp/stock-move/get', {
    params,
  });
}

export function getStockMoveItemPage(
  params: ErpStockMoveApi.StockMoveItemPageReq,
) {
  return requestClient.get<PageResult<ErpStockMoveApi.StockMoveItem>>(
    '/erp/stock-move/item-page',
    { params },
  );
}

export function getStockMoveEditItemPage(
  data: ErpStockMoveApi.StockMoveItemPageReq,
) {
  return requestClient.post<PageResult<ErpStockMoveApi.StockMoveItem>>(
    '/erp/stock-move/item-page',
    data,
  );
}

export function matchStockMoveItems(data: {
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
    '/erp/stock-move/item-match',
    data,
  );
}

export function createStockMove(
  data: ErpStockMoveApi.StockMove,
  decimalOptions: { decimalHiddenFields?: string[] } = {},
) {
  return requestClient.post('/erp/stock-move/create', data, decimalOptions);
}

export function updateStockMove(
  data: ErpStockMoveApi.StockMove,
  decimalOptions: { decimalHiddenFields?: string[] } = {},
) {
  return requestClient.put('/erp/stock-move/update', data, decimalOptions);
}

export function getStockMoveDeptSimpleList() {
  return requestClient.get<any[]>('/erp/stock-move/dept-simple-list');
}

export function updateStockMoveRemark(data: { id: number; remark: string }) {
  return requestClient.put('/erp/stock-move/update-remark', data);
}

export function updateStockMoveStatus(id: number, status: number) {
  return requestClient.put('/erp/stock-move/update-status', null, {
    params: { id, status },
  });
}

export function deleteStockMove(ids: number[]) {
  return requestClient.delete('/erp/stock-move/delete', {
    params: {
      ids: ids.join(','),
    },
  });
}

export function exportStockMove(params: any) {
  return requestClient.download('/erp/stock-move/export-excel', { params });
}

export function getStockMoveImportTemplate() {
  return requestClient.download('/erp/stock-move/get-import-template');
}

export function importStockMove(file: File) {
  return requestClient.upload<ErpStockMoveApi.StockImportResult>(
    '/erp/stock-move/import',
    { file },
  );
}
