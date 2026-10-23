const ERP_DOCUMENT_TAX_FIELDS = new Set([
  'taxPercent',
  'taxRate',
  'taxPrice',
  'totalTaxPrice',
  'taxAmount',
  'taxExclusiveAmount',
  'taxExclusivePrice',
  'taxInclusivePrice',
  'taxInclusiveAmount',
]);

export function stripErpDocumentTaxFields<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripErpDocumentTaxFields(item)) as T;
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  if (value instanceof Date || value instanceof File || value instanceof Blob) {
    return value;
  }
  const result: Record<string, unknown> = {};
  Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
    if (!ERP_DOCUMENT_TAX_FIELDS.has(key)) {
      result[key] = stripErpDocumentTaxFields(item);
    }
  });
  return result as T;
}
