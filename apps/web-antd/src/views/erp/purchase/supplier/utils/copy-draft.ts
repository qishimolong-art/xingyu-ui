import type { ErpSupplierApi } from '#/api/erp/purchase/supplier';

import { CommonStatusEnum } from '@vben/constants';
import { cloneDeep } from '@vben/utils';

const CLEAN_KEYS = [
  'id',
  'code',
  'memberCode',
  'creator',
  'creatorName',
  'createTime',
  'updater',
  'updaterName',
  'updateTime',
];

function deleteKeys(target: Record<string, any>, keys: string[]) {
  for (const key of keys) {
    delete target[key];
  }
}

export function buildSupplierCopyDraft(source: ErpSupplierApi.Supplier) {
  const draft = cloneDeep(source) as Record<string, any>;
  deleteKeys(draft, CLEAN_KEYS);
  draft.status = CommonStatusEnum.ENABLE;
  return draft as ErpSupplierApi.Supplier;
}
