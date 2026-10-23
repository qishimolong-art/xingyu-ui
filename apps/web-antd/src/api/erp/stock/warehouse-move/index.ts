import type { PageParam, PageResult } from '@vben/request';

import { stockDecimalRequestClient as requestClient } from '#/views/erp/stock/utils/stock-decimal-request';

export const WAREHOUSE_MOVE_STATUS = {
  DRAFT: 0,
  PROCESS: 10,
  PICKING: 15,
  APPROVE: 20,
  VOIDED: 30,
} as const;

export namespace ErpWarehouseMoveApi {
  export type WarehouseMovePageParam = Partial<PageParam> & Record<string, any>;

  export interface WarehouseMove {
    id?: number;
    no?: string;
    deptId?: number;
    deptName?: string;
    moveTime?: Date | number | string;
    moveType?: string;
    fromWarehouseId?: number;
    fromWarehouseName?: string;
    toWarehouseId?: number;
    toWarehouseName?: string;
    handlerId?: number;
    handlerName?: string;
    sourceType?: number;
    sourceId?: number;
    sourceNo?: string;
    itemCount?: number;
    totalCount?: null | number | string;
    totalPrice?: null | number | string;
    totalCostAmount?: null | number | string;
    totalWeight?: null | number | string;
    status?: number;
    statusName?: string;
    confirmUserId?: number;
    confirmUserName?: string;
    confirmTime?: Date | number | string;
    pickStatus?: number;
    pickedItemCount?: number;
    pickTotalItemCount?: number;
    pickProgress?: string;
    firstAuditUserName?: string;
    firstAuditTime?: Date | number | string;
    approveUserId?: number;
    approveUserName?: string;
    approveTime?: Date | number | string;
    remark?: string;
    fileUrl?: string;
    creator?: string;
    creatorName?: string;
    createTime?: Date | number | string;
    updater?: string;
    updaterName?: string;
    updateTime?: Date | number | string;
    productNames?: string;
    productCodes?: string;
    items?: WarehouseMoveItem[];
  }

  export interface WarehouseMoveItem {
    clientRowKey?: string;
    id?: number;
    operation?: 'delete' | 'insert' | 'update';
    fromWarehouseId?: number;
    fromWarehouseName?: string;
    fromWarehouseDeptName?: string;
    toWarehouseId?: number;
    toWarehouseName?: string;
    toWarehouseDeptName?: string;
    productId?: number;
    productName?: string;
    productCode?: string;
    productBarCode?: string;
    productUnitId?: number;
    productUnitName?: string;
    packageQty?: number;
    pieceCount?: number | string;
    vehicleModel?: string;
    originPlace?: string;
    standard?: string;
    featureCode?: string;
    brand?: string;
    drawingNo?: string;
    fromShelf?: string;
    toShelf?: string;
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
    count?: null | number | string;
    totalPrice?: null | number | string;
    costPrice?: null | number | string;
    costAmount?: null | number | string;
    weight?: null | number | string;
    totalWeight?: null | number | string;
    batchNo?: string;
    fromStockCount?: null | number | string;
    toStockCount?: null | number | string;
    remark?: string;
    seq?: number | string;
  }

  export interface WarehouseMoveSummary {
    totalRows?: number;
    totalItems?: number;
    totalCount?: null | number | string;
    totalCostAmount?: null | number | string;
    totalPrice?: null | number | string;
  }

  export interface StockImportResult {
    recordId?: number;
    successCount?: number;
    createCount?: number;
    updateCount?: number;
    failureCount?: number;
    failureDetails?: Array<Record<string, any> | string>;
  }

  export interface ExportField {
    field: string;
    label: string;
    group?: string;
    groupLabel?: string;
    required?: boolean;
    sort?: number;
  }

  export interface WarehouseMoveItemPageReq extends PageParam {
    excludedItemIds?: number[];
    mask?: boolean;
    moveId: number;
    orderDirection?: 'asc' | 'desc';
    orderField?: string;
  }

  export interface StockItemMatchResult {
    matches: Array<{ itemId: number; keyIndex: number; pageNo: number }>;
  }
}

export function getWarehouseMovePage(
  params: ErpWarehouseMoveApi.WarehouseMovePageParam,
) {
  return requestClient.get<PageResult<ErpWarehouseMoveApi.WarehouseMove>>(
    '/erp/warehouse-move/page',
    { params, timeout: 60_000 },
  );
}

export function getWarehouseMoveDeptSimplePage(params: PageParam) {
  return requestClient.get<PageResult<any>>(
    '/erp/warehouse-move/dept-simple-page',
    { params },
  );
}

export function getWarehouseMoveUserSimplePage(params: PageParam) {
  return requestClient.get<PageResult<any>>(
    '/erp/warehouse-move/user-simple-page',
    { params },
  );
}

export function getWarehouseMove(
  id: number,
  options: { includeItems?: boolean } = {},
) {
  const params: Record<string, any> = { id };
  if (options.includeItems !== undefined) {
    params.includeItems = options.includeItems;
  }
  return requestClient.get<ErpWarehouseMoveApi.WarehouseMove>(
    '/erp/warehouse-move/get',
    { params },
  );
}

export function getWarehouseMoveItemPage(
  params: ErpWarehouseMoveApi.WarehouseMoveItemPageReq,
) {
  return requestClient.get<PageResult<ErpWarehouseMoveApi.WarehouseMoveItem>>(
    '/erp/warehouse-move/item-page',
    { params },
  );
}

export function getWarehouseMoveEditItemPage(
  data: ErpWarehouseMoveApi.WarehouseMoveItemPageReq,
) {
  return requestClient.post<PageResult<ErpWarehouseMoveApi.WarehouseMoveItem>>(
    '/erp/warehouse-move/item-page',
    data,
  );
}

export function matchWarehouseMoveItems(data: {
  documentId: number;
  excludedItemIds?: number[];
  keys: Array<{
    fromShelf?: string;
    fromWarehouseId?: number;
    productId?: number;
    toWarehouseId?: number;
  }>;
  pageSize: number;
}) {
  return requestClient.post<ErpWarehouseMoveApi.StockItemMatchResult>(
    '/erp/warehouse-move/item-match',
    data,
  );
}

export function createWarehouseMove(
  data: ErpWarehouseMoveApi.WarehouseMove,
  decimalOptions: { decimalHiddenFields?: string[] } = {},
) {
  return requestClient.post<number>(
    '/erp/warehouse-move/create',
    data,
    decimalOptions,
  );
}

export function createWarehouseMoveDraft(
  data: ErpWarehouseMoveApi.WarehouseMove,
  decimalOptions: { decimalHiddenFields?: string[] } = {},
) {
  return requestClient.post<number>(
    '/erp/warehouse-move/create-draft',
    data,
    decimalOptions,
  );
}

export function updateWarehouseMove(
  data: ErpWarehouseMoveApi.WarehouseMove,
  decimalOptions: { decimalHiddenFields?: string[] } = {},
) {
  return requestClient.put('/erp/warehouse-move/update', data, decimalOptions);
}

export function getWarehouseMoveDeptSimpleList() {
  return requestClient.get<any[]>('/erp/warehouse-move/dept-simple-list');
}

export function updateWarehouseMoveDraft(
  data: ErpWarehouseMoveApi.WarehouseMove,
  decimalOptions: { decimalHiddenFields?: string[] } = {},
) {
  return requestClient.put(
    '/erp/warehouse-move/update-draft',
    data,
    decimalOptions,
  );
}

export function updateAndSubmitWarehouseMoveDraft(
  data: ErpWarehouseMoveApi.WarehouseMove,
  decimalOptions: { decimalHiddenFields?: string[] } = {},
) {
  return requestClient.put(
    '/erp/warehouse-move/update-and-submit',
    data,
    decimalOptions,
  );
}

export function submitWarehouseMove(id: number) {
  return requestClient.put('/erp/warehouse-move/submit', null, {
    params: { id },
  });
}

export function confirmWarehouseMove(id: number) {
  return requestClient.put('/erp/warehouse-move/confirm', null, {
    params: { id },
  });
}

export function cancelConfirmWarehouseMove(id: number) {
  return requestClient.put('/erp/warehouse-move/cancel-confirm', null, {
    params: { id },
  });
}

export function updateWarehouseMoveRemark(data: {
  id: number;
  remark: string;
}) {
  return requestClient.put('/erp/warehouse-move/update-remark', data);
}

export function updateWarehouseMoveStatus(id: number, status: number) {
  return requestClient.put('/erp/warehouse-move/update-status', null, {
    params: { id, status },
  });
}

export function deleteWarehouseMove(ids: number[]) {
  return requestClient.delete('/erp/warehouse-move/delete', {
    params: { ids: ids.join(',') },
  });
}

export function exportWarehouseMove(params: any) {
  return requestClient.download('/erp/warehouse-move/export-excel', {
    params,
  });
}

export function getWarehouseMoveSummary(
  params: ErpWarehouseMoveApi.WarehouseMovePageParam,
  signal?: AbortSignal,
) {
  return requestClient.get<ErpWarehouseMoveApi.WarehouseMoveSummary>(
    '/erp/warehouse-move/summary',
    { params, signal, timeout: 30_000 },
  );
}

export function getWarehouseMoveExportFields() {
  return requestClient.get<ErpWarehouseMoveApi.ExportField[]>(
    '/erp/warehouse-move/export-fields',
  );
}

export function getWarehouseMoveImportTemplate() {
  return requestClient.download('/erp/warehouse-move/get-import-template');
}

export function importWarehouseMove(file: File) {
  return requestClient.upload<ErpWarehouseMoveApi.StockImportResult>(
    '/erp/warehouse-move/import',
    { file },
  );
}

export function downloadWarehouseMoveImportFailureDetails(recordId: number) {
  return requestClient.download(
    '/erp/warehouse-move/import-failure-details/download',
    {
      params: { recordId },
    },
  );
}
