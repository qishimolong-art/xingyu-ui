import type { PageParam, PageResult } from '@vben/request';

import { requestClient } from '#/api/request';

export namespace SystemUserApi {
  /** 用户信息 */
  export interface User {
    id?: number;
    username: string;
    nickname: string;
    deptId: number;
    deptIds?: number[];
    roleIds?: number[];
    roleNames?: string;
    dataScope?: number;
    dataScopeDeptIds?: number[];
    email: string;
    mobile: string;
    sex: number;
    avatar: string;
    loginIp: string;
    status: number;
    remark: string;
    createTime?: Date;
  }

  export interface UserImportResp {
    createUsernames: string[];
    updateUsernames: string[];
    failureUsernames: Record<string, string>;
  }

  export interface UserPageParams extends PageParam {
    deptId?: number;
    email?: string;
    mobile?: string;
    nickname?: string;
    orderDirection?: 'asc' | 'desc';
    orderField?: string;
    roleId?: number;
    sex?: number;
    status?: number;
    username?: string;
    dataScope?: number;
  }

  export interface UserBatchUpdateReq {
    ids: number[];
    updateNickname?: boolean;
    nickname?: string;
    updateDeptIds?: boolean;
    deptIds?: number[];
    updateRoleIds?: boolean;
    roleIds?: number[];
    updateEmail?: boolean;
    email?: string;
    updateMobile?: boolean;
    mobile?: string;
    updateSex?: boolean;
    sex?: number;
    updateStatus?: boolean;
    status?: number;
    updateRemark?: boolean;
    remark?: string;
    updateDataScope?: boolean;
    dataScope?: number;
    dataScopeDeptIds?: number[];
    updateWarehousePermissions?: boolean;
    warehousePermissionMode?: 'ADD' | 'REMOVE' | 'REPLACE';
    warehouseIds?: number[];
    updateTenantVisitScope?: boolean;
    tenantVisitScope?: {
      clear?: boolean;
      scopeType?: 'ALL' | 'CUSTOM';
      tenantIds?: number[];
    };
  }
}

/** 查询用户管理列表 */
export function getUserPage(params: SystemUserApi.UserPageParams) {
  return requestClient.get<PageResult<SystemUserApi.User>>(
    '/system/user/page',
    { params },
  );
}

/** 查询用户详情 */
export function getUser(id: number) {
  return requestClient.get<SystemUserApi.User>(`/system/user/get?id=${id}`);
}

/** 新增用户 */
export function createUser(data: SystemUserApi.User) {
  return requestClient.post('/system/user/create', data);
}

/** 修改用户 */
export function updateUser(data: SystemUserApi.User) {
  return requestClient.put('/system/user/update', data);
}

/** 批量修改用户 */
export function updateUserBatch(data: SystemUserApi.UserBatchUpdateReq) {
  return requestClient.put('/system/user/update-batch', data);
}

/** 删除用户 */
export function deleteUser(id: number) {
  return requestClient.delete(`/system/user/delete?id=${id}`);
}

/** 批量删除用户 */
export function deleteUserList(ids: number[]) {
  return requestClient.delete(`/system/user/delete-list?ids=${ids.join(',')}`);
}

/** 导出用户 */
export function exportUser(params: any) {
  return requestClient.download('/system/user/export-excel', { params });
}

/** 下载用户导入模板 */
export function importUserTemplate() {
  return requestClient.download('/system/user/get-import-template');
}

/** 导入用户 */
export function importUser(file: File, updateSupport: boolean) {
  return requestClient.upload<SystemUserApi.UserImportResp>(
    '/system/user/import',
    {
      file,
      updateSupport,
    },
  );
}

/** 用户密码重置 */
export function resetUserPassword(id: number, password: string) {
  return requestClient.put('/system/user/update-password', { id, password });
}

/** 用户状态修改 */
export function updateUserStatus(id: number, status: number) {
  return requestClient.put('/system/user/update-status', { id, status });
}

/** 获取用户精简信息列表 */
export function getSimpleUserList() {
  return requestClient.get<SystemUserApi.User[]>('/system/user/simple-list');
}
