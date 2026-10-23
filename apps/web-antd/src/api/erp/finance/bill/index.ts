import type { PageParam, PageResult } from '@vben/request';

import { financeDecimalRequestClient as requestClient } from '#/views/erp/finance/utils/finance-decimal-request';

export namespace ErpFinanceBillApi {
  export interface FinanceBill {
    id?: number;
    rowKey?: string;
    no?: string;
    billType: 'payment' | 'receipt';
    billTypeName?: string;
    status?: number;
    billTime?: Date;
    financeUserId?: number;
    financeUserName?: string;
    deptId?: number;
    deptName?: string;
    customerId?: number;
    customerName?: string;
    supplierId?: number;
    supplierName?: string;
    accountId?: number;
    accountName?: string;
    totalPrice?: number | string | null;
    discountPrice?: number | string | null;
    actualPrice?: number | string | null;
    bizNo?: string;
    remark?: string;
    creator?: string;
    creatorName?: string;
    createTime?: Date;
    updater?: string;
    updaterName?: string;
    updateTime?: Date;
  }
}

export function getFinanceBillPage(params: PageParam & Record<string, any>) {
  return requestClient.get<PageResult<ErpFinanceBillApi.FinanceBill>>(
    '/erp/finance-bill/page',
    { params },
  );
}

export function getFinanceBillDeptSimplePage(params: PageParam) {
  return requestClient.get<PageResult<any>>(
    '/erp/finance-bill/dept-simple-page',
    {
      params,
    },
  );
}
