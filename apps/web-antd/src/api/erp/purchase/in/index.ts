import type { PageParam, PageResult } from '@vben/request';

import { requestClient } from '#/api/request';
import { stripErpDocumentTaxFields } from '#/api/erp/common/strip-document-tax-fields';

export const PURCHASE_IN_STATUS = {
  DRAFT: 0,
  PROCESS: 10,
  APPROVE: 20,
} as const;

export namespace ErpPurchaseInApi {
  export interface PurchaseInSummary {
    totalCount?: number;
    totalProductPrice?: number;
    discountPrice?: number;
    totalFreight1?: number;
    totalPrice?: number;
    totalWithFreight?: number;
  }
  export interface PurchaseIn {
    id?: number;
    no?: string;
    supplierId?: number;
    accountId?: number;
    inTime?: Date | string;
    totalCount?: number;
    totalPrice?: number;
    status?: number;
    remark?: string;
    outCount?: number;
    returnCount?: number;
    returnStatus?: number;
    transferOutCount?: number;
    transferOutStatus?: number;
    discountPercent?: number;
    discountPrice?: number;
    paymentPrice?: number;
    paymentStatus?: number;
    feeAmount?: number;
    otherPrice?: number;
    totalProductPrice?: number;
    taxPrice?: number;
    totalTaxPrice?: number;
    purchaser?: string | number;
    purchaserName?: string;
    invoiceType?: string;
    transportMethod?: string;
    settleMethod?: string;
    purchaseArea?: string;
    accountant?: string | number;
    accountantName?: string;
    floatRate?: number;
    packageCount?: number;
    factoryOrderNo?: string;
    orderMethod?: string;
    freightType1?: string;
    freightType2?: string;
    freightObject1?: string;
    freightObject2?: string;
    logisticsCompany?: string;
    handler?: string | number;
    handlerName?: string;
    taxRate?: number;
    deptId?: number;
    deptName?: string;
    purchaseDiscount?: number;
    priority?: string;
    unloader?: string;
    floatRecord?: string;
    receiveUnit?: string;
    totalFreight1?: number;
    totalFreight2?: number;
    paymentDate?: Date | string;
    hasInvoice?: boolean;
    businessEntity?: string;
    items?: PurchaseInItem[];
    itemCount?: number;
    adjusted?: boolean;
    adjustStatus?: number;
    orderId?: number;
    orderNo?: string;
    supplierName?: string;
    fileUrl?: string;
    creator?: string;
    creatorName?: string;
    createTime?: Date | string;
    updater?: string;
    updaterName?: string;
    updateTime?: Date | string;
    hasStockInBill?: boolean;
    stockInBills?: StockInBillBrief[];
  }

  export interface StockInBillBrief {
    id?: number;
    no?: string;
    warehouseId?: number;
    warehouseName?: string;
    status?: number;
    statusName?: string;
    totalCount?: number;
    pickedCount?: number;
    billDate?: Date | string;
  }

  export interface PurchaseInPaymentSummary {
    id?: number;
    payableAmount?: number;
    paidAmount?: number;
    unpaidAmount?: number;
    paymentStatus?: number;
  }

  export interface SupplierDeptSimple {
    id?: number;
    name?: string;
    parentId?: number;
  }

  export interface PurchaseInItemBatchUpdate {
    inId: number;
    itemIds: number[];
    warehouseId?: number;
    deptId?: number;
  }

  export interface PurchaseInItemPageParam extends PageParam {
    excludedItemIds?: number[];
    inId: number;
    mask?: boolean;
    orderDirection?: 'asc' | 'desc';
    orderField?: string;
  }

  export interface PurchaseItemMatchResult {
    matches: Array<{ itemId: number; keyIndex: number; pageNo: number }>;
  }

  export interface PurchaseInItem {
    clientRowKey?: string; // 前端表格行身份，不传后端
    count?: number;
    countText?: string;
    priceText?: string;
    taxPercentText?: string;
    wholeQtyText?: string;
    id?: number;
    operation?: 'delete' | 'insert' | 'update';
    seq?: number;
    orderItemId?: number;
    productBarCode?: string;
    productId?: number;
    productCode?: string;
    productName: string;
    productPrice: number;
    productCostAmount?: number;
    productCostPrice?: number;
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
    gift?: boolean;
    productUnitId?: number;
    productUnitName?: string;
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
    inCount?: number;
    packageQty?: number;
    pieceCount?: number | string;
    wholeQty?: number;
    warehousePosition?: string;
    drawingNo?: string;
    batchNo?: string;
    batchNoEnabled?: boolean;
    barCode?: string;
    brand?: string;
    vehicleModel?: string;
    originPlace?: string;
    businessEntity?: string;
    originalProductPrice?: number;
    adjusted?: boolean;
    adjustId?: number;
    hasInvoice?: boolean;
    returnCount?: number;
    returnStatus?: number;
    hasStockInBill?: boolean;
    stockInBillNos?: string;
    stockInBillStatus?: number;
    stockInBillStatusName?: string;
    stockInBillCount?: number;
    stockInBillPickedCount?: number;
    stockInBillRemainCount?: number;
  }

  export interface PurchaseInForAdjust {
    id: number;
    no: string;
    supplierId: number;
    supplierName?: string;
    inTime: number | string;
    auditorId?: number;
    auditorName?: string;
    approveTime?: number | string;
    totalProductPrice: number;
    totalTaxPrice: number;
    totalPrice: number;
    itemCount: number;
    adjusted?: boolean;
    hasInvoice?: boolean;
    invoiceType?: string;
    remark?: string;
  }

  export interface PurchaseInItemForAdjust {
    id: number;
    inId: number;
    inNo: string;
    inTime?: number | string;
    productId: number;
    productCode?: string;
    productName?: string;
    batchNo?: string;
    productUnitId?: number;
    productUnitName?: string;
    weight?: number;
    packageQty?: number;
    warehouseId?: number;
    deptId?: number;
    warehouseName?: string;
    stockCount?: number;
    productPrice: number;
    originalProductPrice?: number;
    count: number;
    totalPrice: number;
    vehicleModel?: string;
    standard?: string;
    featureCode?: string;
    originPlace?: string;
    brand?: string;
    drawingNo?: string;
    warehousePosition?: string;
    adjusted?: boolean;
    hasInvoice?: boolean;
  }

  export interface PurchaseInAdjustableItemPageParam extends PageParam {
    supplierId: number;
    inIds?: number[];
    excludeAdjusted?: boolean;
    excludeInvoiced?: boolean;
    productKeyword?: string;
  }

  export interface ReturnableItem {
    sourceInId?: number;
    sourceInItemId?: number;
    sourceInNo?: string;
    productId?: number;
    productName?: string;
    productCode?: string;
    productUnitId?: number;
    productUnitName?: string;
    weight?: number;
    warehouseId?: number;
    deptId?: number;
    warehouseName?: string;
    deptName?: string;
    productPrice?: number;
    inCount?: number;
    returnedCount?: number;
    returnableCount?: number;
    taxPercent?: number;
    packageQty?: number;
    wholeQty?: number;
    warehousePosition?: string;
    drawingNo?: string;
    batchNo?: string;
    batchNoEnabled?: boolean;
    barCode?: string;
    brand?: string;
    vehicleModel?: string;
    originPlace?: string;
    businessEntity?: string;
    remark?: string;
  }

  export interface ReturnableItemPageParam extends PageParam {
    inId: number;
    productKeyword?: string;
  }

  export interface TransferOutableItem {
    sourceInId?: number;
    sourceInItemId?: number;
    sourceInNo?: string;
    productId?: number;
    productName?: string;
    productCode?: string;
    productUnitId?: number;
    productUnitName?: string;
    fromWarehouseId?: number;
    fromWarehouseName?: string;
    fromWarehouseDeptId?: number;
    fromWarehouseDeptName?: string;
    inCount?: number;
    movedCount?: number;
    transferOutableCount?: number;
    productPrice?: number;
    warehousePosition?: string;
    batchNo?: string;
    batchNoEnabled?: boolean;
    barCode?: string;
    brand?: string;
    vehicleModel?: string;
    originPlace?: string;
    businessEntity?: string;
    remark?: string;
  }

  export interface TransferOutableItemPageParam extends PageParam {
    inId: number;
    productKeyword?: string;
  }

  export interface CreateTransferOutReq {
    sourceInId: number;
    moveTime?: string | number;
    toDeptId?: number;
    toWarehouseId?: number;
    remark?: string;
    items: Array<{
      sourceInItemId: number;
      toWarehouseId?: number;
      count: number;
      remark?: string;
    }>;
  }

  export interface CreateTransferOutResp {
    id?: number;
    ids?: number[];
  }

  export interface SaleCartableItem {
    sourceInId?: number;
    sourceInItemId?: number;
    sourceInNo?: string;
    productId?: number;
    productName?: string;
    productCode?: string;
    productUnitId?: number;
    productUnitName?: string;
    warehouseId?: number;
    warehouseName?: string;
    warehouseDeptId?: number;
    warehouseDeptName?: string;
    inCount?: number;
    convertedCount?: number;
    saleCartableCount?: number;
    purchasePrice?: number;
    salePrice?: number;
    minPrice?: number;
    productPurchasePrice?: number;
    costPrice?: number;
    referencePrice?: number;
    retailPrice?: number;
    lastPurchasePrice?: number;
    backupPrice1?: number;
    wholesalePrice?: number;
    sharePrice?: number;
    customFields?: Record<string, any>;
    warehousePosition?: string;
    batchNo?: string;
    batchNoEnabled?: boolean;
    barCode?: string;
    brand?: string;
    vehicleModel?: string;
    originPlace?: string;
    standard?: string;
    businessEntity?: string;
    remark?: string;
  }

  export interface SaleCartableItemPageParam extends PageParam {
    inId: number;
    orderDirection?: 'asc' | 'desc';
    orderField?: string;
  }

  export interface CreateSaleCartReq {
    sourceInId: number;
    customerId?: number;
    deptId?: number;
    cartTime?: string | number;
    saleUserId?: number;
    accountId?: number;
    settleMethod?: string;
    invoiceType?: string;
    deliveryMethod?: string;
    remark?: string;
    items: Array<{
      sourceInItemId: number;
      deptId?: number;
      warehouseId?: number;
      count: number;
      productPrice?: number;
      giftFlag?: boolean;
      batchNo?: string;
      remark?: string;
    }>;
  }

  export interface CreateSaleCartResp {
    id?: number;
    no?: string;
    status?: number;
  }

  export interface PurchaseInImportResult {
    successCount?: number;
    failureCount?: number;
    orderNo?: string;
    items?: PurchaseInItem[];
    failureDetails?: Array<{
      rowNo?: number;
      productCode?: string;
      reason?: string;
    }>;
  }

  export interface PurchaseInOrderImportResult {
    successCount?: number;
    failureCount?: number;
    recordId?: number;
    documentIds?: number[];
    failureDetails?: Array<{
      rowNo?: number;
      orderNo?: string;
      productCode?: string;
      reason?: string;
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

export function getPurchaseInPage(params: PageParam) {
  return requestClient.get<PageResult<ErpPurchaseInApi.PurchaseIn>>(
    '/erp/purchase-in/page',
    { params, timeout: 60_000 },
  );
}

export function getPurchaseInSummary(
  params: Record<string, any>,
  signal?: AbortSignal,
) {
  return requestClient.get<ErpPurchaseInApi.PurchaseInSummary>(
    '/erp/purchase-in/summary',
    { params, signal, timeout: 30_000 },
  );
}

interface GetPurchaseInOptions {
  includeItems?: boolean;
  mask?: boolean;
}

export function getPurchaseIn(id: number, options: GetPurchaseInOptions = {}) {
  const params: Record<string, boolean | number> = { id };
  if (options.mask !== undefined) {
    params.mask = options.mask;
  }
  if (options.includeItems !== undefined) {
    params.includeItems = options.includeItems;
  }
  return requestClient.get<ErpPurchaseInApi.PurchaseIn>(
    '/erp/purchase-in/get',
    { params },
  );
}

export function getPurchaseInItemPage(
  params: ErpPurchaseInApi.PurchaseInItemPageParam,
) {
  return requestClient.get<PageResult<ErpPurchaseInApi.PurchaseInItem>>(
    '/erp/purchase-in/item-page',
    { params },
  );
}

export function getPurchaseInItemPageForEdit(
  data: ErpPurchaseInApi.PurchaseInItemPageParam,
) {
  return requestClient.post<PageResult<ErpPurchaseInApi.PurchaseInItem>>(
    '/erp/purchase-in/item-page',
    data,
  );
}

export function matchPurchaseInItems(data: {
  documentId: number;
  excludedItemIds?: number[];
  keys: Array<{ gift?: boolean; productId?: number; warehouseId?: number }>;
  pageSize: number;
}) {
  return requestClient.post<ErpPurchaseInApi.PurchaseItemMatchResult>(
    '/erp/purchase-in/item-match',
    data,
  );
}

export function getPurchaseInItems(inId: number) {
  return requestClient.get<ErpPurchaseInApi.PurchaseInItem[]>(
    '/erp/purchase-in/list-items',
    { params: { inId } },
  );
}

export function getPurchaseInPaymentSummary(id: number) {
  return requestClient.get<ErpPurchaseInApi.PurchaseInPaymentSummary>(
    '/erp/purchase-in/payment-summary',
    { params: { id } },
  );
}

export function getPurchaseInSupplierDeptSimpleList(supplierId: number) {
  return requestClient.get<ErpPurchaseInApi.SupplierDeptSimple[]>(
    '/erp/purchase-in/supplier-dept-simple-list',
    { params: { supplierId } },
  );
}

export function getPurchaseInSupplierDeptSimplePage(
  params: Partial<PageParam> & { supplierId?: number },
) {
  return requestClient.get<PageResult<ErpPurchaseInApi.SupplierDeptSimple>>(
    '/erp/purchase-in/supplier-dept-simple-page',
    { params },
  );
}

export function getPurchaseInDeptSimpleList() {
  return requestClient.get<ErpPurchaseInApi.SupplierDeptSimple[]>(
    '/erp/purchase-in/dept-simple-list',
  );
}

export function getPurchaseInDeptSimplePage(params: Partial<PageParam>) {
  return requestClient.get<PageResult<ErpPurchaseInApi.SupplierDeptSimple>>(
    '/erp/purchase-in/dept-simple-page',
    { params },
  );
}

export function getPurchaseInUserSimplePage(params: Partial<PageParam>) {
  return requestClient.get<PageResult<any>>(
    '/erp/purchase-in/user-simple-page',
    {
      params,
    },
  );
}

export function getPurchaseInWarehouseDeptSimpleList(warehouseId: number) {
  return requestClient.get<ErpPurchaseInApi.SupplierDeptSimple[]>(
    '/erp/purchase-in/warehouse-dept-simple-list',
    { params: { warehouseId } },
  );
}

export function getPurchaseInWarehouseDeptSimplePage(
  params: Partial<PageParam> & { warehouseId?: number },
) {
  return requestClient.get<PageResult<ErpPurchaseInApi.SupplierDeptSimple>>(
    '/erp/purchase-in/warehouse-dept-simple-page',
    { params },
  );
}

export function createPurchaseIn(data: ErpPurchaseInApi.PurchaseIn) {
  return requestClient.post(
    '/erp/purchase-in/create',
    stripErpDocumentTaxFields(data),
  );
}

export function createPurchaseInDraft(data: ErpPurchaseInApi.PurchaseIn) {
  return requestClient.post(
    '/erp/purchase-in/create-draft',
    stripErpDocumentTaxFields(data),
  );
}

export function updatePurchaseIn(data: ErpPurchaseInApi.PurchaseIn) {
  return requestClient.put(
    '/erp/purchase-in/update',
    stripErpDocumentTaxFields(data),
  );
}

export function updatePurchaseInDraft(data: ErpPurchaseInApi.PurchaseIn) {
  return requestClient.put(
    '/erp/purchase-in/update-draft',
    stripErpDocumentTaxFields(data),
  );
}

export function updateAndSubmitPurchaseInDraft(
  data: ErpPurchaseInApi.PurchaseIn,
) {
  return requestClient.put(
    '/erp/purchase-in/update-and-submit',
    stripErpDocumentTaxFields(data),
  );
}

export function submitPurchaseIn(id: number) {
  return requestClient.put('/erp/purchase-in/submit', null, {
    params: { id },
  });
}

/** 修改采购入库备注，不受审批状态限制 */
export function updatePurchaseInRemark(data: { id: number; remark: string }) {
  return requestClient.put('/erp/purchase-in/update-remark', data);
}

export function batchUpdatePurchaseInItems(
  data: ErpPurchaseInApi.PurchaseInItemBatchUpdate,
) {
  return requestClient.put('/erp/purchase-in/batch-update-items', data);
}

export function updatePurchaseInStatus(id: number, status: number) {
  return requestClient.put('/erp/purchase-in/update-status', null, {
    params: { id, status },
  });
}

export function deletePurchaseIn(ids: number[]) {
  return requestClient.delete('/erp/purchase-in/delete', {
    params: { ids: ids.join(',') },
  });
}

export function exportPurchaseIn(params: any) {
  return requestClient.download('/erp/purchase-in/export-excel', {
    params,
  });
}

export function getPurchaseInExportFields() {
  return requestClient.get<ErpPurchaseInApi.ExportField[]>(
    '/erp/purchase-in/export-fields',
  );
}

export function importPurchaseIn(file: File) {
  return requestClient.upload<ErpPurchaseInApi.PurchaseInImportResult>(
    '/erp/purchase-in/import',
    { file },
  );
}

export function getPurchaseInImportTemplate() {
  return requestClient.download('/erp/purchase-in/get-import-template');
}

export function importPurchaseInOrder(file: File) {
  return requestClient.upload<ErpPurchaseInApi.PurchaseInOrderImportResult>(
    '/erp/purchase-in/import-order',
    { file },
  );
}

export function getPurchaseInOrderImportTemplate() {
  return requestClient.download('/erp/purchase-in/get-order-import-template');
}

export function downloadPurchaseInImportFailureDetails(recordId: number) {
  return requestClient.download(
    '/erp/purchase-in/import-failure-details/download',
    { params: { recordId } },
  );
}

export function getReturnableItemsByInId(inId: number) {
  return requestClient.get<ErpPurchaseInApi.ReturnableItem[]>(
    '/erp/purchase-in/returnable-items',
    { params: { inId } },
  );
}

export function getReturnableItemPageByInId(
  params: ErpPurchaseInApi.ReturnableItemPageParam,
) {
  return requestClient.get<PageResult<ErpPurchaseInApi.ReturnableItem>>(
    '/erp/purchase-in/returnable-item-page',
    { params },
  );
}

export function getPurchaseInTransferOutableItems(inId: number) {
  return requestClient.get<ErpPurchaseInApi.TransferOutableItem[]>(
    '/erp/purchase-in/transfer-outable-items',
    { params: { inId } },
  );
}

export function getPurchaseInTransferOutableItemPage(
  params: ErpPurchaseInApi.TransferOutableItemPageParam,
) {
  return requestClient.get<PageResult<ErpPurchaseInApi.TransferOutableItem>>(
    '/erp/purchase-in/transfer-outable-item-page',
    { params },
  );
}

export function createTransferOutFromPurchaseIn(
  data: ErpPurchaseInApi.CreateTransferOutReq,
) {
  return requestClient.post<ErpPurchaseInApi.CreateTransferOutResp>(
    '/erp/purchase-in/create-transfer-out',
    data,
  );
}

export function getPurchaseInSaleCartableItems(inId: number) {
  return requestClient.get<ErpPurchaseInApi.SaleCartableItem[]>(
    '/erp/purchase-in/sale-cartable-items',
    { params: { inId } },
  );
}

export function getPurchaseInSaleCartableItemPage(
  params: ErpPurchaseInApi.SaleCartableItemPageParam,
) {
  return requestClient.get<PageResult<ErpPurchaseInApi.SaleCartableItem>>(
    '/erp/purchase-in/sale-cartable-item-page',
    { params },
  );
}

export function createSaleCartFromPurchaseIn(
  data: ErpPurchaseInApi.CreateSaleCartReq,
) {
  return requestClient.post<ErpPurchaseInApi.CreateSaleCartResp>(
    '/erp/purchase-in/create-sale-cart',
    stripErpDocumentTaxFields(data),
  );
}

export function createPurchaseInFromOrder(data: {
  orderId: number;
  inTime?: string;
  accountId?: number;
  items: Array<{
    orderItemId: number;
    count: number;
    warehouseId: number;
    deptId?: number;
  }>;
}) {
  return requestClient.post<number>(
    '/erp/purchase-in/create-from-order',
    stripErpDocumentTaxFields(data),
  );
}

export function getApprovedPurchaseInsBySupplier(supplierId: number) {
  return requestClient.get<ErpPurchaseInApi.PurchaseInForAdjust[]>(
    '/erp/purchase-in/list-approved-for-adjust',
    { params: { supplierId } },
  );
}

export function getApprovedPurchaseInItemsBySupplier(
  supplierId: number,
  excludeAdjusted?: boolean,
) {
  return requestClient.get<ErpPurchaseInApi.PurchaseInItemForAdjust[]>(
    '/erp/purchase-in/list-items-for-adjust',
    { params: { supplierId, excludeAdjusted } },
  );
}

export function getApprovedPurchaseInItemPage(
  params: ErpPurchaseInApi.PurchaseInAdjustableItemPageParam,
) {
  return requestClient.get<
    PageResult<ErpPurchaseInApi.PurchaseInItemForAdjust>
  >('/erp/purchase-in/adjustable-item-page', { params });
}
