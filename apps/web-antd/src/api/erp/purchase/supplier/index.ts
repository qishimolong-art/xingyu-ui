import type { PageParam, PageResult } from '@vben/request';

import { requestClient } from '#/api/request';

export type SupplierSimplePageParam = PageParam & {
  keyword?: string;
  name?: string;
};

export namespace ErpSupplierApi {
  /** 供应商信息 */
  export interface Supplier {
    id?: number; // 供应商编号
    name: string; // 供应商名称
    contact: string; // 联系人
    mobile: string; // 手机号码
    telephone: string; // 联系电话
    email: string; // 电子邮箱
    fax: string; // 传真
    remark: string; // 备注
    status: number; // 开启状态
    sort: number; // 排序
    taxNo: string; // 纳税人识别号
    taxPercent?: number; // 税率
    bankName: string; // 开户行
    bankAccount: string; // 开户账号
    bankAddress: string; // 开户地址
    // ========== 汽配扩展字段 ==========
    code?: string; // 编码(自动生成)
    deptId?: number; // 所属部门
    deptIds?: number[]; // 适用部门
    deptName?: string; // 所属部门名称
    deptNames?: string; // 适用部门名称
    createDeptId?: number; // 创建时所在部门
    createDeptName?: string; // 创建时所在部门名称
    allowMultiDept?: boolean; // 允许多部门
    oldCode?: string; // 旧编码
    shortName?: string; // 简称
    foreignName?: string; // 外文名
    region?: string; // 区域
    category?: string; // 往来类别
    account?: string; // 账户
    settleMethod?: string; // 结算方式
    settleLocked?: boolean; // 结算锁定
    supplierType?: string; // 供应商类型
    arrivalCycle?: number; // 到货周期(天)
    purchaseLeadDays?: number; // 采购提前期(天)
    transportMethod?: string; // 运输方式
    freightType?: string; // 运费类型
    wubiCode?: string; // 五笔码
    pinyinCode?: string; // 拼音码
    purchaser?: string;
    purchaserName?: string; // 采购员
    companyNature?: string; // 公司性质
    obsolete?: boolean; // 淘汰
    obsoleteDate?: string; // 淘汰日期
    invoiceType?: string; // 开票类型
    groupSupplier?: boolean; // 集团供应商
    allowBranchOrder?: boolean; // 是否允许分店开单
    logisticsCompany?: string; // 物流公司
    arrivalPoint?: string; // 到货点
    postalCode?: string; // 邮政编码
    memberCode?: string; // 会员编码(自动生成)
    address?: string; // 地址
    areaIds?: string[]; // 省/市/区县（前端级联选择用）
    province?: string; // 省
    city?: string; // 市
    district?: string; // 区/县
    website?: string; // 网址
    legalPerson?: string; // 法定代表
    creditCode?: string; // 统一信用代码
    purchaseControl?: string; // 采购管控
    floatUpdateLastPrice?: string; // 浮动是否更新供应商最后进价
    taxpayerId?: string; // 纳税人识别号(开票)
    invoiceBank?: string; // 开票银行
    invoiceBankAccount?: string; // 开票银行账号
    invoiceAddress?: string; // 开票地址
    invoicePhone?: string; // 开票电话
    invoiceCompany?: string; // 开票单位
    financePhone?: string; // 财务联系电话
    performanceProfitRef?: string; // 绩效考核利润参考依据
    creator?: string; // 创建人
    creatorName?: string; // 创建人名称
    createTime?: string; // 创建时间
    updater?: string; // 修改人
    updaterName?: string; // 修改人名称
    updateTime?: string; // 修改时间
    accountSetName?: string; // 关联账套（列表扩展展示字段）
    creditLimit?: number; // 白条授信额度（列表扩展展示字段）
    businessInfoSynced?: boolean; // 企业匹配是否已同步
  }

  export interface BusinessLicenseOcrReq {
    image: string;
  }

  export interface BusinessLicenseOcrResp {
    success?: boolean;
    message?: string;
    unifiedCreditCode?: string;
    taxNo?: string;
    invoiceCompany?: string;
    invoiceAddress?: string;
    legalPerson?: string;
    companyType?: string;
    registeredCapital?: string;
    establishDate?: string;
    validPeriod?: string;
    businessScope?: string;
    data?: Record<string, any>;
    raw?: Record<string, any>;
  }

  export interface ExportField {
    field: string;
    label: string;
    group?: string;
    groupLabel?: string;
    required?: boolean;
    sort?: number;
  }

  export interface SupplierImportResult {
    recordId?: number;
    successCount?: number;
    failureCount?: number;
    createCount?: number;
    updateCount?: number;
    failureDetails?: Array<Record<string, any> | string>;
  }

  export interface SupplierBatchUpdate {
    ids: number[];
    status?: number;
    deptId?: number;
    deptIds?: number[];
    allowMultiDept?: boolean;
    region?: string;
    supplierType?: string;
    purchaser?: string;
    purchaserName?: string;
    settleMethod?: string;
    remark?: string;
  }

  export interface DeptDistribution {
    id: number;
    name?: string;
    deptId?: number;
    deptName?: string;
    deptIds?: number[];
    deptNames?: string;
    deptNameMap?: Record<number, string>;
    allowMultiDept?: boolean;
  }
}

/** 查询供应商分页 */
export function getSupplierPage(params: PageParam) {
  return requestClient.get<PageResult<ErpSupplierApi.Supplier>>(
    '/erp/supplier/page',
    { params },
  );
}

/** 获得供应商精简列表 */
export function getSupplierSimpleList() {
  return requestClient.get<ErpSupplierApi.Supplier[]>(
    '/erp/supplier/simple-list',
  );
}

/** 查询供应商精简分页 */
function normalizeSupplierSimplePageParams(params: SupplierSimplePageParam) {
  const { keyword, name, ...pageParams } = params;
  const normalizedName = name?.trim() || keyword?.trim();
  return {
    ...pageParams,
    ...(normalizedName ? { name: normalizedName } : {}),
  };
}

export function getSupplierSimplePage(params: SupplierSimplePageParam) {
  return requestClient.get<PageResult<ErpSupplierApi.Supplier>>(
    '/erp/supplier/simple-page',
    { params: normalizeSupplierSimplePageParams(params) },
  );
}

/** 查询供应商详情 */
export function getSupplierDeptSimpleList() {
  return requestClient.get<any[]>('/erp/supplier/dept-simple-list');
}

export function getSupplier(id: number) {
  return requestClient.get<ErpSupplierApi.Supplier>(
    `/erp/supplier/get?id=${id}`,
  );
}

/** 新增供应商 */
export function createSupplier(data: ErpSupplierApi.Supplier) {
  return requestClient.post<number>('/erp/supplier/create', data);
}

export function recognizeSupplierBusinessLicense(
  data: ErpSupplierApi.BusinessLicenseOcrReq,
) {
  return requestClient.post<ErpSupplierApi.BusinessLicenseOcrResp>(
    '/erp/supplier/business-license/recognize',
    data,
  );
}

/** 修改供应商 */
export function updateSupplier(data: ErpSupplierApi.Supplier) {
  return requestClient.put('/erp/supplier/update', data);
}

export function getSupplierDeptDistribution(id: number) {
  return requestClient.get<ErpSupplierApi.DeptDistribution>(
    `/erp/supplier/dept-distribution?id=${id}`,
  );
}

export function updateSupplierDeptDistribution(
  data: ErpSupplierApi.DeptDistribution,
) {
  return requestClient.put('/erp/supplier/dept-distribution', data);
}

/** 批量修改供应商 */
export function batchUpdateSupplier(data: ErpSupplierApi.SupplierBatchUpdate) {
  return requestClient.put('/erp/supplier/batch-update', data);
}

/** 修改供应商状态 */
export function batchDisableSupplier(ids: number[]) {
  return requestClient.put('/erp/supplier/batch-disable', { ids });
}

export function mergeSupplier(data: { keepId: number; sourceId: number }) {
  return requestClient.put('/erp/supplier/merge', data);
}

export function updateSupplierStatus(id: number, status: number) {
  return requestClient.put('/erp/supplier/update-status', null, {
    params: { id, status },
  });
}

/** 删除供应商 */
export function deleteSupplier(id: number) {
  return requestClient.delete(`/erp/supplier/delete?id=${id}`);
}

/** 批量删除供应商 */
export function deleteSupplierList(ids: number[]) {
  return requestClient.delete('/erp/supplier/delete-list', {
    params: { ids: ids.join(',') },
  });
}

/** 导出供应商 Excel */
export function exportSupplier(params: any) {
  return requestClient.download('/erp/supplier/export-excel', { params });
}

export function getSupplierExportFields() {
  return requestClient.get<ErpSupplierApi.ExportField[]>(
    '/erp/supplier/export-fields',
  );
}

export function importSupplier(file: File) {
  const form = new FormData();
  form.append('file', file);
  return requestClient.post<ErpSupplierApi.SupplierImportResult>(
    '/erp/supplier/import',
    form,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
    },
  );
}

export function getSupplierImportTemplate() {
  return requestClient.download('/erp/supplier/get-import-template');
}

export function getSupplierFormDeptPage(
  params: PageParam & { selectedId?: number },
) {
  return requestClient.get<PageResult<Record<string, any>>>(
    '/erp/supplier/form-dept-simple-page',
    { params },
  );
}
export function getSupplierDeptPage(params: PageParam) {
  return requestClient.get<PageResult<Record<string, any>>>(
    '/erp/supplier/dept-simple-page',
    { params },
  );
}
export function getSupplierAssignableUsersPage(params: PageParam) {
  return requestClient.get<PageResult<Record<string, any>>>(
    '/erp/supplier/assignable-users-page',
    { params },
  );
}
export function getSupplierMergePage(params: PageParam) {
  return requestClient.get<PageResult<ErpSupplierApi.Supplier>>(
    '/erp/supplier/merge-simple-page',
    { params },
  );
}
export function downloadSupplierImportFailureDetails(recordId: number) {
  return requestClient.download(
    '/erp/supplier/import-failure-details/download',
    { params: { recordId } },
  );
}

export function getSupplierFormDeptOptions() {
  return requestClient.get<any[]>('/erp/supplier/form-dept-options');
}

export function getSupplierBaseOptionsPage(params: any) {
  return requestClient.get<{ list: any[]; total: number }>(
    '/erp/supplier/base-options-page',
    { params },
  );
}
