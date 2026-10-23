import type { PageParam, PageResult } from '@vben/request';

import { requestClient } from '#/api/request';

export namespace ErpPrintApi {
  export interface Template {
    id?: number | string;
    moduleKey?: string;
    name?: string;
    defaulted?: boolean;
    templateJson?: string;
    paperConfig?: string;
    status?: number;
    createTime?: Date | string;
    updateTime?: Date | string;
  }

  export interface TemplateSave {
    id?: number | string;
    moduleKey: string;
    name: string;
    defaulted?: boolean;
    templateJson: string;
    paperConfig?: string;
    status?: number;
  }

  export interface FieldGroup {
    key: string;
    label: string;
    hint?: string;
    fields?: Field[];
  }

  export interface Field {
    name: string;
    code: string;
    source?: string;
  }

  export interface FieldMetadata {
    moduleKey: string;
    groups?: FieldGroup[];
  }

  export interface PrintRecordCreate {
    moduleKey: string;
    businessId: number;
    businessNo?: string;
    templateId?: number | string;
  }

  export interface CloudPrintTask {
    id?: number;
    reqid?: string;
    bizType?: string;
    bizId?: number;
    bizNo?: string;
    warehouseId?: number;
    warehouseName?: string;
    devid?: string;
    deviceId?: number;
    templateId?: number | string;
    status?: number;
    errorMsg?: string;
    callbackCode?: number;
    callbackMsg?: string;
    submitTime?: string;
    callbackTime?: string;
    queuePosition?: number;
    queueState?: string;
    queueMessage?: string;
  }

  export interface CloudPrintPreviewItem {
    previewItemId: string;
    warehouseId: number;
    warehouseName: string;
    deviceId: number;
    printerName: string;
    copies: number;
    fileName: string;
    pdfSha256: string;
  }

  export interface CloudPrintPreview {
    previewToken: string;
    expiresAt: string;
    items: CloudPrintPreviewItem[];
  }

  export interface CloudPrintDevice {
    id?: number;
    devid?: string;
    devKey?: string;
    nickname?: string;
    devType?: number;
    contentType?: number;
    printWidth?: number;
    printHeight?: number;
    paperType?: number;
    rotate?: number;
    copies?: number;
    deptId?: number;
    deptName?: string;
    defaulted?: boolean;
    status?: number;
    onlineState?: number;
    lastStatusCode?: number;
    lastStatusMessage?: string;
    lastStatusTime?: string;
    queuePaused?: boolean;
    queuePauseReason?: string;
    queuePauseTaskId?: number;
    currentTask?: string;
    currentTaskStatus?: number;
    pendingCount?: number;
    lastCallbackTime?: string;
    remark?: string;
    createTime?: string;
    updateTime?: string;
  }
}

export function getPrintFields(moduleKey: string) {
  return requestClient.get<ErpPrintApi.FieldMetadata>('/erp/print/fields', {
    params: { moduleKey },
  });
}

export function getDefaultPrintTemplate(moduleKey: string) {
  return requestClient.get<ErpPrintApi.Template>(
    '/erp/print/template/default',
    {
      params: { moduleKey },
    },
  );
}

export function getPrintTemplate(id: number | string) {
  return requestClient.get<ErpPrintApi.Template>('/erp/print/template/get', {
    params: { id },
  });
}

export function getPrintTemplateList(moduleKey: string) {
  return requestClient.get<ErpPrintApi.Template[]>('/erp/print/template/list', {
    params: { moduleKey },
  });
}

export function savePrintTemplate(data: ErpPrintApi.TemplateSave) {
  return requestClient.put<number>('/erp/print/template/save', data);
}

export function saveAsPrintTemplate(data: ErpPrintApi.TemplateSave) {
  return requestClient.post<number>('/erp/print/template/save-as', data);
}

export function setDefaultPrintTemplate(id: number | string) {
  return requestClient.post<boolean>('/erp/print/template/set-default', null, {
    params: { id },
  });
}

export function deletePrintTemplate(id: number | string) {
  return requestClient.delete<boolean>('/erp/print/template/delete', {
    params: { id },
  });
}

export function recordPrint(data: ErpPrintApi.PrintRecordCreate) {
  return requestClient.post<boolean>('/erp/print/record', data);
}

export function previewSaleOutCloudPrint(data: {
  copies?: number;
  itemOrderDirection?: 'asc' | 'desc';
  itemOrderField?: string;
  saleOutId: number;
  templateId: number | string;
}) {
  return requestClient.post<ErpPrintApi.CloudPrintPreview>(
    '/erp/cloud-print/task/preview-sale-out',
    data,
  );
}

export function getSaleOutCloudPrintPreviewFile(data: {
  previewItemId: string;
  previewToken: string;
}) {
  return requestClient.download<Blob>(
    '/erp/cloud-print/task/preview-sale-out/file',
    { data, method: 'POST' },
  );
}

export function submitSaleOutCloudPrint(data: { previewToken: string }) {
  return requestClient.post<ErpPrintApi.CloudPrintTask[]>(
    '/erp/cloud-print/task/submit-sale-out',
    data,
  );
}

export function getPrintFontFile(fontFamily: string, weight: 400 | 700) {
  return requestClient.download<Blob>('/erp/print/font/file', {
    params: { fontFamily, weight },
  });
}

export function getSaleOutCloudPrintTasks(saleOutId: number) {
  return requestClient.get<ErpPrintApi.CloudPrintTask[]>(
    '/erp/cloud-print/task/list-by-sale-out',
    { params: { saleOutId } },
  );
}

export function getEnabledCloudPrintDevices() {
  return requestClient.get<ErpPrintApi.CloudPrintDevice[]>(
    '/erp/cloud-print/device/enabled-list',
  );
}

export function getCloudPrintDevicePage(
  params: PageParam & {
    contentType?: number;
    deptId?: number;
    devType?: number;
    keyword?: string;
    onlineState?: number;
    status?: number;
  },
) {
  return requestClient.get<PageResult<ErpPrintApi.CloudPrintDevice>>(
    '/erp/cloud-print/device/page',
    { params },
  );
}

export function getCloudPrintDevice(id: number) {
  return requestClient.get<ErpPrintApi.CloudPrintDevice>(
    '/erp/cloud-print/device/get',
    { params: { id } },
  );
}

export function createCloudPrintDevice(data: ErpPrintApi.CloudPrintDevice) {
  return requestClient.post<number>('/erp/cloud-print/device/create', data);
}

export function updateCloudPrintDevice(data: ErpPrintApi.CloudPrintDevice) {
  return requestClient.put<boolean>('/erp/cloud-print/device/update', data);
}

export function deleteCloudPrintDevice(id: number) {
  return requestClient.delete<boolean>('/erp/cloud-print/device/delete', {
    params: { id },
  });
}

export function updateCloudPrintDeviceStatus(id: number, status: number) {
  return requestClient.put<boolean>(
    '/erp/cloud-print/device/update-status',
    null,
    {
      params: { id, status },
    },
  );
}

export function setDefaultCloudPrintDevice(id: number) {
  return requestClient.put<boolean>(
    '/erp/cloud-print/device/set-default',
    null,
    {
      params: { id },
    },
  );
}

export function refreshCloudPrintDeviceStatus(id: number) {
  return requestClient.post<ErpPrintApi.CloudPrintDevice>(
    '/erp/cloud-print/device/refresh-status',
    null,
    { params: { id } },
  );
}

export function resumeCloudPrintQueue(data: {
  deviceId: number;
  failedTaskAction: 'RETRY' | 'SKIP';
}) {
  return requestClient.post<ErpPrintApi.CloudPrintDevice>(
    '/erp/cloud-print/device/resume-queue',
    data,
  );
}
