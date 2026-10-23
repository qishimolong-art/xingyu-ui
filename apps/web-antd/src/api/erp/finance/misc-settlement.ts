import type { PageParam, PageResult } from '@vben/request';

import { financeDecimalRequestClient as requestClient } from '#/views/erp/finance/utils/finance-decimal-request';

export interface MiscSettlement {
  documentId: number;
  no?: string;
  bizTime?: string;
  amount?: null | number;
  accountName?: string;
  deptName?: string;
  handlerName?: string;
  status?: number;
  remark?: string;
}

export function getMiscSettlementPage(
  direction: 'payable' | 'receivable',
  params: PageParam & { id: number },
) {
  return requestClient.get<PageResult<MiscSettlement>>(
    `/erp/${direction}-misc/settlement-page`,
    { params },
  );
}
