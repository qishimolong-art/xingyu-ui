import { requestClient } from '#/api/request';

export interface RoleFormDataScope {
  roleId: number;
  formKey: string;
  dataScope: number;
  dataScopeDeptIds?: number[];
}

export function getRoleFormDataScopes(roleId: number) {
  return requestClient.get<RoleFormDataScope[]>(
    '/system/permission/list-role-form-data-scopes',
    { params: { roleId } },
  );
}

export function assignRoleFormDataScope(data: RoleFormDataScope) {
  return requestClient.post(
    '/system/permission/assign-role-form-data-scope',
    data,
  );
}
