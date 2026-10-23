import type { PageParam, PageResult } from '@vben/request';

import { requestClient } from '#/api/request';

export namespace ErpSaleConfigApi {
  export interface SaleConfig {
    id?: number;
    configType?: string;
    code?: string;
    name?: string;
    configValue?: string;
    status?: number;
    deptId?: number;
    deptName?: string;
    sort?: number;
    remark?: string;
    createTime?: Date | string;
  }
}

export function getSaleConfigPage(
  params: PageParam & {
    code?: string;
    configType?: string;
    name?: string;
    status?: number;
    deptId?: number;
  },
) {
  return requestClient.get<PageResult<ErpSaleConfigApi.SaleConfig>>(
    '/erp/sale-config/page',
    { params },
  );
}

export function getSaleConfig(id: number) {
  return requestClient.get<ErpSaleConfigApi.SaleConfig>(
    `/erp/sale-config/get?id=${id}`,
  );
}

export function createSaleConfig(data: ErpSaleConfigApi.SaleConfig) {
  return requestClient.post('/erp/sale-config/create', data);
}

export function updateSaleConfig(data: ErpSaleConfigApi.SaleConfig) {
  return requestClient.put('/erp/sale-config/update', data);
}

export function deleteSaleConfig(ids: number[]) {
  return requestClient.delete('/erp/sale-config/delete', {
    params: { ids: ids.join(',') },
  });
}

export function getSaleConfigSimpleList(configType: string, status?: number) {
  return requestClient.get<ErpSaleConfigApi.SaleConfig[]>(
    '/erp/sale-config/simple-list',
    { params: { configType, status } },
  );
}
