import type {
  PurchaseDocumentItemSortContext,
  PurchaseDocumentItemSortOrder,
} from '../../utils/document-item-table';

import {
  resolvePurchaseDocumentItemSortValue,
  sortPurchaseDocumentItems,
} from '../../utils/document-item-table';

export type PurchaseOrderItemSortContext = PurchaseDocumentItemSortContext;
export type PurchaseOrderItemSortOrder = PurchaseDocumentItemSortOrder;

export const resolvePurchaseOrderItemSortValue =
  resolvePurchaseDocumentItemSortValue;
export const sortPurchaseOrderItems = sortPurchaseDocumentItems;
