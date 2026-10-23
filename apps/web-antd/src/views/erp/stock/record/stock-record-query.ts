export type StockRecordQueryParams = Record<string, unknown>;

export function isEmptyStockRecordQueryValue(value: unknown) {
  return (
    value === undefined ||
    value === null ||
    value === '' ||
    (Array.isArray(value) && value.length === 0)
  );
}

export function cleanStockRecordQueryParams(
  params: StockRecordQueryParams = {},
) {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => !isEmptyStockRecordQueryValue(value),
    ),
  );
}

export function buildStockRecordQueryParams(
  formValues: StockRecordQueryParams = {},
  currentInitialParams: StockRecordQueryParams = {},
  options: { shouldUseInitialParams?: boolean } = {},
) {
  const cleanedFormValues = cleanStockRecordQueryParams(formValues);
  const hasFormWarehouseId = Object.prototype.hasOwnProperty.call(
    cleanedFormValues,
    'warehouseId',
  );
  const stockViewParams =
    currentInitialParams.stockView === true
      ? {
          productId: currentInitialParams.productId,
          stockView: true,
          warehouseId: hasFormWarehouseId
            ? cleanedFormValues.warehouseId
            : currentInitialParams.warehouseId,
          batchNo: currentInitialParams.batchNo,
          unassignedBatch: currentInitialParams.unassignedBatch,
        }
      : {};

  if (options.shouldUseInitialParams) {
    return cleanStockRecordQueryParams({
      ...currentInitialParams,
      ...cleanedFormValues,
      ...stockViewParams,
    });
  }
  return cleanStockRecordQueryParams({
    ...cleanedFormValues,
    ...stockViewParams,
  });
}
