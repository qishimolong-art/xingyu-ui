import { requestClient } from '#/api/request';

export namespace SystemDeptApi {
  /** 部门信息 */
  export interface Dept {
    id?: number;
    name: string;
    parentId?: number;
    status: number;
    sort?: null | number;
    leaderUserId?: null | number;
    phone?: null | string;
    address?: null | string;
    longitude?: null | number;
    latitude?: null | number;
    mapName?: null | string;
    email?: null | string;
    createTime: Date;
    children?: Dept[];
  }

  export interface DeptSort {
    id: number;
    sort: number;
  }

  export interface DeptListParams {
    name?: string;
    leaderUserId?: number;
    leaderUserName?: string;
    orderDirection?: string;
    orderField?: string;
    status?: number;
  }

  export interface DeptImportResp {
    createNames: string[];
    updateNames: string[];
    failureNames: Record<string, string>;
  }

  export interface DeptBatchUpdateReq {
    ids: number[];
    updateParentId?: boolean;
    parentId?: null | number;
    updateLeaderUserId?: boolean;
    leaderUserId?: null | number;
    updateStatus?: boolean;
    status?: number;
  }
}

/** 查询部门（精简)列表 */
export async function getSimpleDeptList() {
  return requestClient.get<SystemDeptApi.Dept[]>('/system/dept/simple-list');
}

export async function getAllSimpleDeptList() {
  return requestClient.get<SystemDeptApi.Dept[]>(
    '/system/dept/all-simple-list',
  );
}

/** 查询部门列表 */
export async function getDeptList(params?: SystemDeptApi.DeptListParams) {
  return requestClient.get('/system/dept/list', { params });
}

/** 查询部门详情 */
export async function exportDept(params?: SystemDeptApi.DeptListParams) {
  return requestClient.download('/system/dept/export-excel', { params });
}

export async function getDept(id: number) {
  return requestClient.get<SystemDeptApi.Dept>(`/system/dept/get?id=${id}`);
}

/** 新增部门 */
export async function createDept(data: SystemDeptApi.Dept) {
  return requestClient.post('/system/dept/create', data);
}

/** 修改部门 */
export async function updateDept(data: SystemDeptApi.Dept) {
  return requestClient.put('/system/dept/update', data);
}

export async function updateDeptSortBatch(data: SystemDeptApi.DeptSort[]) {
  return requestClient.put('/system/dept/update-sort', { items: data });
}

/** 下载部门导入模板 */
export async function importDeptTemplate() {
  return requestClient.download('/system/dept/get-import-template');
}

/** 导入部门 */
export async function importDept(file: File, updateSupport: boolean) {
  return requestClient.upload<SystemDeptApi.DeptImportResp>(
    '/system/dept/import',
    {
      file,
      updateSupport,
    },
  );
}

/** 批量修改部门 */
export async function batchUpdateDept(data: SystemDeptApi.DeptBatchUpdateReq) {
  return requestClient.put('/system/dept/batch-update', data);
}

/** 删除部门 */
export async function deleteDept(id: number) {
  return requestClient.delete(`/system/dept/delete?id=${id}`);
}

/** 批量删除部门 */
export async function deleteDeptList(ids: number[]) {
  return requestClient.delete(`/system/dept/delete-list?ids=${ids.join(',')}`);
}
