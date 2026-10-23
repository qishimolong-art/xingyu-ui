import type { PageParam, PageResult } from '@vben/request';

import { requestClient } from '#/api/request';

export namespace SystemFormDataPermissionApi {
  export type FieldValueType = 'csv_ids' | 'json_ids' | 'single_id';

  export interface FieldConfig {
    id?: number;
    formType?: string;
    columnName: string;
    columnDesc?: string;
    valueType: FieldValueType;
    enabled: boolean;
  }

  export interface Config {
    id?: number;
    formType: string;
    tableDesc?: string;
    enabled: boolean;
    fieldCount?: number;
    fields?: FieldConfig[];
    createTime?: string;
  }

  export interface CandidateTable {
    formType: string;
    tableDesc?: string;
    configured: boolean;
  }

  export interface CandidateColumn {
    columnName: string;
    columnDesc?: string;
    dataType?: string;
    recommended: boolean;
    valueType?: FieldValueType;
  }
}

export function getFormDataPermissionPage(params: PageParam) {
  return requestClient.get<PageResult<SystemFormDataPermissionApi.Config>>(
    '/system/form-data-permission/page',
    { params },
  );
}

export function getCandidateTables() {
  return requestClient.get<SystemFormDataPermissionApi.CandidateTable[]>(
    '/system/form-data-permission/candidate-tables',
  );
}

export function getCandidateColumns(tableName: string) {
  return requestClient.get<SystemFormDataPermissionApi.CandidateColumn[]>(
    '/system/form-data-permission/candidate-columns',
    { params: { tableName } },
  );
}

export function getFormDataPermissionConfig(formType: string) {
  return requestClient.get<SystemFormDataPermissionApi.Config>(
    `/system/form-data-permission/config/${formType}`,
  );
}

export function saveFormDataPermissionConfig(
  data: SystemFormDataPermissionApi.Config,
) {
  return requestClient.post<boolean>(
    '/system/form-data-permission/config',
    data,
  );
}

export function rebuildFormDataPermission(formType: string) {
  return requestClient.post<boolean>(
    `/system/form-data-permission/rebuild/${formType}`,
  );
}
