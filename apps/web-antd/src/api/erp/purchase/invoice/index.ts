import type { PageParam, PageResult } from '@vben/request';

import { stripErpDocumentTaxFields } from '#/api/erp/common/strip-document-tax-fields';
import { requestClient } from '#/api/request';

export const PURCHASE_INVOICE_STATUS = {
  DRAFT: 0,
  PROCESS: 10,
  APPROVE: 20,
} as const;

export const PURCHASE_INVOICE_SOURCE_TYPE = {
  PURCHASE_IN: 10,
  PRICE_ADJUST: 20,
  PURCHASE_RETURN: 30,
} as const;

export namespace ErpPurchaseInvoiceApi {
  export interface PurchaseInvoiceSummary {
    invoiceCount?: number;
    totalAmount?: number;
    taxAmount?: number;
    taxExclusiveAmount?: number;
  }
  export interface PurchaseInvoice {
    id?: number;
    no?: string;
    status?: number;
    supplierId?: number;
    supplierName?: string;
    supplierType?: string;
    invoiceDate?: Date | string;
    invoiceType?: string;
    invoiceNo?: string;
    invoiceCount?: number;
    taxExclusiveAmount?: number;
    taxAmount?: number;
    totalAmount?: number;
    displayTaxPercent?: string;
    deptId?: number;
    deptName?: string;
    handlerId?: number;
    handlerName?: string;
    remark?: string;
    fileUrl?: string;
    creator?: string;
    creatorName?: string;
    createTime?: Date | string;
    auditUserName?: string;
    auditTime?: Date | string;
    updater?: string;
    updaterName?: string;
    updateTime?: Date | string;
    productNames?: string;
    excludedSourceInItemIds?: number[];
    excludedSourceItemKeys?: string[];
    items?: PurchaseInvoiceItem[];
    sourceInIds?: number[];
    sourceRefs?: PurchaseInvoiceSourceRef[];
  }

  export interface PurchaseInvoiceSourceRef {
    sourceDocId: number;
    sourceType: number;
  }

  export interface PurchaseInvoiceSourceDocument {
    allocatedCount?: number;
    bizTime?: Date | number | string;
    deptId?: number;
    id: number;
    invoiceStatus?: '部分开票' | '未开票' | '已开票';
    no?: string;
    remainingCount?: number;
    sourceType: number;
    sourceTypeName?: string;
    supplierId?: number;
    totalAmount?: number;
    totalCount?: number;
  }

  export interface PurchaseInvoiceItem {
    countText?: string;
    clientRowKey?: string; // 前端表格行身份，不传后端
    id?: number;
    operation?: 'delete' | 'insert' | 'update';
    seq?: number;
    sourceInId?: number;
    sourceInNo?: string;
    sourceInItemId?: number;
    sourceType?: number;
    sourceTypeName?: string;
    sourceDocId?: number;
    sourceDocNo?: string;
    sourceItemId?: number;
    amountDirection?: number;
    sourceTotalCount?: number;
    sourceRemainingCount?: number;
    sourceDeptId?: number;
    sourceDeptName?: string;
    productId?: number;
    productCode?: string;
    productName?: string;
    factoryCode?: string;
    productUnitName?: string;
    productBarCode?: string;
    warehouseId?: number;
    warehouseName?: string;
    stockCount?: number;
    count?: number;
    packageQty?: number;
    wholeQty?: number;
    batchNo?: string;
    businessEntity?: string;
    pieceCount?: number | string;
    productPrice?: number;
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
    taxExclusivePrice?: number;
    taxPercent?: number;
    taxPercentText?: string;
    taxPrice?: number;
    totalPrice?: number;
    remark?: string;
  }

  export interface PurchaseInvoicePageParams extends PageParam {
    creator?: string;
    deptId?: number;
    handlerId?: number;
    includeItems?: boolean;
    invoiceDate?: Date[] | string[];
    invoiceNo?: string;
    invoiceStatus?: number;
    invoiceType?: string;
    no?: string;
    orderDirection?: 'asc' | 'desc';
    orderField?: string;
    productId?: number;
    remark?: string;
    showCompleted?: boolean;
    supplierId?: number;
  }

  export interface PurchaseInvoiceItemPageParam extends PageParam {
    excludedItemIds?: number[];
    invoiceId: number;
    mask?: boolean;
    orderDirection?: 'asc' | 'desc';
    orderField?: string;
  }

  export interface PurchaseInvoiceSourceInItemPageParam extends PageParam {
    mask?: boolean;
    orderDirection?: 'asc' | 'desc';
    orderField?: string;
    sourceInIds: number[];
  }

  export interface PurchaseInvoiceSourceDocumentPageParam extends PageParam {
    keyword?: string;
    sourceType?: number;
    supplierId: number;
  }

  export interface PurchaseInvoiceSourceItemPageParam extends PageParam {
    mask?: boolean;
    sourceDocIds: number[];
    sourceType: number;
    supplierId: number;
  }

  export interface PurchaseInvoiceMixedSourceItemPageParam extends PageParam {
    excludedSourceItemKeys?: string[];
    mask?: boolean;
    sourceRefs: PurchaseInvoiceSourceRef[];
    supplierId: number;
  }

  export interface ExportField {
    field: string;
    label: string;
    group?: string;
    groupLabel?: string;
    required?: boolean;
    sort?: number;
  }

  export interface PurchaseInvoiceImportResult {
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
}

export function getPurchaseInvoicePage(
  params: Partial<ErpPurchaseInvoiceApi.PurchaseInvoicePageParams>,
) {
  return requestClient.get<PageResult<ErpPurchaseInvoiceApi.PurchaseInvoice>>(
    '/erp/purchase-invoice/page',
    { params, timeout: 60_000 },
  );
}

export function getPurchaseInvoiceSummary(
  params: Record<string, any>,
  signal?: AbortSignal,
) {
  return requestClient.get<ErpPurchaseInvoiceApi.PurchaseInvoiceSummary>(
    '/erp/purchase-invoice/summary',
    { params, signal, timeout: 30_000 },
  );
}

export function getPurchaseInvoice(
  id: number,
  options?: { includeItems?: boolean; mask?: boolean },
) {
  return requestClient.get<ErpPurchaseInvoiceApi.PurchaseInvoice>(
    '/erp/purchase-invoice/get',
    {
      params: {
        id,
        includeItems: options?.includeItems,
        mask: options?.mask,
      },
    },
  );
}

export function getPurchaseInvoiceItemPage(
  params: ErpPurchaseInvoiceApi.PurchaseInvoiceItemPageParam,
) {
  return requestClient.get<
    PageResult<ErpPurchaseInvoiceApi.PurchaseInvoiceItem>
  >('/erp/purchase-invoice/item-page', { params });
}

export function getPurchaseInvoiceItemPageForEdit(
  data: ErpPurchaseInvoiceApi.PurchaseInvoiceItemPageParam,
) {
  return requestClient.post<
    PageResult<ErpPurchaseInvoiceApi.PurchaseInvoiceItem>
  >('/erp/purchase-invoice/item-page', data);
}

export function getPurchaseInvoiceSourceInItemPage(
  params: ErpPurchaseInvoiceApi.PurchaseInvoiceSourceInItemPageParam,
) {
  return requestClient.get<
    PageResult<ErpPurchaseInvoiceApi.PurchaseInvoiceItem>
  >('/erp/purchase-invoice/source-in-item-page', { params });
}

export function getPurchaseInvoiceSourceDocumentPage(
  params: ErpPurchaseInvoiceApi.PurchaseInvoiceSourceDocumentPageParam,
) {
  return requestClient.get<
    PageResult<ErpPurchaseInvoiceApi.PurchaseInvoiceSourceDocument>
  >('/erp/purchase-invoice/source-document-page', { params });
}

export function getPurchaseInvoiceSourceItemPage(
  params: ErpPurchaseInvoiceApi.PurchaseInvoiceSourceItemPageParam,
) {
  return requestClient.get<
    PageResult<ErpPurchaseInvoiceApi.PurchaseInvoiceItem>
  >('/erp/purchase-invoice/source-item-page', { params });
}

export function getPurchaseInvoiceMixedSourceItemPage(
  data: ErpPurchaseInvoiceApi.PurchaseInvoiceMixedSourceItemPageParam,
) {
  return requestClient.post<
    PageResult<ErpPurchaseInvoiceApi.PurchaseInvoiceItem>
  >('/erp/purchase-invoice/source-item-page/mixed', data);
}

export function getPurchaseInvoiceDeptSimpleList() {
  return requestClient.get<any[]>('/erp/purchase-invoice/dept-simple-list');
}

export function getPurchaseInvoiceDeptSimplePage(params: PageParam) {
  return requestClient.get<PageResult<any>>(
    '/erp/purchase-invoice/dept-simple-page',
    { params },
  );
}

export function getPurchaseInvoiceSupplierDeptSimpleList(supplierId: number) {
  return requestClient.get<any[]>(
    '/erp/purchase-invoice/supplier-dept-simple-list',
    { params: { supplierId } },
  );
}

export function getPurchaseInvoiceSupplierDeptSimplePage(
  params: Partial<PageParam> & { supplierId?: number },
) {
  return requestClient.get<PageResult<any>>(
    '/erp/purchase-invoice/supplier-dept-simple-page',
    { params },
  );
}

export function getPurchaseInvoiceUserSimplePage(params: PageParam) {
  return requestClient.get<PageResult<any>>(
    '/erp/purchase-invoice/user-simple-page',
    { params },
  );
}

export function createPurchaseInvoice(
  data: ErpPurchaseInvoiceApi.PurchaseInvoice,
) {
  return requestClient.post(
    '/erp/purchase-invoice/create',
    stripErpDocumentTaxFields(data),
  );
}

export function createPurchaseInvoiceDraft(
  data: ErpPurchaseInvoiceApi.PurchaseInvoice,
) {
  return requestClient.post(
    '/erp/purchase-invoice/create-draft',
    stripErpDocumentTaxFields(data),
  );
}

export function updatePurchaseInvoice(
  data: ErpPurchaseInvoiceApi.PurchaseInvoice,
) {
  return requestClient.put(
    '/erp/purchase-invoice/update',
    stripErpDocumentTaxFields(data),
  );
}

export function updatePurchaseInvoiceDraft(
  data: ErpPurchaseInvoiceApi.PurchaseInvoice,
) {
  return requestClient.put(
    '/erp/purchase-invoice/update-draft',
    stripErpDocumentTaxFields(data),
  );
}

export function updateAndSubmitPurchaseInvoiceDraft(
  data: ErpPurchaseInvoiceApi.PurchaseInvoice,
) {
  return requestClient.put(
    '/erp/purchase-invoice/update-and-submit',
    stripErpDocumentTaxFields(data),
  );
}

export function submitPurchaseInvoice(id: number) {
  return requestClient.put('/erp/purchase-invoice/submit', null, {
    params: { id },
  });
}

/** 修改采购票据备注，不受审批状态限制 */
export function updatePurchaseInvoiceRemark(data: {
  id: number;
  remark: string;
}) {
  return requestClient.put('/erp/purchase-invoice/update-remark', data);
}

export function updatePurchaseInvoiceStatus(id: number, status: number) {
  return requestClient.put('/erp/purchase-invoice/update-status', null, {
    params: { id, status },
  });
}

export function deletePurchaseInvoice(ids: number[]) {
  return requestClient.delete('/erp/purchase-invoice/delete', {
    params: { ids: ids.join(',') },
  });
}

export function exportPurchaseInvoice(params: any) {
  return requestClient.download('/erp/purchase-invoice/export-excel', {
    params,
  });
}

export function getPurchaseInvoiceExportFields() {
  return requestClient.get<ErpPurchaseInvoiceApi.ExportField[]>(
    '/erp/purchase-invoice/export-fields',
  );
}

export function importPurchaseInvoice(file: File) {
  return requestClient.upload<ErpPurchaseInvoiceApi.PurchaseInvoiceImportResult>(
    '/erp/purchase-invoice/import',
    { file },
  );
}

export function getPurchaseInvoiceImportTemplate() {
  return requestClient.download('/erp/purchase-invoice/get-import-template');
}

export function downloadPurchaseInvoiceImportFailureDetails(recordId: number) {
  return requestClient.download(
    '/erp/purchase-invoice/import-failure-details/download',
    { params: { recordId } },
  );
}
