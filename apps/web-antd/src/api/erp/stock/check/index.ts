import type { PageParam, PageResult } from '@vben/request';

import { stockDecimalRequestClient as requestClient } from '#/views/erp/stock/utils/stock-decimal-request';

export namespace ErpStockCheckApi {
  export const CHECK_TYPE_COUNT = 1;
  export const CHECK_TYPE_COST = 2;
  export const STATUS_DRAFT = 0;
  export const STATUS_PROCESS = 10;
  export const STATUS_APPROVE = 20;

  export interface ExportField {
    field: string;
    label: string;
    group?: string;
    groupLabel?: string;
    required?: boolean;
    sort?: number;
  }

  export interface StockCheck {
    id?: number;
    no?: string;
    deptId?: number;
    deptName?: string;
    checkType?: number;
    checkTime?: Date | number;
    totalCount?: null | number | string;
    totalPrice?: null | number | string;
    totalWeight?: null | number | string;
    status?: number;
    remark?: string;
    fileUrl?: string;
    productNames?: string;
    productCodes?: string;
    creator?: string;
    creatorName?: string;
    createTime?: Date | number;
    updaterName?: string;
    updateTime?: Date | number;
    printCount?: number;
    printTime?: Date | number | string;
    items?: StockCheckItem[];
  }

  export interface StockCheckItem {
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
    batchNoEnabled?: boolean;
    packageQty?: number;
    pieceCount?: number | string;
    weight?: null | number | string;
    totalWeight?: null | number | string;
    count?: null | number | string;
    actualCount?: null | number | string;
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

  export interface StockCheckItemBatchUpdate {
    checkId: number;
    itemIds: number[];
    warehouseId: number;
  }

  export interface StockCheckItemPageReq extends PageParam {
    excludedItemIds?: number[];
    checkId: number;
    mask?: boolean;
    orderDirection?: 'asc' | 'desc';
    orderField?: string;
  }

  export interface StockItemMatchResult {
    matches: Array<{ itemId: number; keyIndex: number; pageNo: number }>;
  }

  export interface StockCheckPageReq extends PageParam {
    includeItems?: boolean;
    productKeyword?: string;
    status?: number;
  }

  export interface StockCheckSummary {
    totalCount?: null | number | string;
    totalPrice?: null | number | string;
  }
}

export function getStockCheckPage(params: ErpStockCheckApi.StockCheckPageReq) {
  return requestClient.get<PageResult<ErpStockCheckApi.StockCheck>>(
    '/erp/stock-check/page',
    { params, timeout: 60_000 },
  );
}

export function getStockCheckSummary(
  params: Record<string, any>,
  signal?: AbortSignal,
) {
  return requestClient.get<ErpStockCheckApi.StockCheckSummary>(
    '/erp/stock-check/summary',
    { params, signal, timeout: 30_000 },
  );
}

export function getStockCheckDeptSimplePage(params: PageParam) {
  return requestClient.get<PageResult<any>>(
    '/erp/stock-check/dept-simple-page',
    {
      params,
    },
  );
}

export function getStockCheckUserSimplePage(params: PageParam) {
  return requestClient.get<PageResult<any>>(
    '/erp/stock-check/user-simple-page',
    {
      params,
    },
  );
}

export function getStockCheck(
  id: number,
  options: { includeItems?: boolean } = {},
) {
  const params: Record<string, any> = { id };
  if (options.includeItems !== undefined) {
    params.includeItems = options.includeItems;
  }
  return requestClient.get<ErpStockCheckApi.StockCheck>(
    '/erp/stock-check/get',
    {
      params,
    },
  );
}

export function getStockCheckItemPage(
  params: ErpStockCheckApi.StockCheckItemPageReq,
) {
  return requestClient.get<PageResult<ErpStockCheckApi.StockCheckItem>>(
    '/erp/stock-check/item-page',
    { params },
  );
}

export function getStockCheckEditItemPage(
  data: ErpStockCheckApi.StockCheckItemPageReq,
) {
  return requestClient.post<PageResult<ErpStockCheckApi.StockCheckItem>>(
    '/erp/stock-check/item-page',
    data,
  );
}

export function matchStockCheckItems(data: {
  documentId: number;
  excludedItemIds?: number[];
  keys: Array<{ batchNo?: string; productId?: number; warehouseId?: number }>;
  pageSize: number;
}) {
  return requestClient.post<ErpStockCheckApi.StockItemMatchResult>(
    '/erp/stock-check/item-match',
    data,
  );
}

export function createStockCheck(
  data: ErpStockCheckApi.StockCheck,
  decimalOptions: { decimalHiddenFields?: string[] } = {},
) {
  return requestClient.post('/erp/stock-check/create', data, decimalOptions);
}

export function createStockCheckDraft(
  data: ErpStockCheckApi.StockCheck,
  decimalOptions: { decimalHiddenFields?: string[] } = {},
) {
  return requestClient.post(
    '/erp/stock-check/create-draft',
    data,
    decimalOptions,
  );
}

export function updateStockCheck(
  data: ErpStockCheckApi.StockCheck,
  decimalOptions: { decimalHiddenFields?: string[] } = {},
) {
  return requestClient.put('/erp/stock-check/update', data, decimalOptions);
}

export function batchUpdateStockCheckItems(
  data: ErpStockCheckApi.StockCheckItemBatchUpdate,
) {
  return requestClient.put('/erp/stock-check/batch-update-items', data);
}

export function getStockCheckWarehouseDeptSimpleList(warehouseId: number) {
  return requestClient.get<any[]>(
    '/erp/stock-check/warehouse-dept-simple-list',
    { params: { warehouseId } },
  );
}

export function getStockCheckDeptSimpleList() {
  return requestClient.get<any[]>('/erp/stock-check/dept-simple-list');
}

export function updateStockCheckDraft(
  data: ErpStockCheckApi.StockCheck,
  decimalOptions: { decimalHiddenFields?: string[] } = {},
) {
  return requestClient.put(
    '/erp/stock-check/update-draft',
    data,
    decimalOptions,
  );
}

export function updateAndSubmitStockCheckDraft(
  data: ErpStockCheckApi.StockCheck,
  decimalOptions: { decimalHiddenFields?: string[] } = {},
) {
  return requestClient.put(
    '/erp/stock-check/update-and-submit',
    data,
    decimalOptions,
  );
}

export function submitStockCheck(id: number) {
  return requestClient.put('/erp/stock-check/submit', null, {
    params: { id },
  });
}

export function updateStockCheckRemark(data: { id: number; remark: string }) {
  return requestClient.put('/erp/stock-check/update-remark', data);
}

export function updateStockCheckStatus(id: number, status: number) {
  return requestClient.put('/erp/stock-check/update-status', null, {
    params: { id, status },
  });
}

export function deleteStockCheck(ids: number[]) {
  return requestClient.delete('/erp/stock-check/delete', {
    params: {
      ids: ids.join(','),
    },
  });
}

export function exportStockCheck(params: any) {
  return requestClient.download('/erp/stock-check/export-excel', {
    params,
  });
}

export function getStockCheckImportTemplate() {
  return requestClient.download('/erp/stock-check/get-import-template');
}

export function importStockCheck(file: File) {
  return requestClient.upload<ErpStockCheckApi.StockImportResult>(
    '/erp/stock-check/import',
    { file },
  );
}

export function downloadStockCheckImportFailureDetails(recordId: number) {
  return requestClient.download(
    '/erp/stock-check/import-failure-details/download',
    {
      params: { recordId },
    },
  );
}

export function getStockCheckExportFields() {
  return requestClient.get<ErpStockCheckApi.ExportField[]>(
    '/erp/stock-check/export-fields',
  );
}
