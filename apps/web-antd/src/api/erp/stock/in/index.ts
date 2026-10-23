import type { PageParam, PageResult } from '@vben/request';

import { stockDecimalRequestClient as requestClient } from '#/views/erp/stock/utils/stock-decimal-request';

export namespace ErpStockInApi {
  export interface StockIn {
    id?: number;
    no?: string;
    deptId?: number;
    deptName?: string;
    supplierId?: number;
    supplierName?: string;
    warehouseNames?: string;
    inTime?: Date | number;
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
    itemCount?: number;
    printCount?: number;
    lastPrintTime?: Date | number;
    creator?: string;
    creatorName?: string;
    createTime?: Date | number;
    updaterName?: string;
    updateTime?: Date | number;
    items?: StockInItem[];
  }

  export interface StockInItem {
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

  export interface StockInItemBatchUpdate {
    inId: number;
    itemIds: number[];
    warehouseId: number;
  }

  export interface StockInItemPageReq extends PageParam {
    excludedItemIds?: number[];
    inId: number;
    mask?: boolean;
    orderDirection?: 'asc' | 'desc';
    orderField?: string;
  }

  export interface StockItemMatchResult {
    matches: Array<{ itemId: number; keyIndex: number; pageNo: number }>;
  }

  export interface StockInPageReq extends PageParam {
    includeItems?: boolean;
    pickStatus?: number;
    productKeyword?: string;
  }

  export interface StockInSummary {
    totalCount?: null | number | string;
    totalPrice?: null | number | string;
  }
}

export function getStockInPage(params: ErpStockInApi.StockInPageReq) {
  return requestClient.get<PageResult<ErpStockInApi.StockIn>>(
    '/erp/stock-in/page',
    { params, timeout: 60_000 },
  );
}

export function getStockInSummary(
  params: Record<string, any>,
  signal?: AbortSignal,
) {
  return requestClient.get<ErpStockInApi.StockInSummary>(
    '/erp/stock-in/summary',
    { params, signal, timeout: 30_000 },
  );
}

export function getStockInDeptSimplePage(params: PageParam) {
  return requestClient.get<PageResult<any>>('/erp/stock-in/dept-simple-page', {
    params,
  });
}

export function getStockInUserSimplePage(params: PageParam) {
  return requestClient.get<PageResult<any>>('/erp/stock-in/user-simple-page', {
    params,
  });
}

export function getStockIn(
  id: number,
  options: { includeItems?: boolean } = {},
) {
  const params: Record<string, any> = { id };
  if (options.includeItems !== undefined) {
    params.includeItems = options.includeItems;
  }
  return requestClient.get<ErpStockInApi.StockIn>('/erp/stock-in/get', {
    params,
  });
}

export function getStockInItemPage(params: ErpStockInApi.StockInItemPageReq) {
  return requestClient.get<PageResult<ErpStockInApi.StockInItem>>(
    '/erp/stock-in/item-page',
    { params },
  );
}

export function getStockInEditItemPage(data: ErpStockInApi.StockInItemPageReq) {
  return requestClient.post<PageResult<ErpStockInApi.StockInItem>>(
    '/erp/stock-in/item-page',
    data,
  );
}

export function matchStockInItems(data: {
  documentId: number;
  excludedItemIds?: number[];
  keys: Array<{ batchNo?: string; productId?: number; warehouseId?: number }>;
  pageSize: number;
}) {
  return requestClient.post<ErpStockInApi.StockItemMatchResult>(
    '/erp/stock-in/item-match',
    data,
  );
}

export function createStockIn(
  data: ErpStockInApi.StockIn,
  decimalOptions: { decimalHiddenFields?: string[] } = {},
) {
  return requestClient.post('/erp/stock-in/create', data, decimalOptions);
}

export function updateStockIn(
  data: ErpStockInApi.StockIn,
  decimalOptions: { decimalHiddenFields?: string[] } = {},
) {
  return requestClient.put('/erp/stock-in/update', data, decimalOptions);
}

export function batchUpdateStockInItems(
  data: ErpStockInApi.StockInItemBatchUpdate,
) {
  return requestClient.put('/erp/stock-in/batch-update-items', data);
}

export function getStockInWarehouseDeptSimpleList(warehouseId: number) {
  return requestClient.get<any[]>('/erp/stock-in/warehouse-dept-simple-list', {
    params: { warehouseId },
  });
}

export function getStockInDeptSimpleList() {
  return requestClient.get<any[]>('/erp/stock-in/dept-simple-list');
}

export function updateStockInRemark(data: { id: number; remark: string }) {
  return requestClient.put('/erp/stock-in/update-remark', data);
}

export function updateStockInStatus(id: number, status: number) {
  return requestClient.put('/erp/stock-in/update-status', null, {
    params: { id, status },
  });
}

export function confirmStockIn(id: number) {
  return requestClient.put('/erp/stock-in/confirm', null, { params: { id } });
}

export function cancelConfirmStockIn(id: number) {
  return requestClient.put('/erp/stock-in/cancel-confirm', null, {
    params: { id },
  });
}

export function deleteStockIn(ids: number[]) {
  return requestClient.delete('/erp/stock-in/delete', {
    params: {
      ids: ids.join(','),
    },
  });
}

export function exportStockIn(params: any) {
  return requestClient.download('/erp/stock-in/export-excel', {
    params,
  });
}

export function getStockInImportTemplate() {
  return requestClient.download('/erp/stock-in/get-import-template');
}

export function importStockIn(file: File) {
  return requestClient.upload<ErpStockInApi.StockImportResult>(
    '/erp/stock-in/import',
    { file },
  );
}

export function downloadStockInImportFailureDetails(recordId: number) {
  return requestClient.download(
    '/erp/stock-in/import-failure-details/download',
    {
      params: { recordId },
    },
  );
}

export function getStockInExportFields() {
  return requestClient.get<
    {
      field: string;
      group?: string;
      groupLabel?: string;
      label: string;
      required?: boolean;
      sort?: number;
    }[]
  >('/erp/stock-in/export-fields');
}
