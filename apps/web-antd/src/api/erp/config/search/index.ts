import { requestClient } from '#/api/request';

export namespace ErpSearchFieldConfigApi {
  export interface SearchFieldConfig {
    id?: number;
    moduleKey: string;
    fieldName: string;
    fieldLabel?: string;
    component?: string;
    enabled?: boolean;
    sort?: number;
    creator?: string;
    createTime?: Date | string;
  }

  export interface BatchUpdateReq {
    moduleKey: string;
    items: Array<{
      component?: string;
      enabled?: boolean;
      fieldLabel?: string;
      fieldName: string;
      sort?: number;
    }>;
  }

  export interface Module {
    key: string;
    name: string;
  }
}

export function getSearchFieldConfigList(moduleKey: string) {
  return requestClient.get<ErpSearchFieldConfigApi.SearchFieldConfig[]>(
    '/erp/search-field-config/list',
    { params: { moduleKey } },
  );
}

export function getRuntimeSearchFieldConfigList(moduleKey: string) {
  return requestClient.get<ErpSearchFieldConfigApi.SearchFieldConfig[]>(
    '/erp/search-field-config/runtime-enabled-list',
    { params: { moduleKey } },
  );
}

export function batchUpdateSearchFieldConfig(
  data: ErpSearchFieldConfigApi.BatchUpdateReq,
) {
  return requestClient.put('/erp/search-field-config/batch-update', data);
}

export function resetSearchFieldConfig(moduleKey: string) {
  return requestClient.put('/erp/search-field-config/reset', null, {
    params: { moduleKey },
  });
}

export function getSearchFieldConfigModules() {
  return requestClient.get<ErpSearchFieldConfigApi.Module[]>(
    '/erp/search-field-config/modules',
  );
}
