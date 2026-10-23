import { requestClient } from '#/api/request';

export interface FieldDefinition {
  id: number;
  module: string;
  fieldKey: string;
  fieldLabel: string;
  fieldGroup?: string;
  sort: number;
}

export interface RoleFieldPermissionResult {
  definitions: FieldDefinition[];
  hiddenFieldIds: number[];
}

export function getRoleFieldPermissions(roleId: number, module: string) {
  return requestClient.get<RoleFieldPermissionResult>(
    '/system/permission/list-role-fields',
    { params: { roleId, module } },
  );
}

export function assignRoleFieldPermission(data: {
  hiddenFieldIds: number[];
  module: string;
  roleId: number;
}) {
  return requestClient.put(
    '/system/permission/assign-role-field-permission',
    data,
  );
}

export function getCurrentUserHiddenFields(
  module: string,
  businessDeptId?: number | string | null,
  includeProductPricePermission?: boolean,
  customerPriceLevel?: number | string | null,
) {
  return requestClient.get<string[]>(
    '/system/permission/get-current-user-hidden-fields',
    {
      params: {
        module,
        ...(businessDeptId == null || businessDeptId === ''
          ? {}
          : { businessDeptId }),
        ...(includeProductPricePermission === undefined
          ? {}
          : { includeProductPricePermission }),
        ...(customerPriceLevel == null || customerPriceLevel === ''
          ? {}
          : { customerPriceLevel }),
      },
    },
  );
}
