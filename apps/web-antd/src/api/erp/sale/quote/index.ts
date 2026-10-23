import type { PageParam, PageResult } from '@vben/request';

import { stripErpDocumentTaxFields } from '#/api/erp/common/strip-document-tax-fields';
import { requestClient } from '#/api/request';

export namespace ErpSaleQuoteApi {
  export interface SaleQuote {
    id?: number;
    no?: string;
    status?: number;
    orderStatus?: number;
    outStatus?: number;
    convertedCount?: number;
    actualOutCount?: number;
    remainingCount?: number;
    creator?: string;
    creatorName?: string;
    createTime?: Date | number | string;
    updater?: string;
    updaterName?: string;
    updateTime?: Date | number | string;
    printCount?: number;
    printTime?: Date | number | string;
    customerId?: number;
    customerCode?: string;
    customerName?: string;
    accountId?: number;
    saleUserId?: number;
    saleUserName?: string;
    deptId?: number;
    deptName?: string;
    quoteTime?: Date | number | string;
    totalCount?: number;
    totalPrice?: number;
    totalProductPrice?: number;
    totalTaxPrice?: number;
    discountPercent?: number;
    discountPrice?: number;
    feeAmount?: number;
    otherPrice?: number;
    fileUrl?: string;
    remark?: string;
    productNames?: string;
    orderType?: string;
    settleMethod?: string;
    prepayment?: boolean;
    priority?: string;
    deliveryMethod?: string;
    proxyDelivery?: boolean;
    deliveryAddress?: string;
    allowancePrice?: number;
    ticketNo?: string;
    invoiceType?: string;
    freightType?: string;
    freightAmount?: number;
    logisticsCompany?: string;
    receiverName?: string;
    receiverPhone?: string;
    priceType?: string;
    branchDelivery?: string;
    expectedDeliveryTime?: Date | number | string;
    billingMethod?: string;
    vehiclePlateNo?: string;
    businessType?: string;
    developerUserId?: number;
    vin?: string;
    internalRemark?: string;
    generatedSaleOutNo?: string;
    items?: SaleQuoteItem[];
  }

  export interface SaleQuoteItem {
    clientRowKey?: string;
    id?: number;
    operation?: 'delete' | 'insert' | 'update';
    quoteId?: number;
    seq?: number | string;
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
    deptName?: string;
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
    convertedCount?: number;
    remainingCount?: number;
    stockCount?: number;
    availableCount?: number;
    totalProductPrice?: number;
    totalPrice?: number;
    taxPercent?: number;
    taxPrice?: number;
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

  export interface ConvertCartReq {
    quoteId: number;
    items: Array<{
      count: number;
      quoteItemId: number;
    }>;
  }

  export interface SaleQuoteItemBatchUpdateReq {
    quoteId: number;
    itemIds: number[];
    warehouseId?: number;
    deptId?: number;
    priceLevel?: number;
  }

  export interface SaleQuoteItemPageParams extends PageParam {
    quoteId: number;
    excludedItemIds?: number[];
    mask?: boolean;
    orderField?: string;
    orderDirection?: 'asc' | 'desc';
  }

  export interface SaleQuoteItemMatchReq {
    documentId: number;
    pageSize: number;
    excludedItemIds?: number[];
    keys: Array<{
      productId?: number;
      warehouseId?: number;
      batchNo?: string;
      giftFlag?: boolean;
    }>;
  }

  export interface SaleQuoteItemMatchResp {
    matches: Array<{ itemId: number; keyIndex: number; pageNo: number }>;
  }

  export interface SaleQuotePageParams extends PageParam {
    productId?: number;
    productKeyword?: string;
    includeItems?: boolean;
    ids?: number[];
    fields?: string;
  }

  export interface SaleQuoteSummary {
    totalProductPrice?: number | null;
    discountPrice?: number | null;
    totalPrice?: number | null;
  }
}

export interface SaleImportFailureItem {
  rowNo?: number;
  orderNo?: string;
  productCode?: string;
  reason?: string;
}

export interface SaleQuoteImportResp {
  recordId?: number;
  successCount?: number;
  failureCount?: number;
  items?: ErpSaleQuoteApi.SaleQuoteItem[];
  failureDetails?: SaleImportFailureItem[];
}

export interface SaleOrderImportResp {
  recordId?: number;
  successCount?: number;
  failureCount?: number;
  documentIds?: number[];
  failureDetails?: SaleImportFailureItem[];
}

export function getSaleQuotePage(params: ErpSaleQuoteApi.SaleQuotePageParams) {
  return requestClient.get<PageResult<ErpSaleQuoteApi.SaleQuote>>(
    '/erp/sale-quote/page',
    { params, timeout: 60_000 },
  );
}

export function getSaleQuoteSummary(
  params: Record<string, any>,
  signal?: AbortSignal,
) {
  return requestClient.get<ErpSaleQuoteApi.SaleQuoteSummary>(
    '/erp/sale-quote/summary',
    { params, signal, timeout: 30_000 },
  );
}

export function getSaleQuote(
  id: number,
  options: {
    includeItems?: boolean;
    includeStock?: boolean;
    mask?: boolean;
  } = {},
) {
  return requestClient.get<ErpSaleQuoteApi.SaleQuote>('/erp/sale-quote/get', {
    params: {
      id,
      includeItems: options.includeItems,
      includeStock: options.includeStock,
      mask: options.mask,
    },
  });
}

export function getSaleQuoteItemPage(
  params: ErpSaleQuoteApi.SaleQuoteItemPageParams,
) {
  return requestClient.get<PageResult<ErpSaleQuoteApi.SaleQuoteItem>>(
    '/erp/sale-quote/item-page',
    { params },
  );
}

export function getSaleQuoteEditItemPage(
  data: ErpSaleQuoteApi.SaleQuoteItemPageParams,
) {
  return requestClient.post<PageResult<ErpSaleQuoteApi.SaleQuoteItem>>(
    '/erp/sale-quote/item-page',
    data,
  );
}

export function matchSaleQuoteItems(
  data: ErpSaleQuoteApi.SaleQuoteItemMatchReq,
) {
  return requestClient.post<ErpSaleQuoteApi.SaleQuoteItemMatchResp>(
    '/erp/sale-quote/item-match',
    data,
  );
}

export function createSaleQuote(data: ErpSaleQuoteApi.SaleQuote) {
  return requestClient.post(
    '/erp/sale-quote/create',
    stripErpDocumentTaxFields(data),
  );
}

export function createSaleQuoteDraft(data: ErpSaleQuoteApi.SaleQuote) {
  return requestClient.post(
    '/erp/sale-quote/create-draft',
    stripErpDocumentTaxFields(data),
  );
}

export function updateSaleQuote(data: ErpSaleQuoteApi.SaleQuote) {
  return requestClient.put(
    '/erp/sale-quote/update',
    stripErpDocumentTaxFields(data),
  );
}

export function updateSaleQuoteDraft(data: ErpSaleQuoteApi.SaleQuote) {
  return requestClient.put(
    '/erp/sale-quote/update-draft',
    stripErpDocumentTaxFields(data),
  );
}

export function batchUpdateSaleQuoteItems(
  data: ErpSaleQuoteApi.SaleQuoteItemBatchUpdateReq,
) {
  return requestClient.put('/erp/sale-quote/batch-update-items', data);
}

export function getSaleQuoteWarehouseDeptSimpleList(warehouseId: number) {
  return requestClient.get<any[]>(
    '/erp/sale-quote/warehouse-dept-simple-list',
    {
      params: { warehouseId },
    },
  );
}

export function getSaleQuoteWarehouseDeptSimplePage(
  params: Partial<PageParam> & { warehouseId?: number },
) {
  return requestClient.get<PageResult<any>>(
    '/erp/sale-quote/warehouse-dept-simple-page',
    { params },
  );
}

export function getSaleQuoteDeptSimpleList() {
  return requestClient.get<any[]>('/erp/sale-quote/dept-simple-list');
}

export function getSaleQuoteDeptSimplePage(params: Partial<PageParam>) {
  return requestClient.get<PageResult<any>>(
    '/erp/sale-quote/dept-simple-page',
    {
      params,
    },
  );
}

export function getSaleQuoteCustomerDeptSimplePage(
  params: Partial<PageParam> & { customerId?: number },
) {
  return requestClient.get<PageResult<any>>(
    '/erp/sale-quote/customer-dept-simple-page',
    { params },
  );
}

export function getSaleQuoteUserSimplePage(params: Partial<PageParam>) {
  return requestClient.get<PageResult<any>>(
    '/erp/sale-quote/user-simple-page',
    {
      params,
    },
  );
}

export function submitSaleQuote(id: number) {
  return requestClient.put('/erp/sale-quote/submit', null, {
    params: { id },
  });
}

/** 修改销售报价单备注，不受审批状态限制 */
export function updateSaleQuoteRemark(data: { id: number; remark: string }) {
  return requestClient.put('/erp/sale-quote/update-remark', data);
}

export function approveSaleQuote(id: number) {
  return requestClient.put('/erp/sale-quote/approve', null, {
    params: { id },
  });
}

export function reverseOrderSaleQuote(id: number) {
  return requestClient.put('/erp/sale-quote/reverse-order', null, {
    params: { id },
  });
}

export function convertSaleQuoteToCart(data: ErpSaleQuoteApi.ConvertCartReq) {
  return requestClient.post('/erp/sale-quote/convert-cart', data);
}

export function deleteSaleQuote(ids: number[]) {
  return requestClient.delete('/erp/sale-quote/delete', {
    params: { ids: ids.join(',') },
  });
}

export function exportSaleQuote(params: ErpSaleQuoteApi.SaleQuotePageParams) {
  const exportParams = { ...params } as Record<string, any>;
  if (Array.isArray(exportParams.ids)) {
    exportParams.ids = exportParams.ids.join(',');
  }
  return requestClient.download('/erp/sale-quote/export-excel', {
    params: exportParams,
  });
}

export function getSaleQuoteExportFields() {
  return requestClient.get<any[]>('/erp/sale-quote/export-fields');
}

export function importSaleQuote(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return requestClient.post<SaleQuoteImportResp>(
    '/erp/sale-quote/import',
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
    },
  );
}

export function exportSaleQuoteImportTemplate() {
  return requestClient.download('/erp/sale-quote/export-import-template');
}

export function importSaleQuoteOrder(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return requestClient.post<SaleOrderImportResp>(
    '/erp/sale-quote/import-order',
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
    },
  );
}

export function exportSaleQuoteOrderImportTemplate() {
  return requestClient.download('/erp/sale-quote/get-order-import-template');
}

export function downloadSaleQuoteImportFailureDetails(recordId: number) {
  return requestClient.download(
    '/erp/sale-quote/import-failure-details/download',
    {
      params: { recordId },
    },
  );
}
