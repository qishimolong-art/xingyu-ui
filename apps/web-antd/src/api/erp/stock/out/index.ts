import type { PageParam, PageResult } from '@vben/request';

import { stockDecimalRequestClient as requestClient } from '#/views/erp/stock/utils/stock-decimal-request';

export namespace ErpStockOutApi {
  export interface StockOut {
    id?: number;
    no?: string;
    deptId?: number;
    deptName?: string;
    customerId?: number;
    customerName?: string;
    outTime?: Date | number;
    totalCount?: null | number | string;
    totalPrice?: null | number | string;
    totalWeight?: null | number | string;
    status?: number;
    statusName?: string;
    confirmUserId?: number;
    confirmUserName?: string;
    confirmTime?: Date | number;
    approveUserId?: number;
    approveUserName?: string;
    approveTime?: Date | number;
    pickStatus?: number;
    pickStatusName?: string;
    pickTotalItemCount?: number;
    pickedItemCount?: number;
    pickProgress?: string;
    remark?: string;
    fileUrl?: string;
    productNames?: string;
    productCodes?: string;
    warehouseNames?: string;
    itemCount?: number;
    creator?: string;
    creatorName?: string;
    createTime?: Date | number;
    updaterName?: string;
    updateTime?: Date | number;
    items?: StockOutItem[];
  }

  export interface StockOutItem {
    clientRowKey?: string;
    id?: number;
    operation?: 'delete' | 'insert' | 'update';
    warehouseId?: number;
    warehouseName?: string;
    warehouseDeptId?: number;
    warehouseDeptName?: string;
    productId?: number;
    productName?: string;
    productCode?: string;
    productUnitId?: number;
    productUnitName?: string;
    productBarCode?: string;
    batchNo?: string;
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

  export interface StockOutItemBatchUpdate {
    itemIds: number[];
    outId: number;
    warehouseId: number;
  }

  export interface StockOutItemPageReq extends PageParam {
    excludedItemIds?: number[];
    outId: number;
    mask?: boolean;
    orderDirection?: 'asc' | 'desc';
    orderField?: string;
  }

  export interface StockItemMatchResult {
    matches: Array<{ itemId: number; keyIndex: number; pageNo: number }>;
  }

  export interface StockOutPageReq extends PageParam {
    includeItems?: boolean;
    pickStatus?: number;
    productKeyword?: string;
  }

  export interface StockOutSummary {
    totalCount?: null | number | string;
    totalPrice?: null | number | string;
  }
}

export function getStockOutPage(params: ErpStockOutApi.StockOutPageReq) {
  return requestClient.get<PageResult<ErpStockOutApi.StockOut>>(
    '/erp/stock-out/page',
    { params, timeout: 60_000 },
  );
}

export function getStockOutSummary(
  params: Record<string, any>,
  signal?: AbortSignal,
) {
  return requestClient.get<ErpStockOutApi.StockOutSummary>(
    '/erp/stock-out/summary',
    { params, signal, timeout: 30_000 },
  );
}

export function getStockOutDeptSimplePage(params: PageParam) {
  return requestClient.get<PageResult<any>>('/erp/stock-out/dept-simple-page', {
    params,
  });
}

export function getStockOutUserSimplePage(params: PageParam) {
  return requestClient.get<PageResult<any>>('/erp/stock-out/user-simple-page', {
    params,
  });
}

export function getStockOut(
  id: number,
  options: { includeItems?: boolean } = {},
) {
  const params: Record<string, any> = { id };
  if (options.includeItems !== undefined) {
    params.includeItems = options.includeItems;
  }
  return requestClient.get<ErpStockOutApi.StockOut>('/erp/stock-out/get', {
    params,
  });
}

export function getStockOutItemPage(
  params: ErpStockOutApi.StockOutItemPageReq,
) {
  return requestClient.get<PageResult<ErpStockOutApi.StockOutItem>>(
    '/erp/stock-out/item-page',
    { params },
  );
}

export function getStockOutEditItemPage(
  data: ErpStockOutApi.StockOutItemPageReq,
) {
  return requestClient.post<PageResult<ErpStockOutApi.StockOutItem>>(
    '/erp/stock-out/item-page',
    data,
  );
}

export function matchStockOutItems(data: {
  documentId: number;
  excludedItemIds?: number[];
  keys: Array<{ batchNo?: string; productId?: number; warehouseId?: number }>;
  pageSize: number;
}) {
  return requestClient.post<ErpStockOutApi.StockItemMatchResult>(
    '/erp/stock-out/item-match',
    data,
  );
}

export function createStockOut(
  data: ErpStockOutApi.StockOut,
  decimalOptions: { decimalHiddenFields?: string[] } = {},
) {
  return requestClient.post('/erp/stock-out/create', data, decimalOptions);
}

export function updateStockOut(
  data: ErpStockOutApi.StockOut,
  decimalOptions: { decimalHiddenFields?: string[] } = {},
) {
  return requestClient.put('/erp/stock-out/update', data, decimalOptions);
}

export function batchUpdateStockOutItems(
  data: ErpStockOutApi.StockOutItemBatchUpdate,
) {
  return requestClient.put('/erp/stock-out/batch-update-items', data);
}

export function getStockOutWarehouseDeptSimpleList(warehouseId: number) {
  return requestClient.get<any[]>('/erp/stock-out/warehouse-dept-simple-list', {
    params: { warehouseId },
  });
}

export function getStockOutDeptSimpleList() {
  return requestClient.get<any[]>('/erp/stock-out/dept-simple-list');
}

export function updateStockOutRemark(data: { id: number; remark: string }) {
  return requestClient.put('/erp/stock-out/update-remark', data);
}

export function updateStockOutStatus(id: number, status: number) {
  return requestClient.put('/erp/stock-out/update-status', null, {
    params: { id, status },
  });
}

export function confirmStockOut(id: number) {
  return requestClient.put('/erp/stock-out/confirm', null, { params: { id } });
}

export function cancelConfirmStockOut(id: number) {
  return requestClient.put('/erp/stock-out/cancel-confirm', null, {
    params: { id },
  });
}

export function deleteStockOut(ids: number[]) {
  return requestClient.delete('/erp/stock-out/delete', {
    params: {
      ids: ids.join(','),
    },
  });
}

export function exportStockOut(params: any) {
  return requestClient.download('/erp/stock-out/export-excel', {
    params,
  });
}

export function getStockOutImportTemplate() {
  return requestClient.download('/erp/stock-out/get-import-template');
}

export function importStockOut(file: File) {
  return requestClient.upload<ErpStockOutApi.StockImportResult>(
    '/erp/stock-out/import',
    { file },
  );
}

export function downloadStockOutImportFailureDetails(recordId: number) {
  return requestClient.download(
    '/erp/stock-out/import-failure-details/download',
    {
      params: { recordId },
    },
  );
}

export function getStockOutExportFields() {
  return requestClient.get<
    {
      field: string;
      group?: string;
      groupLabel?: string;
      label: string;
      required?: boolean;
      sort?: number;
    }[]
  >('/erp/stock-out/export-fields');
}
