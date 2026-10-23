import type { PageParam, PageResult } from '@vben/request';

import { requestClient } from '#/api/request';
import { stripErpDocumentTaxFields } from '#/api/erp/common/strip-document-tax-fields';

export namespace ErpSaleOrderApi {
  /** 销售订单信息 */
  export interface SaleOrder {
    customerName?: string;
    id?: number; // 订单工单编号
    no: string; // 销售订单号
    customerId: number; // 客户编号
    accountId?: number; // 收款账户编号
    deptId?: number;
    deptName?: string; // 销售部门名称
    saleUserId?: number; // 销售员编号
    orderTime: Date; // 订单时间
    totalCount: number; // 合计数量
    totalPrice: number; // 合计金额，单位：元
    status: number; // 状态
    remark: string; // 备注
    outCount: number; // 销售出库数量
    fileUrl?: string; // 附件地址
    inCount?: number; // 采购入库数量
    returnCount: number; // 销售退货数量
    totalProductPrice?: number; // 产品金额，单位：元
    discountPercent?: number; // 优惠率，百分比
    discountPrice?: number; // 优惠金额，单位：元
    feeAmount?: number; // 费用金额，单位：元
    depositPrice?: number; // 定金金额，单位：元
    items?: SaleOrderItem[]; // 销售订单产品明细列表
    // ========== 汽配扩展字段 ==========
    productNames?: string; // 产品信息
    creator?: string;
    creatorName?: string; // 创建人名称
    createTime?: Date | string;
    updater?: string;
    updaterName?: string; // 修改人名称
    updateTime?: Date | string;
    orderType?: number; // 订单类型(1-正式单 2-报价单)
  }

  /** 销售订单项 */
  export interface SaleOrderItem {
    clientRowKey?: string;
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
    packageQty?: number; // 包装数
    pieceCount?: number | string; // 件数（前端展示字段）
    productPurchasePrice?: number; // 采购价（价格遮罩层展示）
    salePrice?: number; // 售价
    lastSalePrice?: number; // 最后一次销售价
    minPrice?: number; // 最低价（价格遮罩层展示）
    referencePrice?: number; // 参考价（价格遮罩层展示）
    retailPrice?: number; // 零售价（价格遮罩层展示）
    lastPurchasePrice?: number; // 最后采购价（价格遮罩层展示）
    grossProfitRate?: number; // 毛利率（价格遮罩层展示）
    backupPrice1?: number; // 备用价1（价格遮罩层展示）
    wholesalePrice?: number; // 批发价（价格遮罩层展示）
    sharePrice?: number; // 股份价（价格遮罩层展示）
    priceVisible?: boolean; // 行级价格是否可见
    productPrice?: number; // 产品单价，单位：元
    totalProductPrice?: number; // 产品总价，单位：元
    count?: number; // 数量
    totalPrice?: number; // 总价，单位：元
    saleCostAmount?: number; // 销售成本金额，单位：元
    saleCostPrice?: number; // 销售成本单价，单位：元
    taxPercent?: number; // 税率，百分比
    taxPrice?: number; // 税额，单位：元
    totalTaxPrice?: number; // 含税总价，单位：元
    remark?: string; // 备注
    stockCount?: number; // 库存数量（显示字段）
    warehouseId?: number; // 仓库编号
    warehouseName?: string; // 仓库名称（显示字段）
    warehouseDeptId?: number; // 仓库所属部门
    warehouseDeptName?: string; // 仓库所属部门名称
    deptId?: number; // 所属部门
    batchNo?: string; // 批次号
    batchNoEnabled?: boolean; // 是否启用批次号
    productWeight?: number; // 产品单重（前端汇总用）
    weight?: number; // 产品单重兼容字段
    totalWeight?: number; // 总重量（前端汇总用）
    // ========== 汽配扩展字段 ==========
    giftFlag?: boolean; // 是否赠品
  }

  export interface SaleOrderItemPageParams extends PageParam {
    orderId: number;
    excludedItemIds?: number[];
    mask?: boolean;
    orderField?: string;
    orderDirection?: 'asc' | 'desc';
  }

  export interface SaleOrderItemMatchReq {
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

  export interface SaleOrderItemMatchResp {
    matches: Array<{ itemId: number; keyIndex: number; pageNo: number }>;
  }

  export interface SaleOrderPageParams extends PageParam {
    productId?: number;
    productKeyword?: string;
    includeItems?: boolean;
    orderField?: string;
    orderDirection?: 'asc' | 'desc';
  }
}

export interface SaleOrderImportResp {
  recordId?: number;
  successCount?: number;
  failureCount?: number;
  documentIds?: number[];
  items?: ErpSaleOrderApi.SaleOrderItem[];
  failureDetails?: Array<{
    rowNo?: number;
    orderNo?: string;
    productCode?: string;
    reason?: string;
  }>;
}

/** 查询销售订单分页 */
export function getSaleOrderPage(params: ErpSaleOrderApi.SaleOrderPageParams) {
  return requestClient.get<PageResult<ErpSaleOrderApi.SaleOrder>>(
    '/erp/sale-order/page',
    { params },
  );
}

export function getSaleOrderDeptSimplePage(params: Partial<PageParam>) {
  return requestClient.get<PageResult<any>>(
    '/erp/sale-order/dept-simple-page',
    {
      params,
    },
  );
}

export function getSaleOrderCustomerDeptSimplePage(
  params: Partial<PageParam> & { customerId?: number },
) {
  return requestClient.get<PageResult<any>>(
    '/erp/sale-order/customer-dept-simple-page',
    { params },
  );
}

export function getSaleOrderUserSimplePage(params: Partial<PageParam>) {
  return requestClient.get<PageResult<any>>(
    '/erp/sale-order/user-simple-page',
    {
      params,
    },
  );
}

/** 查询销售订单详情 */
export function getSaleOrder(
  id: number,
  options: { includeItems?: boolean; mask?: boolean } = {},
) {
  return requestClient.get<ErpSaleOrderApi.SaleOrder>('/erp/sale-order/get', {
    params: {
      id,
      includeItems: options.includeItems,
      mask: options.mask,
    },
  });
}

export function getSaleOrderItemPage(
  params: ErpSaleOrderApi.SaleOrderItemPageParams,
) {
  return requestClient.get<PageResult<ErpSaleOrderApi.SaleOrderItem>>(
    '/erp/sale-order/item-page',
    { params },
  );
}

export function getSaleOrderEditItemPage(
  data: ErpSaleOrderApi.SaleOrderItemPageParams,
) {
  return requestClient.post<PageResult<ErpSaleOrderApi.SaleOrderItem>>(
    '/erp/sale-order/item-page',
    data,
  );
}

export function matchSaleOrderItems(
  data: ErpSaleOrderApi.SaleOrderItemMatchReq,
) {
  return requestClient.post<ErpSaleOrderApi.SaleOrderItemMatchResp>(
    '/erp/sale-order/item-match',
    data,
  );
}

/** 查询销售订单项列表 */
export function getSaleOrderItemListByOrderId(orderId: number) {
  return requestClient.get<ErpSaleOrderApi.SaleOrderItem[]>(
    `/erp/sale-order/item/list-by-order-id?orderId=${orderId}`,
  );
}

/** 新增销售订单 */
export function createSaleOrder(data: ErpSaleOrderApi.SaleOrder) {
  return requestClient.post(
    '/erp/sale-order/create',
    stripErpDocumentTaxFields(data),
  );
}

/** 修改销售订单 */
export function updateSaleOrder(data: ErpSaleOrderApi.SaleOrder) {
  return requestClient.put(
    '/erp/sale-order/update',
    stripErpDocumentTaxFields(data),
  );
}

/** 修改销售订单备注，不受审批状态限制 */
export function updateSaleOrderRemark(data: { id: number; remark: string }) {
  return requestClient.put('/erp/sale-order/update-remark', data);
}

/** 更新销售订单的状态 */
export function updateSaleOrderStatus(id: number, status: number) {
  return requestClient.put('/erp/sale-order/update-status', null, {
    params: { id, status },
  });
}

/** 删除销售订单 */
export function deleteSaleOrder(ids: number[]) {
  return requestClient.delete('/erp/sale-order/delete', {
    params: { ids: ids.join(',') },
  });
}

/** 导出销售订单 Excel */
export function exportSaleOrder(params: any) {
  return requestClient.download('/erp/sale-order/export-excel', { params });
}

export function getSaleOrderExportFields() {
  return requestClient.get<any[]>('/erp/sale-order/export-fields');
}

export function importSaleOrderOrder(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return requestClient.post<SaleOrderImportResp>(
    '/erp/sale-order/import-order',
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } },
  );
}

export function exportSaleOrderOrderImportTemplate() {
  return requestClient.download('/erp/sale-order/get-order-import-template');
}

export function importSaleOrder(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  return requestClient.post<SaleOrderImportResp>(
    '/erp/sale-order/import',
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
    },
  );
}

export function exportSaleOrderImportTemplate() {
  return requestClient.download('/erp/sale-order/export-import-template');
}

export function downloadSaleOrderImportFailureDetails(recordId: number) {
  return requestClient.download(
    '/erp/sale-order/import-failure-details/download',
    {
      params: { recordId },
    },
  );
}
