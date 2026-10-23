import { requestClient } from '#/api/request';

export namespace SystemUserPriceFieldApi {
  /** 单条价格字段配置 */
  export interface UserPriceField {
    id?: number;
    userId: number;
    priceFieldCode: string;
    priceFieldLabel?: string;
    sort?: number;
    visible: boolean;
  }

  /** 保存请求 */
  export interface SaveReq {
    userId: number;
    /** 设为可见的字段编码列表 */
    fieldCodes: string[];
  }
}

/** 查询用户价格字段配置 */
export function getUserPriceFields(userId: number) {
  return requestClient.get<SystemUserPriceFieldApi.UserPriceField[]>(
    '/system/user/price-fields',
    { params: { userId } },
  );
}

/** 保存用户价格字段配置 */
export function saveUserPriceFields(data: SystemUserPriceFieldApi.SaveReq) {
  return requestClient.put('/system/user/price-fields', data);
}

export namespace SystemUserRolePermissionApi {
  export interface RoleInfo {
    code?: string;
    id: number;
    managed?: boolean;
    name: string;
  }
  export interface PermissionInfo {
    code: string;
    name: string;
    checked?: boolean;
    roleGranted?: boolean;
    denied?: boolean;
  }
  export interface RolePermissionResp {
    roleInfos: RoleInfo[];
    allRoles: RoleInfo[];
    permissions: PermissionInfo[];
  }
  export interface SaveRoleReq {
    userId: number;
    roleIds: number[];
    deniedPermissions: string[];
    tenantVisitScope?: TenantVisitScopeSave;
  }
  export interface TenantVisitScopeSave {
    clear?: boolean;
    scopeType?: 'ALL' | 'CUSTOM';
    tenantIds?: number[];
  }
  export interface TenantVisitOption {
    id: number;
    name: string;
    available: boolean;
    unavailableReason?: string;
  }
  export interface TenantVisitScopeResp {
    configured: boolean;
    scopeType?: 'ALL' | 'CUSTOM';
    tenantIds: number[];
    tenantOptions: TenantVisitOption[];
  }
}

/** 获取用户角色及聚合按钮权限 */
export function getUserRolePermissions(userId: number) {
  return requestClient.get<SystemUserRolePermissionApi.RolePermissionResp>(
    '/system/user/role-permissions',
    { params: { userId } },
  );
}

/** 保存用户角色 */
export function saveUserRolePermissions(
  data: SystemUserRolePermissionApi.SaveRoleReq,
) {
  return requestClient.put('/system/user/role-permissions', data);
}

/** 获取用户的租户访问范围 */
export function getUserTenantVisitScope(userId: number) {
  return requestClient.get<SystemUserRolePermissionApi.TenantVisitScopeResp>(
    '/system/user/tenant-visit-scope',
    { params: { userId } },
  );
}
