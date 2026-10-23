import type { PageParam, PageResult } from '@vben/request';

import { requestClient } from '#/api/request';

type UploadProgressEvent = (progressEvent: unknown) => void;

export namespace ErpSalePickDeliveryApi {
  export interface FileResp {
    id?: number;
    submitId?: number;
    fileUrl?: string;
    fileName?: string;
    fileType?: string;
    sort?: number;
  }

  export interface SubmitItem {
    itemId: number;
    quantity: string;
  }

  export interface SubmitItemResp extends SubmitItem {
    id: number;
    productCode?: string;
    productName?: string;
  }

  export interface SubmitResp {
    quantityDetails?: boolean;
    id?: number;
    type?: number;
    submitUserId?: number;
    submitUserName?: string;
    submitTime?: string;
    itemCount?: number;
    remark?: string;
    files?: FileResp[];
  }

  export interface ItemResp {
    id?: number;
    saleOutItemId?: number;
    warehouseId?: number;
    warehouseName?: string;
    productId?: number;
    productCode?: string;
    productName?: string;
    standard?: string;
    count?: number;
    pickedCount?: string;
    deliveredCount?: string;
    remainingPickCount?: string;
    remainingDeliveryCount?: string;
    availableDeliveryCount?: string;
    warehousePosition?: string;
    packageQty?: number;
    pieceCount?: number | string;
    pickStatus?: number;
    pickUserId?: number;
    pickUserName?: string;
    pickTime?: string;
    deliveryStatus?: number;
    deliveryUserId?: number;
    deliveryUserName?: string;
    deliveryTime?: string;
  }

  export interface PickTask {
    warehouseOperable?: boolean;
    id?: number;
    orderId?: number;
    saleOutId?: number;
    saleOutNo?: string;
    sourceType?: number;
    sourceTypeName?: string;
    sourceId?: number;
    sourceNo?: string;
    displayNo?: string;
    customerId?: number;
    customerName?: string;
    warehouseId?: number;
    warehouseName?: string;
    status?: number;
    totalItemCount?: number;
    pickedItemCount?: number;
    totalPieceCount?: number | string;
    pickProgress?: string;
    latestPickTime?: string;
    completeTime?: string;
    createTime?: string;
    items?: ItemResp[];
    submits?: SubmitResp[];
  }

  export interface DeliveryOrder {
    id?: number;
    orderId?: number;
    saleOutId?: number;
    saleOutNo?: string;
    sourceType?: number;
    sourceId?: number;
    sourceNo?: string;
    displayNo?: string;
    customerId?: number;
    customerName?: string;
    deptId?: number;
    warehouseId?: number;
    warehouseName?: string;
    pickStatus?: number;
    deliveryStatus?: number;
    totalItemCount?: number;
    pickedItemCount?: number;
    deliveredItemCount?: number;
    deliverableItemCount?: number;
    totalPieceCount?: number | string;
    pickProgress?: string;
    deliveryProgress?: string;
    latestPickTime?: string;
    latestDeliveryTime?: string;
    pickCompleteTime?: string;
    deliveryCompleteTime?: string;
    legacyHistoryWarning?: boolean;
    createTime?: string;
    items?: ItemResp[];
    submits?: SubmitResp[];
  }

  export interface PickPageParams extends PageParam {
    ids?: number[];
    saleOutNo?: string;
    sourceType?: number;
    customerId?: number;
    warehouseId?: number;
    status?: number;
    createTime?: string[];
    completeTime?: string[];
  }

  export interface DeliveryPageParams extends PageParam {
    ids?: number[];
    saleOutNo?: string;
    customerId?: number;
    warehouseId?: number;
    pickStatus?: number;
    deliveryStatus?: number;
    createTime?: string[];
    deliveryCompleteTime?: string[];
  }

  export interface SubmitFile {
    fileUrl: string;
    fileName?: string;
    fileType?: string;
  }

  export interface PickSubmitReq {
    taskId: number;
    itemIds?: number[];
    items?: SubmitItem[];
    requestId?: string;
    files: SubmitFile[];
    remark?: string;
  }

  export interface DeliverySubmitReq {
    taskId: number;
    itemIds?: number[];
    items?: SubmitItem[];
    requestId?: string;
    files: SubmitFile[];
    remark?: string;
  }
}

function normalizeExportParams(params: Record<string, any>) {
  const exportParams = { ...params };
  if (Array.isArray(exportParams.ids)) {
    exportParams.ids = exportParams.ids.join(',');
  }
  return exportParams;
}

export function getSalePickPage(params: ErpSalePickDeliveryApi.PickPageParams) {
  return requestClient.get<PageResult<ErpSalePickDeliveryApi.PickTask>>(
    '/erp/sale-pick/page',
    { params },
  );
}

export function getMobileSalePickPage(
  params: ErpSalePickDeliveryApi.PickPageParams,
) {
  return requestClient.get<PageResult<ErpSalePickDeliveryApi.PickTask>>(
    '/erp/sale-pick/mobile/page',
    { params },
  );
}

export function getSalePick(id: number, includeDetail = true) {
  return requestClient.get<ErpSalePickDeliveryApi.PickTask>(
    '/erp/sale-pick/get',
    { params: { id, includeDetail } },
  );
}

export function getMobileSalePick(id: number, includeDetail = true) {
  return requestClient.get<ErpSalePickDeliveryApi.PickTask>(
    '/erp/sale-pick/mobile/get',
    { params: { id, includeDetail } },
  );
}

export function getSalePickItemPage(params: PageParam & { taskId: number }) {
  return requestClient.get<PageResult<ErpSalePickDeliveryApi.ItemResp>>(
    '/erp/sale-pick/item-page',
    { params },
  );
}

export function getMobileSalePickItemPage(
  params: PageParam & { taskId: number },
) {
  return requestClient.get<PageResult<ErpSalePickDeliveryApi.ItemResp>>(
    '/erp/sale-pick/mobile/item-page',
    { params },
  );
}

export function getSalePickSubmitPage(params: PageParam & { taskId: number }) {
  return requestClient.get<PageResult<ErpSalePickDeliveryApi.SubmitResp>>(
    '/erp/sale-pick/submit-page',
    { params },
  );
}

export function getMobileSalePickSubmitPage(
  params: PageParam & { taskId: number },
) {
  return requestClient.get<PageResult<ErpSalePickDeliveryApi.SubmitResp>>(
    '/erp/sale-pick/mobile/submit-page',
    { params },
  );
}

export function exportSalePick(params: Record<string, any>) {
  return requestClient.download('/erp/sale-pick/export-excel', {
    params: normalizeExportParams(params),
  });
}

export function submitSalePick(data: ErpSalePickDeliveryApi.PickSubmitReq) {
  return requestClient.post('/erp/sale-pick/mobile/submit', data);
}

export function uploadSalePickVoucher(
  file: File,
  onUploadProgress?: UploadProgressEvent,
) {
  return requestClient.upload<string>(
    '/erp/sale-pick/mobile/upload-voucher',
    { file },
    { onUploadProgress },
  );
}

export function getSaleDeliveryPage(
  params: ErpSalePickDeliveryApi.DeliveryPageParams,
) {
  return requestClient.get<PageResult<ErpSalePickDeliveryApi.DeliveryOrder>>(
    '/erp/sale-delivery/page',
    { params },
  );
}

export function getMobileSaleDeliveryPage(
  params: ErpSalePickDeliveryApi.DeliveryPageParams,
) {
  return requestClient.get<PageResult<ErpSalePickDeliveryApi.DeliveryOrder>>(
    '/erp/sale-delivery/mobile/page',
    { params },
  );
}

export function getSaleDelivery(id: number, includeDetail = true) {
  return requestClient.get<ErpSalePickDeliveryApi.DeliveryOrder>(
    '/erp/sale-delivery/get',
    { params: { id, includeDetail } },
  );
}

export function getMobileSaleDelivery(id: number, includeDetail = true) {
  return requestClient.get<ErpSalePickDeliveryApi.DeliveryOrder>(
    '/erp/sale-delivery/mobile/get',
    { params: { id, includeDetail } },
  );
}

export function getSaleDeliveryItemPage(
  params: PageParam & { taskId: number },
) {
  return requestClient.get<PageResult<ErpSalePickDeliveryApi.ItemResp>>(
    '/erp/sale-delivery/item-page',
    { params },
  );
}

export function getMobileSaleDeliveryItemPage(
  params: PageParam & { taskId: number },
) {
  return requestClient.get<PageResult<ErpSalePickDeliveryApi.ItemResp>>(
    '/erp/sale-delivery/mobile/item-page',
    { params },
  );
}

export function getSaleDeliverySubmitPage(
  params: PageParam & { taskId: number },
) {
  return requestClient.get<PageResult<ErpSalePickDeliveryApi.SubmitResp>>(
    '/erp/sale-delivery/submit-page',
    { params },
  );
}

export function getMobileSaleDeliverySubmitPage(
  params: PageParam & { taskId: number },
) {
  return requestClient.get<PageResult<ErpSalePickDeliveryApi.SubmitResp>>(
    '/erp/sale-delivery/mobile/submit-page',
    { params },
  );
}

export function exportSaleDelivery(params: Record<string, any>) {
  return requestClient.download('/erp/sale-delivery/export-excel', {
    params: normalizeExportParams(params),
  });
}

export function submitSaleDelivery(
  data: ErpSalePickDeliveryApi.DeliverySubmitReq,
) {
  return requestClient.post('/erp/sale-delivery/mobile/submit', data);
}

export function uploadSaleDeliveryVoucher(
  file: File,
  onUploadProgress?: UploadProgressEvent,
) {
  return requestClient.upload<string>(
    '/erp/sale-delivery/mobile/upload-voucher',
    { file },
    { onUploadProgress },
  );
}

export function getSaleSubmitItemPage(
  kind: 'delivery' | 'pick',
  params: PageParam & { parentId: number; submitId: number },
) {
  return requestClient.get<PageResult<ErpSalePickDeliveryApi.SubmitItemResp>>(
    `/erp/sale-${kind}/submit-item-page`,
    { params },
  );
}
