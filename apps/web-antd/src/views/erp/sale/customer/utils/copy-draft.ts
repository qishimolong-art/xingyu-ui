import { CommonStatusEnum } from '@vben/constants';
import { cloneDeep } from '@vben/utils';

import type { ErpCustomerApi } from '#/api/erp/sale/customer';

const CLEAN_KEYS = [
  'id',
  'code',
  'memberCode',
  'platformCode',
  'creator',
  'creatorName',
  'createTime',
  'updateTime',
  'followUpStatus',
  'contactLastTime',
  'contactLastContent',
  'contactNextTime',
  'lockStatus',
  'dealStatus',
  'poolDay',
  'ownerUserName',
  'ownerUserDept',
  'areaName',
  'totalSaleAmount',
  'receivableBalance',
  'lastSaleDate',
];

function deleteKeys(target: Record<string, any>, keys: string[]) {
  for (const key of keys) {
    delete target[key];
  }
}

export function buildCustomerCopyDraft(source: ErpCustomerApi.Customer) {
  const draft = cloneDeep(source) as Record<string, any>;
  deleteKeys(draft, CLEAN_KEYS);
  draft.status = CommonStatusEnum.ENABLE;
  return draft as ErpCustomerApi.Customer;
}
