import type { PageParam, PageResult } from '@vben/request';

import { stripErpDocumentTaxFields } from '#/api/erp/common/strip-document-tax-fields';
import { requestClient } from '#/api/request';

export namespace ErpSaleReturnApi {
  /** 销售退货信息 */
  export interface SaleReturn {
    id?: number; // 销售退货编号
    no?: string; // 销售退货号
    customerId?: number; // 客户编号
    customerCode?: string; // 客户编码
    returnTime?: Date; // 退货时间
    totalCount?: number; // 合计数量
    totalPrice?: number; // 合计金额，单位：元
    status?: number; // 状态
    remark?: string; // 备注
    discountPercent?: number; // 折扣百分比
    discountPrice?: number; // 折扣金额
    feeAmount?: number;
    otherPrice?: number; // 其他费用
    totalProductPrice?: number; // 合计商品金额
    taxPrice?: number; // 合计税额
    totalTaxPrice?: number; // 合计税额
    fileUrl?: string; // 附件地址
    returnMode?: number;
    orderId?: number;
    orderNo?: string;
    customerName?: string;
    sourceOutId?: number;
    sourceOutNo?: string;
    refundPrice?: number;
    creator?: string;
    creatorName?: string;
    createTime?: Date;
    updater?: string;
    updaterName?: string;
    updateTime?: Date;
    approveTime?: Date;
    auditorName?: string;
    confirmUserId?: number;
    confirmUserName?: string;
    confirmTime?: Date;
    pickStatus?: number;
    pickedItemCount?: number;
    pickTotalItemCount?: number;
    deptId?: number;
    deptName?: string;
    priority?: string;
    invoiceType?: string;
    billNo?: string;
    deliveryMethod?: string;
    reductionAmount?: number;
    freightType?: string;
    freightAmount?: number;
    settleMethod?: string;
    logisticsCompany?: string;
    deliveryNo?: string;
    logisticsNo?: string;
    vehicleNo?: string;
    branchStore?: string;
    branchStoreEnabled?: boolean;
    purchaseArea?: string;
    businessType?: string;
    orderMethod?: string;
    developerUserId?: number;
    handler?: number;
    handlerName?: string;
    saleUserId?: number;
    saleUserName?: string;
    accountId?: number;
    totalWeight?: number;
    printCount?: number;
    printTime?: Date;
    productNames?: string;
    items?: SaleReturnItem[];
  }

  /** 销售退货项 */
  export interface SaleReturnItem {
    clientRowKey?: string;
    count?: number;
    id?: number;
    operation?: 'delete' | 'insert' | 'update';
    seq?: number;
    orderItemId?: number;
    sourceOutItemId?: number;
    productBarCode?: string;
    productId?: number;
    productCode?: string;
    productName: string;
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
    productPrice: number;
    productUnitId?: number;
    productUnitName?: string;
    weight?: number;
    packageQty?: number;
    pieceCount?: number | string;
    totalProductPrice?: number;
    remark: string;
    stockCount?: number;
    taxPercent?: number;
    taxPrice?: number;
    totalPrice?: number;
    warehouseId?: number;
    warehouseName?: string;
    warehouseDeptId?: number;
    warehouseDeptName?: string;
    deptId?: number;
    deptName?: string;
    batchNo?: string;
    returnReason?: string;
    warehousePosition?: string;
    outCount?: number;
    returnCount?: number;
    returnableCount?: number;
  }

  export interface SaleReturnItemBatchUpdateReq {
    returnId: number;
    itemIds: number[];
    warehouseId?: number;
    deptId?: number;
  }

  export interface SaleReturnItemPageParams extends PageParam {
    returnId: number;
    excludedItemIds?: number[];
    mask?: boolean;
    orderField?: string;
    orderDirection?: 'asc' | 'desc';
  }

  export interface SaleReturnItemMatchReq {
    documentId: number;
    pageSize: number;
    excludedItemIds?: number[];
    keys: Array<{
      productId?: number;
      warehouseId?: number;
      batchNo?: string;
    }>;
  }

  export interface SaleReturnItemMatchResp {
    matches: Array<{ itemId: number; keyIndex: number; pageNo: number }>;
  }

  export interface SaleReturnPageParams extends PageParam {
    productId?: number;
    productKeyword?: string;
    includeItems?: boolean;
    pickStatus?: number;
    status?: number;
    orderField?: string;
    orderDirection?: 'asc' | 'desc';
  }

  export interface SaleReturnSummary {
    totalCount?: number | null;
    totalProductPrice?: number | null;
    discountPrice?: number | null;
    totalPrice?: number | null;
  }

  export interface SaleReturnTransferOutableItem {
    sourceSaleReturnId?: number;
    sourceSaleReturnItemId?: number;
    sourceSaleReturnNo?: string;
    productId?: number;
    productCode?: string;
    productName?: string;
    productUnitId?: number;
    productUnitName?: string;
    productPrice?: number;
    count?: number;
    transferredCount?: number;
    transferOutableCount?: number;
    fromWarehouseId?: number;
    fromWarehouseName?: string;
    fromDeptId?: number;
    fromDeptName?: string;
    batchNo?: string;
    remark?: string;
  }

  export interface SaleReturnPurchaseReturnableItem {
    sourceSaleReturnId?: number;
    sourceSaleReturnItemId?: number;
    sourceSaleReturnNo?: string;
    productId?: number;
    productCode?: string;
    productName?: string;
    productUnitId?: number;
    productUnitName?: string;
    productPrice?: number;
    count?: number;
    purchaseReturnedCount?: number;
    purchaseReturnableCount?: number;
    warehouseId?: number;
    warehouseName?: string;
    deptId?: number;
    deptName?: string;
    batchNo?: string;
    remark?: string;
  }

  export interface SaleReturnCreateTransferOutReq {
    returnId: number;
    items: Array<{
      sourceSaleReturnItemId?: number;
      count?: number;
      fromWarehouseId?: number;
      fromDeptId?: number;
      toWarehouseId?: number;
      toDeptId?: number;
      remark?: string;
    }>;
  }

  export interface SaleReturnCreatePurchaseReturnReq {
    returnId: number;
    supplierId?: number;
    deptId?: number;
    returnTime?: Date | number | string;
    remark?: string;
    items: Array<{
      sourceSaleReturnItemId?: number;
      count?: number;
      productPrice?: number;
      remark?: string;
    }>;
  }

  export interface SaleReturnCreateTargetDraftResp {
    ids?: number[];
    nos?: string[];
  }

  export interface SaleReturnRefundSummary {
    id?: number;
    refundableAmount?: number;
    refundedAmount?: number;
    unrefundedAmount?: number;
    refundStatus?: number;
  }
}

export interface SaleReturnImportResp {
  recordId?: number;
  returnMode?: number;
  successCount?: number;
  failureCount?: number;
  items?: ErpSaleReturnApi.SaleReturnItem[];
  failureDetails?: Array<{
    productCode?: string;
    reason?: string;
    rowNo?: number;
  }>;
}

/** 查询销售退货分页 */
export function getSaleReturnPage(
  params: ErpSaleReturnApi.SaleReturnPageParams,
) {
  return requestClient.get<PageResult<ErpSaleReturnApi.SaleReturn>>(
    '/erp/sale-return/page',
    { params, timeout: 60_000 },
  );
}

export function getSaleReturnSummary(
  params: Record<string, any>,
  signal?: AbortSignal,
) {
  return requestClient.get<ErpSaleReturnApi.SaleReturnSummary>(
    '/erp/sale-return/summary',
    { params, signal, timeout: 30_000 },
  );
}

/** 查询销售退货详情 */
export function getSaleReturn(
  id: number,
  options: { includeItems?: boolean; mask?: boolean } = {},
) {
  return requestClient.get<ErpSaleReturnApi.SaleReturn>(
    '/erp/sale-return/get',
    {
      params: {
        id,
        includeItems: options.includeItems,
        mask: options.mask,
      },
    },
  );
}

export function getSaleReturnItemPage(
  params: ErpSaleReturnApi.SaleReturnItemPageParams,
) {
  return requestClient.get<PageResult<ErpSaleReturnApi.SaleReturnItem>>(
    '/erp/sale-return/item-page',
    { params },
  );
}

export function getSaleReturnEditItemPage(
  data: ErpSaleReturnApi.SaleReturnItemPageParams,
) {
  return requestClient.post<PageResult<ErpSaleReturnApi.SaleReturnItem>>(
    '/erp/sale-return/item-page',
    data,
  );
}

export function matchSaleReturnItems(
  data: ErpSaleReturnApi.SaleReturnItemMatchReq,
) {
  return requestClient.post<ErpSaleReturnApi.SaleReturnItemMatchResp>(
    '/erp/sale-return/item-match',
    data,
  );
}

export function getSaleReturnRefundSummary(id: number) {
  return requestClient.get<ErpSaleReturnApi.SaleReturnRefundSummary>(
    '/erp/sale-return/refund-summary',
    { params: { id } },
  );
}

/** 新增销售退货 */
export function createSaleReturn(data: ErpSaleReturnApi.SaleReturn) {
  return requestClient.post(
    '/erp/sale-return/create',
    stripErpDocumentTaxFields(data),
  );
}

/** 新增销售退货草稿 */
export function createSaleReturnDraft(data: ErpSaleReturnApi.SaleReturn) {
  return requestClient.post(
    '/erp/sale-return/create-draft',
    stripErpDocumentTaxFields(data),
  );
}

/** 修改销售退货 */
export function updateSaleReturn(data: ErpSaleReturnApi.SaleReturn) {
  return requestClient.put(
    '/erp/sale-return/update',
    stripErpDocumentTaxFields(data),
  );
}

/** 修改销售退货草稿 */
export function updateSaleReturnDraft(data: ErpSaleReturnApi.SaleReturn) {
  return requestClient.put(
    '/erp/sale-return/update-draft',
    stripErpDocumentTaxFields(data),
  );
}

export function batchUpdateSaleReturnItems(
  data: ErpSaleReturnApi.SaleReturnItemBatchUpdateReq,
) {
  return requestClient.put('/erp/sale-return/batch-update-items', data);
}

export function getSaleReturnWarehouseDeptSimpleList(warehouseId: number) {
  return requestClient.get<any[]>(
    '/erp/sale-return/warehouse-dept-simple-list',
    {
      params: { warehouseId },
    },
  );
}

export function getSaleReturnWarehouseDeptSimplePage(
  params: Partial<PageParam> & { warehouseId?: number },
) {
  return requestClient.get<PageResult<any>>(
    '/erp/sale-return/warehouse-dept-simple-page',
    { params },
  );
}

export function getSaleReturnDeptSimplePage(params: Partial<PageParam>) {
  return requestClient.get<PageResult<any>>(
    '/erp/sale-return/dept-simple-page',
    { params },
  );
}

export function getSaleReturnCustomerDeptSimplePage(
  params: Partial<PageParam> & { customerId?: number },
) {
  return requestClient.get<PageResult<any>>(
    '/erp/sale-return/customer-dept-simple-page',
    { params },
  );
}

export function getSaleReturnUserSimplePage(params: Partial<PageParam>) {
  return requestClient.get<PageResult<any>>(
    '/erp/sale-return/user-simple-page',
    { params },
  );
}

export function getSaleReturnTransferOutableItems(returnId: number) {
  return requestClient.get<ErpSaleReturnApi.SaleReturnTransferOutableItem[]>(
    '/erp/sale-return/transfer-outable-items',
    { params: { returnId } },
  );
}

export function getSaleReturnTransferOutableItemPage(
  params: Partial<PageParam> & { productKeyword?: string; returnId: number },
) {
  return requestClient.get<
    PageResult<ErpSaleReturnApi.SaleReturnTransferOutableItem>
  >('/erp/sale-return/transfer-outable-item-page', { params });
}

export function createTransferOutFromSaleReturn(
  data: ErpSaleReturnApi.SaleReturnCreateTransferOutReq,
) {
  return requestClient.post<ErpSaleReturnApi.SaleReturnCreateTargetDraftResp>(
    '/erp/sale-return/create-transfer-out',
    data,
  );
}

export function getSaleReturnPurchaseReturnableItems(returnId: number) {
  return requestClient.get<ErpSaleReturnApi.SaleReturnPurchaseReturnableItem[]>(
    '/erp/sale-return/purchase-returnable-items',
    { params: { returnId } },
  );
}

export function getSaleReturnPurchaseReturnableItemPage(
  params: Partial<PageParam> & { productKeyword?: string; returnId: number },
) {
  return requestClient.get<
    PageResult<ErpSaleReturnApi.SaleReturnPurchaseReturnableItem>
  >('/erp/sale-return/purchase-returnable-item-page', { params });
}

export function createPurchaseReturnFromSaleReturn(
  data: ErpSaleReturnApi.SaleReturnCreatePurchaseReturnReq,
) {
  return requestClient.post<ErpSaleReturnApi.SaleReturnCreateTargetDraftResp>(
    '/erp/sale-return/create-purchase-return',
    data,
  );
}

/** 提交销售退货草稿 */
export function submitSaleReturn(id: number) {
  return requestClient.put('/erp/sale-return/submit', null, {
    params: { id },
  });
}

/** 下单确认并生成销售退货拣货任务 */
export function confirmSaleReturn(
  id: number,
  expectedCostBasisSignature?: string,
) {
  return requestClient.put('/erp/sale-return/confirm', null, {
    params: {
      id,
      ...(expectedCostBasisSignature ? { expectedCostBasisSignature } : {}),
    },
  });
}

/** 未开始拣货时撤销下单确认 */
export function cancelConfirmSaleReturn(id: number) {
  return requestClient.put('/erp/sale-return/cancel-confirm', null, {
    params: { id },
  });
}

/** 修改销售退货备注，不受审批状态限制 */
export function updateSaleReturnRemark(data: { id: number; remark: string }) {
  return requestClient.put('/erp/sale-return/update-remark', data);
}

/** 更新销售退货的状态 */
export function updateSaleReturnStatus(
  id: number,
  status: number,
  expectedCostBasisSignature?: string,
) {
  return requestClient.put('/erp/sale-return/update-status', null, {
    params: {
      id,
      status,
      ...(expectedCostBasisSignature ? { expectedCostBasisSignature } : {}),
    },
  });
}

/** 删除销售退货 */
export function deleteSaleReturn(ids: number[]) {
  return requestClient.delete('/erp/sale-return/delete', {
    params: {
      ids: ids.join(','),
    },
  });
}

/** 导出销售退货 Excel */
export function exportSaleReturn(params: any) {
  const exportParams = { ...params };
  if (Array.isArray(exportParams.ids)) {
    exportParams.ids = exportParams.ids.join(',');
  }
  return requestClient.download('/erp/sale-return/export-excel', {
    params: exportParams,
  });
}

export function getSaleReturnExportFields() {
  return requestClient.get<any[]>('/erp/sale-return/export-fields');
}

export function importSaleReturn(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return requestClient.post<SaleReturnImportResp>(
    '/erp/sale-return/import',
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
    },
  );
}

/** 销售退货整单导入（列表入口） */
export function importSaleReturnOrder(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return requestClient.post<SaleReturnImportResp>(
    '/erp/sale-return/import-order',
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
}

/** 下载销售退货整单导入模板 */
export function exportSaleReturnOrderImportTemplate() {
  return requestClient.download('/erp/sale-return/get-order-import-template');
}

export function exportSaleReturnImportTemplate() {
  return requestClient.download('/erp/sale-return/export-import-template');
}

export function downloadSaleReturnImportFailureDetails(recordId: number) {
  return requestClient.download(
    '/erp/sale-return/import-failure-details/download',
    {
      params: { recordId },
    },
  );
}
