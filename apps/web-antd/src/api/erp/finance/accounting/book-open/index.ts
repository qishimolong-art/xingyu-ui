import type { PageParam, PageResult } from '@vben/request';

import { financeDecimalRequestClient as requestClient } from '#/views/erp/finance/utils/finance-decimal-request';

export namespace ErpBookOpenApi {
  /** 系统开账信息 */
  export interface BookOpen {
    id?: number;
    no?: string;
    chainName?: string;
    fiscalYear: number;
    period?: number;
    startDate?: string;
    opened?: boolean;
    operateTime?: string;
    operator?: string;
    operatorUserId?: number;
    voucherConfigs?: VoucherConfig[];
    createTime?: string;
  }

  /** 凭证类型勾选 */
  export interface VoucherConfig {
    id?: number;
    bookOpenId?: number;
    voucherType: number;
    voucherTypeName?: string;
    enabled: boolean;
    sort?: number;
  }

  /** 批量更新凭证类型勾选 */
  export interface UpdateVoucherConfigsReq {
    bookOpenId: number;
    items: Array<{
      voucherType: number;
      enabled: boolean;
      sort?: number;
    }>;
  }
}

/** 查询系统开账分页 */
export function getBookOpenPage(params: PageParam) {
  return requestClient.get<PageResult<ErpBookOpenApi.BookOpen>>(
    '/erp/book-open/page',
    { params },
  );
}

/** 查询系统开账详情 */
export function getBookOpen(id: number) {
  return requestClient.get<ErpBookOpenApi.BookOpen>(
    `/erp/book-open/get?id=${id}`,
  );
}

/** 新增系统开账 */
export function createBookOpen(data: ErpBookOpenApi.BookOpen) {
  return requestClient.post<number>('/erp/book-open/create', data);
}

/** 修改系统开账 */
export function updateBookOpen(data: ErpBookOpenApi.BookOpen) {
  return requestClient.put('/erp/book-open/update', data);
}

/** 删除系统开账 */
export function deleteBookOpen(id: number) {
  return requestClient.delete(`/erp/book-open/delete?id=${id}`);
}

/** 查询指定开账的凭证类型勾选列表 */
export function getVoucherConfigList(bookOpenId: number) {
  return requestClient.get<ErpBookOpenApi.VoucherConfig[]>(
    '/erp/book-open/voucher-config-list',
    { params: { bookOpenId } },
  );
}

/** 批量更新凭证类型勾选 */
export function updateVoucherConfigs(
  data: ErpBookOpenApi.UpdateVoucherConfigsReq,
) {
  return requestClient.put('/erp/book-open/update-voucher-configs', data);
}
