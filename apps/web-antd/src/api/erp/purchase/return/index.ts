import type { PageParam, PageResult } from '@vben/request';

import { stripErpDocumentTaxFields } from '#/api/erp/common/strip-document-tax-fields';
import { requestClient } from '#/api/request';

export const PURCHASE_RETURN_STATUS = {
  DRAFT: 0,
  PROCESS: 10,
  APPROVE: 20,
} as const;

export namespace ErpPurchaseReturnApi {
  export interface PurchaseReturnSummary {
    documentCount?: number;
    itemCount?: number;
    totalCount?: number;
    totalPrice?: number;
  }
  export interface PurchaseReturn {
    id?: number;
    no?: string;
    orderId?: number;
    orderNo?: string;
    supplierId?: number;
    supplierName?: string;
    returnTime?: Date | number | string;
    totalCount?: number;
    totalPrice?: number;
    discountPercent?: number;
    discountPrice?: number;
    refundPrice?: number;
    itemCount?: number;
    feeAmount?: number;
    status?: number;
    remark?: string;
    totalProductPrice?: number;
    totalTaxPrice?: number;
    otherPrice?: number;
    items?: PurchaseReturnItem[];
    fileUrl?: string;
    createTime?: Date | number | string;
    creator?: number | string;
    creatorName?: string;
    updater?: number | string;
    updaterName?: string;
    updateTime?: Date | number | string;
    purchaser?: number | string;
    purchaserName?: string;
    invoiceType?: string;
    transportMethod?: string;
    settleMethod?: string;
    packageCount?: number;
    freightAmount?: number;
    logisticsCompany?: string;
    factoryOrderNo?: string;
    shipArea?: string;
    warehouseType?: string;
    freightType?: string;
    logisticsNo?: string;
    priority?: string;
    orderMethod?: string;
    sourceType?: string;
    taxRate?: number;
    deptId?: number;
    deptName?: string;
    handler?: number;
    handlerName?: string;
    returnMode?: number;
    sourceInId?: number;
    sourceInNo?: string;
  }

  export interface PurchaseReturnRefundSummary {
    id?: number;
    refundableAmount?: number;
    refundedAmount?: number;
    unrefundedAmount?: number;
    refundStatus?: number;
  }

  export interface SupplierDeptSimple {
    id?: number;
    name?: string;
    parentId?: number;
  }

  export interface PurchaseReturnItem {
    clientRowKey?: string; // 前端表格行身份，不传后端
    count?: number;
    countText?: string;
    id?: number;
    operation?: 'delete' | 'insert' | 'update';
    seq?: number;
    orderItemId?: number;
    productBarCode?: string;
    productId?: number;
    productCode?: string;
    productName: string;
    productPrice: number;
    productPriceText?: string;
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
    productUnitId?: number;
    productUnitName?: string;
    weight?: number;
    totalProductPrice?: number;
    remark: string;
    stockCount?: number;
    taxPercent?: number;
    taxPrice?: number;
    totalPrice?: number;
    warehouseId?: number;
    deptId?: number;
    warehouseName?: string;
    deptName?: string;
    partCode?: string;
    partName?: string;
    vehicleModel?: string;
    originPlace?: string;
    packageQty?: number;
    pieceCount?: number | string;
    wholeQty?: number;
    warehousePosition?: string;
    drawingNo?: string;
    batchNo?: string;
    batchNoEnabled?: boolean;
    barCode?: string;
    brand?: string;
    businessEntity?: string;
    sourceInId?: number;
    sourceInItemId?: number;
    sourceInNo?: string;
    sourceSaleReturnId?: number;
    sourceSaleReturnItemId?: number;
    sourceSaleReturnNo?: string;
    inCount?: number;
    returnableCount?: number;
    createTime?: Date | number | string;
    creator?: number | string;
    creatorName?: string;
    updateTime?: Date | number | string;
    updater?: number | string;
    updaterName?: string;
  }

  export interface PurchaseReturnItemBatchUpdate {
    returnId: number;
    itemIds: number[];
    warehouseId?: number;
    deptId?: number;
  }

  export interface PurchaseReturnItemPageParam extends PageParam {
    excludedItemIds?: number[];
    mask?: boolean;
    orderDirection?: 'asc' | 'desc';
    orderField?: string;
    returnId: number;
  }

  export interface PurchaseItemMatchResult {
    matches: Array<{ itemId: number; keyIndex: number; pageNo: number }>;
  }

  export interface PurchaseReturnImportResult {
    returnMode?: number;
    supplierId?: number;
    successCount?: number;
    failureCount?: number;
    items?: PurchaseReturnItem[];
    failureDetails?: Array<{
      productCode?: string;
      reason?: string;
      rowNo?: number;
    }>;
  }

  export interface PurchaseReturnOrderImportResult {
    successCount?: number;
    failureCount?: number;
    recordId?: number;
    documentIds?: number[];
    failureDetails?: Array<{
      orderNo?: string;
      productCode?: string;
      reason?: string;
      rowNo?: number;
    }>;
  }

  export interface ExportField {
    field: string;
    label: string;
    group?: string;
    groupLabel?: string;
    required?: boolean;
    sort?: number;
  }
}

export function getPurchaseReturnPage(params: any) {
  return requestClient.get<PageResult<ErpPurchaseReturnApi.PurchaseReturn>>(
    '/erp/purchase-return/page',
    { params, timeout: 60_000 },
  );
}

export function getPurchaseReturnSummary(params: any, signal?: AbortSignal) {
  return requestClient.get<ErpPurchaseReturnApi.PurchaseReturnSummary>(
    '/erp/purchase-return/summary',
    { params, signal, timeout: 30_000 },
  );
}

export function getPurchaseReturn(
  id: number,
  options?: { includeItems?: boolean; mask?: boolean },
) {
  return requestClient.get<ErpPurchaseReturnApi.PurchaseReturn>(
    '/erp/purchase-return/get',
    {
      params: {
        id,
        includeItems: options?.includeItems,
        mask: options?.mask,
      },
    },
  );
}

export function getPurchaseReturnItemPage(
  params: ErpPurchaseReturnApi.PurchaseReturnItemPageParam,
) {
  return requestClient.get<PageResult<ErpPurchaseReturnApi.PurchaseReturnItem>>(
    '/erp/purchase-return/item-page',
    { params },
  );
}

export function getPurchaseReturnItemPageForEdit(
  data: ErpPurchaseReturnApi.PurchaseReturnItemPageParam,
) {
  return requestClient.post<
    PageResult<ErpPurchaseReturnApi.PurchaseReturnItem>
  >('/erp/purchase-return/item-page', data);
}

export function matchPurchaseReturnItems(data: {
  documentId: number;
  excludedItemIds?: number[];
  keys: Array<{ productId?: number; warehouseId?: number }>;
  pageSize: number;
}) {
  return requestClient.post<ErpPurchaseReturnApi.PurchaseItemMatchResult>(
    '/erp/purchase-return/item-match',
    data,
  );
}

export function getPurchaseReturnPaymentSummary(id: number) {
  return requestClient.get<ErpPurchaseReturnApi.PurchaseReturnRefundSummary>(
    '/erp/purchase-return/payment-summary',
    { params: { id } },
  );
}

export function createPurchaseReturn(
  data: ErpPurchaseReturnApi.PurchaseReturn,
) {
  return requestClient.post(
    '/erp/purchase-return/create',
    stripErpDocumentTaxFields(data),
  );
}

export function createPurchaseReturnDraft(
  data: ErpPurchaseReturnApi.PurchaseReturn,
) {
  return requestClient.post(
    '/erp/purchase-return/create-draft',
    stripErpDocumentTaxFields(data),
  );
}

export function updatePurchaseReturn(
  data: ErpPurchaseReturnApi.PurchaseReturn,
) {
  return requestClient.put(
    '/erp/purchase-return/update',
    stripErpDocumentTaxFields(data),
  );
}

export function getPurchaseReturnWarehouseDeptSimpleList(warehouseId: number) {
  return requestClient.get<any[]>(
    '/erp/purchase-return/warehouse-dept-simple-list',
    { params: { warehouseId } },
  );
}

export function getPurchaseReturnWarehouseDeptSimplePage(
  params: Partial<PageParam> & { warehouseId?: number },
) {
  return requestClient.get<PageResult<any>>(
    '/erp/purchase-return/warehouse-dept-simple-page',
    { params },
  );
}

export function getPurchaseReturnSupplierDeptSimpleList(supplierId: number) {
  return requestClient.get<ErpPurchaseReturnApi.SupplierDeptSimple[]>(
    '/erp/purchase-return/supplier-dept-simple-list',
    { params: { supplierId } },
  );
}

export function getPurchaseReturnSupplierDeptSimplePage(
  params: Partial<PageParam> & { supplierId?: number },
) {
  return requestClient.get<PageResult<ErpPurchaseReturnApi.SupplierDeptSimple>>(
    '/erp/purchase-return/supplier-dept-simple-page',
    { params },
  );
}

export function getPurchaseReturnDeptSimpleList() {
  return requestClient.get<any[]>('/erp/purchase-return/dept-simple-list');
}

export function getPurchaseReturnDeptSimplePage(params: Partial<PageParam>) {
  return requestClient.get<PageResult<any>>(
    '/erp/purchase-return/dept-simple-page',
    { params },
  );
}

export function getPurchaseReturnUserSimplePage(params: Partial<PageParam>) {
  return requestClient.get<PageResult<any>>(
    '/erp/purchase-return/user-simple-page',
    { params },
  );
}

export function batchUpdatePurchaseReturnItems(
  data: ErpPurchaseReturnApi.PurchaseReturnItemBatchUpdate,
) {
  return requestClient.put('/erp/purchase-return/batch-update-items', data);
}

export function updatePurchaseReturnDraft(
  data: ErpPurchaseReturnApi.PurchaseReturn,
) {
  return requestClient.put(
    '/erp/purchase-return/update-draft',
    stripErpDocumentTaxFields(data),
  );
}

export function updateAndSubmitPurchaseReturnDraft(
  data: ErpPurchaseReturnApi.PurchaseReturn,
) {
  return requestClient.put(
    '/erp/purchase-return/update-and-submit',
    stripErpDocumentTaxFields(data),
  );
}

export function submitPurchaseReturn(id: number) {
  return requestClient.put('/erp/purchase-return/submit', null, {
    params: { id },
  });
}

/** 修改采购退货备注，不受审批状态限制 */
export function updatePurchaseReturnRemark(data: {
  id: number;
  remark: string;
}) {
  return requestClient.put('/erp/purchase-return/update-remark', data);
}

export function updatePurchaseReturnStatus(id: number, status: number) {
  return requestClient.put('/erp/purchase-return/update-status', null, {
    params: { id, status },
  });
}

export function deletePurchaseReturn(ids: number[]) {
  return requestClient.delete('/erp/purchase-return/delete', {
    params: { ids: ids.join(',') },
  });
}

export function exportPurchaseReturn(params: any) {
  return requestClient.download('/erp/purchase-return/export-excel', {
    params,
  });
}

export function getPurchaseReturnExportFields() {
  return requestClient.get<ErpPurchaseReturnApi.ExportField[]>(
    '/erp/purchase-return/export-fields',
  );
}

export function importPurchaseReturn(file: File) {
  return requestClient.upload<ErpPurchaseReturnApi.PurchaseReturnImportResult>(
    '/erp/purchase-return/import',
    { file },
  );
}

export function getPurchaseReturnImportTemplate() {
  return requestClient.download('/erp/purchase-return/get-import-template');
}

export function importPurchaseReturnOrder(file: File) {
  return requestClient.upload<ErpPurchaseReturnApi.PurchaseReturnOrderImportResult>(
    '/erp/purchase-return/import-order',
    { file },
  );
}

export function getPurchaseReturnOrderImportTemplate() {
  return requestClient.download(
    '/erp/purchase-return/get-order-import-template',
  );
}

export function downloadPurchaseReturnImportFailureDetails(recordId: number) {
  return requestClient.download(
    '/erp/purchase-return/import-failure-details/download',
    { params: { recordId } },
  );
}
