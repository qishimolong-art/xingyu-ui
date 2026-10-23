export interface FinanceQuerySummary {
  documentCount?: number;
  draftCount?: number;
  processCount?: number;
  approveCount?: number;
  totalPrice?: null | number;
  discountPrice?: null | number;
  receiptPrice?: null | number;
  paymentPrice?: null | number;
  transferPrice?: null | number;
  totalAmount?: null | number;
  amount?: null | number;
  settledAmount?: null | number;
  balanceAmount?: null | number;
  pendingTransferAmount?: null | number;
  transferAvailableAmount?: null | number;
  receivableAmount?: null | number;
  payableAmount?: null | number;
  outstandingAmount?: null | number;
  receivableBalance?: null | number;
  payableBalance?: null | number;
  offsetBalance?: null | number;
}
