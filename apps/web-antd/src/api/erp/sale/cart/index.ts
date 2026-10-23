import type { PageParam, PageResult } from '@vben/request';

import { stripErpDocumentTaxFields } from '#/api/erp/common/strip-document-tax-fields';
import { requestClient } from '#/api/request';

export namespace ErpSaleCartApi {
  export interface SaleCartPageParams extends PageParam {
    onlineOrder?: boolean;
    productId?: number;
    productKeyword?: string;
    includeItems?: boolean;
    orderField?: string;
    orderDirection?: 'asc' | 'desc';
  }

  export interface SaleCartSummary {
    totalProductPrice?: number | null;
    discountPrice?: number | null;
    feeAmount?: number | null;
    totalPrice?: number | null;
  }

  export interface LatestOnlineOrder {
    id: number;
    no: string;
    sourceNo?: string;
    createTime: Date | number | string;
  }

  export interface SaleCartItemPageParams extends PageParam {
    cartId: number;
    excludedItemIds?: number[];
    mask?: boolean;
    orderField?: string;
    orderDirection?: 'asc' | 'desc';
  }

  export interface SaleCartItemStockKey {
    productId: number;
    warehouseId: number;
    batchNo?: string;
    giftFlag?: boolean;
  }

  export interface SaleCartItemMatch {
    productId: number;
    warehouseId: number;
    batchNo?: string;
    giftFlag?: boolean;
    survivorId: number;
    targetPageNo: number;
    items: SaleCartItem[];
  }

  export interface SaleCartItemMatchResult {
    matches: SaleCartItemMatch[];
  }

  export interface SaleCart {
    id?: number;
    no?: string;
    status?: number;
    firstApproveRequired?: boolean;
    pickDeliveryOrderId?: number;
    pickStatus?: number;
    deliveryStatus?: number;
    customerId?: number;
    customerName?: string;
    customerCode?: string;
    accountId?: number;
    saleUserId?: number;
    saleUserName?: string;
    deptId?: number;
    deptName?: string;
    cartTime?: Date | number | string;
    billingConfirmUserId?: number;
    billingConfirmUserName?: string;
    billingConfirmTime?: Date | number | string;
    firstAuditUserId?: number;
    firstAuditTime?: Date | number | string;
    finalAuditUserId?: number;
    finalAuditTime?: Date | number | string;
    totalCount?: number;
    totalPrice?: number;
    totalProductPrice?: number;
    totalTaxPrice?: number;
    discountPercent?: number;
    discountPrice?: number;
    feeAmount?: number;
    otherPrice?: number;
    sourceType?: number;
    sourceId?: number;
    sourceNo?: string;
    remark?: string;
    businessType?: string;
    orderType?: string;
    billingMethod?: string;
    settleMethod?: string;
    invoiceType?: string;
    deliveryMethod?: string;
    freightType?: string;
    vin?: string;
    priority?: string;
    priceType?: string;
    logisticsCompany?: string;
    developerUserId?: number;
    contactPerson?: string;
    contactPhone?: string;
    deliveryAddress?: string;
    deliveryDate?: Date | number | string;
    taxRate?: number;
    totalFreight?: number;
    paymentDate?: Date | number | string;
    businessEntity?: string;
    orderMethod?: string;
    sourceType2?: string;
    quoteNo?: string;
    vehiclePlateNo?: string;
    remark2?: string;
    productNames?: string;
    creatorName?: string;
    updaterName?: string;
    createTime?: Date | number | string;
    updateTime?: Date | number | string;
    itemCount?: number;
    items?: SaleCartItem[];
  }

  export interface SaleCartItem {
    clientRowKey?: string;
    id?: number;
    operation?: 'delete' | 'insert' | 'update';
    cartId?: number;
    productId?: number;
    productCode?: string;
    productName?: string;
    productBarCode?: string;
    productUnitId?: number;
    productUnitName?: string;
    weight?: number;
    packageQty?: number;
    pieceCount?: number | string;
    warehouseId?: number;
    warehouseName?: string;
    warehouseDeptId?: number;
    warehouseDeptName?: string;
    deptId?: number;
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
    productPrice?: number;
    count?: number;
    giftFlag?: boolean;
    totalPrice?: number;
    taxPercent?: number;
    taxPrice?: number;
    stockCount?: number;
    warehousePosition?: string;
    drawingNo?: string;
    batchNo?: string;
    batchNoEnabled?: boolean;
    barCode?: string;
    brand?: string;
    vehicleModel?: string;
    originPlace?: string;
    standard?: string;
    remark?: string;
  }

  export interface SaleCartUpdateBasic {
    id: number;
    customerId: number;
    feeAmount?: number;
    remark?: string;
  }

  export interface SaleCartSubmitResult {
    id?: number;
    no?: string;
    status?: number;
    success?: boolean;
  }

  export interface FirstApproveConfig {
    enabled: boolean;
    deptAuthEnabled: boolean;
    includeChildDept: boolean;
    deptIds: number[];
    currentUserAllowed: boolean;
  }

  export interface FirstApproveConfigSave {
    enabled: boolean;
    deptAuthEnabled: boolean;
    includeChildDept: boolean;
    deptIds: number[];
  }

  export interface SaleCartItemBatchUpdateReq {
    cartId: number;
    itemIds: number[];
    warehouseId?: number;
    deptId?: number;
    priceLevel?: number;
  }

  export interface VinRecognizeResult {
    vin?: string;
    success?: boolean;
    message?: string;
    data?: Record<string, any>;
    modelList?: Array<Record<string, any>>;
    raw?: Record<string, any>;
  }
}

export interface SaleCartImportResp {
  recordId?: number;
  successCount?: number;
  failureCount?: number;
  items?: ErpSaleCartApi.SaleCartItem[];
  failureDetails?: Array<{
    productCode?: string;
    reason?: string;
    rowNo?: number;
  }>;
}

export interface SaleCartOrderImportResp {
  documentIds?: number[];
  failureCount?: number;
  failureDetails?: Array<{
    documentNo?: string;
    productIdentifier?: string;
    reason?: string;
    rowNo?: number;
  }>;
  recordId?: number;
  successCount?: number;
}

export function getSaleCartPage(params: ErpSaleCartApi.SaleCartPageParams) {
  return requestClient.get<PageResult<ErpSaleCartApi.SaleCart>>(
    '/erp/sale-cart/page',
    { params, timeout: 60_000 },
  );
}

export function getLatestOnlineOrder() {
  return requestClient.get<ErpSaleCartApi.LatestOnlineOrder | null>(
    '/erp/sale-cart/latest-online-order',
    { headers: { 'X-Silent-Error-Message': 'true' } },
  );
}

export function getSaleCartSummary(
  params: Record<string, any>,
  signal?: AbortSignal,
) {
  return requestClient.get<ErpSaleCartApi.SaleCartSummary>(
    '/erp/sale-cart/summary',
    { params, signal, timeout: 30_000 },
  );
}

export function getSaleCart(
  id: number,
  options: { includeItems?: boolean; mask?: boolean } = {},
) {
  return requestClient.get<ErpSaleCartApi.SaleCart>('/erp/sale-cart/get', {
    params: {
      id,
      includeItems: options.includeItems,
      mask: options.mask,
    },
  });
}

export function getSaleCartItemPage(
  params: ErpSaleCartApi.SaleCartItemPageParams,
) {
  return requestClient.get<PageResult<ErpSaleCartApi.SaleCartItem>>(
    '/erp/sale-cart/item-page',
    { params },
  );
}

export function getSaleCartEditItemPage(
  data: ErpSaleCartApi.SaleCartItemPageParams,
) {
  return requestClient.post<PageResult<ErpSaleCartApi.SaleCartItem>>(
    '/erp/sale-cart/item-page',
    data,
  );
}

export function matchSaleCartItems(data: {
  cartId: number;
  pageSize: number;
  keys: ErpSaleCartApi.SaleCartItemStockKey[];
}) {
  return requestClient.post<ErpSaleCartApi.SaleCartItemMatchResult>(
    '/erp/sale-cart/item-match',
    data,
  );
}

export function recognizeSaleCartVin(vin: string) {
  return requestClient.get<ErpSaleCartApi.VinRecognizeResult>(
    '/erp/sale-cart/recognize-vin',
    { params: { vin } },
  );
}

export function createSaleCart(data: ErpSaleCartApi.SaleCart) {
  return requestClient.post<number>(
    '/erp/sale-cart/create',
    stripErpDocumentTaxFields(data),
  );
}

export function createAndSubmitSaleCart(data: ErpSaleCartApi.SaleCart) {
  return requestClient.post<
    boolean | ErpSaleCartApi.SaleCartSubmitResult | null
  >('/erp/sale-cart/create-and-submit', stripErpDocumentTaxFields(data));
}

export function updateSaleCart(data: ErpSaleCartApi.SaleCart) {
  return requestClient.put(
    '/erp/sale-cart/update',
    stripErpDocumentTaxFields(data),
  );
}

export function updateSaleCartDraft(data: ErpSaleCartApi.SaleCart) {
  return requestClient.put(
    '/erp/sale-cart/update-draft',
    stripErpDocumentTaxFields(data),
  );
}

export function batchUpdateSaleCartItems(
  data: ErpSaleCartApi.SaleCartItemBatchUpdateReq,
) {
  return requestClient.put('/erp/sale-cart/batch-update-items', data);
}

export function getSaleCartWarehouseDeptSimpleList(warehouseId: number) {
  return requestClient.get<any[]>('/erp/sale-cart/warehouse-dept-simple-list', {
    params: { warehouseId },
  });
}

export function getSaleCartWarehouseDeptSimplePage(
  params: Partial<PageParam> & { warehouseId?: number },
) {
  return requestClient.get<PageResult<any>>(
    '/erp/sale-cart/warehouse-dept-simple-page',
    { params },
  );
}

export function getSaleCartDeptSimpleList() {
  return requestClient.get<any[]>('/erp/sale-cart/dept-simple-list');
}

export function getSaleCartDeptSimplePage(params: Partial<PageParam>) {
  return requestClient.get<PageResult<any>>('/erp/sale-cart/dept-simple-page', {
    params,
  });
}

export function getSaleCartCustomerDeptSimplePage(
  params: Partial<PageParam> & { customerId?: number },
) {
  return requestClient.get<PageResult<any>>(
    '/erp/sale-cart/customer-dept-simple-page',
    { params },
  );
}

export function getSaleCartUserSimplePage(params: Partial<PageParam>) {
  return requestClient.get<PageResult<any>>('/erp/sale-cart/user-simple-page', {
    params,
  });
}

export function updateSaleCartBasic(data: ErpSaleCartApi.SaleCartUpdateBasic) {
  return requestClient.put(
    '/erp/sale-cart/update-basic',
    stripErpDocumentTaxFields(data),
  );
}

/** 修改销售手推车备注，不受审批状态限制 */
export function updateSaleCartRemark(data: { id: number; remark: string }) {
  return requestClient.put('/erp/sale-cart/update-remark', data);
}

export function submitSaleCart(id: number) {
  return requestClient.put<
    boolean | ErpSaleCartApi.SaleCartSubmitResult | null
  >('/erp/sale-cart/submit', null, { params: { id } });
}

export function confirmSaleCart(id: number) {
  return requestClient.put<
    boolean | ErpSaleCartApi.SaleCartSubmitResult | null
  >('/erp/sale-cart/confirm', null, { params: { id } });
}

export function firstApproveSaleCart(id: number) {
  return requestClient.put('/erp/sale-cart/first-approve', null, {
    params: { id },
  });
}

export function cancelFirstApproveSaleCart(id: number) {
  return requestClient.put('/erp/sale-cart/cancel-first-approve', null, {
    params: { id },
  });
}

export function getSaleCartFirstApproveConfig() {
  return requestClient.get<ErpSaleCartApi.FirstApproveConfig>(
    '/erp/sale-cart/first-approve-config',
  );
}

export function updateSaleCartFirstApproveConfig(
  data: ErpSaleCartApi.FirstApproveConfigSave,
) {
  return requestClient.put('/erp/sale-cart/first-approve-config', data);
}

export function finalApproveSaleCart(id: number) {
  return requestClient.put<number | number[]>(
    '/erp/sale-cart/final-approve',
    null,
    {
      params: { id },
    },
  );
}

export function importSaleCart(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return requestClient.post<SaleCartImportResp>(
    '/erp/sale-cart/import',
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
    },
  );
}

export function exportSaleCartImportTemplate() {
  return requestClient.download('/erp/sale-cart/export-import-template');
}

export function importSaleCartOrder(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return requestClient.post<SaleCartOrderImportResp>(
    '/erp/sale-cart/import-order',
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
    },
  );
}

export function exportSaleCartOrderImportTemplate() {
  return requestClient.download('/erp/sale-cart/get-order-import-template');
}

export function downloadSaleCartImportFailureDetails(recordId: number) {
  return requestClient.download(
    '/erp/sale-cart/import-failure-details/download',
    {
      params: { recordId },
    },
  );
}

export function convertSaleCartToQuote(cartId: number, cartItemIds: number[]) {
  return requestClient.post('/erp/sale-cart/convert-quote', {
    cartId,
    cartItemIds,
  });
}

export function rejectSaleCart(id: number) {
  return requestClient.put('/erp/sale-cart/reject', null, { params: { id } });
}

export function exportSaleCart(params: PageParam) {
  const exportParams = { ...params } as Record<string, any>;
  if (Array.isArray(exportParams.ids)) {
    exportParams.ids = exportParams.ids.join(',');
  }
  return requestClient.download('/erp/sale-cart/export-excel', {
    params: exportParams,
  });
}

export function getSaleCartExportFields() {
  return requestClient.get<any[]>('/erp/sale-cart/export-fields');
}

export function deleteSaleCart(ids: number[]) {
  return requestClient.delete('/erp/sale-cart/delete', {
    params: { ids: ids.join(',') },
  });
}
