import type { PageParam, PageResult } from '@vben/request';

import { requestClient } from '#/api/request';

export namespace ErpPurchasePriceAdjustApi {
  export interface PurchasePriceAdjustSummary {
    originalTotalPrice?: number;
    adjustedTotalPrice?: number;
    totalAdjustPrice?: number;
    paymentPrice?: number;
  }
  /** 采购调价明细 */
  export interface PurchasePriceAdjustItem {
    clientRowKey?: string; // 前端表格行身份，不传后端
    id?: number;
    operation?: 'delete' | 'insert' | 'update';
    adjustId?: number;
    inId?: number;
    inNo?: string;
    inItemId?: number;
    batchNo?: string;
    productId?: number;
    warehouseId?: number;
    deptId?: number;
    oldPrice?: number;
    newPrice?: number;
    newPriceText?: string;
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
    stockCount?: number;
    count?: number;
    remark?: string;
    /** 按入库单方式 = 比率；按明细方式 = null */
    adjustRatio?: number;
    adjustRatioText?: string;
    /** (newPrice - oldPrice) * count */
    adjustPrice?: number;
    // ========== 产品扩展字段（回显用） ==========
    productCode?: string;
    productName?: string;
    productUnitId?: number;
    productUnitName?: string;
    weight?: number;
    packageQty?: number;
    pieceCount?: number | string;
    vehicleModel?: string;
    standard?: string;
    featureCode?: string;
    originPlace?: string;
    brand?: string;
    drawingNo?: string;
    warehousePosition?: string;
    // vxe-table 行主键（前端用）
    seq?: number;
  }

  /** 采购调价单 */
  export interface PurchasePriceAdjust {
    id?: number;
    no?: string;
    status?: number;
    adjustTime?: number | string;
    supplierId?: number;
    supplierName?: string;
    deptId?: number;
    deptName?: string;
    adjuster?: number;
    adjusterName?: string;
    /** 10 按入库单 / 20 添加明细 */
    adjustType?: number;
    remark?: string;
    originalTotalPrice?: number;
    adjustedTotalPrice?: number;
    totalAdjustPrice?: number;
    paymentPrice?: number;
    approverName?: string;
    approveTime?: number | string;
    creator?: string;
    creatorName?: string;
    createTime?: Date | number | string;
    updater?: string;
    updaterName?: string;
    updateTime?: Date | number | string;
    items?: PurchasePriceAdjustItem[];
  }

  export interface PurchasePriceAdjustSettlementSummary {
    id?: number;
    settlementAmount?: number;
    writtenOffAmount?: number;
    unwrittenOffAmount?: number;
    settlementStatus?: number;
  }

  export interface PurchasePriceAdjustImportItem {
    productId?: number;
    productCode?: string;
    productName?: string;
    productUnitName?: string;
    weight?: number;
    packageQty?: number;
    vehicleModel?: string;
    standard?: string;
    featureCode?: string;
    originPlace?: string;
    brand?: string;
    drawingNo?: string;
    count?: number;
    oldPrice?: number;
    newPrice?: number;
    remark?: string;
  }

  export interface PurchasePriceAdjustImportResult {
    successCount?: number;
    failureCount?: number;
    items?: PurchasePriceAdjustImportItem[];
    failureDetails?: Array<{
      productCode?: string;
      reason?: string;
      rowNo?: number;
    }>;
  }

  export interface PurchasePriceAdjustOrderImportResult {
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

  export interface PurchasePriceAdjustItemPageParam extends PageParam {
    excludedItemIds?: number[];
    adjustId: number;
    mask?: boolean;
    orderDirection?: 'asc' | 'desc';
    orderField?: string;
  }

  export interface PurchaseItemMatchResult {
    matches: Array<{ itemId: number; keyIndex: number; pageNo: number }>;
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

/** 查询采购调价单分页 */
export function getPurchasePriceAdjustPage(
  params: PageParam & Record<string, any>,
) {
  return requestClient.get<
    PageResult<ErpPurchasePriceAdjustApi.PurchasePriceAdjust>
  >('/erp/purchase-price-adjust/page', { params, timeout: 60_000 });
}

export function getPurchasePriceAdjustSummary(
  params: Record<string, any>,
  signal?: AbortSignal,
) {
  return requestClient.get<ErpPurchasePriceAdjustApi.PurchasePriceAdjustSummary>(
    '/erp/purchase-price-adjust/summary',
    { params, signal, timeout: 30_000 },
  );
}

/** 查询采购调价单详情 */
export function getPurchasePriceAdjust(
  id: number,
  options?: { includeItems?: boolean; mask?: boolean },
) {
  return requestClient.get<ErpPurchasePriceAdjustApi.PurchasePriceAdjust>(
    '/erp/purchase-price-adjust/get',
    {
      params: {
        id,
        includeItems: options?.includeItems,
        mask: options?.mask,
      },
    },
  );
}

export function getPurchasePriceAdjustItemPage(
  params: ErpPurchasePriceAdjustApi.PurchasePriceAdjustItemPageParam,
) {
  return requestClient.get<
    PageResult<ErpPurchasePriceAdjustApi.PurchasePriceAdjustItem>
  >('/erp/purchase-price-adjust/item-page', { params });
}

export function getPurchasePriceAdjustItemPageForEdit(
  data: ErpPurchasePriceAdjustApi.PurchasePriceAdjustItemPageParam,
) {
  return requestClient.post<
    PageResult<ErpPurchasePriceAdjustApi.PurchasePriceAdjustItem>
  >('/erp/purchase-price-adjust/item-page', data);
}

export function matchPurchasePriceAdjustItems(data: {
  documentId: number;
  excludedItemIds?: number[];
  keys: Array<{ productId?: number; sourceItemId?: number }>;
  pageSize: number;
}) {
  return requestClient.post<ErpPurchasePriceAdjustApi.PurchaseItemMatchResult>(
    '/erp/purchase-price-adjust/item-match',
    data,
  );
}

export function getPurchasePriceAdjustPaymentSummary(id: number) {
  return requestClient.get<ErpPurchasePriceAdjustApi.PurchasePriceAdjustSettlementSummary>(
    '/erp/purchase-price-adjust/payment-summary',
    { params: { id } },
  );
}

/** 新增采购调价单 */
export function getPurchasePriceAdjustDeptSimpleList() {
  return requestClient.get<any[]>(
    '/erp/purchase-price-adjust/dept-simple-list',
  );
}

export function getPurchasePriceAdjustDeptSimplePage(params: PageParam) {
  return requestClient.get<PageResult<any>>(
    '/erp/purchase-price-adjust/dept-simple-page',
    { params },
  );
}

export function getPurchasePriceAdjustSupplierDeptSimpleList(
  supplierId: number,
) {
  return requestClient.get<any[]>(
    '/erp/purchase-price-adjust/supplier-dept-simple-list',
    { params: { supplierId } },
  );
}

export function getPurchasePriceAdjustSupplierDeptSimplePage(
  params: Partial<PageParam> & { supplierId?: number },
) {
  return requestClient.get<PageResult<any>>(
    '/erp/purchase-price-adjust/supplier-dept-simple-page',
    { params },
  );
}

export function getPurchasePriceAdjustUserSimplePage(params: PageParam) {
  return requestClient.get<PageResult<any>>(
    '/erp/purchase-price-adjust/user-simple-page',
    { params },
  );
}

export function createPurchasePriceAdjust(
  data: ErpPurchasePriceAdjustApi.PurchasePriceAdjust,
) {
  return requestClient.post('/erp/purchase-price-adjust/create', data);
}

/** 创建采购调价单草稿 */
export function createPurchasePriceAdjustDraft(
  data: ErpPurchasePriceAdjustApi.PurchasePriceAdjust,
) {
  return requestClient.post('/erp/purchase-price-adjust/create-draft', data);
}

/** 创建并正式提交采购调价单 */
export function createAndSubmitPurchasePriceAdjust(
  data: ErpPurchasePriceAdjustApi.PurchasePriceAdjust,
) {
  return requestClient.post(
    '/erp/purchase-price-adjust/create-and-submit',
    data,
  );
}

/** 修改采购调价单 */
export function updatePurchasePriceAdjust(
  data: ErpPurchasePriceAdjustApi.PurchasePriceAdjust,
) {
  return requestClient.put('/erp/purchase-price-adjust/update', data);
}

/** 更新采购调价单草稿 */
export function updatePurchasePriceAdjustDraft(
  data: ErpPurchasePriceAdjustApi.PurchasePriceAdjust,
) {
  return requestClient.put('/erp/purchase-price-adjust/update-draft', data);
}

/** 更新并正式提交采购调价单草稿 */
export function updateAndSubmitPurchasePriceAdjust(
  data: ErpPurchasePriceAdjustApi.PurchasePriceAdjust,
) {
  return requestClient.put(
    '/erp/purchase-price-adjust/update-and-submit',
    data,
  );
}

/** 提交采购调价单草稿，进入待审批状态 */
export function submitPurchasePriceAdjust(id: number) {
  return requestClient.put('/erp/purchase-price-adjust/submit', null, {
    params: { id },
  });
}

/** 修改采购调价单备注，不受审批状态限制 */
export function updatePurchasePriceAdjustRemark(data: {
  id: number;
  remark: string;
}) {
  return requestClient.put('/erp/purchase-price-adjust/update-remark', data);
}

/** 更新采购调价单状态（审批） */
export function updatePurchasePriceAdjustStatus(id: number, status: number) {
  return requestClient.put('/erp/purchase-price-adjust/update-status', null, {
    params: { id, status },
  });
}

/** 删除采购调价单 */
export function deletePurchasePriceAdjust(ids: number[]) {
  return requestClient.delete('/erp/purchase-price-adjust/delete', {
    params: { ids: ids.join(',') },
  });
}

/** 导出采购调价单 */
export function exportPurchasePriceAdjust(params: Record<string, any>) {
  return requestClient.download('/erp/purchase-price-adjust/export-excel', {
    params,
  });
}

export function getPurchasePriceAdjustExportFields() {
  return requestClient.get<ErpPurchasePriceAdjustApi.ExportField[]>(
    '/erp/purchase-price-adjust/export-fields',
  );
}

export function importPurchasePriceAdjust(file: File) {
  return requestClient.upload<ErpPurchasePriceAdjustApi.PurchasePriceAdjustImportResult>(
    '/erp/purchase-price-adjust/import',
    { file },
  );
}

export function getPurchasePriceAdjustImportTemplate() {
  return requestClient.download(
    '/erp/purchase-price-adjust/get-import-template',
  );
}

export function importPurchasePriceAdjustOrder(file: File) {
  return requestClient.upload<ErpPurchasePriceAdjustApi.PurchasePriceAdjustOrderImportResult>(
    '/erp/purchase-price-adjust/import-order',
    { file },
  );
}

export function getPurchasePriceAdjustOrderImportTemplate() {
  return requestClient.download(
    '/erp/purchase-price-adjust/get-order-import-template',
  );
}

export function downloadPurchasePriceAdjustImportFailureDetails(
  recordId: number,
) {
  return requestClient.download(
    '/erp/purchase-price-adjust/import-failure-details/download',
    { params: { recordId } },
  );
}
