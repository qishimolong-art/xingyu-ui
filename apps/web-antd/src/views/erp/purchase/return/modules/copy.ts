import type { ErpPurchaseReturnApi } from '#/api/erp/purchase/return';

const HEADER_COPY_BLOCKLIST = [
  'id',
  'no',
  'status',
  'returnTime',
  'creator',
  'creatorName',
  'createTime',
  'updater',
  'updaterName',
  'updateTime',
];

const ITEM_COPY_BLOCKLIST = [
  'id',
  'creator',
  'creatorName',
  'createTime',
  'updater',
  'updaterName',
  'updateTime',
];

function clearFields(target: Record<string, any>, fields: string[]) {
  fields.forEach((field) => {
    target[field] = undefined;
  });
}

export function buildPurchaseReturnCopiedDraft(
  source: ErpPurchaseReturnApi.PurchaseReturn,
): ErpPurchaseReturnApi.PurchaseReturn {
  const draft = {
    ...(source as Record<string, any>),
    items: (source.items ?? []).map((item, index) => {
      const copiedItem = { ...(item as Record<string, any>) };
      clearFields(copiedItem, ITEM_COPY_BLOCKLIST);
      copiedItem.clientRowKey = undefined;
      copiedItem.seq = item.seq ?? index + 1;
      return copiedItem;
    }),
  };

  clearFields(draft, HEADER_COPY_BLOCKLIST);

  return draft as ErpPurchaseReturnApi.PurchaseReturn;
}
