import type { PageParam, PageResult } from '@vben/request';

import { requestClient } from '#/api/request';

export namespace ErpSalePriceAdjustApi {
  export interface PriceAdjustPageParams extends PageParam {
    no?: string;
    customerId?: number;
    deptId?: number;
    adjustDate?: Array<Date | number | string>;
    adjustUserId?: number;
    adjustType?: number;
    productId?: number;
    productKeyword?: string;
    includeItems?: boolean;
    remark?: string;
    receiptEnable?: boolean;
    ids?: number[];
    orderField?: string;
    orderDirection?: 'asc' | 'desc';
  }

  export interface PriceAdjustSummary {
    totalOriginalPrice?: number | null;
    totalAdjustedPrice?: number | null;
    totalAdjustPrice?: number | null;
    taxExclusiveAdjustPrice?: number | null;
    taxPrice?: number | null;
  }

  export interface PriceAdjust {
    id?: number;
    no?: string;
    status?: number;
    adjustDate?: Date | number | string;
    customerId?: number;
    customerName?: string;
    deptId?: number;
    deptName?: string;
    adjustUserId?: number;
    adjustUserName?: string;
    adjustType?: number;
    remark?: string;
    totalAdjustPrice?: number;
    receiptPrice?: number;
    settleMethod?: string;
    deliveryMethod?: string;
    logisticsCompany?: string;
    creator?: string;
    creatorName?: string;
    createTime?: Date | number | string;
    updater?: string;
    updaterName?: string;
    updateTime?: Date | number | string;
    sourceNo?: string;
    totalOriginalPrice?: number;
    totalAdjustedPrice?: number;
    taxExclusiveAdjustPrice?: number;
    taxPrice?: number;
    auditorName?: string;
    approveTime?: Date | number | string;
    items?: PriceAdjustItem[];
  }

  export interface PriceAdjustItem {
    clientRowKey?: string;
    id?: number;
    operation?: 'delete' | 'insert' | 'update';
    seq?: number;
    saleOutNo?: string;
    saleOutItemId?: number;
    saleOutId?: number;
    partCode?: string;
    partName?: string;
    vehicleModel?: string;
    originPlace?: string;
    brand?: string;
    unit?: string;
    weight?: number;
    packageQty?: number;
    pieceCount?: number | string;
    outCount?: number;
    stockCount?: number;
    warehouseId?: number;
    warehouseName?: string;
    warehouseDeptId?: number;
    warehouseDeptName?: string;
    batchNo?: string;
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
    oldPrice?: number;
    newPrice?: number;
    adjustPrice?: number;
    productId?: number;
    deptId?: number;
    adjustReason?: string;
    itemRemark?: string;
  }

  export interface PriceAdjustItemPageParams extends PageParam {
    adjustId: number;
    excludedItemIds?: number[];
    mask?: boolean;
    orderField?: string;
    orderDirection?: 'asc' | 'desc';
  }

  export interface PriceAdjustItemMatchReq {
    documentId: number;
    pageSize: number;
    excludedItemIds?: number[];
    keys: Array<{ saleOutId?: number; saleOutItemId?: number }>;
  }

  export interface PriceAdjustItemMatchResp {
    matches: Array<{ itemId: number; keyIndex: number; pageNo: number }>;
  }

  export interface SaleOutItemForAdjust {
    saleOutId?: number;
    saleOutNo?: string;
    outTime?: Date | number | string;
    productId?: number;
    productCode?: string;
    productName?: string;
    vehicleModel?: string;
    originPlace?: string;
    brand?: string;
    unitName?: string;
    weight?: number;
    packageQty?: number;
    count?: number;
    warehouseId?: number;
    warehouseName?: string;
    warehouseDeptId?: number;
    warehouseDeptName?: string;
    batchNo?: string;
    deptId?: number;
    stockCount?: number;
    productPrice?: number;
    saleOutItemId?: number;
    adjusted?: boolean;
  }

  export interface SaleOutItemForAdjustPageParam extends PageParam {
    customerId: number;
    saleOutId?: number;
    excludeAdjusted?: boolean;
    productKeyword?: string;
  }

  export interface PriceAdjustImportResp {
    recordId?: number;
    customerId?: number;
    successCount?: number;
    failureCount?: number;
    items?: PriceAdjustItem[];
    failureDetails?: Array<{
      productCode?: string;
      reason?: string;
      rowNo?: number;
    }>;
  }

  export interface PriceAdjustSettlementSummary {
    id?: number;
    settlementAmount?: number;
    writtenOffAmount?: number;
    unwrittenOffAmount?: number;
    settlementStatus?: number;
  }
}

/** 查询销售调价单分页 */
export function getSalePriceAdjustPage(
  params: ErpSalePriceAdjustApi.PriceAdjustPageParams,
) {
  return requestClient.get<PageResult<ErpSalePriceAdjustApi.PriceAdjust>>(
    '/erp/sale-price-adjust/page',
    { params, timeout: 60_000 },
  );
}

export function getSalePriceAdjustSummary(
  params: Record<string, any>,
  signal?: AbortSignal,
) {
  return requestClient.get<ErpSalePriceAdjustApi.PriceAdjustSummary>(
    '/erp/sale-price-adjust/summary',
    { params, signal, timeout: 30_000 },
  );
}

export function getSalePriceAdjustDeptSimplePage(params: Partial<PageParam>) {
  return requestClient.get<PageResult<any>>(
    '/erp/sale-price-adjust/dept-simple-page',
    { params },
  );
}

export function getSalePriceAdjustCustomerDeptSimplePage(
  params: Partial<PageParam> & { customerId?: number },
) {
  return requestClient.get<PageResult<any>>(
    '/erp/sale-price-adjust/customer-dept-simple-page',
    { params },
  );
}

export function getSalePriceAdjustUserSimplePage(params: Partial<PageParam>) {
  return requestClient.get<PageResult<any>>(
    '/erp/sale-price-adjust/user-simple-page',
    { params },
  );
}

/** 查询销售调价单详情 */
export function getSalePriceAdjust(
  id: number,
  options: { includeItems?: boolean; mask?: boolean } = {},
) {
  return requestClient.get<ErpSalePriceAdjustApi.PriceAdjust>(
    '/erp/sale-price-adjust/get',
    {
      params: {
        id,
        includeItems: options.includeItems,
        mask: options.mask,
      },
    },
  );
}

export function getSalePriceAdjustItemPage(
  params: ErpSalePriceAdjustApi.PriceAdjustItemPageParams,
) {
  return requestClient.get<PageResult<ErpSalePriceAdjustApi.PriceAdjustItem>>(
    '/erp/sale-price-adjust/item-page',
    { params },
  );
}

export function getSalePriceAdjustEditItemPage(
  data: ErpSalePriceAdjustApi.PriceAdjustItemPageParams,
) {
  return requestClient.post<PageResult<ErpSalePriceAdjustApi.PriceAdjustItem>>(
    '/erp/sale-price-adjust/item-page',
    data,
  );
}

export function matchSalePriceAdjustItems(
  data: ErpSalePriceAdjustApi.PriceAdjustItemMatchReq,
) {
  return requestClient.post<ErpSalePriceAdjustApi.PriceAdjustItemMatchResp>(
    '/erp/sale-price-adjust/item-match',
    data,
  );
}

export function getSalePriceAdjustSettlementSummary(id: number) {
  return requestClient.get<ErpSalePriceAdjustApi.PriceAdjustSettlementSummary>(
    '/erp/sale-price-adjust/settlement-summary',
    { params: { id } },
  );
}

/** 新增销售调价单 */
export function createSalePriceAdjust(data: ErpSalePriceAdjustApi.PriceAdjust) {
  return requestClient.post('/erp/sale-price-adjust/create', data);
}

/** 创建销售调价单草稿 */
export function createSalePriceAdjustDraft(
  data: ErpSalePriceAdjustApi.PriceAdjust,
) {
  return requestClient.post('/erp/sale-price-adjust/create-draft', data);
}

/** 修改销售调价单 */
export function updateSalePriceAdjust(data: ErpSalePriceAdjustApi.PriceAdjust) {
  return requestClient.put('/erp/sale-price-adjust/update', data);
}

/** 更新销售调价单草稿 */
export function updateSalePriceAdjustDraft(
  data: ErpSalePriceAdjustApi.PriceAdjust,
) {
  return requestClient.put('/erp/sale-price-adjust/update-draft', data);
}

/** 提交销售调价单草稿，进入未审核状态 */
export function submitSalePriceAdjust(id: number) {
  return requestClient.put('/erp/sale-price-adjust/submit', null, {
    params: { id },
  });
}

/** 修改销售调价单备注，不受审批状态限制 */
export function updateSalePriceAdjustRemark(data: {
  id: number;
  remark: string;
}) {
  return requestClient.put('/erp/sale-price-adjust/update-remark', data);
}

/** 审核销售调价单 */
export function updateSalePriceAdjustStatus(id: number, status: number) {
  return requestClient.put('/erp/sale-price-adjust/update-status', null, {
    params: { id, status },
  });
}

/** 删除销售调价单 */
export function deleteSalePriceAdjust(ids: number[]) {
  return requestClient.delete('/erp/sale-price-adjust/delete', {
    params: { ids: ids.join(',') },
  });
}

/** 获取客户可调价明细（saleOutId 可选，传入时仅返回该销售单的明细） */
export function getAdjustableItemsByCustomerId(
  customerId: number,
  saleOutId?: number,
  excludeAdjusted = true,
) {
  return requestClient.get<ErpSalePriceAdjustApi.SaleOutItemForAdjust[]>(
    '/erp/sale-price-adjust/adjustable-items',
    { params: { customerId, saleOutId, excludeAdjusted } },
  );
}

export function getAdjustableItemPage(
  params: ErpSalePriceAdjustApi.SaleOutItemForAdjustPageParam,
) {
  return requestClient.get<
    PageResult<ErpSalePriceAdjustApi.SaleOutItemForAdjust>
  >('/erp/sale-price-adjust/adjustable-item-page', { params });
}

export function exportSalePriceAdjust(params: any) {
  const exportParams = { ...params };
  if (Array.isArray(exportParams.ids)) {
    exportParams.ids = exportParams.ids.join(',');
  }
  return requestClient.download('/erp/sale-price-adjust/export-excel', {
    params: exportParams,
  });
}

export function getSalePriceAdjustExportFields() {
  return requestClient.get<any[]>('/erp/sale-price-adjust/export-fields');
}

export function importSalePriceAdjust(file: File) {
  return requestClient.upload<ErpSalePriceAdjustApi.PriceAdjustImportResp>(
    '/erp/sale-price-adjust/import',
    { file },
  );
}

/** 销售调价整单导入（列表入口） */
export function importSalePriceAdjustOrder(file: File) {
  return requestClient.upload<ErpSalePriceAdjustApi.PriceAdjustImportResp>(
    '/erp/sale-price-adjust/import-order',
    { file },
  );
}

/** 下载销售调价整单导入模板 */
export function exportSalePriceAdjustOrderImportTemplate() {
  return requestClient.download(
    '/erp/sale-price-adjust/get-order-import-template',
  );
}

export function exportSalePriceAdjustImportTemplate() {
  return requestClient.download('/erp/sale-price-adjust/get-import-template');
}

export function downloadSalePriceAdjustImportFailureDetails(recordId: number) {
  return requestClient.download(
    '/erp/sale-price-adjust/import-failure-details/download',
    { params: { recordId } },
  );
}
