import type { PageParam, PageResult } from '@vben/request';

import { requestClient } from '#/api/request';

type UploadProgressEvent = (progressEvent: unknown) => void;

export namespace ErpSaleOutApi {
  /** 销售出库信息 */
  export interface SaleOut {
    id?: number;
    no?: string;
    customerId?: number;
    customerName?: string;
    customerCode?: string;
    saleUserId?: number;
    saleUserName?: string;
    outTime?: number;
    totalCount?: number;
    totalPrice?: number;
    totalProductPrice?: number;
    totalTaxPrice?: number;
    status?: number;
    remark?: string;
    fileUrl?: string;
    expressFileUrl?: string;
    hasExpressFile?: boolean;
    sourceType?: number;
    sourceId?: number;
    sourceNo?: string;
    sourceCreateTime?: number;
    sourceCreatorName?: string;
    items?: SaleOutItem[];
    productNames?: string;
    creator?: string;
    creatorName?: string;
    createTime?: number;
    // 业务扩展
    settleStatus?: number;
    orderType?: string;
    feeAmount?: number;
    extraFee?: number;
    priority?: string;
    signStatus?: number;
    signImageUrl?: string;
    // 物流
    deliveryMethod?: string;
    shipper?: string;
    receiverName?: string;
    receiverPhone?: string;
    deliveryNo?: string;
    logisticsNo?: string;
    logisticsCompany?: string;
    senderName?: string;
    insuranceCompany?: string;
    thirdPartyNo?: string;
    thirdPartyUpstreamNo?: string;
    // 财务
    settleMethod?: string;
    invoiceAmount?: number;
    reductionAmount?: number;
    afterReductionAmount?: number;
    billAmount?: number;
    freight?: number;
    freightType?: string;
    billType?: string;
    billNo?: string;
    // 取消
    cancelCount?: number;
    cancelAmount?: number;
    afterCancelAmount?: number;
    // 人员
    auditorId?: number;
    auditorName?: string;
    deptId?: number;
    deptName?: string;
    // 时间
    totalWeight?: number;
    approveTime?: number;
    printTime?: number;
    confirmTime?: number;
    // 其他
    internalNote?: string;
    vin?: string;
    printCount?: number;
    // 计算字段
    returnStatus?: number;
    adjusted?: boolean;
    adjustStatus?: number;
    adjustSourceOutId?: number;
    adjustNewOutId?: number;
    adjustPriceAdjustId?: number;
    // 旧字段保留
    orderId?: number;
    orderNo?: string;
    accountId?: number;
    receiptPrice?: number;
    discountPercent?: number;
    discountPrice?: number;
    otherPrice?: number;
    hasStockOutBill?: boolean;
    stockOutBills?: StockOutBillBrief[];
    pickDeliveryOrderId?: number;
    pickStatus?: number;
    deliveryStatus?: number;
    pickDeliveryTotalItemCount?: number;
    pickedItemCount?: number;
    deliveredItemCount?: number;
    pickProgress?: string;
    deliveryProgress?: string;
    latestPickTime?: number | string;
    latestDeliveryTime?: number | string;
    pickCompleteTime?: number | string;
    deliveryCompleteTime?: number | string;
  }

  export interface SaleOutItemPageParams extends PageParam {
    outId: number;
    mask?: boolean;
    orderField?: string;
    orderDirection?: 'asc' | 'desc';
  }

  export interface SaleOutPageParams extends PageParam {
    productId?: number;
    productKeyword?: string;
    includeItems?: boolean;
    receiptEnable?: boolean;
    orderField?: string;
    orderDirection?: 'asc' | 'desc';
  }

  export interface SaleOutSummary {
    totalCount?: number | null;
    totalProductPrice?: number | null;
    reductionAmount?: number | null;
    afterReductionAmount?: number | null;
    billAmount?: number | null;
    freight?: number | null;
  }

  export interface StockOutBillBrief {
    id?: number;
    no?: string;
    warehouseId?: number;
    warehouseName?: string;
    status?: number;
    statusName?: string;
    totalCount?: number;
    pickedCount?: number;
    billDate?: number | string;
  }

  export interface SaleOutReceiptSummary {
    id?: number;
    receivableAmount?: number;
    receivedAmount?: number;
    unreceivedAmount?: number;
    receiptStatus?: number;
  }

  export interface PickDeliveryDetail {
    summary?: PickDeliverySummary;
    deliveryOrder?: DeliveryOrder;
    pickTasks?: PickTask[];
    submits?: PickDeliverySubmit[];
  }

  export interface PickDeliverySummary {
    orderId?: number;
    saleOutId?: number;
    saleOutNo?: string;
    pickStatus?: number;
    deliveryStatus?: number;
    totalItemCount?: number;
    pickedItemCount?: number;
    deliveredItemCount?: number;
    pickProgress?: string;
    deliveryProgress?: string;
    latestPickTime?: number | string;
    latestDeliveryTime?: number | string;
    pickCompleteTime?: number | string;
    deliveryCompleteTime?: number | string;
  }

  export interface PickTask {
    id?: number;
    orderId?: number;
    saleOutId?: number;
    saleOutNo?: string;
    customerId?: number;
    customerName?: string;
    warehouseId?: number;
    warehouseName?: string;
    status?: number;
    totalItemCount?: number;
    pickedItemCount?: number;
    totalPieceCount?: number;
    pickProgress?: string;
    latestPickTime?: number | string;
    completeTime?: number | string;
    createTime?: number | string;
  }

  export interface DeliveryOrder {
    id?: number;
    saleOutId?: number;
    saleOutNo?: string;
    customerId?: number;
    customerName?: string;
    deptId?: number;
    pickStatus?: number;
    deliveryStatus?: number;
    totalItemCount?: number;
    pickedItemCount?: number;
    deliveredItemCount?: number;
    totalPieceCount?: number;
    pickProgress?: string;
    deliveryProgress?: string;
    latestPickTime?: number | string;
    latestDeliveryTime?: number | string;
    pickCompleteTime?: number | string;
    deliveryCompleteTime?: number | string;
    createTime?: number | string;
  }

  export interface PickDeliveryItem {
    id?: number;
    orderId?: number;
    pickTaskId?: number;
    saleOutId?: number;
    saleOutItemId?: number;
    warehouseId?: number;
    warehouseName?: string;
    productId?: number;
    productCode?: string;
    productName?: string;
    standard?: string;
    count?: number;
    warehousePosition?: string;
    packageQty?: number;
    pieceCount?: number;
    pickStatus?: number;
    pickUserId?: number;
    pickUserName?: string;
    pickTime?: number | string;
    deliveryStatus?: number;
    deliveryUserId?: number;
    deliveryUserName?: string;
    deliveryTime?: number | string;
  }

  export interface PickDeliveryOperationItem {
    id?: number;
    submitId?: number;
    type?: number;
    submitUserId?: number;
    submitUserName?: string;
    submitTime?: number | string;
    itemId?: number;
    productCode?: string;
    productName?: string;
    standard?: string;
    warehouseId?: number;
    warehouseName?: string;
    quantity?: number | string;
  }

  export interface PickDeliverySubmit {
    id?: number;
    quantityDetails?: boolean;
    orderId?: number;
    pickTaskId?: number;
    saleOutId?: number;
    type?: number;
    submitUserId?: number;
    submitUserName?: string;
    submitTime?: number | string;
    itemCount?: number;
    remark?: string;
    files?: PickDeliveryFile[];
  }

  export interface PickDeliveryFile {
    id?: number;
    submitId?: number;
    type?: number;
    typeName?: string;
    submitUserId?: number;
    submitUserName?: string;
    submitTime?: number | string;
    itemCount?: number;
    remark?: string;
    fileUrl?: string;
    fileName?: string;
    fileType?: string;
    sort?: number;
  }

  export interface PickDeliveryItemPageParams extends PageParam {
    outId: number;
  }

  export interface PickDeliveryOperationItemPageParams extends PageParam {
    outId: number;
    type: 10 | 20;
  }

  export interface PickDeliveryFilePageParams extends PageParam {
    outId: number;
    type?: number;
  }

  export interface ExpressFile {
    id?: number;
    submitId?: number;
    fileUrl?: string;
    fileName?: string;
    fileType?: string;
    sourceType?: 'DELIVERY' | 'MANUAL';
    sourceName?: string;
    submitUserId?: number;
    submitUserName?: string;
    submitTime?: number | string;
    sort?: number;
  }

  export interface ExpressFilePageParams extends PageParam {
    outId: number;
  }

  /** 销售出库项 */
  export interface SaleOutItem {
    id?: number;
    operation?: 'delete' | 'insert' | 'update';
    seq?: number;
    outId?: number;
    orderItemId?: number;
    productId?: number;
    productName?: string;
    productCode?: string;
    productBarCode?: string;
    productUnitId?: number;
    productUnitName?: string;
    warehouseId?: number;
    deptId?: number;
    warehouseName?: string;
    warehouseDeptId?: number;
    warehouseDeptName?: string;
    sourceWarehouseId?: number;
    sourceWarehouseName?: string;
    sourceDeptId?: number;
    sourceDeptName?: string;
    crossDept?: boolean;
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
    saleCostAmount?: number;
    saleCostPrice?: number;
    count?: number;
    giftFlag?: boolean;
    totalProductPrice?: number;
    taxPercent?: number;
    taxPrice?: number;
    remark?: string;
    stockCount?: number;
    // 扩展字段
    vehicleModel?: string;
    standard?: string;
    featureCode?: string;
    brand?: string;
    drawingNo?: string;
    batchNo?: string;
    batchNoEnabled?: boolean;
    warehousePosition?: string;
    unitWeight?: number;
    packageQty?: number;
    pieceCount?: number | string;
    totalWeight?: number;
    afterReductionPrice?: number;
    afterReductionAmount?: number;
    actualSaleAmount?: number;
    originPlace?: string;
    supplierName?: string;
    originalProductPrice?: number;
    returnedCount?: number;
    hasStockOutBill?: boolean;
    stockOutBillNos?: string;
    stockOutBillStatus?: number;
    stockOutBillStatusName?: string;
    stockOutBillCount?: number;
    stockOutBillPickedCount?: number;
    stockOutBillRemainCount?: number;
  }

  /** 可退货明细 */
  export interface SaleReturnableItem {
    sourceOutId?: number;
    sourceOutItemId?: number;
    sourceOutNo?: string;
    productId?: number;
    productCode?: string;
    productName?: string;
    productBarCode?: string;
    productUnitName?: string;
    productUnitId?: number;
    weight?: number;
    packageQty?: number;
    warehouseId?: number;
    warehouseName?: string;
    warehouseDeptId?: number;
    warehouseDeptName?: string;
    deptId?: number;
    deptName?: string;
    productPrice?: number;
    outCount?: number;
    returnedCount?: number;
    returnableCount?: number;
    taxPercent?: number;
    remark?: string;
  }

  export interface SaleReturnableItemPageParam extends PageParam {
    outId: number;
    productKeyword?: string;
  }
}

/** 查询销售出库分页 */
export function getSaleOutPage(params: ErpSaleOutApi.SaleOutPageParams) {
  return requestClient.get<PageResult<ErpSaleOutApi.SaleOut>>(
    '/erp/sale-out/page',
    { params, timeout: 60_000 },
  );
}

export function getSaleOutSummary(
  params: Record<string, any>,
  signal?: AbortSignal,
) {
  return requestClient.get<ErpSaleOutApi.SaleOutSummary>(
    '/erp/sale-out/summary',
    { params, signal, timeout: 30_000 },
  );
}

export function getSaleOutDeptSimplePage(params: Partial<PageParam>) {
  return requestClient.get<PageResult<any>>('/erp/sale-out/dept-simple-page', {
    params,
  });
}

export function getSaleOutCustomerDeptSimplePage(
  params: Partial<PageParam> & { customerId?: number },
) {
  return requestClient.get<PageResult<any>>(
    '/erp/sale-out/customer-dept-simple-page',
    { params },
  );
}

export function getSaleOutUserSimplePage(params: Partial<PageParam>) {
  return requestClient.get<PageResult<any>>('/erp/sale-out/user-simple-page', {
    params,
  });
}

/** 查询销售出库详情 */
export function getSaleOut(
  id: number,
  options: { includeItems?: boolean; mask?: boolean } = {},
) {
  return requestClient.get<ErpSaleOutApi.SaleOut>('/erp/sale-out/get', {
    params: {
      id,
      includeItems: options.includeItems,
      mask: options.mask,
    },
  });
}

export function getSaleOutItemPage(
  params: ErpSaleOutApi.SaleOutItemPageParams,
) {
  return requestClient.get<PageResult<ErpSaleOutApi.SaleOutItem>>(
    '/erp/sale-out/item-page',
    { params },
  );
}

export function getSaleOutReceiptSummary(id: number) {
  return requestClient.get<ErpSaleOutApi.SaleOutReceiptSummary>(
    '/erp/sale-out/receipt-summary',
    { params: { id } },
  );
}

export function getSaleOutPickDeliveryDetail(outId: number) {
  return requestClient.get<ErpSaleOutApi.PickDeliveryDetail>(
    '/erp/sale-out/pick-delivery-detail',
    { params: { outId } },
  );
}

export function getSaleOutPickDeliveryItemPage(
  params: ErpSaleOutApi.PickDeliveryItemPageParams,
) {
  return requestClient.get<PageResult<ErpSaleOutApi.PickDeliveryItem>>(
    '/erp/sale-out/pick-delivery-item-page',
    { params },
  );
}

export function getSaleOutPickDeliveryOperationItemPage(
  params: ErpSaleOutApi.PickDeliveryOperationItemPageParams,
) {
  return requestClient.get<PageResult<ErpSaleOutApi.PickDeliveryOperationItem>>(
    '/erp/sale-out/pick-delivery-operation-item-page',
    { params },
  );
}

export function getSaleOutPickDeliveryFilePage(
  params: ErpSaleOutApi.PickDeliveryFilePageParams,
) {
  return requestClient.get<PageResult<ErpSaleOutApi.PickDeliveryFile>>(
    '/erp/sale-out/pick-delivery-file-page',
    { params },
  );
}

/** 查询销售单快递单（人工补传主图 + 送货阶段上传，多图去重） */
export function getSaleOutExpressFilePage(
  params: ErpSaleOutApi.ExpressFilePageParams,
) {
  return requestClient.get<PageResult<ErpSaleOutApi.ExpressFile>>(
    '/erp/sale-out/express-file-page',
    { params },
  );
}

/** 修改销售出库备注，不受审批状态限制 */
export function updateSaleOutRemark(data: { id: number; remark: string }) {
  return requestClient.put('/erp/sale-out/update-remark', data);
}

/** 更新销售单快递单 */
export function updateSaleOutExpressFile(id: number, expressFileUrl: string) {
  return requestClient.put('/erp/sale-out/update-express-file', {
    id,
    expressFileUrl,
  });
}

/** 上传并绑定销售单快递单 */
export function uploadSaleOutExpressFile(
  id: number,
  file: File,
  onUploadProgress?: UploadProgressEvent,
) {
  return requestClient.upload<string>(
    '/erp/sale-out/upload-express-file',
    { file, id },
    { onUploadProgress },
  );
}

/** 更新销售出库状态 */
export function updateSaleOutStatus(id: number, status: number) {
  return requestClient.put('/erp/sale-out/update-status', null, {
    params: { id, status },
  });
}

/** 导出销售出库 Excel */
export function exportSaleOut(params: any) {
  const exportParams = { ...params };
  if (Array.isArray(exportParams.ids)) {
    exportParams.ids = exportParams.ids.join(',');
  }
  return requestClient.download('/erp/sale-out/export-excel', {
    params: exportParams,
  });
}

/** 查询可退货明细 */
export function getReturnableItemsByOutId(outId: number) {
  return requestClient.get<ErpSaleOutApi.SaleReturnableItem[]>(
    `/erp/sale-out/returnable-items?outId=${outId}`,
  );
}

export function getReturnableItemPageByOutId(
  params: ErpSaleOutApi.SaleReturnableItemPageParam,
) {
  return requestClient.get<PageResult<ErpSaleOutApi.SaleReturnableItem>>(
    '/erp/sale-out/returnable-item-page',
    { params },
  );
}
