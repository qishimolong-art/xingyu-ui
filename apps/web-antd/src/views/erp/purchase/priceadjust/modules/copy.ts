import type { ErpPurchasePriceAdjustApi } from '#/api/erp/purchase/priceadjust';

function clearFields(target: Record<string, any>, fields: string[]) {
  fields.forEach((field) => {
    target[field] = undefined;
  });
}

const HEADER_COPY_BLOCKLIST = [
  'id',
  'no',
  'status',
  'creator',
  'creatorName',
  'createTime',
  'updater',
  'updaterName',
  'updateTime',
  'approveTime',
  'paymentPrice',
];

const ITEM_COPY_BLOCKLIST = ['id', 'adjustId'];

export function buildPurchasePriceAdjustCopyDraft(
  source: ErpPurchasePriceAdjustApi.PurchasePriceAdjust,
) {
  const draft = {
    ...(source as Record<string, any>),
    adjustTime: String(Date.now()),
    items: (source.items ?? []).map((item, index) => {
      const copiedItem = { ...(item as Record<string, any>) };
      clearFields(copiedItem, ITEM_COPY_BLOCKLIST);
      copiedItem.clientRowKey = undefined;
      copiedItem.seq = index + 1;
      return copiedItem;
    }),
  };

  clearFields(draft, HEADER_COPY_BLOCKLIST);

  return draft as ErpPurchasePriceAdjustApi.PurchasePriceAdjust;
}
