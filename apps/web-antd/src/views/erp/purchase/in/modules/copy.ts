import type { ErpPurchaseInApi } from '#/api/erp/purchase/in';
import type { ErpPurchaseOrderApi } from '#/api/erp/purchase/order';

export type PurchaseInCopySource = ErpPurchaseInApi.PurchaseIn & {
  customerId?: number;
  order?: ErpPurchaseOrderApi.PurchaseOrder;
};

const HEADER_COPY_BLOCKLIST = [
  'id',
  'no',
  'status',
  'inTime',
  'creator',
  'creatorName',
  'createTime',
  'updater',
  'updaterName',
  'updateTime',
  'adjusted',
  'hasInvoice',
  'returnCount',
  'returnStatus',
  'transferOutCount',
  'transferOutStatus',
  'hasStockInBill',
  'stockInBills',
  'order',
  'customerId',
  'feeAmount',
  'otherPrice',
];

const ITEM_COPY_BLOCKLIST = [
  'id',
  'adjusted',
  'adjustId',
  'hasInvoice',
  'returnCount',
  'returnStatus',
  'hasStockInBill',
  'stockInBillNos',
  'stockInBillStatus',
  'stockInBillStatusName',
  'stockInBillCount',
  'stockInBillPickedCount',
  'stockInBillRemainCount',
];

function clearFields(target: Record<string, any>, fields: string[]) {
  fields.forEach((field) => {
    target[field] = undefined;
  });
}

export function buildPurchaseInCopiedDraft(
  source: PurchaseInCopySource,
): PurchaseInCopySource {
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

  return draft as PurchaseInCopySource;
}
