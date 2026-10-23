import type { PageParam, PageResult } from '@vben/request';

import type { SystemDeptApi } from '#/api/system/dept';

import { requestClient } from '#/api/request';

export namespace ErpWarehouseApi {
  export interface Warehouse {
    id?: number;
    name: string;
    deptId?: number;
    deptName?: string;
    directWarehouse?: boolean;
    displayName?: string;
    address?: string;
    latitude?: number;
    longitude?: number;
    mapName?: string;
    sort?: number;
    remark?: string;
    principal?: string;
    warehousePrice?: null | number | string;
    truckagePrice?: null | number | string;
    status?: number;
    defaultStatus?: boolean;
    warehouseType?: number;
    storageCenterId?: number;
    storageWarehouseId?: number;
    saleEnabled?: boolean;
    purchaseEnabled?: boolean;
    stockBillEnabled?: boolean;
    ecommerceEnabled?: boolean;
    scanControl?: boolean;
    saleBillControl?: boolean;
    zeroStockHide?: boolean;
    goodsToBranch?: string;
    dept?: string;
    warehouseLocation?: string;
    outPacking?: boolean;
    autoOrder?: boolean;
    maxPickCount?: number;
    warehouseCode?: string;
    manualInputCode?: boolean;
    splitOrder?: boolean;
    stockGroupType?: number;
    creditControl?: null | number | string;
    regionId?: number;
    cloudPrintDeviceId?: number;
    branchTenantIds?: number[];
    storageCenterName?: string;
    storageWarehouseName?: string;
    regionName?: string;
    creator?: string;
    creatorName?: string;
    createTime?: Date | number;
    updater?: string;
    updaterName?: string;
    updateTime?: Date | number;
    readonlyBySaleDistribution?: boolean;
  }

  export interface WarehouseImportResult {
    recordId?: number;
    successCount?: number;
    failureCount?: number;
    createCount?: number;
    updateCount?: number;
    failureDetails?: Array<Record<string, any> | string>;
  }

  export interface WarehouseBatchUpdate {
    ids: number[];
    deptId?: number;
    warehouseType?: number;
    status?: number;
    saleEnabled?: boolean;
    purchaseEnabled?: boolean;
    stockBillEnabled?: boolean;
    scanControl?: boolean;
    splitOrder?: boolean;
    sort?: number;
    remark?: string;
  }

  export interface UserWarehousePermissions {
    userId: number;
    warehouseIds: number[];
  }

  export interface WarehouseUserPermissions {
    warehouseId: number;
    userIds: number[];
    selectedUsers?: AssignableUser[];
  }

  export interface WarehousePickerUsers {
    warehouseId: number;
    userIds: number[];
    selectedUsers?: AssignableUser[];
  }

  export interface WarehouseSaleDeptPermissions {
    warehouseId: number;
    scopeType?: WarehouseSaleDeptScopeType;
    deptIds: number[];
  }

  export type WarehouseSaleDeptScopeType = 'ALL' | 'SPECIFIED';

  export interface AssignableUser {
    id?: number;
    nickname?: string;
    status?: number;
    mobile?: string;
    deptId?: number;
  }
}

export function getWarehousePage(
  params: PageParam & { decimalMode?: 'string' },
) {
  return requestClient.get<PageResult<ErpWarehouseApi.Warehouse>>(
    '/erp/warehouse/page',
    { params },
  );
}

export function getWarehouseSimplePage(
  params: PageParam & {
    allSaleProduct?: boolean;
    allSaleProductPermission?: string;
    bizType?: 'purchase' | 'sale' | 'stock' | 'stockMoveFrom';
    deptId?: number;
  },
) {
  return requestClient.get<PageResult<ErpWarehouseApi.Warehouse>>(
    '/erp/warehouse/simple-page',
    { params },
  );
}

export function getWarehouseDeptSimpleList() {
  return requestClient.get<SystemDeptApi.Dept[]>(
    '/erp/warehouse/dept-simple-list',
  );
}

export function getWarehouseDeptSimplePage(params: PageParam) {
  return requestClient.get<PageResult<SystemDeptApi.Dept>>(
    '/erp/warehouse/dept-simple-page',
    { params },
  );
}

export function getWarehouseSimpleList(params?: {
  allSaleProduct?: boolean;
  allSaleProductPermission?: string;
  bizType?: 'purchase' | 'sale' | 'stock' | 'stockMoveFrom';
  deptId?: number;
}) {
  return requestClient.get<ErpWarehouseApi.Warehouse[]>(
    '/erp/warehouse/simple-list',
    { params },
  );
}

export const getPurchaseWarehouseSimpleList = (params?: Record<string, any>) =>
  getWarehouseSimpleList({ bizType: 'purchase', deptId: params?.deptId });

export const getPurchaseWarehouseSimplePage = (params: Partial<PageParam>) =>
  getWarehouseSimplePage({
    pageNo: params.pageNo ?? 1,
    pageSize: params.pageSize ?? 10,
    ...params,
    bizType: 'purchase',
  });

export const getPurchaseWarehouseOwnerDeptSimpleList = () =>
  requestClient.get<SystemDeptApi.Dept[]>(
    '/erp/warehouse/purchase-owner-dept-simple-list',
  );

export const getSaleWarehouseSimpleList = (params?: {
  allSaleProduct?: boolean;
  allSaleProductPermission?: string;
}) => getWarehouseSimpleList({ bizType: 'sale', ...params });

export const getSaleWarehouseSimpleListByDept = (
  deptId: number,
  params?: {
    allSaleProduct?: boolean;
    allSaleProductPermission?: string;
  },
) => getWarehouseSimpleList({ bizType: 'sale', deptId, ...params });

export const getSaleWarehouseSimplePage = (
  params: Partial<PageParam> & {
    allSaleProduct?: boolean;
    allSaleProductPermission?: string;
    deptId?: number;
  },
) =>
  getWarehouseSimplePage({
    pageNo: params.pageNo ?? 1,
    pageSize: params.pageSize ?? 10,
    ...params,
    bizType: 'sale',
  });

export const getSaleWarehouseOwnerDeptSimpleList = (
  deptId: number,
  params?: {
    allSaleProduct?: boolean;
    allSaleProductPermission?: string;
  },
) =>
  requestClient.get<SystemDeptApi.Dept[]>(
    '/erp/warehouse/sale-owner-dept-simple-list',
    {
      params: { deptId, ...params },
    },
  );

export const getSaleWarehouseOwnerDeptSimplePage = (
  params: Partial<PageParam> & {
    allSaleProduct?: boolean;
    allSaleProductPermission?: string;
    deptId?: number;
  },
) =>
  requestClient.get<PageResult<SystemDeptApi.Dept>>(
    '/erp/warehouse/sale-owner-dept-simple-page',
    {
      params: {
        pageNo: params.pageNo ?? 1,
        pageSize: params.pageSize ?? 10,
        ...params,
      },
    },
  );

export const getStockMoveFromWarehouseSimpleList = () =>
  getWarehouseSimpleList({ bizType: 'stockMoveFrom' });

export const getStockMoveFromWarehouseSimplePage = (
  params: Partial<PageParam>,
) =>
  getWarehouseSimplePage({
    pageNo: params.pageNo ?? 1,
    pageSize: params.pageSize ?? 10,
    ...params,
    bizType: 'stockMoveFrom',
  });

export const getStockWarehouseOwnerDeptSimpleList = () =>
  requestClient.get<SystemDeptApi.Dept[]>(
    '/erp/warehouse/stock-owner-dept-simple-list',
  );

export function getStockWarehouseOwnerDeptSimplePage(params: PageParam) {
  return requestClient.get<PageResult<SystemDeptApi.Dept>>(
    '/erp/warehouse/stock-owner-dept-simple-page',
    { params },
  );
}

export function formatStockWarehouseDisplayName(
  warehouse: ErpWarehouseApi.Warehouse,
) {
  if (!warehouse.directWarehouse) {
    return warehouse.name;
  }
  return `【直发仓】${warehouse.deptName || warehouse.name}`;
}

export const getStockWarehouseSimpleList = () =>
  getWarehouseSimpleList({ bizType: 'stock' });

export async function getStockWarehouseFilterOptions() {
  const warehouses = await getWarehouseSimpleList({ bizType: 'stock' });
  return warehouses.map((warehouse) => ({
    ...warehouse,
    displayName: formatStockWarehouseDisplayName(warehouse),
  }));
}

export async function getStockWarehouseFilterOptionPage(params: PageParam) {
  const page = await getWarehouseSimplePage({ ...params, bizType: 'stock' });
  return {
    ...page,
    list: (page.list || []).map((warehouse) => ({
      ...warehouse,
      displayName: formatStockWarehouseDisplayName(warehouse),
    })),
  };
}

export function getWarehouseAssignableList() {
  return requestClient.get<ErpWarehouseApi.Warehouse[]>(
    '/erp/warehouse/assignable-list',
  );
}

export function getWarehouseAssignableUsers() {
  return requestClient.get<ErpWarehouseApi.AssignableUser[]>(
    '/erp/warehouse/assignable-users',
  );
}

export function getUserWarehousePermissions(userId: number) {
  return requestClient.get<ErpWarehouseApi.UserWarehousePermissions>(
    '/erp/warehouse/user-permissions',
    { params: { userId } },
  );
}

export function saveUserWarehousePermissions(
  data: ErpWarehouseApi.UserWarehousePermissions,
) {
  return requestClient.put('/erp/warehouse/user-permissions', data);
}

export function getWarehouseUserPermissions(warehouseId: number) {
  return requestClient.get<ErpWarehouseApi.WarehouseUserPermissions>(
    '/erp/warehouse/warehouse-user-permissions',
    { params: { warehouseId } },
  );
}

export function saveWarehouseUserPermissions(
  data: ErpWarehouseApi.WarehouseUserPermissions,
) {
  return requestClient.put('/erp/warehouse/warehouse-user-permissions', data);
}

export function getWarehousePickerUsers(warehouseId: number) {
  return requestClient.get<ErpWarehouseApi.WarehousePickerUsers>(
    '/erp/warehouse/picker-users',
    { params: { warehouseId } },
  );
}

export function saveWarehousePickerUsers(
  data: ErpWarehouseApi.WarehousePickerUsers,
) {
  return requestClient.put('/erp/warehouse/picker-users', data);
}

export function getWarehouseSaleDeptPermissions(warehouseId: number) {
  return requestClient.get<ErpWarehouseApi.WarehouseSaleDeptPermissions>(
    '/erp/warehouse/sale-dept-permissions',
    { params: { warehouseId } },
  );
}

export function getWarehouseSaleDeptOptions() {
  return requestClient.get<SystemDeptApi.Dept[]>(
    '/erp/warehouse/sale-dept-options',
  );
}

export function saveWarehouseSaleDeptPermissions(
  data: ErpWarehouseApi.WarehouseSaleDeptPermissions,
) {
  return requestClient.put('/erp/warehouse/sale-dept-permissions', data);
}

export function getWarehouse(id: number) {
  return requestClient.get<ErpWarehouseApi.Warehouse>(
    `/erp/warehouse/get?id=${id}`,
  );
}

export function createWarehouse(data: ErpWarehouseApi.Warehouse) {
  return requestClient.post<number>(
    '/erp/warehouse/create',
    withoutLegacyStockBillSetting(data),
  );
}

export function updateWarehouse(data: ErpWarehouseApi.Warehouse) {
  return requestClient.put(
    '/erp/warehouse/update',
    withoutLegacyStockBillSetting(data),
  );
}

export function batchUpdateWarehouse(
  data: ErpWarehouseApi.WarehouseBatchUpdate,
) {
  return requestClient.put(
    '/erp/warehouse/batch-update',
    withoutLegacyStockBillSetting(data),
  );
}

/** 旧领货开关仅用于查看历史；省略写入不代表将原值改为false。 */
export function withoutLegacyStockBillSetting<
  T extends { stockBillEnabled?: boolean },
>(data: T): Omit<T, 'stockBillEnabled'> {
  const payload = { ...data };
  delete payload.stockBillEnabled;
  return payload;
}

export function batchDisableWarehouse(ids: number[]) {
  return requestClient.put('/erp/warehouse/batch-disable', { ids });
}

export function restoreWarehouse(ids: number[]) {
  return requestClient.put('/erp/warehouse/restore', { ids });
}

export function updateWarehouseDefaultStatus(
  id: number,
  defaultStatus: boolean,
) {
  return requestClient.put('/erp/warehouse/update-default-status', null, {
    params: { id, defaultStatus },
  });
}

export function deleteWarehouse(id: number) {
  return requestClient.delete(`/erp/warehouse/delete?id=${id}`);
}

export function deleteWarehouseList(ids: number[]) {
  return requestClient.delete('/erp/warehouse/delete-list', {
    params: { ids: ids.join(',') },
  });
}

export function exportWarehouse(params: any) {
  return requestClient.download('/erp/warehouse/export-excel', { params });
}

export function getWarehouseImportTemplate() {
  return requestClient.download('/erp/warehouse/get-import-template');
}

export function importWarehouse(file: File) {
  return requestClient.upload<ErpWarehouseApi.WarehouseImportResult>(
    '/erp/warehouse/import',
    { file },
  );
}

export function downloadWarehouseImportFailureDetails(recordId: number) {
  return requestClient.download(
    '/erp/warehouse/import-failure-details/download',
    {
      params: { recordId },
    },
  );
}

export function getWarehouseFormDeptSimplePage(
  params: PageParam & { selectedId?: number },
) {
  return requestClient.get<PageResult<SystemDeptApi.Dept>>(
    '/erp/warehouse/form-dept-simple-page',
    { params },
  );
}
export function getWarehouseAssignableUsersPage(params: PageParam) {
  return requestClient.get<PageResult<ErpWarehouseApi.AssignableUser>>(
    '/erp/warehouse/assignable-users-page',
    { params },
  );
}
export function getWarehouseExportFields() {
  return requestClient.get<
    Array<{
      field: string;
      group?: string;
      groupLabel?: string;
      label: string;
      sort?: number;
    }>
  >('/erp/warehouse/export-fields');
}
