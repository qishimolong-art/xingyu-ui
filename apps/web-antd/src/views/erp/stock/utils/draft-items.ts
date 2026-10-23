function parseOptionalNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function hasValue(value: unknown) {
  return value !== null && value !== undefined && value !== '';
}

export function hasValidStockTransferDraftItems(items: any[] = []) {
  return items.some((item) => {
    const count = parseOptionalNumber(item?.count);
    return (
      hasValue(item?.productId) &&
      hasValue(item?.fromWarehouseId) &&
      count !== undefined &&
      count > 0
    );
  });
}

export function hasValidWarehouseMoveDraftItems(
  items: any[] = [],
  fromWarehouseId?: unknown,
  toWarehouseId?: unknown,
) {
  if (
    !hasValue(fromWarehouseId) ||
    !hasValue(toWarehouseId) ||
    fromWarehouseId === toWarehouseId
  ) {
    return false;
  }
  return items.some((item) => {
    const count = parseOptionalNumber(item?.count);
    return hasValue(item?.productId) && count !== undefined && count > 0;
  });
}

export function hasValidStockCheckDraftItems(
  items: any[] = [],
  checkType?: number,
) {
  const isCostCheck = checkType === 2;
  return items.some((item) => {
    if (!hasValue(item?.productId) || !hasValue(item?.warehouseId)) {
      return false;
    }
    const value = isCostCheck
      ? parseOptionalNumber(item?.totalPrice)
      : parseOptionalNumber(item?.count);
    return value !== undefined;
  });
}
