import type { PageParam, PageResult } from '@vben/request';

import { requestClient } from '#/api/request';

export namespace ErpAssemblyOrderApi {
  export const STATUS_DRAFT = 10;
  export const STATUS_CONFIRMED = 15;
  export const STATUS_ASSEMBLING = 18;
  export const STATUS_COMPLETED = 20;
  export const STATUS_LEGACY_VOIDED = 30;

  export interface OrderItem {
    id?: number;
    orderId?: number;
    recipeItemId: number;
    productId?: number;
    quantityPerSet?: number;
    requiredQuantity?: number;
    batchNo?: string;
    consumeQuantity: number;
    costPrice?: number;
    costAmount?: number;
    productCode?: string;
    productName?: string;
    productStandard?: string;
    productUnitName?: string;
    productFactoryCode?: string;
    productDrawingNo?: string;
    productOriginPlace?: string;
    productBrand?: string;
    productVehicleModel?: string;
    productFeatureCode?: string;
    productSupplierName?: string;
    productRetailPrice?: number;
    stockCount?: number;
    occupiedCount?: number;
    shortageCount?: number;
    batchNoEnabled?: boolean;
    sort?: number;
    remark?: string;
  }

  export interface StockBatchNo {
    batchNo: string;
    availableCount: number;
    firstInTime?: string;
  }

  export interface Order {
    id?: number;
    no?: string;
    recipeId?: number;
    recipeVersion?: number;
    recipeModuleCode?: string;
    recipeModuleName?: string;
    productId?: number;
    customerId?: number;
    customerName?: string;
    handlerId?: number;
    handlerName?: string;
    setCount: number;
    warehouseId?: number;
    outWarehouseId?: number;
    warehouseMoveId?: number;
    warehouseMoveNo?: string;
    warehouseMoveStatus?: number;
    deptId?: number;
    shelf?: string;
    assemblyTime?: string;
    finishedBatchNo?: string;
    laborCostPerSet?: number;
    otherCost?: number;
    materialCost?: number;
    laborCost?: number;
    totalCost?: number;
    unitCost?: number;
    status?: number;
    executionRevision?: number;
    confirmUserId?: number;
    confirmUserName?: string;
    confirmTime?: number | string;
    reverseConfirmUserId?: number;
    reverseConfirmUserName?: string;
    reverseConfirmTime?: number | string;
    startUserId?: number;
    startUserName?: string;
    startTime?: number | string;
    cancelStartUserId?: number;
    cancelStartUserName?: string;
    cancelStartTime?: number | string;
    completeUserId?: number;
    completeUserName?: string;
    completeTime?: number | string;
    reverseAssemblyUserId?: number;
    reverseAssemblyUserName?: string;
    reverseAssemblyTime?: number | string;
    voidUserId?: number;
    voidUserName?: string;
    voidTime?: number | string;
    voidReason?: string;
    remark?: string;
    createTime?: number | string;
    creator?: string;
    creatorName?: string;
    updater?: string;
    updaterName?: string;
    updateTime?: number | string;
    itemCount?: number;
    productCode?: string;
    productName?: string;
    productFactoryCode?: string;
    productStandard?: string;
    productUnitName?: string;
    productDrawingNo?: string;
    productOriginPlace?: string;
    productFeatureCode?: string;
    productBrand?: string;
    productVehicleModel?: string;
    productRetailPrice?: number;
    productShelf?: string;
    batchNoEnabled?: boolean;
    warehouseName?: string;
    outWarehouseName?: string;
    printCount?: number;
    printTime?: number | string;
    items?: OrderItem[];
  }

  export interface OrderPageReq extends PageParam {
    keyword?: string;
    warehouseId?: number;
    status?: number;
    assemblyTime?: [string, string];
  }

  export interface OrderItemPageReq extends PageParam {
    orderId: number;
  }

  export interface AvailabilityItem {
    productId: number;
    quantityPerSet: number;
    stockCount: number;
    occupiedCount: number;
    availableCount: number;
    maxAssemblableCount: number;
    shelf?: string;
  }

  export interface Availability {
    maxAssemblableCount: number;
    items: AvailabilityItem[];
  }
}

export function getAssemblyOrderPage(params: ErpAssemblyOrderApi.OrderPageReq) {
  return requestClient.get<PageResult<ErpAssemblyOrderApi.Order>>(
    '/erp/assembly-order/page',
    { params },
  );
}

export function getAssemblyOrder(id: number, includeItems = true) {
  return requestClient.get<ErpAssemblyOrderApi.Order>(
    '/erp/assembly-order/get',
    {
      params: { id, includeItems },
    },
  );
}

export function getAssemblyOrderItemPage(
  params: ErpAssemblyOrderApi.OrderItemPageReq,
) {
  return requestClient.get<PageResult<ErpAssemblyOrderApi.OrderItem>>(
    '/erp/assembly-order/item-page',
    { params },
  );
}

export function getAssemblyComponentBatchNoList(params: {
  productId: number;
  warehouseId: number;
}) {
  return requestClient.get<ErpAssemblyOrderApi.StockBatchNo[]>(
    '/erp/assembly-order/component-batch-nos',
    { params },
  );
}

export function getAssemblyAvailability(params: {
  recipeId: number;
  warehouseId: number;
}) {
  return requestClient.get<ErpAssemblyOrderApi.Availability>(
    '/erp/assembly-order/availability',
    { params },
  );
}

export function getAssemblyOrderUserSimplePage(params: PageParam) {
  return requestClient.get<PageResult<any>>(
    '/erp/assembly-order/user-simple-page',
    { params },
  );
}

export function createAssemblyOrderDraft(data: ErpAssemblyOrderApi.Order) {
  return requestClient.post<number>('/erp/assembly-order/create-draft', data);
}

export function updateAssemblyOrderDraft(data: ErpAssemblyOrderApi.Order) {
  return requestClient.put('/erp/assembly-order/update-draft', data);
}

export function confirmAssemblyOrder(id: number) {
  return requestClient.put('/erp/assembly-order/confirm', undefined, {
    params: { id },
  });
}

export function reverseConfirmAssemblyOrder(id: number) {
  return requestClient.put('/erp/assembly-order/reverse-confirm', undefined, {
    params: { id },
  });
}

export function startAssemblyOrder(id: number) {
  return requestClient.put('/erp/assembly-order/start', undefined, {
    params: { id },
  });
}

export function cancelStartAssemblyOrder(id: number) {
  return requestClient.put('/erp/assembly-order/cancel-start', undefined, {
    params: { id },
  });
}

export function completeAssemblyOrder(id: number) {
  return requestClient.put('/erp/assembly-order/complete', undefined, {
    params: { id },
  });
}

export function reverseAssemblyOrder(id: number) {
  return requestClient.put('/erp/assembly-order/reverse-assembly', undefined, {
    params: { id },
  });
}

export function deleteAssemblyOrder(id: number) {
  return requestClient.delete('/erp/assembly-order/delete', { params: { id } });
}

export function exportAssemblyOrder(id: number) {
  return requestClient.download('/erp/assembly-order/export-excel', {
    params: { id },
  });
}

export function recordAssemblyOrderPrint(id: number) {
  return requestClient.post('/erp/assembly-order/record-print', undefined, {
    params: { id },
  });
}
