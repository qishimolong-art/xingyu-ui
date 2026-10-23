function hasValue(value: unknown) {
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function parseOptionalNumber(value: unknown) {
  if (!hasValue(value)) {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function hasAmount(value: unknown) {
  return parseOptionalNumber(value) !== undefined;
}

export function hasValidFinancePaymentDraftItems(items: any[] = []) {
  return items.some(
    (item) =>
      item &&
      hasValue(item.bizType) &&
      hasValue(item.bizId) &&
      hasAmount(item.paymentPrice),
  );
}

export function hasValidFinanceReceiptDraftItems(items: any[] = []) {
  return items.some(
    (item) =>
      item &&
      hasValue(item.bizType) &&
      hasValue(item.bizId) &&
      hasAmount(item.receiptPrice),
  );
}

export function hasValidFinanceNamedAmountDraftItems(items: any[] = []) {
  return items.some(
    (item) => item && hasValue(item.itemName) && hasAmount(item.amount),
  );
}
