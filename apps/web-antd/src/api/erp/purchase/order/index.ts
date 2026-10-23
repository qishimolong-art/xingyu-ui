import type { PageParam, PageResult } from '@vben/request';

import { stripErpDocumentTaxFields } from '#/api/erp/common/strip-document-tax-fields';
import { requestClient } from '#/api/request';

export namespace ErpPurchaseOrderApi {
  export interface PurchaseOrderSummary {
    totalCount?: number;
    totalProductPrice?: number;
    discountPrice?: number;
    feeAmount?: number;
    depositPrice?: number;
    totalPrice?: number;
  }
  /** 采购订单信息 */
  export interface PurchaseOrder {
    id?: number; // 订单工单编号
    no?: string; // 采购订单号
    supplierId?: number; // 供应商编号
    supplierName?: string; // 供应商名称
    orderTime?: Date | string; // 订单时间
    totalCount?: number; // 合计数量
    totalPrice?: number; // 合计金额，单位：元
    totalProductPrice?: number; // 产品金额，单位：元
    discountPercent?: number; // 优惠率，百分比
    discountPrice?: number; // 优惠金额，单位：元
    feeAmount?: number; // 费用金额，单位：元
    depositPrice?: number; // 定金金额，单位：元
    accountId?: number; // 结算账户编号
    status?: number; // 状态
    remark?: string; // 备注
    fileUrl?: string; // 附件地址
    inCount?: number; // 采购入库数量
    count?: number; // 数量
    returnCount?: number; // 采购退货数量
    itemCount?: number; // 明细项数
    inStatus?: number; // 入库状态
    returnStatus?: number; // 退货状态
    productNames?: string; // 产品名称列表
    creatorName?: string; // 创建人名称
    createTime?: Date; // 创建时间
    updater?: string; // 修改人
    updaterName?: string; // 修改人名称
    updateTime?: Date | string; // 修改时间
    printFrequency?: number; // 打印次数
    printTime?: Date | string; // 最近打印时间
    items?: PurchaseOrderItem[]; // 订单项列表
    // ========== 汽配扩展字段 ==========
    arrivalDate?: Date | string; // 到货日期
    deliveryMethod?: string; // 送货方式
    purchaseType?: string; // 采购类型
    orderFormula?: string; // 订货公式
    sendDate?: Date | string; // 发出日期
    latestArrivalDate?: Date | string; // 最近到货日期
    saleDateFrom?: Date | string; // 销售日期从
    saleDateTo?: Date | string; // 到销售日期
    factoryOrderNo?: string; // 厂家单号
    receiveAddress?: string; // 收货地址
    invoiceType?: string; // 开票类型
    settleMethod?: string; // 结算方式
    // ========== 新增字段 ==========
    purchaser?: number; // 采购员（用户ID）
    purchaserName?: string; // 采购员名称
    deptId?: number; // 部门ID
    deptName?: string; // 部门名称
    orderDate?: Date | string; // 订货日期
    purchaseCycle?: number; // 采购周期(天)
    orderCompany?: string; // 订货公司（已废弃，DO 保留不再展示）
    taxPercent?: number; // 税率(%)
    documentType?: string; // 单据类型（普通单据/试销单据/代销单据）
    latestOrderDate?: Date | string; // 最近订货日期（只读，后端维护）
  }

  /** 采购订单项信息 */
  export interface PurchaseOrderItem {
    clientRowKey?: string; // 前端表格行身份，不传后端
    id?: number; // 订单项编号
    operation?: 'delete' | 'insert' | 'update';
    seq?: number; // 序号（前端表格行 key，不传后端）
    orderId?: number; // 采购订单编号
    productId?: number; // 产品编号
    productCode?: string; // 产品编码（前端展示用）
    productName?: string; // 产品名称
    productBarCode?: string; // 产品条码
    productUnitId?: number; // 产品单位编号
    productUnitName?: string; // 产品单位名称
    weight?: number; // 产品重量
    packageQty?: number; // 包装数
    pieceCount?: number | string; // 件数（前端展示）
    productPrice?: number; // 产品单价，单位：元
    productPurchasePrice?: number; // 产品采购价
    salePrice?: number; // 销售价
    lastSalePrice?: number; // 最近销售价
    minPrice?: number; // 最低价
    referencePrice?: number; // 参考价
    retailPrice?: number; // 零售价
    lastPurchasePrice?: number; // 最后采购价（只读参考）
    grossProfitRate?: number; // 毛利率（%）
    backupPrice1?: number; // 备用价1
    wholesalePrice?: number; // 批发价
    sharePrice?: number; // 股份价
    priceVisible?: boolean; // 当前业务场景是否允许查看价格
    totalProductPrice?: number; // 产品总价，单位：元
    count?: number; // 数量
    totalPrice?: number; // 总价，单位：元
    taxPercent?: number; // 税率，百分比
    taxPrice?: number; // 税额，单位：元
    totalTaxPrice?: number; // 含税总价，单位：元
    remark?: string; // 备注
    stockCount?: number; // 库存数量（显示字段）
    // ========== 汽配扩展字段 ==========
    warehouseId?: number; // 仓库编号
    warehouseName?: string; // 仓库名称
    deptId?: number; // 所属部门
    deptName?: string; // 所属部门名称
    warehousePosition?: string; // 货架位
    vehicleModel?: string; // 适用车型（产品带出）
    originPlace?: string; // 产地（产品带出）
    standard?: string; // 规格（产品带出）
    featureCode?: string; // 特征码（产品带出）
    drawingNo?: string; // 图号（产品带出）
    batchNo?: string; // 批次
    batchNoEnabled?: boolean; // 是否开启批次号管理
    factoryCode?: string; // 厂家编码（产品带出）
    brand?: string; // 品牌（产品带出）
    supplierId?: number; // 默认供应商编号
    arrivalCount?: number; // 到货数量
    gift?: boolean; // 是否赠品
    inCount?: number; // 采购入库数量
    returnCount?: number; // 采购退货数量
  }

  export interface PurchaseOrderImportResp {
    successCount?: number;
    failureCount?: number;
    items?: PurchaseOrderItem[];
    failureDetails?: {
      productCode?: string;
      reason?: string;
      rowNo?: number;
    }[];
  }

  export interface PurchaseOrderImportResultResp {
    successCount?: number;
    failureCount?: number;
    recordId?: number;
    orderIds?: number[];
    failureDetails?: {
      groupNo?: string;
      orderNo?: string;
      productCode?: string;
      reason?: string;
      rowNo?: number;
    }[];
  }

  export interface ExportField {
    field: string;
    label: string;
    group?: string;
    groupLabel?: string;
    required?: boolean;
    sort?: number;
  }

  export interface SupplierDeptSimple {
    id?: number;
    name?: string;
    parentId?: number;
  }

  export interface PurchaseOrderItemBatchUpdate {
    orderId: number;
    itemIds: number[];
    warehouseId?: number;
    deptId?: number;
  }

  export interface PurchaseOrderPrintData {
    main?: Record<string, any>;
    items?: Record<string, any>[];
    system?: Record<string, any>;
  }

  export interface PurchaseOrderItemPageParam extends PageParam {
    excludedItemIds?: number[];
    mask?: boolean;
    orderDirection?: 'asc' | 'desc';
    orderField?: string;
    orderId: number;
  }

  export interface PurchaseItemMatchResult {
    matches: Array<{ itemId: number; keyIndex: number; pageNo: number }>;
  }
}

/** 查询采购订单分页 */
export function getPurchaseOrderPage(params: PageParam) {
  return requestClient.get<PageResult<ErpPurchaseOrderApi.PurchaseOrder>>(
    '/erp/purchase-order/page',
    { params, timeout: 60_000 },
  );
}

export function getPurchaseOrderSummary(
  params: Record<string, any>,
  signal?: AbortSignal,
) {
  return requestClient.get<ErpPurchaseOrderApi.PurchaseOrderSummary>(
    '/erp/purchase-order/summary',
    { params, signal, timeout: 30_000 },
  );
}

interface GetPurchaseOrderOptions {
  includeItems?: boolean;
  mask?: boolean;
}

/** 查询采购订单详情 */
export function getPurchaseOrder(
  id: number,
  options: GetPurchaseOrderOptions = {},
) {
  const params: Record<string, boolean | number> = { id };
  if (options.mask !== undefined) {
    params.mask = options.mask;
  }
  if (options.includeItems !== undefined) {
    params.includeItems = options.includeItems;
  }
  return requestClient.get<ErpPurchaseOrderApi.PurchaseOrder>(
    '/erp/purchase-order/get',
    { params },
  );
}

/** 查询采购订单明细分页 */
export function getPurchaseOrderItemPage(
  params: ErpPurchaseOrderApi.PurchaseOrderItemPageParam,
) {
  return requestClient.get<PageResult<ErpPurchaseOrderApi.PurchaseOrderItem>>(
    '/erp/purchase-order/item-page',
    { params },
  );
}

/** 查询采购订单明细分页（编辑态，支持排除待删除明细） */
export function getPurchaseOrderItemPageForEdit(
  data: ErpPurchaseOrderApi.PurchaseOrderItemPageParam,
) {
  return requestClient.post<PageResult<ErpPurchaseOrderApi.PurchaseOrderItem>>(
    '/erp/purchase-order/item-page',
    data,
  );
}

export function matchPurchaseOrderItems(data: {
  documentId: number;
  excludedItemIds?: number[];
  keys: Array<{ gift?: boolean; productId?: number; warehouseId?: number }>;
  pageSize: number;
}) {
  return requestClient.post<ErpPurchaseOrderApi.PurchaseItemMatchResult>(
    '/erp/purchase-order/item-match',
    data,
  );
}

export function getPurchaseOrderPrintData(id: number) {
  return requestClient.get<ErpPurchaseOrderApi.PurchaseOrderPrintData>(
    '/erp/purchase-order/print-data',
    { params: { id } },
  );
}

export function getPurchaseOrderSupplierDeptSimpleList(supplierId: number) {
  return requestClient.get<ErpPurchaseOrderApi.SupplierDeptSimple[]>(
    '/erp/purchase-order/supplier-dept-simple-list',
    { params: { supplierId } },
  );
}

export function getPurchaseOrderSupplierDeptSimplePage(
  params: Partial<PageParam> & { supplierId?: number },
) {
  return requestClient.get<PageResult<ErpPurchaseOrderApi.SupplierDeptSimple>>(
    '/erp/purchase-order/supplier-dept-simple-page',
    { params },
  );
}

export function getPurchaseOrderDeptSimpleList() {
  return requestClient.get<ErpPurchaseOrderApi.SupplierDeptSimple[]>(
    '/erp/purchase-order/dept-simple-list',
  );
}

export function getPurchaseOrderDeptSimplePage(params: Partial<PageParam>) {
  return requestClient.get<PageResult<ErpPurchaseOrderApi.SupplierDeptSimple>>(
    '/erp/purchase-order/dept-simple-page',
    { params },
  );
}

export function getPurchaseOrderUserSimplePage(params: Partial<PageParam>) {
  return requestClient.get<PageResult<any>>(
    '/erp/purchase-order/user-simple-page',
    { params },
  );
}

export function getPurchaseOrderWarehouseDeptSimpleList(warehouseId: number) {
  return requestClient.get<ErpPurchaseOrderApi.SupplierDeptSimple[]>(
    '/erp/purchase-order/warehouse-dept-simple-list',
    { params: { warehouseId } },
  );
}

export function getPurchaseOrderWarehouseDeptSimplePage(
  params: Partial<PageParam> & { warehouseId?: number },
) {
  return requestClient.get<PageResult<ErpPurchaseOrderApi.SupplierDeptSimple>>(
    '/erp/purchase-order/warehouse-dept-simple-page',
    { params },
  );
}

/** 新增采购订单 */
export function createPurchaseOrder(data: ErpPurchaseOrderApi.PurchaseOrder) {
  return requestClient.post(
    '/erp/purchase-order/create',
    stripErpDocumentTaxFields(data),
  );
}

export function createPurchaseOrderDraft(
  data: ErpPurchaseOrderApi.PurchaseOrder,
) {
  return requestClient.post(
    '/erp/purchase-order/create-draft',
    stripErpDocumentTaxFields(data),
  );
}

export function createAndSubmitPurchaseOrder(
  data: ErpPurchaseOrderApi.PurchaseOrder,
) {
  return requestClient.post(
    '/erp/purchase-order/create-and-submit',
    stripErpDocumentTaxFields(data),
  );
}

/** 修改采购订单 */
export function updatePurchaseOrder(data: ErpPurchaseOrderApi.PurchaseOrder) {
  return requestClient.put(
    '/erp/purchase-order/update',
    stripErpDocumentTaxFields(data),
  );
}

export function updatePurchaseOrderDraft(
  data: ErpPurchaseOrderApi.PurchaseOrder,
) {
  return requestClient.put(
    '/erp/purchase-order/update-draft',
    stripErpDocumentTaxFields(data),
  );
}

export function updateAndSubmitPurchaseOrder(
  data: ErpPurchaseOrderApi.PurchaseOrder,
) {
  return requestClient.put(
    '/erp/purchase-order/update-and-submit',
    stripErpDocumentTaxFields(data),
  );
}

/** 单独修改采购订单备注（不受订单状态限制） */
export function updatePurchaseOrderRemark(data: {
  id: number;
  remark: string;
}) {
  return requestClient.put('/erp/purchase-order/update-remark', data);
}

export function batchUpdatePurchaseOrderItems(
  data: ErpPurchaseOrderApi.PurchaseOrderItemBatchUpdate,
) {
  return requestClient.put('/erp/purchase-order/batch-update-items', data);
}

/** 更新采购订单的状态 */
export function updatePurchaseOrderStatus(id: number, status: number) {
  return requestClient.put('/erp/purchase-order/update-status', null, {
    params: { id, status },
  });
}

export const PURCHASE_ORDER_STATUS = {
  DRAFT: 0,
  PROCESS: 10,
  APPROVE: 20,
} as const;

export function submitPurchaseOrder(id: number) {
  return requestClient.put('/erp/purchase-order/submit', null, {
    params: { id },
  });
}

/** 采购订单下订 */
export function orderPurchaseOrder(id: number) {
  return updatePurchaseOrderStatus(id, PURCHASE_ORDER_STATUS.APPROVE);
}

/** 采购订单反下订 */
export function reverseSubmitPurchaseOrder(id: number) {
  return updatePurchaseOrderStatus(id, PURCHASE_ORDER_STATUS.PROCESS);
}

/** 删除采购订单 */
export function deletePurchaseOrder(ids: number[]) {
  return requestClient.delete('/erp/purchase-order/delete', {
    params: { ids: ids.join(',') },
  });
}

/** 导出采购订单 Excel */
export function exportPurchaseOrder(params?: Record<string, any>) {
  const exportParams = { ...params };
  if (Array.isArray(exportParams.ids)) {
    exportParams.ids = exportParams.ids.join(',');
  }
  return requestClient.download('/erp/purchase-order/export-excel', {
    params: exportParams,
  });
}

/** 解析采购订单导入Excel（仅解析不创建） */
export function getPurchaseOrderExportFields() {
  return requestClient.get<ErpPurchaseOrderApi.ExportField[]>(
    '/erp/purchase-order/export-fields',
  );
}

/** 解析采购订单明细导入 Excel（仅回填当前表单明细，不创建整单） */
export function parsePurchaseOrderDetailImportExcel(file: File) {
  return requestClient.upload<ErpPurchaseOrderApi.PurchaseOrderImportResp>(
    '/erp/purchase-order/parse-detail-import-excel',
    { file },
  );
}

/** 下载采购订单整单导入模板 */
export function getPurchaseOrderImportTemplate() {
  return requestClient.download('/erp/purchase-order/get-import-template');
}

/** 导入采购订单整单 */
export function importPurchaseOrder(file: File) {
  return requestClient.upload<ErpPurchaseOrderApi.PurchaseOrderImportResultResp>(
    '/erp/purchase-order/import',
    { file },
  );
}

/** 下载采购订单导入错误数据 */
export function downloadPurchaseOrderImportFailureDetails(recordId: number) {
  return requestClient.download(
    '/erp/purchase-order/import-failure-details/download',
    { params: { recordId } },
  );
}

/** 下载采购订单明细导入模板 */
export function getPurchaseOrderDetailImportTemplate() {
  return requestClient.download(
    '/erp/purchase-order/get-detail-import-template',
  );
}

/** 可入库明细项 */
export interface InableItem {
  orderItemId?: number;
  productId?: number;
  productUnitId?: number;
  productName?: string;
  productCode?: string;
  productUnitName?: string;
  productPrice?: number;
  taxPercent?: number;
  orderCount?: number;
  inCount?: number;
  inableCount?: number;
  warehouseId?: number;
  deptId?: number;
  stockCount?: number;
  availableCount?: number;
  gift?: boolean;
  vehicleModel?: string;
  originPlace?: string;
  brand?: string;
  standard?: string;
  drawingNo?: string;
  warehousePosition?: string;
  packageQty?: number;
  remark?: string;
}

export interface InableItemStockQueryReq {
  orderId: number;
  items: Array<{
    orderItemId: number;
    warehouseId: number;
  }>;
}

export interface InableItemStock {
  orderItemId: number;
  warehouseId: number;
  stockCount: number;
  availableCount: number;
}

/** 可入库明细分页参数 */
export interface InableItemPageParam extends PageParam {
  orderId: number;
  productKeyword?: string;
}

/** 查询采购订单的可入库明细 */
export function getInableItemsByOrderId(orderId: number) {
  return requestClient.get<InableItem[]>('/erp/purchase-order/inable-items', {
    params: { orderId },
  });
}

/** 分页查询采购订单的可入库明细 */
export function getInableItemPage(params: InableItemPageParam) {
  return requestClient.get<PageResult<InableItem>>(
    '/erp/purchase-order/inable-item-page',
    { params },
  );
}

/** 批量查询采购订单可入库明细在所选仓库的实时库存 */
export function getInableItemStockList(data: InableItemStockQueryReq) {
  return requestClient.post<InableItemStock[]>(
    '/erp/purchase-order/inable-item-stock-query',
    data,
  );
}
