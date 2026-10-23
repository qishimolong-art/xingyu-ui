import type { PageParam, PageResult } from '@vben/request';

import { requestClient } from '#/api/request';

export namespace ErpSupplierContactApi {
  export interface SupplierContact {
    id?: number;
    supplierId: number;
    name: string;
    salesperson?: boolean;
    telephone?: string;
    mobile: string;
    address?: string;
    email?: string;
    gender?: number;
    position?: string;
    companyId?: number;
    fax?: string;
    deptId?: number;
    importance?: number;
    commissionRate?: number;
    fixedCommission?: boolean;
    postCode?: string;
    qq?: string;
    birthday?: string;
    primaryContact?: boolean;
    receiverContact?: boolean;
    settleContact?: boolean;
    messageContact?: boolean;
    wechat?: string;
    wechatOfficialStatus?: number;
    orderAccess?: boolean;
    ecommerceAccess?: boolean;
    businessCardFrontUrl?: string;
    businessCardBackUrl?: string;
    lastContactTime?: string;
    status?: number;
    remark?: string;
    createTime?: string;
  }
}

export function getSupplierContactList(supplierId: number) {
  return requestClient.get<ErpSupplierContactApi.SupplierContact[]>(
    '/erp/supplier-contact/list',
    { params: { supplierId } },
  );
}

export function getSupplierContact(id: number) {
  return requestClient.get<ErpSupplierContactApi.SupplierContact>(
    `/erp/supplier-contact/get?id=${id}`,
  );
}

export function createSupplierContact(
  data: ErpSupplierContactApi.SupplierContact,
) {
  return requestClient.post('/erp/supplier-contact/create', data);
}

export function updateSupplierContact(
  data: ErpSupplierContactApi.SupplierContact,
) {
  return requestClient.put('/erp/supplier-contact/update', data);
}

export function deleteSupplierContact(id: number) {
  return requestClient.delete(`/erp/supplier-contact/delete?id=${id}`);
}

export function getSupplierContactPage(
  params: PageParam & { supplierId: number },
) {
  return requestClient.get<PageResult<ErpSupplierContactApi.SupplierContact>>(
    '/erp/supplier-contact/page',
    { params },
  );
}
