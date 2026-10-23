import { requestClient } from '#/api/request';

export namespace DeptPriceFieldApi {
  export interface Department {
    id: number;
    name: string;
    parentId: number;
    sort?: number;
    status: number;
  }

  export interface Field {
    configured: boolean;
    deptIds: number[];
    fieldKey: string;
    fieldLabel: string;
    sort: number;
  }

  export interface Config {
    configVersion: string;
    departments: Department[];
    fields: Field[];
  }

  export interface UpdateItem {
    deptIds: number[];
    fieldKey: string;
  }

  export interface UpdateReq {
    configVersion: string;
    items: UpdateItem[];
  }
}

export function getDeptPriceFieldConfig() {
  return requestClient.get<DeptPriceFieldApi.Config>(
    '/system/dept-price-field/get-config',
  );
}

export function updateDeptPriceFieldConfig(data: DeptPriceFieldApi.UpdateReq) {
  return requestClient.put('/system/dept-price-field/update-config', data);
}
