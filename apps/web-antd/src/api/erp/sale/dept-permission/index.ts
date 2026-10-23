import { requestClient } from '#/api/request';

export namespace ErpSaleDeptPermissionApi {
  export interface ForbiddenDept {
    deptId: number;
    deptName?: string;
  }

  export interface ForbiddenDeptSaveReq {
    deptIds: number[];
  }
}

export function getSaleDirectForbiddenDepts() {
  return requestClient.get<ErpSaleDeptPermissionApi.ForbiddenDept[]>(
    '/erp/sale-dept-permission/forbidden-depts',
  );
}

export function saveSaleDirectForbiddenDepts(
  data: ErpSaleDeptPermissionApi.ForbiddenDeptSaveReq,
) {
  return requestClient.put('/erp/sale-dept-permission/forbidden-depts', data);
}
