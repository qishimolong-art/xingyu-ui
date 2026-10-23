import type { PageParam, PageResult } from '@vben/request';

import { requestClient } from '#/api/request';

export type CustomerSimplePageParam = PageParam & {
  keyword?: string;
  name?: string;
};

export namespace ErpCustomerApi {
  export interface Customer {
    routeName?: string;
    areaName?: string;
    customerTypeName?: string;
    settleMethodName?: string;
    saleUserName?: string;
    developerUserName?: string;
    creatorName?: string;
    updaterName?: string;
    id?: number;
    code?: string;
    name: string;
    shortName?: string;
    relationType?: null | number;
    areaId?: number;
    customerType?: number;
    groupCustomer?: boolean;
    enterpriseMatchStatus?: number;
    businessInfoSynced?: boolean;
    contact?: string;
    mobile?: string;
    telephone?: string;
    email?: string;
    financeTelephone?: string;
    addressAreaId?: number;
    address?: string;
    detailAddress?: string;
    postCode?: string;
    remark?: string;
    status?: number;
    sort?: number;
    taxNo?: string;
    accountName?: string;
    settleMethod?: null | number;
    settleLocked?: boolean;
    invoiceType?: number;
    minOrderAmount?: number;
    freightType?: number;
    commissionRate?: number;
    commissionEnabled?: boolean;
    taxPercent?: number;
    bankName?: string;
    bankAccount?: string;
    bankAddress?: string;
    unifiedCreditCode?: string;
    invoiceBankName?: string;
    invoiceBankAccount?: string;
    invoiceAddress?: string;
    invoiceTelephone?: string;
    invoiceCompany?: string;
    saleUserId?: number;
    developerUserId?: number;
    deptId?: number;
    deptIds?: number[];
    deptName?: string;
    deptNames?: string;
    allowMultiDept?: boolean;
    priceLevel?: number;
    priceLocked?: boolean;
    logistics?: boolean;
    transportMethod?: number;
    routeId?: number;
    freightExplainId?: number;
    wubiCode?: string;
    pinyinCode?: string;
    memberCode?: string;
    platformCode?: string;
    creditLimit?: number;
    creditEnabled?: boolean;
    creditTermDays?: number;
    earliestUnpaidDate?: string;
    debtDays?: number;
    creditAmountExceeded?: boolean;
    creditTermExceeded?: boolean;
    creditBlocked?: boolean;
    creditBlockedReason?: string;
    disabled?: boolean;
    dataCenterAuditStatus?: number;
    lastSaleDate?: string;
    totalSaleAmount?: number;
    receivableBalance?: number;
    createTime?: string;
  }

  export interface CustomerImportResult {
    recordId?: number;
    successCount?: number;
    failureCount?: number;
    createCount?: number;
    updateCount?: number;
    failureDetails?: Array<Record<string, any> | string>;
  }

  export interface CustomerContact {
    id?: number;
    customerId: number;
    name: string;
    mobile?: string;
    telephone?: string;
    email?: string;
    position?: string;
    wechat?: string;
    qq?: string;
    address?: string;
    primaryContact?: boolean;
    receiverContact?: boolean;
    settleContact?: boolean;
    messageContact?: boolean;
    businessCardFrontUrl?: string;
    businessCardBackUrl?: string;
    status?: number;
    salesperson?: boolean;
    gender?: number;
    companyId?: number;
    fax?: string;
    deptId?: number;
    importance?: number;
    commissionRate?: number;
    fixedCommission?: boolean;
    postCode?: string;
    birthday?: string;
    lastContactTime?: string;
    remark?: string;
    createTime?: string;
  }

  export interface CustomerContract {
    id?: number;
    customerId: number;
    contractNo?: string;
    contractDate?: string;
    contractType?: string;
    startTime?: string;
    endTime?: string;
    settleMethod?: string;
    transportMethod?: string;
    baseAmount?: number;
    taskAmount?: number;
    attachmentUrl?: string;
    mainContract?: boolean;
    rebateEnabled?: boolean;
    freightSettleMethod?: number;
    summary?: string;
    status?: number;
    remark?: string;
    createTime?: string;
  }

  export interface CustomerImage {
    id?: number;
    customerId: number;
    imageType?: string;
    imageName?: string;
    imageUrl: string;
    defaulted?: boolean;
    sort?: number;
    remark?: string;
    createTime?: string;
  }

  export interface CustomerTask {
    id?: number;
    customerId: number;
    year: number;
    month?: number;
    taskLevel?: string;
    taskAmount?: number;
    remark?: string;
    createTime?: string;
  }

  export interface CustomerArea {
    id?: number;
    customerId: number;
    longitude?: number;
    latitude?: number;
    mapAddress?: string;
    detailAddress?: string;
    defaulted?: boolean;
    remark?: string;
    createTime?: string;
  }

  export interface CustomerExtend {
    id?: number;
    customerId: number;
    extendKey: string;
    extendName?: string;
    extendValue?: string;
    extendType?: string;
    sort?: number;
    remark?: string;
    createTime?: string;
  }

  export interface CustomerBusinessInfo {
    id?: number;
    customerId: number;
    creditCode?: string;
    legalPerson?: string;
    registeredCapital?: string;
    establishDate?: string;
    businessStatus?: string;
    businessScope?: string;
    rawData?: string;
    remark?: string;
    createTime?: string;
  }

  export interface CustomerMember {
    id?: number;
    customerId: number;
    customerName?: string;
    memberUserId: number;
    memberNickname?: string;
    mobile?: string;
    status?: number;
    remark?: string;
    createTime?: string;
    updateTime?: string;
  }

  export interface CustomerMemberCreateReq {
    customerId: number;
    memberUserId: number;
    remark?: string;
  }

  export interface CustomerMemberUpdateStatusReq {
    id: number;
    status: number;
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

  export interface SaleDept {
    id: number;
    name: string;
    parentId?: number;
    children?: SaleDept[];
  }

  export interface CustomerDeptCreditItem {
    id?: number;
    deptId: number;
    deptName?: string;
    creditEnabled?: boolean;
    creditLimit?: number;
    creditTermDays?: number;
    remark?: string;
  }

  export interface CustomerDeptCredit {
    id: number;
    name?: string;
    deptId?: number;
    deptIds?: number[];
    deptNameMap?: Record<number, string>;
    items?: CustomerDeptCreditItem[];
  }
}

export function getCustomerPage(params: PageParam) {
  return requestClient.get<PageResult<ErpCustomerApi.Customer>>(
    '/erp/customer/page',
    { params },
  );
}

export function getCustomerSimpleList() {
  return requestClient.get<ErpCustomerApi.Customer[]>(
    '/erp/customer/simple-list',
  );
}

function normalizeCustomerSimplePageParams(params: CustomerSimplePageParam) {
  const { keyword, name, ...pageParams } = params;
  const normalizedName = name?.trim() || keyword?.trim();
  return {
    ...pageParams,
    ...(normalizedName ? { name: normalizedName } : {}),
  };
}

export function getCustomerSimplePage(params: CustomerSimplePageParam) {
  return requestClient.get<PageResult<ErpCustomerApi.Customer>>(
    '/erp/customer/simple-page',
    { params: normalizeCustomerSimplePageParams(params) },
  );
}

export function getSaleCustomerSimpleList() {
  return requestClient.get<ErpCustomerApi.Customer[]>(
    '/erp/customer/sale-simple-list',
  );
}

export function getSaleCustomerSimplePage(params: CustomerSimplePageParam) {
  return requestClient.get<PageResult<ErpCustomerApi.Customer>>(
    '/erp/customer/sale-simple-page',
    { params: normalizeCustomerSimplePageParams(params) },
  );
}

export function getCustomer(id: number) {
  return requestClient.get<ErpCustomerApi.Customer>(
    `/erp/customer/get?id=${id}`,
  );
}

export function getCustomerSalePriceLevel(id: number) {
  return requestClient.get<number | undefined>(
    `/erp/customer/sale-price-level?id=${id}`,
  );
}

export function createCustomer(data: ErpCustomerApi.Customer) {
  return requestClient.post<number>('/erp/customer/create', data);
}

export function updateCustomer(data: ErpCustomerApi.Customer) {
  return requestClient.put('/erp/customer/update', data);
}

export function recognizeCustomerBusinessLicense(
  data: ErpCustomerApi.BusinessLicenseOcrReq,
) {
  return requestClient.post<ErpCustomerApi.BusinessLicenseOcrResp>(
    '/erp/customer/business-license/recognize',
    data,
  );
}

export function getCustomerDeptDistribution(id: number) {
  return requestClient.get<ErpCustomerApi.DeptDistribution>(
    `/erp/customer/dept-distribution?id=${id}`,
  );
}

export function getCustomerSaleDeptList(customerId: number) {
  return requestClient.get<ErpCustomerApi.SaleDept[]>(
    `/erp/customer/sale-dept-list?customerId=${customerId}`,
  );
}

export function updateCustomerDeptDistribution(
  data: ErpCustomerApi.DeptDistribution,
) {
  return requestClient.put('/erp/customer/dept-distribution', data);
}

export function getCustomerDeptCredit(id: number) {
  return requestClient.get<ErpCustomerApi.CustomerDeptCredit>(
    `/erp/customer/dept-credit?id=${id}`,
  );
}

export function updateCustomerDeptCredit(
  data: ErpCustomerApi.CustomerDeptCredit,
) {
  return requestClient.put('/erp/customer/dept-credit', data);
}

export function batchDisableCustomer(ids: number[]) {
  return requestClient.put('/erp/customer/batch-disable', { ids });
}

export function restoreCustomer(ids: number[]) {
  return requestClient.put('/erp/customer/restore', { ids });
}

export function mergeCustomer(data: { keepId: number; sourceId: number }) {
  return requestClient.put('/erp/customer/merge', data);
}

export function deleteCustomer(id: number) {
  return requestClient.delete(`/erp/customer/delete?id=${id}`);
}

export function deleteCustomerList(ids: number[]) {
  return requestClient.delete('/erp/customer/delete-list', {
    params: { ids: ids.join(',') },
  });
}

export function exportCustomer(params: any) {
  const exportParams = { ...params };
  if (Array.isArray(exportParams.ids)) {
    exportParams.ids = exportParams.ids.join(',');
  }
  return requestClient.download('/erp/customer/export-excel', {
    params: exportParams,
  });
}

export function getCustomerExportFields() {
  return requestClient.get<any[]>('/erp/customer/export-fields');
}

export function getCustomerContactList(customerId: number) {
  return requestClient.get<ErpCustomerApi.CustomerContact[]>(
    `/erp/customer-contact/list-by-customer?customerId=${customerId}`,
  );
}

export function createCustomerContact(data: ErpCustomerApi.CustomerContact) {
  return requestClient.post<number>('/erp/customer-contact/create', data);
}

export function updateCustomerContact(data: ErpCustomerApi.CustomerContact) {
  return requestClient.put('/erp/customer-contact/update', data);
}

export function deleteCustomerContact(id: number) {
  return requestClient.delete(`/erp/customer-contact/delete?id=${id}`);
}

export function getCustomerContractList(customerId: number) {
  return requestClient.get<ErpCustomerApi.CustomerContract[]>(
    `/erp/customer-contract/list-by-customer?customerId=${customerId}`,
  );
}

export function createCustomerContract(data: ErpCustomerApi.CustomerContract) {
  return requestClient.post<number>('/erp/customer-contract/create', data);
}

export function updateCustomerContract(data: ErpCustomerApi.CustomerContract) {
  return requestClient.put('/erp/customer-contract/update', data);
}

export function deleteCustomerContract(id: number) {
  return requestClient.delete(`/erp/customer-contract/delete?id=${id}`);
}

export function getCustomerImageList(customerId: number) {
  return requestClient.get<ErpCustomerApi.CustomerImage[]>(
    `/erp/customer-image/list-by-customer?customerId=${customerId}`,
  );
}

export function createCustomerImage(data: ErpCustomerApi.CustomerImage) {
  return requestClient.post<number>('/erp/customer-image/create', data);
}

export function updateCustomerImage(data: ErpCustomerApi.CustomerImage) {
  return requestClient.put('/erp/customer-image/update', data);
}

export function deleteCustomerImage(id: number) {
  return requestClient.delete(`/erp/customer-image/delete?id=${id}`);
}

export function getCustomerTaskList(customerId: number) {
  return requestClient.get<ErpCustomerApi.CustomerTask[]>(
    `/erp/customer-task/list-by-customer?customerId=${customerId}`,
  );
}

export function createCustomerTask(data: ErpCustomerApi.CustomerTask) {
  return requestClient.post<number>('/erp/customer-task/create', data);
}

export function updateCustomerTask(data: ErpCustomerApi.CustomerTask) {
  return requestClient.put('/erp/customer-task/update', data);
}

export function deleteCustomerTask(id: number) {
  return requestClient.delete(`/erp/customer-task/delete?id=${id}`);
}

export function getCustomerAreaList(customerId: number) {
  return requestClient.get<ErpCustomerApi.CustomerArea[]>(
    `/erp/customer-area/list-by-customer?customerId=${customerId}`,
  );
}

export function createCustomerArea(data: ErpCustomerApi.CustomerArea) {
  return requestClient.post<number>('/erp/customer-area/create', data);
}

export function updateCustomerArea(data: ErpCustomerApi.CustomerArea) {
  return requestClient.put('/erp/customer-area/update', data);
}

export function deleteCustomerArea(id: number) {
  return requestClient.delete(`/erp/customer-area/delete?id=${id}`);
}

export function getCustomerExtendList(customerId: number) {
  return requestClient.get<ErpCustomerApi.CustomerExtend[]>(
    `/erp/customer-extend/list-by-customer?customerId=${customerId}`,
  );
}

export function createCustomerExtend(data: ErpCustomerApi.CustomerExtend) {
  return requestClient.post<number>('/erp/customer-extend/create', data);
}

export function updateCustomerExtend(data: ErpCustomerApi.CustomerExtend) {
  return requestClient.put('/erp/customer-extend/update', data);
}

export function deleteCustomerExtend(id: number) {
  return requestClient.delete(`/erp/customer-extend/delete?id=${id}`);
}

export function getCustomerBusinessInfoList(customerId: number) {
  return requestClient.get<ErpCustomerApi.CustomerBusinessInfo[]>(
    `/erp/customer-business-info/list-by-customer?customerId=${customerId}`,
  );
}

export function createCustomerBusinessInfo(
  data: ErpCustomerApi.CustomerBusinessInfo,
) {
  return requestClient.post<number>('/erp/customer-business-info/create', data);
}

export function updateCustomerBusinessInfo(
  data: ErpCustomerApi.CustomerBusinessInfo,
) {
  return requestClient.put('/erp/customer-business-info/update', data);
}

export function deleteCustomerBusinessInfo(id: number) {
  return requestClient.delete(`/erp/customer-business-info/delete?id=${id}`);
}

export function getCustomerMemberList(customerId: number) {
  return requestClient.get<ErpCustomerApi.CustomerMember[]>(
    `/erp/customer-member/list-by-customer?customerId=${customerId}`,
  );
}

export function getCustomerMemberListByMember(memberUserId: number) {
  return requestClient.get<ErpCustomerApi.CustomerMember[]>(
    `/erp/customer-member/list-by-member?memberUserId=${memberUserId}`,
  );
}

export function createCustomerMember(
  data: ErpCustomerApi.CustomerMemberCreateReq,
) {
  return requestClient.post<number>('/erp/customer-member/create', data);
}

export function updateCustomerMemberStatus(
  data: ErpCustomerApi.CustomerMemberUpdateStatusReq,
) {
  return requestClient.put('/erp/customer-member/update-status', data);
}

export function deleteCustomerMember(id: number) {
  return requestClient.delete(`/erp/customer-member/delete?id=${id}`);
}

export function importCustomer(file: File) {
  return requestClient.upload<ErpCustomerApi.CustomerImportResult>(
    '/erp/customer/import',
    { file },
  );
}

export function getCustomerImportTemplate() {
  return requestClient.download('/erp/customer/get-import-template');
}

export function batchUpdateCustomer(data: {
  allowMultiDept?: boolean;
  deptId?: number;
  deptIds?: number[];
  developerUserId?: number;
  freightExplainId?: number;
  ids: number[];
  priceLevel?: number;
  remark?: string;
  routeId?: number;
  saleUserId?: number;
  status?: number;
}) {
  return requestClient.put('/erp/customer/batch-update', data);
}

export namespace ErpCustomerExtendInfoApi {
  export interface ExtendInfo {
    id?: number;
    customerId: number;
    // 1) 财务与结算信息
    advanceAmount?: number;
    baseAmount?: number;
    settleAccountId?: number;
    bankName2?: string;
    bankAccount2?: string;
    settleDay?: number;
    priceMarkupRate?: number;
    discountPriceLevel?: number;
    // 2) 销售与业绩信息
    monthlySaleTarget?: number;
    monthlyBusinessScale?: number;
    totalAssets?: number;
    pointsRate?: number;
    deliveryFee?: number;
    // 3) 法人与企业信息
    legalPerson?: string;
    legalPersonPhone?: string;
    boss?: string;
    bossPhone?: string;
    businessScope?: string;
    idCardNo?: string;
    extEmail?: string;
    // 4) 采购退货联系人信息
    purchaseReturnContact?: string;
    purchaseReturnPhone?: string;
    purchaseReturnAddress?: string;
    // 5) 系统与业务开关
    chainGroupId?: number;
    alternateCode?: string;
    generalDistributorId?: number;
    generateOutBill?: boolean;
    generateInBill?: boolean;
    autoConfirmReceiveDays?: number;
    internalDescription?: string;
    excludeStocking?: boolean;
    reconcileServiceUserId?: number;
    yijiaWangAccount?: string;
    createTime?: string;
  }
}

export function getCustomerExtendInfo(customerId: number) {
  return requestClient.get<ErpCustomerExtendInfoApi.ExtendInfo | null>(
    `/erp/customer-extend-info/get-by-customer?customerId=${customerId}`,
  );
}

export function saveCustomerExtendInfo(
  data: ErpCustomerExtendInfoApi.ExtendInfo,
) {
  return requestClient.put<number>('/erp/customer-extend-info/save', data);
}

export function getCustomerContactPage(params: {
  customerId: number;
  pageNo: number;
  pageSize: number;
  [key: string]: any;
}) {
  return requestClient.get<{
    list: ErpCustomerApi.CustomerContact[];
    total: number;
  }>('/erp/customer-contact/page', { params });
}

export function getCustomerContractPage(params: {
  customerId: number;
  pageNo: number;
  pageSize: number;
  [key: string]: any;
}) {
  return requestClient.get<{
    list: ErpCustomerApi.CustomerContract[];
    total: number;
  }>('/erp/customer-contract/page', { params });
}

export function getCustomerAreaPage(params: {
  customerId: number;
  pageNo: number;
  pageSize: number;
  [key: string]: any;
}) {
  return requestClient.get<{
    list: ErpCustomerApi.CustomerArea[];
    total: number;
  }>('/erp/customer-area/page', { params });
}

export function getCustomerImagePage(params: {
  customerId: number;
  pageNo: number;
  pageSize: number;
  [key: string]: any;
}) {
  return requestClient.get<{
    list: ErpCustomerApi.CustomerImage[];
    total: number;
  }>('/erp/customer-image/page', { params });
}

export function getCustomerTaskPage(params: {
  customerId: number;
  pageNo: number;
  pageSize: number;
  [key: string]: any;
}) {
  return requestClient.get<{
    list: ErpCustomerApi.CustomerTask[];
    total: number;
  }>('/erp/customer-task/page', { params });
}

export function getCustomerBusinessInfoPage(params: {
  customerId: number;
  pageNo: number;
  pageSize: number;
  [key: string]: any;
}) {
  return requestClient.get<{
    list: ErpCustomerApi.CustomerBusinessInfo[];
    total: number;
  }>('/erp/customer-business-info/page', { params });
}

export function getCustomerMemberPage(params: {
  customerId: number;
  pageNo: number;
  pageSize: number;
  [key: string]: any;
}) {
  return requestClient.get<{
    list: ErpCustomerApi.CustomerMember[];
    total: number;
  }>('/erp/customer-member/page', { params });
}

export function getCustomerFormDeptPage(params: any) {
  return requestClient.get<{ list: any[]; total: number }>(
    '/erp/customer/form-dept-simple-page',
    { params },
  );
}

export function getCustomerFilterDeptPage(params: any) {
  return requestClient.get<{ list: any[]; total: number }>(
    '/erp/customer/dept-simple-page',
    { params },
  );
}

export function getCustomerUserPage(params: any) {
  return requestClient.get<{ list: any[]; total: number }>(
    '/erp/customer/assignable-users-page',
    { params },
  );
}

export function getCustomerMergePage(params: any) {
  return requestClient.get<{ list: any[]; total: number }>(
    '/erp/customer/merge-simple-page',
    { params },
  );
}

export function getCustomerBaseOptionsPage(params: any) {
  return requestClient.get<{ list: any[]; total: number }>(
    '/erp/customer/base-options-page',
    { params },
  );
}

export function getCustomerFormDeptOptions() {
  return requestClient.get<any[]>('/erp/customer/form-dept-options');
}
export function downloadCustomerImportFailures(recordId: number) {
  return requestClient.download(
    '/erp/customer/import-failure-details/download',
    { params: { recordId } },
  );
}
