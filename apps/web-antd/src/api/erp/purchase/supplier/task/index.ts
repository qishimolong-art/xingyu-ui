import type { PageParam, PageResult } from '@vben/request';

import { requestClient } from '#/api/request';

export namespace ErpSupplierTaskApi {
  export interface SupplierTask {
    id?: number;
    supplierId: number;
    year: number;
    month: number;
    taskLevel?: string;
    taskAmount: number;
    remark?: string;
    createTime?: string;
  }
}

export function getSupplierTaskList(supplierId: number) {
  return requestClient.get<ErpSupplierTaskApi.SupplierTask[]>(
    '/erp/supplier-task/list',
    { params: { supplierId } },
  );
}

export function getSupplierTask(id: number) {
  return requestClient.get<ErpSupplierTaskApi.SupplierTask>(
    `/erp/supplier-task/get?id=${id}`,
  );
}

export function createSupplierTask(data: ErpSupplierTaskApi.SupplierTask) {
  return requestClient.post('/erp/supplier-task/create', data);
}

export function updateSupplierTask(data: ErpSupplierTaskApi.SupplierTask) {
  return requestClient.put('/erp/supplier-task/update', data);
}

export function deleteSupplierTask(id: number) {
  return requestClient.delete(`/erp/supplier-task/delete?id=${id}`);
}

export function getSupplierTaskPage(
  params: PageParam & { supplierId: number },
) {
  return requestClient.get<PageResult<ErpSupplierTaskApi.SupplierTask>>(
    '/erp/supplier-task/page',
    { params },
  );
}
